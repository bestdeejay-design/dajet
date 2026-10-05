const Player = (function() {
    // Если storage.js по какой-то причине не загрузился — работаем без сохранения настроек.
    const Store = typeof DAJETStorage !== 'undefined' ? DAJETStorage : {
        get: (key, fallbackValue = null) => fallbackValue,
        set: () => false,
        getNumber: (key, fallbackValue) => fallbackValue
    };

    const REPEAT_MODES = { NONE: 0, ONE: 1, ALL: 2 };

    const SKINS = ['classic', 'minimal', 'compact'];
    const SKIN_LABELS = { classic: 'Classic', minimal: 'Minimal', compact: 'Compact' };

    let currentAlbum = null;
    let currentTrackIndex = -1;
    let repeatMode = REPEAT_MODES.ALL;
    let shuffleOn = false;
    let shuffleIndices = [];
    let shuffleCurrentIndex = 0;
    let currentSkin = 'classic';
    let isSeeking = false;
    // Защита от «петли» на битых файлах: считаем подряд идущие сбои загрузки.
    let consecutiveErrors = 0;
    let failedTracks = new Set();
    const MAX_CONSECUTIVE_ERRORS = 3;

    let elements = {};

    function init() {
        elements = {
            playerBar: document.getElementById('playerBar'),
            playerNotice: document.getElementById('playerNotice'),
            audioPlayer: document.getElementById('audioPlayer'),
            currentTrackCover: document.getElementById('currentTrackCover'),
            currentTrackName: document.getElementById('currentTrackName'),
            currentAlbumName: document.getElementById('currentAlbumName'),
            togglePlaylist: document.getElementById('togglePlaylist'),
            skinToggle: document.getElementById('skinToggle'),
            playlistPanel: document.getElementById('playlistPanel'),
            closePlaylist: document.getElementById('closePlaylist'),
            overlay: document.getElementById('overlay'),
            playlistContainer: document.getElementById('playlist'),
            playlistAlbumTitle: document.getElementById('playlistAlbumTitle'),
            prevBtn: document.getElementById('prevBtn'),
            playPauseBtn: document.getElementById('playPauseBtn'),
            nextBtn: document.getElementById('nextBtn'),
            shuffleBtn: document.getElementById('shuffleBtn'),
            repeatBtn: document.getElementById('repeatBtn'),
            playIcon: document.querySelector('.play-icon'),
            pauseIcon: document.querySelector('.pause-icon'),
            progressContainer: document.getElementById('progressContainer'),
            progressFill: document.getElementById('progressFill'),
            progressThumb: document.getElementById('progressThumb'),
            currentTime: document.getElementById('currentTime'),
            durationTime: document.getElementById('durationTime'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeBtn: document.getElementById('volumeBtn')
        };

        if (!elements.audioPlayer || !elements.playPauseBtn) {
            console.error('Плеер: не найдены обязательные элементы разметки, инициализация пропущена');
            return;
        }

        loadSkin();
        loadVolume();
        bindEvents();
        updateRepeatButton();
        setPlayIcon(false);
    }

    function setPlayIcon(isPlaying) {
        if (elements.playIcon) elements.playIcon.style.display = isPlaying ? 'none' : 'block';
        if (elements.pauseIcon) elements.pauseIcon.style.display = isPlaying ? 'block' : 'none';
        elements.playPauseBtn.setAttribute('aria-label', isPlaying ? 'Пауза' : 'Воспроизвести');
    }

    function showNotice(message, timeout = 6000) {
        const notice = elements.playerNotice;
        if (!notice) return;
        notice.textContent = message;
        notice.hidden = false;
        if (showNotice.timer) clearTimeout(showNotice.timer);
        if (timeout) {
            showNotice.timer = setTimeout(() => { notice.hidden = true; }, timeout);
        }
    }

    function hideNotice() {
        if (!elements.playerNotice) return;
        if (showNotice.timer) clearTimeout(showNotice.timer);
        elements.playerNotice.hidden = true;
    }

    function bindEvents() {
        const ap = elements.audioPlayer;

        ap.addEventListener('ended', handleTrackEnded);
        ap.addEventListener('play', handlePlay);
        ap.addEventListener('pause', handlePause);
        ap.addEventListener('timeupdate', handleTimeUpdate);
        ap.addEventListener('loadedmetadata', handleLoadedMetadata);
        ap.addEventListener('error', handleAudioError);
        ap.addEventListener('waiting', () => elements.playerBar.classList.add('buffering'));
        ap.addEventListener('playing', () => elements.playerBar.classList.remove('buffering'));
        ap.addEventListener('canplay', () => elements.playerBar.classList.remove('buffering'));

        elements.prevBtn.addEventListener('click', prevTrack);
        elements.nextBtn.addEventListener('click', nextTrack);
        elements.playPauseBtn.addEventListener('click', togglePlayPause);
        elements.shuffleBtn.addEventListener('click', toggleShuffle);
        elements.repeatBtn.addEventListener('click', toggleRepeat);

        elements.togglePlaylist.addEventListener('click', togglePlaylistPanel);
        elements.closePlaylist.addEventListener('click', togglePlaylistPanel);
        elements.overlay.addEventListener('click', togglePlaylistPanel);
        elements.skinToggle.addEventListener('click', cycleSkin);

        elements.progressContainer.addEventListener('click', handleProgressClick);
        elements.progressContainer.addEventListener('keydown', handleProgressKeydown);

        elements.volumeSlider.addEventListener('input', handleVolumeChange);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isPlaylistVisible()) {
                togglePlaylistPanel();
                return;
            }

            // Не перехватываем клавиши, когда пользователь работает с полем ввода,
            // кнопкой, ссылкой или слайдером: иначе Space не нажимает кнопку,
            // а стрелки не дают прокручивать страницу.
            const target = e.target;
            const isInteractive = target && (
                /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
                (target.closest && target.closest('button, a, [contenteditable="true"]'))
            );
            if (isInteractive) return;

            const insidePlayer = !!(target && target.closest && target.closest('.player-bar'));

            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                togglePlayPause();
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                seekRelative(5);
                return;
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                seekRelative(-5);
                return;
            }
            // Вверх/вниз листают страницу — реагируем только внутри плеера.
            if (insidePlayer && e.key === 'ArrowUp') {
                e.preventDefault();
                adjustVolume(0.05);
                return;
            }
            if (insidePlayer && e.key === 'ArrowDown') {
                e.preventDefault();
                adjustVolume(-0.05);
            }
        });
    }

    function seekRelative(seconds) {
        const ap = elements.audioPlayer;
        if (!ap.duration) return;
        ap.currentTime = Math.max(0, Math.min(ap.duration, ap.currentTime + seconds));
    }

    function adjustVolume(delta) {
        const slider = elements.volumeSlider;
        let v = parseFloat(slider.value) + delta;
        v = Math.max(0, Math.min(1, v));
        slider.value = v;
        handleVolumeChange();
    }

    function describeAudioError(code) {
        // MediaError может отсутствовать (старые движки, jsdom) — не падаем.
        const ERR = typeof MediaError !== 'undefined' ? MediaError : {
            MEDIA_ERR_ABORTED: 1, MEDIA_ERR_NETWORK: 2, MEDIA_ERR_DECODE: 3, MEDIA_ERR_SRC_NOT_SUPPORTED: 4
        };
        switch (code) {
            case ERR.MEDIA_ERR_ABORTED: return 'загрузка прервана';
            case ERR.MEDIA_ERR_NETWORK: return 'сетевая ошибка';
            case ERR.MEDIA_ERR_DECODE: return 'файл повреждён';
            case ERR.MEDIA_ERR_SRC_NOT_SUPPORTED: return 'файл недоступен или формат не поддерживается';
            default: return 'не удалось воспроизвести';
        }
    }

    function handleAudioError() {
        const ap = elements.audioPlayer;
        const reason = describeAudioError(ap.error && ap.error.code);
        const album = currentAlbum;
        const track = album && album.tracks[currentTrackIndex];
        const trackName = track ? track.name : 'Трек';
        console.error('Ошибка воспроизведения:', trackName, '—', reason, ap.error);

        // Показываем корректное состояние кнопки и сообщаем пользователю.
        setPlayIcon(false);
        elements.playerBar.classList.remove('buffering');
        if (track && track.file) failedTracks.add(track.file);
        markTrackUnavailable(currentTrackIndex);

        // Пытаемся автоматически перейти к следующему треку, но не зацикливаемся.
        consecutiveErrors++;
        if (consecutiveErrors <= MAX_CONSECUTIVE_ERRORS && currentAlbum && currentTrackIndex >= 0) {
            showNotice(`«${trackName}» не воспроизводится (${reason}). Переключаю на следующий трек…`);
            setTimeout(() => {
                if (currentAlbum && currentTrackIndex >= 0) nextTrack();
            }, 1200);
        } else {
            showNotice(`«${trackName}» не воспроизводится (${reason}). Попробуйте выбрать другой трек.`, 0);
            if ('mediaSession' in navigator) {
                try { navigator.mediaSession.playbackState = 'none'; } catch (err) { /* не критично */ }
            }
        }
    }

    function markTrackUnavailable(index) {
        if (index < 0 || !elements.playlistContainer) return;
        const items = elements.playlistContainer.querySelectorAll('.playlist-item');
        const item = items[index];
        if (item) {
            item.classList.add('is-unavailable');
            item.setAttribute('aria-disabled', 'true');
        }
    }

    function handleTimeUpdate() {
        if (isSeeking) return;
        updateProgress();
    }

    function handleLoadedMetadata() {
        updateDuration();
    }

    function updateProgress() {
        const ap = elements.audioPlayer;
        if (!ap.duration) return;
        const pct = (ap.currentTime / ap.duration) * 100;
        elements.progressFill.style.width = pct + '%';
        elements.progressThumb.style.left = pct + '%';
        elements.progressContainer.setAttribute('aria-valuenow', Math.round(pct));
        elements.currentTime.textContent = formatTime(ap.currentTime);
    }

    function updateDuration() {
        elements.durationTime.textContent = formatTime(elements.audioPlayer.duration);
    }

    function formatTime(t) {
        if (!t || !isFinite(t)) return '0:00';
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function handleProgressClick(e) {
        const ap = elements.audioPlayer;
        if (!ap.duration) return;
        const rect = elements.progressContainer.querySelector('.progress-track').getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const time = pct * ap.duration;
        ap.currentTime = Math.max(0, Math.min(ap.duration, time));
    }

    function handleProgressKeydown(e) {
        const ap = elements.audioPlayer;
        if (!ap.duration) return;
        let step = 0;
        if (e.key === 'ArrowRight') step = 5;
        else if (e.key === 'ArrowLeft') step = -5;
        else return;
        e.preventDefault();
        ap.currentTime = Math.max(0, Math.min(ap.duration, ap.currentTime + step));
    }

    function handleVolumeChange() {
        // Значение обязательно зажимаем в 0..1: присвоение volume вне диапазона
        // бросает IndexSizeError в браузере.
        const raw = parseFloat(elements.volumeSlider.value);
        const v = isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.8;
        elements.volumeSlider.value = v;
        try {
            elements.audioPlayer.volume = v;
        } catch (err) {
            console.warn('Не удалось изменить громкость:', err && err.message);
        }
        Store.set('playerVolume', v);
        updateVolumeIcon(v);
    }

    function loadVolume() {
        const v = Store.getNumber('playerVolume', 0.8, 0, 1);
        try {
            elements.audioPlayer.volume = v;
        } catch (err) { /* игнорируем, громкость останется по умолчанию */ }
        elements.volumeSlider.value = v;
        updateVolumeIcon(v);
    }

    function updateVolumeIcon(v) {
        if (!elements.volumeBtn) return;
        const icon = elements.volumeBtn.querySelector('.volume-icon');
        if (!icon) return;
        if (v === 0) {
            icon.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13 0l-3-3v2.34l3 3 3-3V6l-3 3zm0 4.66l-3-3v2.34l3 3 3-3v-2.34l-3 3z');
        } else if (v < 0.5) {
            icon.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.49 4.49 0 002.5-3.5z');
        } else {
            icon.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.49 4.49 0 002.5-3.5zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z');
        }
    }

    function handleTrackEnded() {
        if (repeatMode === REPEAT_MODES.ONE) {
            elements.audioPlayer.currentTime = 0;
            elements.audioPlayer.play().catch(() => {});
        } else {
            nextTrack();
        }
    }

    function handlePlay() {
        setPlayIcon(true);
        consecutiveErrors = 0;
        elements.playerBar.classList.remove('buffering');
    }

    function handlePause() {
        setPlayIcon(false);
    }

    function updateMediaSession(album, track) {
        if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;

        const coverSrc = track.cover || album.cover || createFallbackCover(512);

        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.name,
                artist: album.title,
                album: album.title,
                artwork: [
                    { src: toUrlPath(coverSrc), sizes: '512x512' }
                ]
            });
        } catch (err) {
            console.warn('Media Session metadata недоступны:', err && err.message);
        }

        // Часть браузеров не поддерживает отдельные действия и бросает исключение —
        // изолируем каждый вызов, чтобы не сломать переключение трека.
        const handlers = {
            play: () => { elements.audioPlayer.play().catch(() => {}); },
            pause: () => { elements.audioPlayer.pause(); },
            previoustrack: prevTrack,
            nexttrack: nextTrack,
            seekbackward: () => seekRelative(-10),
            seekforward: () => seekRelative(10)
        };
        Object.keys(handlers).forEach((action) => {
            try {
                navigator.mediaSession.setActionHandler(action, handlers[action]);
            } catch (err) {
                /* действие не поддерживается этим браузером */
            }
        });
    }

    function selectTrack(album, trackIndex) {
        showPlayer();

        if (currentAlbum !== album) {
            currentAlbum = album;
            renderPlaylist();
            elements.playlistAlbumTitle.textContent = album.title;
        }

        const track = album.tracks[trackIndex];
        if (!track) {
            console.warn('Трек не найден:', album && album.id, trackIndex);
            return;
        }

        currentTrackIndex = trackIndex;
        hideNotice();
        elements.audioPlayer.src = toUrlPath(track.file);
        elements.audioPlayer.load();

        const playPromise = elements.audioPlayer.play();
        if (playPromise && playPromise.catch) {
            playPromise.catch(() => {});
        }

        elements.currentTrackName.textContent = track.name;
        elements.currentAlbumName.textContent = album.title;

        const coverSrc = track.cover || album.cover || createFallbackCover();
        elements.currentTrackCover.src = toUrlPath(coverSrc);

        updateMediaSession(album, track);
        highlightPlaylistItem(trackIndex);

        if (shuffleOn) {
            generateShuffleIndices();
            shuffleCurrentIndex = shuffleIndices.indexOf(trackIndex);
        }
    }

    function playCurrent() {
        if (currentTrackIndex === -1) {
            if (currentAlbum && currentAlbum.tracks.length > 0) {
                selectTrack(currentAlbum, 0);
            }
        } else {
            const playPromise = elements.audioPlayer.play();
            if (playPromise) {
                playPromise.catch(() => {});
            }
        }
    }

    function pauseCurrent() {
        elements.audioPlayer.pause();
    }

    function togglePlayPause() {
        if (elements.audioPlayer.paused) {
            playCurrent();
        } else {
            pauseCurrent();
        }
    }

    function nextTrack() {
        if (!currentAlbum || currentTrackIndex === -1) return;
        if (shuffleOn) {
            navigateShuffle(1);
        } else {
            navigateSequential(1);
        }
    }

    function prevTrack() {
        if (!currentAlbum || currentTrackIndex === -1) return;
        if (elements.audioPlayer.currentTime > 3) {
            elements.audioPlayer.currentTime = 0;
            return;
        }
        if (shuffleOn) {
            navigateShuffle(-1);
        } else {
            navigateSequential(-1);
        }
    }

    function navigateSequential(direction) {
        let newIndex = currentTrackIndex + direction;
        const trackCount = currentAlbum.tracks.length;

        if (newIndex >= trackCount || newIndex < 0) {
            if (repeatMode === REPEAT_MODES.ALL) {
                newIndex = direction > 0 ? 0 : trackCount - 1;
            } else if (repeatMode === REPEAT_MODES.ONE) {
                restartCurrentTrack();
                return;
            } else {
                return;
            }
        }
        selectTrack(currentAlbum, newIndex);
    }

    function navigateShuffle(direction) {
        if (shuffleIndices.length === 0) generateShuffleIndices();

        let newShuffleIndex = shuffleCurrentIndex + direction;

        if (newShuffleIndex >= shuffleIndices.length || newShuffleIndex < 0) {
            if (repeatMode === REPEAT_MODES.ALL) {
                newShuffleIndex = direction > 0 ? 0 : shuffleIndices.length - 1;
            } else if (repeatMode === REPEAT_MODES.ONE) {
                restartCurrentTrack();
                return;
            } else {
                return;
            }
        }

        shuffleCurrentIndex = newShuffleIndex;
        const newTrackIndex = shuffleIndices[shuffleCurrentIndex];
        selectTrack(currentAlbum, newTrackIndex);
    }

    function restartCurrentTrack() {
        elements.audioPlayer.currentTime = 0;
        const playPromise = elements.audioPlayer.play();
        if (playPromise) {
            playPromise.catch(() => {});
        }
    }

    function generateShuffleIndices() {
        if (!currentAlbum) return;
        const n = currentAlbum.tracks.length;
        shuffleIndices = Array.from({ length: n }, (_, i) => i);

        for (let i = shuffleIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffleIndices[i], shuffleIndices[j]] = [shuffleIndices[j], shuffleIndices[i]];
        }

        if (currentTrackIndex >= 0) {
            shuffleCurrentIndex = shuffleIndices.indexOf(currentTrackIndex);
            if (shuffleCurrentIndex === -1) {
                shuffleIndices.unshift(currentTrackIndex);
                shuffleCurrentIndex = 0;
            }
        } else {
            shuffleCurrentIndex = 0;
        }
    }

    function toggleShuffle() {
        if (!currentAlbum) return;
        shuffleOn = !shuffleOn;
        if (shuffleOn) {
            generateShuffleIndices();
        } else {
            shuffleIndices = [];
        }
        updateShuffleButton();
    }

    function toggleRepeat() {
        repeatMode = (repeatMode + 1) % 3;
        updateRepeatButton();
    }

    function updateShuffleButton() {
        elements.shuffleBtn.classList.toggle('active', shuffleOn);
    }

    function updateRepeatButton() {
        elements.repeatBtn.classList.toggle('active', repeatMode !== REPEAT_MODES.NONE);
    }

    function renderPlaylist() {
        if (!currentAlbum) {
            elements.playlistContainer.innerHTML = '<div style="padding: 1rem; color: var(--text-secondary);">Выберите альбом</div>';
            return;
        }

        elements.playlistContainer.innerHTML = '';
        currentAlbum.tracks.forEach((track, idx) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.setAttribute('role', 'option');
            item.setAttribute('tabindex', '0');
            item.setAttribute('aria-selected', idx === currentTrackIndex ? 'true' : 'false');
            if (idx === currentTrackIndex) item.classList.add('active');
            if (failedTracks.has(track.file)) item.classList.add('is-unavailable');

            const coverImg = track.cover || currentAlbum.cover || createFallbackCover(40);

            item.innerHTML = `
                <img class="playlist-item-cover" src="${escapeHtml(toUrlPath(coverImg))}" alt="" loading="lazy" decoding="async">
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${escapeHtml(track.name)}</div>
                    <div class="playlist-item-album">${escapeHtml(currentAlbum.title)}</div>
                </div>
            `;

            const choose = () => {
                selectTrack(currentAlbum, idx);
                if (isPlaylistVisible()) togglePlaylistPanel();
            };

            item.addEventListener('click', choose);
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    choose();
                }
            });

            elements.playlistContainer.appendChild(item);
        });
    }

    function highlightPlaylistItem(index) {
        const items = elements.playlistContainer.querySelectorAll('.playlist-item');
        items.forEach((item, i) => {
            item.classList.toggle('active', i === index);
            item.setAttribute('aria-selected', i === index ? 'true' : 'false');
        });
    }

    function togglePlaylistPanel() {
        const isVisible = elements.playlistPanel.classList.contains('open');
        if (isVisible) {
            elements.playlistPanel.classList.remove('open');
            elements.playlistPanel.setAttribute('aria-hidden', 'true');
            elements.overlay.classList.remove('visible');
            elements.overlay.setAttribute('aria-hidden', 'true');
            elements.togglePlaylist.setAttribute('aria-expanded', 'false');
            // Возвращаем фокус туда, откуда панель открывали, если он был внутри неё.
            if (elements.playlistPanel.contains(document.activeElement)) {
                elements.togglePlaylist.focus();
            }
        } else {
            elements.playlistPanel.classList.add('open');
            elements.playlistPanel.setAttribute('aria-hidden', 'false');
            elements.overlay.classList.add('visible');
            elements.overlay.setAttribute('aria-hidden', 'false');
            elements.togglePlaylist.setAttribute('aria-expanded', 'true');
            elements.playlistAlbumTitle.textContent = currentAlbum ? currentAlbum.title : 'Плейлист';
            renderPlaylist();
            if (elements.closePlaylist) elements.closePlaylist.focus();
        }
    }

    function showPlayer() {
        if (!elements.playerBar.classList.contains('active')) {
            elements.playerBar.classList.add('active');
        }
    }

    function isPlaylistVisible() {
        return elements.playlistPanel.classList.contains('open');
    }

    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Безопасное превращение пути к файлу в URL.
     * Имена треков содержат пробелы, апострофы, «&», кириллицу — всё это
     * должно быть закодировано, иначе в отдельных браузерах ссылка ломается.
     */
    function toUrlPath(path) {
        if (!path) return '';
        if (/^(data:|blob:|https?:)/i.test(path)) return path;
        return String(path).split('/').map((segment) => encodeURIComponent(segment)).join('/');
    }

    function createFallbackCover(size = 100) {
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'%3E%3Crect width='${size}' height='${size}' fill='%23333'/%3E%3C/svg%3E`;
    }

    function setCurrentAlbum(album) {
        currentAlbum = album;
    }

    function getCurrentAlbum() {
        return currentAlbum;
    }

    function getCurrentTrackIndex() {
        return currentTrackIndex;
    }

    function setCurrentTrackIndex(index) {
        currentTrackIndex = index;
    }

    function getElements() {
        return elements;
    }

    function loadSkin() {
        const savedSkin = Store.get('playerSkin');
        if (savedSkin && SKINS.includes(savedSkin)) {
            currentSkin = savedSkin;
        }
        applySkin();
    }

    function cycleSkin() {
        const currentIndex = SKINS.indexOf(currentSkin);
        const nextIndex = (currentIndex + 1) % SKINS.length;
        currentSkin = SKINS[nextIndex];
        Store.set('playerSkin', currentSkin);
        applySkin();
    }

    function applySkin() {
        SKINS.forEach(skin => {
            elements.playerBar.classList.remove(`player-${skin}`);
        });
        elements.playerBar.classList.add(`player-${currentSkin}`);
        elements.skinToggle.textContent = SKIN_LABELS[currentSkin];
    }

    return {
        init,
        selectTrack,
        togglePlayPause,
        nextTrack,
        prevTrack,
        togglePlaylistPanel,
        setCurrentAlbum,
        getCurrentAlbum,
        getCurrentTrackIndex,
        setCurrentTrackIndex,
        getElements,
        renderPlaylist,
        escapeHtml,
        toUrlPath,
        showNotice
    };
})();
