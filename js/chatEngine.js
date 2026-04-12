/* =========================================================
   ФАЙЛ: js/chatEngine.js
   AAA-Движок: Smart Queue, Dynamic Typing, Anti-Spam
========================================================= */

const ChatEngine = (() => {
    let mainLoopTimer = null;
    let typingTimer = null;
    let messageCounter = 2; 
    let subscribers = []; 
    
    // Инновация: Память сессии (чтобы сообщения не повторялись)
    let usedTexts = new Set();

    const senders = [
        "Охранник КПП", "Сантехник Михалыч", "Главный инженер", 
        "Старшая Горничная", "Шеф-повар", "Бухгалтерия", 
        "Снабжение", "Айтишник Влад", "Секретарь Леночка"
    ];

    const texts = [
        "Начальник, тут Михалыч опять без страховки на крышу лезет... Сними его оттуда!",
        "Шеф, а когда новую партию перчаток выдадут? Мои уже до дыр стерлись.",
        "В подвале вода капает прямо на электрощиток. Вырубаем или само просохнет?",
        "Кто-то огнетушителем пожарную дверь подпер. Опять штраф получим.",
        "Проверь аптечку в горячем цеху, там бинты кончились и перекись кто-то вылил.",
        "Гости жалуются на жуткий запах краски на 4 этаже. Подрядчики говорят, что краска ЭКО.",
        "Коллеги, плановый инструктаж точно сегодня? Может на пятницу перенесем, а то банкет?",
        "У нас датчик дыма на кухне опять пищит просто так. Я его скотчем заклеил пока.",
        "Шеф, можно мне отгул на завтра? Я палец дверью прищемил, травму оформлять не хочу...",
        "Влад из IT провода поперек коридора кинул. Я уже два раза споткнулась!",
        "На заднем дворе кто-то курил возле газовых баллонов. Я не разглядел кто.",
        "Зарплату задерживают на день. Народ бунтует, говорят, работать не выйдут.",
        "Привезли новые каски. Они розовые и с блестками. Поставщик говорит, других не было. Берем?",
        "В холодильной камере замок заедает. Грузчик боится туда заходить, вдруг закроется."
    ];

    // API Подписок (Паттерн Observer)
    const subscribe = (callback) => { subscribers.push(callback); };
    const unsubscribe = (callback) => { subscribers = subscribers.filter(cb => cb !== callback); };
    const notify = (event, data) => { subscribers.forEach(cb => cb(event, data)); };

    // Умный генератор уникальных сообщений
    const getUniqueMessage = () => {
        if (usedTexts.size >= texts.length) usedTexts.clear(); // Сброс памяти, если всё отправили
        
        let availableTexts = texts.filter(t => !usedTexts.has(t));
        let randomText = availableTexts[Math.floor(Math.random() * availableTexts.length)];
        usedTexts.add(randomText);
        
        return {
            from: senders[Math.floor(Math.random() * senders.length)],
            text: randomText
        };
    };

    const start = () => {
        stop(); 
        usedTexts.clear(); // Очищаем память при новой смене

        // Асинхронная рекурсивная петля (Smart Loop)
        const runEngineLoop = () => {
            // Задержка между сообщениями: от 12 до 25 секунд
            const idleDelay = Math.floor(Math.random() * 13000) + 12000; 
            
            mainLoopTimer = setTimeout(() => {
                const msgData = getUniqueMessage();
                
                // ИННОВАЦИЯ: Динамический расчет времени печати
                // Человек печатает примерно 1 символ за 50 миллисекунд + базовое время на "взять телефон"
                const typingDuration = Math.min(Math.max(msgData.text.length * 40 + 500, 1500), 4500);
                
                // 1. Сигнал: Контакт начал печатать
                notify('typing', { from: msgData.from });

                // 2. Ждем высчитанное время (Dynamic Delay)
                typingTimer = setTimeout(() => {
                    // Сигнал: Сообщение готово
                    notify('message', { 
                        id: messageCounter++, 
                        from: msgData.from, 
                        text: msgData.text, 
                        read: false 
                    });
                    
                    // Планируем следующий цикл только после доставки текущего
                    runEngineLoop(); 
                }, typingDuration);

            }, idleDelay);
        };
        
        // Запускаем двигатель
        runEngineLoop();
    };

    const stop = () => {
        clearTimeout(mainLoopTimer);
        clearTimeout(typingTimer);
    };

    return { start, stop, subscribe, unsubscribe };
})();

// Экспорт в глобальную среду
window.ChatEngine = ChatEngine;
