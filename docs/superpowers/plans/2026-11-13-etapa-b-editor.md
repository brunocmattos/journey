# Etapa B: o editor no app — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans pra executar este plano tarefa por tarefa. Os passos usam caixas de seleção (`- [ ]`) pra acompanhar o progresso.

**Objetivo:** a etapa B do spec v2 (seção 15): a tela Fluxos (em branco e a partir de modelo), o editor com tudo do protótipo salvando no banco, os cadastros que nascem do desenho (com a tela Cadastros), o estilo e animação, o play e a trava. Pronto quando os critérios 1, 2 e 5 do spec (seção 3) dão pra fazer: criar um fluxo do zero com 10 peças e 2 decisões e dar play; escrever "Fila Cobrança" numa peça e ver a fila em Cadastros, renomear lá e ver mudar no fluxo; e ter, na mesma empresa, fluxos de WhatsApp, interno e telefonia, cada um com a cor da água do seu canal.

**Arquitetura:** o editor é o protótipo aprovado (`editor-journey.html`) portado pra React, num quadro próprio: peças em HTML, canos em SVG, a água quadro a quadro. A lógica sem tela fica em `apps/web/src/editor/` (funções puras sobre o documento `journey/2`, histórico, play em cima do motor do `@journey/fluxo`, salvamento automático) e é testada com Vitest; os componentes ficam em `apps/web/src/componentes/editor/`. O documento e o estilo vão pro banco pelo `salvar_fluxo` direto do navegador, com a revisão; nome, canal, descrição e meta, e os cadastros, vão por server actions. As telas da v1 saem do menu e continuam no código até a etapa C.

**Tecnologia:** a mesma das etapas anteriores: Node 22, TypeScript 5.9, Next.js 16.4, React 19.3, `@supabase/supabase-js` 2.119 e `@supabase/ssr` 0.12, Supabase CLI 2.122, Vitest 3.2, Playwright 1.63. Nenhuma dependência nova de fora: o app passa a depender do `@journey/fluxo` (etapa A).

**Spec:** `docs/superpowers/specs/2026-11-13-journey-v2-editor.md` (seções 3, 5, 6, 7, 8, 10, 11, 13 e 15). O protótipo aprovado é a referência de comportamento e visual.

---

## Antes de começar

- **Branch:** `claude/journey-etapa-3-public-links-5wx03t`, com a `main` (etapa A) mesclada. Este plano, o código e o PR da etapa B saem dele.
- **Todo o código deste plano já foi escrito e testado num ensaio** sobre esse branch: app 258 testes (eram 184), `@journey/fluxo` 78, núcleo 253, pgTAP 136 (sem mudança: a etapa B não mexe no banco), ponta a ponta 30 passando e 1 pulado (eram 24 + 1), `typecheck` e `next build` limpos. Copie os arquivos exatamente como estão. Se um teste falhar, investigue antes de mudar o teste.
- **Sem migração nova.** A etapa B usa as tabelas e funções da etapa A (`fluxos`, `cadastros`, `canais`, `tipos_cadastro`, `salvar_fluxo`, `pegar_trava`, `soltar_trava`), que já estão em produção.
- **Docker e Supabase local:** se `docker info` falhar, `sudo containerd > /tmp/containerd.log 2>&1 &` e depois `sudo dockerd --containerd=/run/containerd/containerd.sock > /tmp/dockerd.log 2>&1 &`, e espere responder. Depois `npm install` e `npm run banco`. O `.env.local` do app é o das etapas anteriores (`apps/web/README.md`, "Rodar").
- **Commits:** crie `.git/atribuicao.txt` uma vez, com as duas linhas de atribuição da sessão (`Co-Authored-By: …` e `Claude-Session: …`). Todo commit usa `-m "$(cat .git/atribuicao.txt)"` como segundo parágrafo da mensagem.
- **Patches:** arquivo novo vem inteiro. Arquivo que já existe vem como diff; aplique da raiz do repositório salvando o bloco num arquivo e rodando `git apply <arquivo>` (ou à mão, linha por linha).
- **TDD:** a lógica (tarefas 2 a 6) tem o teste primeiro. Os componentes (7 a 10) não têm teste de unidade: quem os confere é o `typecheck` a cada tarefa e os testes de ponta a ponta das tarefas 9 e 10, escritos antes das telas que eles testam.
- **Comandos** (da raiz): `npm test` (unitários; os de banco rodam com o Supabase no ar), `npm run typecheck`, `npm run build`, `npm run e2e` (Playwright, com o Supabase no ar; passe `--trace=off`, não `-- --trace off`, que o npm come). Um arquivo de teste do app: `cd apps/web && npx vitest run test/editor/geometria.test.ts`.
- **Contagem do app:** `test/cliente-sem-exceljs.test.ts` cria um teste por arquivo de `src/componentes`; cada componente novo do editor soma um (24 → 31 até a tarefa 9).

## Decisões desta etapa

Cada uma foi comparada com a alternativa antes de entrar aqui.

| Decisão | Por quê | Alternativa recusada |
|---|---|---|
| **Quadro próprio (o protótipo em React), não React Flow** | O protótipo é a especificação aprovada ("melhorou MUITO"): canos que saem pelo lado mais direto de cada peça, a bolinha de ligar e o + com menu, grupos que levam o que está dentro, renomear em cima da peça, a água quadro a quadro com bolhas. Portar o desenho é direto; refazer tudo isso nos nós, alças e arestas do React Flow é reescrever o protótipo noutro modelo. O spec (14) previa o React Flow como base: o desvio fica registrado aqui e no README do app | React Flow: alças fixas, aresta com outro desenho, a água teria que entrar como aresta animada |
| **A lógica do editor sem tela, em funções puras** (`editor/documento.ts`) que recebem o documento e devolvem outro | Testável sem navegador; o histórico guarda as versões por referência, sem cópia profunda | Mutar o documento no lugar, como o protótipo: desfazer exigiria serializar a cada passo |
| **O cano sai pelo vão maior entre as bordas das peças** (no empate, pelos lados), e o cano de volta (a→b e b→a) ganha um desvio de 9 px pro lado | Olhar só os centros (o protótipo) faz peças em escada ligarem pelos lados, com o cano voltando por dentro delas; e o laço "fechado, espera e tenta de novo" desenhava os dois canos um em cima do outro | Os centros, como no protótipo |
| **O que sai do editor sempre passa no `lerDocumento`:** "depois de um tempo" nasce com tempo 0, "horário" com um lado, nome só de espaços volta pro nome do tipo, número de opção é o menor que falta, virar Início ou Fim tira o tempo; e o salvamento confere com o `lerDocumento` antes de mandar | O banco só confere a forma do documento: um documento que o `lerDocumento` recusa seria salvo e o fluxo não abriria mais (a página do editor lê com ele) | Deixar o banco aceitar e descobrir ao abrir |
| **Sem mudança, o mesmo documento** (mover pro mesmo lugar da grade, remendo que não muda nada, id que não existe) | O histórico não ganha passo vazio e o salvamento não manda à toa | Sempre um documento novo |
| **Desfazer: 120 passos; arrasto é um passo só** (o primeiro quadro registra, os seguintes substituem) | Ctrl+Z depois de arrastar volta a peça pro lugar de antes, não um pixel | Um passo por quadro |
| **Salvamento automático pelo navegador**, direto no `salvar_fluxo`, meio segundo depois da última mudança, um envio por vez, com a revisão | O documento vai inteiro (até ~300 KB com 500 peças); pelo servidor do Next seria uma ida a mais. A função do banco confere empresa, revisão, trava e responsáveis | Server action a cada mudança: mais lenta e o mesmo controle |
| **A cópia no navegador fica enquanto o banco não confirma** (escrita a cada envio, apagada na confirmação); sem rede, tenta de novo (2 s, 4 s… até 30 s); envio sem resposta em 20 s desiste (e conta como sem rede); ao abrir, a cópia volta se partiu da mesma revisão | Spec 7.1 ("cópia local até voltar"). Guardar só quando falha perde tudo se o pedido nunca volta e a aba fecha. Cópia de outra revisão é descartada: o banco já tem coisa mais nova | Pedir pra pessoa recarregar e perder o que fez |
| **Conflito logo depois de falta de rede é conferido:** se o banco está uma revisão à frente com uma das versões mandadas sem resposta, o envio chegou; segue dessa revisão | A resposta pode se perder depois de o banco gravar; o próximo envio daria 40001 e a tela diria que outra pessoa salvou, perdendo o que veio depois. O `jsonb` reordena as chaves: a comparação é por valor (`mesmoJson`) | Um id de salvamento no banco: mais uma migração |
| **Login vencido (PGRST301/PGRST303/401) não é "sem rede" nem recusa:** tenta de novo, com "entre de novo pra salvar"; erro passageiro (sem código, 5xx, 429, 57014, 40P01) tenta de novo; o motivo vem do código e do status, nunca do texto da mensagem | O cliente do Supabase renova o login sozinho na maioria das vezes; parar de vez por isso perderia o trabalho | Tratar tudo que não é 40001/P0001 como recusa |
| **Conflito (40001), trava perdida (P0001) ou recusa param o salvamento** e a tela pede pra recarregar; a cópia de uma recusa não fica | Salvar por cima do que outra pessoa salvou é exatamente o que a revisão impede. Uma cópia recusada voltaria a cada abertura e seria recusada de novo | Mesclar documentos: fora da v1 (spec 4) |
| **Trava ao abrir, renovada a cada 4 minutos, solta ao sair** (`fetch` com `keepalive`); sem trava, só leitura com "Fulano está editando" | Spec 4: sem edição simultânea, mas quem abre depois vê e dá play | Abrir pra editar e descobrir o conflito no primeiro salvamento |
| **Falha ao renovar a trava não é "outra pessoa"**: só `ok: false` do banco quer dizer que outra pessoa tem a trava; erro de rede ou de login mantém a edição enquanto a última trava confirmada vale (9 dos 10 minutos), tenta de novo em 20 s e na volta da rede (`online`), da aba (`visibilitychange`) e do cache (`pageshow`); passado isso, só leitura com "não deu pra confirmar a edição" | Editar sem rede é do spec (7.1); culpar outra pessoa por uma falha de rede é mentira e trava a pessoa por até 4 minutos | Tratar todo erro como trava de outra pessoa |
| **Quem estava em só leitura e pega a trava depois não edita: recarrega** (faixa "A edição deste fluxo liberou… Recarregar", e a trava é solta) | O documento e a revisão na tela são de quando a página abriu; quem tinha a trava quase sempre salvou depois, e a primeira edição daria conflito | Reler o fluxo no lugar: mais estado pra acertar sem ganho |
| **O token do `soltar_trava` acompanha a sessão** (`onAuthStateChange`) | O `fetch` com `keepalive` não passa pelo cliente do Supabase; com o token de quando a página abriu, depois de uma hora o pedido dava 401 e a trava ficava presa 10 minutos | Ler o token uma vez |
| **O responsável é uma busca nos cadastros com "Criar" no fim** (o cadastro só nasce com Enter ou clicando em "Criar"; sair do campo com um nome que não existe volta pro que era; Esc também), com o tipo sugerido pelo nome ("Fila …", "Equipe …", "Horário …") ou pela peça (Sistema, Decisão); a peça guarda o id | Critério 2: o cadastro nasce do desenho e renomear muda em todos os fluxos sem tocar nos documentos | Guardar o nome na peça, como o protótipo: renomear teria que varrer os fluxos |
| **Horário nasce de segunda a sexta, 8h às 18h**, e a tela Cadastros edita janelas e feriados | Uma decisão de horário funciona no play desde o primeiro minuto | Horário vazio: o relógio diria "fora" sempre |
| **Fluxo a partir de modelo: os cadastros do modelo viram os da empresa** (reaproveitando o que já existe com o mesmo tipo e nome: tenta criar e, se o nome já existe, acha o igual) e o documento é salvo com `instanciarModelo`; se algo falha, o fluxo e os cadastros que esta chamada criou são apagados | O banco só aceita responsável que seja cadastro da empresa; e não sobra fluxo vazio | Uma função nova no banco (`criar_fluxo_de_modelo`): mais uma migração pra uma coisa que três chamadas resolvem |
| **Play: o motor roda tudo de uma vez a partir das escolhas; a tela mostra os eventos um a um** | Voltar é tirar a última escolha e refazer; o motor já é previsível (etapa A) | Um motor passo a passo na tela |
| **O play usa uma cópia do documento de quando começou; mexer no desenho para o play** | A água não corre por um cano que acabou de sumir | Recalcular no meio do play |
| **Hora do play: agora, em São Paulo**, com o campo "Dia e hora" e "o relógio decide os horários" no cartão | É o que a pessoa espera ao dar play; o campo deixa testar "e se fosse domingo" | Uma hora fixa (segunda às 10h): o play "mentiria" sobre agora |
| **Estilo e animação por fluxo** (`fluxos.estilo`), lido sem confiar (`lerEstilo`: o que falta ou vem errado fica no padrão) | Spec 5; "usar como padrão da empresa" é da etapa D | Estilo da empresa já nesta etapa |
| **Telas da v1 fora do menu, código até a etapa C** (Nav: Fluxos, Cadastros, Membros) | O link público (`/l/[token]`) ainda é o da jornada da v1; a etapa C leva links e cenários pros fluxos e aí apaga a v1 inteira (telas e tabelas). Em produção não há jornada nem link | Apagar a v1 agora e reescrever os links do zero na C |
| **CSS do editor dentro de `.editor`** | As classes do protótipo (`.no`, `.cano`, `.painel`) colidiriam com o CSS da v1 que ainda existe | Renomear as classes do protótipo |

**Gotchas que o ensaio achou:**
- **O palco tem `overflow: hidden` e mesmo assim rola:** o navegador rola um contêiner pra mostrar o elemento com foco, e o cartão do play sumia pro lado. O palco volta a (0, 0) a cada rolagem (`onScroll`).
- **Com o ponteiro capturado, o duplo clique chega no palco:** o arrasto começa no primeiro clique (`setPointerCapture`), então o `dblclick` tem o palco como alvo. O alvo de verdade é `document.elementFromPoint(x, y)`.
- **`<select>` dentro de `<label>` leva o texto das opções no nome acessível** ("Canal principal Telefonia WhatsApp E-mail…"): `getByLabel('E-mail')` achava o select. Todo select assim tem `aria-label`.
- **Turbopack não compila arquivo fora da raiz do projeto:** um `node_modules` que é link pra outra pasta quebra o `next dev` ("Could not find the Next.js package"). Rode `npm install` de verdade.
- **Teclas no play só valem com a pergunta na tela:** a peça aparece (evento `chegou`) meio segundo antes da pergunta (`pede_escolha`). Os testes esperam o botão da opção antes de apertar a tecla.
- **O modo estrito do React roda a limpeza do efeito uma vez ao montar:** a limpeza do editor não pode `parar()` o salvamento (ele ficaria parado de vez). Ela só espera o que falta (`agora()`) e solta a trava.
- **A água passa de novo por um cano já cheio** (voltar ao menu, "fechado, espera e tenta de novo"): o `correu` tira o cano das cheias, senão o quadro desenha o cano cheio, a água nunca chega e o play para.
- **O PostgREST devolve no máximo 1000 linhas por pedido, calado** (`max_rows`, aqui e no Supabase): a lista de cadastros e o "onde é usado" vêm de 1000 em 1000 (`todas`, no `dados.ts`), e criar um cadastro nunca lê a lista inteira (`acharOuCriarCadastro` tenta criar e, no 23505, busca só os parecidos).
- **Clicar noutra peça com um campo do painel em foco:** o `pointerdown` muda a seleção antes de o navegador tirar o foco, e o `blur` do campo gravava o texto na peça nova (o React reaproveita o `<input>` quando o valor é igual). O quadro tira o foco do painel antes de selecionar, cada painel tem `key` pela seleção, e o campo grava o que ficou digitado ao desmontar, com o id de antes.
- **Callback depois de um `await` não pode usar o documento da renderização de antes:** criar um cadastro (ação no servidor) e só então pôr o responsável na peça desfazia o que a pessoa mudou nesse meio-tempo. As mudanças partem de uma ref com o documento mais recente (`docAtual()`), e cada quadro do arrasto é uma função aplicada ao documento atual (posição absoluta da peça; o grupo leva os de dentro a partir da posição de início), não um documento calculado de uma foto: senão o que chega no meio do arrasto (um responsável criado no servidor, Ctrl+Z, Delete) some no quadro seguinte. Ctrl+Z, Ctrl+Y e Delete no meio do arrasto encerram o arrasto.
- **Gestos por ponteiro:** guarde o `pointerId` e ignore os outros; `pointercancel` e `lostpointercapture` encerram o gesto (o sistema pode tomar o toque e o `pointerup` nunca chega).
- **Enter com foco num botão ou link é do botão:** o atalho de renomear (Enter) ignora `button, a, [role=button]…`; a peça trata o próprio Enter no quadro. Botão com só `onPointerDown` não funciona no teclado: o `onClick` com `e.detail === 0` cobre teclado e leitor de tela. Pelo teclado, uma forma da barra cria a peça no centro do quadro visível, já selecionada e com foco (Enter renomeia).
- **`beforeunload` com o salvamento parado** (conflito, trava, recusa) não pede confirmação: senão "Recarregar" abria o diálogo "sair do site?".
- **Rode o pgTAP antes da ponta a ponta** (ou num banco recém-criado): o `journey.test.sql` (da v1) cria a versão 2 de toda jornada do banco, e os testes de importar da ponta a ponta deixam jornadas com versão 2; aí o pgTAP para em `jornada_versoes_jornada_id_numero_key`. Não é regressão da etapa B.
- **Hora da trava no fuso de São Paulo** (`timeZone: FUSO`): o servidor e o navegador de teste rodam em UTC.
- **Um canal chamado `constructor`** acharia a função do `Object` em `estilo.canais[chave]`: a cor só vale se for própria do objeto (`Object.hasOwn`). E o `ESTILO_PADRAO` é congelado: quem quer mudar, copia.
- **`naGrade` devolve 0, não -0:** `Math.round(-0.1) * 10` é `-0`, e o `toEqual` do Vitest diferencia.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/package.json`, `next.config.ts`, `package-lock.json` | O app depende do `@journey/fluxo` (e o transpila) |
| `apps/web/src/app/globals.css`, `src/componentes/Icone.tsx` | Tokens do editor (`--accent`, `--nota`, `--grupo`, `--mistura`) e os ícones das peças e ferramentas |
| `packages/fluxo/src/modelos.ts` | A URA e a Esteira de crédito arrumadas: nenhum cano atravessa uma peça, nas três curvas |
| `apps/web/src/editor/pecas.ts`, `geometria.ts`, `estilo.ts` | Formas e tamanhos; desenho dos canos; estilo e cor da água |
| `apps/web/src/editor/documento.ts`, `historico.ts` | Mudanças no documento (criar, ligar, mover, mudar, apagar, duplicar); desfazer e refazer |
| `apps/web/src/editor/play.ts` | O play em cima do motor: rodar, o que a tela mostra depois de n eventos, esperas, teclas |
| `apps/web/src/editor/salvamento.ts`, `cadastros.ts` | Salvamento automático; busca, tipo sugerido e Horário padrão dos cadastros |
| `apps/web/src/lib/dados.ts` | Leituras: fluxos (lista), fluxo pra editar, canais, cadastros, tipos, "onde é usado" |
| `apps/web/src/acoes/fluxos.ts`, `cadastros.ts` | Server actions: criar (em branco, de modelo), mudar e apagar fluxo; criar, renomear, apagar cadastro e mudar Horário |
| `apps/web/src/lib/cadastro-unico.ts` | Cria o cadastro ou acha o que já existe com o mesmo nome no tipo (sem ler a lista inteira) |
| `apps/web/src/componentes/editor/*` | O editor: `editor.css`, `Pecas`, `Agua`, `Quadro`, `Campos`, `Painel`, `CartaoPlay`, `Editor` |
| `apps/web/src/app/e/[empresa]/page.tsx`, `lista.tsx` | A tela Fluxos (casa da empresa) com o "Novo fluxo" |
| `apps/web/src/app/e/[empresa]/f/[fluxo]/page.tsx`, `error.tsx` | O editor |
| `apps/web/src/app/e/[empresa]/cadastros/page.tsx`, `tabela.tsx` | A tela Cadastros |
| `apps/web/src/componentes/Nav.tsx` | Menu: Fluxos, Cadastros, Membros |
| `apps/web/test/editor/*`, `test/acoes/*` | Unitários |
| `apps/web/e2e/editor.spec.ts`, `fluxos.spec.ts`, `cadastros.spec.ts` e os da v1 | Ponta a ponta |
| `README.md`, `apps/web/README.md` | Documentação |

---

### Tarefa 1: o app ligado ao pacote, tokens e ícones

**Arquivos:**
- Modificar: `apps/web/package.json`, `apps/web/next.config.ts`, `package-lock.json` (pelo `npm install`)
- Modificar: `apps/web/src/app/globals.css`, `apps/web/src/componentes/Icone.tsx`
- Modificar: `packages/fluxo/src/modelos.ts`

- [ ] **Passo 1: a dependência e o transpile**

```diff
diff --git a/apps/web/package.json b/apps/web/package.json
index 46a8114..2d0dba8 100644
--- a/apps/web/package.json
+++ b/apps/web/package.json
@@ -12,6 +12,7 @@
     "e2e": "playwright test"
   },
   "dependencies": {
+    "@journey/fluxo": "*",
     "@journey/nucleo": "*",
     "@supabase/ssr": "0.12.7",
     "@supabase/supabase-js": "2.119.0",
```

```diff
diff --git a/apps/web/next.config.ts b/apps/web/next.config.ts
index 5127ac3..e951274 100644
--- a/apps/web/next.config.ts
+++ b/apps/web/next.config.ts
@@ -1,7 +1,7 @@
 import type { NextConfig } from 'next';
 
 const config: NextConfig = {
-  transpilePackages: ['@journey/nucleo'],
+  transpilePackages: ['@journey/nucleo', '@journey/fluxo'],
   // O link público: nenhum buscador indexa, e o endereço (que é a chave) não vai no Referer pra outro site.
   headers: async () => [
     {
```

Rode `npm install` na raiz. O `package-lock.json` ganha só `"@journey/fluxo": "*"` nas dependências do `apps/web`.

- [ ] **Passo 2: os tokens do editor (claro e os dois escuros)**

```diff
diff --git a/apps/web/src/app/globals.css b/apps/web/src/app/globals.css
index 7eaa13b..f5890bd 100644
--- a/apps/web/src/app/globals.css
+++ b/apps/web/src/app/globals.css
@@ -13,6 +13,8 @@
   --shadow: 0 14px 36px -16px rgba(14, 38, 52, 0.42);
   --agenda-1: #1e7fd0; --agenda-2: #c98410; --agenda-3: #17914f; --agenda-4: #7650d6; --agenda-5: #cf3a3a; --agenda-6: #3a6a88;
   --lit: var(--w-telefonia);
+  /* Editor (v2): destaque, nota, grupo e quanto as cores claras se misturam no fundo. */
+  --accent: #1e8bdc; --accent-soft: #dcecf8; --nota: #f6eaa8; --nota-ink: #4f4110; --grupo: #dfe8ec; --mistura: 60%;
   --f-display: var(--fonte-display), 'IBM Plex Sans', system-ui, sans-serif;
   --f-body: var(--fonte-corpo), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
   --f-mono: var(--fonte-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
@@ -27,6 +29,7 @@
     --lane: #10191e; --lane-ink: #26353d;
     --w-telefonia: #46a8f0; --w-whatsapp: #2cc274; --w-ocorrencia: #9c7ef2; --w-email: #eda63a;
     --ret: #8e80d8;
+    --accent: #46a8f0; --accent-soft: #14283a; --nota: #4a4220; --nota-ink: #f3e7b0; --grupo: #131f26; --mistura: 16%;
     --bad: #f06a62; --bad-soft: #3a1c1d; --warn: #e6a23c; --warn-soft: #33270f;
     --ok: #3cc47d; --ok-soft: #12301f; --info: #7fb2d6; --info-soft: #14262f;
     --btn: #e2ebee; --btn-ink: #0a1014;
@@ -43,6 +46,7 @@
   --lane: #10191e; --lane-ink: #26353d;
   --w-telefonia: #46a8f0; --w-whatsapp: #2cc274; --w-ocorrencia: #9c7ef2; --w-email: #eda63a;
   --ret: #8e80d8;
+  --accent: #46a8f0; --accent-soft: #14283a; --nota: #4a4220; --nota-ink: #f3e7b0; --grupo: #131f26; --mistura: 16%;
   --bad: #f06a62; --bad-soft: #3a1c1d; --warn: #e6a23c; --warn-soft: #33270f;
   --ok: #3cc47d; --ok-soft: #12301f; --info: #7fb2d6; --info-soft: #14262f;
   --btn: #e2ebee; --btn-ink: #0a1014;
```

- [ ] **Passo 3: os ícones das peças e ferramentas** (os mesmos traços do protótipo)

```diff
diff --git a/apps/web/src/componentes/Icone.tsx b/apps/web/src/componentes/Icone.tsx
index efdd1fa..d57ef3f 100644
--- a/apps/web/src/componentes/Icone.tsx
+++ b/apps/web/src/componentes/Icone.tsx
@@ -27,9 +27,25 @@ const TRACOS: Record<string, string> = {
   legenda: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z M8 9h8 M8 13h8 M8 17h5',
   robo: 'M8 8h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3z M12 4.5V8 M9.5 16h5',
   link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2',
+  // Peças e ferramentas do editor (v2).
+  inicio: 'M8 5.2v13.6L19 12z',
+  mensagem: 'M4 5h16v11H9.5L5 19.5V16H4z M8 9.5h8 M8 12.5h5',
+  etapa: 'M5 5h14v14H5z M8.5 12l2.5 2.5L16 9.5',
+  decisao: 'M12 3l9 9-9 9-9-9z',
+  espera: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17z M12 7.5V12l3 2',
+  atendimento: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4.5 20.5a7.5 7.5 0 0 1 15 0',
+  sistema: 'M9 3v5 M15 3v5 M6.5 8h11v3a5.5 5.5 0 0 1-11 0z M12 16.5V21',
+  fim: 'M5 21V4 M5 4h11l-2 4 2 4H5',
+  nota: 'M5 4h14v11l-5 5H5z M14 20v-5h5',
+  grupo: 'M4 7V4h3 M17 4h3v3 M20 17v3h-3 M7 20H4v-3 M9 4h6 M9 20h6 M4 9v6 M20 9v6',
+  selecionar: 'M5 3l13 8-6 1.5L9.5 19z',
+  mao: 'M8 13V6.5a1.5 1.5 0 0 1 3 0V12 M11 11V5a1.5 1.5 0 0 1 3 0v6 M14 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5-2.7L3.6 14a1.5 1.5 0 0 1 2.4-1.8L8 14',
+  refazer: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
+  parar: 'M6 6h12v12H6z',
+  voltar: 'M11 6 5 12l6 6 M5 12h14',
 };
 
-const CHEIOS = new Set(['play', 'pausa']);
+const CHEIOS = new Set(['play', 'pausa', 'inicio', 'parar']);
 
 export function Icone({ nome, className = 'icone' }: { nome: keyof typeof TRACOS | string; className?: string }) {
   const d = TRACOS[nome] ?? TRACOS.seta!;
```

- [ ] **Passo 4: os modelos sem cano atravessando peça**

Na URA, o fora do horário e o desliga ficam embaixo, perto um do outro, e a opção inválida logo abaixo do suporte. Na Esteira de crédito, a negativa vai pra baixo e a análise um pouco pra esquerda. Só posições: os testes do pacote não mudam.

```diff
diff --git a/packages/fluxo/src/modelos.ts b/packages/fluxo/src/modelos.ts
index d5f7e74..7eacba6 100644
--- a/packages/fluxo/src/modelos.ts
+++ b/packages/fluxo/src/modelos.ts
@@ -94,12 +94,12 @@ export const MODELOS: readonly Modelo[] = congelar([
         peca('score', 'sistema', 260, 69, 'Consulta o score', { responsavel: 'bureau', tempo_s: 20 }),
         peca('faixa', 'decisao', 540, 30, 'Score?'),
         peca('automatico', 'etapa', 760, -60, 'Aprova automático', { tempo_s: 60 }),
-        peca('analise', 'atendimento', 730, 280, 'Análise do pedido', { responsavel: 'analistas', tempo_s: 14400 }),
+        peca('analise', 'atendimento', 700, 300, 'Análise do pedido', { responsavel: 'analistas', tempo_s: 14400 }),
         peca('analista', 'decisao', 1030, 240, 'Analista aprova?'),
         peca('liberado', 'fim', 1320, -56, 'Crédito liberado'),
         peca('aviso', 'mensagem', 1300, 140, 'Avisa o cliente por e-mail', { canal: 'email', tempo_s: 30 }),
-        peca('aviso-negado', 'mensagem', 1030, 480, 'Avisa a negativa por e-mail', { canal: 'email', tempo_s: 30 }),
-        peca('negado', 'fim', 1320, 483, 'Pedido negado'),
+        peca('aviso-negado', 'mensagem', 1300, 560, 'Avisa a negativa por e-mail', { canal: 'email', tempo_s: 30 }),
+        peca('negado', 'fim', 1580, 563, 'Pedido negado'),
       ],
       [
         liga('c1', 'pedido', 'score'),
@@ -158,9 +158,9 @@ export const MODELOS: readonly Modelo[] = congelar([
         peca('suporte', 'atendimento', 840, 20, 'Atende suporte', { responsavel: 'fila-suporte', tempo_s: 240 }),
         peca('atendido', 'fim', 1180, -70, 'Atendido'),
         peca('caixa', 'mensagem', 1160, 120, 'Caixa postal', { tempo_s: 30 }),
-        peca('desliga', 'fim', 1440, 123, 'Desliga'),
-        peca('fechado', 'mensagem', 300, 240, 'Fora do horário', { tempo_s: 9 }),
-        peca('invalida', 'mensagem', 840, 240, 'Opção inválida', { tempo_s: 4 }),
+        peca('desliga', 'fim', 1440, 300, 'Desliga'),
+        peca('fechado', 'mensagem', 560, 380, 'Fora do horário', { tempo_s: 9 }),
+        peca('invalida', 'mensagem', 840, 220, 'Opção inválida', { tempo_s: 4 }),
       ],
       [
         liga('c1', 'liga', 'horario'),
```

- [ ] **Passo 5: conferir**

Run: `npm test -w packages/fluxo && npm run typecheck`
Expected: `Tests  78 passed (78)` no pacote; `tsc` sem saída em todos.

- [ ] **Passo 6: commit**

```bash
git add package-lock.json apps/web/package.json apps/web/next.config.ts apps/web/src/app/globals.css apps/web/src/componentes/Icone.tsx packages/fluxo/src/modelos.ts
git commit -m "web: depende do @journey/fluxo; tokens e ícones do editor" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 2: formas, canos e estilo

**Arquivos:**
- Criar: `apps/web/src/editor/pecas.ts`, `geometria.ts`, `estilo.ts`
- Criar: `apps/web/test/editor/pecas.test.ts`, `geometria.test.ts`, `estilo.test.ts`

- [ ] **Passo 1: escrever os testes**

`apps/web/test/editor/pecas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NOMES_TIPOS, TIPOS_PECA } from '@journey/fluxo';
import { FORMAS, ORDEM_FORMAS, caixaDe, naGrade } from '@/editor/pecas';

describe('editor/pecas', () => {
  it('grade de 10 px, sem -0', () => {
    expect([naGrade(14), naGrade(15), naGrade(-0.1), naGrade(-16)]).toEqual([10, 20, 0, -20]);
    expect(Object.is(naGrade(-0.1), -0)).toBe(false);
  });

  it('a caixa vem do tipo; nomes e ordem são os do pacote', () => {
    expect(caixaDe({ tipo: 'decisao', x: 10, y: 20 })).toEqual({ x: 10, y: 20, w: 140, h: 140 });
    expect(ORDEM_FORMAS).toEqual(TIPOS_PECA);
    for (const t of TIPOS_PECA) expect(FORMAS[t].nome).toBe(NOMES_TIPOS[t]);
  });
});
```

`apps/web/test/editor/geometria.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { caminho, dentro, envolvente, geometriaCano, lados } from '@/editor/geometria';

const A = { x: 0, y: 0, w: 100, h: 60 };

describe('editor/geometria', () => {
  it('sai pelo lado mais direto (prefere os lados)', () => {
    expect(lados(A, { x: 300, y: 50, w: 100, h: 60 })).toEqual(['d', 'e']);
    expect(lados(A, { x: -300, y: 0, w: 100, h: 60 })).toEqual(['e', 'd']);
    expect(lados(A, { x: 0, y: 300, w: 100, h: 60 })).toEqual(['b', 'c']);
    expect(lados(A, { x: 0, y: -300, w: 100, h: 60 })).toEqual(['c', 'b']);
  });

  it('cano: sai da borda, chega recuado 7 px pra seta encostar, rótulo no meio', () => {
    const g = geometriaCano(A, { x: 300, y: 0, w: 100, h: 60 }, 'reta');
    expect(g.d).toBe('M100,30 L293,30');
    expect(g.meio).toEqual({ x: 196.5, y: 30 });
    expect(geometriaCano(A, { x: 300, y: 0, w: 100, h: 60 }, 'suave').d).toMatch(/^M100,30 C/);
  });

  it('peças em escada ligam por cima e por baixo, não pelos lados (o cano voltaria por dentro delas)', () => {
    const a = { x: 0, y: 0, w: 210, h: 62 };
    const b = { x: 150, y: 100, w: 210, h: 62 };
    expect(lados(a, b)).toEqual(['b', 'c']);
    expect(geometriaCano(a, b, 'reta').d).toBe('M105,62 L255,93');
  });

  it('cotovelo vertical também é arredondado', () => {
    expect(caminho({ x: 0, y: 0, nx: 0, ny: 1 }, { x: 100, y: 200, nx: 0, ny: -1 }, 'cotovelo')).toBe('M0,0 L0,86 Q0,100 14,100 L86,100 Q100,100 100,114 L100,200');
  });

  it('ida e volta entre as mesmas peças: o desvio afasta os dois canos', () => {
    const B = { x: 400, y: 0, w: 100, h: 60 };
    const ida = geometriaCano(A, B, 'reta', false, -9);
    const volta = geometriaCano(B, A, 'reta', false, 9);
    expect(ida.d).toBe('M100,21 L393,21');
    expect(volta.d).toBe('M400,39 L107,39');
  });

  it('laço na própria peça: o rótulo fica em cima da curva', () => {
    const g = geometriaCano(A, A, 'suave', true);
    expect(g.d).toBe('M100,30 C170,30 90,-77 50,-7');
    expect(g.meio).toEqual({ x: 116.25, y: -14.75 }); // a curva em t = 0,5
  });

  it('cotovelo arredondado; sem altura pra curva, vira reta', () => {
    const p1 = { x: 0, y: 0, nx: 1, ny: 0 };
    expect(caminho(p1, { x: 200, y: 100, nx: -1, ny: 0 }, 'cotovelo')).toBe('M0,0 L86,0 Q100,0 100,14 L100,86 Q100,100 114,100 L200,100');
    expect(caminho(p1, { x: 200, y: 0, nx: -1, ny: 0 }, 'cotovelo')).toBe('M0,0 L200,0');
  });

  it('dentro pelo centro, e a caixa que cobre tudo', () => {
    expect(dentro({ x: 10, y: 10, w: 20, h: 20 }, A)).toBe(true);
    expect(dentro({ x: 90, y: 10, w: 40, h: 20 }, A)).toBe(false);
    expect(envolvente([A, { x: 200, y: -50, w: 10, h: 10 }])).toEqual({ x: 0, y: -50, w: 210, h: 110 });
    expect(envolvente([])).toBeNull();
  });
});
```

`apps/web/test/editor/estilo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ESTILO_PADRAO, corDoCanal, lerEstilo } from '@/editor/estilo';

describe('editor/estilo', () => {
  it('o que falta ou vem errado fica no padrão; números ficam nos limites', () => {
    expect(lerEstilo(null)).toEqual(ESTILO_PADRAO);
    expect(lerEstilo({ cano: 'arco-íris', espessura: 99, velocidade: -3, bolhas: 'sim', autoEscolha: 3.4, canais: { whatsapp: '#000000', email: 'azul' } })).toEqual({
      ...ESTILO_PADRAO,
      espessura: 20,
      velocidade: 0.25,
      autoEscolha: 3,
      canais: { whatsapp: '#000000' },
    });
  });

  it('canais que não são um objeto de cores ficam vazios; o padrão não muda', () => {
    expect(lerEstilo({ canais: ['#000000'] }).canais).toEqual({});
    expect(lerEstilo(JSON.parse('{"canais":{"__proto__":"#000000","email":"#111111"}}')).canais).toEqual({ email: '#111111' });
    expect(lerEstilo('lixo')).toEqual(ESTILO_PADRAO);
    expect(Object.isFrozen(ESTILO_PADRAO) && Object.isFrozen(ESTILO_PADRAO.canais)).toBe(true);
  });

  it('cor da água: a do fluxo, senão a da empresa, senão azul', () => {
    const canais = [{ chave: 'whatsapp', nome: 'WhatsApp', cor: '#159e5a' }];
    expect(corDoCanal(lerEstilo({ canais: { whatsapp: '#111111' } }), canais, 'whatsapp')).toBe('#111111');
    expect(corDoCanal(ESTILO_PADRAO, canais, 'whatsapp')).toBe('#159e5a');
    expect(corDoCanal(ESTILO_PADRAO, canais, 'fax')).toBe('#1e8bdc');
    expect(corDoCanal(ESTILO_PADRAO, canais, null)).toBe('#1e8bdc');
    expect(corDoCanal(ESTILO_PADRAO, [{ chave: 'constructor', nome: 'C', cor: '#222222' }], 'constructor')).toBe('#222222');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/editor`
Expected: FAIL, `Failed to resolve import "@/editor/pecas"` (e os da geometria e do estilo).

- [ ] **Passo 3: as formas**

`apps/web/src/editor/pecas.ts`:

```ts
import { NOMES_TIPOS, TIPOS_PECA, type Peca, type TipoPeca } from '@journey/fluxo';

const TAMANHOS: Record<TipoPeca, { w: number; h: number; dica: string }> = {
  inicio: { w: 190, h: 60, dica: 'Onde a jornada começa: um número, um contato, um formulário…' },
  mensagem: { w: 210, h: 62, dica: 'O que a pessoa recebe ou ouve' },
  etapa: { w: 210, h: 62, dica: 'Uma tarefa ou passo do processo' },
  decisao: { w: 140, h: 140, dica: 'Um ponto com mais de um caminho' },
  espera: { w: 200, h: 62, dica: 'Um tempo parado: SLA, fila, aguardando resposta' },
  atendimento: { w: 220, h: 62, dica: 'Uma pessoa, fila ou equipe atende' },
  sistema: { w: 210, h: 62, dica: 'Uma consulta ou integração com outro sistema' },
  fim: { w: 180, h: 56, dica: 'Onde a jornada termina' },
};

/** Tamanho, nome (o do pacote) e dica de cada tipo de peça no quadro. O documento não guarda tamanho: vem do tipo. */
export const FORMAS: Record<TipoPeca, { nome: string; w: number; h: number; dica: string }> = Object.fromEntries(
  TIPOS_PECA.map((t) => [t, { nome: NOMES_TIPOS[t], ...TAMANHOS[t] }]),
) as Record<TipoPeca, { nome: string; w: number; h: number; dica: string }>;

/** A ordem da barra de formas: a do pacote. */
export const ORDEM_FORMAS: readonly TipoPeca[] = TIPOS_PECA;

export const NOTA = { w: 190, h: 110 } as const;
export const GRUPO = { w: 400, h: 240, minW: 160, minH: 100 } as const;

/** O retângulo de uma peça no quadro. */
export interface Caixa {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const caixaDe = (p: Pick<Peca, 'tipo' | 'x' | 'y'>): Caixa => ({ x: p.x, y: p.y, w: FORMAS[p.tipo].w, h: FORMAS[p.tipo].h });

/** Tipos de peça que usam um responsável (um cadastro), com o rótulo do campo. */
export const ROTULO_RESPONSAVEL: Partial<Record<TipoPeca, string>> = {
  atendimento: 'Quem atende (pessoa, fila ou equipe)',
  sistema: 'Sistema',
  decisao: 'Regra usada (ex.: horário)',
  espera: 'Quem ou o que segura',
  etapa: 'Responsável',
};

/** Arredonda pra grade de 10 px do quadro (sem -0, que atrapalha comparar). */
export const naGrade = (v: number): number => Math.round(v / 10) * 10 || 0;
```

- [ ] **Passo 4: os canos**

`apps/web/src/editor/geometria.ts`:

```ts
import type { Caixa } from './pecas';

export type Curva = 'suave' | 'cotovelo' | 'reta';
type Lado = 'd' | 'e' | 'b' | 'c';

/** Um ponto na borda de uma peça, com a direção em que o cano sai ou entra. */
export interface Ancora {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

export const centro = (c: Caixa) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });

/**
 * De que lado sai e por qual entra: pelo vão maior entre as bordas (no empate, pelos lados). Olhar só os centros
 * faria peças em escada (uma abaixo e um pouco à direita) ligarem pelos lados, com o cano voltando por dentro delas.
 */
export function lados(a: Caixa, b: Caixa): [Lado, Lado] {
  const dx = centro(b).x - centro(a).x;
  const dy = centro(b).y - centro(a).y;
  const vaoX = dx >= 0 ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
  const vaoY = dy >= 0 ? b.y - (a.y + a.h) : a.y - (b.y + b.h);
  if (vaoX >= vaoY) return dx >= 0 ? ['d', 'e'] : ['e', 'd'];
  return dy >= 0 ? ['b', 'c'] : ['c', 'b'];
}

export function ancora(c: Caixa, l: Lado): Ancora {
  if (l === 'd') return { x: c.x + c.w, y: c.y + c.h / 2, nx: 1, ny: 0 };
  if (l === 'e') return { x: c.x, y: c.y + c.h / 2, nx: -1, ny: 0 };
  if (l === 'b') return { x: c.x + c.w / 2, y: c.y + c.h, nx: 0, ny: 1 };
  return { x: c.x + c.w / 2, y: c.y, nx: 0, ny: -1 };
}

/** O desenho do cano entre duas âncoras: curva suave, cotovelo (com cantos arredondados) ou reta. */
export function caminho(p1: Ancora, p2: Ancora, curva: Curva): string {
  if (curva === 'reta') return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
  if (curva === 'cotovelo') {
    const r = 14;
    if (p1.nx !== 0) {
      const mx = (p1.x + p2.x) / 2;
      const s = Math.sign(p2.y - p1.y) || 1;
      const sx1 = Math.sign(mx - p1.x) || 1;
      const sx2 = Math.sign(p2.x - mx) || 1;
      const rr = Math.min(r, Math.abs(p2.y - p1.y) / 2, Math.abs(mx - p1.x), Math.abs(p2.x - mx));
      if (rr < 1) return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
      return `M${p1.x},${p1.y} L${mx - sx1 * rr},${p1.y} Q${mx},${p1.y} ${mx},${p1.y + s * rr} L${mx},${p2.y - s * rr} Q${mx},${p2.y} ${mx + sx2 * rr},${p2.y} L${p2.x},${p2.y}`;
    }
    const my = (p1.y + p2.y) / 2;
    const s = Math.sign(p2.x - p1.x) || 1;
    const sy1 = Math.sign(my - p1.y) || 1;
    const sy2 = Math.sign(p2.y - my) || 1;
    const rr = Math.min(r, Math.abs(p2.x - p1.x) / 2, Math.abs(my - p1.y), Math.abs(p2.y - my));
    if (rr < 1) return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
    return `M${p1.x},${p1.y} L${p1.x},${my - sy1 * rr} Q${p1.x},${my} ${p1.x + s * rr},${my} L${p2.x - s * rr},${my} Q${p2.x},${my} ${p2.x},${my + sy2 * rr} L${p2.x},${p2.y}`;
  }
  const d = Math.max(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2.2);
  return `M${p1.x},${p1.y} C${p1.x + p1.nx * d},${p1.y + p1.ny * d} ${p2.x + p2.nx * d},${p2.y + p2.ny * d} ${p2.x},${p2.y}`;
}

/** A seta encosta na peça: o fim do cano recua um pouco pra fora da borda. */
const RECUO = 7;

/** Ponto da curva suave em t = 0,5 (a de Bézier que `caminho` desenha). */
function meioSuave(p1: Ancora, p2: Ancora): { x: number; y: number } {
  const d = Math.max(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2.2);
  const c1 = { x: p1.x + p1.nx * d, y: p1.y + p1.ny * d };
  const c2 = { x: p2.x + p2.nx * d, y: p2.y + p2.ny * d };
  return { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 };
}

export interface GeometriaCano {
  d: string;
  p1: Ancora;
  p2: Ancora;
  /** Onde fica o rótulo da regra: o meio do desenho. */
  meio: { x: number; y: number };
}

/** Afasta uma âncora pro lado (perpendicular à saída): é o que separa um cano do de volta. */
const desviar = (p: Ancora, d: number): Ancora => (p.nx !== 0 ? { ...p, y: p.y + d } : { ...p, x: p.x + d });

/**
 * O cano entre duas peças. Laço na própria peça sai pela direita e volta por cima. `desvio` afasta as duas pontas
 * pro lado (em px): quem desenha usa quando há o cano de volta (a→b e b→a), pra os dois não ficarem um em cima do outro.
 */
export function geometriaCano(a: Caixa, b: Caixa, curva: Curva, mesmaPeca = false, desvio = 0): GeometriaCano {
  if (mesmaPeca) {
    const p1 = ancora(a, 'd');
    const p2 = { ...ancora(a, 'c'), y: a.y - RECUO };
    const c1 = { x: p1.x + 70, y: p1.y };
    const c2 = { x: p2.x + 40, y: p2.y - 70 };
    const meio = { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 };
    return { d: `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`, p1, p2, meio };
  }
  const [la, lb] = lados(a, b);
  const p1 = desviar(ancora(a, la), desvio);
  const p2 = desviar(ancora(b, lb), desvio);
  const p2r = { ...p2, x: p2.x + p2.nx * RECUO, y: p2.y + p2.ny * RECUO };
  const meio = curva === 'suave' ? meioSuave(p1, p2r) : { x: (p1.x + p2r.x) / 2, y: (p1.y + p2r.y) / 2 };
  return { d: caminho(p1, p2r, curva), p1, p2: p2r, meio };
}

/** Uma caixa está dentro da outra pelo centro (é o que decide o que um grupo leva junto). */
export function dentro(c: Caixa, g: Caixa): boolean {
  const m = centro(c);
  return m.x > g.x && m.x < g.x + g.w && m.y > g.y && m.y < g.y + g.h;
}

/** A caixa que cobre todas: pra "ver tudo". Null quando não há nada. */
export function envolvente(caixas: readonly Caixa[]): Caixa | null {
  if (!caixas.length) return null;
  const x1 = Math.min(...caixas.map((c) => c.x));
  const y1 = Math.min(...caixas.map((c) => c.y));
  const x2 = Math.max(...caixas.map((c) => c.x + c.w));
  const y2 = Math.max(...caixas.map((c) => c.y + c.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
```

- [ ] **Passo 5: o estilo**

`apps/web/src/editor/estilo.ts`:

```ts
import type { Curva } from './geometria';

/**
 * Como o fluxo é desenhado e animado. Fica em fluxos.estilo (só o que muda em relação ao padrão vale, mas
 * guardamos inteiro: é pequeno). `canais` troca a cor da água de um canal só neste fluxo.
 */
export interface Estilo {
  canais: Record<string, string>;
  cano: 'cano' | 'linha' | 'tracejado';
  curva: Curva;
  espessura: number;
  velocidade: number;
  bolhas: boolean;
  brilho: boolean;
  ondas: boolean;
  holofote: boolean;
  camera: boolean;
  /** Segundos até a água seguir sozinha pela primeira opção; 0 é nunca. */
  autoEscolha: number;
}

/** Congelado: quem quer mudar, copia (`{ ...ESTILO_PADRAO, … }`). */
export const ESTILO_PADRAO: Estilo = Object.freeze({
  canais: Object.freeze({}),
  cano: 'cano',
  curva: 'suave',
  espessura: 10,
  velocidade: 1,
  bolhas: true,
  brilho: true,
  ondas: true,
  holofote: true,
  camera: true,
  autoEscolha: 0,
});

export const VELOCIDADES = [0.5, 1, 2, 4] as const;

const COR = /^#[0-9a-fA-F]{6}$/;
const entre = (v: unknown, min: number, max: number, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao);
const um = <T extends string>(v: unknown, opcoes: readonly T[], padrao: T): T => (opcoes.includes(v as T) ? (v as T) : padrao);
const sim = (v: unknown, padrao: boolean) => (typeof v === 'boolean' ? v : padrao);

/** Lê o estilo guardado sem confiar nele: o que faltar ou vier errado fica no padrão. */
export function lerEstilo(bruto: unknown): Estilo {
  const e = (bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? bruto : {}) as Record<string, unknown>;
  const p = ESTILO_PADRAO;
  const canais: Record<string, string> = {};
  if (e.canais && typeof e.canais === 'object' && !Array.isArray(e.canais)) {
    for (const [k, v] of Object.entries(e.canais)) if (typeof v === 'string' && COR.test(v)) canais[k] = v;
  }
  return {
    canais,
    cano: um(e.cano, ['cano', 'linha', 'tracejado'], p.cano),
    curva: um(e.curva, ['suave', 'cotovelo', 'reta'], p.curva),
    espessura: Math.round(entre(e.espessura, 4, 20, p.espessura)),
    velocidade: entre(e.velocidade, 0.25, 4, p.velocidade),
    bolhas: sim(e.bolhas, p.bolhas),
    brilho: sim(e.brilho, p.brilho),
    ondas: sim(e.ondas, p.ondas),
    holofote: sim(e.holofote, p.holofote),
    camera: sim(e.camera, p.camera),
    autoEscolha: Math.round(entre(e.autoEscolha, 0, 10, p.autoEscolha)),
  };
}

/** Um canal da empresa, como o editor precisa: chave, nome e cor. */
export interface CanalEditor {
  chave: string;
  nome: string;
  cor: string;
}

/** A cor da água num canal: a do estilo do fluxo, senão a da empresa, senão um azul. */
export function corDoCanal(estilo: Estilo, canais: readonly CanalEditor[], chave: string | null | undefined): string {
  if (!chave) return '#1e8bdc';
  // hasOwn: um canal chamado "constructor" não pode achar a função do Object.
  return (Object.hasOwn(estilo.canais, chave) ? estilo.canais[chave] : undefined) ?? canais.find((c) => c.chave === chave)?.cor ?? '#1e8bdc';
}
```

- [ ] **Passo 6: rodar e ver passar**

Run: `cd apps/web && npx vitest run test/editor && npx tsc --noEmit`
Expected: `Tests  13 passed (13)`; `tsc` sem saída.

- [ ] **Passo 7: commit**

```bash
git add apps/web/src/editor apps/web/test/editor
git commit -m "editor: formas, canos e estilo" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 3: mudanças no documento e histórico

**Arquivos:**
- Criar: `apps/web/src/editor/documento.ts`, `historico.ts`
- Criar: `apps/web/test/editor/documento.test.ts`, `historico.test.ts`

- [ ] **Passo 1: escrever os testes**

`apps/web/test/editor/documento.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { documentoVazio, lerDocumento, type Documento } from '@journey/fluxo';
import { apagar, conteudoDoGrupo, criarGrupo, criarLigada, criarNota, criarPeca, duplicar, existe, inverterConexao, ligar, moverGrupo, moverGrupoEm, moverPeca, mudarConexao, mudarNota, mudarPeca, redimensionarGrupo } from '@/editor/documento';

const base = (): Documento => {
  let d = criarPeca(documentoVazio(), 'a', 'inicio', 95, 30);
  d = criarPeca(d, 'b', 'etapa', 400, 30);
  d = criarPeca(d, 'c', 'fim', 700, 30);
  return d;
};
const ligado = (d: Documento, id: string, de: string, para: string) => {
  const r = ligar(d, id, de, para);
  if (!('doc' in r)) throw new Error(r.erro);
  return r.doc;
};

describe('editor/documento', () => {
  it('peça nova: centro onde clicou, na grade, com o nome do tipo', () => {
    const d = criarPeca(documentoVazio(), 'p', 'decisao', 104, 207);
    expect(d.pecas).toEqual([{ id: 'p', tipo: 'decisao', nome: 'Decisão', x: 30, y: 140 }]);
  });

  it('não muda o documento de entrada', () => {
    const d = base();
    const copia = structuredClone(d);
    mudarPeca(ligado(d, 'x', 'a', 'b'), 'a', { nome: 'Outro' });
    expect(d).toEqual(copia);
  });

  it('ligar: uma saída é "sempre"; a segunda vira opções 1 e 2', () => {
    let d = ligado(base(), 'c1', 'a', 'b');
    expect(d.conexoes).toEqual([{ id: 'c1', de: 'a', para: 'b', regra: 'sempre' }]);
    d = ligado(d, 'c2', 'a', 'c');
    expect(d.conexoes.map((c) => [c.id, c.regra, c.valor])).toEqual([['c1', 'opcao', '1'], ['c2', 'opcao', '2']]);
  });

  it('ligar: saída com texto ou outra regra não vira opção', () => {
    let d = ligado(base(), 'c1', 'a', 'b');
    d = mudarConexao(d, 'c1', { regra: 'condicao', valor: 'pago' });
    d = ligado(d, 'c2', 'a', 'c');
    expect(d.conexoes.map((c) => [c.regra, c.valor])).toEqual([['condicao', 'pago'], ['opcao', '1']]);
  });

  it('número de opção não se repete: depois de apagar a 2 de 1, 2, 3, a próxima é a 2', () => {
    let d = criarPeca(base(), 'x', 'fim', 700, 300);
    d = ligado(ligado(ligado(d, 'k1', 'b', 'a'), 'k2', 'b', 'c'), 'k3', 'b', 'x');
    d = apagar(d, { tipo: 'conexao', id: 'k2' });
    d = ligado(d, 'k4', 'b', 'c');
    expect(d.conexoes.filter((c) => c.de === 'b').map((c) => [c.id, c.valor])).toEqual([['k1', '1'], ['k3', '3'], ['k4', '2']]);
  });

  it('ligar recusa a mesma peça, ligação repetida e peça que não existe', () => {
    const d = ligado(base(), 'c1', 'a', 'b');
    expect(ligar(d, 'x', 'a', 'a')).toEqual({ erro: 'mesma' });
    expect(ligar(d, 'x', 'a', 'b')).toEqual({ erro: 'repetida' });
    expect(ligar(d, 'x', 'a', 'z')).toEqual({ erro: 'inexistente' });
  });

  it('criar a próxima já ligada: à direita, uma linha abaixo por saída que já existe', () => {
    let d = criarLigada(base(), 'n1', 'k1', 'b', 'mensagem');
    d = criarLigada(d, 'n2', 'k2', 'b', 'fim');
    const [n1, n2] = [d.pecas.find((p) => p.id === 'n1')!, d.pecas.find((p) => p.id === 'n2')!];
    expect([n1.x, n1.y, n2.x, n2.y]).toEqual([620, 0, 620, 110]);
    expect(d.conexoes.filter((c) => c.de === 'b').map((c) => c.regra)).toEqual(['opcao', 'opcao']);
  });

  it('trocar o tipo mantém o centro e as ligações', () => {
    const d = mudarPeca(ligado(base(), 'c1', 'a', 'b'), 'b', { tipo: 'decisao' });
    const b = d.pecas.find((p) => p.id === 'b')!;
    expect([b.x, b.y]).toEqual([340, -40]);
    expect(d.conexoes).toHaveLength(1);
  });

  it('campo vazio some da peça; nome vazio volta pro nome do tipo', () => {
    let d = mudarPeca(base(), 'b', { canal: 'email', responsavel: 'k1' });
    d = mudarPeca(d, 'b', { canal: undefined, responsavel: '', nome: '' });
    expect(d.pecas.find((p) => p.id === 'b')).toEqual({ id: 'b', tipo: 'etapa', nome: 'Etapa', x: 300, y: 0 });
  });

  it('trocar a regra limpa os campos da regra anterior; horário começa em "dentro"', () => {
    let d = mudarConexao(ligado(base(), 'c1', 'a', 'b'), 'c1', { regra: 'tempo', tempo_s: 60 });
    d = mudarConexao(d, 'c1', { regra: 'horario' });
    expect(d.conexoes[0]).toEqual({ id: 'c1', de: 'a', para: 'b', regra: 'horario', horario: 'dentro' });
    expect(inverterConexao(d, 'c1').conexoes[0]).toMatchObject({ de: 'b', para: 'a' });
  });

  it('o que sai daqui sempre passa no lerDocumento (senão salvaria e não abriria mais)', () => {
    let d = ligado(base(), 'c1', 'a', 'b');
    d = mudarConexao(d, 'c1', { regra: 'tempo' });
    expect(d.conexoes[0]).toMatchObject({ regra: 'tempo', tempo_s: 0 });
    d = mudarConexao(d, 'c1', { regra: 'horario', horario: undefined });
    expect(d.conexoes[0]).toMatchObject({ regra: 'horario', horario: 'dentro' });
    d = mudarPeca(d, 'b', { nome: ' \t ' });
    expect(d.pecas.find((p) => p.id === 'b')!.nome).toBe('Etapa');
    d = mudarPeca(d, 'b', { tipo: undefined, x: undefined });
    d = criarNota(d, 'n', 0, 0);
    d = mudarNota(d, 'n', { texto: '' });
    expect(lerDocumento(d).problemas).toEqual([]);
  });

  it('virar Fim tira o tempo e o responsável que o painel não mostra mais', () => {
    let d = mudarPeca(base(), 'b', { tempo_s: 3600, responsavel: 'k1', cor: '#fff' });
    d = mudarPeca(d, 'b', { tipo: 'fim' });
    expect(d.pecas.find((p) => p.id === 'b')).toEqual({ id: 'b', tipo: 'fim', nome: 'Etapa', x: 320, y: 0, cor: '#fff' });
  });

  it('sem mudança, o mesmo documento (o histórico não ganha passo vazio)', () => {
    const d = ligado(base(), 'c1', 'a', 'b');
    expect(moverPeca(d, 'b', 302, 3)).toBe(d);
    expect(mudarPeca(d, 'b', { nome: 'Etapa' })).toBe(d);
    expect(mudarPeca(d, 'zz', { nome: 'X' })).toBe(d);
    expect(mudarConexao(d, 'c1', { regra: 'sempre' })).toBe(d);
    expect(apagar(d, { tipo: 'peca', id: 'zz' })).toBe(d);
    expect(inverterConexao(ligado(d, 'c2', 'b', 'a'), 'c2')).toEqual(ligado(d, 'c2', 'b', 'a'));
  });

  it('grupo leva junto o que tem o centro dentro dele, a partir de onde o arrasto começou', () => {
    let d = criarGrupo(base(), 'g', 240, 30);
    d = criarNota(d, 'n', 1500, 1500);
    const levar = conteudoDoGrupo(d, 'g');
    expect(levar).toEqual({ pecas: ['a', 'b'], notas: [] });
    const m = moverGrupo(d, 'g', 47, 13, levar);
    expect(m.pecas.map((p) => [p.id, p.x, p.y])).toEqual([['a', 50, 10], ['b', 350, 10], ['c', 610, 0]]);
    expect(m.grupos[0]).toMatchObject({ x: 90, y: -80 });
    expect(redimensionarGrupo(m, 'g', 20, 20).grupos[0]).toMatchObject({ w: 160, h: 100 });
    // Em cima do documento de agora: o que mudou no meio do arrasto (nome, peça nova) fica; as posições vêm do início.
    const agora = criarPeca(mudarPeca(m, 'a', { nome: 'Mudou no meio' }), 'z', 'etapa', 900, 900);
    const m2 = moverGrupoEm(agora, d, 'g', 47, 13, levar);
    expect(m2.pecas.find((p) => p.id === 'a')).toMatchObject({ nome: 'Mudou no meio', x: 50, y: 10 });
    expect(m2.pecas.find((p) => p.id === 'z')).toBeDefined();
    expect(moverGrupoEm(m2, d, 'g', 47, 13, levar)).toBe(m2);
  });

  it('apagar peça leva as ligações; duplicar não', () => {
    let d = ligado(ligado(base(), 'c1', 'a', 'b'), 'c2', 'b', 'c');
    expect(apagar(d, { tipo: 'peca', id: 'b' }).conexoes).toEqual([]);
    d = duplicar(d, 'b', 'b2');
    expect(d.pecas.at(-1)).toMatchObject({ id: 'b2', x: 330, y: 30 });
    expect(d.conexoes).toHaveLength(2);
    expect(existe(d, { tipo: 'conexao', id: 'c2' })).toBe(true);
    expect(existe(apagar(d, { tipo: 'conexao', id: 'c2' }), { tipo: 'conexao', id: 'c2' })).toBe(false);
  });
});
```

`apps/web/test/editor/historico.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { documentoVazio } from '@journey/fluxo';
import { PASSOS, comecar, desfazer, refazer, registrar, substituir } from '@/editor/historico';

const d = (n: string) => ({ ...documentoVazio(), notas: [{ id: n, texto: n, x: 0, y: 0, w: 1, h: 1 }] });

describe('editor/historico', () => {
  it('desfaz e refaz; mudança nova perde o refazer', () => {
    const [a, b, c] = [d('a'), d('b'), d('c')];
    let h = registrar(registrar(comecar(a), b), c);
    h = desfazer(h);
    expect(h.atual).toBe(b);
    h = refazer(h);
    expect(h.atual).toBe(c);
    h = registrar(desfazer(h), d('x'));
    expect(h.depois).toEqual([]);
    expect(refazer(h)).toBe(h);
    expect(desfazer(desfazer(desfazer(h)))).toMatchObject({ atual: a });
  });

  it('arrasto: o primeiro quadro registra, os outros substituem', () => {
    const [a, b, c] = [d('a'), d('b'), d('c')];
    const h = substituir(registrar(comecar(a), b), c);
    expect(desfazer(h).atual).toBe(a);
  });

  it(`guarda no máximo ${PASSOS} passos e ignora a mesma versão`, () => {
    let h = comecar(d('0'));
    for (let i = 1; i <= PASSOS + 10; i++) h = registrar(h, d(String(i)));
    expect(h.antes).toHaveLength(PASSOS);
    expect(registrar(h, h.atual)).toBe(h);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/editor`
Expected: FAIL nos dois arquivos novos (`Failed to resolve import "@/editor/documento"` e `"@/editor/historico"`); os 13 da tarefa 2 passam.

- [ ] **Passo 3: o documento**

`apps/web/src/editor/documento.ts`:

```ts
import type { Conexao, Documento, Grupo, Nota, Peca, TipoPeca } from '@journey/fluxo';
import { dentro } from './geometria';
import { FORMAS, GRUPO, NOTA, ROTULO_RESPONSAVEL, caixaDe, naGrade } from './pecas';

/**
 * As mudanças do editor no documento journey/2. Todas puras: recebem o documento e devolvem outro, sem tocar
 * no de entrada (o histórico guarda as versões anteriores por referência). Ids vêm de quem chama.
 * Quando nada muda, devolvem o mesmo documento (o histórico não ganha passo vazio). O que sai daqui passa no
 * `lerDocumento`: um documento que ele recusa seria salvo e depois não abriria mais.
 */

/** Aplica um remendo: chave com `undefined` some do objeto (o documento não guarda campo vazio). */
function remendar<T extends object>(obj: T, patch: Partial<NoInfer<T>>): T {
  const novo = { ...obj } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === '') delete novo[k];
    else novo[k] = v;
  }
  return novo as T;
}

/** Troca um item da lista; se nada mudou (id que não existe, ou o mesmo item), devolve a mesma lista. */
function trocar<T extends { id: string }>(lista: T[], id: string, f: (x: T) => T): T[] {
  let mudou = false;
  const nova = lista.map((x) => {
    if (x.id !== id) return x;
    const y = f(x);
    if (y !== x) mudou = true;
    return y;
  });
  return mudou ? nova : lista;
}

/** O documento com uma lista trocada, ou o mesmo documento se a lista é a mesma. */
const com = <K extends 'pecas' | 'conexoes' | 'grupos' | 'notas'>(doc: Documento, chave: K, lista: Documento[K]): Documento => (lista === doc[chave] ? doc : { ...doc, [chave]: lista });

/** Os números de opção que as saídas de uma peça já usam. O próximo é o menor que falta. */
function proximaOpcao(usados: Set<string>): string {
  let n = 1;
  while (usados.has(String(n))) n++;
  usados.add(String(n));
  return String(n);
}

/** Uma peça nova com o centro em (cx, cy), na grade, com o nome do tipo. */
export function criarPeca(doc: Documento, id: string, tipo: TipoPeca, cx: number, cy: number): Documento {
  const f = FORMAS[tipo];
  const p: Peca = { id, tipo, nome: f.nome, x: naGrade(cx - f.w / 2), y: naGrade(cy - f.h / 2) };
  return { ...doc, pecas: [...doc.pecas, p] };
}

export function criarNota(doc: Documento, id: string, cx: number, cy: number): Documento {
  const n: Nota = { id, texto: 'Escreva aqui', x: naGrade(cx - NOTA.w / 2), y: naGrade(cy - NOTA.h / 2), w: NOTA.w, h: NOTA.h };
  return { ...doc, notas: [...doc.notas, n] };
}

export function criarGrupo(doc: Documento, id: string, cx: number, cy: number): Documento {
  const g: Grupo = { id, nome: 'Grupo', x: naGrade(cx - GRUPO.w / 2), y: naGrade(cy - GRUPO.h / 2), w: GRUPO.w, h: GRUPO.h };
  return { ...doc, grupos: [...doc.grupos, g] };
}

export type Ligacao = { doc: Documento; conexao: Conexao } | { erro: 'mesma' | 'repetida' | 'inexistente' };

/**
 * Liga duas peças. A segunda saída de uma peça transforma as saídas "sempre" sem texto em opções numeradas
 * (1, 2…): é o que faz o play perguntar.
 */
export function ligar(doc: Documento, id: string, de: string, para: string): Ligacao {
  if (de === para) return { erro: 'mesma' };
  if (!doc.pecas.some((p) => p.id === de) || !doc.pecas.some((p) => p.id === para)) return { erro: 'inexistente' };
  if (doc.conexoes.some((c) => c.de === de && c.para === para)) return { erro: 'repetida' };
  const outras = doc.conexoes.filter((c) => c.de === de);
  let conexoes = doc.conexoes;
  let nova: Conexao = { id, de, para, regra: 'sempre' };
  if (outras.length >= 1) {
    // Números que já são opção não se repetem: depois de apagar a opção 2 de 1, 2, 3, a próxima é 2.
    const usados = new Set(outras.filter((c) => c.regra === 'opcao' && c.valor).map((c) => c.valor!));
    conexoes = conexoes.map((c) => (c.de === de && c.regra === 'sempre' && !c.rotulo ? { ...c, regra: 'opcao', valor: proximaOpcao(usados) } : c));
    nova = { ...nova, regra: 'opcao', valor: proximaOpcao(usados) };
  }
  return { doc: { ...doc, conexoes: [...conexoes, nova] }, conexao: nova };
}

/** Distância entre uma peça e a próxima criada pelo "+". */
const VAO = 110;

/** Cria a próxima peça já ligada à de origem: à direita, uma linha abaixo por saída que ela já tem. */
export function criarLigada(doc: Documento, idPeca: string, idConexao: string, origem: string, tipo: TipoPeca, onde?: { x: number; y: number }): Documento {
  const o = doc.pecas.find((p) => p.id === origem);
  if (!o) return doc;
  const co = caixaDe(o);
  const f = FORMAS[tipo];
  const saidas = doc.conexoes.filter((c) => c.de === origem).length;
  const p = onde ?? { x: co.x + co.w + VAO + f.w / 2, y: co.y + co.h / 2 + saidas * VAO };
  const comPeca = criarPeca(doc, idPeca, tipo, p.x, p.y);
  const r = ligar(comPeca, idConexao, origem, idPeca);
  return 'doc' in r ? r.doc : comPeca;
}

/** Põe x e y na grade; se o lugar não muda, o item é o mesmo. */
const noLugar = <T extends { x: number; y: number }>(item: T, x: number, y: number): T => {
  const [gx, gy] = [naGrade(x), naGrade(y)];
  return gx === item.x && gy === item.y ? item : { ...item, x: gx, y: gy };
};
export const moverPeca = (doc: Documento, id: string, x: number, y: number): Documento => com(doc, 'pecas', trocar(doc.pecas, id, (p) => noLugar(p, x, y)));
export const moverNota = (doc: Documento, id: string, x: number, y: number): Documento => com(doc, 'notas', trocar(doc.notas, id, (n) => noLugar(n, x, y)));

/** O que um grupo leva junto quando se move: peças e notas com o centro dentro dele. */
export function conteudoDoGrupo(doc: Documento, id: string): { pecas: string[]; notas: string[] } {
  const g = doc.grupos.find((x) => x.id === id);
  if (!g) return { pecas: [], notas: [] };
  return { pecas: doc.pecas.filter((p) => dentro(caixaDe(p), g)).map((p) => p.id), notas: doc.notas.filter((n) => dentro(n, g)).map((n) => n.id) };
}

/**
 * Move o grupo e o que estava dentro dele no começo do arrasto. As posições de partida vêm de `inicio`
 * (o documento de quando o arrasto começou), pra o arredondamento na grade não acumular erro.
 */
export function moverGrupo(inicio: Documento, id: string, dx: number, dy: number, levar: { pecas: string[]; notas: string[] }): Documento {
  return moverGrupoEm(inicio, inicio, id, dx, dy, levar);
}

/**
 * O mesmo, aplicado em cima de `doc` (o documento de agora): só as posições do grupo e do que ele leva mudam, e
 * vêm de `inicio` mais o deslocamento. O que mudou no meio do arrasto (um responsável que chegou do servidor, um
 * nome) fica. Sem mudança, devolve o próprio `doc`.
 */
export function moverGrupoEm(doc: Documento, inicio: Documento, id: string, dx: number, dy: number, levar: { pecas: string[]; notas: string[] }): Documento {
  const mx = naGrade(dx);
  const my = naGrade(dy);
  const partida = new Map<string, { x: number; y: number }>();
  const g0 = inicio.grupos.find((g) => g.id === id);
  if (g0) partida.set(`g:${id}`, g0);
  for (const p of inicio.pecas) if (levar.pecas.includes(p.id)) partida.set(`p:${p.id}`, p);
  for (const n of inicio.notas) if (levar.notas.includes(n.id)) partida.set(`n:${n.id}`, n);
  const levar1 = <T extends { id: string; x: number; y: number }>(lista: T[], pre: string): T[] => {
    let mudou = false;
    const nova = lista.map((x) => {
      const o = partida.get(`${pre}:${x.id}`);
      if (!o || (x.x === o.x + mx && x.y === o.y + my)) return x;
      mudou = true;
      return { ...x, x: o.x + mx, y: o.y + my };
    });
    return mudou ? nova : lista;
  };
  return com(com(com(doc, 'grupos', levar1(doc.grupos, 'g')), 'pecas', levar1(doc.pecas, 'p')), 'notas', levar1(doc.notas, 'n'));
}

export function redimensionarGrupo(doc: Documento, id: string, w: number, h: number): Documento {
  const [gw, gh] = [Math.max(GRUPO.minW, naGrade(w)), Math.max(GRUPO.minH, naGrade(h))];
  return com(doc, 'grupos', trocar(doc.grupos, id, (g) => (g.w === gw && g.h === gh ? g : { ...g, w: gw, h: gh })));
}

/** O remendo mudou alguma coisa? (Pra não criar passo no histórico à toa.) */
const igual = <T extends object>(a: T, b: T): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Muda campos de uma peça. Trocar o tipo mantém o centro (as formas têm tamanhos diferentes) e as ligações, e tira
 * o que o novo tipo não mostra no painel: o tempo no Início e no Fim, o responsável onde não há responsável.
 * Nome vazio (ou só espaços) volta pro nome do tipo; tipo e posição nunca somem.
 */
export function mudarPeca(doc: Documento, id: string, patch: Partial<Omit<Peca, 'id'>>): Documento {
  return com(
    doc,
    'pecas',
    trocar(doc.pecas, id, (p) => {
      const nova = remendar(p, patch);
      nova.tipo ??= p.tipo;
      nova.x ??= p.x;
      nova.y ??= p.y;
      if (nova.tipo !== p.tipo) {
        const a = FORMAS[p.tipo];
        const b = FORMAS[nova.tipo];
        nova.x = naGrade(p.x + a.w / 2 - b.w / 2);
        nova.y = naGrade(p.y + a.h / 2 - b.h / 2);
        if (nova.tipo === 'inicio' || nova.tipo === 'fim') delete nova.tempo_s;
        if (!ROTULO_RESPONSAVEL[nova.tipo]) delete nova.responsavel;
      }
      nova.nome = nova.nome?.trim() || FORMAS[nova.tipo].nome;
      return igual(nova, p) ? p : nova;
    }),
  );
}

/**
 * Muda a regra ou os campos de uma conexão. Trocar a regra limpa os campos que não são dela. "Depois de um tempo"
 * sempre tem um tempo (zero, até a pessoa preencher) e "horário" sempre tem um lado: sem eles o documento não abre.
 */
export function mudarConexao(doc: Documento, id: string, patch: Partial<Omit<Conexao, 'id' | 'de' | 'para'>>): Documento {
  return com(
    doc,
    'conexoes',
    trocar(doc.conexoes, id, (c) => {
      let base: Conexao = c;
      if (patch.regra && patch.regra !== c.regra) {
        const { valor: _v, tempo_s: _t, horario: _h, ...resto } = c;
        base = resto;
      }
      const nova = remendar(base, patch);
      nova.regra ??= c.regra;
      if (nova.regra === 'tempo' && nova.tempo_s === undefined) nova.tempo_s = 0;
      if (nova.regra === 'horario' && !nova.horario) nova.horario = 'dentro';
      return igual(nova, c) ? c : nova;
    }),
  );
}

/** Inverte a direção. Se a de volta já existe, não faz nada: seriam duas ligações iguais (o que `ligar` recusa). */
export function inverterConexao(doc: Documento, id: string): Documento {
  const c = doc.conexoes.find((x) => x.id === id);
  if (!c || c.de === c.para || doc.conexoes.some((x) => x.de === c.para && x.para === c.de)) return doc;
  return com(doc, 'conexoes', trocar(doc.conexoes, id, () => ({ ...c, de: c.para, para: c.de })));
}

export const mudarGrupo = (doc: Documento, id: string, patch: Partial<Pick<Grupo, 'nome' | 'cor'>>): Documento =>
  com(doc, 'grupos', trocar(doc.grupos, id, (g) => {
    const novo = remendar(g, patch);
    novo.nome = novo.nome?.trim() || 'Grupo';
    return igual(novo, g) ? g : novo;
  }));

/** O texto da nota pode ficar vazio, mas não some do documento. */
export const mudarNota = (doc: Documento, id: string, patch: Partial<Pick<Nota, 'texto' | 'cor'>>): Documento =>
  com(doc, 'notas', trocar(doc.notas, id, (n) => {
    const nova = remendar(n, patch);
    nova.texto ??= '';
    return igual(nova, n) ? n : nova;
  }));

export type Selecao = { tipo: 'peca' | 'conexao' | 'grupo' | 'nota'; id: string } | null;

/** Apaga o que está selecionado. Peça leva junto as ligações dela; grupo deixa as peças. */
export function apagar(doc: Documento, sel: NonNullable<Selecao>): Documento {
  if (!existe(doc, sel)) return doc;
  if (sel.tipo === 'peca') return { ...doc, pecas: doc.pecas.filter((p) => p.id !== sel.id), conexoes: doc.conexoes.filter((c) => c.de !== sel.id && c.para !== sel.id) };
  if (sel.tipo === 'conexao') return { ...doc, conexoes: doc.conexoes.filter((c) => c.id !== sel.id) };
  if (sel.tipo === 'grupo') return { ...doc, grupos: doc.grupos.filter((g) => g.id !== sel.id) };
  return { ...doc, notas: doc.notas.filter((n) => n.id !== sel.id) };
}

/** Cópia da peça (sem as ligações), um pouco abaixo e à direita. */
export function duplicar(doc: Documento, id: string, novoId: string): Documento {
  const p = doc.pecas.find((x) => x.id === id);
  if (!p) return doc;
  return { ...doc, pecas: [...doc.pecas, { ...p, id: novoId, x: p.x + 30, y: p.y + 30 }] };
}

/** A seleção ainda existe no documento? (Desfazer pode tirar o que estava selecionado.) */
export function existe(doc: Documento, sel: Selecao): boolean {
  if (!sel) return false;
  const lista = { peca: doc.pecas, conexao: doc.conexoes, grupo: doc.grupos, nota: doc.notas }[sel.tipo] as readonly { id: string }[];
  return lista.some((x) => x.id === sel.id);
}
```

- [ ] **Passo 4: o histórico**

`apps/web/src/editor/historico.ts`:

```ts
import type { Documento } from '@journey/fluxo';

/** O documento atual com o que dá pra desfazer e refazer. As versões são guardadas por referência. */
export interface Historico {
  atual: Documento;
  antes: readonly Documento[];
  depois: readonly Documento[];
}

/** Quantos passos dá pra desfazer. */
export const PASSOS = 120;

export const comecar = (doc: Documento): Historico => ({ atual: doc, antes: [], depois: [] });

/** Uma mudança que entra no histórico (o que estava vira um passo pra desfazer; o refazer se perde). */
export function registrar(h: Historico, doc: Documento): Historico {
  if (doc === h.atual) return h;
  return { atual: doc, antes: [...h.antes, h.atual].slice(-PASSOS), depois: [] };
}

/** Uma mudança sem passo novo: os quadros seguintes de um arrasto, depois do primeiro. */
export const substituir = (h: Historico, doc: Documento): Historico => ({ ...h, atual: doc });

export function desfazer(h: Historico): Historico {
  const anterior = h.antes[h.antes.length - 1];
  if (!anterior) return h;
  return { atual: anterior, antes: h.antes.slice(0, -1), depois: [...h.depois, h.atual] };
}

export function refazer(h: Historico): Historico {
  const proximo = h.depois[h.depois.length - 1];
  if (!proximo) return h;
  return { atual: proximo, antes: [...h.antes, h.atual], depois: h.depois.slice(0, -1) };
}
```

- [ ] **Passo 5: rodar e ver passar**

Run: `cd apps/web && npx vitest run test/editor && npx tsc --noEmit`
Expected: `Tests  31 passed (31)`; `tsc` sem saída.

- [ ] **Passo 6: commit**

```bash
git add apps/web/src/editor apps/web/test/editor
git commit -m "editor: mudanças no documento, desfazer e refazer" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 4: o play

**Arquivos:**
- Criar: `apps/web/src/editor/play.ts`
- Criar: `apps/web/test/editor/play.test.ts`

- [ ] **Passo 1: escrever o teste**

`apps/web/test/editor/play.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MODELOS, type Documento, type Opcao } from '@journey/fluxo';
import { agora, duracaoCano, espera, opcaoDaTecla, quandoValido, rodar, visual, voltar } from '@/editor/play';

const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
const ctx = { cadastros: m.cadastros, canal: m.canal };
const PLAY = { inicio: 'inicio', quando: '2026-11-23T10:00', modo: 'relogio' as const, escolhas: [] as string[] };

describe('editor/play', () => {
  it('mostra os eventos aos poucos: água correndo, peças molhadas, a pergunta', () => {
    const x = rodar(m.documento, ctx, PLAY);
    const correu = x.eventos.findIndex((e) => e.tipo === 'correu');
    const v1 = visual(x.eventos, correu + 1);
    expect(v1.correndo).toEqual({ conexao: 'c1', canal: 'whatsapp' });
    expect([...v1.molhadas.keys()]).toEqual(['inicio']);
    const v2 = visual(x.eventos, x.eventos.length);
    expect(v2.correndo).toBeNull();
    expect(v2.cheias.get('c1')).toBe('whatsapp');
    expect(v2.pergunta?.peca).toBe('assunto');
    expect(v2.atual).toBe('assunto');
    expect(v2.linha.map((l) => l.peca)).toEqual(['inicio', 'boas-vindas', 'horario', 'assunto']);
    expect(v2.relogio_s).toBe(3);
  });

  it('escolher e voltar refazem pelo motor; o canal muda a cor da água', () => {
    const p = { ...PLAY, escolhas: ['c6', 'c10'] };
    const x = rodar(m.documento, ctx, p);
    const v = visual(x.eventos, x.eventos.length);
    expect(v.fim).toEqual({ motivo: 'fim', peca: 'inatividade' });
    expect(v.molhadas.get('protocolo')).toBe('email');
    expect(v.cheias.get('c11')).toBe('email');
    expect(v.relogio_s).toBe(3 + 720 + 7200 + 10);
    const antes = rodar(m.documento, ctx, voltar(p));
    expect(visual(antes.eventos, antes.eventos.length).pergunta?.peca).toBe('aguardando');
  });

  it('espera de cada evento e duração do cano', () => {
    expect(espera({ tipo: 'chegou', peca: 'a', canal: null, relogio_s: 0 })).toBe(520);
    expect(espera({ tipo: 'escolheu', peca: 'a', conexao: 'c', quem: 'unica' })).toBe(0);
    expect(espera({ tipo: 'terminou', motivo: 'fim', peca: 'a', relogio_s: 0 })).toBe(0);
    expect(espera({ tipo: 'correu', conexao: 'c', de: 'a', para: 'b', relogio_s: 0 })).toBe('cano');
    expect(duracaoCano(100, 1)).toBe(380);
    expect(duracaoCano(500, 2)).toBe(600);
  });

  it('tecla: o código de uma letra da opção, ou a posição', () => {
    const ops = [{ conexao: 'c8' }, { conexao: 'c9' }] as Opcao[];
    const valores = new Map([['c8', 'S'], ['c9', 'N']]);
    expect(opcaoDaTecla(ops, 'n', valores)?.conexao).toBe('c9');
    expect(opcaoDaTecla(ops, '1', valores)?.conexao).toBe('c8');
    expect(opcaoDaTecla(ops, '3', valores)).toBeNull();
    expect(opcaoDaTecla(ops, 'x', valores)).toBeNull();
    // Códigos "2" e "3": a tecla 1 não cai na posição (senão 1 e 2 escolheriam a mesma opção).
    const dig = new Map([['c8', '2'], ['c9', '3']]);
    expect(opcaoDaTecla(ops, '1', dig)).toBeNull();
    expect(opcaoDaTecla(ops, '2', dig)?.conexao).toBe('c8');
  });

  it('a água passa de novo por um cano já cheio: ele volta a correr', () => {
    const loop: Documento = { ...m.documento, conexoes: [...m.documento.conexoes, { id: 'cv', de: 'aguardando', para: 'assunto', regra: 'condicao', valor: 'voltar ao menu' }] };
    const x = rodar(loop, ctx, { ...PLAY, escolhas: ['c6', 'cv', 'c6'] });
    const vezes = x.eventos.flatMap((e, i) => (e.tipo === 'correu' && e.conexao === 'c8' ? [i] : []));
    expect(vezes).toHaveLength(2);
    const v = visual(x.eventos, vezes[1]! + 1);
    expect(v.correndo?.conexao).toBe('c8');
    expect(v.cheias.has('c8')).toBe(false);
    expect(visual(x.eventos, vezes[1]! + 2).cheias.has('c8')).toBe(true);
  });

  it('voltar tira a última escolha que o motor aceitou; quando inválido é recusado', () => {
    expect(voltar({ ...PLAY, escolhas: ['c6', 'velha'] }, ['c6']).escolhas).toEqual([]);
    expect(quandoValido('2026-11-23T10:00')).toBe(true);
    expect(quandoValido('20266-11-23T10:00')).toBe(false);
    expect(quandoValido('2026-13-40T10:00')).toBe(false);
  });

  it('agora em São Paulo, no formato do motor', () => {
    expect(agora(new Date('2026-11-23T13:05:00Z'))).toBe('2026-11-23T10:05');
    expect(agora(new Date('2026-11-23T03:00:00Z'))).toBe('2026-11-23T00:00');
    // Horário de verão antigo de São Paulo (começou em 4/11/2018): a meia-noite pulou pra 1h.
    expect(agora(new Date('2018-11-04T03:00:00Z'))).toBe('2018-11-04T01:00');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/editor/play.test.ts`
Expected: FAIL, `Failed to resolve import "@/editor/play"`.

- [ ] **Passo 3: o play**

`apps/web/src/editor/play.ts`:

```ts
import { simular, type Cadastro, type Documento, type Evento, type Execucao, type Modo, type MotivoFim, type Opcao } from '@journey/fluxo';
import { FUSO } from '@/lib/fuso';

/**
 * O play do editor em cima do motor: a simulação é refeita das escolhas (o motor é previsível) e a tela mostra os
 * eventos um a um, com a água correndo. `mostrados` diz quantos eventos já apareceram.
 */
export interface Play {
  inicio: string;
  /** AAAA-MM-DDTHH:MM, hora de parede de quem simula. */
  quando: string;
  modo: Modo;
  escolhas: readonly string[];
}

export interface Contexto {
  cadastros: readonly Cadastro[];
  canal: string | null;
}

export function rodar(doc: Documento, ctx: Contexto, p: Play): Execucao {
  return simular(doc, { cadastros: ctx.cadastros, ...(ctx.canal && { canal: ctx.canal }) }, { inicio: p.inicio, quando: p.quando, modo: p.modo, escolhas: p.escolhas });
}

/** `quando` no formato que o motor aceita (o campo de data do navegador deixa passar ano de 5 ou 6 dígitos). */
export const quandoValido = (q: string): boolean => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(q) && !Number.isNaN(Date.parse(`${q}:00Z`));

/** A hora de agora em São Paulo, no formato do motor. */
export function agora(d = new Date()): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
}

/** O que a tela desenha depois de mostrar os `n` primeiros eventos. */
export interface Visual {
  /** Peças por onde a água passou, com o canal em que chegou (a cor). */
  molhadas: Map<string, string | null>;
  /** Conexões já cheias, com o canal da água que passou. */
  cheias: Map<string, string | null>;
  /** A conexão onde a água está correndo agora (o último evento mostrado é `correu`). */
  correndo: { conexao: string; canal: string | null } | null;
  atual: string | null;
  pergunta: { peca: string; opcoes: Opcao[] } | null;
  fim: { motivo: MotivoFim; peca: string | null } | null;
  relogio_s: number;
  canal: string | null;
  /** Cada chegada, com o tempo do cliente naquele momento (uma peça visitada duas vezes aparece duas vezes). */
  linha: { peca: string; relogio_s: number }[];
}

export function visual(eventos: readonly Evento[], n: number): Visual {
  const v: Visual = { molhadas: new Map(), cheias: new Map(), correndo: null, atual: null, pergunta: null, fim: null, relogio_s: 0, canal: null, linha: [] };
  for (const e of eventos.slice(0, n)) {
    if (v.correndo) {
      v.cheias.set(v.correndo.conexao, v.correndo.canal);
      v.correndo = null;
    }
    v.pergunta = null;
    if (e.tipo === 'chegou') {
      v.canal = e.canal;
      v.atual = e.peca;
      v.relogio_s = e.relogio_s;
      v.molhadas.set(e.peca, e.canal);
      v.linha.push({ peca: e.peca, relogio_s: e.relogio_s });
    } else if (e.tipo === 'correu') {
      // A água pode passar de novo por um cano já cheio (volta ao menu, tenta de novo): ele volta a correr.
      v.cheias.delete(e.conexao);
      v.correndo = { conexao: e.conexao, canal: v.canal };
      // O relógio já inclui o tempo do cano (regra tempo): o cartão mostra a hora em que a água chega do outro lado.
      v.relogio_s = e.relogio_s;
    } else if (e.tipo === 'pede_escolha') {
      v.pergunta = { peca: e.peca, opcoes: e.opcoes };
    } else if (e.tipo === 'terminou') {
      v.fim = { motivo: e.motivo, peca: e.peca };
      v.relogio_s = e.relogio_s;
    }
  }
  return v;
}

/**
 * Quanto a tela espera depois de mostrar um evento, antes do próximo (em ms, na velocidade 1). `correu` espera a
 * água chegar ao fim do cano. Quando não há próximo (pergunta ou fim), a tela simplesmente para.
 */
export function espera(e: Evento): number | 'cano' {
  if (e.tipo === 'chegou') return 520;
  if (e.tipo === 'correu') return 'cano';
  return 0;
}

/** Duração da água num cano de comprimento `L` (px), na velocidade dada. */
export const duracaoCano = (L: number, velocidade: number): number => Math.max(380, L * 2.4) / velocidade;

/**
 * Voltar uma decisão: tira a última escolha que o motor aceitou (`aplicadas`, de `Execucao.escolhas`; uma escolha
 * guardada que não serve mais já não conta). Sem escolha, recomeça.
 */
export const voltar = (p: Play, aplicadas: readonly string[] = p.escolhas): Play => ({ ...p, escolhas: aplicadas.slice(0, -1) });

/**
 * A opção que uma tecla escolhe: o código de uma letra/dígito da opção ou, se nenhuma opção tem dígito como código,
 * o número da posição (1 a 9). Com códigos "2" e "3", a tecla 1 não escolhe nada (senão 1 e 2 dariam na mesma).
 */
export function opcaoDaTecla(opcoes: readonly Opcao[], tecla: string, valores: ReadonlyMap<string, string | undefined>): Opcao | null {
  const k = tecla.toLowerCase();
  const porValor = opcoes.find((o) => {
    const v = valores.get(o.conexao);
    return v !== undefined && v.length === 1 && v.toLowerCase() === k;
  });
  if (porValor) return porValor;
  const digitos = opcoes.some((o) => /^\d$/.test(valores.get(o.conexao) ?? ''));
  if (!digitos && /^[1-9]$/.test(tecla)) return opcoes[Number(tecla) - 1] ?? null;
  return null;
}

const NOMES_FIM: Record<MotivoFim, string> = {
  fim: 'Chegou em',
  beco: 'Parou em (sem saída)',
  ciclo: 'Ficou rodando em',
  limite: 'Andou demais sozinho até',
  inexistente: 'Não achou o começo',
};
export const tituloDoFim = (m: MotivoFim): string => NOMES_FIM[m];
```

- [ ] **Passo 4: rodar e ver passar**

Run: `cd apps/web && npx vitest run test/editor && npx tsc --noEmit`
Expected: `Tests  38 passed (38)`; `tsc` sem saída.

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/editor apps/web/test/editor
git commit -m "editor: play em cima do motor" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 5: salvamento automático e cadastros

**Arquivos:**
- Criar: `apps/web/src/editor/salvamento.ts`, `cadastros.ts`
- Criar: `apps/web/test/editor/salvamento.test.ts`, `cadastros.test.ts`

- [ ] **Passo 1: escrever os testes**

`apps/web/test/editor/salvamento.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { documentoVazio, type Documento } from '@journey/fluxo';
import { ESTILO_PADRAO } from '@/editor/estilo';
import { Salvamento, copiaValida, mesmoJson, motivoDoErro, proximaTentativa, type NoBanco, type Resposta, type Situacao } from '@/editor/salvamento';

const doc = (n: string): Documento => ({ ...documentoVazio(), notas: [{ id: n, texto: n, x: 0, y: 0, w: 1, h: 1 }] });

function montar(respostas: Resposta[], ler?: () => Promise<NoBanco | null>) {
  const enviados: { revisao: number; doc: Documento }[] = [];
  const situacoes: Situacao[] = [];
  const guardados: unknown[] = [];
  let soltar: (() => void) | null = null;
  const s = new Salvamento({
    revisao: 3,
    enviar: async (revisao, documento) => {
      enviados.push({ revisao, doc: documento });
      await new Promise<void>((r) => (soltar = r));
      return respostas.shift() ?? { ok: true, revisao: revisao + 1 };
    },
    aoMudar: (x) => situacoes.push(x),
    guardar: (c) => guardados.push(c),
    ...(ler && { ler }),
  });
  const responder = async () => {
    soltar?.();
    await vi.advanceTimersByTimeAsync(0);
  };
  return { s, enviados, situacoes, guardados, responder };
}

describe('editor/salvamento', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('espera parar de mexer e manda só a última versão', async () => {
    const t = montar([]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(300);
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(499);
    expect(t.enviados).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.enviados.map((e) => [e.revisao, e.doc.notas[0]!.id])).toEqual([[3, 'b']]);
    await t.responder();
    expect(t.s.revisao).toBe(4);
    expect(t.situacoes.at(-1)).toBe('salvo');
    // A cópia fica no navegador enquanto o banco não confirma, e sai quando ele confirma.
    expect(t.guardados).toEqual([{ revisao: 3, documento: doc('b'), estilo: ESTILO_PADRAO }, null]);
  });

  it('mudou enquanto mandava: manda de novo com a revisão nova', async () => {
    const t = montar([]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    expect(t.s.sujo).toBe(true);
    await t.responder();
    await vi.advanceTimersByTimeAsync(500);
    expect(t.enviados.map((e) => [e.revisao, e.doc.notas[0]!.id])).toEqual([[3, 'a'], [4, 'b']]);
    await t.responder();
    expect(t.s.sujo).toBe(false);
  });

  it('sem rede: guarda no navegador e tenta de novo, cada vez esperando mais', async () => {
    const t = montar([{ ok: false, motivo: 'rede' }, { ok: false, motivo: 'rede' }]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('sem_rede');
    expect(t.guardados.at(-1)).toMatchObject({ revisao: 3, documento: doc('a') });
    await vi.advanceTimersByTimeAsync(2000);
    expect(t.enviados).toHaveLength(2);
    await t.responder();
    await vi.advanceTimersByTimeAsync(3999);
    expect(t.enviados).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('salvo');
    expect(proximaTentativa(10)).toBe(30_000);
  });

  it('conflito ou trava perdida param tudo, com cópia no navegador', async () => {
    const t = montar([{ ok: false, motivo: 'conflito' }]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('conflito');
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.enviados).toHaveLength(1);
    expect(t.guardados.at(-1)).toMatchObject({ documento: doc('a') });
  });

  it('recusa para e não deixa cópia (senão voltaria a cada vez que o fluxo abrisse)', async () => {
    const t = montar([{ ok: false, motivo: 'recusado', mensagem: 'responsável' }]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('recusado');
    expect(t.guardados.at(-1)).toBeNull();
  });

  it('responsável apagado em outra tela (22023/23503): para, mas a cópia fica no navegador', async () => {
    const t = montar([motivoDoErro({ code: '22023', message: 'responsável' })]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('recusado');
    expect(t.s.parado).toBe(true);
    expect(t.guardados.at(-1)).toEqual({ revisao: 3, documento: doc('a'), estilo: ESTILO_PADRAO });
  });

  it('a rede voltou (tentarJa): manda na hora, sem esperar a próxima tentativa', async () => {
    const t = montar([{ ok: false, motivo: 'rede' }, { ok: false, motivo: 'rede' }]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    await vi.advanceTimersByTimeAsync(2000);
    await t.responder();
    // Agora espera 4 s; o `online` chega antes.
    expect(t.enviados).toHaveLength(2);
    t.s.tentarJa();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.enviados).toHaveLength(3);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('salvo');
    // O temporizador velho não manda de novo.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.enviados).toHaveLength(3);
  });

  it('tentarJa sem falha antes, com envio no ar ou parado não faz nada', async () => {
    const t = montar([{ ok: false, motivo: 'conflito' }]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    t.s.tentarJa(); // ainda esperando a pessoa parar de mexer: segue a espera normal
    await vi.advanceTimersByTimeAsync(0);
    expect(t.enviados).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(500);
    t.s.tentarJa(); // no ar
    expect(t.enviados).toHaveLength(1);
    await t.responder();
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    t.s.tentarJa(); // parado pelo conflito
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.enviados).toHaveLength(1);
  });

  it('envio que ficou sem resposta mas chegou: o conflito seguinte não é conflito', async () => {
    let banco: NoBanco = { revisao: 3, documento: null, estilo: null };
    const t = montar([{ ok: false, motivo: 'rede' }, { ok: false, motivo: 'conflito' }], async () => banco);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    // O banco gravou 'a' (revisão 4), mas a resposta se perdeu; o jsonb volta com as chaves em outra ordem.
    banco = { revisao: 4, documento: Object.fromEntries(Object.entries(doc('a')).reverse()), estilo: { ...ESTILO_PADRAO } };
    await t.responder();
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    // 'b' foi com a revisão 3 e deu 40001; o banco tem a revisão 4 com 'a': segue da 4 e manda 'b' de novo.
    await vi.advanceTimersByTimeAsync(0);
    expect(t.enviados.map((e) => [e.revisao, e.doc.notas[0]!.id])).toEqual([[3, 'a'], [3, 'b'], [4, 'b']]);
    await t.responder();
    expect(t.s.revisao).toBe(5);
    expect(t.situacoes.at(-1)).toBe('salvo');
    expect(t.situacoes).not.toContain('conflito');
  });

  it('conflito de verdade (o banco tem outra coisa) para mesmo depois de falta de rede', async () => {
    const t = montar([{ ok: false, motivo: 'rede' }, { ok: false, motivo: 'conflito' }], async () => ({ revisao: 4, documento: doc('outra'), estilo: ESTILO_PADRAO }));
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    await vi.advanceTimersByTimeAsync(2000);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('conflito');
  });

  it('envio que nunca volta: desiste no limite, com a cópia no navegador', async () => {
    const t = montar([]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    expect(t.guardados.at(-1)).toMatchObject({ revisao: 3, documento: doc('a') });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(t.situacoes.at(-1)).toBe('sem_rede');
    expect(t.s.sujo).toBe(true);
  });

  it('agora espera o envio no ar e o que mudou no meio', async () => {
    const t = montar([]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    let fim = false;
    void t.s.agora().then(() => (fim = true));
    await t.responder();
    expect(fim).toBe(false);
    expect(t.enviados.map((e) => [e.revisao, e.doc.notas[0]!.id])).toEqual([[3, 'a'], [4, 'b']]);
    await t.responder();
    expect(fim).toBe(true);
    expect(t.s.sujo).toBe(false);
  });

  it('parar com envio no ar: não agenda nem muda a tela; retomar manda o que ficou', async () => {
    const t = montar([]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    t.s.parar();
    const n = t.situacoes.length;
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    await t.responder();
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.situacoes.length).toBe(n);
    expect(t.enviados).toHaveLength(1);
    expect(t.s.revisao).toBe(4);
    t.s.retomar();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.enviados.map((e) => [e.revisao, e.doc.notas[0]!.id])).toEqual([[3, 'a'], [4, 'b']]);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('salvo');
  });

  it('sessão vencida tenta de novo, com outro aviso', async () => {
    const t = montar([{ ok: false, motivo: 'sessao' }]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('sem_sessao');
    await vi.advanceTimersByTimeAsync(2000);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('salvo');
  });

  it('erro do banco vira motivo; cópia local só vale da mesma revisão', () => {
    const motivo = (...a: Parameters<typeof motivoDoErro>) => {
      const r = motivoDoErro(...a);
      return r.ok ? null : r.motivo;
    };
    expect(motivoDoErro({ code: '40001' })).toEqual({ ok: false, motivo: 'conflito' });
    expect(motivoDoErro({ code: 'P0001' })).toEqual({ ok: false, motivo: 'trava' });
    expect(motivoDoErro({ code: '', message: 'TypeError: Failed to fetch' }, 0)).toEqual({ ok: false, motivo: 'rede' });
    expect(motivoDoErro({ code: '22023', message: 'responsável' })).toMatchObject({ ok: false, motivo: 'recusado', manterCopia: true, mensagem: expect.stringContaining('um responsável deste fluxo foi apagado na tela Cadastros') });
    expect(motivoDoErro({ code: '23514', message: 'nome' })).toEqual({ ok: false, motivo: 'recusado', mensagem: 'nome' });
    // A mensagem não decide: código do banco com "failed" no texto continua recusa.
    expect(motivo({ code: '22023', message: 'validation failed' }, 400)).toBe('recusado');
    expect(motivo({ code: 'PGRST301' }, 401)).toBe('sessao');
    expect(motivo({ code: 'PGRST303' }, 401)).toBe('sessao');
    expect(motivo({ message: 'Invalid authentication credentials' }, 401)).toBe('sessao');
    expect(motivoDoErro({ code: 'P0002', message: 'fluxo não encontrado' })).toEqual({ ok: false, motivo: 'recusado', mensagem: 'este fluxo foi apagado' });
    expect(motivoDoErro({ code: '23503', message: 'insert or update violates foreign key' })).toMatchObject({ motivo: 'recusado', manterCopia: true, mensagem: expect.stringContaining('guardadas neste navegador') });
    expect(motivoDoErro({ code: '23514', message: 'nome' })).not.toHaveProperty('manterCopia');
    expect(motivo({ code: '57014' }, 500)).toBe('rede');
    expect(motivo({ code: '40P01' }, 500)).toBe('rede');
    expect(motivo({ message: 'rate limit' }, 429)).toBe('rede');
    expect(motivoDoErro({ message: 'Request size limit exceeded' }, 413)).toEqual({ ok: false, motivo: 'recusado', mensagem: 'o fluxo ficou grande demais pra salvar' });
    expect(mesmoJson({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1, d: undefined })).toBe(true);
    expect(mesmoJson({ a: 1 }, { a: 2 })).toBe(false);
    expect(mesmoJson([1], { 0: 1 })).toBe(false);
    const c = { revisao: 3, documento: doc('a'), estilo: ESTILO_PADRAO };
    expect(copiaValida(c, 3)).toBe(c);
    expect(copiaValida(c, 4)).toBeNull();
    expect(copiaValida('lixo', 3)).toBeNull();
  });
});
```

`apps/web/test/editor/cadastros.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buscar, comNome, tipoSugerido, usosNoDocumento } from '@/editor/cadastros';
import { documentoVazio } from '@journey/fluxo';

const TIPOS = ['pessoa', 'fila', 'equipe', 'sistema', 'horario'].map((chave) => ({ chave, nome: chave }));
const K = [
  { id: '1', tipo: 'fila', nome: 'Fila Cobrança' },
  { id: '2', tipo: 'pessoa', nome: 'Ana' },
  { id: '3', tipo: 'equipe', nome: 'Cobrança jurídica' },
];

describe('editor/cadastros', () => {
  it('sugere o tipo pelo nome e pela peça', () => {
    expect(tipoSugerido('Fila Cobrança', 'atendimento', TIPOS)).toBe('fila');
    expect(tipoSugerido('Time de vendas', 'atendimento', TIPOS)).toBe('equipe');
    expect(tipoSugerido('Horário do SAC', 'decisao', TIPOS)).toBe('horario');
    expect(tipoSugerido('ERP', 'sistema', TIPOS)).toBe('sistema');
    expect(tipoSugerido('Comercial', 'decisao', TIPOS)).toBe('horario');
    expect(tipoSugerido('Maria', 'atendimento', TIPOS)).toBe('pessoa');
    expect(tipoSugerido('Maria', 'atendimento', [{ chave: 'loja', nome: 'Loja' }])).toBe('loja');
    // Palavra inteira: "Filadelfo" e "Timeout" não são fila nem equipe.
    expect(tipoSugerido('Filadelfo Souza', 'atendimento', TIPOS)).toBe('pessoa');
    expect(tipoSugerido('Timeout do gateway', 'sistema', TIPOS)).toBe('sistema');
  });

  it('busca: começa com antes de contém; nome igual sem caixa nem espaços', () => {
    expect(buscar(K, 'cob').map((k) => k.id)).toEqual(['3', '1']);
    expect(buscar(K, 'cobranca').map((k) => k.id)).toEqual(['3', '1']);
    expect(buscar(K, '').map((k) => k.id)).toEqual(['1', '2', '3']);
    expect(comNome(K, '  fila cobrança ')?.id).toBe('1');
    expect(comNome(K, 'Fila')).toBeUndefined();
  });

  it('conta os usos no documento', () => {
    const d = { ...documentoVazio(), pecas: [{ id: 'a', tipo: 'atendimento' as const, nome: 'a', x: 0, y: 0, responsavel: '1' }, { id: 'b', tipo: 'etapa' as const, nome: 'b', x: 0, y: 0, responsavel: '1' }] };
    expect(usosNoDocumento(d)).toEqual(new Map([['1', 2]]));
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/editor`
Expected: FAIL nos dois arquivos novos; os 38 anteriores passam.

- [ ] **Passo 3: o salvamento**

`apps/web/src/editor/salvamento.ts`:

```ts
import type { Documento } from '@journey/fluxo';
import type { Estilo } from './estilo';

/** O que o banco respondeu a um salvamento. */
export type Resposta =
  | { ok: true; revisao: number }
  /**
   * conflito: outra pessoa salvou no meio (40001); trava: outra pessoa pegou a trava (P0001); rede: não chegou ou
   * deu um erro passageiro (tenta de novo); sessao: o login venceu (tenta de novo até a pessoa entrar outra vez).
   * `manterCopia`: recusa que não é culpa do documento daqui (um cadastro apagado em outra tela): a cópia fica no
   * navegador, senão tudo desde o último salvamento se perderia.
   */
  | { ok: false; motivo: 'conflito' | 'trava' | 'rede' | 'sessao' | 'recusado'; mensagem?: string; manterCopia?: boolean };

export type Situacao = 'salvo' | 'esperando' | 'salvando' | 'sem_rede' | 'sem_sessao' | 'conflito' | 'sem_trava' | 'recusado';

/** O que fica no navegador enquanto uma mudança não chegou no banco: o documento e a revisão de onde ele partiu. */
export interface CopiaLocal {
  revisao: number;
  documento: Documento;
  estilo: Estilo;
}

/** O que o banco tem agora (pra saber se um envio que ficou sem resposta chegou). */
export interface NoBanco {
  revisao: number;
  documento: unknown;
  estilo: unknown;
}

export interface OpcoesSalvamento {
  revisao: number;
  /** Manda pro banco. `sinal` aborta quando passa do `limite`. */
  enviar: (revisao: number, documento: Documento, estilo: Estilo, sinal: AbortSignal) => Promise<Resposta>;
  /** Lê a revisão, o documento e o estilo do banco; sem isso, um conflito depois de falta de rede para tudo. */
  ler?: () => Promise<NoBanco | null>;
  aoMudar: (s: Situacao, mensagem?: string) => void;
  guardar: (copia: CopiaLocal | null) => void;
  /** Quanto espera depois da última mudança (padrão 500 ms). */
  espera?: number;
  /** Quanto espera a resposta de um envio antes de desistir dele (padrão 20 s). */
  limite?: number;
}

/** Espera entre tentativas sem rede: 2 s, 4 s, 8 s… até 30 s. */
export const proximaTentativa = (n: number): number => Math.min(30_000, 2000 * 2 ** n);

type Versao = { documento: Documento; estilo: Estilo };

/**
 * Salvamento automático: espera a pessoa parar de mexer, manda o documento inteiro com a revisão que tem e,
 * se mudou de novo enquanto mandava, manda outra vez. Um envio por vez, e a cópia fica no navegador até o banco
 * confirmar. Sem rede (ou sessão vencida), tenta de novo; conflito, trava perdida ou recusa param (a tela explica).
 */
export class Salvamento {
  revisao: number;
  private pendente: Versao | null = null;
  private voo: Promise<boolean> | null = null;
  private _parado = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tentativas = 0;
  /** Versões mandadas desde a última confirmação que ficaram sem resposta: podem ter chegado (ver `conferir`). */
  private semResposta: Versao[] = [];
  private readonly o: OpcoesSalvamento;

  constructor(o: OpcoesSalvamento) {
    this.o = o;
    this.revisao = o.revisao;
  }

  /** Parou (conflito, trava perdida, recusa ou `parar`): não manda mais nada sozinho. */
  get parado(): boolean {
    return this._parado;
  }

  /** Tem mudança que ainda não chegou no banco? */
  get sujo(): boolean {
    return this.pendente !== null || this.voo !== null;
  }

  mudou(documento: Documento, estilo: Estilo): void {
    this.pendente = { documento, estilo };
    // Parado, a mudança fica na fila (sem barulho na tela) e vai se alguém chamar `retomar`.
    if (this._parado) return;
    if (!this.voo) this.o.aoMudar('esperando');
    this.agendar(this.o.espera ?? 500);
  }

  /** Manda já o que estiver pendente e espera tudo chegar (ou falhar). Ao sair da página, por exemplo. */
  async agora(): Promise<void> {
    while (!this._parado && (this.voo || this.pendente)) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      if (!(await (this.voo ?? this.enviar()))) return;
    }
  }

  /** Para de mandar. O que estiver no ar termina, mas não agenda mais nada. */
  parar(): void {
    this._parado = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /**
   * A rede voltou (evento `online`): quem estava esperando a próxima tentativa (até 30 s) manda já. Fora disso
   * (nada pendente, já no ar, parado ou sem falha antes) não faz nada.
   */
  tentarJa(): void {
    if (this._parado || this.voo || !this.pendente || this.tentativas === 0) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.enviar();
  }

  /** Volta a mandar depois de um `parar` (por exemplo, apagar o fluxo deu errado). */
  retomar(): void {
    this._parado = false;
    if (this.pendente) {
      this.o.aoMudar('esperando');
      this.agendar(0);
    } else if (!this.voo) this.o.aoMudar('salvo');
  }

  private agendar(ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.enviar();
    }, ms);
  }

  private enviar(): Promise<boolean> {
    if (this.voo) return this.voo;
    if (this._parado || !this.pendente) return Promise.resolve(true);
    this.voo = this.mandar().finally(() => (this.voo = null));
    return this.voo;
  }

  /** Um envio. Devolve se chegou. */
  private async mandar(): Promise<boolean> {
    const atual = this.pendente!;
    this.pendente = null;
    this.o.aoMudar('salvando');
    // Enquanto o banco não confirma, a cópia fica no navegador (aba fechada ou pedido que nunca volta).
    this.o.guardar({ revisao: this.revisao, ...atual });
    let r = await this.tentar(atual);
    if (!r.ok && r.motivo === 'conflito') r = await this.conferir(atual, r);
    if (r.ok) {
      this.revisao = r.revisao;
      this.tentativas = 0;
      this.semResposta = [];
      if (!this.pendente) this.o.guardar(null);
      if (this._parado) return true;
      if (this.pendente) {
        this.o.aoMudar('esperando');
        this.agendar(0);
      } else this.o.aoMudar('salvo');
      return true;
    }
    // O que não chegou volta pra fila (a não ser que já tenha coisa mais nova).
    this.pendente ??= atual;
    if (r.motivo === 'recusado' && !r.manterCopia) {
      // Uma cópia recusada voltaria a cada vez que o fluxo abrisse e seria recusada de novo: não fica.
      this.o.guardar(null);
    } else this.o.guardar({ revisao: this.revisao, ...this.pendente });
    if (this._parado) return false;
    if (r.motivo === 'rede' || r.motivo === 'sessao') {
      this.o.aoMudar(r.motivo === 'rede' ? 'sem_rede' : 'sem_sessao');
      this.agendar(proximaTentativa(this.tentativas++));
      return false;
    }
    this.parar();
    this.o.aoMudar(r.motivo === 'conflito' ? 'conflito' : r.motivo === 'trava' ? 'sem_trava' : 'recusado', r.mensagem);
    return false;
  }

  /** Manda, desistindo depois do `limite`. Exceção ou tempo esgotado é rede (e o envio pode ter chegado). */
  private async tentar(v: Versao): Promise<Resposta> {
    const ctl = new AbortController();
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const esgotou = new Promise<Resposta>((resolve) => {
      relogio = setTimeout(() => {
        ctl.abort();
        resolve({ ok: false, motivo: 'rede' });
      }, this.o.limite ?? 20_000);
    });
    let r: Resposta;
    try {
      r = await Promise.race([this.o.enviar(this.revisao, v.documento, v.estilo, ctl.signal), esgotou]);
    } catch {
      r = { ok: false, motivo: 'rede' };
    } finally {
      clearTimeout(relogio);
    }
    if (!r.ok && r.motivo === 'rede') this.semResposta = [...this.semResposta.slice(-19), v];
    return r;
  }

  /**
   * Conflito depois de um envio sem resposta pode ser o próprio envio, que chegou: o banco está uma revisão à frente
   * com uma das versões daqui. Aí não é conflito: segue dessa revisão (e manda de novo só se ainda falta algo).
   */
  private async conferir(atual: Versao, conflito: Resposta): Promise<Resposta> {
    if (!this.semResposta.length || !this.o.ler) return conflito;
    let b: NoBanco | null = null;
    try {
      b = await this.o.ler();
    } catch {
      // Sem conseguir ler, fica o conflito.
    }
    const igual = (v: Versao) => b !== null && mesmoJson(b.documento, v.documento) && mesmoJson(b.estilo, v.estilo);
    if (!b || b.revisao !== this.revisao + 1 || !this.semResposta.some(igual)) return conflito;
    if (!igual(atual)) this.pendente ??= atual;
    return { ok: true, revisao: b.revisao };
  }
}

/** Compara dois valores JSON sem ligar pra ordem das chaves (o jsonb do banco reordena). */
export function mesmoJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const lb = b as unknown[];
    return a.length === lb.length && a.every((x, i) => mesmoJson(x, lb[i]));
  }
  const oa = a as Record<string, unknown>;
  const ob = b as Record<string, unknown>;
  const ka = Object.keys(oa).filter((k) => oa[k] !== undefined);
  const kb = Object.keys(ob).filter((k) => ob[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(ob, k) && mesmoJson(oa[k], ob[k]));
}

/**
 * Erro do salvar_fluxo → motivo. 40001: revisão velha; P0001: trava de outra pessoa; login vencido ou inválido
 * (PGRST301/PGRST303/401): sessão; erro passageiro do banco ou do caminho (sem código, 5xx, 429, cancelado,
 * deadlock, tempo do comando): rede; o resto (o banco disse não): recusado.
 */
export function motivoDoErro(e: { code?: string; message?: string } | null | undefined, status?: number): Resposta {
  if (!e) return { ok: false, motivo: 'rede' };
  const c = e.code ?? '';
  if (c === '40001') return { ok: false, motivo: 'conflito' };
  if (c === 'P0001') return { ok: false, motivo: 'trava' };
  // O que o salvar_fluxo recusa por causa de outra tela: o fluxo ou um cadastro dele foi apagado.
  if (c === 'P0002') return { ok: false, motivo: 'recusado', mensagem: 'este fluxo foi apagado' };
  // O documento daqui está certo, só aponta pra um cadastro que sumiu: a cópia fica (o editor tira esse responsável
  // ao recuperar), senão o trabalho desde o último salvamento iria embora.
  if (c === '22023' || c === '23503')
    return {
      ok: false,
      motivo: 'recusado',
      manterCopia: true,
      mensagem: 'um responsável deste fluxo foi apagado na tela Cadastros. As mudanças ficaram guardadas neste navegador: recarregue pra continuar sem esse responsável',
    };
  if (c === 'PGRST301' || c === 'PGRST303' || status === 401) return { ok: false, motivo: 'sessao' };
  if (c === '57014' || c === '40P01' || /^(08|53)/.test(c) || status === 429 || (status !== undefined && status >= 500)) return { ok: false, motivo: 'rede' };
  if (!c && status === 413) return { ok: false, motivo: 'recusado', mensagem: 'o fluxo ficou grande demais pra salvar' };
  if (!c && !(status !== undefined && status >= 400)) return { ok: false, motivo: 'rede' };
  return { ok: false, motivo: 'recusado', mensagem: e.message };
}

/** A cópia local de um fluxo vale se partiu da mesma revisão que o banco tem agora. */
export function copiaValida(copia: unknown, revisao: number): CopiaLocal | null {
  if (!copia || typeof copia !== 'object') return null;
  const c = copia as Partial<CopiaLocal>;
  return c.revisao === revisao && c.documento && c.estilo ? (c as CopiaLocal) : null;
}
```

- [ ] **Passo 4: os cadastros**

`apps/web/src/editor/cadastros.ts`:

```ts
import type { Cadastro, CamposHorario, Documento, TipoPeca } from '@journey/fluxo';

/** Um tipo de cadastro da empresa: chave (pessoa, fila…) e nome. */
export interface TipoCadastro {
  chave: string;
  nome: string;
}

/** Comparar nomes como o banco compara (índice único em lower(btrim(nome))). */
export const nomeNormalizado = (nome: string): string => nome.trim().toLowerCase();

/** Pra busca: sem caixa e sem acento ("cobranca" acha "Fila Cobrança"). */
const paraBusca = (s: string): string => nomeNormalizado(s).normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** O Horário que nasce do uso: segunda a sexta, 8h às 18h, sem feriado. Dá pra mudar na tela de Cadastros. */
export const HORARIO_PADRAO: CamposHorario = { janelas: [{ dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }], feriados: [] };

/**
 * O tipo mais provável pra um nome novo escrito numa peça: "Fila …" é fila, "Equipe …"/"Time …" é equipe,
 * "Horário …" é horário, peça Sistema é sistema; o resto é pessoa (o tipo dá pra trocar antes de criar).
 */
export function tipoSugerido(nome: string, tipoPeca: TipoPeca, tipos: readonly TipoCadastro[]): string {
  const n = paraBusca(nome);
  const tem = (k: string) => tipos.some((t) => t.chave === k);
  // Palavra inteira: "Filadelfo" não é fila, "Timeout" não é equipe.
  const escolha = /^fila\b/.test(n)
    ? 'fila'
    : /^(equipe|time)\b/.test(n)
      ? 'equipe'
      : /\bhorario\b/.test(n)
        ? 'horario'
        : tipoPeca === 'sistema'
          ? 'sistema'
          : tipoPeca === 'decisao'
            ? 'horario'
            : 'pessoa';
  return tem(escolha) ? escolha : (tipos[0]?.chave ?? 'pessoa');
}

/** Cadastros que batem com o que a pessoa escreveu (o nome começa ou contém; sem acento), os que começam primeiro. */
export function buscar(cadastros: readonly Cadastro[], termo: string, limite = 8): Cadastro[] {
  const t = paraBusca(termo);
  if (!t) return cadastros.slice(0, limite);
  const comeca = cadastros.filter((k) => paraBusca(k.nome).startsWith(t));
  const contem = cadastros.filter((k) => !paraBusca(k.nome).startsWith(t) && paraBusca(k.nome).includes(t));
  return [...comeca, ...contem].slice(0, limite);
}

/** O cadastro com exatamente este nome (sem caixa nem espaços), se existe. */
export const comNome = (cadastros: readonly Cadastro[], nome: string): Cadastro | undefined => cadastros.find((k) => nomeNormalizado(k.nome) === nomeNormalizado(nome));

/** Quantas peças deste documento usam cada cadastro. */
export function usosNoDocumento(doc: Documento): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of doc.pecas) if (p.responsavel) m.set(p.responsavel, (m.get(p.responsavel) ?? 0) + 1);
  return m;
}
```

- [ ] **Passo 5: rodar e ver passar**

Run: `cd apps/web && npx vitest run test/editor && npx tsc --noEmit`
Expected: `Tests  56 passed (56)`; `tsc` sem saída.

- [ ] **Passo 6: commit**

```bash
git add apps/web/src/editor apps/web/test/editor
git commit -m "editor: salvamento automático e ajuda dos cadastros" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 6: o servidor (leituras e server actions)

**Arquivos:**
- Modificar: `apps/web/src/lib/dados.ts`
- Criar: `apps/web/src/lib/cadastro-unico.ts`
- Criar: `apps/web/src/acoes/fluxos.ts`, `cadastros.ts`
- Criar: `apps/web/test/acoes/banco-falso.ts`, `fluxos.test.ts`, `cadastros.test.ts`

- [ ] **Passo 1: o banco de mentira e os testes**

`apps/web/test/acoes/banco-falso.ts`:

```ts
/**
 * Um Supabase de mentira pras server actions: cada consulta registra tabela, operação, valores e filtros, e responde
 * com a próxima resposta da fila `tabela.operação` (ou vazio).
 */
export type Resposta = { data?: unknown; error: { code?: string; message: string } | null };
export interface Feita {
  tabela: string;
  op: string;
  valores?: unknown;
  filtros: [string, unknown][];
}

export function bancoFalso() {
  const filas: Record<string, Resposta[]> = {};
  const feitas: Feita[] = [];
  const responder = (chave: string): Resposta => filas[chave]?.shift() ?? { data: null, error: null };
  const from = (tabela: string) => {
    const f: Feita = { tabela, op: 'select', filtros: [] };
    feitas.push(f);
    const r = () => responder(`${tabela}.${f.op}`);
    const q: Record<string, unknown> = {
      then: (ok: (v: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(r()).then(ok, falha),
      single: async () => r(),
      maybeSingle: async () => r(),
      select: () => q,
      order: () => q,
    };
    for (const m of ['eq', 'in', 'ilike']) q[m] = (c: string, v: unknown) => (f.filtros.push([c, v]), q);
    for (const m of ['insert', 'update', 'delete', 'upsert'])
      q[m] = (valores?: unknown) => {
        f.op = m;
        f.valores = valores;
        return q;
      };
    return q;
  };
  const rpc = async (nome: string, args: unknown) => {
    feitas.push({ tabela: `rpc:${nome}`, op: 'rpc', valores: args, filtros: [] });
    return responder(`rpc.${nome}`);
  };
  return {
    supabase: { from, rpc },
    feitas,
    /** Enfileira respostas pra `tabela.op` (ex.: 'fluxos.insert', 'rpc.salvar_fluxo'). */
    quando: (chave: string, ...rs: Resposta[]) => (filas[chave] = [...(filas[chave] ?? []), ...rs]),
    limpar: () => {
      for (const k of Object.keys(filas)) delete filas[k];
      feitas.length = 0;
    },
  };
}
```

`apps/web/test/acoes/fluxos.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MODELOS } from '@journey/fluxo';
import { bancoFalso } from './banco-falso';

const b = bancoFalso();
vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: b.supabase }) }));
const revalidar = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (c: string) => revalidar(c) }));
const { apagarFluxo, criarDeModelo, criarFluxo, mudarFluxo } = await import('@/acoes/fluxos');
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('acoes/fluxos', () => {
  beforeEach(() => {
    b.limpar();
    revalidar.mockClear();
  });

  it('fluxo em branco: nome e canal; sem nome não vai pro banco', async () => {
    expect(await criarFluxo('e1', '  ', 'whatsapp')).toEqual({ erro: 'Dá um nome pro fluxo.' });
    expect(b.feitas).toEqual([]);
    b.quando('fluxos.insert', { data: { id: 'f1' }, error: null });
    expect(await criarFluxo('e1', ' Cobrança ', '')).toEqual({ id: 'f1' });
    expect(b.feitas[0]).toMatchObject({ tabela: 'fluxos', op: 'insert', valores: { empresa_id: 'e1', nome: 'Cobrança', canal: null } });
    expect(revalidar).toHaveBeenCalledWith('/e/e1');
  });

  it('modelo: reaproveita o cadastro igual, cria os outros e salva o documento com os ids da empresa', async () => {
    const m = MODELOS.find((x) => x.chave === 'credito')!;
    // O Bureau já existe (23505): acha pelo nome, sem ler a lista inteira; os Analistas são novos.
    b.quando('cadastros.insert', { error: { code: '23505', message: 'duplicate' }, data: null }, { data: { id: 'k-analistas' }, error: null });
    b.quando('cadastros.select', { data: [{ id: 'k-bureau-2', tipo: 'sistema', nome: 'Bureau de crédito 2' }, { id: 'k-bureau', tipo: 'sistema', nome: '  bureau de CRÉDITO ' }], error: null });
    b.quando('canais.select', { data: { chave: 'interno' }, error: null });
    b.quando('fluxos.insert', { data: { id: 'f9' }, error: null });
    b.quando('rpc.salvar_fluxo', { data: 1, error: null });
    expect(await criarDeModelo('e1', 'credito')).toEqual({ id: 'f9' });
    const busca = b.feitas.find((f) => f.tabela === 'cadastros' && f.op === 'select')!;
    expect(busca.filtros).toEqual([['empresa_id', 'e1'], ['tipo', 'sistema'], ['nome', '%Bureau de crédito%']]);
    expect(b.feitas.find((f) => f.tabela === 'canais')!.filtros).toEqual([['empresa_id', 'e1'], ['chave', 'interno'], ['arquivado', false]]);
    expect(b.feitas.find((f) => f.tabela === 'fluxos')!.valores).toEqual({ empresa_id: 'e1', nome: m.nome, descricao: m.descricao, canal: 'interno' });
    const salvo = b.feitas.find((f) => f.tabela === 'rpc:salvar_fluxo')!.valores as { p_documento: { pecas: { responsavel?: string }[] }; p_revisao: number };
    expect(salvo.p_revisao).toBe(0);
    expect(salvo.p_documento.pecas.flatMap((p) => (p.responsavel ? [p.responsavel] : []))).toEqual(['k-bureau', 'k-analistas']);
  });

  it('modelo: o Horário entra com as janelas e feriados; canal que a empresa não tem fica vazio', async () => {
    for (const id of ['k1', 'k2', 'k3']) b.quando('cadastros.insert', { data: { id }, error: null });
    b.quando('canais.select', { data: null, error: null });
    b.quando('fluxos.insert', { data: { id: 'f1' }, error: null });
    b.quando('rpc.salvar_fluxo', { data: 1, error: null });
    await criarDeModelo('e1', 'whatsapp');
    const horario = b.feitas.find((f) => f.tabela === 'cadastros' && f.op === 'insert' && (f.valores as { tipo: string }).tipo === 'horario')!;
    expect((horario.valores as { campos: { janelas: unknown[]; feriados: unknown[] } }).campos.janelas).toHaveLength(2);
    expect((b.feitas.find((f) => f.tabela === 'fluxos')!.valores as { canal: unknown }).canal).toBeNull();
  });

  it('modelo: se salvar o documento falha, o fluxo e os cadastros que ele criou são apagados', async () => {
    b.quando('cadastros.insert', { data: { id: 'k1' }, error: null }, { error: { code: '23505', message: 'duplicate' } });
    b.quando('cadastros.select', { data: [{ id: 'k-sup', tipo: 'equipe', nome: 'Supervisão SAC' }], error: null });
    b.quando('fluxos.insert', { data: { id: 'f1' }, error: null });
    b.quando('rpc.salvar_fluxo', { error: { code: '22023', message: 'responsável' } });
    expect((await criarDeModelo('e1', 'email')).erro).toBeTruthy();
    const apagados = b.feitas.filter((f) => f.op === 'delete');
    expect(apagados).toMatchObject([
      { tabela: 'fluxos', filtros: [['empresa_id', 'e1'], ['id', 'f1']] },
      // Só o que esta chamada criou: a Supervisão SAC já existia e fica.
      { tabela: 'cadastros', filtros: [['empresa_id', 'e1'], ['id', ['k1']]] },
    ]);
    expect(await criarDeModelo('e1', 'nao-existe')).toEqual({ erro: 'Esse modelo não existe.' });
  });

  it('modelo: o fluxo não entra (sem acesso) e nada fica pra trás', async () => {
    for (const id of ['k1', 'k2']) b.quando('cadastros.insert', { data: { id }, error: null });
    b.quando('fluxos.insert', { error: { code: '42501', message: 'rls' } });
    expect((await criarDeModelo('e1', 'email')).erro).toBeTruthy();
    expect(b.feitas.filter((f) => f.op === 'delete')).toMatchObject([{ tabela: 'cadastros', filtros: [['empresa_id', 'e1'], ['id', ['k1', 'k2']]] }]);
    expect(b.feitas.some((f) => f.tabela === 'rpc:salvar_fluxo')).toBe(false);
  });

  it('mudar dados do fluxo: confere nome e meta; fluxo que sumiu é erro', async () => {
    expect(await mudarFluxo('e1', 'f1', { nome: ' ' })).toEqual({ erro: 'Dá um nome pro fluxo.' });
    expect(await mudarFluxo('e1', 'f1', { meta_s: -5 })).toEqual({ erro: 'A meta é um tempo maior que zero, de até um ano.' });
    expect(await mudarFluxo('e1', 'f1', { meta_s: 1e12 })).toEqual({ erro: 'A meta é um tempo maior que zero, de até um ano.' });
    expect(await mudarFluxo('e1', 'f1', { descricao: 'x'.repeat(5001) })).toEqual({ erro: 'A descrição vai até 5000 letras.' });
    expect(await mudarFluxo('e1', 'f1', {})).toEqual({});
    expect(b.feitas).toEqual([]);
    b.quando('fluxos.update', { data: [{ id: 'f1' }], error: null }, { data: [], error: null });
    expect(await mudarFluxo('e1', 'f1', { nome: ' Novo ', canal: '', meta_s: null })).toEqual({});
    expect(b.feitas.at(-1)).toMatchObject({ valores: { nome: 'Novo', canal: null, meta_s: null }, filtros: [['empresa_id', 'e1'], ['id', 'f1']] });
    expect(await mudarFluxo('e1', 'f1', { descricao: 'x' })).toEqual({ erro: 'Este fluxo não existe mais.' });
  });

  it('apagar fluxo', async () => {
    b.quando('fluxos.delete', { data: [{ id: 'f1' }], error: null }, { data: [], error: null });
    expect(await apagarFluxo('e1', 'f1')).toEqual({});
    expect(b.feitas[0]!.filtros).toEqual([['empresa_id', 'e1'], ['id', 'f1']]);
    expect(await apagarFluxo('e1', 'f1')).toEqual({ erro: 'Este fluxo não existe mais.' });
  });
});
```

`apps/web/test/acoes/cadastros.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bancoFalso } from './banco-falso';

const b = bancoFalso();
vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: b.supabase }) }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
const { apagarCadastro, criarCadastro, mudarHorario, renomearCadastro } = await import('@/acoes/cadastros');
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('acoes/cadastros', () => {
  beforeEach(() => b.limpar());

  it('cria; Horário nasce de segunda a sexta, 8h às 18h', async () => {
    b.quando('cadastros.insert', { data: { id: 'k1', tipo: 'horario', nome: 'SAC', campos: {} }, error: null });
    expect((await criarCadastro('e1', 'horario', ' SAC ')).cadastro?.id).toBe('k1');
    expect(b.feitas[0]!.valores).toMatchObject({ nome: 'SAC', campos: { janelas: [{ dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }] } });
    expect(await criarCadastro('e1', 'fila', '')).toEqual({ erro: 'Escreve um nome.' });
  });

  it('nome que já existe no tipo: devolve o que existe', async () => {
    b.quando('cadastros.insert', { error: { code: '23505', message: 'duplicate' } }, { error: { code: '23505', message: 'duplicate' } });
    b.quando('cadastros.select', { data: [{ id: 'k7', tipo: 'fila', nome: 'Fila Cobrança', campos: {} }], error: null }, { data: [], error: null });
    expect((await criarCadastro('e1', 'fila', 'fila cobrança')).cadastro).toMatchObject({ id: 'k7', nome: 'Fila Cobrança' });
    // A busca é só dos parecidos, com % e _ do nome valendo como letra.
    expect(b.feitas[1]!.filtros).toEqual([['empresa_id', 'e1'], ['tipo', 'fila'], ['nome', '%fila cobrança%']]);
    b.limpar();
    b.quando('cadastros.insert', { error: { code: '23505', message: 'duplicate' } });
    b.quando('cadastros.select', { data: [], error: null });
    expect(await criarCadastro('e1', 'fila', '50%_off')).toEqual({ erro: 'Já existe um cadastro com esse nome nesse tipo.' });
    expect(b.feitas[1]!.filtros.at(-1)).toEqual(['nome', '%50\\%\\_off%']);
  });

  it('renomear com nome repetido e apagar em uso explicam o porquê', async () => {
    b.quando('cadastros.update', { error: { code: '23505', message: 'duplicate' } });
    expect(await renomearCadastro('e1', 'k1', 'Ana')).toEqual({ erro: 'Já existe um cadastro com esse nome nesse tipo.' });
    expect(b.feitas[0]!.filtros).toEqual([['empresa_id', 'e1'], ['id', 'k1']]);
    b.quando('cadastros.delete', { error: { code: '23503', message: 'fk' } });
    expect(await apagarCadastro('e1', 'k1')).toEqual({ erro: 'Algum fluxo usa este cadastro. Troca nas peças antes de apagar.' });
    expect(b.feitas[1]!.filtros).toEqual([['empresa_id', 'e1'], ['id', 'k1']]);
  });

  it('horário: confere janelas e feriados antes de gravar', async () => {
    expect((await mudarHorario('e1', 'k1', { janelas: [{ dias: ['seg'], inicio: '18:00', fim: '08:00' }] })).erro).toMatch(/Confere as janelas/);
    expect((await mudarHorario('e1', 'k1', { janelas: [{ dias: [], inicio: '08:00', fim: '18:00' }] })).erro).toMatch(/pelo menos um dia/);
    expect(b.feitas).toEqual([]);
    b.quando('cadastros.update', { data: [{ id: 'k1' }], error: null });
    expect(await mudarHorario('e1', 'k1', { janelas: [{ dias: ['sab'], inicio: '00:00', fim: '24:00' }], feriados: [{ data: '2026-12-25', todo_ano: true, extra: 1 }] })).toEqual({});
    expect(b.feitas[0]!.valores).toEqual({ campos: { janelas: [{ dias: ['sab'], inicio: '00:00', fim: '24:00' }], feriados: [{ data: '2026-12-25', todo_ano: true }] } });
    // Só Horário: sem o filtro de tipo, mudaria os campos de uma fila.
    expect(b.feitas[0]!.filtros).toEqual([['empresa_id', 'e1'], ['id', 'k1'], ['tipo', 'horario']]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/acoes/fluxos.test.ts test/acoes/cadastros.test.ts`
Expected: FAIL, `Failed to resolve import "@/acoes/fluxos"` (e `"@/acoes/cadastros"`).

- [ ] **Passo 3: as leituras** (no fim do `dados.ts`, e os imports no começo)

```diff
diff --git a/apps/web/src/lib/dados.ts b/apps/web/src/lib/dados.ts
index 30d97c3..2c16897 100644
--- a/apps/web/src/lib/dados.ts
+++ b/apps/web/src/lib/dados.ts
@@ -2,6 +2,9 @@ import 'server-only';
 import { cache } from 'react';
 import { notFound, redirect } from 'next/navigation';
 import type { Achado, Documento, Evento } from '@journey/nucleo';
+import { lerDocumento, type Cadastro, type Documento as DocumentoFluxo } from '@journey/fluxo';
+import type { TipoCadastro } from '@/editor/cadastros';
+import type { CanalEditor } from '@/editor/estilo';
 import type { LinkResumo } from '@/compartilhar/opcoes';
 import type { Revisao } from '@/importacao/revisao';
 import type { Modo } from '@/simulacao/sessao';
@@ -33,6 +36,20 @@ function ok<T>(r: { data: T[] | null; error: ErroBanco }): T[] {
   return r.data ?? [];
 }
 
+/**
+ * Lista que pode passar de 1000 linhas: o PostgREST devolve no máximo `max_rows` (1000, aqui e no Supabase) por
+ * pedido, calado. Lê de 1000 em 1000, numa ordem fixa, até vir uma página incompleta.
+ */
+async function todas<T>(pedir: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: ErroBanco }>): Promise<T[]> {
+  const POR_VEZ = 1000;
+  const linhas: T[] = [];
+  for (let de = 0; ; de += POR_VEZ) {
+    const pagina = ok(await pedir(de, de + POR_VEZ - 1));
+    linhas.push(...pagina);
+    if (pagina.length < POR_VEZ) return linhas;
+  }
+}
+
 /** Uma linha ou nada. */
 function talvez<T>(r: { data: T | null; error: ErroBanco }): T | null {
   falhou(r.error);
@@ -226,3 +243,108 @@ export async function membros(empresaId: string) {
   const c = ok(await supabase.from('convites').select('email, criado_em').eq('empresa_id', empresaId).order('criado_em'));
   return { membros: m, convites: c };
 }
+
+// Journey v2: fluxos, canais e cadastros --------------------------------------------------------------------------
+
+export interface FluxoResumo {
+  id: string;
+  nome: string;
+  descricao: string;
+  canal: string | null;
+  pecas: number;
+  editado_em: string;
+  /** E-mail de quem mexeu por último (null se não é mais membro). */
+  editado_por: string | null;
+  /** E-mail de quem está editando agora (trava valendo), ou null. */
+  editando: string | null;
+}
+
+/** E-mails dos membros da empresa, por id de usuário. */
+async function emailsDosMembros(empresaId: string): Promise<Map<string, string>> {
+  const { supabase } = await usuarioAtual();
+  const ms = ok<{ usuario_id: string; email: string }>(await supabase.from('membros').select('usuario_id, email').eq('empresa_id', empresaId));
+  return new Map(ms.map((m) => [m.usuario_id, m.email]));
+}
+
+/** A grade de fluxos (da view fluxos_resumo: sem os documentos), do mais mexido pro menos. */
+export async function fluxos(empresaId: string): Promise<FluxoResumo[]> {
+  const { supabase } = await usuarioAtual();
+  const [linhas, emails] = await Promise.all([
+    supabase.from('fluxos_resumo').select('id, nome, descricao, canal, pecas, editado_em, editado_por, editando_por').eq('empresa_id', empresaId).order('editado_em', { ascending: false }),
+    emailsDosMembros(empresaId),
+  ]);
+  return ok<{ id: string; nome: string; descricao: string; canal: string | null; pecas: number; editado_em: string; editado_por: string | null; editando_por: string | null }>(linhas).map(
+    (l) => ({
+      id: l.id,
+      nome: l.nome,
+      descricao: l.descricao,
+      canal: l.canal,
+      pecas: l.pecas,
+      editado_em: l.editado_em,
+      editado_por: (l.editado_por && emails.get(l.editado_por)) ?? null,
+      editando: (l.editando_por && emails.get(l.editando_por)) ?? null,
+    }),
+  );
+}
+
+export interface FluxoParaEditar {
+  id: string;
+  nome: string;
+  descricao: string;
+  canal: string | null;
+  meta_s: number | null;
+  revisao: number;
+  documento: DocumentoFluxo;
+  estilo: unknown;
+}
+
+/** Um fluxo inteiro, pro editor. O documento passa pela validação do pacote: o que vem do banco também é de fora. */
+export async function fluxoParaEditar(empresaId: string, fluxoId: string): Promise<FluxoParaEditar> {
+  const { supabase } = await usuarioAtual();
+  const f = talvez<Omit<FluxoParaEditar, 'documento'> & { documento: unknown }>(
+    await supabase.from('fluxos').select('id, nome, descricao, canal, meta_s, revisao, documento, estilo').eq('empresa_id', empresaId).eq('id', fluxoId).maybeSingle(),
+  );
+  if (!f) notFound();
+  const lido = lerDocumento(f.documento);
+  if (!lido.documento) throw new Error(`o documento do fluxo "${f.nome}" não é um journey/2 válido: ${lido.problemas.map((p) => p.codigo).join(', ')}`);
+  return { ...f, documento: lido.documento };
+}
+
+export async function canais(empresaId: string): Promise<(CanalEditor & { arquivado: boolean })[]> {
+  const { supabase } = await usuarioAtual();
+  return ok(await supabase.from('canais').select('chave, nome, cor, arquivado').eq('empresa_id', empresaId).order('ordem').order('nome'));
+}
+
+export async function cadastros(empresaId: string): Promise<Cadastro[]> {
+  const { supabase } = await usuarioAtual();
+  const linhas = await todas<{ id: string; tipo: string; nome: string; campos: Record<string, unknown> }>((de, ate) =>
+    supabase.from('cadastros').select('id, tipo, nome, campos').eq('empresa_id', empresaId).order('nome').order('id').range(de, ate),
+  );
+  return linhas.map((l) => ({ id: l.id, tipo: l.tipo, nome: l.nome, campos: l.campos }));
+}
+
+export async function tiposCadastro(empresaId: string): Promise<TipoCadastro[]> {
+  const { supabase } = await usuarioAtual();
+  // Os padrão primeiro, na ordem de sempre; os da empresa depois, por nome.
+  const ordem = ['pessoa', 'fila', 'equipe', 'sistema', 'horario'];
+  const linhas = ok<TipoCadastro & { padrao: boolean }>(await supabase.from('tipos_cadastro').select('chave, nome, padrao').eq('empresa_id', empresaId).order('nome'));
+  const pos = (t: { chave: string; padrao: boolean }) => (t.padrao ? ordem.indexOf(t.chave) : ordem.length);
+  return linhas.sort((a, b) => pos(a) - pos(b)).map(({ chave, nome }) => ({ chave, nome }));
+}
+
+/** "Onde é usado": os fluxos de cada cadastro. */
+export async function usosDosCadastros(empresaId: string): Promise<Map<string, { id: string; nome: string }[]>> {
+  const { supabase } = await usuarioAtual();
+  const [usos, fs] = await Promise.all([
+    todas<{ cadastro_id: string; fluxo_id: string }>((de, ate) =>
+      supabase.from('fluxo_cadastros').select('cadastro_id, fluxo_id').eq('empresa_id', empresaId).order('cadastro_id').order('fluxo_id').range(de, ate),
+    ),
+    todas<{ id: string; nome: string }>((de, ate) => supabase.from('fluxos_resumo').select('id, nome').eq('empresa_id', empresaId).order('id').range(de, ate)),
+  ]);
+  const nomes = new Map(fs.map((f) => [f.id, f.nome]));
+  const m = new Map<string, { id: string; nome: string }[]>();
+  for (const u of usos) {
+    m.set(u.cadastro_id, [...(m.get(u.cadastro_id) ?? []), { id: u.fluxo_id, nome: nomes.get(u.fluxo_id) ?? 'fluxo' }]);
+  }
+  return m;
+}
```

E o cadastro que nasce sem repetir (as duas ações usam).

`apps/web/src/lib/cadastro-unico.ts`:

```ts
import type { Cadastro } from '@journey/fluxo';
import { nomeNormalizado } from '@/editor/cadastros';
import type { supabaseServidor } from './supabase/servidor';

type Cliente = Awaited<ReturnType<typeof supabaseServidor>>;
type Erro = { code?: string; message: string };

/** Escapa `%`, `_` e `\` pra que o texto valha literalmente num `ilike`. */
const literal = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Cria o cadastro, ou acha o que já existe com o mesmo nome no mesmo tipo (sem caixa nem espaços, como o índice
 * único do banco). Tenta criar primeiro: duas pessoas (ou dois cliques) ao mesmo tempo dão no mesmo cadastro, e
 * não precisa ler a lista inteira (que passa das 1000 linhas que o PostgREST devolve por vez).
 */
export async function acharOuCriarCadastro(
  supabase: Cliente,
  empresaId: string,
  tipo: string,
  nome: string,
  campos: object,
): Promise<{ cadastro: Cadastro; novo: boolean } | { erro: Erro }> {
  const r = await supabase.from('cadastros').insert({ empresa_id: empresaId, tipo, nome, campos }).select('id, tipo, nome, campos').single();
  if (!r.error) return { cadastro: r.data as Cadastro, novo: true };
  if (r.error.code === '23505') {
    const parecidos = await supabase.from('cadastros').select('id, tipo, nome, campos').eq('empresa_id', empresaId).eq('tipo', tipo).ilike('nome', `%${literal(nome.trim())}%`);
    const igual = (parecidos.data as Cadastro[] | null)?.find((k) => nomeNormalizado(k.nome) === nomeNormalizado(nome));
    if (igual) return { cadastro: igual, novo: false };
  }
  return { erro: r.error };
}
```

- [ ] **Passo 4: as ações dos fluxos**

`apps/web/src/acoes/fluxos.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { LIMITES, MODELOS, camposHorario, instanciarModelo } from '@journey/fluxo';
import { acharOuCriarCadastro } from '@/lib/cadastro-unico';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

const MENSAGENS = { '23514': 'O nome vai de 1 a 120 letras.', '23503': 'Esse canal não existe nesta empresa.' };

/** Fluxo em branco: só nome e canal. O documento vazio vem do banco. */
export async function criarFluxo(empresaId: string, nome: string, canal: string | null): Promise<{ id?: string; erro?: string }> {
  const n = typeof nome === 'string' ? nome.trim() : '';
  if (!n) return { erro: 'Dá um nome pro fluxo.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('fluxos').insert({ empresa_id: empresaId, nome: n, canal: canal || null }).select('id').single();
  if (r.error) return { erro: mensagemDoErro('criarFluxo', r.error, MENSAGENS) };
  revalidatePath(`/e/${empresaId}`);
  return { id: r.data.id as string };
}

/**
 * Fluxo a partir de um modelo. Cada cadastro do modelo vira o cadastro da empresa com o mesmo tipo e nome
 * (o que já existe é reaproveitado), e o documento é salvo com os ids dela. Se algo falha no meio, o que esta
 * chamada criou é apagado (o fluxo e os cadastros novos): não sobra fluxo vazio nem cadastro solto.
 */
export async function criarDeModelo(empresaId: string, chave: string): Promise<{ id?: string; erro?: string }> {
  const modelo = MODELOS.find((m) => m.chave === chave);
  if (!modelo) return { erro: 'Esse modelo não existe.' };
  const { supabase } = await usuarioAtual();

  const ids: Record<string, string> = {};
  const criados: string[] = [];
  const falhou = async (erro: { code?: string; message: string }, mensagens?: Record<string, string>) => {
    if (criados.length) {
      const d = await supabase.from('cadastros').delete().eq('empresa_id', empresaId).in('id', criados);
      if (d.error) mensagemDoErro('criarDeModelo: desfazer cadastros', d.error);
    }
    return { erro: mensagemDoErro('criarDeModelo', erro, mensagens) };
  };
  for (const k of modelo.cadastros) {
    const campos = k.tipo === 'horario' ? (camposHorario(k) ?? {}) : (k.campos ?? {});
    const a = await acharOuCriarCadastro(supabase, empresaId, k.tipo, k.nome, campos);
    if ('erro' in a) return falhou(a.erro, { '23503': `A empresa não tem o tipo de cadastro "${k.tipo}".` });
    ids[k.id] = a.cadastro.id;
    if (a.novo) criados.push(a.cadastro.id);
  }
  const documento = instanciarModelo(modelo, ids);

  // Canal arquivado ou que a empresa não tem: o fluxo nasce sem canal (dá pra escolher no painel).
  const canal = await supabase.from('canais').select('chave').eq('empresa_id', empresaId).eq('chave', modelo.canal).eq('arquivado', false).maybeSingle();
  if (canal.error) return falhou(canal.error);
  const f = await supabase
    .from('fluxos')
    .insert({ empresa_id: empresaId, nome: modelo.nome, descricao: modelo.descricao, canal: canal.data ? modelo.canal : null })
    .select('id')
    .single();
  if (f.error) return falhou(f.error, MENSAGENS);
  const id = f.data.id as string;
  const s = await supabase.rpc('salvar_fluxo', { p_fluxo: id, p_revisao: 0, p_documento: documento });
  if (s.error) {
    const d = await supabase.from('fluxos').delete().eq('empresa_id', empresaId).eq('id', id);
    if (d.error) mensagemDoErro('criarDeModelo: desfazer fluxo', d.error);
    return falhou(s.error);
  }
  revalidatePath(`/e/${empresaId}`);
  return { id };
}

export interface DadosDoFluxo {
  nome?: string;
  descricao?: string;
  canal?: string | null;
  meta_s?: number | null;
}

/** Nome, descrição, canal principal e meta: colunas que a tela grava direto (o documento vai pelo salvar_fluxo). */
export async function mudarFluxo(empresaId: string, fluxoId: string, d: DadosDoFluxo): Promise<{ erro?: string }> {
  const valores: Record<string, unknown> = {};
  if (d.nome !== undefined) {
    if (typeof d.nome !== 'string' || !d.nome.trim()) return { erro: 'Dá um nome pro fluxo.' };
    valores.nome = d.nome.trim();
  }
  if (d.descricao !== undefined) {
    if (typeof d.descricao !== 'string' || d.descricao.length > LIMITES.texto) return { erro: `A descrição vai até ${LIMITES.texto} letras.` };
    valores.descricao = d.descricao.trim();
  }
  if (d.canal !== undefined) valores.canal = d.canal || null;
  if (d.meta_s !== undefined) {
    if (d.meta_s !== null && !(Number.isInteger(d.meta_s) && d.meta_s > 0 && d.meta_s <= LIMITES.tempo_s)) return { erro: 'A meta é um tempo maior que zero, de até um ano.' };
    valores.meta_s = d.meta_s;
  }
  if (!Object.keys(valores).length) return {};
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('fluxos').update(valores).eq('empresa_id', empresaId).eq('id', fluxoId).select('id');
  if (r.error) return { erro: mensagemDoErro('mudarFluxo', r.error, MENSAGENS) };
  if (!r.data?.length) return { erro: 'Este fluxo não existe mais.' };
  revalidatePath(`/e/${empresaId}`);
  return {};
}

export async function apagarFluxo(empresaId: string, fluxoId: string): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('fluxos').delete().eq('empresa_id', empresaId).eq('id', fluxoId).select('id');
  if (r.error) return { erro: mensagemDoErro('apagarFluxo', r.error) };
  if (!r.data?.length) return { erro: 'Este fluxo não existe mais.' };
  revalidatePath(`/e/${empresaId}`);
  return {};
}
```

- [ ] **Passo 5: as ações dos cadastros**

`apps/web/src/acoes/cadastros.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { camposHorario, type Cadastro } from '@journey/fluxo';
import { HORARIO_PADRAO } from '@/editor/cadastros';
import { acharOuCriarCadastro } from '@/lib/cadastro-unico';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

const MENSAGENS = {
  '23505': 'Já existe um cadastro com esse nome nesse tipo.',
  '23514': 'O nome vai de 1 a 200 letras.',
  '23503': 'A empresa não tem esse tipo de cadastro.',
};

const caminho = (empresaId: string) => `/e/${empresaId}/cadastros`;

/**
 * Cria um cadastro (é assim que ele nasce do desenho). Se já existe um com o mesmo nome no mesmo tipo,
 * devolve o que existe: escrever "fila cobrança" numa peça usa a Fila Cobrança que já está lá.
 * Horário nasce de segunda a sexta, das 8h às 18h.
 */
export async function criarCadastro(empresaId: string, tipo: string, nome: string): Promise<{ cadastro?: Cadastro; erro?: string }> {
  const n = typeof nome === 'string' ? nome.trim() : '';
  if (!n) return { erro: 'Escreve um nome.' };
  const { supabase } = await usuarioAtual();
  const campos = tipo === 'horario' ? HORARIO_PADRAO : {};
  const r = await acharOuCriarCadastro(supabase, empresaId, tipo, n, campos);
  if ('erro' in r) return { erro: mensagemDoErro('criarCadastro', r.erro, MENSAGENS) };
  if (r.novo) revalidatePath(caminho(empresaId));
  return { cadastro: r.cadastro };
}

/** Renomear muda o nome em todos os fluxos: as peças guardam o id, não o nome. */
export async function renomearCadastro(empresaId: string, id: string, nome: string): Promise<{ erro?: string }> {
  const n = typeof nome === 'string' ? nome.trim() : '';
  if (!n) return { erro: 'Escreve um nome.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('cadastros').update({ nome: n }).eq('empresa_id', empresaId).eq('id', id).select('id');
  if (r.error) return { erro: mensagemDoErro('renomearCadastro', r.error, MENSAGENS) };
  if (!r.data?.length) return { erro: 'Este cadastro não existe mais.' };
  revalidatePath(caminho(empresaId));
  return {};
}

/** Só apaga cadastro sem uso: o banco recusa (23503) se algum fluxo usa. */
export async function apagarCadastro(empresaId: string, id: string): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('cadastros').delete().eq('empresa_id', empresaId).eq('id', id).select('id');
  if (r.error) return { erro: mensagemDoErro('apagarCadastro', r.error, { '23503': 'Algum fluxo usa este cadastro. Troca nas peças antes de apagar.' }) };
  if (!r.data?.length) return { erro: 'Este cadastro não existe mais.' };
  revalidatePath(caminho(empresaId));
  return {};
}

/** Janelas e feriados de um Horário, conferidos como o relógio confere. */
export async function mudarHorario(empresaId: string, id: string, campos: unknown): Promise<{ erro?: string }> {
  const lidos = camposHorario({ id, tipo: 'horario', nome: 'h', campos: campos as Record<string, unknown> });
  // Janela sem dia não abre nunca: é engano de quem editou, não um horário.
  if (!lidos || lidos.janelas.some((j) => !j.dias.length)) return { erro: 'Confere as janelas (o fim depois do início, até 24:00, com pelo menos um dia) e as datas dos feriados.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('cadastros').update({ campos: lidos }).eq('empresa_id', empresaId).eq('id', id).eq('tipo', 'horario').select('id');
  if (r.error) return { erro: mensagemDoErro('mudarHorario', r.error) };
  if (!r.data?.length) return { erro: 'Este horário não existe mais.' };
  revalidatePath(caminho(empresaId));
  return {};
}
```

- [ ] **Passo 6: rodar e ver passar**

Run: `cd apps/web && npx vitest run test/acoes/fluxos.test.ts test/acoes/cadastros.test.ts && npx tsc --noEmit`
Expected: `Tests  11 passed (11)`; `tsc` sem saída.

- [ ] **Passo 7: commit**

```bash
git add apps/web/src/lib/dados.ts apps/web/src/lib/cadastro-unico.ts apps/web/src/acoes apps/web/test/acoes
git commit -m "web: leituras e ações de fluxos e cadastros" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 7: o quadro

**Arquivos:**
- Criar: `apps/web/src/componentes/editor/editor.css`, `Pecas.tsx`, `Agua.tsx`, `Quadro.tsx`

O CSS é o do protótipo, com cada regra dentro de `.editor` (e `.app` virou `.editor`), mais as peças novas no fim (faixas de aviso, a busca do responsável, o "Dia e hora" do play).

- [ ] **Passo 1: o CSS**

`apps/web/src/componentes/editor/editor.css`:

```css
/* Editor de fluxos (v2): o protótipo aprovado (barra de formas, quadro, painel, play). Tudo dentro de .editor, pra não
   esbarrar no CSS das telas da v1 que ainda existem. Os tokens (--accent, --nota, --grupo, --mistura) estão no globals.css. */
.editor { height: 100%; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 10px; }
.editor .topo { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; min-width: 0; }
.editor .nome-fluxo { min-width: 0; flex: 1 1 180px; max-width: 340px; border: 1px solid transparent; background: transparent; border-radius: 9px; padding: 6px 9px; font-weight: 600; font-size: 15px; }
.editor .nome-fluxo:hover, .editor .nome-fluxo:focus { border-color: var(--line); background: var(--node); }
.editor .salvo { font: 500 11.5px var(--f-mono); color: var(--ink-3); }
.editor .empurra { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.editor .botao { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--line); background: var(--node); color: var(--ink); border-radius: 9px; padding: 7px 12px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; }
.editor .botao:hover { border-color: var(--ink-3); }
.editor .botao:disabled { opacity: .45; cursor: default; }
.editor .botao.primario { background: var(--btn); color: var(--btn-ink); border-color: var(--btn); }
.editor .botao.pequeno { padding: 4px 9px; font-size: 12px; }
.editor .botao.perigo { color: var(--bad); }
.editor .bi { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--line); background: var(--node); border-radius: 9px; cursor: pointer; padding: 0; color: var(--ink); }
.editor .bi:hover { border-color: var(--ink-3); }
.editor .bi:disabled { opacity: .35; cursor: default; }
.editor select.botao { padding-right: 8px; }

.editor .area { display: grid; grid-template-columns: auto minmax(0, 1fr) 330px; gap: 10px; min-height: 0; }
.editor .ferramentas { user-select: none; -webkit-user-select: none; display: flex; flex-direction: column; gap: 4px; padding: 6px; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; overflow-y: auto; }
.editor .ferramentas .sep { height: 1px; background: var(--line); margin: 4px 2px; flex: none; }
.editor .ferr { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border: 1px solid transparent; border-radius: 10px; background: none; cursor: grab; position: relative; color: var(--ink-2); touch-action: none; }
.editor .ferr:hover { background: var(--tile); color: var(--ink); }
.editor .ferr[aria-pressed="true"] { background: var(--btn); color: var(--btn-ink); }
.editor .ferr .icone { width: 20px; height: 20px; }
.editor .ferr .dica-ferr { position: absolute; left: calc(100% + 8px); top: 50%; transform: translateY(-50%); background: var(--btn); color: var(--btn-ink); font-size: 12px; padding: 4px 8px; border-radius: 6px; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity .12s; z-index: 30; }
.editor .ferr:hover .dica-ferr { opacity: 1; }

.editor .palco { user-select: none; -webkit-user-select: none; position: relative; overflow: hidden; background-color: var(--canvas); background-image: radial-gradient(var(--dot) 1.1px, transparent 1.2px); border: 1px solid var(--line); border-radius: 16px; touch-action: none; cursor: default; }
.editor .palco.mao, .editor .palco.arrastando-quadro { cursor: grab; }
.editor .palco.arrastando-quadro { cursor: grabbing; }
.editor .palco.criando { cursor: crosshair; }
.editor .mundo { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.editor .camada { position: absolute; left: 0; top: 0; }
.editor svg.canos { position: absolute; left: -20000px; top: -20000px; width: 40000px; height: 40000px; overflow: visible; pointer-events: none; }

/* Grupos (molduras) */
.editor .grupo { position: absolute; border-radius: 18px; background: color-mix(in srgb, var(--gc, var(--grupo)) var(--mistura), transparent); border: 1.5px dashed color-mix(in srgb, var(--gc, var(--ink-3)) 80%, var(--ink-3)); cursor: move; }
.editor .grupo.sel { border-style: solid; border-color: var(--accent); }
.editor .grupo .g-titulo { position: absolute; left: 14px; top: -11px; padding: 1px 9px; background: var(--canvas); border-radius: 6px; font: 600 12px var(--f-mono); letter-spacing: .04em; text-transform: uppercase; color: var(--ink-2); white-space: nowrap; }
.editor .grupo .alca { position: absolute; right: -6px; bottom: -6px; width: 14px; height: 14px; border-radius: 4px; background: var(--node); border: 1.5px solid var(--accent); cursor: nwse-resize; display: none; }
.editor .grupo.sel .alca { display: block; }

/* Peças */
.editor .no { position: absolute; display: flex; align-items: center; gap: 10px; padding: 0 12px; background: var(--node); border: 1.4px solid var(--node-line); border-radius: 12px; box-shadow: 0 3px 0 var(--plate); cursor: pointer; user-select: none; transition: opacity .3s, box-shadow .2s, border-color .2s; }
.editor .no:hover { border-color: var(--ink-3); }
.editor .no.com-cor { background: color-mix(in srgb, var(--pc) var(--mistura), var(--node)); }
.editor .no.t-nota.com-cor { background: color-mix(in srgb, var(--pc) calc(var(--mistura) + 25%), var(--node)); }
.editor .no.sel { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent), 0 3px 0 var(--plate); }
.editor .no .tile { width: 32px; height: 32px; flex: none; border-radius: 9px; background: var(--tile); display: grid; place-items: center; color: var(--ink-2); position: relative; z-index: 1; }
.editor .no .textos { min-width: 0; display: grid; position: relative; z-index: 1; }
.editor .no .titulo { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.editor .no .sub { font-size: 11px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; gap: 5px; align-items: center; }
.editor .no .sub .ponto-canal { width: 7px; height: 7px; border-radius: 50%; background: var(--c); flex: none; }
.editor .no .etiqueta { position: absolute; left: 4px; top: -17px; font: 500 10.5px var(--f-mono); color: var(--ink-3); white-space: nowrap; pointer-events: none; }
.editor .no.t-inicio { border-radius: 999px; padding-left: 8px; }
.editor .no.t-inicio .tile { border-radius: 50%; background: var(--c, var(--accent)); color: #fff; }
.editor .no.t-fim { border-radius: 999px; }
.editor .no.t-fim .tile { border-radius: 50%; }
.editor .no.t-atendimento .tile { background: var(--accent-soft); color: var(--accent); }
.editor .no.t-espera .tile { background: color-mix(in srgb, #c98410 18%, var(--tile)); color: #b07610; }
.editor .no.t-sistema .tile { background: color-mix(in srgb, #7650d6 16%, var(--tile)); color: #7650d6; }
.editor .no.t-decisao { background: none; border: 0; box-shadow: none; justify-content: center; padding: 0; }
.editor .no.t-decisao::before { content: ''; position: absolute; inset: 15%; transform: rotate(45deg); background: var(--node); border: 1.6px solid var(--ink-2); border-radius: 10px; box-shadow: 0 3px 0 var(--plate); transition: border-color .2s, box-shadow .2s; }
.editor .no.t-decisao.sel::before { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent); }
.editor .no.t-decisao .textos { text-align: center; max-width: 92px; }
.editor .no.t-decisao .titulo { white-space: normal; line-height: 1.2; font-size: 12.5px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.editor .no.t-decisao .tile { display: none; }
.editor .no.t-nota { background: var(--nota); color: var(--nota-ink); border: 0; border-radius: 4px; align-items: flex-start; padding: 12px; box-shadow: 0 8px 18px -10px rgba(0,0,0,.35); transform: rotate(-1.2deg); }
.editor .no.t-nota .tile { display: none; }
.editor .no.t-nota .titulo { white-space: pre-wrap; font-weight: 500; font-size: 13.5px; line-height: 1.35; }
.editor .no.t-nota .sub { display: none; }
.editor .no .ponta { position: absolute; right: -8px; top: 50%; width: 16px; height: 16px; margin-top: -8px; border-radius: 50%; background: var(--node); border: 2px solid var(--accent); cursor: crosshair; opacity: 0; transition: opacity .15s, transform .15s; z-index: 2; touch-action: none; }
.editor .no .mais { position: absolute; right: -40px; top: 50%; width: 24px; height: 24px; margin-top: -12px; border-radius: 50%; border: 0; background: var(--accent); color: #fff; display: grid; place-items: center; cursor: pointer; opacity: 0; transition: opacity .15s; z-index: 2; padding: 0; }
.editor .no .mais .icone { width: 14px; height: 14px; }
.editor .no:hover .ponta, .editor .no.sel .ponta, .editor .no:hover .mais, .editor .no.sel .mais { opacity: 1; }
.editor .no.t-decisao .ponta { right: -2px; }
.editor .no.t-decisao .mais { right: -34px; }
.editor .no.t-nota .ponta, .editor .no.t-nota .mais { display: none; }
.editor .no.alvo-ligacao { border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 35%, transparent); }
.editor .no.t-decisao.alvo-ligacao::before { border-color: var(--accent); }
.editor .no .nivel { position: absolute; inset: 1px; border-radius: inherit; overflow: hidden; pointer-events: none; }
.editor .no .nivel::before { content: ''; position: absolute; left: -40px; right: -40px; bottom: 0; height: 0; background: var(--agua, var(--accent)); opacity: .2; transition: height 1s ease; }
.editor .no.molhado .nivel::before { height: 58%; }
.editor .no.t-decisao .nivel { display: none; }
.editor.ondas .no.molhado .nivel::before { animation: onda 2.6s ease-in-out infinite; }
@keyframes onda { 50% { transform: translateY(-3px) skewX(-6deg); } }
.editor .no.atual { border-color: var(--agua, var(--accent)); border-width: 2.2px; }
.editor .no.t-decisao.atual::before { border-color: var(--agua, var(--accent)); border-width: 2.4px; }
.editor .no.perguntando::after { content: ''; position: absolute; inset: -7px; border-radius: inherit; border: 2px solid var(--agua, var(--accent)); opacity: .55; animation: pulso 1.4s ease-out infinite; pointer-events: none; }
.editor .no.t-decisao.perguntando::after { inset: 8%; transform: rotate(45deg); border-radius: 14px; }
@keyframes pulso { from { transform: scale(.98); opacity: .7; } to { transform: scale(1.06); opacity: 0; } }
.editor .no.t-decisao.perguntando::after { animation-name: pulso-d; }
@keyframes pulso-d { from { transform: rotate(45deg) scale(.98); opacity: .7; } to { transform: rotate(45deg) scale(1.08); opacity: 0; } }
.editor.holofote-on.escolhendo .no:not(.foco), .editor.holofote-on.escolhendo .grupo, .editor.holofote-on.escolhendo .rotulo-cano:not(.foco) { opacity: .22; }
.editor.holofote-on.escolhendo svg.canos .cano:not(.foco) { opacity: .22; }
.editor .renomear { position: absolute; z-index: 5; border: 1.5px solid var(--accent); border-radius: 8px; background: var(--node); padding: 6px 8px; font-weight: 600; font-size: 13px; }

/* Canos */
.editor .cano .alvo { stroke: transparent; stroke-width: 18px; fill: none; pointer-events: stroke; cursor: pointer; }
.editor .cano .parede, .editor .cano .nucleo, .editor .cano .reflexo, .editor .cano .linha { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.editor .cano .parede { stroke: var(--pipe-wall); }
.editor .cano .nucleo { stroke: var(--pipe-core); }
.editor .cano .reflexo { stroke: var(--pipe-sheen); opacity: .9; }
.editor .cano .linha { stroke: var(--pipe-wall); }
.editor .cano.sel .parede, .editor .cano.sel .linha { stroke: var(--accent); }
.editor .cano .seta { fill: var(--pipe-wall); }
.editor .cano.sel .seta { fill: var(--accent); }
.editor .cano.temp .linha { stroke: var(--accent); stroke-dasharray: 6 6; }
.editor .agua-trilho { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.editor .agua-brilho { fill: none; stroke: rgba(255,255,255,.55); stroke-linecap: round; stroke-dasharray: 6 26; animation: brilho var(--dur-brilho, 1.4s) linear infinite; }
@keyframes brilho { to { stroke-dashoffset: -64; } }
.editor .bolha { fill: rgba(255,255,255,.85); }
.editor .rotulo-cano { position: absolute; transform: translate(-50%, -50%); background: var(--node); border: 1px solid var(--node-line); border-radius: 999px; padding: 2px 9px; font: 500 11.5px var(--f-mono); color: var(--ink-2); white-space: nowrap; cursor: pointer; z-index: 3; transition: opacity .3s; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.editor .rotulo-cano:hover { border-color: var(--ink-3); }
.editor .rotulo-cano.sel { border-color: var(--accent); color: var(--accent); }
.editor .rotulo-cano.escolhivel { background: var(--agua, var(--accent)); color: #fff; border-color: transparent; cursor: pointer; }
.editor .rotulo-cano .tecla { display: inline-block; min-width: 16px; margin-right: 4px; padding: 0 4px; border-radius: 4px; background: rgba(255,255,255,.25); text-align: center; }

.editor .vazio-quadro { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; text-align: center; padding: 20px; }
.editor .vazio-quadro div { max-width: 360px; display: grid; gap: 8px; color: var(--ink-2); }
.editor .vazio-quadro b { font-family: var(--f-display); font-size: 22px; color: var(--ink); text-wrap: balance; }

.editor .hud { position: absolute; left: 12px; top: 12px; display: flex; gap: 6px; flex-wrap: wrap; pointer-events: none; z-index: 10; }
.editor .pilula { display: inline-flex; align-items: center; gap: 6px; background: var(--node); border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; font: 500 12px var(--f-mono); color: var(--ink-2); }
.editor .pilula .ponto-cor { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
.editor .zoom { position: absolute; right: 12px; bottom: 12px; display: flex; gap: 4px; align-items: center; background: var(--panel); border: 1px solid var(--line); border-radius: 11px; padding: 4px; z-index: 10; }
.editor .zoom .bi { width: 30px; height: 30px; border-color: transparent; }
.editor .zoom span { font: 500 12px var(--f-mono); min-width: 44px; text-align: center; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.editor .atalhos { position: absolute; left: 12px; bottom: 12px; font-size: 11.5px; color: var(--ink-3); background: color-mix(in srgb, var(--canvas) 85%, transparent); padding: 4px 8px; border-radius: 8px; z-index: 10; max-width: calc(100% - 200px); }

.editor .menu-rapido { position: absolute; z-index: 40; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); padding: 6px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px; width: 260px; }
.editor .menu-rapido .titulo-menu { grid-column: 1 / -1; font: 600 10.5px var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); padding: 4px 6px 6px; }
.editor .menu-rapido button { display: flex; align-items: center; gap: 8px; border: 0; background: none; border-radius: 8px; padding: 7px 8px; cursor: pointer; text-align: left; font-size: 13px; }
.editor .menu-rapido button:hover, .editor .menu-rapido button:focus-visible { background: var(--tile); }

.editor .fantasma { position: fixed; z-index: 60; pointer-events: none; opacity: .85; }

/* Cartão da simulação */
.editor .cartao-sim { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); width: min(440px, calc(100% - 24px)); background: var(--panel); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 12px 14px; z-index: 20; display: grid; gap: 10px; max-height: 60%; overflow: auto; }
.editor .cartao-sim .cab { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font: 500 11.5px var(--f-mono); color: var(--ink-3); text-transform: uppercase; letter-spacing: .06em; }
.editor .cartao-sim .pergunta { font-family: var(--f-display); font-weight: 700; font-size: 18px; line-height: 1.2; text-wrap: balance; }
.editor .cartao-sim .opcoes { display: grid; gap: 6px; }
.editor .cartao-sim .opcao { display: flex; gap: 10px; align-items: center; text-align: left; border: 1px solid var(--line); background: var(--node); border-radius: 10px; padding: 8px 10px; cursor: pointer; }
.editor .cartao-sim .opcao:hover { border-color: var(--agua, var(--accent)); }
.editor .cartao-sim .opcao .tecla { min-width: 24px; height: 24px; border-radius: 7px; background: var(--tile); display: grid; place-items: center; font: 600 12px var(--f-mono); }
.editor .cartao-sim .opcao small { display: block; color: var(--ink-3); font-size: 11.5px; }
.editor .cartao-sim .controles { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.editor .cartao-sim .controles .bi { width: 32px; height: 32px; }
.editor .cartao-sim .vel { display: flex; gap: 2px; padding: 2px; border: 1px solid var(--line); border-radius: 9px; }
.editor .cartao-sim .vel button { border: 0; background: none; border-radius: 7px; padding: 4px 8px; font: 600 11.5px var(--f-mono); cursor: pointer; color: var(--ink-2); }
.editor .cartao-sim .vel button[aria-pressed="true"] { background: var(--btn); color: var(--btn-ink); }
.editor .numeros { display: flex; gap: 6px 16px; flex-wrap: wrap; font-size: 12.5px; color: var(--ink-2); }
.editor .numeros b { font: 600 16px var(--f-mono); color: var(--ink); margin-right: 4px; font-variant-numeric: tabular-nums; }
.editor .linha-tempo { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 12.5px; max-height: 140px; overflow: auto; }
.editor .linha-tempo li { display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 8px; }
.editor .linha-tempo time { font: 500 11.5px var(--f-mono); color: var(--ink-3); font-variant-numeric: tabular-nums; }
.editor details.det summary { cursor: pointer; font: 600 11px var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }

/* Painel */
.editor .painel { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; overflow: hidden; }
.editor .abas { display: flex; gap: 2px; padding: 6px 10px 0; border-bottom: 1px solid var(--line); }
.editor .aba { border: 0; background: none; padding: 9px 10px; font-weight: 600; font-size: 13px; color: var(--ink-3); border-bottom: 2px solid transparent; cursor: pointer; }
.editor .aba[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--ink); }
.editor .conteudo { overflow: auto; padding: 14px 16px 22px; display: grid; gap: 14px; align-content: start; }
.editor .rotulo-secao { font: 600 10.5px var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.editor .campo { display: grid; gap: 5px; font-size: 12.5px; color: var(--ink-2); }
.editor .campo input[type="text"], .editor .campo input[type="number"], .editor .campo select, .editor .campo textarea { width: 100%; padding: 8px 10px; border-radius: 9px; border: 1px solid var(--line); background: var(--node); font-size: 13.5px; color: var(--ink); }
.editor .campo textarea { min-height: 70px; resize: vertical; }
.editor .linha { display: flex; gap: 8px; align-items: center; }
.editor .linha > * { min-width: 0; }
.editor .cores { display: flex; gap: 6px; flex-wrap: wrap; }
.editor .cor { width: 26px; height: 26px; border-radius: 8px; border: 2px solid transparent; cursor: pointer; padding: 0; background: var(--c); box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); }
.editor .cor[aria-pressed="true"] { border-color: var(--ink); }
.editor .interruptor { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 13px; color: var(--ink); }
.editor .interruptor input { width: 38px; height: 22px; appearance: none; border-radius: 999px; background: var(--line); position: relative; cursor: pointer; flex: none; transition: background .2s; }
.editor .interruptor input::after { content: ''; position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--node); transition: transform .2s; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
.editor .interruptor input:checked { background: var(--accent); }
.editor .interruptor input:checked::after { transform: translateX(16px); }
.editor .segmentado { display: flex; gap: 2px; padding: 2px; border: 1px solid var(--line); border-radius: 10px; background: var(--node); }
.editor .segmentado button { flex: 1; border: 0; background: none; border-radius: 8px; padding: 6px 6px; font-size: 12.5px; cursor: pointer; color: var(--ink-2); }
.editor .segmentado button[aria-pressed="true"] { background: var(--btn); color: var(--btn-ink); }
.editor input[type="range"] { width: 100%; accent-color: var(--accent); }
.editor .canal-cor { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; font-size: 13px; }
.editor .canal-cor input[type="color"] { width: 38px; height: 28px; border: 1px solid var(--line); border-radius: 8px; background: var(--node); padding: 2px; cursor: pointer; }
.editor .dica { font-size: 12px; color: var(--ink-3); margin: 0; }
.editor .cad { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 7px 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--node); }
.editor .cad .tipo { font: 600 10px var(--f-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); padding: 2px 6px; border-radius: 5px; background: var(--tile); }
.editor .cad input { border: 0; background: none; font-weight: 600; font-size: 13px; min-width: 0; padding: 2px; border-radius: 5px; }
.editor .cad input:focus { background: var(--tile); }
.editor .cad small { color: var(--ink-3); font-size: 11.5px; white-space: nowrap; }
.editor .lista { display: grid; gap: 6px; }
.editor .selo-ex { font: 600 10px var(--f-mono); letter-spacing: .06em; text-transform: uppercase; padding: 3px 7px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); }
.editor .aviso { position: fixed; left: 50%; top: 70px; transform: translateX(-50%); background: var(--btn); color: var(--btn-ink); padding: 8px 14px; border-radius: 10px; font-size: 13px; z-index: 80; box-shadow: var(--shadow); pointer-events: none; transition: opacity .2s; }
.editor .so-celular { display: none; }

@media (max-width: 820px) {
  .editor .area { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  .editor .ferramentas { flex-direction: row; overflow-x: auto; order: 2; }
  .editor .ferramentas .sep { width: 1px; height: auto; margin: 2px 4px; }
  .editor .ferr .dica-ferr { display: none; }
  .editor .painel { position: fixed; left: max(8px, env(safe-area-inset-left, 0px)); right: max(8px, env(safe-area-inset-right, 0px)); bottom: calc(8px + env(safe-area-inset-bottom, 0px)); height: 62%; z-index: 50; box-shadow: var(--shadow); }
  .editor .painel.fechado { display: none; }
  .editor .so-celular { display: inline-flex; }
  .editor .topo { gap: 8px; }
  .editor .nome-fluxo { flex-basis: 140px; }
  .editor .empurra { margin-left: 0; width: 100%; }
  .editor .empurra .botao { padding: 6px 9px; font-size: 12.5px; }
  .editor .b-play { margin-left: auto; }
  .editor .atalhos { display: none; }
  .editor .salvo { display: none; }
}
/* Só leitura (outra pessoa editando), conflito e avisos do salvamento. */
.editor .faixa { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 8px 12px; border-radius: 10px; font-size: 13px; background: var(--info-soft); color: var(--info); }
.editor .faixa.erro { background: var(--bad-soft); color: var(--bad); }
.editor .salvo.erro { color: var(--bad); }
.editor .cabeca-editor { display: grid; gap: 8px; }

/* Responsável: busca nos cadastros, com "criar" no fim. */
.editor .combo { position: relative; }
.editor .combo > .dica { margin-top: 5px; }
.editor .sugestoes { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 20; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow); padding: 4px; display: grid; gap: 2px; max-height: 240px; overflow: auto; }
.editor .sugestoes button { display: flex; justify-content: space-between; gap: 8px; align-items: center; border: 0; background: none; border-radius: 7px; padding: 6px 8px; text-align: left; cursor: pointer; font-size: 13px; color: var(--ink); }
.editor .sugestoes button[aria-selected="true"], .editor .sugestoes button:hover { background: var(--tile); }
.editor .sugestoes small { color: var(--ink-3); font: 500 10.5px var(--f-mono); text-transform: uppercase; letter-spacing: .04em; }

/* Cartão do play: hora simulada e se o relógio decide. */
.editor .cartao-sim .quando { display: flex; gap: 8px 12px; flex-wrap: wrap; align-items: center; font-size: 12.5px; color: var(--ink-2); }
.editor .cartao-sim .quando input[type="datetime-local"] { padding: 4px 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--node); font-size: 12.5px; }
.editor .cartao-sim .quando label { display: inline-flex; gap: 6px; align-items: center; }

/* Teclado: peças, notas e rótulos entram no Tab; o + aparece quando tem o foco. */
.editor .no:focus-visible, .editor .rotulo-cano:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.editor .no .mais:focus-visible { opacity: 1; outline: 2px solid var(--accent); outline-offset: 2px; }
/* A região viva das faixas fica montada mesmo vazia; vazia, não abre o espaço do gap. */
.editor .cabeca-editor > .vivo { display: grid; gap: 8px; }
.editor .cabeca-editor > .vivo:empty { margin-bottom: -8px; }
.editor .grupo:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
```

- [ ] **Passo 2: peças, notas, grupos e o rótulo do cano**

`apps/web/src/componentes/editor/Pecas.tsx`:

```tsx
'use client';

import { memo } from 'react';
import { formatarTempo, textoRegra, type Conexao, type Grupo, type Nota, type Peca } from '@journey/fluxo';
import { Icone } from '@/componentes/Icone';
import { FORMAS } from '@/editor/pecas';

/**
 * Tudo em valores simples (nada de objeto montado a cada desenho), senão o `memo` nunca segura nada. A simulação
 * marca a peça como molhada (`agua`, a cor), a atual, perguntando e em foco no holofote.
 */
export interface PropsPeca {
  peca: Peca;
  selecionada: boolean;
  /** Nome do responsável (o cadastro), se há. */
  responsavel?: string;
  canalNome?: string;
  canalCor?: string;
  /** Cor do Início: a do canal em que a água começa. */
  corInicio: string;
  agua?: string;
  atual?: boolean;
  perguntando?: boolean;
  foco?: boolean;
  /** Só leitura: sem a bolinha de ligar e sem o +. */
  soLeitura: boolean;
}

/**
 * Uma peça no quadro. Memorizada: arrastar uma peça não redesenha as outras. Dá pra chegar nela pelo Tab; o teclado
 * e o clique sem ponteiro (leitor de tela) são tratados no quadro.
 */
export const PecaNoQuadro = memo(function PecaNoQuadro({ peca: p, selecionada, responsavel, canalNome, canalCor, corInicio, agua, atual, perguntando, foco, soLeitura }: PropsPeca) {
  const f = FORMAS[p.tipo];
  const classes = ['no', `t-${p.tipo}`];
  if (selecionada) classes.push('sel');
  if (p.cor && p.tipo !== 'decisao') classes.push('com-cor');
  if (agua) classes.push('molhado');
  if (atual) classes.push('atual');
  if (perguntando) classes.push('perguntando');
  if (foco) classes.push('foco');
  const estilo: Record<string, string | number> = { left: p.x, top: p.y, width: f.w, height: f.h };
  if (p.tipo === 'inicio') estilo['--c'] = corInicio;
  if (p.cor && p.tipo !== 'decisao') estilo['--pc'] = p.cor;
  if (agua) estilo['--agua'] = agua;
  const sub = [responsavel ?? f.nome, p.tempo_s ? formatarTempo(p.tempo_s) : null].filter(Boolean).join(' · ');
  return (
    <div className={classes.join(' ')} data-peca={p.id} style={estilo} role="button" tabIndex={0} aria-label={`${f.nome}: ${p.nome}`} aria-pressed={selecionada}>
      {p.tipo !== 'decisao' && (
        <span className="etiqueta">
          {f.nome.toLowerCase()}
          {canalNome ? ` · ${canalNome.toLowerCase()}` : ''}
        </span>
      )}
      <span className="nivel" />
      <span className="tile">
        <Icone nome={p.tipo} />
      </span>
      <span className="textos">
        <span className="titulo">{p.nome}</span>
        <span className="sub">
          {canalNome && <span className="ponto-canal" style={{ ['--c' as string]: canalCor }} />}
          <span>{sub}</span>
        </span>
      </span>
      {!soLeitura && (
        <>
          <span className="ponta" data-ponta={p.id} title="Arraste pra ligar" />
          {/* Só entra no Tab com a peça selecionada (fora disso ele nem aparece). */}
          <button className="mais" type="button" data-mais={p.id} tabIndex={selecionada ? 0 : -1} aria-label={`Criar a próxima etapa ligada a ${p.nome}`}>
            <Icone nome="mais" />
          </button>
        </>
      )}
    </div>
  );
});

export const NotaNoQuadro = memo(function NotaNoQuadro({ nota: n, selecionada }: { nota: Nota; selecionada: boolean }) {
  const estilo: Record<string, string | number> = { left: n.x, top: n.y, width: n.w, height: n.h };
  if (n.cor) estilo['--pc'] = n.cor;
  return (
    <div className={`no t-nota${n.cor ? ' com-cor' : ''}${selecionada ? ' sel' : ''}`} data-nota={n.id} style={estilo} role="button" tabIndex={0} aria-label={`Nota: ${n.texto}`} aria-pressed={selecionada}>
      <span className="textos">
        <span className="titulo">{n.texto}</span>
      </span>
    </div>
  );
});

export const GrupoNoQuadro = memo(function GrupoNoQuadro({ grupo: g, selecionado }: { grupo: Grupo; selecionado: boolean }) {
  return (
    <div
      className={`grupo${selecionado ? ' sel' : ''}`}
      data-grupo={g.id}
      style={{ left: g.x, top: g.y, width: g.w, height: g.h, ...(g.cor && { ['--gc' as string]: g.cor }) }}
      // No Tab como as peças: Enter ou espaço seleciona, Enter no selecionado renomeia (tratado no quadro).
      role="button"
      tabIndex={0}
      aria-label={`Grupo: ${g.nome}`}
      aria-pressed={selecionado}
    >
      <span className="g-titulo">{g.nome}</span>
      <span className="alca" data-alca={g.id} />
    </div>
  );
});

/** O texto no meio do cano. Na pergunta do play, os das opções viram botão. */
export const RotuloCano = memo(function RotuloCano({
  conexao: c,
  x,
  y,
  selecionado,
  escolhivel,
  corAgua,
}: {
  conexao: Conexao;
  x: number;
  y: number;
  selecionado: boolean;
  escolhivel: boolean;
  corAgua?: string;
}) {
  const t = textoRegra(c);
  if (!t) return null;
  return (
    <div
      className={`rotulo-cano${selecionado ? ' sel' : ''}${escolhivel ? ' escolhivel foco' : ''}`}
      data-rotulo={c.id}
      style={{ left: x, top: y, ...(escolhivel && corAgua && { ['--agua' as string]: corAgua }) }}
      role="button"
      tabIndex={0}
      aria-label={escolhivel ? `Escolher ${t}` : `Ligação: ${t}`}
    >
      {t}
    </div>
  );
});
```

- [ ] **Passo 3: a água**

`apps/web/src/componentes/editor/Agua.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { duracaoCano } from '@/editor/play';
import type { Estilo } from '@/editor/estilo';

/** Largura da água dentro do cano (o desenho "cano" tem parede; "linha" e "tracejado" não). */
export const larguraAgua = (e: Estilo): number => (e.cano === 'cano' ? Math.max(2, e.espessura - 4.5) : Math.max(2.2, e.espessura / 2.6));

/** Um cano já cheio: a água parada, com o brilho correndo se o estilo pede. */
export function AguaCheia({ d, cor, estilo }: { d: string; cor: string; estilo: Estilo }) {
  const w = larguraAgua(estilo);
  return (
    <g>
      <path className="agua-trilho" d={d} strokeWidth={w} style={{ stroke: cor }} />
      {estilo.brilho && <path className="agua-brilho" d={d} strokeWidth={Math.max(1, w / 3)} />}
    </g>
  );
}

/**
 * A água correndo num cano, quadro a quadro (requestAnimationFrame), com as bolhas na frente.
 * Pausada, o tempo não conta. Sem movimento (preferência do sistema), chega na hora. No fim, avisa.
 */
export function AguaCorrendo({ d, cor, estilo, pausado, aoChegar }: { d: string; cor: string; estilo: Estilo; pausado: boolean; aoChegar: () => void }) {
  const agua = useRef<SVGPathElement>(null);
  const bolhas = useRef<(SVGCircleElement | null)[]>([]);
  // Quanto do cano já tem água (0 a 1), não o tempo gasto: trocar a velocidade no meio não faz a água pular.
  const feito = useRef(0);
  const pausa = useRef(pausado);
  pausa.current = pausado;
  const chegar = useRef(aoChegar);
  chegar.current = aoChegar;
  const w = larguraAgua(estilo);

  useEffect(() => {
    const p = agua.current;
    if (!p) return;
    const L = p.getTotalLength();
    const dur = duracaoCano(L, estilo.velocidade);
    const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
    p.style.strokeDasharray = `${L} ${L}`;
    let ultimo = performance.now();
    let raf = 0;
    let fim = false;
    const quadro = (t: number) => {
      if (!pausa.current) feito.current = Math.min(1, feito.current + Math.max(0, t - ultimo) / dur);
      ultimo = t;
      const prog = semMovimento ? 1 : feito.current;
      p.style.strokeDashoffset = String(L * (1 - prog));
      const cabeca = L * prog;
      bolhas.current.forEach((b, i) => {
        if (!b) return;
        const pos = cabeca - i * 9 - (i ? Math.sin(t / 120 + i) * 3 : 0);
        if (prog >= 1 || pos < 0) return b.setAttribute('opacity', '0');
        const pt = p.getPointAtLength(Math.max(0, pos));
        b.setAttribute('cx', String(pt.x));
        b.setAttribute('cy', String(pt.y + (i % 2 ? 1.5 : -1.5)));
        b.setAttribute('opacity', '1');
      });
      if (prog < 1) raf = requestAnimationFrame(quadro);
      else if (!fim) {
        fim = true;
        chegar.current();
      }
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
    // O desenho do cano (estilo) ou a velocidade podem mudar no meio: recomeça a conta do comprimento e da duração,
    // não do quanto já andou.
  }, [d, estilo.velocidade]);

  return (
    <g>
      <path ref={agua} className="agua-trilho" d={d} strokeWidth={w} style={{ stroke: cor, strokeDashoffset: 99999 }} />
      {estilo.bolhas &&
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            ref={(el) => {
              bolhas.current[i] = el;
            }}
            className="bolha"
            r={Math.max(1.2, w / (4 + i))}
            opacity={0}
          />
        ))}
    </g>
  );
}
```

- [ ] **Passo 4: o quadro** (vista, zoom, gestos, canos, menu de formas, campo de nome)

`apps/web/src/componentes/editor/Quadro.tsx`:

```tsx
'use client';

import { memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Documento, TipoPeca } from '@journey/fluxo';
import { Icone } from '@/componentes/Icone';
import { conteudoDoGrupo, moverGrupoEm, moverNota, moverPeca, redimensionarGrupo, type Selecao } from '@/editor/documento';
import { corDoCanal, type CanalEditor, type Estilo } from '@/editor/estilo';
import { ancora, caminho, envolvente, geometriaCano } from '@/editor/geometria';
import { FORMAS, caixaDe } from '@/editor/pecas';
import type { Visual } from '@/editor/play';
import { AguaCheia, AguaCorrendo } from './Agua';
import { GrupoNoQuadro, NotaNoQuadro, PecaNoQuadro, RotuloCano } from './Pecas';

export type Ferramenta = 'selecionar' | 'mao' | TipoPeca | 'grupo' | 'nota';
export const criaAlgo = (f: Ferramenta): f is TipoPeca | 'grupo' | 'nota' => f !== 'selecionar' && f !== 'mao';

interface Vista {
  x: number;
  y: number;
  k: number;
}

/** O que o editor pede ao quadro: enquadrar, converter coordenadas, o meio da tela, encerrar um arrasto. */
export interface QuadroApi {
  enquadrar(ids: string[] | null, animar?: boolean): void;
  paraMundo(cx: number, cy: number): { x: number; y: number };
  contem(cx: number, cy: number): boolean;
  /** O meio da parte visível do quadro, em coordenadas do mundo. */
  centro(): { x: number; y: number };
  /**
   * Termina o gesto em andamento onde está (sem ligar nem abrir menu). Desfazer ou apagar no meio de um arrasto
   * encerra o arrasto: senão o quadro seguinte reaplicaria a posição em cima do que acabou de ser desfeito.
   */
  encerrarGesto(): void;
}

/** O que o quadro pede ao editor. Mexer no documento é sempre pelo editor (histórico e salvamento). */
export interface AcoesQuadro {
  selecionar(s: Selecao): void;
  criar(f: TipoPeca | 'grupo' | 'nota', x: number, y: number): void;
  criarLigada(origem: string, tipo: TipoPeca, onde?: { x: number; y: number }): void;
  ligar(de: string, para: string): void;
  /**
   * Um quadro de arrasto, como função do documento de AGORA (não de uma cópia do começo do arrasto): o que chega no
   * meio (um responsável vindo do servidor) não some no quadro seguinte. O primeiro entra no histórico, os seguintes
   * substituem.
   */
  mudar(f: (d: Documento) => Documento, primeiro: boolean): void;
  renomear(id: string | null): void;
  gravarNome(id: string, texto: string): void;
  escolher(conexao: string): void;
  usarFerramenta(f: Ferramenta): void;
}

export interface PropsQuadro {
  doc: Documento;
  estilo: Estilo;
  canais: readonly CanalEditor[];
  canalFluxo: string | null;
  nomesCadastros: ReadonlyMap<string, string>;
  sel: Selecao;
  ferramenta: Ferramenta;
  soLeitura: boolean;
  play: Visual | null;
  pausado: boolean;
  aoAguaChegar: () => void;
  renomeando: string | null;
  acoes: AcoesQuadro;
  ref?: React.Ref<QuadroApi>;
  children?: React.ReactNode;
}

/**
 * Um gesto é de um ponteiro só (`ponteiro`): um segundo dedo não mexe no arrasto do primeiro. Cada quadro é aplicado
 * no documento de agora; o grupo guarda só as posições de partida (`inicio`, tirado no primeiro movimento de verdade,
 * depois do texto do painel que grava ao perder o foco), pra o arredondamento na grade não acumular erro.
 */
type Gesto = { ponteiro: number } & (
  | { tipo: 'pan'; x0: number; y0: number; vx: number; vy: number }
  | { tipo: 'ligar'; de: string }
  | { tipo: 'mover'; qual: 'peca' | 'nota'; id: string; dx: number; dy: number; x0: number; y0: number; moveu: boolean }
  | { tipo: 'grupo'; id: string; wx: number; wy: number; inicio: Documento | null; levar: { pecas: string[]; notas: string[] } | null }
  | { tipo: 'redim'; id: string; moveu: boolean }
);

interface Menu {
  x: number;
  y: number;
  titulo: string;
  aoEscolher: (t: TipoPeca) => void;
}

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.5;
const limitar = (v: number, m: number) => Math.max(-m, Math.min(m, v));

export function Quadro({ doc, estilo, canais, canalFluxo, nomesCadastros, sel, ferramenta, soLeitura, play, pausado, aoAguaChegar, renomeando, acoes, ref, children }: PropsQuadro) {
  const palco = useRef<HTMLElement>(null);
  const [vista, setVista] = useState<Vista>({ x: 120, y: 260, k: 1 });
  const vistaRef = useRef(vista);
  vistaRef.current = vista;
  const gesto = useRef<Gesto | null>(null);
  const [temp, setTemp] = useState<{ d: string; alvo: string | null } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [arrastandoQuadro, setArrastandoQuadro] = useState(false);
  const raf = useRef(0);
  const docRef = useRef(doc);
  docRef.current = doc;

  const paraMundo = (cx: number, cy: number) => {
    const r = palco.current!.getBoundingClientRect();
    const v = vistaRef.current;
    return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k };
  };

  /** Zoom em volta de um ponto da tela. Funcional: vários eventos de roda no mesmo quadro se somam. */
  const zoomEm = (k: (atual: number) => number, cx: number, cy: number) => {
    const r = palco.current!.getBoundingClientRect();
    const px = cx - r.left;
    const py = cy - r.top;
    // A pessoa pegou a câmera: a animação (enquadrar, seguir a água) para aqui.
    cancelAnimationFrame(raf.current);
    setVista((v) => {
      const kk = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k(v.k)));
      return { x: px - ((px - v.x) * kk) / v.k, y: py - ((py - v.y) * kk) / v.k, k: kk };
    });
  };

  const animar = (alvo: Vista, comMovimento: boolean) => {
    cancelAnimationFrame(raf.current);
    if (!comMovimento || matchMedia('(prefers-reduced-motion: reduce)').matches) return setVista(alvo);
    const de = vistaRef.current;
    const t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / 520);
      const e = 1 - Math.pow(1 - p, 3);
      setVista({ x: de.x + (alvo.x - de.x) * e, y: de.y + (alvo.y - de.y) * e, k: de.k + (alvo.k - de.k) * e });
      if (p < 1) raf.current = requestAnimationFrame(passo);
    };
    raf.current = requestAnimationFrame(passo);
  };

  /** Na simulação a câmera chega perto (a peça e pra onde ela leva); no "ver tudo", o fluxo inteiro. */
  const enquadrar = (ids: string[] | null, comMovimento = true) => {
    const el = palco.current;
    if (!el) return;
    const d = docRef.current;
    const caixas = ids ? d.pecas.filter((p) => ids.includes(p.id)).map(caixaDe) : [...d.pecas.map(caixaDe), ...d.grupos, ...d.notas];
    const c = envolvente(caixas);
    const W = el.clientWidth;
    const H = el.clientHeight;
    if (!c) return animar({ x: W / 2, y: H / 2, k: 1 }, comMovimento);
    const m = 70;
    const k = ids ? Math.min(1.05, (W - m * 2) / (c.w || 1), (H - m * 2 - 200) / (c.h || 1)) : Math.min(1.2, (W - m * 2) / (c.w || 1), (H - m * 2) / (c.h || 1));
    const kk = Math.max(ids ? 0.55 : 0.25, k);
    animar({ k: kk, x: W / 2 - (c.x + c.w / 2) * kk, y: (ids ? H / 2 - 70 : H / 2) - (c.y + c.h / 2) * kk }, comMovimento);
  };

  const abrirMenu = (cx: number, cy: number, titulo: string, aoEscolher: (t: TipoPeca) => void) => {
    const r = palco.current!.getBoundingClientRect();
    setMenu({ x: Math.max(8, Math.min(cx - r.left, r.width - 270)), y: Math.max(8, Math.min(cy - r.top, r.height - 220)), titulo, aoEscolher });
  };

  useImperativeHandle(ref, () => ({
    enquadrar,
    paraMundo,
    contem: (cx, cy) => {
      const r = palco.current?.getBoundingClientRect();
      return !!r && cx > r.left && cx < r.right && cy > r.top && cy < r.bottom;
    },
    centro: () => paraMundo(...centroTela(palco.current)),
    encerrarGesto: () => cancelar(),
  }));

  // Começa mostrando o fluxo inteiro.
  useEffect(() => {
    enquadrar(null, false);
    return () => cancelAnimationFrame(raf.current);
    // Só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Roda: com Ctrl (ou pinça), zoom; sem, anda. Precisa ser não passivo pra segurar a rolagem da página.
  useEffect(() => {
    const el = palco.current!;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      // Em linhas ou páginas (Firefox), vira pixels. O zoom é limitado por evento: um dente da roda (100 px) não
      // pode dividir o zoom por 2,7; na pinça os passos são pequenos e nem chegam no limite.
      const escala = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dx = e.deltaX * escala;
      const dy = e.deltaY * escala;
      if (e.ctrlKey || e.metaKey) return zoomEm((k) => k * Math.exp(-limitar(dy, 25) * 0.01), e.clientX, e.clientY);
      cancelAnimationFrame(raf.current);
      setVista((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aoApertar = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    // Outro ponteiro já está num gesto (o segundo dedo): fica de fora.
    if (gesto.current && gesto.current.ponteiro !== e.pointerId) return;
    // Um campo do painel com texto ainda não gravado grava agora, contra a seleção de antes. Senão o navegador só
    // tira o foco depois deste pointerdown, com a outra peça já selecionada (e o arrasto já partindo sem o texto).
    const ativo = document.activeElement;
    if (ativo instanceof HTMLElement && ativo.closest('.painel')) ativo.blur();
    if (fim(e.target, '.zoom, .cartao-sim, .menu-rapido, .renomear')) return;
    setMenu(null);
    const w = paraMundo(e.clientX, e.clientY);
    const ponta = fim(e.target, '[data-ponta]');
    const mais = fim(e.target, '[data-mais]');
    const pecaEl = fim(e.target, '[data-peca]');
    const notaEl = fim(e.target, '[data-nota]');
    const rot = fim(e.target, '[data-rotulo]');
    const alvo = fim(e.target, '[data-alvo]');
    const alca = fim(e.target, '[data-alca]');
    const grupoEl = fim(e.target, '[data-grupo]');
    const ponteiro = e.pointerId;
    const capturar = () => palco.current!.setPointerCapture(ponteiro);
    const pan = () => {
      cancelAnimationFrame(raf.current);
      gesto.current = { ponteiro, tipo: 'pan', x0: e.clientX, y0: e.clientY, vx: vistaRef.current.x, vy: vistaRef.current.y };
      setArrastandoQuadro(true);
      capturar();
    };
    if (e.button === 1) {
      e.preventDefault(); // sem a rolagem automática do botão do meio
      return pan();
    }
    if (ferramenta === 'mao') return pan();
    if (play && rot?.classList.contains('escolhivel')) return acoes.escolher(rot.dataset.rotulo!);
    if (mais && !soLeitura) {
      e.preventDefault();
      const id = mais.dataset.mais!;
      const r = mais.getBoundingClientRect();
      return abrirMenu(r.right + 6, r.top - 8, 'Próxima peça', (t) => acoes.criarLigada(id, t));
    }
    if (ponta && !soLeitura) {
      e.preventDefault();
      gesto.current = { ponteiro, tipo: 'ligar', de: ponta.dataset.ponta! };
      capturar();
      return moverLigacao(e.clientX, e.clientY);
    }
    if (criaAlgo(ferramenta) && !pecaEl && !notaEl && !soLeitura) {
      e.preventDefault(); // sem isso o navegador tira o foco do campo de nome logo depois
      acoes.criar(ferramenta, w.x, w.y);
      return acoes.usarFerramenta('selecionar');
    }
    if (pecaEl || notaEl) {
      const qual = pecaEl ? 'peca' : 'nota';
      const id = (pecaEl ?? notaEl)!.dataset[qual]!;
      if (!(sel?.tipo === qual && sel.id === id)) acoes.selecionar({ tipo: qual, id });
      if (play || soLeitura) return;
      const item = qual === 'peca' ? doc.pecas.find((p) => p.id === id)! : doc.notas.find((n) => n.id === id)!;
      gesto.current = { ponteiro, tipo: 'mover', qual, id, dx: w.x - item.x, dy: w.y - item.y, x0: e.clientX, y0: e.clientY, moveu: false };
      return capturar();
    }
    if (rot || alvo) return acoes.selecionar({ tipo: 'conexao', id: (rot ?? alvo)!.dataset.rotulo ?? alvo!.dataset.alvo! });
    if (alca && !soLeitura && !play) {
      gesto.current = { ponteiro, tipo: 'redim', id: alca.dataset.alca!, moveu: false };
      return capturar();
    }
    if (grupoEl) {
      const id = grupoEl.dataset.grupo!;
      acoes.selecionar({ tipo: 'grupo', id });
      if (play || soLeitura) return;
      gesto.current = { ponteiro, tipo: 'grupo', id, wx: w.x, wy: w.y, inicio: null, levar: null };
      return capturar();
    }
    if (sel) acoes.selecionar(null);
    pan();
  };

  const moverLigacao = (cx: number, cy: number) => {
    const g = gesto.current;
    if (g?.tipo !== 'ligar') return;
    const a = docRef.current.pecas.find((p) => p.id === g.de);
    if (!a) return;
    const w = paraMundo(cx, cy);
    const sob = (document.elementFromPoint(cx, cy) as Element | null)?.closest('[data-peca]') as HTMLElement | null;
    const alvo = sob && sob.dataset.peca !== g.de ? sob.dataset.peca! : null;
    setTemp({ d: caminho(ancora(caixaDe(a), 'd'), { x: w.x, y: w.y, nx: -1, ny: 0 }, 'suave'), alvo });
  };

  /** Acaba o gesto sem ligar nem abrir menu (o sistema tomou o ponteiro, ou o botão já estava solto). */
  const cancelar = () => {
    gesto.current = null;
    setTemp(null);
    setArrastandoQuadro(false);
  };
  const doGesto = (e: React.PointerEvent) => gesto.current?.ponteiro === e.pointerId;

  const aoMover = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g || g.ponteiro !== e.pointerId) return;
    // O botão foi solto sem o pointerup chegar aqui (fora da janela, alerta do sistema): o gesto acabou.
    if (e.pointerType === 'mouse' && e.buttons === 0) return cancelar();
    const w = paraMundo(e.clientX, e.clientY);
    if (g.tipo === 'pan') return setVista((v) => ({ ...v, x: g.vx + e.clientX - g.x0, y: g.vy + e.clientY - g.y0 }));
    if (g.tipo === 'ligar') return moverLigacao(e.clientX, e.clientY);
    if (g.tipo === 'mover') {
      if (!g.moveu && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 4) return;
      const primeiro = !g.moveu;
      g.moveu = true;
      // Posição absoluta: aplicar no documento de agora não perde nada do que mudou no meio.
      const mover = g.qual === 'peca' ? moverPeca : moverNota;
      const [id, x, y] = [g.id, w.x - g.dx, w.y - g.dy];
      return acoes.mudar((d) => mover(d, id, x, y), primeiro);
    }
    if (g.tipo === 'grupo') {
      const dx = w.x - g.wx;
      const dy = w.y - g.wy;
      if (!g.inicio && Math.hypot(dx, dy) < 5) return;
      const primeiro = !g.inicio;
      const inicio = (g.inicio ??= docRef.current);
      const levar = (g.levar ??= conteudoDoGrupo(inicio, g.id));
      const id = g.id;
      return acoes.mudar((d) => moverGrupoEm(d, inicio, id, dx, dy, levar), primeiro);
    }
    if (g.tipo === 'redim') {
      const primeiro = !g.moveu;
      g.moveu = true;
      const [id, x, y] = [g.id, w.x, w.y];
      acoes.mudar((d) => {
        const gr = d.grupos.find((k) => k.id === id);
        return gr ? redimensionarGrupo(d, id, x - gr.x, y - gr.y) : d;
      }, primeiro);
    }
  };

  const aoSoltar = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g || g.ponteiro !== e.pointerId) return;
    gesto.current = null;
    setArrastandoQuadro(false);
    if (g.tipo !== 'ligar') return;
    setTemp(null);
    const sob = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-peca]') as HTMLElement | null;
    if (sob && sob.dataset.peca !== g.de) return acoes.ligar(g.de, sob.dataset.peca!);
    if (!sob) {
      const w = paraMundo(e.clientX, e.clientY);
      abrirMenu(e.clientX + 6, e.clientY - 8, 'Criar e ligar', (t) => acoes.criarLigada(g.de, t, w));
    }
  };

  const aoDoisCliques = (e: React.MouseEvent) => {
    // Com o ponteiro capturado pelo palco (o arrasto começa no primeiro clique), o evento chega no palco: o alvo de
    // verdade é o que está debaixo do mouse.
    const alvo = document.elementFromPoint(e.clientX, e.clientY);
    if (fim(alvo, '.zoom, .cartao-sim, .menu-rapido, .renomear') || play) return;
    const pecaEl = fim(alvo, '[data-peca]');
    const notaEl = fim(alvo, '[data-nota]');
    if (pecaEl || notaEl) return soLeitura ? undefined : acoes.renomear((pecaEl?.dataset.peca ?? notaEl?.dataset.nota)!);
    if (fim(alvo, '[data-grupo], [data-rotulo], [data-alvo]') || soLeitura) return;
    const w = paraMundo(e.clientX, e.clientY);
    abrirMenu(e.clientX + 4, e.clientY - 8, 'Criar aqui', (t) => acoes.criar(t, w.x, w.y));
  };

  /**
   * Peça, nota ou rótulo ativados sem ponteiro (teclado, leitor de tela): seleciona; Enter na já selecionada renomeia,
   * como os dois cliques. Na pergunta do play, o rótulo da opção escolhe.
   */
  const ativar = (el: HTMLElement, enter: boolean) => {
    const rotulo = el.dataset.rotulo;
    if (rotulo) return play && el.classList.contains('escolhivel') ? acoes.escolher(rotulo) : acoes.selecionar({ tipo: 'conexao', id: rotulo });
    const qual = el.dataset.peca ? 'peca' : el.dataset.nota ? 'nota' : 'grupo';
    const id = (el.dataset.peca ?? el.dataset.nota ?? el.dataset.grupo)!;
    if (!(sel?.tipo === qual && sel.id === id)) return acoes.selecionar({ tipo: qual, id });
    if (enter && !soLeitura && !play) acoes.renomear(id);
  };

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target as HTMLElement;
    // No + o Enter vira clique (abre o menu); não pode chegar no atalho de renomear do editor.
    if (el.dataset.mais) return e.stopPropagation();
    if (!el.matches('[data-peca], [data-nota], [data-grupo], [data-rotulo]')) return;
    e.preventDefault();
    e.stopPropagation();
    ativar(el, e.key === 'Enter');
  };

  /**
   * Foco pelo teclado (Tab) numa peça, nota, grupo ou rótulo fora da parte visível: anda o quadro até ele, sem mudar o
   * zoom. Só no foco de teclado (`:focus-visible`): o foco de um clique não pode mexer o quadro no meio de um arrasto.
   * Mede no quadro seguinte, depois que o onScroll devolveu o palco a (0, 0) (o navegador rola pra mostrar o foco).
   */
  const aoFocar = (e: React.FocusEvent) => {
    const el = e.target as HTMLElement;
    if (!el.matches('[data-peca], [data-nota], [data-grupo], [data-rotulo]') || !el.matches(':focus-visible')) return;
    requestAnimationFrame(() => {
      const p = palco.current;
      if (!p || !el.isConnected) return;
      const r = p.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const m = 40;
      if (b.left >= r.left + m && b.right <= r.right - m && b.top >= r.top + m && b.bottom <= r.bottom - m) return;
      const v = vistaRef.current;
      animar({ k: v.k, x: v.x + r.left + r.width / 2 - (b.left + b.width / 2), y: v.y + r.top + r.height / 2 - (b.top + b.height / 2) }, true);
    });
  };

  // Clique sem ponteiro (o leitor de tela ativando o botão, Enter no +): `detail` 0. O de mouse o pointerdown já tratou.
  const aoClicar = (e: React.MouseEvent) => {
    if (e.detail !== 0) return;
    const mais = fim(e.target, '[data-mais]');
    if (mais) {
      if (soLeitura || play) return;
      const id = mais.dataset.mais!;
      const r = mais.getBoundingClientRect();
      return abrirMenu(r.right + 6, r.top - 8, 'Próxima peça', (t) => acoes.criarLigada(id, t));
    }
    const alvo = fim(e.target, '[data-peca], [data-nota], [data-grupo], [data-rotulo]');
    if (alvo) ativar(alvo, false);
  };

  const cor = (canal: string | null | undefined) => corDoCanal(estilo, canais, canal ?? canalFluxo);
  const canalPrincipal = canais.find((c) => c.chave === canalFluxo);
  const semInicio = doc.pecas.length > 0 && !doc.pecas.some((p) => p.tipo === 'inicio');

  return (
    <section
      ref={palco}
      className={`palco${ferramenta === 'mao' ? ' mao' : ''}${arrastandoQuadro ? ' arrastando-quadro' : ''}${criaAlgo(ferramenta) ? ' criando' : ''}`}
      aria-label="Quadro do fluxo"
      style={{ backgroundSize: `${24 * vista.k}px ${24 * vista.k}px`, backgroundPosition: `${vista.x}px ${vista.y}px` }}
      onPointerDown={aoApertar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={(e) => doGesto(e) && cancelar()}
      onLostPointerCapture={(e) => doGesto(e) && cancelar()}
      onDoubleClick={aoDoisCliques}
      onKeyDown={aoTeclar}
      onClick={aoClicar}
      onFocus={aoFocar}
      // O palco tem overflow hidden, mas o navegador ainda rola ele pra mostrar um elemento com foco: volta pro lugar.
      onScroll={(e) => {
        e.currentTarget.scrollLeft = 0;
        e.currentTarget.scrollTop = 0;
      }}
      data-testid="quadro"
    >
      <div className="mundo" style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.k})` }}>
        <Mundo
          doc={doc}
          estilo={estilo}
          canais={canais}
          canalFluxo={canalFluxo}
          nomesCadastros={nomesCadastros}
          sel={sel}
          soLeitura={soLeitura}
          play={play}
          pausado={pausado}
          aoAguaChegar={aoAguaChegar}
          renomeando={renomeando}
          temp={temp}
          acoes={acoes}
        />
      </div>

      {doc.pecas.length === 0 && doc.notas.length === 0 && (
        <div className="vazio-quadro">
          <div>
            <b>Quadro em branco</b>
            <span>{soLeitura ? 'Este fluxo ainda não tem peças.' : 'Arraste uma forma da barra da esquerda, ou dê dois cliques aqui pra criar.'}</span>
          </div>
        </div>
      )}
      <div className="hud">
        <span className="pilula" style={{ ['--c' as string]: cor(canalFluxo) }} data-testid="canal-principal">
          <span className="ponto-cor" />
          {canalPrincipal?.nome ?? 'sem canal'}
        </span>
        <span className="pilula">
          {doc.pecas.length} peças · {doc.conexoes.length} ligações
        </span>
        {semInicio && <span className="pilula">sem Início: o play precisa de um</span>}
      </div>
      {!soLeitura && <div className="atalhos">Dois cliques no quadro cria · puxe a bolinha pra ligar · Del apaga · Ctrl+Z desfaz · Ctrl+roda dá zoom</div>}
      <div className="zoom">
        <button className="bi" type="button" aria-label="Diminuir zoom" onClick={() => zoomEm((k) => k / 1.2, ...centroTela(palco.current))}>
          <Icone nome="menos" />
        </button>
        <span>{Math.round(vista.k * 100)}%</span>
        <button className="bi" type="button" aria-label="Aumentar zoom" onClick={() => zoomEm((k) => k * 1.2, ...centroTela(palco.current))}>
          <Icone nome="mais" />
        </button>
        <button className="bi" type="button" aria-label="Ver o fluxo inteiro" title="Ver o fluxo inteiro" onClick={() => enquadrar(null)}>
          <Icone nome="enquadrar" />
        </button>
      </div>
      {menu && (
        <div className="menu-rapido" style={{ left: menu.x, top: menu.y }} role="menu" aria-label={menu.titulo} onPointerDown={(e) => e.stopPropagation()}>
          <div className="titulo-menu">{menu.titulo}</div>
          {(Object.keys(FORMAS) as TipoPeca[]).map((t, i) => (
            <button
              key={t}
              type="button"
              role="menuitem"
              autoFocus={i === 0}
              onClick={() => {
                setMenu(null);
                menu.aoEscolher(t);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return;
                // Fecha só o menu: o Esc do editor tiraria também a seleção.
                e.stopPropagation();
                setMenu(null);
              }}
            >
              <Icone nome={t} />
              {FORMAS[t].nome}
            </button>
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

const fim = (alvo: EventTarget | null, seletor: string) => (alvo as Element | null)?.closest?.(seletor) as HTMLElement | null;

interface PropsMundo {
  doc: Documento;
  estilo: Estilo;
  canais: readonly CanalEditor[];
  canalFluxo: string | null;
  nomesCadastros: ReadonlyMap<string, string>;
  sel: Selecao;
  soLeitura: boolean;
  play: Visual | null;
  pausado: boolean;
  aoAguaChegar: () => void;
  renomeando: string | null;
  temp: { d: string; alvo: string | null } | null;
  acoes: AcoesQuadro;
}

/**
 * O que está dentro do mundo (grupos, canos, peças, rótulos). Memorizado e sem a vista: andar e dar zoom só mudam o
 * transform do `.mundo`, sem redesenhar os canos a cada quadro.
 */
const Mundo = memo(function Mundo({ doc, estilo, canais, canalFluxo, nomesCadastros, sel, soLeitura, play, pausado, aoAguaChegar, renomeando, temp, acoes }: PropsMundo) {
  const pecas = useMemo(() => new Map(doc.pecas.map((p) => [p.id, p])), [doc.pecas]);
  const canos = useMemo(() => {
    // Ida e volta entre as mesmas peças: cada cano vai pra um lado, senão ficam um em cima do outro.
    const pares = new Set(doc.conexoes.map((c) => `${c.de}>${c.para}`));
    return doc.conexoes.flatMap((c) => {
      const a = pecas.get(c.de);
      const b = pecas.get(c.para);
      if (!a || !b) return [];
      const desvio = a.id !== b.id && pares.has(`${c.para}>${c.de}`) ? (c.de < c.para ? -9 : 9) : 0;
      return [{ c, geo: geometriaCano(caixaDe(a), caixaDe(b), estilo.curva, a.id === b.id, desvio) }];
    });
  }, [doc.conexoes, pecas, estilo.curva]);

  // A simulação: o que está molhado, a pergunta (holofote) e a água.
  const foco = new Set<string>();
  if (play?.pergunta) {
    foco.add(play.pergunta.peca);
    for (const o of play.pergunta.opcoes) foco.add(o.para);
  }
  const escolhiveis = new Set(play?.pergunta?.opcoes.map((o) => o.conexao) ?? []);
  const cor = (canal: string | null | undefined) => corDoCanal(estilo, canais, canal ?? canalFluxo);
  const esp = estilo.espessura;
  const marcador = (id: string, cor: string) => (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="6"
      refY="5"
      markerWidth={estilo.cano === 'cano' ? esp * 1.6 : 4.2}
      markerHeight={estilo.cano === 'cano' ? esp * 1.6 : 4.2}
      orient="auto-start-reverse"
      markerUnits={estilo.cano === 'cano' ? 'userSpaceOnUse' : 'strokeWidth'}
    >
      <path d="M0,0 L10,5 L0,10 z" style={{ fill: cor }} />
    </marker>
  );
  // O campo de nome por cima do que está sendo renomeado: peça (no título), nota (o texto todo) ou grupo (na etiqueta).
  const campo = ((): { id: string; valor: string; nota: boolean; rotulo: string; x: number; y: number; w: number; h: number | undefined } | null => {
    if (!renomeando) return null;
    const p = doc.pecas.find((x) => x.id === renomeando);
    if (p) return { id: p.id, valor: p.nome, nota: false, rotulo: 'Nome da peça', x: p.x, y: p.tipo === 'decisao' ? p.y + FORMAS.decisao.h / 2 - 18 : p.y + 2, w: FORMAS[p.tipo].w, h: undefined };
    const n = doc.notas.find((x) => x.id === renomeando);
    if (n) return { id: n.id, valor: n.texto, nota: true, rotulo: 'Texto da nota', x: n.x, y: n.y + 2, w: n.w, h: n.h };
    const g = doc.grupos.find((x) => x.id === renomeando);
    if (g) return { id: g.id, valor: g.nome, nota: false, rotulo: 'Nome do grupo', x: g.x + 10, y: g.y - 18, w: Math.max(140, Math.min(g.w - 20, 280)), h: undefined };
    return null;
  })();

  return (
    <>
      <div className="camada">
        {doc.grupos.map((g) => (
          <GrupoNoQuadro key={g.id} grupo={g} selecionado={sel?.tipo === 'grupo' && sel.id === g.id} />
        ))}
      </div>
      <svg className="canos" aria-hidden="true">
        <defs>
          {marcador('seta', 'var(--pipe-wall)')}
          {marcador('seta-sel', 'var(--accent)')}
        </defs>
        <g transform="translate(20000 20000)">
          {canos.map(({ c, geo }) => {
            const selecionado = sel?.tipo === 'conexao' && sel.id === c.id;
            const seta = `url(#${selecionado ? 'seta-sel' : 'seta'})`;
            return (
              <g key={c.id} className={`cano${selecionado ? ' sel' : ''}${escolhiveis.has(c.id) ? ' foco' : ''}`} data-cano={c.id}>
                {estilo.cano === 'cano' ? (
                  <>
                    <path className="parede" d={geo.d} strokeWidth={esp} markerEnd={seta} />
                    <path className="nucleo" d={geo.d} strokeWidth={Math.max(1, esp - 4)} />
                    <path className="reflexo" d={geo.d} strokeWidth={Math.max(0.6, esp / 6)} transform={`translate(0 ${-esp / 5})`} />
                  </>
                ) : (
                  <path className="linha" d={geo.d} strokeWidth={Math.max(1.4, esp / 3.2)} markerEnd={seta} strokeDasharray={estilo.cano === 'tracejado' ? `${esp * 0.9} ${esp * 0.7}` : undefined} />
                )}
                <path className="alvo" d={geo.d} data-alvo={c.id} />
              </g>
            );
          })}
          {temp && (
            <g className="cano temp">
              <path className="linha" d={temp.d} strokeWidth={2.5} />
            </g>
          )}
        </g>
        <g transform="translate(20000 20000)">
          {play &&
            canos.map(({ c, geo }) => {
              if (play.cheias.has(c.id)) return <AguaCheia key={c.id} d={geo.d} cor={cor(play.cheias.get(c.id))} estilo={estilo} />;
              if (play.correndo?.conexao === c.id)
                return <AguaCorrendo key={`${c.id}:correndo`} d={geo.d} cor={cor(play.correndo.canal)} estilo={estilo} pausado={pausado} aoChegar={aoAguaChegar} />;
              return null;
            })}
        </g>
      </svg>
      <div className="camada">
        {doc.notas.map((n) => (
          <NotaNoQuadro key={n.id} nota={n} selecionada={sel?.tipo === 'nota' && sel.id === n.id} />
        ))}
        {doc.pecas.map((p) => {
          const canal = p.canal ? canais.find((c) => c.chave === p.canal) : undefined;
          return (
            <PecaNoQuadro
              key={p.id}
              peca={p}
              selecionada={(sel?.tipo === 'peca' && sel.id === p.id) || temp?.alvo === p.id}
              {...(p.responsavel && nomesCadastros.has(p.responsavel) && { responsavel: nomesCadastros.get(p.responsavel)! })}
              {...(canal && { canalNome: canal.nome, canalCor: cor(canal.chave) })}
              corInicio={cor(p.canal)}
              {...(play && {
                ...(play.molhadas.has(p.id) && { agua: cor(play.molhadas.get(p.id)) }),
                atual: play.atual === p.id,
                perguntando: play.pergunta?.peca === p.id,
                foco: foco.has(p.id),
              })}
              soLeitura={soLeitura || !!play}
            />
          );
        })}
        {canos.map(({ c, geo }) => (
          <RotuloCano
            key={c.id}
            conexao={c}
            x={geo.meio.x}
            y={geo.meio.y}
            selecionado={sel?.tipo === 'conexao' && sel.id === c.id}
            escolhivel={escolhiveis.has(c.id)}
            {...(play && { corAgua: cor(play.canal) })}
          />
        ))}
        {campo && (
          <CampoNome
            key={campo.id}
            valor={campo.valor}
            nota={campo.nota}
            rotulo={campo.rotulo}
            x={campo.x}
            y={campo.y}
            w={campo.w}
            h={campo.h}
            aoTerminar={(texto) => (texto === null ? acoes.renomear(null) : acoes.gravarNome(campo.id, texto))}
          />
        )}
      </div>
    </>
  );
});

const centroTela = (el: HTMLElement | null): [number, number] => {
  const r = el?.getBoundingClientRect();
  return r ? [r.left + r.width / 2, r.top + r.height / 2] : [0, 0];
};

/** O campo de nome em cima da peça (ou o texto da nota). Enter grava, Esc desiste; sair do campo grava. */
function CampoNome({
  valor,
  nota,
  rotulo,
  x,
  y,
  w,
  h,
  aoTerminar,
}: {
  valor: string;
  nota: boolean;
  rotulo: string;
  x: number;
  y: number;
  w: number;
  h: number | undefined;
  aoTerminar: (texto: string | null) => void;
}) {
  const feito = useRef(false);
  const fim = (texto: string | null) => {
    if (feito.current) return;
    feito.current = true;
    aoTerminar(texto);
  };
  const props = {
    className: 'renomear',
    defaultValue: valor,
    autoFocus: true,
    'aria-label': rotulo,
    style: { left: x, top: y, width: w, height: h ?? 'auto' },
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.currentTarget.select(),
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => fim(e.currentTarget.value),
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !(nota && e.shiftKey)) {
        e.preventDefault();
        fim(e.currentTarget.value);
      }
      if (e.key === 'Escape') fim(null);
    },
  };
  return nota ? <textarea {...props} /> : <input type="text" {...props} />;
}
```

- [ ] **Passo 5: conferir**

Run: `npm run typecheck && cd apps/web && npx vitest run test/cliente-sem-exceljs.test.ts`
Expected: `tsc` sem saída; `Tests  27 passed (27)` (um por arquivo de `src/componentes`).

- [ ] **Passo 6: commit**

```bash
git add apps/web/src/componentes/editor
git commit -m "editor: o quadro (peças, canos, água, gestos)" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 8: o painel e o cartão do play

**Arquivos:**
- Criar: `apps/web/src/componentes/editor/Campos.tsx`, `Painel.tsx`, `CartaoPlay.tsx`

- [ ] **Passo 1: os campos** (texto que grava ao sair, tempo, cores, responsável)

`apps/web/src/componentes/editor/Campos.tsx`:

```tsx
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Cadastro, TipoPeca } from '@journey/fluxo';
import { buscar, comNome, tipoSugerido, type TipoCadastro } from '@/editor/cadastros';

/**
 * Grava, ao desmontar, o que foi digitado e não chegou a sair do campo (a seleção mudou com o foco aqui dentro). Usa
 * o `aoMudar` do último desenho deste campo: o da peça que ele mostrava, não o da que foi selecionada agora.
 */
function useGravaAoSair<T>(aoMudar: (v: T) => void) {
  const pendente = useRef<{ v: T } | null>(null);
  const ultimo = useRef(aoMudar);
  ultimo.current = aoMudar;
  useEffect(
    () => () => {
      // No modo estrito esta limpeza roda uma vez ao montar: aí não há nada pendente.
      const p = pendente.current;
      pendente.current = null;
      if (p) ultimo.current(p.v);
    },
    [],
  );
  return pendente;
}

/**
 * Campo de texto que grava ao sair (ou no Enter), como no protótipo: digitar não cria um passo no histórico por
 * letra. `key` por valor faz o campo voltar ao que está no documento depois de desfazer.
 */
export function CampoTexto({
  rotulo,
  valor,
  aoMudar,
  multilinha = false,
  placeholder,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  multilinha?: boolean;
  placeholder?: string;
}) {
  const pendente = useGravaAoSair(aoMudar);
  const props = {
    defaultValue: valor,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      pendente.current = e.currentTarget.value !== valor ? { v: e.currentTarget.value } : null;
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      pendente.current = null;
      if (e.currentTarget.value !== valor) aoMudar(e.currentTarget.value);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !multilinha) e.currentTarget.blur();
    },
  };
  return (
    <label className="campo">
      {rotulo}
      {multilinha ? <textarea key={valor} {...props} /> : <input key={valor} type="text" {...props} />}
    </label>
  );
}

const UNIDADES = { s: 1, min: 60, h: 3600, d: 86400 } as const;
type Unidade = keyof typeof UNIDADES;

/** Segundos em número + unidade, na maior unidade exata (7200 → 2 h). */
export function partesTempo(s: number | undefined): [number, Unidade] {
  const v = s ?? 0;
  if (v && v % 86400 === 0) return [v / 86400, 'd'];
  if (v && v % 3600 === 0) return [v / 3600, 'h'];
  if (v && v % 60 === 0) return [v / 60, 'min'];
  return [v, 's'];
}

/** Tempo em número e unidade. Zero (ou vazio) é sem tempo. */
export function CampoTempo({ rotulo, valor, aoMudar }: { rotulo: string; valor: number | undefined; aoMudar: (s: number | undefined) => void }) {
  const [n, u] = partesTempo(valor);
  const id = useId();
  const segundos = (num: string, uni: Unidade) => {
    const s = Math.round((parseFloat(num) || 0) * UNIDADES[uni]);
    return s > 0 ? s : undefined;
  };
  const pendente = useGravaAoSair(aoMudar);
  const ler = (form: HTMLElement) => {
    pendente.current = null;
    const num = (form.querySelector(`[data-n="${id}"]`) as HTMLInputElement).value;
    const uni = (form.querySelector(`[data-u="${id}"]`) as HTMLSelectElement).value as Unidade;
    const s = segundos(num, uni);
    if (s !== valor) aoMudar(s);
  };
  return (
    <label className="campo">
      {rotulo}
      <span className="linha" key={valor ?? 0}>
        <input
          type="number"
          min={0}
          step={1}
          data-n={id}
          defaultValue={n || ''}
          placeholder="0"
          style={{ flex: 1 }}
          aria-label={`${rotulo}: quantidade`}
          onChange={(e) => {
            const s = segundos(e.currentTarget.value, (e.currentTarget.nextElementSibling as HTMLSelectElement).value as Unidade);
            pendente.current = s !== valor ? { v: s } : null;
          }}
          onBlur={(e) => ler(e.currentTarget.parentElement!)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <select data-u={id} defaultValue={u} style={{ width: 90 }} aria-label={`${rotulo}: unidade`} onChange={(e) => ler(e.currentTarget.parentElement!)}>
          {Object.keys(UNIDADES).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export const PALETA = ['', '#dcecf8', '#ddf3e6', '#fbefd6', '#ece6fb', '#fbe4e2', '#e7eef1'];
export const PALETA_NOTA = ['', '#f6eaa8', '#dcecf8', '#ddf3e6', '#fbe4e2', '#ece6fb'];

export function Cores({ rotulo, atual, cores, aoMudar }: { rotulo: string; atual: string | undefined; cores: readonly string[]; aoMudar: (c: string | undefined) => void }) {
  return (
    <div className="campo">
      {rotulo}
      <div className="cores" role="group" aria-label={rotulo}>
        {cores.map((c) => (
          <button
            key={c || 'padrao'}
            type="button"
            className="cor"
            aria-pressed={(atual ?? '') === c}
            aria-label={c ? `Cor ${c}` : 'Cor padrão'}
            style={{ ['--c' as string]: c || 'var(--node)' }}
            onClick={() => aoMudar(c || undefined)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * O responsável de uma peça: busca nos cadastros da empresa; um nome que não existe vira cadastro novo (com o
 * tipo sugerido, que dá pra trocar) só no Enter ou no "Criar …": sair do campo com um nome que não existe volta ao
 * que estava (criar um cadastro da empresa sem querer é pior que redigitar). Vazio tira o responsável.
 */
export function Responsavel({
  rotulo,
  tipoPeca,
  atual,
  cadastros,
  tipos,
  aoEscolher,
  aoCriar,
}: {
  rotulo: string;
  tipoPeca: TipoPeca;
  atual: Cadastro | undefined;
  cadastros: readonly Cadastro[];
  tipos: readonly TipoCadastro[];
  aoEscolher: (id: string | undefined) => void;
  aoCriar: (tipo: string, nome: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState(atual?.nome ?? '');
  const [aberto, setAberto] = useState(false);
  // -1: nada destacado (o Enter num campo vazio não pega o primeiro cadastro da lista).
  const [destaque, setDestaque] = useState(-1);
  const [tipoNovo, setTipoNovo] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const lista = useId();
  const achados = buscar(cadastros, texto, 6);
  const exato = comNome(cadastros, texto);
  const podeCriar = texto.trim() !== '' && !exato;
  const tipo = tipoNovo ?? tipoSugerido(texto, tipoPeca, tipos);
  const nomeTipo = (k: string) => tipos.find((t) => t.chave === k)?.nome ?? k;
  const opcoes = [...achados.map((k) => ({ k })), ...(podeCriar ? [{ k: null }] : [])];
  const mostrar = aberto && opcoes.length > 0;
  const idOpcao = (i: number) => `${lista}-op-${i}`;

  const voltar = () => {
    setTexto(atual?.nome ?? '');
    setTipoNovo(null);
    setAberto(false);
    setDestaque(-1);
  };

  const escolher = async (i: number) => {
    const o = opcoes[i];
    setAberto(false);
    if (!o) return;
    if (o.k) {
      setTexto(o.k.nome);
      return aoEscolher(o.k.id);
    }
    setCriando(true);
    await aoCriar(tipo, texto.trim());
    setCriando(false);
  };

  /** Enter sem opção destacada: vazio tira, nome que existe vale, nome novo cria. */
  const confirmar = () => {
    const t = texto.trim();
    if (!t) return atual && aoEscolher(undefined);
    if (exato) {
      setTexto(exato.nome);
      return exato.id !== atual?.id && aoEscolher(exato.id);
    }
    void escolher(opcoes.length - 1);
  };

  /** Saiu do campo e da escolha do tipo: vazio tira, nome que existe vale, nome novo volta ao que estava. */
  const sair = () => {
    setAberto(false);
    if (criando) return;
    const t = texto.trim();
    if (t === (atual?.nome ?? '')) return;
    if (!t) return aoEscolher(undefined);
    if (exato) {
      setTexto(exato.nome);
      return exato.id !== atual?.id && aoEscolher(exato.id);
    }
    voltar();
  };

  return (
    <div
      className="campo"
      ref={caixa}
      onBlur={(e) => {
        // O foco foi pro tipo do cadastro novo (ou voltou dele pro campo): ainda está escolhendo.
        if (caixa.current?.contains(e.relatedTarget as Node | null)) return;
        sair();
      }}
    >
      <label htmlFor={`${lista}-campo`}>{rotulo}</label>
      <div className="combo">
        <input
          id={`${lista}-campo`}
          type="text"
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={mostrar ? lista : undefined}
          aria-activedescendant={mostrar && destaque >= 0 && destaque < opcoes.length ? idOpcao(destaque) : undefined}
          aria-autocomplete="list"
          value={texto}
          placeholder="Escreva: vira cadastro"
          disabled={criando}
          onChange={(e) => {
            setTexto(e.target.value);
            setAberto(true);
            setDestaque(e.target.value.trim() ? 0 : -1);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setAberto(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAberto(true);
              setDestaque((d) => Math.min(d + 1, opcoes.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setDestaque((d) => Math.max(d - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (mostrar && destaque >= 0 && opcoes[destaque]) void escolher(destaque);
              else confirmar();
            } else if (e.key === 'Escape') voltar();
          }}
        />
        {/* O tipo fica entre o campo e a lista: a lista aberta não cobre a escolha. */}
        {podeCriar && (
          <label className="linha dica">
            Novo cadastro do tipo
            <select value={tipo} onChange={(e) => setTipoNovo(e.target.value)} aria-label="Tipo do cadastro novo">
              {tipos.map((t) => (
                <option key={t.chave} value={t.chave}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        {mostrar && (
          <div className="sugestoes" id={lista} role="listbox" aria-label={rotulo}>
            {opcoes.map((o, i) => (
              <button
                key={o.k?.id ?? 'novo'}
                id={idOpcao(i)}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={i === destaque}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void escolher(i)}
              >
                {o.k ? (
                  <>
                    <span>{o.k.nome}</span>
                    <small>{nomeTipo(o.k.tipo)}</small>
                  </>
                ) : (
                  <>
                    <span>Criar “{texto.trim()}”</span>
                    <small>{nomeTipo(tipo)}</small>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Passo 2: o painel** (Propriedades, Estilo e animação, Cadastros)

`apps/web/src/componentes/editor/Painel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { NOMES_TIPOS, REGRAS, TIPOS_PECA, textoRegra, type Cadastro, type Conexao, type Documento, type Grupo, type Nota, type Peca, type Regra } from '@journey/fluxo';
import type { DadosDoFluxo } from '@/acoes/fluxos';
import { usosNoDocumento, type TipoCadastro } from '@/editor/cadastros';
import type { Selecao } from '@/editor/documento';
import { ESTILO_PADRAO, corDoCanal, type CanalEditor, type Estilo } from '@/editor/estilo';
import { FORMAS, ROTULO_RESPONSAVEL } from '@/editor/pecas';
import { CampoTempo, CampoTexto, Cores, PALETA, PALETA_NOTA, Responsavel } from './Campos';

export type Aba = 'prop' | 'estilo' | 'cad';

export interface AcoesPainel {
  mudarPeca(id: string, patch: Partial<Omit<Peca, 'id'>>): void;
  mudarConexao(id: string, patch: Partial<Omit<Conexao, 'id' | 'de' | 'para'>>): void;
  inverter(id: string): void;
  mudarGrupo(id: string, patch: Partial<Pick<Grupo, 'nome' | 'cor'>>): void;
  mudarNota(id: string, patch: Partial<Pick<Nota, 'texto' | 'cor'>>): void;
  apagar(): void;
  duplicar(id: string): void;
  selecionar(s: Selecao): void;
  mudarFluxo(d: DadosDoFluxo): void;
  apagarFluxo(): void;
  criarCadastro(tipo: string, nome: string): Promise<Cadastro | null>;
  renomearCadastro(id: string, nome: string): Promise<void>;
  verCadastro(id: string): void;
  mudarEstilo(e: Estilo): void;
}

export interface DadosFluxo {
  nome: string;
  descricao: string;
  canal: string | null;
  meta_s: number | null;
}

export interface PropsPainel {
  aba: Aba;
  setAba: (a: Aba) => void;
  aberto: boolean;
  doc: Documento;
  sel: Selecao;
  fluxo: DadosFluxo;
  estilo: Estilo;
  canais: readonly CanalEditor[];
  cadastros: readonly Cadastro[];
  tipos: readonly TipoCadastro[];
  soLeitura: boolean;
  acoes: AcoesPainel;
}

const NOMES_REGRAS: Record<Regra, string> = { sempre: 'Sempre', opcao: 'Opção escolhida', condicao: 'Condição', tempo: 'Depois de um tempo', horario: 'Horário (dentro ou fora)', senao: 'Senão' };

export function Painel(p: PropsPainel) {
  return (
    <aside className={`painel${p.aberto ? '' : ' fechado'}`} aria-label="Painel">
      <div className="abas" role="tablist">
        {(
          [
            ['prop', 'Propriedades'],
            ['estilo', 'Estilo e animação'],
            ['cad', 'Cadastros'],
          ] as const
        ).map(([a, nome]) => (
          <button key={a} className="aba" role="tab" aria-selected={p.aba === a} onClick={() => p.setAba(a)} type="button">
            {nome}
          </button>
        ))}
      </div>
      <fieldset className="conteudo" disabled={p.soLeitura} style={{ border: 0, margin: 0, minWidth: 0 }}>
        {p.aba === 'estilo' ? <PainelEstilo {...p} /> : p.aba === 'cad' ? <PainelCadastros {...p} /> : <Propriedades {...p} />}
      </fieldset>
    </aside>
  );
}

/**
 * Um painel por item selecionado (`key` pelo id): trocar de peça monta campos novos, e o que estava digitado no campo
 * da anterior é gravado nela (ver `useGravaAoSair`, no Campos), nunca na que acabou de ser selecionada.
 */
function Propriedades(p: PropsPainel) {
  const { doc, sel } = p;
  if (sel?.tipo === 'peca') {
    const peca = doc.pecas.find((x) => x.id === sel.id);
    if (peca) return <PainelPeca key={`peca:${peca.id}`} {...p} peca={peca} />;
  }
  if (sel?.tipo === 'conexao') {
    const c = doc.conexoes.find((x) => x.id === sel.id);
    if (c) return <PainelConexao key={`conexao:${c.id}`} {...p} conexao={c} />;
  }
  if (sel?.tipo === 'grupo') {
    const g = doc.grupos.find((x) => x.id === sel.id);
    if (g) return <PainelGrupo key={`grupo:${g.id}`} {...p} grupo={g} />;
  }
  if (sel?.tipo === 'nota') {
    const n = doc.notas.find((x) => x.id === sel.id);
    if (n) return <PainelNota key={`nota:${n.id}`} {...p} nota={n} />;
  }
  return <PainelFluxo key="fluxo" {...p} />;
}

function PainelFluxo({ fluxo, canais, acoes, soLeitura }: PropsPainel) {
  const [confirmar, setConfirmar] = useState(false);
  return (
    <>
      <div className="rotulo-secao">Fluxo</div>
      <CampoTexto rotulo="Nome" valor={fluxo.nome} aoMudar={(nome) => acoes.mudarFluxo({ nome })} />
      <label className="campo">
        Canal principal
        <select aria-label="Canal principal" value={fluxo.canal ?? ''} onChange={(e) => acoes.mudarFluxo({ canal: e.target.value || null })}>
          <option value="">sem canal</option>
          {canais.map((c) => (
            <option key={c.chave} value={c.chave}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      <p className="dica">O canal principal dá a cor da água. Cada peça pode trocar de canal no meio do caminho (ex.: o WhatsApp manda um e-mail).</p>
      <CampoTexto rotulo="Descrição" valor={fluxo.descricao} multilinha aoMudar={(descricao) => acoes.mudarFluxo({ descricao })} />
      <CampoTempo rotulo="Meta de tempo pro cliente (opcional)" valor={fluxo.meta_s ?? undefined} aoMudar={(s) => acoes.mudarFluxo({ meta_s: s ?? null })} />
      <div className="rotulo-secao">Como montar</div>
      <p className="dica">Clique numa forma da barra e depois no quadro, ou arraste a forma até onde quiser. Dois cliques num espaço vazio também criam.</p>
      <p className="dica">Passe o mouse numa peça: puxe a bolinha azul até outra peça pra ligar, ou clique no + pra criar a próxima já ligada. Clique numa ligação pra pôr a regra.</p>
      <p className="dica">Dois cliques numa peça renomeiam. Del apaga o que está selecionado.</p>
      {!soLeitura &&
        (confirmar ? (
          <div className="linha">
            <button className="botao perigo" type="button" onClick={acoes.apagarFluxo}>
              Apagar de vez
            </button>
            <button className="botao" type="button" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button className="botao perigo" type="button" onClick={() => setConfirmar(true)}>
            Apagar este fluxo
          </button>
        ))}
    </>
  );
}

function PainelPeca({ peca: n, doc, canais, cadastros, tipos, acoes }: PropsPainel & { peca: Peca }) {
  const saidas = doc.conexoes.filter((c) => c.de === n.id);
  const rotuloResp = ROTULO_RESPONSAVEL[n.tipo];
  const atual = cadastros.find((k) => k.id === n.responsavel);
  return (
    <>
      <div className="rotulo-secao">{FORMAS[n.tipo].nome}</div>
      <CampoTexto rotulo="Nome" valor={n.nome} aoMudar={(nome) => acoes.mudarPeca(n.id, { nome })} />
      <label className="campo">
        Tipo
        <select aria-label="Tipo" value={n.tipo} onChange={(e) => acoes.mudarPeca(n.id, { tipo: e.target.value as Peca['tipo'] })}>
          {TIPOS_PECA.map((t) => (
            <option key={t} value={t}>
              {NOMES_TIPOS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        Canal
        <select aria-label="Canal" value={n.canal ?? ''} onChange={(e) => acoes.mudarPeca(n.id, { canal: e.target.value || undefined })}>
          <option value="">segue o canal de antes</option>
          {canais.map((c) => (
            <option key={c.chave} value={c.chave}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      {rotuloResp && (
        <Responsavel
          key={`${n.id}:${n.responsavel ?? ''}:${atual?.nome ?? ''}`}
          rotulo={rotuloResp}
          tipoPeca={n.tipo}
          atual={atual}
          cadastros={cadastros}
          tipos={tipos}
          aoEscolher={(id) => acoes.mudarPeca(n.id, { responsavel: id })}
          aoCriar={async (tipo, nome) => {
            const k = await acoes.criarCadastro(tipo, nome);
            if (k) acoes.mudarPeca(n.id, { responsavel: k.id });
          }}
        />
      )}
      {n.responsavel && !atual && <p className="dica">O responsável desta peça foi apagado. Escolha outro.</p>}
      {n.tipo !== 'fim' && n.tipo !== 'inicio' && <CampoTempo rotulo="Tempo nesta peça (pra simulação)" valor={n.tempo_s} aoMudar={(s) => acoes.mudarPeca(n.id, { tempo_s: s })} />}
      <CampoTexto rotulo="Descrição" valor={n.descricao ?? ''} multilinha placeholder="O que acontece aqui" aoMudar={(d) => acoes.mudarPeca(n.id, { descricao: d.trim() || undefined })} />
      {n.tipo !== 'decisao' && <Cores rotulo="Cor da peça" atual={n.cor} cores={PALETA} aoMudar={(cor) => acoes.mudarPeca(n.id, { cor })} />}
      <div className="rotulo-secao">Saídas ({saidas.length})</div>
      {saidas.length ? (
        <div className="lista">
          {saidas.map((c) => (
            <button key={c.id} type="button" className="botao" style={{ justifyContent: 'space-between' }} onClick={() => acoes.selecionar({ tipo: 'conexao', id: c.id })}>
              <span>{textoRegra(c) || 'sempre'}</span>
              <span className="dica">→ {doc.pecas.find((x) => x.id === c.para)?.nome}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="dica">Nenhuma. Puxe a bolinha azul da peça até outra, ou clique no +.</p>
      )}
      <div className="linha">
        <button className="botao" type="button" onClick={() => acoes.duplicar(n.id)}>
          Duplicar
        </button>
        <button className="botao perigo" type="button" onClick={acoes.apagar}>
          Apagar
        </button>
      </div>
    </>
  );
}

function PainelConexao({ conexao: c, doc, acoes }: PropsPainel & { conexao: Conexao }) {
  const de = doc.pecas.find((x) => x.id === c.de);
  const para = doc.pecas.find((x) => x.id === c.para);
  return (
    <>
      <div className="rotulo-secao">Ligação</div>
      <p className="dica">
        {de?.nome} → {para?.nome}
      </p>
      <label className="campo">
        Quando a água passa por aqui
        <select aria-label="Quando a água passa por aqui" value={c.regra} onChange={(e) => acoes.mudarConexao(c.id, { regra: e.target.value as Regra })}>
          {REGRAS.map((r) => (
            <option key={r} value={r}>
              {NOMES_REGRAS[r]}
            </option>
          ))}
        </select>
      </label>
      {c.regra === 'opcao' && (
        <>
          <CampoTexto rotulo="Tecla ou código da opção" valor={c.valor ?? ''} placeholder="1, 2, S, N…" aoMudar={(valor) => acoes.mudarConexao(c.id, { valor: valor.trim() })} />
          <CampoTexto rotulo="Nome da opção" valor={c.rotulo ?? ''} placeholder="Financeiro" aoMudar={(rotulo) => acoes.mudarConexao(c.id, { rotulo: rotulo.trim() })} />
        </>
      )}
      {c.regra === 'condicao' && <CampoTexto rotulo="Condição" valor={c.valor ?? ''} placeholder="pagou, score ≥ 700…" aoMudar={(valor) => acoes.mudarConexao(c.id, { valor: valor.trim() })} />}
      {c.regra === 'tempo' && <CampoTempo rotulo="Depois de" valor={c.tempo_s} aoMudar={(s) => acoes.mudarConexao(c.id, { tempo_s: s ?? 0 })} />}
      {c.regra === 'horario' && (
        <label className="campo">
          Lado do horário
          <select aria-label="Lado do horário" value={c.horario ?? 'dentro'} onChange={(e) => acoes.mudarConexao(c.id, { horario: e.target.value as 'dentro' | 'fora' })}>
            <option value="dentro">Dentro do horário</option>
            <option value="fora">Fora do horário</option>
          </select>
        </label>
      )}
      {(c.regra === 'sempre' || c.regra === 'senao') && <CampoTexto rotulo="Texto no cano (opcional)" valor={c.rotulo ?? ''} aoMudar={(rotulo) => acoes.mudarConexao(c.id, { rotulo: rotulo.trim() })} />}
      <p className="dica">
        Peça com mais de uma saída vira escolha no play: cada regra aparece como opção. &quot;Depois de um tempo&quot; soma esse tempo no relógio do cliente. As de horário, a peça decide sozinha
        pelo cadastro Horário que ela usa.
      </p>
      <div className="linha">
        <button className="botao" type="button" onClick={() => acoes.inverter(c.id)}>
          Inverter direção
        </button>
        <button className="botao perigo" type="button" onClick={acoes.apagar}>
          Apagar ligação
        </button>
      </div>
    </>
  );
}

function PainelGrupo({ grupo: g, acoes }: PropsPainel & { grupo: Grupo }) {
  return (
    <>
      <div className="rotulo-secao">Grupo</div>
      <CampoTexto rotulo="Nome" valor={g.nome} aoMudar={(nome) => acoes.mudarGrupo(g.id, { nome: nome.trim() || 'Grupo' })} />
      <Cores rotulo="Cor" atual={g.cor} cores={PALETA} aoMudar={(cor) => acoes.mudarGrupo(g.id, { cor })} />
      <p className="dica">Arraste o grupo pra mover tudo que está dentro. Puxe o canto de baixo pra mudar o tamanho.</p>
      <button className="botao perigo" type="button" onClick={acoes.apagar}>
        Apagar grupo (as peças ficam)
      </button>
    </>
  );
}

function PainelNota({ nota: n, acoes }: PropsPainel & { nota: Nota }) {
  return (
    <>
      <div className="rotulo-secao">Nota</div>
      <CampoTexto rotulo="Texto" valor={n.texto} multilinha aoMudar={(texto) => acoes.mudarNota(n.id, { texto })} />
      <Cores rotulo="Cor da nota" atual={n.cor} cores={PALETA_NOTA} aoMudar={(cor) => acoes.mudarNota(n.id, { cor })} />
      <button className="botao perigo" type="button" onClick={acoes.apagar}>
        Apagar nota
      </button>
    </>
  );
}

function PainelEstilo({ estilo: e, canais, acoes }: PropsPainel) {
  const mudar = (patch: Partial<Estilo>) => acoes.mudarEstilo({ ...e, ...patch });
  const seg = <K extends 'cano' | 'curva'>(chave: K, rotulo: string, opcoes: [Estilo[K], string][]) => (
    <div className="campo">
      {rotulo}
      <div className="segmentado" role="group" aria-label={rotulo}>
        {opcoes.map(([v, nome]) => (
          <button key={v} type="button" aria-pressed={e[chave] === v} onClick={() => mudar({ [chave]: v } as Partial<Estilo>)}>
            {nome}
          </button>
        ))}
      </div>
    </div>
  );
  const inter = (chave: 'bolhas' | 'brilho' | 'ondas' | 'holofote' | 'camera', rotulo: string) => (
    <label className="interruptor">
      {rotulo}
      <input type="checkbox" checked={e[chave]} onChange={(ev) => mudar({ [chave]: ev.target.checked })} />
    </label>
  );
  return (
    <>
      <div className="rotulo-secao">Cor da água por canal</div>
      <div className="lista">
        {canais.map((c) => (
          <label key={c.chave} className="canal-cor">
            {c.nome}
            <input type="color" value={corDoCanal(e, canais, c.chave)} onChange={(ev) => mudar({ canais: { ...e.canais, [c.chave]: ev.target.value } })} />
          </label>
        ))}
      </div>
      <div className="rotulo-secao">Canos</div>
      {seg('cano', 'Desenho', [
        ['cano', 'Cano'],
        ['linha', 'Linha'],
        ['tracejado', 'Tracejado'],
      ])}
      {seg('curva', 'Curva', [
        ['suave', 'Suave'],
        ['cotovelo', 'Cotovelo'],
        ['reta', 'Reta'],
      ])}
      <label className="campo">
        Espessura · {e.espessura}
        <input type="range" min={4} max={20} step={1} value={e.espessura} onChange={(ev) => mudar({ espessura: Number(ev.target.value) })} />
      </label>
      <div className="rotulo-secao">Água</div>
      <label className="campo">
        Velocidade · {e.velocidade}×
        <input type="range" min={0.25} max={4} step={0.25} value={e.velocidade} onChange={(ev) => mudar({ velocidade: Number(ev.target.value) })} />
      </label>
      {inter('bolhas', 'Bolhas correndo junto')}
      {inter('brilho', 'Brilho correndo no cano cheio')}
      {inter('ondas', 'Nível ondulando nas peças')}
      <div className="rotulo-secao">Decisões e câmera</div>
      {inter('holofote', 'Holofote: apaga o resto na decisão')}
      {inter('camera', 'Câmera segue a água')}
      <label className="campo">
        Escolher sozinho depois de · {e.autoEscolha ? `${e.autoEscolha} s` : 'nunca'}
        <input type="range" min={0} max={10} step={1} value={e.autoEscolha} onChange={(ev) => mudar({ autoEscolha: Number(ev.target.value) })} />
      </label>
      <p className="dica">Pra apresentar sem clicar: a água segue pela primeira opção depois desse tempo.</p>
      <button className="botao" type="button" onClick={() => acoes.mudarEstilo(ESTILO_PADRAO)}>
        Voltar ao estilo padrão
      </button>
    </>
  );
}

function PainelCadastros({ doc, cadastros, tipos, acoes }: PropsPainel) {
  const usos = usosNoDocumento(doc);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState(tipos[0]?.chave ?? 'pessoa');
  const [erro, setErro] = useState('');
  const grupos = tipos.map((t) => [t, cadastros.filter((k) => k.tipo === t.chave)] as const).filter(([, l]) => l.length);
  return (
    <>
      <p className="dica">Pessoas, filas, equipes, sistemas e horários que as peças usam. São da empresa: valem pra todos os fluxos. Renomeando aqui, muda em todos.</p>
      {grupos.length ? (
        grupos.map(([t, lista]) => (
          <div key={t.chave} className="lista">
            <div className="rotulo-secao">{t.nome}</div>
            {lista.map((k) => {
              const n = usos.get(k.id) ?? 0;
              return (
                <div key={k.id} className="cad">
                  <span className="tipo">{t.nome}</span>
                  <input
                    key={k.nome}
                    type="text"
                    defaultValue={k.nome}
                    aria-label={`Nome do cadastro ${k.nome}`}
                    onBlur={(e) => {
                      const v = e.currentTarget.value.trim();
                      if (!v) e.currentTarget.value = k.nome;
                      else if (v !== k.nome) void acoes.renomearCadastro(k.id, v);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                  <small>
                    <button className="botao pequeno" type="button" onClick={() => acoes.verCadastro(k.id)} disabled={!n}>
                      {n} {n === 1 ? 'uso' : 'usos'} aqui
                    </button>
                  </small>
                </div>
              );
            })}
          </div>
        ))
      ) : (
        <p className="dica">Nenhum cadastro ainda.</p>
      )}
      <div className="rotulo-secao">Novo cadastro</div>
      <form
        className="lista"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!nome.trim()) return;
          const k = await acoes.criarCadastro(tipo, nome);
          if (k) {
            setNome('');
            setErro('');
          } else setErro('Não deu pra cadastrar.');
        }}
      >
        <label className="campo">
          Nome
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Fila Cobrança, Maria, ERP…" />
        </label>
        <label className="campo">
          Tipo
          <select aria-label="Tipo do cadastro" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {tipos.map((t) => (
              <option key={t.chave} value={t.chave}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <button className="botao primario" type="submit">
          Cadastrar
        </button>
        {erro && <p className="dica">{erro}</p>}
      </form>
    </>
  );
}
```

- [ ] **Passo 3: o cartão do play**

`apps/web/src/componentes/editor/CartaoPlay.tsx`:

```tsx
'use client';

import { formatarTempo, type Documento } from '@journey/fluxo';
import { Icone } from '@/componentes/Icone';
import { VELOCIDADES, type CanalEditor } from '@/editor/estilo';
import { quandoValido, tituloDoFim, type Play, type Visual } from '@/editor/play';

export interface AcoesPlay {
  escolher(conexao: string): void;
  pausar(): void;
  voltar(): void;
  recomecar(): void;
  parar(): void;
  velocidade(v: number): void;
  quando(q: string): void;
  relogio(decide: boolean): void;
  comecarEm(inicio: string): void;
}

/** O cartão de baixo durante o play: a pergunta com as opções, o fim com o resumo, os controles e a linha do tempo. */
export function CartaoPlay({
  doc,
  play,
  visual,
  pausado,
  velocidade,
  autoEscolha,
  corAgua,
  canais,
  inicios,
  acoes,
}: {
  doc: Documento;
  play: Play | null;
  visual: Visual | null;
  pausado: boolean;
  velocidade: number;
  autoEscolha: number;
  corAgua: (canal: string | null) => string;
  canais: readonly CanalEditor[];
  /** Quando há mais de um Início e nenhum selecionado: a pergunta "por onde começa?". */
  inicios: string[] | null;
  acoes: AcoesPlay;
}) {
  const nome = (id: string | null | undefined) => doc.pecas.find((p) => p.id === id)?.nome ?? '';
  const nomeCanal = (k: string | null) => canais.find((c) => c.chave === k)?.nome ?? 'sem canal';

  if (inicios) {
    return (
      <div className="cartao-sim" role="region" aria-label="Simulação">
        <div className="pergunta">Por onde a jornada começa?</div>
        <div className="opcoes">
          {inicios.map((id, i) => (
            <button key={id} className="opcao" type="button" onClick={() => acoes.comecarEm(id)}>
              <span className="tecla">{i + 1}</span>
              <span>{nome(id)}</span>
            </button>
          ))}
        </div>
        <div className="controles">
          <button className="bi" type="button" aria-label="Parar" style={{ marginLeft: 'auto' }} onClick={acoes.parar}>
            <Icone nome="fechar" />
          </button>
        </div>
      </div>
    );
  }
  if (!play || !visual) return null;

  const canal = visual.canal;
  const canaisDoCaminho = [...new Set([...visual.molhadas.values()])];
  const controles = (
    <div className="controles">
      <button className="bi" type="button" aria-label={pausado ? 'Continuar' : 'Pausar'} onClick={acoes.pausar}>
        <Icone nome={pausado ? 'play' : 'pausa'} />
      </button>
      <button className="bi" type="button" aria-label="Voltar uma decisão" title="Voltar uma decisão" onClick={acoes.voltar}>
        <Icone nome="voltar" />
      </button>
      <button className="bi" type="button" aria-label="Recomeçar" title="Recomeçar" onClick={acoes.recomecar}>
        <Icone nome="recomecar" />
      </button>
      <div className="vel" role="group" aria-label="Velocidade">
        {VELOCIDADES.map((v) => (
          <button key={v} type="button" aria-pressed={velocidade === v} onClick={() => acoes.velocidade(v)}>
            {v}×
          </button>
        ))}
      </div>
      <button className="bi" type="button" aria-label="Parar" style={{ marginLeft: 'auto' }} onClick={acoes.parar}>
        <Icone nome="fechar" />
      </button>
    </div>
  );

  let corpo: React.ReactNode;
  if (visual.fim) {
    corpo = (
      <div data-testid="fim" style={{ display: 'grid', gap: 10 }}>
        <div className="pergunta">
          {tituloDoFim(visual.fim.motivo)}: {nome(visual.fim.peca)}
        </div>
        <div className="numeros">
          <span>
            <b>{new Set(visual.linha.map((l) => l.peca)).size}</b>peças
          </span>
          <span>
            <b>{formatarTempo(visual.relogio_s)}</b>pro cliente
          </span>
          <span>
            <b>{canaisDoCaminho.length}</b>
            {canaisDoCaminho.map(nomeCanal).join(', ')}
          </span>
        </div>
        <div className="controles">
          <button className="botao primario" type="button" onClick={acoes.recomecar}>
            Ver de novo
          </button>
          <button className="botao" type="button" onClick={acoes.voltar}>
            Voltar e escolher outro caminho
          </button>
          <button className="botao" type="button" onClick={acoes.parar}>
            Fechar
          </button>
        </div>
      </div>
    );
  } else if (visual.pergunta) {
    const conexoes = new Map(doc.conexoes.map((c) => [c.id, c]));
    corpo = (
      <>
        <div className="pergunta">{nome(visual.pergunta.peca)}</div>
        <div className="opcoes">
          {visual.pergunta.opcoes.map((o, i) => (
            <button key={o.conexao} className="opcao" type="button" onClick={() => acoes.escolher(o.conexao)}>
              <span className="tecla">{conexoes.get(o.conexao)?.valor?.length === 1 ? conexoes.get(o.conexao)!.valor : i + 1}</span>
              <span>
                {o.texto}
                {o.sugerida && ' (o relógio iria por aqui)'}
                <small>
                  → {nome(o.para)}
                  {o.tempo_s ? ` · soma ${formatarTempo(o.tempo_s)}` : ''}
                </small>
              </span>
            </button>
          ))}
        </div>
        <p className="dica">
          Clica numa opção, no cano, ou aperta o número.{autoEscolha ? ` Segue sozinho em ${autoEscolha} s.` : ''}
        </p>
        {controles}
      </>
    );
  } else {
    corpo = (
      <>
        <div className="pergunta">{visual.correndo ? `Indo pra ${nome(doc.conexoes.find((c) => c.id === visual.correndo!.conexao)?.para)}` : nome(visual.atual)}</div>
        {controles}
      </>
    );
  }

  return (
    <div className="cartao-sim" role="region" aria-label="Simulação" style={{ ['--agua' as string]: corAgua(canal) }}>
      <div className="cab">
        <span className="pilula" style={{ ['--c' as string]: corAgua(canal) }}>
          <span className="ponto-cor" />
          {nomeCanal(canal)}
        </span>
        <span data-testid="tempo-cliente">tempo do cliente: {formatarTempo(visual.relogio_s)}</span>
      </div>
      <div className="quando">
        <label>
          Dia e hora
          <input type="datetime-local" value={play.quando} onChange={(e) => quandoValido(e.target.value) && acoes.quando(e.target.value)} />
        </label>
        <label>
          <input type="checkbox" checked={play.modo === 'relogio'} onChange={(e) => acoes.relogio(e.target.checked)} />o relógio decide os horários
        </label>
      </div>
      {corpo}
      <details className="det">
        <summary>Linha do tempo ({visual.linha.length})</summary>
        <ol className="linha-tempo">
          {visual.linha.map((l, i) => (
            <li key={i}>
              <time>{formatarTempo(l.relogio_s)}</time>
              <span>{nome(l.peca)}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
```

- [ ] **Passo 4: conferir**

Run: `npm run typecheck && cd apps/web && npx vitest run test/cliente-sem-exceljs.test.ts`
Expected: `tsc` sem saída; `Tests  30 passed (30)`.

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/componentes/editor
git commit -m "editor: painel e cartão do play" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 9: o editor e a tela Fluxos

**Arquivos:**
- Criar: `apps/web/e2e/editor.spec.ts`, `apps/web/e2e/fluxos.spec.ts`
- Modificar: `apps/web/e2e/apoio.ts`, `aceitacao.spec.ts`, `capturas.spec.ts`, `catalogo.spec.ts`, `importar.spec.ts`, `simulacao.spec.ts`, `membros.spec.ts`
- Criar: `apps/web/src/componentes/editor/Editor.tsx`
- Criar: `apps/web/src/app/e/[empresa]/f/[fluxo]/page.tsx`, `error.tsx`, `apps/web/src/app/e/[empresa]/lista.tsx`
- Substituir: `apps/web/src/app/e/[empresa]/page.tsx`, `apps/web/src/componentes/Nav.tsx`

- [ ] **Passo 1: os testes de ponta a ponta do editor e da tela Fluxos**

Critério 1, desfazer e recarregar:

`apps/web/e2e/editor.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const peca = (page: Page, nome: string) => page.getByRole('button', { name: new RegExp(`: ${esc(nome)}$`) });
const salvo = (page: Page) => expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });

/** O + de uma peça cria a próxima já ligada; o nome fica em edição. */
async function proxima(page: Page, de: string, tipo: string, nome: string) {
  await peca(page, de).hover();
  await page.getByRole('button', { name: `Criar a próxima etapa ligada a ${de}` }).click();
  await page.getByRole('menuitem', { name: tipo, exact: true }).click();
  await page.getByLabel('Nome da peça').fill(nome);
  await page.getByLabel('Nome da peça').press('Enter');
  await expect(peca(page, nome)).toBeVisible();
}

test('critério 1: fluxo novo do zero, 10 peças com 2 decisões, play até o fim', async ({ page, request }) => {
  test.setTimeout(120_000);
  await entrar(page, request, emailNovo('editor'));
  await page.getByLabel('Nome da empresa').fill('Empresa do editor');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByLabel('Nome do fluxo').fill('Onboarding');
  await page.getByRole('button', { name: 'Criar e abrir' }).click();
  await expect(page).toHaveURL(/\/f\//);
  await salvo(page);

  await page.getByRole('button', { name: 'Início', exact: true }).click();
  await page.getByTestId('quadro').click({ position: { x: 200, y: 300 } });
  await page.getByLabel('Nome da peça').fill('Cliente chama');
  await page.getByLabel('Nome da peça').press('Enter');
  await proxima(page, 'Cliente chama', 'Mensagem', 'Boas-vindas');
  await proxima(page, 'Boas-vindas', 'Decisão', 'Já é cliente?');
  await proxima(page, 'Já é cliente?', 'Atendimento', 'Atende cliente');
  await proxima(page, 'Já é cliente?', 'Etapa', 'Cadastra');
  await proxima(page, 'Cadastra', 'Decisão', 'Aprovado?');
  await proxima(page, 'Aprovado?', 'Fim', 'Bem-vindo');
  await proxima(page, 'Aprovado?', 'Fim', 'Recusado');
  await proxima(page, 'Atende cliente', 'Espera', 'Aguarda retorno');
  await proxima(page, 'Aguarda retorno', 'Fim', 'Resolvido');
  await expect(page.locator('[data-peca]')).toHaveCount(10);
  await salvo(page);

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Dar play' }).click();
  const sim = page.getByRole('region', { name: 'Simulação' });
  await expect(sim.getByRole('button', { name: /Cadastra/ })).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('2');
  await sim.getByRole('button', { name: /Recusado/ }).click();
  await expect(page.getByTestId('fim')).toContainText('Chegou em: Recusado', { timeout: 15_000 });
  await sim.getByRole('button', { name: 'Voltar e escolher outro caminho' }).click();
  await expect(sim.locator('.pergunta')).toHaveText('Aprovado?');
  await page.getByRole('button', { name: 'Parar' }).first().click();
});

test('apaga, desfaz, e depois de recarregar o desenho está igual', async ({ page, request }) => {
  test.setTimeout(90_000);
  await entrar(page, request, emailNovo('desfazer'));
  await page.getByLabel('Nome da empresa').fill('Empresa');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('button', { name: /SAC por e-mail/ }).click();
  await expect(page).toHaveURL(/\/f\//);
  await salvo(page);
  await peca(page, 'Resolvido').click();
  await page.keyboard.press('Delete');
  await expect(peca(page, 'Resolvido')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(peca(page, 'Resolvido')).toBeVisible();
  await peca(page, 'Triagem').dblclick();
  await page.getByLabel('Nome da peça').fill('Triagem do SAC');
  await page.getByLabel('Nome da peça').press('Enter');
  await salvo(page);
  await page.reload();
  await expect(peca(page, 'Triagem do SAC')).toBeVisible();
  await expect(peca(page, 'Resolvido')).toBeVisible();
});
```

Critério 5, busca, trava e sem rede:

`apps/web/e2e/fluxos.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

const MODELOS = ['Suporte no WhatsApp', 'Esteira de crédito', 'URA telefônica'];

test('critério 5: fluxos de canais diferentes convivem, cada um com a cor da água dele', async ({ page, request }) => {
  test.setTimeout(120_000);
  await entrar(page, request, emailNovo('canais'));
  await page.getByLabel('Nome da empresa').fill('Empresa dos canais');
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page).toHaveURL(/\/e\/[0-9a-f-]+$/);
  const casa = page.url();
  const cores: string[] = [];
  for (const nome of MODELOS) {
    await page.goto(casa);
    // Sem lista a região já vem aberta; com fluxos, abre pelo botão. Espera a página responder (o clique antes da
    // hidratação se perde) em vez de olhar uma vez só com isVisible().
    const novo = page.getByRole('button', { name: 'Novo fluxo' });
    await expect(novo).toBeEnabled();
    await expect(async () => {
      if ((await novo.getAttribute('aria-expanded')) !== 'true') await novo.click();
      await expect(page.getByRole('region', { name: 'Novo fluxo' })).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await page.getByRole('button', { name: new RegExp(nome) }).click();
    await expect(page).toHaveURL(/\/f\//);
    await expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Dar play' }).click();
    await page.getByRole('region', { name: 'Simulação' }).getByLabel('Dia e hora').fill('2026-11-23T10:00');
    const agua = page.locator('.agua-trilho').first();
    await agua.waitFor({ state: 'attached', timeout: 15_000 });
    cores.push(await agua.evaluate((el) => (el as SVGPathElement).style.stroke));
  }
  expect(new Set(cores).size).toBe(3);
  await page.goto(casa);
  for (const nome of MODELOS) await expect(page.getByRole('link', { name: new RegExp(nome) })).toBeVisible();
  await page.getByLabel('Buscar fluxo').fill('credito');
  await expect(page.getByRole('link', { name: /Esteira de crédito/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /URA telefônica/ })).toHaveCount(0);
});

test('trava: quem abre depois só vê e dá play; sem rede, guarda e salva quando volta', async ({ page, request, browser, context }) => {
  test.setTimeout(150_000);
  const dono = emailNovo('dono');
  await entrar(page, request, dono);
  await page.getByLabel('Nome da empresa').fill('Empresa da trava');
  await page.getByRole('button', { name: 'Criar' }).click();
  const colega = emailNovo('colega');
  await page.getByRole('link', { name: 'Membros' }).click();
  await page.getByLabel('E-mail').fill(colega);
  await page.getByRole('button', { name: 'Convidar' }).click();
  await expect(page.getByText(`Convite pra ${colega} criado`)).toBeVisible();
  await page.getByRole('link', { name: 'Fluxos' }).click();
  await page.getByRole('button', { name: /URA telefônica/ }).click();
  await expect(page).toHaveURL(/\/f\//);
  await expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });

  const outro = await browser.newContext();
  const p2 = await outro.newPage();
  await entrar(p2, request, colega);
  await p2.goto(page.url());
  await expect(p2.getByText(`${dono} está editando este fluxo`)).toBeVisible({ timeout: 15_000 });
  await expect(p2.getByTestId('salvamento')).toHaveText('só leitura');
  await expect(p2.getByRole('button', { name: 'Desfazer' })).toBeDisabled();
  await p2.getByRole('button', { name: 'Dar play' }).click();
  await expect(p2.getByRole('region', { name: 'Simulação' })).toBeVisible();
  await outro.close();

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Fim: Atendido' }).click();
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('salvamento')).toContainText('sem conexão', { timeout: 15_000 });
  await context.setOffline(false);
  await expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 30_000 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Fim: Desliga' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fim: Atendido' })).toHaveCount(0);
});
```

- [ ] **Passo 2: os testes da v1 chegam nas telas dela pelo endereço** (elas saem do menu nesta tarefa)

```diff
diff --git a/apps/web/e2e/apoio.ts b/apps/web/e2e/apoio.ts
index 0e36deb..8e3de0f 100644
--- a/apps/web/e2e/apoio.ts
+++ b/apps/web/e2e/apoio.ts
@@ -25,6 +25,15 @@ export async function entrar(page: Page, request: APIRequestContext, email: stri
   await page.goto(link);
 }
 
+/**
+ * As telas da v1 (importar, catálogo) saíram do menu na etapa B e continuam até a C: os testes delas chegam pelo endereço.
+ */
+export async function irPara(page: Page, secao: 'importar' | 'catalogo') {
+  await page.waitForURL(/\/e\/[0-9a-f-]+/);
+  const empresa = /\/e\/([0-9a-f-]+)/.exec(page.url())![1];
+  await page.goto(`/e/${empresa}/${secao}`);
+}
+
 export const emailNovo = (prefixo: string) => `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@exemplo.com`;
 
 /** Cria a empresa e importa os arquivos; termina na página da jornada. */
@@ -32,7 +41,7 @@ export async function empresaComImport(page: Page, arquivos: string[], nome = 'E
   await expect(page).toHaveURL(/\/empresa\/nova/);
   await page.getByLabel('Nome da empresa').fill(nome);
   await page.getByRole('button', { name: 'Criar' }).click();
-  await page.getByRole('link', { name: 'Importar' }).first().click();
+  await irPara(page, 'importar');
   await page.getByLabel('Arquivos').setInputFiles(arquivos);
   await page.getByRole('button', { name: 'Analisar' }).click();
   await expect(page.getByText('pode confirmar')).toBeVisible({ timeout: 30_000 });
```

```diff
diff --git a/apps/web/e2e/aceitacao.spec.ts b/apps/web/e2e/aceitacao.spec.ts
index 5f5e80f..bb6d765 100644
--- a/apps/web/e2e/aceitacao.spec.ts
+++ b/apps/web/e2e/aceitacao.spec.ts
@@ -1,7 +1,7 @@
 import { readdirSync } from 'node:fs';
 import { join } from 'node:path';
 import { expect, test } from '@playwright/test';
-import { entrar, emailNovo } from './apoio';
+import { entrar, emailNovo, irPara } from './apoio';
 
 const CENTRAL = join(import.meta.dirname, '..', '..', '..', 'packages', 'nucleo', 'test', 'fixtures', 'central');
 
@@ -24,9 +24,9 @@ test('critérios 1 e 2: a central entra sem redesenhar e o diagnóstico acha os
   await expect(page).toHaveURL(/\/empresa\/nova/);
   await page.getByLabel('Nome da empresa').fill('Central de teste');
   await page.getByRole('button', { name: 'Criar' }).click();
-  await expect(page.getByRole('heading', { name: 'Jornadas' })).toBeVisible();
+  await expect(page.getByRole('heading', { name: 'Fluxos' })).toBeVisible();
 
-  await page.getByRole('link', { name: 'Importar' }).first().click();
+  await irPara(page, 'importar');
   const arquivos = readdirSync(CENTRAL).filter((n) => n.endsWith('.csv')).map((n) => join(CENTRAL, n));
   await page.getByLabel('Arquivos').setInputFiles(arquivos);
   await page.getByRole('button', { name: 'Analisar' }).click();
```

```diff
diff --git a/apps/web/e2e/capturas.spec.ts b/apps/web/e2e/capturas.spec.ts
index d1aaea2..fd1c521 100644
--- a/apps/web/e2e/capturas.spec.ts
+++ b/apps/web/e2e/capturas.spec.ts
@@ -1,7 +1,7 @@
 import { readdirSync } from 'node:fs';
 import { join } from 'node:path';
 import { expect, test } from '@playwright/test';
-import { entrar, emailNovo } from './apoio';
+import { entrar, emailNovo, irPara } from './apoio';
 
 const CENTRAL = join(import.meta.dirname, '..', '..', '..', 'packages', 'nucleo', 'test', 'fixtures', 'central');
 const PASTA = process.env.CAPTURAS ?? '';
@@ -14,7 +14,7 @@ test('capturas da tela', async ({ page, request, browser }) => {
   await entrar(page, request, emailNovo('captura'));
   await page.getByLabel('Nome da empresa').fill('Central de teste');
   await page.getByRole('button', { name: 'Criar' }).click();
-  await page.getByRole('link', { name: 'Importar' }).first().click();
+  await irPara(page, 'importar');
   await page.getByLabel('Arquivos').setInputFiles(readdirSync(CENTRAL).filter((n) => n.endsWith('.csv')).map((n) => join(CENTRAL, n)));
   await page.getByRole('button', { name: 'Analisar' }).click();
   await expect(page.getByRole('button', { name: 'Confirmar import' })).toBeVisible({ timeout: 30_000 });
```

```diff
diff --git a/apps/web/e2e/catalogo.spec.ts b/apps/web/e2e/catalogo.spec.ts
index 12efea6..f139790 100644
--- a/apps/web/e2e/catalogo.spec.ts
+++ b/apps/web/e2e/catalogo.spec.ts
@@ -1,13 +1,13 @@
 import { join } from 'node:path';
 import { expect, test } from '@playwright/test';
-import { empresaComImport, entrar, emailNovo } from './apoio';
+import { empresaComImport, entrar, emailNovo, irPara } from './apoio';
 
 const PEQUENA = join(import.meta.dirname, 'fixtures', 'pequena.json');
 
 test('catálogo diz onde cada coisa é usada', async ({ page, request }) => {
   await entrar(page, request, emailNovo('catalogo'));
   await empresaComImport(page, [PEQUENA]);
-  await page.getByRole('link', { name: 'Catálogo' }).click();
+  await irPara(page, 'catalogo');
   await page.getByRole('link', { name: /^ramais/ }).click();
   await page.getByTestId('tabela-catalogo').getByRole('link', { name: 'r1' }).click();
   const onde = page.getByTestId('onde-usado');
@@ -18,7 +18,7 @@ test('catálogo diz onde cada coisa é usada', async ({ page, request }) => {
 test('import parcial muda só a aba que veio', async ({ page, request }) => {
   await entrar(page, request, emailNovo('parcial'));
   await empresaComImport(page, [PEQUENA], 'Empresa parcial');
-  await page.getByRole('link', { name: 'Importar' }).first().click();
+  await irPara(page, 'importar');
   await page.getByLabel('Arquivos').setInputFiles({
     name: 'filas.csv',
     mimeType: 'text/csv',
```

```diff
diff --git a/apps/web/e2e/importar.spec.ts b/apps/web/e2e/importar.spec.ts
index 8e7f736..73c69b6 100644
--- a/apps/web/e2e/importar.spec.ts
+++ b/apps/web/e2e/importar.spec.ts
@@ -1,11 +1,11 @@
 import { expect, test } from '@playwright/test';
-import { entrar, emailNovo } from './apoio';
+import { entrar, emailNovo, irPara } from './apoio';
 
 test('import com erro mostra aba, linha e coluna e não deixa confirmar', async ({ page, request }) => {
   await entrar(page, request, emailNovo('erro'));
   await page.getByLabel('Nome da empresa').fill('Empresa com erro');
   await page.getByRole('button', { name: 'Criar' }).click();
-  await page.getByRole('link', { name: 'Importar' }).first().click();
+  await irPara(page, 'importar');
   await page.getByLabel('Arquivos').setInputFiles({ name: 'saidas.csv', mimeType: 'text/csv', buffer: Buffer.from('id;de;opcao;para\nx;peca:a;tecla-errada;fim:desliga\n') });
   await page.getByRole('button', { name: 'Analisar' }).click();
   const erros = page.getByTestId('problemas-grave');
@@ -19,7 +19,7 @@ test('arquivos acima de 4 MB juntos são barrados antes de enviar', async ({ pag
   await entrar(page, request, emailNovo('grande'));
   await page.getByLabel('Nome da empresa').fill('Empresa com arquivo grande');
   await page.getByRole('button', { name: 'Criar' }).click();
-  await page.getByRole('link', { name: 'Importar' }).first().click();
+  await irPara(page, 'importar');
   const metade = Buffer.alloc(2 * 1024 * 1024, 'a');
   await page.getByLabel('Arquivos').setInputFiles([
     { name: 'pecas.csv', mimeType: 'text/csv', buffer: metade },
```

```diff
diff --git a/apps/web/e2e/simulacao.spec.ts b/apps/web/e2e/simulacao.spec.ts
index bfe8b47..89644b5 100644
--- a/apps/web/e2e/simulacao.spec.ts
+++ b/apps/web/e2e/simulacao.spec.ts
@@ -1,6 +1,6 @@
 import { join } from 'node:path';
 import { expect, test, type Page } from '@playwright/test';
-import { empresaComImport, entrar, emailNovo } from './apoio';
+import { empresaComImport, entrar, emailNovo, irPara } from './apoio';
 
 const PEQUENA = join(import.meta.dirname, 'fixtures', 'pequena.json');
 /** A mesma central sem a opção 1 do menu (Vendas): o cenário que passava por ela muda. */
@@ -90,7 +90,7 @@ test('depois de um import que tira a opção, a decisão mostra a diferença; ap
   await ateAtendido(page);
   await salvar(page, 'Vendas');
 
-  await page.getByRole('link', { name: 'Importar' }).first().click();
+  await irPara(page, 'importar');
   await page.getByLabel('Arquivos').setInputFiles([SEM_VENDAS]);
   await page.getByRole('button', { name: 'Analisar' }).click();
   await expect(page.getByText('pode confirmar')).toBeVisible({ timeout: 30_000 });
```

```diff
diff --git a/apps/web/e2e/membros.spec.ts b/apps/web/e2e/membros.spec.ts
index 5a36872..301e9c0 100644
--- a/apps/web/e2e/membros.spec.ts
+++ b/apps/web/e2e/membros.spec.ts
@@ -5,7 +5,7 @@ test('convidado entra direto na empresa', async ({ page, request, browser }) =>
   await entrar(page, request, emailNovo('dono'));
   await page.getByLabel('Nome da empresa').fill('Empresa do convite');
   await page.getByRole('button', { name: 'Criar' }).click();
-  await expect(page.getByRole('heading', { name: 'Jornadas' })).toBeVisible();
+  await expect(page.getByRole('heading', { name: 'Fluxos' })).toBeVisible();
   const convidado = emailNovo('convidado');
   await page.getByRole('link', { name: 'Membros' }).click();
   await page.getByLabel('E-mail').fill(convidado);
@@ -16,6 +16,6 @@ test('convidado entra direto na empresa', async ({ page, request, browser }) =>
   const p2 = await outra.newPage();
   await entrar(p2, request, convidado);
   await expect(p2.getByText('Empresa do convite')).toBeVisible();
-  await expect(p2.getByRole('heading', { name: 'Nada importado ainda' })).toBeVisible();
+  await expect(p2.getByRole('heading', { name: 'Em branco' })).toBeVisible();
   await outra.close();
 });
```

- [ ] **Passo 3: rodar e ver falhar**

Run: `npm run e2e -- e2e/editor.spec.ts e2e/fluxos.spec.ts --trace=off`
Expected: FAIL nos 4 (a tela da empresa ainda é a de jornadas: não há "Criar e abrir" nem os modelos).

- [ ] **Passo 4: o editor**

`apps/web/src/componentes/editor/Editor.tsx`:

```tsx
'use client';

import './editor.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { lerDocumento, type Cadastro, type Documento, type TipoPeca } from '@journey/fluxo';
import { criarCadastro, renomearCadastro } from '@/acoes/cadastros';
import { apagarFluxo, mudarFluxo, type DadosDoFluxo } from '@/acoes/fluxos';
import { Icone } from '@/componentes/Icone';
import type { TipoCadastro } from '@/editor/cadastros';
import * as D from '@/editor/documento';
import { corDoCanal, lerEstilo, type CanalEditor, type Estilo } from '@/editor/estilo';
import { comecar, desfazer, refazer, registrar, substituir, type Historico } from '@/editor/historico';
import { FORMAS, ORDEM_FORMAS } from '@/editor/pecas';
import { agora, espera, opcaoDaTecla, rodar, visual as verVisual, voltar as voltarPlay, type Play } from '@/editor/play';
import { Salvamento, copiaValida, motivoDoErro, type Situacao } from '@/editor/salvamento';
import { FUSO } from '@/lib/fuso';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { CartaoPlay } from './CartaoPlay';
import { Painel, type Aba, type DadosFluxo } from './Painel';
import { Quadro, criaAlgo, type Ferramenta, type QuadroApi } from './Quadro';

export interface PropsEditor {
  empresaId: string;
  fluxo: { id: string; revisao: number; documento: Documento; estilo: unknown } & DadosFluxo;
  canais: readonly CanalEditor[];
  cadastros: readonly Cadastro[];
  tipos: readonly TipoCadastro[];
}

/** Ids curtos e únicos o bastante dentro de um fluxo. */
const novoId = (prefixo: string) => `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const chaveLocal = (id: string) => `journey:fluxo:${id}`;
/** A trava vale 10 minutos; o editor renova antes de vencer. */
const RENOVAR_TRAVA = 4 * 60 * 1000;
/** Até quando conta como minha uma trava que não deu pra renovar: 9 dos 10 minutos, pelo relógio daqui. */
const TRAVA_VALE = 9 * 60 * 1000;
/** Pedido de trava que falhou (rede, 5xx, login): tenta de novo nesse tempo, não só na próxima renovação. */
const DE_NOVO_TRAVA = 20 * 1000;
/** Quanto espera a resposta do pegar_trava antes de desistir (e tratar como sem rede). */
const LIMITE_TRAVA = 15 * 1000;

/**
 * pegando: abrindo; minha: edita; outra: alguém editando (o banco disse); incerta: não deu pra confirmar com o banco
 * (sem rede) e a trava daqui, se havia, já pode ter vencido; liberou: quem só via ganhou a trava, mas o documento
 * na tela é o do carregamento: recarrega pra editar o que está no banco.
 */
type Trava =
  | { estado: 'pegando' }
  | { estado: 'minha' }
  | { estado: 'outra'; por: string | null; ate: string | null }
  | { estado: 'incerta' }
  | { estado: 'liberou' };

export function Editor({ empresaId, fluxo, canais, cadastros: cadastrosIniciais, tipos }: PropsEditor) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseNavegador(), []);
  const quadro = useRef<QuadroApi>(null);

  const [hist, setHist] = useState<Historico>(() => comecar(fluxo.documento));
  const doc = hist.atual;
  const [estilo, setEstilo] = useState<Estilo>(() => lerEstilo(fluxo.estilo));
  const [velocidadeVista, setVelocidadeVista] = useState<number | null>(null);
  // O que a tela mostra: o estilo, com a velocidade que quem só vê escolheu pro play dele.
  const estiloVisto = useMemo(() => (velocidadeVista === null ? estilo : { ...estilo, velocidade: velocidadeVista }), [estilo, velocidadeVista]);
  const [dados, setDados] = useState<DadosFluxo>({ nome: fluxo.nome, descricao: fluxo.descricao, canal: fluxo.canal, meta_s: fluxo.meta_s });
  // O mais recente, sem esperar o próximo desenho: uma ação chamada depois de um await (ou de um menu aberto antes)
  // traz o `doc` do desenho em que nasceu, e gravar em cima dele apagaria o que mudou nesse meio-tempo. Os refs só
  // mudam junto com o estado (mudarHist, mudarEstilo, mudarDados), nunca no desenho: um desenho atrasado não volta
  // o ref pra trás.
  const histRef = useRef(hist);
  const estiloRef = useRef(estilo);
  const dadosRef = useRef(dados);
  const docAtual = () => histRef.current.atual;
  const mudarHist = (h: Historico) => {
    histRef.current = h;
    setHist(h);
  };
  const trocarEstilo = (e: Estilo) => {
    estiloRef.current = e;
    setEstilo(e);
  };
  /** O último histórico que um quadro de arrasto escreveu: se a cabeça mudou depois dele, o próximo quadro é passo novo. */
  const ultimoQuadro = useRef<Historico | null>(null);
  const [cadastros, setCadastros] = useState<readonly Cadastro[]>(cadastrosIniciais);
  const [sel, setSel] = useState<D.Selecao>(null);
  const [ferramenta, setFerramenta] = useState<Ferramenta>('selecionar');
  const [aba, setAba] = useState<Aba>('prop');
  const [painelAberto, setPainelAberto] = useState(false);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<{ s: Situacao; mensagem?: string }>({ s: 'salvo' });
  const [aviso, setAviso] = useState<string | null>(null);
  const [trava, setTrava] = useState<Trava>({ estado: 'pegando' });
  const [fantasma, setFantasma] = useState<{ t: Ferramenta; x: number; y: number } | null>(null);

  const parado = situacao.s === 'conflito' || situacao.s === 'sem_trava' || situacao.s === 'recusado';
  const soLeitura = trava.estado !== 'minha' || parado;

  const avisar = (t: string) => setAviso(t);
  // O título da aba acompanha o nome do fluxo (renomear aqui muda na hora).
  useEffect(() => {
    document.title = `${dados.nome} · Journey`;
  }, [dados.nome]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2600);
    return () => clearTimeout(t);
  }, [aviso]);

  // Salvamento automático: o documento e o estilo vão pelo salvar_fluxo, com a revisão.
  const salv = useRef<Salvamento | null>(null);
  salv.current ??= new Salvamento({
    revisao: fluxo.revisao,
    enviar: async (revisao, documento, est, sinal) => {
      // O banco só confere a forma: um documento que o lerDocumento recusa salvaria e depois não abriria mais.
      const lido = lerDocumento(documento);
      if (!lido.documento) return { ok: false, motivo: 'recusado', mensagem: lido.problemas.map((p) => p.mensagem).join(' ') };
      const r = await supabase.rpc('salvar_fluxo', { p_fluxo: fluxo.id, p_revisao: revisao, p_documento: documento, p_estilo: est }).abortSignal(sinal);
      return r.error ? motivoDoErro(r.error, r.status) : { ok: true, revisao: r.data as number };
    },
    // Pra saber se um envio que ficou sem resposta chegou (senão o próximo daria um falso conflito).
    ler: async () => {
      const r = await supabase.from('fluxos').select('revisao, documento, estilo').eq('id', fluxo.id).maybeSingle();
      return r.data;
    },
    aoMudar: (s, mensagem) => setSituacao({ s, ...(mensagem && { mensagem }) }),
    guardar: (copia) => {
      try {
        if (copia) localStorage.setItem(chaveLocal(fluxo.id), JSON.stringify(copia));
        else localStorage.removeItem(chaveLocal(fluxo.id));
      } catch {
        // Sem armazenamento no navegador: segue sem a cópia.
      }
    },
  });

  // Trava: pega ao abrir e renova; quem não tem a trava só vê (e dá play). Ao sair, solta.
  const token = useRef<string | null>(null);
  const minha = useRef(false);
  /** Até quando (relógio daqui) a trava confirmada vale, mesmo sem conseguir renovar. */
  const minhaAte = useRef(0);
  /** O banco já disse que era de outra pessoa: o documento na tela pode estar velho. */
  const jaFoiOutra = useRef(false);
  useEffect(() => {
    let vivo = true;
    let pedindo = false;
    let parou = false;
    let deNovo: ReturnType<typeof setTimeout> | undefined;
    const pegar = async () => {
      if (pedindo || parou) return;
      pedindo = true;
      clearTimeout(deNovo);
      let r: { data: unknown; error: unknown };
      // Um pedido que nunca responde (conexão morta) seguraria o `pedindo` pra sempre e nenhuma renovação sairia mais:
      // em 15 s desiste e conta como falha de rede. Com setTimeout (e não AbortSignal.timeout) pra seguir o mesmo
      // relógio dos outros temporizadores.
      const ctl = new AbortController();
      const limite = setTimeout(() => ctl.abort(), LIMITE_TRAVA);
      try {
        r = await supabase.rpc('pegar_trava', { p_fluxo: fluxo.id }).abortSignal(ctl.signal);
      } catch (erro) {
        r = { data: null, error: erro };
      } finally {
        clearTimeout(limite);
        pedindo = false;
      }
      if (!vivo) return;
      const d = r.data as { ok: boolean; por?: string | null; ate?: string | null } | null;
      if (r.error || !d) {
        // Não deu pra perguntar (rede, 5xx, login): não é "outra pessoa". Enquanto a última trava confirmada vale,
        // segue editando; depois, fica só vendo até conseguir confirmar. Tenta de novo logo.
        deNovo = setTimeout(() => void pegar(), DE_NOVO_TRAVA);
        if (minha.current && Date.now() < minhaAte.current) return;
        return setTrava({ estado: 'incerta' });
      }
      if (!d.ok) {
        minha.current = false;
        jaFoiOutra.current = true;
        return setTrava({ estado: 'outra', por: d.por ?? null, ate: d.ate ?? null });
      }
      if (!minha.current && jaFoiOutra.current) {
        // Quem só via ganhou a trava, mas a tela tem o documento (e a revisão) de quando abriu: editar daqui daria
        // um conflito no primeiro salvamento. Solta a trava (pra não segurar à toa) e pede pra recarregar.
        parou = true;
        void supabase.rpc('soltar_trava', { p_fluxo: fluxo.id });
        return setTrava({ estado: 'liberou' });
      }
      minhaAte.current = Date.now() + TRAVA_VALE;
      if (!minha.current) {
        minha.current = true;
        recuperarCopia();
      }
      setTrava({ estado: 'minha' });
    };
    void pegar();
    // O token muda (renova a cada hora): o soltar com keepalive precisa do atual, senão dá 401 ao fechar.
    void supabase.auth.getSession().then(({ data }) => (token.current = data.session?.access_token ?? null));
    const { data: auth } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      token.current = sessao?.access_token ?? null;
    });
    const intervalo = setInterval(() => void pegar(), RENOVAR_TRAVA);
    // A rede voltou, a aba voltou a aparecer ou a página voltou do cache: o intervalo pode ter ficado parado (aba
    // escondida, computador dormindo), então confirma a trava já. Com a rede de volta, o salvamento também tenta já.
    const voltouRede = () => {
      void pegar();
      salv.current?.tentarJa();
    };
    const visivel = () => document.visibilityState === 'visible' && void pegar();
    const voltouDoCache = (e: PageTransitionEvent) => e.persisted && void pegar();
    const soltar = () => {
      if (!minha.current || !token.current) return;
      // keepalive: o pedido segue mesmo com a página fechando.
      void fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/soltar_trava`, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${token.current}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_fluxo: fluxo.id }),
      }).catch(() => {});
    };
    const antesDeSair = (e: BeforeUnloadEvent) => {
      // Parado (conflito, trava perdida, recusa), não há o que esperar: o "Recarregar" da faixa não pode abrir o
      // "sair do site?". A cópia, quando vale, já está no navegador.
      if (salv.current?.sujo && !salv.current.parado) {
        void salv.current.agora();
        e.preventDefault();
      }
    };
    addEventListener('pagehide', soltar);
    addEventListener('beforeunload', antesDeSair);
    addEventListener('online', voltouRede);
    addEventListener('pageshow', voltouDoCache);
    document.addEventListener('visibilitychange', visivel);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      clearTimeout(deNovo);
      auth.subscription.unsubscribe();
      removeEventListener('pagehide', soltar);
      removeEventListener('beforeunload', antesDeSair);
      removeEventListener('online', voltouRede);
      removeEventListener('pageshow', voltouDoCache);
      document.removeEventListener('visibilitychange', visivel);
      // Saindo pra outra tela: espera o que falta chegar e solta a trava. Sem `parar`: no modo estrito do React a
      // limpeza roda uma vez ao montar, e sem rede o salvamento segue tentando (a cópia está no navegador).
      void salv.current?.agora().finally(soltar);
    };
    // Uma vez por fluxo aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fluxo.id]);

  /**
   * O que não chegou no banco da última vez (sem rede, ou recusado porque um responsável foi apagado) e partiu da
   * revisão que o salvamento tem agora volta pro quadro. Responsável que não existe mais sai da peça: senão o banco
   * recusaria de novo.
   */
  function recuperarCopia() {
    let copia = null;
    try {
      copia = copiaValida(JSON.parse(localStorage.getItem(chaveLocal(fluxo.id)) ?? 'null'), salv.current!.revisao);
    } catch {
      return;
    }
    if (!copia) return;
    const existem = new Set(cadastrosIniciais.map((k) => k.id));
    let documento = copia.documento;
    const orfas = documento.pecas.filter((p) => p.responsavel && !existem.has(p.responsavel));
    for (const p of orfas) documento = D.mudarPeca(documento, p.id, { responsavel: undefined });
    mudarHist(comecar(documento));
    trocarEstilo(lerEstilo(copia.estilo));
    salv.current!.mudou(documento, lerEstilo(copia.estilo));
    avisar(
      orfas.length
        ? `Voltaram as mudanças que não tinham chegado ao banco (sem o responsável apagado em ${orfas.length === 1 ? '1 peça' : `${orfas.length} peças`}).`
        : 'Voltaram as mudanças que não tinham chegado ao banco.',
    );
  }

  // ---------- Mudanças no documento ----------
  const parar = () => {
    setPlay(null);
    setMostrados(0);
    setEscolhendoInicio(null);
  };

  /** Toda mudança no documento parte do mais recente (`docAtual()`), nunca do `doc` deste desenho. */
  const editar = (novo: Documento, selecao?: D.Selecao) => {
    const v = vivo.current;
    if (v.soLeitura || novo === docAtual()) return;
    if (v.play) parar();
    mudarHist(registrar(histRef.current, novo));
    salv.current!.mudou(novo, estiloRef.current);
    if (selecao !== undefined) setSel(selecao);
  };

  // Em só leitura o estilo não muda: mudaria aqui e iria junto no primeiro salvamento depois de pegar a trava.
  const mudarEstilo = (e: Estilo) => {
    if (vivo.current.soLeitura) return;
    trocarEstilo(e);
    setVelocidadeVista(null);
    salv.current!.mudou(docAtual(), e);
  };
  /** A velocidade do play: quem só vê também ajusta, só na tela dele (não vai pro estilo nem pro salvamento). */
  const mudarVelocidade = (v: number) => (vivo.current.soLeitura ? setVelocidadeVista(v) : mudarEstilo({ ...estiloRef.current, velocidade: v }));

  const historia = (f: (h: Historico) => Historico) => {
    if (soLeitura) return;
    if (play) parar();
    const antes = histRef.current;
    const h = f(antes);
    if (h === antes) return;
    mudarHist(h);
    salv.current!.mudou(h.atual, estiloRef.current);
    if (!D.existe(h.atual, sel)) setSel(null);
  };

  /** Cria e seleciona. `renomear`: abre o campo de nome (ponteiro); pelo teclado, a peça só ganha o foco. */
  const criar = (f: TipoPeca | 'grupo' | 'nota', x: number, y: number, renomear = true) => {
    const id = novoId(f === 'grupo' ? 'g' : f === 'nota' ? 'n' : 'p');
    if (f === 'grupo') return editar(D.criarGrupo(docAtual(), id, x, y), { tipo: 'grupo', id });
    if (f === 'nota') {
      editar(D.criarNota(docAtual(), id, x, y), { tipo: 'nota', id });
      return renomear ? setRenomeando(id) : setFocar(id);
    }
    editar(D.criarPeca(docAtual(), id, f, x, y), { tipo: 'peca', id });
    if (renomear) setRenomeando(id);
    else setFocar(id);
  };
  // A peça (ou nota) criada pelo teclado recebe o foco depois de aparecer no quadro: Enter nela renomeia.
  const [focar, setFocar] = useState<string | null>(null);
  useEffect(() => {
    if (!focar) return;
    document.querySelector<HTMLElement>(`[data-peca="${focar}"], [data-nota="${focar}"]`)?.focus();
    setFocar(null);
  }, [focar]);

  const ligar = (de: string, para: string) => {
    const r = D.ligar(docAtual(), novoId('c'), de, para);
    if ('erro' in r) return r.erro === 'repetida' && avisar('Essas duas peças já estão ligadas.');
    editar(r.doc, { tipo: 'conexao', id: r.conexao.id });
  };

  const criarLigada = (origem: string, tipo: TipoPeca, onde?: { x: number; y: number }) => {
    const id = novoId('p');
    editar(D.criarLigada(docAtual(), id, novoId('c'), origem, tipo, onde), { tipo: 'peca', id });
    setRenomeando(id);
  };

  const apagarSelecao = () => {
    if (!sel) return;
    editar(D.apagar(docAtual(), sel), null);
  };

  const duplicar = (id: string) => {
    const novo = novoId('p');
    editar(D.duplicar(docAtual(), id, novo), { tipo: 'peca', id: novo });
  };

  const selecionar = (s: D.Selecao) => {
    setSel(s);
    if (s) setAba('prop');
    if (s && innerWidth <= 820) setPainelAberto(true);
  };

  // ---------- Dados do fluxo (colunas) e cadastros ----------
  // Parte do mais recente: duas mudanças seguidas (nome e descrição no mesmo desenho) não apagam uma à outra. Se o banco recusa,
  // volta só os campos desta mudança.
  const mudarDados = async (d: DadosDoFluxo) => {
    if (vivo.current.soLeitura) return;
    const atual = dadosRef.current;
    const antes = Object.fromEntries(Object.keys(d).map((k) => [k, atual[k as keyof DadosFluxo]])) as Partial<DadosFluxo>;
    dadosRef.current = { ...atual, ...d } as DadosFluxo;
    setDados(dadosRef.current);
    const r = await mudarFluxo(empresaId, fluxo.id, d);
    if (r.erro) {
      dadosRef.current = { ...dadosRef.current, ...antes };
      setDados(dadosRef.current);
      avisar(r.erro);
    }
  };

  const criarUmCadastro = async (tipo: string, nome: string): Promise<Cadastro | null> => {
    const r = await criarCadastro(empresaId, tipo, nome);
    if (!r.cadastro) {
      avisar(r.erro ?? 'Não deu pra cadastrar.');
      return null;
    }
    const k = r.cadastro;
    setCadastros((ks) => (ks.some((x) => x.id === k.id) ? ks : [...ks, k].sort((a, b) => a.nome.localeCompare(b.nome))));
    avisar(`“${k.nome}” virou cadastro (${tipos.find((t) => t.chave === k.tipo)?.nome ?? k.tipo}). Dá pra usar em outras peças.`);
    return k;
  };

  const renomearUmCadastro = async (id: string, nome: string) => {
    const r = await renomearCadastro(empresaId, id, nome);
    if (r.erro) return avisar(r.erro);
    setCadastros((ks) => ks.map((k) => (k.id === id ? { ...k, nome: nome.trim() } : k)));
  };

  const verCadastro = (id: string) => {
    const ids = doc.pecas.filter((p) => p.responsavel === id).map((p) => p.id);
    if (!ids.length) return avisar('Nenhuma peça deste fluxo usa esse cadastro.');
    setSel({ tipo: 'peca', id: ids[0]! });
    quadro.current?.enquadrar(ids);
  };

  const nomesCadastros = useMemo(() => new Map(cadastros.map((k) => [k.id, k.nome])), [cadastros]);

  // ---------- Play ----------
  const [play, setPlay] = useState<Play | null>(null);
  const [docPlay, setDocPlay] = useState<Documento>(doc);
  const [mostrados, setMostrados] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [escolhendoInicio, setEscolhendoInicio] = useState<string[] | null>(null);
  const ctx = useMemo(() => ({ cadastros, canal: dados.canal }), [cadastros, dados.canal]);
  // Pro `editar` chamado depois de um await: a trava e o play de agora, não os de quando a ação nasceu.
  const vivo = useRef({ soLeitura, play });
  vivo.current = { soLeitura, play };
  const exec = useMemo(() => (play ? rodar(docPlay, ctx, play) : null), [play, docPlay, ctx]);
  const vis = useMemo(() => (exec ? verVisual(exec.eventos, mostrados) : null), [exec, mostrados]);

  const comecarEm = (inicio: string) => {
    setDocPlay(doc);
    setPlay({ inicio, quando: play?.quando ?? agora(), modo: play?.modo ?? 'relogio', escolhas: [] });
    setMostrados(0);
    setPausado(false);
    setEscolhendoInicio(null);
    setRenomeando(null);
  };

  const darPlay = () => {
    const inicios = doc.pecas.filter((p) => p.tipo === 'inicio').map((p) => p.id);
    const escolhido = sel?.tipo === 'peca' && inicios.includes(sel.id) ? sel.id : null;
    if (escolhido) return comecarEm(escolhido);
    if (!inicios.length) return avisar('Cria uma peça Início pra dar play.');
    if (inicios.length === 1) return comecarEm(inicios[0]!);
    setPlay(null);
    setEscolhendoInicio(inicios);
  };

  // A água anda: cada evento aparece depois do tempo do anterior (o cano espera a água chegar).
  useEffect(() => {
    if (!exec || pausado) return;
    const ev = exec.eventos;
    if (mostrados >= ev.length) return;
    if (mostrados === 0) return setMostrados(1);
    const e = espera(ev[mostrados - 1]!);
    if (e === 'cano') return;
    const t = setTimeout(() => setMostrados((m) => m + 1), e / estiloVisto.velocidade);
    return () => clearTimeout(t);
  }, [exec, mostrados, pausado, estiloVisto.velocidade]);

  // A água que chegou é a do evento `i`: um aviso repetido (ou atrasado, de um cano que já passou) não pula evento.
  const aguaChegou = (i: number) => setMostrados((m) => (m === i ? m + 1 : m));

  const escolher = (conexao: string) => {
    if (!play || !exec?.pendente?.opcoes.some((o) => o.conexao === conexao)) return;
    setPlay({ ...play, escolhas: [...play.escolhas, conexao] });
  };

  const voltar = () => {
    if (!play) return;
    if (!(exec?.escolhas ?? play.escolhas).length) {
      setPlay({ ...play });
      return setMostrados(0);
    }
    const p = voltarPlay(play, exec?.escolhas);
    setPlay(p);
    setMostrados(rodar(docPlay, ctx, p).eventos.length);
    setPausado(false);
  };

  const recomecar = () => {
    if (!play) return;
    setPlay({ ...play, escolhas: [] });
    setMostrados(0);
    setPausado(false);
  };

  // Escolha automática (pra apresentar) e câmera seguindo a água.
  useEffect(() => {
    if (!vis?.pergunta || pausado || !estilo.autoEscolha) return;
    const primeira = vis.pergunta.opcoes[0]!.conexao;
    const t = setTimeout(() => escolher(primeira), estilo.autoEscolha * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis?.pergunta, pausado, estilo.autoEscolha]);

  useEffect(() => {
    if (!vis?.atual || !estilo.camera) return;
    const destinos = docPlay.conexoes.filter((c) => c.de === vis.atual).map((c) => c.para);
    quadro.current?.enquadrar([vis.atual, ...destinos]);
  }, [vis?.atual, estilo.camera, docPlay]);

  // ---------- Teclado ----------
  const teclas = useRef<(e: KeyboardEvent) => void>(() => {});
  teclas.current = (e: KeyboardEvent) => {
    if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    // Desfazer, refazer e apagar no meio de um arrasto encerram o arrasto (a peça fica onde está): senão o quadro
    // seguinte reaplicaria a posição em cima do que acabou de ser desfeito ou apagado.
    if (mod && k === 'z') {
      e.preventDefault();
      quadro.current?.encerrarGesto();
      return historia(e.shiftKey ? refazer : desfazer);
    }
    if (mod && k === 'y') {
      e.preventDefault();
      quadro.current?.encerrarGesto();
      return historia(refazer);
    }
    if (mod && k === 'd' && sel?.tipo === 'peca') {
      e.preventDefault();
      return duplicar(sel.id);
    }
    if (vis?.pergunta && !mod) {
      const valores = new Map(docPlay.conexoes.map((c) => [c.id, c.valor]));
      const o = opcaoDaTecla(vis.pergunta.opcoes, e.key, valores);
      if (o) {
        e.preventDefault();
        return escolher(o.conexao);
      }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !play) {
      e.preventDefault();
      quadro.current?.encerrarGesto();
      return apagarSelecao();
    }
    if (e.key === 'Escape') {
      if (ferramenta !== 'selecionar') return setFerramenta('selecionar');
      if (sel) return setSel(null);
      return;
    }
    // Enter num botão ou link (Dar play, Desfazer, Painel, menu) é dele: ativa o botão, não renomeia. A peça focada
    // (também role=button) trata o Enter no quadro e não deixa ele chegar aqui.
    if (e.key === 'Enter' && (e.target as Element | null)?.closest?.('button, a, [role=button], [role=menuitem], [role=option], [role=tab], summary')) return;
    if (e.key === 'Enter' && (sel?.tipo === 'peca' || sel?.tipo === 'nota') && !soLeitura && !play) {
      e.preventDefault();
      return setRenomeando(sel.id);
    }
    if (!mod && k === 'v') setFerramenta('selecionar');
    if (!mod && k === 'h') setFerramenta('mao');
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => teclas.current(e);
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, []);

  // ---------- Barra de formas: clique escolhe, arrastar solta a forma no quadro ----------
  const apertarFerramenta = (t: Ferramenta, e: React.PointerEvent) => {
    const x0 = e.clientX;
    const y0 = e.clientY;
    let arrastou = false;
    const ponteiro = e.pointerId;
    const mover = (ev: PointerEvent) => {
      if (ev.pointerId !== ponteiro) return;
      if (!arrastou && criaAlgo(t) && !soLeitura && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) arrastou = true;
      if (arrastou) setFantasma({ t, x: ev.clientX, y: ev.clientY });
    };
    const largar = () => {
      removeEventListener('pointermove', mover);
      removeEventListener('pointerup', soltar);
      removeEventListener('pointercancel', cancelar);
      setFantasma(null);
    };
    // O sistema tomou o ponteiro (rolagem no toque, alerta): sem os ouvintes pendurados e sem o fantasma na tela.
    const cancelar = (ev: PointerEvent) => ev.pointerId === ponteiro && largar();
    const soltar = (ev: PointerEvent) => {
      if (ev.pointerId !== ponteiro) return;
      largar();
      if (arrastou && criaAlgo(t)) {
        if (quadro.current?.contem(ev.clientX, ev.clientY)) {
          const w = quadro.current.paraMundo(ev.clientX, ev.clientY);
          criar(t, w.x, w.y);
        }
        return setFerramenta('selecionar');
      }
      alternarFerramenta(t);
    };
    addEventListener('pointermove', mover);
    addEventListener('pointerup', soltar);
    addEventListener('pointercancel', cancelar);
  };

  /**
   * Ferramenta ativada sem ponteiro: quem não usa mouse não tem como clicar no quadro, então a forma nasce já no meio
   * da parte visível (na grade), selecionada e com o foco; a ferramenta volta pro Selecionar. Selecionar e Mover o
   * quadro só são escolhidos, como no clique.
   */
  const ativarPeloTeclado = (t: Ferramenta) => {
    if (!criaAlgo(t)) return alternarFerramenta(t);
    const c = quadro.current?.centro();
    if (soLeitura || !c) return;
    criar(t, c.x, c.y, false);
    setFerramenta('selecionar');
  };

  /** Clique numa ferramenta: escolhe; clicar de novo numa forma já escolhida volta pro Selecionar. */
  const alternarFerramenta = (t: Ferramenta) => {
    const nova = ferramenta === t && criaAlgo(t) ? 'selecionar' : t;
    setFerramenta(nova);
    if (criaAlgo(nova)) avisar(`Clique no quadro pra pôr ${nova === 'grupo' ? 'o grupo' : nova === 'nota' ? 'a nota' : FORMAS[nova].nome}.`);
  };

  const botaoFerramenta = (t: Ferramenta, nome: string, icone: string, dica: string) => (
    <button
      key={t}
      className="ferr"
      type="button"
      aria-pressed={ferramenta === t}
      aria-label={nome}
      disabled={soLeitura && criaAlgo(t)}
      onPointerDown={(e) => apertarFerramenta(t, e)}
      // Teclado (Enter, espaço) e leitor de tela: clique sem ponteiro (`detail` 0). O do mouse o pointerup já tratou.
      onClick={(e) => e.detail === 0 && ativarPeloTeclado(t)}
    >
      <Icone nome={icone} />
      <span className="dica-ferr">
        {nome} · {dica}
      </span>
    </button>
  );

  const textoSituacao: Record<Situacao, string> = {
    salvo: 'salvo',
    esperando: 'salvando…',
    salvando: 'salvando…',
    sem_rede: 'sem conexão: guardado neste navegador, tentando de novo',
    sem_sessao: 'o login venceu: entre de novo (em outra aba) pra salvar; está guardado neste navegador',
    conflito: 'não salvo',
    sem_trava: 'não salvo',
    recusado: 'não salvo',
  };
  const corAgua = (canal: string | null) => corDoCanal(estilo, canais, canal ?? dados.canal);

  return (
    <div className={`editor${estilo.ondas ? ' ondas' : ''}${estilo.holofote ? ' holofote-on' : ''}${vis?.pergunta ? ' escolhendo' : ''}`}>
      {/* O nome do fluxo como título da página pro leitor de tela (na tela ele é o campo editável). */}
      <h1 className="so-leitor">{dados.nome}</h1>
      <div className="cabeca-editor">
        {/* Região viva montada vazia: o leitor de tela só anuncia o que muda dentro de uma região que já existia. */}
        <div className="vivo" role="status">
          {trava.estado === 'outra' && !parado && (
            <div className="faixa">
              {trava.por ? `${trava.por} está editando este fluxo` : 'Outra pessoa está editando este fluxo'}
              {trava.ate && ` (até ${new Date(trava.ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })}, se parar de mexer)`}. Dá pra ver e dar play; a
              edição libera quando a trava vencer ou a pessoa fechar o fluxo.
            </div>
          )}
          {trava.estado === 'incerta' && !parado && (
            <div className="faixa">Não deu pra confirmar a edição deste fluxo com o banco (sem conexão?). Dá pra ver e dar play; tentando de novo.</div>
          )}
          {trava.estado === 'liberou' && !parado && (
            <div className="faixa">
              A edição deste fluxo liberou. Recarregue pra editar a versão que está no banco.
              <button className="botao pequeno" type="button" onClick={() => location.reload()}>
                Recarregar
              </button>
            </div>
          )}
        </div>
        {parado && (
          <div className="faixa erro" role="alert">
            {situacao.s === 'conflito'
              ? 'Este fluxo foi salvo em outro lugar (outra pessoa ou outra aba) enquanto estava aberto aqui. As últimas mudanças daqui não foram salvas: recarregue pra continuar da versão que está no banco.'
              : situacao.s === 'sem_trava'
                ? 'Outra pessoa pegou a edição deste fluxo. As últimas mudanças daqui não foram salvas: recarregue pra ver como ficou.'
                : `O banco recusou as últimas mudanças${situacao.mensagem ? ` (${situacao.mensagem})` : ''}. Recarregue pra continuar.`}
            <button className="botao pequeno" type="button" onClick={() => location.reload()}>
              Recarregar
            </button>
          </div>
        )}
        <header className="topo">
          <input
            key={dados.nome}
            className="nome-fluxo"
            type="text"
            aria-label="Nome do fluxo"
            defaultValue={dados.nome}
            disabled={soLeitura}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              if (!v) e.currentTarget.value = dados.nome;
              else if (v !== dados.nome) void mudarDados({ nome: v });
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <span className={`salvo${parado ? ' erro' : ''}`} role="status" data-testid="salvamento">
            {trava.estado === 'pegando' ? 'abrindo…' : trava.estado === 'incerta' && !parado ? 'não deu pra confirmar a edição' : soLeitura && !parado ? 'só leitura' : textoSituacao[situacao.s]}
          </span>
          <div className="empurra">
            <button className="bi" type="button" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={soLeitura || !hist.antes.length} onClick={() => historia(desfazer)}>
              <Icone nome="desfazer" />
            </button>
            <button className="bi" type="button" aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled={soLeitura || !hist.depois.length} onClick={() => historia(refazer)}>
              <Icone nome="refazer" />
            </button>
            <button className="botao so-celular" type="button" onClick={() => setPainelAberto((a) => !a)}>
              Painel
            </button>
            <button className="botao primario b-play" type="button" onClick={play || escolhendoInicio ? parar : darPlay}>
              <Icone nome={play || escolhendoInicio ? 'parar' : 'play'} />
              {play || escolhendoInicio ? 'Parar' : 'Dar play'}
            </button>
          </div>
        </header>
      </div>

      <div className="area">
        <nav className="ferramentas" aria-label="Formas">
          {botaoFerramenta('selecionar', 'Selecionar', 'selecionar', 'V')}
          {botaoFerramenta('mao', 'Mover o quadro', 'mao', 'H')}
          <span className="sep" />
          {ORDEM_FORMAS.map((t) => botaoFerramenta(t, FORMAS[t].nome, t, 'clique ou arraste'))}
          <span className="sep" />
          {botaoFerramenta('grupo', 'Grupo', 'grupo', 'moldura que junta peças')}
          {botaoFerramenta('nota', 'Nota', 'nota', 'recado no quadro')}
        </nav>

        <Quadro
          ref={quadro}
          doc={play ? docPlay : doc}
          estilo={estiloVisto}
          canais={canais}
          canalFluxo={dados.canal}
          nomesCadastros={nomesCadastros}
          sel={sel}
          ferramenta={ferramenta}
          soLeitura={soLeitura}
          play={vis}
          pausado={pausado}
          aoAguaChegar={() => aguaChegou(mostrados)}
          renomeando={renomeando}
          acoes={{
            selecionar,
            criar,
            criarLigada,
            ligar,
            mudar: (f, primeiro) => {
              if (vivo.current.soLeitura) return;
              const h = histRef.current;
              const d = f(h.atual);
              if (d === h.atual) return;
              // Um passo por arrasto: o primeiro quadro registra, os seguintes substituem a cabeça. Mas se algo entrou
              // no histórico no meio (um responsável que chegou do servidor), a cabeça não é mais deste arrasto:
              // substituir apagaria esse passo do desfazer, então o quadro vira passo novo.
              const novo = primeiro || ultimoQuadro.current !== h ? registrar(h, d) : substituir(h, d);
              ultimoQuadro.current = novo;
              mudarHist(novo);
              salv.current!.mudou(d, estiloRef.current);
            },
            renomear: setRenomeando,
            gravarNome: (id, texto) => {
              setRenomeando(null);
              const t = texto.trim();
              const d = docAtual();
              if (!t) return;
              if (d.pecas.some((p) => p.id === id)) {
                if (d.pecas.find((p) => p.id === id)!.nome !== t) editar(D.mudarPeca(d, id, { nome: t }));
              } else if (d.grupos.some((g) => g.id === id)) {
                if (d.grupos.find((g) => g.id === id)!.nome !== t) editar(D.mudarGrupo(d, id, { nome: t }));
              } else if (d.notas.some((n) => n.id === id) && d.notas.find((n) => n.id === id)!.texto !== t) editar(D.mudarNota(d, id, { texto: t }));
            },
            escolher,
            usarFerramenta: setFerramenta,
          }}
        >
          {(play || escolhendoInicio) && (
            <CartaoPlay
              doc={docPlay}
              play={play}
              visual={vis}
              pausado={pausado}
              velocidade={estiloVisto.velocidade}
              autoEscolha={estilo.autoEscolha}
              corAgua={corAgua}
              canais={canais}
              inicios={escolhendoInicio}
              acoes={{
                escolher,
                pausar: () => setPausado((p) => !p),
                voltar,
                recomecar,
                parar,
                velocidade: mudarVelocidade,
                quando: (q) => {
                  if (!play) return;
                  setPlay({ ...play, quando: q, escolhas: [] });
                  setMostrados(0);
                },
                relogio: (decide) => {
                  if (!play) return;
                  setPlay({ ...play, modo: decide ? 'relogio' : 'livre', escolhas: [] });
                  setMostrados(0);
                },
                comecarEm,
              }}
            />
          )}
        </Quadro>

        <Painel
          aba={aba}
          setAba={setAba}
          aberto={painelAberto}
          doc={doc}
          sel={sel}
          fluxo={dados}
          estilo={estilo}
          canais={canais}
          cadastros={cadastros}
          tipos={tipos}
          soLeitura={soLeitura}
          acoes={{
            mudarPeca: (id, patch) => editar(D.mudarPeca(docAtual(), id, patch)),
            mudarConexao: (id, patch) => editar(D.mudarConexao(docAtual(), id, patch)),
            inverter: (id) => editar(D.inverterConexao(docAtual(), id)),
            mudarGrupo: (id, patch) => editar(D.mudarGrupo(docAtual(), id, patch)),
            mudarNota: (id, patch) => editar(D.mudarNota(docAtual(), id, patch)),
            apagar: apagarSelecao,
            duplicar,
            selecionar,
            mudarFluxo: (d) => void mudarDados(d),
            apagarFluxo: async () => {
              salv.current!.parar();
              const r = await apagarFluxo(empresaId, fluxo.id);
              if (r.erro) {
                salv.current!.retomar();
                return avisar(r.erro);
              }
              router.push(`/e/${empresaId}`);
            },
            criarCadastro: criarUmCadastro,
            renomearCadastro: renomearUmCadastro,
            verCadastro,
            mudarEstilo,
          }}
        />
      </div>

      {fantasma && criaAlgo(fantasma.t) && (
        <div className="fantasma" style={{ left: fantasma.x - 30, top: fantasma.y - 20 }} aria-hidden="true">
          {fantasma.t === 'grupo' ? (
            <div className="grupo" style={{ position: 'static', width: 200, height: 120 }} />
          ) : fantasma.t === 'nota' ? (
            <div className="no t-nota" style={{ position: 'relative', width: 190, height: 110 }} />
          ) : (
            <div className={`no t-${fantasma.t}`} style={{ position: 'relative', width: FORMAS[fantasma.t].w, height: FORMAS[fantasma.t].h }}>
              <span className="tile">
                <Icone nome={fantasma.t} />
              </span>
              <span className="textos">
                <span className="titulo">{FORMAS[fantasma.t].nome}</span>
              </span>
            </div>
          )}
        </div>
      )}
      <div role="status">{aviso && <div className="aviso">{aviso}</div>}</div>
    </div>
  );
}
```

- [ ] **Passo 5: a rota do editor**

`apps/web/src/app/e/[empresa]/f/[fluxo]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { cache } from 'react';
import { Editor } from '@/componentes/editor/Editor';
import { cadastros, canais, fluxoParaEditar, tiposCadastro } from '@/lib/dados';

type Props = { params: Promise<{ empresa: string; fluxo: string }> };

// Uma leitura por pedido: o título e a página usam o mesmo fluxo.
const fluxoDoPedido = cache(fluxoParaEditar);

/** O nome do fluxo no título da aba (no editor, ele acompanha quando renomeia). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { empresa, fluxo } = await params;
  try {
    const f = await fluxoDoPedido(empresa, fluxo);
    return { title: `${f.nome} · Journey` };
  } catch (erro) {
    // notFound e redirect (login vencido) seguem pro Next; um documento que não abre fica com o título genérico e a
    // página de erro do fluxo aparece pelo erro da própria página (aqui ele deixava a aba sem título).
    unstable_rethrow(erro);
    return { title: 'Editor · Journey' };
  }
}

export default async function PaginaEditor({ params }: Props) {
  const { empresa: empresaId, fluxo: fluxoId } = await params;
  const [f, cs, ks, ts] = await Promise.all([fluxoDoPedido(empresaId, fluxoId), canais(empresaId), cadastros(empresaId), tiposCadastro(empresaId)]);
  // Canal arquivado some da lista, a não ser que o fluxo ainda use (como principal ou numa peça).
  const usados = new Set([f.canal, ...f.documento.pecas.map((p) => p.canal)]);
  return (
    <Editor
      empresaId={empresaId}
      fluxo={f}
      canais={cs.filter((c) => !c.arquivado || usados.has(c.chave)).map(({ chave, nome, cor }) => ({ chave, nome, cor }))}
      cadastros={ks}
      tipos={ts}
    />
  );
}
```

`apps/web/src/app/e/[empresa]/f/[fluxo]/error.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/**
 * Quando o fluxo não abre (documento que não passa na validação, banco fora do ar…). Em produção o Next esconde a
 * mensagem do servidor: mostra só o código pra achar no log. `retry` busca a página de novo no servidor.
 */
export default function ErroDoFluxo({ error, retry }: { error: unknown; retry: () => void }) {
  const { empresa } = useParams<{ empresa: string }>();
  const codigo = error instanceof Error && 'digest' in error ? String(error.digest) : null;
  return (
    <main className="pagina">
      <div className="cartao" style={{ display: 'grid', gap: 12 }}>
        <h2>Não deu pra abrir este fluxo</h2>
        <p className="aviso-caixa erro">
          Tenta de novo; se continuar, avisa quem cuida do Journey.
          {codigo && <span className="mono"> (código {codigo})</span>}
        </p>
        <div className="linha-form">
          <button className="botao primario" type="button" onClick={retry}>
            Tentar de novo
          </button>
          <Link className="botao" href={`/e/${empresa}`}>
            Voltar pros fluxos
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Passo 6: a tela Fluxos** (substitui a lista de jornadas)

`apps/web/src/app/e/[empresa]/page.tsx`:

```tsx
import { MODELOS } from '@journey/fluxo';
import { canais, fluxos } from '@/lib/dados';
import { ListaFluxos } from './lista';

export default async function Fluxos({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const [fs, cs] = await Promise.all([fluxos(id), canais(id)]);
  return (
    <ListaFluxos
      empresaId={id}
      fluxos={fs}
      canais={cs.map(({ chave, nome, cor, arquivado }) => ({ chave, nome, cor, arquivado }))}
      modelos={MODELOS.map((m) => ({ chave: m.chave, nome: m.nome, descricao: m.descricao, canal: m.canal, pecas: m.documento.pecas.length }))}
    />
  );
}
```

`apps/web/src/app/e/[empresa]/lista.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { criarDeModelo, criarFluxo } from '@/acoes/fluxos';
import type { FluxoResumo } from '@/lib/dados';
import { FUSO } from '@/lib/fuso';

interface CanalLista {
  chave: string;
  nome: string;
  cor: string;
  arquivado: boolean;
}

interface ModeloLista {
  chave: string;
  nome: string;
  descricao: string;
  canal: string;
  pecas: number;
}

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: FUSO });
const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** A casa da empresa: os fluxos, a busca e o "Novo fluxo" (em branco ou a partir de um modelo). */
export function ListaFluxos({ empresaId, fluxos, canais, modelos }: { empresaId: string; fluxos: FluxoResumo[]; canais: CanalLista[]; modelos: ModeloLista[] }) {
  const router = useRouter();
  const [novo, setNovo] = useState(fluxos.length === 0);
  const [busca, setBusca] = useState('');
  const [nome, setNome] = useState('');
  const [canal, setCanal] = useState(canais.find((c) => !c.arquivado)?.chave ?? '');
  const [erro, setErro] = useState('');
  const [ocupado, comecar] = useTransition();
  const canalDe = (k: string | null) => canais.find((c) => c.chave === k);
  const vistos = busca.trim() ? fluxos.filter((f) => semAcento(`${f.nome} ${f.descricao} ${canalDe(f.canal)?.nome ?? ''}`).includes(semAcento(busca.trim()))) : fluxos;

  const abrir = (r: { id?: string; erro?: string }) => {
    if (r.erro || !r.id) return setErro(r.erro ?? 'Não deu certo agora.');
    router.push(`/e/${empresaId}/f/${r.id}`);
  };

  return (
    <main className="pagina">
      <div className="cabeca">
        <h1>Fluxos</h1>
        <div className="linha-form">
          {fluxos.length > 0 && (
            <input className="entrada-texto" type="search" placeholder="Buscar fluxo" aria-label="Buscar fluxo" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: 220 }} />
          )}
          <button className="botao primario" type="button" onClick={() => setNovo((n) => !n)} aria-expanded={novo}>
            Novo fluxo
          </button>
        </div>
      </div>

      {novo && (
        <section className="cartao" aria-label="Novo fluxo" style={{ display: 'grid', gap: 16 }}>
          <div>
            <h2>Em branco</h2>
            <p className="mudo">Um quadro vazio pra desenhar do zero.</p>
            <form
              className="linha-form"
              onSubmit={(e) => {
                e.preventDefault();
                setErro('');
                comecar(async () => abrir(await criarFluxo(empresaId, nome, canal || null)));
              }}
            >
              <label className="campo" style={{ flex: '1 1 220px' }}>
                Nome do fluxo
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Cobrança no WhatsApp, Onboarding…" required maxLength={120} />
              </label>
              <label className="campo">
                Canal principal
                <select aria-label="Canal principal" value={canal} onChange={(e) => setCanal(e.target.value)}>
                  <option value="">sem canal</option>
                  {canais
                    .filter((c) => !c.arquivado)
                    .map((c) => (
                      <option key={c.chave} value={c.chave}>
                        {c.nome}
                      </option>
                    ))}
                </select>
              </label>
              <button className="botao primario" type="submit" disabled={ocupado}>
                Criar e abrir
              </button>
            </form>
          </div>
          <div>
            <h2>A partir de um modelo</h2>
            <p className="mudo">Um fluxo pronto pra adaptar. Os cadastros dele (filas, equipes, horário) entram nos da empresa.</p>
            <div className="grade" style={{ marginTop: 10 }}>
              {modelos.map((m) => (
                <button
                  key={m.chave}
                  type="button"
                  className="cartao"
                  style={{ textAlign: 'left', display: 'grid', gap: 6, cursor: 'pointer' }}
                  disabled={ocupado}
                  onClick={() => {
                    setErro('');
                    comecar(async () => abrir(await criarDeModelo(empresaId, m.chave)));
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: canalDe(m.canal)?.cor ?? 'var(--ink-3)' }} />
                    <b>{m.nome}</b>
                  </span>
                  <span className="mudo">{m.descricao}</span>
                  <span className="mudo mono" style={{ fontSize: 12 }}>
                    {m.pecas} peças · {canalDe(m.canal)?.nome ?? m.canal}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {erro && (
            <p className="aviso-caixa erro" role="alert">
              {erro}
            </p>
          )}
        </section>
      )}

      {fluxos.length > 0 &&
        (vistos.length ? (
          <div className="grade">
            {vistos.map((f) => {
              const c = canalDe(f.canal);
              return (
                <Link key={f.id} href={`/e/${empresaId}/f/${f.id}`} className="cartao" style={{ textDecoration: 'none', display: 'grid', gap: 6 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: c?.cor ?? 'var(--ink-3)' }} />
                    {c?.nome ?? 'sem canal'}
                  </span>
                  <h2>{f.nome}</h2>
                  {f.descricao && <span className="mudo">{f.descricao}</span>}
                  <span className="mudo" style={{ fontSize: 12.5 }}>
                    {f.pecas} peças · {f.editado_por ? `${f.editado_por}, ` : ''}
                    {quando(f.editado_em)}
                  </span>
                  {f.editando && <span className="selo info">{f.editando} está editando</span>}
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="vazio">Nenhum fluxo com “{busca}”.</p>
        ))}
    </main>
  );
}
```

- [ ] **Passo 7: o menu**

`apps/web/src/componentes/Nav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Nav({ empresaId }: { empresaId: string }) {
  const atual = usePathname();
  const base = `/e/${empresaId}`;
  const itens = [
    { href: base, rotulo: 'Fluxos', ativo: atual === base || atual.startsWith(`${base}/f/`) },
    { href: `${base}/cadastros`, rotulo: 'Cadastros', ativo: atual.startsWith(`${base}/cadastros`) },
    { href: `${base}/membros`, rotulo: 'Membros', ativo: atual.startsWith(`${base}/membros`) },
  ];
  return (
    <nav className="nav" aria-label="Seções">
      {itens.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.ativo ? 'page' : undefined}>
          {i.rotulo}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Passo 8: rodar e ver passar**

Run: `npm run typecheck && npm test -w apps/web && npm run e2e -- e2e/editor.spec.ts e2e/fluxos.spec.ts e2e/membros.spec.ts e2e/aceitacao.spec.ts --trace=off`
Expected: `tsc` sem saída; app `Tests  258 passed (258)` (com o Supabase no ar); os 6 de ponta a ponta passando.

- [ ] **Passo 9: commit**

```bash
git add apps/web
git commit -m "web: o editor de fluxos e a tela Fluxos" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 10: a tela Cadastros

**Arquivos:**
- Criar: `apps/web/e2e/cadastros.spec.ts`
- Criar: `apps/web/src/app/e/[empresa]/cadastros/page.tsx`, `tabela.tsx`

- [ ] **Passo 1: o teste de ponta a ponta** (critério 2 e o Horário)

`apps/web/e2e/cadastros.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

test('critério 2: o nome escrito na peça vira cadastro; renomear lá muda no fluxo', async ({ page, request }) => {
  test.setTimeout(90_000);
  await entrar(page, request, emailNovo('cadastros'));
  await page.getByLabel('Nome da empresa').fill('Empresa dos cadastros');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByLabel('Nome do fluxo').fill('Cobrança');
  await page.getByRole('button', { name: 'Criar e abrir' }).click();
  await expect(page).toHaveURL(/\/f\//);
  const fluxo = page.url();

  await page.getByRole('button', { name: 'Atendimento', exact: true }).click();
  await page.getByTestId('quadro').click({ position: { x: 300, y: 300 } });
  await page.getByLabel('Nome da peça').fill('Cobra o cliente');
  await page.getByLabel('Nome da peça').press('Enter');
  const resp = page.getByRole('combobox', { name: /Quem atende/ });
  await resp.fill('Fila Cobrança');
  await expect(page.getByRole('option', { name: /Criar “Fila Cobrança”/ })).toContainText('Fila');
  await resp.press('Enter');
  // O aviso some em 2,6 s: confere o que fica (o campo e a peça), não o aviso.
  await expect(resp).toHaveValue('Fila Cobrança');
  const naPeca = page.getByRole('button', { name: 'Atendimento: Cobra o cliente' });
  await expect(naPeca).toContainText('Fila Cobrança');
  await expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });

  await page.getByRole('link', { name: 'Cadastros' }).click();
  await expect(page.getByRole('link', { name: 'Cobrança' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apagar' })).toBeDisabled();
  const nome = page.getByLabel('Nome de Fila Cobrança');
  await nome.fill('Fila Recuperação');
  await nome.press('Enter');
  await expect(page.getByText('Agora é “Fila Recuperação” em todos os fluxos.')).toBeVisible();

  await page.goto(fluxo);
  await expect(page.getByRole('button', { name: 'Atendimento: Cobra o cliente' })).toContainText('Fila Recuperação');
});

test('horário: janelas editadas na tela de Cadastros', async ({ page, request }) => {
  test.setTimeout(60_000);
  await entrar(page, request, emailNovo('horario'));
  await page.getByLabel('Nome da empresa').fill('Empresa do horário');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('link', { name: 'Cadastros' }).click();
  await page.getByLabel('Novo cadastro').fill('Plantão');
  await page.getByLabel('Tipo', { exact: true }).selectOption('horario');
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await page.getByRole('button', { name: 'Janelas e feriados' }).click();
  await page.getByLabel('Fim').fill('24:00');
  await page.getByRole('button', { name: 'Salvar horário' }).click();
  await expect(page.getByText('Horário salvo.')).toBeVisible();
  await page.getByLabel('Fim').fill('07:00');
  await page.getByRole('button', { name: 'Salvar horário' }).click();
  await expect(page.getByText('Confere as janelas')).toBeVisible();
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npm run e2e -- e2e/cadastros.spec.ts --trace=off`
Expected: FAIL nos 2 (a rota `/cadastros` ainda não existe: o Next devolve 404).

- [ ] **Passo 3: a rota**

`apps/web/src/app/e/[empresa]/cadastros/page.tsx`:

```tsx
import { cadastros, tiposCadastro, usosDosCadastros } from '@/lib/dados';
import { TabelaCadastros } from './tabela';

export default async function Cadastros({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const [ks, ts, usos] = await Promise.all([cadastros(id), tiposCadastro(id), usosDosCadastros(id)]);
  return <TabelaCadastros empresaId={id} cadastros={ks} tipos={ts} usos={Object.fromEntries(usos)} />;
}
```

- [ ] **Passo 4: a tabela e o Horário**

`apps/web/src/app/e/[empresa]/cadastros/tabela.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { DIAS, camposHorario, type Cadastro, type CamposHorario, type Dia } from '@journey/fluxo';
import { apagarCadastro, criarCadastro, mudarHorario, renomearCadastro } from '@/acoes/cadastros';
import type { TipoCadastro } from '@/editor/cadastros';

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const NOME_DIA: Record<Dia, string> = { dom: 'dom', seg: 'seg', ter: 'ter', qua: 'qua', qui: 'qui', sex: 'sex', sab: 'sáb' };
const INICIO = /^([01]\d|2[0-3]):[0-5]\d$/;
/** O mesmo do pacote: o fim vai até 24:00. Vai no `pattern` do campo (sem as âncoras, que o navegador põe). */
const FIM = '([01]\\d|2[0-3]):[0-5]\\d|24:00';

/** Os cadastros da empresa: por tipo, com busca, onde é usado, renomear, apagar (sem uso) e o Horário. */
export function TabelaCadastros({
  empresaId,
  cadastros,
  tipos,
  usos,
}: {
  empresaId: string;
  cadastros: Cadastro[];
  tipos: TipoCadastro[];
  usos: Record<string, { id: string; nome: string }[]>;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ erro: boolean; texto: string } | null>(null);
  const [nome, setNome] = useState('');
  const [tipoNovo, setTipoNovo] = useState(tipos[0]?.chave ?? 'pessoa');
  // Ocupado por ação e linha (renomear:id, apagar:id, horario:id, criar): o blur de um renomear não desabilita o
  // botão que a pessoa estava clicando (o clique se perdia com o botão desabilitado no meio dele).
  const [ocupados, setOcupados] = useState<Record<string, true>>({});
  const [, comecar] = useTransition();
  const nomeTipo = (k: string) => tipos.find((t) => t.chave === k)?.nome ?? k;
  const vistos = cadastros.filter((k) => (!tipo || k.tipo === tipo) && (!busca.trim() || semAcento(k.nome).includes(semAcento(busca.trim()))));

  const fazer = async (chave: string, f: () => Promise<{ erro?: string }>, ok?: string, aoErrar?: () => void) => {
    if (ocupados[chave]) return;
    setOcupados((o) => ({ ...o, [chave]: true }));
    try {
      const r = await f();
      setMensagem(r.erro ? { erro: true, texto: r.erro } : ok ? { erro: false, texto: ok } : null);
      if (r.erro) aoErrar?.();
      else comecar(() => router.refresh());
    } finally {
      setOcupados(({ [chave]: _, ...resto }) => resto);
    }
  };

  return (
    <main className="pagina">
      <div className="cabeca">
        <h1>Cadastros</h1>
        <input className="entrada-texto" type="search" placeholder="Buscar" aria-label="Buscar cadastro" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: 220 }} />
      </div>
      <p className="mudo" style={{ margin: 0 }}>
        Pessoas, filas, equipes, sistemas e horários que as peças dos fluxos usam. Um nome escrito numa peça vira cadastro aqui; renomear aqui muda em todos os fluxos.
      </p>
      <nav className="nav" aria-label="Tipos" style={{ justifySelf: 'start' }}>
        <button type="button" aria-pressed={tipo === null} onClick={() => setTipo(null)}>
          Todos ({cadastros.length})
        </button>
        {tipos.map((t) => (
          <button key={t.chave} type="button" aria-pressed={tipo === t.chave} onClick={() => setTipo(t.chave)}>
            {t.nome} ({cadastros.filter((k) => k.tipo === t.chave).length})
          </button>
        ))}
      </nav>
      {mensagem && (
        <p className={`aviso-caixa ${mensagem.erro ? 'erro' : 'ok'}`} role={mensagem.erro ? 'alert' : 'status'}>
          {mensagem.texto}
        </p>
      )}
      <div className="cartao tabela-rolagem">
        {vistos.length ? (
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Onde é usado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vistos.map((k) => {
                const u = usos[k.id] ?? [];
                return [
                  <tr key={k.id}>
                    <td>
                      <input
                        key={k.nome}
                        className="entrada-texto"
                        defaultValue={k.nome}
                        aria-label={`Nome de ${k.nome}`}
                        // Enquanto o renomear desta linha está no ar, o campo não aceita outro: um segundo nome seria
                        // descartado calado (o `fazer` ignora a chave ocupada).
                        readOnly={!!ocupados[`renomear:${k.id}`]}
                        aria-busy={ocupados[`renomear:${k.id}`] ? true : undefined}
                        onBlur={(e) => {
                          const campo = e.currentTarget;
                          const v = campo.value.trim();
                          if (!v) campo.value = k.nome;
                          // Recusado (nome repetido, sem permissão): o campo volta pro nome que vale, não fica o recusado.
                          else if (v !== k.nome) void fazer(`renomear:${k.id}`, () => renomearCadastro(empresaId, k.id, v), `Agora é “${v}” em todos os fluxos.`, () => (campo.value = k.nome));
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      />
                    </td>
                    <td>{nomeTipo(k.tipo)}</td>
                    <td>
                      {u.length ? (
                        u.map((f, i) => (
                          <span key={f.id}>
                            {i > 0 && ', '}
                            <Link href={`/e/${empresaId}/f/${f.id}`}>{f.nome}</Link>
                          </span>
                        ))
                      ) : (
                        <span className="mudo">nenhum fluxo</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {k.tipo === 'horario' && (
                        <button
                          className="botao pequeno"
                          type="button"
                          aria-expanded={aberto === k.id}
                          aria-controls={aberto === k.id ? `horario-${k.id}` : undefined}
                          onClick={() => setAberto(aberto === k.id ? null : k.id)}
                        >
                          Janelas e feriados
                        </button>
                      )}{' '}
                      <button
                        className="botao pequeno perigo"
                        type="button"
                        disabled={!!ocupados[`apagar:${k.id}`] || u.length > 0}
                        aria-label={`Apagar ${k.nome}`}
                        title={u.length ? 'Em uso: troque nas peças antes de apagar' : undefined}
                        onClick={() => void fazer(`apagar:${k.id}`, () => apagarCadastro(empresaId, k.id), `“${k.nome}” apagado.`)}
                      >
                        Apagar
                      </button>
                    </td>
                  </tr>,
                  aberto === k.id && (
                    <tr key={`${k.id}:horario`} id={`horario-${k.id}`}>
                      <td colSpan={4}>
                        <EditorHorario
                          campos={camposHorario(k) ?? { janelas: [], feriados: [] }}
                          ocupado={!!ocupados[`horario:${k.id}`]}
                          aoSalvar={(c) => void fazer(`horario:${k.id}`, () => mudarHorario(empresaId, k.id, c), 'Horário salvo.')}
                        />
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        ) : (
          <p className="vazio">{cadastros.length ? 'Nada com essa busca.' : 'Nenhum cadastro ainda. Eles nascem quando alguém escreve um responsável numa peça, ou aqui embaixo.'}</p>
        )}
      </div>
      <form
        className="cartao linha-form"
        onSubmit={(e) => {
          e.preventDefault();
          void fazer('criar', async () => {
            const r = await criarCadastro(empresaId, tipoNovo, nome);
            if (!r.erro) setNome('');
            return r;
          });
        }}
      >
        <label className="campo" style={{ flex: '1 1 220px' }}>
          Novo cadastro
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Fila Cobrança, Maria, ERP…" required />
        </label>
        <label className="campo">
          Tipo
          <select aria-label="Tipo" value={tipoNovo} onChange={(e) => setTipoNovo(e.target.value)}>
            {tipos.map((t) => (
              <option key={t.chave} value={t.chave}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <button className="botao primario" type="submit" disabled={!!ocupados.criar}>
          Cadastrar
        </button>
      </form>
    </main>
  );
}

/** O que está errado numa janela (pra marcar a linha), ou null. */
function erroJanela(j: CamposHorario['janelas'][number]): string | null {
  if (!j.dias.length) return 'Marque pelo menos um dia.';
  if (!INICIO.test(j.inicio)) return 'Início no formato 08:00.';
  if (!new RegExp(`^(${FIM})$`).test(j.fim)) return 'Fim no formato 18:00 (vai até 24:00).';
  if (j.fim <= j.inicio) return 'O fim tem que ser depois do início.';
  return null;
}

/**
 * Janelas da semana (dias, início e fim) e feriados de um Horário. Confere aqui antes de mandar (a mesma regra do
 * pacote, e janela sem dia não vale): a linha errada fica marcada, com o porquê.
 */
function EditorHorario({ campos, ocupado, aoSalvar }: { campos: CamposHorario; ocupado: boolean; aoSalvar: (c: CamposHorario) => void }) {
  const [c, setC] = useState<CamposHorario>(campos);
  const [conferir, setConferir] = useState(false);
  const id = useId();
  const errosJanelas = c.janelas.map(erroJanela);
  const errosFeriados = c.feriados.map((f) => (camposHorario({ id: 'h', tipo: 'horario', nome: 'h', campos: { janelas: [], feriados: [f] } }) ? null : 'Data inválida.'));
  const valido = errosJanelas.every((e) => !e) && errosFeriados.every((e) => !e) && camposHorario({ id: 'h', tipo: 'horario', nome: 'h', campos: { ...c } }) !== null;
  const janela = (i: number, patch: Partial<CamposHorario['janelas'][number]>) => setC({ ...c, janelas: c.janelas.map((j, k) => (k === i ? { ...j, ...patch } : j)) });
  const feriado = (i: number, patch: Partial<CamposHorario['feriados'][number]>) => setC({ ...c, feriados: c.feriados.map((f, k) => (k === i ? { ...f, ...patch } : f)) });
  return (
    <div style={{ display: 'grid', gap: 10, padding: '6px 0' }}>
      <div className="rotulo-secao" style={{ margin: 0 }}>
        Janelas
      </div>
      {c.janelas.map((j, i) => {
        const erro = conferir ? errosJanelas[i] : null;
        return (
        <div key={i} className="linha-form" role="group" aria-label={`Janela ${i + 1}`} aria-invalid={erro ? true : undefined} aria-describedby={erro ? `${id}-j${i}` : undefined}>
          {DIAS.map((d) => (
            <label key={d} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12.5 }}>
              <input type="checkbox" checked={j.dias.includes(d)} onChange={(e) => janela(i, { dias: e.target.checked ? DIAS.filter((x) => x === d || j.dias.includes(x)) : j.dias.filter((x) => x !== d) })} />
              {NOME_DIA[d]}
            </label>
          ))}
          <input type="time" aria-label="Início" value={j.inicio} onChange={(e) => janela(i, { inicio: e.target.value })} aria-invalid={erro ? true : undefined} />
          <span className="mudo">até</span>
          <input
            type="text"
            aria-label="Fim"
            value={j.fim}
            pattern={FIM}
            inputMode="numeric"
            onChange={(e) => janela(i, { fim: e.target.value })}
            style={{ width: 70 }}
            placeholder="18:00"
            aria-invalid={erro ? true : undefined}
          />
          <button className="botao pequeno" type="button" onClick={() => setC({ ...c, janelas: c.janelas.filter((_, k) => k !== i) })}>
            Tirar
          </button>
          {erro && (
            <span id={`${id}-j${i}`} className="erro-campo" style={{ flexBasis: '100%', color: 'var(--bad)', fontSize: 12.5 }}>
              {erro}
            </span>
          )}
        </div>
        );
      })}
      <button className="botao pequeno" type="button" style={{ justifySelf: 'start' }} onClick={() => setC({ ...c, janelas: [...c.janelas, { dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }] })}>
        Mais uma janela
      </button>
      <div className="rotulo-secao" style={{ margin: 0 }}>
        Feriados (fechado o dia todo)
      </div>
      {c.feriados.map((f, i) => {
        const erro = conferir ? errosFeriados[i] : null;
        return (
        <div key={i} className="linha-form" role="group" aria-label={`Feriado ${i + 1}`} aria-invalid={erro ? true : undefined} aria-describedby={erro ? `${id}-f${i}` : undefined}>
          <input type="date" aria-label="Data" value={f.data} onChange={(e) => feriado(i, { data: e.target.value })} aria-invalid={erro ? true : undefined} />
          <input type="text" aria-label="Nome do feriado" value={f.nome ?? ''} placeholder="Natal" onChange={(e) => feriado(i, { nome: e.target.value })} />
          <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12.5 }}>
            <input type="checkbox" checked={!!f.todo_ano} onChange={(e) => feriado(i, { todo_ano: e.target.checked })} />
            todo ano
          </label>
          <button className="botao pequeno" type="button" onClick={() => setC({ ...c, feriados: c.feriados.filter((_, k) => k !== i) })}>
            Tirar
          </button>
          {erro && (
            <span id={`${id}-f${i}`} className="erro-campo" style={{ flexBasis: '100%', color: 'var(--bad)', fontSize: 12.5 }}>
              {erro}
            </span>
          )}
        </div>
        );
      })}
      <button className="botao pequeno" type="button" style={{ justifySelf: 'start' }} onClick={() => setC({ ...c, feriados: [...c.feriados, { data: '' }] })}>
        Mais um feriado
      </button>
      <p className="mudo" style={{ margin: 0, fontSize: 12.5 }}>
        O fim vai até 24:00. Pra passar da meia-noite, use duas janelas (22:00–24:00 num dia, 00:00–06:00 no outro).
      </p>
      {conferir && !valido && (
        <p className="aviso-caixa erro" role="alert" style={{ margin: 0 }}>
          Confere as janelas (o fim depois do início, até 24:00, com pelo menos um dia) e as datas dos feriados.
        </p>
      )}
      <button
        className="botao primario"
        type="button"
        style={{ justifySelf: 'start' }}
        disabled={ocupado}
        onClick={() => {
          setConferir(true);
          if (valido) aoSalvar(c);
        }}
      >
        Salvar horário
      </button>
    </div>
  );
}
```

- [ ] **Passo 5: rodar e ver passar**

Run: `npm run typecheck && npm run e2e -- e2e/cadastros.spec.ts --trace=off`
Expected: `tsc` sem saída; `2 passed`.

- [ ] **Passo 6: commit**

```bash
git add apps/web/e2e/cadastros.spec.ts "apps/web/src/app/e/[empresa]/cadastros"
git commit -m "web: tela Cadastros (renomear, apagar sem uso, Horário)" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 11: documentação e fechamento

**Arquivos:**
- Modificar: `README.md`, `apps/web/README.md`

- [ ] **Passo 1: os READMEs**

```diff
diff --git a/README.md b/README.md
index 3a20e21..67608f1 100644
--- a/README.md
+++ b/README.md
@@ -1,11 +1,11 @@
 # Journey
 
-O fluxo de atendimento como um encanamento: dá play numa entrada e a água anda pelos canos. Serve pra entender e explicar um fluxo, testar cenários ("e se…") sem ligar pra central e encontrar problemas sozinho.
+O fluxo de atendimento, de qualquer canal, como um encanamento: desenha o fluxo, dá play e a água anda pelos canos. Serve pra desenhar, entender e explicar um fluxo, testar cenários ("e se…") e encontrar problemas sozinho. White label: cada empresa tem os seus fluxos, cadastros e canais.
 
 - Spec: [v2, o editor no centro](docs/superpowers/specs/2026-11-13-journey-v2-editor.md) (substitui a [v1](docs/superpowers/specs/2026-11-12-journey-design.md))
 - `packages/fluxo`: o modelo genérico da v2 (documento, motor, diagnóstico e modelos), sem tela ([README](packages/fluxo/README.md))
 - `packages/nucleo`: formato, importação, modelos, motor e diagnóstico, de telefonia, sem tela; na v2 vira o importador de central ([README](packages/nucleo/README.md))
-- `apps/web`: o app (Next.js + Supabase) ([README](apps/web/README.md))
+- `apps/web`: o app (Next.js + Supabase): fluxos, editor, cadastros ([README](apps/web/README.md))
 - `supabase/`: migração, regras de acesso e testes do banco
 
 ## Rodar
```

```diff
diff --git a/apps/web/README.md b/apps/web/README.md
index 78941d5..beaddec 100644
--- a/apps/web/README.md
+++ b/apps/web/README.md
@@ -1,7 +1,8 @@
 # @journey/web
 
-O app de simulação do Journey: login por link mágico, empresa e convites, import com revisão, catálogo com "onde é usado", mapa em encanamento com a água animada, cenários "E se…", diagnóstico e ramais diretos (etapa 2), e links públicos só de leitura, com nomes escondidos, cenário inicial e validade (etapa 3).
-A lógica vem do `@journey/nucleo`; aqui fica a tela, o banco (Supabase) e o que liga os dois.
+O app do Journey. Desde a v2 (etapa B), a casa da empresa é a tela **Fluxos**: criar um fluxo em branco ou a partir de um modelo, desenhar no **editor** (peças, ligações com regra, grupos, notas, estilo da água), dar play e ver a água andar, com os **Cadastros** (pessoas, filas, equipes, sistemas, horários) nascendo do desenho. A lógica do fluxo vem do `@journey/fluxo`.
+
+As telas da v1 (import da central, catálogo, jornadas, links públicos das jornadas) continuam no código e saíram do menu: a etapa C leva os links e os cenários pros fluxos e tira a v1. A lógica delas vem do `@journey/nucleo`.
 
 ## Rodar
 
@@ -33,19 +34,35 @@ npm run build
 
 | Pasta | O que faz |
 |---|---|
+| `src/editor` | O editor sem tela (v2): formas e tamanhos (`pecas`), desenho dos canos (`geometria`), estilo (`estilo`), mudanças no documento (`documento`), desfazer e refazer (`historico`), o play em cima do motor (`play`), salvamento automático (`salvamento`) e busca e tipo sugerido dos cadastros (`cadastros`) |
+| `src/componentes/editor` | O editor (v2): quadro com peças, canos e água (`Quadro`, `Pecas`, `Agua`), painel (`Painel`, `Campos`), cartão do play (`CartaoPlay`) e o componente que junta tudo (`Editor`) |
 | `src/mapa` | `montarMapa`: o documento vira árvore da esquerda pra direita (o algoritmo do protótipo), com atalhos, faixas por regime de horário e canos que seguem o motor |
 | `src/simulacao` | Sessão (refazer as escolhas = mesma execução), passos da animação, estado visual, textos da linha do tempo, comparação com o resultado aprovado e `vinculo` (se a tela ainda é o caminho de um cenário) |
 | `src/diagnostico` | `cenarioAte`: o caminho de uma entrada até o ponto de um achado (o "Simular"); `pontosComAgenda`: as regras de horário que as entradas encontram primeiro, passando por áudios de saída única |
 | `src/importacao` | Jornadas por canal, refs usadas, revisão, relatório e o teto de 4 MB |
 | `src/compartilhar` | O retrato do link público (`montarRetrato`: sem observações e, com "esconder nomes", sem os nomes das pessoas) e as opções do link (validade, situação, a linha que descreve cada um) |
 | `src/lib` | Clientes do Supabase, leituras do servidor (`dados.ts`), o link público (`link.ts`, o único com a chave secreta), origem do app, mensagens de erro, fuso |
-| `src/acoes` | Server actions: import, cenários, intencionais, convites, empresa, links |
+| `src/acoes` | Server actions: fluxos e cadastros (v2); import, cenários, intencionais, convites, empresa, links (v1) |
 | `src/componentes` | Mapa em React Flow (peças e canos), player, cartão da decisão, painéis |
 | `src/app` | Rotas |
 | `supabase/` (na raiz) | Migração, regras de acesso (RLS) e testes pgTAP |
 
 ## Decisões
 
+### Editor de fluxos (v2, etapa B)
+
+- **Quadro próprio, não React Flow.** O editor é o protótipo aprovado em React: peças em HTML, canos em SVG com âncora no lado mais direto de cada peça, água quadro a quadro. O React Flow continua só no mapa da v1.
+- **O documento é a fonte da verdade** e toda mudança é uma função pura (`editor/documento.ts`) que devolve outro documento. O histórico guarda as versões por referência (120 passos); num arrasto, o primeiro quadro entra no histórico e os seguintes substituem.
+- **Salvamento automático pelo navegador**, direto no `salvar_fluxo` (RPC), meio segundo depois da última mudança, um envio por vez, com a revisão. Sem rede, a cópia fica no `localStorage` e o envio tenta de novo (2 s, 4 s… até 30 s); ao abrir, uma cópia que partiu da mesma revisão volta. Conflito (40001), trava perdida (P0001) ou recusa param o salvamento e a tela pede pra recarregar. Nome, canal, descrição e meta são colunas: vão por server action.
+- **Trava:** ao abrir, `pegar_trava`; renova a cada 4 minutos; ao sair, `soltar_trava` com `fetch(..., { keepalive: true })`. Sem a trava, o editor fica só de leitura (dá pra ver e dar play) e diz quem está editando.
+- **Cadastros nascem do desenho:** o campo do responsável busca nos cadastros da empresa e oferece "Criar" com o tipo sugerido pelo nome ("Fila …", "Equipe …", "Horário …") ou pela peça. A peça guarda o id; renomear em Cadastros muda em todos os fluxos. Horário nasce de segunda a sexta, 8h às 18h.
+- **Play:** o motor (`@journey/fluxo`) roda a simulação inteira de uma vez a partir das escolhas; a tela mostra os eventos um a um (`editor/play.ts`). Voltar tira a última escolha e refaz; o play usa uma cópia do documento de quando começou, e mexer no desenho para o play.
+- **Fluxo a partir de modelo:** os cadastros do modelo viram cadastros da empresa (o que já existe com o mesmo tipo e nome é reaproveitado), o fluxo nasce e o documento é salvo com `instanciarModelo`. Se salvar falha, o fluxo criado é apagado.
+- **Dois cuidados do quadro:** o palco tem `overflow: hidden`, mas o navegador ainda o rola pra mostrar um elemento com foco, então ele volta a (0, 0) a cada rolagem; e, com o ponteiro capturado pelo palco (o arrasto começa no primeiro clique), o duplo clique chega no palco, então o alvo é o elemento sob o mouse (`elementFromPoint`).
+- **CSS do editor dentro de `.editor`**, pra não esbarrar no da v1, que ainda existe.
+
+### Telas da v1
+
 - **A tela importa o núcleo só pelos subcaminhos** (`@journey/nucleo/formato`, `/motor`, `/diagnostico`). A raiz reexporta `importacao` e `modelos`, que puxam o exceljs (~1 MB) pro navegador. O teste `test/cliente-sem-exceljs.test.ts` barra a raiz, `importacao` e `modelos` em `src/componentes`, `src/mapa`, `src/simulacao` e `src/diagnostico`; depois do build, `grep -rl ExcelJS apps/web/.next/static` tem que vir vazio. O servidor (páginas, `acoes`, `lib`, `importacao`) pode importar a raiz.
 - **A tela nunca grava no catálogo nem nas versões:** só a função `confirmar_import` (security definer) troca o catálogo e cria versões. O catálogo guarda as colunas do formato em `dados` (jsonb), então coluna nova no formato não pede migração.
 - **`confirmar_import` só aceita documento `journey/1`:** `formato` certo e as 8 listas (entradas, horários, feriados, ramais, filas, grupos, peças, saídas). Com outra forma a jornada não abriria. O conteúdo de cada lista é conferido pelo app.
```

- [ ] **Passo 2: conferência final**

Run: `npm test && npm run typecheck && npm run banco:testes && npm run build && npm run e2e -- --trace=off`
Expected: fluxo 78, núcleo 253, app 258; `tsc` limpo; pgTAP `Tests=136` e `Result: PASS`; build com `/e/[empresa]/f/[fluxo]` e `/e/[empresa]/cadastros` dinâmicas (`ƒ`); ponta a ponta `30 passed` e `1 skipped`.

- [ ] **Passo 3: commit e push**

```bash
git add README.md apps/web/README.md
git commit -m "docs: o editor (etapa B) nos READMEs" -m "$(cat .git/atribuicao.txt)"
git push -u origin claude/journey-etapa-3-public-links-5wx03t
```

---

## Cobertura do spec

| Spec v2 | Onde |
|---|---|
| 3, critério 1 (fluxo do zero, 10 peças, 2 decisões, play) | Tarefas 2 a 9; `e2e/editor.spec.ts` |
| 3, critério 2 (cadastro nasce do desenho; renomear muda em todos) | Tarefas 5, 6, 8 e 10; `e2e/cadastros.spec.ts` |
| 3, critério 5 (canais diferentes, cada um com a cor da água) | Tarefas 2, 7 e 9; `e2e/fluxos.spec.ts` |
| 4 (trava: "Fulano está editando") | Tarefa 9; `e2e/fluxos.spec.ts` |
| 6.2 Fluxos (grade, busca, Novo fluxo em branco e de modelo) | Tarefas 6 e 9 |
| 6.3 Editor | Tarefas 2 a 9 |
| 6.4 Cadastros (por tipo, busca, onde é usado, renomear, apagar sem uso) | Tarefas 6 e 10 |
| 7.1 Criar e editar (formas, arrastar, dois cliques, bolinha e +, segunda saída vira opção, grupos, desfazer, Del, Ctrl+D, Esc; salvamento automático com cópia local; trava) | Tarefas 3, 5, 7 e 9 |
| 7.2 Painel (Propriedades, Estilo e animação, Cadastros) | Tarefa 8 |
| 7.3 Tipos de peça | Tarefas 2 e 7 |
| 8 Simulação (play, água na cor do canal, pergunta com opções e teclado, escolha automática, tempo do cliente, relógio, pausar, voltar, recomeçar, velocidade, linha do tempo, resumo) | Tarefas 4, 7, 8 e 9 |
| 13 Visual (o protótipo; reduzir movimento; 500 peças) | Tarefa 7 (o ensaio mediu arrastar uma peça num fluxo de 500: 60 quadros por segundo no modo de desenvolvimento) |

**Fica pra C:** cenários salvos e "aprovar", versões nomeadas, diagnóstico no editor, links públicos dos fluxos, e apagar a v1 (telas, código e tabelas). **Fica pra D:** marca da empresa, canais e tipos de cadastro próprios, estilo padrão da empresa ("usar como padrão"), seleção múltipla, copiar e colar, alinhar, minimapa, trocar um cadastro em uso por outro antes de apagar. **Depois:** miniatura dos fluxos na grade.

**Produção:** sem migração. Depois do merge na `main`, a Vercel publica sozinha; conferir que `/e/<empresa>` abre a tela Fluxos e que um fluxo novo salva (o `salvar_fluxo` da etapa A já está no banco de produção).
