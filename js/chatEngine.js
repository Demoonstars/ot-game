/* =========================================================
   ФАЙЛ: js/chatEngine.js
   AAA-Движок Чата: Анонимность, Динамическая печать, Анти-Спам
   (Без export, привязка к window)
========================================================= */

const ChatEngine = (() => {
    let mainLoopTimer = null;
    let typingTimer = null;
    let messageCounter = 2; 
    let subscribers = []; 
    
    // Память сессии для исключения повторов сообщений
    let usedTexts = new Set();

    // Анонимные отправители
    const senders = [
        "Охранник КПП", "Сантехник", "Главный инженер", 
        "Старшая Горничная", "Шеф-повар", "Бухгалтерия", 
        "Снабжение", "IT-Отдел", "Секретарь"
    ];

    // Полностью анонимная база сообщений
    const texts = [
        "Начальник, тут Михалыч опять без страховки на крышу лезет... Сними его оттуда!",
        "Шеф, а когда новую партию перчаток выдадут? Мои уже до дыр стерлись.",
        "В подвале вода капает прямо на электрощиток. Вырубаем или само просохнет?",
        "Кто-то огнетушителем пожарную дверь подпер. Опять штраф получим.",
        "Проверьте аптечку в горячем цеху, там бинты кончились и перекись кто-то вылил.",
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

    // API Подписок (Паттерн Observer для связи с React)
    const subscribe = (callback) => { subscribers.push(callback); };
    const unsubscribe = (callback) => { subscribers = subscribers.filter(cb => cb !== callback); };
    const notify = (event, data) => { subscribers.forEach(cb => cb(event, data)); };

    // Умный генератор уникальных сообщений
    const getUniqueMessage = () => {
        // Если перебрали все сообщения — сбрасываем память и идем по второму кругу
        if (usedTexts.size >= texts.length) usedTexts.clear();
        
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
            // Боты пишут случайным образом раз в 12-25 секунд
            const idleDelay = Math.floor(Math.random() * 13000) + 12000; 
            
            mainLoopTimer = setTimeout(() => {
                const msgData = getUniqueMessage();
                
                // ИННОВАЦИЯ: Динамический расчет времени печати на основе длины строки
                // (Примерно 40 мс на один символ + 500 мс на "достать телефон")
                const typingDuration = Math.min(Math.max(msgData.text.length * 40 + 500, 1500), 4500);
                
                // Сигнал в UI: Показать анимацию "печатает..."
                notify('typing', { from: msgData.from });

                typingTimer = setTimeout(() => {
                    // Сигнал в UI: Доставить само сообщение
                    notify('message', { 
                        id: messageCounter++, 
                        from: msgData.from, 
                        text: msgData.text, 
                        read: false 
                    });
                    
                    runEngineLoop(); // Планируем следующее сообщение
                }, typingDuration);

            }, idleDelay);
        };
        
        runEngineLoop();
    };

    const stop = () => {
        clearTimeout(mainLoopTimer);
        clearTimeout(typingTimer);
    };

    return { start, stop, subscribe, unsubscribe };
})();

// ПРИВЯЗКА К ГЛОБАЛЬНОЙ ОБЛАСТИ
window.ChatEngine = ChatEngine;
