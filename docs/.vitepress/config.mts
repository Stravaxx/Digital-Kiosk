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
