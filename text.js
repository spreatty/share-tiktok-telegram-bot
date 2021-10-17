module.exports = {
    get(textId, params) {
        var text = this[textId];
        for(var i = 0; i < params.length; ++i)
            text = text.replace(new RegExp(`\\$${i + 1}`, 'g'), params[i]);
        return text;
    },
    start: 'Вітаю! Я бот, що вміє отримувати відео з TikTok посилань та надсилати їх у чати.',
    whatFor: 'Для чого цей чат?',
    whatForOptions: {
        source: 'Я хочу надсилати сюди TikTok посилання',
        target: 'Я хочу отримувати тут відео',
        both: 'Я хочу все в цьому чаті'
    },
    selectChat: {
        target: 'Тепер вибери чат, куди я надсилатиму відео.',
        source: 'Тепер вибери чат, куди ти надсилатимеш TikTok посилання.',
        button: 'Вибрати чат'
    },
    linked: {
        source: "Чудово! Можеш надсилати сюди TikTok посилання.",
        target: "Чудово! Відтепер ти отримуватимеш тут відео.",
        self: "Чудово! Чат налаштовано."
    },
    alreadyLinked: "Вибрані чати вже з'єднано. Продовжуй користуватись.",
    alreadyLinkedSelf: "Цей чат вже налаштовано. Продовжуй користуватись.",
    unlinked: "1 чат від'єднано.",
    unlinkedSelf: "Чат від'єднано.",
    from: 'Від ',

    error: {
        link: {
            generic: 'Щось пішло не так. Спробуй розпочати спочатку.',
            badRegistry: 'Схоже ти вже поєднав чати цим повідомленням. Спробуй розпочати спочатку.'
        }
    }
};