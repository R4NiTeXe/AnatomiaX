export function buildHumanFocusUrl(structureKey: string): string {
  return `/human?focus=${encodeURIComponent(structureKey)}`;
}

export function parseHumanFocusParam(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get('focus');
  if (!raw || raw.length === 0 || raw.length > 256) return null;
  return raw;
}
