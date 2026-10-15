// Windows 11 Theme Generator Main Application Controller

const App = {
    defaultDarkSysColors: {
        "Background": "0 0 0",
        "ActiveTitle": "0 120 212",
        "InactiveTitle": "32 32 32",
        "TitleText": "255 255 255",
        "InactiveTitleText": "160 160 160",
        "ActiveBorder": "0 120 212",
        "InactiveBorder": "45 45 45",
        "Window": "32 32 32",
        "WindowText": "255 255 255",
        "Menu": "32 32 32",
        "MenuText": "255 255 255",
        "Hilite": "0 120 212",
        "HiliteText": "255 255 255",
        "ButtonFace": "45 45 45",
        "ButtonText": "255 255 255",
        "GrayText": "128 128 128",
        "AppWorkspace": "20 20 20",
        "Scrollbar": "45 45 45",
        "ButtonHilight": "60 60 60",
        "ButtonLight": "50 50 50",
        "ButtonShadow": "30 30 30",
        "ButtonDkShadow": "15 15 15"
    },

    defaultLightSysColors: {
        "Background": "243 243 243",
        "ActiveTitle": "0 120 212",
        "InactiveTitle": "240 240 240",
        "TitleText": "0 0 0",
        "InactiveTitleText": "120 120 120",
        "ActiveBorder": "180 180 180",
        "InactiveBorder": "220 220 220",
        "Window": "255 255 255",
        "WindowText": "0 0 0",
        "Menu": "240 240 240",
        "MenuText": "0 0 0",
        "Hilite": "0 120 212",
        "HiliteText": "255 255 255",
        "ButtonFace": "240 240 240",
        "ButtonText": "0 0 0",
        "GrayText": "109 109 109",
        "AppWorkspace": "200 200 200",
        "Scrollbar": "200 200 200",
        "ButtonHilight": "255 255 255",
        "ButtonLight": "225 225 225",
        "ButtonShadow": "160 160 160",
        "ButtonDkShadow": "105 105 105"
    },

    presets: {
        win11_dark: {
            themeName: "Windows 11 Dark",
            mode: "dark",
            accentColor: "#0078D4",
            titlebarAccent: true,
            wallpaperStyle: "10"
        },
        win11_light: {
            themeName: "Windows 11 Light",
            mode: "light",
            accentColor: "#0078D4",
            titlebarAccent: false,
            wallpaperStyle: "10"
        },
        cyberpunk: {
            themeName: "Cyberpunk Neon",
            mode: "dark",
            accentColor: "#E3008C",
            titlebarAccent: true,
            wallpaperStyle: "10"
        },
        nord: {
            themeName: "Nordic Frost",
            mode: "dark",
            accentColor: "#00B7C3",
            titlebarAccent: true,
            wallpaperStyle: "10"
        },
        oled: {
            themeName: "Midnight OLED",
            mode: "dark",
            accentColor: "#744DA9",
            titlebarAccent: true,
            wallpaperStyle: "10"
        },
        retro95: {
            themeName: "Retro Windows 95",
            mode: "light",
            accentColor: "#008080",
            titlebarAccent: true,
            wallpaperStyle: "0"
        },
        pastel: {
            themeName: "Pastel Glow",
            mode: "light",
            accentColor: "#EA005E",
            titlebarAccent: false,
            wallpaperStyle: "10"
        }
    },

    state: {
        themeName: "My Custom Win11 Theme",
        mode: "dark",
        accentColor: "#0078D4",
        titlebarAccent: true,
        autoColorization: true,
        wallpaperStyle: "10",
        wallpaperData: null,
        wallpaperFilename: "wallpaper.jpg",
        cursors: {},
        sounds: {},
        icons: {},
        sysColors: {}
    },

    init() {
        this.state.sysColors = { ...this.defaultDarkSysColors };
        
        PreviewModule.init();
        this.renderSwatches();
        this.renderSysColorsEditor();
        this.setupEventListeners();
        this.setupTabNavigation();
        this.setupDragAndDrop();

        this.updateAll();
    },

    updateAll() {
        PreviewModule.updatePreview(this.state);
        this.renderLiveIcons();
        this.renderGeneratedCursorsList();
        this.renderGeneratedIconsList();
    },

    // Full System Experience AI Synthesizer (Colors + 10+ Sounds + 15 Cursors + Icons)
    async synthesizeAITheme() {
        this.showStatus('AI Synthesizing Full System Suite...', 'Generating matching colors, 10+ sound scheme events, 15 cursors, and desktop icons.');

        const accentHex = this.state.accentColor;

        // 1. Full Sound Scheme Synthesis
        try {
            const soundScheme = await AIAudioSynthesizer.generateFullSystemSoundScheme(accentHex);
            this.state.sounds = soundScheme;
        } catch (e) {
            console.log('Audio synth notice:', e);
        }

        // 2. Full 15 Cursor Suite Synthesis
        try {
            const cursorSuite = AICursorGenerator.generateFullCursorSuite(accentHex);
            this.state.cursors = cursorSuite;
        } catch (e) {
            console.log('Cursor synth notice:', e);
        }

        // 3. Full System Icons Synthesis
        try {
            const iconSet = AIIconGenerator.generateFullIconSet(accentHex);
            this.state.icons = iconSet;
        } catch (e) {
            console.log('Icon synth notice:', e);
        }

        this.updateAll();
        this.showStatus('✨ Full System Suite Synthesized!', `Created complete Windows 11 system suite (Colors, 10+ Sound Events, 15 Cursors & Icons) for accent ${accentHex}.`);
    },

    renderLiveIcons() {
        if (this.state.icons['Computer']) {
            const el = document.getElementById('iconThisPC');
            if (el) el.innerHTML = `<img src="${this.state.icons['Computer']}" class="w-full h-full object-cover">`;
        }
        if (this.state.icons['UserFiles']) {
            const el = document.getElementById('iconUserFiles');
            if (el) el.innerHTML = `<img src="${this.state.icons['UserFiles']}" class="w-full h-full object-cover">`;
        }
        if (this.state.icons['RecycleEmpty']) {
            const el = document.getElementById('iconRecycleBin');
            if (el) el.innerHTML = `<img src="${this.state.icons['RecycleEmpty']}" class="w-full h-full object-cover">`;
        }
    },

    renderGeneratedCursorsList() {
        const dropZones = document.getElementById('cursorDropZones');
        if (!dropZones) return;

        dropZones.innerHTML = '';
        const cursorNames = {
            'Arrow': 'Normal Select',
            'Help': 'Help Select',
            'AppStarting': 'Working in Background',
            'Wait': 'Busy Spinner',
            'Crosshair': 'Precision Select',
            'IBeam': 'Text I-Beam',
            'NWPen': 'Handwriting Pen',
            'No': 'Unavailable',
            'SizeNS': 'Vertical Resize',
            'SizeWE': 'Horizontal Resize',
            'SizeNWSE': 'Diagonal Resize 1',
            'SizeNESW': 'Diagonal Resize 2',
            'SizeAll': 'Move Pointer',
            'UpArrow': 'Alternate Select',
            'Hand': 'Link Select'
        };

        for (const [key, label] of Object.entries(cursorNames)) {
            const dataUrl = this.state.cursors[key];
            const div = document.createElement('div');
            div.className = 'bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 flex items-center justify-between';
            div.setAttribute('data-cursor', key);
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-slate-900 border border-slate-700 flex items-center justify-center p-1 overflow-hidden">
                        ${dataUrl ? `<img src="${dataUrl}" class="w-full h-full object-contain">` : `<i data-lucide="mouse-pointer" class="w-4 h-4 text-blue-400"></i>`}
                    </div>
                    <div>
                        <span class="text-xs font-semibold text-slate-200 block">${label}</span>
                        <span class="text-[10px] text-slate-400">${dataUrl ? 'AI Theme Stylized Pointer' : 'Default System'}</span>
                    </div>
                </div>
                <label class="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-[11px] rounded-md font-medium cursor-pointer">
                    Browse
                    <input type="file" class="cursor-file-input hidden" accept=".cur,.ani,.png,.ico" data-cursor-key="${key}">
                </label>
            `;
            dropZones.appendChild(div);
        }

        dropZones.querySelectorAll('.cursor-file-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const k = e.target.getAttribute('data-cursor-key');
                if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        this.state.cursors[k] = evt.target.result;
                        this.updateAll();
                    };
                    reader.readAsDataURL(e.target.files[0]);
                }
            });
        });
        if (window.lucide) lucide.createIcons();
    },

    renderGeneratedIconsList() {
        const iconZones = document.getElementById('iconDropZones');
        if (!iconZones) return;

        iconZones.innerHTML = '';
        const iconNames = {
            'Computer': 'This PC / Computer',
            'UserFiles': 'User Files Folder',
            'Network': 'Network Places',
            'RecycleEmpty': 'Recycle Bin (Empty)',
            'RecycleFull': 'Recycle Bin (Full)'
        };

        for (const [key, label] of Object.entries(iconNames)) {
            const dataUrl = this.state.icons[key];
            const div = document.createElement('div');
            div.className = 'bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 flex items-center justify-between';
            div.setAttribute('data-icon', key);
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-slate-900 border border-slate-700 flex items-center justify-center p-1 overflow-hidden">
                        ${dataUrl ? `<img src="${dataUrl}" class="w-full h-full object-contain">` : `<i data-lucide="layout-grid" class="w-4 h-4 text-blue-400"></i>`}
                    </div>
                    <div>
                        <span class="text-xs font-semibold text-slate-200 block">${label}</span>
                        <span class="text-[10px] text-slate-400">${dataUrl ? 'AI Glassmorphic Icon' : 'System Default'}</span>
                    </div>
                </div>
                <label class="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-[11px] rounded-md font-medium cursor-pointer">
                    Upload
                    <input type="file" class="icon-file-input hidden" accept=".ico,.png,.jpg,.svg" data-icon-key="${key}">
                </label>
            `;
            iconZones.appendChild(div);
        }

        iconZones.querySelectorAll('.icon-file-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const k = e.target.getAttribute('data-icon-key');
                if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        this.state.icons[k] = evt.target.result;
                        this.updateAll();
                    };
                    reader.readAsDataURL(e.target.files[0]);
                }
            });
        });
        if (window.lucide) lucide.createIcons();
    },

    renderSwatches() {
        const swatchGrid = document.getElementById('swatchGrid');
        swatchGrid.innerHTML = '';

        ColorPickerModule.defaultSwatches.forEach(hex => {
            const btn = document.createElement('button');
            btn.className = `swatch-btn ${hex.toUpperCase() === this.state.accentColor.toUpperCase() ? 'active' : ''}`;
            btn.style.backgroundColor = hex;
            btn.title = hex;
            btn.addEventListener('click', () => {
                this.setAccentColor(hex);
            });
            swatchGrid.appendChild(btn);
        });
    },

    renderExtractedSwatches(colors) {
        const container = document.getElementById('extractedSwatchesContainer');
        const grid = document.getElementById('extractedSwatchGrid');
        
        if (!colors || colors.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        grid.innerHTML = '';

        colors.forEach(hex => {
            const btn = document.createElement('button');
            btn.className = `swatch-btn ${hex.toUpperCase() === this.state.accentColor.toUpperCase() ? 'active' : ''}`;
            btn.style.backgroundColor = hex;
            btn.title = hex;
            btn.addEventListener('click', () => {
                this.setAccentColor(hex);
            });
            grid.appendChild(btn);
        });
    },

    renderSysColorsEditor() {
        const sysColorsList = document.getElementById('sysColorsList');
        sysColorsList.innerHTML = '';

        for (const [key, rgbStr] of Object.entries(this.state.sysColors)) {
            const rgb = ColorPickerModule.winStringToRgb(rgbStr);
            const hex = ColorPickerModule.rgbToHex(rgb.r, rgb.g, rgb.b);

            const row = document.createElement('div');
            row.className = 'flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/40 text-xs';
            row.innerHTML = `
                <span class="text-slate-300 font-medium">${key}</span>
                <div class="flex items-center gap-2">
                    <input type="color" value="${hex}" data-color-key="${key}" class="sys-color-picker w-5 h-5 rounded cursor-pointer border-0 bg-transparent">
                    <span class="font-mono text-[10px] text-slate-400 w-16 text-right">${rgbStr}</span>
                </div>
            `;
            sysColorsList.appendChild(row);
        }

        document.querySelectorAll('.sys-color-picker').forEach(input => {
            input.addEventListener('input', (e) => {
                const key = e.target.getAttribute('data-color-key');
                const hex = e.target.value;
                const rgb = ColorPickerModule.hexToRgb(hex);
                const rgbStr = ColorPickerModule.rgbToWinString(rgb.r, rgb.g, rgb.b);
                this.state.sysColors[key] = rgbStr;
                e.target.nextElementSibling.textContent = rgbStr;
                this.updateAll();
            });
        });
    },

    setAccentColor(hex) {
        this.state.accentColor = hex;
        document.getElementById('accentColorPicker').value = hex;
        document.getElementById('accentHexLabel').textContent = hex.toUpperCase();
        
        const rgb = ColorPickerModule.hexToRgb(hex);
        const rgbStr = ColorPickerModule.rgbToWinString(rgb.r, rgb.g, rgb.b);
        this.state.sysColors['ActiveTitle'] = rgbStr;
        this.state.sysColors['Hilite'] = rgbStr;
        this.state.sysColors['ActiveBorder'] = rgbStr;

        this.renderSwatches();
        this.renderSysColorsEditor();
        this.updateAll();
    },

    setMode(mode) {
        this.state.mode = mode;
        const isDark = mode === 'dark';

        const modeDarkBtn = document.getElementById('modeDarkBtn');
        const modeLightBtn = document.getElementById('modeLightBtn');

        if (isDark) {
            modeDarkBtn.className = 'flex flex-col items-center justify-center p-3 rounded-xl border border-blue-500 bg-blue-500/10 text-blue-400 transition-all cursor-pointer';
            modeLightBtn.className = 'flex flex-col items-center justify-center p-3 rounded-xl border border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-600 transition-all cursor-pointer';
            this.state.sysColors = { ...this.defaultDarkSysColors };
        } else {
            modeLightBtn.className = 'flex flex-col items-center justify-center p-3 rounded-xl border border-amber-500 bg-amber-500/10 text-amber-400 transition-all cursor-pointer';
            modeDarkBtn.className = 'flex flex-col items-center justify-center p-3 rounded-xl border border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-600 transition-all cursor-pointer';
            this.state.sysColors = { ...this.defaultLightSysColors };
        }

        const rgb = ColorPickerModule.hexToRgb(this.state.accentColor);
        const rgbStr = ColorPickerModule.rgbToWinString(rgb.r, rgb.g, rgb.b);
        this.state.sysColors['ActiveTitle'] = rgbStr;
        this.state.sysColors['Hilite'] = rgbStr;

        this.renderSysColorsEditor();
        this.updateAll();
    },

    loadPreset(presetKey) {
        const preset = this.presets[presetKey];
        if (!preset) return;

        this.state.themeName = preset.themeName;
        document.getElementById('themeNameInput').value = preset.themeName;
        this.state.titlebarAccent = preset.titlebarAccent;
        document.getElementById('titlebarAccentToggle').checked = preset.titlebarAccent;
        this.state.wallpaperStyle = preset.wallpaperStyle;
        document.getElementById('wallpaperStyleSelect').value = preset.wallpaperStyle;

        this.setMode(preset.mode);
        this.setAccentColor(preset.accentColor);
    },

    setupEventListeners() {
        // AI Synthesize Buttons
        const aiBtn = document.getElementById('aiAutoGenerateBtn');
        if (aiBtn) aiBtn.addEventListener('click', () => this.synthesizeAITheme());

        const aiAudioBtn = document.getElementById('aiSynthesizeSoundsBtn');
        if (aiAudioBtn) aiAudioBtn.addEventListener('click', () => this.synthesizeAITheme());

        const aiCursorBtn = document.getElementById('aiGenerateCursorsBtn');
        if (aiCursorBtn) aiCursorBtn.addEventListener('click', () => this.synthesizeAITheme());

        const aiIconBtn = document.getElementById('aiGenerateIconsBtn');
        if (aiIconBtn) aiIconBtn.addEventListener('click', () => this.synthesizeAITheme());

        // Play Sound Previews
        document.querySelectorAll('.play-sound-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const soundType = e.target.closest('[data-sound]').getAttribute('data-sound');
                const audioUrl = this.state.sounds[soundType];
                if (audioUrl) {
                    const audio = new Audio(audioUrl);
                    audio.play();
                } else {
                    AIAudioSynthesizer.generateNotificationSound(this.state.accentColor).then(res => {
                        const audio = new Audio(res.dataUrl);
                        audio.play();
                    });
                }
            });
        });

        // Theme Name Input
        document.getElementById('themeNameInput').addEventListener('input', (e) => {
            this.state.themeName = e.target.value || 'CustomTheme';
            this.updateAll();
        });

        // Light / Dark Mode Toggle
        document.getElementById('modeDarkBtn').addEventListener('click', () => this.setMode('dark'));
        document.getElementById('modeLightBtn').addEventListener('click', () => this.setMode('light'));

        // Titlebar Accent & Auto Color Toggles
        document.getElementById('titlebarAccentToggle').addEventListener('change', (e) => {
            this.state.titlebarAccent = e.target.checked;
            this.updateAll();
        });

        document.getElementById('autoColorizationToggle').addEventListener('change', (e) => {
            this.state.autoColorization = e.target.checked;
            this.updateAll();
        });

        // Accent Color Picker
        document.getElementById('accentColorPicker').addEventListener('input', (e) => {
            this.setAccentColor(e.target.value);
        });

        // Wallpaper Style Select
        document.getElementById('wallpaperStyleSelect').addEventListener('change', (e) => {
            this.state.wallpaperStyle = e.target.value;
            this.updateAll();
        });

        // Preset Dropdown
        document.getElementById('presetSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadPreset(e.target.value);
            }
        });

        // Reset System Colors Button
        document.getElementById('resetSysColorsBtn').addEventListener('click', () => {
            this.setMode(this.state.mode);
        });

        // Export .theme Button
        document.getElementById('exportThemeBtn').addEventListener('click', () => {
            ThemeExporterModule.downloadThemeFile(this.state);
            this.showStatus('Export .theme Ready', `Downloaded ${this.state.themeName}.theme file.`);
        });

        // Export .deskthemepack Button
        document.getElementById('exportPackBtn').addEventListener('click', async () => {
            try {
                this.showStatus('Packaging Full System Suite...', 'Creating .deskthemepack Cabinet bundle.');
                await ThemeExporterModule.downloadDeskThemePack(this.state);
                this.showStatus('Export .deskthemepack Ready', `Downloaded ${this.state.themeName}.deskthemepack archive.`);
            } catch (err) {
                this.showStatus('Export Failed', err.message, true);
            }
        });

        // Apply to Windows Button
        document.getElementById('applyWindowsBtn').addEventListener('click', async () => {
            try {
                this.showStatus('Applying Full System Suite...', 'Saving to Windows Themes directory...');
                const res = await ThemeExporterModule.applyThemeToWindows(this.state);
                this.showStatus('Applied to Windows 11!', res.message);
            } catch (err) {
                this.showStatus('Apply Failed', 'Make sure application is running.', true);
            }
        });

    },

    setupTabNavigation() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');

                tabBtns.forEach(b => {
                    b.classList.remove('active', 'border-blue-500', 'text-blue-400');
                    b.classList.add('border-transparent');
                });
                btn.classList.add('active', 'border-blue-500', 'text-blue-400');

                tabContents.forEach(content => {
                    if (content.id === `tab-${targetTab}`) {
                        content.classList.remove('hidden');
                    } else {
                        content.classList.add('hidden');
                    }
                });
            });
        });
    },

    setupDragAndDrop() {
        const dropZone = document.getElementById('wallpaperDropZone');
        const fileInput = document.getElementById('wallpaperFileInput');

        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleWallpaperFile(e.target.files[0]);
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-active');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files[0]) {
                this.handleWallpaperFile(files[0]);
            }
        });
    },

    handleWallpaperFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (PNG, JPG, WEBP, BMP).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            this.state.wallpaperData = dataUrl;
            this.state.wallpaperFilename = file.name;

            const img = new Image();
            img.onload = async () => {
                const palette = await ColorPickerModule.extractPaletteFromImage(img, 6);
                this.renderExtractedSwatches(palette);
                if (palette.length > 0) {
                    this.setAccentColor(palette[0]);
                    this.synthesizeAITheme();
                }
            };
            img.src = dataUrl;

            this.updateAll();
        };
        reader.readAsDataURL(file);
    },

    showStatus(title, message, isError = false) {
        const toast = document.getElementById('exportStatusToast');
        const titleEl = document.getElementById('exportStatusTitle');
        const descEl = document.getElementById('exportStatusDesc');

        titleEl.innerHTML = isError
            ? `<i data-lucide="alert-circle" class="w-4 h-4 text-rose-400"></i> ${title}`
            : `<i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i> ${title}`;

        descEl.textContent = message;
        if (window.lucide) lucide.createIcons();

        toast.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');

        clearTimeout(this._statusToastTimer);
        this._statusToastTimer = setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
        }, isError ? 6000 : 4000);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
