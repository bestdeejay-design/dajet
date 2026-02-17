/**
 * Theme Manager Module - theme-manager.js
 * 
 * Модуль для управления темами сайта DAJET:
 * - Тёмная тема (Dark): ночь, космос, звёзды
 * - Lounge тема: у камина, огонь, искры
 */

class ThemeManager {
    constructor() {
        // Загружаем сохранённую тему из localStorage
        this.currentTheme = this.loadSavedTheme();
        
        // Инициализируем DOM-элементы
        this.initElements();
        
        // Применяем сохранённую тему
        this.applyTheme(this.currentTheme);
        
        // Инициализируем обработчики событий
        this.initEventListeners();
    }

    /**
     * Загрузка сохранённой темы из localStorage
     */
    loadSavedTheme() {
        try {
            const saved = localStorage.getItem('dajet-theme');
            if (saved && ['dark', 'lounge'].includes(saved)) {
                return saved;
            }
            // По умолчанию возвращаем тёмную тему
            return 'dark';
        } catch (error) {
            console.warn('⚠️ Error loading saved theme, using default:', error);
            return 'dark';
        }
    }

    /**
     * Инициализация DOM-элементов
     */
    initElements() {
        // Создаём контейнер для SVG фона если его нет
        if (!document.getElementById('theme-background')) {
            const bgContainer = document.createElement('div');
            bgContainer.id = 'theme-background';
            bgContainer.className = 'theme-background';
            bgContainer.setAttribute('aria-hidden', 'true');
            document.body.appendChild(bgContainer);
        }

        // Находим кнопку переключения тем
        this.themeToggleBtn = document.getElementById('theme-toggle') || 
                             document.getElementById('themeToggle');
        
        // Если кнопки нет, создаём её
        if (!this.themeToggleBtn) {
            this.createThemeToggleButton();
        }
    }

    /**
     * Создание кнопки переключения тем
     */
    createThemeToggleButton() {
        // Ищем подходящее место для кнопки (например, в header)
        const header = document.querySelector('.header') || 
                      document.querySelector('header');
        
        if (header) {
            this.themeToggleBtn = document.createElement('button');
            this.themeToggleBtn.id = 'theme-toggle';
            this.themeToggleBtn.className = 'control-btn theme-toggle';
            this.themeToggleBtn.title = 'Сменить тему';
            this.themeToggleBtn.innerHTML = `
                <svg class="icon-dark" viewBox="0 0 24 24" width="24" height="24">🌙</svg>
                <svg class="icon-lounge" viewBox="0 0 24 24" width="24" height="24">🔥</svg>
            `;
            header.appendChild(this.themeToggleBtn);
        }
    }

    /**
     * Инициализация обработчиков событий
     */
    initEventListeners() {
        if (this.themeToggleBtn) {
            this.themeToggleBtn.addEventListener('click', () => this.toggle());
        }

        // Обработка изменения темы другими модулями
        document.addEventListener('theme:change', (event) => {
            this.onThemeChangeInternal(event.detail.theme);
        });
    }

    /**
     * Применение темы к документу
     */
    applyTheme(theme) {
        // Удаляем старые классы тем
        document.documentElement.removeAttribute('data-theme');
        document.body.classList.remove('dark-theme', 'lounge-theme');
        
        // Применяем новую тему
        document.documentElement.setAttribute('data-theme', theme);
        document.body.classList.add(`${theme}-theme`);
        
        // Загружаем соответствующий SVG фон
        this.loadThemeBackground(theme);
        
        // Обновляем UI кнопки
        this.updateThemeButton(theme);
        
        // Сохраняем тему
        this.saveTheme(theme);
        
        // Вызываем событие изменения темы
        this.dispatchThemeChangeEvent(theme);
        
        // Уведомляем стробоскоп о смене темы
        if (window.StrobeEffect && typeof window.StrobeEffect.onThemeChange === 'function') {
            window.StrobeEffect.onThemeChange();
        }
    }

    /**
     * Загрузка SVG фона для темы
     */
    async loadThemeBackground(theme) {
        try {
            const bgContainer = document.getElementById('theme-background');
            if (!bgContainer) return;

            // Очищаем текущий фон
            bgContainer.innerHTML = '';

            // Загружаем SVG для выбранной темы
            const response = await fetch(`themes/${theme}.svg`);
            if (!response.ok) {
                console.warn(`⚠️ Could not load ${theme}.svg background`);
                // Создаем резервный градиент при отсутствии SVG
                this.createFallbackGradient(bgContainer, theme);
                return;
            }

            const svgContent = await response.text();
            bgContainer.innerHTML = svgContent;
            
            // Добавляем класс для идентификации активной темы
            bgContainer.setAttribute('data-current-theme', theme);
        } catch (error) {
            console.warn(`⚠️ Error loading theme background for ${theme}:`, error);
            // Создаем резервный градиент при ошибке
            const bgContainer = document.getElementById('theme-background');
            if (bgContainer) {
                this.createFallbackGradient(bgContainer, theme);
            }
        }
    }
    
    /**
     * Создание резервного градиента при отсутствии SVG
     */
    createFallbackGradient(container, theme) {
        const gradientDiv = document.createElement('div');
        if (theme === 'dark') {
            gradientDiv.style.background = 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)';
        } else { // lounge
            gradientDiv.style.background = 'linear-gradient(135deg, #4a2300 0%, #6b3e00 50%, #8c5e00 100%)';
        }
        gradientDiv.style.position = 'absolute';
        gradientDiv.style.top = '0';
        gradientDiv.style.left = '0';
        gradientDiv.style.width = '100%';
        gradientDiv.style.height = '100%';
        gradientDiv.style.zIndex = '-1';
        container.appendChild(gradientDiv);
    }

    /**
     * Обновление UI кнопки переключения темы
     */
    updateThemeButton(theme) {
        if (!this.themeToggleBtn) return;

        // Обновляем видимость иконок в зависимости от темы
        const darkIcon = this.themeToggleBtn.querySelector('.icon-dark');
        const loungeIcon = this.themeToggleBtn.querySelector('.icon-lounge');

        if (darkIcon && loungeIcon) {
            if (theme === 'dark') {
                darkIcon.style.display = 'block';
                loungeIcon.style.display = 'none';
                this.themeToggleBtn.title = 'Переключить на Lounge тему';
            } else {
                darkIcon.style.display = 'none';
                loungeIcon.style.display = 'block';
                this.themeToggleBtn.title = 'Переключить на Тёмную тему';
            }
        } else {
            // Если нет специальных иконок, используем текст
            if (theme === 'dark') {
                this.themeToggleBtn.textContent = '🔥'; // Lounge icon
                this.themeToggleBtn.title = 'Переключить на Lounge тему';
            } else {
                this.themeToggleBtn.textContent = '🌙'; // Dark icon
                this.themeToggleBtn.title = 'Переключить на Тёмную тему';
            }
        }
    }

    /**
     * Сохранение темы в localStorage
     */
    saveTheme(theme) {
        try {
            localStorage.setItem('dajet-theme', theme);
        } catch (error) {
            console.warn('⚠️ Could not save theme to localStorage:', error);
        }
    }

    /**
     * Отправка события изменения темы
     */
    dispatchThemeChangeEvent(theme) {
        const event = new CustomEvent('theme:change', {
            detail: { theme }
        });
        document.dispatchEvent(event);
    }

    /**
     * Получение текущей темы
     */
    getTheme() {
        return this.currentTheme;
    }

    /**
     * Установка темы
     */
    setTheme(theme) {
        if (!['dark', 'lounge'].includes(theme)) {
            console.warn('⚠️ Invalid theme:', theme);
            return;
        }

        if (this.currentTheme !== theme) {
            this.currentTheme = theme;
            this.applyTheme(theme);
        }
    }

    /**
     * Переключение между темами
     */
    toggle() {
        const newTheme = this.currentTheme === 'dark' ? 'lounge' : 'dark';
        this.setTheme(newTheme);
    }

    /**
     * Внутренняя обработка изменения темы
     */
    onThemeChangeInternal(theme) {
        if (this.currentTheme !== theme) {
            this.currentTheme = theme;
            this.applyTheme(theme);
        }
    }

    /**
     * Регистрация слушателя изменения темы
     */
    onThemeChange(callback) {
        if (typeof callback === 'function') {
            document.addEventListener('theme:change', (event) => {
                callback(event.detail.theme);
            });
        }
    }
}

// Инициализация ThemeManager после загрузки DOM
let ThemeManagerInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    ThemeManagerInstance = new ThemeManager();
});

// Экспортируем API для использования в других модулях
window.ThemeManager = {
    getTheme: () => ThemeManagerInstance?.getTheme(),
    setTheme: (theme) => ThemeManagerInstance?.setTheme(theme),
    toggle: () => ThemeManagerInstance?.toggle(),
    onThemeChange: (callback) => ThemeManagerInstance?.onThemeChange(callback)
};