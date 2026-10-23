import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App.jsx';

/**
 * Used only at build time (scripts/prerender.mjs): renders the whole page to HTML so the text is already in the page a visitor,
 * a search engine or an AI crawler receives, before any JavaScript runs. The browser then takes that HTML over (see main.jsx).
 * Everything that needs a browser (window, document, observers) lives inside effects, which never run here.
 */
export function render() {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
