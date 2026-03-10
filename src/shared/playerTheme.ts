import type { GroupThemeSettings, ScreenThemeSettings } from './screenRegistry';

export type ResolvedThemeMode = 'light' | 'dark';

export interface ResolvedPlayerTheme {
  mode: ResolvedThemeMode;
  primaryColor: string;
  accentSoft: string;
  borderStrong: string;
  background: string;
  cardBackground: string;
  foreground: string;
  mutedForeground: string;
  success: string;
  warning: string;
  danger: string;
  infoSoftBackground: string;
  divider: string;
}

const DEFAULT_PLAYER_PRIMARY = '#3b82f6';

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => `${c}${c}`).join('')
    : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16)
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${clampChannel(r).toString(16).padStart(2, '0')}${clampChannel(g).toString(16).padStart(2, '0')}${clampChannel(b).toString(16).padStart(2, '0')}`;
}

function mix(hex: string, target: { r: number; g: number; b: number }, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    rgb.r + (target.r - rgb.r) * factor,
    rgb.g + (target.g - rgb.g) * factor,
    rgb.b + (target.b - rgb.b) * factor
  );
}

function toMinutes(timeValue: string): number {
  const [h, m] = timeValue.split(':').map((v) => Number.parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.max(0, Math.min(23, h)) * 60 + Math.max(0, Math.min(59, m));
}

function resolveScheduledMode(now: Date, lightStart: string, darkStart: string): ResolvedThemeMode {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const lightMins = toMinutes(lightStart);
  const darkMins = toMinutes(darkStart);

  if (lightMins === darkMins) return 'dark';

  if (lightMins < darkMins) {
    return nowMins >= lightMins && nowMins < darkMins ? 'light' : 'dark';
  }

  return nowMins >= lightMins || nowMins < darkMins ? 'light' : 'dark';
}

export function resolveThemeMode(
  groupTheme: GroupThemeSettings,
  screenTheme: ScreenThemeSettings | undefined,
  now: Date
): ResolvedThemeMode {
  void groupTheme;
  void screenTheme;
  void now;
  return 'dark';
}

export function resolvePlayerTheme(
  groupTheme: GroupThemeSettings,
  screenTheme: ScreenThemeSettings | undefined,
  now: Date
): ResolvedPlayerTheme {
  const mode = resolveThemeMode(groupTheme, screenTheme, now);
  const primaryColor = (!screenTheme || screenTheme.mode === 'inherit-group')
    ? groupTheme.primaryColor
    : screenTheme.primaryColor ?? groupTheme.primaryColor;

  const safePrimary = hexToRgb(primaryColor)
    ? primaryColor
    : (hexToRgb(groupTheme.primaryColor) ? groupTheme.primaryColor : DEFAULT_PLAYER_PRIMARY);

  if (mode === 'light') {
    return {
      mode,
      primaryColor: safePrimary,
      accentSoft: mix(safePrimary, { r: 255, g: 255, b: 255 }, 0.84),
      borderStrong: '#e2e8f0',
      background: '#f8fafc',
      cardBackground: '#ffffff',
      foreground: '#0f172a',
      mutedForeground: '#475569',
      success: '#15803d',
      warning: '#b45309',
      danger: '#b91c1c',
      infoSoftBackground: '#dbeafe',
      divider: '#cbd5e1'
    };
  }

  return {
    mode,
    primaryColor: safePrimary,
    accentSoft: mix(safePrimary, { r: 15, g: 23, b: 42 }, 0.78),
    borderStrong: 'rgba(255,255,255,0.08)',
    background: '#0f172a',
    cardBackground: 'rgba(255, 255, 255, 0.08)',
    foreground: '#e5e7eb',
    mutedForeground: '#9ca3af',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    infoSoftBackground: 'rgba(59,130,246,0.16)',
    divider: 'rgba(255,255,255,0.06)'
  };
}
