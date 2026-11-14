# Landing do Journey

- **Data:** 14/11/2026
- **Status:** aprovada (14/11/2026), com os ajustes do ensaio (seções 3, 4, 6 e 8)
- **Direção escolhida:** A, "o próprio editor" (protótipo: https://claude.ai/artifact/FcPwhsAxaqeuFzpHDqenVe, primeira moldura)
- **Depende de:** etapa C (visualizador do link público, diagnóstico, login só com Google)

## 1. Objetivo

Quem abre o Journey sem estar logado vê uma página que explica o produto em segundos e convida a criar a conta. Hoje cai direto na `/entrar`, que é um formulário e uma prévia de um fluxo só.

A página tem uma tarefa: fazer a pessoa clicar em "Continuar com o Google" e criar a conta. Pra isso ela precisa mostrar, só de bater o olho, o que o Journey faz: desenhar um fluxo, dar play e ver onde o cliente chega, onde espera demais e onde se perde.

Público: quem cuida de atendimento e CX (URA, WhatsApp, SAC, filas) e quem desenha processos internos (aprovações, esteiras, onboarding).

## 2. Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Visual | A cara do próprio editor: quadro pontilhado, peças e canos do app, água com brilho suave | Parece produto, não ilustração genérica; o que a pessoa vê na landing é o que ela vai usar |
| Problemas e acertos | Selos discretos nos finais e nos canos ("chegou em 3 min", "acima da meta", "sem saída", "volta pro menu") | Explica o fluxo sem legenda e sem neon |
| Abertura | Um fluxo desenhado à mão em SVG, no estilo do editor, leve | Abre na hora; o editor de verdade pesa demais pro primeiro quadro |
| Demonstração | O visualizador de verdade (o do link público), carregado só quando a pessoa rola até ele | Honesto (é o produto) e não pesa na abertura |
| Mesa da empresa inteira | Fora da landing; vira um recurso do produto numa etapa própria ("Panorama") | A landing não promete o que o app ainda não faz |
| Buscadores | Continua `noindex` | O app ainda está no endereço da Vercel; libera quando houver domínio próprio |

## 3. Rotas e acesso

- **`/` sem sessão:** a landing.
- **`/` com sessão:** o que acontece hoje (aceita convites e vai pra primeira empresa, ou pra `/empresa/nova`).
- **`proxy.ts`:** `/` passa a ser público (só a raiz exata, não tudo que começa com `/`). O resto continua igual.
- **`/entrar`:** continua existindo, igual (só Google enquanto `NEXT_PUBLIC_LOGIN_EMAIL=nao`). É pra onde o proxy manda quem tenta abrir uma página interna sem sessão.
- **"Entrar" e "Criar conta" (barra e botões):**
  - Com o e-mail desligado: os dois abrem direto o login do Google (`signInWithOAuth`, volta pelo `/auth/callback`). No primeiro acesso, o Supabase cria a conta; não há diferença entre entrar e criar.
  - Com o e-mail ligado: "Entrar" leva pra `/entrar`; "Criar conta" leva pra `/entrar?modo=criar`, que abre a aba "Criar conta".
  - O botão de Google segue as diretrizes de marca, como o da `/entrar` (o mesmo `BotaoGoogle`), com o texto aprovado "Continuar com o Google" na abertura e no fechamento ("Criar conta com o Google" não é um dos textos das diretrizes). Sem o Google ligado, a chamada vira "Criar conta" e leva pra `/entrar?modo=criar`.
  - O cliente do Supabase só baixa quando o ponteiro ou o foco chega no botão do Google (ou no clique); o primeiro clique deixa o botão ocupado e o segundo é ignorado; se o pedido não sai, a landing leva pra `/entrar?erro=google`.
- **Erro do Google** (cancelou, recusou): volta pra `/entrar?erro=google`, como hoje, com o aviso.

## 4. A página, seção por seção (com os textos)

Português do Brasil, tratando por "tu", como o resto do app. Sem caixa alta, sem emoji, sem "→" nos botões.

### 4.1 Barra

- Marca Journey (o componente `Marca`).
- Atalhos (âncoras na página): **Exemplos**, **Como funciona**, **Pra quem**. Somem abaixo de 860 px.
- À direita: **Entrar** (texto) e **Criar conta** (botão escuro, pílula). Abaixo de 480 px, "Entrar" some e fica só "Criar conta".
- A barra fica no topo da página (não fixa).

### 4.2 Abertura

- **Título:** Desenha o fluxo e dá play.
- **Texto:** Teu atendimento e teus processos num quadro só. No play, a água mostra por onde o cliente passa, onde espera demais e onde ele se perde.
- **Botões:** "Continuar com o Google" (botão do Google) e **Ver exemplos** (link sublinhado, rola até 4.3).
- **Ao lado (embaixo no celular):** o fluxo animado da seção 5.

### 4.3 Exemplos ("Um fluxo pra cada operação")

- **Título:** Um fluxo pra cada operação
- **Texto:** Escolhe um exemplo e dá play. Tu escolhe o caminho em cada decisão, e o diagnóstico aponta o que está errado.
- **Quatro abas**, cada uma um cartão com nome, a dor em uma frase e uma miniatura do estilo do fluxo:
  - **URA telefônica:** O cliente que aperta 9 e não chega em lugar nenhum.
  - **Suporte no WhatsApp:** O bot que manda o cliente de volta pro começo.
  - **SAC por e-mail:** O chamado que fica dois dias parado antes de alguém escalar.
  - **Esteira de crédito:** A proposta parada horas na análise manual.
- **Embaixo das abas:** o visualizador de verdade com o exemplo escolhido (seção 6).

### 4.4 O que o play mostra

- **Título:** O que o play mostra e o fluxograma esconde
- **Texto:** Fluxo desenhado em slide parece sempre certo. Com a água passando, os problemas aparecem sozinhos.
- Quatro itens, cada um com um ícone no estilo das peças do editor (tile claro, traço `--ink-2`, a cor do problema só num detalhe):
  1. **O cliente que volta pro menu sem parar.** A URA que repete "não entendi", o chamado que passa de setor em setor. No play, tu vê o caminho voltar pro mesmo lugar; quando ele volta sozinho, sem ninguém escolher, o diagnóstico marca o ciclo.
  2. **A opção que não leva a lugar nenhum.** Opção 9 da URA, ligação fora do horário, caixa de e-mail sem dono. A água chega e não tem pra onde ir: tu vê o cano sem saída antes do cliente achar.
  3. **A espera que ninguém mede.** Cada etapa tem um tempo, e o play soma o do cliente até o fim. Quando passa da meta, o Journey diz por qual caminho.
  4. **O fluxograma que ninguém atualiza.** O desenho é o fluxo de verdade: muda num lugar e todo mundo vê. As versões guardam como era antes de cada mudança.

### 4.5 Como funciona

- **Título:** Como funciona
- Três passos numerados (é uma sequência de verdade), ligados por um cano:
  1. **Desenha.** Arrasta as peças: início, mensagem, decisão, atendimento e fim. Cada canal tem a sua cor. Ou começa de um modelo pronto.
  2. **Dá play.** A água sai do início, para em cada decisão pra tu escolher o caminho e conta o tempo do cliente até o fim.
  3. **Compartilha.** Manda um link só de leitura pra diretoria ou pro cliente, com o caminho já tocando.

### 4.6 Pra quem

- **Título:** Pra quem cuida de fluxo
- Duas colunas:
  - **Atendimento e CX.** Pra ver o caminho do cliente em todos os canais antes de mexer na operação. Lista: URA de telefonia e horário de atendimento; bot de WhatsApp e transbordo pro humano; SAC por e-mail e chat do site; filas, tempo de espera e meta de atendimento.
  - **Processos internos.** Pra desenhar esteiras com várias áreas e ver onde o pedido para. Lista: aprovação de compras e de despesas; esteira de crédito com análise manual; onboarding de cliente; chamados de TI entre níveis.

### 4.7 Fechamento e rodapé

- **Título:** Play your journey.
- **Texto:** Entra com o Google e desenha o primeiro fluxo em minutos, do zero ou a partir de um modelo pronto. (Sem o Google ligado: "Desenha o primeiro fluxo em minutos, do zero ou a partir de um modelo pronto.")
- **Botão:** "Continuar com o Google" (sem o Google ligado: "Criar conta").
- **Rodapé:** Journey, à esquerda; "Desenha o fluxo e dá play.", à direita.

## 5. O fluxo animado da abertura

- **O que mostra:** o "Suporte no WhatsApp" do protótipo: Cliente chama (início, WhatsApp) → Boas-vindas (mensagem) → Assunto? (decisão) com três saídas e uma volta:
  - **Boleto** → 2ª via enviada → Resolvido, com o selo verde "chegou em 3 min".
  - **Suporte** → Fila Suporte → Atendido, com o selo âmbar "18 min, acima da meta".
  - **Outro** → cano sem saída que pinga numa poça vermelha, com o selo vermelho "Sem saída".
  - **Não entendi** → volta pras boas-vindas por cima, com o selo roxo "Volta pro menu".
- **Como é feito:** um componente React com SVG próprio (`app/(landing)/FluxoAbertura.tsx` ou equivalente), sem o editor e sem o `@journey/fluxo`. As peças copiam a forma das do editor (placa, tile do ícone, nome e subtítulo; losango da decisão; pílula do início e do fim; pílula da opção no cano) e usam os tokens do `globals.css`, então segue o tema claro e escuro.
- **A água:** a cor do canal (o verde do WhatsApp) em todos os canos, com um brilho que corre devagar (traço branco curto andando pelo cano, CSS). O cano da volta pro menu tem a água roxa. O cano sem saída pinga (três gotas caindo, em sequência).
- **Movimento:** só o brilho e as gotas. Nada pisca nem cresce. Com "reduzir movimento", tudo parado.
- **Acessível:** o SVG é uma imagem com `role="img"` e um `aria-label` que descreve os quatro caminhos.

## 6. Os exemplos com o produto de verdade

- **Onde:** seção 4.3.
- **Carregamento:** o visualizador e o `@journey/fluxo` só carregam quando a área chega a 240 px da tela (`IntersectionObserver` + `next/dynamic` sem SSR). Antes disso, a área tem a altura final e mostra a miniatura do exemplo escolhido, pra a página não pular.
- **Os quatro exemplos:** cada um é um retrato (`Retrato`, o mesmo tipo do link público) montado no código, sem banco e sem chave secreta (`landing/exemplos.ts`):
  - empresa "Exemplo", versão `null`, `esconderNomes: false`, `expiraEm: null`, `intencionais: []`, `cenario: null`;
  - os canais padrão (Telefonia `#1e8bdc`, WhatsApp `#159e5a`, E-mail `#c98410`, Chat `#7650d6`, Interno `#3a6a88`);
  - o documento e os cadastros vêm de uma cópia do modelo (`MODELOS` do `@journey/fluxo`), com os problemas abaixo acrescentados de propósito, pra o diagnóstico ter o que mostrar.
- **Os problemas de cada exemplo** (o diagnóstico acha exatamente estes, e o teste confere). O motor só marca um ciclo quando ele anda sozinho, sem ninguém escolher e sem o tempo passar; por isso a volta que vira achado em cada exemplo passa pela decisão do horário. As voltas com escolha (Opção inválida → Menu, Não entendi → Qual assunto?, Pede documento → Análise) aparecem no play, mas não são achado.

| Exemplo | O que muda em relação ao modelo | O que o diagnóstico acha | Estilo |
|---|---|---|---|
| URA telefônica | Menu ganha a opção 9 "Falar com atendente" → mensagem "Transferindo…" sem saída; "Fora do horário" (sem tempo) volta pro "Dentro do horário?"; "Opção inválida" volta pro Menu | `beco_sem_saida` em "Transferindo…"; `ciclo_sem_tempo` em Fora do horário ↔ Dentro do horário? | `linha`, curva `reta`, espessura 6 |
| Suporte no WhatsApp | O aviso de fora do horário (sem tempo) volta pras Boas-vindas (sem tempo), e "Encerra a conversa" sai; Assunto ganha a opção 3 "Outro assunto" → "Não entendi" → volta pro Assunto; meta 30 min | `ciclo_sem_tempo` em Boas-vindas → horário → aviso; `passou_do_prazo` (suporte + espera pelo cliente) | `cano`, curva `suave`, espessura 10 (o padrão) |
| SAC por e-mail | Meta do fluxo 24 h | `passou_do_prazo` (a escalação de 48 h) | `cano`, curva `cotovelo`, espessura 12 |
| Esteira de crédito | "Dentro do expediente?" (Horário comercial) antes da análise, e "Espera o expediente" (sem tempo) volta pra ele; o analista ganha "Pede documento" → "Cliente manda o documento" → volta pra Análise; meta 2 h | `ciclo_sem_tempo` em Espera o expediente ↔ Dentro do expediente?; `passou_do_prazo` (análise de 4 h) | `tracejado`, curva `cotovelo`, espessura 8 |

- **A hora do play dos exemplos:** o dia de hoje às 10h, ou o próximo dia que às 10h está dentro do Horário comercial (o mesmo relógio do motor). Assim quem abre de noite ou no domingo vê o menu, e não o aviso de fechado; o e2e não depende da hora em que roda.
- **O visualizador embutido:** o `Visualizador` ganha um modo `embutido`:
  - sem o cabeçalho (empresa, versão, validade) e sem o rodapé "Feito com Journey";
  - ocupa a altura que a seção der (fixa: 560 px no computador, 480 px no celular);
  - enquadra o fluxo inteiro ao abrir;
  - a gaveta do diagnóstico abre sozinha, com os achados do exemplo, num contêiner de 900 px ou mais (ao lado do quadro); abaixo disso ela começa fechada, com o botão dos achados visível, pra o fluxo aparecer primeiro;
  - o play começa parado: "Dar play" fica numa barra em cima do quadro, junto com o botão dos achados (o cartão do play só existe com o play andando). Não toca sozinho;
  - a roda do mouse rola a página (o zoom do quadro fica com Ctrl ou Cmd), deslizar na vertical rola a página no toque, e as teclas do play só valem com o foco dentro do visualizador;
  - se o visualizador não carregar (rede, publicação nova no meio da visita), só ele some e a miniatura fica: a página não quebra.
- **Troca de aba:** o visualizador desmonta e monta de novo com o outro retrato (play zerado, enquadramento novo). A aba escolhida fica na URL como `#exemplo-ura`, `#exemplo-whatsapp`, `#exemplo-email` e `#exemplo-credito`, pra dar pra mandar o link de um exemplo.
- **As abas** são um `tablist` de verdade (setas, Home, End, `aria-selected`), como as abas da `/entrar`.

## 7. Visual

- **Tokens:** os do `globals.css` (claro e escuro), as fontes do app (Bricolage Grotesque no título, IBM Plex Sans no texto, IBM Plex Mono nas pílulas de opção e nos números). Os selos usam `--ok`, `--warn` e `--bad`, que já existem; a única cor nova é um roxo pro loop (`--loop` e `--loop-soft`), definido nos dois temas.
- **Fundo:** o pontilhado do quadro só atrás da abertura. O resto da página no `--bg` liso.
- **Ritmo:** largura máxima de 1180 px; seções separadas por 96 px (72 px no celular); textos com até uns 60 caracteres por linha.
- **Cartões só onde são objeto:** as abas dos exemplos e as duas colunas de "Pra quem". As dores e os passos não são cartões.
- **Sem:** neon, gradiente de fundo, sombra igual em tudo, ícone de emoji.

## 8. Desempenho e acessibilidade

- O primeiro carregamento de `/` não traz o editor, o `Quadro`, o `@journey/fluxo` nem o cliente do Supabase. Eles chegam com a seção dos exemplos (e o Supabase com o botão do Google). `npm run test:build` (no app) faz o build e confere isso no manifesto; sem build, falha.
- Sem rolagem lateral em 390 px. A abertura cabe no celular com o fluxo embaixo do texto.
- Foco visível em tudo; as abas e os botões funcionam no teclado; contraste AA nos dois temas (incluindo o texto dos selos).
- "Reduzir movimento": abertura parada; o play dos exemplos continua (é ação da pessoa).

## 9. Testes

- **Unidade:**
  - os quatro retratos de exemplo passam pela mesma validação do link (`lerDocumento`, `lerEstilo`);
  - o diagnóstico de cada exemplo acha exatamente os achados da tabela da seção 6;
  - `proxy`: `/` é público, `/e/…` continua fechado, `/x` não vira público por começar com `/`.
- **Ponta a ponta** (os achados exatos de cada exemplo saem do motor; se algum código da tabela não bater, o teste de unidade mostra e a tabela é corrigida antes de seguir):
  - sem sessão, `/` mostra o título e a chamada de criar a conta ("Continuar com o Google" com o Google ligado; "Criar conta" nos testes locais, que rodam sem ele);
  - com sessão, `/` vai pra empresa como hoje;
  - rolar até os exemplos carrega o visualizador; trocar pra "URA telefônica" mostra o achado do cano sem saída; dar play e escolher a opção 9 leva a água até "Transferindo…";
  - `#exemplo-credito` na URL abre a aba da esteira;
  - 390 px sem rolagem lateral;
  - com o e-mail ligado (o modo dos testes locais), "Entrar" leva pra `/entrar` e "Criar conta" pra `/entrar?modo=criar`.
- **Build:** a página `/` não carrega os chunks do editor no primeiro quadro.

## 10. Fora do escopo

- A mesa da empresa inteira (direção C) como recurso do produto: etapa própria, depois.
- Domínio próprio, e-mail com domínio, liberar pros buscadores.
- Preço, depoimentos, logos de clientes (não existem ainda).
- Tradução pra outro idioma.
