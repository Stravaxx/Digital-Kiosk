
/// <reference types="node" />

// Player CLI : pas besoin de bureau graphique
import WebSocket from 'ws';
import os from 'os';
import readline from 'readline';

const WS_URL = 'ws://localhost:8081';
const deviceId = os.hostname();

const ws = new WebSocket(WS_URL);

function renderStatus(status: string) {
  console.clear();
  console.log('=== Digital Signage Player ===');
  console.log('Device ID:', deviceId);
  console.log('Status:', status);
  console.log('En attente de commandes du serveur...');
  console.log('------------------------------------------');
  console.log('Tapez "exit" pour quitter.');
}

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'register',
    deviceId,
    payload: {
      deviceId,
      hostname: os.hostname(),
      resolution: '1920x1080',
      os: os.platform(),
        version: '1.1.0'
    }
  }));
  renderStatus('Enregistré');
  setInterval(() => {
    ws.send(JSON.stringify({
      type: 'heartbeat',
      deviceId,
      payload: {
        lastSeen: new Date().toISOString()
      }
    }));
    renderStatus('En ligne');
  }, 30000);
});

ws.on('message', (msg: WebSocket.RawData) => {
  const data = JSON.parse(msg.toString()) as { type?: string; command?: string };
  if (data.type === 'command') {
    // Affichage CLI des commandes reçues
    renderStatus('Commande reçue: ' + (data.command || '')); 
    if (data.command === 'reload') {
      console.log('> Reload demandé');
    }
    if (data.command === 'refresh') {
      console.log('> Refresh demandé');
    }
    if (data.command === 'reboot') {
      console.log('> Reboot demandé');
    }
    if (data.command === 'change-layout') {
      console.log('> Changement de layout demandé');
    }
  }
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (input: string) => {
  if (input.trim() === 'exit') {
    console.log('Arrêt du player.');
    process.exit(0);
  }
});
