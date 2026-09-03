# Textos para a listagem na loja (Edge Add-ons / Chrome Web Store)

Copiar e colar nos campos do Partner Center. Tudo já dentro dos limites de caracteres.

## Nome (até 45)

```
Pausar StreamYard + Teleprompter
```

## Descrição curta / resumo (até 132)

```
Teleprompter no painel lateral e sobre o StreamYard, com uma tecla que pausa a gravação e a rolagem do texto juntas.
```

## Descrição completa

```
Um teleprompter feito para quem grava no StreamYard — e uma tecla só (padrão Ctrl+Espaço) que
pausa a gravação e a rolagem do texto ao mesmo tempo. Sem malabarismo com duas janelas.

TRÊS JEITOS DE USAR, MESMO ROTEIRO
• Painel lateral do navegador, com abas Teleprompter, Ajustes e Log
• Sobreposto ao StreamYard, com modo fantasma: semitransparente e com os cliques
  atravessando o painel, então o estúdio continua utilizável por baixo
• Janela separada, para segundo monitor ou tablet

TELEPROMPTER
• Rolagem suave de 5 a 300 px/s, com contagem regressiva ao iniciar e ao retomar
• Espelhamento horizontal e vertical, para vidro de teleprompter
• Fonte, entrelinha, largura da coluna, alinhamento, cores e opacidade ajustáveis
• Linha de leitura com posição regulável e bordas desbotadas
• Barra de progresso com tempo gasto e restante, modo foco e tela cheia
• Editor embutido com contagem de palavras e estimativa de duração da fala
• Importa roteiro de arquivo .txt

ATALHOS (todos configuráveis)
• Ctrl+Espaço — pausa e retoma gravação + rolagem
• Alt+Espaço — pausa só o teleprompter
• Ctrl+Setas — empurra o roteiro um pouco
• Alt+Setas — acelera e desacelera
• Alt+T — esconde e mostra
• Alt+M — crava um marcador no registro

REGISTRO DE PAUSAS PARA A EDIÇÃO
Cada pausa e retomada é anotada com o timecode da gravação, ou seja, a posição no arquivo
final. Exporta em JSON e CSV, com a linha do roteiro que estava sendo lida em cada ponto:
na hora de cortar, você vai direto na emenda.

PRIVACIDADE
Nenhuma requisição de rede, nenhum analytics, nenhum dado enviado para fora. Ajustes,
roteiro e registro ficam apenas no seu navegador.

Código aberto:
https://github.com/pedrohenriquesanchesleal4-debug/pausar-streamyard-teleprompter
```

## Categoria sugerida

`Produtividade` (Edge) / `Ferramentas` ou `Produtividade` (Chrome)

## Idioma

`Português (Brasil)`

## URL da política de privacidade

```
https://github.com/pedrohenriquesanchesleal4-debug/pausar-streamyard-teleprompter/blob/main/PRIVACY.md
```

## Justificativa de cada permissão (o revisor pergunta)

- **storage** — salvar ajustes, roteiro e registro de pausas no próprio navegador.
- **tabs** — localizar as abas do StreamYard/teleprompter.works para entregar o comando de
  pausar. Usa apenas id e URL dessas abas.
- **scripting** — reinjetar os scripts da própria extensão nas abas já abertas após
  instalar/atualizar, para o usuário não precisar recarregar a página.
- **sidePanel** — exibir o teleprompter no painel lateral.
- **host permissions (`streamyard.com`, `teleprompter.works`)** — desenhar o teleprompter na
  página, ler o rótulo do botão de gravação e o cronômetro, e clicar nesse botão quando o
  atalho é usado. Nenhum outro site é acessado.
- **Uso remoto de código**: nenhum. Todo o código está no pacote; a extensão não carrega
  script externo, não usa `eval` e não faz requisição de rede.

## Imagens

- `logo-300.png` — 300x300, logo obrigatório da loja do Edge
- `tile-440x280.png` — 440x280, tile promocional (opcional)
- **Capturas de tela**: obrigatórias (1 a 10, 1280x800 ou 640x480). Precisa tirar na mão.
  Boas capturas: (1) painel lateral com o roteiro rolando ao lado do estúdio,
  (2) overlay em modo fantasma sobre o StreamYard, (3) aba Log com a tabela de pausas,
  (4) aba Ajustes.
