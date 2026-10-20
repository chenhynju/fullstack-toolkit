import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Card } from '@repo/ui';
import { releaseLabel } from '@repo/utils';
import './style.css';
function App() {
  const [label, setLabel] = useState('release-1');
  const [result, setResult] = useState('No report selected.');
  return (
    <main>
      <p className="eyebrow">FULLSTACK TOOLKIT / ENGINEERING LAB</p>
      <h1>Small apps. Strong delivery.</h1>
      <p>
        A minimal Vite consumer of shared components and strict TypeScript contracts. No product
        data or credentials.
      </p>
      <Card>
        <h2>Build report label</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              setResult('Ready: ' + releaseLabel(label));
            } catch {
              setResult('Invalid label. Use letters, digits or hyphens.');
            }
          }}
        >
          <label htmlFor="label">Release label</label>
          <input id="label" value={label} onChange={(event) => setLabel(event.target.value)} />
          <Button type="submit">Check label</Button>
        </form>
        <p role="status">{result}</p>
      </Card>
      <footer>React + Vite · Shared UI + utilities · Production-build acceptance</footer>
    </main>
  );
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(<App />);
