// Service pour gestion dynamique des salles
import { readJson, writeJson } from './dbJsonService';

export interface Room {
  id: string;
  name: string;
  calendarId?: string; // id du calendrier associé
  meetingIds?: string[];
  templateId?: string;
}

// Récupère toutes les salles (DB JSON)
export async function getRooms(): Promise<Room[]> {
  return await readJson<Room[]>('/database/rooms.json', []);
}

// Ajoute une salle (disponible H24)
export async function addRoom(room: Room): Promise<void> {
  const rooms = await getRooms();
  rooms.push(room);
  await writeJson('/database/rooms.json', rooms);
}

// Associe une réunion à une salle (via calendrier)
export async function assignMeetingToRoom(roomId: string, eventId: string): Promise<void> {
  const safeRoomId = String(roomId || '').trim();
  const safeEventId = String(eventId || '').trim();
  if (!safeRoomId || !safeEventId) return;

  const rooms = await getRooms();
  const nextRooms = rooms.map((room) => {
    if (room.id !== safeRoomId) return room;
    const current = Array.isArray(room.meetingIds) ? room.meetingIds : [];
    const nextMeetingIds = Array.from(new Set([...current, safeEventId]));
    return {
      ...room,
      meetingIds: nextMeetingIds
    };
  });

  await writeJson('/database/rooms.json', nextRooms);
}
