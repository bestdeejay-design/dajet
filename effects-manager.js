/* --------------------------------------------------------------
   effects-manager.js – центральный контроллер «GSAP‑эффекты».
   -------------------------------------------------------------- */
(() => {
    // Публичный объект, экспортируем в window
    const API = {};

    // -----------------------------------------------------------------
    // 1. Card entrance (scroll‑trigger)
    // -----------------------------------------------------------------
    const initCardEntrance = () => {
        if (!window.EffectsConfig.get('cardEntrance')) return;
        if (gsap.matchMedia('(prefers-reduced-motion: reduce)')) return; // skip

        // каждый .album-card появляется последовательно при скролле
        gsap.utils.toArray('.album-card').forEach(card => {
            gsap.from(card, {
                opacity: 0,
                y: 30,
                scale: 0.96,
                duration: 0.6,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: card,
                    start: "top 85%",
                    toggleActions: "play none none none"
                }
            });
        });
    };

    // -----------------------------------------------------------------
    // 2. Hover‑tilt (нормальный CSS‑hover + небольшая анимация)
    // -----------------------------------------------------------------
    const enableCardHover = () => {
        if (!window.EffectsConfig.get('cardHover')) return;
        document.querySelectorAll('.album-card').forEach(card => {
            card.classList.add('card-hover');
        });
    };
    const disableCardHover = () => {
        document.querySelectorAll('.album-card').forEach(card => {
            card.classList.remove('card-hover');
        });
    };

    // -----------------------------------------------------------------
    // 3. Ripple on click (delegated)
    // -----------------------------------------------------------------
    const createRipple = (e) => {
        if (!window.EffectsConfig.get('clickRipple')) return;
        const btn = e.target.closest('.control-btn, .album-card, .track-item');
        if (!btn) return;

        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const size = Math.max(rect.width, rect.height) * 2;
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size/2}px`;
        ripple.style.top  = `${e.clientY - rect.top  - size/2}px`;
        btn.appendChild(ripple);
        gsap.to(ripple, {
            scale: 1,
            opacity: 0,
            duration: 0.45,
            ease: "power1.out",
            onComplete: () => ripple.remove()
        });
    };
    const initRipple = () => {
        document.body.addEventListener('click', createRipple);
    };

    // -----------------------------------------------------------------
    // 4. Track pulse (соответствует текущему треку)
    // -----------------------------------------------------------------
    const setTrackPulse = (trackEl) => {
        if (!window.EffectsConfig.get('trackPulse')) return;
        // Убираем у всех
        document.querySelectorAll('.track-item').forEach(el =>
            el.classList.remove('track-pulse')
        );
        // Добавляем к текущему
        if (trackEl) trackEl.classList.add('track-pulse');
    };

    // -----------------------------------------------------------------
    // 5. Audio visualizer (canvas)
    // -----------------------------------------------------------------
    const visualizer = {
        canvas: null,
        ctx: null,
        analyser: null,
        animationId: null,
        init() {
            if (!window.EffectsConfig.get('visualizer')) return;
            if (gsap.matchMedia('(prefers-reduced-motion: reduce)')) return;
            const player = document.getElementById('player');
            if (!player) return;

            this.canvas = document.createElement('canvas');
            this.canvas.id = 'visualizer';
            player.appendChild(this.canvas);
            this.ctx = this.canvas.getContext('2d');
            this.resize();

            window.addEventListener('resize', () => this.resize());

            const audio = window.DAJETPlayerInstance?.state?.audio; // будет доступно после инициализации
            if (!audio) return;
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createMediaElementSource(audio);
            this.analyser = audioCtx.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            this.analyser.connect(audioCtx.destination);
            this.loop();
        },
        resize() {
            if (!this.canvas) return;
            const rect = this.canvas.getBoundingClientRect();
            this.canvas.width  = rect.width;
            this.canvas.height = rect.height;
        },
        loop() {
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const draw = () => {
                this.analyser.getByteFrequencyData(dataArray);
                const { width, height } = this.canvas;
                this.ctx.clearRect(0,0,width,height);
                const barWidth = width / bufferLength;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] / 255 * height;
                    const hue = (i / bufferLength) * 360;
                    this.ctx.fillStyle = `hsl(${hue},80%,60%)`;
                    this.ctx.fillRect(i*barWidth, height - barHeight, barWidth-1, barHeight);
                }
                this.animationId = requestAnimationFrame(draw);
            };
            draw();
        },
        destroy() {
            if (this.animationId) cancelAnimationFrame(this.animationId);
            if (this.canvas) this.canvas.remove();
            this.canvas = null;
        }
    };

    // -----------------------------------------------------------------
    // 6. API – включать / выключать отдельные эффекты
    // -----------------------------------------------------------------
    API.enable = (name) => {
        window.EffectsConfig.set(name, true);
        // Принудительно перезапускаем нужный блок
        switch (name) {
            case 'cardEntrance': initCardEntrance(); break;
            case 'cardHover':    enableCardHover(); break;
            case 'clickRipple':  /* уже работает, ничего делать не надо */ break;
            case 'trackPulse':   // в момент изменения трека вызываем setTrackPulse()
                break;
            case 'visualizer':  visualizer.init(); break;
        }
    };
    API.disable = (name) => {
        window.EffectsConfig.set(name, false);
        switch (name) {
            case 'cardEntrance': /* нет «отключить», просто не вызываем */ break;
            case 'cardHover':    disableCardHover(); break;
            case 'clickRipple':  /* отключаем обработчик */
                document.body.removeEventListener('click', createRipple);
                break;
            case 'trackPulse':   // просто убираем класс
                document.querySelectorAll('.track-item').forEach(el => el.classList.remove('track-pulse'));
                break;
            case 'visualizer':  visualizer.destroy(); break;
        }
    };
    API.toggle = (name) => {
        const cur = window.EffectsConfig.get(name);
        cur ? API.disable(name) : API.enable(name);
    };

    // -----------------------------------------------------------------
    // 7. Инициализация (вызывается после DOMContentLoaded)
    // -----------------------------------------------------------------
    const initAll = () => {
        const cfg = window.EffectsConfig.load();
        // Обходя каждый параметр, вызываем соответствующий init‑метод
        if (cfg.cardEntrance) initCardEntrance();
        if (cfg.cardHover)    enableCardHover();
        if (cfg.clickRipple)  initRipple();
        if (cfg.visualizer)   visualizer.init();
        // trackPulse – будет вызываться из script.js (см. ниже)
    };

   /* Добавьте в конец файла effects-manager.js (после initAll) */
(() => {
    const createSettingsButton = () => {
        const header = document.querySelector('.header');
        if (!header) return;
        const btn = document.createElement('button');
        btn.id = 'effects-toggle';
        btn.className = 'control-btn';
        btn.title = 'Настройки визуальных эффектов';
        btn.innerHTML = '⚙️';
        btn.style.marginLeft = '8px';
        header.appendChild(btn);

        // панель
        const panel = document.createElement('div');
        panel.id = 'effects-panel';
        panel.style.cssText = `
            position: absolute; top: 100%; right: 0;
            background: var(--bg-secondary);
            border: 1px solid var(--glass-border);
            border-radius: 6px;
            padding: 0.5rem 1rem;
            box-shadow: var(--shadow);
            display: none;
            z-index: 10000;
        `;
        btn.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        header.appendChild(panel);

        const cfg = window.EffectsConfig.load();
        const list = document.createElement('ul');
        list.style.listStyle = 'none';
        list.style.margin = 0;
        list.style.padding = 0;
        const items = [
            { name: 'cardEntrance', label: 'Появление карточек' },
            { name: 'cardHover',    label: 'Hover‑tilt' },
            { name: 'clickRipple',  label: 'Ripple‑клик' },
            { name: 'trackPulse',   label: 'Подсветка трека' },
            { name: 'visualizer',   label: 'Визуализатор' }
        ];
        items.forEach(item => {
            const li = document.createElement('li');
            li.style.marginBottom = '0.3rem';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = `ef-${item.name}`;
            cb.checked = !!cfg[item.name];
            cb.addEventListener('change', () => {
                if (cb.checked) window.EffectsManager.enable(item.name);
                else            window.EffectsManager.disable(item.name);
            });
            const lbl = document.createElement('label');
            lbl.htmlFor = cb.id;
            lbl.textContent = ' ' + item.label;
            li.append(cb, lbl);
            list.appendChild(li);
        });
        panel.appendChild(list);
    };
    document.addEventListener('DOMContentLoaded', createSettingsButton);
})();


    // Публично
    window.EffectsManager = API;
    // Вешаем init‑функцию на DOMContentLoaded (после ваших скриптов)
    document.addEventListener('DOMContentLoaded', initAll);
})();
