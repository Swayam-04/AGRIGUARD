import React, { useState, useEffect, useRef } from 'react';
import { Target, Zap, AlertTriangle, CheckCircle2, History, Trash2, ChevronRight, Activity, Cpu } from 'lucide-react';
import { WeedScene } from './WeedScene';

const IntegrationToggle = ({ label, modelName, state, onChange }: { label: string, modelName: string, state: 'SIMULATION' | 'REAL', onChange: (val: 'SIMULATION' | 'REAL') => void }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--emerald-500)', fontWeight: 500 }}>{modelName}</div>
      </div>
      <div style={{ display: 'flex', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)', marginTop: '0.25rem' }}>
        <button 
          onClick={() => onChange('SIMULATION')}
          style={{ 
            flex: 1, padding: '0.4rem', border: 'none', 
            backgroundColor: state === 'SIMULATION' ? 'var(--sky-600)' : 'transparent',
            color: state === 'SIMULATION' ? '#fff' : 'var(--text-muted)',
            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
          }}>
          SIMULATION DATA
        </button>
        <button 
          onClick={() => onChange('REAL')}
          style={{ 
            flex: 1, padding: '0.4rem', border: 'none', 
            backgroundColor: state === 'REAL' ? 'var(--emerald-600)' : 'transparent',
            color: state === 'REAL' ? '#fff' : 'var(--text-muted)',
            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
          }}>
          REAL-TIME HARDWARE
        </button>
      </div>
    </div>
  );
};

export const WeedManagementPage: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<'IDLE' | 'SCANNING' | 'LOCKING' | 'ERADICATING'>('IDLE');
  const [weedsDestroyed, setWeedsDestroyed] = useState(142);
  const [activeThreats, setActiveThreats] = useState(5);
  const [accuracy, setAccuracy] = useState(98.4);
  const [integrationStates, setIntegrationStates] = useState({
    classifier: 'SIMULATION' as 'SIMULATION' | 'REAL',
    detector: 'SIMULATION' as 'SIMULATION' | 'REAL',
    hardware: 'SIMULATION' as 'SIMULATION' | 'REAL'
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WeedScene | null>(null);

  useEffect(() => {
    if (containerRef.current && !sceneRef.current) {
      sceneRef.current = new WeedScene(containerRef.current);
      sceneRef.current.onWeedsCountChange = (count) => {
        setActiveThreats(count);
      };
    }
    return () => {
      if (sceneRef.current) {
        sceneRef.current.destroy();
        sceneRef.current = null;
      }
    };
  }, []);
  
  const [isAutonomous, setIsAutonomous] = useState(false);

  // Real 3D simulation for eradication cycle
  const triggerEradication = async () => {
    if (!sceneRef.current || isAutonomous) return;

    if (activeThreats === 0) {
      sceneRef.current.respawnWeeds();
      // Brief pause to let user see new weeds before attack starts
      await new Promise(r => setTimeout(r, 500));
    }
    
    setIsAutonomous(true);
    
    const runCycle = async () => {
      if (!sceneRef.current) return;
      
      setSystemStatus('SCANNING');
      // Small pause between targets
      await new Promise(r => setTimeout(r, 800));
      if (!sceneRef.current) return;

      setSystemStatus('LOCKING');
      
      // UI switch to eradicating midway
      const timerId = setTimeout(() => {
        if (sceneRef.current) setSystemStatus('ERADICATING');
      }, 1000); // adjusted for the new 90 step drive time

      await sceneRef.current.executeEradicationSequence();
      
      clearTimeout(timerId);
      setWeedsDestroyed(prev => prev + 1);
      
      if (sceneRef.current && sceneRef.current.getWeedCount() > 0) {
        // Continue if there are more weeds
        runCycle();
      } else {
        // Stop if all weeds are cleared
        setIsAutonomous(false);
        setSystemStatus('IDLE');
      }
    };

    runCycle();
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Target size={28} color="var(--amber-500)" />
          Precision Weed Eradication
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>
          Automatically detects weeds around plant roots and across the farming land. 
          Upon detection, it destroys the weed using a high-precision thermal laser—eliminating competing flora effortlessly without requiring any tough manual work.
        </p>
      </header>

      {/* Main Split Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Optical Targeting Canvas */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} />
              Optical Targeting Array
            </h2>
            <div style={{ 
              padding: '4px 10px', 
              borderRadius: '20px', 
              fontSize: '0.75rem', 
              fontWeight: 700,
              backgroundColor: systemStatus === 'ERADICATING' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: systemStatus === 'ERADICATING' ? 'var(--rose-500)' : 'var(--emerald-500)',
              border: `1px solid ${systemStatus === 'ERADICATING' ? 'var(--rose-500)' : 'var(--emerald-500)'}`
            }}>
              {systemStatus}
            </div>
          </div>
          
          <div style={{ 
            backgroundColor: '#05080f', 
            borderRadius: '8px', 
            flex: 1, 
            minHeight: '550px', 
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
            
            {/* Status Overlay */}
            {systemStatus === 'IDLE' && (
              <div style={{ position: 'absolute', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 10 }}>
                <ScanlineEffect />
              </div>
            )}
          </div>
        </div>

        {/* Control & Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Engagement Controls</h2>
            
            <button 
              onClick={triggerEradication}
              disabled={isAutonomous || systemStatus !== 'IDLE'}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: isAutonomous ? 'var(--emerald-500)' : (systemStatus === 'IDLE') ? 'var(--amber-500)' : 'var(--bg-subtle)',
                color: (isAutonomous || systemStatus === 'IDLE') ? '#000' : 'var(--text-disabled)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: (isAutonomous || systemStatus === 'IDLE') ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
            >
              <Zap size={20} />
              {isAutonomous ? 'AUTONOMOUS MODE ACTIVE' : activeThreats === 0 ? 'RESPAWN & START SIMULATION' : 'START AUTONOMOUS LASER'}
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center' }}>
              Requires safety clearance and target confidence {'>'} 95%
            </p>
          </div>

          <div className="card" style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Session Statistics</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <StatBox label="Weeds Destroyed" value={weedsDestroyed.toString()} icon={<Trash2 size={16} color="var(--emerald-500)" />} />
              <StatBox label="Active Threats" value={activeThreats.toString()} icon={<AlertTriangle size={16} color="var(--amber-500)" />} />
              <StatBox label="Target Accuracy" value={`${accuracy}%`} icon={<CheckCircle2 size={16} color="var(--sky-500)" />} />
              <StatBox label="Laser Temp" value={systemStatus === 'ERADICATING' ? '150°C' : 'Standby (150°C)'} icon={<Activity size={16} color={systemStatus === 'ERADICATING' ? 'var(--rose-500)' : 'var(--text-muted)'} />} />
            </div>
          </div>
          
          <div className="card">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={18} />
              AI & Hardware Integration
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <IntegrationToggle 
                label="Weed & Disease Classifier" 
                modelName="EfficientNet-B0 (15 Classes)" 
                state={integrationStates.classifier} 
                onChange={(val) => setIntegrationStates(p => ({...p, classifier: val}))} 
              />
              <IntegrationToggle 
                label="Optical Scene Detector" 
                modelName="SSDLite320 MobileNetV3" 
                state={integrationStates.detector} 
                onChange={(val) => setIntegrationStates(p => ({...p, detector: val}))} 
              />
              <IntegrationToggle 
                label="Robotics Pipeline" 
                modelName="ESP32 Telemetry & Serial" 
                state={integrationStates.hardware} 
                onChange={(val) => setIntegrationStates(p => ({...p, hardware: val}))} 
              />
            </div>
          </div>
          
        </div>
      </div>

      {/* History Log */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={18} />
          Eradication Log
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[1, 2, 3].map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: 'var(--bg-subtle)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Target size={16} color="var(--amber-500)" />
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Broadleaf Weed (Amaranthus)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Confidence: 98.7% &bull; Zone B4</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--emerald-500)', fontSize: '0.8rem', fontWeight: 600 }}>
                <CheckCircle2 size={14} />
                NEUTRALIZED
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safety Protocol */}
      <div className="card" style={{ marginTop: '1.5rem', backgroundColor: 'rgba(52, 211, 153, 0.05)', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--emerald-500)' }}>
          <CheckCircle2 size={18} />
          Crop Safety & Thermal Shielding Protocol
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
          <strong>Concern: Will a 150°C laser damage the main crop?</strong> No. The system utilizes <strong>Millimeter-Precision Targeting</strong> and <strong>Micro-Burst Thermal Pulses (0.1s duration)</strong>. The AI maps a strict digital exclusion boundary around the crop's stem and root system. A 150°C pulse is carefully calibrated—it is just enough to flash-boil the cellular water in the weed's meristem (growth center), rupturing its cells instantly without transferring lethal heat to the surrounding soil or crop roots.
        </p>
      </div>
    </div>
  );
};

const StatBox: React.FC<{ label: string, value: string, icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
      {icon}
      {label}
    </div>
    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
      {value}
    </div>
  </div>
);

const ScanlineEffect = () => (
  <div style={{ width: '100%', height: '2px', backgroundColor: 'rgba(52, 211, 153, 0.5)', boxShadow: '0 0 8px rgba(52, 211, 153, 0.8)', position: 'absolute', top: 0, animation: 'scan 2s linear infinite' }}>
    <style>
      {`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}
    </style>
  </div>
);
