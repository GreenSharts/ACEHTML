
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
    videoStartTime: 0,
    activeCharacters: []
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
                img.onerror = () => resolve();
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

    if (!window.ASSETS[name]) {
        console.warn("Sound asset not found:", name);
        return null;
    }

    try {
        if (!soundCache[name]) {
            const response = await fetch(window.ASSETS[name]);
            if (!response.ok) throw new Error("Fetch failed");
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
        console.error("Audio error for", name, e);
        return null;
    }
}

async function playMusic(name) {
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

    if (!window.ASSETS[blipName]) blipName = 'blip.wav';

    playSound(blipName, false, 0.8);
}

// --- Renderer ---

function setBackground(name) {
    console.log("Setting BG:", name);
    if (name === 'black') {
        ELS.bg.style.backgroundImage = 'none';
        ELS.bg.style.backgroundColor = 'black';
        ELS.desk.style.backgroundImage = 'none';
    } else if (window.ASSETS[name]) {
        ELS.bg.style.backgroundImage = `url(${window.ASSETS[name]})`;
        ELS.bg.style.backgroundColor = 'transparent';
    } else {
        console.error("Background asset missing:", name);
    }
}

function setView(viewName) {
    console.log("Setting View:", viewName);
    const views = {
        'gallery': { bg: 'Gallery', desk: null },
        'judge': { bg: 'Judge', desk: 'Judge_Desk' }, // Removed .png assumption, use key
        'defense': { bg: 'Defense', desk: 'Defense_Desk' },
        'prosecution': { bg: 'Prosecution', desk: 'Prosecution_Desk' },
        'witness': { bg: 'Witness', desk: 'Witness_Desk' },
        'counsel': { bg: 'Defense_Counsel', desk: null }
    };

    const v = views[viewName];
    if (!v) {
        console.error("View not found:", viewName);
        return;
    }

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
    console.log("Character:", name, action);

    if (action === 'hide') {
        if (name) {
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

    const img = document.createElement('img');
    img.src = window.ASSETS[name];
    img.style.position = 'absolute';
    img.style.bottom = '0';
    img.style.left = '50%';
    img.style.transform = 'translateX(-50%)';
    img.style.height = '100%';
    img.style.objectFit = 'contain';

    // For Gallery, we might need specific positioning if provided?
    // Current script just adds them. Assuming images are pre-positioned canvas size or centered.
    // If multiple characters are added, they stack centered.

    ELS.charLayer.appendChild(img);
    STATE.activeCharacters.push({ name: name, element: img });
}

function updateSpeakerAnimation(speaker, isTalking) {
     STATE.activeCharacters.forEach((char, index) => {
        const charName = char.name.toLowerCase();
        const speakName = speaker.toLowerCase();

        let match = charName.includes(speakName);
        if (speakName === 'larry' && charName.includes('butz')) match = true;
        if (speakName === 'butz' && charName.includes('butz')) match = true;
        if (speakName === '???' && charName.includes('butz')) match = true;
        if (speakName === 'phoenix' && (charName.includes('wright') || charName.includes('defense'))) match = true;
        if (speakName === 'judge' && charName.includes('judge')) match = true;
        if (speakName === 'payne' && charName.includes('payne')) match = true;
        if (speakName === 'mia' && charName.includes('mia')) match = true;

        if (!match) return;

        let base = char.name;
        if (base.endsWith('_Talk')) {
            base = base.substring(0, base.length - 5);
        }

        let target = isTalking ? (base + "_Talk") : base;

        if (window.ASSETS[target] && char.name !== target) {
            char.element.src = window.ASSETS[target];
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
    ELS.video.src = window.ASSETS[name];
    ELS.video.currentTime = 0;

    STATE.videoError = false;

    // Explicitly hide BG layer to ensure video visibility
    ELS.bg.style.display = 'none';

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
    // Ensure BG is visible for sequence
    ELS.bg.style.display = 'block';

    return new Promise(resolve => {
        let idx = 0;
        const delay = 1000 / fps;

        const intv = setInterval(() => {
            if (idx >= frames.length) {
                clearInterval(intv);
                if (!keepLast) ELS.charLayer.style.display = 'none';
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
            ELS.bg.style.display = 'block'; // Ensure visible
            setBackground(event.name);
            if (!isSimultaneous) nextStep();
            break;

        case 'view':
            ELS.bg.style.display = 'block'; // Ensure visible
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
            if (STATE.introMode) {
                // If intro, keep video visible
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
            ELS.charLayer.innerHTML = '';
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

document.body.addEventListener('click', async (e) => {
    if (e.target.closest('#choice-overlay') || e.target.closest('.choice-btn')) return;

    if (ELS.startOverlay.style.display !== 'none') {
        ELS.startOverlay.style.display = 'none';

        await preloadAssets();
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

        updateSpeakerAnimation(event.speaker, false);

        finishTyping(event.speaker, false, event.auto_advance);
    }
});
