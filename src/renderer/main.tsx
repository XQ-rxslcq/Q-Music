import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

window.addEventListener('error', (e) => {
  console.error('[Q-Music renderer error]', e.message, e.filename, e.lineno)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Q-Music renderer rejection]', e.reason)
})

if (!window.qmusic) {
  console.error('[Q-Music] preload API missing: window.qmusic is undefined')
}

// Electron 下不用 StrictMode：双挂载会竞态写回默认 theme.json
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
