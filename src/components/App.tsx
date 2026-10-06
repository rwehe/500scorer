import { useEffect, useState } from 'preact/hooks';
import { createGame, currentRound, getOutcome, goToHand, recordHand, undo, type Game } from '../lib/game';
import { getBid } from '../lib/bids';
import type { BidId, Pair, TeamIndex, Teams } from '../lib/types';
import { loadGame, loadNames, saveGame, saveNames } from '../app/persist';
import { Scoreboard } from './Scoreboard';
import { BidScreen, Setup, TricksScreen, Welcome, WinScreen } from './screens';

type Step = 'welcome' | 'setup' | 'play';

interface Draft {
  bidder: TeamIndex | null;
  bidId: BidId | null;
  /** true once the bid is confirmed and we're entering tricks. */
  confirmed: boolean;
}

const EMPTY_DRAFT: Draft = { bidder: null, bidId: null, confirmed: false };

export default function App() {
  // Rendered with client:only, so localStorage is available on first render.
  const [game, setGame] = useState<Game | null>(() => loadGame());
  const [step, setStep] = useState<Step>(() => (game ? 'play' : 'welcome'));
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => saveGame(game), [game]);
  useEffect(() => window.scrollTo({ top: 0 }), [step, draft.confirmed, game?.hands.length]);

  const update = (next: Game) => {
    setGame(next);
    setDraft(EMPTY_DRAFT);
  };

  const startGame = (teams: Teams, names: string[]) => {
    saveNames(names);
    update(createGame(teams));
    setStep('play');
  };

  const newGameSamePlayers = () => {
    if (!game) return;
    if (game.hands.length > 0 && getOutcome(game).status === 'in-progress') {
      if (!confirm('Abandon this game and start again with the same teams?')) return;
    }
    update(createGame(game.teams));
    setStep('play');
    setMenuOpen(false);
  };

  const newGameNewPlayers = () => {
    if (game && game.hands.length > 0 && getOutcome(game).status === 'in-progress') {
      if (!confirm('Abandon this game and set up new players?')) return;
    }
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

  const outcome = game ? getOutcome(game) : null;
  const inPlay = step === 'play' && game;
  const setupNames =
    step === 'setup' && game
      ? [...game.teams[0].players, ...game.teams[1].players]
      : (loadNames() ?? ['', '', '', '']);

  return (
    <div class="app">
      <header class="topbar">
        <h1 class="brand">
          <span class="brand-suit" aria-hidden="true">♠</span> 500 Scorer
        </h1>
        {game && (
          <button
            type="button"
            class="icon-btn"
            aria-label="Game menu"
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
          <nav class="menu" aria-label="Game menu">
            <button type="button" class="menu-item" onClick={newGameSamePlayers}>
              New game · same players
            </button>
            <button type="button" class="menu-item" onClick={newGameNewPlayers}>
              New game · new players
            </button>
            <button type="button" class="menu-item" disabled={game.hands.length === 0} onClick={handleUndo}>
              Undo last hand
            </button>
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
        {step === 'welcome' && <Welcome onStart={() => setStep('setup')} />}

        {step === 'setup' && (
          <Setup
            key="setup"
            initialNames={setupNames}
            onCancel={game ? () => setStep('play') : () => setStep('welcome')}
            onSubmit={startGame}
          />
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
