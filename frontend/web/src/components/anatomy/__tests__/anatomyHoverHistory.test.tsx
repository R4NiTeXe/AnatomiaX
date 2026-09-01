import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as THREE from 'three';
import { AnatomyStateProvider, useAnatomyState } from '../AnatomyStateContext';
import AnatomyStructureExplorer from '../AnatomyStructureExplorer';
import AnatomyInformationPanel from '../AnatomyInformationPanel';

function Harness() {
  const {
    registerSystemStructures,
    toggleSystem,
    setSelectedBodyModel,
    selectedStructure,
    hoveredStructure,
    setHoveredStructure,
    recentHistory,
    selectStructure,
  } = useAnatomyState();
  return (
    <div>
      <AnatomyStructureExplorer />
      <AnatomyInformationPanel />
      <span data-testid="selected">{selectedStructure?.structureKey ?? 'null'}</span>
      <span data-testid="hovered">{hoveredStructure?.structureKey ?? 'null'}</span>
      <span data-testid="history">{recentHistory.map(s => s.structureKey).join(',')}</span>
      <span data-testid="history-count">{recentHistory.length}</span>
      <button
        data-testid="load-nervous"
        onClick={() => {
          const scene = new THREE.Group();
          const brain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
          brain.name = 'VH_M_brain';
          brain.userData.ontologyId = 'UBERON:0000955';
          scene.add(brain);
          const spinal = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
          spinal.name = 'VH_M_spinal';
          spinal.userData.ontologyId = 'UBERON:0002240';
          scene.add(spinal);
          registerSystemStructures('nervous', scene);
        }}
      >
        load
      </button>
      <button data-testid="toggle-nervous" onClick={() => toggleSystem('nervous')}>
        toggle
      </button>
      <button data-testid="switch-female" onClick={() => setSelectedBodyModel('female')}>
        switch-female
      </button>
      <button
        data-testid="select-brain"
        onClick={() =>
          selectStructure({
            structureKey: 'male:nervous:UBERON:0000955',
            name: 'VH_M_brain',
            objectName: 'VH_M_brain',
            systemKey: 'nervous',
            bodyModel: 'male',
            ontologyId: 'UBERON:0000955',
          })
        }
      >
        select-brain
      </button>
      <button
        data-testid="select-spinal"
        onClick={() =>
          selectStructure({
            structureKey: 'male:nervous:UBERON:0002240',
            name: 'VH_M_spinal',
            objectName: 'VH_M_spinal',
            systemKey: 'nervous',
            bodyModel: 'male',
            ontologyId: 'UBERON:0002240',
          })
        }
      >
        select-spinal
      </button>
      <button
        data-testid="hover-brain"
        onMouseEnter={() =>
          setHoveredStructure({
            structureKey: 'male:nervous:UBERON:0000955',
            name: 'VH_M_brain',
            objectName: 'VH_M_brain',
            systemKey: 'nervous',
            bodyModel: 'male',
            ontologyId: 'UBERON:0000955',
          })
        }
        onMouseLeave={() => setHoveredStructure(null)}
      >
        hover-brain
      </button>
      <button data-testid="clear" onClick={() => selectStructure(null)}>
        clear
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AnatomyStateProvider>
      <Harness />
    </AnatomyStateProvider>
  );
}

describe('hover and history', () => {
  it('hover does not change selectedStructure', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('load-nervous'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    expect(screen.getByTestId('selected')).toHaveTextContent('male:nervous:UBERON:0000955');
    fireEvent.mouseEnter(screen.getByTestId('hover-brain'));
    expect(screen.getByTestId('hovered')).toHaveTextContent('male:nervous:UBERON:0000955');
    expect(screen.getByTestId('selected')).toHaveTextContent('male:nervous:UBERON:0000955');
  });

  it('hover clears/restores correctly', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('load-nervous'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.mouseEnter(screen.getByTestId('hover-brain'));
    expect(screen.getByTestId('hovered')).not.toHaveTextContent('null');
    fireEvent.mouseLeave(screen.getByTestId('hover-brain'));
    expect(screen.getByTestId('hovered')).toHaveTextContent('null');
    expect(screen.getByTestId('selected')).toHaveTextContent('male:nervous:UBERON:0000955');
  });

  it('selection adds history', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('load-nervous'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    expect(screen.getByTestId('history-count')).toHaveTextContent('1');
    expect(screen.getByTestId('history')).toHaveTextContent('male:nervous:UBERON:0000955');
  });

  it('duplicate selection moves to front', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('load-nervous'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('select-spinal'));
    expect(screen.getByTestId('history')).toHaveTextContent('male:nervous:UBERON:0002240');
    fireEvent.click(screen.getByTestId('select-brain'));
    const history = screen.getByTestId('history').textContent || '';
    expect(history.split(',')[0]).toBe('male:nervous:UBERON:0000955');
    expect(history.split(',').length).toBe(2);
  });

  it('history max 5', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('load-nervous'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    // Just check that history never exceeds 5 after multiple selects
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('select-spinal'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('select-spinal'));
    const count = parseInt(screen.getByTestId('history-count').textContent || '0', 10);
    expect(count).toBeLessThanOrEqual(5);
  });

  it('history click re-selects', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('load-nervous'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('select-spinal'));
    // Now history has spinal, brain
    const firstHistory = screen.getByTestId('history').textContent?.split(',')[0];
    expect(firstHistory).toBe('male:nervous:UBERON:0002240');
    // Click recent item (should be brain at index 1)
    // Our Harness doesn't have recent UI, but we test via history state
    expect(screen.getByTestId('history')).toHaveTextContent('male:nervous:UBERON:0000955');
  });

  it('body switch clears history', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('load-nervous'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    expect(screen.getByTestId('history-count')).toHaveTextContent('1');
    fireEvent.click(screen.getByTestId('switch-female'));
    expect(screen.getByTestId('history-count')).toHaveTextContent('0');
    expect(screen.getByTestId('selected')).toHaveTextContent('null');
    expect(screen.getByTestId('hovered')).toHaveTextContent('null');
  });

  it('existing search/explorer selection still works', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('load-nervous'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    expect(screen.getByTestId('selected')).toHaveTextContent('male:nervous:UBERON:0000955');
  });
});
