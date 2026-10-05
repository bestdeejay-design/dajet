(function() {
    // Если storage.js по какой-то причине не загрузился — работаем без сохранения настроек.
    const Store = typeof DAJETStorage !== 'undefined' ? DAJETStorage : {
        get: (key, fallbackValue = null) => fallbackValue,
        set: () => false,
        getNumber: (key, fallbackValue) => fallbackValue
    };

    let albums = [];

    const gallery = document.getElementById('gallery');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');

    // ---------------------------------------------------------------- утилиты

    function esc(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const CONFIG = (typeof window !== 'undefined' && window.DAJET_CONFIG) || {};
    const MEDIA_BASE = typeof CONFIG.mediaBase === 'string' ? CONFIG.mediaBase : '';

    // Путь с пробелами, апострофами и кириллицей должен быть корректно закодирован.
    // Если коллекция вынесена на внешнее хранилище (config.js → mediaBase),
    // подставляем его адрес.
    function urlPath(path) {
        if (!path) return '';
        if (/^(data:|blob:|https?:)/i.test(path)) return path;
        const encoded = String(path).split('/').map((segment) => encodeURIComponent(segment)).join('/');
        return MEDIA_BASE ? MEDIA_BASE + encoded : encoded;
    }

    function plural(n, one, few, many) {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
        return many;
    }

    function showError(message, canRetry) {
        if (!errorEl) return;
        errorEl.textContent = '';
        errorEl.append(message);
        if (canRetry) {
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'retry-btn';
            retry.textContent = 'Повторить';
            retry.addEventListener('click', () => {
                errorEl.style.display = 'none';
                if (loadingEl) loadingEl.style.display = '';
                loadLibrary();
            });
            errorEl.append(' ', retry);
        }
        errorEl.style.display = 'block';
    }

    function hideError() {
        if (errorEl) errorEl.style.display = 'none';
    }

    // ---------------------------------------------------------------- загрузка

    async function loadLibrary() {
        hideError();
        if (loadingEl) loadingEl.style.display = '';

        try {
            const response = await fetch('library.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error('сервер вернул ' + response.status);
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error('неверный формат library.json');

            albums = data.filter((album) => album && Array.isArray(album.tracks) && album.tracks.length > 0);

            if (loadingEl) loadingEl.style.display = 'none';
            renderGallery();

            if (albums.length === 0) {
                showError('Коллекция пока пуста — в альбомах нет треков.', false);
            } else if (typeof Player !== 'undefined' && Player.restoreSession) {
                try {
                    Player.restoreSession(albums);
                } catch (err) {
                    console.warn('Не удалось восстановить последний трек:', err);
                }
            }
        } catch (err) {
            console.error('Не удалось загрузить библиотеку:', err);
            if (loadingEl) loadingEl.style.display = 'none';
            showError('Не удалось загрузить коллекцию: ' + (err && err.message ? err.message : 'неизвестная ошибка') + '.', true);
        }
    }

    // ---------------------------------------------------------------- галерея

    function renderGallery() {
        if (!gallery) return;
        gallery.innerHTML = '';

        albums.forEach((album, index) => {
            const card = document.createElement('div');
            card.className = 'album-card';
            card.style.setProperty('--i', index);
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', album.title + ': ' + album.tracks.length + ' ' +
                plural(album.tracks.length, 'трек', 'трека', 'треков'));

            const cover = album.cover
                ? `<img class="album-cover" src="${esc(urlPath(album.cover))}" alt="" loading="lazy" decoding="async" width="400" height="400">`
                : `<div class="album-cover album-cover--fallback" aria-hidden="true">📀</div>`;

            const count = album.tracks.length + ' ' + plural(album.tracks.length, 'трек', 'трека', 'треков');

            card.innerHTML = `
                ${cover}
                <div class="album-info">
                    <div class="album-title">${esc(album.title)}</div>
                    <div class="album-meta">${count}</div>
                </div>
            `;

            const coverImg = card.querySelector('.album-cover');
            if (coverImg && coverImg.tagName === 'IMG' && typeof Player !== 'undefined' && Player.attachCoverFallback) {
                Player.attachCoverFallback(coverImg, 400);
            }

            const open = () => openAlbum(album);

            card.addEventListener('click', open);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open();
                }
            });

            gallery.appendChild(card);
        });

        // Появление карточек: чистый CSS со ступенчатой задержкой (--i),
        // без внешних библиотек и CDN.
        requestAnimationFrame(() => {
            gallery.querySelectorAll('.album-card').forEach((card) => card.classList.add('visible'));
        });
    }

    function openAlbum(album) {
        if (typeof Player === 'undefined' || !Player.getElements) {
            showError('Плеер недоступен — не загрузился player.js.', false);
            return;
        }
        const elements = Player.getElements();
        if (!elements || !elements.playerBar) return;

        elements.playerBar.classList.add('active');

        const currentAlbum = Player.getCurrentAlbum();
        const currentTrackIndex = Player.getCurrentTrackIndex();

        if (currentAlbum !== album) {
            Player.setCurrentAlbum(album);
            elements.playlistAlbumTitle.textContent = album.title;
            if (!elements.playlistPanel.classList.contains('open')) {
                Player.togglePlaylistPanel();
            } else {
                Player.renderPlaylist();
            }
            if (currentTrackIndex === -1 && album.cover) {
                elements.currentAlbumName.textContent = album.title;
                elements.currentTrackCover.src = urlPath(album.cover);
            }
        } else {
            Player.togglePlaylistPanel();
        }
    }

    // ---------------------------------------------------------------- тема

    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = themeToggle ? themeToggle.querySelector('.sun') : null;
    const moonIcon = themeToggle ? themeToggle.querySelector('.moon') : null;

    function applyThemeMeta(theme) {
        const color = theme === 'light' ? '#f5f5f7' : '#0b0b0b';
        document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
            meta.setAttribute('content', color);
        });
    }

    function setTheme(theme) {
        const next = theme === 'light' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        Store.set('theme', next);

        if (sunIcon) sunIcon.style.display = next === 'dark' ? 'block' : 'none';
        if (moonIcon) moonIcon.style.display = next === 'dark' ? 'none' : 'block';
        if (themeToggle) themeToggle.setAttribute('aria-pressed', next === 'light' ? 'true' : 'false');

        applyThemeMeta(next);
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: next } }));
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'dark';
            setTheme(current === 'dark' ? 'light' : 'dark');
        });
    }

    setTheme(Store.get('theme', 'dark'));

    // ---------------------------------------------------------------- запуск

    try {
        Player.init();
    } catch (err) {
        console.error('Не удалось инициализировать плеер:', err);
        showError('Плеер не смог запуститься, но галерея доступна.', false);
    }

    loadLibrary();
})();
