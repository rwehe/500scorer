import { useEffect, useState } from 'preact/hooks';
import { createGame, currentRound, getOutcome, goToHand, isGameOver, recordHand, undo, type Game } from '../lib/game';
import { getBid } from '../lib/bids';
import type { BidId, Pair, TeamIndex, Teams } from '../lib/types';
import {
  archiveActive,
  gameFromPast,
  loadActiveGame,
  loadInstallDismissed,
  loadNames,
  loadPastGames,
  newId,
  pastEntryMatches,
  removePastGame,
  renamePastGame,
  saveActiveGame,
  saveInstallDismissed,
  saveNames,
  savePastGames,
  summarizePastGame,
  toPastEntry,
  type ActiveGame,
  type PastGameEntry,
} from '../app/persist';
import { isIos, isStandalone, type InstallPromptEvent } from '../app/install';
import { Scoreboard } from './Scoreboard';
import { BidScreen, InstallHint, PastGames, Setup, TricksScreen, Welcome, WinScreen } from './screens';

type Step = 'welcome' | 'setup' | 'play' | 'past';

interface Draft {
  bidder: TeamIndex | null;
  bidId: BidId | null;
  /** true once the bid is confirmed and we're entering tricks. */
  confirmed: boolean;
}

const EMPTY_DRAFT: Draft = { bidder: null, bidId: null, confirmed: false };

export default function App() {
  // Rendered with client:only, so localStorage is available on first render.
  const [active, setActive] = useState<ActiveGame | null>(() => loadActiveGame());
  const [past, setPast] = useState<PastGameEntry[]>(() => loadPastGames());
  const [step, setStep] = useState<Step>(() => (active ? 'play' : 'welcome'));
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [menuOpen, setMenuOpen] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(() => loadInstallDismissed());
  const [standalone, setStandalone] = useState(() => isStandalone());

  const game = active?.game ?? null;

  useEffect(() => saveActiveGame(active), [active]);
  useEffect(() => savePastGames(past), [past]);
  useEffect(() => window.scrollTo({ top: 0 }), [step, draft.confirmed, game?.hands.length]);

  // File a finished game immediately, and keep a snapshot in sync once it has been archived.
  useEffect(() => {
    if (!active) return;
    const over = isGameOver(active.game);
    setPast((list) => {
      const tracked = list.some((entry) => entry.id === active.id);
      if (!over && !tracked) return list;
      return archiveActive(list, active);
    });
  }, [active]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const update = (next: Game) => {
    if (!active) return;
    setActive({ id: active.id, game: next });
    setDraft(EMPTY_DRAFT);
  };

  const parkActive = () => {
    if (!active || active.game.hands.length === 0) return;
    setPast((list) => archiveActive(list, active));
  };

  const confirmLeave = (message: string) => {
    if (!game || game.hands.length === 0 || isGameOver(game)) return true;
    return confirm(message);
  };

  const startGame = (teams: Teams, names: string[]) => {
    saveNames(names);
    setActive({ id: newId(), game: createGame(teams) });
    setDraft(EMPTY_DRAFT);
    setStep('play');
  };

  const newGameSamePlayers = () => {
    if (!active) return;
    if (!confirmLeave('Save this game to Past games and start again with the same teams?')) return;
    parkActive();
    setActive({ id: newId(), game: createGame(active.game.teams) });
    setDraft(EMPTY_DRAFT);
    setStep('play');
    setMenuOpen(false);
  };

  const newGameNewPlayers = () => {
    if (!confirmLeave('Save this game to Past games and set up new players?')) return;
    parkActive();
    setMenuOpen(false);
    setDraft(EMPTY_DRAFT);
    setStep('setup');
  };

  const handleUndo = () => {
    if (!game || game.hands.length === 0) return;
    update(undo(game));
    setMenuOpen(false);
  };

  const handleGoToHand = (index: number) => {
    if (!game) return;
    const dropped = game.hands.length - index;
    if (dropped <= 0) return;
    if (!confirm(`Rewind and discard the last ${dropped} hand${dropped === 1 ? '' : 's'}?`)) return;
    update(goToHand(game, index));
  };

  const handleRecord = (tricks: Pair<number>) => {
    if (!game || draft.bidder === null || draft.bidId === null) return;
    update(recordHand(game, { bid: draft.bidId, bidder: draft.bidder, tricks }));
  };

  const openPastList = () => {
    setMenuOpen(false);
    setStep('past');
  };

  const closePast = () => setStep(game ? 'play' : 'welcome');

  const openPastGame = (id: string) => {
    if (active?.id === id) {
      setDraft(EMPTY_DRAFT);
      setStep('play');
      return;
    }
    const entry = past.find((item) => item.id === id);
    if (!entry) return;
    const next = gameFromPast(entry);
    if (!next) {
      setPast((list) => removePastGame(list, id));
      return;
    }
    if (game && game.hands.length > 0 && !isGameOver(game)) {
      if (!confirm('Save this game to Past games and open the other one?')) return;
      parkActive();
    }
    setActive({ id: entry.id, game: next });
    setDraft(EMPTY_DRAFT);
    setStep('play');
  };

  const renamePast = (id: string, title: string) => {
    setPast((list) => renamePastGame(list, id, title, new Date().toISOString()));
  };

  const deletePast = (id: string) => {
    const entry = past.find((item) => item.id === id);
    const label = entry ? (summarizePastGame(entry)?.displayTitle ?? 'this game') : 'this game';
    if (!confirm(`Delete ${label} from Past games? The game is only stored on this device.`)) return;
    setPast((list) => removePastGame(list, id));
  };

  const saveToPast = () => {
    if (!active || active.game.hands.length === 0) return;
    setPast((list) => archiveActive(list, active));
    setMenuOpen(false);
  };

  const promptInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'accepted') setStandalone(true);
    setMenuOpen(false);
  };

  const dismissInstall = () => {
    saveInstallDismissed();
    setInstallDismissed(true);
  };

  const outcome = game ? getOutcome(game) : null;
  const inPlay = step === 'play' && game && active;
  const setupNames =
    step === 'setup' && game ? [...game.teams[0].players, ...game.teams[1].players] : (loadNames() ?? ['', '', '', '']);
  const savedAlready = active ? pastEntryMatches(past.find((entry) => entry.id === active.id), active) : false;
  const summaries = past
    .map((entry) => {
      if (active && active.id === entry.id && active.game.hands.length > 0) {
        return summarizePastGame(toPastEntry(active, entry, entry.updatedAt));
      }
      return summarizePastGame(entry);
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const showInstallHint = !standalone && !installDismissed && (installEvent !== null || isIos());

  return (
    <div class="app">
      <header class="topbar">
        <h1 class="brand">
          <span class="brand-suit" aria-hidden="true">
            ♠
          </span>{' '}
          500 Scorer
        </h1>
        {game && (
          <button
            type="button"
            class="icon-btn"
            aria-label="Game menu"
            aria-controls="game-menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>
        )}
      </header>

      {menuOpen && game && (
        <>
          <div class="scrim" onClick={() => setMenuOpen(false)} />
          <nav id="game-menu" class="menu" aria-label="Game menu">
            <button type="button" class="menu-item" onClick={openPastList}>
              Past games{past.length > 0 ? ` (${past.length})` : ''}
            </button>
            <button type="button" class="menu-item" disabled={game.hands.length === 0 || savedAlready} onClick={saveToPast}>
              {savedAlready ? 'Saved to past games' : 'Save to past games'}
            </button>
            <button type="button" class="menu-item" onClick={newGameSamePlayers}>
              New game · same players
            </button>
            <button type="button" class="menu-item" onClick={newGameNewPlayers}>
              New game · new players
            </button>
            <button type="button" class="menu-item" disabled={game.hands.length === 0} onClick={handleUndo}>
              Undo last hand
            </button>
            {installEvent && !standalone && (
              <button type="button" class="menu-item" onClick={promptInstall}>
                Install app
              </button>
            )}
            {isIos() && !standalone && !installDismissed && !installEvent && (
              <p class="menu-note">To install, open the Safari Share menu and tap Add to Home Screen.</p>
            )}
            <button type="button" class="menu-item menu-close" onClick={() => setMenuOpen(false)}>
              Close
            </button>
          </nav>
        </>
      )}

      {inPlay && (
        <Scoreboard
          game={game}
          highlight={draft.bidder}
          onGoToHand={handleGoToHand}
          onUndo={handleUndo}
          defaultOpen={outcome?.status !== 'in-progress'}
          key={outcome?.status}
        />
      )}

      <main class="content">
        {step === 'welcome' && (
          <>
            <Welcome onStart={() => setStep('setup')} onPast={openPastList} pastCount={past.length} />
            {showInstallHint && (
              <InstallHint canInstall={installEvent !== null} onInstall={promptInstall} onDismiss={dismissInstall} />
            )}
          </>
        )}

        {step === 'setup' && (
          <Setup
            key="setup"
            initialNames={setupNames}
            onCancel={game ? () => setStep('play') : () => setStep('welcome')}
            onSubmit={startGame}
          />
        )}

        {step === 'past' && (
          <PastGames games={summaries} onBack={closePast} onOpen={openPastGame} onRename={renamePast} onDelete={deletePast} />
        )}

        {inPlay && outcome && outcome.status !== 'in-progress' && (
          <>
            <WinScreen game={game} outcome={outcome} />
            <div class="actions stacked">
              <button type="button" class="btn btn-primary btn-xl" onClick={newGameSamePlayers}>
                New game · same players
              </button>
              <button type="button" class="btn btn-ghost" onClick={newGameNewPlayers}>
                New game · new players
              </button>
              <button type="button" class="btn btn-ghost" onClick={openPastList}>
                Past games
              </button>
              <button type="button" class="btn btn-ghost btn-small" onClick={handleUndo}>
                ↶ Undo last hand
              </button>
            </div>
          </>
        )}

        {inPlay && outcome?.status === 'in-progress' && !draft.confirmed && (
          <BidScreen
            game={game}
            round={currentRound(game)}
            bidder={draft.bidder}
            bidId={draft.bidId}
            onChange={(bidder, bidId) => setDraft({ bidder, bidId, confirmed: false })}
            onConfirm={() => setDraft({ ...draft, confirmed: true })}
          />
        )}

        {inPlay && outcome?.status === 'in-progress' && draft.confirmed && draft.bidder !== null && draft.bidId && (
          <TricksScreen
            key={`${currentRound(game)}-${draft.bidder}-${draft.bidId}`}
            game={game}
            round={currentRound(game)}
            bid={getBid(draft.bidId)}
            bidder={draft.bidder}
            onBack={() => setDraft({ ...draft, confirmed: false })}
            onRecord={handleRecord}
          />
        )}
      </main>
    </div>
  );
}
