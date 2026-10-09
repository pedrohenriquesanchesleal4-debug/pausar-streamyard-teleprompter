// pages/prompter-page.js — teleprompter em janela separada (segundo monitor / tablet).
const P = window.PausarExt;
let cfg = {};
let prompter = null;

(async function iniciar() {
  cfg = await P.loadSettings();
  prompter = P.createPrompter({ mode: "page", container: document.getElementById("palco") });
  await prompter.montar();

  P.onChange(({ settings }) => { if (settings) cfg = Object.assign({}, P.DEFAULTS, settings); });

  // um toggle por gesto: atalho global e repasse podem chegar juntos
  let ultimoAlternar = 0;
  function alternarUmaVez() {
    const t = Date.now();
    if (t - ultimoAlternar < 400) return;
    ultimoAlternar = t;
    prompter.alternar();
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || !prompter) return;
      if (msg.action === "toggle-pause") alternarUmaVez();
      else if (msg.action === "prompter-cmd" && msg.cmd === "alternar") alternarUmaVez();
      else if (msg.action === "prompter-cmd" && typeof prompter[msg.cmd] === "function") prompter[msg.cmd](msg.val);
    });
  }

  async function avisarStreamYard(msg) {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) return;
    try {
      const abas = await chrome.tabs.query({ url: "*://*.streamyard.com/*" });
      for (const a of abas) chrome.tabs.sendMessage(a.id, msg).catch(() => {});
    } catch (_) {}
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const dentroDoEditor = e.composedPath().some((n) => n && n.tagName === "TEXTAREA");
    if (dentroDoEditor && e.key !== "Escape") return;

    if (P.matches(e, cfg.hotkeyAll)) {
      e.preventDefault();
      alternarUmaVez();
      // pausa a gravação lá no StreamYard também
      avisarStreamYard({ action: "toggle-pause-somente-gravacao" });
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
})();
