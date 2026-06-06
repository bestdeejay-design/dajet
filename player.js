// player.js — модуль аудиоплеера

const Player = (function() {
    const REPEAT_MODES = {
        NONE: 0,
        ONE: 1,
        ALL: 2
    };

    const SKINS = ['classic', 'minimal', 'compact'];
    const SKIN_LABELS = {
        classic: 'Classic',
        minimal: 'Minimal',
        compact: 'Compact'
    };

    let currentAlbum = null;
    let currentTrackIndex = -1;
    let repeatMode = REPEAT_MODES.ALL;
    let shuffleOn = false;
    let shuffleIndices = [];
    let shuffleCurrentIndex = 0;
    let currentSkin = 'classic';

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
            pauseIcon: document.querySelector('.pause-icon')
        };

        loadSkin();
        bindEvents();
        updateRepeatButton();
        elements.pauseIcon.style.display = 'none';
    }

    function bindEvents() {
        elements.audioPlayer.addEventListener('ended', handleTrackEnded);
        elements.audioPlayer.addEventListener('play', handlePlay);
        elements.audioPlayer.addEventListener('pause', handlePause);

        elements.prevBtn.addEventListener('click', prevTrack);
        elements.nextBtn.addEventListener('click', nextTrack);
        elements.playPauseBtn.addEventListener('click', togglePlayPause);
        elements.shuffleBtn.addEventListener('click', toggleShuffle);
        elements.repeatBtn.addEventListener('click', toggleRepeat);

        elements.togglePlaylist.addEventListener('click', togglePlaylistPanel);
        elements.closePlaylist.addEventListener('click', togglePlaylistPanel);
        elements.overlay.addEventListener('click', togglePlaylistPanel);
        elements.skinToggle.addEventListener('click', cycleSkin);

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
                nextTrack();
            }
            if (e.key === 'ArrowLeft') {
                prevTrack();
            }
        });
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

            navigator.mediaSession.setActionHandler('previoustrack', () => {
                prevTrack();
            });

            navigator.mediaSession.setActionHandler('nexttrack', () => {
                nextTrack();
            });

            navigator.mediaSession.setActionHandler('seekbackward', null);
            navigator.mediaSession.setActionHandler('seekforward', null);
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
        elements.audioPlayer.play().catch(() => {});

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
            elements.audioPlayer.play().catch(() => {});
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
        elements.audioPlayer.play().catch(() => {});
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
            if (idx === currentTrackIndex) item.classList.add('active');

            const coverImg = track.cover || currentAlbum.cover || createFallbackCover(40);

            item.innerHTML = `
                <img class="playlist-item-cover" src="${coverImg}" alt="">
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
        });
    }

    function togglePlaylistPanel() {
        const isVisible = elements.playlistPanel.classList.contains('open');
        if (isVisible) {
            elements.playlistPanel.classList.remove('open');
            elements.overlay.classList.remove('visible');
        } else {
            elements.playlistPanel.classList.add('open');
            elements.overlay.classList.add('visible');
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
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
