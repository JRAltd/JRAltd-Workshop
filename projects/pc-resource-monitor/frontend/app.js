(() => {
  const MAX_HISTORY = 60;
  const ARC_LENGTH = 246;

  const PRESETS = {
    cyan: { primary: "#22d3ee", secondary: "#10b981", bg: "#0d141e" },
    emerald: { primary: "#10b981", secondary: "#34d399", bg: "#0a1714" },
    amber: { primary: "#f59e0b", secondary: "#fb923c", bg: "#18130a" },
    crimson: { primary: "#f43f5e", secondary: "#fb7185", bg: "#1a0c12" },
    cobalt: { primary: "#3b82f6", secondary: "#38bdf8", bg: "#0b1322" },
    arctic: { primary: "#e2e8f0", secondary: "#38bdf8", bg: "#101620" },
  };

  const WEATHER_ICONS = {
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`,
    "partly-cloudy": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1.5M5.6 5.6l1.1 1.1M3 12h1.5M16.9 6.7l1.1-1.1"/><path d="M8.5 12a3.5 3.5 0 0 1 6.7-1.4"/><path d="M9 19h8.5a3.5 3.5 0 0 0 .4-7 4.8 4.8 0 0 0-9.2-1.1A3.6 3.6 0 0 0 9 19z"/></svg>`,
    cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 19h11a4 4 0 0 0 .6-7.9A5.5 5.5 0 0 0 7.4 9.5 4.2 4.2 0 0 0 6.5 19z"/></svg>`,
    fog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14h12a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8.5 6 3.5 3.5 0 0 0 6 14z"/><path d="M4 17.5h16M6 21h12"/></svg>`,
    rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15h12a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8.5 7 3.5 3.5 0 0 0 6 15z"/><path d="M8 18.5l-1 2.5M12.5 18.5l-1 2.5M17 18.5l-1 2.5"/></svg>`,
    snow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14.5h12a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8.5 6.5 3.5 3.5 0 0 0 6 14.5z"/><circle cx="8.5" cy="19" r="0.9" fill="currentColor"/><circle cx="12.5" cy="20" r="0.9" fill="currentColor"/><circle cx="16.5" cy="19" r="0.9" fill="currentColor"/></svg>`,
    storm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14.5h12a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8.5 6.5 3.5 3.5 0 0 0 6 14.5z"/><path d="M13 14.5l-2 4h3l-2 4"/></svg>`,
  };

  const params = new URLSearchParams(window.location.search);
  if (params.get("widget") === "1") {
    document.body.classList.add("widget-mode");
  }

  const state = {
    unit: localStorage.getItem("rtm_unit") || "F",
    clockFormat: localStorage.getItem("rtm_clock") || "12",
    interval: parseFloat(localStorage.getItem("rtm_interval") || "1"),
    location: localStorage.getItem("rtm_location") || "Des Moines, IA",
    preset: localStorage.getItem("rtm_preset") || "cyan",
    primaryColor: localStorage.getItem("rtm_primary") || PRESETS.cyan.primary,
    secondaryColor: localStorage.getItem("rtm_secondary") || PRESETS.cyan.secondary,
    bgColor: localStorage.getItem("rtm_bg") || PRESETS.cyan.bg,
    demo: params.get("demo") === "1" || localStorage.getItem("rtm_demo") === "1",
    ws: null,
    lastWeather: null,
    history: {
      cpu: [],
      gpu: [],
      ram: [],
      netDown: [],
      netUp: [],
    },
  };

  const $ = (id) => document.getElementById(id);

  // Hex -> "r, g, b"
  function hexToRgb(hex) {
    const clean = hex.replace("#", "").trim();
    const num = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
    if (Number.isNaN(num)) return "34, 211, 238";
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  function applyTheme() {
    const root = document.documentElement;
    root.style.setProperty("--accent", state.primaryColor);
    root.style.setProperty("--accent-rgb", hexToRgb(state.primaryColor));
    root.style.setProperty("--accent-2", state.secondaryColor);
    root.style.setProperty("--accent-2-rgb", hexToRgb(state.secondaryColor));
    root.style.setProperty("--card-rgb", hexToRgb(state.bgColor));

    // Update SVG gradients & sparkline strokes
    ["cpuGradStop1", "cpuGradStop2", "cpuSparkStop1", "cpuSparkStop2", "ramSparkStop1", "ramSparkStop2", "netSparkStop1", "netSparkStop2"].forEach((id) => {
      const el = $(id);
      if (el) el.setAttribute("stop-color", state.primaryColor);
    });
    ["gpuGradStop1", "gpuGradStop2", "gpuSparkStop1", "gpuSparkStop2"].forEach((id) => {
      const el = $(id);
      if (el) el.setAttribute("stop-color", state.secondaryColor);
    });

    ["cpuSparkLine", "ramSparkLine", "netDownLine"].forEach((id) => {
      const el = $(id);
      if (el) el.setAttribute("stroke", state.primaryColor);
    });
    ["gpuSparkLine", "netUpLine"].forEach((id) => {
      const el = $(id);
      if (el) el.setAttribute("stroke", state.secondaryColor);
    });

    $("primaryColorPicker").value = state.primaryColor;
    $("secondaryColorPicker").value = state.secondaryColor;
    $("bgColorPicker").value = state.bgColor;

    Array.from($("themePresets").querySelectorAll(".swatch")).forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.preset === state.preset);
    });
  }

  // Fit 515x1920 panel cleanly to any viewport
  function fitPanel() {
    const panel = $("hudPanel");
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (Math.abs(vw - 515) <= 2 && Math.abs(vh - 1920) <= 2) {
      panel.style.transform = "none";
      return;
    }
    const scale = Math.min(vw / 515, vh / 1920);
    panel.style.transform = `scale(${scale.toFixed(4)})`;
  }

  window.addEventListener("resize", fitPanel);
  fitPanel();

  // Clock Widget
  function updateClock() {
    const now = new Date();
    const use12 = state.clockFormat === "12";
    let hours = now.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    if (use12) {
      hours = hours % 12 || 12;
    }
    const hh = use12 ? String(hours) : String(hours).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    $("clockHM").textContent = `${hh}:${mm}`;
    $("clockSec").textContent = ss;
    $("clockAmPm").textContent = use12 ? ampm : "24H";

    const day = now.toLocaleDateString([], { weekday: "long" }).toUpperCase();
    const datePart = now
      .toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" })
      .toUpperCase();
    $("clockDateLine").textContent = `${day} • ${datePart}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // Formatters
  function formatUptime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  }

  function formatTemp(tempC, showUnit = true) {
    if (tempC === null || tempC === undefined) return "N/A";
    if (state.unit === "F") {
      const f = (tempC * 9) / 5 + 32;
      return `${Math.round(f)}°${showUnit ? "F" : ""}`;
    }
    return `${Math.round(tempC)}°${showUnit ? "C" : ""}`;
  }

  function formatWind(kph) {
    if (kph === null || kph === undefined) return "--";
    if (state.unit === "F") {
      return `${Math.round(kph * 0.621371)} mph`;
    }
    return `${Math.round(kph)} km/h`;
  }

  function formatRate(bytesPerSec) {
    if (bytesPerSec >= 1024 * 1024 * 1024) {
      return `${(bytesPerSec / 1024 ** 3).toFixed(2)} GB/s`;
    }
    if (bytesPerSec >= 1024 * 1024) {
      return `${(bytesPerSec / 1024 ** 2).toFixed(1)} MB/s`;
    }
    if (bytesPerSec >= 1024) {
      return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
    }
    return `${bytesPerSec.toFixed(0)} B/s`;
  }

  function loadColor(pct, defaultColor) {
    if (pct >= 90) return "#ef4444";
    if (pct >= 75) return "#f59e0b";
    return defaultColor;
  }

  function setArc(arcId, pct, defaultGrad) {
    const el = $(arcId);
    const clamped = Math.max(0, Math.min(100, pct));
    const offset = ARC_LENGTH * (1 - clamped / 100);
    el.style.strokeDashoffset = offset.toFixed(1);
    if (clamped >= 90) {
      el.setAttribute("stroke", "#ef4444");
    } else if (clamped >= 75) {
      el.setAttribute("stroke", "#f59e0b");
    } else {
      el.setAttribute("stroke", defaultGrad);
    }
  }

  function pushHistory(key, val) {
    const arr = state.history[key];
    arr.push(val);
    if (arr.length > MAX_HISTORY) arr.shift();
  }

  function renderSparkline(lineId, areaId, values, width, height, maxVal = 100) {
    if (values.length < 2) return;
    const safeMax = Math.max(maxVal, 1);
    const stepX = width / (MAX_HISTORY - 1);
    const offsetX = (MAX_HISTORY - values.length) * stepX;

    const pts = values.map((v, idx) => {
      const x = offsetX + idx * stepX;
      const y = height - (Math.max(0, Math.min(safeMax, v)) / safeMax) * (height - 6) - 3;
      return [x.toFixed(1), y.toFixed(1)];
    });

    const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
    $(lineId).setAttribute("d", lineD);

    if (areaId) {
      const firstX = pts[0][0];
      const lastX = pts[pts.length - 1][0];
      const areaD = `${lineD} L${lastX},${height} L${firstX},${height} Z`;
      $(areaId).setAttribute("d", areaD);
    }
  }

  // Weather Widget
  function renderWeather(w) {
    if (!w) return;
    if (!w.ok) {
      $("weatherLocLabel").textContent = w.location || state.location;
      $("weatherCond").textContent = "Location unavailable";
      $("weatherTemp").textContent = "--°";
      $("weatherHiLo").textContent = "H --° / L --°";
      $("weatherFeels").textContent = "--°";
      $("weatherHum").textContent = "--%";
      $("weatherWind").textContent = "--";
      $("weatherIcon").innerHTML = WEATHER_ICONS.cloud;
      return;
    }

    $("weatherLocLabel").textContent = w.location;
    $("weatherTemp").textContent = formatTemp(w.temp_c, true);
    $("weatherCond").textContent = w.condition;
    $("weatherHiLo").textContent = `H ${formatTemp(w.high_c, false)} / L ${formatTemp(w.low_c, false)}`;
    $("weatherFeels").textContent = formatTemp(w.feels_like_c, false);
    $("weatherHum").textContent = `${w.humidity}%`;
    $("weatherWind").textContent = formatWind(w.wind_kph);
    $("weatherIcon").innerHTML = WEATHER_ICONS[w.icon] || WEATHER_ICONS.sun;
  }

  async function fetchWeather(showStatus = false) {
    const statusEl = $("weatherLocStatus");
    try {
      const q = encodeURIComponent(state.location);
      const res = await fetch(`/api/weather?location=${q}&demo=${state.demo}`);
      const data = await res.json();
      state.lastWeather = data;
      renderWeather(data);
      if (showStatus) {
        if (data.ok) {
          statusEl.textContent = `Updated: ${data.location}`;
          statusEl.classList.remove("error");
        } else {
          statusEl.textContent = data.error || "Location not found";
          statusEl.classList.add("error");
        }
      }
    } catch (err) {
      if (showStatus) {
        statusEl.textContent = "Could not reach weather service";
        statusEl.classList.add("error");
      }
    }
  }

  function renderFans(fans) {
    const grid = $("fansGrid");
    const badge = $("fansSource");
    if (!fans || !fans.available || !fans.items || fans.items.length === 0) {
      badge.textContent = "NO LHM";
      grid.innerHTML = `<div class="fans-empty">Run LibreHardwareMonitor for CPU &amp; case fan RPM</div>`;
      return;
    }

    const srcLabels = {
      "lhm-http": "LHM WEB",
      "lhm-wmi": "LHM WMI",
      psutil: "SENSORS",
      demo: "DEMO",
    };
    badge.textContent = srcLabels[fans.source] || "ACTIVE";

    const items = fans.items.slice(0, 4);
    grid.innerHTML = items
      .map(
        (f) => `
        <div class="fan-tile">
          <span class="fan-name">${f.name}</span>
          <span class="fan-rpm">${f.rpm.toLocaleString()}<span class="rpm-unit">RPM</span></span>
        </div>`
      )
      .join("");
  }

  function renderTelemetry(data) {
    // Header
    $("sysMeta").textContent = `${data.system.hostname.toUpperCase()} • Up ${formatUptime(data.system.uptime_sec)}`;
    const badge = $("modeBadge");
    badge.textContent = data.mode === "demo" ? "DEMO" : "LIVE";
    badge.classList.toggle("demo", data.mode === "demo");

    // CPU
    const cpu = data.cpu;
    $("cpuName").textContent = cpu.name;
    $("cpuTopology").textContent = `${cpu.cores}C / ${cpu.threads}T`;
    $("cpuPct").innerHTML = `${Math.round(cpu.usage_percent)}<span class="unit">%</span>`;
    $("cpuFreq").textContent = cpu.freq_ghz ? `${cpu.freq_ghz.toFixed(2)} GHz` : "-- GHz";
    $("cpuTemp").textContent = formatTemp(cpu.temp_c, true);
    setArc("cpuArc", cpu.usage_percent, "url(#cpuGrad)");

    pushHistory("cpu", cpu.usage_percent);
    const cpuPeak = Math.max(...state.history.cpu, 0);
    $("cpuPeak").textContent = `${Math.round(cpuPeak)}%`;
    renderSparkline("cpuSparkLine", "cpuSparkArea", state.history.cpu, 440, 52, 100);

    // GPU
    const gpu = data.gpu;
    $("gpuName").textContent = gpu.name;
    $("gpuFan").textContent = gpu.fan_percent !== null ? `FAN ${Math.round(gpu.fan_percent)}%` : "FAN --";
    $("gpuPct").innerHTML = `${Math.round(gpu.usage_percent)}<span class="unit">%</span>`;
    $("gpuTemp").textContent = formatTemp(gpu.temp_c, true);
    $("gpuPower").textContent =
      gpu.power_w !== null
        ? `${Math.round(gpu.power_w)}${gpu.power_limit_w ? `/${Math.round(gpu.power_limit_w)}` : ""}W`
        : "-- W";
    $("gpuClock").textContent = gpu.clock_mhz ? `${Math.round(gpu.clock_mhz)} MHz` : "-- MHz";
    setArc("gpuArc", gpu.usage_percent, "url(#gpuGrad)");

    pushHistory("gpu", gpu.usage_percent);
    renderSparkline("gpuSparkLine", "gpuSparkArea", state.history.gpu, 440, 46, 100);

    $("vramText").textContent = `${gpu.vram_used_gb.toFixed(1)} / ${gpu.vram_total_gb.toFixed(1)} GB (${Math.round(gpu.vram_percent)}%)`;
    $("vramBar").style.width = `${gpu.vram_percent}%`;

    // Cooling & Fans
    renderFans(data.fans);

    // RAM
    const mem = data.memory;
    $("ramSummary").textContent = `${mem.used_gb.toFixed(1)} / ${mem.total_gb.toFixed(1)} GB`;
    $("ramPct").textContent = `${Math.round(mem.percent)}%`;
    $("ramBar").style.width = `${mem.percent}%`;
    $("ramBar").style.background = loadColor(mem.percent, state.primaryColor);
    $("ramAvail").textContent = `${mem.available_gb.toFixed(1)} GB`;
    $("ramSwap").textContent = `${mem.swap_used_gb.toFixed(1)} / ${mem.swap_total_gb.toFixed(1)} GB`;

    pushHistory("ram", mem.percent);
    renderSparkline("ramSparkLine", "ramSparkArea", state.history.ram, 440, 36, 100);

    // Network
    const net = data.network;
    $("netIp").textContent = data.system.ip;
    $("netTotals").textContent = `↓ ${net.total_rx_gb.toFixed(1)} GB • ↑ ${net.total_tx_gb.toFixed(1)} GB`;
    $("netDown").textContent = formatRate(net.rx_bps);
    $("netUp").textContent = formatRate(net.tx_bps);

    pushHistory("netDown", net.rx_bps);
    pushHistory("netUp", net.tx_bps);
    const netMax = Math.max(...state.history.netDown, ...state.history.netUp, 1024 * 100);
    renderSparkline("netDownLine", "netDownArea", state.history.netDown, 440, 48, netMax);
    renderSparkline("netUpLine", null, state.history.netUp, 440, 48, netMax);
  }

  // WebSocket Lifecycle
  function connectWS() {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/telemetry?demo=${state.demo}&interval=${state.interval}`;
    const dot = $("connDot");
    dot.className = "status-dot";

    const ws = new WebSocket(url);
    state.ws = ws;

    ws.onopen = () => {
      dot.className = "status-dot connected";
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        renderTelemetry(data);
      } catch (err) {
        console.error("Telemetry parse error:", err);
      }
    };

    ws.onclose = () => {
      dot.className = "status-dot error";
      setTimeout(connectWS, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  function pushConfig() {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(
        JSON.stringify({
          demo: state.demo,
          interval: state.interval,
        })
      );
    }
  }

  // Settings & Controls
  function syncSegmented(containerId, attr, activeValue) {
    const container = $(containerId);
    Array.from(container.querySelectorAll("button")).forEach((btn) => {
      btn.classList.toggle("active", btn.dataset[attr] === String(activeValue));
    });
  }

  $("settingsBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const drawer = $("settingsDrawer");
    drawer.hidden = !drawer.hidden;
  });

  document.addEventListener("click", (e) => {
    const drawer = $("settingsDrawer");
    if (!drawer.hidden && !drawer.contains(e.target) && !e.target.closest("#settingsBtn")) {
      drawer.hidden = true;
    }
  });

  // Weather location save
  function saveLocation() {
    const val = $("weatherLocInput").value.trim();
    if (!val) return;
    state.location = val;
    localStorage.setItem("rtm_location", val);
    fetchWeather(true);
  }

  $("weatherLocSave").addEventListener("click", saveLocation);
  $("weatherLocInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveLocation();
  });

  // Theme Presets & Custom Color Pickers
  $("themePresets").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-preset]");
    if (!btn) return;
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    state.preset = btn.dataset.preset;
    state.primaryColor = p.primary;
    state.secondaryColor = p.secondary;
    state.bgColor = p.bg;
    localStorage.setItem("rtm_preset", state.preset);
    localStorage.setItem("rtm_primary", state.primaryColor);
    localStorage.setItem("rtm_secondary", state.secondaryColor);
    localStorage.setItem("rtm_bg", state.bgColor);
    applyTheme();
  });

  $("primaryColorPicker").addEventListener("input", (e) => {
    state.preset = "custom";
    state.primaryColor = e.target.value;
    localStorage.setItem("rtm_preset", "custom");
    localStorage.setItem("rtm_primary", state.primaryColor);
    applyTheme();
  });

  $("secondaryColorPicker").addEventListener("input", (e) => {
    state.preset = "custom";
    state.secondaryColor = e.target.value;
    localStorage.setItem("rtm_preset", "custom");
    localStorage.setItem("rtm_secondary", state.secondaryColor);
    applyTheme();
  });

  $("bgColorPicker").addEventListener("input", (e) => {
    state.preset = "custom";
    state.bgColor = e.target.value;
    localStorage.setItem("rtm_preset", "custom");
    localStorage.setItem("rtm_bg", state.bgColor);
    applyTheme();
  });

  $("clockToggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.clockFormat = btn.dataset.clock;
    localStorage.setItem("rtm_clock", state.clockFormat);
    syncSegmented("clockToggle", "clock", state.clockFormat);
    updateClock();
  });

  $("unitToggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.unit = btn.dataset.unit;
    localStorage.setItem("rtm_unit", state.unit);
    syncSegmented("unitToggle", "unit", state.unit);
    renderWeather(state.lastWeather);
  });

  $("modeToggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.demo = btn.dataset.mode === "demo";
    localStorage.setItem("rtm_demo", state.demo ? "1" : "0");
    syncSegmented("modeToggle", "mode", btn.dataset.mode);
    pushConfig();
    fetchWeather(false);
  });

  $("intervalToggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.interval = parseFloat(btn.dataset.interval);
    localStorage.setItem("rtm_interval", String(state.interval));
    syncSegmented("intervalToggle", "interval", btn.dataset.interval);
    pushConfig();
  });

  // Initialize UI state
  $("weatherLocInput").value = state.location;
  syncSegmented("clockToggle", "clock", state.clockFormat);
  syncSegmented("unitToggle", "unit", state.unit);
  syncSegmented("modeToggle", "mode", state.demo ? "demo" : "live");
  syncSegmented("intervalToggle", "interval", String(state.interval));
  applyTheme();

  connectWS();
  fetchWeather(false);
  setInterval(() => fetchWeather(false), 10 * 60 * 1000);
})();
