import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as THREE from 'three';
import { AnatomyStateProvider, useAnatomyState } from '../components/AnatomyStateContext';
import AnatomySearchBox from '../components/AnatomySearchBox';

function Harness() {
  const { registerSystemStructures, visibleSystems, selectedStructure } = useAnatomyState();
  return (
    <div>
      <AnatomySearchBox />
      <button
        data-testid="load-nervous-male"
        onClick={() => {
          const scene = new THREE.Group();
          const brain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
          brain.name = 'VH_M_brain';
          brain.userData.ontologyId = 'UBERON:0000955';
          scene.add(brain);
          registerSystemStructures('nervous', scene);
        }}
      >
        load-nervous-male
      </button>
      <span data-testid="dbg-visible">{JSON.stringify(visibleSystems)}</span>
      <span data-testid="dbg-selected">{selectedStructure?.structureKey ?? 'null'}</span>
    </div>
  );
}

describe('AnatomySearchBox reveal (8.36)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });
  it('selecting a hidden-system result reveals the system', () => {
    render(
      <AnatomyStateProvider>
        <Harness />
      </AnatomyStateProvider>
    );
    fireEvent.click(screen.getByTestId('load-nervous-male'));
    expect(screen.getByTestId('dbg-visible').textContent).not.toContain('"nervous":true');
    fireEvent.change(screen.getByTestId('anatomy-search-input'), { target: { value: 'brain' } });
    expect(screen.getByTestId('anatomy-search-results')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('anatomy-search-option-0'));
    expect(screen.getByTestId('dbg-visible').textContent).toContain('"nervous":true');
    expect(screen.getByTestId('dbg-selected').textContent).toContain('nervous');
    expect(screen.queryByTestId('anatomy-search-results')).not.toBeInTheDocument();
  });
});
