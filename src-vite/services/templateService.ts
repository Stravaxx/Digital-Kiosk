// Service pour gestion dynamique des templates de salles
import { readJson, writeJson } from './dbJsonService';
import type { Layout } from './layoutService';

export interface RoomTemplate {
  id: string;
  name: string;
  layoutId: string;
  widgets: string[];
  zones: string[];
  style?: any;
  color?: string;
  status?: 'libre' | 'En Cours' | 'prochain';
}

export async function getRoomTemplates(): Promise<RoomTemplate[]> {
  return await readJson<RoomTemplate[]>('/database/templates.json', []);
}

export async function addRoomTemplate(template: RoomTemplate): Promise<void> {
  const templates = await getRoomTemplates();
  templates.push(template);
  await writeJson('/database/templates.json', templates);
}

export async function assignTemplateToRoom(roomId: string, templateId: string): Promise<void> {
  const safeRoomId = String(roomId || '').trim();
  const safeTemplateId = String(templateId || '').trim();
  if (!safeRoomId || !safeTemplateId) return;

  const rooms = await readJson<Array<Record<string, unknown>>>('/database/rooms.json', []);
  const nextRooms = rooms.map((room) => {
    if (String(room.id || '').trim() !== safeRoomId) return room;
    return {
      ...room,
      templateId: safeTemplateId
    };
  });

  await writeJson('/database/rooms.json', nextRooms);
}
