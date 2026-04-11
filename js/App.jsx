/* =========================================================
   ФАЙЛ: js/App.jsx
   Главное Ядро Игры (Частицы, Тряска экрана)
========================================================= */

const { useState, useEffect, useRef } = React;

// --- КОМПОНЕНТ ДИНАМИЧЕСКИХ ЧАСТИЦ ---
const ParticleSystem = ({ safety }) => {
    const isDanger = safety < 30;
    const count = isDanger ? 35 : 15;
    
    // Генерируем частицы один раз при смене состояния
    const particles = Array.from({ length: count }).map((_, i) => {
        const size = Math.random() * (isDanger ? 6 : 12) + 3;
        const left = Math.random() * 100;
        const delay = Math.random() * -15; // Рассинхрон
        const duration = Math.random() * 5 + (isDanger ? 2 : 12);
        
        return (
            <div key={i} 
                 className={isDanger ? 'ember' : 'dust'} 
                 style={{
                     width: `${size}px`, height: `${size}px`, left: `${left}%`, 
                     '--d': `${duration}s`, animationDelay: `${delay}s`
                 }} 
            />
        );
    });
    
    return <div className="particle-layer">{particles}</div>;
};

/* --- ВЬЮШКИ: ДИЕГЕТИЧЕСКИЙ ИНТЕРФЕЙС --- */
const AnalogGauge = ({ value, icon, label, id }) => {
    const rotation = (value / 100) * 180 - 90;
    return (
        <div className="flex flex-col items-center gap-1" id={id}>
            <div className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{label}</div>
            <div className="analog-gauge">
                <div className="gauge-scale"></div>
                <div className="gauge-needle" style={{ transform: `rotate(${rotation}deg)` }}></div>
            </div>
            <div className="text-2xl mt-1 filter drop-shadow-md">{icon}</div>
        </div>
    );
};

const LCDDisplay = ({ value, icon, label, id }) => {
    const isDanger = value < 30;
    const moneyValue = (value * 100000).toLocaleString('ru-RU');
    return (
        <div className="flex flex-col items-center gap-1" id={id}>
            <div className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{label}</div>
            <div className={`lcd-screen ${isDanger ? 'danger' : ''}`}>
               {moneyValue} ₽
            </div>
            <div className="text-2xl mt-1 filter drop-shadow-md">{icon}</div>
        </div>
    );
};

const LoyaltyBar = ({ value, id }) => {
    const isDanger = value < 30;
    let emoji = "😐";
    if (value > 70) emoji = "😎";
    if (value < 30) emoji = "🤬";

    let color = "#3b82f6"; 
    if (value > 70) color = "#10b981"; 
    if (value < 30) color = "#ef4444"; 

    return (
        <div className="flex flex-col items-center gap-1" id={id}>
            <div className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Лояльность</div>
            <div className="loyalty-bar-container">
                <div className="loyalty-bar-fill" style={{ width: `${value}%`, backgroundColor: color }}></div>
            </div>
            <div className="text-2xl mt-1 filter drop-shadow-md transition-transform duration-300" style={{transform: isDanger ? 'scale(1.2)' : 'scale(1)'}}>{emoji}</div>
        </div>
    );
};

/* --- ГЛАВНЫЙ КОМПОНЕНТ ИГРЫ --- */
function Game() {
  const [gameState, setGameState] = useState('start'); 
  
  const [day, setDay] = useState(1);
  const [stats, setStats] = useState({ safety: 50, budget: 50, loyalty: 50 });
  const [deck, setDeck] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [nextCard, setNextCard] = useState(null);
  
  const [actionLog, setActionLog] = useState([]); 
  const [deathReason, setDeathReason] = useState("");
  const [isVictory, setIsVictory] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(8);
  
  const [achievements, setAchievements] = useState([]);
  const [coins, setCoins] = useState(0);
  const [territory, setTerritory] = useState([]); 
  const [playstyle, setPlaystyle] = useState({ s: 0, b: 0, l: 0 }); 
  const [flags, setFlags] = useState({});
  
  const [phoneState, setPhoneState] = useState({ open: false, tab: 'chats', ringing: false });
  const [contactsUsed, setContactsUsed] = useState({ vv: false, buh: false, prof: false });
  const [hasWarnedLowStats, setHasWarnedLowStats] = useState(false);

  const [isSharing, setIsSharing] = useState(false); 
  const [isBurning, setIsBurning] = useState(false);
  const [isShaking, setIsShaking] = useState(false); // Стейт для тряски экрана
  
  const [toast, setToast] = useState(null); 
  const [typingContact, setTypingContact] = useState(null); 
  const [messages, setMessages] = useState([
      { id: 1, from: "Юлия Борисовна", text: "Завтра выездная комиссия ГИТ. Проверь журналы инструктажей, чтобы без косяков! Штрафы платить не будем.", read: false }
  ]);
  
  const timerRef = useRef(null);
  const engineRef = useRef();

  useEffect(() => {
      try { 
          setAchievements(JSON.parse(localStorage.getItem('smena_achievements') || '[]')); 
          setCoins(parseInt(localStorage.getItem('smena_coins')) || 0); 
          setTerritory(JSON.parse(localStorage.getItem('smena_territory') || '[]')); 
      } catch(e) {}
  }, []);

  useEffect(() => {
      if (gameState === 'playing') {
          if (stats.budget < 30) document.body.classList.add('critical-budget'); else document.body.classList.remove('critical-budget');
          if (stats.safety < 30) document.body.classList.add('critical-safety'); else document.body.classList.remove('critical-safety');
          if (stats.loyalty < 30) document.body.classList.add('critical-loyalty'); else document.body.classList.remove('critical-loyalty');
      } else document.body.className = ''; 
  }, [stats, gameState]);

  useEffect(() => {
      if (gameState === 'playing' && window.ChatEngine) {
          const handleChatEvent = (event, data) => {
              if (event === 'typing') { setTypingContact(data.from); } 
              else if (event === 'message') {
                  setTypingContact(null);
                  setMessages(prev => [data, ...prev]);
                  setToast({ from: data.from, text: data.text });
                  
                  if (window.AudioEngine) window.AudioEngine.msg();
                  if (window.vibrate) window.vibrate([100, 50]);
                  
                  setPhoneState(prev => ({ ...prev, ringing: true }));
                  setTimeout(() => setToast(null), 4000);
              }
          };
          window.ChatEngine.subscribe(handleChatEvent);
          window.ChatEngine.start();
          return () => { window.ChatEngine.unsubscribe(handleChatEvent); window.ChatEngine.stop(); };
      } else {
          if (window.ChatEngine) window.ChatEngine.stop();
      }
  }, [gameState]);

  const unlockAchievement = (id) => {
      setAchievements(prev => { 
          if (prev.includes(id)) return prev; 
          const newArr = [...prev, id]; 
          try { localStorage.setItem('smena_achievements', JSON.stringify(newArr)); } catch(e) {} 
          return newArr; 
      });
  };

  const addCoins = (amount) => { 
      const newCoins = coins + amount; 
      setCoins(newCoins); 
      localStorage.setItem('smena_coins', newCoins); 
  };

  const startMegaShift = () => {
      if (window.AudioEngine) window.AudioEngine.init(); 
      if (window.vibrate) window.vibrate(50); 
      
      setFeedback(null); setIsBurning(false); setIsVictory(false); setIsShaking(false);
      setPhoneState({ open: false, tab: 'chats', ringing: false }); 
      setToast(null); setTypingContact(null);
      setActionLog([]); setHasWarnedLowStats(false);
      setDay(1); setContactsUsed({ vv: false, buh: false, prof: false }); 
      setTimeLeft(8); setPlaystyle({ s: 0, b: 0, l: 0 }); setFlags({});
      
      setStats({ 
          safety: 50 + (territory.includes('t_fire') ? 10 : 0), 
          budget: 50 + (territory.includes('t_warehouse') ? 10 : 0), 
          loyalty: 50 + (territory.includes('t_med') ? 10 : 0) 
      });

      let megaDeck = [...window.CAMPAIGNS.main, ...window.CAMPAIGNS.park, ...window.CAMPAIGNS.med].sort(() => Math.random() - 0.5);
      megaDeck[0].ref = engineRef; 
      
      setDeck(megaDeck); setCurrentCard(megaDeck[0]); setNextCard(megaDeck[1]); 
      setGameState('playing');
  };

  const handleTimeout = () => {
      unlockAchievement('slow'); 
      setDeathReason("ИТОГ:\nВы растерялись в критической ситуации.\n\nВЕРДИКТ:\nВас отстранили за халатность.");
      gameOverSequence(false);
  };

  const gameOverSequence = (victory = false) => {
      setIsVictory(victory); setIsBurning(!victory); 
      if (window.AudioEngine) window.AudioEngine.stopBGM();
      if (Math.floor(day / 2) > 0) addCoins(Math.floor(day / 2));
      
      setTimeout(() => { 
          setGameState('gameover'); 
          if (window.vibrate) window.vibrate([500, 200, 500]); 
          setTimeout(() => { if (window.AudioEngine) victory ? window.AudioEngine.winStamp() : window.AudioEngine.stamp(); }, 100); 
      }, 1200); 
  };

  useEffect(() => {
      if (gameState === 'playing' && currentCard?.isUrgent && !phoneState.open && !feedback) {
          timerRef.current = setInterval(() => { 
              setTimeLeft(prev => { 
                  if (prev <= 3 && prev > 1 && window.AudioEngine) window.AudioEngine.alarm(); 
                  if (prev <= 1) { clearInterval(timerRef.current); handleTimeout(); return 0; } 
                  return prev - 1; 
              }); 
          }, 1000);
          return () => clearInterval(timerRef.current);
      }
  }, [gameState, currentCard, phoneState.open, feedback]);

  const handleSwipe = (direction) => {
    clearInterval(timerRef.current);
    const effects = direction === 'left' ? currentCard.onLeft : currentCard.onRight;
    
    setPlaystyle(prev => ({ s: prev.s + (effects.safety > 0 ? effects.safety : 0), b: prev.b + (effects.budget > 0 ? effects.budget : 0), l: prev.l + (effects.loyalty > 0 ? effects.loyalty : 0) }));

    // ТРЯСКА ЭКРАНА ПРИ ОШИБКЕ
    if (effects.safety <= -20 || effects.budget <= -20) {
        if (window.AudioEngine) window.AudioEngine.error(); 
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 400); // Выключаем через 0.4 сек
    }

    const newFlags = { ...flags };
    if (currentCard.setFlag && direction === 'right') newFlags[currentCard.setFlag] = true;
    setFlags(newFlags);

    const newSafety = Math.min(100, Math.max(0, stats.safety + effects.safety)); 
    const newBudget = Math.min(100, Math.max(0, stats.budget + effects.budget)); 
    const newLoyalty = Math.min(100, Math.max(0, stats.loyalty + effects.loyalty));
    
    setStats({ safety: newSafety, budget: newBudget, loyalty: newLoyalty });
    
    setTimeout(() => {
        setFeedback({ text: effects.msg, safety: effects.safety, budget: effects.budget, loyalty: effects.loyalty });
        setTimeout(() => {
            setFeedback(null); 
            
            if (newSafety <= 0 || newBudget <= 0 || newLoyalty <= 0) {
                let res = newSafety <= 0 ? "Тяжелый НС всплыл в прокуратуре." : newBudget <= 0 ? "Вы разорили предприятие." : "Рабочие устроили бунт.";
                setDeathReason(`ПОСЛЕДНЕЕ РЕШЕНИЕ:\n${effects.msg}\n\nВЕРДИКТ:\n${res}`);
                if (newSafety <= 0 && newBudget >= 70) unlockAchievement('greed'); 
                if (newLoyalty <= 0 && newSafety >= 70) unlockAchievement('tyrant');
                if (newBudget <= 0 && newLoyalty >= 70) unlockAchievement('soft');
                gameOverSequence(false); return;
            }
            
            setDay(prev => prev + 1); 
            let newDeck = deck.slice(1);
            
            if (newFlags.fire_show && !newFlags.fire_show_done && day > 3) {
                newDeck.unshift(window.BOSS_CARDS.fire_show_consequence);
                newFlags.fire_show_done = true; setFlags(newFlags);
            } else if (newFlags.git_bribe && !newFlags.git_bribe_done && day > 4) {
                newDeck.unshift(window.BOSS_CARDS.git_bribe_consequence);
                newFlags.git_bribe_done = true; setFlags(newFlags);
            }

            if (newDeck.length === 0) {
                unlockAchievement('pro'); 
                setDeathReason("Сценарии закончились, вы успешно прошли смену!\nРуководство довольно вашими компетенциями."); 
                gameOverSequence(true); return;
            }
            
            newDeck[0].ref = engineRef;
            setDeck(newDeck); setCurrentCard(newDeck[0]); setNextCard(newDeck[1]); 
            if(newDeck[0].isUrgent) setTimeLeft(8);
        }, 2000); 
    }, 400); 
  };

  const useContact = (type) => {
      if (contactsUsed[type]) return;
      if (window.AudioEngine) window.AudioEngine.ring(); 
      if (window.vibrate) window.vibrate([100, 50, 100]); 
      
      setContactsUsed({ ...contactsUsed, [type]: true });
      let newStats = { ...stats };
      if (type === 'vv') { newStats = { safety: 60, budget: 60, loyalty: 60 }; }
      if (type === 'buh') { newStats.budget = Math.min(100, newStats.budget + 30); newStats.loyalty = Math.max(0, newStats.loyalty - 20); }
      if (type === 'prof') { newStats.loyalty = Math.min(100, newStats.loyalty + 30); newStats.budget = Math.max(0, newStats.budget - 20); }
      setStats(newStats); setPhoneState({ ...phoneState, open: false });
  };

  const openPhone = () => {
      setMessages(messages.map(m => ({...m, read: true})));
      setToast(null); 
      setPhoneState({ open: true, tab: 'chats', ringing: false });
  };

  const getTimeClass = () => day <= 5 ? 'theme-morning' : day <= 15 ? 'theme-day' : day <= 25 ? 'theme-evening' : 'theme-night';

  if (gameState === 'achievements') {
      return (
          <div className="flex flex-col items-center justify-start h-[100dvh] pt-12 px-6 bg-slate-900 text-white relative z-20">
              <button onClick={() => setGameState('start')} className="btn-back">←</button>
              <h2 className="text-3xl font-black uppercase tracking-widest text-emerald-400 mb-8">Удостоверения</h2>
              <div className="w-full max-w-md flex flex-col gap-4 overflow-y-auto pb-10 custom-scroll">
                  {window.ACHIEVEMENTS_LIST.map(ach => {
                      const isUnlocked = achievements.includes(ach.id);
                      return (
                          <div key={ach.id} className={`p-4 rounded-3xl border-2 flex items-center gap-4 transition-all ${isUnlocked ? 'bg-slate-800 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-900 border-slate-700 opacity-50 grayscale'}`}>
                              <div className="text-4xl">{isUnlocked ? ach.icon : '🔒'}</div>
                              <div><div className="font-black text-lg">{isUnlocked ? ach.title : 'Неизвестно'}</div><div className="text-sm text-slate-400 leading-tight">{isUnlocked ? ach.desc : 'Пройдите смену, чтобы узнать.'}</div></div>
                          </div>
                      )
                  })}
              </div>
          </div>
      )
  }

  if (gameState === 'office') {
      return (
          <div className="flex flex-col items-center justify-start h-[100dvh] pt-12 px-6 bg-slate-900 text-white relative z-20">
              <button onClick={() => setGameState('start')} className="btn-back">←</button>
              <h2 className="text-3xl font-black uppercase tracking-widest text-blue-400 mb-2">Ваш Кабинет</h2>
              <div className="bg-slate-800 px-6 py-2 rounded-full border border-slate-600 mb-8 font-black text-xl text-yellow-400 shadow-md">Бюджет: {coins} 🪙</div>
              <div className="w-full max-w-md flex flex-col gap-4 overflow-y-auto pb-10 custom-scroll">
                  <p className="text-center text-slate-400 text-sm mb-2">Улучшения дают бонусы в начале каждой смены.</p>
                  {window.TERRITORY_UPGRADES.map(upg => {
                      const isOwned = territory.includes(upg.id);
                      return (
                          <div key={upg.id} className={`p-4 rounded-3xl border-2 flex justify-between items-center gap-3 transition-all ${isOwned ? 'bg-blue-900/30 border-blue-500' : 'bg-slate-800 border-slate-600'}`}>
                              <div className="flex items-center gap-3"><div className="text-3xl">{upg.icon}</div><div><div className="font-black text-[15px] leading-tight">{upg.name}</div><div className="text-[11px] text-emerald-400 uppercase font-bold mt-1">{upg.desc}</div></div></div>
                              {!isOwned ? (
                                  <button onClick={() => {
                                      if (coins >= upg.cost) {
                                          if (window.AudioEngine) window.AudioEngine.buy();
                                          setCoins(prev => { const n = prev - upg.cost; localStorage.setItem('smena_coins', n); return n; });
                                          setTerritory(prev => { const n = [...prev, upg.id]; localStorage.setItem('smena_territory', JSON.stringify(n)); return n; });
                                      } else { if (window.AudioEngine) window.AudioEngine.error(); }
                                  }} className={`px-4 py-2 rounded-xl font-black text-sm whitespace-nowrap shadow-md ${coins >= upg.cost ? 'bg-blue-600 active:scale-95' : 'bg-slate-700 text-slate-500'}`}>
                                      {upg.cost} 🪙
                                  </button>
                              ) : <div className="text-blue-400 font-black text-sm px-2">КУПЛЕНО</div>}
                          </div>
                      )
                  })}
              </div>
          </div>
      )
  }

  if (gameState === 'start') {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] px-6 text-center relative theme-morning">
        <div className="mesh-container"><div className="blob blob-1 w-[400px] h-[400px] top-[-10%] left-[-10%] animate-blob"></div><div className="blob blob-2 w-[350px] h-[350px] bottom-[-10%] right-[-10%] animate-blob" style={{animationDelay: '2s'}}></div></div>
        <div className="grid-overlay"></div>
        
        <div className="text-8xl mb-4 drop-shadow-[0_0_30px_rgba(14,165,233,0.6)] relative z-10 mt-10">👷</div>
        <h1 className="text-6xl font-black text-white mb-2 tracking-tighter drop-shadow-lg">СМЕНА 3.0</h1>
        <p className="text-lg font-bold text-blue-400 mb-10 uppercase tracking-widest drop-shadow-md">Симулятор СОТ</p>
        
        <div className="w-full max-w-xs flex flex-col gap-4 relative z-50">
            <button onClick={startMegaShift} className="bg-blue-600 text-white font-black py-4 rounded-full text-lg shadow-[0_0_20px_rgba(37,99,235,0.6)] uppercase border-2 border-blue-400 hover:scale-105 active:scale-95 transition-all">Начать Смену</button>
            <div className="flex gap-4 mt-2">
                <button onClick={() => { if(window.AudioEngine) window.AudioEngine.init(); setGameState('office')}} className="flex-1 bg-slate-800 text-slate-200 font-black py-3 rounded-full text-sm shadow-lg uppercase border border-slate-600 hover:bg-slate-700 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
                    <span>Ваш Кабинет</span><span className="text-[10px] text-yellow-500">{coins} 🪙</span>
                </button>
                <button onClick={() => { if(window.AudioEngine) window.AudioEngine.init(); setGameState('achievements')}} className="flex-1 bg-slate-800 text-slate-200 font-black py-3 rounded-full text-sm shadow-lg uppercase border border-slate-600 hover:bg-slate-700 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
                    <span>Удостоверения</span><span className="text-[10px] text-emerald-400">{achievements.length} / 10</span>
                </button>
            </div>
        </div>
      </div>
    );
  }

  if (gameState === 'gameover') {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] px-6 text-center relative z-20 bg-[#0f172a] overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto custom-scroll flex flex-col items-center p-6">
              <div className="text-7xl mb-2 mt-10 filter drop-shadow-xl">{isVictory ? '🎉' : '💀'}</div>
              <h1 className={`text-3xl font-black uppercase tracking-widest drop-shadow-lg mb-4 ${isVictory ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isVictory ? 'Аттестация Сдана' : 'Смена Провалена'}
              </h1>
              
              <div className={`bg-slate-800 border-2 p-4 rounded-3xl mb-4 max-w-sm w-full shadow-2xl ${isVictory ? 'border-emerald-900' : 'border-rose-900'}`}>
                  <p className="text-slate-200 text-sm whitespace-pre-line text-left font-medium leading-relaxed mb-4">{deathReason}</p>
                  <div className="border-t border-slate-700 pt-4 flex justify-between text-xs font-bold text-slate-400">
                      <div>💰 Бюджет: {(stats.budget * 100000).toLocaleString('ru-RU')} ₽</div>
                      <div>🛡️ ТБ: {stats.safety}%</div>
                  </div>
              </div>
              
              <div className="text-5xl font-black text-blue-400 mb-2 drop-shadow-lg">{day} <span className="text-xl">карточек</span></div>
              <div className={`stamp ${isVictory ? 'stamp-victory' : ''}`}>{isVictory ? 'АТТЕСТОВАН' : 'УВОЛЕН'}</div>
              
              <div className="flex flex-col w-full max-w-xs gap-3 mt-8 mb-10 pb-10">
                 <button onClick={() => setGameState('start')} className="bg-slate-700 text-white font-black py-4 w-full rounded-full border border-slate-500 shadow-lg tracking-widest uppercase hover:bg-slate-600 active:scale-95 transition-all">В Главное меню</button>
              </div>
          </div>
      </div>
    );
  }

  /* --- ИГРОВОЙ ЭКРАН (С ТРЯСКОЙ И ЧАСТИЦАМИ) --- */
  return (
    <div className={`flex flex-col h-[100dvh] overflow-hidden relative z-10 transition-colors duration-1000 ${getTimeClass()} ${isShaking ? 'animate-shake-hard' : ''}`}>
      
      {/* СЛОЙ ЧАСТИЦ */}
      <ParticleSystem safety={stats.safety} />
      
      <div className="hazard-border"></div><div className="vignette-anger"></div>
      <div className="mesh-container"><div className="blob blob-1 w-[500px] h-[500px] top-[-20%] left-[-10%] animate-blob"></div><div className="blob blob-2 w-[450px] h-[450px] bottom-[-10%] right-[-10%] animate-blob" style={{animationDelay: '3s'}}></div></div>
      <div className="grid-overlay"></div>

      {toast && (
          <div onClick={openPhone} className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-800/95 backdrop-blur-xl border border-slate-600 shadow-2xl rounded-2xl p-4 z-[100] cursor-pointer transition-all duration-300 flex items-start gap-3 active:scale-95">
              <div className="w-10 h-10 min-w-[40px] bg-blue-600 rounded-full flex items-center justify-center text-xl shadow-inner">💬</div>
              <div className="flex-1 overflow-hidden">
                  <div className="text-white font-bold text-sm truncate">{toast.from}</div>
                  <div className="text-slate-300 text-xs line-clamp-2 mt-0.5 leading-tight">{toast.text}</div>
              </div>
          </div>
      )}

      <button onClick={openPhone} className={`physical-phone ${phoneState.ringing ? 'ringing' : ''}`}>
          <div className="phone-screen-mini">
              <span className="text-[10px] text-slate-500 absolute bottom-1 font-bold">09:41</span>
              {messages.filter(m=>!m.read).length > 0 && <div className="phone-badge-diegetic"></div>}
          </div>
      </button>

      {phoneState.open && (
          <div className="absolute inset-0 z-[150] bg-slate-900/90 backdrop-blur-md flex flex-col p-4 animate-slideUp">
              <div className="ios-screen">
                  <div className="ios-header flex justify-between items-center">
                      <span className="text-blue-400 font-bold text-sm">Назад</span>
                      <span>Чаты СОТ</span>
                      <button onClick={() => setPhoneState({...phoneState, open: false})} className="text-slate-400 text-2xl font-black">×</button>
                  </div>
                  
                  <div className="flex bg-slate-800 p-2 gap-2 border-b border-slate-700 z-10">
                      <button onClick={()=>setPhoneState({...phoneState, tab: 'chats'})} className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${phoneState.tab === 'chats' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>💬 Чаты</button>
                      <button onClick={()=>setPhoneState({...phoneState, tab: 'contacts'})} className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${phoneState.tab === 'contacts' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>📇 Контакты</button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scroll relative bg-[#0f172a]">
                      {phoneState.tab === 'contacts' && (
                          <>
                              <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex justify-between items-center shadow-md">
                                  <div><div className="text-white font-bold">В.В. (Директор)</div><div className="text-emerald-400 text-[10px] uppercase font-bold">Восстановит всё до 60%</div></div>
                                  <button onClick={()=>useContact('vv')} disabled={contactsUsed.vv} className={`px-4 py-2 rounded-xl font-black text-sm ${!contactsUsed.vv ? 'bg-emerald-500 text-slate-900 shadow-md active:scale-95' : 'bg-slate-700 text-slate-500'}`}>📞</button>
                              </div>
                              <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex justify-between items-center shadow-md">
                                  <div><div className="text-white font-bold">Главбух Зинаида</div><div className="text-yellow-400 text-[10px] uppercase font-bold">+30 Бюджет / -20 Люди</div></div>
                                  <button onClick={()=>useContact('buh')} disabled={contactsUsed.buh} className={`px-4 py-2 rounded-xl font-black text-sm ${!contactsUsed.buh ? 'bg-yellow-500 text-slate-900 shadow-md active:scale-95' : 'bg-slate-700 text-slate-500'}`}>📞</button>
                              </div>
                              <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex justify-between items-center shadow-md">
                                  <div><div className="text-white font-bold">Профком</div><div className="text-blue-400 text-[10px] uppercase font-bold">+30 Люди / -20 Бюджет</div></div>
                                  <button onClick={()=>useContact('prof')} disabled={contactsUsed.prof} className={`px-4 py-2 rounded-xl font-black text-sm ${!contactsUsed.prof ? 'bg-blue-500 text-white shadow-md active:scale-95' : 'bg-slate-700 text-slate-500'}`}>📞</button>
                              </div>
                          </>
                      )}

                      {phoneState.tab === 'chats' && (
                          <>
                              {messages.map(msg => (
                                  <div key={msg.id} className="chat-bubble-received">
                                      <div className="text-blue-400 font-black text-[10px] uppercase mb-1">{msg.from}</div>
                                      <div className="text-sm leading-snug">{msg.text}</div>
                                  </div>
                              ))}
                              
                              {typingContact && (
                                  <div className="chat-bubble-received !w-20 animate-pulse flex flex-col">
                                      <div className="text-slate-400 font-bold text-[9px] uppercase mb-1 truncate">{typingContact}</div>
                                      <div className="flex gap-1 items-center h-4">
                                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                                      </div>
                                  </div>
                              )}
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {feedback && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
              <div className="bg-white p-8 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center border-4 border-slate-200 flex flex-col items-center justify-center max-w-sm w-full">
                  <p className="text-slate-900 font-black text-xl mb-8 leading-relaxed whitespace-pre-line">{feedback.text}</p>
              </div>
          </div>
      )}

      <div className={`dashboard-panel`}>
          <div className="flex justify-between items-center mb-2 px-2">
              <div className="font-black text-lg text-slate-400 tracking-widest uppercase">СМЕНА {day}</div>
              {currentCard?.isUrgent && !feedback && <div className="text-lg font-black text-rose-500 bg-rose-950 px-4 py-1 rounded-full border-2 border-rose-500 animate-pulse shadow-[0_0_15px_rgba(225,29,72,0.5)]">⏱️ 0:0{timeLeft}</div>}
          </div>
          <div className="flex justify-between items-end gap-4 px-1 mt-4">
              <LoyaltyBar value={stats.loyalty} id="bar-loyalty" />
              <LCDDisplay id="lcd-budget" value={stats.budget} icon="" label="Бюджет" />
              <AnalogGauge id="gauge-safety" value={stats.safety} icon="🛡️" label="Безопасность" />
          </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center p-2">
          {window.CardEngine && <window.CardEngine card={currentCard} nextCard={nextCard} onSwipe={handleSwipe} isBurning={isBurning} />}
      </div>

      {!feedback && !isBurning && !phoneState.open && (
          <div className="action-buttons">
              <button onClick={() => engineRef.current?.forceSwipe('left')} className="btn-action btn-reject">{currentCard?.leftChoice || 'ОТКАЗАТЬ'}</button>
              <button onClick={() => engineRef.current?.forceSwipe('right')} className="btn-action btn-accept">{currentCard?.rightChoice || 'РАЗРЕШИТЬ'}</button>
          </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('game-root'));
root.render(<Game />);
