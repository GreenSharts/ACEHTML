import json
import re
import os

def parse_script(filepath):
    events = []

    with open(filepath, 'r') as f:
        # Read lines, preserving order
        lines = [l.strip() for l in f.readlines() if l.strip()]

    current_speaker = None

    # State tracking
    is_intro = False
    intro_lines = []

    # Metadata skipping
    start_index = 0
    for i, line in enumerate(lines):
        if line.startswith("Episode 1"):
            start_index = i
            break

    lines = lines[start_index:]

    for line in lines:
        # Skip divider lines
        if line.startswith("__"):
            continue

        # Handle [Commands] at start of line
        if line.startswith("[") and line.endswith("]"):
            command = line[1:-1]

            # Special case: Black Screen starts intro sequence
            if command == "Black Screen":
                is_intro = True
                intro_lines = []
                events.append({"type": "bg", "name": "black"})
                continue

            # Fade in BG (End of intro)
            if command.startswith("Fade in") and "Defense_Lobby" in command and ".ogg" not in command:
                if is_intro and intro_lines:
                    events.append({"type": "intro_card", "lines": list(intro_lines)})
                    is_intro = False

                events.append({"type": "bg", "name": "Defense_Lobby", "transition": "fade"})
                continue

            # Fade out BG
            if command.startswith("Fade out") and "Defense_Lobby" in command and ".ogg" not in command:
                events.append({"type": "bg", "name": "black", "transition": "fade"})
                continue

            # Play Music
            if command.startswith("Play"):
                music_name = command.replace("Play ", "").strip()
                events.append({"type": "music", "action": "play", "name": music_name})
                continue

            # Stop Music
            if command.startswith("Fade out") and ".ogg" in command:
                 events.append({"type": "music", "action": "stop"})
                 continue

            # Load/Fade Character
            if command.startswith("Load") or command.startswith("Fade in") or command.startswith("Fade out"):
                if ".ogg" in command: continue # handled above

                # "Load Mia_Happy" or "Fade in Mia_Stand"
                # "Fade out Mia_Happy"
                action = "show"
                if "Fade out" in command:
                    action = "hide"

                parts = command.split()
                asset_name = parts[-1].strip() # Mia_Happy

                events.append({"type": "character", "action": action, "name": asset_name})
                continue

        # Handle Intro Lines (if we are in intro block and not a command)
        if is_intro:
            intro_lines.append(line)
            continue

        # Handle Speaker
        if line.endswith(":"):
            current_speaker = line[:-1]
            continue

        # Handle Dialogue
        # Can contain [Commands] and <Dialogue>
        # Regex to find all tags.
        # We look for <...> and [...]

        # If line has no < or [, skip (maybe part of metadata not skipped?)
        if "<" not in line and "[" not in line:
            continue

        # We need to iterate carefully to handle missing closing >
        # Or just regex findall but robustly.

        # Let's clean the line first.
        # Check for missing > at very end
        if line.startswith("<") and not line.endswith(">") and not line.endswith("]"):
             line += ">"

        tokens = re.findall(r'(<[^>]+>|\[[^\]]+\])', line)

        for token in tokens:
            if token.startswith("["):
                # Embedded command
                cmd = token[1:-1]
                if cmd.startswith("Load") or cmd.startswith("Fade in"):
                    asset = cmd.split()[-1]
                    events.append({"type": "character", "action": "show", "name": asset})
                elif cmd.startswith("Fade out"):
                     asset = cmd.split()[-1]
                     events.append({"type": "character", "action": "hide", "name": asset})

            elif token.startswith("<"):
                text_content = token[1:-1]

                # Check if it is a thought
                is_thought = text_content.startswith("(") and text_content.endswith(")")

                events.append({
                    "type": "dialogue",
                    "speaker": current_speaker,
                    "text": text_content,
                    "isThought": is_thought
                })

    return events

if __name__ == "__main__":
    if os.path.exists("Text/script_content.txt"):
        script = parse_script("Text/script_content.txt")
        print(json.dumps(script, indent=2))
    else:
        print("[]")
