import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as THREE from 'three';
import { AnatomyStateProvider, useAnatomyState } from '../components/AnatomyStateContext';
import AnatomySearchBox from '../components/AnatomySearchBox';

function Harness() {
  const { registerSystemStructures, setSelectedBodyModel } = useAnatomyState();
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
          const spinal = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
          spinal.name = 'VH_M_spinal_cord';
          spinal.userData.ontologyId = 'UBERON:0002240';
          scene.add(spinal);
          registerSystemStructures('nervous', scene);
        }}
      >
        load
      </button>
      <button data-testid="to-female" onClick={() => setSelectedBodyModel('female')}>
        female
      </button>
    </div>
  );
}

beforeEach(() => {
  // jsdom has no layout engine: stub scrolling used to reveal the active option.
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: jest.fn(),
  });
});

function setup() {
  render(
    <AnatomyStateProvider>
      <Harness />
    </AnatomyStateProvider>
  );
  fireEvent.click(screen.getByTestId('load-nervous-male'));
}

describe('AnatomySearchBox', () => {
  it('lists matching structures as options', () => {
    setup();
    fireEvent.change(screen.getByTestId('anatomy-search-input'), { target: { value: 'brain' } });
    expect(screen.getByTestId('anatomy-search-results')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-search-option-0')).toHaveTextContent(/brain/i);
  });

  it('shows a no-results option for unknown queries', () => {
    setup();
    fireEvent.change(screen.getByTestId('anatomy-search-input'), { target: { value: 'zzz-nope' } });
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('moves the active descendant with ArrowDown and clears with Escape', () => {
    setup();
    const input = screen.getByTestId('anatomy-search-input');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      expect.stringContaining('anatomy-search-option-')
    );
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('anatomy-search-results')).not.toBeInTheDocument();
  });

  it('clears the query with the clear button', () => {
    setup();
    const input = screen.getByTestId('anatomy-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'brain' } });
    fireEvent.click(screen.getByTestId('anatomy-search-clear'));
    expect(input.value).toBe('');
  });

  it('resets the query on body-model switch', () => {
    setup();
    const input = screen.getByTestId('anatomy-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'brain' } });
    expect(input.value).toBe('brain');
    fireEvent.click(screen.getByTestId('to-female'));
    expect(input.value).toBe('');
  });
});
