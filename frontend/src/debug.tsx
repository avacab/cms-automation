import React from 'react'
import ReactDOM from 'react-dom/client'

// Simple test component
function DebugApp() {
  console.log('DebugApp component rendered')
  return (
    <div style={{padding: '20px', background: '#f0f0f0'}}>
      <h1>🐛 Debug Test</h1>
      <p>If you see this, React is working!</p>
      <p>Current time: {new Date().toLocaleTimeString()}</p>
    </div>
  )
}

console.log('Debug script starting...')
console.log('Document ready state:', document.readyState)
console.log('Root element:', document.getElementById('root'))

const rootElement = document.getElementById('root')
if (rootElement) {
  console.log('Root element found, creating React root...')
  try {
    const root = ReactDOM.createRoot(rootElement)
    console.log('React root created, rendering...')
    root.render(<DebugApp />)
    console.log('Render called successfully')
  } catch (error) {
    console.error('Error creating/rendering React root:', error)
  }
} else {
  console.error('Root element not found!')
}