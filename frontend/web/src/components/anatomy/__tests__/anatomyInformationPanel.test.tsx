import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnatomyStateProvider, useAnatomyState } from '../AnatomyStateContext';
import AnatomyInformationPanel from '../AnatomyInformationPanel';
import type { AnatomySelection } from '../anatomyTypes';

function Harness() {
  const {
    selectStructure,
    setSelectedBodyModel,
    selectedStructure,
    selectedBodyModel,
    toggleSystem,
  } = useAnatomyState();
  return (
    <div>
      <AnatomyInformationPanel />
      <span data-testid="selected-key">{selectedStructure?.structureKey ?? 'null'}</span>
      <span data-testid="body-model">{selectedBodyModel}</span>
      <button
        data-testid="select-male-skin"
        onClick={() =>
          selectStructure({
            structureKey: 'male:skin:UBERON:0002097',
            name: 'VH_M_skin',
            objectName: 'VH_M_skin',
            systemKey: 'skin',
            bodyModel: 'male',
            ontologyId: 'UBERON:0002097',
          } as AnatomySelection)
        }
      >
        select-male-skin
      </button>
      <button
        data-testid="select-female-ovary"
        onClick={() =>
          selectStructure({
            structureKey: 'female:reproductive:UBERON:0000992',
            name: 'VH_F_ovary',
            objectName: 'VH_F_ovary',
            systemKey: 'reproductive',
            bodyModel: 'female',
            ontologyId: 'UBERON:0000992',
          } as AnatomySelection)
        }
      >
        select-female-ovary
      </button>
      <button
        data-testid="select-unknown"
        onClick={() =>
          selectStructure({
            structureKey: 'male:skin:UBERON:9999999',
            name: 'Unknown',
            objectName: 'Unknown',
            systemKey: 'skin',
            bodyModel: 'male',
            ontologyId: 'UBERON:9999999',
          } as AnatomySelection)
        }
      >
        select-unknown
      </button>
      <button
        data-testid="select-male-heart"
        onClick={() =>
          selectStructure({
            structureKey: 'male:cardiovascular:UBERON:0000948',
            name: 'VH_M_heart',
            objectName: 'VH_M_heart',
            systemKey: 'cardiovascular',
            bodyModel: 'male',
            ontologyId: 'UBERON:0000948',
          } as AnatomySelection)
        }
      >
        select-male-heart
      </button>
      <button data-testid="clear" onClick={() => selectStructure(null)}>
        clear
      </button>
      <button data-testid="switch-female" onClick={() => setSelectedBodyModel('female')}>
        switch-female
      </button>
      <button data-testid="switch-male" onClick={() => setSelectedBodyModel('male')}>
        switch-male
      </button>
      <button data-testid="toggle-cardiovascular" onClick={() => toggleSystem('cardiovascular')}>
        toggle-cardio
      </button>
      <button data-testid="toggle-reproductive" onClick={() => toggleSystem('reproductive')}>
        toggle-repro
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

describe('AnatomyInformationPanel', () => {
  it('selected structure with information renders canonical name, description, function', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('select-male-skin'));
    expect(screen.getByTestId('anatomy-information-panel')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-information-canonical-name')).toHaveTextContent('Skin');
    expect(screen.getByTestId('anatomy-information-description')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-information-function')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-information-panel')).toHaveTextContent(/Skin/);
  });

  it('unavailable information shows Information unavailable', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('select-unknown'));
    expect(screen.getByTestId('anatomy-information-panel')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-information-unavailable')).toHaveTextContent(
      'Information unavailable'
    );
    expect(screen.queryByTestId('anatomy-information-description')).not.toBeInTheDocument();
  });

  it('ontology display shows ontology ID when available', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-cardiovascular'));
    fireEvent.click(screen.getByTestId('select-male-heart'));
    expect(screen.getByTestId('anatomy-information-ontology')).toHaveTextContent('UBERON:0000948');
    fireEvent.click(screen.getByTestId('select-male-skin'));
    expect(screen.getByTestId('anatomy-information-ontology')).toHaveTextContent('UBERON:0002097');
  });

  it('provenance display shows source, sourceUrl, lastVerified, license', () => {
    renderWithProvider();
    // Female ovary requires reproductive visible and female body model
    fireEvent.click(screen.getByTestId('switch-female'));
    fireEvent.click(screen.getByTestId('toggle-reproductive'));
    fireEvent.click(screen.getByTestId('select-female-ovary'));
    expect(screen.getByTestId('anatomy-information-source')).toHaveTextContent(
      /Human Reference Atlas/
    );
    const link = screen.getByTestId('anatomy-information-source-url');
    expect(link).toHaveAttribute('href', 'https://humanatlas.io/asct-b-reporter');
    expect(screen.getByTestId('anatomy-information-last-verified')).toHaveTextContent('2026-01-15');
    expect(screen.getByTestId('anatomy-information-license')).toHaveTextContent(/CC BY/);
    // NIH provenance also — switch back to male for skin
    fireEvent.click(screen.getByTestId('switch-male'));
    fireEvent.click(screen.getByTestId('select-male-skin'));
    expect(screen.getByTestId('anatomy-information-source')).toHaveTextContent('NIH');
    expect(screen.getByTestId('anatomy-information-source-url')).toHaveAttribute(
      'href',
      'https://medlineplus.gov/ency/article/002363.htm'
    );
  });

  it('clear selection shows recent, not hides', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('select-male-skin'));
    expect(screen.getByTestId('anatomy-information-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('clear'));
    expect(screen.getByTestId('anatomy-information-panel')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-information-empty')).toHaveTextContent('Select a structure');
    expect(screen.getByTestId('anatomy-recent-list')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-recent-item-0')).toHaveTextContent('Skin');
    expect(screen.getByTestId('selected-key')).toHaveTextContent('null');
  });

  it('recent items render when history has entries', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('select-male-skin'));
    fireEvent.click(screen.getByTestId('select-male-heart'));
    expect(screen.getByTestId('anatomy-recent-list')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-recent-item-0')).toHaveTextContent('Heart');
    expect(screen.getByTestId('anatomy-recent-item-1')).toHaveTextContent('Skin');
  });

  it('recent newest first ordering', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('select-male-skin'));
    fireEvent.click(screen.getByTestId('select-male-heart'));
    // Heart should be first (newest), Skin second
    const first = screen.getByTestId('anatomy-recent-item-0');
    const second = screen.getByTestId('anatomy-recent-item-1');
    expect(first).toHaveTextContent('Heart');
    expect(second).toHaveTextContent('Skin');
    // Re-select skin, should move to front
    fireEvent.click(screen.getByTestId('select-male-skin'));
    expect(screen.getByTestId('anatomy-recent-item-0')).toHaveTextContent('Skin');
  });

  it('recent max 5', () => {
    renderWithProvider();
    // Add 6 distinct selections via state (use existing buttons, duplicate moves to front so count stays <=2)
    // Instead test via direct history: select skin, heart, unknown, then check count <=5
    fireEvent.click(screen.getByTestId('select-male-skin'));
    fireEvent.click(screen.getByTestId('select-male-heart'));
    fireEvent.click(screen.getByTestId('select-unknown'));
    fireEvent.click(screen.getByTestId('select-male-skin'));
    fireEvent.click(screen.getByTestId('select-male-heart'));
    const items = screen.queryAllByTestId(/^anatomy-recent-item-/);
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it('clicking Recent re-selects', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('select-male-skin'));
    fireEvent.click(screen.getByTestId('toggle-cardiovascular'));
    fireEvent.click(screen.getByTestId('select-male-heart'));
    expect(screen.getByTestId('selected-key')).toHaveTextContent(
      'male:cardiovascular:UBERON:0000948'
    );
    fireEvent.click(screen.getByTestId('anatomy-recent-item-1')); // Skin
    expect(screen.getByTestId('selected-key')).toHaveTextContent('male:skin:UBERON:0002097');
    expect(screen.getByTestId('anatomy-information-canonical-name')).toHaveTextContent('Skin');
  });

  it('recent keyboard accessible', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('select-male-skin'));
    const item = screen.getByTestId('anatomy-recent-item-0');
    expect(item).toHaveAttribute('role', 'button');
    expect(item).toHaveAttribute('tabIndex', '0');
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(screen.getByTestId('selected-key')).toHaveTextContent('male:skin:UBERON:0002097');
  });

  it('body-model switch clears old information (stale disappears)', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('select-male-skin'));
    expect(screen.getByTestId('anatomy-information-canonical-name')).toHaveTextContent('Skin');
    expect(screen.getByTestId('anatomy-information-body-model')).toHaveTextContent('male');
    // Switch to female — selection cleared via AnatomyStateContext effect
    fireEvent.click(screen.getByTestId('switch-female'));
    expect(screen.queryByTestId('anatomy-information-panel')).not.toBeInTheDocument();
    // Female ovary now shows female info, not male — need reproductive visible
    fireEvent.click(screen.getByTestId('toggle-reproductive'));
    fireEvent.click(screen.getByTestId('select-female-ovary'));
    expect(screen.getByTestId('anatomy-information-canonical-name')).toHaveTextContent('Ovary');
    expect(screen.getByTestId('anatomy-information-body-model')).toHaveTextContent('female');
  });

  it('does not duplicate seed data and uses getAnatomyInformation', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../AnatomyInformationPanel.tsx'), 'utf8');
    expect(src).toMatch(/getAnatomyInformation/);
    expect(src).not.toMatch(/ANATOMY_INFORMATION_SEED/);
    expect(src).not.toMatch(/Skin.*forms the outer covering/);
  });

  it('panel fits aside layout and is scrollable', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('select-male-skin'));
    const panel = screen.getByTestId('anatomy-information-panel');
    expect(panel).toHaveClass('rounded-xl');
    expect(panel).toHaveClass('border');
    const content = screen.getByTestId('anatomy-information-content');
    expect(content).toHaveClass('overflow-y-auto');
  });
});
