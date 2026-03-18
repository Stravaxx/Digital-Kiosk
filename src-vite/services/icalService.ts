import { DateTime } from 'luxon';
import ical from 'ical';
import { writeJson } from './dbJsonService';
import { getCalendarSources } from './calendarSourceService';

export interface ICalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  room?: string;
  organizer?: string;
  location?: string;
}

/**
 * Récupère et parse un flux iCal, retourne la liste des événements normalisés
 */
export async function fetchICal(url: string): Promise<ICalEvent[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Erreur lors du fetch iCal');
  const icalText = await res.text();
  const data = ical.parseICS(icalText);
  const events: ICalEvent[] = [];
  for (const k in data) {
    const ev = data[k] as {
      type?: string;
      uid?: string;
      summary?: string;
      start?: Date;
      end?: Date;
      location?: string;
      organizer?: { val?: string };
    };
    if (ev.type === 'VEVENT' && ev.start instanceof Date && ev.end instanceof Date) {
      const startIso = DateTime.fromJSDate(ev.start).toISO() ?? ev.start.toISOString();
      const endIso = DateTime.fromJSDate(ev.end).toISO() ?? ev.end.toISOString();
      events.push({
        id: ev.uid || k,
        title: ev.summary || '',
        start: startIso,
        end: endIso,
        room: ev.location || '',
        organizer: ev.organizer?.val || '',
        location: ev.location || ''
      });
    }
  }
  return events;
}

export async function syncICalSourcesToCache(): Promise<{ synced: number; failed: number }> {
  const sources = await getCalendarSources();
  let synced = 0;
  let failed = 0;

  for (const source of sources) {
    if (source.type !== 'ical' || !source.url) continue;
    try {
      const events = await fetchICal(source.url);
      await writeJson(`/storage/cache/calendar/${source.id}.json`, events);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return { synced, failed };
}
