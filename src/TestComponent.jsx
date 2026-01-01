import React from 'react';

export default function TestComponent() {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0' }}>
      <h1>Test Component Works!</h1>
      <p>If you see this, React is rendering correctly.</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}