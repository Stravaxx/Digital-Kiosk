// Service de cron pour synchronisation périodique (ex: iCal)

export function startICalSyncJob(syncFn: () => Promise<void>, intervalMs = 5 * 60 * 1000) {
  setInterval(() => {
    syncFn().catch(console.error);
  }, intervalMs);
}

// Exemple d'utilisation :
// startICalSyncJob(() => syncAllICalSources());
