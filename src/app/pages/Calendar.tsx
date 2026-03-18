import React, { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Plus, Trash2, Users, Clock, Pencil, Copy } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import {
  createExceptionForOccurrence,
  expandEventsForPeriod,
  loadEvents,
  loadRooms,
  saveEvents,
  type LocalCalendarEvent,
  type LocalCalendarOccurrence,
  type RoomModel,
  validateEventCapacity
} from '../../shared/localCalendar';

interface EventForm {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  roomId: string;
  facilitators: string;
  maxParticipants: string;
  recurrenceFrequency: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceInterval: string;
  recurrenceUntil: string;
  recurrenceDays: boolean[];
  recurrenceMonths: boolean[];
}

const emptyForm: EventForm = {
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  roomId: '',
  facilitators: '',
  maxParticipants: '',
  recurrenceFrequency: 'none',
  recurrenceInterval: '1',
  recurrenceUntil: '',
  recurrenceDays: [false, false, false, false, false, false, false],
  recurrenceMonths: [false, false, false, false, false, false, false, false, false, false, false, false]
};

function toLocalInputDateTime(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

const weekdayLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Dec'];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
type CalendarSortMode = 'date' | 'az' | 'za' | 'room';

function getOccurrenceSourceId(occurrence: LocalCalendarOccurrence): string {
  return occurrence.sourceEventId || occurrence.recurrenceParentId || occurrence.id;
}

function keepSingleOccurrencePerSeries(
  occurrences: LocalCalendarOccurrence[],
  nowMs: number,
  mode: 'upcoming' | 'past'
): LocalCalendarOccurrence[] {
  const grouped = new Map<string, LocalCalendarOccurrence[]>();

  occurrences.forEach((occurrence) => {
    const key = getOccurrenceSourceId(occurrence);
    const list = grouped.get(key) ?? [];
    list.push(occurrence);
    grouped.set(key, list);
  });

  const picked: LocalCalendarOccurrence[] = [];

  grouped.forEach((list) => {
    const sorted = [...list].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    if (mode === 'upcoming') {
      const next = sorted.find((item) => new Date(item.endAt).getTime() >= nowMs);
      if (next) picked.push(next);
      return;
    }

    const past = [...sorted]
      .filter((item) => new Date(item.endAt).getTime() < nowMs)
      .sort((a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime())[0];
    if (past) picked.push(past);
  });

  return picked.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function dayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function normalizeSearchTerm(value: string): string {
  return String(value || '').trim().toLocaleLowerCase('fr-FR');
}

function matchesSearchTerm(occurrence: LocalCalendarOccurrence, query: string): boolean {
  if (!query) return true;

  const haystack = [
    occurrence.title,
    occurrence.description,
    occurrence.roomNumber,
    ...(Array.isArray(occurrence.facilitators) ? occurrence.facilitators : [])
  ]
    .map((value) => String(value || '').toLocaleLowerCase('fr-FR'))
    .join(' ');

  return haystack.includes(query);
}

function sortOccurrences(list: LocalCalendarOccurrence[], mode: CalendarSortMode): LocalCalendarOccurrence[] {
  const next = [...list];
  if (mode === 'az') {
    return next.sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
  }
  if (mode === 'za') {
    return next.sort((a, b) => b.title.localeCompare(a.title, 'fr', { sensitivity: 'base' }));
  }
  if (mode === 'room') {
    return next.sort((a, b) => {
      const byRoom = a.roomNumber.localeCompare(b.roomNumber, 'fr', { sensitivity: 'base' });
      if (byRoom !== 0) return byRoom;
      return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
    });
  }

  return next.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function recurrenceDaysToFlags(days: number[]): boolean[] {
  const map = [false, false, false, false, false, false, false];
  days.forEach((day) => {
    if (day >= 0 && day <= 6) map[day] = true;
  });
  return map;
}

function defaultDaysFromStart(startAt: string): boolean[] {
  const map = [false, false, false, false, false, false, false];
  const date = new Date(startAt);
  if (!Number.isNaN(date.getTime())) {
    map[date.getDay()] = true;
  }
  return map;
}

function recurrenceMonthsToFlags(months: number[]): boolean[] {
  const map = [false, false, false, false, false, false, false, false, false, false, false, false];
  months.forEach((month) => {
    if (month >= 1 && month <= 12) map[month - 1] = true;
  });
  return map;
}

function defaultMonthsFromStart(startAt: string): boolean[] {
  const map = [false, false, false, false, false, false, false, false, false, false, false, false];
  const date = new Date(startAt);
  if (!Number.isNaN(date.getTime())) {
    map[date.getMonth()] = true;
  }
  return map;
}

function buildRecurrenceFromForm(form: EventForm): LocalCalendarEvent['recurrence'] {
  if (form.recurrenceFrequency === 'none') {
    return {
      frequency: 'none',
      interval: 1,
      daysOfWeek: [],
      exceptions: []
    };
  }

  const interval = Math.max(1, Number.parseInt(form.recurrenceInterval, 10) || 1);
  let daysOfWeek = form.recurrenceDays
    .map((checked, index) => (checked ? index : -1))
    .filter((index) => index !== -1);

  let monthsOfYear = form.recurrenceMonths
    .map((checked, index) => (checked ? index + 1 : -1))
    .filter((month) => month !== -1);

  if (form.recurrenceFrequency === 'weekly' && daysOfWeek.length === 0) {
    const fallback = new Date(form.startAt);
    if (!Number.isNaN(fallback.getTime())) {
      daysOfWeek = [fallback.getDay()];
    }
  }

  if (form.recurrenceFrequency !== 'weekly') {
    daysOfWeek = [];
  }

  if (form.recurrenceFrequency === 'yearly' && monthsOfYear.length === 0) {
    const fallback = new Date(form.startAt);
    if (!Number.isNaN(fallback.getTime())) {
      monthsOfYear = [fallback.getMonth() + 1];
    }
  }

  if (form.recurrenceFrequency !== 'yearly') {
    monthsOfYear = [];
  }

  return {
    frequency: form.recurrenceFrequency,
    interval,
    daysOfWeek,
    monthsOfYear,
    until: form.recurrenceUntil || undefined,
    exceptions: []
  };
}

export function Calendar() {
  const [rooms, setRooms] = useState<RoomModel[]>([]);
  const [events, setEvents] = useState<LocalCalendarEvent[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingOccurrenceDate, setEditingOccurrenceDate] = useState<string>('');
  const [applyScope, setApplyScope] = useState<'series' | 'single'>('series');
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<CalendarSortMode>('date');
  const [dateSliderValue, setDateSliderValue] = useState(0);

  useEffect(() => {
    setRooms(loadRooms());
    setEvents(loadEvents());
  }, []);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === form.roomId) ?? null,
    [form.roomId, rooms]
  );

  const toInputDateTime = (value: string) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      return value.slice(0, 16);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return shifted.toISOString().slice(0, 16);
  };

  const openCreateModal = () => {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setEditingEventId(null);
    setEditingOccurrenceDate('');
    setApplyScope('series');
    setForm({
      ...emptyForm,
      startAt: toLocalInputDateTime(start),
      endAt: toLocalInputDateTime(end),
      recurrenceDays: defaultDaysFromStart(toLocalInputDateTime(start)),
      recurrenceMonths: defaultMonthsFromStart(toLocalInputDateTime(start))
    });
    setFormError('');
    setShowEventModal(true);
  };

  const openDuplicateModal = (occurrence: LocalCalendarOccurrence) => {
    const source = events.find((item) => item.id === occurrence.sourceEventId || item.id === occurrence.id) ?? occurrence;
    const startValue = toInputDateTime(occurrence.startAt);

    setEditingEventId(null);
    setEditingOccurrenceDate('');
    setApplyScope('series');
    setForm({
      title: source.title,
      description: source.description,
      startAt: startValue,
      endAt: toInputDateTime(occurrence.endAt),
      roomId: source.roomId,
      facilitators: source.facilitators.join(', '),
      maxParticipants: String(source.maxParticipants),
      recurrenceFrequency: source.recurrence?.frequency ?? 'none',
      recurrenceInterval: String(source.recurrence?.interval ?? 1),
      recurrenceUntil: toInputDateTime(source.recurrence?.until ?? ''),
      recurrenceDays:
        source.recurrence?.frequency === 'weekly'
          ? recurrenceDaysToFlags(source.recurrence.daysOfWeek)
          : defaultDaysFromStart(startValue),
      recurrenceMonths:
        source.recurrence?.frequency === 'yearly'
          ? recurrenceMonthsToFlags(source.recurrence.monthsOfYear ?? [])
          : defaultMonthsFromStart(startValue)
    });
    setFormError('');
    setShowEventModal(true);
  };

  const openEditModal = (occurrence: LocalCalendarOccurrence) => {
    const source = events.find((item) => item.id === occurrence.sourceEventId || item.id === occurrence.id) ?? occurrence;
    const sourceStartDay = dayKey(source.startAt);
    const currentOccurrenceDay = occurrence.occurrenceDate;
    const recurring = Boolean(source.recurrence && source.recurrence.frequency !== 'none');

    setEditingEventId(source.id);
    setEditingOccurrenceDate(currentOccurrenceDay);
    setApplyScope(recurring && sourceStartDay !== currentOccurrenceDay ? 'single' : 'series');
    setForm({
      title: source.title,
      description: source.description,
      startAt: toInputDateTime(occurrence.startAt),
      endAt: toInputDateTime(occurrence.endAt),
      roomId: source.roomId,
      facilitators: source.facilitators.join(', '),
      maxParticipants: String(source.maxParticipants),
      recurrenceFrequency: source.recurrence?.frequency ?? 'none',
      recurrenceInterval: String(source.recurrence?.interval ?? 1),
      recurrenceUntil: toInputDateTime(source.recurrence?.until ?? ''),
      recurrenceDays:
        source.recurrence?.frequency === 'weekly'
          ? recurrenceDaysToFlags(source.recurrence.daysOfWeek)
          : [false, false, false, false, false, false, false],
      recurrenceMonths:
        source.recurrence?.frequency === 'yearly'
          ? recurrenceMonthsToFlags(source.recurrence.monthsOfYear ?? [])
          : [false, false, false, false, false, false, false, false, false, false, false, false]
    });
    setFormError('');
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setEditingEventId(null);
    setEditingOccurrenceDate('');
    setApplyScope('series');
    setForm(emptyForm);
    setFormError('');
  };

  const now = Date.now();
  const timeline = useMemo(
    () => expandEventsForPeriod(events, new Date(now - THIRTY_DAYS_MS), new Date(now + NINETY_DAYS_MS)),
    [events, now]
  );
  const upcomingEvents = useMemo(
    () => keepSingleOccurrencePerSeries(timeline, now, 'upcoming'),
    [timeline, now]
  );
  const pastEvents = useMemo(
    () => keepSingleOccurrencePerSeries(timeline, now, 'past'),
    [timeline, now]
  );
  const normalizedSearch = useMemo(() => normalizeSearchTerm(searchTerm), [searchTerm]);
  const timelineBounds = useMemo(() => {
    if (timeline.length === 0) return null;
    const values = timeline
      .map((item) => new Date(item.startAt).getTime())
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) return null;
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }, [timeline]);

  const selectedDateMs = useMemo(() => {
    if (!timelineBounds) return null;
    const range = timelineBounds.max - timelineBounds.min;
    if (range <= 0) return timelineBounds.min;
    return timelineBounds.min + (range * dateSliderValue) / 100;
  }, [timelineBounds, dateSliderValue]);

  const filteredUpcomingEvents = useMemo(() => {
    let list = upcomingEvents.filter((event) => matchesSearchTerm(event, normalizedSearch));

    if (sortMode === 'date' && selectedDateMs !== null) {
      list = list.filter((event) => new Date(event.startAt).getTime() >= selectedDateMs);
    }

    return sortOccurrences(list, sortMode);
  }, [upcomingEvents, normalizedSearch, sortMode, selectedDateMs]);

  const filteredPastEvents = useMemo(() => {
    let list = pastEvents.filter((event) => matchesSearchTerm(event, normalizedSearch));

    if (sortMode === 'date' && selectedDateMs !== null) {
      list = list.filter((event) => new Date(event.startAt).getTime() <= selectedDateMs);
    }

    return sortOccurrences(list, sortMode);
  }, [pastEvents, normalizedSearch, sortMode, selectedDateMs]);

  const saveEvent = () => {
    setFormError('');

    if (!form.title.trim() || !form.startAt || !form.endAt || !form.roomId || !form.maxParticipants.trim()) {
      setFormError('Tous les champs sont requis.');
      return;
    }

    if (new Date(form.endAt).getTime() <= new Date(form.startAt).getTime()) {
      setFormError('La fin doit être après le début.');
      return;
    }

    const maxParticipants = Number.parseInt(form.maxParticipants, 10);
    if (Number.isNaN(maxParticipants) || maxParticipants <= 0) {
      setFormError('Le nombre maximum de participants doit être supérieur à 0.');
      return;
    }

    const room = rooms.find((item) => item.id === form.roomId);
    if (!room) {
      setFormError('La salle sélectionnée est introuvable.');
      return;
    }

    const facilitators = form.facilitators
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    const recurrence = buildRecurrenceFromForm(form);
    const sourceEvent = editingEventId ? events.find((event) => event.id === editingEventId) : null;

    const payload: LocalCalendarEvent = {
      id: editingEventId ?? `event-${Date.now()}`,
      title: form.title.trim(),
      status: sourceEvent?.status ?? 'confirmed',
      description: form.description.trim(),
      startAt: form.startAt,
      endAt: form.endAt,
      roomId: room.id,
      roomNumber: room.number,
      facilitators,
      maxParticipants,
      recurrence,
      updatedAt: new Date().toISOString()
    };

    const capacityError = validateEventCapacity(payload, rooms);
    if (capacityError) {
      setFormError(capacityError);
      return;
    }

    let nextEvents: LocalCalendarEvent[] = [];

    if (!editingEventId) {
      nextEvents = [...events, payload];
    } else if (applyScope === 'single' && editingOccurrenceDate) {
      const source = events.find((event) => event.id === editingEventId);
      if (!source) {
        setFormError('Événement source introuvable.');
        return;
      }
      const updatedSource = createExceptionForOccurrence(source, editingOccurrenceDate);
      const detachedEvent: LocalCalendarEvent = {
        ...payload,
        id: `event-${Date.now()}`,
        recurrenceParentId: source.id,
        recurrence: {
          frequency: 'none',
          interval: 1,
          daysOfWeek: [],
          monthsOfYear: [],
          exceptions: []
        }
      };

      nextEvents = events
        .map((event) => (event.id === source.id ? updatedSource : event))
        .concat(detachedEvent);
    } else {
      nextEvents = events.map((event) => (event.id === editingEventId ? payload : event));
    }

    nextEvents = nextEvents.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    setEvents(nextEvents);
    saveEvents(nextEvents);
    closeEventModal();
  };

  const removeEvent = (occurrence: LocalCalendarOccurrence) => {
    const source = events.find((event) => event.id === occurrence.sourceEventId || event.id === occurrence.id);
    if (!source) return;

    const sourceDay = dayKey(source.startAt);
    const isRecurring = Boolean(source.recurrence && source.recurrence.frequency !== 'none');
    const isSingleOccurrence = isRecurring && sourceDay !== occurrence.occurrenceDate;

    let nextEvents: LocalCalendarEvent[];
    if (isSingleOccurrence) {
      nextEvents = events.map((event) =>
        event.id === source.id ? createExceptionForOccurrence(event, occurrence.occurrenceDate) : event
      );
    } else {
      nextEvents = events.filter((event) => event.id !== source.id);
    }

    setEvents(nextEvents);
    saveEvents(nextEvents);
  };

  const toggleEventCancellation = (occurrence: LocalCalendarOccurrence) => {
    const source = events.find((event) => event.id === occurrence.sourceEventId || event.id === occurrence.id);
    if (!source) return;

    const sourceDay = dayKey(source.startAt);
    const isRecurring = Boolean(source.recurrence && source.recurrence.frequency !== 'none');
    const isSingleOccurrence = isRecurring && sourceDay !== occurrence.occurrenceDate;
    const nextStatus: LocalCalendarEvent['status'] = occurrence.status === 'cancelled' ? 'confirmed' : 'cancelled';
    const nowIso = new Date().toISOString();

    let nextEvents: LocalCalendarEvent[];

    if (isSingleOccurrence) {
      const updatedSource = createExceptionForOccurrence(source, occurrence.occurrenceDate);
      const existingDetached = events.find((event) =>
        event.recurrenceParentId === source.id
        && (event.recurrence?.frequency ?? 'none') === 'none'
        && dayKey(event.startAt) === occurrence.occurrenceDate
      );

      const detachedEvent: LocalCalendarEvent = existingDetached
        ? {
            ...existingDetached,
            status: nextStatus,
            updatedAt: nowIso
          }
        : {
            ...source,
            id: `event-${Date.now()}`,
            status: nextStatus,
            startAt: occurrence.startAt,
            endAt: occurrence.endAt,
            recurrenceParentId: source.id,
            recurrence: {
              frequency: 'none',
              interval: 1,
              daysOfWeek: [],
              monthsOfYear: [],
              exceptions: []
            },
            updatedAt: nowIso
          };

      nextEvents = events
        .map((event) => {
          if (event.id === source.id) return updatedSource;
          if (existingDetached && event.id === existingDetached.id) return detachedEvent;
          return event;
        });

      if (!existingDetached) {
        nextEvents.push(detachedEvent);
      }
    } else {
      nextEvents = events.map((event) => (
        event.id === source.id
          ? { ...event, status: nextStatus, updatedAt: nowIso }
          : event
      ));
    }

    nextEvents = nextEvents.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    setEvents(nextEvents);
    saveEvents(nextEvents);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#e5e7eb] mb-2">Calendrier local</h1>
          <p className="text-[#9ca3af]">Les événements sont saisis localement. Le connecteur iCal sera ajouté plus tard.</p>
        </div>
        <GlassButton onClick={openCreateModal}>
          <Plus size={20} className="inline mr-2" />
          Ajouter un événement
        </GlassButton>
      </div>

      {rooms.length === 0 && (
        <GlassCard className="p-6">
          <p className="text-[#f59e0b]">Ajoutez d’abord une salle dans la section Salles avant de créer des événements.</p>
        </GlassCard>
      )}

      <GlassCard className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="calendar-search" className="block text-[#e5e7eb] mb-2">Recherche événement (mots-clés)</label>
            <input
              id="calendar-search"
              type="text"
              placeholder="Titre, description, salle, animateur..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
            />
          </div>
          <div>
            <label htmlFor="calendar-sort" className="block text-[#e5e7eb] mb-2">Tri</label>
            <select
              id="calendar-sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as CalendarSortMode)}
              className="w-full appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
            >
              <option className="bg-[#111827] text-[#e5e7eb]" value="date">Date</option>
              <option className="bg-[#111827] text-[#e5e7eb]" value="az">Ordre alphabétique A-Z</option>
              <option className="bg-[#111827] text-[#e5e7eb]" value="za">Ordre alphabétique Z-A</option>
              <option className="bg-[#111827] text-[#e5e7eb]" value="room">Tri par salle</option>
            </select>
          </div>
        </div>

        {sortMode === 'date' && timelineBounds && selectedDateMs !== null ? (
          <div>
            <label htmlFor="calendar-date-slider" className="block text-[#e5e7eb] mb-2">
              Date pivot: {new Date(selectedDateMs).toLocaleString('fr-FR')}
            </label>
            <input
              id="calendar-date-slider"
              type="range"
              min={0}
              max={100}
              value={dateSliderValue}
              onChange={(event) => setDateSliderValue(Number(event.target.value) || 0)}
              className="w-full"
            />
            <div className="flex items-center justify-between text-xs text-[#9ca3af] mt-1">
              <span>{new Date(timelineBounds.min).toLocaleDateString('fr-FR')}</span>
              <span>{new Date(timelineBounds.max).toLocaleDateString('fr-FR')}</span>
            </div>
          </div>
        ) : null}
      </GlassCard>

      {timeline.length === 0 ? (
        <GlassCard className="p-6">
          <div className="text-center py-20">
            <CalendarIcon size={64} className="mx-auto text-[#9ca3af] opacity-50 mb-4" />
            <h3 className="text-lg text-[#e5e7eb] mb-2">Aucun événement</h3>
            <p className="text-[#9ca3af]">Créez votre premier événement avec salle et capacité.</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg text-[#e5e7eb]">À venir ({filteredUpcomingEvents.length})</h2>
          {filteredUpcomingEvents.map((event) => (
            <GlassCard key={event.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <h3 className="text-[#e5e7eb] font-medium text-lg">{event.title}</h3>
                  {event.status === 'cancelled' && (
                    <div className="text-xs text-[#ef4444] uppercase">Status: annulé</div>
                  )}
                  <p className="text-[#9ca3af]">{event.description}</p>
                  <div className="flex items-center gap-2 text-sm text-[#e5e7eb]">
                    <Clock size={14} />
                    <span>{new Date(event.startAt).toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="text-sm text-[#9ca3af]">Salle n°{event.roomNumber}</div>
                  <div className="flex items-center gap-2 text-sm text-[#9ca3af]">
                    <Users size={14} />
                    <span>Animateurs: {event.facilitators.join(', ')}</span>
                  </div>
                  <div className="text-sm text-[#9ca3af]">Nombre de participants: {event.maxParticipants}</div>
                  {event.recurrence && event.recurrence.frequency !== 'none' && (
                    <div className="text-xs text-[#3b82f6] uppercase">Répétition: {event.recurrence.frequency}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Dupliquer l'événement"
                    title="Dupliquer l'événement"
                    onClick={() => openDuplicateModal(event)}
                    className="p-2 hover:bg-[rgba(168,85,247,0.1)] rounded-[8px] transition-colors"
                  >
                    <Copy size={16} className="text-[#a855f7]" />
                  </button>
                  <button
                    type="button"
                    aria-label={event.status === 'cancelled' ? 'Réactiver l\'événement' : 'Annuler l\'événement'}
                    title={event.status === 'cancelled' ? 'Réactiver l\'événement' : 'Annuler l\'événement'}
                    onClick={() => toggleEventCancellation(event)}
                    className="px-2 py-1 text-xs rounded-[8px] border border-[rgba(239,68,68,0.45)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                  >
                    {event.status === 'cancelled' ? 'Réactiver' : 'Annuler'}
                  </button>
                  <button
                    type="button"
                    aria-label="Modifier l'événement"
                    title="Modifier l'événement"
                    onClick={() => openEditModal(event)}
                    className="p-2 hover:bg-[rgba(59,130,246,0.1)] rounded-[8px] transition-colors"
                  >
                    <Pencil size={16} className="text-[#3b82f6]" />
                  </button>
                  <button
                    type="button"
                    aria-label="Supprimer l'événement"
                    title="Supprimer l'événement"
                    onClick={() => removeEvent(event)}
                    className="p-2 hover:bg-[rgba(239,68,68,0.1)] rounded-[8px] transition-colors"
                  >
                    <Trash2 size={16} className="text-[#ef4444]" />
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}

          <h2 className="text-lg text-[#e5e7eb] pt-2">Passé ({filteredPastEvents.length})</h2>
          {filteredPastEvents.length === 0 ? (
            <GlassCard className="p-5 text-[#9ca3af]">Aucun événement passé dans les 30 derniers jours.</GlassCard>
          ) : (
            filteredPastEvents.map((event) => (
              <GlassCard key={event.id} className="p-5 opacity-80">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <h3 className="text-[#e5e7eb] font-medium">{event.title}</h3>
                    {event.status === 'cancelled' && (
                      <div className="text-xs text-[#ef4444] uppercase">Status: annulé</div>
                    )}
                    <p className="text-[#9ca3af] text-sm">{new Date(event.startAt).toLocaleString('fr-FR')} → {new Date(event.endAt).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Dupliquer l'événement"
                      title="Dupliquer l'événement"
                      onClick={() => openDuplicateModal(event)}
                      className="p-2 hover:bg-[rgba(168,85,247,0.1)] rounded-[8px] transition-colors"
                    >
                      <Copy size={16} className="text-[#a855f7]" />
                    </button>
                    <button
                      type="button"
                      aria-label={event.status === 'cancelled' ? 'Réactiver l\'événement' : 'Annuler l\'événement'}
                      title={event.status === 'cancelled' ? 'Réactiver l\'événement' : 'Annuler l\'événement'}
                      onClick={() => toggleEventCancellation(event)}
                      className="px-2 py-1 text-xs rounded-[8px] border border-[rgba(239,68,68,0.45)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                    >
                      {event.status === 'cancelled' ? 'Réactiver' : 'Annuler'}
                    </button>
                    <button
                      type="button"
                      aria-label="Supprimer l'événement"
                      title="Supprimer l'événement"
                      onClick={() => removeEvent(event)}
                      className="p-2 hover:bg-[rgba(239,68,68,0.1)] rounded-[8px] transition-colors"
                    >
                      <Trash2 size={16} className="text-[#ef4444]" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      )}

      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="w-full max-w-2xl p-6">
            <h2 className="text-xl text-[#e5e7eb] mb-6">{editingEventId ? 'Modifier un événement local' : 'Nouvel événement local'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="event-title" className="block text-[#e5e7eb] mb-2">Nom</label>
                <input
                  id="event-title"
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="event-description" className="block text-[#e5e7eb] mb-2">Description</label>
                <textarea
                  id="event-description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  rows={3}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>

              <div>
                <label htmlFor="event-start" className="block text-[#e5e7eb] mb-2">Date et heure</label>
                <input
                  id="event-start"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(event) => {
                    const nextStart = event.target.value;
                    let nextDays = form.recurrenceDays;
                    let nextMonths = form.recurrenceMonths;
                    if (form.recurrenceFrequency === 'weekly') {
                      nextDays = defaultDaysFromStart(nextStart);
                    }
                    if (form.recurrenceFrequency === 'yearly') {
                      nextMonths = defaultMonthsFromStart(nextStart);
                    }
                    setForm({ ...form, startAt: nextStart, recurrenceDays: nextDays, recurrenceMonths: nextMonths });
                  }}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>

              <div>
                <label htmlFor="event-end" className="block text-[#e5e7eb] mb-2">Date et heure de fin</label>
                <input
                  id="event-end"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(event) => setForm({ ...form, endAt: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>

              <div>
                <label htmlFor="event-room" className="block text-[#e5e7eb] mb-2">Salle (numéro)</label>
                <select
                  id="event-room"
                  value={form.roomId}
                  onChange={(event) => setForm({ ...form, roomId: event.target.value })}
                  className="w-full appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                >
                  <option className="bg-[#111827] text-[#e5e7eb]" value="">Sélectionner</option>
                  {rooms.map((room) => (
                    <option className="bg-[#111827] text-[#e5e7eb]" key={room.id} value={room.id}>
                      {room.number} - {room.name} (capacité {room.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="event-facilitators" className="block text-[#e5e7eb] mb-2">Animateurs</label>
                <input
                  id="event-facilitators"
                  type="text"
                  placeholder="Ex: Alice Martin, Paul Dupont"
                  value={form.facilitators}
                  onChange={(event) => setForm({ ...form, facilitators: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>

              <div>
                <label htmlFor="event-max" className="block text-[#e5e7eb] mb-2">Nombre max de participants</label>
                <input
                  id="event-max"
                  type="number"
                  min={1}
                  value={form.maxParticipants}
                  onChange={(event) => setForm({ ...form, maxParticipants: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
                {selectedRoom && (
                  <p className="text-xs text-[#9ca3af] mt-2">Capacité de la salle: {selectedRoom.capacity}</p>
                )}
              </div>

              <div>
                <label htmlFor="recurrence-frequency" className="block text-[#e5e7eb] mb-2">Répétition</label>
                <select
                  id="recurrence-frequency"
                  value={form.recurrenceFrequency}
                  onChange={(event) => {
                    const nextFrequency = event.target.value as EventForm['recurrenceFrequency'];
                    const nextDays = nextFrequency === 'weekly'
                      ? defaultDaysFromStart(form.startAt)
                      : [false, false, false, false, false, false, false];
                    const nextMonths = nextFrequency === 'yearly'
                      ? defaultMonthsFromStart(form.startAt)
                      : [false, false, false, false, false, false, false, false, false, false, false, false];
                    setForm({ ...form, recurrenceFrequency: nextFrequency, recurrenceDays: nextDays, recurrenceMonths: nextMonths });
                  }}
                  className="w-full appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                >
                  <option className="bg-[#111827] text-[#e5e7eb]" value="none">Aucune</option>
                  <option className="bg-[#111827] text-[#e5e7eb]" value="daily">Journalière</option>
                  <option className="bg-[#111827] text-[#e5e7eb]" value="weekly">Hebdomadaire</option>
                  <option className="bg-[#111827] text-[#e5e7eb]" value="monthly">Mensuelle</option>
                  <option className="bg-[#111827] text-[#e5e7eb]" value="yearly">Annuelle</option>
                </select>
              </div>

              {form.recurrenceFrequency !== 'none' && (
                <>
                  <div>
                    <label htmlFor="recurrence-interval" className="block text-[#e5e7eb] mb-2">Intervalle</label>
                    <input
                      id="recurrence-interval"
                      type="number"
                      min={1}
                      value={form.recurrenceInterval}
                      onChange={(event) => setForm({ ...form, recurrenceInterval: event.target.value })}
                      className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                    />
                  </div>

                  <div>
                    <label htmlFor="recurrence-until" className="block text-[#e5e7eb] mb-2">Répéter jusqu’au</label>
                    <input
                      id="recurrence-until"
                      type="datetime-local"
                      value={form.recurrenceUntil}
                      onChange={(event) => setForm({ ...form, recurrenceUntil: event.target.value })}
                      className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                    />
                  </div>

                  {form.recurrenceFrequency === 'weekly' && (
                    <div className="md:col-span-2">
                      <label className="block text-[#e5e7eb] mb-2">Répéter les jours</label>
                      <div className="flex flex-wrap gap-2">
                        {weekdayLabels.map((label, index) => (
                          <button
                            key={`${label}-${index}`}
                            type="button"
                            onClick={() => {
                              const nextDays = [...form.recurrenceDays];
                              nextDays[index] = !nextDays[index];
                              setForm({ ...form, recurrenceDays: nextDays });
                            }}
                            className={`w-9 h-9 rounded-full border ${form.recurrenceDays[index] ? 'bg-[#3b82f6] border-[#3b82f6] text-white' : 'bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.12)] text-[#9ca3af]'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.recurrenceFrequency === 'yearly' && (
                    <div className="md:col-span-2">
                      <label className="block text-[#e5e7eb] mb-2">Répéter sur les mois</label>
                      <div className="flex flex-wrap gap-2">
                        {monthLabels.map((label, index) => (
                          <button
                            key={`${label}-${index}`}
                            type="button"
                            onClick={() => {
                              const nextMonths = [...form.recurrenceMonths];
                              nextMonths[index] = !nextMonths[index];
                              setForm({ ...form, recurrenceMonths: nextMonths });
                            }}
                            className={`px-3 h-9 rounded-[10px] border text-sm ${form.recurrenceMonths[index] ? 'bg-[#3b82f6] border-[#3b82f6] text-white' : 'bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.12)] text-[#9ca3af]'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {editingEventId && form.recurrenceFrequency !== 'none' && editingOccurrenceDate && (
              <div className="mt-4 p-3 rounded-[12px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)]">
                <p className="text-[#e5e7eb] text-sm mb-2">Appliquer la modification :</p>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2 text-[#9ca3af]">
                    <input
                      type="radio"
                      checked={applyScope === 'single'}
                      onChange={() => setApplyScope('single')}
                    />
                    Cette occurrence
                  </label>
                  <label className="flex items-center gap-2 text-[#9ca3af]">
                    <input
                      type="radio"
                      checked={applyScope === 'series'}
                      onChange={() => setApplyScope('series')}
                    />
                    Toute la série
                  </label>
                </div>
              </div>
            )}

            {formError && <p className="text-sm text-[#ef4444] mt-4">{formError}</p>}

            <div className="flex gap-3 pt-6">
              <GlassButton variant="ghost" className="flex-1" onClick={closeEventModal}>
                Annuler
              </GlassButton>
              <GlassButton className="flex-1" onClick={saveEvent}>
                {editingEventId ? 'Mettre à jour' : 'Enregistrer'}
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
