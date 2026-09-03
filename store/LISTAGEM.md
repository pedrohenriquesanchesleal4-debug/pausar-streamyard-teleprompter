# Textos para a listagem na loja (Edge Add-ons / Chrome Web Store)

Copiar e colar nos campos do Partner Center. Tudo já dentro dos limites de caracteres.

## Nome (até 45)

(32 caracteres)

```
Pausar StreamYard + Teleprompter
```

## Descrição curta (até 132)

(116 caracteres)

```
Teleprompter no painel lateral e sobre o StreamYard: uma tecla pausa a gravação e a rolagem do texto ao mesmo tempo.
```

## Descrição completa (até 10.000)

(3274 caracteres)

```
Gravar no StreamYard lendo um roteiro costuma virar malabarismo: o teleprompter está em outra aba ou em outro site, e quando você precisa parar para respirar, tossir ou corrigir uma frase, tem que pausar a gravação em um lugar e o texto em outro — e as duas coisas nunca param juntas.

Esta extensão resolve isso com uma tecla. O atalho (padrão Ctrl+Espaço, e você pode trocar) pausa e retoma a gravação do StreamYard e a rolagem do texto ao mesmo tempo.

TRÊS JEITOS DE USAR, O MESMO ROTEIRO

• Painel lateral do navegador, com abas Teleprompter, Ajustes e Registro — encaixado ao lado do estúdio, com largura ajustável, sem cobrir nada.
• Sobreposto ao StreamYard, em modo fantasma: semitransparente e com os cliques atravessando o painel, então você continua operando o estúdio normalmente por baixo. Arraste e redimensione onde quiser.
• Em janela separada, para segundo monitor ou tablet.

Os três compartilham roteiro, ajustes e estado, e pausam juntos.

O TELEPROMPTER

• Rolagem suave, de 5 a 300 px/s, com aceleração pelo teclado
• Contagem regressiva antes de voltar a rolar, tanto ao iniciar quanto ao retomar (padrão 5 s, configurável ou desligável) — dá tempo de respirar e entrar na fala
• Espelhamento horizontal e vertical, para uso com vidro de teleprompter
• Fonte, entrelinha, largura da coluna, alinhamento, cores e opacidade do fundo
• Linha de leitura com posição regulável e bordas desbotadas, para o olho não perder o ponto
• Barra de progresso com tempo gasto e restante, modo foco e tela cheia
• Editor embutido, com contagem de palavras e estimativa de duração da fala
• Importa o roteiro de um arquivo .txt
• Clique no texto dá play/pause; a roda do mouse move o roteiro na mão

ATALHOS, TODOS CONFIGURÁVEIS

• Ctrl+Espaço — pausa e retoma gravação + rolagem
• Alt+Espaço — pausa só o teleprompter
• Ctrl+Setas — empurra o roteiro um pouco, sem parar a rolagem
• Alt+Setas — acelera e desacelera
• Alt+Shift+Setas — aumenta e diminui a fonte
• Alt+T — esconde e mostra o teleprompter
• Alt+R — volta ao início
• Alt+M — crava um marcador no registro

REGISTRO DE PAUSAS, PARA A EDIÇÃO

Cada pausa e retomada é anotada com o timecode da gravação — a posição no arquivo final, não a hora do relógio. Como o StreamYard não grava enquanto está pausado, esse número é exatamente o ponto da emenda no vídeo.

O registro sai em JSON e CSV e leva também a linha do roteiro que estava sendo lida em cada ponto. Na hora de editar, você vai direto na emenda em vez de procurar no timeline. O Alt+M marca um "corta aqui" sem pausar nada.

E QUANDO O BOTÃO MUDA DE LUGAR

A extensão identifica sozinha o botão de gravação do StreamYard, inclusive quando ele é só um ícone, e nunca clica em "Encerrar transmissão", "Sair do estúdio" ou parecidos. Se a interface mudar, o modo aprender resolve: clique no alvo (🎯) e depois no botão real, uma vez. Há uma tela de diagnóstico mostrando o que foi localizado.

PRIVACIDADE

Nenhuma requisição de rede, nenhum analytics, nenhum dado enviado para fora. Ajustes, roteiro e registro ficam apenas no seu navegador, e você apaga tudo quando quiser.

Código aberto, com o repositório em
https://github.com/pedrohenriquesanchesleal4-debug/pausar-streamyard-teleprompter

Extensão independente, sem vínculo com o StreamYard.
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
