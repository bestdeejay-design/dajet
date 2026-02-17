/* --------------------------------------------------------------
   rays.js – контроллер световых лучей
   -------------------------------------------------------------- */
(() => {
    const overlay = document.getElementById('rays-overlay');
    if (!overlay) {
        console.warn('⚠️ #rays-overlay not found – световые лучи не инициализированы');
        return;
    }

    // добавляем отдельный элемент для третьего луча
    const third = document.createElement('div');
    third.className = 'ray-3';
    overlay.appendChild(third);

    const API = {
        /** Показать лучи */
        enable()   { overlay.classList.remove('hidden'); },

        /** Скрыть лучи */
        disable()  { overlay.classList.add('hidden'); },

        /** Переключить */
        toggle()   { overlay.classList.toggle('hidden'); },

        /**
         * Установить масштаб скорости (1 — норма,
         * 0.5 — в 2 раза быстрее, 2 — в 2 раза медленнее)
         */
        setSpeed(factor = 1) {
            overlay.style.setProperty('--ray-duration-1', `${4.5 * factor}s`);
            overlay.style.setProperty('--ray-duration-2', `${5.2 * factor}s`);
            overlay.style.setProperty('--ray-duration-3', `${6.0 * factor}s`);
        }
    };

    // экспортируем в глобальный объект, чтобы было удобно из консоли
    window.Rays = API;

    // --------- (опционально) добавляем кнопку‑тумблер в шапку ---------- //
    const addToggle = () => {
        const header = document.querySelector('.header');
        if (!header) return;

        const btn = document.createElement('button');
        btn.id = 'rays-toggle';
        btn.className = 'control-btn';
        btn.title = 'Включить/выключить световые лучи';
        btn.innerHTML = '💡';
        btn.style.marginLeft = '8px';

        btn.addEventListener('click', () => API.toggle());
        header.appendChild(btn);
    };
    addToggle();

})();
