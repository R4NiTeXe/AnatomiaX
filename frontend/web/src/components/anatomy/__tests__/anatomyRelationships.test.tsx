// @ts-nocheck
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnatomyStateProvider, useAnatomyState } from '../AnatomyStateContext';
import AnatomyInformationPanel from '../AnatomyInformationPanel';
import {
  getAnatomyInformationByStructureKey,
  getAnatomyInformationSeed,
  getRelatedAnatomyInformation,
} from '../anatomyInformation';
import type { AnatomySystemKey } from '../anatomyTypes';

const ALL_SYSTEMS: AnatomySystemKey[] = [
  'skin',
  'musculoskeletal',
  'nervous',
  'cardiovascular',
  'respiratory',
  'digestive',
  'urinary',
  'reproductive',
  'lymphatic',
];

function selectPayload(key: string, systemKey: AnatomySystemKey, bodyModel: 'male' | 'female') {
  const info = getAnatomyInformationByStructureKey(key);
  return {
    structureKey: key,
    name: info?.canonicalName ?? key,
    objectName: info?.canonicalName ?? key,
    systemKey,
    bodyModel,
    ontologyId: info?.ontologyId ?? null,
  };
}

function Harness() {
  const { selectStructure, toggleSystem, visibleSystems, selectedStructure } = useAnatomyState();
  return (
    <div>
      <AnatomyInformationPanel />
      <span data-testid="dbg-selected">{selectedStructure?.structureKey ?? 'null'}</span>
      <button
        data-testid="show-all"
        onClick={() => ALL_SYSTEMS.forEach(k => !visibleSystems[k] && toggleSystem(k))}
      >
        show-all
      </button>
      <button
        data-testid="select-lv"
        onClick={() =>
          selectStructure(
            selectPayload('male:cardiovascular:UBERON:0002084', 'cardiovascular', 'male')
          )
        }
      >
        lv
      </button>
      <button
        data-testid="select-cervix"
        onClick={() =>
          selectStructure(
            selectPayload('female:reproductive:UBERON:0000002', 'reproductive', 'female')
          )
        }
      >
        cervix
      </button>
      <button
        data-testid="select-skin"
        onClick={() => selectStructure(selectPayload('male:skin:UBERON:0002097', 'skin', 'male'))}
      >
        skin
      </button>
      <button
        data-testid="select-brain"
        onClick={() =>
          selectStructure(selectPayload('male:nervous:UBERON:0004720', 'nervous', 'male'))
        }
      >
        brain
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

describe('anatomy relationships — seed integrity', () => {
  it('relationship types are only part_of | related_to', () => {
    for (const entry of getAnatomyInformationSeed()) {
      for (const rel of entry.relatedStructures ?? []) {
        expect(['part_of', 'related_to']).toContain(rel.relation);
      }
    }
  });

  it('every target exists', () => {
    for (const entry of getAnatomyInformationSeed()) {
      for (const rel of entry.relatedStructures ?? []) {
        expect(getAnatomyInformationByStructureKey(rel.structureKey)).toBeDefined();
      }
    }
  });

  it('same-body constraint everywhere', () => {
    for (const entry of getAnatomyInformationSeed()) {
      for (const rel of entry.relatedStructures ?? []) {
        const target = getAnatomyInformationByStructureKey(rel.structureKey);
        expect(target?.bodyModel).toBe(entry.bodyModel);
      }
    }
  });

  it('no self-links', () => {
    for (const entry of getAnatomyInformationSeed()) {
      for (const rel of entry.relatedStructures ?? []) {
        expect(rel.structureKey).not.toBe(entry.structureKey);
      }
    }
  });

  it('no duplicate relation pairs per record', () => {
    for (const entry of getAnatomyInformationSeed()) {
      const seen = new Set<string>();
      for (const rel of entry.relatedStructures ?? []) {
        const pair = `${rel.structureKey}|${rel.relation}`;
        expect(seen.has(pair)).toBe(false);
        seen.add(pair);
      }
    }
  });

  it('exact approved relationship count is 29', () => {
    let total = 0;
    let male = 0;
    let female = 0;
    for (const entry of getAnatomyInformationSeed()) {
      const n = entry.relatedStructures?.length ?? 0;
      total += n;
      if (entry.bodyModel === 'male') male += n;
      else female += n;
    }
    expect(total).toBe(29);
    expect(male).toBe(11);
    expect(female).toBe(18);
  });

  it('male/female separation — no cross-body targets', () => {
    for (const entry of getAnatomyInformationSeed()) {
      const related = getRelatedAnatomyInformation(entry.structureKey);
      for (const r of related) {
        expect(r.info.bodyModel).toBe(entry.bodyModel);
      }
    }
  });

  it('fallopian tube links Ovary and Uterus (mesh-less source, data-level)', () => {
    const related = getRelatedAnatomyInformation('female:reproductive:UBERON:0003889');
    expect(related.map(r => r.relation)).toEqual(['related_to', 'related_to']);
    expect(related.map(r => r.info.structureKey)).toEqual([
      'female:reproductive:UBERON:0000992',
      'female:reproductive:UBERON:0000995',
    ]);
  });

  it('mesh-less whole targets are valid records', () => {
    for (const key of [
      'male:cardiovascular:UBERON:0000948',
      'female:reproductive:UBERON:0000995',
      'male:respiratory:UBERON:0002048',
    ]) {
      expect(getAnatomyInformationByStructureKey(key)).toBeDefined();
    }
  });
});

describe('anatomy relationships — lookup helper', () => {
  it('LV returns part_of Heart + related RV + related Asc in order', () => {
    const related = getRelatedAnatomyInformation('male:cardiovascular:UBERON:0002084');
    expect(related.map(r => r.relation)).toEqual(['part_of', 'related_to', 'related_to']);
    expect(related.map(r => r.info.structureKey)).toEqual([
      'male:cardiovascular:UBERON:0000948',
      'male:cardiovascular:UBERON:0002080',
      'male:cardiovascular:UBERON:0001496',
    ]);
  });

  it('unknown key and null return empty', () => {
    expect(getRelatedAnatomyInformation('male:skin:UBERON:9999999')).toEqual([]);
    expect(getRelatedAnatomyInformation(null)).toEqual([]);
    expect(getRelatedAnatomyInformation('')).toEqual([]);
  });

  it('unverified structures have no relationships', () => {
    expect(getRelatedAnatomyInformation('male:skin:UBERON:0002097')).toEqual([]);
  });
});

describe('anatomy relationships — panel', () => {
  it('Part of rendering for Left ventricle', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('show-all'));
    fireEvent.click(screen.getByTestId('select-lv'));
    expect(screen.getByTestId('anatomy-relationships')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-partof-heading')).toHaveTextContent('Part of');
    expect(screen.getByTestId('anatomy-partof-item-0')).toHaveTextContent('Part of: Heart');
  });

  it('Related structures rendering for Left ventricle', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('show-all'));
    fireEvent.click(screen.getByTestId('select-lv'));
    expect(screen.getByTestId('anatomy-related-heading')).toHaveTextContent('Related structures');
    const items = screen.getAllByTestId(/anatomy-related-item-/);
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Related: Right ventricle');
    expect(items[1]).toHaveTextContent('Related: Ascending aorta');
  });

  it('click Part of flows through existing selection', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('show-all'));
    fireEvent.click(screen.getByTestId('select-lv'));
    fireEvent.click(screen.getByTestId('anatomy-partof-item-0'));
    expect(screen.getByTestId('dbg-selected')).toHaveTextContent(
      'male:cardiovascular:UBERON:0000948'
    );
    expect(screen.getByTestId('anatomy-information-canonical-name')).toHaveTextContent('Heart');
  });

  it('click Related flows through existing selection', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('show-all'));
    fireEvent.click(screen.getByTestId('select-lv'));
    fireEvent.click(screen.getByTestId('anatomy-related-item-0'));
    expect(screen.getByTestId('dbg-selected')).toHaveTextContent(
      'male:cardiovascular:UBERON:0002080'
    );
    expect(screen.getByTestId('anatomy-information-canonical-name')).toHaveTextContent(
      'Right ventricle'
    );
  });

  it('mesh-less Heart target selects without crash', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('show-all'));
    fireEvent.click(screen.getByTestId('select-lv'));
    fireEvent.click(screen.getByTestId('anatomy-partof-item-0'));
    // Heart whole has no mesh; info still renders, no throw
    expect(screen.getByTestId('anatomy-information-panel')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-information-canonical-name')).toHaveTextContent('Heart');
  });

  it('female Cervix shows Part of Uterus; male shows no female-only links', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('show-all'));
    fireEvent.click(screen.getByTestId('select-cervix'));
    expect(screen.getByTestId('anatomy-partof-item-0')).toHaveTextContent('Part of: Uterus');
    const maleRelated = getRelatedAnatomyInformation('male:nervous:UBERON:0004720');
    expect(maleRelated.every(r => r.info.bodyModel === 'male')).toBe(true);
    expect(maleRelated.map(r => r.info.canonicalName)).toContain('Spinal cord');
  });

  it('no relationship section for unverified structures', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('select-skin'));
    expect(screen.queryByTestId('anatomy-relationships')).not.toBeInTheDocument();
    expect(screen.queryByTestId('anatomy-partof-heading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('anatomy-related-heading')).not.toBeInTheDocument();
  });

  it('Brain actual shows Related Spinal cord (canonical display)', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('show-all'));
    fireEvent.click(screen.getByTestId('select-brain'));
    expect(screen.getByTestId('anatomy-related-item-0')).toHaveTextContent('Related: Spinal cord');
    expect(screen.queryByTestId('anatomy-partof-heading')).not.toBeInTheDocument();
  });
});
