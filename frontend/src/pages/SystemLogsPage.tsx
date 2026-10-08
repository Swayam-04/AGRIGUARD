import React, { useState, useEffect } from 'react';
import { Search, Filter, AlertTriangle, Info, ShieldAlert, Bug } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  component: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
  message: string;
}

// Generate some initial logs for the UI to be populated with 
// real backend logs via API or WebSocket eventually
const MOCK_LOGS: LogEntry[] = [
  { id: '1', timestamp: new Date(Date.now() - 12000).toISOString(), component: 'ESP32_BRIDGE', severity: 'INFO', message: 'WebSocket connection established on port 8000' },
  { id: '2', timestamp: new Date(Date.now() - 11500).toISOString(), component: 'CAMERA_SERVICE', severity: 'INFO', message: 'Physical camera powered ON and hardware resource claimed' },
  { id: '3', timestamp: new Date(Date.now() - 10000).toISOString(), component: 'ROBOT_CONTROL', severity: 'INFO', message: 'Mode switched to REAL_HARDWARE' },
  { id: '4', timestamp: new Date(Date.now() - 8000).toISOString(), component: 'AI_INFERENCE', severity: 'DEBUG', message: 'Model loaded: ag_model_v2_1.pt in 1.2s' },
  { id: '5', timestamp: new Date(Date.now() - 3000).toISOString(), component: 'SENSOR_POLL', severity: 'WARNING', message: 'NPK sensor response delayed (timeout 500ms)' },
];

export const SystemLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>(MOCK_LOGS);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  // In a real application, we would subscribe to a WebSocket topic for live logs.
  // We'll simulate receiving new logs occasionally.
  useEffect(() => {
    const interval = setInterval(() => {
      const newLog: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        component: 'SYSTEM',
        severity: 'INFO',
        message: 'Heartbeat OK'
      };
      setLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filterSeverity !== 'ALL' && log.severity !== filterSeverity) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase()) && !log.component.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'INFO': return 'var(--info)';
      case 'WARNING': return 'var(--warning)';
      case 'ERROR': return 'var(--danger)';
      case 'DEBUG': return 'var(--text-muted)';
      default: return 'var(--text-primary)';
    }
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'INFO': return <Info size={14} />;
      case 'WARNING': return <AlertTriangle size={14} />;
      case 'ERROR': return <ShieldAlert size={14} />;
      case 'DEBUG': return <Bug size={14} />;
      default: return <Info size={14} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>System Logs</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Real-time event stream and diagnostic logs.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input" 
              placeholder="Search logs..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', width: '220px' }}
            />
          </div>
          <select 
            className="input" 
            value={filterSeverity} 
            onChange={e => setFilterSeverity(e.target.value)}
            style={{ width: '120px' }}
          >
            <option value="ALL">All Levels</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
            <option value="DEBUG">DEBUG</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th style={{ padding: '10px 16px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, width: '180px' }}>TIMESTAMP</th>
                <th style={{ padding: '10px 16px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, width: '120px' }}>SEVERITY</th>
                <th style={{ padding: '10px 16px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, width: '180px' }}>COMPONENT</th>
                <th style={{ padding: '10px 16px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>MESSAGE</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                  <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: getSeverityColor(log.severity), background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.7rem' }}>
                      {getSeverityIcon(log.severity)}
                      {log.severity}
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {log.component}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>
                    {log.message}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No logs found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
