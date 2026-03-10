import { mirrorLocalStorageKeyToDb } from '../services/clientDbStorage';

export type LayoutZoneType = 'header' | 'main' | 'sidebar' | 'footer' | 'calendar' | 'widget' | 'media';

export interface LayoutZoneModel {
  id: string;
  name: string;
  type: LayoutZoneType;
  content: string;
  playlistId?: string;
}

export interface LayoutModel {
  id: string;
  name: string;
  mode?: 'standard' | 'room-door-display' | 'room-status-board';
  displayTemplate?: 'classic' | 'low-vision';
  resolution: string;
  headerText: string;
  footerText: string;
  footerLogos?: string[];
  zones: LayoutZoneModel[];
}

export const LAYOUTS_KEY = 'ds.layouts';

export function loadLayouts(): LayoutModel[] {
  try {
    const raw = localStorage.getItem(LAYOUTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LayoutModel[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((layout) => ({
      ...layout,
      displayTemplate: layout.displayTemplate === 'low-vision' ? 'low-vision' : 'classic',
      footerLogos: Array.isArray(layout.footerLogos)
        ? layout.footerLogos
          .filter((logo): logo is string => typeof logo === 'string' && logo.trim().length > 0)
          .map((logo) => logo.trim())
        : [],
      zones: Array.isArray(layout.zones)
        ? layout.zones.map((zone) => ({
          ...zone,
          playlistId: typeof zone.playlistId === 'string' ? zone.playlistId : undefined
        }))
        : []
    }));
  } catch {
    return [];
  }
}

export function saveLayouts(layouts: LayoutModel[]): void {
  localStorage.setItem(LAYOUTS_KEY, JSON.stringify(layouts));
  void mirrorLocalStorageKeyToDb(LAYOUTS_KEY);
}

export function upsertLayout(layout: LayoutModel): LayoutModel[] {
  const current = loadLayouts();
  const idx = current.findIndex((item) => item.id === layout.id);
  const next = idx === -1 ? [...current, layout] : current.map((item) => (item.id === layout.id ? layout : item));
  saveLayouts(next);
  return next;
}

export function deleteLayoutById(layoutId: string): LayoutModel[] {
  const next = loadLayouts().filter((item) => item.id !== layoutId);
  saveLayouts(next);
  return next;
}
