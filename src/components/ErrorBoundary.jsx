import { Component } from 'react';

/** Last line of defence: show a message instead of a blank page. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="screen" id="main">
        <section className="screen__card panel" role="alert">
          <h1 className="screen__title">Something broke</h1>
          <p>The planner hit an unexpected error. Reloading usually fixes it.</p>
          <pre className="error-detail">{String(this.state.error?.message ?? this.state.error)}</pre>
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </section>
      </main>
    );
  }
}
