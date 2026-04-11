/* =========================================================
   ФАЙЛ: js/CardEngine.jsx
   AAA-Движок: Продвинутая физика, 3D-Освещение, Бесшовная смена
========================================================= */

const { useRef, useState, useEffect, useImperativeHandle } = React;

// Компонент печатающегося текста (без изменений, он идеален)
const TypewriterText = ({ text }) => {
    const [displayed, setDisplayed] = useState("");
    
    useEffect(() => {
        setDisplayed(""); 
        let i = 0;
        const timer = setInterval(() => { 
            setDisplayed(text.slice(0, i + 1)); 
            i++; 
            if (i >= text.length) clearInterval(timer); 
        }, 15);
        return () => clearInterval(timer);
    }, [text]);
    
    const highlightWords = (str) => {
        const words = ["убью", "штраф", "срочно", "пожар", "вскрыть", "уволю", "быстро", "скорую", "кровь", "эвакуация", "травма", "смерть", "упал", "взрыв", "катастрофа", "ампутация"];
        let res = str;
        words.forEach(w => { 
            const regex = new RegExp(`(${w})`, 'gi'); 
            res = res.replace(regex, '<span class="text-rose-600 font-black animate-shake inline-block drop-shadow-md">$&</span>'); 
        });
        return { __html: res };
    };
    
    return <p dangerouslySetInnerHTML={highlightWords(displayed)} className="text-slate-800 text-[1.15rem] font-semibold text-center leading-relaxed relative z-10 pointer-events-none" />;
};

const CardEngine = ({ card, nextCard, onSwipe, isBurning }) => {
    const cardRef = useRef(null);
    const nextCardRef = useRef(null);
    const glareRef = useRef(null);
    
    // Вся математика в useRef (0 лагов, 60 FPS)
    const state = useRef({ 
        x: 0, y: 0, rx: 0, ry: 0, 
        isDragging: false, isFlying: false, 
        startX: 0, startY: 0, currentPrediction: null 
    });

    // Свежие пропсы для безопасных коллбэков
    const latestProps = useRef({ card, onSwipe, isBurning });
    useEffect(() => { latestProps.current = { card, onSwipe, isBurning }; }, [card, onSwipe, isBurning]);

    const SWIPE_THRESHOLD = 130; // Чуть увеличил порог для солидности
    const SPRING_TENSION = 0.12; // Плавный возврат пружины
    const FRICTION = 0.85;       

    // Реакция аватарки на плохие решения
    const getReactionEmoji = (effects, defaultAvatar) => {
        if (!effects) return defaultAvatar;
        if (effects.safety < -15 || effects.budget < -20) return "😰"; 
        if (effects.loyalty < -15) return "🤬"; 
        if (effects.budget > 15 && effects.safety < 0) return "😏"; 
        if (effects.safety > 15 || effects.loyalty > 15) return "😇"; 
        return defaultAvatar; 
    };

    // Обновление приборов на столе (Инъекция DOM)
    const updatePredictions = (x) => {
        const currentCard = latestProps.current.card;
        if (!currentCard) return;
        
        const absX = Math.abs(x);
        const intensity = Math.min(absX / SWIPE_THRESHOLD, 1); 
       
        if (window.AudioEngine && window.AudioEngine.setTension) window.AudioEngine.setTension(0); 
        if (window.AudioEngine && window.AudioEngine.swipe) window.AudioEngine.swipe(direction); // Добавили эту строчку!
        }
       
        const safetyUI = document.getElementById('gauge-safety');
        const budgetUI = document.getElementById('lcd-budget');
        const loyaltyUI = document.getElementById('bar-loyalty');
        const avatarUI = document.getElementById('card-avatar');
        const cardWrapUI = document.getElementById('card-wrapper');

        // Сброс тревоги
        if (absX < 30) {
            if (state.current.currentPrediction !== null) {
                safetyUI?.classList.remove('gauge-predict-danger'); 
                budgetUI?.classList.remove('lcd-predict-danger'); 
                loyaltyUI?.classList.remove('gauge-predict-danger');
                if (avatarUI) avatarUI.innerText = currentCard.avatar;
                if (cardWrapUI) cardWrapUI.classList.remove('avatar-predict');
                state.current.currentPrediction = null;
            }
            return;
        }

        // Включение тревоги при натяжении
        const dir = x < 0 ? 'left' : 'right';
        if (state.current.currentPrediction !== dir) {
            state.current.currentPrediction = dir;
            const effects = dir === 'left' ? currentCard.onLeft : currentCard.onRight;
            
            safetyUI?.classList.remove('gauge-predict-danger'); 
            budgetUI?.classList.remove('lcd-predict-danger'); 
            loyaltyUI?.classList.remove('gauge-predict-danger');
            
            if (effects.safety < -15) safetyUI?.classList.add('gauge-predict-danger');
            if (effects.budget < -15) budgetUI?.classList.add('lcd-predict-danger');
            if (effects.loyalty < -15) loyaltyUI?.classList.add('gauge-predict-danger');

            if (avatarUI) avatarUI.innerText = getReactionEmoji(effects, currentCard.avatar);
            if (cardWrapUI) cardWrapUI.classList.add('avatar-predict');
            
            if ((effects.safety < -15 || effects.budget < -15 || effects.loyalty < -15) && window.vibrate) {
                window.vibrate(15);
            }
        }
    };

    // ГЛАВНЫЙ РЕНДЕР КАДРА (Математика позиций)
    const updateTransform = () => {
        if (!cardRef.current) return;
        const { x, y, rx, ry, isDragging } = state.current;
        
        // 1. Физика активной карты (Вращение от нижнего края + увеличение при клике)
        const dragRotate = x * 0.06; 
        const scale = isDragging ? 1.03 : 1; 
        cardRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotateZ(${dragRotate}deg) rotateY(${ry}deg) rotateX(${rx}deg)`;
        
        // Динамическая тень: при отрыве от экрана становится глубже
        cardRef.current.style.boxShadow = isDragging 
            ? `0 50px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.2) inset` 
            : `0 30px 60px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.1) inset`;

        // 2. 3D-Блик (Голографический эффект луча)
        if (glareRef.current) {
            const intensity = Math.min(Math.abs(x)/200 + Math.abs(ry)/30, 0.6);
            glareRef.current.style.opacity = intensity;
            glareRef.current.style.background = `linear-gradient(${105 + x * 0.5 + ry * 2}deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 80%)`;
        }

        // 3. Индикаторы выбора (Разрешить / Отказать)
        const leftInd = cardRef.current.querySelector('.choice-left'); 
        const rightInd = cardRef.current.querySelector('.choice-right');
        if (leftInd) leftInd.style.opacity = x < -30 ? Math.min((Math.abs(x)-30)/60, 1) : 0;
        if (rightInd) rightInd.style.opacity = x > 30 ? Math.min((Math.abs(x)-30)/60, 1) : 0;

        // 4. КИНЕМАТОГРАФИЧНОЕ ПОЯВЛЕНИЕ НИЖНЕЙ КАРТЫ (Решение бага просвечивания)
        if (nextCardRef.current) {
            const swipeProgress = Math.min(Math.abs(x) / SWIPE_THRESHOLD, 1);
            // Карта "вырастает" из 0.9 scale в 1.0 и плавно появляется из 0 opacity
            const nextScale = 0.9 + (swipeProgress * 0.1); 
            nextCardRef.current.style.transform = `scale(${nextScale}) translateY(${25 - (swipeProgress * 25)}px)`;
            nextCardRef.current.style.opacity = state.current.isFlying ? 1 : swipeProgress;
        }

        updatePredictions(x);
    };

    // Пружинный возврат, если не дотянули
    const springLoop = () => {
        if (state.current.isDragging || state.current.isFlying) return;
        state.current.x += (0 - state.current.x) * SPRING_TENSION;
        state.current.y += (0 - state.current.y) * SPRING_TENSION;
        state.current.rx *= FRICTION; 
        state.current.ry *= FRICTION;
        updateTransform();

        if (Math.abs(state.current.x) > 0.5 || Math.abs(state.current.ry) > 0.5) {
            requestAnimationFrame(springLoop);
        } else {
            state.current.x = 0; state.current.y = 0; state.current.rx = 0; state.current.ry = 0;
            updateTransform();
        }
    };

    // ==========================================
    // ПУЛЕНЕПРОБИВАЕМЫЕ СОБЫТИЯ (Pointer Capture)
    // ==========================================
    const handlePointerDown = (e) => {
        if (latestProps.current.isBurning || state.current.isFlying) return;
        e.target.setPointerCapture(e.pointerId); // Захват пальца/мыши железобетонно
        
        state.current.isDragging = true;
        state.current.startX = e.clientX - state.current.x;
        state.current.startY = e.clientY - state.current.y;
        
        if (cardRef.current) cardRef.current.style.transition = 'none';
        updateTransform(); // Вызов для эффекта "Pop-up"
    };

    const handlePointerMove = (e) => {
        // Параллакс, когда просто водим мышкой по карте
        if (!state.current.isDragging && e.pointerType === 'mouse' && !state.current.isFlying) {
            const rect = cardRef.current.getBoundingClientRect();
            state.current.rx = -((e.clientY - rect.top - rect.height/2) / rect.height) * 15; 
            state.current.ry = ((e.clientX - rect.left - rect.width/2) / rect.width) * 15;
            if (cardRef.current) cardRef.current.style.transition = 'transform 0.1s linear';
            updateTransform(); 
            return;
        }
        
        if (!state.current.isDragging) return;
        
        // Резиновое сопротивление (0.85)
        state.current.x = (e.clientX - state.current.startX) * 0.85; 
        state.current.y = (e.clientY - state.current.startY) * 0.85;
        updateTransform();
    };

    const handlePointerUp = (e) => {
        if (!state.current.isDragging) return;
        try { e.target.releasePointerCapture(e.pointerId); } catch(err) {}
        
        state.current.isDragging = false;

        if (state.current.x > SWIPE_THRESHOLD) triggerSwipe('right');
        else if (state.current.x < -SWIPE_THRESHOLD) triggerSwipe('left');
        else {
            if (window.AudioEngine && window.AudioEngine.setTension) window.AudioEngine.setTension(0);
            if (cardRef.current) cardRef.current.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease';
            requestAnimationFrame(springLoop); 
        }
    };

    // Вылет карты с экрана
    const triggerSwipe = (direction) => {
        state.current.isFlying = true;
        if (window.AudioEngine && window.AudioEngine.setTension) window.AudioEngine.setTension(0); 
        
        state.current.x = direction === 'right' ? window.innerWidth + 100 : -window.innerWidth - 100; 
        state.current.y += 150; 
        
        if (cardRef.current) cardRef.current.style.transition = 'transform 0.35s ease-in, opacity 0.3s';
        updateTransform(); 
        
        // Вызов следующего хода
        setTimeout(() => { latestProps.current.onSwipe(direction); }, 350);
    };

    // Гироскоп (Параллакс)
    useEffect(() => {
        const handleOrientation = (e) => {
            if (state.current.isDragging || state.current.isFlying || latestProps.current.isBurning) return;
            state.current.ry = Math.max(-15, Math.min(15, e.gamma ? e.gamma / 2 : 0)); 
            state.current.rx = Math.max(-15, Math.min(15, e.beta ? (e.beta - 45) / 2 : 0));
            if (cardRef.current && !state.current.isDragging) {
                cardRef.current.style.transition = 'transform 0.1s linear';
                updateTransform();
            }
        };
        window.addEventListener('deviceorientation', handleOrientation);
        return () => window.removeEventListener('deviceorientation', handleOrientation);
    }, []);

    // Сброс стейта при выдаче новой карты
    useEffect(() => {
        state.current = { x: 0, y: 0, rx: 0, ry: 0, isDragging: false, isFlying: false, startX: 0, startY: 0, currentPrediction: null };
        if(cardRef.current) {
            cardRef.current.style.transition = 'none';
            cardRef.current.style.transform = `translate3d(0,0,0) scale(1)`;
            cardRef.current.style.boxShadow = `0 30px 60px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.1) inset`;
        }
        if (glareRef.current) glareRef.current.style.opacity = 0;
        if (nextCardRef.current) {
            nextCardRef.current.style.transform = 'scale(0.9) translateY(25px)';
            nextCardRef.current.style.opacity = 0;
        }
    }, [card]);

    // Экспорт для кнопок внизу
    useImperativeHandle(card?.ref, () => ({
        forceSwipe: (dir) => { if (!state.current.isDragging && !state.current.isFlying && !latestProps.current.isBurning) triggerSwipe(dir); }
    }));

    if (!card) return null;

    return (
        <div className="relative w-full max-w-[360px] aspect-[3/4.2] mx-auto perspective-[1500px] z-10 select-none">
            
            {/* НИЖНЯЯ КАРТА (Абсолютно спрятана в начале) */}
            {nextCard && (
                <div ref={nextCardRef} className="absolute inset-0 bg-slate-200 rounded-[36px] flex flex-col items-center justify-center opacity-0 border border-slate-300 shadow-[0_15px_30px_rgba(0,0,0,0.5)] will-change-[transform,opacity] pointer-events-none" style={{ transformOrigin: 'center bottom' }}>
                    <div className="text-[6rem] opacity-20 grayscale filter drop-shadow-md">{nextCard.avatar}</div>
                </div>
            )}
            
            {/* ГЛАВНАЯ КАРТА */}
            <div ref={cardRef} 
                className={`absolute inset-0 bg-white rounded-[36px] flex flex-col will-change-transform transform-style-3d cursor-grab active:cursor-grabbing origin-bottom ${card.isUrgent?'bg-rose-50 border-2 border-rose-300':''} ${isBurning ? 'animate-burn' : ''}`}
                style={{ touchAction: 'none', transformOrigin: '50% 120%' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                {/* 3D БЛИК */}
                <div ref={glareRef} className="absolute inset-0 rounded-[36px] pointer-events-none z-20 transition-opacity duration-200 opacity-0 mix-blend-overlay"></div>
                
                {/* ИНДИКАТОРЫ */}
                <div className="choice-indicator choice-left pointer-events-none">{card.leftChoice}</div>
                <div className="choice-indicator choice-right pointer-events-none">{card.rightChoice}</div>
                
                {/* ВЕРХНЯЯ ЧАСТЬ (Персонаж) */}
                <div className="relative z-10 bg-slate-50/50 rounded-t-[36px] p-4 flex flex-col items-center justify-center border-b border-slate-100 h-[45%] pointer-events-none">
                    <div id="card-wrapper" className="avatar-wrapper text-[5rem] mb-2 filter drop-shadow-[0_15px_15px_rgba(0,0,0,0.2)]">
                        <span id="card-avatar">{card.avatar}</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight text-center leading-tight drop-shadow-sm">{card.character}</h2>
                    <div className="mt-2 px-4 py-1.5 rounded-full font-black text-[11px] uppercase shadow-[0_5px_10px_rgba(37,99,235,0.3)] tracking-widest bg-blue-600 text-white">{card.role}</div>
                </div>
                
                {/* НИЖНЯЯ ЧАСТЬ (Текст) */}
                <div className="p-6 flex-1 flex items-center justify-center bg-white rounded-b-[36px] pointer-events-none">
                    <TypewriterText text={card.text} />
                </div>
            </div>
        </div>
    );
};

window.CardEngine = CardEngine;
