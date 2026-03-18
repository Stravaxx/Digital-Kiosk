import { getClientEnv } from './runtimeEnv';

export function getSystemApiBase(): string {
  const envBase = getClientEnv('VITE_ADMIN_API_BASE');
  if (envBase) return envBase;

  const { hostname, port, origin } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  const isViteDevPort = port === '5173' || port === '5174';

  if (isLocal && isViteDevPort) {
    return '';
  }

  return origin;
}

export function getSystemWsUrl(pathname = '/ws/system-sync'): string {
  const envBase = getClientEnv('VITE_ADMIN_API_BASE');
  if (envBase) {
    const base = new URL(envBase, window.location.origin);
    const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${base.host}${pathname}`;
  }

  const { protocol, hostname, port, host } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  const isFrontendDevPort = port === '4173' || port === '5173' || port === '5174';

  if (isLocal && isFrontendDevPort) {
    return `ws://${hostname}:8787${pathname}`;
  }

  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}${pathname}`;
}
