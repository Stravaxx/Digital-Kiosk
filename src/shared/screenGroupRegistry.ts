import { DEFAULT_GROUP_THEME, type GroupThemeSettings } from './screenRegistry';
import { mirrorLocalStorageKeyToDb } from '../services/clientDbStorage';

export interface ScreenGroupModel {
  id: string;
  name: string;
  theme: GroupThemeSettings;
}

export const SCREEN_GROUPS_KEY = 'ds.screen-groups';

const LEGACY_DEFAULT_PRIMARY = '#8dc63f';

function normalizePrimaryColor(color?: string): string {
  if (!color) return DEFAULT_GROUP_THEME.primaryColor;
  const lower = color.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(lower)) return DEFAULT_GROUP_THEME.primaryColor;
  if (lower === LEGACY_DEFAULT_PRIMARY) return DEFAULT_GROUP_THEME.primaryColor;
  return lower;
}

function normalizeTheme(theme?: Partial<GroupThemeSettings>): GroupThemeSettings {
  return {
    mode: theme?.mode ?? DEFAULT_GROUP_THEME.mode,
    primaryColor: normalizePrimaryColor(theme?.primaryColor),
    lightStart: theme?.lightStart ?? DEFAULT_GROUP_THEME.lightStart,
    darkStart: theme?.darkStart ?? DEFAULT_GROUP_THEME.darkStart
  };
}

export function loadScreenGroups(): ScreenGroupModel[] {
  try {
    const raw = localStorage.getItem(SCREEN_GROUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScreenGroupModel[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((group) => ({
      ...group,
      theme: normalizeTheme(group.theme)
    }));
  } catch {
    return [];
  }
}

export function saveScreenGroups(groups: ScreenGroupModel[]): void {
  localStorage.setItem(SCREEN_GROUPS_KEY, JSON.stringify(groups));
  void mirrorLocalStorageKeyToDb(SCREEN_GROUPS_KEY);
}

export function upsertScreenGroup(group: ScreenGroupModel): ScreenGroupModel[] {
  const current = loadScreenGroups();
  const idx = current.findIndex((item) => item.id === group.id);
  const next = idx === -1
    ? [...current, { ...group, theme: normalizeTheme(group.theme) }]
    : current.map((item) => (item.id === group.id ? { ...group, theme: normalizeTheme(group.theme) } : item));
  saveScreenGroups(next);
  return next;
}

export function deleteScreenGroup(groupId: string): ScreenGroupModel[] {
  const next = loadScreenGroups().filter((item) => item.id !== groupId);
  saveScreenGroups(next);
  return next;
}
