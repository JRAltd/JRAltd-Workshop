// Color Utilities & Palette Extractor for Windows 11 Theme Generator

const ColorPickerModule = {
    // Windows 11 Default Accent Swatches
    defaultSwatches: [
        "#0078D4", "#00B7C3", "#00836B", "#107C41", "#00CC6A", "#744DA9",
        "#881798", "#B4009E", "#E3008C", "#E81123", "#EA005E", "#C30052",
        "#E74856", "#0099BC", "#2D7D9A", "#038387", "#00B294", "#018574",
        "#498205", "#10893E", "#7A7574", "#5D5A58", "#68768A", "#4C4A48"
    ],

    // Convert HEX (#RRGGBB) to RGB object {r, g, b}
    hexToRgb(hex) {
        let cleanHex = hex.replace('#', '');
        if (cleanHex.length === 3) {
            cleanHex = cleanHex.split('').map(c => c + c).join('');
        }
        const num = parseInt(cleanHex, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    },

    // Convert RGB object to HEX string #RRGGBB
    rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(x => {
            const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join('').toUpperCase();
    },

    // Convert RGB object to Windows INI space-separated string "R G B"
    rgbToWinString(r, g, b) {
        return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
    },

    // Parse Windows INI string "R G B" to RGB object
    winStringToRgb(str) {
        const parts = str.trim().split(/\s+/).map(Number);
        return {
            r: parts[0] || 0,
            g: parts[1] || 0,
            b: parts[2] || 0
        };
    },

    // Convert RGB to Windows DWORD colorization hex 0xAAABBGGRR
    rgbToDwordHex(r, g, b, alpha = 0xC4) {
        const aHex = alpha.toString(16).padStart(2, '0');
        const bHex = Math.round(b).toString(16).padStart(2, '0');
        const gHex = Math.round(g).toString(16).padStart(2, '0');
        const rHex = Math.round(r).toString(16).padStart(2, '0');
        return `0x${aHex}${bHex}${gHex}${rHex}`.toUpperCase();
    },

    // Extract dominant palette from Image element or Data URL using HTML5 Canvas
    extractPaletteFromImage(imgElement, colorCount = 6) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const width = 100;
            const height = 100;
            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(imgElement, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height).data;

            const colorMap = {};
            const step = 4; // Sample every 4th pixel for speed

            for (let i = 0; i < imageData.length; i += 4 * step) {
                const r = imageData[i];
                const g = imageData[i + 1];
                const b = imageData[i + 2];
                const a = imageData[i + 3];

                if (a < 128) continue; // Skip transparent

                // Quantize colors to group similar hues
                const qr = Math.round(r / 32) * 32;
                const qg = Math.round(g / 32) * 32;
                const qb = Math.round(b / 32) * 32;
                const key = `${qr},${qg},${qb}`;

                colorMap[key] = (colorMap[key] || 0) + 1;
            }

            // Sort colors by frequency
            const sortedColors = Object.keys(colorMap)
                .sort((a, b) => colorMap[b] - colorMap[a])
                .map(key => {
                    const [r, g, b] = key.split(',').map(Number);
                    return ColorPickerModule.rgbToHex(r, g, b);
                });

            // Filter out extremely dark or extremely white colors for rich accent choices
            const vibrantColors = sortedColors.filter(hex => {
                const rgb = ColorPickerModule.hexToRgb(hex);
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                return brightness > 30 && brightness < 235;
            });

            resolve(vibrantColors.slice(0, colorCount));
        });
    }
};
