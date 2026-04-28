import { Monitor, Smartphone, Tablet, User, UserCircle } from 'lucide-react';

export interface ConnectedClientItem {
  id: string;
  ip: string;
  os: string;
  browser: string;
  device: 'desktop' | 'mobile' | 'tablet';
  account: string | null;
  accountType: 'admin' | 'user' | 'player';
  connectedAt: string;
}

interface ConnectedClientsProps {
  language: 'fr' | 'en';
  clients: ConnectedClientItem[];
}

export function ConnectedClients({ language, clients }: ConnectedClientsProps) {
  const translations = {
    fr: {
      account: 'Compte',
      player: 'Joueur',
      admin: 'Admin',
      user: 'Utilisateur'
    },
    en: {
      account: 'Account',
      player: 'Player',
      admin: 'Admin',
      user: 'User'
    }
  };

  const t = translations[language];

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'mobile':
        return Smartphone;
      case 'tablet':
        return Tablet;
      default:
        return Monitor;
    }
  };

  const getAccountBadgeColor = (type: string) => {
    switch (type) {
      case 'admin':
        return 'bg-red-500/20 border-red-400/30 text-red-400';
      case 'user':
        return 'bg-blue-500/20 border-blue-400/30 text-blue-400';
      default:
        return 'bg-gray-500/20 border-gray-400/30 text-gray-400';
    }
  };

  const getAccountLabel = (type: string) => {
    switch (type) {
      case 'admin':
        return t.admin;
      case 'user':
        return t.user;
      default:
        return t.player;
    }
  };

  return (
    <div className="max-h-full space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-blue-500/50 scrollbar-track-transparent md:space-y-3 md:pr-2">
      {clients.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
          {language === 'fr' ? 'Aucun client connecté en ce moment.' : 'No connected clients right now.'}
        </div>
      ) : null}
      {clients.map((client) => {
        const DeviceIcon = getDeviceIcon(client.device);

        return (
          <div
            key={client.id}
            className="rounded-xl border border-white/10 bg-white/5 p-3 transition-all duration-300 hover:scale-[1.01] hover:bg-white/10 md:p-4"
          >
            <div className="mb-2 flex items-start gap-2 md:mb-3 md:gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg border border-blue-400/30 bg-blue-500/20 md:size-10">
                <DeviceIcon className="size-4 text-blue-400 md:size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${getAccountBadgeColor(client.accountType)}`}>
                    {getAccountLabel(client.accountType)}
                  </span>
                  <span className="text-xs text-gray-500">{client.connectedAt}</span>
                </div>
                {client.account ? (
                  <div className="flex items-center gap-2 mb-2">
                    <UserCircle className="size-4 text-gray-400" />
                    <p className="text-sm text-white font-medium truncate">{client.account}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-2">
                    <User className="size-4 text-gray-400" />
                    <p className="text-sm text-gray-400 italic">{t.player}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2 text-gray-400">
                <span className="font-mono bg-black/20 px-2 py-0.5 rounded">{client.ip}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <span>{client.os}</span>
                <span>•</span>
                <span>{client.browser}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
