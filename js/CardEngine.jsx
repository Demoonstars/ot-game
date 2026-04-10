/* =========================================================
   ФАЙЛ: js/CardEngine.jsx
   Движок свайпов, пружинная физика, 3D-Параллакс и Pre-cognition
========================================================= */

const { useRef, useState, useEffect, useImperativeHandle } = React;

// Вспомогательный компонент для эффекта "печатающейся" карточки
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
    
    return <p dangerouslySetInnerHTML={highlightWords(displayed)} className="text-slate-700 text-[1.15rem] font-semibold text-center leading-relaxed relative z-10" />;
};


// Главный компонент карточки
const CardEngine = ({ card, nextCard, onSwipe, isBurning }) => {
    const cardRef = useRef(null);
    const state = useRef({ x: 0, y: 0, rx: 0, ry: 0, isDragging: false, isFlying: false, startX: 0, startY: 0, currentPrediction: null });

    const SWIPE_THRESHOLD = 120; 
    const SPRING_TENSION = 0.15; 
    const FRICTION = 0.85;       

    // Анализируем решение и выдаем эмоцию персонажа
    const getReactionEmoji = (effects, defaultAvatar) => {
        if (!effects) return defaultAvatar;
        if (effects.safety < -15 || effects.budget < -20) return "😰"; 
        if (effects.loyalty < -15) return "🤬"; 
        if (effects.budget > 15 && effects.safety < 0) return "😏"; 
        if (effects.safety > 15 || effects.loyalty > 15) return "😇"; 
        return defaultAvatar; 
    };

    // Прямая инъекция DOM для Предсказаний (60 FPS без лагов React State)
    const updatePredictions = (x) => {
        if (!card) return;
        const absX = Math.abs(x);
        const intensity = Math.min(absX / SWIPE_THRESHOLD, 1); 
        
        // Нагнетаем звуковое напряжение пропорционально свайпу
        if (window.AudioEngine) window.AudioEngine.setTension(intensity);

        const safetyUI = document.getElementById('gauge-safety');
        const budgetUI = document.getElementById('lcd-budget');
        const loyaltyUI = document.getElementById('bar-loyalty');
        const avatarUI = document.getElementById('card-avatar');
        const cardWrapUI = document.getElementById('card-wrapper');

        // СБРОС (Карточка в центре)
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

        // ПРЕДСКАЗАНИЕ ВЛЕВО ИЛИ ВПРАВО
        const dir = x < 0 ? 'left' : 'right';
        if (state.current.currentPrediction !== dir) {
            state.current.currentPrediction = dir;
            const effects = dir === 'left' ? card.onLeft : card.onRight;
            
            // Сбрасываем старые предсказания
            safetyUI?.classList.remove('gauge-predict-danger'); 
            budgetUI?.classList.remove('lcd-predict-danger'); 
            loyaltyUI?.classList.remove('gauge-predict-danger');
            
            // Включаем тревогу на приборах, если решение фатально
            if (effects.safety < -15) safetyUI?.classList.add('gauge-predict-danger');
            if (effects.budget < -15) budgetUI?.classList.add('lcd-predict-danger');
            if (effects.loyalty < -15) loyaltyUI?.classList.add('gauge-predict-danger');

            // Изменяем лицо персонажа
            if (avatarUI) avatarUI.innerText = getReactionEmoji(effects, card.avatar);
            if (cardWrapUI) cardWrapUI.classList.add('avatar-predict');
            
            // Легкая вибрация при понимании угрозы
            if ((effects.safety < -15 || effects.budget < -15 || effects.loyalty < -15) && window.vibrate) {
                window.vibrate(10);
            }
        }
    };

    // Расчет 3D-матрицы
    const updateTransform = () => {
        if (!cardRef.current) return;
        const { x, y, rx, ry } = state.current;
        
        // CSS Матрица для 3D
        cardRef.current.style.transform = `translate3d(${x}px, ${y + Math.abs(x)*0.05}px, 0) rotateZ(${x * 0.05}deg) rotateY(${(x * 0.08) + ry}deg) rotateX(${(Math.abs(x) * 0.03) + rx}deg)`;
        
        const glare = cardRef.current.querySelector('.glare');
        if (glare) {
            glare.style.opacity = Math.min(Math.abs(x)/150 + Math.abs(ry)/50, 0.5);
            glare.style.background = `linear-gradient(${(x * 0.5 + ry * 2) + 180}deg, rgba(255,255,255,1) 0%, transparent 60%)`;
        }

        const leftInd = cardRef.current.querySelector('.choice-left'); 
        const rightInd = cardRef.current.querySelector('.choice-right');
        if (leftInd) leftInd.style.opacity = x < -30 ? Math.min((Math.abs(x)-30)/50, 1) : 0;
        if (rightInd) rightInd.style.opacity = x > 30 ? Math.min((Math.abs(x)-30)/50, 1) : 0;

        updatePredictions(x);
    };

    // Пружинный цикл возврата в центр
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

    const handlePointerDown = (e) => {
        if (isBurning) return;
        state.current.isDragging = true;
        state.current.startX = (e.clientX || (e.touches && e.touches[0].clientX)) - state.current.x;
        state.current.startY = (e.clientY || (e.touches && e.touches[0].clientY)) - state.current.y;
    };

    const handlePointerMove = (e) => {
        // Параллакс от мыши (для ПК)
        if (!state.current.isDragging && e.type === 'mousemove' && !isBurning) {
            const rect = cardRef.current.getBoundingClientRect();
            state.current.rx = -((e.clientY - rect.top - rect.height/2) / rect.height) * 20; 
            state.current.ry = ((e.clientX - rect.left - rect.width/2) / rect.width) * 20;
            updateTransform(); 
            return;
        }
        if (!state.current.isDragging) return;
        
        // Добавляем резиновое сопротивление свайпу
        state.current.x = ((e.clientX || (e.touches && e.touches[0].clientX)) - state.current.startX) * 0.8; 
        state.current.y = ((e.clientY || (e.touches && e.touches[0].clientY)) - state.current.startY) * 0.8;
        updateTransform();
    };

    const handlePointerUp = () => {
        if (!state.current.isDragging) return;
        state.current.isDragging = false;
        if (state.current.x > SWIPE_THRESHOLD) triggerSwipe('right');
        else if (state.current.x < -SWIPE_THRESHOLD) triggerSwipe('left');
        else {
            if (window.AudioEngine) window.AudioEngine.setTension(0); // Сбрасываем звук натяжения
            requestAnimationFrame(springLoop); 
        }
    };

    const triggerSwipe = (direction) => {
        state.current.isFlying = true;
        if (window.AudioEngine) window.AudioEngine.setTension(0); 
        state.current.x = direction === 'right' ? window.innerWidth : -window.innerWidth; 
        state.current.y += 100; 
        updateTransform(); 
        onSwipe(direction);
    };

    // Гироскоп для мобилок (Параллакс)
    useEffect(() => {
        const handleOrientation = (e) => {
            if (state.current.isDragging || state.current.isFlying || isBurning) return;
            state.current.ry = Math.max(-20, Math.min(20, e.gamma ? e.gamma / 2 : 0)); 
            state.current.rx = Math.max(-20, Math.min(20, e.beta ? (e.beta - 45) / 2 : 0));
            updateTransform();
        };
        window.addEventListener('deviceorientation', handleOrientation);
        return () => window.removeEventListener('deviceorientation', handleOrientation);
    }, [isBurning]);

    // Сброс физики при новой карте
    useEffect(() => {
        state.current = { x: 0, y: 0, rx: 0, ry: 0, isDragging: false, isFlying: false, startX: 0, startY: 0, currentPrediction: null };
        if(cardRef.current) cardRef.current.style.transform = `translate3d(0,0,0)`;
    }, [card]);

    // Экспортируем функцию свайпа для кликов по кнопкам
    useImperativeHandle(card?.ref, () => ({
        forceSwipe: (dir) => {
            if (!state.current.isDragging && !state.current.isFlying && !isBurning) triggerSwipe(dir);
        }
    }));

    if (!card) return null;

    return (
        <div className="card-stack" onMouseMove={handlePointerMove} onTouchMove={handlePointerMove} onMouseUp={handlePointerUp} onTouchEnd={handlePointerUp} onMouseLeave={handlePointerUp}>
            {nextCard && <div className="next-card flex flex-center items-center justify-center"><div className="text-[5rem] opacity-20 grayscale">{nextCard.avatar}</div></div>}
            
            <div ref={cardRef} className={`swipe-card cursor-grab active:cursor-grabbing ${card.isUrgent?'urgent':''} ${isBurning ? 'animate-burn' : ''}`}
                style={{ transition: state.current.isFlying ? 'transform 0.4s ease-out' : 'none' }}
                onMouseDown={handlePointerDown} onTouchStart={handlePointerDown}
            >
                <div className="glare"></div>
                <div className="choice-indicator choice-left">{card.leftChoice}</div>
                <div className="choice-indicator choice-right">{card.rightChoice}</div>
                
                <div className={`relative z-10 bg-slate-50 rounded-t-[24px] p-4 flex flex-col items-center justify-center border-b h-[42%] ${card.isUrgent?'bg-rose-50':''}`}>
                    <div id="card-wrapper" className="avatar-wrapper text-[4.5rem] mb-1 filter drop-shadow-2xl">
                        <span id="card-avatar">{card.avatar}</span>
                    </div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight text-center leading-tight">{card.character}</h2>
                    <div className="mt-2 px-3 py-1 rounded-full font-black text-[10px] uppercase shadow-lg tracking-widest bg-blue-600 text-white">{card.role}</div>
                </div>
                <div className="p-4 flex-1 flex items-center justify-center bg-white rounded-b-[24px]">
                    <TypewriterText text={card.text} />
                </div>
            </div>
        </div>
    );
};

// Экспортируем в глобальную область для использования в App.jsx
window.CardEngine = CardEngine;
