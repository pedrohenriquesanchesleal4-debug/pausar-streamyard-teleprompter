// src/prompter.js — motor do teleprompter (Shadow DOM, isolado do CSS do site).
// Usado como overlay em cima do StreamYard e também na janela separada.
(function () {
  const P = window.PausarExt;
  if (!P || P.createPrompter) return;

  const CSS = `
:host {
  --fs: 44px; --lh: 1.55; --ls: 0px; --w: 92%; --tc: #fff;
  --bg: rgba(0,0,0,.55); --align: left; --fw: 700; --ff: system-ui, sans-serif;
  --guide: 38%;
  all: initial;
}
* { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.tp {
  position: fixed; display: flex; flex-direction: column; overflow: hidden;
  max-width: 100vw; max-height: 100vh;
  background: var(--bg); color: #fff; border: 1px solid rgba(255,255,255,.18);
  border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,.5);
  backdrop-filter: blur(2px); pointer-events: auto;
  min-width: 260px; min-height: 180px;
}
.tp.page { position: relative; width: 100%; height: 100%; border: 0; border-radius: 0; box-shadow: none; }
.tp.full { inset: 0 !important; width: auto !important; height: auto !important; border-radius: 0; }
.tp.ghost .stage, .tp.ghost .prog { pointer-events: none; }
.tp.ghost { box-shadow: none; border-color: rgba(255,255,255,.08); }

/* barra de topo */
.hd {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px; flex-wrap: nowrap;
  background: rgba(20,22,28,.75); cursor: grab; user-select: none;
  font-size: 12px; flex: 0 0 auto; transition: opacity .25s;
}
.tp.page .hd { cursor: default; }
.hd .ttl { font-weight: 700; letter-spacing: .2px; white-space: nowrap; }
.hd .stat { color: #9aa4b2; white-space: nowrap; }
.hd button { flex: 0 0 auto; }
.hd .stat.on { color: #4ade80; }
.hd .sp { flex: 1; }
button {
  background: rgba(255,255,255,.09); color: #fff; border: 1px solid rgba(255,255,255,.16);
  border-radius: 7px; padding: 4px 8px; cursor: pointer; font-size: 12px; line-height: 1.2;
}
button:hover { background: rgba(255,255,255,.18); }
button.on { background: #2563eb; border-color: #3b82f6; }
button.play { background: #16a34a; border-color: #22c55e; font-size: 14px; min-width: 40px; }
button.play.pausing { background: #b45309; border-color: #f59e0b; }
button.voice.on { background: #16a34a; border-color: #22c55e; }

/* barra de alternância de modo (Voz / Manual) */
.sub-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 5px 8px; background: rgba(14, 18, 26, 0.96);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08); flex: 0 0 auto; gap: 6px;
}
.mode-bar {
  display: flex; gap: 6px; flex: 1 1 auto;
}
.btn-m {
  flex: 1 1 auto; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.06);
  color: #94a3b8; cursor: pointer; text-align: center; transition: all 0.2s; white-space: nowrap;
}
.btn-m:hover { background: rgba(255, 255, 255, 0.14); color: #fff; }
.btn-m.on {
  background: #2563eb; color: #fff; border-color: #3b82f6;
  box-shadow: 0 0 10px rgba(37, 99, 235, 0.4);
}
.btn-m[data-m="voz"].on {
  background: #15803d; border-color: #22c55e;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.35);
}

/* caixa de áudio / transcrição ao vivo */
.v-box {
  display: flex; align-items: center; gap: 8px; padding: 5px 10px;
  background: rgba(10, 14, 20, 0.96); border-bottom: 1px solid rgba(59, 130, 246, 0.25);
  font-size: 11px; flex: 0 0 auto; min-height: 28px; transition: background 0.2s, border-color 0.2s;
}
.v-box.hearing {
  background: rgba(16, 50, 30, 0.98); border-bottom-color: #22c55e;
}
.v-pulse {
  font-size: 13px; line-height: 1; flex: 0 0 auto;
}
.v-box.hearing .v-pulse {
  animation: pulse-mic 0.7s infinite alternate;
}
@keyframes pulse-mic {
  from { transform: scale(1); filter: drop-shadow(0 0 2px #22c55e); }
  to { transform: scale(1.25); filter: drop-shadow(0 0 8px #4ade80); }
}
.v-lbl {
  color: #94a3b8; font-weight: 700; white-space: nowrap; flex: 0 0 auto;
}
.v-txt {
  color: #f1f5f9; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  flex: 1 1 auto;
}
.v-txt a {
  color: #38bdf8; text-decoration: underline; cursor: pointer;
}

/* palco do texto */
.stage { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; cursor: pointer; }
.stage .flip { position: absolute; inset: 0; transform-origin: 50% 50%; }
.scroller { position: absolute; left: 0; right: 0; top: 0; will-change: transform; }
.txt {
  width: var(--w); margin: 0 auto; color: var(--tc); text-align: var(--align);
  font-size: var(--fs); line-height: var(--lh); letter-spacing: var(--ls);
  font-weight: var(--fw); font-family: var(--ff); white-space: pre-wrap;
  word-break: break-word; text-shadow: 0 2px 6px rgba(0,0,0,.55);
}
.txt p { min-height: .6em; padding: 4px 6px; margin-bottom: 2px; border-radius: 4px; transition: all 0.2s ease; }
.txt p.active-line {
  background: rgba(37, 99, 235, 0.28);
  border-left: 4px solid #3b82f6;
  color: #ffffff;
  text-shadow: 0 0 12px rgba(59, 130, 246, 0.8);
}
.guide {
  position: absolute; left: 0; right: 0; top: var(--guide); height: 2px;
  background: linear-gradient(90deg, transparent, #ef4444, transparent); opacity: .8; display: none;
}
.tp.guide-on .guide { display: block; }
.fade { position: absolute; left: 0; right: 0; height: 10%; display: none; pointer-events: none; z-index: 2; }
.fade.t { top: 0; background: linear-gradient(to bottom, rgba(0,0,0,.85), transparent); }
.fade.b { bottom: 0; background: linear-gradient(to top, rgba(0,0,0,.85), transparent); }
.tp.fade-on .fade { display: block; }
.count {
  position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
  font-size: 96px; font-weight: 800; color: #fff; background: rgba(0,0,0,.35);
  text-shadow: 0 4px 20px #000, 0 0 40px #000; pointer-events: none;
}
.count.on { display: flex; }

/* controles */
.ctl {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 6px 8px; background: rgba(20,22,28,.8); font-size: 12px; flex: 0 0 auto;
  transition: opacity .25s;
}
.ctl label { display: flex; align-items: center; gap: 5px; color: #cbd5e1; white-space: nowrap; min-width: 0; }
.ctl .lab { font-weight: 400; }
.ctl button { flex: 0 0 auto; }
input[type=range] { width: 74px; min-width: 54px; accent-color: #3b82f6; }
output { color: #fff; min-width: 34px; font-variant-numeric: tabular-nums; }
.time { margin-left: auto; color: #cbd5e1; font-variant-numeric: tabular-nums; white-space: nowrap; }

/* esconde barras enquanto rola */
.tp.playing.autohide .hd, .tp.playing.autohide .ctl { opacity: 0; }
.tp.playing.autohide:hover .hd, .tp.playing.autohide:hover .ctl { opacity: 1; }

.prog { height: 3px; background: rgba(255,255,255,.12); flex: 0 0 auto; }
.prog i { display: block; height: 100%; width: 0; background: #3b82f6; }

/* painéis (editor / ajustes) */
.pane {
  position: absolute; inset: 0; background: rgba(12,14,18,.97); padding: 10px;
  display: none; flex-direction: column; gap: 8px; overflow: auto; z-index: 5;
}
.pane.on { display: flex; }
.pane h3 { font-size: 13px; font-weight: 700; }
textarea {
  flex: 1 1 auto; min-height: 120px; resize: none; background: #0f1319; color: #e5e7eb;
  border: 1px solid rgba(255,255,255,.18); border-radius: 8px; padding: 10px;
  font-size: 14px; line-height: 1.5; font-family: ui-monospace, Consolas, monospace;
}
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
.grid label { display: flex; align-items: center; gap: 6px; color: #cbd5e1; font-size: 12px; }
.muted { color: #94a3b8; font-size: 11px; }
input[type=color] { width: 30px; height: 22px; border: 0; background: none; padding: 0; }
input[type=number] { width: 62px; background: #0f1319; color: #e5e7eb; border: 1px solid rgba(255,255,255,.18); border-radius: 6px; padding: 3px 5px; }
select { background: #0f1319; color: #e5e7eb; border: 1px solid rgba(255,255,255,.18); border-radius: 6px; padding: 3px 5px; font-size: 12px; }
.rs {
  position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; z-index: 6;
  background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,.45) 50%);
}
.tp.page .rs, .tp.full .rs { display: none; }
.tp.page [data-a="ghost"], .tp.page [data-a="hide"] { display: none; }

/* modo foco: usado quando a tela cheia de verdade nao e permitida (painel lateral) */
.tp.zen .ctl, .tp.zen .prog { display: none; }
.tp.zen .hd { background: transparent; opacity: .45; }
.tp.zen .hd:hover { opacity: 1; background: rgba(20,22,28,.75); }

/* painel estreito (side panel): controles encolhem em vez de cortar o texto */
.tp.compact .hd { padding: 4px 6px; gap: 4px; }
.tp.compact .hd .ttl, .tp.compact .hd .grip { display: none; }
.tp.compact .sub-hd { padding: 4px 6px; }
.tp.compact .btn-m { padding: 4px 6px; font-size: 10px; }
.tp.compact .ctl { gap: 4px; padding: 4px 6px; }
.tp.compact .ctl label { gap: 2px; font-size: 10px; }
.tp.compact input[type=range] { width: 50px; min-width: 40px; }
.tp.compact .time { display: none; }
.tp.narrow .sub-hd { flex-direction: column; gap: 3px; }
.tp.narrow .lab { display: none; }
.tp.narrow input[type=range] { width: 44px; }
.tp.narrow .grid { grid-template-columns: 1fr; }
`;

  const HTML = `
<div class="tp">
  <div class="hd">
    <span class="grip">⠿</span>
    <span class="ttl">Teleprompter</span>
    <span class="stat">pausado</span>
    <span class="sp"></span>
    <button data-a="voice" class="voice" title="Acompanhamento inteligente de voz (pt-BR)">🎙</button>
    <button data-a="editor" title="Editar roteiro">✎</button>
    <button data-a="cfg" title="Ajustes rápidos">⚙</button>
    <button data-a="ghost" title="Modo fantasma: cliques passam para o site">👻</button>
    <button data-a="full" title="Tela cheia / modo foco (Esc sai)">⛶</button>
    <button data-a="hide" title="Esconder">✕</button>
  </div>

  <div class="sub-hd">
    <div class="mode-bar">
      <button class="btn-m on" data-m="voz" title="Modo Inteligente: O teleprompter desce sozinho acompanhando sua voz">🎙️ Modo Voz (Auto)</button>
      <button class="btn-m" data-m="manual" title="Modo Manual: Rolagem contínua por velocidade ajustável">⏱️ Modo Manual</button>
    </div>
  </div>

  <div class="v-box" id="v-box" title="O que você está falando em tempo real">
    <span class="v-pulse">🎙️</span>
    <span class="v-lbl">Ouvido no Mic:</span>
    <span class="v-txt" id="v-txt">❝ Fale algo no microfone... ❞</span>
  </div>

  <div class="stage">
    <div class="flip">
      <div class="scroller"><div class="txt"></div></div>
    </div>
    <div class="fade t"></div>
    <div class="fade b"></div>
    <div class="guide"></div>
    <div class="count">3</div>
  </div>

  <div class="ctl">
    <button data-a="restart" title="Voltar ao início">⏮</button>
    <button data-a="back" title="Subir um pouco">↑</button>
    <button class="play" data-a="play" title="Play / Pause">▶</button>
    <button data-a="fwd" title="Descer um pouco">↓</button>
    <label class="ctl-speed" style="display:none;"><b class="lab">Vel</b><input type="range" data-s="speed" min="5" max="300" step="1"><output data-o="speed">45</output></label>
    <label><b class="lab">Fonte</b><input type="range" data-s="fontSize" min="14" max="160" step="1"><output data-o="fontSize">44</output></label>
    <span class="time">0:00 / 0:00</span>
  </div>
  <div class="prog"><i></i></div>

  <div class="pane editor">
    <div class="row"><h3>Roteiro</h3><span class="sp" style="flex:1"></span><span class="muted info"></span></div>
    <textarea spellcheck="false"></textarea>
    <div class="row">
      <button data-a="salvar">Salvar</button>
      <button data-a="cancelar">Cancelar</button>
      <button data-a="importar">Importar .txt</button>
      <button data-a="limpar">Limpar</button>
      <input type="file" accept=".txt,.md,text/plain" hidden />
    </div>
  </div>

  <div class="pane cfg">
    <div class="row"><h3>Ajustes rápidos</h3><span style="flex:1"></span><button data-a="fecharCfg">Fechar</button></div>
    <div class="grid">
      <label>Entrelinha <input type="range" data-s="lineHeight" min="1" max="3" step="0.05"><output data-o="lineHeight"></output></label>
      <label>Largura <input type="range" data-s="width" min="40" max="100" step="1"><output data-o="width"></output></label>
      <label>Linha de leitura <input type="range" data-s="guidePos" min="10" max="80" step="1"><output data-o="guidePos"></output></label>
      <label>Fundo (opacidade) <input type="range" data-s="bgOpacity" min="0" max="1" step="0.05"><output data-o="bgOpacity"></output></label>
      <label>Fonte <select data-s="fontFamily">
        <option value="system">Sistema</option><option value="condensed">Estreita</option>
        <option value="serif">Serifada</option><option value="mono">Monoespaçada</option>
      </select></label>
      <label>Alinhar <select data-s="align"><option value="left">Esquerda</option><option value="center">Centro</option></select></label>
      <label>Cor do texto <input type="color" data-s="textColor"></label>
      <label>Cor do fundo <input type="color" data-s="bgColor"></label>
      <label>Contagem (s) <input type="number" data-s="countdown" min="0" max="20"></label>
      <label><input type="checkbox" data-s="countdownOnResume"> Contar ao retomar</label>
      <label><input type="checkbox" data-s="bold"> Negrito</label>
      <label><input type="checkbox" data-s="mirrorH"> Espelhar ↔</label>
      <label><input type="checkbox" data-s="mirrorV"> Espelhar ↕</label>
      <label><input type="checkbox" data-s="fadeEdges"> Desbotar bordas</label>
      <label><input type="checkbox" data-s="guideLine"> Mostrar linha de leitura</label>
      <label><input type="checkbox" data-s="loop"> Repetir no fim</label>
      <label><input type="checkbox" data-s="hideBarWhilePlaying"> Esconder barras ao rolar</label>
      <label><input type="checkbox" data-s="pauseRecording"> Atalho também pausa a gravação</label>
    </div>
    <div class="row"><button data-a="maisAjustes">Todos os ajustes / atalhos</button></div>
  </div>

  <div class="rs"></div>
</div>`;

  function escapar(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function createPrompter(opts) {
    opts = opts || {};
    const modoPagina = opts.mode === "page";
    const container = opts.container || document.documentElement;

    let cfg = Object.assign({}, P.DEFAULTS);
    let painel = Object.assign({}, P.PANEL_DEFAULT);
    let roteiro = "";
    let offset = 0;
    let targetOffset = 0;
    let modo = "voz";
    let maxOffset = 0;
    let tocando = false;
    let ultimoT = 0;
    let rafId = 0;
    let contagemId = 0;
    let contando = false;
    let salvarPainelId = 0;
    let montado = false;

    const host = document.createElement("div");
    host.id = "pausar-ext-prompter";
    Object.assign(host.style, modoPagina
      ? { position: "absolute", inset: "0", zIndex: "1" }
      : { position: "fixed", inset: "0", zIndex: "2147483646", pointerEvents: "none" });

    const raiz = host.attachShadow({ mode: "open" });
    const estilo = document.createElement("style");
    estilo.textContent = CSS;
    const wrap = document.createElement("div");
    wrap.innerHTML = HTML;
    raiz.append(estilo, wrap);

    const $ = (s) => raiz.querySelector(s);
    const tp = $(".tp");
    const stage = $(".stage");
    const flip = $(".flip");
    const scroller = $(".scroller");
    const txt = $(".txt");
    const barra = $(".hd");
    const stat = $(".stat");
    const btnPlay = $("button.play");
    const tempo = $(".time");
    const progresso = $(".prog i");
    const contagem = $(".count");
    const paneEditor = $(".pane.editor");
    const paneCfg = $(".pane.cfg");
    const area = $("textarea");
    const infoEditor = $(".pane.editor .info");
    const inputArquivo = $('input[type=file]');
    const alcaResize = $(".rs");

    const vBox = $("#v-box");
    const vTxt = $("#v-txt");
    const vPulse = $(".v-pulse");
    const btnModoVoz = $('[data-m="voz"]');
    const btnModoManual = $('[data-m="manual"]');
    const ctlSpeed = $(".ctl-speed");

    if (modoPagina) tp.classList.add("page");

    function definirModo(novoModo) {
      modo = novoModo === "manual" ? "manual" : "voz";
      if (btnModoVoz) btnModoVoz.classList.toggle("on", modo === "voz");
      if (btnModoManual) btnModoManual.classList.toggle("on", modo === "manual");
      if (ctlSpeed) ctlSpeed.style.display = modo === "manual" ? "flex" : "none";
      if (vBox) vBox.style.display = modo === "voz" ? "flex" : "none";

      if (modo === "voz") {
        ativarVoz();
      } else {
        desativarVoz();
      }
      pintar();
    }

    // ------------------------------------------------------------- aparência
    function aplicarCfg() {
      host.style.setProperty("--fs", cfg.fontSize + "px");
      host.style.setProperty("--lh", String(cfg.lineHeight));
      host.style.setProperty("--ls", cfg.letterSpacing + "px");
      host.style.setProperty("--w", cfg.width + "%");
      host.style.setProperty("--tc", cfg.textColor);
      host.style.setProperty("--bg", P.hexParaRgba(cfg.bgColor, cfg.bgOpacity));
      host.style.setProperty("--align", cfg.align);
      host.style.setProperty("--fw", cfg.bold ? "700" : "400");
      host.style.setProperty("--ff", P.fontStack(cfg.fontFamily));
      host.style.setProperty("--guide", cfg.guidePos + "%");

      tp.classList.toggle("fade-on", !!cfg.fadeEdges);
      tp.classList.toggle("guide-on", !!cfg.guideLine);
      tp.classList.toggle("ghost", !modoPagina && !!cfg.ghost);
      tp.classList.toggle("autohide", !!cfg.hideBarWhilePlaying);
      tp.classList.toggle("full", !modoPagina && !!cfg.fullscreen);
      raiz.querySelector('[data-a="ghost"]').classList.toggle("on", !!cfg.ghost);
      raiz.querySelector('[data-a="full"]').classList.toggle("on", !!cfg.fullscreen);

      flip.style.transform = `scale(${cfg.mirrorH ? -1 : 1}, ${cfg.mirrorV ? -1 : 1})`;

      if (!modoPagina) posicionarPainel();
      espelharControles();
      medir();
    }

    function posicionarPainel() {
      if (!modoPagina && cfg.fullscreen) {
        // em tela cheia quem manda é o CSS (.tp.full): sem left/top/width/height inline
        Object.assign(tp.style, { left: "", top: "", width: "", height: "" });
        return;
      }
      const larg = Math.min(painel.w, window.innerWidth - 20);
      const alt = Math.min(painel.h, window.innerHeight - 20);
      const x = painel.x == null ? Math.round((window.innerWidth - larg) / 2) : painel.x;
      Object.assign(tp.style, {
        left: Math.max(0, Math.min(x, window.innerWidth - larg)) + "px",
        top: Math.max(0, Math.min(painel.y, window.innerHeight - 60)) + "px",
        width: larg + "px",
        height: alt + "px"
      });
    }

    function espelharControles() {
      raiz.querySelectorAll("[data-s]").forEach((el) => {
        const k = el.dataset.s;
        if (!(k in cfg)) return;
        if (el.type === "checkbox") el.checked = !!cfg[k];
        else el.value = cfg[k];
      });
      raiz.querySelectorAll("[data-o]").forEach((o) => {
        const k = o.dataset.o;
        const v = cfg[k];
        o.textContent = k === "bgOpacity" ? Math.round(v * 100) + "%"
          : k === "lineHeight" ? Number(v).toFixed(2)
          : k === "width" || k === "guidePos" ? v + "%"
          : v;
      });
    }

    // ------------------------------------------------------------- texto
    function renderTexto() {
      const linhas = String(roteiro || "").split(/\r?\n/);
      txt.innerHTML = linhas.map((l) => "<p>" + (escapar(l) || "&nbsp;") + "</p>").join("");
      medir();
    }

    function medir() {
      const h = stage.clientHeight || 300;
      const w = stage.clientWidth || 400;

      // Em painel estreito (sidepanel ~320px), reduz fonte padrão para caber frase inteira sem cortar
      if (w < 380 && cfg.fontSize > 32) {
        host.style.setProperty("--fs", "26px");
      } else {
        host.style.setProperty("--fs", cfg.fontSize + "px");
      }

      const guideOffset = Math.round(h * (cfg.guidePos / 100));
      txt.style.paddingTop = guideOffset + "px";
      txt.style.paddingBottom = Math.round(h * 0.45) + "px";
      maxOffset = Math.max(0, scroller.scrollHeight - h * 0.35);
      if (offset > maxOffset) offset = maxOffset;
      if (targetOffset > maxOffset) targetOffset = maxOffset;
      pintar();
    }

    function pintar() {
      scroller.style.transform = "translate3d(0," + -offset.toFixed(2) + "px,0)";
      const total = maxOffset || 1;
      progresso.style.width = ((offset / total) * 100).toFixed(2) + "%";
      const restante = Math.max(0, (maxOffset - offset) / Math.max(1, cfg.speed));
      const gasto = offset / Math.max(1, cfg.speed);
      tempo.textContent = P.mmss(gasto) + " / -" + P.mmss(restante);
      btnPlay.textContent = (tocando || contando) ? "❚❚" : "▶";
      btnPlay.classList.toggle("pausing", tocando || contando);
      if (!contando) stat.textContent = tocando ? (modo === "voz" ? "ouvindo..." : "rolando") : "pausado";
      stat.classList.toggle("on", tocando);
      tp.classList.toggle("playing", tocando);
    }

    // ------------------------------------------------------------- rolagem
    function laco(t) {
      if (!tocando) return;
      if (!ultimoT) ultimoT = t;
      const dt = Math.min(0.25, (t - ultimoT) / 1000);
      ultimoT = t;

      if (modo === "manual") {
        offset += cfg.speed * dt;
        if (offset >= maxOffset) {
          offset = cfg.loop ? 0 : maxOffset;
          if (!cfg.loop) { pausar(); return; }
        }
      } else {
        // MODO VOZ: interpolação suave (lerp) em direção à linha falada (targetOffset)
        const diff = targetOffset - offset;
        if (Math.abs(diff) > 0.5) {
          offset += diff * 0.16;
          if (offset >= maxOffset) offset = maxOffset;
          if (offset < 0) offset = 0;
        }
      }

      pintar();
      rafId = requestAnimationFrame(laco);
    }

    function tocar(comContagem) {
      if (tocando) return;
      mostrar();
      const doInicio = offset <= 1;
      const contarAgora = comContagem !== false && cfg.countdown > 0 &&
        (doInicio || cfg.countdownOnResume);
      if (contarAgora) return contar(cfg.countdown, () => iniciarLaco());
      iniciarLaco();
    }

    function iniciarLaco() {
      tocando = true;
      ultimoT = 0;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(laco);
      if (alignmentEngine) alignmentEngine.setManualPaused(false);
      if (stateMachine) stateMachine.manualResume();
      pintar();
      avisar();
    }

    function pausar() {
      clearInterval(contagemId);
      contando = false;
      contagem.classList.remove("on");
      tocando = false;
      cancelAnimationFrame(rafId);
      if (alignmentEngine) alignmentEngine.setManualPaused(true);
      if (stateMachine) stateMachine.manualPause();
      pintar();
      avisar();
    }

    function contar(seg, feito) {
      clearInterval(contagemId);
      let n = Math.round(seg);
      const mostra = () => {
        contagem.textContent = n;
        stat.textContent = "começa em " + n + "s";
      };
      contando = true;
      contagem.classList.add("on");
      mostra();
      contagemId = setInterval(() => {
        n -= 1;
        if (n <= 0) {
          clearInterval(contagemId);
          contando = false;
          contagem.classList.remove("on");
          feito();
        } else {
          mostra();
        }
      }, 1000);
    }

    function alternar() { (tocando || contando) ? pausar() : tocar(); }

    let zen = false;

    async function telaCheia(ligar) {
      if (modoPagina) {
        // no painel lateral o Chrome nao deixa entrar em tela cheia: cai no modo foco
        zen = !!ligar;
        tp.classList.toggle("zen", zen);
        raiz.querySelector('[data-a="full"]').classList.toggle("on", zen);
        try {
          if (zen) await document.documentElement.requestFullscreen();
          else if (document.fullscreenElement) await document.exitFullscreen();
        } catch (_) {}
        medir();
        return;
      }
      cfg.fullscreen = !!ligar;
      tp.classList.toggle("full", cfg.fullscreen);
      aplicarCfg();
      P.saveSettings({ fullscreen: cfg.fullscreen });
    }

    function reiniciar() {
      offset = 0;
      targetOffset = 0;
      if (alignmentEngine) alignmentEngine.repositionToIndex(0);
      txt.querySelectorAll("p.active-line").forEach((p) => p.classList.remove("active-line"));
      pintar();
    }

    function empurrar(px) {
      offset = Math.max(0, Math.min(maxOffset, offset + px));
      targetOffset = offset;
      if (alignmentEngine) {
        const alvo = offset + stage.clientHeight * (cfg.guidePos / 100);
        let melhorIdx = 0;
        let dist = Infinity;
        const paras = Array.from(txt.children);
        paras.forEach((p, idx) => {
          const d = Math.abs(p.offsetTop + p.offsetHeight / 2 - alvo);
          if (d < dist) { dist = d; melhorIdx = idx; }
        });
        alignmentEngine.repositionToLine(melhorIdx);
      }
      pintar();
    }

    function mudarVel(d) {
      cfg.speed = Math.max(5, Math.min(300, Math.round(cfg.speed + d)));
      espelharControles();
      pintar();
      P.saveSettingsDebounced({ speed: cfg.speed });
    }

    function mudarFonte(d) {
      cfg.fontSize = Math.max(14, Math.min(160, cfg.fontSize + d));
      aplicarCfg();
      P.saveSettingsDebounced({ fontSize: cfg.fontSize });
    }

    function avisar() {
      if (typeof opts.onState === "function") opts.onState({ playing: tocando, offset, maxOffset, speed: cfg.speed });
    }

    // ------------------------------------------------------------- visibilidade
    function mostrar() {
      const estavaEscondido = host.style.display === "none";
      host.style.display = "";
      if (estavaEscondido) medir();
      if (!modoPagina && !cfg.overlayVisible) {
        cfg.overlayVisible = true;
        P.saveSettings({ overlayVisible: true });
      }
    }
    function esconder() {
      pausar();
      host.style.display = "none";
      if (!modoPagina && cfg.overlayVisible) {
        cfg.overlayVisible = false;
        P.saveSettings({ overlayVisible: false });
      }
    }
    function alternarVisivel() {
      if (host.style.display === "none") mostrar(); else esconder();
    }

    // ------------------------------------------------------------- painéis
    function abrirEditor() {
      area.value = roteiro;
      atualizarInfo();
      paneCfg.classList.remove("on");
      paneEditor.classList.add("on");
      area.focus();
    }
    function fecharEditor() { paneEditor.classList.remove("on"); }
    function atualizarInfo() {
      const t = area.value;
      const palavras = (t.trim().match(/\S+/g) || []).length;
      infoEditor.textContent = palavras + " palavras · " + t.length + " caracteres · ~" + P.mmss((palavras / 150) * 60) + " a 150 ppm";
    }

    // ------------------------------------------------------------- reconhecimento de voz
    let recognizer = null;
    let alignmentEngine = null;
    let stateMachine = null;
    let vozAtiva = false;

    function alternarVoz() {
      if (vozAtiva) desativarVoz(); else ativarVoz();
    }

    function ativarVoz() {
      const btnVozIcon = raiz.querySelector('[data-a="voice"]');
      if (!window.TextNormalizer || !window.AlignmentEngine || !window.WebSpeechRecognizer) {
        if (vTxt) vTxt.textContent = "Módulos de voz não carregados.";
        stat.textContent = "voz não disponível";
        return;
      }

      const tokenData = window.TextNormalizer.tokenizeScript(roteiro);
      alignmentEngine = new window.AlignmentEngine({
        tokens: tokenData.tokens,
        lines: tokenData.lines,
        lookaheadWindow: 20,
        confidentThreshold: 0.65
      });

      stateMachine = new window.SyncStateMachine({
        silenceTimeoutMs: 2800,
        onStateChange: ({ currentState }) => {
          const badge = window.SyncStateMachine.getBadgeInfo(currentState);
          stat.textContent = badge.label;
          if (currentState === "PAUSED") {
            if (vBox) vBox.classList.remove("hearing");
          }
        }
      });

      recognizer = new window.WebSpeechRecognizer({
        lang: "pt-BR",
        onStatusChange: ({ status: st }) => {
          if (st === "LISTENING") {
            stat.textContent = "ouvindo...";
            if (btnVozIcon) btnVozIcon.classList.add("on");
            if (vPulse) { vPulse.textContent = "🎙️"; vPulse.style.color = "#22c55e"; }
            if (vTxt && (vTxt.textContent.includes("Fale algo") || vTxt.textContent.includes("Aguardando"))) {
              vTxt.textContent = "❝ Fale algo no microfone... ❞";
            }
          } else {
            if (btnVozIcon) btnVozIcon.classList.remove("on");
            if (vPulse) vPulse.style.color = "#94a3b8";
          }
        },
        onResult: ({ transcript, isFinal, isSilence }) => {
          if (!vozAtiva) return;

          if (vTxt && transcript) {
            vTxt.textContent = "❝ " + transcript + " ❞";
          }
          if (vBox) {
            vBox.classList.add("hearing");
            clearTimeout(vBox._ht);
            vBox._ht = setTimeout(() => vBox.classList.remove("hearing"), 1500);
          }

          if (isSilence) {
            if (stateMachine && typeof stateMachine.onSilence === "function") {
              stateMachine.onSilence();
            }
            return;
          }

          const match = alignmentEngine.processSpokenTranscript(transcript, isFinal);
          if (match.action === "ADVANCE" || match.action === "JUMP_FORWARD") {
            stateMachine.onConfidentMatch();
            const tok = match.token;
            if (tok) {
              const paras = txt.querySelectorAll("p");
              paras.forEach((p, idx) => p.classList.toggle("active-line", idx === tok.lineIndex));
              const targetP = paras[tok.lineIndex];
              if (targetP) {
                const h = stage.clientHeight || 300;
                targetOffset = Math.max(0, Math.min(maxOffset, targetP.offsetTop - h * (cfg.guidePos / 100)));
                if (!tocando) {
                  iniciarLaco();
                }
              }
            }
          } else if (match.confidence === "UNCERTAIN" || match.reason === "OFF_SCRIPT_OR_IMPROVISING") {
            stateMachine.onUncertainMatch();
          }
        },
        onError: (err) => {
          stat.textContent = "erro mic";
          if (vTxt) {
            if (err.code === "PERMISSION_DENIED" || (err.message && err.message.includes("negada"))) {
              vTxt.innerHTML = "⚠️ Permissão de mic negada. <a id='pedir-mic' style='color:#38bdf8;text-decoration:underline;cursor:pointer;'>Clique aqui para autorizar</a>";
              const lk = vTxt.querySelector('#pedir-mic');
              if (lk) {
                lk.onclick = async (e) => {
                  e.preventDefault();
                  try {
                    await navigator.mediaDevices.getUserMedia({ audio: true });
                    ativarVoz();
                  } catch (e2) {
                    alert("Acesso ao microfone negado nas permissões do Chrome.");
                  }
                };
              }
            } else {
              vTxt.textContent = "⚠️ Erro mic: " + (err.message || err.code);
            }
          }
        }
      });

      vozAtiva = true;
      if (btnVozIcon) btnVozIcon.classList.add("on");
      recognizer.start();
      stateMachine.startListening();
      if (!tocando) {
        tocando = true;
        ultimoT = 0;
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(laco);
        pintar();
      }
    }

    function desativarVoz() {
      vozAtiva = false;
      const btnVozIcon = raiz.querySelector('[data-a="voice"]');
      if (btnVozIcon) btnVozIcon.classList.remove("on");
      if (vPulse) vPulse.style.color = "#94a3b8";
      if (recognizer) {
        recognizer.stop();
        recognizer = null;
      }
      if (stateMachine) {
        stateMachine.stop();
        stateMachine = null;
      }
      stat.textContent = tocando ? "rolando" : "pausado";
      txt.querySelectorAll("p.active-line").forEach((p) => p.classList.remove("active-line"));
    }

    // ------------------------------------------------------------- eventos
    raiz.addEventListener("click", (e) => {
      const btnModo = e.target.closest("[data-m]");
      if (btnModo) {
        e.preventDefault();
        e.stopPropagation();
        definirModo(btnModo.dataset.m);
        return;
      }

      const btn = e.target.closest("[data-a]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      switch (btn.dataset.a) {
        case "voice": alternarVoz(); break;
        case "play": alternar(); break;
        case "restart": reiniciar(); break;
        case "back": empurrar(-(cfg.nudgePx || 80)); break;
        case "fwd": empurrar(cfg.nudgePx || 80); break;
        case "editor": paneEditor.classList.contains("on") ? fecharEditor() : abrirEditor(); break;
        case "cfg": paneCfg.classList.toggle("on"); espelharControles(); break;
        case "fecharCfg": paneCfg.classList.remove("on"); break;
        case "hide": esconder(); break;
        case "ghost": cfg.ghost = !cfg.ghost; aplicarCfg(); P.saveSettings({ ghost: cfg.ghost }); break;
        case "full": telaCheia(modoPagina ? !zen : !cfg.fullscreen); break;
        case "salvar": roteiro = area.value; P.saveScript(roteiro); renderTexto(); reiniciar(); fecharEditor(); break;
        case "cancelar": fecharEditor(); break;
        case "limpar": area.value = ""; atualizarInfo(); area.focus(); break;
        case "importar": inputArquivo.click(); break;
        case "maisAjustes": chrome.runtime.sendMessage({ action: "abrir-opcoes" }).catch(() => {}); break;
      }
    });

    // clicar no texto dá play/pause (igual aos teleprompters online)
    stage.addEventListener("click", (e) => {
      if (paneEditor.classList.contains("on") || paneCfg.classList.contains("on")) return;
      if (e.target.closest("[data-a]")) return;
      alternar();
    });

    // roda do mouse move o roteiro na mão
    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      empurrar(e.deltaY);
    }, { passive: false });

    inputArquivo.addEventListener("change", async () => {
      const f = inputArquivo.files && inputArquivo.files[0];
      if (!f) return;
      area.value = await f.text();
      atualizarInfo();
      inputArquivo.value = "";
    });

    area.addEventListener("input", atualizarInfo);
    // dentro do editor, Esc fecha e Ctrl+Enter salva
    area.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); fecharEditor(); }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.stopPropagation();
        roteiro = area.value; P.saveScript(roteiro); renderTexto(); reiniciar(); fecharEditor();
      }
    });

    raiz.addEventListener("input", (e) => {
      const el = e.target.closest("[data-s]");
      if (!el) return;
      const k = el.dataset.s;
      let v;
      if (el.type === "checkbox") v = el.checked;
      else if (el.type === "number" || el.type === "range") v = parseFloat(el.value);
      else v = el.value;
      cfg[k] = v;
      aplicarCfg();
      P.saveSettingsDebounced({ [k]: v });
    });

    // arrastar pelo topo
    if (!modoPagina) {
      barra.addEventListener("mousedown", (e) => {
        if (e.target.closest("button")) return;
        if (cfg.fullscreen) return;
        const r = tp.getBoundingClientRect();
        const dx = e.clientX - r.left;
        const dy = e.clientY - r.top;
        barra.style.cursor = "grabbing";
        const mover = (ev) => {
          painel.x = Math.round(ev.clientX - dx);
          painel.y = Math.round(ev.clientY - dy);
          posicionarPainel();
        };
        const soltar = () => {
          document.removeEventListener("mousemove", mover, true);
          document.removeEventListener("mouseup", soltar, true);
          barra.style.cursor = "grab";
          guardarPainel();
        };
        document.addEventListener("mousemove", mover, true);
        document.addEventListener("mouseup", soltar, true);
        e.preventDefault();
      });

      alcaResize.addEventListener("mousedown", (e) => {
        const r = tp.getBoundingClientRect();
        const x0 = e.clientX, y0 = e.clientY, w0 = r.width, h0 = r.height;
        const mover = (ev) => {
          painel.w = Math.max(260, Math.round(w0 + ev.clientX - x0));
          painel.h = Math.max(180, Math.round(h0 + ev.clientY - y0));
          posicionarPainel();
          medir();
        };
        const soltar = () => {
          document.removeEventListener("mousemove", mover, true);
          document.removeEventListener("mouseup", soltar, true);
          guardarPainel();
        };
        document.addEventListener("mousemove", mover, true);
        document.addEventListener("mouseup", soltar, true);
        e.preventDefault();
        e.stopPropagation();
      });
    }

    function guardarPainel() {
      clearTimeout(salvarPainelId);
      salvarPainelId = setTimeout(() => P.savePanel(painel), 250);
    }

    window.addEventListener("resize", () => {
      if (!modoPagina) posicionarPainel();
      medir();
    });

    // qualquer mudança de tamanho do palco (tela cheia, resize, painel aberto) remede o texto
    if (window.ResizeObserver) {
      let agendado = 0;
      new ResizeObserver(() => {
        cancelAnimationFrame(agendado);
        agendado = requestAnimationFrame(medir);
      }).observe(stage);

      new ResizeObserver((ent) => {
        const w = ent[0].contentRect.width;
        tp.classList.toggle("compact", w < 460);
        tp.classList.toggle("narrow", w < 340);
      }).observe(tp);
    }

    // duplo clique no topo = tela cheia; Esc sai
    barra.addEventListener("dblclick", (e) => {
      if (e.target.closest("button")) return;
      telaCheia(!cfg.fullscreen);
    });
    raiz.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && (cfg.fullscreen || zen) && !paneEditor.classList.contains("on")) {
        e.stopPropagation();
        telaCheia(false);
      }
    });
    document.addEventListener("fullscreenchange", () => {
      if (modoPagina && zen && !document.fullscreenElement) medir();
    });

    // ------------------------------------------------------------- ciclo de vida
    async function montar() {
      if (montado) return api;
      cfg = await P.loadSettings();
      painel = await P.loadPanel();
      roteiro = await P.loadScript();
      container.appendChild(host);
      montado = true;
      renderTexto();
      aplicarCfg();
      definirModo("voz");
      if (!modoPagina && (!cfg.overlayVisible || opts.startHidden)) host.style.display = "none";
      // reagir a mudanças feitas nas opções / em outra aba
      P.onChange(({ settings, script }) => {
        if (settings) {
          const antesVisivel = cfg.overlayVisible;
          cfg = Object.assign({}, P.DEFAULTS, settings);
          aplicarCfg();
          if (!modoPagina && cfg.overlayVisible !== antesVisivel) {
            host.style.display = cfg.overlayVisible ? "" : "none";
          }
        }
        if (typeof script === "string" && script !== roteiro) {
          roteiro = script;
          renderTexto();
        }
      });
      return api;
    }

    const api = {
      montar, mostrar, esconder, alternarVisivel,
      tocar, pausar, alternar, reiniciar, empurrar, telaCheia,
      mudarVel, mudarFonte, abrirEditor, definirModo,
      get modo() { return modo; },
      get tocando() { return tocando || contando; },
      get visivel() { return host.style.display !== "none"; },
      get cfg() { return cfg; },
      get progresso() { return maxOffset ? +(offset / maxOffset).toFixed(3) : 0; },
      get linhaAtual() {
        const alvo = offset + stage.clientHeight * (cfg.guidePos / 100);
        let melhor = "";
        let dist = Infinity;
        for (const p of txt.children) {
          const d = Math.abs(p.offsetTop + p.offsetHeight / 2 - alvo);
          if (d < dist) { dist = d; melhor = (p.textContent || "").trim(); }
        }
        return melhor;
      },
      setCfg(patch) { Object.assign(cfg, patch); aplicarCfg(); },
      setRoteiro(t) { roteiro = t; renderTexto(); },
      alternarVoz, ativarVoz, desativarVoz,
      get vozAtiva() { return vozAtiva; }
    };
    return api;
  }

  P.createPrompter = createPrompter;
})();
