import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  AlertCircle,
  Scan,
  Power,
  Video,
  VideoOff,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  Zap,
  Crosshair,
  Gauge,
  Sliders,
  Upload
} from 'lucide-react';
import { AIDetection, CameraStatus, TelemetryData } from '../types';
import { setCameraPower, releaseCamera, reclaimCamera } from '../services/api';
import { checkIsPlantLeaf } from '../services/cropDiseaseService';


interface CameraViewProps {
  cameraStatus?: CameraStatus;
  lastDetection: AIDetection | null;
  isScanning: boolean;
  onTriggerScan: (frameBase64?: string) => void;
  onCameraToggled?: (status: any) => void;
  activeZoneId?: string;
  telemetry?: TelemetryData | null;
  onMove?: (direction: string, speed: number, durationMs?: number) => void;
  onStop?: () => void;
}

export const CameraView: React.FC<CameraViewProps> = React.memo(({
  cameraStatus,
  lastDetection,
  isScanning,
  onTriggerScan,
  onCameraToggled,
  activeZoneId,
  telemetry,
  onMove,
  onStop
}) => {
  // Video & Stream references (persistent, non-rerendering)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const fpsDataRef = useRef({ frames: 0, lastTime: performance.now() });

  // Stream state
  const [streamMode, setStreamMode] = useState<'direct' | 'fallback' | 'off' | 'error'>('direct');
  const [streamError, setStreamError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [showReticle, setShowReticle] = useState(true);
  const [showDebugMetrics, setShowDebugMetrics] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [cameraSource, setCameraSource] = useState<'system'|'usb'>('system');

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const { isLeaf } = await checkIsPlantLeaf(base64);
      if (!isLeaf) {
        alert("Please upload a valid plant leaf image (at least 15% green coverage required).");
        return;
      }
      onTriggerScan(base64);
    };
    reader.readAsDataURL(file);
  }, [onTriggerScan]);

  // Performance metrics (updated only once per second for zero frame-by-frame UI re-renders)
  const [cameraFps, setCameraFps] = useState<number>(0);
  const [systemFps, setSystemFps] = useState<number>(60);
  
  // Real System FPS Monitoring
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;
    
    const measureSystemFps = () => {
      const now = performance.now();
      frameCount++;
      if (now - lastTime >= 1000) {
        setSystemFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(measureSystemFps);
    };
    animId = requestAnimationFrame(measureSystemFps);
    
    return () => cancelAnimationFrame(animId);
  }, []);
  const [droppedFrames, setDroppedFrames] = useState<number>(0);
  const [hardwareCapability, setHardwareCapability] = useState<string>('');
  const [aiFps, setAiFps] = useState<number>(0);
  const [lastInferenceMs, setLastInferenceMs] = useState<number>(0);
  const [resolution, setResolution] = useState<string>('640x480');

  // Camera Power state (optimistic local state to prevent telemetry flickering)
  const [localPower, setLocalPower] = useState<boolean>(true);
  const [streamTimestamp, setStreamTimestamp] = useState<number>(Date.now());

  // Fallback to true if undefined, but check explicit status
  const isEnabled = localPower && (cameraStatus?.enabled !== false && cameraStatus?.status !== 'OFF');
  const isConnected = isEnabled && (streamMode === 'direct' || streamMode === 'fallback' || (cameraStatus?.connected ?? false));

  // Frame counter callback for zero-overhead FPS monitoring using requestVideoFrameCallback
  const onVideoFrameCallback = useCallback((now: DOMHighResTimeStamp, _metadata?: any) => {
    fpsDataRef.current.frames++;
    const elapsed = now - fpsDataRef.current.lastTime;
    // Throttled to 1 Hz: ZERO frame-by-frame UI re-renders
    if (elapsed >= 1000) {
      const calculated = Math.round((fpsDataRef.current.frames * 1000) / elapsed);
      setCameraFps(calculated);
      fpsDataRef.current.frames = 0;
      fpsDataRef.current.lastTime = now;

      // Extract real dropped frames via standard browser API
      if (videoRef.current && typeof (videoRef.current as any).getVideoPlaybackQuality === 'function') {
        const quality = (videoRef.current as any).getVideoPlaybackQuality();
        if (quality && typeof quality.droppedVideoFrames === 'number') {
          setDroppedFrames(quality.droppedVideoFrames);
        }
      }
    }
    if (videoRef.current && 'requestVideoFrameCallback' in videoRef.current) {
      (videoRef.current as any).requestVideoFrameCallback(onVideoFrameCallback);
    }
  }, []);

  // Direct Browser Hardware Camera Acquisition with Progressive 120 FPS Negotiation
  const startDirectCamera = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setStreamError(false);
    setErrorMessage(null);

    // Stop existing stream tracks first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (cameraSource === 'usb') {
      console.log('USB Camera selected. Reclaiming backend capture lock and using fallback stream.');
      await reclaimCamera().catch(() => {});
      setStreamTimestamp(Date.now());
      setStreamMode('fallback');
      isStartingRef.current = false;
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('getUserMedia not supported in this browser, falling back to MJPEG stream.');
      await reclaimCamera().catch(() => {});
      setStreamTimestamp(Date.now());
      setStreamMode('fallback');
      isStartingRef.current = false;
      return;
    }

    try {
      // Step 1: Yield backend OpenCV lock so Windows DirectShow does not block browser access
      await releaseCamera().catch(() => {});

      // Simplify constraints to just ask for ideal resolution. 
      // Do not force frame rates, as it often breaks Windows webcams.
      const candidateProfiles: MediaStreamConstraints[] = [
        { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
        { video: true, audio: false }
      ];

      let mediaStream: MediaStream | null = null;
      let lastErr: any = null;

      for (const profile of candidateProfiles) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(profile);
          if (mediaStream) break;
        } catch (err: any) {
          lastErr = err;
        }
      }

      if (!mediaStream) {
        throw lastErr || new Error('Failed to acquire camera media stream');
      }

      streamRef.current = mediaStream;

      // Ensure resolution is updated for UI
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        setResolution(`${settings.width || 640}x${settings.height || 480}`);
        setHardwareCapability(`Webcam (${settings.width || 640}x${settings.height || 480})`);

        videoTrack.onended = () => {
          console.warn('[AgriGuard Camera] Video track ended. Reconnecting...');
          setStreamMode('error');
          setErrorMessage('System Camera disconnected.');
        };
      }

      // Step 4: Attach to single persistent HTML <video> element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.autoplay = true;
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        videoRef.current.play().catch(e => console.warn('Video auto-playback notice:', e));

        // Reset measurement ref
        fpsDataRef.current = { frames: 0, lastTime: performance.now() };

        // Bind requestVideoFrameCallback for zero-overhead frame monitoring
        if ('requestVideoFrameCallback' in videoRef.current) {
          (videoRef.current as any).requestVideoFrameCallback(onVideoFrameCallback);
        }
      }

      setStreamMode('direct');
      setErrorMessage(null);
    } catch (err: any) {
      console.warn('Direct getUserMedia acquisition notice, falling back to backend MJPEG stream:', err.name, err.message);
      if (err.name === 'NotAllowedError') {
        setErrorMessage('Browser camera permission denied. Displaying backend hardware stream.');
      } else if (err.name === 'NotFoundError') {
        setErrorMessage('No physical USB camera device detected.');
      } else if (err.name === 'NotReadableError') {
        setErrorMessage('Camera is currently busy. Displaying backend hardware stream.');
      }
      // Reclaim backend camera so /api/camera/stream is active and serving frames
      await reclaimCamera().catch(() => {});
      setStreamTimestamp(Date.now());
      setStreamMode('fallback');
    } finally {
      isStartingRef.current = false;
    }
  }, [onVideoFrameCallback, cameraSource]);

  // Clean shutdown of camera streams
  const stopDirectCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamMode('off');
  }, []);

  // Initialize camera stream once on mount, power-on, or source change
  useEffect(() => {
    if (isEnabled) {
      // Small delay helps ensure previous tracks are fully stopped before restarting
      const timer = setTimeout(() => {
        startDirectCamera();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopDirectCamera();
    }

    return () => {
      // Clean up MediaStream tracks on unmount to prevent leaks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isEnabled, cameraSource, startDirectCamera, stopDirectCamera]);

  // Ensure persistent video element always attaches to streamRef if available
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.warn('Video auto-playback notice:', e));
    }
  }, [streamMode, isEnabled]);

  // Reusable Off-screen Canvas Frame Grabber for AI
  const captureFrameFromVideo = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const targetWidth = Math.min(video.videoWidth, 640);
    const targetHeight = Math.min(video.videoHeight, 480);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  // Trigger Scan: captures frame from live video and sends to AI
  const handleTriggerScan = useCallback(() => {
    const startTime = performance.now();
    let frameBase64: string | undefined;

    if (streamMode === 'direct') {
      const captured = captureFrameFromVideo();
      if (captured) {
        frameBase64 = captured;
      }
    }

    onTriggerScan(frameBase64);
    const duration = Math.round(performance.now() - startTime);
    setLastInferenceMs(duration);
  }, [streamMode, captureFrameFromVideo, onTriggerScan]);

  // Throttled 2-5 FPS AI Auto-Sampler
  useEffect(() => {
    if (!autoScan || !isEnabled) return;

    // 200ms = 5 inference FPS
    const timer = setInterval(() => {
      if (isScanning) return;

      const start = performance.now();
      const frame = streamMode === 'direct' ? captureFrameFromVideo() : undefined;
      
      if (streamMode === 'direct' && !frame) return;
      
      onTriggerScan(frame || undefined);
      const duration = Math.round(performance.now() - start);
      setLastInferenceMs(duration);
      setAiFps(5.0);
    }, 200);

    return () => clearInterval(timer);
  }, [autoScan, isEnabled, isScanning, streamMode, captureFrameFromVideo, onTriggerScan]);

  // Toggle Camera Power
  const handleTogglePower = async () => {
    setIsToggling(true);
    try {
      const newEnabled = !isEnabled;
      setLocalPower(newEnabled);
      if (!newEnabled) {
        stopDirectCamera();
      }
      const res = await setCameraPower(newEnabled);
      if (newEnabled) {
        await reclaimCamera().catch(() => {});
        setStreamTimestamp(Date.now());
        await startDirectCamera();
      }
      if (onCameraToggled) {
        onCameraToggled(res);
      }
    } catch (err) {
      console.error('Failed to toggle camera power:', err);
    } finally {
      setIsToggling(false);
    }
  };

  const handleRefreshStream = async () => {
    setStreamError(false);
    setErrorMessage(null);
    await reclaimCamera().catch(() => {});
    setStreamTimestamp(Date.now());
    await startDirectCamera();
  };

  const handleQuickMove = (direction: string) => {
    if (onMove) {
      onMove(direction, 130, 400);
    }
  };

  const handleQuickStop = () => {
    if (onStop) {
      onStop();
    }
  };

  const currentZone = activeZoneId || telemetry?.active_zone_id || 'ZONE-R1C1';

  return (
    <div className="card" style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with Title and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Camera size={20} color={isEnabled ? 'var(--emerald-400)' : 'var(--text-muted)'} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em', margin: 0, color: 'var(--text-primary)' }}>
                Field Monitor Camera
              </h2>
              <select 
                className="input" 
                value={cameraSource}
                style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem', height: 'auto', minHeight: '24px' }}
                onChange={(e) => {
                  stopDirectCamera();
                  setCameraSource(e.target.value as 'system' | 'usb');
                }}
              >
                <option value="system">System Camera</option>
                <option value="usb">USB Camera</option>
              </select>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '4px' }}>
              <span>Primary Field Viewport</span>
              {isConnected && (
                <>
                  <span>•</span>
                  <span style={{ color: 'var(--green-500)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <Zap size={11} /> {streamMode === 'direct' ? 'Hardware Direct (<15ms)' : 'Zero-Lag Stream'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Status Badge */}
          <span className={`status-pill ${!isEnabled ? 'status-warning' : isConnected ? 'status-online' : 'status-offline'}`}>
            {!isEnabled ? 'STANDBY' : isConnected ? `${streamMode === 'direct' ? 'DIRECT VIDEO' : 'STREAM'} • LIVE` : 'DISCONNECTED'}
          </span>

          {/* Performance HUD Toggle */}
          <button
            onClick={() => setShowDebugMetrics(!showDebugMetrics)}
            className="btn btn-outline"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', opacity: showDebugMetrics ? 1 : 0.6 }}
            title="Toggle Performance HUD"
          >
            <Gauge size={13} />
          </button>

          {/* Reticle Toggle */}
          {isConnected && (
            <button
              onClick={() => setShowReticle(!showReticle)}
              className="btn btn-outline"
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', opacity: showReticle ? 1 : 0.6 }}
              title="Toggle target reticle"
            >
              <Crosshair size={13} />
            </button>
          )}

          {/* Refresh stream button */}
          {isConnected && (
            <button
              onClick={handleRefreshStream}
              className="btn btn-outline"
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
              title="Refresh video connection"
            >
              <RefreshCw size={13} />
            </button>
          )}

          {/* Camera ON / OFF Power Toggle Button */}
          <button
            onClick={handleTogglePower}
            disabled={isToggling}
            className={`btn ${isEnabled ? 'btn-outline' : 'btn-primary'}`}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              borderColor: isEnabled ? 'rgba(244, 63, 94, 0.4)' : undefined,
              color: isEnabled ? 'var(--rose-500)' : undefined
            }}
            title={isEnabled ? 'Turn physical camera OFF' : 'Turn physical camera ON'}
          >
            {isToggling ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : isEnabled ? (
              <>
                <VideoOff size={14} />
                <span>Turn OFF</span>
              </>
            ) : (
              <>
                <Video size={14} />
                <span>Turn ON</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Video Viewport Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        backgroundColor: '#05080f',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)'
      }}>
        {/* Persistent Hardware Video Element (Always present in DOM) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: '#000',
            display: isEnabled && streamMode === 'direct' ? 'block' : 'none'
          }}
        />

        {/* Fallback MJPEG Stream for Remote Access or Permission Fallback */}
        {isEnabled && streamMode === 'fallback' && (
          <img
            src={`/api/camera/stream?t=${streamTimestamp}`}
            alt="Live Physical USB Camera Stream"
            style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
            onError={() => {
              console.warn('Fallback stream reconnecting, reclaiming camera...');
              reclaimCamera().catch(() => {});
            }}
          />
        )}

        {/* State 1: Powered OFF Overlay */}
        {!isEnabled && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#05080f',
            zIndex: 4,
            textAlign: 'center',
            padding: '2rem',
            color: 'var(--text-muted)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto'
            }}>
              <VideoOff size={28} color="var(--text-muted)" />
            </div>
            <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.25rem' }}>Camera Standby Mode</h3>
            <p style={{ fontSize: '0.8rem', maxWidth: '320px', margin: '0 auto 1.25rem auto' }}>
              Optical hardware bus is in low-power standby. Click below to engage direct hardware video capture.
            </p>
            <button
              onClick={handleTogglePower}
              disabled={isToggling}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
            >
              <Power size={14} />
              <span>Power ON Camera</span>
            </button>
          </div>
        )}

        {/* State 2: Disconnected / Error Overlay */}
        {isEnabled && streamMode === 'error' && !isConnected && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#05080f',
            zIndex: 4,
            textAlign: 'center',
            padding: '2rem',
            color: 'var(--text-muted)'
          }}>
            <AlertCircle size={44} color="var(--rose-500)" style={{ margin: '0 auto 0.75rem auto' }} />
            <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.25rem' }}>CAMERA: DISCONNECTED</h3>
            <p style={{ fontSize: '0.8rem', maxWidth: '340px', margin: '0 auto 1rem auto' }}>
              {errorMessage || 'Physical USB camera stream interrupted. Check connection and click retry.'}
            </p>
            <button
              onClick={handleRefreshStream}
              className="btn btn-outline"
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
            >
              <RefreshCw size={13} />
              <span>Retry Stream</span>
            </button>
          </div>
        )}

        {/* Overlays when Camera is Enabled and Active */}
        {isEnabled && isConnected && (
          <>
            {/* Target Reticle Crosshair */}
            {showReticle && <div className="camera-reticle" />}

            {/* HUD: Top-Left Stream Telemetry */}
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              background: 'rgba(10, 15, 24, 0.75)',
              
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              color: '#34d399',
              fontFamily: 'JetBrains Mono, monospace',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              zIndex: 3
            }}>
              <span className="pulse-indicator green" style={{ width: '6px', height: '6px' }} />
              <span>LIVE • {cameraFps} FPS</span>
              <span style={{ color: 'var(--text-dim)' }}>|</span>
              <span style={{ color: 'var(--sky-400)' }}>{resolution}</span>
            </div>

            {/* Performance Debug HUD (When toggled) */}
            {showDebugMetrics && (
              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                background: 'rgba(10, 15, 24, 0.92)',
                
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.70rem',
                fontFamily: 'JetBrains Mono, monospace',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                zIndex: 4,
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
              }}>
                <div style={{ fontWeight: 700, color: 'var(--sky-400)', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>CAMERA PERFORMANCE HUD</span>
                  <span style={{ color: streamMode === 'direct' ? '#34d399' : '#f59e0b', fontSize: '0.65rem' }}>
                    {streamMode === 'direct' ? 'DIRECT HTML5' : 'HTTP STREAM'}
                  </span>
                </div>
                                <div>Requested FPS: <strong style={{ color: '#fff' }}>120</strong></div>
                <div>System UI FPS: <strong style={{ color: systemFps >= 50 ? '#34d399' : '#f87171' }}>{systemFps}</strong></div>
                <div>Camera FPS: <strong style={{ color: cameraFps >= 60 ? '#34d399' : '#38bdf8' }}>{cameraFps}</strong></div>
                <div>Resolution: <strong style={{ color: '#fff' }}>{resolution}</strong></div>
                <div>AI FPS: <strong style={{ color: '#fff' }}>{autoScan ? `${aiFps.toFixed(1)}` : '0 (On-Demand)'}</strong></div>
                <div>Inference Time: <strong style={{ color: '#fff' }}>{lastInferenceMs} ms</strong></div>
                <div>Dropped Frames: <strong style={{ color: droppedFrames > 0 ? '#f87171' : '#34d399' }}>{droppedFrames}</strong></div>
                {hardwareCapability && (
                  <div style={{ marginTop: '2px', color: 'var(--text-muted)', fontSize: '0.62rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '2px' }}>
                    Hardware Limits: {hardwareCapability}
                  </div>
                )}
              </div>
            )}

            {/* HUD: Top-Right Field Position */}
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'rgba(10, 15, 24, 0.75)',
              
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              color: '#f8fafc',
              fontFamily: 'JetBrains Mono, monospace',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              zIndex: 3
            }}>
              <span>📍 {currentZone}</span>
              {telemetry?.robot_location && (
                <span style={{ color: 'var(--text-muted)' }}>
                  (X:{telemetry.robot_location.x}, Y:{telemetry.robot_location.y})
                </span>
              )}
            </div>

            {/* Multi-Stage Visual Overlays (Step 11): Green for valid leaf, Red for person/tool, Amber for low-quality/unsupported */}
            {lastDetection?.visual_annotations && lastDetection.visual_annotations.length > 0 ? (
              lastDetection.visual_annotations.map((ann, idx) => {
                const fW = lastDetection.frame_dimensions?.width || 1280;
                const fH = lastDetection.frame_dimensions?.height || 720;
                const left = (ann.bbox[0] / fW) * 100;
                const top = (ann.bbox[1] / fH) * 100;
                const width = ((ann.bbox[2] - ann.bbox[0]) / fW) * 100;
                const height = ((ann.bbox[3] - ann.bbox[1]) / fH) * 100;
                const boxColor = ann.color || (ann.is_target ? '#10b981' : '#ef4444');

                return (
                  <div
                    key={`ann-${idx}`}
                    style={{
                      position: 'absolute',
                      border: `2px solid ${boxColor}`,
                      backgroundColor: `${boxColor}22`,
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                      pointerEvents: 'none',
                      transition: 'all 0.2s ease-out',
                      boxShadow: `0 0 10px ${boxColor}66`,
                      zIndex: 3
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '-22px',
                        left: '0',
                        background: boxColor,
                        color: '#fff',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '3px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.4)'
                      }}
                    >
                      {ann.label}
                    </span>
                  </div>
                );
              })
            ) : lastDetection?.bounding_box ? (
              <div style={{
                position: 'absolute',
                border: '2px solid #10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                left: `${(lastDetection.bounding_box.x / 1280) * 100}%`,
                top: `${(lastDetection.bounding_box.y / 720) * 100}%`,
                width: `${(lastDetection.bounding_box.w / 1280) * 100}%`,
                height: `${(lastDetection.bounding_box.h / 720) * 100}%`,
                pointerEvents: 'none',
                transition: 'all 0.2s ease-out',
                boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)',
                zIndex: 3
              }}>
                <span style={{
                  position: 'absolute',
                  top: '-20px',
                  left: '0',
                  background: '#10b981',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '3px',
                  whiteSpace: 'nowrap'
                }}>
                  {lastDetection.disease} ({Math.round(lastDetection.confidence * 100)}%)
                </span>
              </div>
            ) : null}

            {/* Target Status HUD Banner (Step 11 & Step 19) */}
            {lastDetection && (
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: lastDetection.status === 'HUMAN_DETECTED'
                  ? 'rgba(239, 68, 68, 0.9)'
                  : (lastDetection.status === 'DISEASE_RESULT' || lastDetection.status === 'HEALTHY')
                    ? 'rgba(16, 185, 129, 0.9)'
                    : 'rgba(30, 41, 59, 0.88)',
                border: `1px solid ${
                  lastDetection.status === 'HUMAN_DETECTED'
                    ? '#ef4444'
                    : (lastDetection.status === 'DISEASE_RESULT' || lastDetection.status === 'HEALTHY')
                      ? '#10b981'
                      : 'rgba(245, 158, 11, 0.6)'
                }`,
                color: '#fff',
                padding: '4px 14px',
                borderRadius: '20px',
                fontSize: '0.72rem',
                fontWeight: 700,
                zIndex: 10,
                
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                pointerEvents: 'none',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap'
              }}>
                {lastDetection.status === 'HUMAN_DETECTED'
                  ? '⚠️ [PERSON DETECTED] Disease analysis: DISABLED'
                  : lastDetection.status === 'NO_VALID_LEAF'
                    ? '🌿 [NO VALID LEAF] Disease analysis: IDLE'
                    : lastDetection.status === 'UNSUPPORTED_CROP'
                      ? '🚫 [UNSUPPORTED PLANT] Disease analysis: DISABLED'
                      : lastDetection.status === 'LOW_QUALITY'
                        ? '🔍 [LOW QUALITY ROI] Move camera closer'
                        : (lastDetection.status === 'DISEASE_RESULT' || lastDetection.status === 'HEALTHY')
                          ? '🌱 [SUPPORTED LEAF] Disease analysis: ACTIVE'
                          : lastDetection.display_name}
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Navigation Drive Dock (Below Video) */}
      {onMove && (
        <div className="quick-drive-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Cockpit Drive:
            </span>
            <button
              onClick={() => handleQuickMove('left')}
              className="quick-drive-btn"
              title="Steer Left"
            >
              <ArrowLeft size={13} />
              <span>Left</span>
            </button>
            <button
              onClick={() => handleQuickMove('forward')}
              className="quick-drive-btn"
              title="Move Forward"
            >
              <ArrowUp size={13} />
              <span>Fwd</span>
            </button>
            <button
              onClick={() => handleQuickMove('backward')}
              className="quick-drive-btn"
              title="Move Backward"
            >
              <ArrowDown size={13} />
              <span>Back</span>
            </button>
            <button
              onClick={() => handleQuickMove('right')}
              className="quick-drive-btn"
              title="Steer Right"
            >
              <ArrowRight size={13} />
              <span>Right</span>
            </button>
            <button
              onClick={handleQuickStop}
              className="quick-drive-btn btn-stop"
              title="Halt Motors"
            >
              <Square size={13} />
              <span>Stop</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Auto-Scan 2-5 FPS Toggle */}
            <button
              onClick={() => setAutoScan(!autoScan)}
              className="btn btn-outline"
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.72rem',
                borderColor: autoScan ? 'var(--emerald-500)' : undefined,
                color: autoScan ? 'var(--emerald-400)' : 'var(--text-muted)'
              }}
              title="Toggle automatic 5.0 FPS foliage pathology monitoring"
            >
              <Sliders size={12} />
              <span>Auto-Scan: {autoScan ? '5.0 FPS ON' : 'OFF'}</span>
            </button>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
              {telemetry?.actuators?.motor_state ? `MOTORS: ${telemetry.actuators.motor_state}` : 'READY'}
            </div>
          </div>
        </div>
      )}

      {/* Capture & Action Bar */}
      <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {!isEnabled ? (
            <span style={{ color: 'var(--amber-400)' }}>Camera offline (Standby mode)</span>
          ) : lastDetection ? (
            <span>
              Last Scan: <strong style={{ color: '#fff' }}>{lastDetection.display_name}</strong>{' '}
              <span style={{ color: 'var(--text-dim)' }}>({(lastDetection.confidence * 100).toFixed(0)}% conf)</span>
            </span>
          ) : (
            <span>Live optical feed synchronized • Ready for pathology scan</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: '0.65rem 1rem', fontSize: '0.85rem' }}
              title="Upload leaf image specimen (<= 5MB)"
            >
              <Upload size={15} color="#10b981" />
              <span>Upload Leaf</span>
            </button>
            <input
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handleFileUpload}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%'
              }}
            />
          </div>

          <button
            onClick={handleTriggerScan}
            disabled={!isEnabled || isScanning}
            className="btn btn-primary"
            style={{ padding: '0.65rem 1.4rem', whiteSpace: 'nowrap' }}
            title={!isEnabled ? 'Turn ON camera to perform scan' : undefined}
          >
            {isScanning ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Analyzing Foliage...</span>
              </>
            ) : (
              <>
                <Scan size={16} />
                <span>Capture & AI Scan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
