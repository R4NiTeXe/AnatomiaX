export function readViteApiBaseUrl(): string | undefined {
  return import.meta.env.VITE_API_BASE_URL;
}
