import { v4 as uuidv4 } from 'uuid';
import { getAllScreensPersistent, upsertScreenPersistent } from './persistenceService';

export interface ScreenRegistration {
  deviceId: string;
  hostname: string;
  resolution: string;
  os: string;
  version: string;
}

export interface ScreenRecord extends ScreenRegistration {
  deviceToken: string;
  playlistId: string;
  layoutId: string;
  lastSeen: string;
}

export async function registerScreen(data: ScreenRegistration): Promise<ScreenRecord> {
  const existingRows = await getAllScreensPersistent();
  const existing = existingRows.find((screen) => screen.deviceId === data.deviceId);

  const record: ScreenRecord = {
    ...data,
    deviceToken: existing?.deviceToken ?? uuidv4(),
    playlistId: existing?.playlistId ?? 'default',
    layoutId: existing?.layoutId ?? 'default',
    lastSeen: new Date().toISOString()
  };

  await upsertScreenPersistent(record);
  return record;
}
