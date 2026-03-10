// Service pour synchroniser et stocker les événements de toutes les sources calendrier
import { fetchICal } from './icalService';
import { getCalendarSources, CalendarSource } from './calendarSourceService';
import { readJson, writeJson } from './dbJsonService';

export async function syncAllICalSources() {
  const sources = await getCalendarSources();
  for (const src of sources) {
    if (src.type === 'ical' && src.url) {
      const events = await fetchICal(src.url);
      // Stocker dans /storage/cache/calendar/{src.id}.json
      await writeJson(`/storage/cache/calendar/${src.id}.json`, events);
    }

    if (src.type === 'json' && src.url) {
      try {
        const response = await fetch(src.url);
        if (!response.ok) continue;
        const events = await response.json();
        await writeJson(`/storage/cache/calendar/${src.id}.json`, Array.isArray(events) ? events : []);
      } catch {
        // ignore source fetch error
      }
    }

    if (src.type === 'internal') {
      const events = await readJson<any[]>('/database/events.json', []);
      await writeJson(`/storage/cache/calendar/${src.id}.json`, events);
    }
  }
}
