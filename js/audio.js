/* =========================================================
   ФАЙЛ: js/audio.js
   AAA-Аудиодвижок: Ducking, Стерео-панорама, Многослойность
========================================================= */

const AudioEngine = (() => {
    let ctx = null;
    let enabled = false;
    let masterGain = null;
    let bgmPlayer = null;
    let baseVolume = 0.25; // Базовая громкость музыки (25%)
    let duckTimeout = null;
    let fadeInterval = null;

    // 1. ИНИЦИАЛИЗАЦИЯ И РАЗБЛОКИРОВКА АУДИО (Для мобилок)
    const init = () => {
        if (ctx) return;
        
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        ctx = new AudioContextClass();
        masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);
        
        initBGM();

        // Предохранитель для iOS/Android (разблокировка контекста по клику)
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

    // 2. ФОНОВАЯ МУЗЫКА (MP3)
    const initBGM = () => {
        if (!bgmPlayer) {
            bgmPlayer = new Audio('assets/bgm.mp3');
            bgmPlayer.loop = true;
            bgmPlayer.volume = baseVolume;
        }
        bgmPlayer.play().catch(e => console.log('MP3 трек не найден. Положите bgm.mp3 в папку assets/'));
    };

    // 3. СИСТЕМА ПРИГЛУШЕНИЯ МУЗЫКИ (DUCKING)
    const duckMusic = (durationMs, dipVolume = 0.05) => {
        if (!bgmPlayer) return;
        
        clearInterval(fadeInterval);
        clearTimeout(duckTimeout);
        
        // Резко приглушаем музыку
        bgmPlayer.volume = dipVolume;
        
        // Плавно возвращаем громкость через заданное время
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

    // Плавная остановка музыки (Fade Out при проигрыше)
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

    // 4. БАЗОВЫЙ СИНТЕЗАТОР ЭФФЕКТОВ
    const playTone = (freq, type, duration, vol = 0.1, panValue = 0) => {
        if (!enabled || !ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        // Огибающая (ADSR - чтобы не было звуковых щелчков)
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        // Стерео-панорама (если поддерживается браузером)
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

    // 5. ЗВУК СВАЙПА (С ПРОСТРАНСТВЕННЫМ АУДИО)
    const playPaperSwipe = (direction = null) => {
        if (!enabled || !ctx) return;
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1; // Белый шум

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        // Срезаем частоты, чтобы звучало как плотная бумага/картон
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        // Определяем, в какое ухо пустить звук
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

    // 6. БИБЛИОТЕКА ИГРОВЫХ ЗВУКОВ
    return {
        init,
        // Свайп с передачей направления для 3D-звука
        swipe: (dir) => playPaperSwipe(dir), 
        
        // Удар печати (Многослойный: Саб-бас + щелчок)
        stamp: () => { 
            duckMusic(800, 0.02); // Сильно глушим музыку
            playTone(60, 'square', 0.6, 0.7); // Низкий тяжелый удар
            playTone(120, 'sawtooth', 0.3, 0.5); // Хруст
        }, 
        
        // Печать победы (Мажорный аккорд)
        winStamp: () => { 
            duckMusic(1500, 0.05);
            playTone(392, 'sine', 0.6, 0.3); // G4
            playTone(493, 'sine', 0.6, 0.3); // B4
            playTone(587, 'sine', 0.8, 0.4); // D5
        },
        
        // Сирена таймера
        alarm: () => { 
            duckMusic(500, 0.1);
            playTone(600, 'square', 0.2, 0.08); 
            setTimeout(() => playTone(800, 'square', 0.2, 0.08), 100); 
        },
        
        // Звонок телефона (Трель)
        ring: () => { 
            duckMusic(1200, 0.1);
            for(let i=0; i<3; i++) { 
                setTimeout(() => playTone(1000, 'sine', 0.1, 0.08), i*200); 
                setTimeout(() => playTone(1300, 'sine', 0.1, 0.08), i*200 + 100); 
            } 
        },
        
        // Ошибка (Нарушение ТБ)
        error: () => {
            duckMusic(400, 0.1);
            playTone(100, 'sawtooth', 0.4, 0.4);
        },
        
        // Новое сообщение в чате
        msg: () => {
            duckMusic(500, 0.15);
            playTone(1200, 'sine', 0.1, 0.05);
            setTimeout(() => playTone(1600, 'sine', 0.15, 0.05), 100);
        },
        
        // Покупка апгрейда
        buy: () => { 
            playTone(800, 'sine', 0.2, 0.1); 
            setTimeout(() => playTone(1200, 'sine', 0.4, 0.1), 100); 
        },
        
        // Остановка музыки
        stopBGM,

        // Пустые заглушки для совместимости с CardEngine (чтобы не переписывать логику React)
        setTension: () => {}, 
        startAmbient: () => {},
        updateAmbient: () => {},
        stopAmbient: () => stopBGM()
    };
})();

// Визуальные эффекты
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
