import re

def revert_colors():
    filepath = 'frontend/src/simulator/SimulatedViewPage.tsx'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Revert text colors
    content = content.replace("color: 'var(--text-primary)'", "color: '#ffffff'")
    content = content.replace("color: 'var(--text-muted)'", "color: '#cccccc'")
    content = content.replace("color: 'var(--text-secondary)'", "color: '#dddddd'")
    content = content.replace("color: 'var(--text-dim)'", "color: '#aaaaaa'")
    
    # Revert backgrounds to transparent darks instead of var(--bg-subtle) which is light green
    content = content.replace("background: 'var(--bg-subtle)'", "background: 'rgba(255,255,255,0.06)'")
    content = content.replace("background: 'var(--surface-card)'", "background: 'rgba(11, 19, 32, 0.95)'")
    
    # Revert borders
    content = content.replace("border: '1px solid var(--border-subtle)'", "border: '1px solid rgba(255,255,255,0.1)'")
    content = content.replace("borderBottom: '1px solid var(--border-subtle)'", "borderBottom: '1px solid rgba(255,255,255,0.1)'")
    content = content.replace("borderColor: 'var(--border-subtle)'", "borderColor: 'rgba(255,255,255,0.1)'")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    revert_colors()
