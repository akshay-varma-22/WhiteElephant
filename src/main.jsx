import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const root = document.getElementById('root');
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// In the published site the page's HTML is already in #root (written at build time by scripts/prerender.mjs), so React takes that HTML over
// instead of building it again. In `npm run dev` #root is empty and the page is built here as before.
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
