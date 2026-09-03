// pages/sidepanel.js — teleprompter no painel lateral do Chrome (Side Panel API).
const P = window.PausarExt;
const $ = (s) => document.querySelector(s);
let cfg = {};
let prompter = null;

const PADROES = ["*://*.streamyard.com/*", "*://*.teleprompter.works/*"];

async function paraTodas(msg) {
  const abas = await chrome.tabs.query({ url: PADROES });
  for (const a of abas) chrome.tabs.sendMessage(a.id, msg).catch(() => {});
  return abas.length;
}

function dizer(t) {
  $("#msg").textContent = t || "";
  clearTimeout(dizer._id);
  if (t) dizer._id = setTimeout(() => { $("#msg").textContent = ""; }, 6000);
}

// ------------------------------------------------------------------ status
async function atualizarStatus(podeReinjetar) {
  const r = await chrome.runtime.sendMessage({ action: "status-abas" }).catch(() => null);
  const lista = (r && r.abas) || [];
  const sy = lista.find((a) => a.site === "streamyard");
  const dot = $("#dot");
  const est = $("#est");

  // aba aberta mas sem responder = content script ausente (extensão recém-atualizada):
  // reinjeta na hora, sem pedir F5
  if (!lista.length && podeReinjetar !== false) {
    const abertas = await chrome.tabs.query({ url: PADROES }).catch(() => []);
    if (abertas.length) {
      est.textContent = "conectando à aba do StreamYard…";
      await chrome.runtime.sendMessage({ action: "reinjetar" }).catch(() => {});
      return atualizarStatus(false);
    }
  }

  if (!sy) {
    dot.className = "dot err";
    est.textContent = lista.length ? "teleprompter.works conectado" : "StreamYard não está aberto";
  } else if (!sy.noEstudio) {
    dot.className = "dot err";
    est.textContent = "StreamYard fora do estúdio";
    est.title = sy.url || "";
    dizer("Você está em " + (sy.url || "").replace(/^https?:\/\//, "") + " — entre num estúdio (Criar transmissão / Gravar) para eu pausar a gravação.");
  } else {
    dot.className = "dot " + (sy.botaoOk ? "ok" : "err");
    est.textContent = sy.botaoOk ? "StreamYard pronto" : "botão de gravação não encontrado";
    if (!sy.botaoOk) dizer("No StreamYard, clique no 🎯 da barrinha e depois no botão de gravação.");
  }
  $('[data-a="olho"]').classList.toggle("on", !!cfg.overlayVisible);
}

// ------------------------------------------------------------------ ações
$(".bar").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-a]");
  if (!b) return;
  switch (b.dataset.a) {
    case "tudo": {
      const n = await paraTodas({ action: "toggle-pause" });
      prompter.alternar();
      if (!n) dizer("Nenhuma aba do StreamYard aberta — rolando só aqui.");
      setTimeout(atualizarStatus, 250);
      break;
    }
    case "marcar": {
      const n = await paraTodas({ action: "marcar" });
      dizer(n ? "🚩 marcador anotado no log." : "Nenhuma aba do StreamYard aberta.");
      break;
    }
    case "aba":
      chrome.runtime.openOptionsPage();
      break;
    case "olho":
      cfg = await P.saveSettings({ overlayVisible: !cfg.overlayVisible });
      $('[data-a="olho"]').classList.toggle("on", !!cfg.overlayVisible);
      break;
    case "janela":
      chrome.runtime.sendMessage({ action: "abrir-janela-prompter" });
      break;
  }
});

// ------------------------------------------------------------------ abas
// Ajustes e Log são a própria página de opções embutida (?vista=...), então
// existe um só lugar de verdade para essas telas.
function trocarAba(nome) {
  document.querySelectorAll("[data-aba]").forEach((b) => b.classList.toggle("on", b.dataset.aba === nome));
  for (const vista of document.querySelectorAll(".vista")) {
    const ativa = vista.id === "v-" + nome;
    vista.hidden = !ativa;
    if (!ativa) continue;
    const frame = vista.querySelector("iframe");
    if (frame && !frame.src) frame.src = frame.dataset.src;   // carrega só quando abre
  }
}

document.querySelector(".abas").addEventListener("click", (e) => {
  const b = e.target.closest("[data-aba]");
  if (!b) return;
  trocarAba(b.dataset.aba);
  try { localStorage.setItem("aba", b.dataset.aba); } catch (_) {}
});

// ------------------------------------------------------------------ início
(async function iniciar() {
  cfg = await P.loadSettings();
  prompter = P.createPrompter({ mode: "page", container: $("#palco") });
  await prompter.montar();

  P.onChange(({ settings }) => {
    if (settings) {
      cfg = Object.assign({}, P.DEFAULTS, settings);
      $('[data-a="olho"]').classList.toggle("on", !!cfg.overlayVisible);
    }
  });

  // um toggle por gesto: atalho global e repasse podem chegar juntos
  let ultimoAlternar = 0;
  function alternarUmaVez() {
    const t = Date.now();
    if (t - ultimoAlternar < 400) return;
    ultimoAlternar = t;
    prompter.alternar();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !prompter) return;
    if (msg.action === "toggle-pause") alternarUmaVez();
    else if (msg.action === "prompter-cmd" && msg.cmd === "alternar") alternarUmaVez();
    else if (msg.action === "prompter-cmd" && typeof prompter[msg.cmd] === "function") prompter[msg.cmd](msg.val);
  });

  // atalhos com o painel em foco
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const digitando = e.composedPath().some((n) => n && n.tagName === "TEXTAREA");
    if (digitando && e.key !== "Escape") return;

    if (P.matches(e, cfg.hotkeyAll)) {
      e.preventDefault();
      alternarUmaVez();
      paraTodas({ action: "toggle-pause-somente-gravacao" });
    } else if (P.matches(e, cfg.hotkeyPrompter)) {
      e.preventDefault(); prompter.alternar();
    } else if (P.matches(e, cfg.hotkeyRestart)) {
      e.preventDefault(); prompter.reiniciar();
    } else if (P.matches(e, cfg.hotkeySpeedUp)) {
      e.preventDefault(); prompter.mudarVel(cfg.speedStep);
    } else if (P.matches(e, cfg.hotkeySpeedDown)) {
      e.preventDefault(); prompter.mudarVel(-cfg.speedStep);
    } else if (P.matches(e, cfg.hotkeyNudgeUp)) {
      e.preventDefault(); prompter.empurrar(-cfg.nudgePx);
    } else if (P.matches(e, cfg.hotkeyNudgeDown)) {
      e.preventDefault(); prompter.empurrar(cfg.nudgePx);
    } else if (P.matches(e, cfg.hotkeyFontUp)) {
      e.preventDefault(); prompter.mudarFonte(2);
    } else if (P.matches(e, cfg.hotkeyFontDown)) {
      e.preventDefault(); prompter.mudarFonte(-2);
    }
  }, true);

  try { trocarAba(localStorage.getItem("aba") || "prompter"); } catch (_) { trocarAba("prompter"); }
  $(".bar").title = "Pausar Ext v" + chrome.runtime.getManifest().version;
  atualizarStatus();
  dizer("⛶ = modo foco · Ctrl+↑/↓ empurra o roteiro · largura: arraste a borda do painel.");
  window.addEventListener("focus", () => atualizarStatus());
  chrome.tabs.onActivated.addListener(() => atualizarStatus());
  chrome.tabs.onUpdated.addListener((_id, info) => { if (info.status === "complete") atualizarStatus(); });
})();
