import React, { useEffect, useState } from 'react';

interface ScreenInfo {
  deviceId: string;
  hostname: string;
  resolution: string;
  os: string;
  version: string;
  playlistId: string;
  layoutId: string;
  status: 'online' | 'offline';
}

export function ScreenMenu() {
  const [screens, setScreens] = useState<ScreenInfo[]>([]);

  useEffect(() => {
    // Charger dynamiquement depuis DB JSON ou API
    fetch('/api/screens')
      .then(res => res.json())
      .then(data => setScreens(data));
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Écrans enregistrés</h2>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>Device ID</th>
            <th>Hostname</th>
            <th>Résolution</th>
            <th>OS</th>
            <th>Playlist</th>
            <th>Layout</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {screens.map(screen => (
            <tr key={screen.deviceId}>
              <td>{screen.deviceId}</td>
              <td>{screen.hostname}</td>
              <td>{screen.resolution}</td>
              <td>{screen.os}</td>
              <td>{screen.playlistId}</td>
              <td>{screen.layoutId}</td>
              <td>{screen.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
