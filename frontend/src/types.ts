export interface CameraStatus {
  enabled?: boolean;
  connected: boolean;
  device_index: number;
  resolution: string;
  fps: number;
  backend?: string;
  status?: string;
}

export interface UltrasonicTelemetry {
  left?: number | null;
  center?: number | null;
  right?: number | null;
  distance_cm: number;
  obstacle_status?: "SAFE" | "WARNING" | "OBSTACLE" | string;
  robot_status?: string;
  valid?: boolean;
  obstacle_detected?: boolean;
  obstacle_ahead?: boolean;
  status?: string;
}

export interface DHT22Telemetry {
  temperature: number;
  humidity: number;
  valid?: boolean;
}

export interface MPU6050Telemetry {
  accel_x: number;
  accel_y: number;
  accel_z: number;
  gyro_x: number;
  gyro_y: number;
  gyro_z: number;
  pitch_deg?: number;
  roll_deg?: number;
  tilt_status?: string;
  valid?: boolean;
}

export interface PumpTelemetry {
  state: "ON" | "OFF" | string;
  relay: "ON" | "OFF" | string;
  spray_status?: "READY" | "ACTIVE" | string;
}

export interface IMUTelemetry {
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
  pitch_deg: number;
  roll_deg: number;
  yaw_deg: number;
  valid: boolean;
}

export interface SoilMoistureTelemetry {
  raw_adc?: number;
  moisture_pct: number;
  percentage?: number;
  valid?: boolean;
  status?: string;
}

export interface EnvironmentTelemetry {
  temperature_c: number;
  humidity_pct: number;
  valid: boolean;
  status: string;
}

export interface NPKTelemetry {
  nitrogen_mg_kg: number;
  phosphorus_mg_kg: number;
  potassium_mg_kg: number;
  n?: number | null;
  p?: number | null;
  k?: number | null;
  valid: boolean;
  status: string;
}

export interface ActuatorsTelemetry {
  pump_active: boolean;
  valve_open: boolean;
  flow_rate_ml_s: number;
  total_volume_ml?: number;
  motor_state: string;
  motor_speed: number;
  spray_state?: string;
}

export interface SafetyTelemetry {
  emergency_stop: boolean;
  watchdog_tripped: boolean;
  obstacle_detected?: boolean;
  physical_estop_pin?: boolean;
  robot_status?: string;
  hardware_errors: string[];
}

export interface TelemetryData {
  mode?: "SIMULATION" | "REAL_HARDWARE" | string;
  hardware_mode?: "REAL_HARDWARE" | "SIMULATION" | string;
  data_source?: "SIMULATION" | "ESP32_PHYSICAL" | string;
  esp32_connected: boolean;
  connection_state?: "CONNECTED" | "DISCONNECTED" | "RECONNECTING";
  timestamp_ms: number;
  active_zone_id: string;
  camera_status: CameraStatus;
  ultrasonic: UltrasonicTelemetry;
  soil_moisture: any;
  soil_moisture_status?: "DRY" | "NORMAL" | "WET" | string;
  dht22?: DHT22Telemetry;
  environment?: EnvironmentTelemetry;
  mpu6050?: MPU6050Telemetry;
  imu?: IMUTelemetry;
  pump?: PumpTelemetry;
  actuators?: ActuatorsTelemetry;
  npk?: NPKTelemetry;
  safety?: SafetyTelemetry;
  battery_voltage?: number | null;
  battery_percentage?: number | null;
  robot_location?: RobotPosition;
  esp32_ping_ms?: number | null;
  operating_mode?: string;
  robot_status?: string;
  movement?: string;
  relay?: { state: string };
}

export interface DiagnosticsReport {
  timestamp?: number;
  esp32: "CONNECTED" | "DISCONNECTED";
  camera: "CONNECTED" | "DISCONNECTED";
  npk: "CONNECTED" | "DISCONNECTED";
  soil_moisture: "OK" | "ERROR";
  temperature: "OK" | "ERROR";
  ultrasonic: "OK" | "ERROR";
  imu: "OK" | "ERROR";
  pump: "OFF" | "ON";
  valve: "CLOSED" | "OPEN";
  flow: string;
  battery_voltage?: number | null;
  raw_telemetry?: any;
}

export interface VisualAnnotation {
  type: string;
  category: string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  color: string;
  label: string;
  is_target: boolean;
}

export interface AIDetection {
  plant_id: string;
  crop: string;
  disease: string;
  display_name: string;
  confidence: number;
  severity: string;
  affected_area: number;
  plant_health_score?: number;
  score_breakdown?: {
    disease_penalty: number;
    drought_penalty: number;
    nitrogen_penalty: number;
  };
  status: string;
  bounding_box?: { x: number; y: number; w: number; h: number } | null;
  objects?: Array<{ type: string; confidence: number; bbox?: number[] }>;
  plant_results?: Array<any>;
  visual_annotations?: VisualAnnotation[];
  frame_status?: string;
  spray_eligible?: boolean;
  spray_allowed?: boolean;
  message?: string;
  frame_dimensions?: { width: number; height: number };
  inference_time_ms?: number;
  timestamp: string;
}

export interface TreatmentItem {
  id: string;
  trade_name: string;
  active_ingredient: string;
  dosage_description: string;
  pulse_duration_ms: number;
  estimated_volume_ml: number;
  target_inventory_code: string;
  application_method: string;
  safety_interval_hours: number;
}

export interface TreatmentDecision {
  decision_id: string;
  crop: string;
  disease: string;
  display_name?: string;
  confidence: number;
  severity: string;
  status: string;
  recommended_treatment?: TreatmentItem | null;
  inventory_check: {
    available: boolean;
    reason: string;
    remaining_ml?: number;
  };
  approval_required: boolean;
  approved: boolean;
  spray_permitted: boolean;
  action_guidance: string;
  warnings: string[];
  recommendation_db_id?: number | null;
}

export interface ZoneData {
  zone_id: string;
  row_idx: number;
  col_idx: number;
  crop_type: string;
  health_status: string;
  last_inspected: string | null;
}

export interface TankInventory {
  tank_id: string;
  chemical_name: string;
  active_ingredient: string;
  current_level_ml: number;
  capacity_ml: number;
  percentage: number;
  status: string;
  compatible_diseases: string[];
}

export interface RobotPosition {
  x: number;
  y: number;
  zone_id: string;
  zone: string;
  mode: string;
  latitude?: number | null;
  longitude?: number | null;
  last_movement?: string | null;
  last_moved_at?: string | null;
  total_moves?: number;
}

export interface HeatmapObservation {
  id: number;
  timestamp: string;
  zone_id: string;
  zone: string;
  x: number;
  y: number;
  latitude?: number | null;
  longitude?: number | null;
  crop: string;
  disease: string;
  confidence: number;
  severity: string;
  health_score: number;
  treatment_status: string;
  prescribed_treatment?: string | null;
}

export interface FieldHeatmapResponse {
  field: {
    width: number;
    height: number;
    cell_size_m?: number;
    name?: string;
  };
  observations: HeatmapObservation[];
  current_robot_position?: RobotPosition;
}

export interface NetworkStatus {
  operating_mode: string;
  wifi_mode: string;
  esp32_target_ip: string;
  esp32_connected: boolean;
  esp32_ping_ms: number | null;
  laptop_lan_ip: string;
  dashboard_mobile_url: string;
  internet_required: boolean;
  offline_ready: boolean;
  watchdog_timeout_ms: number;
}

export type CropType =
  | "Rice"
  | "Wheat"
  | "Cotton"
  | "Sugarcane"
  | "Tomato"
  | "Potato"
  | "Onion"
  | "Maize"
  | "Soybean"
  | "Groundnut"
  | "Pepper"
  | "Beans";

export const CROP_LIST: CropType[] = [
  "Rice",
  "Wheat",
  "Cotton",
  "Sugarcane",
  "Tomato",
  "Potato",
  "Onion",
  "Maize",
  "Soybean",
  "Groundnut",
  "Pepper",
  "Beans",
];

export interface DiseaseDetectionResult {
  diseaseName: string;
  severity: "Low" | "Medium" | "High" | "Healthy";
  confidence: number;
  infectionArea?: string;
  isStable?: boolean;
  description: string;
  remedies: string[];
  preventiveMeasures: string[];
  topPredictions?: { label: string; confidence: number }[];
}

