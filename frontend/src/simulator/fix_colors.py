import re

def fix():
    with open('SimulatedViewPage.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Generic replace for all rgba white in borders and backgrounds
    content = re.sub(r"border:\s*['`]1px solid rgba\(255,\s*255,\s*255,\s*[0-9.]+[^`']*['`]", "border: '1px solid var(--border-subtle)'", content)
    content = re.sub(r"borderBottom:\s*['`]1px solid rgba\(255,\s*255,\s*255,\s*[0-9.]+[^`']*['`]", "borderBottom: '1px solid var(--border-subtle)'", content)
    content = re.sub(r"borderColor:\s*['`]rgba\(255,\s*255,\s*255,\s*[0-9.]+[^`']*['`]", "borderColor: 'var(--border-subtle)'", content)
    content = re.sub(r"background:\s*['`]rgba\(255,\s*255,\s*255,\s*[0-9.]+\)['`]", "background: 'var(--bg-subtle)'", content)
    
    # Text colors
    content = content.replace("color: '#fff'", "color: 'var(--text-primary)'")
    content = content.replace("color: '#FFFFFF'", "color: 'var(--text-primary)'")
    content = content.replace("color: '#ccc'", "color: 'var(--text-muted)'")
    content = content.replace("color: '#ddd'", "color: 'var(--text-muted)'")

    with open('SimulatedViewPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    fix()
