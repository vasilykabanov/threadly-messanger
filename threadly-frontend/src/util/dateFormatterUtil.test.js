import { formatLastMessageDate } from "./dateFormatterUtil";

// Опорная дата для тестов: воскресенье 16 февраля 2025, 12:00 (локальное время)
const NOW = new Date(2025, 1, 16, 12, 0, 0, 0);

describe("formatLastMessageDate", () => {
    describe("невалидный ввод", () => {
        it("возвращает пустую строку для null", () => {
            expect(formatLastMessageDate(null, "ru-RU", NOW)).toBe("");
        });
        it("возвращает пустую строку для undefined", () => {
            expect(formatLastMessageDate(undefined, "ru-RU", NOW)).toBe("");
        });
        it("возвращает пустую строку для пустой строки", () => {
            expect(formatLastMessageDate("", "ru-RU", NOW)).toBe("");
        });
        it("возвращает пустую строку для невалидной ISO-строки", () => {
            expect(formatLastMessageDate("not-a-date", "ru-RU", NOW)).toBe("");
        });
    });

    describe("сегодня", () => {
        it("показывает только время в формате HH:mm", () => {
            const todayMorning = new Date(2025, 1, 16, 9, 5, 0, 0);
            expect(formatLastMessageDate(todayMorning, "ru-RU", NOW)).toBe("09:05");
        });
        it("показывает время для ISO-строки сегодня", () => {
            expect(formatLastMessageDate("2025-02-16T08:30:00.000Z", "ru-RU", NOW)).toMatch(/\d{1,2}:\d{2}/);
        });
    });

    describe("вчера", () => {
        it('показывает "Вчера" для сообщения вчера', () => {
            const yesterday = new Date(2025, 1, 15, 20, 0, 0, 0);
            expect(formatLastMessageDate(yesterday, "ru-RU", NOW)).toBe("Вчера");
        });
    });

    describe("текущая неделя", () => {
        it("показывает день недели для понедельника этой недели", () => {
            const monday = new Date(2025, 1, 10, 10, 0, 0, 0);
            expect(formatLastMessageDate(monday, "ru-RU", NOW)).toBe("Пн");
        });
        it("показывает день недели для среды этой недели", () => {
            const wednesday = new Date(2025, 1, 12, 10, 0, 0, 0);
            expect(formatLastMessageDate(wednesday, "ru-RU", NOW)).toBe("Ср");
        });
        it("показывает день недели для пятницы этой недели (2 дня назад)", () => {
            const friday = new Date(2025, 1, 14, 10, 0, 0, 0);
            expect(formatLastMessageDate(friday, "ru-RU", NOW)).toBe("Пт");
        });
        it("суббота при сегодня воскресенье показывается как «Вчера»", () => {
            const saturday = new Date(2025, 1, 15, 10, 0, 0, 0);
            expect(formatLastMessageDate(saturday, "ru-RU", NOW)).toBe("Вчера");
        });
    });

    describe("раньше текущей недели", () => {
        it("показывает dd.MM для прошлой недели", () => {
            const lastWeek = new Date(2025, 1, 9, 10, 0, 0, 0);
            expect(formatLastMessageDate(lastWeek, "ru-RU", NOW)).toBe("09.02");
        });
        it("показывает dd.MM для прошлого месяца", () => {
            const lastMonth = new Date(2025, 0, 15, 10, 0, 0, 0);
            expect(formatLastMessageDate(lastMonth, "ru-RU", NOW)).toBe("15.01");
        });
    });

    describe("граничные случаи: переход года", () => {
        it("31 декабря в той же календарной неделе что и 5 января показывается как день недели (Вт)", () => {
            const nowJan5 = new Date(2025, 0, 5, 12, 0, 0, 0);
            const dec31 = new Date(2024, 11, 31, 10, 0, 0, 0);
            expect(formatLastMessageDate(dec31, "ru-RU", nowJan5)).toBe("Вт");
        });
        it("показывает dd.MM для 31 декабря при текущей дате 10 января (другая неделя)", () => {
            const nowJan10 = new Date(2025, 0, 10, 12, 0, 0, 0);
            const dec31 = new Date(2024, 11, 31, 10, 0, 0, 0);
            expect(formatLastMessageDate(dec31, "ru-RU", nowJan10)).toBe("31.12");
        });
        it("показывает dd.MM для прошлого года", () => {
            const lastYear = new Date(2024, 5, 15, 10, 0, 0, 0);
            expect(formatLastMessageDate(lastYear, "ru-RU", NOW)).toBe("15.06");
        });
    });

    describe("граничные случаи: переход недели", () => {
        it("понедельник этой недели показывается как день недели (Пн)", () => {
            const nowSunday = new Date(2025, 1, 16, 12, 0, 0, 0);
            const thisWeekMonday = new Date(2025, 1, 10, 0, 0, 0, 0);
            expect(formatLastMessageDate(thisWeekMonday, "ru-RU", nowSunday)).toBe("Пн");
        });
        it("понедельник предыдущей недели показывается как dd.MM", () => {
            const nowSunday = new Date(2025, 1, 16, 12, 0, 0, 0);
            const prevWeekMonday = new Date(2025, 1, 3, 10, 0, 0, 0);
            expect(formatLastMessageDate(prevWeekMonday, "ru-RU", nowSunday)).toBe("03.02");
        });
        it("понедельник текущей недели в начале дня всё ещё в текущей неделе", () => {
            const nowMonday = new Date(2025, 1, 10, 9, 0, 0, 0);
            const sameMonday = new Date(2025, 1, 10, 8, 0, 0, 0);
            expect(formatLastMessageDate(sameMonday, "ru-RU", nowMonday)).toBe("08:00");
        });
    });

    describe("форматы ввода", () => {
        it("принимает ISO-строку", () => {
            expect(formatLastMessageDate("2025-02-15T10:00:00.000Z", "ru-RU", NOW)).toBe("Вчера");
        });
        it("принимает timestamp (мс)", () => {
            const yesterday = new Date(2025, 1, 15, 10, 0, 0, 0);
            expect(formatLastMessageDate(yesterday.getTime(), "ru-RU", NOW)).toBe("Вчера");
        });
        it("принимает объект Date", () => {
            const yesterday = new Date(2025, 1, 15, 10, 0, 0, 0);
            expect(formatLastMessageDate(yesterday, "ru-RU", NOW)).toBe("Вчера");
        });
    });

    describe("без параметра now (реальное время)", () => {
        it("не падает при вызове без now", () => {
            const anyDate = new Date();
            expect(() => formatLastMessageDate(anyDate.toISOString())).not.toThrow();
        });
        it("возвращает непустую строку для валидной даты", () => {
            const anyDate = new Date();
            expect(formatLastMessageDate(anyDate.toISOString()).length).toBeGreaterThan(0);
        });
    });
});
