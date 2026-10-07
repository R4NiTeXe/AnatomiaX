import { fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as THREE from 'three';
import { renderWithAppProviders as render } from '@/test-utils';
import { AnatomyStateProvider, useAnatomyState } from '../components/AnatomyStateContext';
import AnatomySystemPanel from '../components/AnatomySystemPanel';
import { createStructureKey } from '../components/anatomyRegistry';

const SKIN_KEY = 'male:skin:UBERON:0002097';

function Harness() {
  const { selectStructure, registerSystemStructures, toggleSystem } = useAnatomyState();
  return (
    <div>
      <AnatomySystemPanel onResetCamera={() => {}} />
      <button
        data-testid="harness-select-skin"
        onClick={() =>
          selectStructure({
            structureKey: SKIN_KEY,
            name: 'Skin',
            objectName: 'VH_M_skin',
            systemKey: 'skin',
            bodyModel: 'male',
            ontologyId: 'UBERON:0002097',
          } as never)
        }
      >
        select-skin
      </button>
      <button
        data-testid="harness-load-liver"
        onClick={() => {
          const scene = new THREE.Group();
          const parent = new THREE.Group();
          parent.name = 'VH_M_abdominal_cavity';
          const liver = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
          liver.name = 'VH_M_liver';
          parent.add(liver);
          scene.add(parent);
          registerSystemStructures('digestive', scene);
        }}
      >
        load-liver
      </button>
      <button data-testid="harness-toggle-digestive" onClick={() => toggleSystem('digestive')}>
        toggle-digestive
      </button>
      <button
        data-testid="harness-select-liver"
        onClick={() =>
          selectStructure({
            structureKey: createStructureKey('digestive', null, 'VH_M_liver', 'male'),
            name: 'VH_M_liver',
            objectName: 'VH_M_liver',
            systemKey: 'digestive',
            bodyModel: 'male',
            ontologyId: null,
          } as never)
        }
      >
        select-liver
      </button>
    </div>
  );
}

function renderPanel() {
  return render(
    <AnatomyStateProvider>
      <Harness />
    </AnatomyStateProvider>,
    ['/human']
  );
}

describe('selection context (8.40)', () => {
  it('shows a Studied mark once the structure enters local history', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('harness-select-skin'));
    expect(screen.getByTestId('selection-panel')).toBeInTheDocument();
    expect(screen.getByTestId('selected-studied')).toHaveTextContent('Studied');
  });

  it('shows verified parent lineage for registered structures', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('harness-load-liver'));
    fireEvent.click(screen.getByTestId('harness-toggle-digestive'));
    fireEvent.click(screen.getByTestId('harness-select-liver'));
    expect(screen.getByTestId('selected-parent')).toHaveTextContent('Located in: abdominal cavity');
  });

  it('shows no Studied mark without selection', () => {
    renderPanel();
    expect(screen.queryByTestId('selection-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('selected-studied')).not.toBeInTheDocument();
  });

  it('navigates the module sequence from the selection (8.50)', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('harness-select-skin'));
    expect(screen.getByTestId('session-position')).toHaveTextContent('2 of 2');
    expect(screen.getByTestId('session-next')).toBeDisabled();
    expect(screen.getByTestId('session-prev')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('session-prev'));
    expect(screen.getByTestId('session-position')).toHaveTextContent('1 of 2');
    expect(screen.getByTestId('selected-structure-name')).toHaveTextContent('Skin');
  });

  it('hides the navigator for structures outside any module', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('harness-load-liver'));
    fireEvent.click(screen.getByTestId('harness-toggle-digestive'));
    fireEvent.click(screen.getByTestId('harness-select-liver'));
    expect(screen.getByTestId('selection-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('session-navigator')).not.toBeInTheDocument();
  });
});
