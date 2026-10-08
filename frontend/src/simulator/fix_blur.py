import re

def fix():
    with open('SimulatedViewPage.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove backdropFilter
    content = re.sub(r"backdropFilter:\s*'blur[^']*',?\s*", "", content)
    
    # Replace transparent backgrounds with solid to prevent ugly see-through UI
    # e.g., rgba(11, 19, 32, 0.75) -> rgba(11, 19, 32, 0.98)
    content = content.replace("rgba(11, 19, 32, 0.75)", "rgba(11, 19, 32, 0.98)")
    content = content.replace("rgba(0,0,0,0.75)", "rgba(11, 19, 32, 0.98)")
    content = content.replace("rgba(0,0,0,0.4)", "rgba(11, 19, 32, 0.95)")
    content = content.replace("rgba(255, 255, 255, 0.03)", "rgba(255, 255, 255, 0.08)")

    with open('SimulatedViewPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    fix()
