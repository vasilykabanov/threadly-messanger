import React, { useEffect, useRef } from "react";
import "./MessageContextMenu.css";

/**
 * Компонент контекстного меню для сообщений.
 * Отображается при долгом нажатии на сообщение.
 */
const MessageContextMenu = ({ visible, position, onClose, onCopy, messageContent }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        if (!visible) return;

        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        const handleEscape = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        // Добавляем обработчики с небольшой задержкой, чтобы не закрыть меню сразу после открытия
        const timeoutId = setTimeout(() => {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("touchstart", handleClickOutside);
            document.addEventListener("keydown", handleEscape);
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [visible, onClose]);

    useEffect(() => {
        if (!visible || !menuRef.current) return;

        // Позиционируем меню относительно точки касания
        const menu = menuRef.current;
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = position.x;
        let top = position.y;

        // Корректируем позицию, чтобы меню не выходило за границы экрана
        if (left + rect.width > viewportWidth) {
            left = viewportWidth - rect.width - 10;
        }
        if (left < 10) {
            left = 10;
        }

        if (top + rect.height > viewportHeight) {
            top = viewportHeight - rect.height - 10;
        }
        if (top < 10) {
            top = 10;
        }

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }, [visible, position]);

    if (!visible) return null;

    const handleCopy = async () => {
        if (onCopy) {
            await onCopy(messageContent);
        }
        onClose();
    };

    return (
        <div className="message-context-menu-overlay" onClick={onClose}>
            <div
                ref={menuRef}
                className="message-context-menu"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="message-context-menu-item"
                    onClick={handleCopy}
                    onTouchEnd={(e) => {
                        e.preventDefault();
                        handleCopy();
                    }}
                >
                    <i className="fa fa-copy" aria-hidden="true"></i>
                    <span>Копировать</span>
                </button>
            </div>
        </div>
    );
};

export default MessageContextMenu;
