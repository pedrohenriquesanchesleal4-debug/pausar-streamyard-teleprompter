// src/background.js — service worker: atalhos globais do Chrome e repasse entre abas.
const ALVOS = ["*://*.streamyard.com/*", "*://*.teleprompter.works/*"];

async function abas(padroes) {
  try { return await chrome.tabs.query({ url: padroes || ALVOS }); } catch (_) { return []; }
}

function paraAba(id, msg, frameId) {
  const p = frameId === undefined
    ? chrome.tabs.sendMessage(id, msg)
    : chrome.tabs.sendMessage(id, msg, { frameId });
  return p.catch(() => {});
}

// manda para todas as abas do StreamYard/teleprompter.works e para as páginas da extensão.
// Só para o frame principal (frameId 0): se cada iframe também recebesse, o teleprompter
// alternava duas vezes e ficava parecendo que o atalho não fazia nada.
async function transmitir(msg, exceto) {
  for (const a of await abas()) {
    if (exceto && a.id === exceto) continue;
    paraAba(a.id, msg, 0);
  }
  chrome.runtime.sendMessage(msg).catch(() => {});
}

const SCRIPTS_SY = ["src/shared.js", "src/prompter.js", "src/streamyard-target.js", "src/content-streamyard.js"];
const SCRIPTS_TW = ["src/shared.js", "src/content-teleprompter.js"];

// injeta os content scripts nas abas ja abertas (depois de instalar/atualizar,
// ou quando a aba nao responde) — evita depender de F5
async function reinjetar() {
  const out = [];
  for (const a of await abas()) {
    const sy = /streamyard\.com/.test(a.url || "");
    try {
      await chrome.scripting.executeScript({
        target: { tabId: a.id, allFrames: true },
        files: sy ? SCRIPTS_SY : SCRIPTS_TW
      });
      out.push({ tabId: a.id, url: a.url, ok: true });
    } catch (e) {
      out.push({ tabId: a.id, url: a.url, ok: false, erro: String((e && e.message) || e) });
    }
  }
  return out;
}

// ------------------------------------------------------------------ painel lateral
// clicar no ícone da extensão abre o painel lateral
async function ligarPainelNoIcone() {
  try { await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); } catch (_) {}
}
chrome.runtime.onInstalled.addListener(ligarPainelNoIcone);
chrome.runtime.onStartup.addListener(ligarPainelNoIcone);
ligarPainelNoIcone();

async function abrirPainel(tabId) {
  try {
    if (tabId !== undefined) await chrome.sidePanel.open({ tabId });
    else {
      const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (aba) await chrome.sidePanel.open({ tabId: aba.id });
    }
    return { ok: true };
  } catch (e) {
    // open() exige gesto do usuário; se falhar, o clique no ícone resolve
    return { ok: false, msg: "Clique no ícone da extensão para abrir o painel lateral." };
  }
}

// ------------------------------------------------------------------ atalhos do Chrome
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "toggle-pause") transmitir({ action: "toggle-pause" });
  else if (cmd === "toggle-prompter") transmitir({ action: "prompter-cmd", cmd: "alternar" });
  else if (cmd === "toggle-overlay") transmitir({ action: "prompter-cmd", cmd: "alternarVisivel" });
  else if (cmd === "restart-prompter") transmitir({ action: "prompter-cmd", cmd: "reiniciar" });
  else if (cmd === "abrir-painel") abrirPainel();
});

// ------------------------------------------------------------------ mensagens
chrome.runtime.onMessage.addListener((msg, sender, resposta) => {
  if (!msg || !msg.action) return;

  switch (msg.action) {
    // um content script já se pausou: repassa para o "outro lado"
    case "relay-pause": {
      const idOrigem = sender.tab ? sender.tab.id : null;
      const padrao = msg.origem === "streamyard" ? ["*://*.teleprompter.works/*"] : ["*://*.streamyard.com/*"];
      abas(padrao).then((lista) => lista.forEach((a) => { if (a.id !== idOrigem) paraAba(a.id, { action: "toggle-pause" }, 0); }));
      // outras abas do mesmo site (ex: dois estúdios abertos) ficam de fora para não desfazer o toggle
      chrome.runtime.sendMessage({ action: "prompter-cmd", cmd: "alternar" }).catch(() => {});
      break;
    }

    // vindo de um iframe: executa no frame principal da mesma aba
    case "prompter-cmd": {
      if (msg.escopo === "topo" && sender.tab) {
        paraAba(sender.tab.id, { action: "prompter-cmd", cmd: msg.cmd, val: msg.val }, 0);
      } else if (msg.escopo === "tudo") {
        transmitir({ action: "prompter-cmd", cmd: msg.cmd, val: msg.val });
      }
      break;
    }

    case "abrir-opcoes":
      chrome.runtime.openOptionsPage();
      break;

    case "reinjetar":
      reinjetar().then((r) => resposta({ abas: r }));
      return true;

    case "abrir-painel":
      abrirPainel(sender.tab ? sender.tab.id : undefined).then(resposta);
      return true;

    case "abrir-janela-prompter":
      chrome.windows.create({
        url: chrome.runtime.getURL("pages/prompter.html"),
        type: "popup",
        width: 760,
        height: 520
      });
      break;

    case "abrir-streamyard":
      chrome.tabs.create({ url: "https://streamyard.com/" });
      break;

    case "atalhos-chrome":
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
      break;

    case "status-abas": {
      abas().then(async (lista) => {
        const out = [];
        for (const a of lista) {
          const r = await chrome.tabs.sendMessage(a.id, { action: "status" }, { frameId: 0 }).catch(() => null);
          if (r) out.push(Object.assign({ tabId: a.id, title: a.title }, r));
        }
        resposta({ abas: out });
      });
      return true;
    }
  }
});

async function migrarAjustes() {
  try {
    const d = await chrome.storage.sync.get("settings");
    if (d.settings && d.settings.countdownOnResume === undefined) {
      d.settings.countdown = 5;
      d.settings.countdownOnResume = true;
      await chrome.storage.sync.set({ settings: d.settings });
    }
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener((d) => {
  migrarAjustes();
  reinjetar();
  if (d.reason === "install") chrome.runtime.openOptionsPage();
});
