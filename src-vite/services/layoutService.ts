// Service pour gestion dynamique des layouts
import { readJson, writeJson } from './dbJsonService';

export interface LayoutZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'playlist' | 'calendar' | 'widget' | 'media' | 'iframe';
}

export interface Layout {
  id: string;
  name: string;
  zones: LayoutZone[];
  resolution: string;
  style?: any;
}

export async function getLayouts(): Promise<Layout[]> {
  return await readJson<Layout[]>('/database/layouts.json');
}

export async function addLayout(layout: Layout): Promise<void> {
  const layouts = await getLayouts();
  layouts.push(layout);
  await writeJson('/database/layouts.json', layouts);
}

export async function updateLayout(layout: Layout): Promise<void> {
  const layouts = await getLayouts();
  const idx = layouts.findIndex(l => l.id === layout.id);
  if (idx !== -1) {
    layouts[idx] = layout;
    await writeJson('/database/layouts.json', layouts);
  }
}
