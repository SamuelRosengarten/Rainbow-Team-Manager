import { Component } from 'react';
import { t } from '../i18n/index.js';

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
    // A class can't use the hook; this screen is only ever shown once, in the language at the time of the crash.
    return (
      <main className="screen" id="main">
        <section className="screen__card panel" role="alert">
          <h1 className="screen__title">{t('errorBoundary.title')}</h1>
          <p>{t('errorBoundary.body')}</p>
          <pre className="error-detail">{String(this.state.error?.message ?? this.state.error)}</pre>
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              {t('errorBoundary.reload')}
            </button>
          </div>
        </section>
      </main>
    );
  }
}
