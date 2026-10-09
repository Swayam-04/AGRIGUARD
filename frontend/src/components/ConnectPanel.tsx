import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  Bluetooth,
  PlugZap,
  Unplug,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  Sparkles,
  AlertTriangle,
  Radio,
  ExternalLink
} from 'lucide-react';
import {
  connectionManager,
  ConnectionState,
  ConnectionStatusInfo,
  OperatingMode,
  TransportType
} from '../services/connectionManager';
import { HARDWARE_CONFIG } from '../config/hardwareConfig';
import { TelemetryData } from '../types';

interface ConnectPanelProps {
  telemetry: TelemetryData | null;
  onConnectionChange?: () => void;
}

type ActiveTab = 'wifi' | 'bluetooth';

export const ConnectPanel: React.FC<ConnectPanelProps> = ({ telemetry, onConnectionChange }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('wifi');
  const [connStatus, setConnStatus] = useState<ConnectionStatusInfo>(connectionManager.getStatus());
  const [operatingMode, setOperatingMode] = useState<OperatingMode>(connectionManager.getMode());

  // Wi-Fi state
  const [wifiIp, setWifiIp] = useState<string>(HARDWARE_CONFIG.WIFI.DEFAULT_IP);
  const [wifiPort, setWifiPort] = useState<string>(String(HARDWARE_CONFIG.WIFI.DEFAULT_PORT));
  const [isActionPending, setIsActionPending] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Bluetooth state
  const hasWebBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : true;

  // Subscribe to ConnectionManager status updates
  useEffect(() => {
    const unsubscribe = connectionManager.subscribeStatus((status) => {
      setConnStatus(status);
      setOperatingMode(status.mode);
      if (status.message) {
        setStatusMessage(status.message);
      }
    });
    return () => unsubscribe();
  }, []);

  const isRealConnected = connStatus.state === 'CONNECTED' && operatingMode === 'REAL_HARDWARE';
  const isConnecting = connStatus.state === 'CONNECTING' || isActionPending;
  const isReconnecting = connStatus.state === 'RECONNECTING';

  // ── Mode Switch Handler ───────────────────────────────────────────────────────
  const handleModeSwitch = (mode: OperatingMode) => {
    connectionManager.setMode(mode);
    setOperatingMode(mode);
    setStatusMessage(
      mode === 'SIMULATION'
        ? 'Switched to SIMULATION mode (Safe test sandbox, no hardware required).'
        : 'Switched to REAL HARDWARE mode. Connect your physical ESP32 to begin.'
    );
    onConnectionChange?.();
  };

  // ── Wi-Fi Actions ─────────────────────────────────────────────────────────────
  const handleWifiConnect = async () => {
    const ip = wifiIp.trim();
    const port = parseInt(wifiPort, 10) || 80;
    if (!ip) {
      setStatusMessage('Please enter a valid ESP32 IP address or hostname (e.g., 192.168.4.1).');
      return;
    }

    setIsActionPending(true);
    setStatusMessage(`Verifying ESP32 at ${ip}:${port}…`);
    try {
      const ok = await connectionManager.connect('wifi', { ip, port });
      if (!ok) {
        setStatusMessage(`Could not reach ESP32 at ${ip}:${port}. Connect PC Wi-Fi to "${HARDWARE_CONFIG.WIFI.AP_SSID}".`);
      }
      onConnectionChange?.();
    } catch (err: any) {
      setStatusMessage(err.message || 'Wi-Fi connection error.');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleWifiDisconnect = async () => {
    setIsActionPending(true);
    try {
      await connectionManager.disconnect();
      setStatusMessage('ESP32 disconnected. Actuators safely stopped.');
      onConnectionChange?.();
    } catch (err: any) {
      setStatusMessage(err.message || 'Disconnect error.');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleWifiReconnect = async () => {
    setIsActionPending(true);
    setStatusMessage(`Reconnecting to ESP32 at ${wifiIp}…`);
    try {
      const ok = await connectionManager.reconnect();
      if (!ok) {
        setStatusMessage(`Reconnect attempt failed for ${wifiIp}. Verify ESP32 power and Wi-Fi connection.`);
      }
      onConnectionChange?.();
    } catch (err: any) {
      setStatusMessage(err.message || 'Reconnect error.');
    } finally {
      setIsActionPending(false);
    }
  };

  // ── Web Bluetooth Action ──────────────────────────────────────────────────────
  const handleBleConnect = async () => {
    if (!hasWebBluetooth) {
      setStatusMessage('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera on desktop/Android.');
      return;
    }

    if (!isSecureContext) {
      setStatusMessage('Web Bluetooth requires a secure context (HTTPS or http://localhost).');
      return;
    }

    setIsActionPending(true);
    setStatusMessage('Opening Bluetooth device chooser… scanning all nearby devices');
    try {
      const ok = await connectionManager.connect('bluetooth');
      if (ok) {
        setStatusMessage('Connected to Bluetooth device! Hardware connection active.');
      }
      onConnectionChange?.();
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        setStatusMessage('Bluetooth device chooser was cancelled by user.');
      } else {
        setStatusMessage(err.message || 'Web Bluetooth connection failed.');
      }
    } finally {
      setIsActionPending(false);
    }
  };

  // Wi-Fi Status label
  let wifiStatusLabel: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' = 'DISCONNECTED';
  if (connStatus.transport === 'Wi-Fi') {
    if (connStatus.state === 'CONNECTED') wifiStatusLabel = 'CONNECTED';
    else if (connStatus.state === 'RECONNECTING') wifiStatusLabel = 'RECONNECTING';
    else wifiStatusLabel = 'DISCONNECTED';
  }

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
      
      {/* ── Top Header Row ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        {/* Title & Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: isRealConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
            border: `1px solid ${isRealConnected ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.35)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <PlugZap size={20} color={isRealConnected ? 'var(--emerald-400)' : 'var(--sky-400)'} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Robot Hardware Connectivity
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
              Primary: Wi-Fi (SoftAP / LAN) · Optional: Web Bluetooth BLE · Safe Watchdog Interlock
            </p>
          </div>
        </div>

        {/* Explicit Operating Mode Switch (SIMULATION vs REAL HARDWARE) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            id="connect-mode-sim-btn"
            onClick={() => handleModeSwitch('SIMULATION')}
            style={{
              padding: '0.35rem 0.8rem',
              borderRadius: '7px',
              border: 'none',
              background: operatingMode === 'SIMULATION' ? 'var(--sky-500)' : 'transparent',
              color: operatingMode === 'SIMULATION' ? '#05080f' : 'var(--text-muted)',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>SIMULATION</span>
            <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: operatingMode === 'SIMULATION' ? '#0284C7' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
              PRIORITY
            </span>
          </button>

          <button
            type="button"
            id="connect-mode-hw-btn"
            onClick={() => handleModeSwitch('REAL_HARDWARE')}
            style={{
              padding: '0.35rem 0.8rem',
              borderRadius: '7px',
              border: 'none',
              background: operatingMode === 'REAL_HARDWARE' ? 'var(--emerald-500)' : 'transparent',
              color: operatingMode === 'REAL_HARDWARE' ? '#05080f' : 'var(--text-muted)',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            REAL HARDWARE
          </button>
        </div>
      </div>

      {/* ── Status Banner (Zero False Claims) ─────────────────────────────────── */}
      <div style={{
        padding: '0.65rem 0.9rem',
        borderRadius: '8px',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        background: operatingMode === 'SIMULATION'
          ? 'rgba(56, 189, 248, 0.08)'
          : isRealConnected
            ? 'rgba(16, 185, 129, 0.12)'
            : 'rgba(244, 63, 94, 0.12)',
        border: `1px solid ${
          operatingMode === 'SIMULATION'
            ? 'rgba(56, 189, 248, 0.3)'
            : isRealConnected
              ? 'rgba(16, 185, 129, 0.4)'
              : 'rgba(244, 63, 94, 0.4)'
        }`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          {operatingMode === 'SIMULATION' ? (
            <Radio size={16} color="var(--sky-400)" />
          ) : isRealConnected ? (
            <CheckCircle2 size={16} color="var(--emerald-400)" />
          ) : (
            <XCircle size={16} color="var(--rose-400)" />
          )}

          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: operatingMode === 'SIMULATION' ? 'var(--sky-400)' : isRealConnected ? 'var(--emerald-400)' : 'var(--rose-400)' }}>
              {operatingMode === 'SIMULATION'
                ? 'MODE: SIMULATION (Active Priority · Safe Test Sandbox)'
                : isRealConnected
                  ? `ROBOT: CONNECTED via ${connStatus.transport}`
                  : 'ROBOT: DISCONNECTED (Real Hardware Mode)'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {operatingMode === 'SIMULATION'
                ? 'Simulation is prioritized as the primary testbed. Full dynamic physics and simulated sensors active. Switch to Real Hardware at any time to link physical ESP32.'
                : isRealConnected
                  ? `Hardware: ${connStatus.deviceName || HARDWARE_CONFIG.BLE.DEVICE_NAME} · Ping: ${connStatus.pingMs != null ? `${connStatus.pingMs}ms` : '<10ms'}`
                  : 'Physical ESP32 unreachable. Connect Wi-Fi or Web Bluetooth BLE to link rover, or switch back to safe Simulation mode.'}
            </div>
          </div>
        </div>

        {/* Mode Tag */}
        <span style={{
          fontSize: '0.7rem',
          padding: '0.2rem 0.6rem',
          borderRadius: '6px',
          fontWeight: 700,
          background: 'rgba(0,0,0,0.3)',
          color: operatingMode === 'SIMULATION' ? 'var(--sky-400)' : isRealConnected ? 'var(--emerald-400)' : 'var(--rose-400)'
        }}>
          {operatingMode === 'SIMULATION' ? 'SIMULATION (PRIORITY)' : isRealConnected ? 'LIVE ESP32' : 'HARDWARE OFFLINE'}
        </span>
      </div>

      {/* ── Transport Tabs (Wi-Fi vs Bluetooth) ──────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
        background: 'rgba(0, 0, 0, 0.25)',
        padding: '0.3rem',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
        maxWidth: '380px'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('wifi')}
          style={{
            flex: 1,
            padding: '0.45rem 0.75rem',
            borderRadius: '7px',
            border: 'none',
            background: activeTab === 'wifi' ? 'var(--emerald-500)' : 'transparent',
            color: activeTab === 'wifi' ? '#05080f' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Wifi size={14} />
          Wi-Fi (Primary)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bluetooth')}
          style={{
            flex: 1,
            padding: '0.45rem 0.75rem',
            borderRadius: '7px',
            border: 'none',
            background: activeTab === 'bluetooth' ? 'var(--emerald-500)' : 'transparent',
            color: activeTab === 'bluetooth' ? '#05080f' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Bluetooth size={14} />
          Bluetooth BLE (Optional)
        </button>
      </div>

      {/* ── Wi-Fi Section ────────────────────────────────────────────────────── */}
      {activeTab === 'wifi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* Wi-Fi Info Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '0.85rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Wifi size={16} color="var(--emerald-400)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Wi-Fi Connection</span>
              </div>

              {/* Status Badge: CONNECTED / DISCONNECTED / RECONNECTING */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Status:</span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  background: wifiStatusLabel === 'CONNECTED' ? 'rgba(16, 185, 129, 0.2)' : wifiStatusLabel === 'RECONNECTING' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                  color: wifiStatusLabel === 'CONNECTED' ? 'var(--emerald-400)' : wifiStatusLabel === 'RECONNECTING' ? 'var(--amber-400)' : 'var(--rose-400)',
                  border: `1px solid ${wifiStatusLabel === 'CONNECTED' ? 'rgba(16, 185, 129, 0.4)' : wifiStatusLabel === 'RECONNECTING' ? 'rgba(234, 179, 8, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`
                }}>
                  {wifiStatusLabel}
                </span>
              </div>
            </div>

            {/* IP & Port Input Controls */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div style={{ flex: '2 1 200px' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Robot IP / Hostname
                </label>
                <input
                  type="text"
                  value={wifiIp}
                  onChange={(e) => setWifiIp(e.target.value)}
                  placeholder="192.168.4.1 or agriguard.local"
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ flex: '1 1 90px', maxWidth: '120px' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Port
                </label>
                <input
                  type="number"
                  value={wifiPort}
                  onChange={(e) => setWifiPort(e.target.value)}
                  min={1}
                  max={65535}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Three Mandatory Buttons: CONNECT, DISCONNECT, RECONNECT */}
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleWifiConnect}
                  disabled={isConnecting}
                  className="btn btn-primary"
                  style={{
                    height: '38px',
                    padding: '0 1rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer'
                  }}
                >
                  {isConnecting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Wifi size={13} />}
                  CONNECT
                </button>

                <button
                  type="button"
                  onClick={handleWifiDisconnect}
                  disabled={isConnecting || connStatus.state !== 'CONNECTED'}
                  className="btn btn-outline"
                  style={{
                    height: '38px',
                    padding: '0 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    color: 'var(--rose-400)',
                    borderColor: 'rgba(244, 63, 94, 0.35)',
                    cursor: connStatus.state === 'CONNECTED' ? 'pointer' : 'default',
                    opacity: connStatus.state === 'CONNECTED' ? 1 : 0.5
                  }}
                >
                  <Unplug size={13} />
                  DISCONNECT
                </button>

                <button
                  type="button"
                  onClick={handleWifiReconnect}
                  disabled={isConnecting}
                  className="btn btn-outline"
                  style={{
                    height: '38px',
                    padding: '0 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    color: 'var(--sky-400)',
                    borderColor: 'rgba(56, 189, 248, 0.35)',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={13} className={isReconnecting ? 'spin' : ''} />
                  RECONNECT
                </button>
              </div>
            </div>

            {/* Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>Discovery Presets:</span>
              {[
                { label: 'SoftAP Default (192.168.4.1)', ip: HARDWARE_CONFIG.WIFI.DEFAULT_IP },
                { label: 'mDNS (agriguard.local)', ip: HARDWARE_CONFIG.WIFI.DEFAULT_HOSTNAME },
                { label: 'LAN Hotspot (192.168.1.100)', ip: '192.168.1.100' }
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setWifiIp(p.ip)}
                  style={{
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-muted)',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Bluetooth BLE Section ────────────────────────────────────────────── */}
      {activeTab === 'bluetooth' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Bluetooth size={16} color="var(--emerald-400)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Web Bluetooth (BLE GATT)</span>
              </div>

              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                background: connStatus.transport === 'Bluetooth' && connStatus.state === 'CONNECTED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: connStatus.transport === 'Bluetooth' && connStatus.state === 'CONNECTED' ? 'var(--emerald-400)' : 'var(--text-muted)'
              }}>
                {connStatus.transport === 'Bluetooth' && connStatus.state === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>

            {/* Browser Support Check */}
            {!hasWebBluetooth && (
              <div style={{
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: 'var(--amber-400)',
                fontSize: '0.74rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertTriangle size={15} color="var(--amber-400)" style={{ flexShrink: 0 }} />
                <span>Bluetooth not supported in this browser. Please use Chrome, Edge, or Opera on desktop or Android.</span>
              </div>
            )}

            {!isSecureContext && hasWebBluetooth && (
              <div style={{
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: 'var(--rose-400)',
                fontSize: '0.74rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertTriangle size={15} color="var(--rose-400)" style={{ flexShrink: 0 }} />
                <span>Web Bluetooth requires a secure context (HTTPS or http://localhost).</span>
              </div>
            )}

            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
              Scans and discovers all available Bluetooth devices in your area (AgriGuard ESP32, BLE modules, and nearby peripherals). Select any device to connect.
            </p>

            {/* Explicit User Button */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleBleConnect}
                disabled={!hasWebBluetooth || isConnecting}
                className="btn btn-primary"
                style={{
                  height: '38px',
                  padding: '0 1.25rem',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: hasWebBluetooth ? 'pointer' : 'not-allowed',
                  opacity: hasWebBluetooth ? 1 : 0.6
                }}
              >
                {isConnecting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Bluetooth size={14} />}
                CONNECT BLUETOOTH
              </button>

              {connStatus.transport === 'Bluetooth' && connStatus.state === 'CONNECTED' && (
                <button
                  type="button"
                  onClick={handleWifiDisconnect}
                  className="btn btn-outline"
                  style={{
                    height: '38px',
                    padding: '0 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--rose-400)',
                    borderColor: 'rgba(244, 63, 94, 0.35)',
                    cursor: 'pointer'
                  }}
                >
                  <Unplug size={13} />
                  DISCONNECT BLE
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Status Message Feedback ─────────────────────────────────────────── */}
      {statusMessage && (
        <div style={{
          marginTop: '0.85rem',
          padding: '0.55rem 0.85rem',
          borderRadius: '8px',
          background: isRealConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(56, 189, 248, 0.08)',
          border: `1px solid ${isRealConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.2)'}`,
          color: isRealConnected ? 'var(--emerald-400)' : 'var(--text-main)',
          fontSize: '0.75rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Info size={14} color="var(--sky-400)" style={{ flexShrink: 0 }} />
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
};
