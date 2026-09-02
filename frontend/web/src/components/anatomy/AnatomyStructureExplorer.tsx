import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAnatomyState } from './AnatomyStateContext';
import { getAnatomySystem } from './anatomyAssetConfig';
import { getAnatomyInformationByStructureKey } from './anatomyInformation';
import type { AnatomyStructure, AnatomySystemKey } from './anatomyTypes';

function humanizeParentName(raw: string): string {
  // Remove VH_M_ / VH_F_ prefix and underscores, keep readable
  const withoutPrefix = raw.replace(/^VH_[MF]_/, '');
  return withoutPrefix.replace(/_/g, ' ');
}

function getDisplayName(structure: AnatomyStructure): string {
  const canonical = getAnatomyInformationByStructureKey(structure.structureKey)?.canonicalName;
  if (canonical) return canonical;
  // Fallback to humanized objectName without VH_ prefix
  return humanizeParentName(structure.name);
}

function getParentDisplayName(parentRaw: string, systemKey: AnatomySystemKey): string {
  // Try to find verified canonicalName for a structure that has this parentRaw in its lineage
  // Fallback to humanized parentRaw
  // For system-level fallback, use system label
  if (!parentRaw || parentRaw === 'VH_M' || parentRaw === 'VH_F') {
    return getAnatomySystem(systemKey as never).label;
  }
  // Try to find any information record that matches parentRaw as objectName (without prefix)
  // We don't have direct parent structure, so humanize
  return humanizeParentName(parentRaw);
}

export default function AnatomyStructureExplorer(): JSX.Element {
  const {
    registry,
    registryVersion,
    selectedBodyModel,
    visibleSystems,
    selectedStructure,
    selectStructure,
    hoveredStructure,
    setHoveredStructure,
    setCompareStructure,
    compareStructure,
  } = useAnatomyState();
  const [isOpen, setIsOpen] = useState(true);
  const [filter, setFilter] = useState('');
  const [systemFilter, setSystemFilter] = useState<AnatomySystemKey | 'all'>('all');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [expandedSystems, setExpandedSystems] = useState<Set<AnatomySystemKey>>(new Set());
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allLoaded = useMemo(() => {
    return registry
      .getAllLoadedStructures()
      .filter(s => s.bodyModel === selectedBodyModel && visibleSystems[s.systemKey]);
  }, [registry, registryVersion, selectedBodyModel, visibleSystems]);

  const availableSystems = useMemo(() => {
    const set = new Set<AnatomySystemKey>();
    for (const s of allLoaded) set.add(s.systemKey);
    return [...set].sort();
  }, [allLoaded]);

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
        const canonical =
          getAnatomyInformationByStructureKey(s.structureKey)?.canonicalName.toLowerCase() ?? '';
        return name.includes(nq) || obj.includes(nq) || ont.includes(nq) || canonical.includes(nq);
      });
    }
    return [...list].sort((a, b) => a.structureKey.localeCompare(b.structureKey));
  }, [allLoaded, filter, systemFilter]);

  // Hierarchy: System -> Parent (lineage[1]) -> Structures
  const hierarchy = useMemo(() => {
    const bySystem = new Map<AnatomySystemKey, Map<string, AnatomyStructure[]>>();
    for (const s of filtered) {
      const parentRaw = s.lineage[1] ?? s.systemKey;
      // Fallback to systemKey if parent is VH_M / VH_F or empty
      const parentKey =
        !parentRaw || parentRaw === 'VH_M' || parentRaw === 'VH_F' ? s.systemKey : parentRaw;
      if (!bySystem.has(s.systemKey)) bySystem.set(s.systemKey, new Map());
      const byParent = bySystem.get(s.systemKey)!;
      if (!byParent.has(parentKey)) byParent.set(parentKey, []);
      byParent.get(parentKey)!.push(s);
    }
    // Sort systems, parents, and structures deterministically
    const sortedSystems = [...bySystem.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [, byParent] of sortedSystems) {
      for (const [parent, list] of byParent.entries()) {
        list.sort((a, b) => a.structureKey.localeCompare(b.structureKey));
        byParent.set(parent, list);
      }
    }
    // Also sort parents within each system
    for (const [sys, byParent] of sortedSystems) {
      const sortedParents = [...byParent.entries()].sort(([a], [b]) => a.localeCompare(b));
      bySystem.set(sys, new Map(sortedParents));
    }
    return new Map(sortedSystems);
  }, [filtered]);

  const flatFiltered = useMemo(() => filtered, [filtered]);

  useEffect(() => {
    setActiveIndex(flatFiltered.length > 0 ? 0 : -1);
  }, [flatFiltered]);

  // Auto-expand systems/parents when filtering or initial load
  useEffect(() => {
    if (filtered.length > 0 && filtered.length <= 20) {
      // Small result set: expand all
      setExpandedSystems(new Set([...hierarchy.keys()]));
      const allParents = new Set<string>();
      for (const [sys, byParent] of hierarchy.entries()) {
        for (const parent of byParent.keys()) {
          allParents.add(`${sys}:${parent}`);
        }
      }
      setExpandedParents(allParents);
    } else if (filter.trim()) {
      // When filtering, expand all matching branches
      setExpandedSystems(new Set([...hierarchy.keys()]));
      const allParents = new Set<string>();
      for (const [sys, byParent] of hierarchy.entries()) {
        for (const parent of byParent.keys()) {
          allParents.add(`${sys}:${parent}`);
        }
      }
      setExpandedParents(allParents);
    }
  }, [filtered, hierarchy]);

  // Expand all systems by default when first loaded
  useEffect(() => {
    if (allLoaded.length > 0 && allLoaded.length <= 10) {
      setExpandedSystems(new Set([...hierarchy.keys()]));
    }
  }, [allLoaded.length, hierarchy]);

  const handleSelect = useCallback(
    (structure: AnatomyStructure, e?: React.MouseEvent) => {
      const isShift = (e as unknown as { shiftKey?: boolean })?.shiftKey;
      if (isShift) {
        setCompareStructure({
          structureKey: structure.structureKey,
          name: structure.name,
          objectName: structure.objectName,
          systemKey: structure.systemKey,
          bodyModel: structure.bodyModel,
          ontologyId: structure.ontologyId,
        } as never);
        return;
      }
      selectStructure({
        structureKey: structure.structureKey,
        name: structure.name,
        objectName: structure.objectName,
        systemKey: structure.systemKey,
        bodyModel: structure.bodyModel,
        ontologyId: structure.ontologyId,
      });
    },
    [selectStructure, setCompareStructure]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % flatFiltered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + flatFiltered.length) % flatFiltered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && flatFiltered[activeIndex]) {
          handleSelect(flatFiltered[activeIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setFilter('');
        inputRef.current?.focus();
      }
    },
    [flatFiltered, activeIndex, handleSelect]
  );

  useEffect(() => {
    setFilter('');
    setSystemFilter('all');
    setActiveIndex(-1);
    setExpandedSystems(new Set());
    setExpandedParents(new Set());
  }, [selectedBodyModel]);

  const toggleSystem = useCallback((sys: AnatomySystemKey) => {
    setExpandedSystems(prev => {
      const next = new Set(prev);
      if (next.has(sys)) next.delete(sys);
      else next.add(sys);
      return next;
    });
  }, []);

  const toggleParent = useCallback((sys: AnatomySystemKey, parent: string) => {
    const key = `${sys}:${parent}`;
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Scroll active into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const el = listRef.current.querySelector(
        `[data-index="${activeIndex}"]`
      ) as HTMLElement | null;
      el?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeIndex]);

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
            <p className="px-1 text-xs text-slate-500">Browse loaded structures</p>
            <p className="px-1 text-xs text-slate-500">Shift+Click or Compare to compare</p>

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

          <div
            ref={listRef}
            role="listbox"
            aria-label="Loaded structures"
            data-testid="anatomy-explorer-list"
            className="mt-3 max-h-[30vh] overflow-y-auto rounded-lg border border-slate-700/50 bg-slate-800/30"
          >
            {filtered.length === 0 ? (
              <div
                className="px-3 py-6 text-center text-sm text-slate-500"
                data-testid="anatomy-explorer-empty"
              >
                {allLoaded.length === 0 ? 'No structures loaded' : 'No matching structures'}
              </div>
            ) : (
              [...hierarchy.entries()].map(([systemKey, byParent]) => {
                const isSystemExpanded = expandedSystems.has(systemKey);
                const systemLabel = getAnatomySystem(systemKey as never).label;
                const systemCount = [...byParent.values()].reduce(
                  (acc, arr) => acc + arr.length,
                  0
                );
                return (
                  <div key={systemKey} data-testid={`anatomy-explorer-system-${systemKey}`}>
                    <button
                      type="button"
                      onClick={() => toggleSystem(systemKey)}
                      aria-expanded={isSystemExpanded}
                      data-testid={`anatomy-explorer-system-toggle-${systemKey}`}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest hover:bg-slate-700/50 focus-visible:outline-none ${isSystemExpanded ? 'bg-slate-700 text-slate-100' : 'bg-slate-800/50 text-slate-400'}`}
                    >
                      <span>
                        {systemLabel} ({systemCount})
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden
                        className={`transition-transform ${isSystemExpanded ? 'rotate-180 text-slate-200' : 'text-slate-400'}`}
                      >
                        <path
                          d="M3 5l4 4 4-4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    {isSystemExpanded && (
                      <div>
                        {[...byParent.entries()].map(([parentRaw, structures]) => {
                          const parentKey = `${systemKey}:${parentRaw}`;
                          const isParentExpanded = expandedParents.has(parentKey);
                          const parentLabel = getParentDisplayName(parentRaw, systemKey);
                          return (
                            <div
                              key={parentKey}
                              data-testid={`anatomy-explorer-parent-${systemKey}-${parentRaw}`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleParent(systemKey, parentRaw)}
                                aria-expanded={isParentExpanded}
                                data-testid={`anatomy-explorer-parent-toggle-${systemKey}-${parentRaw}`}
                                className={`flex w-full items-center justify-between border-l-2 px-3 py-1.5 pl-6 text-left text-xs font-medium hover:bg-slate-700/30 focus-visible:outline-none ${isParentExpanded ? 'border-teal-500/50 bg-slate-700/20 text-slate-200' : 'border-slate-700/50 bg-slate-800/30 text-slate-300'}`}
                              >
                                <span className="truncate">
                                  {parentLabel} ({structures.length})
                                </span>
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 14 14"
                                  fill="none"
                                  aria-hidden
                                  className={`shrink-0 transition-transform ${isParentExpanded ? 'rotate-180 text-slate-200' : 'text-slate-400'}`}
                                >
                                  <path
                                    d="M3 5l4 4 4-4"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                              {isParentExpanded && (
                                <ul>
                                  {structures.map(s => {
                                    const flatIndex = flatFiltered.findIndex(
                                      f => f.structureKey === s.structureKey
                                    );
                                    const isSelected =
                                      selectedStructure?.structureKey === s.structureKey;
                                    const isCompared =
                                      compareStructure?.structureKey === s.structureKey;
                                    const isActive = flatIndex === activeIndex;
                                    const displayName = getDisplayName(s);
                                    return (
                                      <li
                                        key={s.structureKey}
                                        id={`anatomy-explorer-option-${s.structureKey}`}
                                        role="option"
                                        aria-selected={isSelected}
                                        data-testid={`anatomy-explorer-option-${flatIndex >= 0 ? flatIndex : s.structureKey}`}
                                        data-index={flatIndex}
                                        onClick={e =>
                                          handleSelect(s, e as unknown as React.MouseEvent)
                                        }
                                        onMouseEnter={() => {
                                          setActiveIndex(flatIndex);
                                          setHoveredStructure({
                                            structureKey: s.structureKey,
                                            name: s.name,
                                            objectName: s.objectName,
                                            systemKey: s.systemKey,
                                            bodyModel: s.bodyModel,
                                            ontologyId: s.ontologyId,
                                          });
                                        }}
                                        onMouseLeave={() => setHoveredStructure(null)}
                                        className={`cursor-pointer border-b border-slate-700/30 px-3 py-2 pl-8 last:border-b-0 focus-visible:outline-none ${
                                          isSelected
                                            ? 'bg-teal-500/20 text-teal-200'
                                            : isCompared
                                              ? 'bg-violet-500/20 text-violet-200'
                                              : isActive
                                                ? 'bg-slate-700 text-slate-100'
                                                : hoveredStructure?.structureKey === s.structureKey
                                                  ? 'bg-slate-700/50 text-slate-100'
                                                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="truncate text-sm font-medium">
                                            {displayName}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={e => {
                                                e.stopPropagation();
                                                setCompareStructure({
                                                  structureKey: s.structureKey,
                                                  name: s.name,
                                                  objectName: s.objectName,
                                                  systemKey: s.systemKey,
                                                  bodyModel: s.bodyModel,
                                                  ontologyId: s.ontologyId,
                                                } as never);
                                              }}
                                              aria-label={`Compare ${displayName}`}
                                              data-testid={`anatomy-explorer-compare-${flatIndex >= 0 ? flatIndex : s.structureKey}`}
                                              className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${isCompared ? 'bg-violet-500/30 text-violet-200' : 'bg-slate-700 text-slate-400 hover:bg-violet-500/30 hover:text-violet-100'}`}
                                            >
                                              Compare
                                            </button>
                                            <span className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-xs capitalize text-slate-400">
                                              {getAnatomySystem(s.systemKey as never).label}
                                            </span>
                                          </span>
                                        </div>
                                        {s.ontologyId && (
                                          <span className="mt-0.5 block truncate font-mono text-xs text-slate-500">
                                            {s.ontologyId}
                                          </span>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
