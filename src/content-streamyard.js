// src/content-streamyard.js — cola tudo dentro do StreamYard:
// teleprompter em overlay, barrinha de status e os atalhos de teclado.
(function () {
  // pode ser reinjetado (chrome.scripting) sem F5: se ja rodou neste frame, sai
  if (window.__pausarExtSY) return;
  window.__pausarExtSY = true;

  const P = window.PausarExt;
  const noTopo = window.top === window;
  const VERSAO = chrome.runtime.getManifest().version;
  // botao de gravacao so existe dentro do estudio
  const NO_ESTUDIO = /[/](studio|broadcast|record|room)/i.test(location.pathname);
  let cfg = Object.assign({}, P.DEFAULTS);
  let prompter = null;
  let ocupado = false;

  // ------------------------------------------------------------------ barrinha
  const PILL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.pill {
  position: fixed; left: 12px; bottom: 12px; z-index: 2147483645;
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap; max-width: min(96vw, 640px);
  background: rgba(17,20,26,.92); color: #fff; border: 1px solid rgba(255,255,255,.16);
  border-radius: 999px; padding: 6px 10px; font-size: 12px;
  box-shadow: 0 8px 26px rgba(0,0,0,.45); backdrop-filter: blur(3px);
}
.pill.min { border-radius: 50%; padding: 0; width: 34px; height: 34px; justify-content: center; cursor: pointer; }
.pill.min > *:not(.mini) { display: none; }
.mini { display: none; font-size: 15px; }
.pill.min .mini { display: block; }
b { font-weight: 700; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #64748b; flex: 0 0 auto; }
.dot.ok { background: #22c55e; }
.dot.err { background: #ef4444; }
button {
  background: rgba(255,255,255,.1); color: #fff; border: 1px solid rgba(255,255,255,.18);
  border-radius: 999px; padding: 4px 9px; cursor: pointer; font-size: 12px;
}
button:hover { background: rgba(255,255,255,.2); }
button.main { background: #b45309; border-color: #f59e0b; font-weight: 700; }
button.on { background: #2563eb; border-color: #3b82f6; }
.kbd {
  border: 1px solid rgba(255,255,255,.3); border-radius: 6px; padding: 2px 6px;
  font: 600 11px ui-monospace, Consolas, monospace; color: #e2e8f0; white-space: nowrap;
}
.msg { color: #cbd5e1; font-size: 11px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

  const PILL_HTML = `
<div class="pill">
  <span class="mini">⏸</span>
  <span class="dot"></span>
  <b class="marca">Pausar</b>
  <button class="main" data-a="tudo">⏸ Pausar tudo</button>
  <span class="kbd"></span>
  <button data-a="tp" title="Mostrar/esconder teleprompter">Teleprompter</button>
  <button data-a="painel" title="Abrir no painel lateral do Chrome">🗔</button>
  <button data-a="editar" title="Editar roteiro">✎</button>
  <button data-a="marcar" title="Marcar este momento no log (corta aqui)">🚩</button>
  <button data-a="learn" title="Escolher na mão o botão de gravação">🎯</button>
  <button data-a="opts" title="Ajustes">⚙</button>
  <button data-a="min" title="Encolher">–</button>
  <span class="msg"></span>
</div>`;

  let raizPill = null;

  function criarPill() {
    const host = document.createElement("div");
    host.id = "pausar-ext-pill";
    raizPill = host.attachShadow({ mode: "open" });
    const st = document.createElement("style");
    st.textContent = PILL_CSS;
    const w = document.createElement("div");
    w.innerHTML = PILL_HTML;
    raizPill.append(st, w);
    document.documentElement.appendChild(host);

    const pill = raizPill.querySelector(".pill");

    raizPill.addEventListener("click", (e) => {
      if (pill.classList.contains("min")) { pill.classList.remove("min"); return; }
      const b = e.target.closest("[data-a]");
      if (!b) return;
      switch (b.dataset.a) {
        case "tudo": executar(true); break;
        case "tp": prompter && prompter.alternarVisivel(); atualizarPill(); break;
        case "editar": prompter && (prompter.mostrar(), prompter.abrirEditor()); break;
        case "marcar": marcar(); break;
        case "learn":
          P.streamyard.aprender(async (sel, alt) => {
            if (!sel) return dizer("Cancelado.");
            await P.saveSettings({ streamyardSelector: sel, streamyardSelectorAlt: alt || "" });
            cfg.streamyardSelector = sel;
            cfg.streamyardSelectorAlt = alt || "";
            dizer("Botão salvo: " + sel);
            verificarBotao();
          });
          break;
        case "painel":
          chrome.runtime.sendMessage({ action: "abrir-painel" })
            .then((r) => { if (r && !r.ok) dizer(r.msg); })
            .catch(() => dizer("Clique no ícone da extensão para abrir o painel lateral."));
          break;
        case "opts": chrome.runtime.sendMessage({ action: "abrir-opcoes" }).catch(() => {}); break;
        case "min": pill.classList.add("min"); break;
      }
    });

    raizPill.querySelector(".marca").title = "Pausar Ext v" + VERSAO;
    atualizarPill();
    setTimeout(verificarBotao, 2500);
  }

  function atualizarPill() {
    if (!raizPill) return;
    raizPill.querySelector(".kbd").textContent = P.bonito(cfg.hotkeyAll);
    const btnTp = raizPill.querySelector('[data-a="tp"]');
    btnTp.classList.toggle("on", !!(prompter && prompter.visivel));
  }

  function dizer(t) {
    if (!raizPill) return;
    const m = raizPill.querySelector(".msg");
    m.textContent = t;
    clearTimeout(dizer._id);
    dizer._id = setTimeout(() => { m.textContent = ""; }, 6000);
  }

  function verificarBotao() {
    if (!raizPill) return;
    const dot = raizPill.querySelector(".dot");
    const achou = botaoLocalizado();
    dot.classList.toggle("ok", achou);
    dot.classList.toggle("err", !achou);
    dot.title = achou
      ? "Botão de gravação localizado"
      : NO_ESTUDIO
        ? "Não achei o botão de gravação — use o 🎯 para clicar nele uma vez"
        : "Esta tela do StreamYard não tem gravação; entre em um estúdio";
    if (achou) return;
    dizer(NO_ESTUDIO
      ? "Não achei o botão de gravação. Clique no 🎯 e depois no botão real."
      : "Você não está num estúdio (" + location.pathname + "). Abra uma transmissão/gravação para eu achar o botão.");
  }

  // ------------------------------------------------------------------ ação
  // atalho global do Chrome + tecla na página + repasse podem chegar quase juntos:
  // um toggle por gesto (250 ms) para o teleprompter não alternar duas vezes
  let ultimoAlternar = 0;
  function alternarPrompter() {
    const t = Date.now();
    if (t - ultimoAlternar < 400) {
      console.log("[Pausar Ext] toggle duplicado ignorado (" + (t - ultimoAlternar) + "ms)");
      return;
    }
    ultimoAlternar = t;
    console.log("[Pausar Ext] toggle do teleprompter", noTopo ? "(frame principal)" : "(iframe -> repassa)");
    if (noTopo && prompter) prompter.alternar();
    else chrome.runtime.sendMessage({ action: "prompter-cmd", cmd: "alternar", escopo: "topo" }).catch(() => {});
    atualizarPill();
  }

  function botaoLocalizado() {
    if (cfg.streamyardSelector) {
      try { if (document.querySelector(cfg.streamyardSelector)) return true; } catch (_) {}
    }
    return !!P.streamyard.acharBotao();
  }

  async function clicarGravacao() {
    const r = await P.streamyard.pausarGravacao(cfg);
    if (r.ok) dizer("Gravação: cliquei em “" + (r.label || "?") + "” (" + r.via + ")");
    else dizer("Não achei o botão de gravação — use o 🎯.");
    registrarPausa(r);
    return r;
  }

  // marcador manual: "corta aqui" sem parar nada
  function marcar(nota) {
    return registrarPausa({
      ok: true,
      label: "marcador",
      antes: "marcador",
      estadoAntes: "marcador",
      timecode: P.streamyard.lerTimecode(),
      nota: nota || ""
    });
  }

  // ------------------------------------------------------------------ registro
  // Anota cada pausa/retomada com o timecode da gravação — é o que se usa depois
  // para achar os cortes. Timecode vem do cronômetro do StreamYard quando dá para
  // ler; senão é calculado somando o tempo em que a gravação ficou rodando.
  const GAP_SESSAO = 4 * 60 * 60 * 1000;

  async function registrarPausa(r) {
    if (!cfg.logPauses || !r || !r.ok) return;
    const agora = Date.now();
    const tcSeg = P.timecodeParaSeg(r.timecode);

    let s = await P.loadSessao();
    if (s && agora - (s.ultimo || s.inicio) > GAP_SESSAO) s = null;

    // se o "cronômetro" repetiu o mesmo valor enquanto a gravação rodou vários
    // segundos, ele não é o cronômetro: ignora e calcula o timecode
    let tcConfiavel = tcSeg;
    if (tcConfiavel != null && s && !s.pausado && s.ultimoTc === tcConfiavel &&
        (agora - s.desde) / 1000 > 3) {
      console.warn("[Pausar Ext] cronômetro suspeito (parado em " + r.timecode + ") — calculando o timecode");
      tcConfiavel = null;
    }

    let tipo;
    if (r.estadoAntes === "marcador") tipo = "marcador";
    else if (r.estadoAntes === "gravando") tipo = "pausa";
    else if (r.estadoAntes === "pausado") tipo = "retomada";
    else if (r.estadoAntes === "parado") tipo = "inicio";
    else tipo = s && s.pausado ? "retomada" : "pausa";

    if (!s || tipo === "inicio") {
      s = {
        id: new Date(agora).toISOString(),
        inicio: agora,
        gravado: tcConfiavel != null ? tcConfiavel : 0,
        desde: agora,
        pausado: false,
        // sem cronômetro e sem ter visto o início, o timecode é aproximado
        estimado: tipo !== "inicio" && tcSeg == null,
        ultimaPausaEm: 0
      };
    }

    const ev = {
      tipo,
      sessao: s.id,
      iso: new Date(agora).toISOString(),
      hora: new Date(agora).toLocaleTimeString("pt-BR"),
      botao: r.antes || r.label || "",
      url: location.href
    };

    if (tipo === "marcador") {
      ev.tGravado = tcConfiavel != null ? tcConfiavel
        : s.pausado ? s.gravado : s.gravado + (agora - s.desde) / 1000;
      ev.nota = r.nota || "";
    } else if (tipo === "inicio") {
      s.gravado = 0;
      s.desde = agora;
      s.pausado = false;
      s.estimado = false;
      ev.tGravado = 0;
    } else if (tipo === "pausa") {
      if (!s.pausado) s.gravado += (agora - s.desde) / 1000;
      s.pausado = true;
      s.ultimaPausaEm = agora;
      ev.tGravado = tcConfiavel != null ? tcConfiavel : s.gravado;
    } else {
      ev.tGravado = tcConfiavel != null ? tcConfiavel : s.gravado;
      if (s.ultimaPausaEm) ev.duracaoPausa = +((agora - s.ultimaPausaEm) / 1000).toFixed(1);
      s.desde = agora;
      s.pausado = false;
    }

    if (tcConfiavel != null) {
      if (tipo !== "marcador") { s.gravado = tcConfiavel; s.estimado = false; }
      ev.timecodeStreamYard = r.timecode;
    }
    s.ultimoTc = tcSeg;
    ev.tGravado = +Number(ev.tGravado).toFixed(1);
    ev.timecode = P.hhmmss(ev.tGravado);
    ev.timecodeAproximado = !!s.estimado;

    if (prompter) {
      const linha = prompter.linhaAtual;
      if (linha) ev.roteiro = { progresso: prompter.progresso, linha: linha.slice(0, 160) };
    }

    s.ultimo = agora;
    P.streamyard.setGravando(!s.pausado);
    await P.saveSessao(s);
    await P.appendLog(ev, cfg.logMax);

    const rotulos = { pausa: "⏸ pausa", retomada: "▶ retomada", inicio: "● início", marcador: "🚩 marcador" };
    dizer(rotulos[tipo] + " em " + ev.timecode + (ev.timecodeAproximado ? " (aprox.)" : "") + " — anotado no log");
    console.log("[Pausar Ext] log:", ev);
  }

  // repassar = true quando a ação partiu daqui (precisa avisar as outras abas)
  async function executar(repassar) {
    if (ocupado) return;
    ocupado = true;
    setTimeout(() => { ocupado = false; }, 400);

    if (cfg.pauseRecording) await clicarGravacao();

    alternarPrompter();

    if (repassar) {
      chrome.runtime.sendMessage({ action: "relay-pause", origem: "streamyard" }).catch(() => {});
    }
    atualizarPill();
  }

  // ------------------------------------------------------------------ atalhos
  function nossoCampo(e) {
    // ignora quando o usuário está digitando no editor do teleprompter
    const p = e.composedPath ? e.composedPath() : [];
    return p.some((n) => n && n.tagName === "TEXTAREA" && n.getRootNode() instanceof ShadowRoot);
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;

    if (P.matches(e, cfg.hotkeyAll)) {
      e.preventDefault(); e.stopPropagation();
      console.log("[Pausar Ext] atalho principal:", P.comboFromEvent(e));
      executar(true);
      return;
    }
    if (nossoCampo(e)) return;

    if (P.matches(e, cfg.hotkeyPrompter)) {
      e.preventDefault(); e.stopPropagation();
      cmdPrompter("alternar");
    } else if (P.matches(e, cfg.hotkeyOverlay)) {
      e.preventDefault(); e.stopPropagation();
      cmdPrompter("alternarVisivel");
    } else if (P.matches(e, cfg.hotkeyRestart)) {
      e.preventDefault(); e.stopPropagation();
      cmdPrompter("reiniciar");
    } else if (P.matches(e, cfg.hotkeySpeedUp)) {
      e.preventDefault(); cmdPrompter("mudarVel", cfg.speedStep);
    } else if (P.matches(e, cfg.hotkeySpeedDown)) {
      e.preventDefault(); cmdPrompter("mudarVel", -cfg.speedStep);
    } else if (P.matches(e, cfg.hotkeyFontUp)) {
      e.preventDefault(); cmdPrompter("mudarFonte", 2);
    } else if (P.matches(e, cfg.hotkeyFontDown)) {
      e.preventDefault(); cmdPrompter("mudarFonte", -2);
    } else if (P.matches(e, cfg.hotkeyNudgeUp)) {
      e.preventDefault(); e.stopPropagation();
      cmdPrompter("empurrar", -cfg.nudgePx);
    } else if (P.matches(e, cfg.hotkeyNudgeDown)) {
      e.preventDefault(); e.stopPropagation();
      cmdPrompter("empurrar", cfg.nudgePx);
    } else if (P.matches(e, cfg.hotkeyMarcar)) {
      e.preventDefault(); e.stopPropagation();
      marcar();
    }
  }, true);

  function cmdPrompter(cmd, val) {
    if (noTopo && prompter) {
      if (typeof prompter[cmd] === "function") prompter[cmd](val);
      atualizarPill();
    } else {
      chrome.runtime.sendMessage({ action: "prompter-cmd", cmd, val, escopo: "topo" }).catch(() => {});
    }
  }

  // ------------------------------------------------------------------ mensagens
  chrome.runtime.onMessage.addListener((msg, _s, resposta) => {
    if (!msg || !msg.action) return;
    switch (msg.action) {
      case "toggle-pause":
        console.log("[Pausar Ext] recebi toggle-pause do service worker");
        executar(false);
        break;
      case "marcar":
        marcar(msg.nota);
        break;
      case "toggle-pause-somente-gravacao":
        if (cfg.pauseRecording) clicarGravacao();
        break;
      case "prompter-cmd":
        if (msg.cmd === "alternar") { alternarPrompter(); break; }
        if (noTopo && prompter && typeof prompter[msg.cmd] === "function") {
          prompter[msg.cmd](msg.val);
          atualizarPill();
        }
        break;
      case "testar-seletor":
        resposta(P.streamyard.testarSeletor(msg.sel));
        return true;
      case "status":
        resposta({
          site: "streamyard",
          versao: VERSAO,
          url: location.href,
          noEstudio: NO_ESTUDIO,
          topo: noTopo,
          tocando: !!(prompter && prompter.tocando),
          visivel: !!(prompter && prompter.visivel),
          botaoOk: botaoLocalizado(),
          timerOk: !!P.streamyard.timerOk,
          hotkey: cfg.hotkeyAll,
          speed: cfg.speed
        });
        return true;
    }
  });

  // ------------------------------------------------------------------ início
  function domPronto() {
    return document.readyState === "loading"
      ? new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }))
      : Promise.resolve();
  }

  (async function iniciar() {
    cfg = await P.loadSettings();
    console.log("[Pausar Ext] ativo — atalho:", P.bonito(cfg.hotkeyAll), "| frame:", noTopo ? "principal" : "iframe");
    P.onChange(({ settings }) => {
      if (settings) {
        cfg = Object.assign({}, P.DEFAULTS, settings);
        atualizarPill();
      }
    });

    if (NO_ESTUDIO) {
      const s = await P.loadSessao();
      P.streamyard.monitorarTimer(cfg.streamyardTimerSelector, !(s && s.pausado));
    }

    if (noTopo) {
      await domPronto();
      // fora do estúdio (dashboard, login…) o teleprompter começa escondido — Alt+T mostra
      prompter = P.createPrompter({ mode: "overlay", startHidden: !NO_ESTUDIO });
      await prompter.montar();
      criarPill();
    }
  })();
})();
