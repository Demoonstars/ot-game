/* =========================================================
   ФАЙЛ: js/chatEngine.js
   AAA-Движок чата (Эффект "печатает", Push-система)
========================================================= */

const ChatEngine = (() => {
    let timer = null;
    let typingTimer = null;
    let messageCounter = 2; // ID 1 занят Юлией Борисовной
    let subscribers = []; // Подписчики на события (React)

    const senders = [
        "Охранник КПП", "Сантехник Михалыч", "Главный инженер", 
        "Старшая Горничная", "Шеф-повар", "Бухгалтерия", 
        "Снабжение", "Айтишник Влад", "Секретарь Леночка"
    ];

    const texts = [
        "Тут Михалыч опять без страховки на крышу лезет... Сними его оттуда!",
        "А когда новую партию перчаток выдадут? Мои уже до дыр стерлись.",
        "В подвале вода капает прямо на электрощиток. Вырубаем или само просохнет?",
        "Кто-то огнетушителем пожарную дверь подпер. Опять штраф получим.",
        "Проверь аптечку в горячем цеху, там бинты кончились и перекись кто-то вылил.",
        "Гости жалуются на жуткий запах краски на 4 этаже. Подрядчики говорят, что краска ЭКО.",
        "А плановый инструктаж точно сегодня? Может на пятницу перенесем, а то у нас банкет?",
        "У нас датчик дыма на кухне опять пищит просто так. Я его скотчем заклеил пока.",
        "Можно мне отгул на завтра? Я палец дверью прищемил, травму оформлять не хочу...",
        "Влад из IT провода поперек коридора кинул. Я уже два раза споткнулась!",
        "На заднем дворе кто-то курил возле газовых баллонов. Я не разглядел кто.",
        "Зарплату задерживают на день. Народ бунтует, говорят, работать не выйдут."
    ];

    // Система подписок для связи с React
    const subscribe = (callback) => { subscribers.push(callback); };
    const unsubscribe = (callback) => { subscribers = subscribers.filter(cb => cb !== callback); };
    const notify = (event, data) => { subscribers.forEach(cb => cb(event, data)); };

    const start = () => {
        stop(); // Сброс старых таймеров
        
        const scheduleNext = () => {
            // Сообщения приходят рандомно каждые 15 - 35 секунд
            const delay = Math.random() * 20000 + 15000; 
            
            timer = setTimeout(() => {
                const from = senders[Math.floor(Math.random() * senders.length)];
                const text = texts[Math.floor(Math.random() * texts.length)];
                
                // 1. Отправляем событие "Печатает..."
                notify('typing', { from });

                // 2. Ждем 3 секунды и отправляем само сообщение
                typingTimer = setTimeout(() => {
                    notify('message', { 
                        id: messageCounter++, 
                        from: from, 
                        text: text, 
                        read: false 
                    });
                    
                    scheduleNext(); // Запускаем цикл заново
                }, 3000);

            }, delay);
        };
        
        scheduleNext();
    };

    const stop = () => {
        clearTimeout(timer);
        clearTimeout(typingTimer);
    };

    return { start, stop, subscribe, unsubscribe };
})();

window.ChatEngine = ChatEngine;
