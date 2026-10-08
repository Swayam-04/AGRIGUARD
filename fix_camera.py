import re

def fix():
    filepath = 'frontend/src/components/CameraView.tsx'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the Throttled AI Auto-Sampler block
    old_block = """  // Throttled 2-5 FPS AI Auto-Sampler
  useEffect(() => {
    if (!autoScan || !isEnabled || isScanning) return;

    // 200ms = 5 inference FPS
    const timer = setInterval(() => {
      if (!isScanning && streamMode === 'direct') {
        const start = performance.now();
        const frame = captureFrameFromVideo();
        if (frame) {
          onTriggerScan(frame);
          const duration = Math.round(performance.now() - start);
          setLastInferenceMs(duration);
          setAiFps(2.5);
        }
      }
    }, 200);

    return () => clearInterval(timer);
  }, [autoScan, isEnabled, isScanning, streamMode, captureFrameFromVideo, onTriggerScan]);"""

    new_block = """  // Throttled 2-5 FPS AI Auto-Sampler
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
  }, [autoScan, isEnabled, isScanning, streamMode, captureFrameFromVideo, onTriggerScan]);"""

    if old_block in content:
        content = content.replace(old_block, new_block)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully updated CameraView.tsx auto-sampler block.")
    else:
        print("Could not find the block to replace!")

if __name__ == '__main__':
    fix()
