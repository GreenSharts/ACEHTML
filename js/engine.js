
const STATE = {
    index: 0,
    waitingForInput: false,
    typing: false,
    currentMusic: null,
    bgName: 'black',
    introMode: false,
    labels: {},
    isAutoAdvancing: false,
    videoError: false,
    videoStartTime: 0,
    // Track loaded characters to manage "add" vs "show"
    activeCharacters: [] // Array of { name, element }
};

const ELS = {
    videoContainer: document.getElementById('video-layer'),
    video: document.getElementById('intro-video'),
    bg: document.getElementById('background-layer'),
    charLayer: document.getElementById('character-layer'),
    desk: document.getElementById('desk-layer'),
    textbox: document.getElementById('textbox'),
    namebox: document.getElementById('speaker-name'),
    text: document.getElementById('dialogue-text'),
    next: document.getElementById('next-indicator'),
    intro: document.getElementById('intro-card'),
    introText: document.getElementById('intro-text'),
    startOverlay: document.getElementById('start-overlay'),
    choiceOverlay: document.getElementById('choice-overlay')
};

// --- Preloader ---
const imageCache = {};

async function preloadAssets() {
    console.log("Preloading assets...");
    const promises = [];
    for (const key in window.ASSETS) {
        const path = window.ASSETS[key];
        const ext = path.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            const p = new Promise((resolve) => {
                const img = new Image();
                img.src = path;
                img.onload = () => resolve();
                img.onerror = () => resolve(); // proceed even if fail
                imageCache[key] = img;
            });
            promises.push(p);
        }
    }
    await Promise.all(promises);
    console.log("Preloading complete.");
}

// --- Audio System ---
let audioCtx;
const soundCache = {};
let musicSource = null;
let musicGain = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

async function playSound(name, loop = false, vol = 1.0) {
    if (name.includes('blip') && !window.ASSETS[name]) {
         name = 'blip.wav';
    }

    if (!window.ASSETS[name]) return null;

    try {
        if (!soundCache[name]) {
            const response = await fetch(window.ASSETS[name]);
            const arrayBuffer = await response.arrayBuffer();
            soundCache[name] = await audioCtx.decodeAudioData(arrayBuffer);
        }

        const source = audioCtx.createBufferSource();
        source.buffer = soundCache[name];
        source.loop = loop;

        const gainNode = audioCtx.createGain();
        gainNode.gain.value = vol;

        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        source.start(0);
        return { source, gain: gainNode };
    } catch (e) {
        console.error("Audio error", e);
        return null;
    }
}

async function playMusic(name) {
    // If name contains path separators, strip them to match keys if needed
    // But script.json uses "Trial.ogg". assets.js keys are filenames.
    // If script says "Music/Trial.ogg", we need to match key.
    // Our mapper uses filenames as keys.

    // Normalize key
    const key = name.split('/').pop();

    if (STATE.currentMusic === key && musicSource) {
        if (musicSource.context.state === 'suspended') musicSource.context.resume();
        return;
    }

    stopMusic();

    if (!key || !window.ASSETS[key]) {
        console.warn("Music not found:", name);
        return;
    }

    STATE.currentMusic = key;
    const result = await playSound(key, true, 0.5);
    if (result) {
        musicSource = result.source;
        musicGain = result.gain;
    }
}

function stopMusic() {
    if (musicSource) {
        try { musicSource.stop(); } catch(e){}
        musicSource = null;
    }
    STATE.currentMusic = null;
}

function pauseMusic() {
    if (audioCtx) audioCtx.suspend();
}

function resumeMusic() {
    if (audioCtx) audioCtx.resume();
}

function playBlip(speaker) {
    let blipName = 'blip.wav';
    if (speaker === 'Mia') blipName = 'blip-female.wav';
    // Check availability
    if (!window.ASSETS[blipName]) blipName = 'blip.wav';

    playSound(blipName, false, 0.8);
}

// --- Renderer ---

function setBackground(name) {
    if (name === 'black') {
        ELS.bg.style.backgroundImage = 'none';
        ELS.bg.style.backgroundColor = 'black';
        ELS.desk.style.backgroundImage = 'none';
    } else if (window.ASSETS[name]) {
        ELS.bg.style.backgroundImage = `url(${window.ASSETS[name]})`;
        ELS.bg.style.backgroundColor = 'transparent';
    }
}

function setView(viewName) {
    const views = {
        'gallery': { bg: 'Gallery', desk: null },
        'judge': { bg: 'Judge', desk: 'Judge_Desk.png' },
        'defense': { bg: 'Defense', desk: 'Defense_Desk.png' },
        'prosecution': { bg: 'Prosecution', desk: 'Prosecution_Desk.png' },
        'witness': { bg: 'Witness', desk: 'Witness_Desk.png' },
        'counsel': { bg: 'Defense_Counsel', desk: null }
    };

    const v = views[viewName];
    if (!v) return;

    // Clear all characters on view change
    clearCharacters();

    setBackground(v.bg);

    if (v.desk && window.ASSETS[v.desk]) {
        ELS.desk.style.backgroundImage = `url(${window.ASSETS[v.desk]})`;
    } else {
        ELS.desk.style.backgroundImage = 'none';
    }
}

function clearCharacters() {
    ELS.charLayer.innerHTML = '';
    STATE.activeCharacters = [];
}

function setCharacter(name, action) {
    // action: "show" (replace all), "add" (append), "hide" (remove specific or all?)

    if (action === 'hide') {
        if (name) {
             // Remove specific
             const idx = STATE.activeCharacters.findIndex(c => c.name === name);
             if (idx !== -1) {
                 STATE.activeCharacters[idx].element.remove();
                 STATE.activeCharacters.splice(idx, 1);
             }
        } else {
            clearCharacters();
        }
        return;
    }

    if (!window.ASSETS[name]) {
        console.warn("Character asset not found:", name);
        return;
    }

    if (action === 'show') {
        clearCharacters();
    }

    // Check if already exists?
    // If "add", we might be adding a duplicate, which is allowed for crowds?
    // Usually for AA, "add" implies unique actors.

    const img = document.createElement('img');
    img.src = window.ASSETS[name];
    img.style.position = 'absolute';
    img.style.bottom = '0';
    // Center it horizontally by default?
    // Or stick to standard flow?
    // If we use absolute, we need to center it.
    img.style.left = '50%';
    img.style.transform = 'translateX(-50%)';
    img.style.height = '100%';
    img.style.objectFit = 'contain';

    ELS.charLayer.appendChild(img);
    STATE.activeCharacters.push({ name: name, element: img });
}

function updateCharacterAnimation(isTalking) {
    // Update ALL active characters?
    // Usually only the speaker talks.
    // We don't know WHICH one is the speaker easily without mapping "Phoenix" -> "Wright_Stand".
    // For now, iterate all active characters.

    STATE.activeCharacters.forEach(char => {
        const baseName = char.name;
        // Heuristic: remove _Talk suffix if present
        let base = baseName;
        if (base.endsWith('_Talk')) {
            base = base.substring(0, base.length - 5);
        } else if (base.endsWith('_Stand')) {
             // Maybe? "Wright_Stand" -> "Wright_Stand_Talk"
             // "Wright_Cornered" -> "Wright_Cornered_Talk"
        }

        // Try to construct talk name
        // If current is X, talk is X_Talk (if X doesn't end in Talk)
        // If current is X_Talk, talk is X_Talk

        // Actually, we need to switch betwen Base and Base_Talk.

        // If char.name (current asset) is "Mia_Stand" -> Talk is "Mia_Stand_Talk"

        let talkName = base + "_Talk";
        // Special case handling if naming convention varies
        // e.g. "Judge_Stand" -> "Judge_Stand_Talk"

        // If we are talking, switch to Talk asset if exists
        // If not talking, switch to Base asset

        let target = isTalking ? talkName : base;

        // If we don't have the target asset, do nothing
        if (!window.ASSETS[target]) {
             // Maybe base was already the talk variant?
             // If isTalking is false, we want the non-talk variant.
             // If base ends in _Talk, strip it.
             if (!isTalking && baseName.endsWith('_Talk')) {
                 target = baseName.substring(0, baseName.length - 5);
             } else {
                 return;
             }
        }

        // Only update if changed
        // Use src check is unreliable if full path differs.
        // Use stored name check.

        // We need to update the char object in array too

        // Filter: Only animate characters that match the current speaker?
        // We don't have speaker info here easily passed down.
        // Let's assume the ENGINE manages "who is speaking" via setCharacter updates?
        // NO, the engine just sends "isTalking" true/false during typing.

        // Issue: If Phoenix and Mia are on screen, and Phoenix talks, Mia shouldn't move mouth.
        // We need to know who is talking.
        // `typeText` knows the speaker name.
        // We can pass `speakerName` to `updateCharacterAnimation`.

    });
}

function updateSpeakerAnimation(speaker, isTalking) {
     STATE.activeCharacters.forEach((char, index) => {
        // Check match
        const charName = char.name.toLowerCase();
        const speakName = speaker.toLowerCase();

        let match = charName.includes(speakName);
        if (speakName === 'larry' && charName.includes('butz')) match = true;
        if (speakName === 'butz' && charName.includes('butz')) match = true;
        if (speakName === '???' && charName.includes('butz')) match = true;
        if (speakName === 'phoenix' && (charName.includes('wright') || charName.includes('defense'))) match = true;
        if (speakName === 'judge' && charName.includes('judge')) match = true;
        if (speakName === 'payne' && charName.includes('payne')) match = true;

        if (!match) return; // Don't animate this character

        // Calculate Target Asset
        let base = char.name;
        if (base.endsWith('_Talk')) {
            base = base.substring(0, base.length - 5);
        }

        // Assume convention: X -> X_Talk
        // If currently X, and talk=true, become X_Talk
        // If currently X_Talk, and talk=false, become X

        let target = isTalking ? (base + "_Talk") : base;

        if (window.ASSETS[target] && char.name !== target) {
            char.element.src = window.ASSETS[target];
            // Update our state record
            STATE.activeCharacters[index].name = target;
        }
     });
}


// --- Text Engine ---

let typeInterval = null;

async function typeText(text, speaker, isThought, autoAdvance) {
    STATE.typing = true;
    STATE.waitingForInput = false;
    ELS.next.style.display = 'none';
    ELS.text.textContent = '';
    ELS.text.className = isThought ? 'thought' : '';

    if (speaker) {
        ELS.namebox.textContent = speaker;
        ELS.namebox.style.display = 'block';
    } else {
        ELS.namebox.style.display = 'none';
    }

    let shouldAnimate = !isThought;

    let i = 0;
    typeInterval = setInterval(() => {
        if (i >= text.length) {
            finishTyping(speaker, shouldAnimate, autoAdvance);
            return;
        }

        const char = text[i];
        ELS.text.textContent += char;

        if (char !== ' ') {
            playBlip(speaker);
        }

        if (shouldAnimate) {
            updateSpeakerAnimation(speaker, true);
        }

        i++;
    }, 30);
}

function finishTyping(speaker, wasAnimating, autoAdvance) {
    clearInterval(typeInterval);
    typeInterval = null;
    STATE.typing = false;

    // Stop talking
    updateSpeakerAnimation(speaker, false);

    if (autoAdvance) {
        setTimeout(nextStep, 500);
    } else {
        STATE.waitingForInput = true;
        ELS.next.style.display = 'block';
    }
}

// --- Intro / Video Logic ---

function playVideo(name) {
    if (!window.ASSETS[name]) return;

    ELS.videoContainer.style.display = 'block';
    ELS.videoContainer.style.zIndex = 0; // Ensure visible (BG is 1, so wait... BG covers it?)
    // BG z-index is 1. Video z-index is 0.
    // If BG is 'black' or has image, it covers video.
    // We must hide BG.
    ELS.bg.style.display = 'none';

    ELS.video.src = window.ASSETS[name];
    ELS.video.currentTime = 0;

    STATE.videoError = false;

    ELS.video.play().then(() => {
        setTimeout(() => {
            if (ELS.video.paused && !STATE.videoError) {
                console.warn("Video stalled, switching to simulation");
                STATE.videoError = true;
                STATE.videoStartTime = Date.now();
            }
        }, 500);
    }).catch(e => {
        console.error("Video play fail", e);
        STATE.videoError = true;
        STATE.videoStartTime = Date.now();
    });
}

function waitForVideoTime(time) {
    return new Promise(resolve => {
        const check = setInterval(() => {
            let currentTime = ELS.video.currentTime;

            if (STATE.videoError) {
                currentTime = (Date.now() - STATE.videoStartTime) / 1000;
            }

            if (currentTime >= time || ELS.video.ended) {
                clearInterval(check);
                resolve();
            }
        }, 100);
    });
}

// --- Sequence Logic (Cutscene A) ---
async function playSequence(frames, fps, keepLast) {
    return new Promise(resolve => {
        let idx = 0;
        const delay = 1000 / fps;

        const intv = setInterval(() => {
            if (idx >= frames.length) {
                clearInterval(intv);
                if (!keepLast) ELS.charLayer.style.display = 'none'; // logic from before, maybe revisit?
                resolve();
                return;
            }

            const frameName = frames[idx];
            if (window.ASSETS[frameName]) {
                ELS.bg.style.backgroundImage = `url(${window.ASSETS[frameName]})`;
            }
            idx++;
        }, delay);
    });
}

// --- Main Loop ---

function indexLabels() {
    for (let i = 0; i < window.SCRIPT.length; i++) {
        if (window.SCRIPT[i].type === 'label') {
            STATE.labels[window.SCRIPT[i].name] = i;
        }
    }
}

async function nextStep() {
    if (STATE.typing) return;
    if (STATE.index >= window.SCRIPT.length) return;

    const event = window.SCRIPT[STATE.index];
    STATE.index++;

    console.log("Event:", event);

    if (event.type === 'simultaneous') {
        // For simultaneous events, we want to fire them all.
        // If any are async (wait), do we wait for them?
        // Usually simultaneous implies "start them all now".
        // We will await them sequentially but if they are non-blocking actions they will appear simultaneous.
        for (let sub of event.events) {
            await processEvent(sub, true);
        }
        nextStep();
        return;
    }

    await processEvent(event, false);
}

async function processEvent(event, isSimultaneous) {
    switch (event.type) {
        case 'bg':
            setBackground(event.name);
            if (!isSimultaneous) nextStep();
            break;

        case 'view':
            setView(event.name);
            if (!isSimultaneous) nextStep();
            break;

        case 'music':
            if (event.action === 'play') playMusic(event.name);
            else if (event.action === 'pause') pauseMusic();
            else if (event.action === 'resume') resumeMusic();
            else stopMusic();
            if (!isSimultaneous) nextStep();
            break;

        case 'sfx':
            playSound(event.name);
            if (!isSimultaneous) nextStep();
            break;

        case 'character':
            setCharacter(event.name, event.action);
            if (!isSimultaneous) nextStep();
            break;

        case 'dialogue':
            ELS.textbox.style.display = 'block';
            ELS.videoContainer.style.zIndex = -1;
            // If in intro mode, we might want video visible?
            if (STATE.introMode) {
                ELS.videoContainer.style.zIndex = 0;
                ELS.bg.style.display = 'none';
            } else {
                ELS.bg.style.display = 'block';
            }

            typeText(event.text, event.speaker, event.isThought, event.auto_advance);
            break;

        case 'wait':
            setTimeout(nextStep, event.time * 1000);
            break;

        case 'video':
            playVideo(event.name);
            if (!isSimultaneous) nextStep();
            break;

        case 'wait_video':
            await waitForVideoTime(event.time);
            nextStep();
            break;

        case 'intro_start':
            STATE.introMode = true;
            nextStep();
            break;

        case 'intro_end':
            STATE.introMode = false;
            ELS.videoContainer.style.display = 'none';
            ELS.video.pause();
            ELS.bg.style.display = 'block';
            nextStep();
            break;

        case 'intro_card':
            ELS.textbox.style.display = 'none';
            typeIntroCard(event.lines);
            break;

        case 'sequence':
            ELS.charLayer.innerHTML = ''; // clear chars
            await playSequence(event.frames, event.fps, event.keepLast);
            nextStep();
            break;

        case 'label':
            if (!isSimultaneous) nextStep();
            break;

        case 'jump':
            if (STATE.labels[event.target] !== undefined) {
                STATE.index = STATE.labels[event.target];
            }
            nextStep();
            break;

        case 'choice':
            showChoices(event.choices);
            break;
    }
}

async function typeIntroCard(lines) {
    STATE.typing = true;
    STATE.introMode = true;
    ELS.intro.style.display = 'flex';
    ELS.textbox.style.display = 'none';
    ELS.introText.innerHTML = '';

    for (let line of lines) {
        const lineDiv = document.createElement('div');
        ELS.introText.appendChild(lineDiv);

        for (let i=0; i<line.length; i++) {
            lineDiv.textContent += line[i];
            playSound('blip-machine.wav');
            await new Promise(r => setTimeout(r, 50));
        }
        await new Promise(r => setTimeout(r, 500));
    }

    STATE.typing = false;
    STATE.waitingForInput = true;
}

function showChoices(choices) {
    ELS.choiceOverlay.innerHTML = '';
    ELS.choiceOverlay.style.display = 'flex';

    choices.forEach(c => {
        const btn = document.createElement('div');
        btn.className = 'choice-btn';
        btn.textContent = c.text;
        btn.onclick = () => {
            ELS.choiceOverlay.style.display = 'none';
            if (STATE.labels[c.target] !== undefined) {
                STATE.index = STATE.labels[c.target];
            }
            nextStep();
        };
        ELS.choiceOverlay.appendChild(btn);
    });
}

// Input Handling
document.body.addEventListener('click', async (e) => {
    if (e.target.closest('#choice-overlay') || e.target.closest('.choice-btn')) return;

    if (ELS.startOverlay.style.display !== 'none') {
        ELS.startOverlay.style.display = 'none';

        await preloadAssets(); // Preload here
        initAudio();
        indexLabels();
        nextStep();
        return;
    }

    if (STATE.waitingForInput) {
         if (ELS.intro.style.display !== 'none') {
             ELS.intro.style.display = 'none';
         }
         nextStep();
    } else if (STATE.typing && typeInterval) {
        clearInterval(typeInterval);
        typeInterval = null;
        const event = window.SCRIPT[STATE.index - 1];
        ELS.text.textContent = event.text;

        // Stop animation immediately
        updateSpeakerAnimation(event.speaker, false);

        finishTyping(event.speaker, false, event.auto_advance);
    }
});
