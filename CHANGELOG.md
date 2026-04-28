# Changelog

Toutes les évolutions notables de ce projet sont documentées dans ce fichier.


## v1.2.0 - 2026-04-27

### Ajouté

- Système RBAC avancé : gestion multi-utilisateurs, groupes, privilèges lecture/écriture, matrice de permissions personnalisable.
- Monitoring temps réel des clients connectés au panel (Electron/Web/Flutter).
- Endpoint d’usage système : CPU %, RAM %, réseau Mb/s.
- Endpoint de téléchargement multi-plateformes (Windows/Linux/Android) prêt pour QR code.
- Synchronisation automatique des droits et groupes sur toutes les interfaces (web, Electron, Flutter).
- Ajout d’un onglet “Téléchargements” sur le web avec QR code et liens directs.
- Icône branding appliquée sur toutes les surfaces Electron (fenêtres, tray, notifications).
- Packaging Windows admin tout-en-un avec bundle serveur embarqué dans l’application Electron.
- App Electron player Windows dédiée avec mode plein écran, artefacts installables et portables.
- Persistance explicite de l’identité/token player côté Electron via stockage local dédié.
- Scripts de packaging Windows `package:admin:win` et `package:player:win`.
- Encoche paramètres (notch) bas-droite du player : configuration de l'URL, de l'instance, du mode plein écran et du démarrage automatique au login Windows.
- Persistance des paramètres player via `player-config.json` dans le dossier utilisateur Electron.
- Prise en charge du démarrage automatique au login Windows/macOS via `app.setLoginItemSettings`.
- Handlers IPC `player:settings-load`, `player:settings-save`, `player:settings-apply` exposés dans le player et dans le shell admin.
- Pipeline CI/CD GitHub Actions complet : build web/API, renderer Electron, Flutter manager Windows/APK/AAB, déclenché sur push et pull-request.
- Pipeline de release GitHub Actions : extraction automatique de la section la plus récente du changelog, création de release taguée, upload des artefacts renommés.
- Option `--latest` dans `scripts/extract-release-notes.cjs` pour extraire uniquement la dernière version du changelog.
- Raccourcis bureau créés automatiquement par les installateurs NSIS pour "Digital Kiosk Desktop" et "Digital Kiosk Player".
- Internationalisation FR/EN du panel admin avec bascule de langue persistée.
- Billet de documentation complet sur le tour du projet v1.2.0 dans le blog VitePress.

### Modifié

- Sécurisation et centralisation de la logique d’authentification et de permissions sur toutes les routes API.
- Refactorisation du backend pour supporter la matrice de permissions dynamique et les groupes.
- Amélioration du système de logs et de la traçabilité des actions admin.
- Mise à jour du système d’update web : affichage détaillé de l’état, gestion avancée des erreurs, meilleure UX lors des mises à jour.
- Uniformisation des fenêtres Electron (manager/settings/player/admin) pour utiliser la même logique de titlebar custom.
- Refonte de l’édition des playlists côté Flutter avec un mode guidé par blocs médias (assets locaux, URL, iframes, markdown) et réordonnancement visuel.
- Refonte complète du README et des guides principaux avec contenu FR/EN aligné sur le runtime actuel.
- Mise à jour des guides d’installation, déploiement, modes d’exécution, pairing player et dépannage.
- Normalisation du runtime Electron packagé pour utiliser des répertoires de données utilisateur en écriture.
- Script `prepare-electron-bundle.cjs` renforcé : copie du dossier `node_modules` complet dans le bundle pour garantir la résolution des dépendances du serveur en mode packagé.
- Stratégie de reset du bundle rendue robuste sur Windows (rotation + retries sur `ENOTEMPTY`).
- Injection de `NODE_PATH` dans l'environnement du processus serveur enfant en mode packagé.
- Documentation VitePress : suppression de l'entrée "Agent Kiosk C++" de la sidebar et du guide dédié.

### Corrigé

- Correction de la gestion des sessions admin et de la révocation des droits en temps réel.
- Correction de la propagation des droits sur les endpoints sensibles.
- Correction de la détection des clients connectés et du rafraîchissement temps réel.
- Correction de la collecte des métriques système (CPU/RAM/réseau) sur tous les OS supportés.
- Correction de la saisie Flutter qui injectait `-` dans plusieurs formulaires (écrans, layouts, salles, événements, playlists), causant des enregistrements invalides.
- Correction de l’enregistrement des événements Flutter pour une compatibilité de rendu player/web alignée avec les champs attendus.
- Correction de l’upload assets Flutter pour conserver le nom de fichier (et son extension), afin de restaurer la prévisualisation navigateur.
- Correction des boutons minimise/maximise/fermeture du panneau admin Electron via preload et titlebar custom câblée au renderer web.
- Correction du player Electron pour conserver son identité même hors `localStorage` persistant.
- Correction du lancement du serveur packagé pour qu'il démarre depuis le bundle embarqué au lieu d'un environnement Node externe.
- Correction de l'erreur `MODULE_NOT_FOUND` pour `express` et autres dépendances lors du démarrage du serveur en mode packagé.
- Correction du verrouillage de fichier Windows (`ENOTEMPTY`) lors de la reconstruction du bundle Electron.

### Supprimé

- Suppression du code legacy Next.js et des dépendances inutilisées.
- Nettoyage des scripts de build et de migration obsolètes.
- Suppression de l'agent natif C++ (`kiosk-agent-cpp`) et de tous ses scripts, guides et références — remplacé par l'app Electron player Windows.

---

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
