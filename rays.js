/* --------------------------------------------------------------
   rays.js – простой контроллер световых лучей
   -------------------------------------------------------------- */

(() => {
    const overlay = document.getElementById('rays-overlay');

    if (!overlay) {
        console.warn('⚠️ #rays-overlay element not found');
        return;
    }

    // Создаём дополнительный элемент .ray-3, которое объявлено в CSS
    const third = document.createElement('div');
    third.className = 'ray-3';
    overlay.appendChild(third);

    // ----------------------------------------------------------------
    // Публичный API: window.Rays = { enable, disable, toggle, setSpeed }
    // ----------------------------------------------------------------
    const API = {
        /** Включить лучи */
        enable() {
            overlay.classList.remove('hidden');
        },

        /** Выключить лучи */
        disable() {
            overlay.classList.add('hidden');
        },

        /** Переключить текущее состояние */
        toggle() {
            overlay.classList.toggle('hidden');
        },

        /**
         * Изменить скорость всех лучей.
         * speed = 0.5 → в 2 раза быстрее,
         * speed = 2   → в 2 раза медленнее.
         */
        setSpeed(speed = 1) {
            // Ожидаем, что в CSS анимации объявлены как
            //   animation: ray-move-1 4.5s …
            // Умножаем длительность на speed.
            const overlays = [overlay];
            overlays.forEach(el => {
                // перебираем все pseudo‑элементы (они наследуют
                // стили с тем же именем анимаций)
                const styles = getComputedStyle(el);
                const anim1 = styles.getPropertyValue('animation-name');
                // если анимации существуют – меняем её duration
                if (anim1.includes('ray-move-1')) {
                    el.style.setProperty('--ray-duration-1', `${4.5 * speed}s`);
                }
                if (anim1.includes('ray-move-2')) {
                    el.style.setProperty('--ray-duration-2', `${5.2 * speed}s`);
                }
                if (anim1.includes('ray-move-3')) {
                    el.style.setProperty('--ray-duration-3', `${6.0 * speed}s`);
                }
            });
            // На практике проще переопределить duration прямо в CSS:
            //   .rays-overlay::before   { animation-duration: var(--ray-duration-1, 4.5s); }
            //   .rays-overlay::after    { animation-duration: var(--ray-duration-2, 5.2s); }
            //   .rays-overlay .ray-3    { animation-duration: var(--ray-duration-3, 6s); }
        }
    };

    // Экспортируем в глобальную область (чтобы было доступно из консоли)
    window.Rays = API;

    // ----------------------------------------------------------------
    // (Опционально) Добавляем небольшую кнопку‑переключатель в шапку
    // ----------------------------------------------------------------
    const addToggleBtn = () => {
        const header = document.querySelector('.header');
        if (!header) return;

        const btn = document.createElement('button');
        btn.id = 'rays-toggle';
        btn.className = 'control-btn';   // стили из плеера уже подходят
        btn.title = 'Включить/выключить световые лучи';
        btn.innerHTML = '💡';
        btn.style.marginLeft = '8px';

        btn.addEventListener('click', () => API.toggle());
        header.appendChild(btn);
    };

    // Сразу добавляем кнопку (можно закомментировать, если не нужно)
    addToggleBtn();

})();
