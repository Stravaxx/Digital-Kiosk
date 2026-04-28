import React, { useEffect, useState } from 'react';
import { DoorOpen, Plus, Trash2, MapPin, Users, Edit3 } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { loadRooms, saveRooms, type RoomModel } from '../../shared/localCalendar';
import { useTranslation } from '../i18n';

export function Rooms() {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<RoomModel[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: '',
    number: '',
    location: '',
    capacity: ''
  });
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoom, setEditRoom] = useState({
    name: '',
    number: '',
    location: '',
    capacity: ''
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setRooms(loadRooms());
  }, []);

  const handleAddRoom = () => {
    setFormError('');
    if (!newRoom.name.trim() || !newRoom.number.trim() || !newRoom.location.trim() || !newRoom.capacity.trim()) {
      setFormError(t('rooms.requiredFields'));
      return;
    }

    const capacity = Number.parseInt(newRoom.capacity, 10);
    if (Number.isNaN(capacity) || capacity <= 0) {
      setFormError(t('rooms.invalidCapacity'));
      return;
    }

    if (rooms.some((room) => room.number === newRoom.number.trim())) {
      setFormError(t('rooms.duplicateRoomNumber'));
      return;
    }

    const room: RoomModel = {
      id: `room-${Date.now()}`,
      name: newRoom.name.trim(),
      number: newRoom.number.trim(),
      location: newRoom.location.trim(),
      capacity,
      status: 'free'
    };

    const nextRooms = [...rooms, room];
    setRooms(nextRooms);
    saveRooms(nextRooms);
    setShowAddModal(false);
    setNewRoom({ name: '', number: '', location: '', capacity: '' });
  };

  const handleDeleteRoom = (roomId: string) => {
    const nextRooms = rooms.filter((room) => room.id !== roomId);
    setRooms(nextRooms);
    saveRooms(nextRooms);
  };

  const openEditRoom = (room: RoomModel) => {
    setFormError('');
    setEditingRoomId(room.id);
    setEditRoom({
      name: room.name,
      number: room.number,
      location: room.location,
      capacity: String(room.capacity)
    });
    setShowEditModal(true);
  };

  const handleSaveEditRoom = () => {
    if (!editingRoomId) return;
    setFormError('');

    if (!editRoom.name.trim() || !editRoom.number.trim() || !editRoom.location.trim() || !editRoom.capacity.trim()) {
      setFormError(t('rooms.requiredFields'));
      return;
    }

    const capacity = Number.parseInt(editRoom.capacity, 10);
    if (Number.isNaN(capacity) || capacity <= 0) {
      setFormError(t('rooms.invalidCapacity'));
      return;
    }

    if (rooms.some((room) => room.id !== editingRoomId && room.number === editRoom.number.trim())) {
      setFormError(t('rooms.duplicateRoomNumber'));
      return;
    }

    const nextRooms = rooms.map((room) =>
      room.id === editingRoomId
        ? {
            ...room,
            name: editRoom.name.trim(),
            number: editRoom.number.trim(),
            location: editRoom.location.trim(),
            capacity
          }
        : room
    );

    setRooms(nextRooms);
    saveRooms(nextRooms);
    setShowEditModal(false);
    setEditingRoomId(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#e5e7eb] mb-2">{t('rooms.title')}</h1>
          <p className="text-[#9ca3af]">{t('rooms.subtitle')}</p>
        </div>
        <GlassButton onClick={() => setShowAddModal(true)}>
          <Plus size={20} className="inline mr-2" />
          {t('rooms.addRoom')}
        </GlassButton>
      </div>

      {rooms.length === 0 ? (
        <GlassCard className="p-6">
          <div className="text-center py-20">
            <DoorOpen size={64} className="mx-auto text-[#9ca3af] opacity-50 mb-4" />
            <h3 className="text-lg text-[#e5e7eb] mb-2">{t('rooms.empty')}</h3>
            <p className="text-[#9ca3af] mb-6">{t('rooms.emptyHint')}</p>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <GlassCard key={room.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-[#e5e7eb] font-medium">{room.name}</h3>
                  <p className="text-[#9ca3af] text-sm">{t('rooms.roomNumberPrefix')}{room.number}</p>
                </div>
                <button
                  type="button"
                  aria-label={t('rooms.editRoom')}
                  title={t('rooms.editRoom')}
                  onClick={() => openEditRoom(room)}
                  className="p-2 hover:bg-[rgba(59,130,246,0.15)] rounded-[8px] transition-colors"
                >
                  <Edit3 size={16} className="text-[#3b82f6]" />
                </button>
                <button
                  type="button"
                  aria-label={t('rooms.deleteRoom')}
                  title={t('rooms.deleteRoom')}
                  onClick={() => handleDeleteRoom(room.id)}
                  className="p-2 hover:bg-[rgba(239,68,68,0.1)] rounded-[8px] transition-colors"
                >
                  <Trash2 size={16} className="text-[#ef4444]" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#9ca3af] text-sm">
                  <MapPin size={14} />
                  <span>{room.location}</span>
                </div>
                <div className="flex items-center gap-2 text-[#9ca3af] text-sm">
                  <Users size={14} />
                  <span>{t('rooms.maxCapacity')}: {room.capacity}</span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="w-full max-w-lg p-6">
            <h2 className="text-xl text-[#e5e7eb] mb-6">{t('rooms.addRoom')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="room-name">{t('rooms.name')}</label>
                <input
                  id="room-name"
                  type="text"
                  value={newRoom.name}
                  onChange={(event) => setNewRoom({ ...newRoom, name: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>
              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="room-number">{t('rooms.roomNumber')}</label>
                <input
                  id="room-number"
                  type="text"
                  value={newRoom.number}
                  onChange={(event) => setNewRoom({ ...newRoom, number: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>
              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="room-location">{t('rooms.location')}</label>
                <input
                  id="room-location"
                  type="text"
                  value={newRoom.location}
                  onChange={(event) => setNewRoom({ ...newRoom, location: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>
              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="room-capacity">{t('rooms.maxCapacity')}</label>
                <input
                  id="room-capacity"
                  type="number"
                  min={1}
                  value={newRoom.capacity}
                  onChange={(event) => setNewRoom({ ...newRoom, capacity: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>

              {formError && <p className="text-sm text-[#ef4444]">{formError}</p>}

              <div className="flex gap-3 pt-2">
                <GlassButton variant="ghost" className="flex-1" onClick={() => setShowAddModal(false)}>
                  {t('common.close')}
                </GlassButton>
                <GlassButton className="flex-1" onClick={handleAddRoom}>
                  {t('rooms.add')}
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="w-full max-w-lg p-6">
            <h2 className="text-xl text-[#e5e7eb] mb-6">{t('rooms.editRoom')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="edit-room-name">{t('rooms.name')}</label>
                <input
                  id="edit-room-name"
                  type="text"
                  value={editRoom.name}
                  onChange={(event) => setEditRoom({ ...editRoom, name: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>
              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="edit-room-number">{t('rooms.roomNumber')}</label>
                <input
                  id="edit-room-number"
                  type="text"
                  value={editRoom.number}
                  onChange={(event) => setEditRoom({ ...editRoom, number: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>
              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="edit-room-location">{t('rooms.location')}</label>
                <input
                  id="edit-room-location"
                  type="text"
                  value={editRoom.location}
                  onChange={(event) => setEditRoom({ ...editRoom, location: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>
              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="edit-room-capacity">{t('rooms.maxCapacity')}</label>
                <input
                  id="edit-room-capacity"
                  type="number"
                  min={1}
                  value={editRoom.capacity}
                  onChange={(event) => setEditRoom({ ...editRoom, capacity: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb]"
                />
              </div>

              {formError && <p className="text-sm text-[#ef4444]">{formError}</p>}

              <div className="flex gap-3 pt-2">
                <GlassButton variant="ghost" className="flex-1" onClick={() => setShowEditModal(false)}>
                  {t('common.close')}
                </GlassButton>
                <GlassButton className="flex-1" onClick={handleSaveEditRoom}>
                  {t('common.saveChanges')}
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
