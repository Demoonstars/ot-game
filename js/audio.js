/* =========================================================
   ФАЙЛ: js/audio.js
   ТОЛЬКО MP3 ФОН И ЭФФЕКТЫ ДЕЙСТВИЙ (БЕЗ ГУЛА И БИТОВ)
========================================================= */

const AudioEngine = (() => {
    let ctx = null;
    let enabled = false;
    let masterGain = null;
    let bgmPlayer = null;

    const init = () => {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.connect(ctx.destination);
            initBGM();
        }
        if (ctx.state === 'suspended') ctx.resume();
        enabled = true;
    };

    const initBGM = () => {
        if (!bgmPlayer) {
            bgmPlayer = new Audio('assets/bgm.mp3');
            bgmPlayer.loop = true;
            bgmPlayer.volume = 0.3; // Громкость твоей музыки (30%)
        }
        bgmPlayer.play().catch(e => console.log('MP3 не найден'));
    };

    // Генератор коротких звуков (пиков) для действий
    const playTone = (freq, type, duration, vol = 0.1) => {
        if (!enabled || !ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;

        osc.connect(gain);
        gain.connect(masterGain);

        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.start();
        osc.stop(ctx.currentTime + duration + 0.1);
    };

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

        noise.connect(filter); filter.connect(gain); gain.connect(masterGain);
        noise.start();
    };

    const stopBGM = () => {
        if (bgmPlayer) {
            bgmPlayer.pause();
            bgmPlayer.currentTime = 0;
        }
    };

    return {
        init,
        swipe: () => playPaperSwipe(),
        stamp: () => { playTone(80, 'square', 0.6, 0.6); playTone(40, 'sawtooth', 0.5, 0.8); },
        winStamp: () => { playTone(400, 'sine', 0.5, 0.3); setTimeout(() => playTone(600, 'sine', 0.8, 0.4), 150); },
        alarm: () => { playTone(600, 'square', 0.2, 0.05); setTimeout(() => playTone(800, 'square', 0.2, 0.05), 100); },
        ring: () => { for(let i=0; i<3; i++) { setTimeout(() => playTone(1000, 'sine', 0.1, 0.05), i*200); setTimeout(() => playTone(1300, 'sine', 0.1, 0.05), i*200 + 100); } },
        error: () => playTone(120, 'sawtooth', 0.4, 0.3),
        msg: () => playTone(1200, 'sine', 0.1, 0.05),
        buy: () => { playTone(800, 'sine', 0.2, 0.1); setTimeout(() => playTone(1200, 'sine', 0.4, 0.1), 100); },
        
        // Пустые функции-заглушки, чтобы код не ломался при попытке вызвать вырезанный эмбиент
        setTension: () => {}, 
        startAmbient: () => {},
        updateAmbient: () => {},
        stopAmbient: () => stopBGM()
    };
})();

const vibrate = (pattern) => { if (typeof window !== 'undefined' && 'navigator' in window && window.navigator.vibrate) window.navigator.vibrate(pattern); };

const burstParticles = (direction) => {
    const color = direction === 'left' ? '#e11d48' : '#10b981';
    for (let i = 0; i < 30; i++) {
       const p = document.createElement('div'); p.className = 'particle'; const size = Math.random() * 10 + 5;
       p.style.width = p.style.height = `${size}px`; p.style.backgroundColor = color; p.style.boxShadow = `0 0 15px ${color}`;
       p.style.left = `${window.innerWidth/2}px`; p.style.top = `${window.innerHeight/2}px`;
       p.style.setProperty('--tx', `${(Math.random()-0.5)*500}px`); p.style.setProperty('--ty', `${(Math.random()-0.5)*500 - 100}px`);
       document.body.appendChild(p); setTimeout(() => p.remove(), 800);
    }
};

window.AudioEngine = AudioEngine;
window.vibrate = vibrate;
window.burstParticles = burstParticles;
