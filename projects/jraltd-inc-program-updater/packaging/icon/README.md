# App icon

`icon.svg` is the editable source (dark navy badge, cyan ring, cyan lightning bolt —
same palette and bolt motif as jraltdinc.us and the app's own title bar). The built
`.ico` consumed by the app lives at `src/JRAltdIncProgramUpdater/icon.ico` (referenced
by `<ApplicationIcon>` in the `.csproj`), not here — regenerate it after editing the
SVG with:

```bash
for sz in 16 32 48 64 128 256; do
  rsvg-convert -w $sz -h $sz icon.svg -o "icon_${sz}.png"
done
convert icon_16.png icon_32.png icon_48.png icon_64.png icon_128.png icon_256.png icon.ico
rm icon_16.png icon_32.png icon_48.png icon_64.png icon_128.png icon_256.png
mv icon.ico ../../src/JRAltdIncProgramUpdater/icon.ico
```

Requires `rsvg-convert` (`librsvg2-bin`) and `convert` (`imagemagick`). On Windows,
[GIMP](https://www.gimp.org/) or an online SVG-to-ICO converter works too — just make
sure the result is a multi-resolution `.ico` (16/32/48/64/128/256), not a single size.
