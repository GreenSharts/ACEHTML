import os
import json

# Directories to scan
ASSET_DIRS = ['Backgrounds', 'Characters', 'Cutscenes', 'Music', 'SFX', 'blips']

def map_assets():
    assets = {}

    print("Scanning assets...")
    for d in ASSET_DIRS:
        if not os.path.exists(d):
            print(f"Warning: Directory {d} not found.")
            continue

        for root, _, files in os.walk(d):
            for file in files:
                if file.startswith('.'): continue # skip hidden

                filepath = os.path.join(root, file)
                # Normalize path separators for JS
                web_path = filepath.replace('\\', '/')

                filename = file
                stem = os.path.splitext(file)[0]
                ext = os.path.splitext(file)[1].lower()

                # Determine Key
                key = filename # Default to full name

                if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    # Images: Use stem (no ext)
                    key = stem
                elif ext in ['.ogg', '.wav', '.mp3', '.mp4']:
                    # Audio/Video: Use filename (with ext)
                    key = filename

                assets[key] = web_path

    # Write JS file
    js_content = f"window.ASSETS = {json.dumps(assets, indent=2)};"

    with open("js/assets.js", "w") as f:
        f.write(js_content)

    print("Asset map created: js/assets.js")

if __name__ == "__main__":
    map_assets()
