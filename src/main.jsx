// ── CRITICAL: setup-db MUST be the very first import ──
// It sets globalThis.__B44_DB__ before any component code runs
import '@/setup-db.js';

import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
