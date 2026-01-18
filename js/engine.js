
const STATE = {
    index: 0,
    waitingForInput: false,
    typing: false,
    currentMusic: null,
    currentCharacter: null, // {name, baseName}
    bgName: 'black',
    introMode: false,
    labels: {},
    isAutoAdvancing: false,
    videoError: false,
    videoStartTime: 0
};

const ELS = {
    videoContainer: document.getElementById('video-layer'),
    video: document.getElementById('intro-video'),
    bg: document.getElementById('background-layer'),
    charImg: document.getElementById('character-sprite'),
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
    // Handle blips mapping
    if (name.includes('blip') && !window.ASSETS[name]) {
         // Fallback logic handled in caller, but just in case
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
    if (STATE.currentMusic === name && musicSource) {
        if (musicSource.context.state === 'suspended') musicSource.context.resume();
        return;
    }

    stopMusic();

    if (!name || !window.ASSETS[name]) return;

    STATE.currentMusic = name;
    const result = await playSound(name, true, 0.5); // Music at 50% volume
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
    // Reset desk if not explicit
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
    // Helper for View combinations
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

    // Set BG
    setBackground(v.bg);

    // Set Desk
    if (v.desk && window.ASSETS[v.desk]) {
        ELS.desk.style.backgroundImage = `url(${window.ASSETS[v.desk]})`;
    } else {
        ELS.desk.style.backgroundImage = 'none';
    }
}

function setCharacter(name, action) {
    if (action === 'hide') {
        ELS.charImg.style.display = 'none';
        STATE.currentCharacter = null;
        return;
    }

    if (window.ASSETS[name]) {
        ELS.charImg.src = window.ASSETS[name];
        ELS.charImg.style.display = 'block';
        STATE.currentCharacter = name;
    }
}

function updateCharacterAnimation(isTalking) {
    if (!STATE.currentCharacter) return;

    const baseName = STATE.currentCharacter;

    let base = baseName;
    if (base.endsWith('_Talk')) {
        base = base.substring(0, base.length - 5);
    }

    const talkName = base + "_Talk";

    if (!window.ASSETS[talkName]) return;

    const target = isTalking ? talkName : base;

    if (STATE.currentCharacter !== target && window.ASSETS[target]) {
        ELS.charImg.src = window.ASSETS[target];
        STATE.currentCharacter = target;
    }
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
    // Verify speaker matches visual
    if (shouldAnimate && STATE.currentCharacter) {
        // Very loose check
        const charName = STATE.currentCharacter.toLowerCase();
        const speakName = speaker.toLowerCase();

        let match = charName.includes(speakName);
        if (speakName === 'larry' && charName.includes('butz')) match = true;
        if (speakName === 'butz' && charName.includes('butz')) match = true;
        if (speakName === '???' && charName.includes('butz')) match = true;
        if (speakName === 'phoenix' && (charName.includes('wright') || charName.includes('defense'))) match = true;

        if (!match) shouldAnimate = false;
    } else {
        shouldAnimate = false;
    }

    let i = 0;
    typeInterval = setInterval(() => {
        if (i >= text.length) {
            finishTyping(shouldAnimate, autoAdvance);
            return;
        }

        const char = text[i];
        ELS.text.textContent += char;

        if (char !== ' ') {
            playBlip(speaker);
        }

        if (shouldAnimate) {
            updateCharacterAnimation(true);
        }

        i++;
    }, 30);
}

function finishTyping(wasAnimating, autoAdvance) {
    clearInterval(typeInterval);
    typeInterval = null;
    STATE.typing = false;
    updateCharacterAnimation(false); // Stop talking

    if (autoAdvance) {
        setTimeout(nextStep, 500); // Auto proceed
    } else {
        STATE.waitingForInput = true;
        ELS.next.style.display = 'block';
    }
}

// --- Intro / Video Logic ---

function playVideo(name) {
    if (!window.ASSETS[name]) return;

    ELS.videoContainer.style.display = 'block';
    ELS.video.src = window.ASSETS[name];
    ELS.video.currentTime = 0;

    STATE.videoError = false;

    ELS.video.play().then(() => {
        // Check if actually playing (sometimes promise resolves but it pauses immediately)
        setTimeout(() => {
            if (ELS.video.paused && !STATE.videoError) {
                console.warn("Video stalled, switching to simulation");
                STATE.videoError = true;
                STATE.videoStartTime = Date.now();
            }
        }, 500);
    }).catch(e => {
        console.error("Video play fail", e);
        // Fallback for environment where video fails
        STATE.videoError = true;
        STATE.videoStartTime = Date.now();
    });

    // Ensure BG is hidden or behind
    ELS.bg.style.display = 'none';
}

function waitForVideoTime(time) {
    return new Promise(resolve => {
        const check = setInterval(() => {
            let currentTime = ELS.video.currentTime;

            if (STATE.videoError) {
                // Simulate time
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
                if (!keepLast) ELS.charImg.style.display = 'none';
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

// Preprocess labels
function indexLabels() {
    for (let i = 0; i < window.SCRIPT.length; i++) {
        if (window.SCRIPT[i].type === 'label') {
            STATE.labels[window.SCRIPT[i].name] = i;
        }
    }
}

async function nextStep() {
    if (STATE.typing) {
        return;
    }

    if (STATE.index >= window.SCRIPT.length) return;

    const event = window.SCRIPT[STATE.index];
    STATE.index++;

    console.log("Event:", event);

    // Handle Parallel
    if (event.type === 'simultaneous') {
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
            ELS.videoContainer.style.zIndex = -1; // Push video back if active
            typeText(event.text, event.speaker, event.isThought, event.auto_advance);
            // typeText handles nextStep callback if auto_advance
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
            ELS.bg.style.display = 'block'; // Restore BG layer
            nextStep();
            break;

        case 'intro_card':
            ELS.textbox.style.display = 'none';
            typeIntroCard(event.lines);
            // typeIntroCard sets wait state
            break;

        case 'sequence':
            ELS.charImg.style.display = 'none';
            await playSequence(event.frames, event.fps, event.keepLast);
            nextStep();
            break;

        case 'label':
            // No op
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
document.body.addEventListener('click', (e) => {
    // Ignore if clicking overlay
    if (e.target.closest('#choice-overlay') || e.target.closest('.choice-btn')) return;

    if (ELS.startOverlay.style.display !== 'none') {
        ELS.startOverlay.style.display = 'none';
        initAudio();
        indexLabels();
        nextStep();
        return;
    }

    if (STATE.waitingForInput) {
         // If intro card, dismiss
         if (ELS.intro.style.display !== 'none') {
             ELS.intro.style.display = 'none';
         }
         nextStep();
    } else if (STATE.typing && typeInterval) {
        // Instant finish
        clearInterval(typeInterval);
        typeInterval = null;
        const event = window.SCRIPT[STATE.index - 1]; // Current event
        ELS.text.textContent = event.text; // Fill text
        finishTyping(false, event.auto_advance);
    }
});
