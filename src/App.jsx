import PlanView from './components/PlanView.jsx';
import { useTeamState } from './state/useTeamState.js';

export default function App() {
  const { state: team, update } = useTeamState();
  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="brand">
          <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 3 27 8.5v8.5c0 6-4.5 9.5-11 12-6.5-2.5-11-6-11-12V8.5z" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="16" cy="16" r="3.5" fill="currentColor" />
          </svg>
          <span className="brand__name">R6 Team Planner</span>
        </div>
      </header>
      <main id="main" className="main">
        <PlanView team={team} updateTeam={update} />
      </main>
    </div>
  );
}
