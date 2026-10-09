// src/shared.js — base compartilhada: defaults, storage, atalhos.
// Carregado em content scripts, options, painel lateral e janela do teleprompter.
(function () {
  if (window.PausarExt) return;

  const DEFAULTS = {
    // ---- atalhos (combos dentro da página) ----
    hotkeyAll: "Ctrl+Space",        // pausa gravação + teleprompter
    hotkeyPrompter: "Alt+Space",    // só o teleprompter
    hotkeyOverlay: "Alt+T",         // mostra/esconde o teleprompter
    hotkeyRestart: "Alt+R",         // volta ao início
    hotkeySpeedUp: "Alt+Up",
    hotkeySpeedDown: "Alt+Down",
    hotkeyFontUp: "Alt+Shift+Up",
    hotkeyFontDown: "Alt+Shift+Down",
    hotkeyMarcar: "Alt+M",          // grava um marcador no log ("corta aqui")
    hotkeyNudgeUp: "Ctrl+Up",       // sobe um pouco o roteiro
    hotkeyNudgeDown: "Ctrl+Down",   // desce um pouco o roteiro
    nudgePx: 80,                    // quanto cada empurrao move (px)

    // ---- comportamento ----
    pauseRecording: true,        // o atalho principal também clica no botão do StreamYard
    countdown: 5,                // segundos de contagem antes de começar (0 = desliga)
    countdownOnResume: true,     // contar também ao retomar, não só no começo do roteiro
    loop: false,                 // ao chegar no fim, volta ao início
    hideBarWhilePlaying: true,   // esconde a barra de controles enquanto rola

    // ---- rolagem ----
    speed: 45,                   // px por segundo
    speedStep: 5,

    // ---- texto ----
    fontSize: 44,
    fontFamily: "system",        // system | serif | mono | condensed
    bold: true,
    lineHeight: 1.55,
    letterSpacing: 0,
    align: "left",               // left | center
    width: 92,                   // % da largura do painel
    textColor: "#ffffff",

    // ---- painel ----
    bgColor: "#000000",
    bgOpacity: 0.55,
    fadeEdges: true,
    guideLine: true,
    guidePos: 38,                // % da altura onde fica a linha de leitura
    mirrorH: false,
    mirrorV: false,
    ghost: false,                // cliques atravessam o teleprompter (segundo plano)
    overlayVisible: true,
    fullscreen: false,

    // ---- registro de pausas (para edição) ----
    logPauses: true,
    logMax: 3000,          // quantos eventos guardar

    // ---- integração ----
    streamyardSelector: "",
    streamyardSelectorAlt: "",
    streamyardTimerSelector: "",   // cronometro da gravacao (normalmente descoberto sozinho)
    teleprompterSelector: ""
  };

  const PANEL_DEFAULT = { x: null, y: 64, w: 760, h: 460 };

  const SCRIPT_DEFAULT = [
    "Cole seu roteiro aqui.",
    "",
    "Clique no lápis (✎) na barra do teleprompter para editar, ou abra os ajustes da extensão.",
    "",
    "Atalhos:",
    "Ctrl+Space  ->  pausa gravação + teleprompter",
    "Alt+Space   ->  pausa só o teleprompter",
    "Alt+T       ->  esconde / mostra",
    "Alt+R       ->  volta ao início",
    "Alt+Setas   ->  velocidade"
  ].join("\n");

  // ------------------------------------------------------------------ storage
  async function loadSettings() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
      try {
        const local = localStorage.getItem("pausar_settings");
        return Object.assign({}, DEFAULTS, local ? JSON.parse(local) : {});
      } catch (_) {
        return Object.assign({}, DEFAULTS);
      }
    }
    const sync = await chrome.storage.sync.get([
      "settings", "shortcutKey", "streamyardSelector", "teleprompterSelector"
    ]);
    const legado = {};
    if (!sync.settings) {
      // migra a versão 1.x
      if (sync.shortcutKey) legado.hotkeyAll = normalize(sync.shortcutKey);
      if (sync.streamyardSelector) legado.streamyardSelector = sync.streamyardSelector;
      if (sync.teleprompterSelector) legado.teleprompterSelector = sync.teleprompterSelector;
    }
    const s = Object.assign({}, DEFAULTS, legado, sync.settings || {});
    // v2.4: quem já tinha ajustes salvos passa a contar 5s ao retomar
    if (sync.settings && sync.settings.countdownOnResume === undefined) {
      s.countdown = 5;
      s.countdownOnResume = true;
    }
    return s;
  }

  async function saveSettings(patch) {
    const atual = await loadSettings();
    const novo = Object.assign({}, atual, patch);
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
      try { localStorage.setItem("pausar_settings", JSON.stringify(novo)); } catch (_) {}
      return novo;
    }
    await chrome.storage.sync.set({ settings: novo });
    return novo;
  }

  // sliders disparam muitos eventos e o storage.sync tem cota (~120 escritas/min):
  // junta as mudanças e grava uma vez só.
  let pendente = {};
  let pendenteId = 0;
  function saveSettingsDebounced(patch, ms) {
    Object.assign(pendente, patch);
    clearTimeout(pendenteId);
    pendenteId = setTimeout(() => {
      const p = pendente;
      pendente = {};
      saveSettings(p);
    }, ms || 400);
  }

  async function resetSettings() {
    const novo = Object.assign({}, DEFAULTS);
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
      try { localStorage.setItem("pausar_settings", JSON.stringify(novo)); } catch (_) {}
      return novo;
    }
    await chrome.storage.sync.set({ settings: novo });
    return novo;
  }

  // roteiro e geometria ficam em `local` (sync tem limite de 8KB por item)
  async function loadScript() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      try {
        const local = localStorage.getItem("pausar_script");
        return typeof local === "string" && local.length > 0 ? local : SCRIPT_DEFAULT;
      } catch (_) {
        return SCRIPT_DEFAULT;
      }
    }
    const d = await chrome.storage.local.get("script");
    return typeof d.script === "string" ? d.script : SCRIPT_DEFAULT;
  }
  function saveScript(texto) {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      try { localStorage.setItem("pausar_script", texto); } catch (_) {}
      return Promise.resolve();
    }
    return chrome.storage.local.set({ script: texto });
  }
  async function loadPanel() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      try {
        const local = localStorage.getItem("pausar_panel");
        return Object.assign({}, PANEL_DEFAULT, local ? JSON.parse(local) : {});
      } catch (_) {
        return Object.assign({}, PANEL_DEFAULT);
      }
    }
    const d = await chrome.storage.local.get("panel");
    const p = Object.assign({}, d.panel || {});
    // quem já usou a v2.0 tem 640x340 salvo — pequeno demais, cortava os controles
    if (p.w === 640 && p.h === 340) { delete p.w; delete p.h; }
    return Object.assign({}, PANEL_DEFAULT, p);
  }

  function resetPanel() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      try { localStorage.removeItem("pausar_panel"); } catch (_) {}
      return Promise.resolve();
    }
    return chrome.storage.local.remove("panel");
  }
  function savePanel(p) {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      try { localStorage.setItem("pausar_panel", JSON.stringify(p)); } catch (_) {}
      return Promise.resolve();
    }
    return chrome.storage.local.set({ panel: p });
  }

  // ---------------------------------------------------------------- registro
  // log de pausas/retomadas em chrome.storage.local; serve para achar os cortes depois
  async function loadLog() {
    const d = await chrome.storage.local.get("log");
    return Array.isArray(d.log) ? d.log : [];
  }

  async function appendLog(evento, max) {
    const log = await loadLog();
    log.push(evento);
    const limite = max || 3000;
    if (log.length > limite) log.splice(0, log.length - limite);
    await chrome.storage.local.set({ log });
    return evento;
  }

  // corrige o ultimo evento (usado quando a medicao do cronometro chega depois)
  async function atualizarUltimoLog(patch) {
    const log = await loadLog();
    if (!log.length) return null;
    Object.assign(log[log.length - 1], patch);
    await chrome.storage.local.set({ log });
    return log[log.length - 1];
  }

  function clearLog() {
    return chrome.storage.local.remove(["log", "sessao"]);
  }

  // estado da gravação em curso, para calcular o timecode do arquivo final
  async function loadSessao() {
    const d = await chrome.storage.local.get("sessao");
    return d.sessao || null;
  }
  function saveSessao(s) {
    return chrome.storage.local.set({ sessao: s });
  }

  function onChange(cb) {
    chrome.storage.onChanged.addListener((mud, area) => {
      if (area === "sync" && mud.settings) cb({ settings: mud.settings.newValue || {} });
      if (area === "local" && mud.script) cb({ script: mud.script.newValue });
    });
  }

  // ------------------------------------------------------------------ atalhos
  const CODE_MAP = {
    Space: "Space", Enter: "Enter", NumpadEnter: "Enter", Escape: "Esc", Tab: "Tab",
    Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]",
    Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\",
    ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
    Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
    Insert: "Insert", Delete: "Del", Backspace: "Backspace",
    NumpadAdd: "Numpad+", NumpadSubtract: "Numpad-",
    NumpadMultiply: "Numpad*", NumpadDivide: "Numpad/"
  };

  function keyName(e) {
    const c = e.code || "";
    if (/^Key[A-Z]$/.test(c)) return c.slice(3);
    if (/^Digit[0-9]$/.test(c)) return c.slice(5);
    if (/^Numpad[0-9]$/.test(c)) return "Numpad" + c.slice(6);
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(c)) return c;
    if (CODE_MAP[c]) return CODE_MAP[c];
    const k = e.key;
    if (!k || ["Control", "Alt", "Shift", "Meta", "Dead", "Unidentified"].includes(k)) return null;
    return k.length === 1 ? k.toUpperCase() : k;
  }

  // nomes de tecla canônicos (o usuário/legado pode escrever de qualquer jeito)
  const CANON = {
    space: "Space", enter: "Enter", esc: "Esc", escape: "Esc", tab: "Tab",
    up: "Up", down: "Down", left: "Left", right: "Right",
    arrowup: "Up", arrowdown: "Down", arrowleft: "Left", arrowright: "Right",
    home: "Home", end: "End", pageup: "PageUp", pagedown: "PageDown",
    insert: "Insert", del: "Del", delete: "Del", backspace: "Backspace"
  };

  function canon(tecla) {
    if (!tecla) return "";
    const b = tecla.toLowerCase();
    if (CANON[b]) return CANON[b];
    if (/^f([1-9]|1[0-9]|2[0-4])$/.test(b)) return b.toUpperCase();
    if (b.length === 1) return b.toUpperCase();
    return tecla;
  }

  // "ctrl + space" -> "Ctrl+Space"
  function normalize(combo) {
    if (!combo) return "";
    const partes = String(combo).split("+").map((p) => p.trim()).filter(Boolean);
    const mods = new Set();
    let tecla = "";
    for (const p of partes) {
      const b = p.toLowerCase();
      if (b === "ctrl" || b === "control") mods.add("Ctrl");
      else if (b === "alt" || b === "option") mods.add("Alt");
      else if (b === "shift") mods.add("Shift");
      else if (b === "meta" || b === "cmd" || b === "command" || b === "win") mods.add("Meta");
      else tecla = canon(p);
    }
    const ordem = ["Ctrl", "Alt", "Shift", "Meta"].filter((m) => mods.has(m));
    return [...ordem, tecla].filter(Boolean).join("+");
  }

  function comboFromEvent(e) {
    const k = keyName(e);
    if (!k) return null;
    const p = [];
    if (e.ctrlKey) p.push("Ctrl");
    if (e.altKey) p.push("Alt");
    if (e.shiftKey) p.push("Shift");
    if (e.metaKey) p.push("Meta");
    p.push(k);
    return p.join("+");
  }

  function matches(e, combo) {
    if (!combo) return false;
    const atual = comboFromEvent(e);
    return !!atual && atual.toLowerCase() === normalize(combo).toLowerCase();
  }

  function bonito(combo) {
    return normalize(combo).replace(/Space/g, "Espaço").replace(/\+/g, " + ");
  }

  // ------------------------------------------------------------------ util
  function fontStack(nome) {
    switch (nome) {
      case "serif": return 'Georgia, "Times New Roman", serif';
      case "mono": return 'ui-monospace, "Cascadia Mono", Consolas, monospace';
      case "condensed": return '"Arial Narrow", "Roboto Condensed", "Liberation Sans Narrow", system-ui, sans-serif';
      default: return 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    }
  }

  function hexParaRgba(hex, alpha) {
    const h = String(hex || "#000000").replace("#", "");
    const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(n.slice(0, 2), 16) || 0;
    const g = parseInt(n.slice(2, 4), 16) || 0;
    const b = parseInt(n.slice(4, 6), 16) || 0;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  // "12:34" ou "01:02:03" -> segundos (null se nao for timecode)
  function timecodeParaSeg(tc) {
    const m = /^(?:([0-9]{1,2}):)?([0-9]{1,2}):([0-9]{2})$/.exec(String(tc || "").trim());
    if (!m) return null;
    const h = m[1] ? parseInt(m[1], 10) : 0;
    return h * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
  }

  // 0 -> "00:00:00"
  function hhmmss(seg) {
    if (!isFinite(seg) || seg < 0) seg = 0;
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = Math.floor(seg % 60);
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  }

  function mmss(seg) {
    if (!isFinite(seg) || seg < 0) seg = 0;
    const m = Math.floor(seg / 60);
    const s = Math.floor(seg % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  window.PausarExt = {
    DEFAULTS, PANEL_DEFAULT, SCRIPT_DEFAULT,
    loadSettings, saveSettings, saveSettingsDebounced, resetSettings,
    loadScript, saveScript, loadPanel, savePanel, resetPanel, onChange,
    loadLog, appendLog, atualizarUltimoLog, clearLog, loadSessao, saveSessao,
    comboFromEvent, matches, normalize, bonito, keyName,
    fontStack, hexParaRgba, mmss, hhmmss, timecodeParaSeg
  };
})();
