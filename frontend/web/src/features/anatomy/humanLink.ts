/**
 * Deep links from dashboard/history into the /human viewer.
 * The viewer applies `?focus=` via parseStudiedKey (no registry needed),
 * so links stay valid even before GLBs load. Invalid keys are ignored
 * by the viewer — never throws.
 */
export function buildHumanFocusUrl(structureKey: string): string {
  return `/human?focus=${encodeURIComponent(structureKey)}`;
}

export function parseHumanFocusParam(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get('focus');
  if (!raw || raw.length === 0 || raw.length > 256) return null;
  return raw;
}
