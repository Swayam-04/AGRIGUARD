import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    # Remove CSS backdrop-filter
    content = re.sub(r'backdrop-filter:\s*blur[^;]+;', '', content)
    
    # Remove React backdropFilter inline styles
    content = re.sub(r"backdropFilter:\s*['`]blur[^`']+['`],?", "", content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Removed blurs from: {filepath}")

def main():
    src_dir = os.path.join(os.getcwd(), 'frontend', 'src')
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith(('.css', '.tsx', '.ts', '.js', '.jsx')):
                process_file(os.path.join(root, file))

if __name__ == '__main__':
    main()
