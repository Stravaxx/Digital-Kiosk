# Changelog

Toutes les évolutions notables de ce projet sont documentées dans ce fichier.

## v1.1.0 - 2026-03-18

### Ajouté

- Refonte de l’interface admin sur la stack Vite + React Router + composants Radix.
- Nouveau parcours calendrier avec recherche depuis la navbar, panneau de filtres latéral, tri par date/nom/salle et remise à zéro globale.
- Système de mise à jour en arrière-plan avec sauvegarde automatique de la base et du storage avant exécution.
- Suivi de progression de mise à jour côté backend et exposition d’un état détaillé pour l’interface d’administration.
- Intégration d’un statut visuel “En mise à jour” dans l’interface admin.
- Migration des données JSON vers SQLite/Prisma avec conservation d’une sauvegarde.

### Modifié

- Standardisation du runtime autour de Vite pour le frontend d’administration.
- Simplification de la CI/CD GitHub pour ne plus construire de panel Next.js séparé.
- Packaging de release recentré sur le build Vite et le serveur Node principal.
- Vérification des releases GitHub basée sur la version applicative et les tags sémantiques.

### Corrigé

- Correction des erreurs TypeScript, CSS et accessibilité bloquantes sur les pages admin.
- Correction du routage WebSocket système pour le développement local.
- Gestion non bloquante des réponses GitHub 404 lors de la vérification de release.
- Nettoyage des tests legacy liés à Next.js et exclusion explicite de ces tests dans Vitest.

## v1.0.0 - Version initiale

### Fonctionnalités initiales

- Première release stable de Digital Kiosk.
- Panel d’administration pour la gestion des écrans, layouts, playlists, assets et salles.
- API Node.js/Express pour la persistance, les logs et la synchronisation système.
- Player et télémétrie de base pour le suivi des écrans.
- Documentation initiale d’installation, d’exploitation et de déploiement.
