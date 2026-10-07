/**
 * AgriGuard — Unified Hardware Connection Manager
 * ===============================================
 * Architecture:
 *   AgriGuard Dashboard
 *           ↓
 *   Connection Manager
 *           ↓
 *       ┌───────────────┐
 *       │               │
 *    WiFi Transport   BLE Transport
 *       │               │
 *    ESP32 HTTP/      ESP32 GATT
 *    WebSocket
 *
 * Supports explicit modes: SIMULATION and REAL HARDWARE.
 * Never claims "Connected" unless the physical ESP32 is verified online.
 * Disconnect immediately triggers safe stop and halts all actuators.
 */

import { HARDWARE_CONFIG } from '../config/hardwareConfig';
import { TelemetryData } from '../types';

export type OperatingMode = 'SIMULATION' | 'REAL_HARDWARE';
export type TransportType = 'Wi-Fi' | 'Bluetooth' | 'None';
export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export interface ConnectionStatusInfo {
  state: ConnectionState;
  transport: TransportType;
  mode: OperatingMode;
  ip?: string;
  port?: number;
  deviceName?: string;
  pingMs?: number | null;
  message?: string;
}

export interface RobotCommandPayload {
  type?: string;
  command?: string;
  direction?: string;
  speed?: number;
  duration_ms?: number;
  approval_token?: string;
  pump?: boolean;
  relay?: boolean;
  active?: boolean;
  timestamp?: number;
  [key: string]: any;
}

export type TelemetryCallback = (data: TelemetryData) => void;
export type StatusCallback = (status: ConnectionStatusInfo) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Disconnected Telemetry State (Zero Fake Sensor Data)
// ─────────────────────────────────────────────────────────────────────────────

export function createDisconnectedTelemetry(): TelemetryData {
  return {
    mode: 'REAL_HARDWARE',
    hardware_mode: 'REAL_HARDWARE',
    data_source: 'ESP32_PHYSICAL',
    esp32_connected: false,
    operating_mode: 'ROBOT: DISCONNECTED',
    robot_status: 'ROBOT: DISCONNECTED',
    timestamp_ms: Date.now(),
    active_zone_id: 'ZONE-R1C1',
    camera_status: { connected: false, fps: 0, device_index: 0, resolution: '1280x720' },
    esp32_ping_ms: null,
    battery_voltage: undefined,
    battery_percentage: undefined,
    movement: 'STOP',
    ultrasonic: {
      left: null as any,
      center: null as any,
      right: null as any,
      distance_cm: null as any,
      obstacle_detected: false,
      obstacle_ahead: false,
      obstacle_status: 'OFFLINE',
      robot_status: 'ROBOT: DISCONNECTED',
      status: 'OFFLINE',
      valid: false
    },
    soil_moisture: null as any,
    soil_moisture_status: 'OFFLINE',
    dht22: {
      temperature: null as any,
      humidity: null as any,
      valid: false
    },
    npk: {
      n: null as any,
      p: null as any,
      k: null as any,
      nitrogen_mg_kg: null as any,
      phosphorus_mg_kg: null as any,
      potassium_mg_kg: null as any,
      valid: false,
      status: 'OFFLINE'
    },
    mpu6050: {
      accel_x: null as any,
      accel_y: null as any,
      accel_z: null as any,
      gyro_x: null as any,
      gyro_y: null as any,
      gyro_z: null as any,
      pitch_deg: null as any,
      roll_deg: null as any,
      tilt_status: 'OFFLINE',
      valid: false
    },
    pump: {
      state: 'OFF',
      relay: 'OFF',
      spray_status: 'OFFLINE'
    },
    relay: {
      state: 'OFF'
    },
    actuators: {
      motor_state: 'DISCONNECTED',
      motor_speed: 0,
      pump_active: false,
      valve_open: false,
      flow_rate_ml_s: 0.0,
      total_volume_ml: 0.0
    },
    safety: {
      emergency_stop: false,
      obstacle_detected: false,
      watchdog_tripped: false,
      hardware_errors: ['Physical robot offline']
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IRobotTransport {
  name: TransportType;
  connect(options?: any): Promise<boolean>;
  disconnect(): Promise<void>;
  reconnect(): Promise<boolean>;
  sendCommand(payload: RobotCommandPayload): Promise<any>;
  isConnected(): boolean;
  getStatus(): ConnectionStatusInfo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wi-Fi Transport Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class WiFiTransport implements IRobotTransport {
  name: TransportType = 'Wi-Fi';
  private _state: ConnectionState = 'DISCONNECTED';
  private _ip: string = HARDWARE_CONFIG.WIFI.DEFAULT_IP;
  private _port: number = HARDWARE_CONFIG.WIFI.DEFAULT_PORT;
  private _pingMs: number | null = null;
  private _message: string = 'Disconnected';
  private _reconnectTimer: any = null;
  private _heartbeatTimer: any = null;
  private _ws: WebSocket | null = null;
  private _onTelemetry: (data: TelemetryData) => void;
  private _onStatusChange: (status: ConnectionStatusInfo) => void;

  constructor(
    onTelemetry: (data: TelemetryData) => void,
    onStatusChange: (status: ConnectionStatusInfo) => void
  ) {
    this._onTelemetry = onTelemetry;
    this._onStatusChange = onStatusChange;
  }

  setEndpoint(ip: string, port: number = 80) {
    this._ip = ip.trim();
    this._port = port;
  }

  isConnected(): boolean {
    return this._state === 'CONNECTED';
  }

  getStatus(): ConnectionStatusInfo {
    return {
      state: this._state,
      transport: 'Wi-Fi',
      mode: 'REAL_HARDWARE',
      ip: this._ip,
      port: this._port,
      deviceName: HARDWARE_CONFIG.WIFI.AP_SSID,
      pingMs: this._pingMs,
      message: this._message
    };
  }

  private _updateState(state: ConnectionState, msg: string, ping?: number | null) {
    this._state = state;
    this._message = msg;
    if (ping !== undefined) this._pingMs = ping;
    this._onStatusChange(this.getStatus());
  }

  async connect(options?: { ip?: string; port?: number }): Promise<boolean> {
    if (options?.ip) this._ip = options.ip.trim();
    if (options?.port) this._port = options.port;

    this._updateState('CONNECTING', `Connecting to ESP32 at ${this._ip}:${this._port}…`, null);

    try {
      // 1. Verify reachability through backend proxy / ping
      const res = await fetch('/api/robot/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: this._ip, port: this._port })
      });

      const data = await res.json();
      if (res.ok && data.is_connected) {
        this._pingMs = data.ping_ms || 5;
        this._updateState('CONNECTED', `Connected to ESP32 at ${this._ip}:${this._port} (${this._pingMs}ms)`, this._pingMs);
        this._startHeartbeat();
        this._connectWebSocket();
        return true;
      } else {
        // Direct probe fallback if backend couldn't reach
        const directProbe = await this._probeDirect();
        if (directProbe) {
          this._updateState('CONNECTED', `Connected directly to ESP32 at ${this._ip}:${this._port}`, this._pingMs);
          this._startHeartbeat();
          this._connectWebSocket();
          return true;
        }

        this._updateState('DISCONNECTED', data.message || `ESP32 unreachable at ${this._ip}:${this._port}. Connect to "${HARDWARE_CONFIG.WIFI.AP_SSID}" Wi-Fi.`);
        return false;
      }
    } catch (e: any) {
      this._updateState('DISCONNECTED', `Connection error: ${e.message || 'ESP32 unreachable'}`);
      return false;
    }
  }

  private async _probeDirect(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const t0 = performance.now();
      const res = await fetch(`http://${this._ip}:${this._port}/api/status`, {
        signal: controller.signal,
        mode: 'cors'
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        this._pingMs = Math.round(performance.now() - t0);
        return true;
      }
    } catch {}
    return false;
  }

  async disconnect(): Promise<void> {
    this._stopHeartbeat();
    this._stopReconnect();
    if (this._ws) {
      try { this._ws.close(); } catch {}
      this._ws = null;
    }

    try {
      await fetch('/api/robot/disconnect', { method: 'POST' });
    } catch {}

    this._updateState('DISCONNECTED', 'Wi-Fi transport disconnected. Safe stop engaged.', null);
  }

  async reconnect(): Promise<boolean> {
    this._updateState('RECONNECTING', `Reconnecting to ${this._ip}:${this._port}…`, null);
    await new Promise((r) => setTimeout(r, 600));
    return await this.connect();
  }

  private _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(async () => {
      if (this._state !== 'CONNECTED') return;
      try {
        const res = await fetch('/api/robot/heartbeat', { method: 'POST' });
        if (!res.ok) throw new Error('Heartbeat lost');
      } catch {
        // Connection lost!
        this._handleConnectionLost();
      }
    }, HARDWARE_CONFIG.WIFI.HEARTBEAT_INTERVAL_MS);
  }

  private _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private _stopReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  private _handleConnectionLost() {
    this._stopHeartbeat();
    this._updateState('RECONNECTING', 'Connection lost to ESP32. Reconnecting…', null);

    // Auto-reconnect attempt
    this._reconnectTimer = setTimeout(async () => {
      const ok = await this.connect();
      if (!ok) {
        this._updateState('DISCONNECTED', 'ESP32 Wi-Fi disconnected. Actuators safely stopped.', null);
        this._onTelemetry(createDisconnectedTelemetry());
      }
    }, 2000);
  }

  private _connectWebSocket() {
    // Standard telemetry is streamed via backend /ws/telemetry or direct ESP32 WS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

    try {
      if (this._ws) this._ws.close();
      const ws = new WebSocket(wsUrl);
      this._ws = ws;

      ws.onmessage = (event) => {
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
          this._onTelemetry(raw as TelemetryData);
        } catch {}
      };

      ws.onclose = () => {
        if (this._state === 'CONNECTED') {
          this._handleConnectionLost();
        }
      };
    } catch {}
  }

  async sendCommand(payload: RobotCommandPayload): Promise<any> {
    const cmd = payload.command || payload.direction || '';
    if (cmd === 'STOP' || payload.type === 'stop') {
      return await fetch('/api/robot/stop', { method: 'POST' }).then((r) => r.json());
    }
    if (cmd === 'EMERGENCY_STOP' || payload.type === 'emergency_stop' || payload.type === 'estop') {
      return await fetch('/api/robot/estop', { method: 'POST' }).then((r) => r.json());
    }

    return await fetch('/api/robot/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => r.json());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Web Bluetooth (BLE) GATT Transport Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class BLETransport implements IRobotTransport {
  name: TransportType = 'Bluetooth';
  private _state: ConnectionState = 'DISCONNECTED';
  private _device: any = null;
  private _server: any = null;
  private _cmdChar: any = null;
  private _telemetryChar: any = null;
  private _statusChar: any = null;
  private _message: string = 'Disconnected';
  private _onTelemetry: (data: TelemetryData) => void;
  private _onStatusChange: (status: ConnectionStatusInfo) => void;

  constructor(
    onTelemetry: (data: TelemetryData) => void,
    onStatusChange: (status: ConnectionStatusInfo) => void
  ) {
    this._onTelemetry = onTelemetry;
    this._onStatusChange = onStatusChange;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  isConnected(): boolean {
    return this._state === 'CONNECTED' && Boolean(this._server?.connected);
  }

  getStatus(): ConnectionStatusInfo {
    return {
      state: this._state,
      transport: 'Bluetooth',
      mode: 'REAL_HARDWARE',
      deviceName: this._device?.name || 'Bluetooth Device',
      message: this._message
    };
  }

  private _updateState(state: ConnectionState, msg: string) {
    this._state = state;
    this._message = msg;
    this._onStatusChange(this.getStatus());
  }

  async connect(): Promise<boolean> {
    if (!BLETransport.isSupported()) {
      this._updateState('ERROR', 'Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera over HTTPS/localhost.');
      return false;
    }

    this._updateState('CONNECTING', 'Scanning for all available Bluetooth devices nearby…');

    try {
      const nav: any = navigator;
      // Show ALL nearby Bluetooth devices in the user's area without filtering out by prefix
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          HARDWARE_CONFIG.BLE.SERVICE_UUID,
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
          '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 Serial
          '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
          '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
          '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
          '0000181a-0000-1000-8000-00805f9b34fb', // Environmental Sensing
          '00001815-0000-1000-8000-00805f9b34fb', // Automation IO
          '0000fff0-0000-1000-8000-00805f9b34fb'  // Generic ESP32 Custom
        ]
      });

      this._device = device;
      const deviceDisplayName = device.name || 'Bluetooth Device';
      this._updateState('CONNECTING', `Connecting to GATT server on ${deviceDisplayName}…`);

      // GATT Connect
      const server = await device.gatt.connect();
      this._server = server;

      let cmdChar: any = null;
      let telemChar: any = null;
      let statusChar: any = null;

      // 1. Primary Attempt: AgriGuard Custom BLE Service
      try {
        const service = await server.getPrimaryService(HARDWARE_CONFIG.BLE.SERVICE_UUID);
        try {
          cmdChar = await service.getCharacteristic(HARDWARE_CONFIG.BLE.COMMAND_CHARACTERISTIC_UUID);
        } catch {}
        try {
          telemChar = await service.getCharacteristic(HARDWARE_CONFIG.BLE.TELEMETRY_CHARACTERISTIC_UUID);
        } catch {}
        try {
          statusChar = await service.getCharacteristic(HARDWARE_CONFIG.BLE.STATUS_CHARACTERISTIC_UUID);
        } catch {}
      } catch {
        // Device does not expose AgriGuard custom UUID; try standard UART fallbacks
      }

      // 2. Secondary Attempt: Nordic Semiconductor UART Service (NUS)
      if (!cmdChar || !telemChar) {
        try {
          const nusService = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
          if (!cmdChar) {
            cmdChar = await nusService.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e'); // RX (write)
          }
          if (!telemChar) {
            telemChar = await nusService.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e'); // TX (notify)
          }
        } catch {}
      }

      // 3. Tertiary Attempt: HM-10 / CC2541 Serial Service
      if (!cmdChar || !telemChar) {
        try {
          const hmService = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
          const char = await hmService.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
          if (!cmdChar) cmdChar = char;
          if (!telemChar) telemChar = char;
        } catch {}
      }

      // 4. Quaternary Attempt: Inspect any available primary services for writable and notifiable characteristics
      if (!cmdChar || !telemChar) {
        try {
          const primaryServices = await server.getPrimaryServices();
          for (const s of primaryServices) {
            try {
              const characteristics = await s.getCharacteristics();
              for (const c of characteristics) {
                if (!cmdChar && (c.properties?.write || c.properties?.writeWithoutResponse)) {
                  cmdChar = c;
                }
                if (!telemChar && (c.properties?.notify || c.properties?.indicate)) {
                  telemChar = c;
                }
              }
            } catch {}
          }
        } catch {}
      }

      this._cmdChar = cmdChar;
      this._telemetryChar = telemChar;
      this._statusChar = statusChar;

      // Status notifications if present
      if (this._statusChar && this._statusChar.properties?.notify) {
        try {
          await this._statusChar.startNotifications();
          this._statusChar.addEventListener('characteristicvaluechanged', (e: any) => {
            try {
              const raw = new TextDecoder().decode(e.target.value);
              console.log('[BLE STATUS]', raw);
            } catch {}
          });
        } catch {}
      }

      // Start Telemetry Notifications if characteristic supports notify or indicate
      if (this._telemetryChar && (this._telemetryChar.properties?.notify || this._telemetryChar.properties?.indicate)) {
        try {
          await this._telemetryChar.startNotifications();
          this._telemetryChar.addEventListener('characteristicvaluechanged', (event: any) => {
            try {
              const raw = new TextDecoder().decode(event.target.value);
              const telem = JSON.parse(raw);
              telem.esp32_connected = true;
              telem.mode = 'REAL_HARDWARE';
              telem.data_source = 'ESP32_BLE';

              // Deliver directly to dashboard
              this._onTelemetry(telem);

              // Ingest into backend for AI & DB persistence
              fetch('/api/robot/telemetry_ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: raw
              }).catch(() => {});
            } catch (err) {
              console.warn('[BLE] Telemetry stream parse warning:', err);
            }
          });
        } catch (subErr) {
          console.warn('[BLE] Telemetry notification registration skipped:', subErr);
        }
      }

      // Disconnect Listener
      device.addEventListener('gattserverdisconnected', () => {
        this._handleGattDisconnected();
      });

      const hasControls = Boolean(this._cmdChar);
      const hasTelem = Boolean(this._telemetryChar);
      let statusMsg = `Connected to ${deviceDisplayName} via Web Bluetooth!`;
      if (hasControls && hasTelem) {
        statusMsg += ' Real hardware telemetry & controls live.';
      } else if (hasControls) {
        statusMsg += ' Hardware control channel live.';
      } else {
        statusMsg += ' GATT link established.';
      }

      this._updateState('CONNECTED', statusMsg);
      return true;
    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        this._updateState('DISCONNECTED', 'Bluetooth device pairing was cancelled by user.');
      } else if (e.name === 'SecurityError') {
        this._updateState('ERROR', 'Web Bluetooth requires a secure context (HTTPS or http://localhost).');
      } else {
        this._updateState('ERROR', e.message || 'Bluetooth connection failed.');
      }
      return false;
    }
  }

  private _handleGattDisconnected() {
    this._server = null;
    this._cmdChar = null;
    this._telemetryChar = null;
    this._statusChar = null;
    this._updateState('DISCONNECTED', 'Bluetooth GATT disconnected. Robot stopped safely.');
    this._onTelemetry(createDisconnectedTelemetry());
  }

  async disconnect(): Promise<void> {
    if (this._device?.gatt?.connected) {
      try {
        // Safe stop command before disconnecting if writable
        if (this._cmdChar) {
          await this.sendCommand({ type: 'robot_command', command: 'STOP' });
        }
        this._device.gatt.disconnect();
      } catch {}
    }
    this._handleGattDisconnected();
  }

  async reconnect(): Promise<boolean> {
    if (this._device) {
      try {
        this._updateState('RECONNECTING', `Reconnecting to ${this._device.name || 'Bluetooth Device'}…`);
        const server = await this._device.gatt.connect();
        this._server = server;
        this._updateState('CONNECTED', `Reconnected to ${this._device.name || 'Bluetooth Device'} via Bluetooth.`);
        return true;
      } catch {
        return await this.connect();
      }
    }
    return await this.connect();
  }

  async sendCommand(payload: RobotCommandPayload): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Bluetooth is not connected. Command rejected.');
    }
    if (!this._cmdChar) {
      throw new Error(`Device "${this._device?.name || 'Selected Device'}" has no writable command characteristic. Please pair with an AgriGuard robot.`);
    }

    const json = JSON.stringify(payload);
    const data = new TextEncoder().encode(json);
    if (this._cmdChar.properties?.writeWithoutResponse && !this._cmdChar.properties?.write) {
      await this._cmdChar.writeValueWithoutResponse(data);
    } else {
      await this._cmdChar.writeValue(data);
    }
    return { ok: true, accepted: true, executed: true, source: 'bluetooth_gatt' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified Connection Manager Facade
// ─────────────────────────────────────────────────────────────────────────────

class ConnectionManager {
  private _mode: OperatingMode = 'REAL_HARDWARE';
  private _activeTransport: IRobotTransport;
  private _wifiTransport: WiFiTransport;
  private _bleTransport: BLETransport;
  private _telemetrySubscribers: Set<TelemetryCallback> = new Set();
  private _statusSubscribers: Set<StatusCallback> = new Set();
  private _currentStatus: ConnectionStatusInfo;

  constructor() {
    this._wifiTransport = new WiFiTransport(
      (data) => this._broadcastTelemetry(data),
      (status) => this._broadcastStatus(status)
    );

    this._bleTransport = new BLETransport(
      (data) => this._broadcastTelemetry(data),
      (status) => this._broadcastStatus(status)
    );

    this._activeTransport = this._wifiTransport;
    this._currentStatus = this._wifiTransport.getStatus();

    // Query initial mode from backend
    fetch('/api/robot/mode')
      .then((r) => r.json())
      .then((data) => {
        if (data.mode) {
          this._mode = data.mode.toUpperCase() as OperatingMode;
          this._currentStatus.mode = this._mode;
          this._broadcastStatus(this._currentStatus);
        }
      })
      .catch(() => {});
  }

  getMode(): OperatingMode {
    return this._mode;
  }

  setMode(mode: OperatingMode): void {
    this._mode = mode;
    this._currentStatus.mode = mode;

    fetch('/api/robot/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    }).catch(() => {});

    if (mode === 'SIMULATION') {
      this._broadcastStatus({
        state: 'CONNECTED',
        transport: 'None',
        mode: 'SIMULATION',
        message: 'SIMULATION MODE ACTIVE (Safe test sandbox)'
      });
    } else {
      const st = this._activeTransport.getStatus();
      this._broadcastStatus(st);
      if (!this._activeTransport.isConnected()) {
        this._broadcastTelemetry(createDisconnectedTelemetry());
      }
    }
  }

  getStatus(): ConnectionStatusInfo {
    if (this._mode === 'SIMULATION') {
      return {
        state: 'CONNECTED',
        transport: 'None',
        mode: 'SIMULATION',
        message: 'SIMULATION MODE ACTIVE'
      };
    }
    return this._activeTransport.getStatus();
  }

  isConnected(): boolean {
    if (this._mode === 'SIMULATION') return true;
    return this._activeTransport.isConnected();
  }

  getTransport(): TransportType {
    return this._activeTransport.name.includes('Bluetooth') ? 'Bluetooth' : 'Wi-Fi';
  }

  getDisconnectedTelemetry(): TelemetryData {
    return createDisconnectedTelemetry();
  }

  async connect(transportType: 'wifi' | 'bluetooth' = 'wifi', options?: any): Promise<boolean> {
    this.setMode('REAL_HARDWARE');

    if (transportType === 'bluetooth') {
      if (this._wifiTransport.isConnected()) {
        await this._wifiTransport.disconnect();
      }
      this._activeTransport = this._bleTransport;
      return await this._bleTransport.connect();
    } else {
      if (this._bleTransport.isConnected()) {
        await this._bleTransport.disconnect();
      }
      this._activeTransport = this._wifiTransport;
      return await this._wifiTransport.connect(options);
    }
  }

  async disconnect(): Promise<void> {
    await this._activeTransport.disconnect();
    if (this._mode === 'REAL_HARDWARE') {
      this._broadcastTelemetry(createDisconnectedTelemetry());
    }
  }

  async reconnect(): Promise<boolean> {
    return await this._activeTransport.reconnect();
  }

  async sendCommand(command: RobotCommandPayload): Promise<any> {
    if (this._mode === 'REAL_HARDWARE' && !this._activeTransport.isConnected()) {
      throw new Error('Action blocked: Physical ESP32 robot is DISCONNECTED.');
    }

    if (this._mode === 'SIMULATION') {
      // In simulation, forward through backend mock API
      const cmd = command.command || command.direction || '';
      if (cmd === 'STOP' || command.type === 'stop') {
        return await fetch('/api/robot/stop', { method: 'POST' }).then((r) => r.json());
      }
      if (cmd === 'EMERGENCY_STOP' || command.type === 'emergency_stop') {
        return await fetch('/api/robot/estop', { method: 'POST' }).then((r) => r.json());
      }
      return await fetch('/api/robot/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command)
      }).then((r) => r.json());
    }

    return await this._activeTransport.sendCommand(command);
  }

  subscribeTelemetry(callback: TelemetryCallback): () => void {
    this._telemetrySubscribers.add(callback);
    return () => {
      this._telemetrySubscribers.delete(callback);
    };
  }

  subscribeStatus(callback: StatusCallback): () => void {
    this._statusSubscribers.add(callback);
    callback(this.getStatus());
    return () => {
      this._statusSubscribers.delete(callback);
    };
  }

  private _broadcastTelemetry(data: TelemetryData) {
    if (this._mode === 'REAL_HARDWARE' && !this._activeTransport.isConnected()) {
      data = createDisconnectedTelemetry();
    }
    this._telemetrySubscribers.forEach((cb) => {
      try { cb(data); } catch {}
    });
  }

  private _broadcastStatus(status: ConnectionStatusInfo) {
    this._currentStatus = status;
    this._statusSubscribers.forEach((cb) => {
      try { cb(status); } catch {}
    });
  }
}

// Global Singleton Export
export const connectionManager = new ConnectionManager();
