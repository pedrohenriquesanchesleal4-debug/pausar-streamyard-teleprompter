// pages/options.js — tela de ajustes (salva na hora, com prévia ao vivo).
const P = window.PausarExt;
let cfg = {};
let capturando = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// nas vistas recortadas do painel lateral alguns blocos não existem
function liga(sel, evento, fn) {
  const el = $(sel);
  if (el) el.addEventListener(evento, fn);
}

function avisarSalvo() {
  const el = $("#salvo");
  el.classList.add("on");
  clearTimeout(avisarSalvo._id);
  avisarSalvo._id = setTimeout(() => el.classList.remove("on"), 900);
}

// -------------------------------------------------------------------- campos
function pintarCampos() {
  $$("[data-s]").forEach((el) => {
    const k = el.dataset.s;
    if (!(k in cfg)) return;
    if (el.type === "checkbox") el.checked = !!cfg[k];
    else el.value = cfg[k];
  });
  $$("[data-o]").forEach((o) => {
    const k = o.dataset.o;
    const v = cfg[k];
    o.textContent = k === "bgOpacity" ? Math.round(v * 100) + "%"
      : k === "lineHeight" ? Number(v).toFixed(2)
      : k === "width" || k === "guidePos" ? v + "%"
      : k === "fontSize" ? v + "px"
      : k === "speed" ? v + " px/s"
      : v;
  });
  $$("[data-hotkey]").forEach((b) => {
    const v = cfg[b.dataset.hotkey];
    b.textContent = v ? P.bonito(v) : "— sem atalho —";
  });
}

document.addEventListener("input", async (e) => {
  const el = e.target.closest("[data-s]");
  if (!el) return;
  const k = el.dataset.s;
  let v;
  if (el.type === "checkbox") v = el.checked;
  else if (el.type === "number" || el.type === "range") v = parseFloat(el.value);
  else v = el.value;
  if (el.type === "number" && isNaN(v)) return;
  cfg[k] = v;
  pintarCampos();
  P.saveSettingsDebounced({ [k]: v });
  avisarSalvo();
});

// -------------------------------------------------------------------- atalhos
document.addEventListener("click", (e) => {
  const cap = e.target.closest("[data-hotkey]");
  if (cap) {
    if (capturando) capturando.classList.remove("ouvindo");
    capturando = cap;
    cap.classList.add("ouvindo");
    cap.textContent = "aperte a combinação…";
    return;
  }
  const limpar = e.target.closest("[data-limpar]");
  if (limpar) {
    const k = limpar.dataset.limpar;
    cfg[k] = "";
    P.saveSettings({ [k]: "" }).then(avisarSalvo);
    pintarCampos();
  }
});

window.addEventListener("keydown", async (e) => {
  if (!capturando) return;
  if (e.key === "Escape") {
    capturando.classList.remove("ouvindo");
    capturando = null;
    pintarCampos();
    return;
  }
  const combo = P.comboFromEvent(e);
  if (!combo) return;
  e.preventDefault();
  e.stopPropagation();
  const k = capturando.dataset.hotkey;
  cfg[k] = combo;
  await P.saveSettings({ [k]: combo });
  capturando.classList.remove("ouvindo");
  capturando = null;
  pintarCampos();
  avisarSalvo();
}, true);

// -------------------------------------------------------------------- roteiro
const area = $("#roteiro");
let salvarId = 0;

function infoRoteiro() {
  if (!area) return;
  const t = area.value;
  const palavras = (t.trim().match(/\S+/g) || []).length;
  $("#infoRoteiro").textContent =
    palavras + " palavras · " + t.length + " caracteres · ~" + P.mmss((palavras / 150) * 60) + " falando a 150 palavras/min";
}

if (area) {
  area.addEventListener("input", () => {
    infoRoteiro();
    clearTimeout(salvarId);
    salvarId = setTimeout(async () => {
      await P.saveScript(area.value);
      avisarSalvo();
    }, 400);
  });
}

liga("#importar", "click", () => $("#arquivo").click());
liga("#arquivo", "change", async () => {
  const f = $("#arquivo").files[0];
  if (!f) return;
  area.value = await f.text();
  infoRoteiro();
  await P.saveScript(area.value);
  avisarSalvo();
  $("#arquivo").value = "";
});
liga("#limparRoteiro", "click", async () => {
  area.value = "";
  infoRoteiro();
  await P.saveScript("");
  avisarSalvo();
});

// -------------------------------------------------------------------- StreamYard
liga("#testarSy", "click", async () => {
  const sel = (cfg.streamyardSelector || "").trim();
  const msg = $("#msgSy");
  if (!sel) {
    msg.className = "dica err";
    msg.textContent = "Escreva um seletor (ou use o 🎯 dentro do StreamYard).";
    return;
  }
  const abas = await chrome.tabs.query({ url: "*://*.streamyard.com/*" });
  if (!abas.length) {
    msg.className = "dica err";
    msg.textContent = "Nenhuma aba do StreamYard aberta.";
    return;
  }
  const r = await chrome.tabs.sendMessage(abas[0].id, { action: "testar-seletor", sel }, { frameId: 0 }).catch(() => null);
  msg.className = "dica " + (r && r.ok ? "ok" : "err");
  msg.textContent = r ? r.msg : "A aba do StreamYard precisa ser recarregada (F5) depois de instalar/atualizar a extensão.";
});

// -------------------------------------------------------------------- registro de pausas
const QUEBRA = String.fromCharCode(10);
const ROTULO = { pausa: "⏸ pausa", retomada: "▶ retomada", inicio: "● início", marcador: "🚩 marcador" };

function escapaHtml(t) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function pintarLog() {
  const alvo = $("#logTabela");
  if (!alvo) return;
  const log = await P.loadLog();
  if (!log.length) {
    alvo.innerHTML = '<div class="dica">Nada registrado ainda. Pause a gravação uma vez que aparece aqui.</div>';
    $("#logMsg").textContent = "";
    return;
  }

  const sessoes = new Set(log.map((e) => e.sessao));
  $("#logMsg").textContent = log.length + " eventos · " + sessoes.size + " sessão(ões)";

  const cab = ["evento", "timecode", "hora", "pausa durou", "botão", "linha do roteiro"];
  const linhas = log.slice().reverse().map((e) => {
    const tc = escapaHtml(e.timecode || "") + (e.timecodeAproximado ? " ~" : "");
    return '<tr class="' + escapaHtml(e.tipo) + '">' +
      "<td>" + (ROTULO[e.tipo] || escapaHtml(e.tipo)) + "</td>" +
      '<td><code class="tc">' + tc + "</code></td>" +
      "<td>" + escapaHtml(e.hora || "") + "</td>" +
      "<td>" + (e.duracaoPausa != null ? e.duracaoPausa + " s" : "") + "</td>" +
      "<td>" + escapaHtml(e.botao || "") + "</td>" +
      '<td class="linha">' + escapaHtml((e.roteiro && e.roteiro.linha) || "") + "</td>" +
      "</tr>";
  });

  alvo.innerHTML = '<table class="log"><thead><tr>' +
    cab.map((c) => "<th>" + c + "</th>").join("") +
    "</tr></thead><tbody>" + linhas.join("") + "</tbody></table>";
}

function baixar(nome, texto, tipoMime) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipoMime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function nomeArquivo(ext) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return "pausas-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
    "-" + p(d.getHours()) + p(d.getMinutes()) + "." + ext;
}

async function logComoJson() {
  const log = await P.loadLog();
  const sessoes = {};
  for (const e of log) (sessoes[e.sessao] = sessoes[e.sessao] || []).push(e);

  return JSON.stringify({
    geradoEm: new Date().toISOString(),
    extensao: chrome.runtime.getManifest().version,
    observacao: "timecode = posicao no arquivo gravado (a gravacao nao avanca enquanto pausada). " +
      "timecodeAproximado = calculado pela extensao, sem ler o cronometro do StreamYard.",
    totalEventos: log.length,
    sessoes: Object.keys(sessoes).map((id) => ({
      sessao: id,
      eventos: sessoes[id],
      pausas: sessoes[id].filter((e) => e.tipo === "pausa").length,
      marcadores: sessoes[id].filter((e) => e.tipo === "marcador").map((e) => e.timecode)
    }))
  }, null, 2);
}

async function logComoCsv() {
  const log = await P.loadLog();
  const cols = ["sessao", "tipo", "timecode", "tGravado", "timecodeAproximado", "hora", "iso",
    "duracaoPausa", "botao", "linhaRoteiro"];
  const celula = (v) => {
    const t = v == null ? "" : String(v);
    return /[",;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  const linhas = [cols.join(";")];
  for (const e of log) {
    linhas.push([
      e.sessao, e.tipo, e.timecode, e.tGravado, e.timecodeAproximado ? "sim" : "nao",
      e.hora, e.iso, e.duracaoPausa != null ? e.duracaoPausa : "",
      e.botao, (e.roteiro && e.roteiro.linha) || ""
    ].map(celula).join(";"));
  }
  return linhas.join(QUEBRA);
}

liga("#logAtualizar", "click", pintarLog);
liga("#logJson", "click", async () => {
  baixar(nomeArquivo("json"), await logComoJson(), "application/json");
});
liga("#logCsv", "click", async () => {
  baixar(nomeArquivo("csv"), await logComoCsv(), "text/csv");
});
liga("#logCopiar", "click", async () => {
  await navigator.clipboard.writeText(await logComoJson());
  $("#logMsg").textContent = "JSON copiado.";
});
liga("#logLimpar", "click", async () => {
  if (!confirm("Apagar todo o registro de pausas?")) return;
  await P.clearLog();
  pintarLog();
});

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-timer]");
  if (!b) return;
  const v = parseInt(b.dataset.timer, 10);
  cfg.countdown = v;
  pintarCampos();
  P.saveSettings({ countdown: v }).then(avisarSalvo);
});

// -------------------------------------------------------------------- diagnóstico

async function diagnostico() {
  if (!$("#diag")) return;
  const m = chrome.runtime.getManifest();
  const linhas = ["Extensão: " + m.name + " v" + m.version];

  const cmds = await chrome.commands.getAll().catch(() => []);
  linhas.push("", "Atalhos globais do Chrome:");
  for (const c of cmds) {
    linhas.push("  " + c.name + ": " + (c.shortcut ? c.shortcut : "(não atribuído — conflito com outra extensão?)"));
  }

  const abertas = await chrome.tabs.query({ url: ["*://*.streamyard.com/*", "*://*.teleprompter.works/*"] });
  linhas.push("", "Abas do StreamYard/teleprompter.works: " + abertas.length);
  const r = await chrome.runtime.sendMessage({ action: "status-abas" }).catch(() => null);
  const responderam = new Map(((r && r.abas) || []).map((a) => [a.tabId, a]));
  for (const a of abertas) {
    const st = responderam.get(a.id);
    if (!st) {
      linhas.push("  ✗ " + a.url);
      linhas.push("     content script NÃO respondeu → clique em “Reconectar nas abas abertas”");
    } else {
      linhas.push("  ✓ " + a.url);
      if (st.site === "streamyard") {
        linhas.push("     no estúdio: " + (st.noEstudio ? "sim" : "não (esta tela não tem gravação)"));
        linhas.push("     botão de gravação: " + (st.botaoOk ? "localizado" : "NÃO localizado → use o 🎯 na barrinha"));
        linhas.push("     cronômetro da gravação: " + (st.timerOk
          ? "identificado (timecode exato no log)"
          : "não identificado ainda → o log calcula o timecode e marca como aproximado"));
        linhas.push("     teleprompter: " + (st.visivel ? (st.tocando ? "rolando" : "pausado") : "escondido"));
      }
    }
  }
  linhas.push("", "Atalho na página: " + P.bonito(cfg.hotkeyAll) +
    " | pausar gravação junto: " + (cfg.pauseRecording ? "sim" : "não"));
  $("#diag").textContent = linhas.join(QUEBRA);
}

liga("#diagBtn", "click", diagnostico);
liga("#reinjetar", "click", async () => {
  const r = await chrome.runtime.sendMessage({ action: "reinjetar" }).catch(() => null);
  const lista = (r && r.abas) || [];
  $("#diag").textContent = lista.length
    ? ["Reconectado:"].concat(
        lista.map((a) => (a.ok ? "  ✓ " : "  ✗ ") + a.url + (a.erro ? " — " + a.erro : ""))
      ).join(QUEBRA)
    : "Nenhuma aba do StreamYard/teleprompter.works aberta.";
  setTimeout(diagnostico, 400);
});

liga("#atalhosChrome", "click", () => chrome.runtime.sendMessage({ action: "atalhos-chrome" }));
liga("#janela", "click", () => chrome.runtime.sendMessage({ action: "abrir-janela-prompter" }));
liga("#abrirSy", "click", () => chrome.runtime.sendMessage({ action: "abrir-streamyard" }));
liga("#resetPainel", "click", async () => {
  await P.resetPanel();
  await P.saveSettings({ fullscreen: false, overlayVisible: true });
  $("#msgSy").className = "dica ok";
  $("#msgSy").textContent = "Painel restaurado — dê F5 na aba do StreamYard.";
  avisarSalvo();
});

liga("#reset", "click", async () => {
  if (!confirm("Restaurar todos os ajustes padrão? (o roteiro não é apagado)")) return;
  cfg = await P.resetSettings();
  pintarCampos();
  avisarSalvo();
});

// -------------------------------------------------------------------- início
// ?vista=ajustes|log deixa esta mesma página servir como aba do painel lateral
const VISTA = new URLSearchParams(location.search).get("vista");

function aplicarVista() {
  if (!VISTA) return;
  document.body.classList.add("embutido");
  $$("section").forEach((sec) => {
    if (sec.dataset.vista !== VISTA) sec.remove();
  });
}

(async function iniciar() {
  aplicarVista();
  cfg = await P.loadSettings();
  if (area) area.value = await P.loadScript();
  pintarCampos();
  infoRoteiro();

  if ($("#preview")) {
    const previa = P.createPrompter({ mode: "page", container: $("#preview") });
    await previa.montar();
  }

  pintarLog();
  // o log vive em storage.local: se uma pausa acontecer com esta tela aberta, redesenha
  chrome.storage.onChanged.addListener((mud, area) => {
    if (area === "local" && mud.log) pintarLog();
  });

  P.onChange(({ settings }) => {
    if (settings) {
      cfg = Object.assign({}, P.DEFAULTS, settings);
      if (!capturando) pintarCampos();
    }
  });
})();
