import { useRef, useCallback } from "react";

const LONG_PRESS_DELAY = 500; // мс
const MAX_MOVEMENT_PX = 10; // максимальное движение для определения long press

/**
 * Хук для обработки долгого нажатия (long press).
 * Не триггерится при скролле или движении пальца.
 * 
 * @param {Object} options
 * @param {Function} options.onLongPress - колбэк при долгом нажатии
 * @param {Function} [options.onPress] - колбэк при обычном нажатии
 * @param {number} [options.delay=500] - задержка в мс для определения long press
 * @param {number} [options.maxMovement=10] - максимальное движение в px для определения long press
 * @param {React.RefObject} [options.isPullGestureRef] - ref из usePullToRefresh для предотвращения конфликтов
 * @returns {{ onTouchStart, onTouchMove, onTouchEnd, onTouchCancel }}
 */
export function useLongPress({
    onLongPress,
    onPress,
    delay = LONG_PRESS_DELAY,
    maxMovement = MAX_MOVEMENT_PX,
    isPullGestureRef,
}) {
    const timeoutRef = useRef(null);
    const startPosRef = useRef({ x: 0, y: 0 });
    const movedRef = useRef(false);
    const longPressTriggeredRef = useRef(false);

    const clearTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const handleTouchStart = useCallback(
        (e) => {
            // Не обрабатываем, если это pull-жест
            if (isPullGestureRef?.current) {
                return;
            }

            const touch = e.touches[0];
            if (!touch) return;

            startPosRef.current = { x: touch.clientX, y: touch.clientY };
            movedRef.current = false;
            longPressTriggeredRef.current = false;

            timeoutRef.current = setTimeout(() => {
                // Проверяем, что не было движения и это не pull-жест
                if (!movedRef.current && !isPullGestureRef?.current) {
                    longPressTriggeredRef.current = true;
                    if (onLongPress) {
                        // Используем сохраненную позицию начала касания
                        onLongPress(e, { x: startPosRef.current.x, y: startPosRef.current.y });
                    }
                }
            }, delay);
        },
        [onLongPress, delay, isPullGestureRef]
    );

    const handleTouchMove = useCallback(
        (e) => {
            // Не обрабатываем, если это pull-жест
            if (isPullGestureRef?.current) {
                clearTimeout();
                return;
            }

            const touch = e.touches[0];
            if (!touch) return;

            const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
            const deltaY = Math.abs(touch.clientY - startPosRef.current.y);
            const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Если движение превышает порог, отменяем long press
            if (totalMovement > maxMovement) {
                movedRef.current = true;
                clearTimeout();
            }
        },
        [maxMovement, clearTimeout, isPullGestureRef]
    );

    const handleTouchEnd = useCallback(
        (e) => {
            clearTimeout();

            // Если long press не был триггернут и не было движения, вызываем обычный press
            if (!longPressTriggeredRef.current && !movedRef.current && onPress) {
                onPress(e);
            }

            // Сбрасываем состояние
            movedRef.current = false;
            longPressTriggeredRef.current = false;
        },
        [onPress, clearTimeout]
    );

    const handleTouchCancel = useCallback(() => {
        clearTimeout();
        movedRef.current = false;
        longPressTriggeredRef.current = false;
    }, [clearTimeout]);

    return {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onTouchCancel: handleTouchCancel,
    };
}
