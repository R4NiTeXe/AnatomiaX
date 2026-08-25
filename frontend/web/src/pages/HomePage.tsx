import { useState } from 'react';
import AnatomyCanvas from '@/components/anatomy/AnatomyCanvas';
import ModelSelector from '@/components/anatomy/ModelSelector';
import type { AnatomyModelKey } from '@/components/anatomy/anatomyAssets';

export default function HomePage(): JSX.Element {
  const [selectedModel, setSelectedModel] = useState<AnatomyModelKey | null>(null);

  return (
    <div style={{ minHeight: '100vh', background: '#0b1220' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem' }}>
        <header style={{ marginBottom: '1.25rem' }}>
          <h1
            style={{
              fontSize: '1.875rem',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              margin: 0,
            }}
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            AnatomiaX 3D Engine
          </h1>
          <p
            style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.6 }}
            className="mt-2 text-sm text-slate-400"
          >
            Development preview — React Three Fiber canvas with OrbitControls. Use drag to rotate,
            scroll to zoom, right-drag to pan.
          </p>
        </header>

        <div style={{ marginBottom: '1rem' }}>
          <p
            style={{
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
              color: '#64748b',
              marginBottom: '0.5rem',
            }}
          >
            MODEL SELECTOR — PLACEHOLDER
          </p>
          <ModelSelector selected={selectedModel} onSelect={setSelectedModel} />
          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#475569' }}>
            Male and female anatomy models are not yet available. The test object below proves the
            engine works.
          </p>
        </div>

        <AnatomyCanvas selectedModel={selectedModel} />

        <p
          style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#64748b' }}
          className="mt-4 text-xs text-slate-500"
        >
          Placeholder test object (icosahedron) proves the renderer works. No anatomy model yet.
          Future models will be lazy-loaded only when selected.
        </p>
      </div>
    </div>
  );
}
