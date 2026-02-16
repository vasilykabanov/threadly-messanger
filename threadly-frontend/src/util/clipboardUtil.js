/**
 * Копирует текст в буфер обмена с fallback для Safari и старых браузеров.
 * 
 * @param {string} text - Текст для копирования
 * @returns {Promise<void>}
 */
export async function copyToClipboard(text) {
    if (!text) return;

    // Используем современный Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (err) {
            // Если Clipboard API не работает (например, в Safari без HTTPS),
            // используем fallback метод
            // Логируем только в development режиме
            if (process.env.NODE_ENV === 'development') {
                console.warn("Clipboard API failed, using fallback:", err);
            }
        }
    }

    // Fallback для Safari и старых браузеров
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    textArea.style.opacity = "0";
    textArea.setAttribute("readonly", "");
    document.body.appendChild(textArea);

    try {
        // Для iOS Safari нужно выделить текст
        if (navigator.userAgent.match(/ipad|iphone/i)) {
            const range = document.createRange();
            range.selectNodeContents(textArea);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            textArea.setSelectionRange(0, text.length);
        } else {
            textArea.select();
        }

        const successful = document.execCommand("copy");
        if (!successful) {
            throw new Error("execCommand('copy') failed");
        }
    } finally {
        document.body.removeChild(textArea);
    }
}
