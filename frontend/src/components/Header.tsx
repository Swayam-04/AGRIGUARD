/**
 * Header.tsx — Legacy compatibility shim.
 * The main navigation is now handled by SidebarNav + TopBar.
 * This file is kept to avoid breaking imports in case it's referenced elsewhere.
 * It renders nothing — SidebarNav and TopBar provide all header/nav functionality.
 */
import React from 'react';
import { TelemetryData } from '../types';

interface HeaderProps {
  telemetry?: TelemetryData | null;
  wsConnected?: boolean;
  activeTab?: any;
  setActiveTab?: (tab: any) => void;
  onEmergencyStop?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  // Navigation is now handled by SidebarNav and TopBar.
  return null;
};
