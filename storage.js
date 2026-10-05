/**
 * Безопасная обёртка над localStorage.
 *
 * В обычном режиме доступ к localStorage может бросать исключение
 * (Safari Private Browsing, отключённые cookies, встраивание в iframe
 * с запретом storage, переполненная квота). Ранее такие исключения
 * ломали инициализацию плеера и галереи целиком — теперь всё
 * деградирует мягко: значение просто не сохраняется/не читается.
 */
const DAJETStorage = (function () {
    let memoryFallback = Object.create(null);
    let available = false;

    try {
        const probeKey = '__dajet_probe__';
        window.localStorage.setItem(probeKey, '1');
        window.localStorage.removeItem(probeKey);
        available = true;
    } catch (err) {
        available = false;
        console.warn('localStorage недоступен, настройки не будут сохраняться:', err && err.message);
    }

    function get(key, fallback = null) {
        try {
            const raw = available ? window.localStorage.getItem(key) : memoryFallback[key];
            return raw === null || raw === undefined ? fallback : raw;
        } catch (err) {
            return fallback;
        }
    }

    function set(key, value) {
        const raw = String(value);
        memoryFallback[key] = raw;
        if (!available) return false;
        try {
            window.localStorage.setItem(key, raw);
            return true;
        } catch (err) {
            // Например, квота переполнена — переходим в память до конца сессии.
            available = false;
            console.warn('Не удалось сохранить настройку, использую память:', err && err.message);
            return false;
        }
    }

    function getNumber(key, fallback, min, max) {
        const parsed = parseFloat(get(key, ''));
        if (!isFinite(parsed)) return fallback;
        if (typeof min === 'number' && parsed < min) return min;
        if (typeof max === 'number' && parsed > max) return max;
        return parsed;
    }

    return { get, set, getNumber, isAvailable: () => available };
})();
