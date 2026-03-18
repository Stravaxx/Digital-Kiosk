// Service WebSocket pour communication live avec les players (Raspberry Pi)

export type ScreenCommand = 'reload' | 'change-layout' | 'refresh' | 'reboot';

export interface ScreenLiveCommand {
	id: string;
	command: ScreenCommand;
	payload?: unknown;
	issuedAt: string;
}

const commandQueues = new Map<string, ScreenLiveCommand[]>();
const lastHeartbeatByDevice = new Map<string, number>();

export function sendCommandToScreen(deviceId: string, command: ScreenCommand, payload?: unknown): ScreenLiveCommand {
	const normalizedDeviceId = String(deviceId || '').trim();
	if (!normalizedDeviceId) {
		throw new Error('deviceId is required');
	}

	const nextCommand: ScreenLiveCommand = {
		id: `${normalizedDeviceId}-${Date.now()}`,
		command,
		payload,
		issuedAt: new Date().toISOString()
	};

	const queue = commandQueues.get(normalizedDeviceId) || [];
	queue.push(nextCommand);
	commandQueues.set(normalizedDeviceId, queue);
	return nextCommand;
}

export function popPendingCommands(deviceId: string): ScreenLiveCommand[] {
	const normalizedDeviceId = String(deviceId || '').trim();
	if (!normalizedDeviceId) return [];
	const queue = commandQueues.get(normalizedDeviceId) || [];
	commandQueues.set(normalizedDeviceId, []);
	return queue;
}

export function onScreenHeartbeat(deviceId: string): void {
	const normalizedDeviceId = String(deviceId || '').trim();
	if (!normalizedDeviceId) return;
	lastHeartbeatByDevice.set(normalizedDeviceId, Date.now());
}

export function isScreenLive(deviceId: string, maxSilenceMs = 60_000): boolean {
	const normalizedDeviceId = String(deviceId || '').trim();
	const lastHeartbeat = lastHeartbeatByDevice.get(normalizedDeviceId);
	if (!lastHeartbeat) return false;
	return Date.now() - lastHeartbeat <= Math.max(5_000, Number(maxSilenceMs) || 60_000);
}
