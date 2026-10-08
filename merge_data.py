import os
import shutil
from pathlib import Path
from tqdm import tqdm

base_dir = Path('PlantVillage-Dataset/raw')
out_dir = Path('PlantVillage_Combined')
out_dir.mkdir(exist_ok=True)

folders = {'color': '_c', 'grayscale': '_g', 'segmented': '_s'}
for fold, suffix in folders.items():
    src_fold = base_dir / fold
    if not src_fold.exists(): continue
    for class_dir in tqdm(src_fold.iterdir(), desc=fold):
        if not class_dir.is_dir(): continue
        out_class_dir = out_dir / class_dir.name
        out_class_dir.mkdir(exist_ok=True)
        for img in class_dir.iterdir():
            if img.is_file():
                new_name = f"{img.stem}{suffix}{img.suffix}"
                dest = out_class_dir / new_name
                if not dest.exists():
                    shutil.copy2(img, dest)
