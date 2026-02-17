/**
 * Strobe Effect Module - strobe.js
 * 
 * Модуль для создания безопасного эффекта стробоскопа на сайте DAJET.
 * Важные особенности:
 * - По умолчанию эффект ВЫКЛЮЧЕН
 * - Поддержка prefers-reduced-motion
 * - Частота пульсации не превышает 4 Гц (безопасно)
 * - Возможность отключения через интерфейс
 * - Сохранение состояния в localStorage
 */

class StrobeEffect {
    constructor() {
        // Проверяем, поддерживается ли prefers-reduced-motion
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Если пользователь предпочитает меньше анимаций, отключаем стробоскоп
        if (this.prefersReducedMotion) {
            console.log('⚠️ prefers-reduced-motion detected - strobe effect disabled');
            this.enabled = false;
            this.mode = 'constant';
            this.intensity = 0.15;
            return;
        }

        // Загружаем настройки из localStorage
        this.loadSettings();
        
        // Создаём DOM-элементы если они ещё не существуют
        this.createElements();
        
        // Инициализируем обработчики событий
        this.initEventListeners();
        
        // Обновляем состояние UI
        this.updateUI();
    }

    /**
     * Загрузка настроек из localStorage
     */
    loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem('strobeSettings')) || {};
            
            // По умолчанию эффект выключен
            this.enabled = saved.enabled ?? false;
            this.mode = saved.mode ?? 'constant'; // 'constant' или 'beat-sync'
            this.intensity = saved.intensity ?? 0.15; // 0.0 - 1.0
            
            // Убедимся, что значения в допустимых пределах
            this.intensity = Math.min(Math.max(this.intensity, 0.05), 0.3); // 5-30% прозрачность
            
        } catch (error) {
            console.warn('⚠️ Error loading strobe settings, using defaults:', error);
            this.enabled = false;
            this.mode = 'constant';
            this.intensity = 0.15;
        }
    }

    /**
     * Сохранение настроек в localStorage
     */
    saveSettings() {
        try {
            const settings = {
                enabled: this.enabled,
                mode: this.mode,
                intensity: this.intensity
            };
            localStorage.setItem('strobeSettings', JSON.stringify(settings));
        } catch (error) {
            console.warn('⚠️ Could not save strobe settings:', error);
        }
    }

    /**
     * Создание необходимых DOM-элементов
     */
    createElements() {
        // Создаём overlay слой если его нет
        if (!document.getElementById('strobe-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'strobe-overlay';
            overlay.className = 'strobe-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            document.body.appendChild(overlay);
        }

        // Добавляем кнопку управления в плеер если её нет
        const playerControls = document.querySelector('.player-controls');
        if (playerControls && !document.getElementById('strobe-toggle')) {
            const strobeBtn = document.createElement('button');
            strobeBtn.id = 'strobe-toggle';
            strobeBtn.className = 'control-btn';
            strobeBtn.title = 'Стробоскоп (безопасный режим)';
            strobeBtn.innerHTML = '⚡'; // Иконка молнии
            playerControls.insertBefore(strobeBtn, playerControls.firstChild);
        }

        // Создаём модальное окно предупреждения если его нет
        if (!document.getElementById('strobe-warning')) {
            const warningModal = document.createElement('div');
            warningModal.id = 'strobe-warning';
            warningModal.className = 'modal hidden';
            warningModal.innerHTML = `
                <h3>⚠️ Предупреждение о безопасности</h3>
                <p>Этот эффект может вызвать дискомфорт у людей с фоточувствительной эпилепсией. 
                   Используйте с осторожностью и обязательно сделайте перерывы при длительном прослушивании.</p>
                <button id="strobe-accept">Понятно, включить</button>
                <button id="strobe-decline">Отмена</button>
            `;
            document.body.appendChild(warningModal);
        }
    }

    /**
     * Инициализация обработчиков событий
     */
    initEventListeners() {
        // Кнопка включения/выключения
        const toggleBtn = document.getElementById('strobe-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }

        // Кнопки в модальном окне
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
                // При отмене не включаем эффект, но сбрасываем показ предупреждения
                this.showWarning = false;
            });
        }

        // Обновляем тему при изменении
        this.updateTheme();
    }

    /**
     * Обновление темы (новая система тем)
     */
    updateTheme() {
        // Проверяем текущую тему через атрибут data-theme
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const overlay = document.getElementById('strobe-overlay');
        
        if (overlay) {
            if (currentTheme === 'dark') {
                overlay.setAttribute('data-theme', 'dark');
            } else if (currentTheme === 'lounge') {
                overlay.setAttribute('data-theme', 'lounge');
            } else {
                overlay.removeAttribute('data-theme');
            }
        }
    }

    /**
     * Показ предупреждения при первом включении
     */
    showWarningIfNeeded() {
        // Проверяем, нужно ли показывать предупреждение
        // (показываем только при первом включении или если явно не отключено)
        const warningShown = localStorage.getItem('strobeWarningShown');
        
        if (!warningShown && this.enabled) {
            this.showWarning = true;
            localStorage.setItem('strobeWarningShown', 'true');
        }
        
        if (this.showWarning) {
            const warningModal = document.getElementById('strobe-warning');
            if (warningModal) {
                warningModal.classList.remove('hidden');
            }
            return true;
        }
        
        return false;
    }

    /**
     * Включение эффекта
     */
    enable() {
        if (this.prefersReducedMotion) {
            console.log('⚠️ Strobe effect disabled due to prefers-reduced-motion');
            return;
        }

        this.enabled = true;
        
        const overlay = document.getElementById('strobe-overlay');
        if (overlay) {
            overlay.classList.add('active');
            overlay.classList.add(`mode-${this.mode}`);
            // Устанавливаем интенсивность через стиль
            overlay.style.opacity = this.intensity;
        }

        const toggleBtn = document.getElementById('strobe-toggle');
        if (toggleBtn) {
            toggleBtn.classList.add('enabled');
        }

        this.saveSettings();
        this.updateUI();
    }

    /**
     * Выключение эффекта
     */
    disable() {
        this.enabled = false;
        
        const overlay = document.getElementById('strobe-overlay');
        if (overlay) {
            overlay.classList.remove('active', 'mode-constant', 'mode-beat');
            overlay.style.animation = 'none';
            // Маленькая задержка чтобы анимация не прыгала
            setTimeout(() => {
                if (!this.enabled) {
                    overlay.style.opacity = '0';
                }
            }, 300);
        }

        const toggleBtn = document.getElementById('strobe-toggle');
        if (toggleBtn) {
            toggleBtn.classList.remove('enabled');
        }

        this.saveSettings();
        this.updateUI();
    }

    /**
     * Переключение состояния
     */
    toggle() {
        if (this.prefersReducedMotion) {
            console.log('⚠️ Strobe effect disabled due to prefers-reduced-motion');
            return;
        }

        if (this.enabled) {
            this.disable();
        } else {
            // Показываем предупреждение при включении, если нужно
            if (!this.showWarningIfNeeded()) {
                this.enable();
            }
        }
    }

    /**
     * Установка режима работы
     * @param {string} mode - 'constant' или 'beat-sync'
     */
    setMode(mode) {
        if (!['constant', 'beat-sync'].includes(mode)) {
            console.warn('⚠️ Invalid strobe mode:', mode);
            return;
        }

        this.mode = mode;

        const overlay = document.getElementById('strobe-overlay');
        if (overlay) {
            // Обновляем классы режима
            overlay.classList.remove('mode-constant', 'mode-beat');
            if (this.enabled) {
                overlay.classList.add(`mode-${this.mode}`);
            }
        }

        // Обновляем длительность анимации в зависимости от режима
        if (this.enabled) {
            this.applyAnimationTiming();
        }

        this.saveSettings();
    }

    /**
     * Применение тайминга анимации в зависимости от режима
     */
    applyAnimationTiming() {
        const overlay = document.getElementById('strobe-overlay');
        if (!overlay || !this.enabled) return;

        // Очищаем предыдущую анимацию
        overlay.style.animation = 'none';
        
        // Применяем новую анимацию через небольшую задержку
        setTimeout(() => {
            if (this.enabled) {
                if (this.mode === 'beat-sync') {
                    // Более быстрая пульсация для beat-sync (4 Гц)
                    overlay.style.animation = `strobe-pulse 250ms infinite ease-in-out`;
                } else {
                    // Константная пульсация (2 Гц)
                    overlay.style.animation = `strobe-pulse 500ms infinite ease-in-out`;
                }
                
                // Для новых тем используем соответствующие анимации
                const currentTheme = document.documentElement.getAttribute('data-theme');
                if (currentTheme === 'dark' && this.mode === 'beat-sync') {
                    overlay.style.animation = `strobe-pulse-dark 250ms infinite ease-in-out`;
                } else if (currentTheme === 'dark') {
                    overlay.style.animation = `strobe-pulse-dark 500ms infinite ease-in-out`;
                } else if (currentTheme === 'lounge' && this.mode === 'beat-sync') {
                    overlay.style.animation = `strobe-pulse-warm 250ms infinite ease-in-out`;
                } else if (currentTheme === 'lounge') {
                    overlay.style.animation = `strobe-pulse-warm 500ms infinite ease-in-out`;
                }
            }
        }, 10);
    }

    /**
     * Установка интенсивности эффекта
     * @param {number} intensity - значение от 0.0 до 1.0
     */
    setIntensity(intensity) {
        // Ограничиваем значение в безопасных пределах
        this.intensity = Math.min(Math.max(intensity, 0.05), 0.3); // 5-30%
        
        const overlay = document.getElementById('strobe-overlay');
        if (overlay) {
            overlay.style.opacity = this.intensity;
        }

        this.saveSettings();
    }

    /**
     * Запуск эффекта (при воспроизведении музыки)
     */
    play() {
        if (this.enabled && this.mode === 'beat-sync') {
            // В режиме синхронизации с битом активируем анимацию
            const overlay = document.getElementById('strobe-overlay');
            if (overlay) {
                overlay.classList.add('active');
                this.applyAnimationTiming();
            }
        }
    }

    /**
     * Пауза эффекта
     */
    pause() {
        if (this.enabled && this.mode === 'beat-sync') {
            const overlay = document.getElementById('strobe-overlay');
            if (overlay) {
                overlay.classList.remove('active');
            }
        }
    }

    /**
     * Остановка эффекта
     */
    stop() {
        if (this.enabled && this.mode === 'beat-sync') {
            const overlay = document.getElementById('strobe-overlay');
            if (overlay) {
                overlay.classList.remove('active');
            }
        }
    }

    /**
     * Обновление UI в соответствии с текущим состоянием
     */
    updateUI() {
        const toggleBtn = document.getElementById('strobe-toggle');
        if (toggleBtn) {
            if (this.enabled) {
                toggleBtn.title = 'Выключить стробоскоп';
                toggleBtn.innerHTML = '⚡';
            } else {
                toggleBtn.title = 'Включить стробоскоп (безопасный режим)';
                toggleBtn.innerHTML = '⚪';
            }
        }
    }

    /**
     * Обработка изменения темы
     */
    onThemeChange() {
        this.updateTheme();
        
        // Если эффект активен, применяем нужную анимацию для новой темы
        if (this.enabled) {
            this.applyAnimationTiming();
        }
    }

    /**
     * Обновление при смене трека (плавный переход)
     */
    onTrackChange() {
        // В режиме beat-sync может потребоваться перезапуск анимации
        if (this.enabled && this.mode === 'beat-sync') {
            this.applyAnimationTiming();
        }
    }
}

// Создаём глобальный экземпляр StrobeEffect
let StrobeEffectInstance = null;

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, поддерживает ли браузер prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    // Создаём экземпляр только если анимации разрешены
    if (!mediaQuery.matches) {
        StrobeEffectInstance = new StrobeEffect();
    } else {
        console.log('⚠️ prefers-reduced-motion detected - strobe effect will not be initialized');
    }
    
    // Обновляем эффект при изменении предпочтений пользователя
    mediaQuery.addEventListener('change', (e) => {
        if (e.matches) {
            // Пользователь теперь предпочитает меньше анимаций
            if (StrobeEffectInstance) {
                StrobeEffectInstance.disable();
                StrobeEffectInstance = null;
            }
        } else {
            // Пользователь теперь разрешает анимации
            StrobeEffectInstance = new StrobeEffect();
        }
    });
});

// Экспортируем функции для использования в основном скрипте
window.StrobeEffect = {
    play: () => StrobeEffectInstance?.play(),
    pause: () => StrobeEffectInstance?.pause(),
    stop: () => StrobeEffectInstance?.stop(),
    toggle: () => StrobeEffectInstance?.toggle(),
    setIntensity: (intensity) => StrobeEffectInstance?.setIntensity(intensity),
    setMode: (mode) => StrobeEffectInstance?.setMode(mode),
    onThemeChange: () => StrobeEffectInstance?.onThemeChange()
};