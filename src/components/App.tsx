import { useState } from 'preact/hooks';
import { createGame, getScores } from '../lib/game';

/** M0/M1 placeholder island — real game flow lands in M2. */
export default function App() {
  const [game] = useState(() =>
    createGame([{ players: ['Player 1', 'Player 3'] }, { players: ['Player 2', 'Player 4'] }]),
  );
  const scores = getScores(game);
  return (
    <main>
      <h1>500 Scorer</h1>
      <p>4 players · 2 teams of 2</p>
      <ul class="teams">
        {game.teams.map((t, i) => (
          <li key={i}>
            <strong>Team {i + 1}</strong>: {t.players.join(' & ')} — {scores[i]}
          </li>
        ))}
      </ul>
    </main>
  );
}
