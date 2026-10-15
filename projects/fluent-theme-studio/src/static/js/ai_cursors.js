// Procedural Canvas Theme Cursor Generator for Full 15-Cursor System Suite

const AICursorGenerator = {
    
    // Generate Full 15-Cursor System Suite matching theme accent color
    generateFullCursorSuite(accentHex) {
        const suite = {};

        suite['Arrow'] = this.generateArrowCursor(accentHex);
        suite['Help'] = this.generateHelpCursor(accentHex);
        suite['AppStarting'] = this.generateWaitCursor(accentHex);
        suite['Wait'] = this.generateWaitCursor(accentHex);
        suite['Crosshair'] = this.generateCrosshairCursor(accentHex);
        suite['IBeam'] = this.generateIBeamCursor(accentHex);
        suite['NWPen'] = this.generateArrowCursor(accentHex);
        suite['No'] = this.generateNoCursor(accentHex);
        suite['SizeNS'] = this.generateResizeCursor(accentHex, 'NS');
        suite['SizeWE'] = this.generateResizeCursor(accentHex, 'WE');
        suite['SizeNWSE'] = this.generateResizeCursor(accentHex, 'NWSE');
        suite['SizeNESW'] = this.generateResizeCursor(accentHex, 'NESW');
        suite['SizeAll'] = this.generateSizeAllCursor(accentHex);
        suite['UpArrow'] = this.generateArrowCursor(accentHex);
        suite['Hand'] = this.generateHandCursor(accentHex);

        return suite;
    },

    generateArrowCursor(accentHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.beginPath();
        ctx.moveTo(2, 2);
        ctx.lineTo(2, 24);
        ctx.lineTo(8, 18);
        ctx.lineTo(13, 29);
        ctx.lineTo(17, 27);
        ctx.lineTo(12, 16);
        ctx.lineTo(20, 16);
        ctx.closePath();

        ctx.shadowColor = accentHex;
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 2;
        ctx.stroke();

        return canvas.toDataURL('image/png');
    },

    generateHandCursor(accentHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.beginPath();
        ctx.arc(16, 16, 10, 0, 2 * Math.PI);
        ctx.fillStyle = accentHex;
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        return canvas.toDataURL('image/png');
    },

    generateWaitCursor(accentHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.beginPath();
        ctx.arc(16, 16, 11, 0, 1.5 * Math.PI);
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 4;
        ctx.stroke();

        return canvas.toDataURL('image/png');
    },

    generateIBeamCursor(accentHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(12, 6); ctx.lineTo(20, 6);
        ctx.moveTo(16, 6); ctx.lineTo(16, 26);
        ctx.moveTo(12, 26); ctx.lineTo(20, 26);
        ctx.stroke();

        return canvas.toDataURL('image/png');
    },

    generateHelpCursor(accentHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.beginPath();
        ctx.moveTo(2, 2); ctx.lineTo(2, 20); ctx.lineTo(7, 15); ctx.lineTo(16, 15);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = accentHex;
        ctx.font = 'bold 14px Segoe UI';
        ctx.fillText('?', 18, 26);

        return canvas.toDataURL('image/png');
    },

    generateCrosshairCursor(accentHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(16, 16, 8, 0, 2 * Math.PI);
        ctx.moveTo(16, 4); ctx.lineTo(16, 28);
        ctx.moveTo(4, 16); ctx.lineTo(28, 16);
        ctx.stroke();

        return canvas.toDataURL('image/png');
    },

    generateNoCursor(accentHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(16, 16, 10, 0, 2 * Math.PI);
        ctx.moveTo(9, 9); ctx.lineTo(23, 23);
        ctx.stroke();

        return canvas.toDataURL('image/png');
    },

    generateResizeCursor(accentHex, dir) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (dir === 'NS') {
            ctx.moveTo(16, 4); ctx.lineTo(16, 28);
            ctx.moveTo(10, 10); ctx.lineTo(16, 4); ctx.lineTo(22, 10);
            ctx.moveTo(10, 22); ctx.lineTo(16, 28); ctx.lineTo(22, 22);
        } else if (dir === 'WE') {
            ctx.moveTo(4, 16); ctx.lineTo(28, 16);
            ctx.moveTo(10, 10); ctx.lineTo(4, 16); ctx.lineTo(10, 22);
            ctx.moveTo(22, 10); ctx.lineTo(28, 16); ctx.lineTo(22, 22);
        } else if (dir === 'NWSE') {
            ctx.moveTo(6, 6); ctx.lineTo(26, 26);
            ctx.moveTo(6, 14); ctx.lineTo(6, 6); ctx.lineTo(14, 6);
            ctx.moveTo(26, 18); ctx.lineTo(26, 26); ctx.lineTo(18, 26);
        } else {
            ctx.moveTo(26, 6); ctx.lineTo(6, 26);
            ctx.moveTo(18, 6); ctx.lineTo(26, 6); ctx.lineTo(26, 14);
            ctx.moveTo(6, 18); ctx.lineTo(6, 26); ctx.lineTo(14, 26);
        }
        ctx.stroke();

        return canvas.toDataURL('image/png');
    },

    generateSizeAllCursor(accentHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(16, 4); ctx.lineTo(16, 28);
        ctx.moveTo(4, 16); ctx.lineTo(28, 16);
        ctx.stroke();

        return canvas.toDataURL('image/png');
    }
};
