/**
 * Утилита форматирования даты последнего сообщения.
 * Учитывает локаль пользователя и таймзону клиента (браузера).
 *
 * Логика отображения:
 * - Сегодня → время HH:mm
 * - Вчера → "Вчера"
 * - В пределах текущей недели → день недели (Пн, Вт, Ср ...)
 * - Ранее → дата dd.MM
 */

const DEFAULT_LOCALE = "ru-RU";

/**
 * Возвращает начало текущей недели (понедельник 00:00:00) в локальной таймзоне.
 * Для ru-RU и многих локалей неделя начинается с понедельника.
 *
 * @param {Date} date - опорная дата
 * @param {string} locale - локаль (влияет на первый день недели)
 * @returns {Date} начало недели
 */
function getStartOfWeek(date, locale = DEFAULT_LOCALE) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    // Воскресенье = 0, понедельник = 1. Для ru-RU понедельник — первый день.
    const toMonday = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - toMonday);
    return d;
}

/**
 * Строка "Вчера" с учётом локали (первая буква заглавная).
 *
 * @param {string} locale
 * @returns {string}
 */
function getYesterdayLabel(locale = DEFAULT_LOCALE) {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const str = rtf.format(-1, "day");
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Форматирует дату последнего сообщения для отображения в списке чатов (карточка контакта).
 * Используется локаль и таймзона клиента.
 *
 * @param {string|number|Date} dateInput - дата/время (ISO-строка, timestamp или Date)
 * @param {string} [locale] - локаль (по умолчанию ru-RU)
 * @param {Date} [now] - опорная дата "сейчас" (для тестов; в проде не передаётся)
 * @returns {string} отображаемая строка: "HH:mm" | "Вчера" | "Пн"/"Вт"/... | "dd.MM"
 */
export function formatLastMessageDate(dateInput, locale = DEFAULT_LOCALE, now = undefined) {
    if (dateInput == null || dateInput === "") return "";

    const msg = new Date(dateInput);
    if (Number.isNaN(msg.getTime())) return "";

    const nowRef = now instanceof Date ? now : new Date();

    const msgDay = new Date(msg.getFullYear(), msg.getMonth(), msg.getDate());
    const todayStart = new Date(nowRef.getFullYear(), nowRef.getMonth(), nowRef.getDate());
    const diffMs = todayStart.getTime() - msgDay.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays === 0) {
        return msg.toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    }

    if (diffDays === 1) {
        return getYesterdayLabel(locale);
    }

    const startOfWeek = getStartOfWeek(nowRef, locale);
    if (msgDay.getTime() >= startOfWeek.getTime()) {
        const weekday = msg.toLocaleDateString(locale, { weekday: "short" });
        return weekday.charAt(0).toUpperCase() + weekday.slice(1);
    }

    return msg.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
    });
}
