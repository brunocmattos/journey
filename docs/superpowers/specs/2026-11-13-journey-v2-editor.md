# Journey v2: o editor no centro

- **Data:** 13/11/2026
- **Status:** rascunho pra revisão do Bruno
- **Substitui:** `2026-11-12-journey-design.md` (v1) no que diz respeito a produto, modelo de dados e ordem de construção. O que a v1 diz sobre visual, links públicos e erros continua valendo onde este documento não fala o contrário.
- **Protótipo de referência:** https://claude.ai/artifact/43mGrdLCja5EGS5PwT4ZE1 (editor em página única, aprovado no teste de 13/11/2026)

## 1. Por que uma v2

A v1 foi desenhada a partir do export da central telefônica e virou um produto de central telefônica: o modelo de dados são as abas de um PABX (entradas, ramais, filas, grupos, horários, peças de URA), a única porta de entrada é uma planilha que ninguém consegue preencher à mão, e desenhar ficou pra "etapa 4". O app publicado em 13/11 só aceita importação: não dá pra criar um fluxo, nem cadastrar uma pessoa ou uma fila, nem desenhar.

O Journey é outra coisa: um SaaS white label em que a pessoa entra, cria um fluxo em branco de qualquer canal ou esteira e vai desenhando, como no Miro, FigJam ou Whimsical. A estrutura (cadastros, regras, tempos) nasce do que ela desenha. Importar é um atalho, não a porta.

## 2. O que é o Journey

Um quadro onde se desenha um fluxo de atendimento ou uma esteira de trabalho, liga as etapas com regras e dá play: a água anda pelos canos, troca de cor quando troca de canal, para nas decisões e mostra quanto tempo o cliente levou. Serve pra:

1. **Desenhar** o fluxo do zero, rápido, sem formulário nem planilha.
2. **Entender e explicar** com a animação, sem precisar de quem conhece do lado (link público).
3. **Testar cenários** ("e se o cliente não responder em 2 h?") e encontrar problemas (becos, ciclos, etapas que ninguém alcança).

Qualquer canal (telefonia, WhatsApp, e-mail, chat, presencial, interno) e qualquer esteira (aprovação de crédito, onboarding, SAC, cobrança). Nenhum é especial no modelo.

## 3. Critérios de sucesso da primeira versão

| # | Critério | Como verificar |
|---|---|---|
| 1 | Uma pessoa nova cria um fluxo do zero sem ajuda | Entrar, "Novo fluxo", desenhar um fluxo de 10 peças com 2 decisões e dar play em até 10 minutos, sem ler instrução |
| 2 | Cadastros nascem do desenho | Escrever "Fila Cobrança" numa peça faz a fila aparecer em Cadastros; renomear lá muda em todos os fluxos que a usam |
| 3 | Um colega entende um fluxo pelo link | Mandar o link de um cenário pra 2 ou 3 colegas e eles descreverem o caminho (era o critério 3 da v1) |
| 4 | Cada empresa tem a cara dela | Trocar nome, logo, cor e cores dos canais da empresa muda o app e os links públicos dela |
| 5 | Fluxos de canais diferentes convivem | Na mesma empresa, um fluxo de WhatsApp, uma esteira interna e um fluxo de telefonia, cada um com sua cor de água |

## 4. Fora do escopo da primeira versão

- Duas pessoas editando o mesmo fluxo ao mesmo tempo, com cursores (fica a trava: quem abre depois vê "Fulano está editando").
- Execução real (o fluxo rodar uma URA ou um bot de verdade).
- Domínio próprio por empresa (o white label é nome, logo, cores).
- Papéis além de "editor" (leitor com conta, admin).
- Editar no celular (no celular dá pra ver, simular e abrir links; editar é no computador).
- Importar draw.io, Mermaid e BPMN, e exportar pra imagem ou PDF (vêm logo depois, seção 15).

## 5. Conceitos

| Termo | Significado |
|---|---|
| **Empresa** | O espaço de trabalho, com marca (nome, logo, cor), canais, membros, cadastros e fluxos |
| **Fluxo** | Um quadro: peças, conexões, grupos e notas, com um canal principal e um estilo. É o que a v1 chamava de jornada |
| **Peça** | Um passo do fluxo. Tem um **tipo** (início, mensagem, etapa, decisão, espera, atendimento, sistema, fim), um nome, e opcionalmente canal, responsável (um cadastro), tempo e descrição |
| **Conexão** | Liga uma peça a outra, numa direção, com uma **regra**: sempre, opção (tecla ou código + nome), condição (texto), depois de um tempo, senão |
| **Grupo** | Uma moldura com nome e cor que junta peças (uma raia, uma área, uma equipe). Mover o grupo move o que está dentro |
| **Nota** | Um recado no quadro, fora do fluxo |
| **Canal** | Por onde a jornada passa naquele trecho (telefonia, WhatsApp…). Cada empresa tem sua lista e a cor de cada um. A água pega a cor do canal |
| **Cadastro** | Uma coisa real que as peças usam: pessoa, fila, equipe, sistema, horário, ou um tipo que a empresa criar, com campos dela. Vale pra empresa toda, não só pra um fluxo |
| **Estilo** | Como o fluxo é desenhado e animado: desenho e curva do cano, espessura, velocidade, bolhas, brilho, ondas, holofote, câmera, escolha automática. A empresa tem um padrão; cada fluxo pode mudar |
| **Versão** | Foto do fluxo num momento, com nome ("antes da mudança de horário"). O editor salva sozinho; versão é quando a pessoa quer marcar |
| **Cenário** | Um caminho salvo: de onde começa e as escolhas, com o resultado esperado |
| **Link público** | Endereço só de leitura de um fluxo (versão fixa ou a atual), com cenário inicial, nomes escondidos e validade. Já existe (v1, etapa 3) |
| **Modelo** | Um fluxo pronto pra começar (Suporte no WhatsApp, Esteira de crédito, SAC por e-mail, URA telefônica) |

## 6. Telas

1. **Entrar** (já existe): link mágico, Google opcional.
2. **Fluxos** (a casa da empresa): grade de fluxos com miniatura, canal, quem mexeu por último e quando; busca; botão **Novo fluxo** com três caminhos: *em branco*, *a partir de um modelo*, *importar* (seção 12). Vazio, a tela abre já oferecendo "em branco" e os modelos.
3. **Editor** (o protótipo, seção 7): quadro, barra de formas, painel com Propriedades, Estilo e animação, Cadastros; play; Compartilhar; Versões.
4. **Cadastros**: tabela por tipo, com busca, "onde é usado" (fluxos e peças), criar, renomear, apagar (só sem uso, ou trocando por outro). Tipos personalizados com campos (texto, número, opções, pessoa).
5. **Configurações da empresa**: marca (nome, logo, cor principal), canais (nome, cor, ícone; criar e arquivar), estilo padrão dos fluxos, membros e convites (já existe).
6. **Link público** (já existe, adaptado): o fluxo só de leitura, com a marca da empresa.

## 7. Editor

O protótipo é a especificação de comportamento. O que ele faz entra igual; o que falta pra uso real está marcado com **novo**.

### 7.1 Criar e editar

- Quadro infinito com grade de pontos; arrastar o fundo move, Ctrl+roda (ou pinça) dá zoom, "ver tudo".
- Barra de formas à esquerda: clicar e depois clicar no quadro, ou arrastar a forma até o lugar. Dois cliques num espaço vazio abrem o menu de formas ali.
- Ao criar, o nome já fica em edição; Enter confirma. Dois cliques numa peça renomeiam.
- Passando o mouse numa peça: a bolinha pra puxar uma conexão até outra peça (soltar no vazio pergunta qual peça criar e já liga) e o **+** que cria a próxima já ligada.
- Segunda saída de uma peça transforma as saídas em opções (1, 2…), pra o play perguntar.
- Grupo: moldura com nome e cor; mover leva o que está dentro; redimensionar pelo canto.
- Desfazer e refazer, Del apaga, Ctrl+D duplica, Esc solta.
- **Novo:** seleção múltipla (arrastar um retângulo com Shift, ou Shift+clique), mover e apagar em bloco; copiar e colar (inclusive entre fluxos); alinhar e distribuir a seleção; encaixe nas outras peças ao arrastar (guias); minimapa.
- **Novo:** salvamento automático no banco a cada mudança (com aviso se a conexão cair e cópia local até voltar); trava de edição (seção 4).

### 7.2 Painel

- **Propriedades** da seleção:
  - peça: nome, tipo (trocar sem perder ligações), canal ("segue o de antes" ou um da lista), responsável (um cadastro, com busca; escrever um nome novo cria o cadastro), tempo nesta peça, descrição, cor;
  - conexão: regra e seus campos, texto no cano, inverter, apagar;
  - grupo: nome, cor;
  - nada selecionado: nome do fluxo, canal principal, descrição, como montar.
- **Estilo e animação**: o que está no protótipo (cor da água por canal, desenho e curva do cano, espessura, velocidade, bolhas, brilho, ondas, holofote, câmera, escolha automática), começando do padrão da empresa. **Novo:** "usar como padrão da empresa".
- **Cadastros**: os do fluxo e os da empresa, com uso; criar; renomear (muda em todos os fluxos).

### 7.3 Tipos de peça

Os oito tipos do protótipo são o vocabulário comum. Cada um tem ícone e forma própria (início e fim arredondados, decisão em losango) e nenhum carrega regra de negócio de um canal específico: "menu de URA" é uma decisão cujas saídas são teclas; "fila" é um atendimento cujo responsável é um cadastro do tipo Fila.

A forma é só a aparência; o que importa pra simulação e diagnóstico é: quantas saídas a peça tem, quais regras, quanto tempo leva e de quem é.

## 8. Simulação

- **Play a qualquer momento**, sem salvar antes. Começa no Início selecionado ou no primeiro; com vários, pergunta.
- A água anda pelo cano na cor do canal, com bolhas e brilho conforme o estilo; a peça enche quando a água chega; a câmera segue (se ligada).
- Peça com uma saída: segue sozinha. Com mais de uma: holofote e pergunta, com as opções no cartão, nos canos e no teclado (número ou a tecla da opção). Escolha automática depois de N segundos, pra apresentar.
- **Tempo do cliente:** soma o tempo de cada peça e das conexões "depois de um tempo". Mostra no topo e no fim.
- **Relógio (novo, vindo da v1):** uma decisão ligada a um cadastro do tipo Horário pode decidir sozinha pela data e hora simuladas ("dentro do horário?"), com a escolha manual sempre possível. É o que a v1 fazia com a regra de horário, agora genérico.
- Controles: pausar, voltar uma decisão, recomeçar, velocidade 0,5× a 4×, parar. Linha do tempo com a hora do cliente em cada peça. Fim com resumo (peças, tempo, canais).
- **Cenários:** no fim, salvar o caminho como cenário; abrir um cenário toca de novo; se o fluxo mudou e o caminho dá outro resultado, avisa e oferece aprovar o novo (como na v1).

O motor continua puro (sem tela), previsível (mesmas escolhas, mesmos eventos) e testável sozinho. O motor da v1 é específico de telefonia (menu, regra de horário, fila, toque de ramal); o novo reaproveita o desenho dele (eventos, escolhas como caminho, tempo) e não o código das peças.

## 9. Diagnóstico

Roda ao vivo no editor, num painel recolhível, com "ver no quadro" (holofote nas peças) e "simular até aqui". Regras genéricas:

| Achado | Regra |
|---|---|
| Beco sem saída | peça sem saída que não é Fim |
| Ninguém chega aqui | peça que nenhum Início alcança |
| Não termina | Início sem caminho até algum Fim |
| Ciclo sem saída | grupo de peças que se alcançam e de onde não se chega a um Fim |
| Decisão sem escolha | decisão com uma saída só |
| Opções repetidas | duas saídas da mesma peça com a mesma opção ou condição |
| Regra vazia | opção sem código, condição sem texto, tempo zerado |
| Sem responsável | atendimento sem responsável |
| Passou do prazo | tempo do caminho mais longo acima da meta do fluxo (meta é opcional) |

Marcar como intencional continua (com nota e quem marcou). Os achados específicos de telefonia da v1 (ramal em ciclo de transbordo, membro inexistente…) saem do núcleo e viram parte do importador de central (seção 12), que os traduz pra estes genéricos.

## 10. White label

- Empresa tem nome, logo (imagem até 512 KB) e cor principal. O app (topo, botões, destaques) e os links públicos usam essas cores; a marca do Journey fica discreta no rodapé.
- Canais são da empresa: nome, cor e ícone. Vêm cinco por padrão (Telefonia, WhatsApp, E-mail, Chat, Interno) e dá pra criar e arquivar.
- Estilo padrão dos fluxos é da empresa.
- Domínio próprio fica pra depois (seção 4).

## 11. Dados

Postgres (Supabase) com RLS por empresa, como na v1. O documento do fluxo é JSON (o editor carrega e salva inteiro); os cadastros e canais são tabelas, porque são da empresa toda.

| Tabela | Conteúdo |
|---|---|
| `empresas` (já existe) | + `marca` (logo, cor), `estilo_padrao` |
| `membros`, `convites` (já existem) | sem mudança |
| `canais` | empresa, chave, nome, cor, ícone, arquivado |
| `tipos_cadastro` | empresa, nome, campos (jsonb: nome, tipo, opções) — os cinco padrão vêm criados |
| `cadastros` | empresa, tipo, nome, campos (jsonb) |
| `fluxos` | empresa, nome, descrição, canal principal, `documento` (jsonb: peças, conexões, grupos, notas), `estilo`, `revisao` (número que sobe a cada salvamento), editado por, editado em, trava (quem, desde) |
| `fluxo_versoes` | fluxo, número, nome, documento, estilo, autor, data |
| `fluxo_cadastros` | fluxo, cadastro: o "onde é usado", refeito a cada salvamento |
| `cenarios` (já existe, adaptado) | fluxo em vez de jornada; entrada vira o id do Início |
| `links` (já existe, adaptado) | fluxo em vez de jornada; versão fixa ou "a atual" |
| `achados_intencionais` (já existe, adaptado) | fluxo em vez de jornada |

- **Peça aponta pro cadastro pelo id**, nunca pelo nome: renomear o cadastro muda em todos os fluxos sem tocar no documento.
- **Salvar é otimista:** o editor manda o documento com a `revisao` que tinha; se outra pessoa salvou no meio, o banco recusa e a tela avisa (com a trava, isso só acontece se a trava venceu).
- **Somem:** `catalogo`, `catalogo_membros`, `jornadas`, `jornada_versoes`, `jornada_refs` e o bucket de imports da v1. O banco de produção está vazio (13/11), então a troca é uma migração nova, sem conversão de dados.

## 12. Modelos e importação

- **Modelos:** fluxos prontos que a empresa copia: Suporte no WhatsApp, Esteira de crédito, SAC por e-mail (os três do protótipo) e URA telefônica. A empresa pode salvar um fluxo dela como modelo.
- **Importar central telefônica:** o formato `journey/1` e o roteiro de extração da v1 (FreePBX) viram um importador que gera um fluxo genérico: entrada vira Início (canal Telefonia), menu vira Decisão com opções por tecla, regra de horário vira Decisão ligada a um cadastro Horário, fila, grupo e ramal viram Atendimento com cadastro Fila, Equipe ou Pessoa (com o tempo de toque como tempo da peça), transbordo vira conexão "depois de um tempo". O núcleo da v1 (`@journey/nucleo`) continua existindo pra ler e validar a planilha, só que como importador.
- **Depois:** draw.io, Mermaid e BPMN com a tela de classificar formas (era a etapa 5 da v1).

## 13. Visual

- O protótipo é a referência: tokens da v1 (claro e escuro), peças com tile e ícone, canos com volume, água com brilho e bolhas, holofote.
- A cor principal da empresa entra como `--accent`; as cores dos canais, como as da água.
- Reduzir movimento: sem animação contínua, câmera sem transição.
- Até 500 peças com arrasto e animação fluidos; diagnóstico em menos de 100 ms pra 500 peças.

## 14. O que se aproveita da v1

| Parte | Destino |
|---|---|
| Login, empresas, membros, convites, proxy, deploy (Vercel em gru1 + Supabase em São Paulo) | fica igual |
| Links públicos (etapa 3): token, revogação, validade, esconder nomes, retrato no servidor com a chave secreta | fica; o retrato passa a ler o fluxo genérico, e "esconder nomes" esconde os cadastros do tipo Pessoa |
| Mapa em React Flow, peças e canos, player, cartão de decisão, linha do tempo | base do editor; as peças e canos ganham o visual do protótipo e a edição |
| `@journey/nucleo` (formato, motor e diagnóstico de telefonia) | vira o importador de central (seção 12) |
| Import com revisão, catálogo da central, jornadas por canal | sai |

## 15. Ordem de construção

Cada etapa tem plano próprio, termina com algo que funciona publicado e testado.

| Etapa | Entrega | Pronto quando |
|---|---|---|
| A. Modelo e motor genéricos | Pacote `@journey/fluxo` sem tela: tipos do documento, validação, motor genérico (com relógio de Horário), diagnóstico genérico, testes; migração nova do banco | Os três exemplos do protótipo simulam e diagnosticam em testes |
| B. Editor no app | Tela Fluxos (em branco e modelos), editor com tudo do protótipo salvando no banco, cadastros que nascem do uso, estilo, play, trava | Critérios 1, 2 e 5 |
| C. Compartilhar e cenários | Links públicos e cenários sobre o fluxo genérico; versões nomeadas; diagnóstico no editor | Critério 3 |
| D. Marca e configurações | White label (logo, cor), canais da empresa, tipos de cadastro personalizados, estilo padrão, seleção múltipla, copiar e colar, alinhar | Critério 4 |
| E. Importar e exportar | Importador de central (journey/1), draw.io, Mermaid, BPMN; exportar PNG, SVG e PDF | Uma central importada vira fluxo genérico simulável |

A etapa B é a primeira que dá pra usar de verdade; A existe pra ela não nascer com regra de telefonia de novo.

## 16. Riscos e questões em aberto

| Item | Tratamento |
|---|---|
| Edição simultânea | Fora da v1 (trava). Se for pedida, o documento em JSON e o salvamento por revisão permitem evoluir pra edição em tempo real depois |
| Relógio só via cadastro Horário | Pode não cobrir regras como "dia útil" ou "feriado"; o cadastro Horário ganha calendário de feriados (vindo da v1) |
| Arquivo grande | Fluxo de 500 peças em JSON fica perto de 300 KB: salvar a cada mudança com espera curta (meio segundo) e só se mudou |
| Fluxo publicado e link "atual" | O link da versão atual mostra o rascunho que está sendo editado; quem quer estabilidade fixa a versão |
| O que é "responsável" em cada tipo | Hoje é um campo só; se as empresas precisarem de mais (fila + supervisor), os tipos de peça ganham campos configuráveis, como os cadastros |
