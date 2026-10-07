import { fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithAppProviders as render } from '@/test-utils';
import { AnatomyStateProvider, useAnatomyState } from '../components/AnatomyStateContext';
import AnatomySystemPanel from '../components/AnatomySystemPanel';
import AnatomyQuiz from '../components/AnatomyQuiz';

const SKIN_SELECTION = {
  structureKey: 'male:skin:UBERON:0002097',
  name: 'Skin',
  objectName: 'VH_M_skin',
  systemKey: 'skin',
  bodyModel: 'male',
  ontologyId: 'UBERON:0002097',
} as never;

function SelectSkinButton() {
  const { selectStructure } = useAnatomyState();
  return (
    <button data-testid="select-skin" onClick={() => selectStructure(SKIN_SELECTION)}>
      select-skin
    </button>
  );
}

describe('selection to quiz flow (8.37)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('selection panel offers a quiz next action that starts with the selection', () => {
    render(
      <AnatomyStateProvider>
        <AnatomySystemPanel onResetCamera={() => {}} />
        <AnatomyQuiz />
        <SelectSkinButton />
      </AnatomyStateProvider>,
      ['/human']
    );
    expect(screen.queryByTestId('selection-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('select-skin'));
    expect(screen.getByTestId('selection-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('quiz-this-structure'));
    expect(screen.getByTestId('anatomy-quiz-question')).toHaveTextContent(/skin/i);
    expect(screen.getByTestId('anatomy-quiz-progress')).toHaveTextContent('1 / 5');
    expect(document.activeElement?.getAttribute('data-testid')).toBe('anatomy-quiz');
  });

  it('starts the quiz even when the quiz section is absent (guarded target)', () => {
    const Probe = () => {
      const { quizQuestions: started } = useAnatomyState();
      return <span data-testid="dbg-quiz-count">{started.length}</span>;
    };
    render(
      <AnatomyStateProvider>
        <AnatomySystemPanel onResetCamera={() => {}} />
        <SelectSkinButton />
        <Probe />
      </AnatomyStateProvider>,
      ['/human']
    );
    fireEvent.click(screen.getByTestId('select-skin'));
    fireEvent.click(screen.getByTestId('quiz-this-structure'));
    expect(screen.getByTestId('dbg-quiz-count')).toHaveTextContent('5');
  });

  it('withholds the targeted quiz action without a verified record (8.41)', () => {
    const SelectUnknownButton = () => {
      const { selectStructure } = useAnatomyState();
      return (
        <button
          data-testid="select-unknown"
          onClick={() =>
            selectStructure({
              structureKey: 'male:skin:UBERON:9999999',
              name: 'VH_M_unknown',
              objectName: 'VH_M_unknown',
              systemKey: 'skin',
              bodyModel: 'male',
              ontologyId: null,
            } as never)
          }
        >
          select-unknown
        </button>
      );
    };
    render(
      <AnatomyStateProvider>
        <AnatomySystemPanel onResetCamera={() => {}} />
        <SelectUnknownButton />
      </AnatomyStateProvider>,
      ['/human']
    );
    fireEvent.click(screen.getByTestId('select-unknown'));
    expect(screen.getByTestId('selection-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('quiz-this-structure')).not.toBeInTheDocument();
    expect(screen.getByTestId('quiz-unavailable-note')).toHaveTextContent(/isn.*t available/i);
    expect(screen.getByTestId('clear-selection')).toBeInTheDocument();
  });
});
