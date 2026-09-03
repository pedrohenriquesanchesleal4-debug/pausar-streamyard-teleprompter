// src/content-teleprompter.js — suporte ao teleprompter.works (quem já usa o site de fora).
// O mesmo atalho pausa o site e avisa o StreamYard.
(function () {
  if (window.__pausarExtTW) return;
  window.__pausarExtTW = true;

  const P = window.PausarExt;
  let cfg = Object.assign({}, P.DEFAULTS);
  let ocupado = false;

  const TERMOS = /pausar|pause|retomar|resume|play|iniciar|start|parar|stop/i;

  function visivel(el) {
    const r = el.getBoundingClientRect();
    return r.width > 6 && r.height > 6 && getComputedStyle(el).visibility !== "hidden";
  }

  async function pausarSite() {
    if (cfg.teleprompterSelector) {
      let el = null;
      try { el = document.querySelector(cfg.teleprompterSelector); } catch (_) {}
      if (el && visivel(el)) { el.click(); return "seletor"; }
    }

    const alvo = Array.from(document.querySelectorAll('button, [role="button"]')).find((el) => {
      if (!visivel(el)) return false;
      const t = [el.getAttribute("aria-label"), el.getAttribute("title"), el.textContent].join(" ");
      return TERMOS.test(t);
    });
    if (alvo) { alvo.click(); return "botão"; }

    // último recurso: a maioria dos teleprompters usa a barra de espaço
    for (const tipo of ["keydown", "keyup"]) {
      document.body.dispatchEvent(new KeyboardEvent(tipo, {
        key: " ", code: "Space", keyCode: 32, which: 32, bubbles: true, cancelable: true
      }));
    }
    return "tecla espaço";
  }

  async function executar(repassar) {
    if (ocupado) return;
    ocupado = true;
    setTimeout(() => { ocupado = false; }, 400);
    const via = await pausarSite();
    console.log("[Pausar Ext] teleprompter.works pausado/retomado via " + via);
    if (repassar) chrome.runtime.sendMessage({ action: "relay-pause", origem: "teleprompter" }).catch(() => {});
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (P.matches(e, cfg.hotkeyAll) || P.matches(e, cfg.hotkeyPrompter)) {
      e.preventDefault();
      e.stopPropagation();
      executar(true);
    }
  }, true);

  chrome.runtime.onMessage.addListener((msg, _s, resposta) => {
    if (!msg || !msg.action) return;
    if (msg.action === "toggle-pause" || (msg.action === "prompter-cmd" && msg.cmd === "alternar")) {
      executar(false);
    } else if (msg.action === "status") {
      resposta({ site: "teleprompter.works", hotkey: cfg.hotkeyAll });
      return true;
    }
  });

  (async function iniciar() {
    cfg = await P.loadSettings();
    P.onChange(({ settings }) => { if (settings) cfg = Object.assign({}, P.DEFAULTS, settings); });
  })();
})();
