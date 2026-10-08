import React, { useState, useCallback, useRef } from 'react';
import { Microscope, Upload, Loader2, AlertCircle, ShieldCheck, Pill, Shield, Camera, X } from 'lucide-react';
import { CROP_LIST, CropType, DiseaseDetectionResult } from '../types';
import {
  CROP_EMOJI,
  checkIsPlantLeaf,
  detectCropDisease
} from '../services/cropDiseaseService';
import { NearbyAgroStores } from '../components/NearbyAgroStores';

export const DiseaseDetectPage: React.FC = () => {
  const [cropType, setCropType] = useState<CropType>('Tomato');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiseaseDetectionResult | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Camera Handling (facingMode environment for field smartphones/webcams)
  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError('Camera access denied or device not found. Please check browser permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const captureImage = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.92);
        setImagePreview(imageData);
        stopCamera();
        setResult(null);
        setError(null);
      }
    }
  };

  // 2. Dual Input Modality: File Upload with 5MB & JPG/PNG validation
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size exceeds 5MB limit');
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        setError('Only JPG/PNG formats are supported');
        return;
      }

      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // 3. Fast Pre-Validation & AI Inference
  const handleAnalyze = async () => {
    if (!imagePreview || result) return;
    setLoading(true);
    setError(null);

    // Heuristic Pre-Validation Layer (Leaf & Skin tone ratio check)
    const { isLeaf, confidence } = await checkIsPlantLeaf(imagePreview);

    if (!isLeaf) {
      setLoading(false);
      setError('Please upload a valid plant leaf image');
      return;
    }

    if (confidence < 60) {
      setLoading(false);
      setError('Uncertain result – Please retake image');
      return;
    }

    try {
      const res = await detectCropDisease(cropType, imagePreview);
      setResult(res);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'An error occurred during pathology analysis');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadgeStyle = (severity: string) => {
    switch (severity) {
      case 'Healthy':
      case 'Low':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.35)'
        };
      case 'Medium':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.35)'
        };
      case 'High':
      default:
        return {
          bg: 'rgba(244, 63, 94, 0.15)',
          color: '#f43f5e',
          border: '1px solid rgba(244, 63, 94, 0.35)'
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Page Header */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #16a34a, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(22, 163, 74, 0.4)'
              }}
            >
              <Microscope size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Crop Disease AI Diagnostics
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Dual-modality leaf pathology detection with instant client pre-validation and treatment decisions
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399'
            }}
          >
            ● VISION ENGINE READY
          </span>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '1.5rem',
          alignItems: 'start'
        }}
      >
        {/* LEFT COLUMN: Input Panel */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              Foliage Sample Input
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Select target crop, capture via camera, or upload a leaf photograph (&le; 5MB)
            </p>
          </div>

          {/* Crop Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Target Crop Variety:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
              {CROP_LIST.map((crop) => {
                const isSelected = cropType === crop;
                return (
                  <button
                    key={crop}
                    type="button"
                    onClick={() => {
                      setCropType(crop);
                      setResult(null);
                    }}
                    style={{
                      padding: '0.5rem 0.4rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                      cursor: 'pointer',
                      border: isSelected
                        ? '1px solid #16a34a'
                        : '1px solid var(--border-subtle)',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(22, 163, 74, 0.25), rgba(5, 150, 105, 0.15))'
                        : 'rgba(255, 255, 255, 0.02)',
                      color: isSelected ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>{CROP_EMOJI[crop] || '🌱'}</span>
                    <span>{crop}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Alert Banner */}
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                color: '#f43f5e',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>Pre-Validation Notice</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Dual Input Modality Controls */}
          {!imagePreview && !isCameraOpen && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={startCamera}
                className="btn btn-outline"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem'
                }}
              >
                <Camera size={16} color="#16a34a" />
                <span>Live Camera</span>
              </button>

              <div style={{ position: 'relative', flex: 1 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <Upload size={16} color="#16a34a" />
                  <span>Upload Image</span>
                </button>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleImageUpload}
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
            </div>
          )}

          {/* Dotted Dropzone Viewport */}
          <div
            style={{
              border: '2px dashed var(--border-subtle)',
              borderRadius: '12px',
              minHeight: '240px',
              backgroundColor: 'rgba(5, 8, 15, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {isCameraOpen ? (
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '280px', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '1rem',
                    padding: '0 1rem'
                  }}
                >
                  <button
                    type="button"
                    onClick={captureImage}
                    title="Capture Foliage Snapshot"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: '#16a34a',
                      color: '#fff',
                      border: '2px solid #fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 16px rgba(22, 163, 74, 0.6)'
                    }}
                  >
                    <Microscope size={22} />
                  </button>

                  <button
                    type="button"
                    onClick={stopCamera}
                    title="Cancel Camera"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'rgba(244, 63, 94, 0.9)',
                      color: '#fff',
                      border: '2px solid #fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            ) : imagePreview ? (
              <div style={{ padding: '1rem', textAlign: 'center', width: '100%' }}>
                <img
                  src={imagePreview}
                  alt="Leaf specimen"
                  style={{
                    maxHeight: '220px',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    margin: '0 auto',
                    display: 'block'
                  }}
                />
                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setResult(null);
                      setError(null);
                    }}
                    className="btn btn-outline"
                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem', color: '#f43f5e' }}
                  >
                    Retake / Clear
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Microscope size={36} color="var(--text-dim)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
                <p style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  No foliage specimen loaded
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Use the camera or upload buttons above to feed a leaf sample
                </p>
              </div>
            )}
          </div>

          {/* Analyze Button */}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!imagePreview || loading}
            className="btn btn-primary"
            style={{
              padding: '0.85rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #16a34a, #059669)',
              borderRadius: '10px'
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Validating & Diagnosing Foliage...</span>
              </>
            ) : (
              <>
                <Microscope size={18} />
                <span>Analyze Crop Disease</span>
              </>
            )}
          </button>
        </div>

        {/* RIGHT COLUMN: Results Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {result ? (
            <>
              {/* Main Pathology Diagnosis Card with Left Accent Border */}
              <div
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  borderLeft: `4px solid ${result.severity === 'Healthy' ? '#10b981' : '#ef4444'}`,
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}
              >
                {/* Header with Title and Badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {result.severity === 'Healthy' ? (
                      <ShieldCheck size={24} color="#10b981" />
                    ) : (
                      <AlertCircle size={24} color="#ef4444" />
                    )}
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                        {result.diseaseName}
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Target Crop: <strong>{cropType}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Stability & Severity Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {result.isStable !== undefined && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: result.isStable ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          border: `1px solid ${result.isStable ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                          color: result.isStable ? '#34d399' : '#fbbf24'
                        }}
                      >
                        {result.isStable ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
                        <span>{result.isStable ? 'Stable Prediction' : 'Uncertain Prediction'}</span>
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '999px',
                        ...getSeverityBadgeStyle(result.severity)
                      }}
                    >
                      {result.severity.toUpperCase()} RISK
                    </span>
                  </div>
                </div>

                {/* Top-2 Predictions Ranked Progress Bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Ranked Inference Confidence (Top-2):
                  </span>
                  {result.topPredictions && result.topPredictions.length > 0 ? (
                    result.topPredictions.slice(0, 2).map((pred, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <span style={{ fontWeight: idx === 0 ? 700 : 500, color: idx === 0 ? '#fff' : 'var(--text-muted)' }}>
                            {idx + 1}. {pred.label}
                          </span>
                          <span className="mono" style={{ fontWeight: 700, color: idx === 0 ? '#34d399' : 'var(--text-muted)' }}>
                            {Math.round(pred.confidence * 100)}%
                          </span>
                        </div>
                        <div
                          style={{
                            height: '8px',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: '999px',
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, Math.round(pred.confidence * 100))}%`,
                              borderRadius: '999px',
                              background: idx === 0 ? '#10b981' : 'rgba(16, 185, 129, 0.4)',
                              boxShadow: idx === 0 ? '0 0 10px rgba(16, 185, 129, 0.4)' : undefined,
                              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ fontWeight: 700, color: '#fff' }}>1. {result.diseaseName}</span>
                        <span className="mono" style={{ fontWeight: 700, color: '#34d399' }}>
                          {Math.round(result.confidence * 100)}%
                        </span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${result.confidence * 100}%`, background: '#10b981', borderRadius: '999px' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Leaf Infection Area Metric Box */}
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Estimated Foliage Lesion Area:</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color:
                        result.severity === 'High'
                          ? '#f43f5e'
                          : result.severity === 'Medium'
                            ? '#fbbf24'
                            : '#34d399'
                    }}
                  >
                    {result.infectionArea || '0%'}
                  </span>
                </div>

                {/* Pathology Description */}
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                  {result.description}
                </p>
              </div>

              {/* Treatment Prescriptions Card */}
              {result.severity !== 'Healthy' && result.remedies.length > 0 && (
                <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <Pill size={18} color="#38bdf8" />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                      Targeted Chemical Prescriptions & Remedies
                    </h4>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {result.remedies.map((remedy, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.83rem', color: 'var(--text-main)' }}>
                        <ShieldCheck size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{remedy}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preventive Measures Card */}
              <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <Shield size={18} color="#10b981" />
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                    {result.severity === 'Healthy' ? 'Healthy Canopy Maintenance Schedule' : 'Agronomic Preventive Measures'}
                  </h4>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {result.preventiveMeasures.map((measure, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.83rem', color: 'var(--text-main)' }}>
                      <ShieldCheck size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{measure}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Nearby Agro Stores (Shown if severe or diseased) */}
              {result.severity !== 'Healthy' && (
                <NearbyAgroStores treatmentKeywords={result.remedies || []} />
              )}
            </>
          ) : (
            /* Awaiting Diagnosis State */
            <div
              className="glass-panel"
              style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '360px'
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(22, 163, 74, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  border: '1px solid rgba(22, 163, 74, 0.2)'
                }}
              >
                <Microscope size={28} color="#16a34a" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.35rem' }}>
                Awaiting Specimen Analysis
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '340px', lineHeight: 1.5 }}>
                Provide a high-resolution leaf photograph using the live camera or upload file input on the left to generate pathology scores, top predictions, and store recommendations.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
