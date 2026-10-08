import re

def update_camera():
    filepath = 'frontend/src/components/CameraView.tsx'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Automatic object detection startup
    content = content.replace("const [autoScan, setAutoScan] = useState(false);", "const [autoScan, setAutoScan] = useState(true);")

    # 2. System FPS calculation state & effect
    # We will inject this right after cameraFps
    fps_hook = """  const [cameraFps, setCameraFps] = useState<number>(0);
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
  }, []);"""
    
    content = content.replace("  const [cameraFps, setCameraFps] = useState<number>(0);", fps_hook)

    # 3. Detection performance optimization & Smooth camera experience (5 FPS instead of 2.5)
    content = content.replace("400ms = 2.5 inference FPS", "200ms = 5 inference FPS")
    content = content.replace("}, 400);", "}, 200);")
    content = content.replace("2.5 FPS ON", "5.0 FPS ON")
    content = content.replace("automatic 2.5 FPS", "automatic 5.0 FPS")

    # 4. Add System FPS to debug UI
    ui_block = """                <div>Requested FPS: <strong style={{ color: '#fff' }}>120</strong></div>
                <div>System UI FPS: <strong style={{ color: systemFps >= 50 ? '#34d399' : '#f87171' }}>{systemFps}</strong></div>
                <div>Camera FPS: <strong style={{ color: cameraFps >= 60 ? '#34d399' : '#38bdf8' }}>{cameraFps}</strong></div>"""
    
    content = content.replace(
        "<div>Requested FPS: <strong style={{ color: '#fff' }}>120</strong></div>\n                <div>Actual FPS: <strong style={{ color: cameraFps >= 60 ? '#34d399' : '#38bdf8' }}>{cameraFps}</strong></div>",
        ui_block
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    update_camera()
