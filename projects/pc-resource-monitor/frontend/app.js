(() => {
  const MAX_HISTORY = 60;
  const ARC_LENGTH = 246;

  const params = new URLSearchParams(window.location.search);
  if (params.get("widget") === "1") {
    document.body.classList.add("widget-mode");
  }

  const state = {
    unit: localStorage.getItem("hud_unit") || "C",
    interval: parseFloat(localStorage.getItem("hud_interval") || "1"),
    sort: localStorage.getItem("hud_sort") || "cpu",
    demo: params.get("demo") === "1" ||
          localStorage.getItem("hud_demo") === "1",
    ws: null,
    history: {
      cpu: [],
      gpu: [],
      ram: [],
      netDown: [],
      netUp: [],
    },
  };

  const $ = (id) => document.getElementById(id);

  // Fit 515x1920 panel cleanly when previewing on a larger/shorter desktop monitor
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

  // Clock
  function updateClock() {
    const now = new Date();
    $("clockTime").textContent = now.toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    $("clockDate").textContent = now.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
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

  function formatTemp(tempC) {
    if (tempC === null || tempC === undefined) return "N/A";
    if (state.unit === "F") {
      return `${((tempC * 9) / 5 + 32).toFixed(0)}°F`;
    }
    return `${tempC.toFixed(0)}°C`;
  }

  function formatRate(bytesPerSec) {
    if (bytesPerSec >= 1024 * 1024 * 1024) {
      return `${(bytesPerSec / (1024 ** 3)).toFixed(2)} GB/s`;
    }
    if (bytesPerSec >= 1024 * 1024) {
      return `${(bytesPerSec / (1024 ** 2)).toFixed(1)} MB/s`;
    }
    if (bytesPerSec >= 1024) {
      return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
    }
    return `${bytesPerSec.toFixed(0)} B/s`;
  }

  function loadColor(pct, defaultColor = "#22d3ee") {
    if (pct >= 90) return "#ef4444";
    if (pct >= 72) return "#f59e0b";
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

  function renderCores(perCore) {
    const grid = $("coresGrid");
    const count = perCore.length;
    const cols = count <= 8 ? count : count <= 16 ? 8 : count <= 24 ? 12 : 16;
    grid.style.gridTemplateColumns = `repeat(${Math.max(cols, 4)}, 1fr)`;

    if (grid.children.length !== count) {
      grid.innerHTML = perCore
        .map(
          (_, i) => `
          <div class="core-cell" title="Thread ${i}">
            <div class="core-bar-track"><div class="core-bar-fill" style="height:0%"></div></div>
            <span class="core-pct">0%</span>
          </div>`
        )
        .join("");
    }

    Array.from(grid.children).forEach((cell, idx) => {
      const val = perCore[idx] ?? 0;
      const fill = cell.querySelector(".core-bar-fill");
      const label = cell.querySelector(".core-pct");
      fill.style.height = `${Math.max(4, Math.min(100, val))}%`;
      fill.style.background = loadColor(val, "#22d3ee");
      label.textContent = `${Math.round(val)}`;
    });
  }

  function renderDrives(drives) {
    const list = $("drivesList");
    list.innerHTML = drives
      .map((d) => {
        const color = loadColor(d.percent, "#38bdf8");
        return `
        <div class="drive-row">
          <div class="drive-top">
            <span class="drive-mount">${d.mount} <span style="color:var(--text-muted);font-weight:400">(${d.fs})</span></span>
            <span class="drive-cap">${d.used_gb.toFixed(0)} / ${d.total_gb.toFixed(0)} GB • ${d.percent.toFixed(0)}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${d.percent}%;background:${color}"></div>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderProcesses(procs) {
    const list = $("procsList");
    const maxVal = Math.max(
      ...procs.map((p) => (state.sort === "ram" ? p.ram_mb : p.cpu_percent)),
      1
    );
    list.innerHTML = procs
      .map((p) => {
        const ratio =
          state.sort === "ram"
            ? (p.ram_mb / maxVal) * 100
            : Math.min(100, (p.cpu_percent / Math.max(maxVal, 25)) * 100);
        const ramLabel =
          p.ram_mb >= 1024 ? `${(p.ram_mb / 1024).toFixed(1)} GB` : `${p.ram_mb.toFixed(0)} MB`;
        return `
        <div class="proc-row">
          <div class="proc-bar" style="width:${ratio.toFixed(1)}%"></div>
          <span class="proc-name" title="PID ${p.pid}">${p.name}</span>
          <span class="proc-cpu">${p.cpu_percent.toFixed(1)}%</span>
          <span class="proc-ram">${ramLabel}</span>
        </div>`;
      })
      .join("");
  }

  function renderTelemetry(data) {
    // Header
    $("hostname").textContent = data.system.hostname.toUpperCase();
    $("sysMeta").textContent = `${data.system.os} • Up ${formatUptime(data.system.uptime_sec)}`;
    const badge = $("modeBadge");
    badge.textContent = data.mode === "demo" ? "DEMO" : "LIVE";
    badge.classList.toggle("demo", data.mode === "demo");

    // CPU
    const cpu = data.cpu;
    $("cpuName").textContent = cpu.name;
    $("cpuTopology").textContent = `${cpu.cores}C / ${cpu.threads}T`;
    $("cpuPct").innerHTML = `${Math.round(cpu.usage_percent)}<span class="unit">%</span>`;
    $("cpuFreq").textContent = cpu.freq_ghz ? `${cpu.freq_ghz.toFixed(2)} GHz` : "-- GHz";
    $("cpuTemp").textContent = formatTemp(cpu.temp_c);
    setArc("cpuArc", cpu.usage_percent, "url(#cpuGrad)");

    pushHistory("cpu", cpu.usage_percent);
    const cpuPeak = Math.max(...state.history.cpu, 0);
    $("cpuPeak").textContent = `${Math.round(cpuPeak)}%`;
    renderSparkline("cpuSparkLine", "cpuSparkArea", state.history.cpu, 440, 52, 100);
    renderCores(cpu.per_core || []);

    // GPU
    const gpu = data.gpu;
    $("gpuName").textContent = gpu.name;
    $("gpuFan").textContent = gpu.fan_percent !== null ? `FAN ${Math.round(gpu.fan_percent)}%` : "FAN --";
    $("gpuPct").innerHTML = `${Math.round(gpu.usage_percent)}<span class="unit">%</span>`;
    $("gpuTemp").textContent = formatTemp(gpu.temp_c);
    $("gpuPower").textContent =
      gpu.power_w !== null
        ? `${Math.round(gpu.power_w)}${gpu.power_limit_w ? ` / ${Math.round(gpu.power_limit_w)}` : ""} W`
        : "-- W";
    $("gpuClock").textContent = gpu.clock_mhz ? `${Math.round(gpu.clock_mhz)} MHz` : "-- MHz";
    setArc("gpuArc", gpu.usage_percent, "url(#gpuGrad)");

    pushHistory("gpu", gpu.usage_percent);
    renderSparkline("gpuSparkLine", "gpuSparkArea", state.history.gpu, 440, 46, 100);

    $("vramText").textContent = `${gpu.vram_used_gb.toFixed(1)} / ${gpu.vram_total_gb.toFixed(1)} GB (${Math.round(gpu.vram_percent)}%)`;
    $("vramBar").style.width = `${gpu.vram_percent}%`;

    // RAM
    const mem = data.memory;
    $("ramSummary").textContent = `${mem.used_gb.toFixed(1)} / ${mem.total_gb.toFixed(1)} GB`;
    $("ramPct").textContent = `${Math.round(mem.percent)}%`;
    $("ramBar").style.width = `${mem.percent}%`;
    $("ramBar").style.background = loadColor(mem.percent, "linear-gradient(90deg, #06b6d4, #38bdf8)");
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

    // Storage
    $("diskRead").textContent = formatRate(data.storage.read_bps);
    $("diskWrite").textContent = formatRate(data.storage.write_bps);
    renderDrives(data.storage.drives || []);

    // Processes
    renderProcesses(data.processes || []);
  }

  // WebSocket Lifecycle
  function connectWS() {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/telemetry?demo=${state.demo}&interval=${state.interval}&sort=${state.sort}`;
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
          sort: state.sort,
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
    if (!drawer.hidden && !drawer.contains(e.target) && e.target !== $("settingsBtn")) {
      drawer.hidden = true;
    }
  });

  $("modeToggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.demo = btn.dataset.mode === "demo";
    localStorage.setItem("hud_demo", state.demo ? "1" : "0");
    syncSegmented("modeToggle", "mode", btn.dataset.mode);
    pushConfig();
  });

  $("unitToggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.unit = btn.dataset.unit;
    localStorage.setItem("hud_unit", state.unit);
    syncSegmented("unitToggle", "unit", state.unit);
  });

  $("intervalToggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.interval = parseFloat(btn.dataset.interval);
    localStorage.setItem("hud_interval", String(state.interval));
    syncSegmented("intervalToggle", "interval", btn.dataset.interval);
    pushConfig();
  });

  $("procSortToggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.sort = btn.dataset.sort;
    localStorage.setItem("hud_sort", state.sort);
    syncSegmented("procSortToggle", "sort", state.sort);
    pushConfig();
  });

  syncSegmented("modeToggle", "mode", state.demo ? "demo" : "live");
  syncSegmented("unitToggle", "unit", state.unit);
  syncSegmented("intervalToggle", "interval", String(state.interval));
  syncSegmented("procSortToggle", "sort", state.sort);

  connectWS();
})();
