/* =========================================================
   ФАЙЛ: js/audio.js
   AAA-Аудиодвижок (Без export, привязка к window)
========================================================= */

const createAudioEngine = () => {
    let ctx = null;
    let enabled = false;
    let masterGain = null;
    let bgmPlayer = null;
    let baseVolume = 0.25; 
    let duckTimeout = null;
    let fadeInterval = null;

    const init = () => {
        if (ctx) return;
        
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        ctx = new AudioContextClass();
        masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);
        
        initBGM();

        // Мобильная разблокировка звука (браузеры требуют клика от пользователя)
        if (ctx.state === 'suspended') {
            const unlock = () => {
                ctx.resume();
                document.removeEventListener('click', unlock);
                document.removeEventListener('touchstart', unlock);
            };
            document.addEventListener('click', unlock);
            document.addEventListener('touchstart', unlock);
        }
        
        enabled = true;
    };

    const initBGM = () => {
        if (!bgmPlayer) {
            bgmPlayer = new Audio('assets/bgm.mp3');
            bgmPlayer.loop = true;
            bgmPlayer.volume = baseVolume;
        }
        bgmPlayer.play().catch(e => console.log('Фоновая музыка не найдена. Создайте папку assets и положите туда bgm.mp3'));
    };

    // Система приглушения музыки (Ducking) при важных звуковых событиях
    const duckMusic = (durationMs, dipVolume = 0.05) => {
        if (!bgmPlayer) return;
        
        clearInterval(fadeInterval);
        clearTimeout(duckTimeout);
        
        bgmPlayer.volume = dipVolume;
        
        duckTimeout = setTimeout(() => {
            let vol = dipVolume;
            fadeInterval = setInterval(() => {
                vol += 0.02;
                if (vol >= baseVolume) {
                    bgmPlayer.volume = baseVolume;
                    clearInterval(fadeInterval);
                } else {
                    bgmPlayer.volume = vol;
                }
            }, 50);
        }, durationMs);
    };

    const stopBGM = () => {
        if (!bgmPlayer) return;
        clearInterval(fadeInterval);
        clearTimeout(duckTimeout);
        
        let vol = bgmPlayer.volume;
        fadeInterval = setInterval(() => {
            vol -= 0.03;
            if (vol <= 0.01) {
                bgmPlayer.pause();
                bgmPlayer.currentTime = 0;
                bgmPlayer.volume = baseVolume;
                clearInterval(fadeInterval);
            } else {
                bgmPlayer.volume = vol;
            }
        }, 50);
    };

    // Синтезатор эффектов
    const playTone = (freq, type, duration, vol = 0.1, panValue = 0) => {
        if (!enabled || !ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        if (ctx.createStereoPanner) {
            const panner = ctx.createStereoPanner();
            panner.pan.value = panValue;
            osc.connect(gain).connect(panner).connect(masterGain);
        } else {
            osc.connect(gain).connect(masterGain);
        }

        osc.start();
        osc.stop(ctx.currentTime + duration + 0.1);
    };

    // Звук свайпа со стерео-панорамой (Spatial Audio)
    const playPaperSwipe = (direction = null) => {
        if (!enabled || !ctx) return;
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1; 

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        let panValue = 0;
        if (direction === 'left') panValue = -0.7;
        if (direction === 'right') panValue = 0.7;

        if (ctx.createStereoPanner) {
            const panner = ctx.createStereoPanner();
            panner.pan.value = panValue;
            noise.connect(filter).connect(gain).connect(panner).connect(masterGain);
        } else {
            noise.connect(filter).connect(gain).connect(masterGain);
        }
        
        noise.start();
    };

    return {
        init,
        swipe: (dir) => playPaperSwipe(dir), 
        stamp: () => { duckMusic(800, 0.02); playTone(60, 'square', 0.6, 0.7); playTone(120, 'sawtooth', 0.3, 0.5); }, 
        winStamp: () => { duckMusic(1500, 0.05); playTone(392, 'sine', 0.6, 0.3); playTone(493, 'sine', 0.6, 0.3); playTone(587, 'sine', 0.8, 0.4); },
        alarm: () => { duckMusic(500, 0.1); playTone(600, 'square', 0.2, 0.08); setTimeout(() => playTone(800, 'square', 0.2, 0.08), 100); },
        ring: () => { duckMusic(1200, 0.1); for(let i=0; i<3; i++) { setTimeout(() => playTone(1000, 'sine', 0.1, 0.08), i*200); setTimeout(() => playTone(1300, 'sine', 0.1, 0.08), i*200 + 100); } },
        error: () => { duckMusic(400, 0.1); playTone(100, 'sawtooth', 0.4, 0.4); },
        msg: () => { duckMusic(500, 0.15); playTone(1200, 'sine', 0.1, 0.05); setTimeout(() => playTone(1600, 'sine', 0.15, 0.05), 100); },
        buy: () => { playTone(800, 'sine', 0.2, 0.1); setTimeout(() => playTone(1200, 'sine', 0.4, 0.1), 100); },
        stopBGM,
        setTension: () => {} 
    };
};

const AudioEngine = createAudioEngine();

// Глобальная функция вибрации (безопасный вызов)
const vibrate = (pattern) => { 
    if (typeof window !== 'undefined' && 'navigator' in window && window.navigator.vibrate) {
        window.navigator.vibrate(pattern); 
    }
};

// ПРИВЯЗКА К ГЛОБАЛЬНОЙ ОБЛАСТИ (ДЛЯ РАБОТЫ БЕЗ СБОРЩИКА)
window.AudioEngine = AudioEngine;
window.vibrate = vibrate;
