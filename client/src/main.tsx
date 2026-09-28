import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// NOTE: StrictMode is intentionally omitted.
// React StrictMode double-invokes effects in development, which creates
// two Yjs WebSocket providers per tab. With TipTap's useEditor this is less
// problematic (it handles cleanup), but we keep this off for consistency.
createRoot(document.getElementById('root')!).render(<App />)
