/* =========================================================
   ФАЙЛ: js/audio.js
   Супер-Аудиодвижок и визуальные утилиты
========================================================= */

const AudioEngine = (() => {
    let ctx = null; 
    let enabled = false; 
    let tensionOsc = null; 
    let tensionGain = null;
    let ambientActive = false; 
    let humOsc, humGain, heartOsc, heartGain;

    // Инициализация аудиоконтекста (вызывается при старте игры)
    const init = () => { 
        if (!ctx) { 
            ctx = new (window.AudioContext || window.webkitAudioContext)(); 
        } 
        if (ctx.state === 'suspended') ctx.resume(); 
        enabled = true; 
        startAmbient(); 
    };

    // Продвинутый синтез звука с фильтром низких частот (для сочных свайпов и ударов)
    const playTone = (freq, type, duration, vol = 0.1, slideFreq = null, useFilter = false) => {
        if (!enabled || !ctx) return;
        const osc = ctx.createOscillator(); 
        const gain = ctx.createGain();
        osc.type = type; 

        if (useFilter) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass'; 
            filter.frequency.setValueAtTime(2000, ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + duration);
            osc.connect(filter); 
            filter.connect(gain);
        } else {
            osc.connect(gain); 
        }
        
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, ctx.currentTime + duration);
        }
        
        gain.gain.setValueAtTime(vol, ctx.currentTime); 
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        
        osc.start(); 
        osc.stop(ctx.currentTime + duration);
    };
    
    // Нагнетание напряжения (Pre-cognition - при натяжении карты)
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
            tensionOsc.frequency.value = 50; 
            
            const lpf = ctx.createBiquadFilter(); 
            lpf.type = 'lowpass'; 
            lpf.frequency.value = 300;
            
            tensionOsc.connect(lpf); 
            lpf.connect(tensionGain); 
            tensionGain.connect(ctx.destination);
            tensionGain.gain.value = 0.001; 
            tensionOsc.start();
        }
        tensionGain.gain.setTargetAtTime(intensity * 0.15, ctx.currentTime, 0.1); // Мягкая громкость
        tensionOsc.frequency.setTargetAtTime(40 + (intensity * 60), ctx.currentTime, 0.1);
    };

    // Генеративный фоновый эмбиент (Adaptive Ambient)
    const startAmbient = () => {
        if(!enabled || ambientActive) return;
        ambientActive = true;
        
        // Базовый гул предприятия
        humOsc = ctx.createOscillator(); 
        humGain = ctx.createGain();
        humOsc.type = 'sine'; 
        humOsc.frequency.value = 60;
        humGain.gain.value = 0.05;
        humOsc.connect(humGain).connect(ctx.destination);
        humOsc.start();

        // Сердцебиение (Пульс катастрофы)
        heartOsc = ctx.createOscillator(); 
        heartGain = ctx.createGain();
        heartOsc.type = 'sine'; 
        heartOsc.frequency.value = 45;
        heartGain.gain.value = 0; 
        
        // LFO для создания ритма пульсации сердца
        const lfo = ctx.createOscillator(); 
        lfo.type = 'square'; 
        lfo.frequency.value = 1.2;
        const lfoGain = ctx.createGain(); 
        lfoGain.gain.value = 1;
        lfo.connect(lfoGain).connect(heartGain.gain);
        lfo.start();
        
        heartOsc.connect(heartGain).connect(ctx.destination);
        heartOsc.start();
    };

    // Реакция эмбиента на изменение показателей
    const updateAmbient = (stats) => {
        if (!enabled || !ambientActive) return;
        // Если Безопасность < 30, включаем тревожное сердцебиение
        if (stats.safety < 30) {
            heartGain.gain.setTargetAtTime(0.5, ctx.currentTime, 1);
        } else {
            heartGain.gain.setTargetAtTime(0, ctx.currentTime, 1);
        }
    };

    const stopAmbient = () => {
        if(!ambientActive) return;
        humGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        heartGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        setTimeout(() => { 
            if(humOsc) humOsc.stop(); 
            if(heartOsc) heartOsc.stop(); 
            ambientActive = false; 
        }, 600);
    };

    return {
        init, 
        swipe: () => playTone(200, 'sine', 0.3, 0.15, 50, true), // Ветреный свайп с фильтром
        stamp: () => { playTone(150, 'square', 0.5, 0.4, 20, true); playTone(80, 'sawtooth', 0.4, 0.3, 10); }, // Мощный удар поражения
        winStamp: () => { playTone(400, 'sine', 0.1, 0.2, 800); setTimeout(() => playTone(600, 'sine', 0.4, 0.2, 1200), 100); }, // Звук победы
        alarm: () => { playTone(600, 'square', 0.1, 0.05); setTimeout(() => playTone(800, 'square', 0.1, 0.05), 100); },
        ring: () => { for(let i=0; i<3; i++) { setTimeout(() => playTone(1000, 'sine', 0.1, 0.05), i*200); setTimeout(() => playTone(1300, 'sine', 0.1, 0.05), i*200 + 100); } },
        error: () => playTone(150, 'sawtooth', 0.4, 0.2, 50, true),
        msg: () => playTone(1500, 'sine', 0.1, 0.05, 2000),
        buy: () => { playTone(800, 'sine', 0.1, 0.1, 1200); setTimeout(() => playTone(1200, 'sine', 0.2, 0.1, 1600), 100); },
        setTension, 
        updateAmbient, 
        stopAmbient
    };
})();

/* =========================================================
   ВИЗУАЛЬНЫЕ УТИЛИТЫ И ЭФФЕКТЫ
========================================================= */

// Тактильный отклик для мобильных устройств
const vibrate = (pattern) => { 
    if (typeof window !== 'undefined' && 'navigator' in window && window.navigator.vibrate) {
        window.navigator.vibrate(pattern); 
    }
};

// Генератор частиц при свайпе
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

// Экспорт в глобальную область видимости
window.AudioEngine = AudioEngine;
window.vibrate = vibrate;
window.burstParticles = burstParticles;
