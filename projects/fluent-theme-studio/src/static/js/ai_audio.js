// Pure JS Wave Synthesizer for Full System Experience Windows Sound Schemes

const AIAudioSynthesizer = {
    
    generateWavDataUrl(sampleRate, duration, sampleGenerator) {
        const numSamples = Math.floor(sampleRate * duration);
        const bufferLength = 44 + numSamples * 2;
        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);

        const writeString = (offset, str) => {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + numSamples * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, numSamples * 2, true);

        let offset = 44;
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const sample = Math.max(-1, Math.min(1, sampleGenerator(t, i)));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }

        const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ blob, dataUrl: reader.result });
            reader.readAsDataURL(blob);
        });
    },

    // Synthesize Full Sound Scheme (10+ Windows Event Sounds)
    async generateFullSystemSoundScheme(accentHex) {
        const rgb = ColorPickerModule.hexToRgb(accentHex || "#0078D4");
        const baseFreq = 440 + ((rgb.r + rgb.g + rgb.b) % 350);

        const scheme = {};

        // 1. Windows Startup / Logon Chime (Rich 4-note ascending chord)
        scheme['WindowsLogon'] = (await this.generateWavDataUrl(44100, 1.2, (t) => {
            const notes = [baseFreq * 0.75, baseFreq, baseFreq * 1.25, baseFreq * 1.5];
            let s = 0;
            notes.forEach((f, idx) => {
                const st = idx * 0.15;
                if (t >= st) {
                    const lt = t - st;
                    s += 0.25 * Math.sin(2 * Math.PI * f * lt) * Math.exp(-4 * lt);
                }
            });
            return s;
        })).dataUrl;

        // 2. Notification Default Chime
        scheme['Notification'] = (await this.generateNotificationSound(accentHex)).dataUrl;

        // 3. Critical Stop / Error Sound
        scheme['CriticalStop'] = (await this.generateErrorSound()).dataUrl;

        // 4. Exclamation / Warning Sound
        scheme['Exclamation'] = (await this.generateWavDataUrl(44100, 0.45, (t) => {
            const env = Math.exp(-6 * t);
            return 0.35 * Math.sin(2 * Math.PI * (baseFreq * 1.1) * t) * env;
        })).dataUrl;

        // 5. Empty Recycle Bin Sound
        scheme['EmptyRecycleBin'] = (await this.generateRecycleSound()).dataUrl;

        // 6. Device Connect (Ascending 2-tone)
        scheme['DeviceConnect'] = (await this.generateWavDataUrl(44100, 0.35, (t) => {
            const f = t < 0.15 ? baseFreq : baseFreq * 1.33;
            const env = Math.exp(-8 * (t % 0.15));
            return 0.35 * Math.sin(2 * Math.PI * f * t) * env;
        })).dataUrl;

        // 7. Device Disconnect (Descending 2-tone)
        scheme['DeviceDisconnect'] = (await this.generateWavDataUrl(44100, 0.35, (t) => {
            const f = t < 0.15 ? baseFreq * 1.33 : baseFreq;
            const env = Math.exp(-8 * (t % 0.15));
            return 0.35 * Math.sin(2 * Math.PI * f * t) * env;
        })).dataUrl;

        // 8. Navigation Click Sound (Short crisp click)
        scheme['Navigating'] = (await this.generateWavDataUrl(44100, 0.08, (t) => {
            const env = Math.exp(-30 * t);
            return 0.3 * Math.sin(2 * Math.PI * 800 * t) * env;
        })).dataUrl;

        return scheme;
    },

    async generateNotificationSound(accentHex) {
        const rgb = ColorPickerModule.hexToRgb(accentHex || "#0078D4");
        const baseFreq = 440 + ((rgb.r + rgb.g + rgb.b) % 350);
        const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];

        return this.generateWavDataUrl(44100, 0.6, (t) => {
            let s = 0;
            notes.forEach((freq, idx) => {
                const startTime = idx * 0.09;
                if (t >= startTime) {
                    const localT = t - startTime;
                    const env = Math.exp(-7 * localT);
                    s += 0.3 * Math.sin(2 * Math.PI * freq * localT) * env;
                }
            });
            return s;
        });
    },

    async generateErrorSound() {
        return this.generateWavDataUrl(44100, 0.4, (t) => {
            const env = Math.exp(-8 * t);
            const freq = 220 - (t * 250);
            return 0.4 * Math.sin(2 * Math.PI * freq * t) * env;
        });
    },

    async generateRecycleSound() {
        return this.generateWavDataUrl(44100, 0.3, (t) => {
            const env = Math.exp(-14 * t);
            const noise = (Math.random() * 2 - 1) * 0.25;
            const tone = 0.3 * Math.sin(2 * Math.PI * 550 * t);
            return (noise + tone) * env;
        });
    }
};
