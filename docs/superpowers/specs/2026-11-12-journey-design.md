# Journey: design da primeira versão

- **Data:** 12/11/2026
- **Status:** aguardando revisão
- **Protótipo de referência:** https://claude.ai/artifact/7fr2TJLSUoy4wcFfq2Pp35 (versão 2, com o fluxo real da central exportado em 11/11/2026)

## 1. Problema

Os fluxos de atendimento da empresa (telefonia, WhatsApp, e-mail, ocorrências) existem, mas explicar como eles funcionam exige repetir a explicação ou desenhar de novo a cada conversa. Testar um fluxo de telefonia hoje significa ligar, configurar e conferir na prática. Desenhos em Miro ou draw.io dão muito trabalho pra ficarem bons e não respondem perguntas como:

- "Se eu ligar no 9001 agora, o que acontece?"
- "Se ligarem pro ramal dela e ela não atender, pra onde vai?"
- "Se ninguém atender a fila, a pessoa espera até quando?"

O export da central feito em 11/11/2026 mostrou que esses fluxos têm problemas que ninguém via: menus que mandam pra uma fase apagada, 25 ramais em ciclo de transbordo, a opção "elétrica" da emergência caindo na fila do hidráulico, um buraco de 5 minutos entre o horário de dia útil e o estendido.

## 2. O que é o Journey

Um app web onde o fluxo de atendimento aparece como um encanamento. Tu dá play numa entrada e a água anda pelos canos. Em cada decisão o caminho acende e espera tua escolha (ou a do relógio, do sistema, da fila). Tudo isso pra:

1. **Entender e explicar** um fluxo sem precisar de quem o conhece do lado.
2. **Testar cenários** ("e se…") sem ligar pra central.
3. **Encontrar problemas** automaticamente: becos sem saída, ciclos, redundâncias, buracos de horário.

Mais pra frente, o mesmo desenho vira o pipeline que **executa** de verdade (URA, conectores, agentes RAG). Por isso o motor de simulação é pensado desde já pra rodar fora da tela.

## 3. Objetivos e critérios de sucesso da primeira versão

| # | Critério | Como verificar |
|---|---|---|
| 1 | O fluxo atual da central entra no Journey sem redesenhar nada | Importar a planilha padrão gerada pelo roteiro de extração (seção 16) e ver o mapa completo |
| 2 | O diagnóstico encontra sozinho os problemas que o protótipo encontrou | Os achados da seção 12.3 aparecem no import da central real |
| 3 | Um colega entende um cenário sem explicação | Mandar um link "E se ligarem às 16h57?" pra 2 ou 3 colegas e eles descreverem o caminho corretamente |
| 4 | Ajuste manual sobrevive a um novo import | Ajustar um tempo de fila, importar de novo, o ajuste continua lá |
| 5 | Dá pra migrar um desenho existente | Importar um `.drawio` e um `.bpmn` e classificar as peças em até 5 minutos |

## 4. Fora do escopo da primeira versão

- Outros canais (WhatsApp, e-mail, ocorrências) como jornadas próprias. O modelo já é genérico pra eles entrarem depois.
- Execução real: tocar áudio, transferir ligação, conectores, agentes RAG.
- Papéis além de "editor" (admin, leitor com conta).
- Exportar do Journey pra draw.io, Mermaid ou BPMN.
- Leitura direta de `.vsdx` e do CSV do Lucidchart, e integração com Miro.
- Pessoa como entidade própria (a mesma pessoa em ramal, WhatsApp e e-mail). Na primeira versão o nome fica no ramal.
- Edição simultânea por duas pessoas na mesma jornada.

## 5. Conceitos

| Termo | Significado |
|---|---|
| **Empresa** | O espaço de trabalho. Tem membros (editores), catálogo e jornadas |
| **Catálogo** | As coisas reais da central, compartilhadas entre jornadas: entradas (números), horários, feriados, ramais, filas, grupos de toque |
| **Jornada** | Um fluxo: uma ou mais entradas e tudo que é alcançável a partir delas. O primeiro import cria a jornada "Telefonia" com todas as entradas; o editor pode criar jornadas menores com parte das entradas |
| **Peça** | Um passo do fluxo: áudio, menu, regra de horário, consulta ao sistema, transferência, atalho, fim |
| **Saída (cano)** | Liga uma peça a outra por uma opção: tecla "1", "esgotou", "sim", "não atende" |
| **Referência** | Forma única de apontar pra algo: `fila:90011`, `ramal:9019`, `peca:fase-16`, `saida:fase-30-esgotou`, `horario:tg1`, `fim:desliga` |
| **ID estável** | O identificador de cada coisa, de preferência o mesmo da central. É o que liga imports e ajustes |
| **Base** | O que veio do último import |
| **Ajuste** | Uma alteração manual guardada à parte, contra um ID estável e um campo |
| **Versão** | Foto da jornada efetiva (base + ajustes + posições) num momento |
| **Cenário** | Uma simulação salva: entrada, data e hora, respostas pré-definidas e resultado esperado |
| **Achado** | Um problema encontrado pelo diagnóstico, com chave estável |
| **Link público** | Endereço só de leitura de uma jornada, sem conta |

## 6. Arquitetura

```
┌──────────────────────────── Next.js (Vercel) ────────────────────────────┐
│  Telas: editor (React Flow) · player animado · painel · import · link    │
│  Rotas de servidor: import, versões, link público, modelos pra baixar    │
└───────────────┬───────────────────────────────────────────┬──────────────┘
                │ usa                                       │ lê/grava
┌───────────────▼──────────────────────────┐   ┌────────────▼─────────────┐
│ Pacotes internos (TypeScript puro)       │   │ Supabase                 │
│  formato      esquema + validação        │   │  Auth (link mágico,      │
│  motor        simulação determinística   │   │   Google opcional)       │
│  diagnostico  achados                    │   │  Postgres + RLS          │
│  importacao   planilha/CSV/JSON → base   │   │  Storage (arquivos       │
│  conversores  drawio · mermaid · bpmn    │   │   importados, privado)   │
│  modelos      gera .xlsx e .json modelo  │   └──────────────────────────┘
└──────────────────────────────────────────┘
```

Regras de fronteira:

- **O esquema não usa biblioteca:** as colunas de `formato/abas.ts` geram a leitura das células, a validação, a planilha modelo e o esquema JSON.

- **Os pacotes internos não conhecem React, Next.js nem Supabase.** Recebem dados e devolvem dados. Isso deixa o motor pronto pra rodar no servidor quando vier a execução real, e deixa tudo testável sem tela.
- **`formato` é a única definição do modelo.** Validação do import, tipos do app, modelo `.xlsx` e esquema JSON saem dela. Nada é escrito duas vezes.
- **A tela nunca grava direto nas tabelas do catálogo.** Toda mudança passa por import ou por ajuste.

Bibliotecas previstas: Next.js (App Router), `@xyflow/react` (React Flow), `@supabase/supabase-js`, ExcelJS (ler e gerar `.xlsx` com listas de valores), um leitor de XML (`fast-xml-parser`) e `pako` (diagramas compactados do draw.io), Vitest e Playwright.

## 7. Dados

### 7.1 Tabelas

| Tabela | Conteúdo |
|---|---|
| `empresas`, `membros` | Empresa e quem edita |
| `imports` | Cada arquivo importado: formato, relatório de validação, dados normalizados, quem e quando |
| `entradas`, `horarios`, `feriados`, `ramais`, `filas`, `fila_membros`, `grupos`, `grupo_membros` | **Catálogo efetivo** (último import + ajustes), em tabelas pra permitir consulta cruzada |
| `ajustes` | Alvo (referência + campo), valor, nota, autor, data, ativo |
| `jornadas` | Nome, canal, entradas que fazem parte |
| `jornada_versoes` | Número, documento efetivo (JSON), origem (`import`, `edicao`, `restauracao`), import de origem, autor, data, resultado do diagnóstico |
| `jornada_refs` | Pra cada versão, as referências de catálogo que ela usa. É o que responde "onde é usado" |
| `cenarios` | Nome, entrada, data e hora simulada, respostas, resultado esperado |
| `achados_intencionais` | Chave do achado, nota, autor |
| `regras_mapeamento` | Regras salvas dos conversores ("losango amarelo = regra de horário") |
| `links` | Token, jornada, versão fixa ou nula (= mais recente), cenário inicial, esconder nomes, validade, revogado em |
| `edicao_trava` | Quem está editando cada jornada e desde quando |

Todas as tabelas com dado de empresa têm `empresa_id` e regra de acesso (RLS) que só libera membros daquela empresa.

### 7.2 Base, ajustes e versões

- **Jornada efetiva = base do último import + ajustes ativos + posições salvas.**
- Um ajuste aponta pra `referência.campo`, por exemplo `fila:90011.espera_maxima_s = 180` ou `saida:fase-30-esgotou.para = fila:90015`.
- **Peça criada à mão** no editor também é ajuste: um ajuste de criação, com ID gerado `manual-…`.
- **Novo import:**
  1. calcula a nova base;
  2. reaplica os ajustes;
  3. lista três tipos de situação na revisão:
     - **conflito:** a central agora traz um valor diferente do ajustado;
     - **ajuste órfão:** o alvo sumiu da central;
     - **ajuste redundante:** a central passou a trazer o mesmo valor, e o ajuste pode ser apagado.
- Cada import confirmado gera uma **versão nova**. Na edição, o salvamento automático grava num rascunho da sessão; a versão nova é criada quando a pessoa sai do modo Editar ou quando a trava expira. Versões antigas podem ser abertas e restauradas.

### 7.3 "Ramais diretos" não é documento

A visão de ramais é gerada do catálogo: cada ramal já sabe pra onde transborda, quanto toca e se tem siga-me. Não existe documento de jornada pra ela, então não há o que desenhar nem versionar além do próprio catálogo.

## 8. Formato Journey

O mesmo modelo existe em três arquivos: planilha `.xlsx`, um `.csv` por aba e `.json`. O JSON tem `"formato": "journey/1"` e uma lista por aba, com os mesmos campos.

### 8.1 Abas e colunas

Toda aba tem `id` (obrigatório, único na aba, estável entre imports) e `observacao` (opcional). Campos de lista usam espaço como separador. Horas em `HH:MM`, datas em `AAAA-MM-DD`, tempos em segundos.

**`entradas`**: números que recebem ligação.
| Coluna | Obrigatória | Exemplo |
|---|---|---|
| `id` | sim | `did-5133279001` |
| `numero` | sim | `5133279001` |
| `nome` | não | `Comercial 9001` |
| `canal` | não (padrão `telefonia`) | `telefonia` |
| `destino` | sim | `peca:tc-3` (regra de feriado) |
| `ativo` | não (padrão `sim`) | `sim` |

**`horarios`**: cada linha é uma janela. Várias janelas com o mesmo `grupo` formam um grupo de horário.
| Coluna | Obrigatória | Exemplo |
|---|---|---|
| `id` | sim | `tg2-sabado` (a janela) |
| `grupo` | sim | `tg2` (o que as peças usam: `horario:tg2`) |
| `nome` | não | `Horário estendido` |
| `dias` | sim | `sab`, `seg ter qua qui sex` ou `seg-sex` |
| `inicio`, `fim` | sim | `17:00`, `18:00` |

**`feriados`**
| Coluna | Obrigatória | Exemplo |
|---|---|---|
| `id` | sim | `cal-padrao-2026-11-20` |
| `calendario` | sim | `cal-padrao` |
| `data` | sim | `2026-11-20` |
| `nome` | não | `Consciência Negra` |
| `todo_ano` | não | `sim` |

**`ramais`**
| Coluna | Obrigatória | Exemplo |
|---|---|---|
| `id` | sim | `9019` |
| `nome` | não | `Carolina Vanderlei` |
| `tipo` | não | `pessoa`, `webphone`, `setor` |
| `toque_s` | não (padrão da central) | `20` |
| `siga_me_so_ramal_s`, `siga_me_com_lista_s` | não | `7`, `20` |
| `siga_me_lista` | não | `ramal:9020 externo:celular` |
| `ao_nao_atender`, `ao_ocupado`, `ao_indisponivel` | não | `ramal:9507`, `fila:97775` |
| `transbordo_anti_loop` | não (padrão `nao`) | `sim` quando o transbordo não volta pra fila de onde a ligação veio |

**`filas`** e **`grupos`**
| Coluna | Obrigatória | Exemplo |
|---|---|---|
| `id` | sim | `90011` |
| `nome` | não | `URA-Aluguéis` |
| `estrategia` | sim | `rrmemory`, `ringall`, `linear` |
| `toque_por_membro_s` (filas) ou `toque_s` (grupos) | não (sem ele, a fila fica incompleta) | `15` |
| `espera_maxima_s` (só filas) | não (vazio = sem limite) | `180` |
| `ao_esgotar` | não | `fila:90012`, `fim:desliga` |
| `membros` | não | `ramal:9013 ramal:9024` |
| `membros_dinamicos` (só filas) | não | `sim` |
| `pesquisa_ao_desligar` (só filas) | não | `peca:nps-8851` |

**`pecas`**
| Coluna | Obrigatória | Exemplo |
|---|---|---|
| `id` | sim | `fase-16` |
| `tipo` | sim | `audio`, `menu`, `regra_horario`, `regra_feriado`, `consulta`, `transferencia`, `atalho`, `pesquisa`, `fim` |
| `nome` | não | `Menu principal` |
| `horario` (`regra_horario`) | condicional | `horario:tg1` |
| `calendario` (`regra_feriado`) | condicional | `cal-padrao` |
| `espera_s`, `tentativas` (`menu`) | não | `5`, `3` |
| `texto` | não | fala do áudio |
| `duracao_s` | não | `12` |
| `guarda_variavel` | não | `tipo` |
| `canal` | não | `email` (a jornada segue nesse canal a partir desta peça) |
| `id_central` | não | `wf2 fase 16` |
| `ativo` | não | `nao` (nó marcado como inativo na central) |

**`saidas`**: os canos.
| Coluna | Obrigatória | Exemplo |
|---|---|---|
| `id` | sim | `fase-16-tecla-1` |
| `de` | sim | `peca:fase-16` |
| `opcao` | sim | `1`…`9`, `0`, `*`, `#`, `esgotou`, `sim`, `nao`, `ok`, `erro`, `sempre`, ou um resultado livre |
| `rotulo` | não | `Boleto` |
| `quando` | não | `tipo=aluguel` |
| `define` | não | `tipo=aluguel` |
| `para` | sim | `peca:fase-1`, `fila:90015`, `fim:desliga` |
| `ativo` | não | `nao` |

### 8.2 Referências embutidas

`fim:desliga`, `fim:atendido`, `fim:caixa_postal` e `externo:celular` existem sem precisar de linha em nenhuma aba. Números de celular externo **não** são pedidos pelo modelo: o Journey só precisa saber que é um celular.

### 8.3 Regras de validação

**Erros (bloqueiam o import):**
- `id` repetido na aba, ou com caractere fora de letras, números, ponto, hífen e sublinhado;
- referência mal escrita, ou de um tipo que a coluna não aceita;
- campo obrigatório vazio, ou coluna obrigatória ausente;
- `tipo` ou `opcao` fora da lista;
- hora ou data inválida;
- `regra_horario` sem `horario`;
- duas saídas iguais (mesmo `de`, mesma `opcao`, mesmo `quando`).

**Avisos (não bloqueiam; a peça entra como incompleta):**
- referência bem escrita que aponta pra algo que não existe. Dado real tem isso (ramal apagado, fase removida), e bloquear o import esconderia o problema; o diagnóstico marca como grave;
- coluna desconhecida (é ignorada);
- calendário sem nenhum feriado;
- menu sem `espera_s` ou `tentativas`;
- fila sem `toque_por_membro_s`;
- peça sem nenhuma saída e que não é `fim`;
- `menu` sem saída `esgotou`.

Cada mensagem cita aba, linha e coluna, por exemplo: "saidas, linha 14, coluna `para`: `fila:90099` não existe".

### 8.4 Import parcial

Cada aba é opcional. Subir só `filas.csv` atualiza as filas e mantém o resto. As linhas se juntam pelo `id`. Uma linha que existia no catálogo e não veio num import **completo** é marcada como removida na revisão. Num import **parcial**, o que não veio não é tocado.

### 8.5 Modelos pra baixar

Na tela de import:

- **"Baixar modelo (.xlsx)":**
  - aba `instrucoes` com a explicação de cada aba e coluna;
  - uma aba por tipo, com cabeçalho, comentário em cada coluna e listas de valores permitidos;
  - 2 ou 3 linhas de exemplo preenchidas.
- **"Baixar modelo (.json)" e o esquema JSON**, pra quem automatiza.

Os dois são gerados pelo pacote `modelos` a partir de `formato`.

## 9. Conversores de outras ferramentas

Cada conversor transforma um arquivo de outra ferramenta num **rascunho** no formato Journey. Depois disso, o rascunho passa pela mesma validação e pela mesma revisão do import normal.

| Ferramenta | Arquivo | Primeira versão |
|---|---|---|
| draw.io / diagrams.net | `.drawio`, `.xml` (inclusive diagrama compactado) | sim |
| Mermaid | `.mmd` (flowchart `graph`/`flowchart`, TD/LR, formas e rótulos de seta) | sim |
| BPMN 2.0 (Bizagi, Camunda, Bonita…) | `.bpmn` | sim |
| Visio, Lucidchart | `.vsdx` | via draw.io (abrir lá e salvar `.drawio`) |
| Lucidchart (dados das formas) | `.csv` | depois |
| Miro | integração com a conta | depois |

### 9.1 Classificação das peças

O conversor sugere o tipo de cada forma pelo formato, pela cor e pelo texto:

- **BPMN:** `exclusiveGateway` → decisão; `task` → peça; `startEvent` → entrada; `endEvent` → fim; condição de `sequenceFlow` → opção.
- **draw.io e Mermaid:**
  - losango → decisão;
  - texto com "fila" e um número → `fila:<número>`;
  - "URA", "menu" ou "digite" → `menu`;
  - "horário", "seg–sex" ou "feriado" → regra;
  - "desliga" ou "fim" → `fim`;
  - rótulo de seta só com dígito → tecla;
  - "sim" ou "não" → resultado.

A **tela de mapeamento** mostra o que foi reconhecido e o que ficou como "a classificar". Tu ajusta tipo e referência e pode salvar a regra pra empresa (`regras_mapeamento`), que vale nos próximos imports. Tu também escolhe entre **manter as posições do desenho** ou **organizar automaticamente**.

## 10. Editor

- **Uma tela, dois modos:** Simular e Editar. Só membros da empresa veem o modo Editar.
- **Paleta:** entrada, áudio, menu, regra de horário, regra de feriado, consulta, fila, ramal, grupo, transferência, atalho, pesquisa, fim.
- **Ligar canos:** arrastar da válvula de uma peça até outra. Ao soltar, o editor pede a opção (tecla, resultado).
- **Painel de propriedades:** os campos do formato para aquela peça. Fila, ramal e horário são escolhidos do catálogo, com "onde é usado" logo abaixo.
- **Peças vindas do import:** um selo discreto "da central". Editar uma delas cria um ajuste. O painel mostra o valor da central e o valor ajustado, com "voltar ao da central".
- **Organizar:** layout automático em árvore (o algoritmo do protótipo, com faixas por regime de horário). Mover uma peça à mão grava a posição como ajuste.
- **Desfazer e refazer** na sessão. **Salvamento automático** a cada alteração no rascunho da sessão, com cópia local se a conexão cair. Ao sair do modo Editar, o rascunho vira versão nova.
- **Trava de edição:** ao entrar no modo Editar, a jornada fica travada pra aquela pessoa. Os outros veem "Fulano está editando" e continuam podendo simular. A trava expira após 10 minutos sem atividade, e o rascunho vira versão nova.

## 11. Simulação

### 11.1 Motor

`motor` é puro e previsível. Uma execução começa com `iniciar(jornada, catalogo, { entrada, inicio, respostas, modo })` e avança com `avancar(decisao?)`, que devolve um evento:

- `chegou(peca)`;
- `pede_decisao(peca, opcoes, quem_decide, sugestao)`;
- `correu(saida)`;
- `trocou_canal`;
- `terminou(tipo, peca, motivo)`.

A mesma jornada com as mesmas entradas dá sempre os mesmos eventos. A tela só anima o que o motor manda.

### 11.2 Quem decide

| Peça | Quem decide | Automático quando |
|---|---|---|
| `menu` | quem liga | o cenário traz a resposta |
| `regra_horario`, `regra_feriado` | o relógio | sempre, fora do modo livre, pelo horário simulado e pelo calendário do catálogo |
| `consulta` | o sistema | o cenário traz a resposta |
| `fila`, `grupo` | a fila | o cenário traz a resposta ou o modo é "ninguém atende" |
| `ramal` | quem está no ramal | o cenário traz a resposta ou o modo é "ninguém atende" |

No **modo livre**, tudo é perguntado, inclusive o relógio, com a sugestão do relógio visível.

### 11.3 Tempo, variáveis e limites

- **Tempo na linha:**
  - **menus:** `espera_s × tentativas` quando esgota, alguns segundos quando digita;
  - **ramais e grupos:** o toque real;
  - **filas:** um tempo de exemplo, marcado como exemplo;
  - **áudios:** `duracao_s` quando informado.
- **Variáveis:** `define` grava uma variável numa saída; `quando` filtra saídas por variável. Se só uma saída é válida, ela é escolhida sozinha, com a explicação no cartão.
- **Ciclos em modo automático:** a execução termina como "ciclo sem fim" quando uma peça é alcançada pela terceira vez.
- **Peça incompleta:** a água para e o cartão diz o que falta. Editores veem "Completar agora".

### 11.4 Cenários

- Um cenário guarda nome, entrada, data e hora simulada, respostas e o **resultado esperado**: os eventos da última execução aprovada.
- Cenários aparecem na lista "E se…" e podem ser abertos por link.
- **Modo "ninguém atende"** pra ramais: escolhe um ramal e segue o transbordo até o fim.

### 11.5 Tela

- Igual ao protótipo:
  - play na entrada e água animada;
  - câmera que segue a água, com opção de desligar;
  - holofote na decisão, opções no cartão e nas teclas do mapa, teclado numérico;
  - velocidade 1×, 2× e 4×, pausar;
  - **voltar e escolher outra opção**;
  - linha do tempo no painel;
  - resumo no fim (tempo na linha, decisões, canais).
- Atalhos (peças que continuam em outro ponto do mapa) levam a câmera até o destino.

## 12. Diagnóstico

### 12.1 Quando roda

A cada versão salva, no servidor, com o resultado guardado na versão. Na tela, recalcula ao vivo durante a edição.

### 12.2 Regras

| Achado | Gravidade | Regra |
|---|---|---|
| Beco sem saída | grave | peça alcançável sem saída e que não é `fim`; saída apontando pra peça inexistente ou removida |
| Ramal ou fila inexistente | grave | transbordo pra referência fora do catálogo; regra de horário com `horario` que não existe |
| Membro inexistente | alerta | ramal listado em `membros` ou `siga_me_lista` que não está no catálogo: ele não toca, os outros seguem |
| Ciclo de transbordo | grave | cadeia de `ao_nao_atender` que volta a um ramal já visitado |
| Volta sem limite | alerta | atalho de retorno pra um menu anterior sem contador |
| Redundância | alerta | duas ou mais opções do mesmo menu terminam no mesmo destino (ignora menus com `guarda_variavel`) |
| Sem entrada | alerta | peça, fila ou grupo que nenhuma entrada alcança |
| Nó inativo | alerta | saída ou peça com `ativo = nao` no caminho |
| Volta pra própria fila | alerta | ramal transborda pra fila da qual é membro |
| Grupo que desliga | alerta | grupo com `ao_esgotar = fim:desliga` ou sem `ao_esgotar` (o motor trata os dois igual) |
| Buraco no horário | observação | janela menor que 60 min sem atendimento entre duas janelas com atendimento |
| Espera sem limite | observação | fila sem `espera_maxima_s` |
| Plano B que não dispara | observação | fila com `ao_esgotar` e sem `espera_maxima_s` |
| Sem transbordo | observação | fila alcançável com `espera_maxima_s` e sem `ao_esgotar` (um achado por fila); ramais alcançáveis sem `ao_nao_atender` (um achado só, com todos) |
| Dado incompleto | observação | menu sem `espera_s` ou `tentativas`, menu sem saída `esgotou`, fila sem `toque_por_membro_s` |

### 12.3 Achados que precisam aparecer com a central real

Servem de teste de aceitação (critério 2):

1. Fase 29 apagada, alcançada pelos menus Aluguéis, Condomínios e Estendido ao esgotar.
2. 25 ramais em ciclo, incluindo 9019 ↔ 9507.
3. 24 ramais transbordando pra ramal fora da lista exportada. A confirmar: o export de 11/11 só traz os 180 ramais com transbordo configurado, então parte desses destinos pode existir (ver seção 16).
4. Emergência POA: teclas 1 e 2 na fila 99951. Fila 99950 sem entrada.
5. Seg–sex 16h55–17h sem atendimento.
6. Menu principal: 4, 5 e "não digitar" na 90015. Submenu Aluguéis: 3, 4 e 6 na 90011. Menu NS: tudo na 90019.
7. Sete transferências por nó inativo (99954 a 99960).

### 12.4 Na tela

- Cada achado tem "Ver no mapa" (holofote nas peças) e "Simular" (cenário que leva até ele).
- **Marcar como intencional:** o achado sai da contagem e fica numa seção recolhida, com nota e autor. A chave do achado é estável (tipo + referências), então a marcação sobrevive a novos imports.
- **Agenda "quem atende quando":** uma barra por dia da semana, com o regime de cada horário e feriados destacados.

## 13. Visual

- **Direção:** 70% técnico e limpo, 30% vivo.
  - **Canos:** com volume (parede, núcleo e brilho), cotovelos arredondados e luvas nas pontas.
  - **Água:** com brilho correndo e bolhas.
  - **Filas:** mostram o nível da água ondulando.
  - **Mapa:** faixas de fundo por regime de horário.
- **Cor da água = canal:** telefonia azul, WhatsApp verde, e-mail âmbar, ocorrência roxo. Ela muda quando a jornada troca de canal.
- **Cor do cano = tipo de ligação:**
  - normal: aço;
  - retorno: roxo;
  - nó inativo: núcleo tracejado;
  - sem saída: vermelho com ponta quebrada.
- **Peças:** válvula giratória onde há decisão; selo do ID da central acima de cada peça.
- **Holofote:** na decisão o resto do mapa apaga.
- **Tema:** claro e escuro com os mesmos tokens. Respeita "reduzir movimento": sem animação contínua e câmera sem transição.
- **Celular:** funciona em 390 px de largura. O mapa ocupa a parte de cima e o painel fica embaixo.
- **Desempenho:** até 300 peças com animação fluida; diagnóstico em menos de 200 ms pra 300 peças.

## 14. Compartilhamento e contas

- **Entrada:** por link mágico no e-mail, com Google opcional. A empresa é criada no primeiro acesso e editores são convidados por e-mail.
- **Link público:** criado pelo botão "Compartilhar", com as opções:
  - versão fixa ou mais recente;
  - **esconder nomes (ligado por padrão)**;
  - cenário inicial;
  - validade.
- **O link é servido por uma rota de servidor** que monta um retrato só de leitura. Os nomes são removidos no servidor quando "esconder nomes" está ligado. O navegador de quem abre o link nunca acessa as tabelas.
- **Quem abre o link** pode simular e ver o diagnóstico. Não vê histórico, ajustes nem cenários não compartilhados.
- **Revogado ou vencido:** abre uma página explicando. Não é indexado por buscadores.

## 15. Erros

| Situação | Comportamento |
|---|---|
| Arquivo com erro de validação | Import bloqueado; lista de erros por aba, linha e coluna; dá pra baixar o relatório |
| Arquivo em formato desconhecido | Mensagem com os formatos aceitos e link pros modelos |
| Conversor não reconhece uma forma | Vira "a classificar" na tela de mapeamento, nunca é descartada em silêncio |
| Conflito entre ajuste e central | Aparece na revisão do import; tu escolhe manter o ajuste ou aceitar a central |
| Ajuste órfão | Listado na revisão e numa seção "ajustes sem alvo" da jornada |
| Queda de conexão no editor | Rascunho local; ao voltar, salva e avisa |
| Jornada travada por outro editor | Modo Simular liberado; aviso com quem e desde quando |
| Peça incompleta na simulação | Água para, cartão explica o que falta |
| Link revogado ou vencido | Página explicativa |

## 16. Roteiro de extração da central atual

Entregável da primeira versão: uma pasta `extracao/freepbx-ura/` com um README e as consultas pra rodar com o Claude Code contra a central e gerar a planilha padrão.

| Fonte | Vai para |
|---|---|
| `.46` FreePBX (MySQL `asterisk`): `incoming`, `timeconditions`, `timegroups`, calendário de feriados, `queues_config`, `ringgroups`, `users` (destinos de não atende, ocupado e indisponível), siga-me do banco interno do Asterisk, `miscdests` | `entradas`, `horarios`, `feriados`, `filas`, `grupos`, `ramais` |
| `.45` URA (`c0446_omn_apiapp`): fases vivas de cada fluxo `888x`, com tipo, espera, tentativas, ligações entre fases e destino de esgotou | `pecas`, `saidas` |
| `.47` monitor: quem logou em cada fila nos últimos 30 dias | `filas.membros_dinamicos` e observação |

O roteiro também precisa trazer o que o export de 11/11 não trouxe:

- **Todos os ramais da central**, inclusive os sem transbordo configurado. O export de 11/11 só tem os 180 com transbordo; por isso 96 números diretos, 29 membros de fila e 24 transbordos apontam pra ramais "fora da lista", e o diagnóstico não consegue dizer se eles existem.
- O calendário de feriados da central.
- A lista do que faltou, que está pendente (seção 18).

## 17. Testes

- **Unitários (Vitest) nos pacotes internos:**
  - `formato`: cada regra de validação tem caso que passa e caso que falha.
  - `motor`: cada tipo de peça, variáveis, ciclos, peça incompleta, previsibilidade (mesma entrada = mesmos eventos).
  - `diagnostico`: cada regra da seção 12.2.
  - `importacao`: import completo, parcial, reaplicação de ajustes, conflito, órfão, redundante.
  - `conversores`: um arquivo de exemplo por ferramenta, mais o `fluxo.drawio` e o `fluxo-entrada.mmd` do export real.
- **Material real sem nomes:** o export de 11/11 convertido pro formato padrão, com nomes trocados, vira fixture. Os achados da seção 12.3 são testes de aceitação.
- **Cenários de referência:** cada cenário salvo tem resultado esperado. Mudança no motor que altere um resultado faz o teste falhar, mostrando a diferença.
- **Ponta a ponta (Playwright):**
  - baixar o modelo, preencher e importar;
  - simular um cenário até o fim;
  - voltar uma decisão;
  - criar um link com nomes escondidos e abrir sem login;
  - importar um `.drawio` e classificar peças.

## 18. Riscos e questões em aberto

| Item | Tratamento |
|---|---|
| **Lista do que faltou no export** | Pendente, a ser enviada pelo dono do projeto. Pode acrescentar colunas ao formato (por exemplo, texto dos áudios, prioridade de fila, música de espera) |
| IDs da central mudam quando alguém recria uma fase | Ajustes viram órfãos e aparecem na revisão; dá pra reapontar |
| React Flow com cara de encanamento | Arestas e peças customizadas desde o primeiro dia; o protótipo serve de referência visual |
| Calendário real de feriados | Entra pelo roteiro de extração (aba `feriados`); até lá, a simulação avisa que usa feriados nacionais e do RS |
| Export sem todos os ramais | O diagnóstico marca "destino inexistente" pra ramais que só não vieram no arquivo; a extração (etapa 6) precisa exportar todos |
| Nomes de colegas no app | Esconder nomes ligado por padrão nos links; dentro do app só membros da empresa veem |
| Tempo de áudio e espera em fila não vêm da central | Colunas opcionais; quando vazias, a simulação marca o tempo como exemplo |

## 19. Ordem de construção

A primeira versão é grande demais pra um plano só. Ela sai em etapas; cada uma tem seu próprio plano e termina com algo que funciona e é testado.

| Etapa | Entrega | Pronto quando |
|---|---|---|
| 1. Núcleo | Pacotes `formato`, `modelos`, `importacao`, `motor` e `diagnostico`, sem tela, com a fixture do export real | Os achados da seção 12.3 passam como teste; modelo `.xlsx` gerado |
| 2. App de simulação | Next.js + Supabase, login e empresa, tela de import (validação e revisão), catálogo, player animado, cenários, diagnóstico, visão de ramais | Critérios 1 e 2 da seção 3 |
| 3. Compartilhamento | Links públicos com nomes escondidos, cenário inicial e validade | Critério 3 |
| 4. Editor | React Flow com peças e canos customizados, ajustes, trava, versões e restauração, conflitos no reimport | Critério 4 |
| 5. Conversores | draw.io, Mermaid, BPMN e tela de mapeamento | Critério 5 |
| 6. Extração | Roteiro `extracao/freepbx-ura/` e a lista do que faltou incorporada ao formato | Planilha da central real importada sem ajuste manual de estrutura |

As etapas 3, 4 e 5 dependem da 2, mas não dependem entre si. A etapa 6 pode correr em paralelo desde a 1.

## 20. Depois da primeira versão

1. **Outros canais:** WhatsApp (fora do horário, bot, filas de atendimento), e-mail (caixa, SLA "se não responder em 2 h vai pra quem"), ocorrências. Pessoa vira entidade própria, ligada a ramal, número de WhatsApp e e-mail.
2. **Catálogo consultável completo (a abordagem C):** telas de "onde é usado" em lote, comparação entre jornadas, relatórios.
3. **Execução:** o motor roda no servidor ligado a conectores (URA, WhatsApp, agentes RAG), e o desenho passa a ser o pipeline.
4. Papéis (admin, editor, leitor com conta) e edição simultânea.
5. Exportar pra draw.io, Mermaid e BPMN; ler `.vsdx` e CSV do Lucidchart; integração com Miro.
