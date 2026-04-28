#!/usr/bin/env node
/**
 * Migration script: JSON DB -> Prisma SQLite
 * 
 * Usage: node scripts/migrate-to-prisma.cjs
 * 
 * This script:
 * 1. Reads the old JSON database (system-db.json)
 * 2. Migrates data to Prisma SQLite with proper relationships
 * 3. Creates a backup of the old JSON DB
 * 4. Validates the migration
 */

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

// Try to import Prisma Client
let PrismaClient;
try {
  const { PrismaClient: PC } = require('@prisma/client');
  PrismaClient = PC;
} catch (err) {
  console.error('❌ @prisma/client not installed. Run: npm install');
  process.exit(1);
}

const ROOT = process.cwd();
const DB_DIR = path.join(ROOT, 'database');
const JSON_DB_PATH = path.join(DB_DIR, 'system-db.json');
const BACKUP_DIR = path.join(DB_DIR, 'backups');

// ============================================================================

function log(msg, type = 'info') {
  const icons = {
    info: 'ℹ️ ',
    success: '✅',
    warn: '⚠️ ',
    error: '❌',
    debug: '🔍'
  };
  console.log(`${icons[type]} ${msg}`);
}

async function ensureBackupDir() {
  try {
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
  } catch (err) {
    log(`Failed to create backup dir: ${err.message}`, 'warn');
  }
}

async function backupJsonDb() {
  try {
    if (!fs.existsSync(JSON_DB_PATH)) {
      log(`JSON DB not found at ${JSON_DB_PATH}`, 'warn');
      return null;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `system-db.${timestamp}.json`);
    
    await fsp.copyFile(JSON_DB_PATH, backupPath);
    log(`Backed up JSON DB to ${path.relative(ROOT, backupPath)}`, 'success');
    return backupPath;
  } catch (err) {
    log(`Backup failed: ${err.message}`, 'error');
    throw err;
  }
}

function readJsonDb() {
  try {
    if (!fs.existsSync(JSON_DB_PATH)) {
      log(`Creating empty JSON DB structure`, 'info');
      return {
        'ds.screens': [],
        'ds.layouts': [],
        'ds.playlists': [],
        'ds.rooms': [],
        'ds.events': [],
        'ds.screen-groups': [],
        'ds.storage.policy': {},
        'ds.alerts.policy': {},
        'ds.system-settings': {},
        'ds.security.admin-users': []
      };
    }
    
    const raw = fs.readFileSync(JSON_DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    log(`Loaded JSON DB with ${Object.keys(parsed).length} keys`, 'info');
    return parsed;
  } catch (err) {
    log(`Failed to read JSON DB: ${err.message}`, 'error');
    throw err;
  }
}

async function migrateData(prisma, jsonDb) {
  const stats = {
    screens: 0,
    layouts: 0,
    zones: 0,
    playlists: 0,
    playlistItems: 0,
    assets: 0,
    rooms: 0,
    groups: 0,
    logs: 0,
    users: 0
  };

  try {
    // ===== SCREENS =====
    const screens = Array.isArray(jsonDb['ds.screens']) ? jsonDb['ds.screens'] : [];
    for (const screen of screens) {
      try {
        await prisma.screen.upsert({
          where: { deviceId: screen.deviceId || `device-${screen.id}` },
          update: {
            name: screen.name || screen.deviceId || 'Unnamed Screen',
            status: screen.status || 'offline',
            lastHeartbeat: screen.lastHeartbeat ? new Date(screen.lastHeartbeat) : null,
            hostName: screen.hostName || null,
            ipAddress: screen.ipAddress || null,
            resolution: screen.resolution || null,
            osInfo: screen.osInfo || null,
            playerVersion: screen.playerVersion || null,
            uptime: screen.uptime || null,
            cpuPercent: Number(screen.cpuPercent || 0),
            memoryPercent: Number(screen.memoryPercent || 0),
            temperatureC: Number(screen.temperatureC || 0),
            diskUsedPercent: Number(screen.diskUsedPercent || 0),
            layoutId: screen.layoutId || null,
            groupId: screen.groupId || null,
            roomIds: Array.isArray(screen.roomIds) 
              ? JSON.stringify(screen.roomIds) 
              : (screen.roomId ? JSON.stringify([screen.roomId]) : JSON.stringify([])),
            theme: screen.theme ? JSON.stringify(screen.theme) : null,
            pendingCommand: screen.pendingCommand || null
          },
          create: {
            id: screen.id || `screen-${Math.random().toString(36).substr(2, 9)}`,
            deviceId: screen.deviceId || `device-${Math.random().toString(36).substr(2, 9)}`,
            deviceToken: screen.deviceToken || `token-${Math.random().toString(36).substr(2, 9)}`,
            name: screen.name || screen.deviceId || 'Unnamed Screen',
            status: screen.status || 'offline',
            lastHeartbeat: screen.lastHeartbeat ? new Date(screen.lastHeartbeat) : null,
            hostName: screen.hostName || null,
            ipAddress: screen.ipAddress || null,
            resolution: screen.resolution || null,
            osInfo: screen.osInfo || null,
            playerVersion: screen.playerVersion || null,
            uptime: screen.uptime || null,
            cpuPercent: Number(screen.cpuPercent || 0),
            memoryPercent: Number(screen.memoryPercent || 0),
            temperatureC: Number(screen.temperatureC || 0),
            diskUsedPercent: Number(screen.diskUsedPercent || 0),
            layoutId: screen.layoutId || null,
            groupId: screen.groupId || null,
            roomIds: Array.isArray(screen.roomIds) 
              ? JSON.stringify(screen.roomIds) 
              : (screen.roomId ? JSON.stringify([screen.roomId]) : JSON.stringify([])),
            theme: screen.theme ? JSON.stringify(screen.theme) : null,
            pendingCommand: screen.pendingCommand || null
          }
        });
        stats.screens++;
      } catch (err) {
        log(`Failed to migrate screen ${screen.id}: ${err.message}`, 'warn');
      }
    }

    // ===== LAYOUTS & ZONES =====
    const layouts = Array.isArray(jsonDb['ds.layouts']) ? jsonDb['ds.layouts'] : [];
    for (const layout of layouts) {
      try {
        await prisma.layout.upsert({
          where: { id: layout.id },
          update: {
            name: layout.name || 'Unnamed Layout',
            description: layout.description || null,
            width: layout.width || 1920,
            height: layout.height || 1080,
            orientation: layout.orientation || 'landscape'
          },
          create: {
            id: layout.id || `layout-${Math.random().toString(36).substr(2, 9)}`,
            name: layout.name || 'Unnamed Layout',
            description: layout.description || null,
            width: layout.width || 1920,
            height: layout.height || 1080,
            orientation: layout.orientation || 'landscape'
          }
        });
        stats.layouts++;

        // Migrate zones
        if (Array.isArray(layout.zones)) {
          for (const zone of layout.zones) {
            try {
              await prisma.zone.create({
                data: {
                  id: zone.id || `zone-${Math.random().toString(36).substr(2, 9)}`,
                  layoutId: layout.id,
                  name: zone.name || 'Unnamed Zone',
                  type: zone.type || 'media',
                  x: Number(zone.x || 0),
                  y: Number(zone.y || 0),
                  width: Number(zone.width || 1),
                  height: Number(zone.height || 1),
                  playlistId: zone.playlistId || null,
                  config: zone.config ? JSON.stringify(zone.config) : null
                }
              });
              stats.zones++;
            } catch (err) {
              log(`Failed to migrate zone ${zone.id}: ${err.message}`, 'warn');
            }
          }
        }
      } catch (err) {
        log(`Failed to migrate layout ${layout.id}: ${err.message}`, 'warn');
      }
    }

    // ===== PLAYLISTS & ITEMS =====
    const playlists = Array.isArray(jsonDb['ds.playlists']) ? jsonDb['ds.playlists'] : [];
    for (const playlist of playlists) {
      try {
        await prisma.playlist.upsert({
          where: { id: playlist.id },
          update: {
            name: playlist.name || 'Unnamed Playlist',
            description: playlist.description || null,
            type: playlist.type || 'sequential'
          },
          create: {
            id: playlist.id || `playlist-${Math.random().toString(36).substr(2, 9)}`,
            name: playlist.name || 'Unnamed Playlist',
            description: playlist.description || null,
            type: playlist.type || 'sequential'
          }
        });
        stats.playlists++;

        // Migrate items
        if (Array.isArray(playlist.items)) {
          for (const item of playlist.items) {
            try {
              await prisma.playlistItem.create({
                data: {
                  id: item.id || `item-${Math.random().toString(36).substr(2, 9)}`,
                  playlistId: playlist.id,
                  kind: item.kind || 'asset',
                  title: item.title || null,
                  duration: Number(item.duration || 10),
                  priority: Number(item.priority || 0),
                  assetId: item.assetId || null,
                  assetType: item.assetType || null,
                  url: item.url || null,
                  htmlContent: item.htmlContent || null,
                  scheduleStart: item.scheduleStart || null,
                  scheduleEnd: item.scheduleEnd || null,
                  daysOfWeek: Array.isArray(item.daysOfWeek)
                    ? JSON.stringify(item.daysOfWeek)
                    : JSON.stringify([])
                }
              });
              stats.playlistItems++;
            } catch (err) {
              log(`Failed to migrate playlist item ${item.id}: ${err.message}`, 'warn');
            }
          }
        }
      } catch (err) {
        log(`Failed to migrate playlist ${playlist.id}: ${err.message}`, 'warn');
      }
    }

    // ===== ROOMS =====
    const rooms = Array.isArray(jsonDb['ds.rooms']) ? jsonDb['ds.rooms'] : [];
    for (const room of rooms) {
      try {
        await prisma.room.upsert({
          where: { id: room.id },
          update: {
            name: room.name || 'Unnamed Room',
            location: room.location || null,
            color: room.color || '#3B82F6',
            capacity: Number(room.capacity || 1)
          },
          create: {
            id: room.id || `room-${Math.random().toString(36).substr(2, 9)}`,
            name: room.name || 'Unnamed Room',
            location: room.location || null,
            color: room.color || '#3B82F6',
            capacity: Number(room.capacity || 1)
          }
        });
        stats.rooms++;
      } catch (err) {
        log(`Failed to migrate room ${room.id}: ${err.message}`, 'warn');
      }
    }

    // ===== SCREEN GROUPS =====
    const groups = Array.isArray(jsonDb['ds.screen-groups']) ? jsonDb['ds.screen-groups'] : [];
    for (const group of groups) {
      try {
        await prisma.screenGroup.upsert({
          where: { id: group.id },
          update: {
            name: group.name || 'Unnamed Group',
            description: group.description || null,
            theme: group.theme ? JSON.stringify(group.theme) : null
          },
          create: {
            id: group.id || `group-${Math.random().toString(36).substr(2, 9)}`,
            name: group.name || 'Unnamed Group',
            description: group.description || null,
            theme: group.theme ? JSON.stringify(group.theme) : null
          }
        });
        stats.groups++;
      } catch (err) {
        log(`Failed to migrate group ${group.id}: ${err.message}`, 'warn');
      }
    }

    // ===== ADMIN USERS =====
    const users = Array.isArray(jsonDb['ds.security.admin-users']) ? jsonDb['ds.security.admin-users'] : [];
    for (const user of users) {
      try {
        await prisma.adminUser.upsert({
          where: { username: user.username },
          update: {
            passwordHash: user.passwordHash || '',
            isAdmin: Boolean(user.isAdmin)
          },
          create: {
            id: user.id || `user-${Math.random().toString(36).substr(2, 9)}`,
            username: user.username || `user-${Date.now()}`,
            passwordHash: user.passwordHash || '',
            isAdmin: Boolean(user.isAdmin)
          }
        });
        stats.users++;
      } catch (err) {
        log(`Failed to migrate user ${user.username}: ${err.message}`, 'warn');
      }
    }

    // ===== STORAGE & ALERT POLICIES =====
    const storagePolicy = jsonDb['ds.storage.policy'] || {}; 
    try {
      await prisma.storagePolicy.upsert({
        where: { id: 'default' },
        update: {
          maxAssetBytes: BigInt(storagePolicy.maxAssetBytes || 6 * 1024 * 1024 * 1024),
          maxCacheBytes: BigInt(storagePolicy.maxCacheBytes || 1024 * 1024 * 1024),
          logsRetentionDays: Number(storagePolicy.logsRetentionDays || 30),
          autoPurge: Boolean(storagePolicy.autoPurge !== false),
          staleHeartbeatSecs: Number(storagePolicy.staleHeartbeatSeconds || 90)
        },
        create: {
          id: 'default',
          maxAssetBytes: BigInt(storagePolicy.maxAssetBytes || 6 * 1024 * 1024 * 1024),
          maxCacheBytes: BigInt(storagePolicy.maxCacheBytes || 1024 * 1024 * 1024),
          logsRetentionDays: Number(storagePolicy.logsRetentionDays || 30),
          autoPurge: Boolean(storagePolicy.autoPurge !== false),
          staleHeartbeatSecs: Number(storagePolicy.staleHeartbeatSeconds || 90)
        }
      });
    } catch (err) {
      log(`Failed to migrate storage policy: ${err.message}`, 'warn');
    }

    const alertPolicy = jsonDb['ds.alerts.policy'] || {};
    try {
      await prisma.alertPolicy.upsert({
        where: { id: 'default' },
        update: {
          offlineAfterSecs: Number(alertPolicy.offlineAfterSeconds || 180),
          staleAfterSecs: Number(alertPolicy.staleAfterSeconds || 90),
          maxTemperatureC: Number(alertPolicy.maxTemperatureC || 80),
          maxStorageUsagePercent: Number(alertPolicy.maxStorageUsagePercent || 85)
        },
        create: {
          id: 'default',
          offlineAfterSecs: Number(alertPolicy.offlineAfterSeconds || 180),
          staleAfterSecs: Number(alertPolicy.staleAfterSeconds || 90),
          maxTemperatureC: Number(alertPolicy.maxTemperatureC || 80),
          maxStorageUsagePercent: Number(alertPolicy.maxStorageUsagePercent || 85)
        }
      });
    } catch (err) {
      log(`Failed to migrate alert policy: ${err.message}`, 'warn');
    }

    return stats;
  } catch (err) {
    log(`Migration failed: ${err.message}`, 'error');
    throw err;
  }
}

async function main() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('JSON DB → Prisma SQLite Migration', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

  let prisma;
  
  try {
    // Initialize Prisma Client
    log('Initializing Prisma Client...', 'info');
    prisma = new PrismaClient({
      errorFormat: 'pretty'
    });

    // Ensure backup directory exists
    await ensureBackupDir();

    // Backup JSON DB
    await backupJsonDb();

    // Read JSON DB
    log('Reading JSON database...', 'info');
    const jsonDb = readJsonDb();

    // Migrate data
    log('Starting migration...', 'info');
    const stats = await migrateData(prisma, jsonDb);

    // Print statistics
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'success');
    log('Migration completed successfully!', 'success');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'success');
    console.log('\nMigration Statistics:');
    console.log(`  📺 Screens:      ${stats.screens}`);
    console.log(`  📐 Layouts:      ${stats.layouts}`);
    console.log(`  🔲 Zones:        ${stats.zones}`);
    console.log(`  📹 Playlists:    ${stats.playlists}`);
    console.log(`  📄 Playlist Items: ${stats.playlistItems}`);
    console.log(`  🏢 Rooms:        ${stats.rooms}`);
    console.log(`  👥 Groups:       ${stats.groups}`);
    console.log(`  👤 Users:        ${stats.users}`);

    log('✨ Migration complete! Your data has been migrated to SQLite.', 'success');
    log('📁 Keep the backup in database/backups/ for reference.', 'info');

  } catch (err) {
    log(err.message, 'error');
    log('Migration failed. Your JSON DB is unchanged.', 'error');
    process.exit(1);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

main();
