/**
 * Strobe Effect Module - strobe.js
 *
 * Пояснение к изменениям:
 *  • Интенсивность теперь диапазон 0.05‑0.45 (≈ 45 % яркости).  
 *  • Яркость управляется CSS‑переменной `--strobe-opacity`.  
 *  • `mix-blend-mode: screen` делает свет ярче на тёмных темах.  
 *  • Добавлен «лучевой» конусный градиент (через ::before overlay).  
 *  • Ползунок яркости #strobe-intensity (5‑45 %) позволяет пользователю подстроить эффект.  
 *  • События `music:play/pause/stop` автоматически включают/выключают анимацию, если режим beat‑sync.  
 */

class StrobeEffect {
    constructor() {
        // Учитываем prefers-reduced-motion
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (this.prefersReducedMotion) {
            console.log('⚠️ prefers-reduced-motion detected – strobe disabled');
            this.enabled = false;
            this.mode   = 'constant';
            this.intensity = 0.15;
            return;
        }

        // Настройки из localStorage
        this.loadSettings();

        // Создаём нужные DOM‑элементы (overlay, кнопка, ползунок)
        this.createElements();

        // Привязываем обработчики
        this.initEventListeners();

        // Применяем состояние UI
        this.updateUI();
    }

    /* ------------------------------------------------------------------ *
     *  Настройки (load / save)
     * ------------------------------------------------------------------ */
    loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem('strobeSettings')) || {};
            this.enabled   = saved.enabled ?? false;
            this.mode      = saved.mode ?? 'constant';          // 'constant' | 'beat-sync'
            this.intensity = saved.intensity ?? 0.15;           // 0‑1
            // Ограничиваем безопасный диапазон
            this.intensity = Math.min(Math.max(this.intensity, 0.05), 0.45);
        } catch (e) {
            console.warn('⚠️ Error reading strobeSettings – using defaults', e);
            this.enabled   = false;
            this.mode      = 'constant';
            this.intensity = 0.15;
        }
    }

    saveSettings() {
        try {
            const obj = {
                enabled:   this.enabled,
                mode:      this.mode,
                intensity: this.intensity
            };
            localStorage.setItem('strobeSettings', JSON.stringify(obj));
        } catch (e) {
            console.warn('⚠️ Could not save strobeSettings', e);
        }
    }

    /* ------------------------------------------------------------------ *
     *  Создание DOM‑элементов
     * ------------------------------------------------------------------ */
    createElements() {
        // overlay (если ещё нет)
        if (!document.getElementById('strobe-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'strobe-overlay';
            overlay.className = 'strobe-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            document.body.appendChild(overlay);
        }

        // кнопка в блоке управления плеером
        const controls = document.querySelector('.player-controls');
        if (controls && !document.getElementById('strobe-toggle')) {
            const btn = document.createElement('button');
            btn.id = 'strobe-toggle';
            btn.className = 'control-btn';
            btn.title = 'Стробоскоп (безопасный режим)';
            btn.innerHTML = '⚡';
            controls.insertBefore(btn, controls.firstChild);
        }

        // ползунок яркости (опционально)
        if (!document.getElementById('strobe-intensity')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'strobe-intensity-wrapper';
            wrapper.innerHTML = `
                <label for="strobe-intensity">Яркость</label>
                <input type="range" id="strobe-intensity" min="5" max="45" step="5"
                       value="${Math.round(this.intensity * 100)}">
            `;
            document.body.appendChild(wrapper);
        }
    }

    /* ------------------------------------------------------------------ *
     *  Обработчики событий
     * ------------------------------------------------------------------ */
    initEventListeners() {
        // кнопка вкл/выкл
        const toggleBtn = document.getElementById('strobe-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }

        // ползунок яркости
        const intensitySlider = document.getElementById('strobe-intensity');
        if (intensitySlider) {
            intensitySlider.addEventListener('input', e => {
                const val = Number(e.target.value) / 100; // 0.05‑0.45
                this.setIntensity(val);
            });
        }

        // предупреждение — уже есть в index.html
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
                this.showWarning = false; // просто закрываем, не включаем
            });
        }

        // реакция на смену темы (через событие theme:change)
        document.addEventListener('theme:change', () => {
            this.updateTheme();
            if (this.enabled) this.applyAnimationTiming();
        });
    }

    /* ------------------------------------------------------------------ *
     *  Управление интенсивностью
     * ------------------------------------------------------------------ */
    setIntensity(v) {
        this.intensity = Math.min(Math.max(v, 0.05), 0.45);
        const overlay = document.getElementById('strobe-overlay');
        if (overlay) {
            overlay.style.setProperty('--strobe-opacity', this.intensity);
            overlay.style.opacity = this.intensity;                  // основной слой
        }
        // синхронизируем ползунок, если он есть
        const slider = document.getElementById('strobe-intensity');
        if (slider) slider.value = Math.round(this.intensity * 100);
        this.saveSettings();
    }

    /* ------------------------------------------------------------------ *
     *  Вкл / выкл
     * ------------------------------------------------------------------ */
    enable() {
        if (this.prefersReducedMotion) return;
        this.enabled = true;

        const overlay = document.getElementById('strobe-overlay');
        if (overlay) {
            overlay.style.setProperty('--strobe-opacity', this.intensity);
            overlay.style.opacity = this.intensity;
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
        if (this.prefersReducedMotion) {
            console.log('⚠️ Strobe disabled – prefers-reduced-motion');
            return;
        }

        if (this.enabled) this.disable();
        else {
            // При первом включении показываем предупреждение, если ещё не показывали
            if (!localStorage.getItem('strobeWarningShown')) {
                this.showWarning = true;
                localStorage.setItem('strobeWarningShown', 'true');
                const modal = document.getElementById('strobe-warning');
                if (modal) modal.classList.remove('hidden');
                // Включение произойдёт после подтверждения (см. обработчик acceptBtn)
            } else {
                this.enable();
            }
        }
    }

    /* ------------------------------------------------------------------ *
     *  Режим (constant / beat-sync)
     * ------------------------------------------------------------------ */
    setMode(mode) {
        if (!['constant', 'beat-sync'].includes(mode)) {
            console.warn('⚠️ Invalid strobe mode:', mode);
            return;
        }
        this.mode = mode;
        if (this.enabled) this.applyAnimationTiming();
        this.saveSettings();
    }

    /* ------------------------------------------------------------------ *
     *  Применение анимации (частота)
     * ------------------------------------------------------------------ */
    applyAnimationTiming() {
        const overlay = document.getElementById('strobe-overlay');
        if (!overlay || !this.enabled) return;

        overlay.style.animation = 'none';
        setTimeout(() => {
            if (!this.enabled) return;
            const anim = this.mode === 'beat-sync' ? 'strobe-pulse-fast' : 'strobe-pulse';
            const dur = this.mode === 'beat-sync' ? '250ms' : '500ms';
            overlay.style.animation = `${anim} ${dur} infinite ease-in-out`;
        }, 10);
    }

    /* ------------------------------------------------------------------ *
     *  Тема (изменение цвета фона)
     * ------------------------------------------------------------------ */
    updateTheme() {
        // Тема хранится в data-theme на <html>.
        // Стили в CSS реагируют автоматически, но можно выставить data‑attribute overlay‑а
        const theme = document.documentElement.getAttribute('data-theme');
        const overlay = document.getElementById('strobe-overlay');
        if (overlay) overlay.setAttribute('data-current-theme', theme || '');
    }

    /* ------------------------------------------------------------------ *
     *  Методы, вызываемые плеером
     * ------------------------------------------------------------------ */
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

    /* ------------------------------------------------------------------ *
     *  UI‑обновление (текст/цвет кнопки)
     * ------------------------------------------------------------------ */
    updateUI() {
        const btn = document.getElementById('strobe-toggle');
        if (btn) {
            btn.title = this.enabled ? 'Выключить стробоскоп' : 'Включить стробоскоп (безопасный режим)';
            btn.innerHTML = this.enabled ? '⚡' : '⚪';
            btn.classList.toggle('enabled', this.enabled);
        }
    }

    /* ------------------------------------------------------------------ *
     *  Публичный API
     * ------------------------------------------------------------------ */
    onThemeChange() {
        this.updateTheme();
        if (this.enabled) this.applyAnimationTiming();
    }
}

/* --------------------------------------------------------------- *
 *  Инициализация глобального экземпляра
 * --------------------------------------------------------------- */
let StrobeEffectInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // Если пользователь явно отключил анимацию, не создаём объект.
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq.matches) {
        StrobeEffectInstance = new StrobeEffect();
    } else {
        console.log('⚠️ prefers-reduced-motion detected – strobe will not be initialized');
    }

    // Слушаем изменение предпочтения в реальном времени
    mq.addEventListener('change', e => {
        if (e.matches) {
            // пользователь включил «меньше анимаций»
            if (StrobeEffectInstance) {
                StrobeEffectInstance.disable();
                StrobeEffectInstance = null;
            }
        } else {
            // пользователь разрешил анимацию
            if (!StrobeEffectInstance) StrobeEffectInstance = new StrobeEffect();
        }
    });
});

/* --------------------------------------------------------------- *
 *  Экспортируем публичные функции для использования в script.js
 * --------------------------------------------------------------- */
window.StrobeEffect = {
    play:            () => StrobeEffectInstance?.play(),
    pause:           () => StrobeEffectInstance?.pause(),
    stop:            () => StrobeEffectInstance?.stop(),
    toggle:          () => StrobeEffectInstance?.toggle(),
    setIntensity:    v => StrobeEffectInstance?.setIntensity(v),
    setMode:         m => StrobeEffectInstance?.setMode(m),
    onThemeChange:  () => StrobeEffectInstance?.onThemeChange()
};
