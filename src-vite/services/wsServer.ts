// Serveur WebSocket pour communication live avec les players Raspberry Pi
import { WebSocketServer } from 'ws';
import { registerScreen } from './screenService';

const wss = new WebSocketServer({ port: 8081 });

interface WSMessage {
  type: 'register' | 'heartbeat' | 'command';
  deviceId?: string;
  payload?: any;
}

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    const data: WSMessage = JSON.parse(msg.toString());
    if (data.type === 'register' && data.deviceId) {
      // Enregistrement automatique
      registerScreen(data.payload);
      ws.send(JSON.stringify({ type: 'registered', deviceId: data.deviceId }));
    }
    if (data.type === 'heartbeat' && data.deviceId) {
      // Mise à jour lastSeen
      registerScreen({ ...data.payload, deviceId: data.deviceId });
      ws.send(JSON.stringify({ type: 'heartbeat-ack', deviceId: data.deviceId }));
    }
    if (data.type === 'command' && data.deviceId) {
      // Commande live (reload, refresh, etc.)
      ws.send(JSON.stringify({ type: 'command-ack', deviceId: data.deviceId }));
    }
  });
});

console.log('WebSocket server running on ws://localhost:8081');
