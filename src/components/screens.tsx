import { useMemo, useState } from 'preact/hooks';
import { BIDS, MISERE, SUITS, SUIT_BIDS, TRICK_COUNTS } from '../lib/bids';
import { scoreHand, TRICKS_PER_HAND } from '../lib/scoring';
import type { Game, GameOutcome } from '../lib/game';
import type { Bid, BidId, Pair, TeamIndex, Teams } from '../lib/types';
import { bidLabel, bidLongLabel, isRedSuit, ordinal, signed, SUIT_NAME, SUIT_SYMBOL, teamName } from '../app/format';

/* ───────────────────────── Welcome ───────────────────────── */

export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div class="screen welcome">
      <img src="/img/cards.svg" alt="" class="welcome-art" width="320" height="225" />
      <h2 class="welcome-title">Keep score for 500</h2>
      <p class="lede">Four players, two teams. Enter the winning bid and the tricks each team took — we'll do the maths.</p>
      <button type="button" class="btn btn-primary btn-xl" onClick={onStart}>
        New game
      </button>
    </div>
  );
}

/* ───────────────────────── Setup ───────────────────────── */

const SEATS: { team: TeamIndex; label: string }[] = [
  { team: 0, label: 'Player 1' },
  { team: 0, label: 'Player 2' },
  { team: 1, label: 'Player 3' },
  { team: 1, label: 'Player 4' },
];

export function Setup({
  initialNames,
  onCancel,
  onSubmit,
}: {
  initialNames: string[];
  onCancel?: () => void;
  onSubmit: (teams: Teams, names: string[]) => void;
}) {
  const [names, setNames] = useState<string[]>(initialNames);
  const [touched, setTouched] = useState(false);
  const trimmed = names.map((n) => n.trim());
  const missing = trimmed.map((n) => n === '');
  const lower = trimmed.map((n) => n.toLowerCase());
  const dupes = lower.map((n, i) => n !== '' && lower.indexOf(n) !== i);
  const valid = !missing.some(Boolean) && !dupes.some(Boolean);

  const submit = (e: Event) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onSubmit([{ players: [trimmed[0], trimmed[1]] }, { players: [trimmed[2], trimmed[3]] }], trimmed);
  };

  return (
    <form class="screen setup" onSubmit={submit} noValidate>
      <h2 class="screen-title">Who's playing?</h2>
      <p class="lede">Partners sit opposite each other. All four names are required.</p>
      {[0, 1].map((team) => (
        <fieldset key={team} class={`team-card team-${team}`}>
          <legend>Team {team + 1}</legend>
          {SEATS.map((seat, i) =>
            seat.team !== team ? null : (
              <label key={i} class="field">
                <span class="field-label">{seat.label}</span>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint={i === 3 ? 'done' : 'next'}
                  maxLength={24}
                  placeholder="Name"
                  value={names[i]}
                  aria-invalid={touched && (missing[i] || dupes[i])}
                  onInput={(e) => {
                    const next = [...names];
                    next[i] = (e.currentTarget as HTMLInputElement).value;
                    setNames(next);
                  }}
                />
                {touched && missing[i] && <span class="field-error">Enter a name</span>}
                {touched && !missing[i] && dupes[i] && <span class="field-error">Names must be different</span>}
              </label>
            ),
          )}
        </fieldset>
      ))}
      <div class="actions">
        {onCancel && (
          <button type="button" class="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" class="btn btn-primary btn-grow" aria-disabled={!valid}>
          Start game
        </button>
      </div>
    </form>
  );
}

/* ───────────────────────── Bid ───────────────────────── */

export function BidScreen({
  game,
  round,
  bidder,
  bidId,
  onChange,
  onConfirm,
}: {
  game: Game;
  round: number;
  bidder: TeamIndex | null;
  bidId: BidId | null;
  onChange: (bidder: TeamIndex | null, bidId: BidId | null) => void;
  onConfirm: () => void;
}) {
  const ready = bidder !== null && bidId !== null;
  return (
    <div class="screen bid">
      <h2 class="screen-title">{ordinal(round)} hand</h2>

      <h3 class="question">Who won the bid?</h3>
      <div class="team-picker" role="radiogroup" aria-label="Winning team">
        {game.teams.map((t, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={bidder === i}
            class={`choice team-choice team-${i}${bidder === i ? ' is-selected' : ''}`}
            onClick={() => onChange(i as TeamIndex, bidId)}
          >
            <span>{t.players[0]}</span>
            <span class="amp">&amp;</span>
            <span>{t.players[1]}</span>
          </button>
        ))}
      </div>

      <h3 class="question">What was the bid?</h3>
      <div class="bid-grid" role="radiogroup" aria-label="Winning bid">
        <span class="bid-grid-corner" aria-hidden="true" />
        {SUITS.map((s) => (
          <span key={s} class={`bid-grid-head${isRedSuit(s) ? ' red' : ''}`} title={SUIT_NAME[s]} aria-hidden="true">
            {SUIT_SYMBOL[s]}
          </span>
        ))}
        {TRICK_COUNTS.map((n) => [
          <span key={`r${n}`} class="bid-grid-row" aria-hidden="true">
            {n}
          </span>,
          ...SUIT_BIDS.filter((b) => b.tricks === n).map((b) => (
            <BidCell key={b.id} bid={b} selected={bidId === b.id} onPick={() => onChange(bidder, b.id)} />
          )),
        ])}
        <BidCell bid={MISERE} selected={bidId === MISERE.id} onPick={() => onChange(bidder, MISERE.id)} wide />
      </div>

      <div class="actions sticky-actions">
        <button type="button" class="btn btn-primary btn-grow btn-xl" disabled={!ready} onClick={onConfirm}>
          {ready ? `Confirm ${bidLabel(BIDS.find((b) => b.id === bidId)!)} · ${game.teams[bidder!].players[0]} & ${game.teams[bidder!].players[1]}` : 'Pick a team and a bid'}
        </button>
      </div>
    </div>
  );
}

function BidCell({ bid, selected, onPick, wide }: { bid: Bid; selected: boolean; onPick: () => void; wide?: boolean }) {
  const red = bid.kind === 'suit' && isRedSuit(bid.suit);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${bidLongLabel(bid)}, ${bid.value} points`}
      class={`choice bid-cell${wide ? ' bid-cell-wide' : ''}${red ? ' red' : ''}${selected ? ' is-selected' : ''}`}
      onClick={onPick}
    >
      <span class="bid-cell-label">{bidLabel(bid)}</span>
      <span class="bid-cell-value">{bid.value}</span>
    </button>
  );
}

/* ───────────────────────── Tricks ───────────────────────── */

export function TricksScreen({
  game,
  round,
  bid,
  bidder,
  onBack,
  onRecord,
}: {
  game: Game;
  round: number;
  bid: Bid;
  bidder: TeamIndex;
  onBack: () => void;
  onRecord: (tricks: Pair<number>) => void;
}) {
  const opponent: TeamIndex = bidder === 0 ? 1 : 0;
  // Default: bidder takes exactly their contract (0 for misère).
  const [bidderTricks, setBidderTricks] = useState<number>(bid.kind === 'misere' ? 0 : bid.tricks);
  const tricks: Pair<number> = bidder === 0 ? [bidderTricks, TRICKS_PER_HAND - bidderTricks] : [TRICKS_PER_HAND - bidderTricks, bidderTricks];
  const result = useMemo(() => scoreHand(bid, bidder, tricks), [bid, bidder, bidderTricks]);

  const setFor = (team: TeamIndex, n: number) => {
    const clamped = Math.max(0, Math.min(TRICKS_PER_HAND, n));
    setBidderTricks(team === bidder ? clamped : TRICKS_PER_HAND - clamped);
  };

  return (
    <div class="screen tricks">
      <h2 class="screen-title">{ordinal(round)} hand</h2>
      <p class="contract">
        <span class={`bid-chip team-${bidder}`}>{bidLongLabel(bid)}</span>
        <span>
          bid by <strong>{teamName(game.teams[bidder])}</strong>
        </span>
        <button type="button" class="link" onClick={onBack}>
          change
        </button>
      </p>

      <h3 class="question">How many tricks did each team take?</h3>
      <p class="hint">Total must be {TRICKS_PER_HAND} — the other team updates automatically.</p>

      {[bidder, opponent].map((team) => (
        <div key={team} class={`trick-card team-${team}${team === bidder ? ' is-bidder' : ''}`}>
          <div class="trick-card-head">
            <span class="trick-team">{teamName(game.teams[team])}</span>
            <span class="trick-role">{team === bidder ? 'bidders' : 'opponents'}</span>
          </div>
          <div class="stepper">
            <button
              type="button"
              class="step"
              aria-label={`One fewer trick for ${teamName(game.teams[team])}`}
              disabled={tricks[team] <= 0}
              onClick={() => setFor(team, tricks[team] - 1)}
            >
              −
            </button>
            <output class="step-value" aria-live="polite">
              {tricks[team]}
            </output>
            <button
              type="button"
              class="step"
              aria-label={`One more trick for ${teamName(game.teams[team])}`}
              disabled={tricks[team] >= TRICKS_PER_HAND}
              onClick={() => setFor(team, tricks[team] + 1)}
            >
              +
            </button>
          </div>
          {team === bidder && (
            <div class="trick-chips" role="radiogroup" aria-label="Bidder tricks">
              {Array.from({ length: TRICKS_PER_HAND + 1 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={tricks[team] === n}
                  class={`chip${tricks[team] === n ? ' is-selected' : ''}`}
                  onClick={() => setFor(team, n)}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <div class={`preview ${result.made ? 'ok' : 'bad'}`} aria-live="polite">
        <strong>
          {result.made ? (result.slam ? 'Slam! Contract made' : 'Contract made') : 'Contract set'}
        </strong>
        <span>
          {game.teams.map((t, i) => (
            <span key={i} class="preview-delta">
              {t.players[0]} &amp; {t.players[1]} <b class={result.deltas[i] < 0 ? 'neg' : ''}>{signed(result.deltas[i])}</b>
            </span>
          ))}
        </span>
      </div>

      <div class="actions sticky-actions">
        <button type="button" class="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" class="btn btn-primary btn-grow btn-xl" onClick={() => onRecord(tricks)}>
          Record hand
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Win ───────────────────────── */

export function WinScreen({ game, outcome }: { game: Game; outcome: Exclude<GameOutcome, { status: 'in-progress' }> }) {
  return (
    <div class="screen win">
      <img src="/img/winners.svg" alt="" class="win-art" width="280" height="200" />
      {outcome.status === 'draw' ? (
        <h2 class="win-title">It's a draw!</h2>
      ) : (
        <>
          <h2 class="win-title">{teamName(game.teams[outcome.winner])} win!</h2>
          <p class="lede">
            {outcome.reason === 'reached-500'
              ? `Made their bid and reached ${outcome.finalScores[outcome.winner]}.`
              : `A team fell to −500 or below; highest score wins.`}
          </p>
        </>
      )}
      <p class="final-score">
        {outcome.finalScores[0]} – {outcome.finalScores[1]}
      </p>
    </div>
  );
}
