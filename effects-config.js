// ---- effects-config.js ----
// Точка входа для сохранения/чтения пользовательских настроек.
// Все значения bool, хранится в localStorage под ключом "effectsConfig".
window.EffectsConfig = (() => {
    const KEY = 'effectsConfig';
    const defaults = {
        cardEntrance: true,
        cardHover: true,
        clickRipple: true,
        trackPulse: true,
        visualizer: true
    };
    const load = () => {
        try {
            const data = JSON.parse(localStorage.getItem(KEY));
            return { ...defaults, ...(data || {}) };
        } catch (e) {
            console.warn('⚠️ Effects config corrupted → using defaults', e);
            return { ...defaults };
        }
    };
    const save = (obj) => {
        try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (_) {}
    };
    const set = (name, value) => {
        const cfg = load();
        cfg[name] = Boolean(value);
        save(cfg);
        return cfg;
    };
    const get = (name) => {
        const cfg = load();
        return cfg[name];
    };
    return { load, set, get };
})();
