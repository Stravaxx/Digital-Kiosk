// Service pour gérer les différentes sources de calendrier (iCal, JSON, intégré)
import { readJson } from './dbJsonService';

export type CalendarSourceType = 'ical' | 'json' | 'internal';

export interface CalendarSource {
  id: string;
  type: CalendarSourceType;
  url?: string; // pour iCal ou JSON
  name: string;
  room?: string;
}

export function getCalendarSources(): Promise<CalendarSource[]> {
  return readJson<CalendarSource[]>('/database/calendar-sources.json', [])
    .then((sources) => Array.isArray(sources) ? sources : [])
    .then((sources) => sources
      .map((source) => ({
        id: String(source.id || '').trim(),
        type: (source.type === 'ical' || source.type === 'json' || source.type === 'internal') ? source.type : 'internal',
        url: typeof source.url === 'string' ? source.url.trim() : undefined,
        name: String(source.name || '').trim() || 'Source',
        room: typeof source.room === 'string' ? source.room.trim() : undefined
      }))
      .filter((source) => source.id.length > 0)
    );
}
