import { mirrorLocalStorageKeyToDb } from '../services/clientDbStorage';

export interface RoomModel {
  id: string;
  name: string;
  number: string;
  location: string;
  capacity: number;
  status: 'free' | 'occupied' | 'starting-soon';
}

export interface LocalCalendarEvent {
  id: string;
  title: string;
  status?: 'confirmed' | 'cancelled';
  description: string;
  startAt: string;
  endAt: string;
  roomId: string;
  roomNumber: string;
  facilitators: string[];
  maxParticipants: number;
  updatedAt?: string;
  recurrenceParentId?: string;
  recurrence?: {
    frequency: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek: number[];
    monthsOfYear?: number[];
    until?: string;
    exceptions?: string[];
  };
}

export interface LocalCalendarOccurrence extends LocalCalendarEvent {
  sourceEventId: string;
  occurrenceDate: string;
}

export const ROOMS_KEY = 'ds.rooms';
export const EVENTS_KEY = 'ds.localEvents';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function loadRooms(): RoomModel[] {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RoomModel[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRooms(rooms: RoomModel[]): void {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  void mirrorLocalStorageKeyToDb(ROOMS_KEY);
}

export function loadEvents(): LocalCalendarEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalCalendarEvent[];
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map(normalizeEvent);
    const purged = purgeExpiredEvents(normalized);
    if (purged.length !== normalized.length) {
      localStorage.setItem(EVENTS_KEY, JSON.stringify(purged));
      void mirrorLocalStorageKeyToDb(EVENTS_KEY);
    }
    return purged;
  } catch {
    return [];
  }
}

export function saveEvents(events: LocalCalendarEvent[]): void {
  const normalized = events.map(normalizeEvent);
  localStorage.setItem(EVENTS_KEY, JSON.stringify(normalized));
  void mirrorLocalStorageKeyToDb(EVENTS_KEY);
}

function normalizeEvent(event: LocalCalendarEvent): LocalCalendarEvent {
  const startDate = new Date(event.startAt);
  const defaultWeekDay = Number.isNaN(startDate.getTime()) ? 1 : startDate.getDay();
  const recurrence = event.recurrence
    ? {
        frequency: event.recurrence.frequency ?? 'none',
        interval: Math.max(1, event.recurrence.interval ?? 1),
        daysOfWeek: Array.isArray(event.recurrence.daysOfWeek) ? event.recurrence.daysOfWeek : [defaultWeekDay],
        monthsOfYear: Array.isArray(event.recurrence.monthsOfYear)
          ? event.recurrence.monthsOfYear.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
          : [startDate.getMonth() + 1],
        until: event.recurrence.until,
        exceptions: Array.isArray(event.recurrence.exceptions) ? event.recurrence.exceptions : []
      }
    : {
        frequency: 'none' as const,
        interval: 1,
        daysOfWeek: [defaultWeekDay],
        monthsOfYear: [startDate.getMonth() + 1],
        exceptions: []
      };

  return {
    ...event,
    status: event.status === 'cancelled' ? 'cancelled' : 'confirmed',
    updatedAt: event.updatedAt ?? new Date().toISOString(),
    recurrence
  };
}

function purgeExpiredEvents(events: LocalCalendarEvent[]): LocalCalendarEvent[] {
  const threshold = Date.now() - THIRTY_DAYS_MS;
  return events.filter((event) => {
    const end = new Date(event.endAt).getTime();
    const hasRepeat = Boolean(event.recurrence && event.recurrence.frequency !== 'none');
    const updatedAt = event.updatedAt ? new Date(event.updatedAt).getTime() : Number.NaN;
    const modifiedAfterEvent = Number.isFinite(updatedAt) ? updatedAt > end : false;

    if (end < threshold && (!hasRepeat || !modifiedAfterEvent)) {
      return false;
    }
    return true;
  });
}

function formatDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function combineDateWithTime(day: Date, reference: Date): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    reference.getHours(),
    reference.getMinutes(),
    reference.getSeconds(),
    reference.getMilliseconds()
  );
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / (24 * 60 * 60 * 1000));
}

function diffMonths(a: Date, b: Date): number {
  return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
}

function matchesRecurrenceOnDay(event: LocalCalendarEvent, day: Date): boolean {
  const rule = event.recurrence;
  if (!rule || rule.frequency === 'none') return false;

  const start = new Date(event.startAt);
  if (Number.isNaN(start.getTime())) return false;
  if (startOfDay(day).getTime() < startOfDay(start).getTime()) return false;

  if (rule.until) {
    const until = new Date(rule.until);
    if (!Number.isNaN(until.getTime()) && startOfDay(day).getTime() > startOfDay(until).getTime()) {
      return false;
    }
  }

  const selectedDays = rule.daysOfWeek.length > 0 ? rule.daysOfWeek : [start.getDay()];
  const interval = Math.max(1, rule.interval ?? 1);

  if (rule.frequency === 'daily') {
    const dayDelta = diffDays(day, start);
    return dayDelta >= 0 && dayDelta % interval === 0;
  }

  if (rule.frequency === 'weekly') {
    const weekDelta = Math.floor(diffDays(day, start) / 7);
    return weekDelta >= 0 && weekDelta % interval === 0 && selectedDays.includes(day.getDay());
  }

  if (rule.frequency === 'monthly') {
    const monthDelta = diffMonths(day, start);
    if (monthDelta < 0 || monthDelta % interval !== 0) return false;
    return day.getDate() === start.getDate();
  }

  if (rule.frequency === 'yearly') {
    const yearDelta = day.getFullYear() - start.getFullYear();
    if (yearDelta < 0 || yearDelta % interval !== 0) return false;
    const monthsOfYear = Array.isArray(rule.monthsOfYear) && rule.monthsOfYear.length > 0
      ? rule.monthsOfYear
      : [start.getMonth() + 1];
    const month = day.getMonth() + 1;
    if (!monthsOfYear.includes(month)) return false;
    return day.getDate() === start.getDate();
  }

  return false;
}

function toOccurrence(event: LocalCalendarEvent, start: Date, end: Date, sourceId: string): LocalCalendarOccurrence {
  const recurrence = event.recurrence ?? {
    frequency: 'none' as const,
    interval: 1,
    daysOfWeek: [],
    monthsOfYear: [],
    exceptions: []
  };
  return {
    ...event,
    id: `${sourceId}__${formatDayKey(start)}`,
    recurrenceParentId: sourceId,
    recurrence: { ...recurrence, frequency: 'none', interval: 1, daysOfWeek: [], monthsOfYear: [], exceptions: [] },
    sourceEventId: sourceId,
    occurrenceDate: formatDayKey(start),
    startAt: start.toISOString(),
    endAt: end.toISOString()
  };
}

export function expandEventsForPeriod(events: LocalCalendarEvent[], fromDate: Date, toDate: Date): LocalCalendarOccurrence[] {
  const from = fromDate.getTime();
  const to = toDate.getTime();
  const occurrences: LocalCalendarOccurrence[] = [];

  events.forEach((event) => {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

    const durationMs = Math.max(1, end.getTime() - start.getTime());
    const recurrence = event.recurrence;
    const sourceId = event.id;
    const exceptionSet = new Set(recurrence?.exceptions ?? []);

    if (!recurrence || recurrence.frequency === 'none') {
      if (end.getTime() >= from && start.getTime() <= to) {
        occurrences.push({ ...event, sourceEventId: sourceId, occurrenceDate: formatDayKey(start) });
      }
      return;
    }

    let cursor = startOfDay(new Date(Math.max(startOfDay(start).getTime(), startOfDay(fromDate).getTime())));
    const lastDay = startOfDay(toDate);

    while (cursor.getTime() <= lastDay.getTime()) {
      if (matchesRecurrenceOnDay(event, cursor)) {
        const dayKey = formatDayKey(cursor);
        if (!exceptionSet.has(dayKey)) {
          const occurrenceStart = combineDateWithTime(cursor, start);
          const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
          if (occurrenceEnd.getTime() >= from && occurrenceStart.getTime() <= to) {
            occurrences.push(toOccurrence(event, occurrenceStart, occurrenceEnd, sourceId));
          }
        }
      }
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
  });

  return occurrences.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

export function createExceptionForOccurrence(event: LocalCalendarEvent, occurrenceDate: string): LocalCalendarEvent {
  const recurrence = event.recurrence ?? {
    frequency: 'none' as const,
    interval: 1,
    daysOfWeek: [],
    monthsOfYear: [],
    exceptions: []
  };
  const nextExceptions = Array.from(new Set([...(recurrence.exceptions ?? []), occurrenceDate]));
  return {
    ...event,
    recurrence: {
      ...recurrence,
      exceptions: nextExceptions
    },
    updatedAt: new Date().toISOString()
  };
}

export function validateEventCapacity(event: Pick<LocalCalendarEvent, 'roomId' | 'maxParticipants'>, rooms: RoomModel[]): string | null {
  const room = rooms.find((item) => item.id === event.roomId);
  if (!room) return 'Salle introuvable.';
  if (event.maxParticipants > room.capacity) {
    return `Le maximum de participants (${event.maxParticipants}) dépasse la capacité de la salle (${room.capacity}).`;
  }
  return null;
}
