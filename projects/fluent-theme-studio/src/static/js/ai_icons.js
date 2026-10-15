// Procedural Canvas Desktop Icon Synthesizer for AI Studio

const AIIconGenerator = {

    // Helper: Create HTML5 Canvas for Icon Generation
    createIconCanvas(drawFunc) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        drawFunc(ctx, 64, 64);
        return canvas.toDataURL('image/png');
    },

    // Draw Glassmorphism Frosted Tile with Accent Glow
    drawIconBackdrop(ctx, width, height, accentHex) {
        ctx.clearRect(0, 0, width, height);

        // Outer Glow
        ctx.shadowColor = accentHex;
        ctx.shadowBlur = 10;

        // Rounded Rect Container
        const r = 14;
        ctx.beginPath();
        ctx.roundRect(4, 4, width - 8, height - 8, r);

        // Gradient Fill
        const rgb = ColorPickerModule.hexToRgb(accentHex);
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`);
        grad.addColorStop(1, `rgba(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)}, 0.95)`);

        ctx.fillStyle = grad;
        ctx.fill();

        // Border Stroke
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    },

    // 1. Generate "This PC" / Computer Icon
    generateComputerIcon(accentHex) {
        return this.createIconCanvas((ctx, w, h) => {
            this.drawIconBackdrop(ctx, w, h, accentHex);

            // Draw Monitor Outline
            ctx.strokeStyle = '#ffffff';
            ctx.fillStyle = '#ffffff';
            ctx.lineWidth = 2.5;

            // Screen
            ctx.beginPath();
            ctx.roundRect(16, 16, 32, 22, 4);
            ctx.stroke();

            // Stand
            ctx.beginPath();
            ctx.moveTo(32, 38);
            ctx.lineTo(32, 45);
            ctx.lineTo(24, 45);
            ctx.lineTo(40, 45);
            ctx.stroke();
        });
    },

    // 2. Generate "User Files" Folder Icon
    generateUserFolderIcon(accentHex) {
        return this.createIconCanvas((ctx, w, h) => {
            this.drawIconBackdrop(ctx, w, h, accentHex);

            ctx.strokeStyle = '#ffffff';
            ctx.fillStyle = '#ffffff';
            ctx.lineWidth = 2.5;

            // Folder
            ctx.beginPath();
            ctx.moveTo(16, 22);
            ctx.lineTo(26, 22);
            ctx.lineTo(30, 26);
            ctx.lineTo(48, 26);
            ctx.lineTo(48, 44);
            ctx.lineTo(16, 44);
            ctx.closePath();
            ctx.stroke();
        });
    },

    // 3. Generate "Network" Icon
    generateNetworkIcon(accentHex) {
        return this.createIconCanvas((ctx, w, h) => {
            this.drawIconBackdrop(ctx, w, h, accentHex);

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;

            // Globe
            ctx.beginPath();
            ctx.arc(32, 32, 14, 0, 2 * Math.PI);
            ctx.stroke();

            // Grid lines
            ctx.beginPath();
            ctx.moveTo(18, 32); ctx.lineTo(46, 32);
            ctx.moveTo(32, 18); ctx.lineTo(32, 46);
            ctx.stroke();
        });
    },

    // 4. Generate "Recycle Bin Empty" Icon
    generateRecycleEmptyIcon(accentHex) {
        return this.createIconCanvas((ctx, w, h) => {
            this.drawIconBackdrop(ctx, w, h, accentHex);

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;

            // Trash Can Body
            ctx.beginPath();
            ctx.moveTo(20, 22);
            ctx.lineTo(44, 22);
            ctx.moveTo(23, 22);
            ctx.lineTo(25, 45);
            ctx.lineTo(39, 45);
            ctx.lineTo(41, 22);
            ctx.stroke();
        });
    },

    // 5. Generate "Recycle Bin Full" Icon
    generateRecycleFullIcon(accentHex) {
        return this.createIconCanvas((ctx, w, h) => {
            this.drawIconBackdrop(ctx, w, h, accentHex);

            ctx.strokeStyle = '#ffffff';
            ctx.fillStyle = '#ffffff';
            ctx.lineWidth = 2.5;

            // Trash Can Body
            ctx.beginPath();
            ctx.moveTo(20, 24);
            ctx.lineTo(44, 24);
            ctx.moveTo(23, 24);
            ctx.lineTo(25, 45);
            ctx.lineTo(39, 45);
            ctx.lineTo(41, 24);
            ctx.stroke();

            // Full papers inside
            ctx.beginPath();
            ctx.arc(32, 20, 5, 0, Math.PI * 2);
            ctx.fill();
        });
    },

    // Generate Full Icon Set
    generateFullIconSet(accentHex) {
        return {
            Computer: this.generateComputerIcon(accentHex),
            UserFiles: this.generateUserFolderIcon(accentHex),
            Network: this.generateNetworkIcon(accentHex),
            RecycleEmpty: this.generateRecycleEmptyIcon(accentHex),
            RecycleFull: this.generateRecycleFullIcon(accentHex)
        };
    }
};
