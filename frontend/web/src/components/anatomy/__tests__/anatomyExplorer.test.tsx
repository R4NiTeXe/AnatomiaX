import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as THREE from 'three';
import { AnatomyStateProvider, useAnatomyState } from '../AnatomyStateContext';
import AnatomyStructureExplorer from '../AnatomyStructureExplorer';

function Harness() {
  const { registerSystemStructures, toggleSystem, setSelectedBodyModel, visibleSystems } =
    useAnatomyState();
  return (
    <div>
      <AnatomyStructureExplorer />
      <button
        data-testid="load-nervous-male"
        onClick={() => {
          const scene = new THREE.Group();
          const brain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
          brain.name = 'VH_M_brain';
          brain.userData.ontologyId = 'UBERON:0000955';
          scene.add(brain);
          const spinal = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
          spinal.name = 'VH_M_spinal_cord';
          spinal.userData.ontologyId = 'UBERON:0002240';
          scene.add(spinal);
          registerSystemStructures('nervous', scene);
        }}
      >
        load-nervous-male
      </button>
      <button
        data-testid="load-musculoskeletal-male"
        onClick={() => {
          const scene = new THREE.Group();
          const femur = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
          femur.name = 'VH_M_femur';
          femur.userData.ontologyId = 'FMA:24474';
          scene.add(femur);
          registerSystemStructures('musculoskeletal', scene);
        }}
      >
        load-musc-male
      </button>
      <button
        data-testid="load-nervous-female"
        onClick={() => {
          const scene = new THREE.Group();
          const brain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
          brain.name = 'VH_F_brain';
          brain.userData.ontologyId = 'UBERON:0000955';
          scene.add(brain);
          registerSystemStructures('nervous', scene);
        }}
      >
        load-nervous-female
      </button>
      <button data-testid="toggle-nervous" onClick={() => toggleSystem('nervous')}>
        toggle-nervous
      </button>
      <button data-testid="switch-female" onClick={() => setSelectedBodyModel('female')}>
        switch-female
      </button>
      <span data-testid="visible">{JSON.stringify(visibleSystems)}</span>
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

describe('AnatomyStructureExplorer', () => {
  it('initial shows only loaded Skin or empty', () => {
    renderWithProvider();
    // Skin is loaded by default? Actually skin is visible but not yet registered until GLB loads.
    // In test, no GLB, so explorer should show empty
    expect(screen.getByTestId('anatomy-explorer')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-explorer-empty')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-explorer-empty')).toHaveTextContent(/No structures loaded/);
  });

  it('loaded-only: structures appear after system load', () => {
    renderWithProvider();
    expect(screen.getByTestId('anatomy-explorer-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('load-nervous-male'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    expect(screen.queryByTestId('anatomy-explorer-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('anatomy-explorer-list')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-explorer-option-0')).toBeInTheDocument();
  });

  it('body-model filtering: only selected bodyModel structures', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('load-nervous-male'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    expect(screen.getByTestId('anatomy-explorer-option-0')).toHaveTextContent(/VH_M_brain/);
    fireEvent.click(screen.getByTestId('switch-female'));
    // After switch, male structures cleared, explorer should be empty until female load
    expect(screen.getByTestId('anatomy-explorer-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('load-nervous-female'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    expect(screen.getByTestId('anatomy-explorer-option-0')).toHaveTextContent(/VH_F_brain/);
  });

  it('filter matching: Filter structures... by name/objectName case-insensitive', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('load-nervous-male'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    // Two structures: brain and spinal cord
    expect(screen.getAllByTestId(/anatomy-explorer-option-/).length).toBe(2);
    const input = screen.getByTestId('anatomy-explorer-filter');
    fireEvent.change(input, { target: { value: 'brain' } });
    expect(screen.getAllByTestId(/anatomy-explorer-option-/).length).toBe(1);
    expect(screen.getByTestId('anatomy-explorer-option-0')).toHaveTextContent(/brain/i);
    fireEvent.change(input, { target: { value: 'spinal' } });
    expect(screen.getAllByTestId(/anatomy-explorer-option-/).length).toBe(1);
    expect(screen.getByTestId('anatomy-explorer-option-0')).toHaveTextContent(/spinal/i);
    fireEvent.change(input, { target: { value: 'XYZ' } });
    expect(screen.getByTestId('anatomy-explorer-empty')).toHaveTextContent(/No matching/);
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getAllByTestId(/anatomy-explorer-option-/).length).toBe(2);
  });

  it('system visibility filtering: Hide system → its structures disappear', () => {
    renderWithProvider();
    // Make nervous visible before loading
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('load-nervous-male'));
    expect(screen.getAllByTestId(/anatomy-explorer-option-/).length).toBe(2);
    const countBefore = screen.getAllByTestId(/anatomy-explorer-option-/).length;
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    const countAfterHide = screen.queryAllByTestId(/anatomy-explorer-option-/).length;
    expect(countAfterHide).toBeLessThan(countBefore);
    expect(countAfterHide).toBe(0);
  });

  it('selection callback: click structure selects via existing selectStructure', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('load-nervous-male'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    const option = screen.getByTestId('anatomy-explorer-option-0');
    fireEvent.click(option);
    expect(option).toHaveAttribute('aria-selected', 'true');
  });

  it('empty state clear', () => {
    renderWithProvider();
    expect(screen.getByTestId('anatomy-explorer-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('load-nervous-male'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    expect(screen.queryByTestId('anatomy-explorer-empty')).not.toBeInTheDocument();
    const input = screen.getByTestId('anatomy-explorer-filter');
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    expect(screen.getByTestId('anatomy-explorer-empty')).toHaveTextContent(/No matching/);
  });

  it('no GLB request caused by filtering/clicking already-loaded structure', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../AnatomyStructureExplorer.tsx'), 'utf8');
    expect(src).not.toMatch(/\.glb/);
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/useGLTF/);
    expect(src).toMatch(/getAllLoadedStructures/);
  });

  it('accessibility: semantic section, filter input, listbox, aria-selected', () => {
    renderWithProvider();
    expect(screen.getByTestId('anatomy-explorer')).toHaveAttribute(
      'aria-label',
      'Structure explorer'
    );
    expect(screen.getByTestId('anatomy-explorer-filter')).toHaveAttribute(
      'aria-label',
      'Filter structures'
    );
    expect(screen.getByTestId('anatomy-explorer-filter')).toHaveAttribute(
      'placeholder',
      'Filter structures...'
    );
    expect(screen.getByTestId('anatomy-explorer-list')).toHaveAttribute('role', 'listbox');
    fireEvent.click(screen.getByTestId('load-nervous-male'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    const option = screen.getByTestId('anatomy-explorer-option-0');
    expect(option).toHaveAttribute('role', 'option');
    expect(option).toHaveAttribute('aria-selected');
  });

  it('scrollable list max-height ~30vh', () => {
    renderWithProvider();
    const list = screen.getByTestId('anatomy-explorer-list');
    expect(list).toHaveClass('max-h-[30vh]');
    expect(list).toHaveClass('overflow-y-auto');
  });
});
