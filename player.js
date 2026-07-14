const Player = (function() {
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

    let elements = {};

    function init() {
        elements = {
            playerBar: document.getElementById('playerBar'),
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

        loadSkin();
        loadVolume();
        bindEvents();
        updateRepeatButton();
        elements.pauseIcon.style.display = 'none';
    }

    function bindEvents() {
        const ap = elements.audioPlayer;

        ap.addEventListener('ended', handleTrackEnded);
        ap.addEventListener('play', handlePlay);
        ap.addEventListener('pause', handlePause);
        ap.addEventListener('timeupdate', handleTimeUpdate);
        ap.addEventListener('loadedmetadata', handleLoadedMetadata);
        ap.addEventListener('error', handleAudioError);

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
            }
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.code === 'Space') {
                e.preventDefault();
                togglePlayPause();
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                seekRelative(5);
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                seekRelative(-5);
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                adjustVolume(0.05);
            }
            if (e.key === 'ArrowDown') {
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

    function handleAudioError() {
        const ap = elements.audioPlayer;
        let msg = 'Ошибка воспроизведения';
        if (ap.error) {
            switch (ap.error.code) {
                case MediaError.MEDIA_ERR_ABORTED: msg = 'Воспроизведение прервано'; break;
                case MediaError.MEDIA_ERR_NETWORK: msg = 'Сетевая ошибка'; break;
                case MediaError.MEDIA_ERR_DECODE: msg = 'Ошибка декодирования аудио'; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: msg = 'Формат не поддерживается'; break;
            }
        }
        console.error('Audio error:', msg);
        if (elements.currentTrackName) {
            elements.currentTrackName.textContent = msg;
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
        const v = parseFloat(elements.volumeSlider.value);
        elements.audioPlayer.volume = v;
        localStorage.setItem('playerVolume', v);
        updateVolumeIcon(v);
    }

    function loadVolume() {
        const saved = localStorage.getItem('playerVolume');
        const v = saved !== null ? parseFloat(saved) : 0.8;
        elements.audioPlayer.volume = v;
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
        elements.playIcon.style.display = 'none';
        elements.pauseIcon.style.display = 'block';
    }

    function handlePause() {
        elements.playIcon.style.display = 'block';
        elements.pauseIcon.style.display = 'none';
    }

    function updateMediaSession(album, track) {
        if ('mediaSession' in navigator) {
            const coverSrc = track.cover || album.cover || createFallbackCover(512);

            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.name,
                artist: album.title,
                album: album.title,
                artwork: [
                    { src: coverSrc, sizes: '512x512', type: 'image/jpeg' }
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => {
                elements.audioPlayer.play().catch(() => {});
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                elements.audioPlayer.pause();
            });
            navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
            navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
            navigator.mediaSession.setActionHandler('seekbackward', () => seekRelative(-10));
            navigator.mediaSession.setActionHandler('seekforward', () => seekRelative(10));
        }
    }

    function selectTrack(album, trackIndex) {
        showPlayer();

        if (currentAlbum !== album) {
            currentAlbum = album;
            renderPlaylist();
            elements.playlistAlbumTitle.textContent = album.title;
        }

        const track = album.tracks[trackIndex];
        if (!track) return;

        currentTrackIndex = trackIndex;
        elements.audioPlayer.src = track.file;
        elements.audioPlayer.load();

        const playPromise = elements.audioPlayer.play();
        if (playPromise) {
            playPromise.catch(() => {});
        }

        elements.currentTrackName.textContent = track.name;
        elements.currentAlbumName.textContent = album.title;

        const coverSrc = track.cover || album.cover || createFallbackCover();
        elements.currentTrackCover.src = coverSrc;

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
            item.setAttribute('aria-selected', idx === currentTrackIndex ? 'true' : 'false');
            if (idx === currentTrackIndex) item.classList.add('active');

            const coverImg = track.cover || currentAlbum.cover || createFallbackCover(40);

            item.innerHTML = `
                <img class="playlist-item-cover" src="${coverImg}" alt="${escapeHtml(track.name)}" loading="lazy">
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${escapeHtml(track.name)}</div>
                    <div class="playlist-item-album">${escapeHtml(currentAlbum.title)}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                selectTrack(currentAlbum, idx);
                if (isPlaylistVisible()) togglePlaylistPanel();
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
        } else {
            elements.playlistPanel.classList.add('open');
            elements.playlistPanel.setAttribute('aria-hidden', 'false');
            elements.overlay.classList.add('visible');
            elements.overlay.setAttribute('aria-hidden', 'false');
            elements.togglePlaylist.setAttribute('aria-expanded', 'true');
            if (currentAlbum) {
                elements.playlistAlbumTitle.textContent = currentAlbum.title;
                renderPlaylist();
            } else {
                elements.playlistAlbumTitle.textContent = 'Плейлист';
                renderPlaylist();
            }
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
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
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
        const savedSkin = localStorage.getItem('playerSkin');
        if (savedSkin && SKINS.includes(savedSkin)) {
            currentSkin = savedSkin;
        }
        applySkin();
    }

    function cycleSkin() {
        const currentIndex = SKINS.indexOf(currentSkin);
        const nextIndex = (currentIndex + 1) % SKINS.length;
        currentSkin = SKINS[nextIndex];
        localStorage.setItem('playerSkin', currentSkin);
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
        escapeHtml
    };
})();
