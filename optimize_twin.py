import re

def optimize():
    filepath = 'frontend/src/digitalTwin/TwinScene.ts'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Disable antialias
    content = content.replace("antialias: true", "antialias: false, powerPreference: 'high-performance'")
    
    # Lower pixel ratio
    content = content.replace("this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));", "this.renderer.setPixelRatio(window.devicePixelRatio > 1 ? 0.8 : 1);")
    
    # Disable heavy shadows
    content = content.replace("this.renderer.shadowMap.enabled = true;", "this.renderer.shadowMap.enabled = false;")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    optimize()
