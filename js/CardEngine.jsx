/* =========================================================
   ФАЙЛ: js/CardEngine.jsx
   Движок свайпов (ПУЛЕНЕПРОБИВАЕМЫЙ: Глобальные слушатели)
========================================================= */

const { useRef, useState, useEffect, useImperativeHandle } = React;

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
        const words = ["убью", "штраф", "срочно", "пожар", "вскрыть", "уволю", "быстро", "скорую", "кровь", "эвакуация", "травма", "смерть", "упал", "взрыв"];
        let res = str;
        words.forEach(w => { 
            const regex = new RegExp(`(${w})`, 'gi'); 
            res = res.replace(regex, '<span class="text-rose-600 font-black animate-shake inline-block">$&</span>'); 
        });
        return { __html: res };
    };
    
    return <p dangerouslySetInnerHTML={highlightWords(displayed)} className="text-slate-800 text-[1.15rem] font-semibold text-center leading-relaxed relative z-10 pointer-events-none" />;
};

const CardEngine = ({ card, nextCard, onSwipe, isBurning }) => {
    const cardRef = useRef(null);
    // Храним всю математику в useRef, чтобы не вызывать ререндеры React
    const state = useRef({ x: 0, y: 0, rx: 0, ry: 0, isDragging: false, isFlying: false, startX: 0, startY: 0, currentPrediction: null });

    const SWIPE_THRESHOLD = 120; 

    // Эмоции персонажа при оттягивании
    const getReactionEmoji = (effects, defaultAvatar) => {
        if (!effects) return defaultAvatar;
        if (effects.safety < -15 || effects.budget < -20) return "😰"; 
        if (effects.loyalty < -15) return "🤬"; 
        if (effects.budget > 15 && effects.safety < 0) return "😏"; 
        if (effects.safety > 15 || effects.loyalty > 15) return "😇"; 
        return defaultAvatar; 
    };

    // Прямая инъекция в DOM для приборов (без лагов)
    const updatePredictions = (x) => {
        if (!card) return;
        const absX = Math.abs(x);
        const intensity = Math.min(absX / SWIPE_THRESHOLD, 1); 
        
        if (window.AudioEngine && window.AudioEngine.setTension) {
            window.AudioEngine.setTension(intensity);
        }

        const safetyUI = document.getElementById('gauge-safety');
        const budgetUI = document.getElementById('lcd-budget');
        const loyaltyUI = document.getElementById('bar-loyalty');
        const avatarUI = document.getElementById('card-avatar');
        const cardWrapUI = document.getElementById('card-wrapper');

        // Если карта в центре - сбрасываем тревогу
        if (absX < 30) {
            if (state.current.currentPrediction !== null) {
                safetyUI?.classList.remove('gauge-predict-danger'); 
                budgetUI?.classList.remove('lcd-predict-danger'); 
                loyaltyUI?.classList.remove('gauge-predict-danger');
                if (avatarUI) avatarUI.innerText = card.avatar;
                if (cardWrapUI) cardWrapUI.classList.remove('avatar-predict');
                state.current.currentPrediction = null;
            }
            return;
        }

        // Если потянули - предсказываем последствия
        const dir = x < 0 ? 'left' : 'right';
        if (state.current.currentPrediction !== dir) {
            state.current.currentPrediction = dir;
            const effects = dir === 'left' ? card.onLeft : card.onRight;
            
            safetyUI?.classList.remove('gauge-predict-danger'); 
            budgetUI?.classList.remove('lcd-predict-danger'); 
            loyaltyUI?.classList.remove('gauge-predict-danger');
            
            if (effects.safety < -15) safetyUI?.classList.add('gauge-predict-danger');
            if (effects.budget < -15) budgetUI?.classList.add('lcd-predict-danger');
            if (effects.loyalty < -15) loyaltyUI?.classList.add('gauge-predict-danger');

            if (avatarUI) avatarUI.innerText = getReactionEmoji(effects, card.avatar);
            if (cardWrapUI) cardWrapUI.classList.add('avatar-predict');
            
            if ((effects.safety < -15 || effects.budget < -15 || effects.loyalty < -15) && window.vibrate) {
                window.vibrate(10);
            }
        }
    };

    // Применение трансформаций и эффектов к DOM
    const updateTransform = () => {
        if (!cardRef.current) return;
        const { x, y, rx, ry } = state.current;
        
        // Поворот карточки при свайпе (Tinder эффект)
        const dragRotate = x * 0.05; 
        
        cardRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotateZ(${dragRotate}deg) rotateY(${ry}deg) rotateX(${rx}deg)`;

        const leftInd = cardRef.current.querySelector('.choice-left'); 
        const rightInd = cardRef.current.querySelector('.choice-right');
        if (leftInd) leftInd.style.opacity = x < -30 ? Math.min((Math.abs(x)-30)/50, 1) : 0;
        if (rightInd) rightInd.style.opacity = x > 30 ? Math.min((Math.abs(x)-30)/50, 1) : 0;

        // Проявление нижней карты
        const nextCardDOM = document.getElementById('next-card-element');
        if (nextCardDOM) {
            const swipeProgress = Math.min(Math.abs(x) / SWIPE_THRESHOLD, 1);
            nextCardDOM.style.opacity = state.current.isFlying ? 1 : swipeProgress;
        }

        updatePredictions(x);
    };

    // ==========================================
    // ЛОГИКА ГЛОБАЛЬНОГО ДРАГА (ПУЛЕНЕПРОБИВАЕМАЯ)
    // ==========================================
    useEffect(() => {
        const handleMove = (e) => {
            if (!state.current.isDragging || state.current.isFlying) return;
            
            // Поддержка и мыши, и тачскрина
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            // Натяжение резинкой (умножаем на 0.8)
            state.current.x = (clientX - state.current.startX) * 0.8; 
            state.current.y = (clientY - state.current.startY) * 0.8;
            updateTransform();
        };

        const handleUp = () => {
            if (!state.current.isDragging || state.current.isFlying) return;
            state.current.isDragging = false;

            if (state.current.x > SWIPE_THRESHOLD) {
                triggerSwipe('right');
            } else if (state.current.x < -SWIPE_THRESHOLD) {
                triggerSwipe('left');
            } else {
                // Если не дотянули - возвращаем в центр с красивой анимацией
                if (window.AudioEngine && window.AudioEngine.setTension) window.AudioEngine.setTension(0);
                
                state.current.x = 0; 
                state.current.y = 0; 
                state.current.rx = 0; 
                state.current.ry = 0;
                
                if (cardRef.current) {
                    cardRef.current.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                }
                updateTransform();
            }
        };

        // Вешаем слушатели на ВЕСЬ экран
        window.addEventListener('mousemove', handleMove, { passive: false });
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
        };
    }, []);

    // Старт драга (вешается на саму карточку)
    const handleDown = (e) => {
        if (isBurning || state.current.isFlying) return;
        state.current.isDragging = true;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        state.current.startX = clientX - state.current.x;
        state.current.startY = clientY - state.current.y;
        
        // Выключаем CSS-анимации, чтобы карта мгновенно прилипла к пальцу
        if (cardRef.current) {
            cardRef.current.style.transition = 'none';
        }
    };

    // Функция отлета карты
    const triggerSwipe = (direction) => {
        state.current.isFlying = true;
        if (window.AudioEngine && window.AudioEngine.setTension) window.AudioEngine.setTension(0); 
        
        state.current.x = direction === 'right' ? window.innerWidth : -window.innerWidth; 
        state.current.y += 100; 
        
        if (cardRef.current) {
            cardRef.current.style.transition = 'transform 0.4s ease-in';
        }
        updateTransform(); 
        
        // Ждем пока карта улетит, затем вызываем игровую логику
        setTimeout(() => {
            onSwipe(direction);
        }, 300);
    };

    // Гироскоп (Параллакс)
    useEffect(() => {
        const handleOrientation = (e) => {
            if (state.current.isDragging || state.current.isFlying || isBurning) return;
            state.current.ry = Math.max(-15, Math.min(15, e.gamma ? e.gamma / 2 : 0)); 
            state.current.rx = Math.max(-15, Math.min(15, e.beta ? (e.beta - 45) / 2 : 0));
            
            if (cardRef.current && !state.current.isDragging) {
                cardRef.current.style.transition = 'transform 0.1s linear';
                updateTransform();
            }
        };
        window.addEventListener('deviceorientation', handleOrientation);
        return () => window.removeEventListener('deviceorientation', handleOrientation);
    }, [isBurning]);

    // Сброс при новой карте
    useEffect(() => {
        state.current = { x: 0, y: 0, rx: 0, ry: 0, isDragging: false, isFlying: false, startX: 0, startY: 0, currentPrediction: null };
        if(cardRef.current) {
            cardRef.current.style.transition = 'none';
            cardRef.current.style.transform = `translate3d(0,0,0)`;
        }
        const nextCardDOM = document.getElementById('next-card-element');
        if (nextCardDOM) nextCardDOM.style.opacity = 0;
    }, [card]);

    // Экспорт функции свайпа для нижних кнопок "Разрешить/Отказать"
    useImperativeHandle(card?.ref, () => ({
        forceSwipe: (dir) => {
            if (!state.current.isDragging && !state.current.isFlying && !isBurning) triggerSwipe(dir);
        }
    }));

    if (!card) return null;

    return (
        <div className="card-stack">
            
            {/* НИЖНЯЯ КАРТА */}
            {nextCard && (
                <div id="next-card-element" className="next-card flex flex-col items-center justify-center opacity-0" style={{willChange: 'opacity'}}>
                    <div className="text-[6rem] opacity-20 grayscale">{nextCard.avatar}</div>
                </div>
            )}
            
            {/* ТЕКУЩАЯ КАРТА */}
            <div ref={cardRef} className={`swipe-card cursor-grab active:cursor-grabbing ${card.isUrgent?'urgent':''} ${isBurning ? 'animate-burn' : ''}`}
                onMouseDown={handleDown}
                onTouchStart={handleDown}
            >
                <div className="choice-indicator choice-left">{card.leftChoice}</div>
                <div className="choice-indicator choice-right">{card.rightChoice}</div>
                
                <div className={`relative z-10 bg-slate-50 rounded-t-[36px] p-4 flex flex-col items-center justify-center border-b border-slate-200 h-[45%] ${card.isUrgent?'bg-rose-50':''} pointer-events-none`}>
                    <div id="card-wrapper" className="avatar-wrapper text-[5rem] mb-2 filter drop-shadow-2xl">
                        <span id="card-avatar">{card.avatar}</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight text-center leading-tight">{card.character}</h2>
                    <div className="mt-2 px-4 py-1.5 rounded-full font-black text-[11px] uppercase shadow-lg tracking-widest bg-blue-600 text-white">{card.role}</div>
                </div>
                <div className="p-6 flex-1 flex items-center justify-center bg-white rounded-b-[36px] pointer-events-none">
                    <TypewriterText text={card.text} />
                </div>
            </div>
        </div>
    );
};

window.CardEngine = CardEngine;
