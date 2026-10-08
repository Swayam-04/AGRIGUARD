import re

def optimize():
    with open('FarmScene.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Renderer Optimizations
    content = content.replace("antialias: true", "antialias: false")
    content = content.replace("this.renderer.setPixelRatio(1);", "this.renderer.setPixelRatio(window.devicePixelRatio > 1 ? 0.8 : 1);")

    # 2. Geometry Optimizations
    content = content.replace("PlaneGeometry(this.fieldWidth + 12, this.fieldLength + 12, 32, 32)", "PlaneGeometry(this.fieldWidth + 12, this.fieldLength + 12, 1, 1)")
    content = content.replace("CylinderGeometry(0.016, 0.016, 32.0, 8)", "CylinderGeometry(0.016, 0.016, 32.0, 4)")
    content = content.replace("CylinderGeometry(0.035, 0.035, 1.6, 8)", "CylinderGeometry(0.035, 0.035, 1.6, 4)")
    content = content.replace("CylinderGeometry(0.07, 0.07, 1.25, 8)", "CylinderGeometry(0.07, 0.07, 1.25, 5)")
    content = content.replace("CylinderGeometry(0.9, 0.9, 2.2, 20)", "CylinderGeometry(0.9, 0.9, 2.2, 12)")
    content = content.replace("CylinderGeometry(2.0, 2.0, 7.0, 16, 1, true, 0, Math.PI)", "CylinderGeometry(2.0, 2.0, 7.0, 8, 1, true, 0, Math.PI)")
    content = content.replace("CylinderGeometry(0.15, 0.22, trH, 8)", "CylinderGeometry(0.15, 0.22, trH, 5)")
    content = content.replace("CylinderGeometry(0.022, 0.038, 0.95, 8)", "CylinderGeometry(0.022, 0.038, 0.95, 4)")
    content = content.replace("CylinderGeometry(0.008, 0.014, cfg.len, 6)", "CylinderGeometry(0.008, 0.014, cfg.len, 3)")
    content = content.replace("PlaneGeometry(leafW, leafL, 2, 2)", "PlaneGeometry(leafW, leafL, 1, 1)")
    content = content.replace("SphereGeometry(0.048, 8, 8)", "IcosahedronGeometry(0.048, 0)")
    
    with open('FarmScene.ts', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    optimize()
