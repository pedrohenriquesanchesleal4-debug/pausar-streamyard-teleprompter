# Pausar StreamYard + Teleprompter (v2)

Teleprompter próprio desenhado **em cima do StreamYard** (dá para deixar semitransparente e
com "modo fantasma", então o StreamYard continua clicável por baixo) e **uma tecla só**
— padrão `Ctrl + Espaço` — que pausa/retoma **a gravação e a rolagem do texto juntas**.

## Instalar

1. Abra `chrome://extensions/`
2. Ligue o **Modo do desenvolvedor** (canto superior direito)
3. **Carregar sem compactação** → escolha esta pasta (`pausar-extensao`)
4. Abra/recarregue (F5) a aba do StreamYard

> Depois de qualquer atualização da extensão, dê F5 na aba do StreamYard —
> content scripts antigos não se atualizam sozinhos.

## Painel lateral (como o Claude in Chrome)

Três abas: **Teleprompter · Ajustes · Log**. Ajustes e Log são a própria página de opções
embutida (`options.html?vista=ajustes` / `?vista=log`), então não há tela duplicada para manter —
o que você muda ali vale em todo lugar na hora.

Clique no **ícone da extensão** → o teleprompter abre no **painel lateral nativo do Chrome**
(`chrome.sidePanel`): fica encaixado ao lado da página, você arrasta a borda para escolher a largura
e o StreamYard não fica coberto. A barrinha do topo do painel tem `⏸ Tudo` (pausa gravação + rolagem),
`🚩` (marcador no log), `👁` (esconde/mostra o teleprompter sobre a página), `🗔` (janela separada)
e `↗` (abre os ajustes em uma aba inteira).

Dentro do StreamYard, o `🗔` da barrinha também abre o painel. Se o Chrome recusar
(a API exige gesto do usuário), clique no ícone da extensão.

Os três jeitos de usar dividem o mesmo roteiro e os mesmos ajustes, e pausam juntos:
**painel lateral**, **overlay sobre o StreamYard** e **janela separada** (segundo monitor).

## Como usar

- Dentro do estúdio (`/studio/...`) o teleprompter já aparece; nas outras telas do StreamYard
  ele começa escondido — `Alt + T` (ou o botão `Teleprompter` da barrinha) mostra.
- Arraste o painel pelo topo, redimensione pelo canto de baixo à direita.
- Embaixo à esquerda fica a **barrinha**: `⏸ Pausar tudo`, `Teleprompter`, `✎` (roteiro), `🚩` (marcador),
  `🎯` (ensinar o botão de gravação), `⚙` (ajustes) e `–` (encolher).
- Cole o roteiro no `✎` (ou na tela de ajustes; aceita importar `.txt`).
- `Ctrl + Espaço` pausa/retoma gravação + rolagem.

### Atalhos padrão (todos configuráveis)

| Atalho | O que faz |
|---|---|
| `Ctrl + Espaço` | pausa/retoma **gravação + teleprompter** |
| `Alt + Espaço` | pausa/retoma só o teleprompter |
| `Alt + T` | mostra/esconde o teleprompter |
| `Alt + R` | volta o roteiro ao início |
| `Alt + ↑` / `Alt + ↓` | acelera / desacelera |
| `Alt + Shift + ↑` / `↓` | fonte maior / menor |
| `Ctrl + ↑` / `Ctrl + ↓` | empurra o roteiro um pouco (passo em Ajustes → Rolagem, padrão 80 px) |
| `Alt + M` | 🚩 marca o momento no log |

Trocar: `⚙` → seção **Atalhos** → clique no atalho e aperte a combinação nova
(`Esc` cancela, `limpar` desliga aquele atalho).

Esses atalhos funcionam quando a página do StreamYard está na frente. Para funcionar
**com o Chrome em outra aba/janela**, o mesmo `Ctrl+Espaço` está registrado como atalho
global do Chrome — confira/troque em `chrome://extensions/shortcuts`.

## Teleprompter — o que tem

- Rolagem suave por `requestAnimationFrame`, velocidade de 5 a 300 px/s
- Play/pause clicando no próprio texto; roda do mouse move o roteiro na mão
- Contagem regressiva antes de rolar — **padrão 5 s, tanto ao iniciar quanto ao retomar**
  (Ajustes → Rolagem: segundos e o "contar também ao retomar"). Durante a contagem o texto
  continua legível e apertar o atalho de novo **cancela** em vez de recomeçar
- Repetir no fim (loop)
- Fonte (tamanho, família, negrito), entrelinha, espaço entre letras, alinhamento, largura da coluna
- Cor do texto, cor e **opacidade** do fundo
- **Espelhar ↔ e ↕** (para vidro de teleprompter)
- Linha de leitura com posição ajustável, bordas desbotadas
- **Modo fantasma** (`👻`): cliques atravessam o painel — fica em segundo plano sobre o StreamYard
- Tela cheia pelo `⛶` **ou duplo clique na barra de topo** (`Esc` sai). No painel lateral o
  Chrome não permite tela cheia de verdade: o `⛶` vira **modo foco** (esconde controles e
  barra de progresso, o texto ocupa tudo). A **largura do painel lateral** se muda arrastando
  a borda dele — quem tem alça de redimensionar é o overlay sobre a página (canto de baixo à direita)
- Esconder barras enquanto rola, barra de progresso e tempo gasto/restante
- Editor embutido com contagem de palavras e estimativa de tempo (150 palavras/min)
- **Janela separada** (Ajustes → “Abrir teleprompter em janela separada”) para segundo monitor;
  obedece aos mesmos atalhos
- Prévia ao vivo na tela de ajustes

## Registro de pausas (para cortar depois)

Cada pausa/retomada vira um evento em `chrome.storage.local`, com o **timecode da gravação** —
a posição no arquivo final. Como o StreamYard não grava enquanto está pausado, esse número é
exatamente o ponto da emenda no vídeo.

Ajustes → **Registro de pausas**: tabela ao vivo, **Baixar JSON**, **Baixar CSV**, copiar e limpar.
`🚩 Alt+M` (ou o 🚩 da barrinha) crava um marcador sem pausar nada — "corta aqui".

Formato de cada evento:

```json
{
  "tipo": "pausa",                       // pausa | retomada | inicio | marcador
  "sessao": "2026-09-03T10:00:00.000Z",  // nova sessão após 4 h sem eventos
  "iso": "2026-09-03T10:00:00.000Z",
  "hora": "07:00:00",
  "timecode": "00:00:30",                // posição no arquivo gravado
  "tGravado": 30,                        // o mesmo, em segundos
  "timecodeStreamYard": "00:00:30",       // cronômetro do estúdio, quando dá para ler
  "timecodeAproximado": false,           // true = somado pela extensão
  "duracaoPausa": 12,                    // só na retomada: quanto ficou pausado
  "botao": "Pausar",
  "roteiro": { "progresso": 0.42, "linha": "linha que estava na linha de leitura" },
  "url": "https://streamyard.com/studio/..."
}
```

O timecode vem do cronômetro do StreamYard quando a extensão consegue lê-lo na tela; senão é
somado aqui (tempo em que a gravação ficou rodando) e sai marcado como `timecodeAproximado`.

**Como o cronômetro é achado:** procurar "algum texto tipo `00:15`" na tela não serve — pega
rótulo estático (era o bug que fazia todos os eventos sairem com o mesmo timecode). A extensão
observa a página de segundo em segundo e só aceita um elemento que **está andando** como relógio
(+1 s por segundo, duas vezes seguidas). Havendo mais de um relógio (duração da live x da
gravação), fica com o mais perto do botão de gravação, e não tenta aprender enquanto a gravação
está pausada (aí o cronômetro está parado). Se ainda assim sair errado, dá para fixar o
**seletor CSS do cronômetro** em Ajustes → StreamYard. O Diagnóstico mostra se ele foi
identificado.
Se você começou a gravar pelo botão do próprio StreamYard, o t=0 é estimado a partir do primeiro
evento visto — o cronômetro, quando disponível, corrige isso sozinho.

O JSON baixado agrupa por sessão e já lista os marcadores de cada uma. O CSV (`;`) abre direto
no Excel/Sheets.

## Quando "não pausa" — diagnóstico

`⚙` → seção **Diagnóstico** → **Verificar instalação**. Ele mostra:

- a versão realmente carregada (confere se o reload pegou);
- se o atalho global do Chrome ficou registrado ou saiu como *(não atribuído)* por conflito
  com outra extensão;
- cada aba do StreamYard: se o content script respondeu, se você está **dentro de um estúdio**
  e se o botão de gravação foi localizado.

**Fora do estúdio não existe botão de gravação.** Em `streamyard.com/welcome`, `/dashboard` etc.
o teleprompter funciona, mas não há o que pausar — entre em uma transmissão/gravação
(`/studio/...`).

O botão **Reconectar nas abas abertas** injeta os content scripts nas abas já abertas
(`chrome.scripting.executeScript`), então atualizar a extensão não exige mais F5 —
isso também acontece sozinho ao instalar/atualizar e quando o painel lateral vê uma aba
que não responde. Os scripts são idempotentes, reinjetar duas vezes não duplica nada.

## Como ele acha o botão de gravação

1. Se você salvou um **seletor CSS**, usa ele (e um seletor alternativo por posição no DOM,
   porque o botão do StreamYard troca de `aria-label` entre `Pausar` e `Retomar`).
2. Senão, procura por pontuação: `Pausar`, `Retomar`, `Pausar gravação`, `Parar gravação`,
   `Gravar`, `Record`… lendo `aria-label`, `title`, `data-testid`, o texto **e a classe do `<svg>`**
   (`lucide-pause` / `lucide-play`), porque no StreamYard o botão é só ícone.
   Ignora o que está invisível ou `aria-disabled="true"`.
3. Tem **lista de bloqueio**: nunca clica em “Encerrar transmissão”, “Sair do estúdio”,
   “Excluir”, “Convidar”, “Sair da conta” e afins.

Se o ponto da barrinha estiver **vermelho**, clique no `🎯` e depois no botão real —
a extensão monta o seletor sozinha (prefere `data-testid` → `aria-label` → `id` → caminho CSS).

Quer desligar o clique na gravação (usar só como teleprompter)?
Ajustes → **StreamYard** → desmarque “o atalho principal também clica no botão de gravação”.

## teleprompter.works

O suporte antigo continua: o mesmo atalho pausa o `teleprompter.works` (seletor salvo →
botão por texto → tecla espaço como último recurso) e avisa a aba do StreamYard.
Com o teleprompter embutido isso ficou opcional.

## Arquivos

```
manifest.json           MV3
src/shared.js           defaults, storage, parser de atalhos
src/prompter.js         motor do teleprompter (Shadow DOM, reusado no overlay/janela/prévia)
src/streamyard-target.js   acha/clica o botão de gravação + modo "aprender"
src/content-streamyard.js  overlay + barrinha + atalhos no StreamYard
src/content-teleprompter.js suporte ao teleprompter.works
src/background.js       atalhos globais do Chrome e repasse entre abas
pages/options.*         ajustes completos + prévia ao vivo
pages/sidepanel.*       teleprompter no painel lateral do Chrome
pages/prompter.*        teleprompter em janela separada
```

Ajustes ficam em `chrome.storage.sync`; o roteiro e a posição do painel em
`chrome.storage.local` (o roteiro pode passar do limite de 8 KB por item do `sync`).
As escritas são agrupadas (debounce) para não bater na cota do `sync`.
