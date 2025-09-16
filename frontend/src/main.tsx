import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

console.log('=== Main.tsx Starting ===')
console.log('React version:', React.version)
console.log('Document ready state:', document.readyState)

const rootElement = document.getElementById('root')
console.log('Root element:', rootElement)

if (rootElement) {
  try {
    console.log('Creating React root...')
    const root = ReactDOM.createRoot(rootElement)
    
    console.log('Rendering App component...')
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
    console.log('✅ React app rendered successfully')
  } catch (error) {
    console.error('❌ Error rendering React app:', error)
    // Fallback content
    rootElement.innerHTML = `
      <div style="padding: 20px; background: #ffe6e6; border: 1px solid #ff0000;">
        <h2>React Loading Error</h2>
        <p>Failed to load React app. Check console for details.</p>
        <pre>${error}</pre>
      </div>
    `
  }
} else {
  console.error('❌ Root element not found!')
}