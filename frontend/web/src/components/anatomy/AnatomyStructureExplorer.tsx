import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAnatomyState } from './AnatomyStateContext';
import { getAnatomySystem } from './anatomyAssetConfig';
import type { AnatomySystemKey } from './anatomyTypes';

export default function AnatomyStructureExplorer(): JSX.Element {
  const {
    registry,
    registryVersion,
    selectedBodyModel,
    visibleSystems,
    selectedStructure,
    selectStructure,
  } = useAnatomyState();
  const [isOpen, setIsOpen] = useState(true);
  const [filter, setFilter] = useState('');
  const [systemFilter, setSystemFilter] = useState<AnatomySystemKey | 'all'>('all');
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allLoaded = useMemo(() => {
    // Only structures belonging to selected bodyModel and currently visible systems
    return registry
      .getAllLoadedStructures()
      .filter(s => s.bodyModel === selectedBodyModel && visibleSystems[s.systemKey]);
  }, [registry, registryVersion, selectedBodyModel, visibleSystems]);

  const availableSystems = useMemo(() => {
    const set = new Set<AnatomySystemKey>();
    for (const s of allLoaded) set.add(s.systemKey);
    return [...set].sort();
  }, [allLoaded]);

  // Reset system filter if it becomes unavailable
  useEffect(() => {
    if (systemFilter !== 'all' && !availableSystems.includes(systemFilter)) {
      setSystemFilter('all');
    }
  }, [availableSystems, systemFilter]);

  const filtered = useMemo(() => {
    const nq = filter.trim().toLowerCase();
    let list = allLoaded;
    if (systemFilter !== 'all') {
      list = list.filter(s => s.systemKey === systemFilter);
    }
    if (nq) {
      list = list.filter(s => {
        const name = s.name.toLowerCase();
        const obj = s.objectName.toLowerCase();
        const ont = s.ontologyId ? s.ontologyId.toLowerCase() : '';
        return name.includes(nq) || obj.includes(nq) || ont.includes(nq);
      });
    }
    // Deterministic ordering
    return [...list].sort((a, b) => a.structureKey.localeCompare(b.structureKey));
  }, [allLoaded, filter, systemFilter]);

  useEffect(() => {
    setActiveIndex(filtered.length > 0 ? 0 : -1);
  }, [filtered]);

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
      el?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleSelect = useCallback(
    (structure: (typeof filtered)[number]) => {
      selectStructure({
        structureKey: structure.structureKey,
        name: structure.name,
        objectName: structure.objectName,
        systemKey: structure.systemKey,
        bodyModel: structure.bodyModel,
        ontologyId: structure.ontologyId,
      });
    },
    [selectStructure]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && filtered[activeIndex]) {
          handleSelect(filtered[activeIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setFilter('');
        inputRef.current?.focus();
      }
    },
    [filtered, activeIndex, handleSelect]
  );

  // Reset filter on body switch
  useEffect(() => {
    setFilter('');
    setSystemFilter('all');
    setActiveIndex(-1);
  }, [selectedBodyModel]);

  return (
    <section
      className="rounded-xl border border-slate-800 bg-slate-900/40"
      data-testid="anatomy-explorer"
      aria-label="Structure explorer"
    >
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        aria-expanded={isOpen}
        aria-controls="anatomy-explorer-content"
        data-testid="anatomy-explorer-toggle"
        className="flex w-full items-center justify-between px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Structure explorer
        </h2>
        <span className="flex items-center gap-2">
          <span
            className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400"
            data-testid="anatomy-explorer-count"
          >
            {filtered.length} / {allLoaded.length}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden
            className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            <path
              d="M3 5l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div id="anatomy-explorer-content" className="border-t border-slate-800 px-3 py-3">
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Filter structures..."
              aria-label="Filter structures"
              data-testid="anatomy-explorer-filter"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />

            {availableSystems.length > 1 && (
              <select
                value={systemFilter}
                onChange={e => setSystemFilter(e.target.value as AnatomySystemKey | 'all')}
                aria-label="Filter by system"
                data-testid="anatomy-explorer-system-filter"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-xs text-slate-300 focus:border-teal-500 focus:outline-none"
              >
                <option value="all">All systems</option>
                {availableSystems.map(key => (
                  <option key={key} value={key}>
                    {getAnatomySystem(key as never).label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <ul
            ref={listRef}
            role="listbox"
            aria-label="Loaded structures"
            data-testid="anatomy-explorer-list"
            className="mt-3 max-h-[30vh] overflow-y-auto rounded-lg border border-slate-700/50 bg-slate-800/30"
          >
            {filtered.length === 0 ? (
              <li
                className="px-3 py-6 text-center text-sm text-slate-500"
                data-testid="anatomy-explorer-empty"
              >
                {allLoaded.length === 0 ? 'No structures loaded' : 'No matching structures'}
              </li>
            ) : (
              filtered.map((s, index) => {
                const isSelected = selectedStructure?.structureKey === s.structureKey;
                const isActive = index === activeIndex;
                return (
                  <li
                    key={s.structureKey}
                    id={`anatomy-explorer-option-${s.structureKey}`}
                    role="option"
                    aria-selected={isSelected}
                    data-testid={`anatomy-explorer-option-${index}`}
                    onClick={() => handleSelect(s)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`cursor-pointer border-b border-slate-700/30 px-3 py-2 last:border-b-0 focus-visible:outline-none ${
                      isSelected
                        ? 'bg-teal-500/20 text-teal-200'
                        : isActive
                          ? 'bg-slate-700 text-slate-100'
                          : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{s.name}</span>
                      <span className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-xs capitalize text-slate-400">
                        {getAnatomySystem(s.systemKey as never).label}
                      </span>
                    </div>
                    {s.ontologyId && (
                      <span className="mt-0.5 block truncate font-mono text-xs text-slate-500">
                        {s.ontologyId}
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
