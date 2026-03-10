export function getSystemApiBase(): string {
  const envBase = (import.meta.env.VITE_ADMIN_API_BASE as string | undefined)?.trim() || '';
  if (envBase) return envBase;

  const { hostname, port, origin } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  const isViteDevPort = port === '5173' || port === '5174';

  if (isLocal && isViteDevPort) {
    return '';
  }

  return origin;
}
