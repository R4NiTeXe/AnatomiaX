import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnatomyStateProvider, useAnatomyState } from '../AnatomyStateContext';
import { initialVisibleSystems } from '../anatomyAssetConfig';
import type { AnatomySystemKey } from '../anatomyTypes';

function TestPanel() {
  const s = useAnatomyState();
  return (
    <div>
      <span data-testid="visible">{JSON.stringify(s.visibleSystems)}</span>
      <span data-testid="opacity">{JSON.stringify(s.systemOpacity)}</span>
      <span data-testid="isolated">{s.isolatedSystem ?? 'null'}</span>
      <span data-testid="selected">
        {s.selectedStructure
          ? `${s.selectedStructure.name}:${s.selectedStructure.systemKey}`
          : 'null'}
      </span>
      <button
        data-testid="toggle-musculoskeletal"
        onClick={() => s.toggleSystem('musculoskeletal')}
      >
        toggle-musc
      </button>
      <button data-testid="toggle-nervous" onClick={() => s.toggleSystem('nervous')}>
        toggle-nerv
      </button>
      <button data-testid="toggle-skin" onClick={() => s.toggleSystem('skin')}>
        toggle-skin
      </button>
      <button
        data-testid="set-opacity-cardio"
        onClick={() => s.setSystemOpacity('cardiovascular', 0.4)}
      >
        set-cardio-0.4
      </button>
      <button data-testid="set-opacity-skin" onClick={() => s.setSystemOpacity('skin', 0.4)}>
        set-skin-0.4
      </button>
      <button data-testid="isolate-cardio" onClick={() => s.isolateSystem('cardiovascular')}>
        isolate-cardio
      </button>
      <button data-testid="isolate-nervous" onClick={() => s.isolateSystem('nervous')}>
        isolate-nerv
      </button>
      <button data-testid="reset-view" onClick={() => s.resetView()}>
        reset-view
      </button>
      <button
        data-testid="select-heart"
        onClick={() =>
          s.selectStructure({
            structureKey: 'male:cardiovascular:UBERON:0000948',
            name: 'VH_M_heart',
            objectName: 'VH_M_heart',
            systemKey: 'cardiovascular',
            bodyModel: 'male',
            ontologyId: 'UBERON:0000948',
          })
        }
      >
        select-heart
      </button>
      <button
        data-testid="select-brain"
        onClick={() =>
          s.selectStructure({
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
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AnatomyStateProvider>
      <TestPanel />
    </AnatomyStateProvider>
  );
}

describe('layer state', () => {
  it('default visibility: skin visible, others hidden', () => {
    renderWithProvider();
    const visible = JSON.parse(screen.getByTestId('visible').textContent || '{}');
    expect(visible.skin).toBe(true);
    (Object.keys(initialVisibleSystems) as AnatomySystemKey[]).forEach(k => {
      if (k !== 'skin') expect(visible[k]).toBe(false);
    });
  });

  it('toggle visibility shows and hides without reload flag', async () => {
    renderWithProvider();
    expect(JSON.parse(screen.getByTestId('visible').textContent || '{}').musculoskeletal).toBe(
      false
    );
    fireEvent.click(screen.getByTestId('toggle-musculoskeletal'));
    expect(JSON.parse(screen.getByTestId('visible').textContent || '{}').musculoskeletal).toBe(
      true
    );
    fireEvent.click(screen.getByTestId('toggle-musculoskeletal'));
    expect(JSON.parse(screen.getByTestId('visible').textContent || '{}').musculoskeletal).toBe(
      false
    );
  });

  it('opacity changes per system without leaking', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('set-opacity-cardio'));
    let opacity = JSON.parse(screen.getByTestId('opacity').textContent || '{}');
    expect(opacity.cardiovascular).toBeCloseTo(0.4);
    expect(opacity.skin).toBe(1);
    expect(opacity.nervous).toBe(1);
    fireEvent.click(screen.getByTestId('set-opacity-skin'));
    opacity = JSON.parse(screen.getByTestId('opacity').textContent || '{}');
    expect(opacity.skin).toBeCloseTo(0.4);
    expect(opacity.cardiovascular).toBeCloseTo(0.4);
  });

  it('isolate hides others and can be restored via reset view', () => {
    renderWithProvider();
    // make musculoskeletal visible first
    fireEvent.click(screen.getByTestId('toggle-musculoskeletal'));
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    let visible = JSON.parse(screen.getByTestId('visible').textContent || '{}');
    expect(visible.musculoskeletal).toBe(true);
    expect(visible.nervous).toBe(true);
    expect(visible.skin).toBe(true);
    // isolate cardiovascular
    fireEvent.click(screen.getByTestId('isolate-cardio'));
    visible = JSON.parse(screen.getByTestId('visible').textContent || '{}');
    expect(visible.cardiovascular).toBe(true);
    expect(visible.skin).toBe(false);
    expect(visible.musculoskeletal).toBe(false);
    expect(screen.getByTestId('isolated').textContent).toBe('cardiovascular');
    // reset view restores
    fireEvent.click(screen.getByTestId('reset-view'));
    visible = JSON.parse(screen.getByTestId('visible').textContent || '{}');
    expect(visible.skin).toBe(true);
    expect(visible.musculoskeletal).toBe(true);
    expect(visible.nervous).toBe(true);
    expect(screen.getByTestId('isolated').textContent).toBe('null');
  });

  it('reset view without prior isolate restores defaults', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-musculoskeletal'));
    fireEvent.click(screen.getByTestId('set-opacity-cardio'));
    fireEvent.click(screen.getByTestId('reset-view'));
    const visible = JSON.parse(screen.getByTestId('visible').textContent || '{}');
    expect(visible).toEqual(initialVisibleSystems);
    const opacity = JSON.parse(screen.getByTestId('opacity').textContent || '{}');
    Object.values(opacity).forEach(v => expect(v).toBe(1));
  });

  it('hiding selected system clears selection (via toggle)', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-musculoskeletal'));
    // select brain is nervous, not musculoskeletal — select a structure that belongs to musculoskeletal
    // Our harness only has select-heart/brain; so select heart belongs to cardiovascular which is not visible yet.
    // Let's test with brain on nervous
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    expect(screen.getByTestId('selected').textContent).toContain('VH_M_brain');
    // hide nervous -> selection cleared
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    expect(screen.getByTestId('selected').textContent).toBe('null');
  });

  it('isolate clears selection if not in isolated system', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    expect(screen.getByTestId('selected').textContent).toContain('VH_M_brain');
    fireEvent.click(screen.getByTestId('isolate-cardio'));
    expect(screen.getByTestId('selected').textContent).toBe('null');
  });

  it('opacity does not leak between systems after isolate/reset', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('set-opacity-cardio'));
    fireEvent.click(screen.getByTestId('isolate-nervous'));
    let opacity = JSON.parse(screen.getByTestId('opacity').textContent || '{}');
    expect(opacity.cardiovascular).toBeCloseTo(0.4);
    fireEvent.click(screen.getByTestId('reset-view'));
    opacity = JSON.parse(screen.getByTestId('opacity').textContent || '{}');
    expect(opacity.cardiovascular).toBe(1);
    expect(opacity.nervous).toBe(1);
  });
});
