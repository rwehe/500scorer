import { useState } from 'preact/hooks';
import type { Teams } from '../lib/types';

const initialTeams: Teams = [
  { players: ['Player 1', 'Player 3'], score: 0 },
  { players: ['Player 2', 'Player 4'], score: 0 },
];

/** M0 placeholder island — real game flow lands in later milestones. */
export default function App() {
  const [teams] = useState<Teams>(initialTeams);
  return (
    <main>
      <h1>500 Scorer</h1>
      <p>4 players · 2 teams of 2</p>
      <ul class="teams">
        {teams.map((t, i) => (
          <li key={i}>
            <strong>Team {i + 1}</strong>: {t.players.join(' & ')} — {t.score}
          </li>
        ))}
      </ul>
    </main>
  );
}
