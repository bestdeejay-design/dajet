const Player = (function() {
    // Если storage.js по какой-то причине не загрузился — работаем без сохранения настроек.
    const Store = typeof DAJETStorage !== 'undefined' ? DAJETStorage : {
        get: (key, fallbackValue = null) => fallbackValue,
        set: () => false,
        getNumber: (key, fallbackValue) => fallbackValue
    };

    const REPEAT_MODES = { NONE: 0, ONE: 1, ALL: 2 };

    // Настройки (config.js) с безопасными значениями по умолчанию.
    const CONFIG = (typeof window !== 'undefined' && window.DAJET_CONFIG) || {};
    // Целевая интегрированная громкость (LUFS). Треки в коллекции сведены
    // с разбросом ~6 LU — без выравнивания одни песни заметно громче других.
    // Значение — примерно середина коллекции, чтобы подстройка шла в обе
    // стороны и не «съедала» громкость.
    const TARGET_LUFS = typeof CONFIG.targetLufs === 'number' ? CONFIG.targetLufs : -13.5;
    // Ограничители: не усиливаем тихие треки больше, чем на 6 дБ, и не
    // ослабляем больше, чем на 12 дБ (запас, чтобы не упереться в клиппинг).
    const MAX_GAIN_DB = typeof CONFIG.maxGainUpDb === 'number' ? CONFIG.maxGainUpDb : 6;
    const MIN_GAIN_DB = typeof CONFIG.maxGainDownDb === 'number' ? CONFIG.maxGainDownDb : -12;
    // Запас по истинному пику (дБ), который оставляем при подстройке громкости.
    const PEAK_HEADROOM_DB = typeof CONFIG.peakHeadroomDb === 'number' ? CONFIG.peakHeadroomDb : 1;
    // Код ошибки «загрузка прервана»: возникает, когда МЫ переключаем трек,
    // а не когда что-то сломалось.
    const ERR_ABORTED = 1;
    // Аудио и обложки могут лежать на внешнем хранилище (см. config.js).
    const MEDIA_BASE = typeof CONFIG.mediaBase === 'string' ? CONFIG.mediaBase : '';

    const SKINS = ['classic', 'minimal', 'compact'];
    const SKIN_LABELS = { classic: 'Classic', minimal: 'Minimal', compact: 'Compact' };

    let library = [];                 // все альбомы коллекции (для непрерывного прослушивания)
    let currentAlbum = null;
    let currentTrackIndex = -1;
    let repeatMode = REPEAT_MODES.ALL;
    let shuffleOn = false;
    let shuffleOrder = [];            // порядок перемешивания по всей коллекции
    let shuffleCurrentIndex = 0;
    let prefetchedFile = null;
    let bufferingTimer = null;
    let lastNoticeKind = null;
    let mediaSessionTick = 0;
    let currentSkin = 'classic';
    let isSeeking = false;
    // Сколько секунд «пустого» вступления пропустить у текущего трека.
    let pendingTrim = null;
    // Защита от «петли» на битых файлах: считаем подряд идущие сбои загрузки.
    let consecutiveErrors = 0;
    let normalizeOn = true;
    let baseVolume = 0.8;
    let failedTracks = new Set();
    let audioGraph = null;            // Web Audio для iOS: { ctx, gain }
    let audioCtx = null;              // контекст создаём один раз, маршрутизируем только «живой»
    let nativeVolumeSupported = null; // определяется один раз при запуске
    let hasPlayedOnce = false;
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
            volumeBtn: document.getElementById('volumeBtn'),
            prefetchPlayer: document.getElementById('prefetchPlayer'),
            playAllBtn: document.getElementById('playAllBtn'),
            normalizeBtn: document.getElementById('normalizeBtn'),
            lyricsBtn: document.getElementById('lyricsBtn'),
            lyricsPanel: document.getElementById('lyricsPanel'),
            lyricsTitle: document.getElementById('lyricsTitle'),
            lyricsText: document.getElementById('lyricsText'),
            closeLyrics: document.getElementById('closeLyrics')
        };

        if (!elements.audioPlayer || !elements.playPauseBtn) {
            console.error('Плеер: не найдены обязательные элементы разметки, инициализация пропущена');
            return;
        }

        loadSkin();
        // Обложка трека существует с самого начала — обработчик ставим сразу,
        // иначе «сломанная» картинка возможна ещё до выбора трека.
        attachCoverFallback(elements.currentTrackCover, 120);
        nativeVolumeWorks();
        normalizeOn = Store.get('playerNormalize', '1') !== '0';
        updateNormalizeButton();
        updateLyricsButton();
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

    function showNotice(message, timeout = 6000, kind = 'warn') {
        const notice = elements.playerNotice;
        if (!notice) return;
        notice.textContent = message;
        notice.classList.toggle('is-info', kind === 'info');
        notice.hidden = false;
        lastNoticeKind = kind;
        if (showNotice.timer) clearTimeout(showNotice.timer);
        if (timeout) {
            showNotice.timer = setTimeout(() => { notice.hidden = true; }, timeout);
        }
    }

    function hideNotice() {
        if (!elements.playerNotice) return;
        if (showNotice.timer) clearTimeout(showNotice.timer);
        elements.playerNotice.hidden = true;
        lastNoticeKind = null;
    }

    function bindEvents() {
        const ap = elements.audioPlayer;

        ap.addEventListener('ended', handleTrackEnded);
        ap.addEventListener('play', handlePlay);
        ap.addEventListener('pause', handlePause);
        ap.addEventListener('timeupdate', handleTimeUpdate);
        ap.addEventListener('loadedmetadata', handleLoadedMetadata);
        ap.addEventListener('error', handleAudioError);
        ap.addEventListener('waiting', handleBufferingStart);
        // Обрезку вступления пробуем на нескольких событиях: в разных
        // браузерах готовность к перемотке наступает по-разному.
        ap.addEventListener('playing', () => { clearBuffering(); prefetchNextTrack(); applyStartTrim(); wakeAudioContext(); });
        ap.addEventListener('canplay', () => { clearBuffering(); applyStartTrim(); });
        ap.addEventListener('loadedmetadata', () => { clearBuffering(); updatePositionState(true); });
        ap.addEventListener('stalled', handleBufferingStart);

        // Первое касание/клавиша — единственная возможность разбудить звук в iOS
        ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
            document.addEventListener(eventName, wakeAudioContext, { passive: true });
        });

        elements.prevBtn.addEventListener('click', prevTrack);
        elements.nextBtn.addEventListener('click', nextTrack);
        elements.playPauseBtn.addEventListener('click', togglePlayPause);
        elements.shuffleBtn.addEventListener('click', toggleShuffle);
        elements.repeatBtn.addEventListener('click', toggleRepeat);

        elements.togglePlaylist.addEventListener('click', togglePlaylistPanel);
        elements.closePlaylist.addEventListener('click', togglePlaylistPanel);
        elements.overlay.addEventListener('click', () => {
            if (isLyricsVisible()) closeLyricsPanel();
            if (isPlaylistVisible()) togglePlaylistPanel();
        });
        elements.skinToggle.addEventListener('click', cycleSkin);

        elements.progressContainer.addEventListener('click', handleProgressClick);
        elements.progressContainer.addEventListener('keydown', handleProgressKeydown);

        elements.volumeSlider.addEventListener('input', handleVolumeChange);

        if (elements.playAllBtn) elements.playAllBtn.addEventListener('click', playAll);
        if (elements.normalizeBtn) elements.normalizeBtn.addEventListener('click', toggleNormalize);
        if (elements.lyricsBtn) elements.lyricsBtn.addEventListener('click', toggleLyricsPanel);
        if (elements.closeLyrics) elements.closeLyrics.addEventListener('click', toggleLyricsPanel);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (isLyricsVisible()) { closeLyricsPanel(); return; }
                if (isPlaylistVisible()) { togglePlaylistPanel(); return; }
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
                return;
            }
            // M — выключить/включить звук (учитываем и русскую раскладку).
            if (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') {
                toggleMute();
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

    /**
     * Если трек грузится долго (медленный интернет, большой файл), человек
     * должен видеть, что сайт работает, а не думать, что всё зависло.
     */
    function handleBufferingStart() {
        elements.playerBar.classList.add('buffering');
        if (bufferingTimer) clearTimeout(bufferingTimer);
        bufferingTimer = setTimeout(() => {
            if (elements.audioPlayer.readyState < 3 && !elements.audioPlayer.paused) {
                showNotice('Загружаю трек…', 0, 'info');
            }
        }, 3000);
    }

    function clearBuffering() {
        elements.playerBar.classList.remove('buffering');
        if (bufferingTimer) {
            clearTimeout(bufferingTimer);
            bufferingTimer = null;
        }
        if (lastNoticeKind === 'info') hideNotice();
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
        const code = ap.error && ap.error.code;

        // Нет источника — событие не про наш трек (бывает при очистке плеера).
        if (!ap.getAttribute('src')) return;

        // «Загрузка прервана» — это мы сами переключили трек или браузер
        // отменил загрузку (частый случай при быстрых кликах по плейлисту).
        // Считать это сбоем нельзя: иначе плеер начинал бы пропускать треки.
        if (code === ERR_ABORTED) return;

        const reason = describeAudioError(code);
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
        applyStartTrim();
    }

    /**
     * Треки коллекции начинаются с 0.4–1.1 с тишины — при непрерывном
     * прослушивании это превращается в заметные паузы между песнями.
     * Генератор библиотеки измеряет эту тишину и записывает в поле trim;
     * здесь мы просто перематываем начало. Значение применяется один раз
     * при загрузке трека, чтобы не мешать ручной перемотке.
     */
    function applyStartTrim() {
        if (pendingTrim == null) return;
        const trim = pendingTrim;
        pendingTrim = null;
        const ap = elements.audioPlayer;
        if (!isFinite(ap.duration) || ap.duration <= trim + 1) return;
        try {
            if (ap.currentTime < trim) ap.currentTime = trim;
        } catch (err) {
            // некоторые браузеры не дают перематывать до готовности — не беда
        }
    }

    function updateProgress() {
        const ap = elements.audioPlayer;
        if (!ap.duration) return;
        const pct = (ap.currentTime / ap.duration) * 100;
        elements.progressFill.style.width = pct + '%';
        elements.progressThumb.style.left = pct + '%';
        elements.progressContainer.setAttribute('aria-valuenow', Math.round(pct));
        elements.progressContainer.setAttribute('aria-valuetext',
            formatTime(ap.currentTime) + ' из ' + formatTime(ap.duration));
        elements.currentTime.textContent = formatTime(ap.currentTime);
        updatePositionState(false);
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
        baseVolume = v;
        Store.set('playerVolume', v);
        applyVolume();
        updateVolumeIcon(v);
    }

    function loadVolume() {
        const v = Store.getNumber('playerVolume', 0.8, 0, 1);
        elements.volumeSlider.value = v;
        baseVolume = v;
        applyVolume();
        updateVolumeIcon(v);
    }

    /**
     * Приводит громкость трека к целевому уровню, чтобы песни не «прыгали»
     * по громкости. Слайдер остаётся главным: выравнивание лишь корректирует
     * его значение в пределах ±6/−12 дБ.
     */
    function gainDbFor(track) {
        if (!normalizeOn || !track) return 0;
        let gain = 0;
        if (typeof track.lufs === 'number' && isFinite(track.lufs)) {
            gain = TARGET_LUFS - track.lufs;
        }
        // Запас по истинному пику. У большинства треков коллекции пик выше
        // 0 dBTP, поэтому «слепое» усиление срезало бы вершины и давало
        // искажения. Здесь усиление ограничено так, чтобы до потолка
        // оставался PEAK_HEADROOM_DB.
        if (typeof track.peak === 'number' && isFinite(track.peak)) {
            gain = Math.min(gain, -track.peak - PEAK_HEADROOM_DB);
        }
        if (gain > MAX_GAIN_DB) gain = MAX_GAIN_DB;
        if (gain < MIN_GAIN_DB) gain = MIN_GAIN_DB;
        return gain;
    }

    function effectiveVolume() {
        const track = currentAlbum && currentTrackIndex >= 0 ? currentAlbum.tracks[currentTrackIndex] : null;
        const gain = gainDbFor(track);
        return {
            gain,
            value: Math.max(0, Math.min(1, baseVolume * Math.pow(10, gain / 20)))
        };
    }

    /**
     * На iPhone/iPad свойство audio.volume не работает (браузер его игнорирует).
     * В этом случае громкость и выравнивание проводим через Web Audio API —
     * иначе «Ровно» на iOS молча ничего бы не делало.
     */
    function nativeVolumeWorks() {
        if (nativeVolumeSupported !== null) return nativeVolumeSupported;
        try {
            const ap = elements.audioPlayer;
            const probe = 0.123;
            const prev = ap.volume;
            ap.volume = probe;
            const works = Math.abs(ap.volume - probe) < 0.01;
            ap.volume = prev;
            nativeVolumeSupported = works;
            if (!works) {
                console.warn('Браузер игнорирует audio.volume (iOS) — включаю регулировку через Web Audio');
            }
            return works;
        } catch (err) {
            nativeVolumeSupported = false;
            return false;
        }
    }

    function ensureAudioGraph() {
        if (audioGraph) return audioGraph;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        try {
            if (!audioCtx) audioCtx = new Ctx();

            // Звук направляем в граф ТОЛЬКО когда контекст уже работает.
            // Если маршрутизировать через «спящий» контекст, на iOS вместо
            // музыки будет полная тишина — это хуже, чем просто ровная
            // громкость чуть громче желаемой.
            if (audioCtx.state !== 'running') {
                audioCtx.resume().catch(() => {});
                return null;
            }

            const source = audioCtx.createMediaElementSource(elements.audioPlayer);
            const gainNode = audioCtx.createGain();
            gainNode.gain.value = 1;
            source.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            audioGraph = { ctx: audioCtx, gain: gainNode };
            return audioGraph;
        } catch (err) {
            console.warn('Web Audio недоступен, громкость остаётся системной:', err && err.message);
            return null;
        }
    }

    /**
     * Будим аудиоконтекст на действиях пользователя. После того как он
     * проснулся, применяем громкость — тогда граф создастся и «Ровно»
     * заработает. До этого музыка играет обычным путём, без тишины.
     */
    function wakeAudioContext() {
        if (!audioCtx) return;
        if (audioCtx.state === 'running') {
            if (!audioGraph) applyVolume();
            return;
        }
        audioCtx.resume().then(() => {
            if (audioCtx && audioCtx.state === 'running' && !audioGraph) applyVolume();
        }).catch(() => {});
    }

    function applyVolume() {
        const { gain, value } = effectiveVolume();
        // Подпись «Ровно: … дБ» показываем сразу, независимо от пути громкости.
        updateNormalizeHint(gain);
        try {
            if (nativeVolumeWorks()) {
                elements.audioPlayer.volume = value;
            } else if (!hasPlayedOnce && !audioGraph) {
                // До первого воспроизведения AudioContext был бы «спящим»,
                // поэтому отложим создание графа до первого play.
                return;
            } else {
                // Путь для iOS: громкость элемента не действует, применяем gain.
                const graph = ensureAudioGraph();
                if (graph) {
                    elements.audioPlayer.volume = 1;
                    graph.gain.gain.value = value;
                } else {
                    elements.audioPlayer.volume = value;
                }
            }
        } catch (err) {
            console.warn('Не удалось изменить громкость:', err && err.message);
        }
    }

    function updateNormalizeHint(gain) {
        if (!elements.normalizeBtn) return;
        const parts = [];
        if (normalizeOn && Math.abs(gain) > 0.5) {
            parts.push((gain > 0 ? '+' : '') + gain.toFixed(1) + ' дБ');
        }
        elements.normalizeBtn.title = normalizeOn
            ? 'Громкость выровнена по коллекции' + (parts.length ? ' (' + parts[0] + ')' : '')
            : 'Выравнивание громкости выключено';
    }

    function toggleNormalize() {
        normalizeOn = !normalizeOn;
        Store.set('playerNormalize', normalizeOn ? '1' : '0');
        updateNormalizeButton();
        applyVolume();
        showNotice(normalizeOn
            ? 'Выравнивание громкости включено: треки звучат ровно'
            : 'Выравнивание громкости выключено: громкость как в файле', 3500);
    }

    function updateNormalizeButton() {
        if (!elements.normalizeBtn) return;
        elements.normalizeBtn.classList.toggle('active', normalizeOn);
        elements.normalizeBtn.setAttribute('aria-pressed', normalizeOn ? 'true' : 'false');
        elements.normalizeBtn.textContent = 'Ровно';
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
        hasPlayedOnce = true;
        if (!nativeVolumeWorks()) {
            // Мы внутри пользовательского действия — самое время поднять граф.
            // Если контекст ещё не запустился, звук пойдёт обычным путём
            // (без «Ровно», но и без тишины), а граф включится позже.
            ensureAudioGraph();
            wakeAudioContext();
            applyVolume();
        }
        updatePositionState(true);
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
                    { src: toUrlPath(coverSrc), sizes: '512x512' },
                    { src: toUrlPath(coverSrc), sizes: '1024x1024' }
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
        pendingTrim = typeof track.trim === 'number' && isFinite(track.trim) && track.trim > 0
            ? track.trim
            : null;
        elements.audioPlayer.src = toUrlPath(track.file);
        elements.audioPlayer.load();

        const playPromise = elements.audioPlayer.play();
        if (playPromise && playPromise.catch) {
            playPromise.catch(() => {});
        }

        elements.currentTrackName.textContent = track.name;
        elements.currentAlbumName.textContent = album.title;

        const coverSrc = track.cover || album.cover || createFallbackCover();
        attachCoverFallback(elements.currentTrackCover, 120);
        nativeVolumeWorks();
        elements.currentTrackCover.src = toUrlPath(coverSrc);

        applyVolume();
        updateLyricsButton();
        if (isLyricsVisible()) {
            if (hasLyrics(track)) {
                elements.lyricsTitle.textContent = track.name;
                renderLyrics(track);
            } else {
                closeLyricsPanel();
            }
        }

        updateMediaSession(album, track);
        highlightPlaylistItem(trackIndex);
        saveSession(album, trackIndex);

        if (shuffleOn) {
            if (shuffleOrder.length === 0) buildShuffleOrder();
            syncShuffleCursor();
        }
        prefetchNextTrack();
        announceTrackChange(album, trackIndex);
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

    function albumIndex(album) {
        if (!album) return -1;
        return library.indexOf(album);
    }

    /**
     * Переход к следующему/предыдущему альбому. Возвращает false, если
     * двигаться некуда (библиотека не задана или альбом один).
     */
    function moveToAdjacentAlbum(direction) {
        if (!currentAlbum || library.length < 2) return false;
        const idx = albumIndex(currentAlbum);
        if (idx === -1) return false;

        let next = idx + direction;
        if (next < 0) next = library.length - 1;
        if (next >= library.length) next = 0;

        const album = library[next];
        if (!album || !album.tracks || album.tracks.length === 0) return false;

        const trackIndex = direction > 0 ? 0 : album.tracks.length - 1;
        selectTrack(album, trackIndex);
        return true;
    }

    function navigateSequential(direction) {
        let newIndex = currentTrackIndex + direction;
        const trackCount = currentAlbum.tracks.length;

        if (newIndex >= trackCount || newIndex < 0) {
            if (repeatMode === REPEAT_MODES.ALL) {
                // Сначала пробуем продолжить следующим альбомом — так коллекция
                // играет подряд, а не зацикливается на одном альбоме.
                if (moveToAdjacentAlbum(direction)) return;
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
        if (shuffleOrder.length === 0) buildShuffleOrder();

        let next = shuffleCurrentIndex + direction;

        if (next >= shuffleOrder.length || next < 0) {
            if (repeatMode === REPEAT_MODES.ALL) {
                next = direction > 0 ? 0 : shuffleOrder.length - 1;
            } else if (repeatMode === REPEAT_MODES.ONE) {
                restartCurrentTrack();
                return;
            } else {
                return;
            }
        }

        const entry = shuffleOrder[next];
        const album = library[entry.ai] || currentAlbum;
        if (!album || !album.tracks[entry.ti]) return;

        shuffleCurrentIndex = next;
        selectTrack(album, entry.ti);
    }

    /**
     * Перемешивание идёт по всей коллекции, а не только по текущему альбому:
     * при 227 треках «случайный порядок» в пределах одного альбома звучит
     * предсказуемо.
     */
    function buildShuffleOrder() {
        const source = library.length ? library : (currentAlbum ? [currentAlbum] : []);
        shuffleOrder = [];
        source.forEach((album, ai) => {
            if (!album || !Array.isArray(album.tracks)) return;
            album.tracks.forEach((track, ti) => shuffleOrder.push({ ai, ti }));
        });

        for (let i = shuffleOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
        }

        syncShuffleCursor();
    }

    function syncShuffleCursor() {
        const ai = albumIndex(currentAlbum);
        if (ai === -1 || currentTrackIndex < 0) {
            shuffleCurrentIndex = 0;
            return;
        }
        const found = shuffleOrder.findIndex((e) => e.ai === ai && e.ti === currentTrackIndex);
        shuffleCurrentIndex = found === -1 ? 0 : found;
    }

    function restartCurrentTrack() {
        elements.audioPlayer.currentTime = 0;
        const playPromise = elements.audioPlayer.play();
        if (playPromise) {
            playPromise.catch(() => {});
        }
    }

    function toggleShuffle() {
        if (!currentAlbum && library.length === 0) return;
        shuffleOn = !shuffleOn;
        if (shuffleOn) {
            buildShuffleOrder();
            showNotice('Перемешиваю всю коллекцию: ' + shuffleOrder.length + ' треков', 3000, 'info');
        } else {
            shuffleOrder = [];
            showNotice('Перемешивание выключено: треки идут по порядку', 3000, 'info');
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

            attachCoverFallback(item.querySelector('.playlist-item-cover'), 40);
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

        // Активный трек не должен «уезжать» за пределы экрана, когда играет
        // следующий, — но панель при этом не должна прыгать без нужды.
        if (isPlaylistVisible() && items[index] && typeof items[index].scrollIntoView === 'function') {
            try {
                items[index].scrollIntoView({ block: 'nearest' });
            } catch (err) {
                items[index].scrollIntoView();
            }
        }
    }

    function saveSession(album, trackIndex) {
        if (!album || !album.id) return;
        Store.set('lastAlbumId', album.id);
        Store.set('lastTrackIndex', String(trackIndex));
    }

    /**
     * Возвращает выбор к последнему прослушанному треку — без автозапуска
     * (браузеры всё равно блокируют автопроигрывание, а неожиданный звук
     * сбивает с толку). Достаточно нажать «воспроизвести».
     */
    function restoreSession(albums) {
        if (!Array.isArray(albums) || albums.length === 0) return false;
        const albumId = Store.get('lastAlbumId');
        if (!albumId) return false;

        const album = albums.find((a) => a && a.id === albumId);
        if (!album || !album.tracks || album.tracks.length === 0) return false;

        const saved = parseInt(Store.get('lastTrackIndex'), 10);
        const trackIndex = Number.isInteger(saved) && saved >= 0 && saved < album.tracks.length ? saved : 0;
        const track = album.tracks[trackIndex];
        if (!track) return false;

        // Восстанавливаем состояние плеера, не начиная воспроизведение.
        currentAlbum = album;
        currentTrackIndex = trackIndex;

        elements.audioPlayer.src = toUrlPath(track.file);
        elements.currentTrackName.textContent = track.name;
        elements.currentAlbumName.textContent = album.title;
        attachCoverFallback(elements.currentTrackCover, 120);
        nativeVolumeWorks();
        elements.currentTrackCover.src = toUrlPath(track.cover || album.cover || createFallbackCover());
        elements.playlistAlbumTitle.textContent = album.title;
        renderPlaylist();
        highlightPlaylistItem(trackIndex);
        applyVolume();
        updateLyricsButton();
        updateMediaSession(album, track);
        showPlayer();
        setPlayIcon(false);

        showNotice(`Продолжаем с трека «${track.name}» — нажмите воспроизведение`, 6000, 'info');
        return true;
    }

    /**
     * Ссылка на трек, который зазвучит следующим, — с учётом перемешивания,
     * повтора и перехода между альбомами.
     */
    function nextTrackRef() {
        if (!currentAlbum || currentTrackIndex < 0) return null;

        if (shuffleOn && shuffleOrder.length > 0) {
            const next = (shuffleCurrentIndex + 1) % shuffleOrder.length;
            const entry = shuffleOrder[next];
            const album = library[entry.ai] || currentAlbum;
            if (album && album.tracks && album.tracks[entry.ti]) {
                return { album, index: entry.ti, track: album.tracks[entry.ti] };
            }
            return null;
        }

        const nextIndex = currentTrackIndex + 1;
        if (nextIndex < currentAlbum.tracks.length) {
            return { album: currentAlbum, index: nextIndex, track: currentAlbum.tracks[nextIndex] };
        }

        if (repeatMode === REPEAT_MODES.ALL && library.length > 1) {
            const idx = albumIndex(currentAlbum);
            const album = library[(idx + 1) % library.length];
            if (album && album.tracks && album.tracks[0]) {
                return { album, index: 0, track: album.tracks[0] };
            }
        }
        return null;
    }

    /**
     * Заранее подгружаем следующий трек, чтобы переключение было мгновенным.
     * На медленном соединении и при экономии трафика не делаем этого.
     */
    function prefetchNextTrack() {
        const el = elements.prefetchPlayer;
        if (!el) return;

        const ref = nextTrackRef();
        if (!ref || !ref.track || !ref.track.file) return;

        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn) {
            if (conn.saveData) return;
            if (typeof conn.effectiveType === 'string' && /^(slow-2g|2g|3g)$/.test(conn.effectiveType)) return;
            if (typeof conn.downlink === 'number' && conn.downlink > 0 && conn.downlink < 1) return;
        }

        const url = toUrlPath(ref.track.file);
        if (prefetchedFile === url) return;
        prefetchedFile = url;
        try {
            el.preload = 'auto';
            el.src = url;
            el.load();
        } catch (err) {
            /* префетч — необязательная оптимизация */
        }
    }

    function announceTrackChange(album, trackIndex) {
        if (typeof CustomEvent !== 'function') return;
        try {
            window.dispatchEvent(new CustomEvent('dajet:trackchange', {
                detail: { albumId: album && album.id, trackIndex }
            }));
        } catch (err) {
            /* событие не критично для работы плеера */
        }
    }

    /**
     * Позиция трека для системного плеера (экран блокировки, часы, авто).
     * Вызывается не чаще раза в секунду.
     */
    function updatePositionState(force) {
        if (!('mediaSession' in navigator)) return;
        const session = navigator.mediaSession;
        if (!session || typeof session.setPositionState !== 'function') return;

        const ap = elements.audioPlayer;
        if (!ap.duration || !isFinite(ap.duration) || ap.duration <= 0) return;

        const now = Date.now();
        if (!force && now - mediaSessionTick < 1000) return;
        mediaSessionTick = now;

        try {
            session.setPositionState({
                duration: ap.duration,
                playbackRate: ap.playbackRate || 1,
                position: Math.max(0, Math.min(ap.currentTime || 0, ap.duration))
            });
        } catch (err) {
            /* часть браузеров не поддерживает — просто пропускаем */
        }
    }

    function currentTrack() {
        return currentAlbum && currentTrackIndex >= 0 ? currentAlbum.tracks[currentTrackIndex] : null;
    }

    function hasLyrics(track) {
        return !!(track && typeof track.lyrics === 'string' && track.lyrics.trim());
    }

    function updateLyricsButton() {
        if (!elements.lyricsBtn) return;
        const track = currentTrack();
        const available = hasLyrics(track);
        elements.lyricsBtn.disabled = !available;
        elements.lyricsBtn.setAttribute('aria-disabled', available ? 'false' : 'true');
        elements.lyricsBtn.title = available ? 'Текст песни' : 'Для этого трека текста нет';
        if (!available && isLyricsVisible()) closeLyricsPanel();
    }

    function isLyricsVisible() {
        return !!(elements.lyricsPanel && elements.lyricsPanel.classList.contains('open'));
    }

    function renderLyrics(track) {
        if (!elements.lyricsText) return;
        elements.lyricsText.textContent = '';
        (track.lyrics || '').split('\n').forEach((line) => {
            const row = document.createElement('p');
            // Пустая строка — разделитель строф
            if (line.trim()) {
                row.textContent = line;
            } else {
                row.className = 'lyrics-gap';
            }
            elements.lyricsText.appendChild(row);
        });
    }

    function toggleLyricsPanel() {
        if (isLyricsVisible()) closeLyricsPanel();
        else openLyricsPanel();
    }

    function openLyricsPanel() {
        const track = currentTrack();
        if (!hasLyrics(track) || !elements.lyricsPanel) return;
        if (isPlaylistVisible()) togglePlaylistPanel();
        elements.lyricsTitle.textContent = track.name;
        renderLyrics(track);
        elements.lyricsPanel.classList.add('open');
        elements.lyricsPanel.setAttribute('aria-hidden', 'false');
        elements.overlay.classList.add('visible');
        elements.overlay.setAttribute('aria-hidden', 'false');
        if (elements.lyricsBtn) elements.lyricsBtn.setAttribute('aria-expanded', 'true');
        if (elements.closeLyrics) elements.closeLyrics.focus();
    }

    function closeLyricsPanel() {
        if (!elements.lyricsPanel) return;
        elements.lyricsPanel.classList.remove('open');
        elements.lyricsPanel.setAttribute('aria-hidden', 'true');
        if (!isPlaylistVisible()) {
            elements.overlay.classList.remove('visible');
            elements.overlay.setAttribute('aria-hidden', 'true');
        }
        if (elements.lyricsBtn) {
            elements.lyricsBtn.setAttribute('aria-expanded', 'false');
            if (elements.lyricsPanel.contains(document.activeElement)) elements.lyricsBtn.focus();
        }
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
            if (isLyricsVisible()) closeLyricsPanel();
            elements.playlistAlbumTitle.textContent = currentAlbum ? currentAlbum.title : 'Плейлист';
            renderPlaylist();
            if (elements.closePlaylist) elements.closePlaylist.focus();
        }
    }

    /** «Слушать всё»: запускаем коллекцию с первого трека и идём подряд. */
    function playAll() {
        const album = library.length ? library[0] : currentAlbum;
        if (!album || !album.tracks || album.tracks.length === 0) {
            showNotice('Пока нет треков для воспроизведения', 4000, 'info');
            return;
        }
        showPlayer();
        if (shuffleOn && shuffleOrder.length > 0) {
            const entry = shuffleOrder[0];
            const first = library[entry.ai] || album;
            selectTrack(first, entry.ti);
            return;
        }
        selectTrack(album, 0);
    }

    function toggleMute() {
        const slider = elements.volumeSlider;
        if (baseVolume > 0.001) {
            Store.set('playerVolumeBeforeMute', baseVolume);
            slider.value = 0;
        } else {
            slider.value = Store.getNumber('playerVolumeBeforeMute', 0.8, 0, 1);
        }
        handleVolumeChange();
    }

    function setLibrary(albums) {
        library = Array.isArray(albums)
            ? albums.filter((a) => a && Array.isArray(a.tracks) && a.tracks.length > 0)
            : [];
        if (shuffleOn) buildShuffleOrder();
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
        const encoded = String(path).split('/').map((segment) => encodeURIComponent(segment)).join('/');
        return MEDIA_BASE ? MEDIA_BASE + encoded : encoded;
    }

    /**
     * Если обложка не загрузилась (файл переименован, оборвалась сеть),
     * подставляем аккуратную заглушку вместо «сломанной» иконки.
     */
    function attachCoverFallback(img, size = 100) {
        if (!img) return;
        img.addEventListener('error', function onError() {
            if (img.dataset.fallbackApplied === '1') return;
            img.dataset.fallbackApplied = '1';
            img.src = createFallbackCover(size);
            img.classList.add('cover-fallback');
        });
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
        showNotice,
        applyVolume,
        restoreSession,
        attachCoverFallback,
        setLibrary,
        playAll,
        toggleMute,
        getShuffleOrderLength: () => shuffleOrder.length,
        getLibrary: () => library,
        isNativeVolumeSupported: () => nativeVolumeSupported !== false
    };
})();
