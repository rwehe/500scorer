import { useState } from 'preact/hooks';
import { currentRound, getScores, isGameOver, type Game } from '../lib/game';
import { bidLabel, ordinal, signed } from '../app/format';

interface Props {
  game: Game;
  /** Highlight this team (e.g. the current bidder). */
  highlight?: 0 | 1 | null;
  onGoToHand?: (index: number) => void;
  onUndo?: () => void;
  /** Start with history open (win screen). */
  defaultOpen?: boolean;
}

/** Always-visible score strip with expandable hand history (rewind / undo). */
export function Scoreboard({ game, highlight = null, onGoToHand, onUndo, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const scores = getScores(game);
  const hands = game.hands;
  const leader = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;

  return (
    <section class="scoreboard" aria-label="Scoreboard">
      <div class="score-strip">
        {game.teams.map((t, i) => (
          <div
            key={i}
            class={`score-team${highlight === i ? ' is-highlight' : ''}${leader === i ? ' is-leader' : ''}`}
          >
            <span class="score-names">
              <span>{t.players[0]}</span>
              <span class="amp">&amp;</span>
              <span>{t.players[1]}</span>
            </span>
            <span class={`score-value${scores[i] < 0 ? ' is-negative' : ''}`}>{scores[i]}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        class="history-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          {hands.length === 0 ? 'No hands yet' : `${hands.length} hand${hands.length === 1 ? '' : 's'} played`}
          {' · '}
          {isGameOver(game) ? 'game over' : `${ordinal(currentRound(game))} hand next`}
        </span>
        <span class="chevron" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div class="history">
          {hands.length === 0 ? (
            <p class="history-empty">Scores will appear here after the first hand.</p>
          ) : (
            <table class="history-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Bid</th>
                  <th scope="col">{game.teams[0].players[0]} &amp; {game.teams[0].players[1]}</th>
                  <th scope="col">{game.teams[1].players[0]} &amp; {game.teams[1].players[1]}</th>
                  {onGoToHand && <th scope="col"><span class="sr-only">Rewind</span></th>}
                </tr>
              </thead>
              <tbody>
                <tr class="history-start">
                  <td>—</td>
                  <td>Start</td>
                  <td>0</td>
                  <td>0</td>
                  {onGoToHand && (
                    <td>
                      <button
                        type="button"
                        class="rewind"
                        title="Rewind to start (replay from hand 1)"
                        aria-label="Rewind to the start of the game"
                        onClick={() => onGoToHand(0)}
                      >
                        ↺
                      </button>
                    </td>
                  )}
                </tr>
                {hands.map((h, i) => (
                  <tr key={i} class={h.made ? 'made' : 'set'}>
                    <td>{h.round}</td>
                    <td class="history-bid">
                      <span class={`bid-chip team-${h.bidder}`}>{bidLabel(h.bid)}</span>
                      <span class={`made-flag ${h.made ? 'ok' : 'bad'}`}>
                        {h.made ? (h.slam ? 'slam' : 'made') : 'set'}
                      </span>
                    </td>
                    {h.finalScores.map((s, t) => (
                      <td key={t}>
                        <strong>{s}</strong>
                        <small class={h.deltas[t] < 0 ? 'neg' : ''}>
                          {signed(h.deltas[t])} · {h.tricks[t]}t
                        </small>
                      </td>
                    ))}
                    {onGoToHand && (
                      <td>
                        {i < hands.length - 1 && (
                          <button
                            type="button"
                            class="rewind"
                            title={`Rewind to after hand ${h.round} (replay hand ${h.round + 1})`}
                            aria-label={`Rewind to after hand ${h.round}`}
                            onClick={() => onGoToHand(i + 1)}
                          >
                            ↺
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {onUndo && hands.length > 0 && (
            <button type="button" class="btn btn-ghost btn-small undo" onClick={onUndo}>
              ↶ Undo last hand
            </button>
          )}
        </div>
      )}
    </section>
  );
}
