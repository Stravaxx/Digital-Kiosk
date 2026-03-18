import React, { useEffect, useState } from 'react';
import { getSystemApiBase } from '../../services/systemApiBase';
import { getSystemWsUrl } from '../../services/systemApiBase';

interface UpdateState {
  isRunning: boolean;
  currentStep: string;
  progress: number;
  timestamp: string | null;
  error: string | null;
  steps?: Record<string, any>;
}

interface UpdateStatusBadgeProps {
  /** Whether the user/device is online (will preserve this state during update) */
  isOnline?: boolean;
}

export function UpdateStatusBadge({ isOnline = true }: UpdateStatusBadgeProps) {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    const connectWebSocket = () => {
      try {
        const wsUrl = getSystemWsUrl('/ws/system-sync');
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'update-status') {
              setUpdateState(message.payload);
            }
          } catch {
            // ignore parsing errors
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          // Attempt reconnect in 3 seconds
          reconnectTimeout = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
      }
    };

    const pollUpdateStatus = () => {
      const statusUrl = `${getSystemApiBase()}/api/system/update/state`;
      fetch(statusUrl, { method: 'GET' })
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) {
            const { ok, ...state } = data;
            setUpdateState(state);
          }
        })
        .catch(() => {
          // ignore polling errors
        });
    };

    // Try WebSocket first
    connectWebSocket();

    // Fallback: poll every 2 seconds if WebSocket isn't connected
    pollingInterval = setInterval(() => {
      if (!wsConnected) {
        pollUpdateStatus();
      }
    }, 2000);

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  // If no update is running, don't show badge
  if (!updateState?.isRunning) {
    return null;
  }

  const step = updateState.steps?.[updateState.currentStep];
  const stepLabel = step?.label || 'Mise à jour...';
  const progress = Math.round(updateState.progress || 0);
  const progressBucket = Math.max(0, Math.min(20, Math.round(progress / 5)));
  const progressWidthClass = [
    'w-0',
    'w-[5%]',
    'w-[10%]',
    'w-[15%]',
    'w-[20%]',
    'w-[25%]',
    'w-[30%]',
    'w-[35%]',
    'w-[40%]',
    'w-[45%]',
    'w-[50%]',
    'w-[55%]',
    'w-[60%]',
    'w-[65%]',
    'w-[70%]',
    'w-[75%]',
    'w-[80%]',
    'w-[85%]',
    'w-[90%]',
    'w-[95%]',
    'w-full'
  ][progressBucket];

  return (
    <div className="flex items-center gap-2">
      {/* Inline progress bar */}
      <div className="hidden sm:flex items-center gap-1.5">
        <div className="w-16 h-1.5 rounded-full bg-yellow-900/30 overflow-hidden border border-yellow-600/30">
          <div className={`h-full ${progressWidthClass} bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-300`} />
        </div>
        <span className="text-xs text-yellow-300 font-medium whitespace-nowrap">
          {progress}%
        </span>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 shadow-lg">
        {/* Animated pulse indicator */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-yellow-400"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
        </span>

        {/* Label */}
        <span className="text-xs font-semibold text-yellow-100 select-none">
          En Mise à Jour
        </span>

        {/* Tooltip on hover (mobile shows step on hold) */}
        <div className="opacity-0 hover:opacity-100 absolute left-0 bottom-full mb-2 px-2.5 py-1.5 bg-slate-900/95 border border-yellow-500/30 rounded text-xs text-white whitespace-nowrap pointer-events-none transition-opacity z-50">
          {stepLabel}
        </div>
      </div>
    </div>
  );
}
