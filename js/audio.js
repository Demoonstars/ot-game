/* =========================================================
   ФАЙЛ: js/audio.js
   ШЕДЕВРАЛЬНЫЙ АУДИОДВИЖОК (Процедурная реверберация и ADSR)
========================================================= */

const AudioEngine = (() => {
    let ctx = null; 
    let enabled = false; 
    let convolver = null; // Виртуальная комната (эхо)
    let masterGain = null;
    let tensionOsc = null; 
    let tensionGain = null;
    let ambientActive = false; 
    let humOsc, humGain, heartOsc1, heartOsc2, heartGain;

    // ГЕНЕРАТОР ВИРТУАЛЬНОЙ КОМНАТЫ (Impulse Response)
    const createReverb = () => {
        const length = ctx.sampleRate * 1.5; // Длина эха 1.5 секунды
        const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let i = 0; i < 2; i++) {
            const channel = impulse.getChannelData(i);
            for (let j = 0; j < length; j++) {
                // Белый шум с экспоненциальным затуханием (имитация отражения звука от стен)
                channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 4); 
            }
        }
        convolver = ctx.createConvolver();
        convolver.buffer = impulse;
    };

    const init = () => { 
        if (!ctx) { 
            ctx = new (window.AudioContext || window.webkitAudioContext)(); 
            masterGain = ctx.createGain();
            masterGain.connect(ctx.destination);
            createReverb();
        } 
        if (ctx.state === 'suspended') ctx.resume(); 
        enabled = true; 
    };

    // УМНЫЙ СИНТЕЗАТОР С ОГИБАЮЩЕЙ (ADSR)
    const playTone = (freq, type, duration, vol = 0.1, isReverb = false) => {
        if (!enabled || !ctx) return;
        const osc = ctx.createOscillator(); 
        const gain = ctx.createGain();
        osc.type = type; 
        
        // Маршрутизация: пускать звук сухо или через эхо-комнату
        if (isReverb) {
            osc.connect(gain);
            gain.connect(convolver);
            convolver.connect(masterGain);
        } else {
            osc.connect(gain);
            gain.connect(masterGain);
        }

        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        // ADSR Огибающая (Мягкий старт и плавный спад, чтобы не было щелчков)
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.05); // Attack
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration); // Decay
        
        osc.start(); 
        osc.stop(ctx.currentTime + duration + 0.1);
    };

    // Шуршащий звук бумажной карточки (Белый шум через фильтр)
    const playPaperSwipe = () => {
        if (!enabled || !ctx) return;
        const bufferSize = ctx.sampleRate * 0.2; // 0.2 секунды
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        const noise = ctx.createBufferSource(); noise.buffer = buffer;
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1000;
        const gain = ctx.createGain();
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        
        noise.connect(filter); filter.connect(gain); gain.connect(masterGain);
        noise.start();
    };
    
    // Напряжение при натягивании карточки (Низкий рокот)
    const setTension = (intensity) => {
        if (!enabled || !ctx) return;
        if (intensity <= 0.1) {
            if (tensionGain) tensionGain.gain.setTargetAtTime(0.001, ctx.currentTime, 0.1); 
            return;
        }
        if (!tensionOsc) {
            tensionOsc = ctx.createOscillator(); tensionGain = ctx.createGain();
            tensionOsc.type = 'sawtooth'; tensionOsc.frequency.value = 40; 
            const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 200;
            tensionOsc.connect(lpf); lpf.connect(tensionGain); tensionGain.connect(masterGain);
            tensionGain.gain.value = 0.001; tensionOsc.start();
        }
        tensionGain.gain.setTargetAtTime(intensity * 0.2, ctx.currentTime, 0.1); 
        tensionOsc.frequency.setTargetAtTime(30 + (intensity * 40), ctx.currentTime, 0.1);
    };

    // Эмбиент с двойным саб-басом
    const startAmbient = () => {
        if(!enabled || ambientActive) return;
        ambientActive = true;
        
        humOsc = ctx.createOscillator(); humGain = ctx.createGain();
        humOsc.type = 'sine'; humOsc.frequency.value = 55;
        humGain.gain.value = 0.05;
        humOsc.connect(humGain).connect(masterGain);
        humOsc.start();

        // Сердцебиение из двух расстроенных осцилляторов (плотный бас)
        heartOsc1 = ctx.createOscillator(); heartOsc2 = ctx.createOscillator(); 
        heartGain = ctx.createGain();
        heartOsc1.type = 'sine'; heartOsc1.frequency.value = 45;
        heartOsc2.type = 'sine'; heartOsc2.frequency.value = 46; // Легкий диссонанс
        heartGain.gain.value = 0; 
        
        const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1.3;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 1;
        lfo.connect(lfoGain).connect(heartGain.gain);
        lfo.start();
        
        heartOsc1.connect(heartGain).connect(masterGain);
        heartOsc2.connect(heartGain).connect(masterGain);
        heartOsc1.start(); heartOsc2.start();
    };

    const updateAmbient = (stats) => {
        if (!enabled || !ambientActive) return;
        if (stats.safety < 30) heartGain.gain.setTargetAtTime(0.6, ctx.currentTime, 1);
        else heartGain.gain.setTargetAtTime(0, ctx.currentTime, 1);
    };

    const stopAmbient = () => {
        if(!ambientActive) return;
        humGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        heartGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        setTimeout(() => { 
            if(humOsc) humOsc.stop(); if(heartOsc1) heartOsc1.stop(); if(heartOsc2) heartOsc2.stop();
            ambientActive = false; 
        }, 600);
    };

    return {
        init, 
        swipe: () => playPaperSwipe(), // Новый звук свайпа
        stamp: () => { 
            playTone(100, 'square', 0.4, 0.5, true); // Мощный удар в реверберацию
            playTone(50, 'sawtooth', 0.3, 0.4, true); 
        }, 
        winStamp: () => { 
            playTone(400, 'sine', 0.6, 0.2, true); 
            setTimeout(() => playTone(600, 'sine', 0.8, 0.2, true), 150); 
        },
        alarm: () => { playTone(600, 'square', 0.2, 0.05); setTimeout(() => playTone(800, 'square', 0.2, 0.05), 100); },
        ring: () => { for(let i=0; i<3; i++) { setTimeout(() => playTone(1000, 'sine', 0.1, 0.05), i*200); setTimeout(() => playTone(1300, 'sine', 0.1, 0.05), i*200 + 100); } },
        error: () => playTone(150, 'sawtooth', 0.4, 0.2, false),
        msg: () => playTone(1500, 'sine', 0.1, 0.05),
        buy: () => { playTone(800, 'sine', 0.2, 0.1); setTimeout(() => playTone(1200, 'sine', 0.4, 0.1), 100); },
        setTension, updateAmbient, stopAmbient, startAmbient
    };
})();

window.AudioEngine = AudioEngine;
