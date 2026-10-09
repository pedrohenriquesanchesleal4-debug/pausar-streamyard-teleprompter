// src/streamyard-target.js — acha e clica no botão de gravação do StreamYard.
// Estratégia: 1) seletor salvo pelo usuário  2) heurística com pontuação  3) avisa que não achou.
(function () {
  const P = window.PausarExt;
  if (!P || P.streamyard) return;

  // termos que indicam pausar/retomar/parar gravação (peso maior = melhor candidato)
  const BONS = [
    { re: /(pausar|pause)\s*(a\s*)?(grava|record)/i, peso: 100 },
    { re: /(retomar|continuar|resume)\s*(a\s*)?(grava|record)/i, peso: 100 },
    // botão só de ícone: aria-label="Pausar" / "Retomar" (é o caso do StreamYard)
    { re: /(^|\|)\s*(pausar|pause)\s*(\||$)/i, peso: 94 },
    { re: /(^|\|)\s*(retomar|continuar|resume)\s*(\||$)/i, peso: 92 },
    { re: /lucide-pause|icon-pause|pause-icon|pauseicon/i, peso: 88 },
    { re: /(parar|stop)\s*(a\s*)?(grava|record)/i, peso: 70 },
    { re: /(iniciar|começar|start)\s*(a\s*)?(grava|record)/i, peso: 60 },
    { re: /^(gravar|record|rec)$/i, peso: 55 },
    { re: /lucide-play|lucide-circle-play|icon-play/i, peso: 46 },
    { re: /grava(ç|c)(ão|ao)|recording/i, peso: 35 },
    { re: /record|grava/i, peso: 20 }
  ];

  // nunca clicar nisso (encerraria a transmissão, sairia do estúdio, apagaria coisas…)
  const PROIBIDOS = /encerrar\s*(a\s*)?transmiss|end\s*(broadcast|stream)|finalizar\s*transmiss|sair\s*do\s*est(ú|u)dio|leave\s*studio|excluir|apagar|delete|remove|banir|kick|convidar|invite|sign\s*out|logout|encerrar\s*sess/i;

  function visivel(el) {
    if (!el || !el.isConnected) return false;
    if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity || "1") > 0.05;
  }

  function textoDe(el) {
    // o botão do StreamYard é só ícone: o nome vive no aria-label e na classe do <svg>
    const svg = el.querySelector("svg");
    const partes = [
      el.getAttribute("aria-label") || "",
      el.getAttribute("title") || "",
      el.getAttribute("data-testid") || "",
      el.getAttribute("data-test") || "",
      el.getAttribute("name") || "",
      (el.textContent || "").trim().slice(0, 80),
      svg ? (svg.getAttribute("class") || "") : "",
      typeof el.className === "string" ? el.className : ""
    ];
    return partes.join(" | ");
  }

  function pontuar(el) {
    const t = textoDe(el);
    if (!t.trim()) return 0;
    if (PROIBIDOS.test(t)) return -1;
    let p = 0;
    for (const b of BONS) if (b.re.test(t)) p = Math.max(p, b.peso);
    if (!p) return 0;
    // pistas fracas (só a palavra "record" num data-testid) só contam em botão de verdade
    const ehBotao = el.matches('button, [role="button"], a');
    if (p < 30 && !ehBotao) return 0;
    // botões dentro da barra de controles do estúdio tendem a ficar embaixo
    const r = el.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.6) p += 6;
    return p;
  }

  function acharBotao() {
    const cand = Array.from(document.querySelectorAll(
      'button, [role="button"], a[href="#"], [data-testid], [class*="record" i]'
    ));
    let melhor = null, melhorP = 0;
    for (const el of cand) {
      if (!visivel(el)) continue;
      const p = pontuar(el);
      if (p > melhorP) { melhorP = p; melhor = el; }
    }
    return melhorP > 0 ? { el: melhor, peso: melhorP } : null;
  }

  function clicavel(el) {
    // se o seletor pegou um ícone/span, sobe até o botão de verdade
    return el.closest('button, [role="button"], a') || el;
  }

  function clicar(el) {
    const alvo = clicavel(el);
    alvo.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    alvo.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    alvo.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
    alvo.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    alvo.click();
    return alvo;
  }

  // ---------------------------------------------------------------- ação principal
  async function pausarGravacao(cfg) {
    const s = cfg || (await P.loadSettings());

    // o botão troca de aria-label ao pausar ("Pausar" -> "Retomar"), então tentamos
    // o seletor salvo e depois um caminho no DOM que não depende do rótulo
    for (const [chave, via] of [["streamyardSelector", "seletor"], ["streamyardSelectorAlt", "seletor alternativo"]]) {
      const sel = s[chave];
      if (!sel) continue;
      let el = null;
      try { el = document.querySelector(sel); } catch (_) { el = null; }
      if (el && visivel(el)) {
        const antes = rotulo(el);
        const timers = snapshotTimers();
        const estadoAntes = estadoPelosTimers() || estadoDe(el);
        const timecode = lerTimecode();
        const alvo = clicar(el);
        return { ok: true, via, label: rotulo(alvo), antes, estadoAntes, timecode, timers };
      }
    }

    const achado = acharBotao();
    if (achado) {
      const antes = rotulo(achado.el);
      const timers = snapshotTimers();
      const estadoAntes = estadoPelosTimers() || estadoDe(achado.el);
      const timecode = lerTimecode();
      const alvo = clicar(achado.el);
      return { ok: true, via: "heurística", label: rotulo(alvo), antes, estadoAntes, timecode, timers };
    }
    return { ok: false, via: "nenhum", label: "" };
  }

  // "gravando" (o clique vai pausar), "pausado" (vai retomar), "parado" (vai iniciar)
  function estadoDe(el) {
    const t = textoDe(el);
    if (/retomar|continuar|resume|lucide-play/i.test(t)) return "pausado";
    if (/pausar|pause|lucide-pause/i.test(t)) return "gravando";
    if (/gravar|record|iniciar|start/i.test(t)) return "parado";
    return "desconhecido";
  }

  // ---------------------------------------------------------------- cronometro
  // O timecode do arquivo final vem do cronometro da gravacao. Achar "algum texto
  // tipo 00:15" na tela nao serve: pega rotulo estatico. Entao a extensao observa a
  // pagina de segundo em segundo e so aceita um elemento que ESTA ANDANDO.
  const RE_TC = /^(?:[0-9]{1,2}:)?[0-9]{1,2}:[0-9]{2}$/;

  let timerEl = null;        // cronometro confirmado
  let timerSel = "";         // seletor informado pelo usuario (tem prioridade)
  let gravando = true;       // enquanto pausado nao aprende (o cronometro fica parado)
  let amostras = new Map();
  let monitorId = 0;

  // ---- cronômetros nomeados do StreamYard -------------------------------
  // O estúdio monta o relógio com UM <span> POR DÍGITO dentro de
  // <div class="Timer__TimerWrapper-...">, e a etiqueta em volta diz o que é:
  //   <span class="Tags__LiveTag-...">Gravações<div class="Timer__TimerWrapper-...">3:13</div></span>
  //   <span class="Tags__PausedTag-...">Pausado<div class="Timer__TimerWrapper-...">3:00</div></span>
  // Varrer só elementos-folha nunca acha isso (cada folha é "3", ":", "1"...),
  // então aqui a leitura é feita no wrapper, juntando o texto dos filhos.
  const RE_ROTULO_GRAV = /grava|record/i;
  const RE_ROTULO_PAUSA = /pausad|paused/i;

  function lerTimers() {
    const res = { gravacao: null, pausa: null, outros: [] };
    const wrappers = document.querySelectorAll(
      '[class*="Timer__TimerWrapper"], [class*="TimerWrapper"], [class*="Timer__"]'
    );
    for (const w of wrappers) {
      const txt = (w.textContent || "").replace(/\s+/g, "");
      if (!RE_TC.test(txt)) continue;
      const seg = P.timecodeParaSeg(txt);
      if (seg == null || !visivel(w)) continue;

      // a etiqueta é o texto do ancestral sem os dígitos ("Gravações3:13" -> "Gravações")
      let rotulo = "";
      let pai = w.parentElement;
      for (let i = 0; pai && i < 3 && !rotulo; i++) {
        rotulo = (pai.textContent || "").replace(/\s+/g, " ").replace(/[\d:\s]+$/, "").trim();
        pai = pai.parentElement;
      }

      const item = { txt, seg, rotulo, el: w };
      if (RE_ROTULO_PAUSA.test(rotulo)) res.pausa = res.pausa || item;
      else if (RE_ROTULO_GRAV.test(rotulo)) res.gravacao = res.gravacao || item;
      else res.outros.push(item);
    }
    // sem etiqueta reconhecida, o primeiro relógio visível serve de gravação
    if (!res.gravacao && res.outros.length) res.gravacao = res.outros[0];
    return res;
  }

  // a etiqueta "Pausado" existir é o sinal mais confiável de que a gravação está pausada
  function estadoPelosTimers() {
    const t = lerTimers();
    if (t.pausa) return "pausado";
    if (t.gravacao) return "gravando";
    return null;
  }

  // dados simples (sem elemento DOM) para viajar em mensagem e ir para o log
  function snapshotTimers() {
    const t = lerTimers();
    return {
      gravacaoTxt: t.gravacao ? t.gravacao.txt : "",
      gravacaoSeg: t.gravacao ? t.gravacao.seg : null,
      gravacaoRotulo: t.gravacao ? t.gravacao.rotulo : "",
      pausaTxt: t.pausa ? t.pausa.txt : "",
      pausaSeg: t.pausa ? t.pausa.seg : null
    };
  }

  function varrerTimecodes() {
    const out = [];
    for (const el of document.querySelectorAll("span, div, p, time, b, strong, label")) {
      if (el.children && el.children.length) continue;
      const t = (el.textContent || "").trim();
      if (t.length > 8 || !RE_TC.test(t)) continue;
      if (!visivel(el)) continue;
      const seg = P.timecodeParaSeg(t);
      if (seg == null) continue;
      out.push({ el, t, seg });
    }
    return out;
  }

  function timerValido() {
    if (!timerEl || !timerEl.isConnected) return false;
    return P.timecodeParaSeg((timerEl.textContent || "").trim()) != null;
  }

  function tique() {
    if (timerValido()) return;            // já temos um; nada a fazer
    if (!gravando) return;                // pausado: cronometro parado, não dá para aprender
    timerEl = null;

    const atuais = varrerTimecodes();
    const vistos = new Set();
    const confirmados = [];

    for (const c of atuais) {
      vistos.add(c.el);
      const a = amostras.get(c.el);
      if (!a) { amostras.set(c.el, { seg: c.seg, subiu: 0 }); continue; }
      if (c.seg > a.seg && c.seg - a.seg <= 5) a.subiu += 1;   // andou como relógio
      else if (c.seg !== a.seg) a.subiu = 0;                   // pulou/voltou: não é
      a.seg = c.seg;
      if (a.subiu >= 2) confirmados.push(c);
    }
    for (const el of Array.from(amostras.keys())) if (!vistos.has(el)) amostras.delete(el);

    if (!confirmados.length) return;
    // pode haver mais de um relógio (duração da live x da gravação):
    // fica com o mais perto do botão de gravação
    const botao = acharBotao();
    if (botao && confirmados.length > 1) {
      const r = botao.el.getBoundingClientRect();
      confirmados.sort((a, b) => dist(a.el, r) - dist(b.el, r));
    }
    timerEl = confirmados[0].el;
    console.log("[Pausar Ext] cronômetro da gravação identificado:", confirmados[0].t);
  }

  function dist(el, r) {
    const q = el.getBoundingClientRect();
    return Math.hypot(q.left - r.left, q.top - r.top);
  }

  function monitorarTimer(sel, estaGravando) {
    if (sel !== undefined) timerSel = sel || "";
    if (estaGravando !== undefined) gravando = !!estaGravando;
    if (monitorId) return;
    monitorId = setInterval(tique, 1000);
    tique();
  }

  function setGravando(v) { gravando = !!v; }

  // devolve "" quando não há cronômetro confirmado — melhor calcular o timecode
  // do que gravar um número errado no log
  function lerTimecode() {
    // 1) cronômetro nomeado do estúdio ("Gravações")
    const t = lerTimers();
    if (t.gravacao) return t.gravacao.txt;
    // 2) seletor informado pelo usuário
    if (timerSel) {
      try {
        const el = document.querySelector(timerSel);
        const t = ((el && el.textContent) || "").trim();
        if (P.timecodeParaSeg(t) != null) return t;
      } catch (_) {}
    }
    return timerValido() ? (timerEl.textContent || "").trim() : "";
  }

  function rotulo(el) {
    const t = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim();
    return t.replace(/\s+/g, " ").slice(0, 40);
  }

  function testarSeletor(sel) {
    try {
      const el = document.querySelector(sel);
      if (!el) return { ok: false, msg: "Nenhum elemento com esse seletor nesta aba." };
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const antes = el.style.outline;
      el.style.outline = "3px solid #22c55e";
      setTimeout(() => { el.style.outline = antes; }, 2000);
      return { ok: true, msg: "Achei: " + (rotulo(el) || el.tagName.toLowerCase()) };
    } catch (e) {
      return { ok: false, msg: "Seletor inválido: " + e.message };
    }
  }

  // ---------------------------------------------------------------- modo aprender
  function caminhoDom(el) {
    const alvo = clicavel(el);
    const partes = [];
    let n = alvo;
    for (let i = 0; n && n.nodeType === 1 && n.tagName !== "BODY" && i < 8; i++) {
      let p = n.tagName.toLowerCase();
      const pai = n.parentElement;
      if (pai) {
        const irmaos = Array.from(pai.children).filter((c) => c.tagName === n.tagName);
        if (irmaos.length > 1) p += ":nth-of-type(" + (irmaos.indexOf(n) + 1) + ")";
      }
      partes.unshift(p);
      if (n.id && !/^[0-9]|:|\d{4,}/.test(n.id)) { partes[0] = "#" + cssEsc(n.id); break; }
      n = pai;
    }
    return partes.join(" > ");
  }

  function construirSeletor(el) {
    const alvo = clicavel(el);

    const tid = alvo.getAttribute("data-testid") || alvo.closest("[data-testid]")?.getAttribute("data-testid");
    if (tid) return '[data-testid="' + cssEsc(tid) + '"]';

    const aria = alvo.getAttribute("aria-label");
    if (aria) return alvo.tagName.toLowerCase() + '[aria-label="' + cssEsc(aria) + '"]';

    if (alvo.id && !/^[0-9]|:|\d{4,}/.test(alvo.id)) return "#" + cssEsc(alvo.id);

    // caminho curto com nth-of-type
    const partes = [];
    let n = alvo;
    for (let i = 0; n && n.nodeType === 1 && i < 6; i++) {
      let p = n.tagName.toLowerCase();
      const pai = n.parentElement;
      if (pai) {
        const irmaos = Array.from(pai.children).filter((c) => c.tagName === n.tagName);
        if (irmaos.length > 1) p += ":nth-of-type(" + (irmaos.indexOf(n) + 1) + ")";
      }
      partes.unshift(p);
      if (n.id && !/^[0-9]|:|\d{4,}/.test(n.id)) { partes[0] = "#" + cssEsc(n.id); break; }
      n = pai;
    }
    return partes.join(" > ");
  }

  function cssEsc(v) {
    return window.CSS && CSS.escape ? CSS.escape(v).replace(/\\"/g, '"') : String(v).replace(/"/g, '\\"');
  }

  // pede para o usuário clicar no botão real; devolve o seletor
  function aprender(cb) {
    const aviso = document.createElement("div");
    aviso.textContent = "Clique no botão de gravação do StreamYard (Esc cancela)";
    Object.assign(aviso.style, {
      position: "fixed", left: "50%", top: "12px", transform: "translateX(-50%)",
      zIndex: "2147483647", background: "#2563eb", color: "#fff", padding: "8px 14px",
      borderRadius: "10px", font: "600 13px system-ui, sans-serif", pointerEvents: "none",
      boxShadow: "0 6px 20px rgba(0,0,0,.4)"
    });
    document.documentElement.appendChild(aviso);
    document.documentElement.style.cursor = "crosshair";

    function limpar() {
      aviso.remove();
      document.documentElement.style.cursor = "";
      document.removeEventListener("click", noClique, true);
      document.removeEventListener("keydown", noEsc, true);
    }
    function noClique(e) {
      e.preventDefault();
      e.stopPropagation();
      const sel = construirSeletor(e.target);
      const alt = caminhoDom(e.target);
      limpar();
      cb(sel, alt);
    }
    function noEsc(e) {
      if (e.key === "Escape") { limpar(); cb(null); }
    }
    document.addEventListener("click", noClique, true);
    document.addEventListener("keydown", noEsc, true);
  }

  P.streamyard = {
    pausarGravacao, acharBotao, testarSeletor, aprender,
    construirSeletor, caminhoDom, estadoDe, lerTimecode,
    monitorarTimer, setGravando, lerTimers, snapshotTimers, estadoPelosTimers,
    get timerOk() { return !!lerTimers().gravacao || timerValido() || !!(timerSel && lerTimecode()); }
  };
})();
