/* =========================================================
   ФАЙЛ: js/index.jsx
   Точка входа: Сборка всех систем и логика симулятора
   (Использует глобальные объекты window.CAMPAIGNS, window.AudioEngine и др.)
========================================================= */

const { useState, useEffect, useRef } = React;

// --- ВИЗУАЛЬНЫЕ КОМПОНЕНТЫ (UI) ---

const ParticleSystem = ({ safety }) => {
    const isDanger = safety < 30;
    const count = isDanger ? 35 : 15;
    const particles = Array.from({ length: count }).map((_, i) => {
        const size = Math.random() * (isDanger ? 6 : 12) + 3;
        const left = Math.random() * 100;
        const delay = Math.random() * -15; 
        const duration = Math.random() * 5 + (isDanger ? 2 : 12);
        return <div key={i} className={isDanger ? 'ember' : 'dust'} style={{ width: `${size}px`, height: `${size}px`, left: `${left}%`, '--d': `${duration}s`, animationDelay: `${delay}s` }} />;
    });
    return <div className="particle-layer">{particles}</div>;
};

const AnalogGauge = ({ value, icon, label, id }) => {
    const rotation = (value / 100) * 180 - 90;
    return (
        <div className="flex flex-col items-center gap-1" id={id}>
            <div className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{label}</div>
            <div className="analog-gauge"><div className="gauge-scale"></div><div className="gauge-needle" style={{ transform: `rotate(${rotation}deg)` }}></div></div>
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
            <div className={`lcd-screen ${isDanger ? 'danger' : ''}`}>{moneyValue} ₽</div>
            <div className="text-2xl mt-1 filter drop-shadow-md">{icon}</div>
        </div>
    );
};

const LoyaltyBar = ({ value, id }) => {
    const isDanger = value < 30;
    let emoji = "😐", color = "#3b82f6"; 
    if (value > 70) { emoji = "😎"; color = "#10b981"; }
    if (value < 30) { emoji = "🤬"; color = "#ef4444"; }
    return (
        <div className="flex flex-col items-center gap-1" id={id}>
            <div className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Лояльность</div>
            <div className="loyalty-bar-container"><div className="loyalty-bar-fill" style={{ width: `${value}%`, backgroundColor: color }}></div></div>
            <div className="text-2xl mt-1 filter drop-shadow-md transition-transform duration-300" style={{transform: isDanger ? 'scale(1.2)' : 'scale(1)'}}>{emoji}</div>
        </div>
    );
};

// --- ГЛАВНОЕ ЯДРО (GAME STATE) ---

function Game() {
  const [gameState, setGameState] = useState('start'); 
  
  const [day, setDay] = useState(1);
  const [stats, setStats] = useState({ safety: 50, budget: 50, loyalty: 50 });
  const [deck, setDeck] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [nextCard, setNextCard] = useState(null);
  
  const [deathReason, setDeathReason] = useState("");
  const [isVictory, setIsVictory] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(8);
  
  const [achievements, setAchievements] = useState([]);
  const [coins, setCoins] = useState(0);
  const [territory, setTerritory] = useState([]); 
  const [flags, setFlags] = useState({});
  const [contactsUsed, setContactsUsed] = useState({ vv: false, buh: false, prof: false });

  const [isBurning, setIsBurning] = useState(false);
  const [isShaking, setIsShaking] = useState(false); 
  
  // OS State (Умный планшет)
  const [osState, setOsState] = useState({ activeApp: null, ringing: false });
  const [toast, setToast] = useState(null); 
  const [typingContact, setTypingContact] = useState(null); 
  const [messages, setMessages] = useState([
      { id: 1, from: "Руководство", text: "Смена началась. Следите за журналами инструктажей.", read: false }
  ]);
  
  const timerRef = useRef(null);
  const engineRef = useRef();

  // Загрузка сохранений из памяти браузера
  useEffect(() => {
      try { 
          setAchievements(JSON.parse(localStorage.getItem('smena_achievements') || '[]')); 
          setCoins(parseInt(localStorage.getItem('smena_coins')) || 0); 
          setTerritory(JSON.parse(localStorage.getItem('smena_territory') || '[]')); 
      } catch(e) {}
  }, []);

  // Эффекты критических состояний (изменение фона)
  useEffect(() => {
      if (gameState === 'playing') {
          if (stats.budget < 30) document.body.classList.add('critical-budget'); else document.body.classList.remove('critical-budget');
          if (stats.safety < 30) document.body.classList.add('critical-safety'); else document.body.classList.remove('critical-safety');
          if (stats.loyalty < 30) document.body.classList.add('critical-loyalty'); else document.body.classList.remove('critical-loyalty');
      } else document.body.className = ''; 
  }, [stats, gameState]);

  // Запуск и подписка на Умный Чат
  useEffect(() => {
      if (gameState === 'playing' && ChatEngine) {
          const handleChatEvent = (event, data) => {
              if (event === 'typing') { setTypingContact(data.from); } 
              else if (event === 'message') {
                  setTypingContact(null);
                  setMessages(prev => [data, ...prev]);
                  setToast({ from: data.from, text: data.text });
                  
                  if (AudioEngine) AudioEngine.msg();
                  if (vibrate) vibrate([100, 50]);
                  
                  setOsState(prev => ({ ...prev, ringing: true }));
                  setTimeout(() => setToast(null), 4000);
              }
          };
          ChatEngine.subscribe(handleChatEvent);
          ChatEngine.start();
          return () => { ChatEngine.unsubscribe(handleChatEvent); ChatEngine.stop(); };
      } else {
          if (ChatEngine) ChatEngine.stop();
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
      if (AudioEngine) AudioEngine.init(); 
      if (vibrate) vibrate(50); 
      
      setFeedback(null); setIsBurning(false); setIsVictory(false); setIsShaking(false);
      setOsState({ activeApp: null, ringing: false }); 
      setToast(null); setTypingContact(null);
      setDay(1); setContactsUsed({ vv: false, buh: false, prof: false }); 
      setTimeLeft(8); setFlags({});
      
      // Стартовые статы с учетом улучшений кабинета
      setStats({ 
          safety: 50 + (territory.includes('t_fire') ? 10 : 0), 
          budget: 50 + (territory.includes('t_warehouse') ? 10 : 0) + (territory.includes('t_lawyer') ? 15 : 0), 
          loyalty: 50 + (territory.includes('t_med') ? 10 : 0) + (territory.includes('t_coffee') ? 15 : 0) 
      });

      // Сборка и перемешивание колоды
      let megaDeck = [...CAMPAIGNS.main, ...CAMPAIGNS.park, ...CAMPAIGNS.med].sort(() => Math.random() - 0.5);
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
      if (AudioEngine) AudioEngine.stopBGM();
      if (Math.floor(day / 2) > 0) addCoins(Math.floor(day / 2));
      
      setTimeout(() => { 
          setGameState('gameover'); 
          if (vibrate) vibrate([500, 200, 500]); 
          setTimeout(() => { if (AudioEngine) victory ? AudioEngine.winStamp() : AudioEngine.stamp(); }, 100); 
      }, 1200); 
  };

  useEffect(() => {
      if (gameState === 'playing' && currentCard?.isUrgent && !osState.activeApp && !feedback) {
          timerRef.current = setInterval(() => { 
              setTimeLeft(prev => { 
                  if (prev <= 3 && prev > 1 && AudioEngine) AudioEngine.alarm(); 
                  if (prev <= 1) { clearInterval(timerRef.current); handleTimeout(); return 0; } 
                  return prev - 1; 
              }); 
          }, 1000);
          return () => clearInterval(timerRef.current);
      }
  }, [gameState, currentCard, osState.activeApp, feedback]);

  const handleSwipe = (direction) => {
    clearInterval(timerRef.current);
    const effects = direction === 'left' ? currentCard.onLeft : currentCard.onRight;

    if (effects.safety <= -20 || effects.budget <= -20) {
        if (AudioEngine) AudioEngine.error(); 
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 400); 
    }

    const newFlags = { ...flags };
    if (currentCard.setFlag && direction === 'left') newFlags[currentCard.setFlag] = true;
    if (currentCard.id === 'm8' && direction === 'right') newFlags['bribe_given'] = true;
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
            
            // Проверка условий для появления карт-последствий
            if (newFlags.fake_sout && !newFlags.fake_sout_done && day > 5) { newDeck.unshift(BOSS_CARDS.fake_sout_consequence); newFlags.fake_sout_done = true; setFlags(newFlags); }
            if (newFlags.bribe_given && !newFlags.bribe_given_done && day > 8) { newDeck.unshift(BOSS_CARDS.git_bribe_consequence); newFlags.bribe_given_done = true; setFlags(newFlags); }
            if (newFlags.grinder_killer && !newFlags.grinder_killer_done && day > 3) { newDeck.unshift(BOSS_CARDS.grinder_killer_consequence); newFlags.grinder_killer_done = true; setFlags(newFlags); }
            if (newFlags.fake_signatures && !newFlags.fake_signatures_done && day > 4) { newDeck.unshift(BOSS_CARDS.fake_signatures_consequence); newFlags.fake_signatures_done = true; setFlags(newFlags); }

            if (newDeck.length === 0) {
                unlockAchievement('pro'); 
                setDeathReason("Сценарии закончились, вы успешно прошли смену!\nВы лучший специалист по ОТ."); 
                gameOverSequence(true); return;
            }
            
            newDeck[0].ref = engineRef;
            setDeck(newDeck); setCurrentCard(newDeck[0]); setNextCard(newDeck[1]); 
            if(newDeck[0].isUrgent) setTimeLeft(8);
        }, 2500); 
    }, 400); 
  };

  const useContact = (type) => {
      if (contactsUsed[type]) return;
      if (AudioEngine) AudioEngine.ring(); 
      if (vibrate) vibrate([100, 50, 100]); 
      
      setContactsUsed({ ...contactsUsed, [type]: true });
      let newStats = { ...stats };
      if (type === 'vv') { newStats = { safety: 60, budget: 60, loyalty: 60 }; }
      if (type === 'buh') { newStats.budget = Math.min(100, newStats.budget + 30); newStats.loyalty = Math.max(0, newStats.loyalty - 20); }
      if (type === 'prof') { newStats.loyalty = Math.min(100, newStats.loyalty + 30); newStats.budget = Math.max(0, newStats.budget - 20); }
      setStats(newStats); setOsState({ ...osState, activeApp: null });
  };

  const openApp = (appId) => {
      if (appId === 'messenger') setMessages(messages.map(m => ({...m, read: true})));
      setToast(null); 
      setOsState({ activeApp: appId, ringing: false });
  };
  const closeApp = () => setOsState({ ...osState, activeApp: null });

  const unreadCount = messages.filter(m => !m.read).length;
  const getTimeClass = () => day <= 5 ? 'theme-morning' : day <= 15 ? 'theme-day' : day <= 25 ? 'theme-evening' : 'theme-night';

  // Вспомогательные экраны (Меню)
  if (gameState === 'achievements') {
      return (
          <div className="flex flex-col items-center justify-start h-[100dvh] pt-12 px-6 bg-slate-900 text-white relative z-20">
              <button onClick={() => setGameState('start')} className="btn-back">←</button>
              <h2 className="text-3xl font-black uppercase tracking-widest text-emerald-400 mb-8">Удостоверения</h2>
              <div className="w-full max-w-md flex flex-col gap-4 overflow-y-auto pb-10 custom-scroll">
                  {ACHIEVEMENTS_LIST.map(ach => {
                      const isUnlocked = achievements.includes(ach.id);
                      return (
                          <div key={ach.id} className={`p-4 rounded-3xl border-2 flex items-center gap-4 transition-all ${isUnlocked ? 'bg-slate-800 border-emerald-500' : 'bg-slate-900 border-slate-700 opacity-50 grayscale'}`}>
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
              <h2 className="text-3xl font-black uppercase tracking-widest text-blue-400 mb-2">Кабинет</h2>
              <div className="bg-slate-800 px-6 py-2 rounded-full border border-slate-600 mb-8 font-black text-xl text-yellow-400">Бюджет: {coins} 💰</div>
              <div className="w-full max-w-md flex flex-col gap-4 overflow-y-auto pb-10 custom-scroll">
                  {TERRITORY_UPGRADES.map(upg => {
                      const isOwned = territory.includes(upg.id);
                      return (
                          <div key={upg.id} className={`p-4 rounded-3xl border-2 flex justify-between items-center gap-3 ${isOwned ? 'bg-blue-900/30 border-blue-500' : 'bg-slate-800 border-slate-600'}`}>
                              <div className="flex items-center gap-3"><div className="text-3xl">{upg.icon}</div><div><div className="font-black text-[15px]">{upg.name}</div><div className="text-[11px] text-emerald-400 uppercase font-bold">{upg.desc}</div></div></div>
                              {!isOwned ? (
                                  <button onClick={() => {
                                      if (coins >= upg.cost) {
                                          if (AudioEngine) AudioEngine.buy();
                                          setCoins(prev => { const n = prev - upg.cost; localStorage.setItem('smena_coins', n); return n; });
                                          setTerritory(prev => { const n = [...prev, upg.id]; localStorage.setItem('smena_territory', JSON.stringify(n)); return n; });
                                      } else if (AudioEngine) AudioEngine.error();
                                  }} className={`px-4 py-2 rounded-xl font-black text-sm ${coins >= upg.cost ? 'bg-blue-600' : 'bg-slate-700 text-slate-500'}`}>
                                      {upg.cost} 💰
                                  </button>
                              ) : <div className="text-blue-400 font-black text-sm px-2">В НАЛИЧИИ</div>}
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
        <div className="mesh-container"><div className="blob blob-1 w-[400px] h-[400px] top-[-10%] left-[-10%] animate-blob"></div><div className="blob blob-2 w-[350px] h-[350px] bottom-[-10%] right-[-10%] animate-blob"></div></div>
        <div className="grid-overlay"></div>
        <div className="text-8xl mb-4 relative z-10 mt-10">👷</div>
        <h1 className="text-6xl font-black text-white mb-2 tracking-tighter">СМЕНА 3.0</h1>
        <p className="text-lg font-bold text-blue-400 mb-10 uppercase tracking-widest">Симулятор СОТ</p>
        <div className="w-full max-w-xs flex flex-col gap-4 relative z-50">
            <button onClick={startMegaShift} className="bg-blue-600 text-white font-black py-4 rounded-full text-lg shadow-lg uppercase border-2 border-blue-400 active:scale-95 transition-all">Начать Смену</button>
            <div className="flex gap-4">
                <button onClick={() => { if(AudioEngine) AudioEngine.init(); setGameState('office')}} className="flex-1 bg-slate-800 text-slate-200 font-black py-3 rounded-full text-xs border border-slate-600 active:scale-95">КАБИНЕТ</button>
                <button onClick={() => { if(AudioEngine) AudioEngine.init(); setGameState('achievements')}} className="flex-1 bg-slate-800 text-slate-200 font-black py-3 rounded-full text-xs border border-slate-600 active:scale-95">ДОСТИЖЕНИЯ</button>
            </div>
        </div>
      </div>
    );
  }

  if (gameState === 'gameover') {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] px-6 text-center relative z-20 bg-[#0f172a] overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto custom-scroll flex flex-col items-center p-6">
              <div className="text-7xl mb-2 mt-10">{isVictory ? '🎉' : '💀'}</div>
              <h1 className={`text-3xl font-black uppercase mb-4 ${isVictory ? 'text-emerald-500' : 'text-rose-500'}`}>{isVictory ? 'Смена пройдена' : 'Смена провалена'}</h1>
              <div className={`bg-slate-800 border-2 p-4 rounded-3xl mb-4 max-w-sm w-full ${isVictory ? 'border-emerald-900' : 'border-rose-900'}`}>
                  <p className="text-slate-200 text-sm whitespace-pre-line text-left font-medium leading-relaxed mb-4">{deathReason}</p>
                  <div className="border-t border-slate-700 pt-4 flex justify-between text-xs font-bold text-slate-400">
                      <div>💰 Бюджет: {(stats.budget * 100000).toLocaleString('ru-RU')} ₽</div>
                      <div>🛡️ ТБ: {stats.safety}%</div>
                  </div>
              </div>
              <div className="text-5xl font-black text-blue-400 mb-10">{day} КАРТОЧЕК</div>
              <div className={`stamp ${isVictory ? 'stamp-victory' : ''}`}>{isVictory ? 'АТТЕСТОВАН' : 'УВОЛЕН'}</div>
              <button onClick={() => setGameState('start')} className="bg-slate-700 text-white font-black py-4 w-full max-w-xs rounded-full border border-slate-500 uppercase active:scale-95 transition-all">В меню</button>
          </div>
      </div>
    );
  }

  /* --- ИГРОВОЙ ЭКРАН (ПЛАНШЕТ) --- */
  return (
    <div className={`flex flex-col h-[100dvh] overflow-hidden relative z-10 transition-colors duration-1000 ${getTimeClass()} ${isShaking ? 'animate-shake-hard' : ''}`}>
      
      <ParticleSystem safety={stats.safety} />
      <div className="hazard-border"></div><div className="vignette-anger"></div>
      <div className="grid-overlay"></div>

      {/* Push-Уведомление */}
      {toast && (
          <div onClick={() => openApp('messenger')} className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-800/95 backdrop-blur-xl border border-slate-600 shadow-2xl rounded-2xl p-4 z-[100] cursor-pointer flex items-start gap-3 active:scale-95 transition-all">
              <div className="w-10 h-10 min-w-[40px] bg-blue-600 rounded-full flex items-center justify-center text-xl">💬</div>
              <div className="flex-1 overflow-hidden">
                  <div className="text-white font-bold text-sm truncate">{toast.from}</div>
                  <div className="text-slate-300 text-xs line-clamp-2 mt-0.5 leading-tight">{toast.text}</div>
              </div>
          </div>
      )}

      {/* Панель приложений (DOCK) */}
      <div className="os-dock">
          <button onClick={() => openApp('messenger')} className={`dock-btn ${osState.ringing ? 'ringing' : ''}`}>
              💬
              {unreadCount > 0 && <span className="dock-badge">{unreadCount}</span>}
          </button>
          <button onClick={() => openApp('contacts')} className="dock-btn">📇</button>
      </div>

      {/* Окна приложений */}
      {osState.activeApp && (
          <div className="os-window-overlay">
              <div className="os-window">
                  <div className="p-4 bg-slate-800/90 backdrop-blur-md border-b border-slate-700 flex justify-between items-center z-10">
                      <div className="font-black text-lg text-white">
                          {osState.activeApp === 'messenger' ? '💬 Мессенджер' : '📇 Справочник'}
                      </div>
                      <button onClick={closeApp} className="w-9 h-9 rounded-full bg-slate-700 text-xl text-slate-300 font-bold active:scale-90 transition-all">✕</button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scroll relative bg-[#0f172a]">
                      {osState.activeApp === 'contacts' && (
                          <>
                              <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700 flex justify-between items-center">
                                  <div><div className="text-white font-bold text-lg">Директор</div><div className="text-emerald-400 text-xs uppercase font-bold">Восстановить всё до 60%</div></div>
                                  <button onClick={()=>useContact('vv')} disabled={contactsUsed.vv} className={`w-12 h-12 flex items-center justify-center rounded-full text-xl ${!contactsUsed.vv ? 'bg-emerald-500 active:scale-90' : 'bg-slate-700 text-slate-500'}`}>📞</button>
                              </div>
                              <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700 flex justify-between items-center">
                                  <div><div className="text-white font-bold text-lg">Бухгалтерия</div><div className="text-yellow-400 text-xs uppercase font-bold">+30 Бюджет / -20 Люди</div></div>
                                  <button onClick={()=>useContact('buh')} disabled={contactsUsed.buh} className={`w-12 h-12 flex items-center justify-center rounded-full text-xl ${!contactsUsed.buh ? 'bg-yellow-500 active:scale-90' : 'bg-slate-700 text-slate-500'}`}>📞</button>
                              </div>
                              <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700 flex justify-between items-center">
                                  <div><div className="text-white font-bold text-lg">Профсоюз</div><div className="text-blue-400 text-xs uppercase font-bold">+30 Люди / -20 Бюджет</div></div>
                                  <button onClick={()=>useContact('prof')} disabled={contactsUsed.prof} className={`w-12 h-12 flex items-center justify-center rounded-full text-xl ${!contactsUsed.prof ? 'bg-blue-500 active:scale-90' : 'bg-slate-700 text-slate-500'}`}>📞</button>
                              </div>
                          </>
                      )}

                      {osState.activeApp === 'messenger' && (
                          <>
                              {messages.map(msg => (
                                  <div key={msg.id} className="chat-bubble-received">
                                      <div className="text-blue-400 font-black text-xs uppercase mb-1.5">{msg.from}</div>
                                      <div className="text-[15px] leading-snug">{msg.text}</div>
                                  </div>
                              ))}
                              {typingContact && (
                                  <div className="chat-bubble-received !w-20 animate-pulse flex flex-col">
                                      <div className="text-slate-400 font-bold text-[10px] uppercase truncate">{typingContact}</div>
                                      <div className="flex gap-1.5 items-center h-4">
                                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
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
              <div className="bg-white p-8 rounded-[32px] shadow-2xl text-center border-4 border-slate-200 flex flex-col items-center justify-center max-w-sm w-full">
                  <p className="text-slate-900 font-black text-xl leading-relaxed whitespace-pre-line">{feedback.text}</p>
              </div>
          </div>
      )}

      <div className="dashboard-panel">
          <div className="flex justify-between items-center mb-2 px-2">
              <div className="font-black text-lg text-slate-400 tracking-widest">ДЕНЬ {day}</div>
              {currentCard?.isUrgent && !feedback && <div className="text-lg font-black text-rose-500 bg-rose-950 px-4 py-1 rounded-full border-2 border-rose-500 animate-pulse">⏱️ 0:0{timeLeft}</div>}
          </div>
          <div className="flex justify-between items-end gap-4 px-1 mt-4">
              <LoyaltyBar value={stats.loyalty} id="bar-loyalty" />
              <LCDDisplay id="lcd-budget" value={stats.budget} icon="" label="Бюджет" />
              <AnalogGauge id="gauge-safety" value={stats.safety} icon="🛡️" label="Защита" />
          </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center p-2">
          {CardEngine && <CardEngine card={currentCard} nextCard={nextCard} onSwipe={handleSwipe} isBurning={isBurning} />}
      </div>

      {!feedback && !isBurning && !osState.activeApp && (
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
