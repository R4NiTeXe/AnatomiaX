import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnatomyStateProvider, useAnatomyState } from '../AnatomyStateContext';
import AnatomyComparePanel from '../AnatomyComparePanel';

function Harness() {
  const {
    selectStructure,
    setCompareStructure,
    clearCompare,
    setSelectedBodyModel,
    selectedStructure,
    compareStructure,
    toggleSystem,
  } = useAnatomyState();
  return (
    <div>
      <AnatomyComparePanel />
      <span data-testid="selected">{selectedStructure?.structureKey ?? 'null'}</span>
      <span data-testid="compare">{compareStructure?.structureKey ?? 'null'}</span>
      <button data-testid="toggle-nervous" onClick={() => toggleSystem('nervous')}>
        toggle-nervous
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
        data-testid="compare-spinal"
        onClick={() =>
          setCompareStructure({
            structureKey: 'male:nervous:UBERON:0002240',
            name: 'VH_M_spinal',
            objectName: 'VH_M_spinal',
            systemKey: 'nervous',
            bodyModel: 'male',
            ontologyId: 'UBERON:0002240',
          })
        }
      >
        compare-spinal
      </button>
      <button
        data-testid="compare-brain"
        onClick={() =>
          setCompareStructure({
            structureKey: 'male:nervous:UBERON:0000955',
            name: 'VH_M_brain',
            objectName: 'VH_M_brain',
            systemKey: 'nervous',
            bodyModel: 'male',
            ontologyId: 'UBERON:0000955',
          })
        }
      >
        compare-brain
      </button>
      <button data-testid="clear-compare" onClick={clearCompare}>
        clear-compare
      </button>
      <button data-testid="switch-female" onClick={() => setSelectedBodyModel('female')}>
        switch-female
      </button>
      <button data-testid="clear-select" onClick={() => selectStructure(null)}>
        clear-select
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

describe('compare', () => {
  it('compare set separately from selected', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    expect(screen.getByTestId('selected')).toHaveTextContent('male:nervous:UBERON:0000955');
    expect(screen.getByTestId('compare')).toHaveTextContent('null');
    fireEvent.click(screen.getByTestId('compare-spinal'));
    expect(screen.getByTestId('compare')).toHaveTextContent('male:nervous:UBERON:0002240');
    expect(screen.getByTestId('selected')).toHaveTextContent('male:nervous:UBERON:0000955');
  });

  it('same structure cannot compare with itself', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('compare-brain'));
    expect(screen.getByTestId('compare')).toHaveTextContent('null');
  });

  it('compare action does not replace primary selection', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('compare-spinal'));
    expect(screen.getByTestId('selected')).toHaveTextContent('male:nervous:UBERON:0000955');
    expect(screen.getByTestId('compare')).toHaveTextContent('male:nervous:UBERON:0002240');
  });

  it('compare information renders', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('compare-spinal'));
    expect(screen.getByTestId('anatomy-compare-panel')).toBeInTheDocument();
  });

  it('clear compare works', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('compare-spinal'));
    expect(screen.getByTestId('compare')).toHaveTextContent('male:nervous:UBERON:0002240');
    fireEvent.click(screen.getByTestId('clear-compare'));
    expect(screen.getByTestId('compare')).toHaveTextContent('null');
    expect(screen.queryByTestId('anatomy-compare-panel')).not.toBeInTheDocument();
  });

  it('body switch clears compare', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('compare-spinal'));
    expect(screen.getByTestId('compare')).toHaveTextContent('male:nervous:UBERON:0002240');
    fireEvent.click(screen.getByTestId('switch-female'));
    expect(screen.getByTestId('compare')).toHaveTextContent('null');
    expect(screen.getByTestId('selected')).toHaveTextContent('null');
  });

  it('clear selection clears compare', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('compare-spinal'));
    fireEvent.click(screen.getByTestId('clear-select'));
    expect(screen.getByTestId('selected')).toHaveTextContent('null');
    expect(screen.getByTestId('compare')).toHaveTextContent('null');
  });

  it('mobile/desktop layout state where testable', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('compare-spinal'));
    const panel = screen.getByTestId('anatomy-compare-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass('rounded-xl');
  });
});
