/* =========================================================
   ФАЙЛ: js/CardEngine.jsx
   Движок свайпов (ИСПРАВЛЕННЫЙ БАГ ЗАВИСАНИЯ И КНОПОК)
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
    const state = useRef({ x: 0, y: 0, rx: 0, ry: 0, isDragging: false, isFlying: false, startX: 0, startY: 0, currentPrediction: null });
    
    // ХРАНИЛИЩЕ СВЕЖИХ ДАННЫХ (Защита от зависания колоды)
    const latestProps = useRef({ card, onSwipe, isBurning });
    useEffect(() => {
        latestProps.current = { card, onSwipe, isBurning };
    }, [card, onSwipe, isBurning]);

    const SWIPE_THRESHOLD = 120; 
    const SPRING_TENSION = 0.15; 
    const FRICTION = 0.85;       

    const getReactionEmoji = (effects, defaultAvatar) => {
        if (!effects) return defaultAvatar;
        if (effects.safety < -15 || effects.budget < -20) return "😰"; 
        if (effects.loyalty < -15) return "🤬"; 
        if (effects.budget > 15 && effects.safety < 0) return "😏"; 
        if (effects.safety > 15 || effects.loyalty > 15) return "😇"; 
        return defaultAvatar; 
    };

    const updatePredictions = (x) => {
        const currentCard = latestProps.current.card;
        if (!currentCard) return;
        
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
                window.vibrate(10);
            }
        }
    };

    const updateTransform = () => {
        if (!cardRef.current) return;
        const { x, y, rx, ry } = state.current;
        
        const dragRotate = x * 0.05; 
        cardRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotateZ(${dragRotate}deg) rotateY(${ry}deg) rotateX(${rx}deg)`;

        const leftInd = cardRef.current.querySelector('.choice-left'); 
        const rightInd = cardRef.current.querySelector('.choice-right');
        if (leftInd) leftInd.style.opacity = x < -30 ? Math.min((Math.abs(x)-30)/50, 1) : 0;
        if (rightInd) rightInd.style.opacity = x > 30 ? Math.min((Math.abs(x)-30)/50, 1) : 0;

        const nextCardDOM = document.getElementById('next-card-element');
        if (nextCardDOM) {
            const swipeProgress = Math.min(Math.abs(x) / SWIPE_THRESHOLD, 1);
            nextCardDOM.style.opacity = state.current.isFlying ? 1 : swipeProgress;
        }

        updatePredictions(x);
    };

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

    // ГЛОБАЛЬНЫЕ СЛУШАТЕЛИ ДЛЯ ТЕЛЕФОНОВ
    useEffect(() => {
        const handleMove = (e) => {
            if (!state.current.isDragging || state.current.isFlying) return;
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

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

        // Вешаем слушатели на окно, включая touchcancel (решает проблему блокировки кнопок)
        window.addEventListener('mousemove', handleMove, { passive: false });
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp);
        window.addEventListener('touchcancel', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
            window.removeEventListener('touchcancel', handleUp);
        };
    }, []);

    const handleDown = (e) => {
        if (latestProps.current.isBurning || state.current.isFlying) return;
        state.current.isDragging = true;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        state.current.startX = clientX - state.current.x;
        state.current.startY = clientY - state.current.y;
        
        if (cardRef.current) {
            cardRef.current.style.transition = 'none';
        }
    };

    const triggerSwipe = (direction) => {
        state.current.isFlying = true;
        if (window.AudioEngine && window.AudioEngine.setTension) window.AudioEngine.setTension(0); 
        
        state.current.x = direction === 'right' ? window.innerWidth : -window.innerWidth; 
        state.current.y += 100; 
        
        if (cardRef.current) {
            cardRef.current.style.transition = 'transform 0.4s ease-in';
        }
        updateTransform(); 
        
        setTimeout(() => {
            // ИСПОЛЬЗУЕМ СВЕЖИЙ КОЛЛБЭК!
            latestProps.current.onSwipe(direction);
        }, 300);
    };

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

    useEffect(() => {
        state.current = { x: 0, y: 0, rx: 0, ry: 0, isDragging: false, isFlying: false, startX: 0, startY: 0, currentPrediction: null };
        if(cardRef.current) {
            cardRef.current.style.transition = 'none';
            cardRef.current.style.transform = `translate3d(0,0,0)`;
        }
        const nextCardDOM = document.getElementById('next-card-element');
        if (nextCardDOM) nextCardDOM.style.opacity = 0;
    }, [card]);

    // Кнопки обращаются сюда
    useImperativeHandle(card?.ref, () => ({
        forceSwipe: (dir) => {
            if (!state.current.isDragging && !state.current.isFlying && !latestProps.current.isBurning) triggerSwipe(dir);
        }
    }));

    if (!card) return null;

    return (
        <div className="card-stack">
            {nextCard && (
                <div id="next-card-element" className="next-card flex flex-col items-center justify-center opacity-0" style={{willChange: 'opacity'}}>
                    <div className="text-[6rem] opacity-20 grayscale">{nextCard.avatar}</div>
                </div>
            )}
            
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
