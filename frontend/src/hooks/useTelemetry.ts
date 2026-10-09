import { useState, useEffect, useRef } from 'react';
import { TelemetryData } from '../types';
import { connectionManager, ConnectionStatusInfo } from '../services/connectionManager';

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusInfo>(connectionManager.getStatus());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let unmounted = false;

    // 1. Subscribe to ConnectionManager status
    const unsubStatus = connectionManager.subscribeStatus((st) => {
      if (!unmounted) {
        setConnectionStatus(st);
      }
    });

    // 2. Subscribe to ConnectionManager telemetry
    const unsubTelemetry = connectionManager.subscribeTelemetry((data) => {
      if (!unmounted) {
        setTelemetry(data);
      }
    });

    // 3. Connect to backend websocket
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/telemetry`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!unmounted) setWsConnected(true);
        };

        ws.onmessage = (event) => {
          if (unmounted) return;
          try {
            const raw = JSON.parse(event.data);
            if (raw.type === 'field_observation') {
              window.dispatchEvent(new CustomEvent('field_observation', { detail: raw.observation }));
              return;
            }
            if (raw.type === 'treatment_applied') {
              window.dispatchEvent(new CustomEvent('treatment_applied', { detail: raw }));
              return;
            }
            const data: TelemetryData = raw;

            // When in SIMULATION mode (Priority), ensure simulation tags and propagate data
            if (connectionManager.getMode() === 'SIMULATION') {
              data.mode = 'SIMULATION';
              data.hardware_mode = 'SIMULATION';
              setTelemetry(data);
              return;
            }

            // If in REAL_HARDWARE mode and BLE is active, BLE takes precedence
            if (connectionManager.getTransport() === 'Bluetooth' && connectionManager.isConnected()) {
              return;
            }

            // If in REAL_HARDWARE mode and disconnected, enforce clean disconnected state (no fake data)
            if (connectionManager.getMode() === 'REAL_HARDWARE' && !data.esp32_connected) {
              setTelemetry(connectionManager.getDisconnectedTelemetry());
              return;
            }

            setTelemetry(data);
          } catch (e) {
            console.error('Failed to parse telemetry message:', e);
          }
        };

        ws.onclose = () => {
          if (!unmounted) {
            setWsConnected(false);
            // Reconnect after 1.5 seconds
            reconnectTimeoutRef.current = window.setTimeout(connect, 1500);
          }
        };

        ws.onerror = () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        };
      } catch (err) {
        if (!unmounted) {
          reconnectTimeoutRef.current = window.setTimeout(connect, 2000);
        }
      }
    }

    connect();

    return () => {
      unmounted = true;
      unsubStatus();
      unsubTelemetry();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { telemetry, wsConnected, connectionStatus };
}
