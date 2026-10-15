// Windows 11 Desktop Live Preview Renderer

const PreviewModule = {
    init() {
        this.canvasWallpaper = document.getElementById('canvasWallpaper');
        this.sampleWindowFrame = document.getElementById('sampleWindowFrame');
        this.winTitleBar = document.getElementById('winTitleBar');
        this.winTitleText = document.getElementById('winTitleText');
        this.winClientBody = document.getElementById('winClientBody');
        this.winModeBadge = document.getElementById('winModeBadge');
        this.sampleAccentBtn = document.getElementById('sampleAccentBtn');
        this.sampleCheckbox = document.getElementById('sampleCheckbox');
        this.taskbarActiveIndicator = document.getElementById('taskbarActiveIndicator');
        this.winTaskbar = document.getElementById('winTaskbar');
        this.startMenuFlyout = document.getElementById('startMenuFlyout');
        this.winStartBtn = document.getElementById('winStartBtn');
        this.sysClockTime = document.getElementById('sysClockTime');
        this.sysClockDate = document.getElementById('sysClockDate');

        this.setupWindowDragging();
        this.setupStartMenu();
        this.startClock();
    },

    updatePreview(state) {
        const isDark = state.mode === 'dark';
        const accentHex = state.accentColor;
        const rgbAccent = ColorPickerModule.hexToRgb(accentHex);

        // Update CSS Custom Properties for live accent styling
        document.documentElement.style.setProperty('--win-accent', accentHex);
        document.documentElement.style.setProperty('--win-accent-rgb', `${rgbAccent.r}, ${rgbAccent.g}, ${rgbAccent.b}`);

        // Update Wallpaper
        if (state.wallpaperData) {
            this.canvasWallpaper.style.backgroundImage = `url(${state.wallpaperData})`;
        } else {
            // Default Fluent wallpaper gradient / pattern
            if (isDark) {
                this.canvasWallpaper.style.backgroundImage = 'radial-gradient(circle at 50% 30%, #1a2a40 0%, #0d131f 60%, #05080e 100%)';
            } else {
                this.canvasWallpaper.style.backgroundImage = 'radial-gradient(circle at 50% 30%, #dbeafe 0%, #bfdbfe 60%, #93c5fd 100%)';
            }
        }

        // Apply Wallpaper Style background properties
        const styleMode = state.wallpaperStyle;
        if (styleMode === '0') { // Tile
            this.canvasWallpaper.style.backgroundSize = 'auto';
            this.canvasWallpaper.style.backgroundRepeat = 'repeat';
        } else if (styleMode === '6') { // Fit
            this.canvasWallpaper.style.backgroundSize = 'contain';
            this.canvasWallpaper.style.backgroundRepeat = 'no-repeat';
        } else if (styleMode === '2') { // Stretch
            this.canvasWallpaper.style.backgroundSize = '100% 100%';
            this.canvasWallpaper.style.backgroundRepeat = 'no-repeat';
        } else { // Fill (default)
            this.canvasWallpaper.style.backgroundSize = 'cover';
            this.canvasWallpaper.style.backgroundRepeat = 'no-repeat';
        }

        // Update Title Text & Badge
        this.winTitleText.textContent = `${state.themeName} - Personalization`;
        this.winModeBadge.textContent = isDark ? 'Dark Mode' : 'Light Mode';
        this.winModeBadge.className = isDark 
            ? 'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400' 
            : 'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-600';

        // Update Dark / Light Mode visual classes on Window & Taskbar
        if (isDark) {
            this.sampleWindowFrame.className = 'absolute top-10 left-36 w-[420px] rounded-xl shadow-2xl border border-slate-700/80 bg-slate-900/85 text-slate-100 backdrop-blur-xl z-20 overflow-hidden flex flex-col transition-colors';
            this.winClientBody.className = 'p-4 space-y-4 text-xs bg-slate-900/60 text-slate-100';
            this.winTaskbar.className = 'h-12 border-t border-slate-800/80 bg-slate-900/85 text-slate-100 backdrop-blur-2xl flex items-center justify-between px-4 relative z-20 transition-all';
        } else {
            this.sampleWindowFrame.className = 'absolute top-10 left-36 w-[420px] rounded-xl shadow-2xl border border-slate-300/80 bg-white/90 text-slate-900 backdrop-blur-xl z-20 overflow-hidden flex flex-col transition-colors';
            this.winClientBody.className = 'p-4 space-y-4 text-xs bg-slate-50/80 text-slate-800';
            this.winTaskbar.className = 'h-12 border-t border-slate-200/80 bg-white/85 text-slate-800 backdrop-blur-2xl flex items-center justify-between px-4 relative z-20 transition-all';
        }

        // Update Window Titlebar Color (Accent title bar option)
        if (state.titlebarAccent) {
            this.winTitleBar.style.backgroundColor = accentHex;
            this.winTitleBar.style.color = '#ffffff';
        } else {
            this.winTitleBar.style.backgroundColor = isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(241, 245, 249, 0.9)';
            this.winTitleBar.style.color = isDark ? '#f1f5f9' : '#0f172a';
        }

        // Update Primary Accent Buttons & Indicators
        this.sampleAccentBtn.style.backgroundColor = accentHex;
        this.sampleAccentBtn.style.boxShadow = `0 4px 14px rgba(${rgbAccent.r}, ${rgbAccent.g}, ${rgbAccent.b}, 0.4)`;
        this.taskbarActiveIndicator.style.backgroundColor = accentHex;
        this.sampleCheckbox.style.accentColor = accentHex;
    },

    setupWindowDragging() {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        this.winTitleBar.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = this.sampleWindowFrame.offsetLeft;
            initialTop = this.sampleWindowFrame.offsetTop;
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // Restrict bounds within desktop preview container
            const container = document.getElementById('winDesktopCanvas');
            const maxLeft = container.clientWidth - this.sampleWindowFrame.clientWidth;
            const maxTop = container.clientHeight - this.sampleWindowFrame.clientHeight - 48; // Taskbar height

            const newLeft = Math.max(0, Math.min(maxLeft, initialLeft + dx));
            const newTop = Math.max(0, Math.min(maxTop, initialTop + dy));

            this.sampleWindowFrame.style.left = `${newLeft}px`;
            this.sampleWindowFrame.style.top = `${newTop}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
            }
        });
    },

    setupStartMenu() {
        this.winStartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startMenuFlyout.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!this.startMenuFlyout.contains(e.target) && e.target !== this.winStartBtn) {
                this.startMenuFlyout.classList.add('hidden');
            }
        });
    },

    startClock() {
        const update = () => {
            const now = new Date();
            this.sysClockTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            this.sysClockDate.textContent = now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
        };
        update();
        setInterval(update, 10000);
    }
};
