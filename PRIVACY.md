# Política de privacidade — Pausar StreamYard + Teleprompter

Última atualização: 3 de setembro de 2026

## Resumo

Esta extensão **não coleta, não transmite e não vende nenhum dado**. Ela não faz nenhuma
requisição de rede: não há servidor, analytics, telemetria, rastreador ou anúncio.
Tudo o que ela guarda fica no seu próprio navegador.

## O que é armazenado, e onde

| Dado | Onde | Para quê |
|---|---|---|
| Ajustes (atalhos, velocidade, fonte, cores, seletores) | `chrome.storage.sync` | manter suas preferências; o navegador pode sincronizá-las entre seus dispositivos pela sua própria conta |
| Roteiro do teleprompter | `chrome.storage.local` | mostrar o texto na tela |
| Posição/tamanho do painel | `chrome.storage.local` | lembrar onde você deixou o teleprompter |
| Registro de pausas (horário, timecode, linha do roteiro no momento da pausa) | `chrome.storage.local` | permitir exportar JSON/CSV para achar os cortes na edição |

Nada disso sai do navegador, exceto pela sincronização de ajustes que o próprio
Chrome/Edge faz na sua conta, se você tiver essa opção ligada.

Você pode apagar tudo a qualquer momento: **Ajustes → Registro de pausas → Limpar registro**
e **Ajustes → Extras → Restaurar padrões**; remover a extensão também elimina o armazenamento.

## Por que cada permissão é necessária

- **`storage`** — salvar ajustes, roteiro e o registro de pausas localmente.
- **`tabs`** — encontrar as abas do StreamYard/teleprompter.works para enviar o comando de
  pausar. A extensão usa apenas o identificador e a URL dessas abas; não lê histórico
  nem conteúdo de outras abas.
- **`scripting`** — reinjetar os próprios scripts nas abas já abertas depois de instalar ou
  atualizar a extensão, evitando que o usuário precise recarregar a página.
- **`sidePanel`** — exibir o teleprompter no painel lateral do navegador.
- **Acesso a `streamyard.com` e `teleprompter.works`** — é onde a extensão precisa desenhar o
  teleprompter, ler o rótulo do botão de gravação e o cronômetro da gravação, e clicar nesse
  botão quando você usa o atalho. Nenhuma outra página é acessada.

## Conteúdo lido nas páginas

Dentro do StreamYard, a extensão lê apenas o necessário para funcionar: rótulos
(`aria-label`, `title`, texto) de botões, para achar o botão de gravação, e o texto do
cronômetro da gravação, para anotar o timecode das pausas. Esse conteúdo é usado na hora,
não é enviado para lugar nenhum e só o timecode fica salvo, localmente, no seu registro
de pausas.

## Contato

Dúvidas ou problemas: abra uma issue em
<https://github.com/pedrohenriquesanchesleal4-debug/pausar-streamyard-teleprompter/issues>.
