import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Digital Signage Docs',
  description: 'Documentation fonctionnelle et API du projet Digital Signage',
  base: '/docs/',
  outDir: '../public/docs',
  ignoreDeadLinks: [
    '/docs/api/index.html'
  ],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/overview' },
      { text: 'API', link: '/reference/api' }
    ],
    sidebar: [
      {
        text: 'Démarrage',
        items: [
          { text: 'Accueil', link: '/' },
          { text: 'Vue d’ensemble', link: '/guide/overview' },
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Mode dev/prod (tout-en-un)', link: '/guide/run-modes' }
        ]
      },
      {
        text: 'Système',
        items: [
          { text: 'Manuel utilisateur (hub)', link: '/guide/user-manual' },
          { text: 'Dashboard', link: '/guide/manual/dashboard' },
          { text: 'Screens', link: '/guide/manual/screens' },
          { text: 'Rooms', link: '/guide/manual/rooms' },
          { text: 'Playlists', link: '/guide/manual/playlists' },
          { text: 'Assets', link: '/guide/manual/assets' },
          { text: 'Calendar', link: '/guide/manual/calendar' },
          { text: 'Layouts', link: '/guide/manual/layouts' },
          { text: 'Templates', link: '/guide/manual/templates' },
          { text: 'Storage', link: '/guide/manual/storage' },
          { text: 'Logs', link: '/guide/manual/logs' },
          { text: 'Fleet', link: '/guide/manual/fleet' },
          { text: 'Alerts', link: '/guide/manual/alerts' },
          { text: 'Ops', link: '/guide/manual/ops' },
          { text: 'Settings', link: '/guide/manual/settings' },
          { text: 'Types de configuration', link: '/guide/manual/configuration-types' },
          { text: 'Authentification', link: '/guide/authentication' },
          { text: 'Player & Pairing PIN', link: '/guide/player-pairing' },
          { text: 'Agent Kiosk C++', link: '/guide/kiosk-agent-cpp' },
          { text: 'Déploiement', link: '/guide/deployment' },
          { text: 'Exploitation', link: '/guide/operations' },
          { text: 'Dépannage', link: '/guide/troubleshooting' }
        ]
      },
      {
        text: 'Référence',
        items: [
          { text: 'API & Endpoints', link: '/reference/api' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/' }
    ]
  }
});
