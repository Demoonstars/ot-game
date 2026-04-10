/* =========================================================
   ФАЙЛ: js/App.jsx
   Главное Ядро Игры (Game Loop, Меню, Магазин, Сохранения)
========================================================= */

const { useState, useEffect, useRef } = React;

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
  
  const timerRef = useRef(null);
  const engineRef = useRef();

  const [messages, setMessages] = useState([
      { id: 1, from: "Юлия Борисовна", text: "Антон, завтра выездная комиссия ГИТ. Проверь журналы инструктажей, чтобы без косяков! Штрафы платить не будем.", read: false }
  ]);

  // ЗАГРУЗКА СОХРАНЕНИЙ ИЗ БРАУЗЕРА
  useEffect(() => {
      try { 
          setAchievements(JSON.parse(localStorage.getItem('smena_achievements') || '[]')); 
          setCoins(parseInt(localStorage.getItem('smena_coins')) || 0); 
          setTerritory(JSON.parse(localStorage.getItem('smena_territory') || '[]')); 
      } catch(e) {}
  }, []);

  // ЭФФЕКТЫ ФОНА И ЭМБИЕНТА
  useEffect(() => {
      if (gameState === 'playing') {
          if (stats.budget < 30) document.body.classList.add('critical-budget'); else document.body.classList.remove('critical-budget');
          if (stats.safety < 30) document.body.classList.add('critical-safety'); else document.body.classList.remove('critical-safety');
          if (stats.loyalty < 30) document.body.classList.add('critical-loyalty'); else document.body.classList.remove('critical-loyalty');
          if (window.AudioEngine) window.AudioEngine.updateAmbient(stats);
      } else document.body.className = ''; 
  }, [stats, gameState]);

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

  const getRank = (days) => { 
      if (days <= 5) return "Стажер с блокнотом"; 
      if (days <= 10) return "Младший инспектор"; 
      if (days <= 15) return "Гроза нарушителей"; 
      if (days <= 25) return "Эксперт по ТБ"; 
      return "Бог Охраны Труда"; 
  };

  // СТАРТ МЕГА-СМЕНЫ (Смешиваем все 30 карт)
  const startMegaShift = () => {
      if (window.AudioEngine) {
          window.AudioEngine.init(); 
          window.AudioEngine.startAmbient();
      }
      if (window.vibrate) window.vibrate(50); 
      
      setFeedback(null); setIsBurning(false); setIsVictory(false); 
      setPhoneState({ open: false, tab: 'chats', ringing: false }); 
      setActionLog([]); setHasWarnedLowStats(false);
      setDay(1); setContactsUsed({ vv: false, buh: false, prof: false }); 
      setTimeLeft(8); setPlaystyle({ s: 0, b: 0, l: 0 }); setFlags({});
      
      // Баффы от кабинета
      setStats({ 
          safety: 50 + (territory.includes('t_fire') ? 10 : 0), 
          budget: 50 + (territory.includes('t_warehouse') ? 10 : 0), 
          loyalty: 50 + (territory.includes('t_med') ? 10 : 0) 
      });

      // СМЕШИВАЕМ ВСЕ БАЗЫ
      let megaDeck = [
          ...window.CAMPAIGNS.main, 
          ...window.CAMPAIGNS.park, 
          ...window.CAMPAIGNS.med
      ]; 
      megaDeck = megaDeck.sort(() => Math.random() - 0.5);
      megaDeck[0].ref = engineRef; 
      
      setDeck(megaDeck); setCurrentCard(megaDeck[0]); setNextCard(megaDeck[1]); 
      setGameState('playing');
  };

  const handleTimeout = () => {
      unlockAchievement('slow'); 
      setDeathReason("ИТОГ:\nВы растерялись в критической ситуации.\n\nВЕРДИКТ:\nВас отстранили за халатность.");
      setActionLog(prev => [...prev, { text: currentCard.text, choice: "БЕЗДЕЙСТВИЕ", isError: true, rule: currentCard.rule || "Нарушение регламента быстрого реагирования." }]);
      gameOverSequence(false);
  };

  const gameOverSequence = (victory = false) => {
      setIsVictory(victory); setIsBurning(!victory); 
      if (window.AudioEngine) window.AudioEngine.stopAmbient();
      
      if (Math.floor(day / 2) > 0) addCoins(Math.floor(day / 2));
      
      setTimeout(() => { 
          setGameState('gameover'); 
          if (window.vibrate) window.vibrate([500, 200, 500]); 
          setTimeout(() => { 
              if (window.AudioEngine) {
                  if (victory) window.AudioEngine.winStamp(); else window.AudioEngine.stamp(); 
              }
          }, 100); 
      }, 1200); 
  };

  // ТАЙМЕР СРОЧНЫХ КАРТОЧЕК
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

  // ЗВОНОК СМАРТФОНА В ЧС
  useEffect(() => {
      let hintTimer; const needsHelp = stats.safety < 40 || stats.budget < 40 || stats.loyalty < 40;
      if (needsHelp && (!contactsUsed.vv || !contactsUsed.buh || !contactsUsed.prof) && gameState === 'playing' && !phoneState.open && !hasWarnedLowStats) {
          if (window.AudioEngine) window.AudioEngine.msg(); 
          setPhoneState({...phoneState, ringing: true}); 
          setHasWarnedLowStats(true); 
      } else if (!needsHelp) { 
          setHasWarnedLowStats(false); setPhoneState({...phoneState, ringing: false});
      }
      return () => clearTimeout(hintTimer);
  }, [stats, contactsUsed, gameState, phoneState.open, hasWarnedLowStats]);

   // --- НОВОЕ: ЖИВОЙ ЧАТ С СОТРУДНИКАМИ ---
  useEffect(() => {
      // Запускаем чат только когда идет игра
      if (gameState === 'playing' && window.ChatEngine) {
          window.ChatEngine.start((newMessage) => {
              // Добавляем новое сообщение в начало списка
              setMessages(prev => [newMessage, ...prev]);
              
              // Проигрываем звук уведомления и зажигаем телефон
              if (window.AudioEngine) window.AudioEngine.msg();
              if (window.vibrate) window.vibrate([100, 50]);
              setPhoneState(prev => ({ ...prev, ringing: true }));
          });
      } else {
          // Останавливаем, если мы в меню или проиграли
          if (window.ChatEngine) window.ChatEngine.stop();
      }
      
      // Очистка при размонтировании
      return () => { if (window.ChatEngine) window.ChatEngine.stop(); };
  }, [gameState]);

  // ОБРАБОТКА СВАЙПА
  const handleSwipe = (direction) => {
    clearInterval(timerRef.current);
    
    // Аудио свайпа бумаги
    if (window.AudioEngine) window.AudioEngine.swipe();

    const effects = direction === 'left' ? currentCard.onLeft : currentCard.onRight;
    
    setPlaystyle(prev => ({ s: prev.s + (effects.safety > 0 ? effects.safety : 0), b: prev.b + (effects.budget > 0 ? effects.budget : 0), l: prev.l + (effects.loyalty > 0 ? effects.loyalty : 0) }));

    if (effects.safety < -15 || effects.budget < -15) {
        if (window.AudioEngine) window.AudioEngine.error(); 
        setActionLog(prev => [...prev, { text: currentCard.text, choice: direction === 'left' ? currentCard.leftChoice : currentCard.rightChoice, isError: true, rule: currentCard.rule || "Нарушение регламента." }]);
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
      setPhoneState({ open: true, tab: 'contacts', ringing: false });
  };

  const shareResult = async () => {
      setIsSharing(true); await new Promise(r => setTimeout(r, 100)); 
      const badgeElem = document.getElementById('share-badge-wrap'); 
      const oldBodyOverflow = document.body.style.overflow;
      
      document.body.style.overflow = 'visible'; 
      badgeElem.style.top = '0px'; badgeElem.style.left = '0px'; badgeElem.style.opacity = '1';
      
      await new Promise(r => setTimeout(r, 200));
      try {
          const canvas = await html2canvas(badgeElem, { scale: 2, backgroundColor: '#0f172a', windowWidth: 600, windowHeight: 900 });
          const dataUrl = canvas.toDataURL('image/png'); const blob = await (await fetch(dataUrl)).blob(); const file = new File([blob], 'smena-result.png', { type: 'image/png' });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: 'Мой результат в СМЕНЕ', text: `Я прошел ${day} смен! Звание: ${getRank(day)}`, files: [file] });
          else { const a = document.createElement('a'); a.href = dataUrl; a.download = `Smena_${day}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
      } catch (e) { alert("Ошибка сохранения."); } finally {
          document.body.style.overflow = oldBodyOverflow; badgeElem.style.top = '-9999px'; badgeElem.style.left = '-9999px'; badgeElem.style.opacity = '0'; setIsSharing(false);
      }
  };

  const getTimeClass = () => day <= 5 ? 'theme-morning' : day <= 15 ? 'theme-day' : day <= 25 ? 'theme-evening' : 'theme-night';

  /* --- РЕНДЕР: ДОСТИЖЕНИЯ --- */
  if (gameState === 'achievements') {
      return (
          <div className="flex flex-col items-center justify-start h-[100dvh] pt-12 px-6 bg-slate-900 text-white relative z-20">
              <button onClick={() => setGameState('start')} className="absolute top-6 left-6 text-slate-400 text-3xl font-black active:scale-90 transition-transform">←</button>
              <h2 className="text-3xl font-black uppercase tracking-widest text-emerald-400 mb-8">Удостоверения</h2>
              
              <div className="w-full max-w-md flex flex-col gap-4 overflow-y-auto pb-10 custom-scroll">
                  {window.ACHIEVEMENTS_LIST.map(ach => {
                      const isUnlocked = achievements.includes(ach.id);
                      return (
                          <div key={ach.id} className={`p-4 rounded-3xl border-2 flex items-center gap-4 transition-all ${isUnlocked ? 'bg-slate-800 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-900 border-slate-700 opacity-50 grayscale'}`}>
                              <div className="text-4xl">{isUnlocked ? ach.icon : '🔒'}</div>
                              <div>
                                  <div className="font-black text-lg">{isUnlocked ? ach.title : 'Неизвестно'}</div>
                                  <div className="text-sm text-slate-400 leading-tight">{isUnlocked ? ach.desc : 'Пройдите смену, чтобы узнать.'}</div>
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>
      )
  }

  /* --- РЕНДЕР: КАБИНЕТ СОТ --- */
  if (gameState === 'office') {
      return (
          <div className="flex flex-col items-center justify-start h-[100dvh] pt-12 px-6 bg-slate-900 text-white relative z-20">
              <button onClick={() => setGameState('start')} className="absolute top-6 left-6 text-slate-400 text-3xl font-black active:scale-90 transition-transform">←</button>
              <h2 className="text-3xl font-black uppercase tracking-widest text-blue-400 mb-2">Ваш Кабинет</h2>
              <div className="bg-slate-800 px-6 py-2 rounded-full border border-slate-600 mb-8 font-black text-xl text-yellow-400 shadow-md">Бюджет: {coins} 🪙</div>
              
              <div className="w-full max-w-md flex flex-col gap-4 overflow-y-auto pb-10 custom-scroll">
                  <p className="text-center text-slate-400 text-sm mb-2">Улучшения дают бонусы в начале каждой смены.</p>
                  {window.TERRITORY_UPGRADES.map(upg => {
                      const isOwned = territory.includes(upg.id);
                      return (
                          <div key={upg.id} className={`p-4 rounded-3xl border-2 flex justify-between items-center gap-3 transition-all ${isOwned ? 'bg-blue-900/30 border-blue-500' : 'bg-slate-800 border-slate-600'}`}>
                              <div className="flex items-center gap-3">
                                  <div className="text-3xl">{upg.icon}</div>
                                  <div>
                                      <div className="font-black text-[15px] leading-tight">{upg.name}</div>
                                      <div className="text-[11px] text-emerald-400 uppercase font-bold mt-1">{upg.desc}</div>
                                  </div>
                              </div>
                              {!isOwned ? (
                                  <button onClick={() => {
                                      if (coins >= upg.cost) {
                                          if (window.AudioEngine) window.AudioEngine.buy();
                                          setCoins(prev => { const n = prev - upg.cost; localStorage.setItem('smena_coins', n); return n; });
                                          setTerritory(prev => { const n = [...prev, upg.id]; localStorage.setItem('smena_territory', JSON.stringify(n)); return n; });
                                      } else {
                                          if (window.AudioEngine) window.AudioEngine.error();
                                      }
                                  }} className={`px-4 py-2 rounded-xl font-black text-sm whitespace-nowrap shadow-md ${coins >= upg.cost ? 'bg-blue-600 active:scale-95' : 'bg-slate-700 text-slate-500'}`}>
                                      {upg.cost} 🪙
                                  </button>
                              ) : (
                                  <div className="text-blue-400 font-black text-sm px-2">КУПЛЕНО</div>
                              )}
                          </div>
                      )
                  })}
              </div>
          </div>
      )
  }

  /* --- РЕНДЕР: МЕНЮ --- */
  if (gameState === 'start') {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] px-6 text-center animate-fade-in relative theme-morning">
        <div className="mesh-container"><div className="blob blob-1 w-[400px] h-[400px] top-[-10%] left-[-10%] animate-blob"></div><div className="blob blob-2 w-[350px] h-[350px] bottom-[-10%] right-[-10%] animate-blob" style={{animationDelay: '2s'}}></div></div>
        <div className="grid-overlay"></div><div className="noise"></div>
        
        <div className="text-8xl mb-4 drop-shadow-[0_0_30px_rgba(14,165,233,0.6)] relative z-10 mt-10">👷</div>
        <h1 className="text-6xl font-black text-white mb-2 tracking-tighter">СМЕНА 3.0</h1>
        <p className="text-lg font-bold text-blue-400 mb-10 uppercase tracking-widest">Симулятор СОТ</p>
        
        <div className="w-full max-w-xs flex flex-col gap-4 relative z-50">
            {/* КНОПКА СТАРТА - МЕГА СМЕНА */}
            <button onClick={startMegaShift} className="bg-blue-600 text-white font-black py-4 rounded-full text-lg shadow-[0_0_20px_rgba(37,99,235,0.6)] uppercase border-2 border-blue-400 active:scale-95 transition-transform">Начать Смену</button>
            
            <div className="flex gap-4 mt-2">
                <button onClick={() => { if(window.AudioEngine) window.AudioEngine.init(); setGameState('office')}} className="flex-1 bg-slate-800 text-slate-200 font-black py-3 rounded-full text-sm shadow-lg uppercase border border-slate-600 active:scale-95 transition-transform flex flex-col items-center justify-center gap-1">
                    <span>Ваш Кабинет</span>
                    <span className="text-[10px] text-yellow-500">{coins} 🪙</span>
                </button>
                <button onClick={() => { if(window.AudioEngine) window.AudioEngine.init(); setGameState('achievements')}} className="flex-1 bg-slate-800 text-slate-200 font-black py-3 rounded-full text-sm shadow-lg uppercase border border-slate-600 active:scale-95 transition-transform flex flex-col items-center justify-center gap-1">
                    <span>Удостоверения</span>
                    <span className="text-[10px] text-emerald-400">{achievements.length} / 5</span>
                </button>
            </div>
        </div>
      </div>
    );
  }

  /* --- РЕНДЕР: ИГРА ОКОНЧЕНА --- */
  if (gameState === 'gameover') {
    const totalPoints = (playstyle.s + playstyle.b + playstyle.l) || 1;
    const sNorm = (playstyle.s / totalPoints) * 40; const bNorm = (playstyle.b / totalPoints) * 40; const lNorm = (playstyle.l / totalPoints) * 40;
    const points = `50,${50-sNorm} ${50+bNorm*0.866},${50+bNorm*0.5} ${50-lNorm*0.866},${50+lNorm*0.5}`;
    const moneyValue = (stats.budget * 100000).toLocaleString('ru-RU');

    return (
      <div id="gameover-container" className="flex flex-col items-center justify-center h-[100dvh] px-6 text-center relative z-20 bg-[#0f172a] overflow-hidden">
          <div id="share-badge-wrap" className="share-badge">
              <div className="badge-logo">🛡️ СМЕНА</div>
              <div className="badge-title">Удостоверение СОТ</div><div className="badge-sub">Официальный результат</div>
              <div className="badge-days-label">{isVictory ? 'Завершено:' : 'Продержался:'}</div><div className="badge-days">{day}</div>
              <div className="badge-days-label" style={{marginTop:'10px', marginBottom:'40px'}}>смен</div>
              <div className="badge-rank">{getRank(day)}</div>
              <div className="radar-box">
                  <svg viewBox="0 0 100 100" width="300" height="300">
                      <polygon points="50,10 84.6,70 15.4,70" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                      <polygon points="50,23.3 73.1,63.3 26.9,63.3" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                      <polygon points="50,36.6 61.5,56.6 38.5,56.6" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                      <line x1="50" y1="50" x2="50" y2="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                      <line x1="50" y1="50" x2="84.6" y2="70" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                      <line x1="50" y1="50" x2="15.4" y2="70" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                      <polygon points={points} fill="rgba(56, 189, 248, 0.6)" stroke="#38bdf8" strokeWidth="2" strokeLinejoin="round"/>
                      <text x="50" y="5" fill="#f8fafc" fontSize="6" textAnchor="middle" fontWeight="bold">Правила</text>
                      <text x="90" y="75" fill="#f8fafc" fontSize="6" textAnchor="middle" fontWeight="bold">Бюджет</text>
                      <text x="10" y="75" fill="#f8fafc" fontSize="6" textAnchor="middle" fontWeight="bold">Люди</text>
                  </svg>
              </div>
          </div>

          <div className="absolute inset-0 overflow-y-auto custom-scroll flex flex-col items-center p-6">
              <div className="text-7xl mb-2 mt-10">{isVictory ? '🎉' : '💀'}</div>
              <h1 className={`text-3xl font-black uppercase tracking-widest drop-shadow-lg mb-4 ${isVictory ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isVictory ? 'Аттестация Сдана' : 'Смена Провалена'}
              </h1>
              
              <div className={`bg-slate-800 border-2 p-4 rounded-3xl mb-4 max-w-sm w-full shadow-2xl ${isVictory ? 'border-emerald-900' : 'border-rose-900'}`}>
                  <p className="text-slate-200 text-sm whitespace-pre-line text-left font-medium leading-relaxed mb-4">{deathReason}</p>
                  <div className="border-t border-slate-700 pt-4 flex justify-between text-xs font-bold text-slate-400">
                      <div>💰 Остаток: {moneyValue} ₽</div>
                      <div>🛡️ ТБ: {stats.safety}%</div>
                  </div>
              </div>
              
              <div className="text-5xl font-black text-blue-400 mb-2 drop-shadow-lg">{day} <span className="text-xl">карточек</span></div>
              <div className={`stamp ${isVictory ? 'stamp-victory' : ''}`}>{isVictory ? 'АТТЕСТОВАН' : 'УВОЛЕН'}</div>
              
              <div className="flex flex-col w-full max-w-xs gap-3 mt-8 mb-10 pb-10">
                 <button onClick={shareResult} disabled={isSharing} className={`bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-4 w-full rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] tracking-widest uppercase flex justify-center gap-2 ${isSharing ? 'opacity-70' : 'active:scale-95 transition-transform'}`}>
                     {isSharing ? '⌛ Генерируем...' : '📸 Поделиться'}
                 </button>
                 <button onClick={() => setGameState('start')} className="bg-slate-700 text-white font-black py-4 w-full rounded-full border border-slate-500 shadow-lg tracking-widest uppercase active:scale-95 transition-transform">В Главное меню</button>
              </div>
          </div>
      </div>
    );
  }

  /* --- РЕНДЕР: ИГРОВОЙ ПРОЦЕСС --- */
  return (
    <div className={`flex flex-col h-[100dvh] overflow-hidden relative z-10 transition-all duration-1000 ${getTimeClass()}`}>
      <div className="hazard-border"></div><div className="vignette-anger"></div>
      <div className="mesh-container"><div className="blob blob-1 w-[500px] h-[500px] top-[-20%] left-[-10%] animate-blob"></div><div className="blob blob-2 w-[450px] h-[450px] bottom-[-10%] right-[-10%] animate-blob" style={{animationDelay: '3s'}}></div></div>
      <div className="grid-overlay"></div><div className="noise"></div>

      <button onClick={openPhone} className={`physical-phone ${phoneState.ringing ? 'ringing' : ''}`}>
          <div className="phone-screen-mini">
              <span className="text-[10px] text-slate-500 absolute bottom-1">09:41</span>
              {messages.filter(m=>!m.read).length > 0 && <div className="phone-badge-diegetic"></div>}
          </div>
      </button>

      {phoneState.open && (
          <div className="absolute inset-0 z-[55] bg-slate-900/90 backdrop-blur-md flex flex-col p-4 animate-slideUp">
              <div className="bg-slate-800 flex-1 rounded-3xl border-4 border-slate-700 shadow-2xl flex flex-col overflow-hidden relative">
                  <div className="bg-slate-900 p-4 flex justify-between items-center border-b border-slate-700">
                      <div className="font-black text-xl text-white">Контакты СОТ</div>
                      <button onClick={() => setPhoneState({...phoneState, open: false})} className="text-slate-400 text-3xl font-bold hover:text-white">×</button>
                  </div>
                  <div className="flex bg-slate-800 p-2 gap-2 border-b border-slate-700">
                      <button onClick={()=>setPhoneState({...phoneState, tab: 'chats'})} className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${phoneState.tab === 'chats' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>💬 Чаты</button>
                      <button onClick={()=>setPhoneState({...phoneState, tab: 'contacts'})} className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${phoneState.tab === 'contacts' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>📇 Контакты</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scroll">
                      {phoneState.tab === 'chats' && messages.map(msg => (
                          <div key={msg.id} className="bg-slate-700 p-4 rounded-2xl rounded-tl-none self-start max-w-[85%] border border-slate-600 shadow-md">
                              <div className="text-blue-400 font-bold text-[10px] uppercase mb-1">{msg.from}</div><div className="text-white text-sm">{msg.text}</div>
                          </div>
                      ))}
                      {phoneState.tab === 'contacts' && (
                          <div className="p-3 bg-slate-700 rounded-xl border border-slate-600 flex justify-between items-center shadow-md">
                              <div><div className="text-white font-bold">В.В. (Директор)</div><div className="text-emerald-400 text-[10px] uppercase">Восстановит всё до 60%</div></div>
                              <button onClick={()=>useContact('vv')} disabled={contactsUsed.vv} className={`px-4 py-2 rounded-lg font-black text-sm ${!contactsUsed.vv ? 'bg-emerald-500 text-slate-900 shadow-md active:scale-95' : 'bg-slate-600 text-slate-400'}`}>☎️</button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {feedback && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in bg-slate-900/80 backdrop-blur-md">
              <div className="bg-white p-8 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center border-4 border-slate-200 flex flex-col items-center justify-center max-w-sm w-full">
                  <p className="text-slate-900 font-black text-xl mb-8 leading-relaxed whitespace-pre-line">{feedback.text}</p>
              </div>
          </div>
      )}

      {/* ПАНЕЛЬ ПРИБОРОВ */}
      <div className={`dashboard-panel`}>
          <div className="flex justify-between items-center mb-2 px-2">
              <div className="font-black text-lg text-slate-400 tracking-widest uppercase">КАРТА {day}</div>
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

      {/* КНОПКИ ВНИЗУ */}
      {!feedback && !isBurning && !phoneState.open && (
          <div className="action-buttons">
              <button onClick={() => engineRef.current?.forceSwipe('left')} className="btn-action btn-reject">{currentCard?.leftChoice || 'ОТКАЗАТЬ'}</button>
              <button onClick={() => engineRef.current?.forceSwipe('right')} className="btn-action btn-accept">{currentCard?.rightChoice || 'РАЗРЕШИТЬ'}</button>
          </div>
      )}
    </div>
  );
}

// Запуск React
const root = ReactDOM.createRoot(document.getElementById('game-root'));
root.render(<Game />);
