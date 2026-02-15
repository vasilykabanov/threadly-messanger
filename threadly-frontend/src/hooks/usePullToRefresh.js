import { useRef, useState, useCallback, useEffect } from "react";

const DEFAULT_THRESHOLD = 60;
const MAX_PULL = 80;
const RESISTANCE = 0.5;
const MIN_MOVEMENT_PX = 5;
const PULL_END_DELAY_MS = 100;

/**
 * Хук для pull-to-refresh только внутри переданного scroll-контейнера.
 * Триггер только при scrollTop === 0 и вертикальном свайпе вниз.
 * Не ломает скролл, tap и long-tap: при определении pull-жеста отменяет long tap и клик.
 *
 * @param {Object} options
 * @param {() => void | Promise<void>} options.onRefresh - колбэк обновления (может быть async)
 * @param {number} [options.threshold=60] - порог в px для запуска refresh
 * @returns {{ scrollRef, pullDistance, isRefreshing, isPullGestureRef }}
 */
export function usePullToRefresh({ onRefresh, threshold = DEFAULT_THRESHOLD }) {
    const scrollRef = useRef(null);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const startX = useRef(0);
    const startY = useRef(0);
    const pullDistanceRef = useRef(0);
    const isRefreshingRef = useRef(false);
    const onRefreshRef = useRef(onRefresh);
    /** true, когда текущее касание распознано как вертикальный pull вниз (для отмены long tap у дочерних элементов) */
    const isPullGestureRef = useRef(false);
    /** true в течение PULL_END_DELAY_MS после touchend pull-жеста (для подавления click) */
    const pullJustEndedRef = useRef(false);

    onRefreshRef.current = onRefresh;
    isRefreshingRef.current = isRefreshing;

    const runRefresh = useCallback(async () => {
        if (!onRefreshRef.current || isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        setPullDistance(0);
        pullDistanceRef.current = 0;
        try {
            await Promise.resolve(onRefreshRef.current());
        } finally {
            isRefreshingRef.current = false;
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const handleTouchStart = (e) => {
            if (e.touches.length === 0) return;
            startX.current = e.touches[0].clientX;
            startY.current = e.touches[0].clientY;
            isPullGestureRef.current = false;
        };

        const handleTouchMove = (e) => {
            if (e.touches.length === 0) return;
            const scrollTop = el.scrollTop;
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = currentX - startX.current;
            const deltaY = currentY - startY.current;

            if (scrollTop > 0) {
                isPullGestureRef.current = false;
                el.classList.remove("pulling");
                setPullDistance(0);
                pullDistanceRef.current = 0;
                return;
            }

            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);
            const isVerticalPull = absDeltaY > absDeltaX && deltaY > 0;
            const movedEnough = absDeltaY >= MIN_MOVEMENT_PX;

            if (!isPullGestureRef.current && movedEnough && isVerticalPull) {
                isPullGestureRef.current = true;
                el.classList.add("pulling");
                e.preventDefault();
            }

            if (isPullGestureRef.current && deltaY > 0) {
                e.preventDefault();
                const resisted = Math.min(deltaY * RESISTANCE, MAX_PULL);
                pullDistanceRef.current = resisted;
                setPullDistance(resisted);
            } else if (deltaY <= 0) {
                pullDistanceRef.current = 0;
                setPullDistance(0);
            }
        };

        const handleTouchEnd = () => {
            const wasPull = isPullGestureRef.current;
            const distance = pullDistanceRef.current;

            if (wasPull) {
                pullJustEndedRef.current = true;
                el.classList.remove("pulling");
                setTimeout(() => {
                    pullJustEndedRef.current = false;
                }, PULL_END_DELAY_MS);
            }

            if (distance >= threshold && wasPull) {
                runRefresh();
            } else {
                setPullDistance(0);
                pullDistanceRef.current = 0;
            }

            isPullGestureRef.current = false;
        };

        const handleTouchCancel = () => {
            el.classList.remove("pulling");
            isPullGestureRef.current = false;
            pullJustEndedRef.current = false;
            setPullDistance(0);
            pullDistanceRef.current = 0;
        };

        const handleContextMenu = (e) => {
            if (isPullGestureRef.current || pullJustEndedRef.current) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        const handleClick = (e) => {
            if (pullJustEndedRef.current) {
                e.preventDefault();
                e.stopPropagation();
                pullJustEndedRef.current = false;
            }
        };

        el.addEventListener("touchstart", handleTouchStart, { passive: true });
        el.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });
        el.addEventListener("touchend", handleTouchEnd, { passive: true, capture: true });
        el.addEventListener("touchcancel", handleTouchCancel, { passive: true, capture: true });
        el.addEventListener("click", handleClick, { capture: true });
        el.addEventListener("contextmenu", handleContextMenu, { capture: true });

        return () => {
            el.removeEventListener("touchstart", handleTouchStart);
            el.removeEventListener("touchmove", handleTouchMove, true);
            el.removeEventListener("touchend", handleTouchEnd, true);
            el.removeEventListener("touchcancel", handleTouchCancel, true);
            el.removeEventListener("click", handleClick, true);
            el.removeEventListener("contextmenu", handleContextMenu, true);
        };
    }, [threshold, runRefresh]);

    return { scrollRef, pullDistance, isRefreshing, isPullGestureRef };
}
