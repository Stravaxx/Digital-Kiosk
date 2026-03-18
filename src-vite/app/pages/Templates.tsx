import React, { useEffect, useState } from 'react';
import { DoorOpen, Layout, Calendar, Table, Wand2 } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { type LayoutModel } from '../../shared/layoutRegistry';
import { listLayoutsFromApi, upsertLayoutFromApi } from '../../services/layoutApiService';

interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  build: () => LayoutModel;
}

const createPreset = (preset: 'door' | 'status-board' | 'meeting') => {
  const now = Date.now();
  if (preset === 'door') {
    return {
      id: `layout-${now}`,
      name: 'Room Door Display',
      mode: 'room-door-display' as const,
      displayTemplate: 'classic' as const,
      resolution: '1080x1920',
      headerText: 'Salle de réunion',
      footerText: 'Réservation en cours',
      zones: [
        { id: `zone-${now}-1`, name: 'Current Meeting', type: 'calendar' as const, content: 'Titre / Horaire / Animateur' },
        { id: `zone-${now}-2`, name: 'Next Meeting', type: 'calendar' as const, content: 'Prochain événement' },
        { id: `zone-${now}-3`, name: 'Status', type: 'widget' as const, content: 'Libre / Occupé / Prochainement' }
      ]
    } satisfies LayoutModel;
  }

  if (preset === 'status-board') {
    return {
      id: `layout-${now}`,
      name: 'Room Status Board',
      mode: 'room-status-board' as const,
      displayTemplate: 'classic' as const,
      resolution: '1920x1080',
      headerText: 'Statut global des salles',
      footerText: 'Mise à jour automatique',
      zones: [
        { id: `zone-${now}-1`, name: 'Tableau principal', type: 'calendar' as const, content: 'Nom | Salle | Emplacement | Date/Heure | Status' }
      ]
    } satisfies LayoutModel;
  }

  return {
    id: `layout-${now}`,
    name: 'Meeting Room Standard',
    mode: 'standard' as const,
    displayTemplate: 'classic' as const,
    resolution: '1920x1080',
    headerText: 'Planning de la salle',
    footerText: 'Merci de respecter les horaires',
    zones: [
      { id: `zone-${now}-1`, name: 'En cours', type: 'calendar' as const, content: 'Réunion en cours' },
      { id: `zone-${now}-2`, name: 'Prochain', type: 'calendar' as const, content: 'Prochaine réunion' },
      { id: `zone-${now}-3`, name: 'Informations', type: 'widget' as const, content: 'Rappels salle' }
    ]
  } satisfies LayoutModel;
};

const presets: TemplatePreset[] = [
  {
    id: 'door',
    name: 'Room Door Display',
    description: 'Affichage compact devant la salle',
    icon: <DoorOpen size={22} />,
    build: () => createPreset('door')
  },
  {
    id: 'status-board',
    name: 'Room Status Board (Tableau)',
    description: 'Vue multi-salles triée par horaires et statut',
    icon: <Table size={22} />,
    build: () => createPreset('status-board')
  },
  {
    id: 'status-board-low-vision',
    name: 'Aide Personnes Malvoyantes',
    description: 'Room Status Board avec affichage agrandi et lisible à distance',
    icon: <Table size={22} />,
    build: () => ({
      ...createPreset('status-board'),
      name: 'Room Status Board - Aide Personnes Malvoyantes',
      displayTemplate: 'low-vision' as const
    })
  },
  {
    id: 'meeting',
    name: 'Meeting Room Standard',
    description: 'Layout standard calendrier pour une salle',
    icon: <Calendar size={22} />,
    build: () => createPreset('meeting')
  }
];

export function Templates() {
  const [layouts, setLayouts] = useState<LayoutModel[]>([]);

  useEffect(() => {
    void listLayoutsFromApi().then(setLayouts).catch(() => setLayouts([]));
  }, []);

  const useTemplate = async (preset: TemplatePreset) => {
    await upsertLayoutFromApi(preset.build());
    const next = await listLayoutsFromApi();
    setLayouts(next);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#e5e7eb] mb-2">Templates</h1>
          <p className="text-[#9ca3af]">Créez rapidement des layouts personnalisés (incluant Room Door Display)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {presets.map((preset) => (
          <GlassCard key={preset.id} className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-[10px] bg-[#3b82f6]/20 border border-[#3b82f6]/40 flex items-center justify-center text-[#3b82f6]">
                {preset.icon}
              </div>
              <div>
                <h3 className="text-[#e5e7eb] font-medium">{preset.name}</h3>
                <p className="text-[#9ca3af] text-sm">{preset.description}</p>
              </div>
            </div>
            <GlassButton className="w-full" onClick={() => useTemplate(preset)}>
              <Wand2 size={16} className="mr-2" />
              Utiliser ce template
            </GlassButton>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Layout size={18} className="text-[#22c55e]" />
          <h2 className="text-[#e5e7eb]">Layouts générés</h2>
        </div>
        {layouts.length === 0 ? (
          <p className="text-[#9ca3af]">Aucun layout généré depuis les templates.</p>
        ) : (
          <ul className="space-y-2">
            {layouts.map((layout) => (
              <li key={layout.id} className="text-[#9ca3af] text-sm">
                {layout.name} ({layout.mode ?? 'standard'})
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
