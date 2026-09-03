# Formulário de conformidade — Edge Add-ons

Respostas para o formulário de práticas de privacidade do Partner Center.
Copiar e colar em cada campo; todas dentro do limite de 1000 caracteres
(2048 no campo da URL). Conferidas contra o código em 2.7.1.

## Descrição de propósito único

(947 caracteres)

```
Servir de teleprompter para quem grava e transmite no StreamYard, com um atalho único que pausa e retoma, ao mesmo tempo, a gravação no StreamYard e a rolagem do texto do teleprompter.

Tudo na extensão existe para esse propósito: exibir o roteiro (no painel lateral do navegador, sobreposto à página do StreamYard ou em uma janela separada), controlar a rolagem desse texto (velocidade, tamanho da fonte, espelhamento para vidro de teleprompter) e acionar o botão de gravação do StreamYard junto com essa rolagem por meio de um atalho de teclado configurável (padrão Ctrl+Espaço).

Como complemento do mesmo propósito, a extensão anota localmente o momento de cada pausa e retomada, com o timecode correspondente da gravação, para que o usuário encontre depois esses pontos ao editar o vídeo.

A extensão não faz nada além disso: não altera páginas de outros sites, não injeta conteúdo em navegação comum e não realiza nenhuma requisição de rede.
```

## Justificativa de armazenamento (storage)

(888 caracteres)

```
Necessária para guardar, no próprio navegador do usuário, aquilo que a extensão precisa lembrar entre sessões:

1. Preferências (chrome.storage.sync): atalhos de teclado escolhidos pelo usuário, velocidade de rolagem, tamanho e família da fonte, entrelinha, cores, opacidade, espelhamento, tempo da contagem regressiva e os seletores CSS opcionais do botão de gravação.

2. Roteiro do teleprompter e geometria do painel (chrome.storage.local): o texto que será lido, que pode passar do limite de 8 KB por item do storage.sync, e a posição/tamanho em que o usuário deixou o painel.

3. Registro de pausas (chrome.storage.local): horário, timecode da gravação e a linha do roteiro em cada pausa, para exportação em JSON/CSV pelo próprio usuário.

Sem essa permissão o usuário perderia o roteiro e todos os ajustes a cada recarregamento. Nenhum desses dados é enviado para fora do navegador.
```

## Justificativa dos tabs

(853 caracteres)

```
Necessária para que o comando de pausar alcance a aba certa e para informar o estado ao usuário.

Usos concretos no código:

1. chrome.tabs.query filtrando pelas URLs do StreamYard e do teleprompter.works, para localizar as abas onde a extensão atua. Quando o usuário aciona o atalho global do navegador (que funciona mesmo com outra aba em foco) ou os botões do painel lateral, a extensão precisa descobrir essa aba para entregar o comando.

2. chrome.tabs.sendMessage para essas abas, transportando as ações de pausar/retomar, empurrar o roteiro e marcar um ponto no registro.

3. Leitura apenas do id e da URL dessas mesmas abas, para o painel lateral indicar se o StreamYard está aberto, se o usuário está dentro de um estúdio e se o botão de gravação foi localizado.

A extensão não lê histórico de navegação nem o conteúdo de abas de outros sites.
```

## Justificativa de scripts (scripting)

(884 caracteres)

```
Usada em um único caso: reinjetar os próprios arquivos da extensão nas abas do StreamYard/teleprompter.works que já estavam abertas quando a extensão é instalada ou atualizada.

Sem isso, o content script antigo (ou nenhum) continua na página e a extensão simplesmente não responde até o usuário recarregar a aba manualmente, o que é péssimo no meio de uma gravação. Com a permissão, chrome.scripting.executeScript recoloca os scripts e o usuário volta a ter o atalho funcionando na hora.

A chamada é restrita: o destino são apenas as abas que casam com as host permissions já declaradas, e os arquivos injetados são exclusivamente os que vêm dentro do pacote (src/shared.js, src/prompter.js, src/streamyard-target.js, src/content-streamyard.js e src/content-teleprompter.js). A extensão nunca injeta código gerado em tempo de execução, string avaliada ou arquivo obtido da internet.
```

## Justificativa do sidePanel

(725 caracteres)

```
É a interface principal da extensão. O teleprompter é exibido no painel lateral do navegador (chrome.sidePanel), ao lado da página do StreamYard, com as abas Teleprompter, Ajustes e Registro de pausas.

O painel lateral é o formato adequado para este caso de uso porque o texto precisa ficar visível de forma contínua enquanto a pessoa grava, sem cobrir os controles do estúdio e com largura ajustável pelo usuário. É a alternativa a sobrepor conteúdo à página, que atrapalharia o uso do StreamYard.

A extensão também usa chrome.sidePanel.setPanelBehavior para que o clique no ícone da extensão abra esse painel, e chrome.sidePanel.open quando o usuário pede o painel por um botão ou atalho. Nenhum outro uso é feito da API.
```

## Justificativa de permissão do host

(844 caracteres)

```
As host permissions são apenas *://*.streamyard.com/* e *://*.teleprompter.works/*, os dois sites onde a extensão precisa atuar. Nenhum outro site é acessado.

Em streamyard.com, o content script precisa:
1. desenhar o teleprompter sobre a página (em Shadow DOM, para não afetar o layout do estúdio);
2. receber o atalho de teclado enquanto a página está em foco;
3. ler o rótulo de botões (aria-label, title, texto e classe do ícone) para identificar o botão de pausar/retomar gravação, e clicar nele quando o usuário aciona o atalho;
4. ler o texto do cronômetro da gravação, para anotar o timecode da pausa no registro local.

Em teleprompter.works, o mesmo atalho pausa a rolagem de quem usa aquele site como teleprompter externo.

Esse conteúdo é usado na hora, não é transmitido para lugar algum e apenas o timecode fica salvo localmente.
```

## Código remoto — justificativa (resposta: NÃO)

(703 caracteres)

```
Não. Todo o JavaScript e HTML executado pela extensão está dentro do pacote enviado.

A extensão não carrega script externo (não há tag <script> apontando para outro domínio, nem import dinâmico, nem CDN), não usa eval() nem new Function(), não usa WebAssembly e não faz nenhuma requisição de rede: não há fetch, XMLHttpRequest ou WebSocket em nenhum arquivo. Não existe servidor, analytics ou telemetria.

Os únicos endereços externos presentes no código são links que abrem uma aba comum quando o usuário clica em um botão da interface (a página inicial do StreamYard, a página de atalhos do navegador e o repositório do projeto). Isso é navegação iniciada pelo usuário, não execução de código remoto.
```

## Dados de usuário coletados

(581 caracteres)

```
Nenhum. Não marcar nenhuma das categorias (informações de identificação pessoal, saúde, financeiras, autenticação, comunicações pessoais, localização, histórico de navegação, atividade do usuário ou conteúdo de sites).

A extensão não coleta nem transmite dado nenhum. O que ela guarda — ajustes, roteiro e registro de pausas — fica exclusivamente no armazenamento local do navegador do próprio usuário, sob o controle dele, e nunca é enviado à extensão, ao desenvolvedor ou a terceiros. A única saída possível é o próprio usuário exportar o registro em JSON/CSV para o disco dele.
```

## URL da política de privacidade

(102 caracteres)

```
https://github.com/pedrohenriquesanchesleal4-debug/pausar-streamyard-teleprompter/blob/main/PRIVACY.md
```

## Certificações finais

Marcar as três — todas verdadeiras para esta extensão:

- não vendo nem transfiro dados do usuário a terceiros;
- não uso nem transfiro dados do usuário para propósitos alheios ao propósito único do item;
- não uso nem transfiro dados do usuário para determinar capacidade financeira ou crédito.

Não coletando dado nenhum, as três são satisfeitas por vacuidade.
