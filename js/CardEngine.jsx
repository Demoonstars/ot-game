/* =========================================================
   ФАЙЛ: js/CardEngine.jsx
   AAA-Движок: Высокая производительность (60 FPS Mobile)
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
        const words = ["убью", "штраф", "срочно", "пожар", "вскрыть", "уволю", "быстро", "скорую", "кровь", "эвакуация", "травма", "смерть", "упал", "взрыв", "катастрофа", "ампутация"];
        let res = str;
        words.forEach(w => { 
            const regex = new RegExp(`(${w})`, 'gi'); 
            res = res.replace(regex, '<span class="text-rose-600 font-black inline-block">$&</span>'); 
        });
        return { __html: res };
    };
    
    return <p dangerouslySetInnerHTML={highlightWords(displayed)} className="text-slate-800 text-[1.05rem] font-semibold text-center leading-snug relative z-10 pointer-events-none" />;
};

const CardEngine = ({ card, nextCard, onSwipe, isBurning }) => {
    const cardRef = useRef(null);
    const nextCardRef = useRef(null);
    const glareRef = useRef(null);
    
    const state = useRef({ x: 0, y: 0, rx: 0, ry: 0, isDragging: false, isFlying: false, startX: 0, startY: 0 });
    const latestProps = useRef({ card, onSwipe, isBurning });

    useEffect(() => { latestProps.current = { card, onSwipe, isBurning }; }, [card, onSwipe, isBurning]);

    const SWIPE_THRESHOLD = 110; // Немного снизил порог для легкого свайпа на мобилках
    const SPRING_TENSION = 0.15; 
    const FRICTION = 0.85;       

    const updateTransform = () => {
        if (!cardRef.current) return;
        const { x, y, rx, ry, isDragging } = state.current;
        
        const dragRotate = x * 0.05; 
        const scale = isDragging ? 1.02 : 1; 
        
        // ОПТИМИЗАЦИЯ: translate3d включает аппаратное ускорение на 100%
        cardRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotateZ(${dragRotate}deg) rotateY(${ry}deg) rotateX(${rx}deg)`;

        // ОПТИМИЗАЦИЯ БЛИКА: Оставили градиент, убрали тяжелые расчеты
        if (glareRef.current && !isDragging) {
            const intensity = Math.min(Math.abs(rx)/40 + Math.abs(ry)/40, 0.5);
            glareRef.current.style.opacity = intensity;
            glareRef.current.style.background = `linear-gradient(${105 + ry * 2}deg, rgba(255,255,255,0) 10%, rgba(255,215,0, 0.4) 40%, rgba(0,255,255, 0.4) 60%, rgba(255,255,255,0) 90%)`;
        }

        const leftInd = cardRef.current.querySelector('.choice-left'); 
        const rightInd = cardRef.current.querySelector('.choice-right');
        if (leftInd) leftInd.style.opacity = x < -20 ? Math.min((Math.abs(x)-20)/50, 1) : 0;
        if (rightInd) rightInd.style.opacity = x > 20 ? Math.min((Math.abs(x)-20)/50, 1) : 0;

        if (nextCardRef.current) {
            const swipeProgress = Math.min(Math.abs(x) / SWIPE_THRESHOLD, 1);
            const nextScale = 0.95 + (swipeProgress * 0.05); 
            nextCardRef.current.style.transform = `translate3d(0, ${15 - (swipeProgress * 15)}px, 0) scale(${nextScale})`;
            nextCardRef.current.style.opacity = state.current.isFlying ? 1 : swipeProgress;
        }
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

    useEffect(() => {
        const handlePointerMove = (e) => {
            if (latestProps.current.isBurning || state.current.isFlying) return;
            
            if (!state.current.isDragging && e.pointerType === 'mouse') {
                const rect = cardRef.current?.getBoundingClientRect();
                if (rect) {
                    state.current.rx = -((e.clientY - rect.top - rect.height/2) / rect.height) * 15; 
                    state.current.ry = ((e.clientX - rect.left - rect.width/2) / rect.width) * 15;
                    updateTransform(); 
                }
                return;
            }
            if (!state.current.isDragging) return;
            
            state.current.x = (e.clientX - state.current.startX) * 0.9; 
            state.current.y = (e.clientY - state.current.startY) * 0.9;
            updateTransform();
        };

        const handlePointerUp = (e) => {
            if (!state.current.isDragging) return;
            state.current.isDragging = false;

            if (state.current.x > SWIPE_THRESHOLD) triggerSwipe('right');
            else if (state.current.x < -SWIPE_THRESHOLD) triggerSwipe('left');
            else { requestAnimationFrame(springLoop); }
        };

        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, []);

    const handlePointerDown = (e) => {
        if (latestProps.current.isBurning || state.current.isFlying) return;
        try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
        
        state.current.isDragging = true;
        state.current.startX = e.clientX - state.current.x;
        state.current.startY = e.clientY - state.current.y;
        
        if (cardRef.current) cardRef.current.style.transition = 'none';
        updateTransform(); 
    };

    const triggerSwipe = (direction) => {
        state.current.isFlying = true;
        if (window.AudioEngine && window.AudioEngine.swipe) window.AudioEngine.swipe(direction); 
        
        state.current.x = direction === 'right' ? window.innerWidth + 50 : -window.innerWidth - 50; 
        state.current.y += 100; 
        
        if (cardRef.current) cardRef.current.style.transition = 'transform 0.3s ease-in, opacity 0.2s';
        updateTransform(); 
        
        setTimeout(() => { latestProps.current.onSwipe(direction); }, 300);
    };

    // ОПТИМИЗАЦИЯ: Троттлинг гироскопа (чтобы не убивать CPU)
    useEffect(() => {
        let ticking = false;
        const handleOrientation = (e) => {
            if (state.current.isDragging || state.current.isFlying || latestProps.current.isBurning) return;
            if (!ticking) {
                requestAnimationFrame(() => {
                    state.current.ry = Math.max(-15, Math.min(15, e.gamma ? e.gamma / 2 : 0)); 
                    state.current.rx = Math.max(-15, Math.min(15, e.beta ? (e.beta - 45) / 2 : 0));
                    if (cardRef.current && !state.current.isDragging) updateTransform();
                    ticking = false;
                });
                ticking = true;
            }
        };
        window.addEventListener('deviceorientation', handleOrientation, { passive: true });
        return () => window.removeEventListener('deviceorientation', handleOrientation);
    }, []);

    useEffect(() => {
        state.current = { x: 0, y: 0, rx: 0, ry: 0, isDragging: false, isFlying: false, startX: 0, startY: 0, currentPrediction: null };
        if(cardRef.current) {
            cardRef.current.style.transition = 'none';
            cardRef.current.style.transform = `translate3d(0,0,0) scale(1)`;
        }
        if (glareRef.current) glareRef.current.style.opacity = 0;
        if (nextCardRef.current) {
            nextCardRef.current.style.transform = 'translate3d(0, 15px, 0) scale(0.95)';
            nextCardRef.current.style.opacity = 0;
        }
    }, [card]);

    useImperativeHandle(card?.ref, () => ({
        forceSwipe: (dir) => { if (!state.current.isDragging && !state.current.isFlying && !latestProps.current.isBurning) triggerSwipe(dir); }
    }));

    if (!card) return null;

    return (
        <div className="card-stack">
            {nextCard && (
                <div ref={nextCardRef} className="next-card flex flex-col items-center justify-center opacity-0 pointer-events-none" style={{ transformOrigin: 'center bottom' }}>
                    <div className="text-[5rem] opacity-20 grayscale">{nextCard.avatar}</div>
                </div>
            )}
            
            <div ref={cardRef} 
                className={`swipe-card cursor-grab active:cursor-grabbing origin-bottom ${card.isUrgent?'bg-rose-50 border-2 border-rose-300':''} ${isBurning ? 'animate-burn' : ''}`}
                style={{ touchAction: 'none', transformOrigin: '50% 120%' }}
                onPointerDown={handlePointerDown}
            >
                <div className="card-texture"></div>
                <div ref={glareRef} className="absolute inset-0 rounded-[32px] pointer-events-none z-20 transition-opacity duration-150 opacity-0 mix-blend-overlay"></div>
                
                <div className="choice-indicator choice-left pointer-events-none">{card.leftChoice}</div>
                <div className="choice-indicator choice-right pointer-events-none">{card.rightChoice}</div>
                
                <div className={`relative z-10 bg-slate-50/50 rounded-t-[32px] p-2 flex flex-col items-center justify-center border-b border-slate-100 h-[38%] pointer-events-none ${card.isUrgent?'bg-rose-50 border-rose-200':''}`}>
                    <div id="card-wrapper" className="text-[4rem] mb-1"><span id="card-avatar">{card.avatar}</span></div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight text-center leading-tight">{card.character}</h2>
                    <div className="mt-1 px-3 py-1 rounded-full font-black text-[10px] uppercase bg-blue-600 text-white shadow-sm">{card.role}</div>
                </div>
                
                <div className="p-4 flex-1 flex items-center justify-center bg-white rounded-b-[32px] pointer-events-none">
                    <TypewriterText text={card.text} />
                </div>
            </div>
        </div>
    );
};

window.CardEngine = CardEngine;
