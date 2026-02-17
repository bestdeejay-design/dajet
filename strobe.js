/**
 * Strobe Effect Module - strobe.js
 * (не меняем, только проверяем, что в файле НЕ ОЧЕНЬ ПУСТО)
 */

class StrobeEffect {
    constructor() {
        // 1️⃣ Проверка prefers-reduced-motion
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (this.prefersReducedMotion) {
            console.log('⚠️ prefers-reduced-motion detected – strobe disabled');
            this.enabled = false;
            this.mode   = 'constant';
            this.intensity = 0.15;
            return;
        }

        // 2️⃣ Настройки из localStorage
        this.loadSettings();

        // 3️⃣ Создаём необходимые DOM‑элементы
        this.createElements();

        // 4️⃣ Привязываем события
        this.initEventListeners();

        // 5️⃣ UI‑инициализация
        this.updateUI();
    }

    /* ----------------------------------------------------------------- *
     *  Настройки (load / save)
     * ----------------------------------------------------------------- */
    loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem('strobeSettings')) || {};
            this.enabled   = saved.enabled ?? false;
            this.mode      = saved.mode ?? 'constant';
            this.intensity = saved.intensity ?? 0.15;
            // безопасный диапазон 5‑45 %
            this.intensity = Math.min(Math.max(this.intensity, 0.05), 0.45);
        } catch (e) {
            console.warn('⚠️ Error loading strobeSettings, using defaults', e);
            this.enabled = false;
            this.mode    = 'constant';
            this.intensity = 0.15;
        }
    }

    saveSettings() {
        try {
            const obj = { enabled: this.enabled, mode: this.mode, intensity: this.intensity };
            localStorage.setItem('strobeSettings', JSON.stringify(obj));
        } catch (e) {
            console.warn('⚠️ Could not save strobeSettings', e);
        }
    }

    /* ----------------------------------------------------------------- *
     *  Создание DOM‑элементов
     * ----------------------------------------------------------------- */
    createElements() {
        // overlay (если отсутствует)
        if (!document.getElementById('strobe-overlay')) {
            const o = document.createElement('div');
            o.id = 'strobe-overlay';
            o.className = 'strobe-overlay';
            o.setAttribute('aria-hidden', 'true');
            document.body.appendChild(o);
        }

        // кнопка
        const controls = document.querySelector('.player-controls');
        if (controls && !document.getElementById('strobe-toggle')) {
            const btn = document.createElement('button');
            btn.id = 'strobe-toggle';
            btn.className = 'control-btn';
            btn.title = 'Стробоскоп (безопасный режим)';
            btn.innerHTML = '⚡';
            controls.insertBefore(btn, controls.firstChild);
        }

        // модальное окно
        if (!document.getElementById('strobe-warning')) {
            const w = document.createElement('div');
            w.id = 'strobe-warning';
            w.className = 'modal hidden';
            w.innerHTML = `
                <h3>⚠️ Предупреждение о безопасности</h3>
                <p>Этот эффект может вызвать дискомфорт у людей с фоточувствительной эпилепсией. 
                   Используйте с осторожностью и делайте перерывы.</p>
                <button id="strobe-accept">Понятно, включить</button>
                <button id="strobe-decline">Отмена</button>
            `;
            document.body.appendChild(w);
        }
    }

    /* ----------------------------------------------------------------- *
     *  Обработчики событий
     * ----------------------------------------------------------------- */
    initEventListeners() {
        const toggleBtn = document.getElementById('strobe-toggle');
        if (toggleBtn) toggleBtn.addEventListener('click', () => this.toggle());

        const acceptBtn = document.getElementById('strobe-accept');
        const declineBtn = document.getElementById('strobe-decline');

        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => {
                this.showWarning = false;
                document.getElementById('strobe-warning').classList.add('hidden');
                this.enable();
            });
        }
        if (declineBtn) {
            declineBtn.addEventListener('click', () => {
                document.getElementById('strobe-warning').classList.add('hidden');
                this.showWarning = false; // просто закрываем
            });
        }

        // реагируем на смену темы (theme-manager посылает событие)
        document.addEventListener('theme:change', () => this.onThemeChange());
    }

    /* ----------------------------------------------------------------- *
     *  Включить / выключить
     * ----------------------------------------------------------------- */
    enable() {
        if (this.prefersReducedMotion) return;
        this.enabled = true;

        const overlay = document.getElementById('strobe-overlay');
        if (overlay) {
            overlay.style.setProperty('--strobe-opacity', this.intensity);
            overlay.style.opacity = this.intensity; // основной слой
        }
        const btn = document.getElementById('strobe-toggle');
        if (btn) btn.classList.add('enabled');

        this.applyAnimationTiming();
        this.saveSettings();
        this.updateUI();
    }

    disable() {
        this.enabled = false;
        const overlay = document.getElementById('strobe-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.animation = 'none';
        }
        const btn = document.getElementById('strobe-toggle');
        if (btn) btn.classList.remove('enabled');

        this.saveSettings();
        this.updateUI();
    }

    toggle() {
        if (this.prefersReducedMotion) return;
        if (this.enabled) this.disable();
        else {
            if (!this.showWarningIfNeeded()) this.enable();
        }
    }

    /* ----------------------------------------------------------------- *
     *  Предупреждение при первом включении
     * ----------------------------------------------------------------- */
    showWarningIfNeeded() {
        const seen = localStorage.getItem('strobeWarningShown');
        if (!seen && this.enabled) {
            this.showWarning = true;
            localStorage.setItem('strobeWarningShown', 'true');
        }
        if (this.showWarning) {
            const modal = document.getElementById('strobe-warning');
            if (modal) modal.classList.remove('hidden');
            return true;
        }
        return false;
    }

    /* ----------------------------------------------------------------- *
     *  Режимы (constant / beat‑sync)
     * ----------------------------------------------------------------- */
    setMode(mode) {
        if (!['constant', 'beat-sync'].includes(mode)) {
            console.warn('⚠️ Invalid strobe mode:', mode);
            return;
        }
        this.mode = mode;
        const overlay = document.getElementById('strobe-overlay');
        if (overlay && this.enabled) {
            overlay.classList.remove('mode-constant', 'mode-beat', 'mode-beat-sync');
            overlay.classList.add(`mode-${mode}`);
        }
        if (this.enabled) this.applyAnimationTiming();
        this.saveSettings();
    }

    /* ----------------------------------------------------------------- *
     *  Применяем тайминг анимации (учитываем текущий режим)
     * ----------------------------------------------------------------- */
    applyAnimationTiming() {
        const overlay = document.getElementById('strobe-overlay');
        if (!overlay || !this.enabled) return;

        overlay.style.animation = 'none';
        setTimeout(() => {
            if (!this.enabled) return;
            // 2 Гц → 500 ms, 4 Гц → 250 ms
            const duration = this.mode === 'beat-sync' ? '250ms' : '500ms';
            overlay.style.animation = `strobe-pulse ${duration} infinite ease-in-out`;
        }, 10);
    }

    /* ----------------------------------------------------------------- *
     *  Интенсивность (0.05‑0.45)
     * ----------------------------------------------------------------- */
    setIntensity(v) {
        this.intensity = Math.min(Math.max(v, 0.05), 0.45);
        const overlay = document.getElementById('strobe-overlay');
        if (overlay) {
            overlay.style.setProperty('--strobe-opacity', this.intensity);
            overlay.style.opacity = this.intensity;
        }
        this.saveSettings();
    }

    /* ----------------------------------------------------------------- *
     *  Управление из плеера (play / pause / stop)
     * ----------------------------------------------------------------- */
    play() {
        if (this.enabled && this.mode === 'beat-sync') {
            const overlay = document.getElementById('strobe-overlay');
            if (overlay) {
                overlay.classList.add('active');
                this.applyAnimationTiming();
            }
        }
    }
    pause() {
        if (this.enabled && this.mode === 'beat-sync') {
            const overlay = document.getElementById('strobe-overlay');
            if (overlay) overlay.classList.remove('active');
        }
    }
    stop() {
        if (this.enabled && this.mode === 'beat-sync') {
            const overlay = document.getElementById('strobe-overlay');
            if (overlay) overlay.classList.remove('active');
        }
    }

    /* ----------------------------------------------------------------- *
     *  UI‑обновление (кнопка, подсказки)
     * ----------------------------------------------------------------- */
    updateUI() {
        const btn = document.getElementById('strobe-toggle');
        if (btn) {
            btn.title = this.enabled ? 'Выключить стробоскоп' : 'Включить стробоскоп (безопасный режим)';
            btn.innerHTML = this.enabled ? '⚡' : '⚪';
            btn.classList.toggle('enabled', this.enabled);
        }
    }

    /* ----------------------------------------------------------------- *
     *  Тема меняется – обновляем overlay‑цвета
     * ----------------------------------------------------------------- */
    onThemeChange() {
        // Всё уже делаем в CSS через data‑theme, но если нужны какие‑то дополнительные действия:
        this.applyAnimationTiming();
    }
}

/* --------------------------------------------------------------- *
 *  Глобальная инициализация
 * --------------------------------------------------------------- */
let StrobeEffectInstance = null;
document.addEventListener('DOMContentLoaded', () => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq.matches) StrobeEffectInstance = new StrobeEffect();

    // реакция на изменение настройки reduced‑motion
    mq.addEventListener('change', e => {
        if (e.matches) {
            if (StrobeEffectInstance) {
                StrobeEffectInstance.disable();
                StrobeEffectInstance = null;
            }
        } else {
            if (!StrobeEffectInstance) StrobeEffectInstance = new StrobeEffect();
        }
    });
});

/* --------------------------------------------------------------- *
 *  Экспортируем публичный API, чтобы `script.js` мог вызывать
 * --------------------------------------------------------------- */
window.StrobeEffect = {
    play:        () => StrobeEffectInstance?.play(),
    pause:       () => StrobeEffectInstance?.pause(),
    stop:        () => StrobeEffectInstance?.stop(),
    toggle:      () => StrobeEffectInstance?.toggle(),
    setIntensity: i => StrobeEffectInstance?.setIntensity(i),
    setMode:     m => StrobeEffectInstance?.setMode(m),
    onThemeChange: () => StrobeEffectInstance?.onThemeChange()
};
