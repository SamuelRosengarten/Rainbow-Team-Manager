// Entry point of the in-game overlay window (overlay/index.html). Only the
// read-only screens are imported from here, so the strategy editor never
// ends up in the overlay bundle (noWrites.test.js checks the import graph).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import OverlayApp from './OverlayApp.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import '../theme.css';
import '../styles.css';
import '../tactical.css';
import './overlay.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <OverlayApp />
    </ErrorBoundary>
  </StrictMode>,
);
