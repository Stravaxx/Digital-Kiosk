// Calendar Engine : support iCal, JSON, intégré
import { readJson } from './dbJsonService';
import { getCalendarSources } from './calendarSourceService';

export type CalendarEventSource = 'ical' | 'json' | 'internal';

export async function getEventsForRoom(roomId: string, sourceType: CalendarEventSource, sourceId: string): Promise<any[]> {
  if (sourceType === 'ical') {
    // Charger depuis le cache iCal
    return await readJson<any[]>(`/storage/cache/calendar/${sourceId}.json`);
  }
  if (sourceType === 'json') {
    // Charger depuis un fichier JSON
    return await readJson<any[]>(`/storage/cache/calendar/${sourceId}.json`);
  }
  if (sourceType === 'internal') {
    // Charger depuis la DB JSON interne
    return await readJson<any[]>(`/database/events.json`);
  }
  return [];
}

export async function getAllEvents(): Promise<any[]> {
  // Fusionne tous les événements de toutes les sources
  const sources = await getCalendarSources();
  let allEvents: any[] = [];
  for (const src of sources) {
    if (src.type === 'ical' && src.id) {
      const events = await readJson<any[]>(`/storage/cache/calendar/${src.id}.json`);
      allEvents = allEvents.concat(events);
    }
    if (src.type === 'json' && src.id) {
      const events = await readJson<any[]>(`/storage/cache/calendar/${src.id}.json`);
      allEvents = allEvents.concat(events);
    }
    if (src.type === 'internal') {
      const events = await readJson<any[]>('/database/events.json', []);
      allEvents = allEvents.concat(events);
    }
  }
  return allEvents;
}
