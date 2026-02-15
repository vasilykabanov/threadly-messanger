import { useRef, useState, useCallback, useEffect } from "react";

const DEFAULT_THRESHOLD = 60;
const MAX_PULL = 80;
const RESISTANCE = 0.5;

/**
 * Хук для pull-to-refresh только внутри переданного scroll-контейнера.
 * Триггер только при scrollTop === 0 и свайпе вниз. Не ломает обычный скролл.
 *
 * @param {Object} options
 * @param {() => void | Promise<void>} options.onRefresh - колбэк обновления (может быть async)
 * @param {number} [options.threshold=60] - порог в px для запуска refresh
 * @returns {{ scrollRef: React.RefObject, pullDistance: number, isRefreshing: boolean }}
 */
export function usePullToRefresh({ onRefresh, threshold = DEFAULT_THRESHOLD }) {
    const scrollRef = useRef(null);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const startY = useRef(0);
    const currentY = useRef(0);
    const pulling = useRef(false);
    const pullDistanceRef = useRef(0);
    const isRefreshingRef = useRef(false);
    const onRefreshRef = useRef(onRefresh);
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
            startY.current = e.touches[0].clientY;
            currentY.current = startY.current;
            pulling.current = el.scrollTop === 0;
        };

        const handleTouchMove = (e) => {
            currentY.current = e.touches[0].clientY;
            const scrollTop = el.scrollTop;

            if (scrollTop > 0) {
                pulling.current = false;
                setPullDistance(0);
                return;
            }

            const deltaY = currentY.current - startY.current;
            if (deltaY > 0 && pulling.current) {
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
            const distance = pullDistanceRef.current;
            if (distance >= threshold && pulling.current) {
                runRefresh();
            } else {
                setPullDistance(0);
                pullDistanceRef.current = 0;
            }
            pulling.current = false;
        };

        el.addEventListener("touchstart", handleTouchStart, { passive: true });
        el.addEventListener("touchmove", handleTouchMove, { passive: false });
        el.addEventListener("touchend", handleTouchEnd, { passive: true });

        return () => {
            el.removeEventListener("touchstart", handleTouchStart);
            el.removeEventListener("touchmove", handleTouchMove);
            el.removeEventListener("touchend", handleTouchEnd);
        };
    }, [threshold, runRefresh]);

    return { scrollRef, pullDistance, isRefreshing };
}
