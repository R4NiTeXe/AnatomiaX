import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAnatomyState } from './AnatomyStateContext';
import { searchStructures } from './anatomyRegistry';
import type { AnatomySearchResult } from './anatomyTypes';

export default function AnatomySearchBox(): JSX.Element {
  const { registry, selectedBodyModel, selectStructure, setHoveredStructure, setCompareStructure } =
    useAnatomyState();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Reactive to registry size — search only loaded structures
  const registrySize = registry.size;

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchStructures(registry, query, {
      bodyModel: selectedBodyModel,
      systemKey: 'all',
      limit: 8,
    });
  }, [registry, query, selectedBodyModel, registrySize]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  const handleSelect = useCallback(
    (result: AnatomySearchResult, e?: React.MouseEvent) => {
      const isShift = (e as unknown as { shiftKey?: boolean })?.shiftKey;
      if (isShift) {
        setCompareStructure({
          structureKey: result.structureKey,
          name: result.name,
          objectName: result.objectName,
          systemKey: result.systemKey as never,
          bodyModel: result.bodyModel,
          ontologyId: result.ontologyId,
        } as never);
        return;
      }
      selectStructure({
        structureKey: result.structureKey,
        name: result.name,
        objectName: result.objectName,
        systemKey: result.systemKey as never,
        bodyModel: result.bodyModel,
        ontologyId: result.ontologyId,
      });
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [selectStructure, setCompareStructure]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen && results.length > 0) setIsOpen(true);
        setActiveIndex(prev => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen && results.length > 0) setIsOpen(true);
        setActiveIndex(prev => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          handleSelect(results[activeIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isOpen) {
          setIsOpen(false);
          setActiveIndex(-1);
        } else {
          handleClear();
        }
      }
    },
    [isOpen, results, activeIndex, handleSelect, handleClear]
  );

  // Close on body model switch — no stale selection
  useEffect(() => {
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
  }, [selectedBodyModel]);

  // Ensure active item is visible in list
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <div className="relative">
      <p className="mb-1 px-1 text-xs text-slate-500">Search all anatomy</p>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim() && results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search anatomy..."
          aria-label="Search anatomy"
          role="combobox"
          aria-expanded={isOpen && results.length > 0}
          aria-controls="anatomy-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 && results[activeIndex]
              ? `anatomy-search-option-${results[activeIndex].structureKey}`
              : undefined
          }
          className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 pr-8 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          data-testid="anatomy-search-input"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            data-testid="anatomy-search-clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {isOpen && query.trim() && (
        <ul
          ref={listRef}
          id="anatomy-search-listbox"
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg"
          data-testid="anatomy-search-results"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500" role="option" aria-selected={false}>
              No results
            </li>
          ) : (
            results.map((result, index) => (
              <li
                key={result.structureKey}
                id={`anatomy-search-option-${result.structureKey}`}
                role="option"
                aria-selected={index === activeIndex}
                data-testid={`anatomy-search-option-${index}`}
                onClick={e => handleSelect(result, e as unknown as React.MouseEvent)}
                onMouseEnter={() => {
                  setActiveIndex(index);
                  setHoveredStructure({
                    structureKey: result.structureKey,
                    name: result.name,
                    objectName: result.objectName,
                    systemKey: result.systemKey as never,
                    bodyModel: result.bodyModel,
                    ontologyId: result.ontologyId,
                  });
                }}
                onMouseLeave={() => setHoveredStructure(null)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === activeIndex
                    ? 'bg-teal-500/20 text-teal-200'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{result.name}</span>
                  <span className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-xs capitalize text-slate-400">
                    {result.systemKey}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  <span className="capitalize">{result.bodyModel}</span>
                  {result.ontologyId && (
                    <>
                      <span>·</span>
                      <span className="truncate font-mono">{result.ontologyId}</span>
                    </>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
