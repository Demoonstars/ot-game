/* =========================================================
   ФАЙЛ: js/audio.js
   Аудиодвижок (ADSR, Реверберация, MP3-плеер) и Эффекты
========================================================= */

const AudioEngine = (() => {
    let ctx = null; 
    let enabled = false; 
    let convolver = null; 
    let masterGain = null;
    
    let bgmPlayer = null; // Плеер для настоящей MP3 музыки

    let tensionOsc = null; 
    let tensionGain = null;
    let ambientActive = false; 
    let heartOsc1, heartOsc2, heartGain;

    // 1. ГЕНЕРАТОР ЭХА (Impulse Response для пространства)
    const createReverb = () => {
        const length = ctx.sampleRate * 1.5; 
        const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let i = 0; i < 2; i++) {
            const channel = impulse.getChannelData(i);
            for (let j = 0; j < length; j++) {
                channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 4); 
            }
        }
        convolver = ctx.createConvolver();
        convolver.buffer = impulse;
    };

    // 2. ИНИЦИАЛИЗАЦИЯ
    const init = () => { 
        if (!ctx) { 
            ctx = new (window.AudioContext || window.webkitAudioContext)(); 
            masterGain = ctx.createGain();
            masterGain.connect(ctx.destination);
            createReverb();
            initBGM(); // Пытаемся загрузить MP3 пользователя
        } 
        if (ctx.state === 'suspended') ctx.resume(); 
        enabled = true; 
    };

    // 3. ЗАГРУЗЧИК ФОНОВОЙ МУЗЫКИ (MP3)
    const initBGM = () => {
        if (!bgmPlayer) {
            bgmPlayer = new Audio('assets/bgm.mp3'); // Укажи здесь путь к своему треку
            bgmPlayer.loop = true;
            bgmPlayer.volume = 0.15; // Громкость фона 15%
        }
        bgmPlayer.play().catch(e => {
            console.log('Фоновая музыка не найдена. Создай папку "assets" и положи туда "bgm.mp3"');
        });
    };

    // 4. СИНТЕЗАТОР С ОГИБАЮЩЕЙ (Для UI звуков)
    const playTone = (freq, type, duration, vol = 0.1, isReverb = false) => {
        if (!enabled || !ctx) return;
        const osc = ctx.createOscillator(); 
        const gain = ctx.createGain();
        osc.type = type; 
        
        if (isReverb) {
            osc.connect(gain);
            gain.connect(convolver);
            convolver.connect(masterGain);
        } else {
            osc.connect(gain);
            gain.connect(masterGain);
        }

        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        // ADSR: Мягкая атака и затухание
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02); 
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration); 
        
        osc.start(); 
        osc.stop(ctx.currentTime + duration + 0.1);
    };

    // 5. ЗВУК СВАЙПА (Шелест бумаги)
    const playPaperSwipe = () => {
        if (!enabled || !ctx) return;
        const bufferSize = ctx.sampleRate * 0.15; 
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        const noise = ctx.createBufferSource(); 
        noise.buffer = buffer;
        
        const filter = ctx.createBiquadFilter(); 
        filter.type = 'bandpass'; 
        filter.frequency.value = 1500;
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        
        noise.connect(filter); 
        filter.connect(gain); 
        gain.connect(masterGain);
        noise.start();
    };
    
    // 6. НАПРЯЖЕНИЕ (Pre-cognition гул)
    const setTension = (intensity) => {
        if (!enabled || !ctx) return;
        if (intensity <= 0.1) {
            if (tensionGain) tensionGain.gain.setTargetAtTime(0.001, ctx.currentTime, 0.1); 
            return;
        }
        if (!tensionOsc) {
            tensionOsc = ctx.createOscillator(); 
            tensionGain = ctx.createGain();
            tensionOsc.type = 'sawtooth'; 
            tensionOsc.frequency.value = 40; 
            
            const lpf = ctx.createBiquadFilter(); 
            lpf.type = 'lowpass'; 
            lpf.frequency.value = 150;
            
            tensionOsc.connect(lpf); 
            lpf.connect(tensionGain); 
            tensionGain.connect(masterGain);
            tensionGain.gain.value = 0.001; 
            tensionOsc.start();
        }
        tensionGain.gain.setTargetAtTime(intensity * 0.4, ctx.currentTime, 0.1); 
        tensionOsc.frequency.setTargetAtTime(30 + (intensity * 30), ctx.currentTime, 0.1);
    };

    // 7. СЕРДЦЕБИЕНИЕ (При падении ТБ)
    const startAmbient = () => {
        if(!enabled || ambientActive) return;
        ambientActive = true;
        
        heartOsc1 = ctx.createOscillator(); 
        heartOsc2 = ctx.createOscillator(); 
        heartGain = ctx.createGain();
        heartOsc1.type = 'sine'; heartOsc1.frequency.value = 45;
        heartOsc2.type = 'sine'; heartOsc2.frequency.value = 47; // Диссонанс для объема
        heartGain.gain.value = 0; 
        
        const lfo = ctx.createOscillator(); 
        lfo.type = 'sine'; 
        lfo.frequency.value = 1.2; // Ритм пульса
        const lfoGain = ctx.createGain(); 
        lfoGain.gain.value = 1;
        lfo.connect(lfoGain).connect(heartGain.gain);
        lfo.start();
        
        heartOsc1.connect(heartGain).connect(masterGain);
        heartOsc2.connect(heartGain).connect(masterGain);
        heartOsc1.start(); heartOsc2.start();
    };

    const updateAmbient = (stats) => {
        if (!enabled || !ambientActive) return;
        if (stats.safety < 30) heartGain.gain.setTargetAtTime(0.8, ctx.currentTime, 1);
        else heartGain.gain.setTargetAtTime(0, ctx.currentTime, 1);
    };

    const stopAmbient = () => {
        if(!ambientActive) return;
        heartGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        setTimeout(() => { 
            if(heartOsc1) heartOsc1.stop(); 
            if(heartOsc2) heartOsc2.stop();
            ambientActive = false; 
        }, 600);
        
        if (bgmPlayer) {
            bgmPlayer.pause();
            bgmPlayer.currentTime = 0;
        }
    };

    return {
        init, 
        swipe: () => playPaperSwipe(), 
        stamp: () => { 
            playTone(80, 'square', 0.5, 0.6, true); 
            playTone(40, 'sawtooth', 0.4, 0.8, false); 
        }, 
        winStamp: () => { 
            playTone(300, 'sine', 0.5, 0.3, true); 
            setTimeout(() => playTone(600, 'sine', 0.8, 0.4, true), 150); 
        },
        alarm: () => { playTone(600, 'square', 0.2, 0.05); setTimeout(() => playTone(800, 'square', 0.2, 0.05), 100); },
        ring: () => { for(let i=0; i<3; i++) { setTimeout(() => playTone(1000, 'sine', 0.1, 0.05), i*200); setTimeout(() => playTone(1300, 'sine', 0.1, 0.05), i*200 + 100); } },
        error: () => playTone(120, 'sawtooth', 0.4, 0.3, false),
        msg: () => playTone(1200, 'sine', 0.1, 0.05),
        buy: () => { playTone(800, 'sine', 0.2, 0.1); setTimeout(() => playTone(1200, 'sine', 0.4, 0.1), 100); },
        setTension, startAmbient, updateAmbient, stopAmbient
    };
})();

/* =========================================================
   ВИЗУАЛЬНЫЕ УТИЛИТЫ И ЭФФЕКТЫ
========================================================= */

// Тактильный отклик (вибрация)
const vibrate = (pattern) => { 
    if (typeof window !== 'undefined' && 'navigator' in window && window.navigator.vibrate) {
        window.navigator.vibrate(pattern); 
    }
};

// Генератор частиц (Конфетти или искры при решениях)
const burstParticles = (direction) => {
    const color = direction === 'left' ? '#e11d48' : '#10b981';
    for (let i = 0; i < 30; i++) {
       const p = document.createElement('div'); 
       p.className = 'particle'; 
       const size = Math.random() * 10 + 5;
       p.style.width = p.style.height = `${size}px`; 
       p.style.backgroundColor = color; 
       p.style.boxShadow = `0 0 15px ${color}`;
       p.style.left = `${window.innerWidth/2}px`; 
       p.style.top = `${window.innerHeight/2}px`;
       p.style.setProperty('--tx', `${(Math.random()-0.5)*500}px`); 
       p.style.setProperty('--ty', `${(Math.random()-0.5)*500 - 100}px`);
       document.body.appendChild(p); 
       setTimeout(() => p.remove(), 800);
    }
};

// Экспорт в глобальную область
window.AudioEngine = AudioEngine;
window.vibrate = vibrate;
window.burstParticles = burstParticles;
