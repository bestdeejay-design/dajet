// script.js — галерея и тема

(function() {
    let albums = [];

    const gallery = document.getElementById('gallery');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');

    async function loadLibrary() {
        try {
            const response = await fetch('library.json');
            if (!response.ok) throw new Error('Не удалось загрузить library.json');
            albums = await response.json();
            loadingEl.style.display = 'none';
            renderGallery();
            
            if (typeof gsap !== 'undefined') {
                gsap.fromTo('.album-card', 
                    { y: 30, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'power2.out' }
                );
            }
        } catch (err) {
            loadingEl.style.display = 'none';
            errorEl.style.display = 'block';
            errorEl.textContent = 'Ошибка: ' + err.message;
        }
    }

    function renderGallery() {
        gallery.innerHTML = '';
        albums.forEach(album => {
            const card = document.createElement('div');
            card.className = 'album-card';
            
            const coverHtml = album.cover 
                ? `<img class="album-cover" src="${Player.escapeHtml(album.cover)}" alt="${Player.escapeHtml(album.title)}" loading="lazy">`
                : `<div class="album-cover" style="background:#2a2a2a; display:flex; align-items:center; justify-content:center; color:#666;">📀</div>`;
            
            card.innerHTML = `
                ${coverHtml}
                <div class="album-info">
                    <div class="album-title">${Player.escapeHtml(album.title)}</div>
                    <div class="album-meta">${album.tracks.length} files</div>
                </div>
            `;
            
            card.addEventListener('click', () => {
                const elements = Player.getElements();
                if (!elements.playerBar.classList.contains('active')) {
                    elements.playerBar.classList.add('active');
                }

                const currentAlbum = Player.getCurrentAlbum();
                const currentTrackIndex = Player.getCurrentTrackIndex();

                if (currentAlbum !== album) {
                    Player.setCurrentAlbum(album);
                    Player.renderPlaylist();
                    elements.playlistAlbumTitle.textContent = album.title;
                    if (!elements.playlistPanel.classList.contains('open')) {
                        Player.togglePlaylistPanel();
                    }
                    if (currentTrackIndex === -1) {
                        elements.currentAlbumName.textContent = album.title;
                        elements.currentTrackCover.src = album.cover || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%23333\'/%3E%3C/svg%3E';
                    }
                } else {
                    Player.togglePlaylistPanel();
                }
            });
            
            gallery.appendChild(card);
        });
    }

    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = themeToggle?.querySelector('.sun');
    const moonIcon = themeToggle?.querySelector('.moon');

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        } else {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
        });
    }

    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    Player.init();
    loadLibrary();
})();
