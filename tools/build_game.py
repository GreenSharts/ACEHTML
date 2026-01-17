import os
import base64
import json
import mimetypes
import sys

# Ensure we can import parse_script from the same directory
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)
import parse_script

# Directories to scan (relative to repo root, assuming we run from root)
ASSET_DIRS = ['Backgrounds', 'Characters', 'Music', 'blips']

def get_mime_type(filepath):
    mime, _ = mimetypes.guess_type(filepath)
    return mime or 'application/octet-stream'

def encode_file(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()

    mime = get_mime_type(filepath)
    b64 = base64.b64encode(data).decode('utf-8')
    return f"data:{mime};base64,{b64}"

def build():
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
                filename = file
                stem = os.path.splitext(file)[0]
                ext = os.path.splitext(file)[1].lower()

                # Determine Key
                key = filename # Default to full name

                if ext in ['.jpg', '.jpeg', '.png', '.gif']:
                    # Images: Use stem (no ext) to match script (Mia_Happy, Defense_Lobby)
                    key = stem
                elif ext in ['.ogg', '.wav', '.mp3']:
                    # Audio: Use filename (with ext) to match updated parser (Defense_Lobby.ogg, blip.wav)
                    key = filename

                # print(f"Encoding {filepath} as '{key}'...")
                assets[key] = encode_file(filepath)

    # Parse Script
    print("Parsing script...")
    if os.path.exists("Text/script_content.txt"):
        script_data = parse_script.parse_script("Text/script_content.txt")
    else:
        print("Error: Script file not found!")
        script_data = []

    # Read Template
    print("Reading template...")
    try:
        with open("game_template.html", "r") as f:
            template = f.read()
    except FileNotFoundError:
        print("Error: game_template.html not found!")
        return

    # Inject
    print("Injecting data...")
    assets_json = json.dumps(assets)
    script_json = json.dumps(script_data)

    final_html = template.replace("{{ASSETS}}", assets_json).replace("{{SCRIPT}}", script_json)

    # Write Output
    output_filename = "AceAttorney_Part1.html"
    with open(output_filename, "w") as f:
        f.write(final_html)

    print(f"Build complete: {output_filename}")
    print(f"Total size: {os.path.getsize(output_filename) / 1024 / 1024:.2f} MB")

if __name__ == "__main__":
    build()
