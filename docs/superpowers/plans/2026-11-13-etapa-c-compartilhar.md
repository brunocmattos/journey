# Etapa C: compartilhar, cenários, versões e diagnóstico — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans pra executar este plano tarefa por tarefa. Os passos usam caixas de seleção (`- [ ]`) pra acompanhar o progresso.

**Objetivo:** a etapa C do spec v2 (seção 15): links públicos e cenários sobre o fluxo genérico, versões nomeadas e o diagnóstico no editor; e a v1 sai inteira (telas, código, tabelas). Pronto quando o critério 3 do spec (seção 3) dá pra fazer: mandar o link de um cenário pra um colega, que abre sem conta, vê a água tocar o caminho e entende o fluxo. Junto, a página de entrar ganha cara de produto (pedido do Bruno).

**Arquitetura:** uma migração nova apaga a v1 do banco (com uma guarda que para tudo se a v1 tiver dados) e cria `cenarios`, `achados_intencionais` e `links` sobre os fluxos, mais o `abrir_link` (só a chave secreta chama) que devolve o retrato do fluxo. No app, a v1 sai; a lógica nova sem tela (cenários, diagnóstico, retrato do link) fica em `src/editor/` e `src/compartilhar/` com testes; as ações no servidor em `src/acoes/`; o play sai do `Editor.tsx` pra um hook (`usePlay`) que o editor e a página do link usam; a página `/l/[token]` mostra o quadro só de leitura com o play.

**Tecnologia:** a mesma da etapa B (Node 22, TypeScript 5.9, Next.js 16.4, React 19.3, supabase-js 2.119, Supabase CLI 2.122, Vitest 3.2, Playwright 1.63). Sai do app: `@xyflow/react` e `@journey/nucleo` (o pacote fica no repositório pro importador da etapa E).

**Spec:** `docs/superpowers/specs/2026-11-13-journey-v2-editor.md` (seções 3, 5, 8, 9, 11, 14 e 15).

---

## Antes de começar

- **Branch:** `claude/journey-etapa-3-public-links-5wx03t`, com a `main` (etapa B) mesclada. Este plano, o código e o PR da etapa C saem dele.
- **Todo o código deste plano já foi escrito e testado num ensaio** sobre esse branch, e cada parte passou por uma revisão independente antes de virar plano: `@journey/fluxo` 84 testes (eram 78), núcleo 253, app 202 (eram 258: a v1 sai), pgTAP 181 (eram 136), ponta a ponta 25 (eram 30 + 1 pulado: os da v1 saem), `typecheck` e `next build` limpos. Copie os arquivos exatamente como estão. Se um teste falhar, investigue antes de mudar o teste.
- **Migrações novas:** `20261115000000_journey_v2_compartilhar.sql` e (tarefa 10) `20261116000000_journey_v2_senha.sql`, com gatilhos em `auth.users`. Ela apaga tabelas da v1 e para (`raise exception`) se a v1 tiver dados ou se o bucket `imports` tiver arquivos. No banco local a v1 tem sobras de testes antigos: a tarefa 2 explica como passar por isso sem apagar nada à mão.
- **Docker e Supabase local:** se `docker info` falhar, `sudo containerd > /tmp/containerd.log 2>&1 &` e depois `sudo dockerd --containerd=/run/containerd/containerd.sock > /tmp/dockerd.log 2>&1 &`, e espere responder. Depois `npm install` e `npm run banco`. O `.env.local` do app é o das etapas anteriores (`apps/web/README.md`), com `SUPABASE_SECRET_KEY` pros testes do link público.
- **Commits:** `.git/atribuicao.txt` tem as duas linhas de atribuição da sessão. Todo commit usa `-m "$(cat .git/atribuicao.txt)"` como segundo parágrafo da mensagem.
- **Patches:** arquivo novo vem inteiro. Arquivo que já existe vem como diff; aplique da raiz salvando o bloco num arquivo e rodando `git apply <arquivo>`. Arquivo que a tarefa 3 apaga e uma tarefa depois cria de novo (`acoes/links.ts`, `compartilhar/retrato.ts`, `lib/link.ts`, `/l/[token]`) vem inteiro.
- **TDD:** a lógica (tarefas 1, 4, 5 e 6) tem o teste primeiro. As telas (7 a 9) começam pelos testes de ponta a ponta, que falham antes de a tela existir.
- **Comandos** (da raiz): `npm test` (unitários; os de banco do app rodam com o Supabase no ar), `npm run typecheck`, `npm run build`, `npx supabase test db` (pgTAP), `npm run e2e` (Playwright; passe `--trace=off` direto: `cd apps/web && npx playwright test --trace=off`). Antes da ponta a ponta, nada pode estar ouvindo na porta 3000.

## Decisões desta etapa

Cada uma foi comparada com a alternativa antes de entrar aqui.

| Decisão | Por quê | Alternativa recusada |
|---|---|---|
| **A v1 sai inteira nesta etapa** (rotas, componentes, módulos, testes, tabelas, bucket) | Os links e cenários passam pros fluxos; o que sobra da v1 não tem mais menu nem uso, e o banco de produção não tem dados dela. O `@journey/nucleo` fica no repositório (sai só do app) pro importador da etapa E | Manter a v1 escondida até a E: duas versões de links, cenários e diagnóstico pra manter |
| **A migração tem uma guarda: com dado na v1 (tabelas ou arquivo no bucket `imports`), para tudo** | Apagar tabela com dado é irreversível, e apagar só a linha do Storage deixaria o arquivo órfão no S3 (planilhas com nomes e telefones). Em produção, roda primeiro dentro de `begin … rollback` | Apagar o que tiver: perde dado sem aviso |
| **Cenário: início, quando (hora de parede), modo, escolhas e o esperado** (`{ caminho, fim, tempo_s }`); aprovar grava o esperado e as escolhas que o motor aceitou | Refazer o cenário com o documento de agora e comparar caminho + fim + tempo diz se o fluxo mudou; gravar as escolhas aceitas tira o "mudou" quando uma escolha deixou de existir (ex.: o horário foi ampliado e a decisão não pergunta mais) | Guardar os eventos inteiros: grande e sensível a detalhe que não muda o caminho |
| **Início, quando e modo do cenário não mudam depois de salvo** (grant de update só em nome, escolhas, esperado e revisão aprovada) | O cenário é aquele caminho; outro começo é outro cenário | Deixar editar tudo |
| **Achado intencional pela chave do achado, que nunca leva texto livre** (opções repetidas pelos ids das conexões; chave longa vira começo + FNV-1a de 64 bits) | A chave vai pro banco e pro link público: com texto, um nome escondido mudaria a chave no link e o intencional apareceria aberto; e um ciclo enorme passava do limite do índice | A chave com o texto da condição, como antes |
| **Diagnóstico ao vivo numa gaveta** (`diagnosticar` com `useDeferredValue`; 2 ms pra 500 peças) com "ver no quadro", "simular até aqui" e "marcar como intencional" | Spec 9. "Simular até aqui" só aparece pras peças que algum Início alcança (uma busca por documento); o caminho é calculado no clique e toca em modo livre (é o modo em que as escolhas do caminho valem) | Calcular o caminho de cada achado a cada edição: 176 ms no pior caso de 500 peças |
| **Versão: marcar depois que o salvamento chegou; restaurar é uma edição desfazível** (Ctrl+Z volta) | `marcar_versao` (etapa A) tira a foto do banco: marcar com mudança pendente marcaria a versão de antes. Restaurar pelo editor passa pela trava, pela revisão e pelo histórico, sem função nova no banco | Restaurar no banco: pularia a trava e o histórico |
| **Link: versão fixa ou "o fluxo de agora", cenário inicial copiado, esconder nomes ligado, validade 7/30/90 dias ou sem prazo**; link de versão fixa só aceita cenário que toca nela | Como a v1 (etapa 3), sobre o fluxo. O cenário é cópia: o link continua igual se o cenário mudar | Referência ao cenário: o link mudaria sozinho |
| **Esconder nomes troca toda pessoa da empresa** (não só as responsáveis): o nome inteiro e cada palavra dele com 3 letras ou mais, sem acento e com qualquer separador; os nomes vêm do banco só pro servidor e nunca vão pro navegador; só o Horário leva os campos | Uma pessoa citada numa descrição ("chama a Ana") vazava; trocar a mais é o lado seguro. Limites registrados no código e no diálogo: apelido, abreviação, nome grudado ou em e-mail, gente cadastrada com outro tipo | Trocar só o nome inteiro das responsáveis |
| **O play num hook (`usePlay`)** usado pelo editor e pelo link | A página do link toca o mesmo play sem carregar trava, salvamento e painel | Duplicar a máquina do play |
| **Listas do editor (intencionais, cenários, versões, links) no estado do editor**, atualizadas pelo que cada ação devolve; sem `revalidatePath` | Revalidar releria o documento inteiro à toa | Revalidar a página a cada ação |
| **Confirmação no lugar** (o "Não …" primeiro e com o foco; clique duplo não confirma) em revogar, apagar cenário e restaurar | O botão de confirmar aparecia onde estava o primeiro: um clique duplo revogava o link pra sempre | `window.confirm` |
| **A página de entrar redesenhada** (mesma forma de entrar: link por e-mail com PKCE e Google opcional), com uma prévia animada do quadro em SVG próprio que pausa fora da tela e para depois de três voltas; o botão só liga depois de hidratar (o e-mail nunca vai pra URL); o limite de envio do Supabase vira mensagem em português com espera de 30 s | Pedido do Bruno; a prévia não carrega o editor nem o `@journey/fluxo` e não gasta a página o tempo todo | Importar o editor pra prévia; animação infinita |
| **Entrar com e-mail e senha (o principal), Google e o link por e-mail**; "Criar conta" só com o e-mail (o link de confirmação leva a escolher a senha); "Esqueci a senha"; "Senha" no topo pra quem está logado | Pedido do Bruno. Pedir a senha no cadastro não serve: a senha de antes da confirmação não pode valer (abaixo) | Senha no cadastro |
| **A senha some quando o e-mail é confirmado; ninguém troca o próprio e-mail** (gatilhos em `auth.users`; contas que o admin cria já confirmadas ficam com a senha) | Quem cadastrava o e-mail de uma convidada antes dela (pela API pública) ou trocava o próprio e-mail pro dela ficava com uma senha que valia depois, e o convite punha essa conta na empresa (reproduzido) | Confiar no "Confirm email" do Supabase: ele não apaga a senha de antes |
| **Os e-mails apontam pra `/auth/confirm?token_hash=…`, uma página com botão; só o POST (Origin conferido) entra** | Com PKCE, o link aberto em outro navegador ou no celular falhava; com o `token_hash` no GET, um link montado por outra pessoa logava a vítima na conta dela, e leitores de link gastavam o token | PKCE só (falha em outro aparelho) ou GET direto (CSRF de login) |

**Gotchas que o ensaio achou:**
- **Banco local compartilhado:** a migração já aplicada não se reaplica com `migration up`; mudar o arquivo depois exige alinhar o banco local com DDL avulso (nunca `db reset` num banco que outros usam).
- **Storage:** o `storage.buckets`/`storage.objects` têm o gatilho `protect_delete`; apagar o bucket pelo SQL exige `set_config('storage.allow_delete_query', 'true', true)` na mesma transação. Arquivos não somem por SQL: por isso a guarda.
- **Listas em jsonb nos checks:** `jsonb_path_exists` em modo `lax` aceita lista dentro de lista; use `strict` com `silent` (`'{}', true`) e `coalesce` (não-lista dá null).
- **Teclas dentro de pops, diálogo e gaveta:** o atalho do editor ignora Delete/Enter vindos deles (senão um Delete num botão apagava a peça selecionada), mas deixa passar Esc e Ctrl+Z/Y.
- **Gaveta lembrada no navegador:** lida depois de montar (o primeiro desenho tem que bater com o do servidor).
- **Tipos velhos no `.next`:** depois de apagar as rotas da v1, o `next typegen` pode reclamar delas (sobra de um `next dev` antigo em `apps/web/.next/dev/types`). Apague `apps/web/.next` (fica fora do git) e rode de novo.
- **Mudança no `config.toml` do Auth só vale depois de reiniciar o Supabase local** (`npm run banco:parar && npm run banco`).
- **`Referrer-Policy: no-referrer` faz o Chrome mandar `Origin: null` no POST do formulário:** a página `/auth/confirm` usa `same-origin` (o handler recusa Origin nulo).
- **Página do link:** o retrato serializado (HTML, dados do RSC e JS) não pode ter nenhum nome escondido; o teste de ponta a ponta confere o HTML.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/fluxo/src/diagnostico.ts` | Chave de achado sem texto livre e curta; título curto pra ciclo grande |
| `supabase/migrations/20261115000000_journey_v2_compartilhar.sql` | Guarda da v1; a v1 sai; `cenarios`, `achados_intencionais`, `links`, `abrir_link` |
| `supabase/tests/database/compartilhar.test.sql`, `empresas.test.sql` | pgTAP das tabelas novas e do `abrir_link`; empresas, membros e convites (saiu do `journey.test.sql`) |
| `apps/web/src/editor/cenarios.ts` | Resultado de um play, situação de um cenário (igual/mudou), o que aprovar, cenário ↔ play |
| `apps/web/src/editor/diagnostico.ts` | Abertos e intencionais, peças alcançáveis, caminho até uma peça, foco e gaveta |
| `apps/web/src/editor/documento.ts` | `semResponsaveisQueSumiram` (restaurar versão e cópia local) |
| `apps/web/src/compartilhar/opcoes.ts`, `retrato.ts` | Opções do link; o retrato do link público (pessoas escondidas) |
| `apps/web/src/lib/link.ts` | O único lugar que usa a chave secreta: abre o link pelo `abrir_link` |
| `apps/web/src/lib/dados.ts` | Leituras: versões, cenários, intencionais e links de um fluxo |
| `apps/web/src/acoes/{versoes,cenarios,intencionais,links}.ts` | Server actions |
| `apps/web/src/componentes/editor/usePlay.ts` | A máquina do play (editor e link) |
| `apps/web/src/componentes/editor/{Gaveta,Cenarios,Versoes,Compartilhar,Pop,Confirmacao}.tsx`, `useAnuncioAdiado.ts` | As telas novas do editor |
| `apps/web/src/componentes/editor/Visualizador.tsx`, `src/app/l/[token]/*` | A página do link público |
| `apps/web/src/app/entrar/*` | A página de entrar redesenhada; e-mail e senha, Google, link |
| `supabase/migrations/20261116000000_journey_v2_senha.sql`, `supabase/templates/*` | A senha some na confirmação; sem troca do próprio e-mail; os e-mails em português |
| `apps/web/src/lib/acesso.ts`, `src/app/auth/{confirm,confirmar,callback}`, `src/app/conta/senha/*` | Mensagens do Auth, a volta dos e-mails (página + POST), a volta do Google, a senha nova |

---

### Tarefa 1: chave de achado curta e sem texto livre

**Arquivos:**
- Modificar: `packages/fluxo/src/diagnostico.ts`, `packages/fluxo/test/diagnostico.test.ts`

- [ ] **Passo 1: os testes**

```diff
diff --git a/packages/fluxo/test/diagnostico.test.ts b/packages/fluxo/test/diagnostico.test.ts
index a08d2b7..79ef9dc 100644
--- a/packages/fluxo/test/diagnostico.test.ts
+++ b/packages/fluxo/test/diagnostico.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it } from 'vitest';
-import { diagnosticar } from '../src/diagnostico';
+import { diagnosticar, fnv1a64, resumirChave } from '../src/diagnostico';
 import { doc, liga, peca } from './apoio';
 
 const chaves = (...args: Parameters<typeof diagnosticar>) => diagnosticar(...args).map((a) => a.chave);
@@ -43,7 +43,21 @@ describe('diagnóstico', () => {
       [peca('i', 'inicio'), peca('d', 'decisao'), peca('a', 'fim'), peca('b', 'fim')],
       [liga('i', 'd'), liga('d', 'a', { regra: 'opcao', valor: '1' }), liga('d', 'b', { regra: 'opcao', valor: '1' })],
     );
-    expect(diagnosticar(d)).toEqual([expect.objectContaining({ chave: 'opcoes_repetidas:d:opcao:1', refs: ['d', 'd>a', 'd>b'] })]);
+    expect(diagnosticar(d)).toEqual([expect.objectContaining({ chave: 'opcoes_repetidas:d:d>a+d>b', refs: ['d', 'd>a', 'd>b'] })]);
+  });
+
+  it('a chave das opções repetidas é feita dos ids, nunca do texto da condição', () => {
+    // A condição é texto livre: pode ter o nome de uma pessoa (e o link esconde nomes) ou emoji.
+    const valor = `pediu a Ana Souza ${'😀'.repeat(40)}`;
+    const d = doc(
+      [peca('i', 'inicio'), peca('d', 'decisao'), peca('a', 'fim'), peca('b', 'fim')],
+      [liga('i', 'd'), liga('d', 'b', { id: 'z', regra: 'condicao', valor }), liga('d', 'a', { id: 'y', regra: 'condicao', valor })],
+    );
+    const k = chaves(d)[0]!;
+    expect(k).toBe('opcoes_repetidas:d:y+z');
+    // Texto diferente depois dos primeiros 60 caracteres não é a mesma condição.
+    const diferentes = doc(d.pecas, [liga('i', 'd'), liga('d', 'b', { regra: 'condicao', valor: `${'x'.repeat(60)}1` }), liga('d', 'a', { regra: 'condicao', valor: `${'x'.repeat(60)}2` })]);
+    expect(chaves(diferentes)).toEqual([]);
   });
 
   it('regra pela metade', () => {
@@ -107,9 +121,9 @@ describe('diagnóstico', () => {
   it('saídas iguais: um achado por grupo, inclusive "senão" repetido', () => {
     const pecas = [peca('i', 'inicio'), peca('d', 'decisao'), peca('a', 'fim'), peca('b', 'fim'), peca('c', 'fim')];
     const tres = doc(pecas, [liga('i', 'd'), ...['a', 'b', 'c'].map((x) => liga('d', x, { regra: 'opcao', valor: '1' }))]);
-    expect(diagnosticar(tres)).toEqual([expect.objectContaining({ chave: 'opcoes_repetidas:d:opcao:1', refs: ['d', 'd>a', 'd>b', 'd>c'] })]);
+    expect(diagnosticar(tres)).toEqual([expect.objectContaining({ chave: 'opcoes_repetidas:d:d>a+d>b+d>c', refs: ['d', 'd>a', 'd>b', 'd>c'] })]);
     const senoes = doc(pecas, [liga('i', 'd'), liga('d', 'a', { regra: 'condicao', valor: 'pago' }), liga('d', 'b', { regra: 'senao' }), liga('d', 'c', { regra: 'senao' })]);
-    expect(chaves(senoes)).toEqual(['opcoes_repetidas:d:senao']);
+    expect(chaves(senoes)).toEqual(['opcoes_repetidas:d:d>b+d>c']);
   });
 
   describe('caminho mais longo com muitos caminhos', () => {
@@ -166,4 +180,51 @@ describe('diagnóstico', () => {
     diagnosticar(d, { meta_s: 60 });
     expect(performance.now() - t0).toBeLessThan(100);
   });
+
+  describe('chave comprida', () => {
+    // Um ciclo junta os ids de todas as peças dele: a chave cresce com o ciclo, e o banco guarda a chave do intencional.
+    const ciclo = (n: number, prefixo = 'p') => {
+      const ids = Array.from({ length: n }, (_, i) => `${prefixo}-${String(i).padStart(3, '0')}`);
+      return doc(
+        [peca('i', 'inicio'), ...ids.map((id) => peca(id, 'etapa'))],
+        [liga('i', ids[0]!), ...ids.map((id, k) => liga(id, ids[(k + 1) % n]!))],
+      );
+    };
+    const doCiclo = (d: ReturnType<typeof ciclo>) => chaves(d).find((k) => k.startsWith('ciclo_sem_saida:'))!;
+
+    it('curta fica como é', () => {
+      expect(doCiclo(ciclo(3))).toBe('ciclo_sem_saida:p-000+p-001+p-002');
+    });
+
+    it('o título de um ciclo grande cita alguns nomes e conta o resto', () => {
+      const titulo = diagnosticar(ciclo(2000)).find((a) => a.tipo === 'ciclo_sem_saida')!.titulo;
+      expect(titulo).toBe('Ciclo sem saída: p-000, p-001, p-002, p-003, p-004 e mais 1995');
+      expect(diagnosticar(ciclo(5)).find((a) => a.tipo === 'ciclo_sem_saida')!.titulo).toBe('Ciclo sem saída: p-000, p-001, p-002, p-003, p-004');
+    });
+
+    it('comprida vira o começo mais um resumo: curta, estável e diferente pra outro ciclo', () => {
+      const k = doCiclo(ciclo(300));
+      expect(k.length).toBeLessThanOrEqual(120);
+      expect(k.startsWith('ciclo_sem_saida:p-000+p-001+')).toBe(true);
+      expect(k).toMatch(/~[0-9a-f]{16}$/);
+      expect(doCiclo(ciclo(300))).toBe(k);
+      expect(doCiclo(ciclo(301))).not.toBe(k);
+      expect(doCiclo(ciclo(300, 'q'))).not.toBe(k);
+    });
+
+    it('o resumo é o FNV-1a de 64 bits do texto inteiro', () => {
+      const longo = 'x'.repeat(201);
+      expect(resumirChave('a'.repeat(200))).toBe('a'.repeat(200));
+      expect(resumirChave(longo)).toBe(`${'x'.repeat(80)}~${fnv1a64('x'.repeat(201))}`);
+      // Vetores conhecidos do FNV-1a de 64 bits.
+      expect(fnv1a64('')).toBe('cbf29ce484222325');
+      expect(fnv1a64('a')).toBe('af63dc4c8601ec8c');
+      expect(fnv1a64('foobar')).toBe('85944171f73967e8');
+    });
+
+    it('não corta um caractere no meio', () => {
+      const k = resumirChave('😀'.repeat(150));
+      expect(k.startsWith('😀'.repeat(80) + '~')).toBe(true);
+    });
+  });
 });
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd packages/fluxo && npx vitest run test/diagnostico.test.ts`
Expected: FAIL nos testes novos (chave de ciclo grande, chave de opções repetidas, título de ciclo).

- [ ] **Passo 3: o diagnóstico**

```diff
diff --git a/packages/fluxo/src/diagnostico.ts b/packages/fluxo/src/diagnostico.ts
index 242817a..98e14aa 100644
--- a/packages/fluxo/src/diagnostico.ts
+++ b/packages/fluxo/src/diagnostico.ts
@@ -25,6 +25,30 @@ export interface OpcoesDiagnostico {
 
 const ORDEM: Record<Gravidade, number> = { grave: 0, alerta: 1, observacao: 2 };
 
+const FNV_BASE = 0xcbf29ce484222325n;
+const FNV_PRIMO = 0x100000001b3n;
+const BITS_64 = 0xffffffffffffffffn;
+
+/** FNV-1a de 64 bits dos bytes UTF-8 do texto, em hexadecimal (16 dígitos). Pequeno, determinístico e sem dependência. */
+export function fnv1a64(texto: string): string {
+  let h = FNV_BASE;
+  for (const b of new TextEncoder().encode(texto)) h = ((h ^ BigInt(b)) * FNV_PRIMO) & BITS_64;
+  return h.toString(16).padStart(16, '0');
+}
+
+/** Até este tamanho, o fim da chave fica como é. */
+const SUFIXO_MAXIMO = 200;
+
+/**
+ * O fim da chave de um achado, curto. A de um ciclo junta os ids de todas as peças dele e cresceria com o ciclo; a
+ * chave vai pro banco (achados_intencionais, até 2000 letras). Passando do limite, fica o começo (pra quem lê) e o
+ * resumo do texto inteiro (pra continuar única e estável). Corta por caractere, não por unidade de UTF-16.
+ */
+export function resumirChave(sufixo: string): string {
+  if (sufixo.length <= SUFIXO_MAXIMO) return sufixo;
+  return `${Array.from(sufixo).slice(0, 80).join('')}~${fnv1a64(sufixo)}`;
+}
+
 /** As saídas que a água usa: um Fim encerra a jornada, então as saídas dele não levam a lugar nenhum. */
 const proximas = (idx: Indice, id: string): Conexao[] => (idx.pecas.get(id)!.tipo === 'fim' ? [] : idx.saidas.get(id)!);
 const tempoDa = (c: Conexao): number => (c.regra === 'tempo' ? (c.tempo_s ?? 0) : 0);
@@ -155,7 +179,7 @@ function igualdade(c: Conexao): string {
   switch (c.regra) {
     case 'opcao':
     case 'condicao':
-      return c.valor ? `${c.regra}:${c.valor.trim().toLowerCase().slice(0, 60)}` : '';
+      return c.valor ? `${c.regra}:${c.valor.trim().toLowerCase()}` : '';
     case 'horario':
       return c.horario ? `horario:${c.horario}` : '';
     case 'senao':
@@ -164,6 +188,9 @@ function igualdade(c: Conexao): string {
       return '';
   }
 }
+/** Até cinco nomes; passando disso, os cinco primeiros e quantos faltam (o título de um ciclo de 2.000 peças cabe na tela). */
+const alguns = (nomes: readonly string[]): string => (nomes.length > 5 ? `${nomes.slice(0, 5).join(', ')} e mais ${nomes.length - 5}` : nomes.join(', '));
+
 const COMO_IGUAL: Record<string, string> = { opcao: 'a mesma opção', condicao: 'a mesma condição', horario: 'o mesmo lado do horário', senao: '"senão"' };
 
 /** Os problemas de um fluxo, do mais grave pro mais leve. Vale pra qualquer canal: nada aqui é de telefonia. */
@@ -172,7 +199,7 @@ export function diagnosticar(doc: Documento, opcoes: OpcoesDiagnostico = {}): Ac
   const out: Achado[] = [];
   const nome = (id: string) => idx.pecas.get(id)?.nome || id;
   const achado = (tipo: string, gravidade: Gravidade, sufixo: string, titulo: string, texto: string, refs: string[]) =>
-    out.push({ tipo, gravidade, chave: `${tipo}:${sufixo}`, titulo, texto, refs });
+    out.push({ tipo, gravidade, chave: `${tipo}:${resumirChave(sufixo)}`, titulo, texto, refs });
 
   const inicios = doc.pecas.filter((p) => p.tipo === 'inicio').map((p) => p.id);
   const fins = doc.pecas.filter((p) => p.tipo === 'fim').map((p) => p.id);
@@ -216,7 +243,8 @@ export function diagnosticar(doc: Documento, opcoes: OpcoesDiagnostico = {}): Ac
     for (const [k, ids] of iguais) {
       if (ids.length < 2) continue;
       const regra = k.split(':')[0]!;
-      achado('opcoes_repetidas', 'alerta', `${p.id}:${k}`, `${p.nome} tem ${ids.length} saídas iguais`, `${ids.length} saídas de ${p.nome} são ${COMO_IGUAL[regra]}: não dá pra saber qual seguir.`, [p.id, ...ids]);
+      // A chave é feita dos ids (em ordem): o valor da opção ou da condição é texto livre (pode ter nome de pessoa).
+      achado('opcoes_repetidas', 'alerta', `${p.id}:${[...ids].sort().join('+')}`, `${p.nome} tem ${ids.length} saídas iguais`, `${ids.length} saídas de ${p.nome} são ${COMO_IGUAL[regra]}: não dá pra saber qual seguir.`, [p.id, ...ids]);
     }
   }
 
@@ -241,10 +269,10 @@ export function diagnosticar(doc: Documento, opcoes: OpcoesDiagnostico = {}): Ac
       const sozinho = comp.every((id) => proximas(idx, id).length === 1 || doRelogio(id));
       const semTempo = comp.every((id) => !idx.pecas.get(id)!.tempo_s && proximas(idx, id).every((c) => !dentro.has(c.para) || tempoDa(c) === 0));
       if (sozinho && semTempo && comp.some(doRelogio))
-        achado('ciclo_sem_tempo', 'alerta', comp.join('+'), `Ciclo sem espera: ${comp.map(nome).join(', ')}`, 'O relógio manda a jornada de volta pras mesmas peças sem o tempo andar, então ele decide igual de novo e ela não sai. Põe um tempo na espera (uma peça com tempo ou uma ligação "depois de um tempo").', comp);
+        achado('ciclo_sem_tempo', 'alerta', comp.join('+'), `Ciclo sem espera: ${alguns(comp.map(nome))}`, 'O relógio manda a jornada de volta pras mesmas peças sem o tempo andar, então ele decide igual de novo e ela não sai. Põe um tempo na espera (uma peça com tempo ou uma ligação "depois de um tempo").', comp);
       continue;
     }
-    achado('ciclo_sem_saida', 'grave', comp.join('+'), `Ciclo sem saída: ${comp.map(nome).join(', ')}`, 'Essas peças levam umas às outras e nenhuma chega num Fim: quem entra aqui não termina a jornada.', comp);
+    achado('ciclo_sem_saida', 'grave', comp.join('+'), `Ciclo sem saída: ${alguns(comp.map(nome))}`, 'Essas peças levam umas às outras e nenhuma chega num Fim: quem entra aqui não termina a jornada.', comp);
   }
 
   if (opcoes.meta_s && opcoes.meta_s > 0) {
```

- [ ] **Passo 4: rodar e ver passar**

Run: `cd packages/fluxo && npx vitest run && npx tsc --noEmit`
Expected: `Tests  84 passed (84)`; `tsc` sem saída.

- [ ] **Passo 5: commit**

```bash
git add packages/fluxo
git commit -m "fluxo: chave de achado curta e sem texto livre; título curto pra ciclo grande" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 2: o banco (a v1 sai; cenários, intencionais e links sobre os fluxos)

**Arquivos:**
- Criar: `supabase/migrations/20261115000000_journey_v2_compartilhar.sql`
- Criar: `supabase/tests/database/compartilhar.test.sql`, `supabase/tests/database/empresas.test.sql`
- Apagar: `supabase/tests/database/journey.test.sql`, `supabase/tests/database/links.test.sql`

- [ ] **Passo 1: os testes de banco**

`supabase/tests/database/compartilhar.test.sql`:

```sql
-- Journey v2 (etapa C): cenários, achados intencionais, links públicos e o abrir_link.
begin;
create extension if not exists pgtap with schema extensions;
select plan(101);

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'ana@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000c2', 'beto@exemplo.com', 'authenticated', 'authenticated', now());

create function pg_temp.entrar(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
-- Um documento journey/2: Início → Atende (com o responsável dado) → Fim; com um Horário, mais uma decisão solta.
create function pg_temp.doc(p_responsavel text, p_horario text default null) returns jsonb language sql as $$
  select jsonb_build_object('formato', 'journey/2',
    'pecas', jsonb_build_array(
      jsonb_build_object('id', 'i', 'tipo', 'inicio', 'nome', 'Começo', 'x', 0, 'y', 0),
      jsonb_build_object('id', 'a', 'tipo', 'atendimento', 'nome', 'Atende', 'x', 200, 'y', 0, 'responsavel', p_responsavel),
      jsonb_build_object('id', 'f', 'tipo', 'fim', 'nome', 'Fim', 'x', 400, 'y', 0))
      || case when p_horario is null then '[]'::jsonb
         else jsonb_build_array(jsonb_build_object('id', 'h', 'tipo', 'decisao', 'nome', 'Aberto?', 'x', 0, 'y', 200, 'responsavel', p_horario)) end,
    'conexoes', '[{"id":"c1","de":"i","para":"a","regra":"sempre"},{"id":"c2","de":"a","para":"f","regra":"sempre"}]'::jsonb,
    'grupos', '[]'::jsonb, 'notas', '[]'::jsonb);
$$;
-- Quantas linhas um update ou delete mexeu: a RLS não dá erro, só não acha a linha.
create function pg_temp.linhas(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;
-- O resultado esperado de um cenário que vai do Começo ao Fim.
select set_config('teste.esperado', '{"caminho":["i","a","f"],"fim":{"motivo":"fim","peca":"f"},"tempo_s":0}', true);

-- A v1 saiu inteira do banco.
select hasnt_table('public', 'jornadas', 'a tabela jornadas da v1 não existe mais');
select hasnt_table('public', 'imports', 'nem a de imports');
select is((select count(*)::int from storage.buckets where id = 'imports'), 0, 'nem o bucket dos arquivos importados');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and policyname like '%arquivos de import%'), 0, 'nem as regras de acesso dele');
select hasnt_function('public', 'empresa_do_caminho', 'nem a função das regras');
select hasnt_function('public', 'confirmar_import', 'nem a do import');

-- Empresa A (Ana): a fila, a Maria (com telefone), o Horário, o Zeca (pessoa que nenhum fluxo usa) e um sistema sem uso;
-- o fluxo Cobrança com a versão 1 marcada (atendida pela fila) e a revisão 2 (atendida pela Maria, com o Horário);
-- o fluxo Outro, com as versões 1 e 2. Empresa B (Beto), com um cadastro e um fluxo dele.
set local role authenticated;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000c1');
select set_config('teste.a', public.criar_empresa('Empresa A')::text, true);
insert into public.cadastros (empresa_id, tipo, nome) values
  (current_setting('teste.a')::uuid, 'fila', 'Fila Cobrança'),
  (current_setting('teste.a')::uuid, 'sistema', 'Sobra'),
  (current_setting('teste.a')::uuid, 'pessoa', 'Zeca Lima');
insert into public.cadastros (empresa_id, tipo, nome, campos) values
  (current_setting('teste.a')::uuid, 'pessoa', 'Maria Souza', '{"telefone":"51 99999-0000"}'),
  (current_setting('teste.a')::uuid, 'horario', 'Comercial', '{"janelas":[{"dias":["seg"],"inicio":"08:00","fim":"18:00"}],"feriados":[]}');
select set_config('teste.horario', (select id::text from public.cadastros where nome = 'Comercial'), true);
select set_config('teste.fila', (select id::text from public.cadastros where nome = 'Fila Cobrança'), true);
select set_config('teste.maria', (select id::text from public.cadastros where nome = 'Maria Souza'), true);
update public.canais set arquivado = true where chave = 'chat';
insert into public.fluxos (empresa_id, nome, canal, descricao, meta_s) values (current_setting('teste.a')::uuid, 'Cobrança', 'whatsapp', 'Do aviso ao acordo', 600);
select set_config('teste.f', (select id::text from public.fluxos), true);
select public.salvar_fluxo(current_setting('teste.f')::uuid, 0, pg_temp.doc(current_setting('teste.fila')), '{"velocidade":2}');
select public.marcar_versao(current_setting('teste.f')::uuid, 'antes da Maria');
-- Em maiúsculas: o salvar_fluxo aceita, e o abrir_link tem que achar o cadastro do mesmo jeito.
select public.salvar_fluxo(current_setting('teste.f')::uuid, 1, pg_temp.doc(upper(current_setting('teste.maria')), current_setting('teste.horario')), '{"velocidade":3}');
insert into public.fluxos (empresa_id, nome) values (current_setting('teste.a')::uuid, 'Outro');
select set_config('teste.f2', (select id::text from public.fluxos where nome = 'Outro'), true);
select public.marcar_versao(current_setting('teste.f2')::uuid, 'um');
select public.marcar_versao(current_setting('teste.f2')::uuid, 'dois');

select pg_temp.entrar('00000000-0000-0000-0000-0000000000c2');
select set_config('teste.b', public.criar_empresa('Empresa B')::text, true);
insert into public.cadastros (empresa_id, tipo, nome) values (current_setting('teste.b')::uuid, 'pessoa', 'Beto');
select set_config('teste.beto', (select id::text from public.cadastros), true);
insert into public.fluxos (empresa_id, nome) values (current_setting('teste.b')::uuid, 'Do Beto');
select set_config('teste.fb', (select id::text from public.fluxos), true);

-- Cenários --------------------------------------------------------------------------------------
select pg_temp.entrar('00000000-0000-0000-0000-0000000000c1');
select lives_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, escolhas, esperado, revisao_aprovada)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'Paga na hora', 'i', '2026-11-23T16:57', '["c1"]',
       current_setting('teste.esperado')::jsonb, 2) $$,
  'membro salva um cenário no fluxo');
select set_config('teste.cenario', (select id::text from public.cenarios), true);
select is((select criado_por from public.cenarios), '00000000-0000-0000-0000-0000000000c1'::uuid, 'o autor é quem está logado');
select is((select modo from public.cenarios), 'relogio', 'o modo começa no relógio');
select throws_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, esperado, revisao_aprovada)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'X', 'i', '23/11/2026 16:57', current_setting('teste.esperado')::jsonb, 2) $$,
  '23514', null, 'a hora vai no formato AAAA-MM-DDTHH:MM');
select throws_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, esperado, revisao_aprovada)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'X', 'i', '2026-99-99T99:99', current_setting('teste.esperado')::jsonb, 2) $$,
  '23514', null, 'com mês, dia, hora e minuto que existem');
select throws_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, modo, esperado, revisao_aprovada)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'X', 'i', '2026-11-23T16:57', 'cenario', current_setting('teste.esperado')::jsonb, 2) $$,
  '23514', null, 'o modo é relogio ou livre');
select throws_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, esperado, revisao_aprovada)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'X', 'i', '2026-11-23T16:57', '{"caminho":["i"],"tempo_s":0}', 2) $$,
  '23514', null, 'o esperado diz como terminou');
select throws_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, esperado, revisao_aprovada)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'X', 'i', '2026-11-23T16:57',
       '{"caminho":["i"],"fim":{"motivo":"fim","peca":"f"},"tempo_s":"muito"}', 2) $$,
  '23514', null, 'e o tempo é um número');
select throws_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, esperado, revisao_aprovada)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'X', 'i', '2026-11-23T16:57',
       '{"caminho":["i",2],"fim":{"motivo":"fim","peca":"f"},"tempo_s":0}', 2) $$,
  '23514', null, 'o caminho é uma lista de ids');
select throws_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, escolhas, esperado, revisao_aprovada)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'X', 'i', '2026-11-23T16:57', '[{"conexao":"c1"}]',
       current_setting('teste.esperado')::jsonb, 2) $$,
  '23514', null, 'as escolhas também');
select throws_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, escolhas, esperado, revisao_aprovada)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'X', 'i', '2026-11-23T16:57', '[["c1"]]',
       current_setting('teste.esperado')::jsonb, 2) $$,
  '23514', null, 'lista dentro da lista não passa por lista de ids');
select throws_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, esperado, revisao_aprovada)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'X', 'i', '2026-11-23T16:57',
       '{"caminho":[["i"]],"fim":{"motivo":"fim","peca":"f"},"tempo_s":0}', 2) $$,
  '23514', null, 'nem no caminho');
-- Aprovar o resultado novo grava as escolhas que o motor aceitou (uma que sobrou deixaria o cenário "mudou").
select lives_ok($$ update public.cenarios set escolhas = '[]' $$, 'aprovar troca as escolhas');
select throws_ok($$ update public.cenarios set escolhas = '[["c1"]]' $$, '23514', null, 'na forma de uma lista de ids');
select throws_ok($$ update public.cenarios set inicio = 'f' $$, '42501', null, 'o começo não muda depois de salvo');
select throws_ok($$ update public.cenarios set quando = '2026-11-24T10:00' $$, '42501', null, 'nem a hora');
select throws_ok($$ update public.cenarios set modo = 'livre' $$, '42501', null, 'nem o modo');
reset role;
update public.cenarios set atualizado_em = now() - interval '1 day';
set local role authenticated;
select lives_ok(
  $$ update public.cenarios set nome = 'Paga no dia', esperado = '{"caminho":["i","f"],"fim":{"motivo":"fim","peca":"f"},"tempo_s":60}', revisao_aprovada = 3 $$,
  'renomear e aprovar o resultado novo, sim');
select is((select atualizado_em from public.cenarios), now(), 'e a data da mudança é a do banco');

-- Achados intencionais ------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.achados_intencionais (empresa_id, fluxo_id, chave, nota)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'sem_responsavel:a', 'de propósito') $$,
  'membro marca um achado como intencional');
select is((select autor from public.achados_intencionais), '00000000-0000-0000-0000-0000000000c1'::uuid, 'com o autor de quem marcou');
-- Marcar de novo, como o upsert do app (todas as colunas enviadas no "do update set").
select lives_ok(
  $$ insert into public.achados_intencionais (empresa_id, fluxo_id, chave, nota)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'sem_responsavel:a', 'a fila decide')
     on conflict (fluxo_id, chave) do update
       set empresa_id = excluded.empresa_id, fluxo_id = excluded.fluxo_id, chave = excluded.chave, nota = excluded.nota $$,
  'marcar de novo troca a nota');
select is((select nota from public.achados_intencionais), 'a fila decide', 'e a nota é a nova');
insert into public.achados_intencionais (empresa_id, fluxo_id, chave) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'inalcancavel:x');
select is(pg_temp.linhas($$ delete from public.achados_intencionais where chave = 'inalcancavel:x' $$), 1, 'e desmarca');
select throws_ok(
  $$ update public.achados_intencionais set autor = null $$,
  '42501', null, 'quem marcou não muda');
-- Um intencional do outro fluxo da mesma empresa: não vai no link da Cobrança.
insert into public.achados_intencionais (empresa_id, fluxo_id, chave, nota) values (current_setting('teste.a')::uuid, current_setting('teste.f2')::uuid, 'inalcancavel:outro', 'do Outro');

-- Links -------------------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.links (empresa_id, fluxo_id) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid) $$,
  'membro cria um link só com o fluxo');
select ok((select token ~ '^[A-Za-z0-9_-]{24}$' from public.links), 'o banco gera o token: 24 caracteres de URL');
select ok((select esconder_nomes and versao is null and expira_em is null from public.links), 'nomes escondidos, o fluxo de agora, sem prazo');
select is((select criado_por from public.links), '00000000-0000-0000-0000-0000000000c1'::uuid, 'o autor é quem está logado');
select set_config('teste.token', (select token from public.links), true);
select throws_ok(
  $$ insert into public.links (empresa_id, fluxo_id, token) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'escolhido-por-mim-123456') $$,
  '42501', null, 'o membro não escolhe o token');
select throws_ok(
  $$ insert into public.links (empresa_id, fluxo_id, criado_por) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, '00000000-0000-0000-0000-0000000000c2') $$,
  '42501', null, 'nem o autor');
select throws_ok(
  $$ insert into public.links (empresa_id, fluxo_id, criado_em) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, now() - interval '1 year') $$,
  '42501', null, 'nem a data de criação');
select throws_ok(
  $$ insert into public.links (empresa_id, fluxo_id, versao) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 9) $$,
  '23503', null, 'versão fixa tem que ser uma versão marcada do fluxo');
select throws_ok(
  $$ insert into public.links (empresa_id, fluxo_id, versao) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 2) $$,
  '23503', null, 'deste fluxo: a versão 2 só existe no Outro');
select throws_ok(
  $$ insert into public.links (empresa_id, fluxo_id, cenario) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid,
       '{"nome":"x","entrada":"entrada:e1","inicio":"2026-11-23T16:57","modo":"cenario","escolhas":[]}') $$,
  '23514', null, 'cenário no formato da v1 não entra');
select throws_ok(
  $$ insert into public.links (empresa_id, fluxo_id, cenario) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid,
       '{"nome":"x","inicio":"i","quando":"2026-11-23T16:57","modo":"livre","escolhas":[1]}') $$,
  '23514', null, 'nem com escolha que não é id');
select throws_ok(
  $$ insert into public.links (empresa_id, fluxo_id, cenario) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid,
       '{"nome":"x","inicio":"i","quando":"2026-11-23T16:57","modo":"livre","escolhas":[["c1"]]}') $$,
  '23514', null, 'nem com lista dentro da lista');
select throws_ok(
  $$ insert into public.links (empresa_id, fluxo_id, cenario) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid,
       '{"nome":"x","inicio":"i","quando":"2026-13-01T10:00","modo":"livre","escolhas":[]}') $$,
  '23514', null, 'nem com hora que não existe');
select throws_ok(
  $$ insert into public.links (empresa_id, fluxo_id, expira_em) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, now() - interval '1 day') $$,
  '23514', null, 'validade no passado não entra');
select lives_ok(
  $$ insert into public.links (empresa_id, fluxo_id, versao, esconder_nomes, expira_em, cenario)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 1, false, now() + interval '7 days',
       '{"nome":"E se pagar na hora?","inicio":"i","quando":"2026-11-23T16:57","modo":"relogio","escolhas":["c1"]}') $$,
  'link com versão fixa, nomes à mostra, validade e cenário');
select set_config('teste.token_fixo', (select token from public.links where versao = 1), true);
select throws_ok($$ update public.links set expira_em = null $$, '42501', null, 'a validade não muda depois de criado');
select throws_ok($$ delete from public.links $$, '42501', null, 'link não se apaga: revoga');
select throws_ok($$ select public.abrir_link(current_setting('teste.token')) $$, '42501', null, 'nem o membro chama abrir_link');
select throws_ok($$ truncate public.links $$, '42501', null, 'ninguém esvazia os links');
select throws_ok($$ truncate public.cenarios $$, '42501', null, 'nem os cenários');
select throws_ok($$ truncate public.achados_intencionais $$, '42501', null, 'nem os intencionais');

-- A empresa B não vê nem mexe em nada da A -------------------------------------------------------
select pg_temp.entrar('00000000-0000-0000-0000-0000000000c2');
insert into public.links (empresa_id, fluxo_id) values (current_setting('teste.b')::uuid, current_setting('teste.fb')::uuid);
select is((select count(*)::int from public.links), 1, 'o Beto vê só o link dele');
select is((select count(*)::int from public.cenarios) + (select count(*)::int from public.achados_intencionais), 0, 'e nenhum cenário nem intencional da A');
select is(pg_temp.linhas($$ update public.links set revogado_em = now() where empresa_id = current_setting('teste.a')::uuid $$), 0, 'não revoga link da A');
select is(pg_temp.linhas($$ update public.cenarios set nome = 'Intruso' $$) + pg_temp.linhas($$ delete from public.cenarios $$), 0, 'nem muda ou apaga cenário da A');
select is(pg_temp.linhas($$ delete from public.achados_intencionais $$), 0, 'nem desmarca intencional da A');
select throws_ok(
  $$ insert into public.links (empresa_id, fluxo_id) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid) $$,
  '42501', null, 'nem cria link no fluxo da A');
select throws_ok(
  $$ insert into public.links (empresa_id, fluxo_id) values (current_setting('teste.b')::uuid, current_setting('teste.f')::uuid) $$,
  '23503', null, 'nem com a empresa dele: o fluxo tem que ser da mesma empresa');
select throws_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, esperado, revisao_aprovada)
     values (current_setting('teste.b')::uuid, current_setting('teste.f')::uuid, 'Intruso', 'i', '2026-11-23T16:57', current_setting('teste.esperado')::jsonb, 2) $$,
  '23503', null, 'cenário também');
select throws_ok(
  $$ insert into public.achados_intencionais (empresa_id, fluxo_id, chave, nota)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'sem_responsavel:a', 'invasão')
     on conflict (fluxo_id, chave) do update
       set empresa_id = excluded.empresa_id, fluxo_id = excluded.fluxo_id, chave = excluded.chave, nota = excluded.nota $$,
  '42501', null, 'nem a nota de um intencional da A');

-- Revogar ---------------------------------------------------------------------------------------
select pg_temp.entrar('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.links where revogado_em is not null), 0, 'os links da A seguem sem revogação depois do Beto');
update public.links set revogado_em = '1999-01-01' where token = current_setting('teste.token');
select is((select revogado_em from public.links where token = current_setting('teste.token')), now(), 'a data da revogação é a do banco, não a que o app mandou');
select is(pg_temp.linhas($$ update public.links set revogado_em = null where token = current_setting('teste.token') $$), 0, 'revogar é pra sempre');

-- O link aberto, como o servidor do app (chave secreta) ------------------------------------------
set local role service_role;
select is(public.abrir_link('nao-existe'), '{"estado":"inexistente"}'::jsonb, 'token que não existe');
select is(public.abrir_link(current_setting('teste.token')) ->> 'estado', 'revogado', 'link revogado não abre');
select is(public.abrir_link(current_setting('teste.token')) ->> 'quando', to_jsonb(now()) #>> '{}', 'e diz desde quando');
select ok(public.abrir_link(current_setting('teste.token')) - array['estado', 'quando'] = '{}', 'e nada do fluxo');

reset role;
insert into public.links (empresa_id, fluxo_id) values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid);
select set_config('teste.token_atual', (select token from public.links where revogado_em is null and versao is null and fluxo_id = current_setting('teste.f')::uuid), true);
select set_config('teste.atual', public.abrir_link(current_setting('teste.token_atual'))::text, true);
select set_config('teste.fixo', public.abrir_link(current_setting('teste.token_fixo'))::text, true);
set local role service_role;

select is(current_setting('teste.atual')::jsonb ->> 'estado', 'ok', 'o link vale');
select is(current_setting('teste.atual')::jsonb -> 'empresa', '{"nome":"Empresa A"}'::jsonb, 'com o nome da empresa');
select is(current_setting('teste.atual')::jsonb -> 'fluxo', '{"nome":"Cobrança","canal":"whatsapp","descricao":"Do aviso ao acordo","meta_s":600}'::jsonb,
  'e o nome, o canal, a descrição e a meta do fluxo');
select is(current_setting('teste.atual')::jsonb -> 'documento', (select documento from public.fluxos where id = current_setting('teste.f')::uuid),
  'sem versão fixa, o documento é o de agora');
select is(current_setting('teste.atual')::jsonb -> 'estilo', '{"velocidade":3}'::jsonb, 'com o estilo de agora');
select is(current_setting('teste.atual')::jsonb -> 'versao', 'null'::jsonb, 'sem versão');
select is((current_setting('teste.atual')::jsonb -> 'atual' ->> 'revisao')::int, 2, 'mas com a revisão de agora');
select is(current_setting('teste.atual')::jsonb -> 'cadastros',
  jsonb_build_array(
    jsonb_build_object('id', current_setting('teste.horario'), 'tipo', 'horario', 'nome', 'Comercial',
      'campos', '{"janelas":[{"dias":["seg"],"inicio":"08:00","fim":"18:00"}],"feriados":[]}'::jsonb),
    jsonb_build_object('id', current_setting('teste.maria'), 'tipo', 'pessoa', 'nome', 'Maria Souza', 'campos', '{}'::jsonb)),
  'os cadastros são só os que o documento usa, e só o Horário leva os campos');
select is(current_setting('teste.atual')::jsonb -> 'pessoas', '["Maria Souza", "Zeca Lima"]'::jsonb,
  'com nomes escondidos, vão os nomes de todas as pessoas da empresa (pra sair também do texto livre)');
select is((select array_agg(c ->> 'chave' order by o) from jsonb_array_elements(current_setting('teste.atual')::jsonb -> 'canais') with ordinality x (c, o)),
  array['telefonia', 'whatsapp', 'email', 'chat', 'interno'], 'os canais da empresa, na ordem dela');
select is((select c -> 'arquivado' from jsonb_array_elements(current_setting('teste.atual')::jsonb -> 'canais') c where c ->> 'chave' = 'chat'), 'true'::jsonb,
  'os arquivados também, marcados');
select is(current_setting('teste.atual')::jsonb -> 'intencionais', '[{"chave":"sem_responsavel:a","nota":"a fila decide"}]'::jsonb,
  'os intencionais vão só com chave e nota, sem quem marcou');
select is(current_setting('teste.atual')::jsonb -> 'cenario', 'null'::jsonb, 'sem cenário inicial');

select is((current_setting('teste.fixo')::jsonb -> 'versao') - 'criada_em', '{"numero":1,"nome":"antes da Maria"}'::jsonb, 'com versão fixa, abre ela');
select is(current_setting('teste.fixo')::jsonb -> 'atual', 'null'::jsonb, 'e não diz nada do fluxo de agora');
select is(current_setting('teste.fixo')::jsonb -> 'documento', (select documento from public.fluxo_versoes where fluxo_id = current_setting('teste.f')::uuid and numero = 1),
  'o documento e o estilo são os da versão');
select is((select array_agg(c ->> 'nome') from jsonb_array_elements(current_setting('teste.fixo')::jsonb -> 'cadastros') c), array['Fila Cobrança'],
  'e os cadastros, os que a versão usa');
select is(current_setting('teste.fixo')::jsonb -> 'cenario' ->> 'nome', 'E se pagar na hora?', 'leva o cenário inicial');
select is(current_setting('teste.fixo')::jsonb -> 'esconder_nomes', 'false'::jsonb, 'e as opções do link');
select is(current_setting('teste.fixo')::jsonb -> 'pessoas', '[]'::jsonb, 'com os nomes à mostra, sem a lista das pessoas');

-- Um documento que aponta pra cadastro de outra empresa (o salvar_fluxo recusa; aqui, por fora): o cadastro não vem.
reset role;
update public.fluxos set documento = pg_temp.doc(current_setting('teste.beto')) where id = current_setting('teste.f2')::uuid;
insert into public.links (empresa_id, fluxo_id) values (current_setting('teste.a')::uuid, current_setting('teste.f2')::uuid);
set local role service_role;
select is(public.abrir_link((select token from public.links where fluxo_id = current_setting('teste.f2')::uuid)) -> 'cadastros', '[]'::jsonb,
  'cadastro de outra empresa não vem');
select is(public.abrir_link((select token from public.links where fluxo_id = current_setting('teste.f2')::uuid)) -> 'pessoas', '["Maria Souza", "Zeca Lima"]'::jsonb,
  'e as pessoas são só as da empresa do link');

-- A fila saiu do fluxo de agora, então pode ser apagada: a versão antiga continua abrindo, sem ela.
reset role;
delete from public.cadastros where id = current_setting('teste.fila')::uuid;
set local role service_role;
select is(public.abrir_link(current_setting('teste.token_fixo')) -> 'cadastros', '[]'::jsonb, 'cadastro apagado depois da versão não vem');

reset role;
update public.links set criado_em = now() - interval '10 days', expira_em = now() - interval '1 day' where token = current_setting('teste.token_fixo');
set local role service_role;
select is(public.abrir_link(current_setting('teste.token_fixo')) ->> 'estado', 'vencido', 'link vencido não abre');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.abrir_link(current_setting('teste.token_atual')) $$, '42501', null, 'quem não tem conta não chama abrir_link pela API');
select throws_ok($$ select * from public.links $$, '42501', null, 'nem lê a tabela de links');
select throws_ok($$ select * from public.cenarios $$, '42501', null, 'nem a de cenários');
select throws_ok($$ select * from public.achados_intencionais $$, '42501', null, 'nem a de intencionais');

-- Tetos alinhados: o maior cenário que entra cabe no link que o copia; um maior não entra.
set local role authenticated;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000c1');
select set_config('teste.muitas', (select jsonb_agg('c' || lpad(g::text, 6, '0'))::text from generate_series(1, 18000) g), true);
select ok(octet_length(current_setting('teste.muitas')) between 190000 and 200000, 'escolhas perto do teto (200 KB)');
select lives_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, escolhas, esperado, revisao_aprovada)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, repeat('n', 200), repeat('i', 1000), '2026-11-23T16:57',
       current_setting('teste.muitas')::jsonb, current_setting('teste.esperado')::jsonb, 2) $$,
  'o cenário com o máximo entra');
select lives_ok(
  $$ insert into public.links (empresa_id, fluxo_id, cenario)
     select empresa_id, fluxo_id, jsonb_build_object('nome', nome, 'inicio', inicio, 'quando', quando, 'modo', modo, 'escolhas', escolhas)
     from public.cenarios where nome = repeat('n', 200) $$,
  'e cabe no link que o copia');
select throws_ok(
  $$ insert into public.cenarios (empresa_id, fluxo_id, nome, inicio, quando, escolhas, esperado, revisao_aprovada)
     values (current_setting('teste.a')::uuid, current_setting('teste.f')::uuid, 'X', 'i', '2026-11-23T16:57',
       current_setting('teste.muitas')::jsonb || current_setting('teste.muitas')::jsonb, current_setting('teste.esperado')::jsonb, 2) $$,
  '23514', null, 'escolhas passando do teto não entram');

-- Apagar o fluxo leva tudo dele junto.
set local role authenticated;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000c1');
delete from public.fluxos where id = current_setting('teste.f')::uuid;
reset role;
select is(
  (select count(*)::int from public.links where fluxo_id = current_setting('teste.f')::uuid)
  + (select count(*)::int from public.cenarios where fluxo_id = current_setting('teste.f')::uuid)
  + (select count(*)::int from public.achados_intencionais where fluxo_id = current_setting('teste.f')::uuid),
  0, 'apagar o fluxo apaga os links, os cenários e os intencionais dele');

select * from finish();
rollback;
```

`supabase/tests/database/empresas.test.sql` (a parte do antigo `journey.test.sql` que não é da v1):

```sql
-- Empresas, membros e convites. Roda com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Duas pessoas, cada uma na sua empresa, mais o Caio (convidado) e o Davi (e-mail ainda não confirmado).
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-00000000000b', 'beto@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-00000000000c', 'caio@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-00000000000d', 'davi@exemplo.com', 'authenticated', 'authenticated', null);

create function pg_temp.entrar(p_id uuid, p_email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

select pg_temp.entrar('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com');
select lives_ok($$ select public.criar_empresa('Empresa A') $$, 'quem está logado cria uma empresa');
select is((select count(*)::int from public.empresas), 1, 'e vê só a sua');
select is((select count(*)::int from public.membros), 1, 'e entra como membro');
select set_config('teste.empresa_a', (select id::text from public.empresas), true);
select throws_ok($$ select public.criar_empresa('   ') $$, '23514', null, 'nome vazio não vale');

select pg_temp.entrar('00000000-0000-0000-0000-00000000000b', 'beto@exemplo.com');
select public.criar_empresa('Empresa B');
select set_config('teste.empresa_b', (select id::text from public.empresas), true);
select is((select array_agg(nome) from public.empresas), array['Empresa B'], 'quem é de outra empresa não vê a primeira');

-- Convite: a Ana convida o Caio; o Caio entra quando loga.
select pg_temp.entrar('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com');
select lives_ok(
  $$ insert into public.convites (empresa_id, email) select id, 'caio@exemplo.com' from public.empresas $$,
  'membro convida por e-mail');
insert into public.convites (empresa_id, email) select id, 'davi@exemplo.com' from public.empresas;
select pg_temp.entrar('00000000-0000-0000-0000-00000000000b', 'beto@exemplo.com');
select throws_ok(
  $$ insert into public.convites (empresa_id, email) values (current_setting('teste.empresa_a')::uuid, 'x@exemplo.com') $$,
  '42501', null, 'quem não é membro não convida');
select pg_temp.entrar('00000000-0000-0000-0000-00000000000b', 'caio@exemplo.com');
select is((select count(*)::int from public.aceitar_convites()), 0, 'o e-mail do token não vale: o Beto não pega o convite do Caio');
select pg_temp.entrar('00000000-0000-0000-0000-00000000000d', 'davi@exemplo.com');
select is((select count(*)::int from public.convites), 0, 'e-mail não confirmado não vê o convite');
select is((select count(*)::int from public.aceitar_convites()), 0, 'nem aceita');
select pg_temp.entrar('00000000-0000-0000-0000-00000000000c', 'caio@exemplo.com');
select is((select count(*)::int from public.aceitar_convites()), 1, 'o convidado entra ao aceitar');
select is((select array_agg(nome) from public.empresas), array['Empresa A'], 'e passa a ver a empresa');

-- Empresa: só o nome muda. E ninguém esvazia tabela por fora das regras.
select pg_temp.entrar('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com');
select lives_ok($$ update public.empresas set nome = 'Empresa A1' $$, 'membro renomeia a empresa');
select throws_ok(
  $$ update public.empresas set criada_por = auth.uid() $$,
  '42501', null, 'membro não troca quem criou a empresa');
select throws_ok($$ truncate public.membros $$, '42501', null, 'nem esvazia uma tabela');

-- Sem sessão (anon): não vê nada nem chama as funções.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.empresas) + (select count(*)::int from public.membros), 0, 'anon não vê empresas nem membros');
select throws_ok($$ select public.criar_empresa('X') $$, '42501', null, 'anon não cria empresa');
select throws_ok($$ select public.aceitar_convites() $$, '42501', null, 'anon não aceita convite');

-- Apagar uma pessoa não trava: o que ela criou fica, sem autor.
reset role;
select lives_ok($$ delete from auth.users where id = '00000000-0000-0000-0000-00000000000b' $$, 'dá pra apagar quem criou uma empresa');
select is((select criada_por from public.empresas where nome = 'Empresa B'), null, 'e a empresa fica, sem quem criou');

-- O Davi confirma o e-mail e aí o convite vale.
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000000d';
set local role authenticated;
select pg_temp.entrar('00000000-0000-0000-0000-00000000000d', 'davi@exemplo.com');
select is((select count(*)::int from public.aceitar_convites()), 1, 'com o e-mail confirmado, o convite vale');

select * from finish();
rollback;
```

```bash
git rm -q supabase/tests/database/journey.test.sql supabase/tests/database/links.test.sql
```

- [ ] **Passo 2: a migração**

`supabase/migrations/20261115000000_journey_v2_compartilhar.sql`:

```sql
-- Journey v2 (etapa C): cenários, achados intencionais e links públicos sobre os fluxos. A v1 sai do banco.
-- Como na A: toda tabela tem empresa_id, RLS só pra membros, e filha liga o fluxo pela dupla (fluxo_id, empresa_id).
-- O link segue o desenho da v1 (etapa 3): token, autor e datas são do banco, revogar é pra sempre, e quem abre
-- o link não tem conta: o servidor do app lê pelo abrir_link, que só a chave secreta (service_role) chama.

-- A v1 sai -----------------------------------------------------------------------------
-- Catálogo, imports, jornadas e o que pendurava nelas. Sem conversão: em produção essas tabelas estão vazias, e a
-- guarda abaixo confere antes de apagar qualquer coisa (em produção, rode antes dentro de begin/rollback).
-- Sem "if exists" nas nossas tabelas e funções: as migrações de antes criam todas, e se faltar uma é bom saber.

-- Guarda: com dado da v1 ou arquivo no bucket de imports, a migração para sem mexer em nada. Os arquivos só saem
-- pela API do Storage (ou pelo painel): apagar a linha de storage.objects deixaria o arquivo órfão no S3.
do $$
declare
  v_subindo boolean := false;
begin
  if exists (select 1 from public.jornadas) or exists (select 1 from public.imports)
    or exists (select 1 from public.links) or exists (select 1 from public.cenarios) then
    raise exception 'a v1 tem dados (jornadas, imports, links ou cenários): confira e esvazie antes de migrar';
  end if;
  -- Envio em partes que não terminou também guarda arquivo no S3. A tabela é de versões mais novas do Storage.
  if to_regclass('storage.s3_multipart_uploads') is not null then
    execute $q$ select exists (select 1 from storage.s3_multipart_uploads where bucket_id = 'imports') $q$ into v_subindo;
  end if;
  if v_subindo or exists (select 1 from storage.objects where bucket_id = 'imports') then
    raise exception 'o bucket imports não está vazio: esvazie pela API do Storage ou pelo painel antes de migrar';
  end if;
end;
$$;

drop function public.abrir_link(text);
drop function public.confirmar_import(uuid, jsonb);
drop function public.onde_usado(uuid, text);
drop view public.jornadas_resumo;
drop table public.links, public.cenarios, public.achados_intencionais, public.jornada_refs, public.jornada_versoes,
  public.jornadas, public.catalogo_membros, public.catalogo, public.imports;
drop function public.links_revogado_agora();

-- O bucket dos arquivos importados. O schema storage é do Supabase: aí sim "if exists".
drop policy if exists "membro lê arquivos de import" on storage.objects;
drop policy if exists "membro envia arquivos de import" on storage.objects;
drop function public.empresa_do_caminho(text);
-- O bucket já está vazio (a guarda conferiu). O Storage recusa apagar direto nas tabelas dele (protect_delete) sem
-- esta chave; is_local: vale só até o fim da transação.
do $$
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id = 'imports';
end;
$$;

-- Cenários: um caminho salvo do play, com o resultado esperado ---------------------------

create table public.cenarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  fluxo_id uuid not null,
  nome text not null check (length(btrim(nome)) between 1 and 200),
  -- Id da peça Início de onde a água sai. Não se confere com o documento: o fluxo muda, e o cenário avisa.
  inicio text not null check (length(inicio) between 1 and 1000),
  -- Data e hora simuladas do começo (a do motor), AAAA-MM-DDTHH:MM, com mês, dia, hora e minuto possíveis.
  quando text not null check (quando ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$'),
  modo text not null default 'relogio' check (modo in ('relogio', 'livre')),
  -- As escolhas, em ordem: ids de conexão. O motor refaz uma por uma (simular).
  escolhas jsonb not null default '[]',
  -- O resultado aprovado: { caminho: [ids das peças, em ordem], fim: { motivo, peca }, tempo_s }.
  esperado jsonb not null,
  -- A revisão do fluxo em que o resultado foi aprovado.
  revisao_aprovada int not null check (revisao_aprovada >= 0),
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (fluxo_id, empresa_id) references public.fluxos (id, empresa_id) on delete cascade,
  -- jsonb_path_exists confere cada item da lista (um check não aceita subconsulta). strict: no modo lax, uma lista
  -- dentro da lista seria aberta e os itens dela conferidos no lugar dela; silent: no strict, o que não é lista dá
  -- null em vez de erro. coalesce: chave faltando dá null, e null passaria no check. case: o Postgres não garante a
  -- ordem do and, e o cast falharia num texto.
  constraint cenarios_escolhas check (coalesce(
    jsonb_typeof(escolhas) = 'array' and not jsonb_path_exists(escolhas, 'strict $[*] ? (@.type() != "string")', '{}', true), false)),
  constraint cenarios_esperado check (coalesce(
    jsonb_typeof(esperado) = 'object'
    and jsonb_typeof(esperado -> 'caminho') = 'array'
    and not jsonb_path_exists(esperado, 'strict $.caminho[*] ? (@.type() != "string")', '{}', true)
    and (esperado -> 'fim' ->> 'motivo') in ('fim', 'beco', 'ciclo', 'limite', 'inexistente')
    and jsonb_typeof(esperado -> 'fim' -> 'peca') in ('string', 'null')
    and case when jsonb_typeof(esperado -> 'tempo_s') = 'number' then (esperado ->> 'tempo_s')::numeric >= 0 else false end, false)),
  -- Contra lixo: o caminho de um fluxo de 2.000 peças cabe com folga. As escolhas têm o mesmo teto da cópia que vai
  -- pro link (links_cenario_tamanho): um cenário que entra aqui sempre cabe num link.
  constraint cenarios_tamanho check (octet_length(escolhas::text) <= 200000 and octet_length(esperado::text) <= 2000000)
);
create index cenarios_fluxo on public.cenarios (fluxo_id, nome);
create index cenarios_empresa on public.cenarios (empresa_id);

-- Aprovar o resultado novo ou renomear mudam o cenário: a data é a do banco.
create function public.carimbar_cenario() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
create trigger carimbar_cenario before update on public.cenarios for each row execute function public.carimbar_cenario();

-- Achados marcados como intencionais: a chave do achado (diagnosticar) e a nota de quem marcou --------

create table public.achados_intencionais (
  fluxo_id uuid not null,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  -- O diagnóstico resume a chave comprida (a de um ciclo juntaria os ids de todas as peças): ela não passa de umas
  -- 230 letras. O teto fica abaixo do que o índice da chave primária aceita (uns 2.700 bytes).
  chave text not null check (length(chave) between 1 and 2000),
  nota text not null default '' check (length(nota) <= 5000),
  autor uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  primary key (fluxo_id, chave),
  foreign key (fluxo_id, empresa_id) references public.fluxos (id, empresa_id) on delete cascade
);
create index achados_intencionais_empresa on public.achados_intencionais (empresa_id);

-- Links públicos -----------------------------------------------------------------------------

create table public.links (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  fluxo_id uuid not null,
  -- 18 bytes aleatórios em base64 de URL: 24 caracteres, sem "=". Só o banco gera (a coluna não tem grant de insert).
  token text not null unique default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  -- null: o fluxo como está agora (o que está sendo editado). Número: uma versão marcada (fluxo_versoes).
  versao int,
  esconder_nomes boolean not null default true,
  -- Cenário inicial, copiado do cenário salvo quando o link foi criado: { nome, inicio, quando, modo, escolhas }.
  -- Cópia, e não referência: o link continua mostrando o que foi mandado mesmo se o cenário mudar ou for apagado.
  cenario jsonb,
  -- null: sem prazo.
  expira_em timestamptz,
  revogado_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (id, empresa_id),
  foreign key (fluxo_id, empresa_id) references public.fluxos (id, empresa_id) on delete cascade,
  -- Versão fixa tem que existir neste fluxo (com versao null, a chave não é conferida).
  foreign key (fluxo_id, versao) references public.fluxo_versoes (fluxo_id, numero) on delete cascade,
  constraint links_validade check (expira_em is null or expira_em > criado_em),
  constraint links_cenario check (cenario is null or coalesce(
    jsonb_typeof(cenario) = 'object'
    and jsonb_typeof(cenario -> 'nome') = 'string'
    and length(btrim(cenario ->> 'nome')) between 1 and 200
    and jsonb_typeof(cenario -> 'inicio') = 'string'
    and length(cenario ->> 'inicio') between 1 and 1000
    and (cenario ->> 'quando') ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$'
    and (cenario ->> 'modo') in ('relogio', 'livre')
    and jsonb_typeof(cenario -> 'escolhas') = 'array'
    and not jsonb_path_exists(cenario, 'strict $.escolhas[*] ? (@.type() != "string")', '{}', true), false)),
  -- As escolhas (até 200 KB, como em cenarios_tamanho) mais nome, início, hora e modo.
  constraint links_cenario_tamanho check (octet_length(cenario::text) <= 210000)
);
create index links_fluxo on public.links (fluxo_id, criado_em desc);
create index links_empresa on public.links (empresa_id);

-- A data da revogação é a do banco, seja qual for a que o app mandou (o grant deixa escrever a coluna).
create function public.links_revogado_agora() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.revogado_em := now();
  return new;
end;
$$;
create trigger links_revogado_agora before update of revogado_em on public.links
  for each row execute function public.links_revogado_agora();

-- Regras de acesso ---------------------------------------------------------------------------

alter table public.cenarios enable row level security;
alter table public.achados_intencionais enable row level security;
alter table public.links enable row level security;

create policy "membro vê os cenários" on public.cenarios for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria cenário" on public.cenarios for insert to authenticated with check (public.eh_membro(empresa_id) and criado_por = auth.uid());
create policy "membro muda cenário" on public.cenarios for update to authenticated using (public.eh_membro(empresa_id)) with check (public.eh_membro(empresa_id));
create policy "membro apaga cenário" on public.cenarios for delete to authenticated using (public.eh_membro(empresa_id));

create policy "membro vê os intencionais" on public.achados_intencionais for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro marca intencional" on public.achados_intencionais for insert to authenticated with check (public.eh_membro(empresa_id) and autor = auth.uid());
create policy "membro muda a nota do intencional" on public.achados_intencionais for update to authenticated
  using (public.eh_membro(empresa_id)) with check (public.eh_membro(empresa_id));
create policy "membro desmarca intencional" on public.achados_intencionais for delete to authenticated using (public.eh_membro(empresa_id));

create policy "membro vê os links" on public.links for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria link" on public.links for insert to authenticated
  with check (public.eh_membro(empresa_id) and criado_por = auth.uid() and revogado_em is null);
-- Revogar é pra sempre: só muda link ainda não revogado, e só pra revogado.
create policy "membro revoga link" on public.links for update to authenticated
  using (public.eh_membro(empresa_id) and revogado_em is null)
  with check (public.eh_membro(empresa_id) and revogado_em is not null);

-- Por coluna, o que a tela grava. Autor e datas são do banco.
revoke all on public.cenarios, public.achados_intencionais, public.links from anon;
revoke insert, update, delete, truncate, trigger, references, maintain on public.cenarios, public.achados_intencionais, public.links from authenticated;
-- Cenário: o começo (início, hora, modo) não muda depois de salvo; renomear e aprovar o resultado novo, sim. Aprovar
-- grava também as escolhas que o motor aceitou: uma escolha que o fluxo novo não usa mais deixaria o cenário "mudou".
grant insert (empresa_id, fluxo_id, nome, inicio, quando, modo, escolhas, esperado, revisao_aprovada) on public.cenarios to authenticated;
grant update (nome, escolhas, esperado, revisao_aprovada) on public.cenarios to authenticated;
grant delete on public.cenarios to authenticated;
-- Marcar de novo (upsert) troca a nota. As quatro colunas porque o upsert do PostgREST põe no "do update set"
-- toda coluna enviada, e sem permissão em alguma delas até o primeiro upsert falha. A regra e a FK composta
-- seguram a empresa; autor e criado_em ficam como estão.
grant insert (empresa_id, fluxo_id, chave, nota) on public.achados_intencionais to authenticated;
grant update (empresa_id, fluxo_id, chave, nota) on public.achados_intencionais to authenticated;
grant delete on public.achados_intencionais to authenticated;
-- Link: na criação, só as opções; depois, só revoga.
grant insert (empresa_id, fluxo_id, versao, esconder_nomes, cenario, expira_em) on public.links to authenticated;
grant update (revogado_em) on public.links to authenticated;

-- O link aberto -------------------------------------------------------------------------------

-- O que o link mostra, pelo token, numa ida só. Devolve { estado } e, quando o link vale:
-- { empresa: { nome }, fluxo: { nome, canal, descricao, meta_s }, documento, estilo,
--   versao: { numero, nome, criada_em } (versão fixa) ou null, atual: { revisao, editado_em } (o fluxo de agora) ou null,
--   cadastros (só os que o documento usa), canais, intencionais: [{ chave, nota }], esconder_nomes, cenario, expira_em,
--   pessoas: [nomes] }.
-- Esconder os nomes é com o servidor do app, antes de qualquer coisa ir pro navegador: `pessoas` traz o nome de todo
-- cadastro do tipo Pessoa da empresa (com "esconder nomes"), pra sair também do texto livre que cita quem não é
-- responsável de nenhuma peça. O servidor usa e não repassa.
-- De propósito: com versão fixa, o nome, a descrição, o canal e a meta são os do fluxo de agora (fluxo_versoes guarda
-- só o documento e o estilo). O link mostra o desenho daquela versão com o nome que o fluxo tem hoje.
-- security invoker: quem chama é o servidor do app com a chave secreta (service_role, que passa pela RLS).
-- Nenhum outro papel executa: com o token na mão, ninguém lê pela API o que o servidor esconderia.
create function public.abrir_link(p_token text) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_link public.links%rowtype;
  v_fluxo public.fluxos%rowtype;
  v_versao public.fluxo_versoes%rowtype;
  v_documento jsonb;
  v_estilo jsonb;
begin
  select * into v_link from public.links where token = p_token;
  if not found then
    return jsonb_build_object('estado', 'inexistente');
  end if;
  if v_link.revogado_em is not null then
    return jsonb_build_object('estado', 'revogado', 'quando', v_link.revogado_em);
  end if;
  if v_link.expira_em is not null and v_link.expira_em <= now() then
    return jsonb_build_object('estado', 'vencido', 'quando', v_link.expira_em);
  end if;
  -- O fluxo e a versão existem: as duas FKs apagam o link junto.
  select * into v_fluxo from public.fluxos where id = v_link.fluxo_id;
  if v_link.versao is null then
    v_documento := v_fluxo.documento;
    v_estilo := v_fluxo.estilo;
  else
    select * into v_versao from public.fluxo_versoes where fluxo_id = v_link.fluxo_id and numero = v_link.versao;
    v_documento := v_versao.documento;
    v_estilo := v_versao.estilo;
  end if;
  return jsonb_build_object(
    'estado', 'ok',
    'empresa', (select jsonb_build_object('nome', e.nome) from public.empresas e where e.id = v_link.empresa_id),
    'fluxo', jsonb_build_object('nome', v_fluxo.nome, 'canal', v_fluxo.canal, 'descricao', v_fluxo.descricao, 'meta_s', v_fluxo.meta_s),
    'documento', v_documento,
    'estilo', v_estilo,
    'versao', case when v_link.versao is not null
      then jsonb_build_object('numero', v_versao.numero, 'nome', v_versao.nome, 'criada_em', v_versao.criada_em) end,
    'atual', case when v_link.versao is null
      then jsonb_build_object('revisao', v_fluxo.revisao, 'editado_em', v_fluxo.editado_em) end,
    -- Os responsáveis das peças deste documento (o "onde é usado" é do fluxo de agora; a versão fixa pode usar
    -- outros). Só cadastro desta empresa; o que foi apagado depois de a versão ser marcada simplesmente não vem.
    -- Dos campos, só os do Horário (o relógio do play precisa): os outros podem ter telefone, e-mail…
    'cadastros', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'tipo', c.tipo, 'nome', c.nome,
          'campos', case when c.tipo = 'horario' then c.campos else '{}'::jsonb end) order by c.nome, c.id)
      from public.cadastros c
      where c.empresa_id = v_link.empresa_id
        and c.id in (
          select lower(p ->> 'responsavel')::uuid
          from jsonb_array_elements(case when jsonb_typeof(v_documento -> 'pecas') = 'array' then v_documento -> 'pecas' else '[]' end) p
          where lower(p ->> 'responsavel') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')), '[]'::jsonb),
    -- Os arquivados também: um fluxo antigo pode passar por um canal que a empresa arquivou depois.
    'canais', coalesce((
      select jsonb_agg(jsonb_build_object('chave', k.chave, 'nome', k.nome, 'cor', k.cor, 'arquivado', k.arquivado) order by k.ordem, k.nome)
      from public.canais k where k.empresa_id = v_link.empresa_id), '[]'::jsonb),
    -- Só chave e nota: quem marcou (autor) não sai daqui.
    'intencionais', coalesce((
      select jsonb_agg(jsonb_build_object('chave', i.chave, 'nota', i.nota) order by i.chave)
      from public.achados_intencionais i where i.fluxo_id = v_link.fluxo_id), '[]'::jsonb),
    'esconder_nomes', v_link.esconder_nomes,
    'cenario', v_link.cenario,
    'expira_em', v_link.expira_em,
    'pessoas', case when v_link.esconder_nomes then coalesce((
      select jsonb_agg(c.nome order by c.nome) from public.cadastros c where c.empresa_id = v_link.empresa_id and c.tipo = 'pessoa'), '[]'::jsonb)
      else '[]'::jsonb end);
end;
$$;

revoke execute on function public.abrir_link(text) from public, anon, authenticated;
grant execute on function public.abrir_link(text) to service_role;
```

- [ ] **Passo 3: aplicar no banco local**

Run: `npx supabase migration up --local`
Expected: aplica `20261115000000_journey_v2_compartilhar.sql`.

Se parar com "a v1 tem dados…" ou "o bucket imports não está vazio…", são sobras dos testes da v1 no banco local. **Não apague à mão:** confira com o Bruno, ou recrie o banco local inteiro com `npx supabase db reset` só se ninguém mais usa esse banco (o reset apaga tudo e reaplica as migrações).

- [ ] **Passo 4: rodar os testes de banco**

Run: `npx supabase test db`
Expected: `Files=3, Tests=168` e `Result: PASS` (compartilhar 101, empresas 21, fluxos 46).

Os testes da v1 no app (`npm test`) falham até a tarefa 3: as tabelas deles sumiram.

- [ ] **Passo 5: commit**

```bash
git add supabase
git commit -m "banco: cenários, intencionais e links sobre os fluxos; a v1 sai (com guarda)" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 3: a v1 sai do app

**Arquivos:**
- Apagar: as rotas, componentes, módulos, ações, testes e specs da v1 (lista no passo 1)
- Modificar: `apps/web/package.json`, `next.config.ts`, `src/proxy.ts`, `src/app/globals.css`, `src/app/empresa/nova/page.tsx`, `src/componentes/editor/editor.css`, `src/lib/dados.ts`, `e2e/apoio.ts`, `test/banco/links.test.ts`, `test/chave-secreta.test.ts`, `test/lib/dados.test.ts`

- [ ] **Passo 1: apagar a v1**

```bash
git rm -q \
  'apps/web/e2e/aceitacao.spec.ts' \
  'apps/web/e2e/capturas.spec.ts' \
  'apps/web/e2e/catalogo.spec.ts' \
  'apps/web/e2e/fixtures/pequena-sem-vendas.json' \
  'apps/web/e2e/fixtures/pequena.json' \
  'apps/web/e2e/fixtures/whatsapp.json' \
  'apps/web/e2e/importar.spec.ts' \
  'apps/web/e2e/links.spec.ts' \
  'apps/web/e2e/mapa.spec.ts' \
  'apps/web/e2e/simulacao.spec.ts' \
  'apps/web/src/acoes/importar.ts' \
  'apps/web/src/acoes/jornada.ts' \
  'apps/web/src/acoes/links.ts' \
  'apps/web/src/app/e/[empresa]/catalogo/page.tsx' \
  'apps/web/src/app/e/[empresa]/importar/[import]/botoes.tsx' \
  'apps/web/src/app/e/[empresa]/importar/[import]/page.tsx' \
  'apps/web/src/app/e/[empresa]/importar/[import]/relatorio/route.ts' \
  'apps/web/src/app/e/[empresa]/importar/formulario.tsx' \
  'apps/web/src/app/e/[empresa]/importar/page.tsx' \
  'apps/web/src/app/e/[empresa]/j/[jornada]/error.tsx' \
  'apps/web/src/app/e/[empresa]/j/[jornada]/page.tsx' \
  'apps/web/src/app/l/[token]/error.tsx' \
  'apps/web/src/app/l/[token]/page.tsx' \
  'apps/web/src/app/modelos/[arquivo]/route.ts' \
  'apps/web/src/compartilhar/retrato.ts' \
  'apps/web/src/componentes/jornada/Agenda.tsx' \
  'apps/web/src/componentes/jornada/Cartao.tsx' \
  'apps/web/src/componentes/jornada/Compartilhar.tsx' \
  'apps/web/src/componentes/jornada/Jornada.tsx' \
  'apps/web/src/componentes/jornada/PainelDiagnostico.tsx' \
  'apps/web/src/componentes/jornada/PainelRamais.tsx' \
  'apps/web/src/componentes/jornada/jornada.css' \
  'apps/web/src/componentes/jornada/usePlayer.ts' \
  'apps/web/src/componentes/mapa/Cano.tsx' \
  'apps/web/src/componentes/mapa/MapaFluxo.tsx' \
  'apps/web/src/componentes/mapa/NoPonto.tsx' \
  'apps/web/src/componentes/mapa/contexto.ts' \
  'apps/web/src/diagnostico/agenda.ts' \
  'apps/web/src/diagnostico/caminho.ts' \
  'apps/web/src/importacao/analisar.ts' \
  'apps/web/src/importacao/jornadas.ts' \
  'apps/web/src/importacao/limite.ts' \
  'apps/web/src/importacao/revisao.ts' \
  'apps/web/src/lib/documento.ts' \
  'apps/web/src/lib/link.ts' \
  'apps/web/src/mapa/montar.ts' \
  'apps/web/src/simulacao/comparar.ts' \
  'apps/web/src/simulacao/descrever.ts' \
  'apps/web/src/simulacao/estado.ts' \
  'apps/web/src/simulacao/passos.ts' \
  'apps/web/src/simulacao/sessao.ts' \
  'apps/web/src/simulacao/vinculo.ts' \
  'apps/web/test/acoes/importar.test.ts' \
  'apps/web/test/acoes/jornada.test.ts' \
  'apps/web/test/acoes/links.test.ts' \
  'apps/web/test/banco/import.test.ts' \
  'apps/web/test/central.ts' \
  'apps/web/test/cliente-sem-exceljs.test.ts' \
  'apps/web/test/compartilhar/retrato.test.ts' \
  'apps/web/test/diagnostico/agenda.test.ts' \
  'apps/web/test/diagnostico/caminho.test.ts' \
  'apps/web/test/importacao/analisar.test.ts' \
  'apps/web/test/importacao/jornadas.test.ts' \
  'apps/web/test/importacao/limite.test.ts' \
  'apps/web/test/importacao/revisao.test.ts' \
  'apps/web/test/lib/link.test.ts' \
  'apps/web/test/mapa/montar.test.ts' \
  'apps/web/test/simulacao/descrever.test.ts' \
  'apps/web/test/simulacao/estado.test.ts' \
  'apps/web/test/simulacao/passos.test.ts' \
  'apps/web/test/simulacao/sessao.test.ts' \
  'apps/web/test/simulacao/vinculo.test.ts'
```

- [ ] **Passo 2: dependências e configuração**

`apps/web/package.json`:

```diff
diff --git a/apps/web/package.json b/apps/web/package.json
index 2d0dba8..2c8bc19 100644
--- a/apps/web/package.json
+++ b/apps/web/package.json
@@ -13,10 +13,8 @@
   },
   "dependencies": {
     "@journey/fluxo": "*",
-    "@journey/nucleo": "*",
     "@supabase/ssr": "0.12.7",
     "@supabase/supabase-js": "2.119.0",
-    "@xyflow/react": "12.12.1",
     "next": "16.4.6",
     "react": "19.3.1",
     "react-dom": "19.3.1",
```

Depois, da raiz: `npm install` (atualiza o `package-lock.json`: o `@xyflow/react` sai; o `exceljs` fica pelo pacote do núcleo).

`apps/web/next.config.ts`:

```diff
diff --git a/apps/web/next.config.ts b/apps/web/next.config.ts
index e951274..990cbb1 100644
--- a/apps/web/next.config.ts
+++ b/apps/web/next.config.ts
@@ -1,7 +1,7 @@
 import type { NextConfig } from 'next';
 
 const config: NextConfig = {
-  transpilePackages: ['@journey/nucleo', '@journey/fluxo'],
+  transpilePackages: ['@journey/fluxo'],
   // O link público: nenhum buscador indexa, e o endereço (que é a chave) não vai no Referer pra outro site.
   headers: async () => [
     {
@@ -12,13 +12,6 @@ const config: NextConfig = {
       ],
     },
   ],
-  serverExternalPackages: ['exceljs'],
-  experimental: {
-    // O import aceita até 4 MB (importacao/limite.ts; a Vercel corta em 4,5 MB); a folga é das bordas do multipart.
-    serverActions: { bodySizeLimit: '5mb' },
-    // Com proxy, o Next guarda o corpo em memória até este tamanho (padrão 10 MB) e corta o resto em silêncio.
-    proxyClientMaxBodySize: '5mb',
-  },
 };
 
 export default config;
```

`apps/web/src/proxy.ts`:

```diff
diff --git a/apps/web/src/proxy.ts b/apps/web/src/proxy.ts
index 9d2e4d7..c3c54b4 100644
--- a/apps/web/src/proxy.ts
+++ b/apps/web/src/proxy.ts
@@ -26,4 +26,4 @@ export async function proxy(request: NextRequest) {
   return resposta;
 }
 
-export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|modelos/).*)'] };
+export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

- [ ] **Passo 3: o que sobrava da v1 nos arquivos que ficam**

`apps/web/src/app/globals.css`:

```diff
diff --git a/apps/web/src/app/globals.css b/apps/web/src/app/globals.css
index f5890bd..d690ed8 100644
--- a/apps/web/src/app/globals.css
+++ b/apps/web/src/app/globals.css
@@ -4,15 +4,11 @@
   --ink: #13212a; --ink-2: #4b5d68; --ink-3: #7c8c95; --line: #d2dbdf;
   --node: #ffffff; --node-line: #b6c3ca; --tile: #e7eef1; --plate: #13212a17;
   --pipe-wall: #9fafb8; --pipe-core: #d9e1e5; --pipe-sheen: #f6f9fa;
-  --lane: #e2e9ec; --lane-ink: #b4c1c8;
-  --w-telefonia: #1e8bdc; --w-whatsapp: #159e5a; --w-ocorrencia: #7650d6; --w-email: #c98410;
-  --ret: #8e7ccb; --foam: #ffffff;
+  --w-telefonia: #1e8bdc;
   --bad: #cf3a3a; --bad-soft: #fbe4e2; --warn: #9c6205; --warn-soft: #fbefd6;
   --ok: #17914f; --ok-soft: #ddf3e6; --info: #3a6a88; --info-soft: #e0ecf3;
   --btn: #13212a; --btn-ink: #f2f6f7;
   --shadow: 0 14px 36px -16px rgba(14, 38, 52, 0.42);
-  --agenda-1: #1e7fd0; --agenda-2: #c98410; --agenda-3: #17914f; --agenda-4: #7650d6; --agenda-5: #cf3a3a; --agenda-6: #3a6a88;
-  --lit: var(--w-telefonia);
   /* Editor (v2): destaque, nota, grupo e quanto as cores claras se misturam no fundo. */
   --accent: #1e8bdc; --accent-soft: #dcecf8; --nota: #f6eaa8; --nota-ink: #4f4110; --grupo: #dfe8ec; --mistura: 60%;
   --f-display: var(--fonte-display), 'IBM Plex Sans', system-ui, sans-serif;
@@ -26,15 +22,12 @@
     --ink: #e2ebee; --ink-2: #9baeb8; --ink-3: #6b7f8a; --line: #1f2c34;
     --node: #121d24; --node-line: #2e404a; --tile: #1b2931; --plate: #00000066;
     --pipe-wall: #34454f; --pipe-core: #1a252c; --pipe-sheen: #2d3d46;
-    --lane: #10191e; --lane-ink: #26353d;
-    --w-telefonia: #46a8f0; --w-whatsapp: #2cc274; --w-ocorrencia: #9c7ef2; --w-email: #eda63a;
-    --ret: #8e80d8;
+    --w-telefonia: #46a8f0;
     --accent: #46a8f0; --accent-soft: #14283a; --nota: #4a4220; --nota-ink: #f3e7b0; --grupo: #131f26; --mistura: 16%;
     --bad: #f06a62; --bad-soft: #3a1c1d; --warn: #e6a23c; --warn-soft: #33270f;
     --ok: #3cc47d; --ok-soft: #12301f; --info: #7fb2d6; --info-soft: #14262f;
     --btn: #e2ebee; --btn-ink: #0a1014;
     --shadow: 0 16px 40px -14px rgba(0, 0, 0, 0.65);
-    --agenda-1: #3b86cc; --agenda-2: #bf8326; --agenda-3: #3cc47d; --agenda-4: #9c7ef2; --agenda-5: #f06a62; --agenda-6: #7fb2d6;
     color-scheme: dark;
   }
 }
@@ -43,15 +36,12 @@
   --ink: #e2ebee; --ink-2: #9baeb8; --ink-3: #6b7f8a; --line: #1f2c34;
   --node: #121d24; --node-line: #2e404a; --tile: #1b2931; --plate: #00000066;
   --pipe-wall: #34454f; --pipe-core: #1a252c; --pipe-sheen: #2d3d46;
-  --lane: #10191e; --lane-ink: #26353d;
-  --w-telefonia: #46a8f0; --w-whatsapp: #2cc274; --w-ocorrencia: #9c7ef2; --w-email: #eda63a;
-  --ret: #8e80d8;
+  --w-telefonia: #46a8f0;
   --accent: #46a8f0; --accent-soft: #14283a; --nota: #4a4220; --nota-ink: #f3e7b0; --grupo: #131f26; --mistura: 16%;
   --bad: #f06a62; --bad-soft: #3a1c1d; --warn: #e6a23c; --warn-soft: #33270f;
   --ok: #3cc47d; --ok-soft: #12301f; --info: #7fb2d6; --info-soft: #14262f;
   --btn: #e2ebee; --btn-ink: #0a1014;
   --shadow: 0 16px 40px -14px rgba(0, 0, 0, 0.65);
-  --agenda-1: #3b86cc; --agenda-2: #bf8326; --agenda-3: #3cc47d; --agenda-4: #9c7ef2; --agenda-5: #f06a62; --agenda-6: #7fb2d6;
   color-scheme: dark;
 }
 
@@ -78,14 +68,9 @@ h2 { font-size: 18px; font-weight: 700; }
 .marca svg { width: 30px; height: 30px; }
 .migalhas { display: flex; align-items: center; gap: 7px; color: var(--ink-2); font-size: 13px; min-width: 0; }
 .migalhas .barra { color: var(--ink-3); }
-/* No link público o nome da jornada é o h1 da página, com o desenho das migalhas. */
-.migalhas h1 { font: inherit; letter-spacing: inherit; }
-.selos-link { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; }
-.selos-link .validade { color: var(--ink-2); font-size: 12.5px; }
 .nav { display: flex; gap: 2px; padding: 3px; background: var(--panel); border: 1px solid var(--line); border-radius: 11px; flex-wrap: wrap; }
 .nav a, .nav button { display: flex; align-items: center; gap: 7px; border: 0; background: none; border-radius: 8px; padding: 5px 11px; font-size: 12.5px; font-weight: 500; color: var(--ink-2); cursor: pointer; text-decoration: none; }
 .nav a[aria-current='page'], .nav button[aria-pressed='true'], .nav button[aria-selected='true'] { background: var(--node); color: var(--ink); box-shadow: 0 1px 0 var(--line); }
-.nav .ponto { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
 .empurra { margin-left: auto; }
 
 /* Páginas comuns. */
@@ -116,9 +101,6 @@ h2 { font-size: 18px; font-weight: 700; }
 table.tabela { width: 100%; border-collapse: collapse; font-size: 13px; }
 .tabela th { text-align: left; font: 600 10.5px var(--f-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
 .tabela td { padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
-.tabela tr[aria-selected='true'] td { background: var(--tile); }
-.tabela tbody tr.clicavel { cursor: pointer; }
-.tabela tbody tr.clicavel:hover td { background: var(--tile); }
 .numeros { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12.5px; color: var(--ink-2); }
 .numeros b { font: 600 15px var(--f-mono); color: var(--ink); margin-right: 4px; font-variant-numeric: tabular-nums; }
 .vazio { color: var(--ink-3); font-size: 13px; margin: 0; }
```

`apps/web/src/app/empresa/nova/page.tsx`:

```diff
diff --git a/apps/web/src/app/empresa/nova/page.tsx b/apps/web/src/app/empresa/nova/page.tsx
index 66360a4..fa01879 100644
--- a/apps/web/src/app/empresa/nova/page.tsx
+++ b/apps/web/src/app/empresa/nova/page.tsx
@@ -7,7 +7,7 @@ export default function NovaEmpresa() {
       <div className="cartao">
         <Marca />
         <h1>Tua empresa</h1>
-        <p className="mudo">É o espaço onde ficam o catálogo da central, as jornadas e quem pode editar. Depois tu convida os colegas.</p>
+        <p className="mudo">É o espaço onde ficam os fluxos, os cadastros e quem pode editar. Depois tu convida os colegas.</p>
         <FormularioEmpresa />
       </div>
     </main>
```

`apps/web/src/componentes/editor/editor.css` (só um comentário agora; a tarefa 7 traz o resto):

```diff
diff --git a/apps/web/src/componentes/editor/editor.css b/apps/web/src/componentes/editor/editor.css
index d1136a1..7d64480 100644
--- a/apps/web/src/componentes/editor/editor.css
+++ b/apps/web/src/componentes/editor/editor.css
@@ -1,5 +1,5 @@
 /* Editor de fluxos (v2): o protótipo aprovado (barra de formas, quadro, painel, play). Tudo dentro de .editor, pra não
-   esbarrar no CSS das telas da v1 que ainda existem. Os tokens (--accent, --nota, --grupo, --mistura) estão no globals.css. */
+   esbarrar no CSS das outras telas. Os tokens (--accent, --nota, --grupo, --mistura) estão no globals.css. */
 .editor { height: 100%; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 10px; }
 .editor .topo { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; min-width: 0; }
 .editor .nome-fluxo { min-width: 0; flex: 1 1 180px; max-width: 340px; border: 1px solid transparent; background: transparent; border-radius: 9px; padding: 6px 9px; font-weight: 600; font-size: 15px; }
```

`apps/web/src/lib/dados.ts` (as leituras da v1 saem; a tarefa 6 traz as novas):

```diff
diff --git a/apps/web/src/lib/dados.ts b/apps/web/src/lib/dados.ts
index 2c16897..8f9b083 100644
--- a/apps/web/src/lib/dados.ts
+++ b/apps/web/src/lib/dados.ts
@@ -1,14 +1,9 @@
 import 'server-only';
 import { cache } from 'react';
 import { notFound, redirect } from 'next/navigation';
-import type { Achado, Documento, Evento } from '@journey/nucleo';
-import { lerDocumento, type Cadastro, type Documento as DocumentoFluxo } from '@journey/fluxo';
+import { lerDocumento, type Cadastro, type Documento } from '@journey/fluxo';
 import type { TipoCadastro } from '@/editor/cadastros';
 import type { CanalEditor } from '@/editor/estilo';
-import type { LinkResumo } from '@/compartilhar/opcoes';
-import type { Revisao } from '@/importacao/revisao';
-import type { Modo } from '@/simulacao/sessao';
-import { ehDocumento } from './documento';
 import { supabaseServidor } from './supabase/servidor';
 
 /** Leituras do banco pelo servidor, com a sessão de quem está logado: a regra de acesso (RLS) vale em todas. */
@@ -73,170 +68,6 @@ export async function empresa(id: string): Promise<EmpresaResumo> {
   return e;
 }
 
-export interface JornadaResumo {
-  id: string;
-  nome: string;
-  canal: string;
-  versao: number | null;
-  atualizada: string | null;
-  graves: number;
-}
-
-/** Da view jornadas_resumo: só a última versão de cada jornada, com os graves contados no banco. */
-export async function jornadas(empresaId: string): Promise<JornadaResumo[]> {
-  const { supabase } = await usuarioAtual();
-  const linhas = ok<{ id: string; nome: string; canal: string; numero: number | null; criada_em: string | null; graves: number }>(
-    await supabase.from('jornadas_resumo').select('id, nome, canal, numero, criada_em, graves').eq('empresa_id', empresaId).order('nome'),
-  );
-  return linhas.map((l) => ({ id: l.id, nome: l.nome, canal: l.canal, versao: l.numero, atualizada: l.criada_em, graves: l.graves }));
-}
-
-export interface VersaoJornada {
-  jornada: { id: string; nome: string; canal: string };
-  numero: number;
-  criada_em: string;
-  documento: Documento;
-  diagnostico: Achado[];
-}
-
-export async function versaoAtual(empresaId: string, jornadaId: string): Promise<VersaoJornada> {
-  const { supabase } = await usuarioAtual();
-  const j = talvez<VersaoJornada['jornada']>(await supabase.from('jornadas').select('id, nome, canal').eq('empresa_id', empresaId).eq('id', jornadaId).maybeSingle());
-  if (!j) notFound();
-  const v = talvez<{ numero: number; criada_em: string; documento: unknown; diagnostico: unknown }>(
-    await supabase.from('jornada_versoes').select('numero, criada_em, documento, diagnostico').eq('jornada_id', jornadaId).order('numero', { ascending: false }).limit(1).maybeSingle(),
-  );
-  if (!v) notFound();
-  if (!ehDocumento(v.documento)) throw new Error(`a versão ${v.numero} de "${j.nome}" não é um documento journey/1`);
-  return { jornada: j, numero: v.numero, criada_em: v.criada_em, documento: v.documento, diagnostico: v.diagnostico as Achado[] };
-}
-
-export interface Cenario {
-  id: string;
-  nome: string;
-  entrada: string;
-  inicio: string;
-  modo: Modo;
-  escolhas: string[];
-  esperado: Evento[];
-  versao_aprovada: number;
-}
-
-export async function cenarios(jornadaId: string): Promise<Cenario[]> {
-  const { supabase } = await usuarioAtual();
-  return ok<Cenario>(await supabase.from('cenarios').select('id, nome, entrada, inicio, modo, escolhas, esperado, versao_aprovada').eq('jornada_id', jornadaId).order('nome'));
-}
-
-export interface Intencional {
-  chave: string;
-  nota: string;
-  criado_em: string;
-  /** E-mail de quem marcou; null se a pessoa não é mais membro da empresa (ou foi apagada). */
-  autor: string | null;
-}
-
-/** As marcações da jornada, com o e-mail de quem marcou (pelos membros da mesma empresa). */
-export async function intencionais(empresaId: string, jornadaId: string): Promise<Intencional[]> {
-  const { supabase } = await usuarioAtual();
-  const linhas = ok<{ chave: string; nota: string; criado_em: string; autor: string | null }>(
-    await supabase.from('achados_intencionais').select('chave, nota, criado_em, autor').eq('empresa_id', empresaId).eq('jornada_id', jornadaId),
-  );
-  const ids = [...new Set(linhas.flatMap((l) => (l.autor ? [l.autor] : [])))];
-  const emails = new Map<string, string>();
-  if (ids.length > 0) {
-    const ms = ok<{ usuario_id: string; email: string }>(await supabase.from('membros').select('usuario_id, email').eq('empresa_id', empresaId).in('usuario_id', ids));
-    for (const m of ms) emails.set(m.usuario_id, m.email);
-  }
-  return linhas.map((l) => ({ chave: l.chave, nota: l.nota, criado_em: l.criado_em, autor: (l.autor && emails.get(l.autor)) ?? null }));
-}
-
-/** Os links da jornada, do mais novo pro mais velho (vencidos e revogados também: a lista conta o que já foi mandado). */
-export async function links(jornadaId: string): Promise<LinkResumo[]> {
-  const { supabase } = await usuarioAtual();
-  return ok<LinkResumo>(
-    await supabase
-      .from('links')
-      .select('id, token, versao, esconder_nomes, cenario_nome:cenario->>nome, expira_em, revogado_em, criado_em')
-      .eq('jornada_id', jornadaId)
-      .order('criado_em', { ascending: false }),
-  );
-}
-
-export interface ImportRevisao {
-  id: string;
-  status: 'revisao' | 'confirmado' | 'descartado';
-  parcial: boolean;
-  arquivos: { nome: string; tamanho: number }[];
-  relatorio: Revisao;
-  criado_em: string;
-}
-
-export async function importDaEmpresa(empresaId: string, id: string): Promise<ImportRevisao> {
-  const { supabase } = await usuarioAtual();
-  const i = talvez<ImportRevisao>(await supabase.from('imports').select('id, status, parcial, arquivos, relatorio, criado_em').eq('empresa_id', empresaId).eq('id', id).maybeSingle());
-  if (!i) notFound();
-  return i;
-}
-
-export async function importsRecentes(empresaId: string) {
-  const { supabase } = await usuarioAtual();
-  return ok(await supabase.from('imports').select('id, status, parcial, arquivos, criado_em').eq('empresa_id', empresaId).order('criado_em', { ascending: false }).limit(10)) as Omit<
-    ImportRevisao,
-    'relatorio'
-  >[];
-}
-
-export interface ItemCatalogo {
-  aba: string;
-  item_id: string;
-  nome: string | null;
-  dados: Record<string, unknown>;
-}
-
-/** O PostgREST devolve no máximo 1000 linhas por pedido (max_rows): o que pode passar disso vem em páginas. */
-const PAGINA = 1000;
-
-/** A aba inteira, em páginas (a busca da tela filtra sobre tudo). */
-export async function catalogo(empresaId: string, aba: string): Promise<ItemCatalogo[]> {
-  const { supabase } = await usuarioAtual();
-  const todos: ItemCatalogo[] = [];
-  for (let de = 0; ; de += PAGINA) {
-    const pagina = ok<ItemCatalogo>(
-      await supabase.from('catalogo').select('aba, item_id, nome, dados').eq('empresa_id', empresaId).eq('aba', aba).order('item_id').range(de, de + PAGINA - 1),
-    );
-    todos.push(...pagina);
-    if (pagina.length < PAGINA) return todos;
-  }
-}
-
-const ABAS_DO_CATALOGO = ['entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos'] as const;
-
-/** Quantos itens por aba, contados no banco (contar as linhas devolvidas pararia em 1000). */
-export async function contagemCatalogo(empresaId: string): Promise<Record<string, number>> {
-  const { supabase } = await usuarioAtual();
-  const pares = await Promise.all(
-    ABAS_DO_CATALOGO.map(async (aba) => {
-      const r = await supabase.from('catalogo').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('aba', aba);
-      falhou(r.error);
-      return [aba, r.count ?? 0] as const;
-    }),
-  );
-  return Object.fromEntries(pares);
-}
-
-export interface Uso {
-  tipo: 'catalogo' | 'jornada';
-  aba: string | null;
-  item_id: string;
-  nome: string | null;
-  campos: string[] | null;
-}
-
-export async function ondeUsado(empresaId: string, ref: string): Promise<Uso[]> {
-  const { supabase } = await usuarioAtual();
-  return ok<Uso>(await supabase.rpc('onde_usado', { p_empresa: empresaId, p_ref: ref }));
-}
-
 export async function membros(empresaId: string) {
   const { supabase } = await usuarioAtual();
   const m = ok(await supabase.from('membros').select('usuario_id, email, entrou_em').eq('empresa_id', empresaId).order('entrou_em'));
@@ -244,8 +75,6 @@ export async function membros(empresaId: string) {
   return { membros: m, convites: c };
 }
 
-// Journey v2: fluxos, canais e cadastros --------------------------------------------------------------------------
-
 export interface FluxoResumo {
   id: string;
   nome: string;
@@ -294,7 +123,7 @@ export interface FluxoParaEditar {
   canal: string | null;
   meta_s: number | null;
   revisao: number;
-  documento: DocumentoFluxo;
+  documento: Documento;
   estilo: unknown;
 }
 
```

`apps/web/e2e/apoio.ts`:

```diff
diff --git a/apps/web/e2e/apoio.ts b/apps/web/e2e/apoio.ts
index 8e3de0f..e74451a 100644
--- a/apps/web/e2e/apoio.ts
+++ b/apps/web/e2e/apoio.ts
@@ -25,26 +25,5 @@ export async function entrar(page: Page, request: APIRequestContext, email: stri
   await page.goto(link);
 }
 
-/**
- * As telas da v1 (importar, catálogo) saíram do menu na etapa B e continuam até a C: os testes delas chegam pelo endereço.
- */
-export async function irPara(page: Page, secao: 'importar' | 'catalogo') {
-  await page.waitForURL(/\/e\/[0-9a-f-]+/);
-  const empresa = /\/e\/([0-9a-f-]+)/.exec(page.url())![1];
-  await page.goto(`/e/${empresa}/${secao}`);
-}
-
 export const emailNovo = (prefixo: string) => `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@exemplo.com`;
 
-/** Cria a empresa e importa os arquivos; termina na página da jornada. */
-export async function empresaComImport(page: Page, arquivos: string[], nome = 'Empresa de teste') {
-  await expect(page).toHaveURL(/\/empresa\/nova/);
-  await page.getByLabel('Nome da empresa').fill(nome);
-  await page.getByRole('button', { name: 'Criar' }).click();
-  await irPara(page, 'importar');
-  await page.getByLabel('Arquivos').setInputFiles(arquivos);
-  await page.getByRole('button', { name: 'Analisar' }).click();
-  await expect(page.getByText('pode confirmar')).toBeVisible({ timeout: 30_000 });
-  await page.getByRole('button', { name: 'Confirmar import' }).click();
-  await expect(page.getByTestId('mapa')).toBeVisible({ timeout: 30_000 });
-}
```

- [ ] **Passo 4: os testes que ficam**

`apps/web/test/banco/links.test.ts` (o link público da v2 pela API: só a chave secreta abre):

```diff
diff --git a/apps/web/test/banco/links.test.ts b/apps/web/test/banco/links.test.ts
index 29bf7d4..ebce231 100644
--- a/apps/web/test/banco/links.test.ts
+++ b/apps/web/test/banco/links.test.ts
@@ -1,32 +1,19 @@
 import { beforeAll, describe, expect, it } from 'vitest';
-import { doc, entrada, ramal } from '@journey/nucleo/teste';
-import { montarRetrato, type LinkDoBanco } from '@/compartilhar/retrato';
-import { jornadasDoImport } from '@/importacao/jornadas';
 import { bancoNoAr, clienteAnonimo, clienteSecreto, usuarioNovo } from './apoio';
 
 const noAr = await bancoNoAr();
 
-/** Uma central mínima com o nome de uma pessoa no ramal. */
-const CENTRAL = doc({ entradas: [entrada('e1', 'ramal:2001')], ramais: [ramal('2001', { nome: 'Fulana de Tal' })] });
-
+// O pgTAP (compartilhar.test.sql) confere o abrir_link por dentro; aqui, o caminho de verdade: a API do Supabase.
 describe.skipIf(!noAr)('links públicos no banco (Supabase local)', () => {
   let u: Awaited<ReturnType<typeof usuarioNovo>>;
-  let jornada: string;
   let token: string;
   beforeAll(async () => {
     u = await usuarioNovo();
     const { data: empresa, error } = await u.cliente.rpc('criar_empresa', { p_nome: 'Links' });
     if (error) throw error;
-    const jornadas = jornadasDoImport(CENTRAL);
-    const { data: imp } = await u.cliente
-      .from('imports')
-      .insert({ empresa_id: empresa, relatorio: {}, base: CENTRAL, efetivo: CENTRAL })
-      .select('id')
-      .single();
-    const conf = await u.cliente.rpc('confirmar_import', { p_import: imp!.id, p_jornadas: jornadas });
-    if (conf.error) throw conf.error;
-    jornada = (await u.cliente.from('jornadas').select('id').single()).data!.id as string;
-    const l = await u.cliente.from('links').insert({ empresa_id: empresa, jornada_id: jornada }).select('token').single();
+    const f = await u.cliente.from('fluxos').insert({ empresa_id: empresa, nome: 'Cobrança', canal: 'whatsapp' }).select('id').single();
+    if (f.error) throw f.error;
+    const l = await u.cliente.from('links').insert({ empresa_id: empresa, fluxo_id: f.data.id }).select('token').single();
     if (l.error) throw l.error;
     token = l.data.token as string;
   });
@@ -48,13 +35,10 @@ describe.skipIf(!noAr)('links públicos no banco (Supabase local)', () => {
     expect(r.error?.code).toBe('42501');
   });
 
-  it('com a chave secreta, abre a versão; o retrato sai sem o nome', async () => {
+  it('com a chave secreta, abre o fluxo de agora', async () => {
     const { data, error } = await clienteSecreto().rpc('abrir_link', { p_token: token });
     expect(error).toBeNull();
-    const l = data as LinkDoBanco;
-    expect(l).toMatchObject({ estado: 'ok', mais_recente: true, esconder_nomes: true, versao: { numero: 1 } });
-    expect(JSON.stringify(l)).toContain('Fulana de Tal');
-    expect(JSON.stringify(montarRetrato(l))).not.toContain('Fulana');
+    expect(data).toMatchObject({ estado: 'ok', empresa: { nome: 'Links' }, fluxo: { nome: 'Cobrança', canal: 'whatsapp' }, versao: null, atual: { revisao: 0 } });
   });
 
   it('revogado, não abre mais', async () => {
```

`apps/web/test/chave-secreta.test.ts` (por enquanto sem o `lib/link.ts`; a tarefa 5 volta à forma estrita):

```diff
diff --git a/apps/web/test/chave-secreta.test.ts b/apps/web/test/chave-secreta.test.ts
index b16b059..434c9e1 100644
--- a/apps/web/test/chave-secreta.test.ts
+++ b/apps/web/test/chave-secreta.test.ts
@@ -17,8 +17,10 @@ function arquivos(pasta: string): string[] {
 describe('chave secreta', () => {
   const todos = arquivos(SRC).map((f) => [f.slice(SRC.length + 1), readFileSync(f, 'utf8')] as const);
 
+  const leem = todos.filter(([, texto]) => /SUPABASE_SECRET_KEY|SERVICE_ROLE|sb_secret_/.test(texto));
+
   it('só src/lib/link.ts lê SUPABASE_SECRET_KEY', () => {
-    expect(todos.filter(([, texto]) => /SUPABASE_SECRET_KEY|SERVICE_ROLE|sb_secret_/.test(texto)).map(([nome]) => nome)).toEqual(['lib/link.ts']);
+    expect(leem.map(([nome]) => nome).filter((nome) => nome !== 'lib/link.ts')).toEqual([]);
   });
 
   it('o next.config não tem env: (iria pro bundle do navegador)', () => {
@@ -27,8 +29,7 @@ describe('chave secreta', () => {
   });
 
   it('e ele é só do servidor', () => {
-    const [, link] = todos.find(([nome]) => nome === 'lib/link.ts')!;
-    expect(link.startsWith("import 'server-only';")).toBe(true);
+    expect(leem.filter(([, texto]) => !texto.startsWith("import 'server-only';")).map(([nome]) => nome)).toEqual([]);
   });
 
   it('nenhum componente de cliente importa lib/link', () => {
```

`apps/web/test/lib/dados.test.ts`:

```diff
diff --git a/apps/web/test/lib/dados.test.ts b/apps/web/test/lib/dados.test.ts
index 1fc9e6c..f724736 100644
--- a/apps/web/test/lib/dados.test.ts
+++ b/apps/web/test/lib/dados.test.ts
@@ -1,5 +1,4 @@
 import { beforeEach, describe, expect, it, vi } from 'vitest';
-import { documentoVazio } from '@journey/nucleo';
 
 vi.mock('server-only', () => ({}));
 // notFound do Next lança; aqui lança um erro reconhecível.
@@ -39,10 +38,8 @@ vi.mock('@/lib/supabase/servidor', () => ({
   supabaseServidor: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: consulta }),
 }));
 
-const { catalogo, contagemCatalogo, empresa, intencionais, jornadas, versaoAtual } = await import('@/lib/dados');
+const { cadastros, empresa, fluxoParaEditar } = await import('@/lib/dados');
 
-const JORNADA = { id: 'j1', nome: 'Telefonia', canal: 'telefonia' };
-const versao = (documento: unknown): Resposta => ({ data: { numero: 1, criada_em: '2026-11-12T10:00:00Z', documento, diagnostico: [] }, error: null });
 const uuidInvalido: Resposta = { data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid: "x"' } };
 
 describe('dados', () => {
@@ -54,8 +51,8 @@ describe('dados', () => {
   it('id que não é uuid na URL vira "não achado", não erro', async () => {
     respostas.empresas = uuidInvalido;
     await expect(empresa('x')).rejects.toThrow('NAO_ACHADO');
-    respostas.jornadas_resumo = uuidInvalido;
-    await expect(jornadas('x')).rejects.toThrow('NAO_ACHADO');
+    respostas.fluxos = uuidInvalido;
+    await expect(fluxoParaEditar('e1', 'x')).rejects.toThrow('NAO_ACHADO');
   });
 
   it('outro erro do banco continua erro', async () => {
@@ -63,73 +60,18 @@ describe('dados', () => {
     await expect(empresa('e1')).rejects.toThrow('permission denied');
   });
 
-  it('a lista de jornadas vem da view do resumo (última versão e graves contados no banco)', async () => {
-    respostas.jornadas_resumo = {
-      data: [
-        { id: 'j1', nome: 'Telefonia', canal: 'telefonia', numero: 3, criada_em: '2026-11-12T10:00:00Z', graves: 2 },
-        { id: 'j2', nome: 'WhatsApp', canal: 'whatsapp', numero: null, criada_em: null, graves: 0 },
-      ],
-      error: null,
-    };
-    expect(await jornadas('e1')).toEqual([
-      { id: 'j1', nome: 'Telefonia', canal: 'telefonia', versao: 3, atualizada: '2026-11-12T10:00:00Z', graves: 2 },
-      { id: 'j2', nome: 'WhatsApp', canal: 'whatsapp', versao: null, atualizada: null, graves: 0 },
-    ]);
-    expect(filtros).toContainEqual(['eq', 'empresa_id', 'e1']);
-  });
-
-  it('intencionais trazem o e-mail de quem marcou; quem saiu (ou foi apagado) fica null', async () => {
-    respostas.achados_intencionais = {
-      data: [
-        { chave: 'k1', nota: 'de propósito', criado_em: '2026-11-12T10:00:00Z', autor: 'u1' },
-        { chave: 'k2', nota: '', criado_em: '2026-11-12T11:00:00Z', autor: 'u-saiu' },
-        { chave: 'k3', nota: '', criado_em: '2026-11-12T12:00:00Z', autor: null },
-      ],
-      error: null,
-    };
-    respostas.membros = { data: [{ usuario_id: 'u1', email: 'ana@exemplo.com' }], error: null };
-    expect((await intencionais('e1', 'j1')).map((i) => [i.chave, i.autor])).toEqual([
-      ['k1', 'ana@exemplo.com'],
-      ['k2', null],
-      ['k3', null],
-    ]);
-    expect(filtros).toContainEqual(['in', 'usuario_id', ['u1', 'u-saiu']]);
-    expect(filtros.filter((f) => f[0] === 'eq' && f[1] === 'empresa_id')).toHaveLength(2);
-  });
-
-  it('versaoAtual devolve o documento journey/1', async () => {
-    respostas.jornadas = { data: JORNADA, error: null };
-    respostas.jornada_versoes = versao(documentoVazio());
-    const v = await versaoAtual('e1', 'j1');
-    expect(v.documento).toEqual(documentoVazio());
-    expect(v.numero).toBe(1);
-  });
-
-  it('versaoAtual recusa versão que não é um documento journey/1', async () => {
-    respostas.jornadas = { data: JORNADA, error: null };
-    for (const doc of [{ ...documentoVazio(), formato: 'journey/2' }, { ...documentoVazio(), pecas: undefined }, { ...documentoVazio(), saidas: {} }, null, 'journey/1']) {
-      respostas.jornada_versoes = versao(doc);
-      await expect(versaoAtual('e1', 'j1'), JSON.stringify(doc)).rejects.toThrow('a versão 1 de "Telefonia" não é um documento journey/1');
-    }
-  });
-
-  it('o catálogo vem inteiro, em páginas de 1000 (o PostgREST corta em 1000 por pedido)', async () => {
-    const itens = (de: number, n: number) => Array.from({ length: n }, (_, i) => ({ aba: 'ramais', item_id: String(de + i), nome: null, dados: {} }));
-    respostas.catalogo = [
+  it('os cadastros vêm inteiros, em páginas de 1000 (o PostgREST corta em 1000 por pedido)', async () => {
+    const itens = (de: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: String(de + i), tipo: 'pessoa', nome: `P${de + i}`, campos: {} }));
+    respostas.cadastros = [
       { data: itens(0, 1000), error: null },
       { data: itens(1000, 1000), error: null },
       { data: itens(2000, 5), error: null },
     ];
-    expect(await catalogo('e1', 'ramais')).toHaveLength(2005);
+    expect(await cadastros('e1')).toHaveLength(2005);
     expect(filtros.filter((f) => f[0] === 'range')).toEqual([
       ['range', 0, 999],
       ['range', 1000, 1999],
       ['range', 2000, 2999],
     ]);
   });
-
-  it('a contagem por aba vem do banco, não das linhas devolvidas', async () => {
-    respostas.catalogo = ['entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos'].map((_, i) => ({ data: null, count: (i + 1) * 1000, error: null }) as Resposta);
-    expect(await contagemCatalogo('e1')).toEqual({ entradas: 1000, horarios: 2000, feriados: 3000, ramais: 4000, filas: 5000, grupos: 6000 });
-  });
 });
```

- [ ] **Passo 5: tudo verde sem a v1**

Run: `npm test && npm run typecheck && npm run build`
Expected: fluxo 84, núcleo 253, app `Tests  99 passed (99)`; `tsc` limpo; build sem as rotas da v1 (`/e/[empresa]/j`, `/importar`, `/catalogo`, `/l/[token]`, `/modelos`).

Run: `cd apps/web && npx playwright test --trace=off`
Expected: `9 passed` (cadastros 2, editor 2, entrar 2, fluxos 2, membros 1).

- [ ] **Passo 6: commit**

```bash
git add -A apps/web package-lock.json
git commit -m "app: a v1 sai (rotas, componentes, módulos, ações, testes e dependências)" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 4: cenários e diagnóstico sem tela

**Arquivos:**
- Criar: `apps/web/src/editor/cenarios.ts`, `apps/web/src/editor/diagnostico.ts`
- Modificar: `apps/web/src/editor/documento.ts`
- Testes: `apps/web/test/editor/cenarios.test.ts`, `diagnostico.test.ts` (novos), `documento.test.ts`

- [ ] **Passo 1: os testes**

`apps/web/test/editor/cenarios.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MODELOS, type Documento } from '@journey/fluxo';
import { cenarioDoPlay, ehEsperado, paraAprovar, playDoCenario, resultado, situacao, type Cenario } from '@/editor/cenarios';
import { rodar } from '@/editor/play';

const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
const ctx = { cadastros: m.cadastros, canal: m.canal };
// Segunda às 10h: o horário comercial manda pro menu de assuntos.
const PLAY = { inicio: 'inicio', quando: '2026-11-23T10:00', modo: 'relogio' as const, escolhas: ['c6', 'c10'] };

const ESPERADO = {
  caminho: ['inicio', 'boas-vindas', 'horario', 'assunto', 'suporte', 'aguardando', 'protocolo', 'inatividade'],
  fim: { motivo: 'fim' as const, peca: 'inatividade' },
  tempo_s: 3 + 720 + 7200 + 10,
};
const cenario = (extra: Partial<Cenario> = {}): Cenario => ({
  id: 'k1',
  nome: 'Some depois do suporte',
  inicio: PLAY.inicio,
  quando: PLAY.quando,
  modo: PLAY.modo,
  escolhas: PLAY.escolhas,
  esperado: ESPERADO,
  revisao_aprovada: 4,
  atualizado_em: '2026-11-13T10:00:00Z',
  ...extra,
});

describe('editor/cenarios', () => {
  it('o resultado é o caminho das peças, como terminou e o tempo do cliente', () => {
    expect(resultado(rodar(m.documento, ctx, PLAY))).toEqual(ESPERADO);
  });

  it('play que ainda pergunta não tem fim', () => {
    const r = resultado(rodar(m.documento, ctx, { ...PLAY, escolhas: [] }));
    expect(r.fim).toBeNull();
    expect(r.caminho.at(-1)).toBe('assunto');
  });

  it('cenário e play: um vira o outro', () => {
    expect(playDoCenario(cenario())).toEqual(PLAY);
  });

  it('salvar do play: só as escolhas que o motor aceitou, e só com o play no fim', () => {
    const x = rodar(m.documento, ctx, { ...PLAY, escolhas: ['c6', 'velha', 'c10'] });
    expect(x.terminou).toBe(false);
    expect(cenarioDoPlay(PLAY, x)).toBeNull();
    const fim = rodar(m.documento, ctx, PLAY);
    expect(cenarioDoPlay({ ...PLAY, escolhas: ['c6', 'c10', 'sobrou'] }, fim)).toEqual({ ...PLAY, esperado: ESPERADO });
  });

  it('mesmo documento: igual', () => {
    expect(situacao(cenario(), m.documento, ctx)).toEqual({ situacao: 'igual', resultado: ESPERADO, escolhas: PLAY.escolhas });
  });

  it('tempo diferente no caminho: mudou, com o resultado novo', () => {
    const doc: Documento = { ...m.documento, pecas: m.documento.pecas.map((p) => (p.id === 'suporte' ? { ...p, tempo_s: 60 } : p)) };
    const s = situacao(cenario(), doc, ctx);
    expect(s.situacao).toBe('mudou');
    expect(s.resultado.tempo_s).toBe(3 + 60 + 7200 + 10);
  });

  it('a escolha guardada sumiu: mudou, mesmo que acabe igual', () => {
    // c10 trocada por outra conexão igual: o motor para na pergunta, a escolha não serve mais.
    const doc: Documento = { ...m.documento, conexoes: m.documento.conexoes.map((c) => (c.id === 'c10' ? { ...c, id: 'c10b' } : c)) };
    const s = situacao(cenario(), doc, ctx);
    expect(s.situacao).toBe('mudou');
    expect(s.resultado.fim).toBeNull();
    // Escolha a mais que o motor não usa também não é "igual": o caminho guardado não é mais o mesmo.
    expect(situacao(cenario({ escolhas: [...PLAY.escolhas, 'c99'] }), m.documento, ctx).situacao).toBe('mudou');
  });

  it('o resultado esperado é conferido como o banco confere', () => {
    expect(ehEsperado(ESPERADO)).toBe(true);
    expect(ehEsperado({ ...ESPERADO, fim: { motivo: 'beco', peca: null } })).toBe(true);
    for (const ruim of [null, [], { ...ESPERADO, fim: null }, { ...ESPERADO, fim: { motivo: 'outro', peca: 'x' } }, { ...ESPERADO, caminho: ['a', 1] }, { ...ESPERADO, tempo_s: -1 }, { ...ESPERADO, tempo_s: '3' }, { ...ESPERADO, tempo_s: Infinity }])
      expect(ehEsperado(ruim), JSON.stringify(ruim)).toBe(false);
  });

  describe('aprovar', () => {
    // Fora do horário, a espera pergunta; dentro, vai direto pro fim.
    const H = 'h0000000-0000-0000-0000-000000000001';
    const comercial = (fim: string) => ({ id: H, tipo: 'horario', nome: 'Comercial', campos: { janelas: [{ dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim }], feriados: [] } });
    const doc: Documento = {
      formato: 'journey/2',
      pecas: [
        { id: 'i', tipo: 'inicio', nome: 'Início', x: 0, y: 0 },
        { id: 'h', tipo: 'decisao', nome: 'Horário', x: 0, y: 0, responsavel: H },
        { id: 'espera', tipo: 'espera', nome: 'Espera', x: 0, y: 0 },
        { id: 'f', tipo: 'fim', nome: 'Fim', x: 0, y: 0 },
      ],
      conexoes: [
        { id: 'c1', de: 'i', para: 'h', regra: 'sempre' },
        { id: 'c2', de: 'h', para: 'f', regra: 'horario', horario: 'dentro' },
        { id: 'c3', de: 'h', para: 'espera', regra: 'senao' },
        { id: 'c5', de: 'espera', para: 'f', regra: 'opcao', valor: '1' },
        { id: 'c6', de: 'espera', para: 'f', regra: 'condicao', valor: 'desistiu' },
      ],
      grupos: [],
      notas: [],
    };

    it('a escolha que o fluxo não usa mais sai junto: depois de aprovar, igual', () => {
      // Salvo às 20h, fora do horário: a pessoa escolheu "desistiu".
      const p = { inicio: 'i', quando: '2026-11-23T20:00', modo: 'relogio' as const, escolhas: ['c6'] };
      const salvo = cenarioDoPlay(p, rodar(doc, { cadastros: [comercial('18:00')], canal: null }, p))!;
      // O horário passou a ir até as 22h: às 20h vai direto pro fim, e a escolha sobra.
      const ctx22 = { cadastros: [comercial('22:00')], canal: null };
      const s = situacao(salvo, doc, ctx22);
      expect(s).toMatchObject({ situacao: 'mudou', escolhas: [] });
      const aprovado = { ...salvo, ...paraAprovar(s)! };
      expect(aprovado.escolhas).toEqual([]);
      expect(situacao(aprovado, doc, ctx22).situacao).toBe('igual');
      // Só o resultado (sem as escolhas novas) continuaria "mudou".
      expect(situacao({ ...salvo, esperado: aprovado.esperado }, doc, ctx22).situacao).toBe('mudou');
    });

    it('sem fim não há o que aprovar', () => {
      const p = { inicio: 'i', quando: '2026-11-23T20:00', modo: 'relogio' as const, escolhas: ['c6'] };
      const ctx = { cadastros: [comercial('18:00')], canal: null };
      const salvo = cenarioDoPlay(p, rodar(doc, ctx, p))!;
      // A conexão escolhida foi refeita (outro id): o play para na pergunta.
      const semC6: Documento = { ...doc, conexoes: doc.conexoes.map((c) => (c.id === 'c6' ? { ...c, id: 'c6b' } : c)) };
      expect(paraAprovar(situacao(salvo, semC6, ctx))).toBeNull();
      // O Início sumiu: o resultado novo "termina" sem nem começar, e isso não se aprova.
      const semInicio: Documento = { ...doc, pecas: doc.pecas.filter((p) => p.id !== 'i') };
      const s = situacao(salvo, semInicio, ctx);
      expect(s.resultado.fim?.motivo).toBe('inexistente');
      expect(paraAprovar(s)).toBeNull();
    });
  });
});
```

`apps/web/test/editor/diagnostico.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODELOS, type Achado, type Documento } from '@journey/fluxo';
import { alcancaveis, antigos, caminhoAte, contar, focoDoAchado, gavetaAberta, lembrarGaveta, pecaDoAchado, rotuloAchados, separar, simulaveis } from '@/editor/diagnostico';
import { rodar, type Contexto } from '@/editor/play';

const achado = (chave: string): Achado => ({ tipo: chave.split(':')[0]!, gravidade: 'alerta', chave, titulo: chave, texto: '', refs: [] });

/** Toca o caminho em modo livre e diz se a água chega na peça. */
const QUANDO = '2026-11-23T10:00';

function chega(doc: Documento, ctx: Contexto, alvo: string) {
  const c = caminhoAte(doc, ctx, alvo, QUANDO);
  if (!c) return false;
  const x = rodar(doc, ctx, c);
  return x.escolhas.length === c.escolhas.length && x.eventos.some((e) => e.tipo === 'chegou' && e.peca === alvo);
}

describe('editor/diagnostico', () => {
  it('separa os achados abertos dos marcados como intencionais', () => {
    const achados = [achado('beco_sem_saida:a'), achado('inalcancavel:b'), achado('regra_vazia:c')];
    const marcados = [{ chave: 'inalcancavel:b', nota: '', autor: null, criado_em: '' }, { chave: 'de-outro-documento', nota: '', autor: null, criado_em: '' }];
    expect(separar(achados, marcados)).toEqual({ abertos: [achados[0], achados[2]], intencionais: [achados[1]] });
    // O marcado que não é achado deste documento não conta.
    expect(contar(achados, marcados)).toEqual({ abertos: 2, intencionais: 1 });
  });

  it('caminho até uma peça atrás de duas decisões (e do horário, que no modo livre pergunta)', () => {
    const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
    const ctx = { cadastros: m.cadastros, canal: m.canal };
    const play = (escolhas: string[]) => ({ inicio: 'inicio', quando: QUANDO, modo: 'livre', escolhas });
    expect(caminhoAte(m.documento, ctx, 'protocolo', QUANDO)).toEqual(play(['c3', 'c6', 'c10']));
    expect(caminhoAte(m.documento, ctx, 'fechado', QUANDO)).toEqual(play(['c4']));
    expect(caminhoAte(m.documento, ctx, 'inicio', QUANDO)).toEqual(play([]));
    expect(chega(m.documento, ctx, 'protocolo')).toBe(true);
  });

  it.each(MODELOS.map((m) => [m.nome, m] as const))('em "%s", toda peça chega pelo caminho achado', (_nome, m) => {
    const ctx = { cadastros: m.cadastros, canal: m.canal };
    for (const p of m.documento.pecas) expect(chega(m.documento, ctx, p.id), p.id).toBe(true);
  });

  it('ninguém chega: sem caminho', () => {
    const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
    const ctx = { cadastros: m.cadastros, canal: m.canal };
    const solta: Documento = {
      ...m.documento,
      pecas: [...m.documento.pecas, { id: 'solta', tipo: 'etapa', nome: 'Solta', x: 0, y: 600 }, { id: 'depois', tipo: 'etapa', nome: 'Depois do fim', x: 0, y: 700 }],
      // Saída de um Fim não leva a lugar nenhum: a água para no Fim.
      conexoes: [...m.documento.conexoes, { id: 'cf', de: 'resolvido', para: 'depois', regra: 'sempre' }],
    };
    expect(caminhoAte(solta, ctx, 'solta', QUANDO)).toBeNull();
    expect(caminhoAte(solta, ctx, 'depois', QUANDO)).toBeNull();
    expect(caminhoAte(solta, ctx, 'nao-existe', QUANDO)).toBeNull();
  });

  it('com dois Inícios, vai pelo mais perto', () => {
    const doc: Documento = {
      formato: 'journey/2',
      pecas: [
        { id: 'i1', tipo: 'inicio', nome: 'Telefone', x: 0, y: 0 },
        { id: 'i2', tipo: 'inicio', nome: 'Site', x: 0, y: 100 },
        { id: 'd', tipo: 'decisao', nome: 'Qual?', x: 100, y: 0 },
        { id: 'a', tipo: 'etapa', nome: 'A', x: 200, y: 0 },
        { id: 'f', tipo: 'fim', nome: 'Fim', x: 300, y: 0 },
      ],
      conexoes: [
        { id: 'c1', de: 'i1', para: 'd', regra: 'sempre' },
        { id: 'c2', de: 'd', para: 'a', regra: 'opcao', valor: '1' },
        { id: 'c3', de: 'd', para: 'f', regra: 'opcao', valor: '2' },
        { id: 'c4', de: 'i2', para: 'a', regra: 'sempre' },
        { id: 'c5', de: 'a', para: 'f', regra: 'sempre' },
      ],
      grupos: [],
      notas: [],
    };
    expect(caminhoAte(doc, { cadastros: [], canal: null }, 'a', QUANDO)).toEqual({ inicio: 'i2', quando: QUANDO, modo: 'livre', escolhas: [] });
  });

  it('atrás de um "senão" do horário: o play volta em modo livre, porque no relógio as escolhas não valem', () => {
    const H = 'h0000000-0000-0000-0000-000000000001';
    const ctx = { cadastros: [{ id: H, tipo: 'horario', nome: 'Comercial', campos: { janelas: [{ dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }], feriados: [] } }], canal: null };
    const doc: Documento = {
      formato: 'journey/2',
      pecas: [
        { id: 'i', tipo: 'inicio', nome: 'I', x: 0, y: 0 },
        { id: 'h', tipo: 'decisao', nome: 'Horário', x: 0, y: 0, responsavel: H },
        { id: 'fechado', tipo: 'etapa', nome: 'Fechado', x: 0, y: 0 },
        { id: 'alvo', tipo: 'etapa', nome: 'Alvo', x: 0, y: 0 },
        { id: 'f', tipo: 'fim', nome: 'Fim', x: 0, y: 0 },
      ],
      conexoes: [
        { id: 'c1', de: 'i', para: 'h', regra: 'sempre' },
        { id: 'c2', de: 'h', para: 'f', regra: 'horario', horario: 'dentro' },
        { id: 'c3', de: 'h', para: 'fechado', regra: 'senao' },
        { id: 'c4', de: 'fechado', para: 'alvo', regra: 'sempre' },
        { id: 'c5', de: 'alvo', para: 'f', regra: 'sempre' },
      ],
      grupos: [],
      notas: [],
    };
    // Segunda às 10h o relógio diria "dentro": só no modo livre a escolha do "senão" vale.
    const p = caminhoAte(doc, ctx, 'alvo', QUANDO)!;
    expect(p).toEqual({ inicio: 'i', quando: QUANDO, modo: 'livre', escolhas: ['c3'] });
    expect(rodar(doc, ctx, p).eventos.some((e) => e.tipo === 'chegou' && e.peca === 'alvo')).toBe(true);
    expect(rodar(doc, ctx, { ...p, modo: 'relogio' }).eventos.some((e) => e.tipo === 'chegou' && e.peca === 'alvo')).toBe(false);
  });

  it('marcações de achados que o documento não tem mais são "antigas"', () => {
    const achados = [achado('beco_sem_saida:a')];
    const marcados = [{ chave: 'beco_sem_saida:a', nota: '' }, { chave: 'inalcancavel:sumiu', nota: 'x' }];
    expect(antigos(achados, marcados)).toEqual([{ chave: 'inalcancavel:sumiu', nota: 'x' }]);
  });

  it('o rótulo do botão', () => {
    expect([0, 1, 3].map(rotuloAchados)).toEqual(['sem achados', '1 achado', '3 achados']);
  });

  it('a peça de um achado: a primeira peça das referências, ou a origem da conexão', () => {
    const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
    expect(pecaDoAchado(m.documento, { refs: ['c5', 'assunto'] })).toBe('assunto');
    expect(pecaDoAchado(m.documento, { refs: ['c5'] })).toBe('assunto');
    expect(pecaDoAchado(m.documento, { refs: [] })).toBeNull();
  });

  describe('a gaveta lembrada por fluxo', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('guarda e lê do navegador', () => {
      const guardado = new Map<string, string>();
      vi.stubGlobal('localStorage', { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => guardado.set(k, v), removeItem: (k: string) => guardado.delete(k) });
      expect(gavetaAberta('f1')).toBe(false);
      lembrarGaveta('f1', true);
      expect(gavetaAberta('f1')).toBe(true);
      expect(gavetaAberta('f2')).toBe(false);
      lembrarGaveta('f1', false);
      expect(gavetaAberta('f1')).toBe(false);
    });

    it('sem armazenamento (ou bloqueado), fechada e sem erro', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('bloqueado');
        },
        setItem: () => {
          throw new Error('bloqueado');
        },
      });
      expect(gavetaAberta('f1')).toBe(false);
      expect(() => lembrarGaveta('f1', true)).not.toThrow();
    });
  });

  it('ver no quadro: seleciona a primeira referência, holofote em todas, enquadra as peças (as da conexão também)', () => {
    const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
    expect(focoDoAchado(m.documento, { refs: ['c5', 'assunto'] })).toEqual({ sel: { tipo: 'conexao', id: 'c5' }, destaque: new Set(['c5', 'assunto']), enquadrar: ['assunto', 'financeiro'] });
    expect(focoDoAchado(m.documento, { refs: ['sumiu', 'horario'] })!.sel).toEqual({ tipo: 'peca', id: 'horario' });
    expect(focoDoAchado(m.documento, { refs: [] })).toBeNull();
  });

  it('as peças que algum Início alcança: uma busca só, sem passar de um Fim; bate com o caminho de cada peça', () => {
    for (const m of MODELOS) {
      const ctx = { cadastros: m.cadastros, canal: m.canal };
      const a = alcancaveis(m.documento);
      for (const p of m.documento.pecas) expect(a.has(p.id), `${m.chave}:${p.id}`).toBe(caminhoAte(m.documento, ctx, p.id, QUANDO) !== null);
    }
    const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
    const doc: Documento = {
      ...m.documento,
      pecas: [...m.documento.pecas, { id: 'solta', tipo: 'etapa', nome: 'Solta', x: 0, y: 0 }, { id: 'depois', tipo: 'etapa', nome: 'Depois', x: 0, y: 0 }],
      conexoes: [...m.documento.conexoes, { id: 'cf', de: 'resolvido', para: 'depois', regra: 'sempre' }],
    };
    const a = alcancaveis(doc);
    expect([a.has('solta'), a.has('depois'), a.has('protocolo')]).toEqual([false, false, true]);
    expect(alcancaveis({ ...doc, pecas: doc.pecas.filter((p) => p.tipo !== 'inicio') }).size).toBe(0);
    // Os achados com "simular até aqui": os de peça alcançável (o "inalcancavel:solta" não).
    const achados = [achado('beco_sem_saida:depois'), achado('inalcancavel:solta'), achado('regra_vazia:c5'), achado('sem_inicio:fluxo')];
    achados[0]!.refs = ['depois'];
    achados[1]!.refs = ['solta'];
    achados[2]!.refs = ['assunto', 'c5'];
    expect([...simulaveis(doc, achados)]).toEqual(['regra_vazia:c5']);
  });
});
```

`apps/web/test/editor/documento.test.ts`:

```diff
diff --git a/apps/web/test/editor/documento.test.ts b/apps/web/test/editor/documento.test.ts
index 30cad84..c35a19a 100644
--- a/apps/web/test/editor/documento.test.ts
+++ b/apps/web/test/editor/documento.test.ts
@@ -1,6 +1,6 @@
 import { describe, expect, it } from 'vitest';
 import { documentoVazio, lerDocumento, type Documento } from '@journey/fluxo';
-import { apagar, conteudoDoGrupo, criarGrupo, criarLigada, criarNota, criarPeca, duplicar, existe, inverterConexao, ligar, moverGrupo, moverGrupoEm, moverPeca, mudarConexao, mudarNota, mudarPeca, redimensionarGrupo } from '@/editor/documento';
+import { apagar, conteudoDoGrupo, criarGrupo, criarLigada, criarNota, criarPeca, duplicar, existe, inverterConexao, ligar, moverGrupo, moverGrupoEm, moverPeca, mudarConexao, mudarNota, mudarPeca, redimensionarGrupo, semResponsaveisQueSumiram } from '@/editor/documento';
 
 const base = (): Documento => {
   let d = criarPeca(documentoVazio(), 'a', 'inicio', 95, 30);
@@ -140,4 +140,14 @@ describe('editor/documento', () => {
     expect(existe(d, { tipo: 'conexao', id: 'c2' })).toBe(true);
     expect(existe(apagar(d, { tipo: 'conexao', id: 'c2' }), { tipo: 'conexao', id: 'c2' })).toBe(false);
   });
+
+  it('responsável que não é mais cadastro sai da peça; o resto fica igual', () => {
+    let d = mudarPeca(base(), 'b', { responsavel: 'k-existe' });
+    d = mudarPeca(d, 'c', { responsavel: 'k-sumiu' });
+    const r = semResponsaveisQueSumiram(d, new Set(['k-existe']));
+    expect(r.orfas).toBe(1);
+    expect(r.documento.pecas.map((p) => p.responsavel)).toEqual([undefined, 'k-existe', undefined]);
+    expect('responsavel' in r.documento.pecas[2]!).toBe(false);
+    expect(semResponsaveisQueSumiram(d, new Set(['k-existe', 'k-sumiu'])).documento).toBe(d);
+  });
 });
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/editor/cenarios.test.ts test/editor/diagnostico.test.ts test/editor/documento.test.ts`
Expected: FAIL, `Failed to resolve import "@/editor/cenarios"` (e `"@/editor/diagnostico"`), e o teste de `semResponsaveisQueSumiram`.

- [ ] **Passo 3: os cenários**

`apps/web/src/editor/cenarios.ts`:

```ts
import type { Documento, Execucao, Modo, MotivoFim } from '@journey/fluxo';
import { rodar, type Contexto, type Play } from './play';

/**
 * Cenário: um caminho salvo do play (de onde começa, a hora, o modo e as escolhas) com o resultado aprovado.
 * Abrir o cenário refaz o caminho com o documento de agora; se o resultado mudou, a tela avisa e oferece aprovar o novo.
 */

/** O resultado de um play: as peças por onde a água passou (em ordem, com repetição), como terminou e o tempo do cliente. */
export interface Resultado {
  caminho: string[];
  /** null: o play ainda pergunta (a escolha guardada não serve mais). */
  fim: { motivo: MotivoFim; peca: string | null } | null;
  tempo_s: number;
}

/** O resultado aprovado, como fica no banco: sempre com fim (o cenário é salvo no fim do play). */
export interface Esperado extends Resultado {
  fim: { motivo: MotivoFim; peca: string | null };
}

export interface Cenario {
  id: string;
  nome: string;
  inicio: string;
  quando: string;
  modo: Modo;
  escolhas: string[];
  esperado: Esperado;
  /** A revisão do fluxo em que o resultado foi aprovado. */
  revisao_aprovada: number;
  atualizado_em: string;
}

/** O que se guarda de um cenário novo (o nome vem da pessoa). */
export type CenarioNovo = Pick<Cenario, 'inicio' | 'quando' | 'modo' | 'escolhas' | 'esperado'>;

export function resultado(x: Execucao): Resultado {
  // Quando termina, "terminou" é o último evento: depois dele o motor não anda mais.
  const fim = x.eventos.at(-1);
  return {
    caminho: x.eventos.flatMap((e) => (e.tipo === 'chegou' ? [e.peca] : [])),
    fim: fim?.tipo === 'terminou' ? { motivo: fim.motivo, peca: fim.peca } : null,
    tempo_s: x.relogio_s,
  };
}

/** O play que toca o cenário. */
export const playDoCenario = (c: Pick<Cenario, 'inicio' | 'quando' | 'modo' | 'escolhas'>): Play => ({ inicio: c.inicio, quando: c.quando, modo: c.modo, escolhas: c.escolhas });

/**
 * O cenário a salvar no fim de um play. As escolhas são as que o motor aceitou (`x.escolhas`), não as que o play
 * guardava: uma escolha que não serve mais não pode ir pro cenário. Sem fim, não há o que salvar (null).
 */
export function cenarioDoPlay(p: Play, x: Execucao): CenarioNovo | null {
  const r = resultado(x);
  if (!r.fim) return null;
  return { inicio: p.inicio, quando: p.quando, modo: p.modo, escolhas: [...x.escolhas], esperado: { ...r, fim: r.fim } };
}

const mesmo = (a: Resultado, b: Resultado) =>
  a.tempo_s === b.tempo_s &&
  a.fim?.motivo === b.fim?.motivo &&
  a.fim?.peca === b.fim?.peca &&
  a.caminho.length === b.caminho.length &&
  a.caminho.every((p, i) => p === b.caminho[i]);

/** O cenário refeito com o documento de agora. */
export interface Situacao {
  situacao: 'igual' | 'mudou';
  resultado: Resultado;
  /** As escolhas que o motor aceitou agora: aprovar grava estas, não as guardadas. */
  escolhas: string[];
}

/**
 * Refaz o cenário com o documento de agora. "mudou" quando uma escolha guardada não serve mais (o caminho não é o
 * mesmo, mesmo que acabe igual) ou o resultado é outro; com ele vão o resultado e as escolhas novos, pra aprovar.
 */
export function situacao(c: Pick<Cenario, 'inicio' | 'quando' | 'modo' | 'escolhas' | 'esperado'>, doc: Documento, ctx: Contexto): Situacao {
  const x = rodar(doc, ctx, playDoCenario(c));
  const r = resultado(x);
  const igual = x.escolhas.length === c.escolhas.length && mesmo(r, c.esperado);
  return { situacao: igual ? 'igual' : 'mudou', resultado: r, escolhas: [...x.escolhas] };
}

/**
 * O que aprovar grava: as escolhas que o motor aceitou e o resultado novo. Gravar só o resultado deixaria uma
 * escolha que o fluxo não usa mais, e o cenário continuaria "mudou". Sem fim (o play ainda pergunta), ou com o
 * Início que sumiu, não há o que aprovar: null, e a tela não oferece o botão.
 */
export function paraAprovar(s: Situacao): Pick<Cenario, 'escolhas' | 'esperado'> | null {
  // "inexistente": o Início do cenário não existe mais; aprovar guardaria um cenário que não toca nada.
  return s.resultado.fim && s.resultado.fim.motivo !== 'inexistente' ? { escolhas: s.escolhas, esperado: { ...s.resultado, fim: s.resultado.fim } } : null;
}

const MOTIVOS: readonly MotivoFim[] = ['fim', 'beco', 'ciclo', 'limite', 'inexistente'];

/** O resultado esperado na forma que o banco aceita (cenarios_esperado). */
export function ehEsperado(v: unknown): v is Esperado {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const e = v as Record<string, unknown>;
  const fim = e.fim as Record<string, unknown> | null | undefined;
  return (
    Array.isArray(e.caminho) &&
    e.caminho.every((p) => typeof p === 'string') &&
    !!fim &&
    typeof fim === 'object' &&
    MOTIVOS.includes(fim.motivo as MotivoFim) &&
    (fim.peca === null || typeof fim.peca === 'string') &&
    typeof e.tempo_s === 'number' &&
    Number.isFinite(e.tempo_s) &&
    e.tempo_s >= 0
  );
}
```

- [ ] **Passo 4: o diagnóstico**

`apps/web/src/editor/diagnostico.ts`:

```ts
import { executar, indexar, type Achado, type Documento, type Evento, type Indice } from '@journey/fluxo';
import type { Contexto, Play } from './play';

/** Um achado marcado como intencional: a chave do achado, a nota e quem marcou (e-mail; null se saiu da empresa). */
export interface Intencional {
  chave: string;
  nota: string;
  autor: string | null;
  criado_em: string;
}

/** Os achados abertos e os marcados como intencionais. Marcação de achado que este documento não tem não conta. */
export function separar(achados: readonly Achado[], intencionais: readonly Pick<Intencional, 'chave'>[]): { abertos: Achado[]; intencionais: Achado[] } {
  const marcadas = new Set(intencionais.map((i) => i.chave));
  return { abertos: achados.filter((a) => !marcadas.has(a.chave)), intencionais: achados.filter((a) => marcadas.has(a.chave)) };
}

/** Quantos abertos e quantos intencionais (o botão do topo mostra os abertos). */
export function contar(achados: readonly Achado[], intencionais: readonly Pick<Intencional, 'chave'>[]): { abertos: number; intencionais: number } {
  const s = separar(achados, intencionais);
  return { abertos: s.abertos.length, intencionais: s.intencionais.length };
}

/**
 * As peças que a água alcança a partir de algum Início (sem seguir saída de Fim, onde ela para). Uma busca só pro
 * documento inteiro: o "simular até aqui" de cada achado só fica disponível pra peça daqui, e o caminho em si
 * (`caminhoAte`, que roda o motor) só é feito no clique.
 */
export function alcancaveis(doc: Documento): Set<string> {
  const idx = indexar(doc);
  const vistos = new Set(doc.pecas.filter((p) => p.tipo === 'inicio').map((p) => p.id));
  const fila = [...vistos];
  for (let i = 0; i < fila.length; i++) {
    const id = fila[i]!;
    if (idx.pecas.get(id)!.tipo === 'fim') continue;
    for (const c of idx.saidas.get(id)!) {
      if (vistos.has(c.para)) continue;
      vistos.add(c.para);
      fila.push(c.para);
    }
  }
  return vistos;
}

/** As chaves dos achados que têm "simular até aqui": a peça deles é alcançável. O documento é lido uma vez só. */
export function simulaveis(doc: Documento, achados: readonly Achado[]): Set<string> {
  const idx = indexar(doc);
  const a = alcancaveis(doc);
  return new Set(achados.flatMap((x) => (a.has(pecaNoIndice(idx, x) ?? '') ? [x.chave] : [])));
}

/**
 * O play que leva a água de um Início até a peça `alvo` ("simular até aqui"). O caminho mais curto, numa busca em
 * largura a partir de todos os Inícios (a água para num Fim, então não se segue saída de Fim). Depois o motor anda
 * por ele em modo livre (o relógio não decide: o horário também pergunta) e, a cada pergunta, escolhe a saída do
 * caminho. Devolve o play inteiro, já em modo livre: no modo relógio as mesmas escolhas não valem (o relógio decide
 * o horário sozinho e a escolha guardada pra ele sobra). null quando nenhum Início chega lá.
 */
export function caminhoAte(doc: Documento, ctx: Contexto, alvo: string, quando: string): Play | null {
  const idx = indexar(doc);
  if (!idx.pecas.has(alvo)) return null;
  const inicios = doc.pecas.filter((p) => p.tipo === 'inicio').map((p) => p.id);
  // Por qual conexão cada peça foi alcançada primeiro (os Inícios não têm).
  const veioPor = new Map<string, string | null>(inicios.map((id) => [id, null]));
  const fila = [...inicios];
  for (let i = 0; i < fila.length && !veioPor.has(alvo); i++) {
    const id = fila[i]!;
    if (idx.pecas.get(id)!.tipo === 'fim') continue;
    for (const c of idx.saidas.get(id)!) {
      if (veioPor.has(c.para)) continue;
      veioPor.set(c.para, c.id);
      fila.push(c.para);
    }
  }
  if (!veioPor.has(alvo)) return null;
  const conexoes = new Map(doc.conexoes.map((c) => [c.id, c]));
  const doCaminho = new Set<string>();
  let inicio = alvo;
  for (let c = veioPor.get(alvo); c; c = veioPor.get(inicio)) {
    doCaminho.add(c);
    inicio = conexoes.get(c)!.de;
  }
  const x = executar(doc, { cadastros: ctx.cadastros, ...(ctx.canal && { canal: ctx.canal }) }, { inicio, modo: 'livre' });
  const chegou = (eventos: readonly Evento[]) => eventos.some((e) => e.tipo === 'chegou' && e.peca === alvo);
  let chegouNoAlvo = chegou(x.eventos);
  while (!chegouNoAlvo && x.pendente) {
    const opcao = x.pendente.opcoes.find((o) => doCaminho.has(o.conexao));
    if (!opcao) break;
    chegouNoAlvo = chegou(x.avancar(opcao.conexao));
  }
  // Não acontece num caminho sem peça repetida; se acontecer, melhor nenhum caminho que um errado.
  return chegouNoAlvo ? { inicio, quando, modo: 'livre', escolhas: [...x.escolhas] } : null;
}

/** Marcações de achados que este documento não tem mais (a peça mudou ou sumiu): não contam, mas dá pra desmarcar. */
export function antigos<T extends Pick<Intencional, 'chave'>>(achados: readonly Achado[], intencionais: readonly T[]): T[] {
  const chaves = new Set(achados.map((a) => a.chave));
  return intencionais.filter((i) => !chaves.has(i.chave));
}

/** O texto do botão do diagnóstico: "sem achados", "1 achado", "3 achados". */
export const rotuloAchados = (n: number): string => (n === 0 ? 'sem achados' : n === 1 ? '1 achado' : `${n} achados`);

/** Gravidade com nome e ícone: a cor não é a única pista. */
export const GRAVIDADES: Record<Achado['gravidade'], { nome: string; icone: string }> = {
  grave: { nome: 'Grave', icone: 'alerta' },
  alerta: { nome: 'Alerta', icone: 'alerta' },
  observacao: { nome: 'Observação', icone: 'legenda' },
};

/** A peça onde "simular até aqui" chega: a primeira peça entre as referências do achado (uma conexão leva à origem dela). */
export function pecaDoAchado(doc: Documento, a: Pick<Achado, 'refs'>): string | null {
  return pecaNoIndice(indexar(doc), a);
}

function pecaNoIndice(idx: Indice, a: Pick<Achado, 'refs'>): string | null {
  for (const r of a.refs) {
    if (idx.pecas.has(r)) return r;
    const c = idx.doc.conexoes.find((x) => x.id === r);
    if (c && idx.pecas.has(c.de)) return c.de;
  }
  return null;
}

const chaveGaveta = (fluxoId: string) => `journey:diagnostico:${fluxoId}`;

/** Se a gaveta do diagnóstico estava aberta neste fluxo (lembrado no navegador; sem armazenamento, fechada). */
export function gavetaAberta(fluxoId: string): boolean {
  try {
    return globalThis.localStorage?.getItem(chaveGaveta(fluxoId)) === '1';
  } catch {
    return false;
  }
}

export function lembrarGaveta(fluxoId: string, aberta: boolean): void {
  try {
    if (aberta) globalThis.localStorage?.setItem(chaveGaveta(fluxoId), '1');
    else globalThis.localStorage?.removeItem(chaveGaveta(fluxoId));
  } catch {
    // Sem armazenamento no navegador (janela anônima, bloqueado): só não lembra.
  }
}

/**
 * "Ver no quadro": o que selecionar (a primeira referência que existe: peça ou conexão), o que fica no holofote (todas
 * as referências) e as peças a enquadrar (as da conexão, quando a referência é uma). null: nada do achado está no
 * documento (o "sem Início", por exemplo).
 */
export function focoDoAchado(doc: Documento, a: Pick<Achado, 'refs'>): { sel: { tipo: 'peca' | 'conexao'; id: string }; destaque: Set<string>; enquadrar: string[] } | null {
  const pecas = new Set(doc.pecas.map((p) => p.id));
  const conexoes = new Map(doc.conexoes.map((c) => [c.id, c]));
  const primeiro = a.refs.find((r) => pecas.has(r) || conexoes.has(r));
  if (!primeiro) return null;
  return {
    sel: { tipo: pecas.has(primeiro) ? 'peca' : 'conexao', id: primeiro },
    destaque: new Set(a.refs),
    enquadrar: [...new Set(a.refs.flatMap((r) => (pecas.has(r) ? [r] : conexoes.has(r) ? [conexoes.get(r)!.de, conexoes.get(r)!.para] : [])))],
  };
}
```

`apps/web/src/editor/documento.ts`:

```diff
diff --git a/apps/web/src/editor/documento.ts b/apps/web/src/editor/documento.ts
index 79b5016..8f624ea 100644
--- a/apps/web/src/editor/documento.ts
+++ b/apps/web/src/editor/documento.ts
@@ -251,3 +251,15 @@ export function existe(doc: Documento, sel: Selecao): boolean {
   const lista = { peca: doc.pecas, conexao: doc.conexoes, grupo: doc.grupos, nota: doc.notas }[sel.tipo] as readonly { id: string }[];
   return lista.some((x) => x.id === sel.id);
 }
+
+/**
+ * Tira das peças o responsável que não é mais cadastro da empresa (apagado depois): uma cópia guardada no navegador
+ * ou uma versão marcada antiga voltando pro editor seria recusada pelo banco no salvamento seguinte. Devolve o
+ * documento e quantas peças perderam o responsável (o aviso conta).
+ */
+export function semResponsaveisQueSumiram(doc: Documento, existem: ReadonlySet<string>): { documento: Documento; orfas: number } {
+  const orfas = doc.pecas.filter((p) => p.responsavel && !existem.has(p.responsavel));
+  let documento = doc;
+  for (const p of orfas) documento = mudarPeca(documento, p.id, { responsavel: undefined });
+  return { documento, orfas: orfas.length };
+}
```

- [ ] **Passo 5: rodar e ver passar**

Run: `cd apps/web && npx vitest run test/editor/cenarios.test.ts test/editor/diagnostico.test.ts test/editor/documento.test.ts && npx tsc --noEmit`
Expected: `Tests  42 passed (42)`; `tsc` sem saída.

- [ ] **Passo 6: commit**

```bash
git add apps/web/src/editor apps/web/test/editor
git commit -m "editor: cenários (resultado, situação, aprovar) e diagnóstico (abertos, alcançáveis, caminho até uma peça)" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 5: o retrato do link público e a chave secreta

**Arquivos:**
- Criar: `apps/web/src/compartilhar/retrato.ts`, `apps/web/src/lib/link.ts`
- Modificar: `apps/web/src/compartilhar/opcoes.ts`
- Testes: `apps/web/test/compartilhar/retrato.test.ts`, `apps/web/test/lib/link.test.ts` (novos), `test/compartilhar/opcoes.test.ts`, `test/chave-secreta.test.ts`

- [ ] **Passo 1: os testes**

`apps/web/test/compartilhar/retrato.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { diagnosticar, type Documento } from '@journey/fluxo';
import { ESTILO_PADRAO } from '@/editor/estilo';
import { montarRetrato, PESSOA, pessoasEscondidas, rotuloDaVersao, trocadorDeNomes, type LinkDoBanco } from '@/compartilhar/retrato';

const ANA = 'a0000000-0000-0000-0000-000000000001';
const ANA_PAULA = 'a0000000-0000-0000-0000-000000000002';
const SEM_USO = 'a0000000-0000-0000-0000-000000000003';
const FILA = 'f0000000-0000-0000-0000-000000000001';

const DOC: Documento = {
  formato: 'journey/2',
  pecas: [
    { id: 'i', tipo: 'inicio', nome: 'Cliente liga', x: 0, y: 0 },
    { id: 'menu', tipo: 'decisao', nome: 'Menu', x: 200, y: 0, descricao: 'Digite 1 para Análise, 2 para falar com a ANA ou 3 para a Ana Paula.' },
    // A Ana Paula aparece primeiro nas peças: ela é a Pessoa 1.
    { id: 'ap', tipo: 'atendimento', nome: 'Atende a Ana Paula', x: 400, y: 100, responsavel: ANA_PAULA },
    { id: 'a', tipo: 'atendimento', nome: 'Atende a Ana', x: 400, y: 0, responsavel: ANA },
    { id: 'fila', tipo: 'atendimento', nome: 'Fila', x: 400, y: 200, responsavel: FILA },
    { id: 'f', tipo: 'fim', nome: 'Fim', x: 600, y: 0 },
  ],
  conexoes: [
    { id: 'c1', de: 'i', para: 'menu', regra: 'sempre' },
    { id: 'c2', de: 'menu', para: 'a', regra: 'opcao', valor: '2', rotulo: 'Falar com a Ana' },
    { id: 'c3', de: 'menu', para: 'ap', regra: 'condicao', valor: 'pediu a Ana Paula' },
    { id: 'c4', de: 'menu', para: 'fila', regra: 'opcao', valor: '1', rotulo: 'Análise' },
    { id: 'c5', de: 'a', para: 'f', regra: 'sempre' },
    { id: 'c6', de: 'ap', para: 'f', regra: 'sempre' },
  ],
  grupos: [{ id: 'g', nome: 'Mesa da Ana', x: 380, y: -20, w: 300, h: 300 }],
  notas: [
    { id: 'n', texto: 'A Ana sai às 17h', x: 0, y: 300, w: 100, h: 100 },
    // Quem não é responsável de nenhuma peça, citado só no texto: a Bia é cadastro da empresa; o Rui, não.
    { id: 'n2', texto: 'Se a Bia Torres faltar, chama o Rui', x: 0, y: 400, w: 100, h: 100 },
  ],
};

/** Uma chave que está no diagnóstico de DOC (a fila não tem saída): o intencional dela vai no retrato. */
const CHAVE = diagnosticar(DOC)[0]!.chave;

function link(extra: Partial<LinkDoBanco> = {}): LinkDoBanco {
  return {
    estado: 'ok',
    empresa: { nome: 'Empresa A' },
    fluxo: { nome: 'Telefonia da Ana', canal: 'telefonia', descricao: 'Quem atende é a Ana Paula', meta_s: null },
    documento: DOC,
    estilo: { velocidade: 2, cano: 'nao-existe' },
    versao: { numero: 3, nome: 'antes da Ana sair', criada_em: '2026-11-12T10:00:00Z' },
    atual: null,
    cadastros: [
      { id: ANA, tipo: 'pessoa', nome: 'Ana', campos: { ramal: '2001' } },
      { id: ANA_PAULA, tipo: 'pessoa', nome: 'Ana Paula', campos: {} },
      { id: SEM_USO, tipo: 'pessoa', nome: 'Zeca', campos: {} },
      { id: FILA, tipo: 'fila', nome: 'Fila da Ana', campos: { obs: ['falar com a Ana'] } },
    ],
    canais: [{ chave: 'telefonia', nome: 'Telefonia', cor: '#1e8bdc', arquivado: false }],
    intencionais: [
      { chave: CHAVE, nota: 'a Ana pediu' },
      { chave: 'de_outra_versao:x', nota: 'não vai' },
    ],
    esconder_nomes: true,
    cenario: { nome: 'E se a Ana não atender?', inicio: 'i', quando: '2026-11-23T10:00', modo: 'relogio', escolhas: ['c2'] },
    expira_em: null,
    // Todas as pessoas da empresa, como o abrir_link manda (por nome; Ana e Zeca também são cadastros acima).
    pessoas: ['Ana', 'Ana Paula', 'Bia Torres', 'Zeca'],
    ...extra,
  };
}

describe('nomes das pessoas', () => {
  it('cada Pessoa das peças vira "Pessoa N", na ordem em que aparece; a que nenhuma peça usa, só "Pessoa"', () => {
    expect([...pessoasEscondidas(link().cadastros, DOC)]).toEqual([
      [ANA_PAULA, 'Pessoa 1'],
      [ANA, 'Pessoa 2'],
      [SEM_USO, PESSOA],
    ]);
  });

  it('trocam como palavra inteira, sem caixa, o nome maior primeiro', () => {
    const trocar = trocadorDeNomes(new Map([['Ana', 'Pessoa 2'], ['Ana Paula', 'Pessoa 1']]));
    expect(trocar('Digite 1 para Análise, 2 para falar com a ANA ou 3 para a Ana Paula.')).toBe('Digite 1 para Análise, 2 para falar com a Pessoa 2 ou 3 para a Pessoa 1.');
    expect(trocar('Banana')).toBe('Banana');
  });

  it('compara em NFC, e um acento combinante não é fim de palavra', () => {
    const trocar = trocadorDeNomes(new Map([['Ana', 'Pessoa 1'], ['José', 'Pessoa 2']]));
    expect(trocar('Fale com o José'.normalize('NFD'))).toBe('Fale com o Pessoa 2');
    expect(trocar('Rua Anã, 10'.normalize('NFD'))).toBe('Rua Anã, 10'.normalize('NFC'));
    expect(trocar('Ana̱ e ̱Ana')).toBe('Ana̱ e ̱Ana');
  });

  it('acha o nome sem depender da caixa do idioma', () => {
    expect(trocadorDeNomes(new Map([['İsmail', 'Pessoa 1']]))('Ligue para İsmail agora')).toBe('Ligue para Pessoa 1 agora');
  });

  it('espaços repetidos contam como um, NBSP é espaço e os apóstrofos são iguais', () => {
    const trocar = trocadorDeNomes(new Map([['Ana  Paula', 'Pessoa 1'], ['Ana Paula', 'Pessoa 9'], ["D'Ávila", 'Pessoa 2']]));
    expect(trocar('Ana Paula, Ana   Paula e Ana Paula')).toBe('Pessoa 1, Pessoa 1 e Pessoa 1');
    expect(trocar('Fale com d’Ávila ou D\'Ávila')).toBe('Fale com Pessoa 2 ou Pessoa 2');
  });

  it('nome de uma letra não troca nada no texto', () => {
    expect(trocadorDeNomes(new Map([['A', 'Pessoa 1']]))('Digite A para atendimento')).toBe('Digite A para atendimento');
  });

  describe('variantes do nome', () => {
    const trocar = trocadorDeNomes(new Map([['Ana Souza', 'Pessoa 1'], ['João da Silva', 'Pessoa 2']]));

    it('cada palavra do nome sozinha (3 letras ou mais, menos as partículas)', () => {
      expect(trocar('fala com a Ana')).toBe('fala com a Pessoa 1');
      expect(trocar('o Souza atende')).toBe('o Pessoa 1 atende');
      expect(trocar('ligar pro João, da Silva')).toBe('ligar pro Pessoa 2, da Pessoa 2');
      // "da" é partícula: não troca sozinha.
      expect(trocar('a casa da praia')).toBe('a casa da praia');
    });

    it('sem o acento que o nome tem', () => {
      expect(trocar('Joao da Silva ligou')).toBe('Pessoa 2 ligou');
      expect(trocar('JOAO')).toBe('Pessoa 2');
    });

    it('com hífen, sublinhado, tab, espaços ou espaço de largura zero entre as palavras', () => {
      for (const t of ['Ana-Souza', 'Ana_Souza', 'Ana\tSouza', 'ANA   SOUZA', 'Ana\u200BSouza', 'Ana\u00A0Souza'])
        expect(trocar(t), JSON.stringify(t)).toBe('Pessoa 1');
    });

    it('palavra que só contém o nome não troca', () => {
      expect(trocar('Banana e Análise')).toBe('Banana e Análise');
      expect(trocar('Anabela')).toBe('Anabela');
      // Limite conhecido: o nome grudado em outra palavra fica.
      expect(trocar('AnaSouza')).toBe('AnaSouza');
    });

    it('o nome inteiro de uma pessoa vale mais que a palavra do nome de outra', () => {
      const t = trocadorDeNomes(new Map([['Ana Paula', 'Pessoa 1'], ['Ana', 'Pessoa 2']]));
      expect(t('Ana e Paula e Ana Paula')).toBe('Pessoa 2 e Pessoa 1 e Pessoa 1');
    });
  });
});

describe('montarRetrato', () => {
  it('com nomes escondidos, nenhum nome de pessoa vai pro navegador', () => {
    const r = montarRetrato(link())!;
    const tudo = JSON.stringify(r);
    for (const nome of ['Ana', 'ANA', 'Zeca', '2001']) expect(tudo).not.toContain(nome);
    expect(r.cadastros).toEqual([
      { id: ANA, tipo: 'pessoa', nome: 'Pessoa 2', campos: {} },
      { id: ANA_PAULA, tipo: 'pessoa', nome: 'Pessoa 1', campos: {} },
      { id: SEM_USO, tipo: 'pessoa', nome: 'Pessoa', campos: {} },
      { id: FILA, tipo: 'fila', nome: 'Fila da Pessoa 2', campos: { obs: ['falar com a Pessoa 2'] } },
    ]);
  });

  it('quem não é responsável de nenhuma peça também sai do texto, sem número; a lista das pessoas não vai', () => {
    const r = montarRetrato(link())!;
    expect(r.documento.notas[1]!.texto).toBe('Se a Pessoa faltar, chama o Rui');
    const tudo = JSON.stringify(r);
    for (const nome of link().pessoas) expect(tudo).not.toContain(nome);
    expect(tudo).not.toContain('Pessoa 3');
    expect(tudo).not.toContain('pessoas');
    expect(Object.keys(r)).not.toContain('pessoas');
  });

  it('o nome que está nas peças e na lista fica com o número', () => {
    const r = montarRetrato(link({ pessoas: ['Ana Paula', 'Ana'] }))!;
    expect(r.documento.notas[0]!.texto).toBe('A Pessoa 2 sai às 17h');
    // Sem a lista (resposta antiga do banco), os das peças continuam escondidos.
    expect(montarRetrato(link({ pessoas: undefined as unknown as string[] }))!.documento.notas[0]!.texto).toBe('A Pessoa 2 sai às 17h');
  });

  it('o nome sai de todo texto livre; o que não é nome fica', () => {
    const { documento: d, fluxo, versao, cenario, intencionais } = montarRetrato(link())!;
    expect(d.pecas.find((p) => p.id === 'menu')!.descricao).toBe('Digite 1 para Análise, 2 para falar com a Pessoa 2 ou 3 para a Pessoa 1.');
    expect(d.pecas.map((p) => p.nome)).toEqual(['Cliente liga', 'Menu', 'Atende a Pessoa 1', 'Atende a Pessoa 2', 'Fila', 'Fim']);
    expect(d.conexoes.map((c) => [c.valor, c.rotulo])).toEqual([
      [undefined, undefined],
      ['2', 'Falar com a Pessoa 2'],
      ['pediu a Pessoa 1', undefined],
      ['1', 'Análise'],
      [undefined, undefined],
      [undefined, undefined],
    ]);
    expect(d.grupos[0]!.nome).toBe('Mesa da Pessoa 2');
    expect(d.notas[0]!.texto).toBe('A Pessoa 2 sai às 17h');
    expect(fluxo).toEqual({ nome: 'Telefonia da Pessoa 2', canal: 'telefonia', descricao: 'Quem atende é a Pessoa 1', meta_s: null });
    expect(versao).toEqual({ numero: 3, nome: 'antes da Pessoa 2 sair' });
    expect(cenario).toEqual({ nome: 'E se a Pessoa 2 não atender?', inicio: 'i', quando: '2026-11-23T10:00', modo: 'relogio', escolhas: ['c2'] });
    expect(intencionais).toEqual([{ chave: CHAVE, nota: 'a Pessoa 2 pediu' }]);
  });

  it('com nomes à mostra, fica tudo como está', () => {
    const r = montarRetrato(link({ esconder_nomes: false }))!;
    expect(r.documento).toEqual(DOC);
    expect(r.cadastros.map((k) => k.nome)).toEqual(['Ana', 'Ana Paula', 'Zeca', 'Fila da Ana']);
    expect(r.fluxo.nome).toBe('Telefonia da Ana');
    expect(r.intencionais).toEqual([{ chave: CHAVE, nota: 'a Ana pediu' }]);
  });

  it('o estilo é lido sem confiar; os canais vão só com chave, nome e cor', () => {
    const r = montarRetrato(link())!;
    expect(r.estilo).toEqual({ ...ESTILO_PADRAO, canais: {}, velocidade: 2 });
    expect(r.canais).toEqual([{ chave: 'telefonia', nome: 'Telefonia', cor: '#1e8bdc' }]);
  });

  it('versão fixa ou o fluxo de agora, com a data de cada um', () => {
    const fixa = montarRetrato(link({ esconder_nomes: false }))!;
    expect([rotuloDaVersao(fixa.versao), fixa.de]).toEqual(['versão 3 · antes da Ana sair', '2026-11-12T10:00:00Z']);
    const agora = montarRetrato(link({ versao: null, atual: { revisao: 7, editado_em: '2026-11-13T09:00:00Z' } }))!;
    expect([rotuloDaVersao(agora.versao), agora.de]).toEqual(['o fluxo de agora', '2026-11-13T09:00:00Z']);
  });

  it('do cenário guardado só vão os campos dele', () => {
    const cenario = { ...link().cenario!, esperado: { caminho: ['Ana'] } } as unknown as LinkDoBanco['cenario'];
    expect(Object.keys(montarRetrato(link({ cenario }))!.cenario!)).toEqual(['nome', 'inicio', 'quando', 'modo', 'escolhas']);
    expect(montarRetrato(link({ cenario: null }))!.cenario).toBeNull();
  });

  it('documento que não é journey/2 válido: o link não abre', () => {
    expect(montarRetrato(link({ documento: { formato: 'journey/1' } }))).toBeNull();
    expect(montarRetrato(link({ documento: { ...DOC, pecas: [{ id: 'x', tipo: 'robo' }] } }))).toBeNull();
  });

  it('o que o documento não conhece não vai', () => {
    const comLixo = { ...DOC, segredo: 'Ana', pecas: DOC.pecas.map((p) => ({ ...p, observacao: 'Ana' })) };
    expect(JSON.stringify(montarRetrato(link({ esconder_nomes: false, documento: comLixo }))!.documento)).not.toContain('observacao');
  });
});

describe('o que mais sai com os nomes escondidos', () => {
  const FULANA = 'a0000000-0000-0000-0000-00000000000f';
  const base = (doc: unknown, cadastros: LinkDoBanco['cadastros'], extra: Partial<LinkDoBanco> = {}): LinkDoBanco =>
    link({
      documento: doc,
      cadastros,
      fluxo: { nome: 'F', canal: null, descricao: '', meta_s: null },
      versao: null,
      atual: { revisao: 1, editado_em: '2026-11-13T00:00:00Z' },
      canais: [{ chave: 'wa', nome: 'WhatsApp da Ana Souza', cor: '#000000', arquivado: false }],
      intencionais: [],
      cenario: null,
      pessoas: ['Ana Souza'],
      ...extra,
    });

  it('pessoa que só aparece no texto, valor de qualquer regra, nome de canal e responsável solto', () => {
    const doc = {
      formato: 'journey/2',
      pecas: [
        { id: 'i', tipo: 'inicio', nome: 'Início', x: 0, y: 0 },
        { id: 'a', tipo: 'atendimento', nome: 'Atende', x: 0, y: 0, responsavel: FILA, descricao: 'Se travar, chama a Ana Souza' },
        { id: 'b', tipo: 'atendimento', nome: 'Outro', x: 0, y: 0, responsavel: 'Ana Souza' },
        { id: 'f', tipo: 'fim', nome: 'Fim', x: 0, y: 0 },
      ],
      conexoes: [
        { id: 'c1', de: 'i', para: 'a', regra: 'sempre', valor: 'Ana Souza respondeu' },
        { id: 'c2', de: 'a', para: 'f', regra: 'opcao', valor: 'Ana Souza' },
        { id: 'c3', de: 'a', para: 'b', regra: 'opcao', valor: '2' },
        { id: 'c4', de: 'b', para: 'f', regra: 'sempre' },
      ],
      grupos: [],
      notas: [],
    };
    const r = montarRetrato(base(doc, [{ id: FILA, tipo: 'fila', nome: 'Suporte', campos: {} }]))!;
    expect(JSON.stringify(r)).not.toMatch(/Ana|Souza/);
    expect(r.documento.pecas[1]!.descricao).toBe('Se travar, chama a Pessoa');
    expect(r.documento.conexoes.map((c) => c.valor)).toEqual(['Pessoa respondeu', 'Pessoa', '2', undefined]);
    expect(r.canais[0]!.nome).toBe('WhatsApp da Pessoa');
    // O responsável que não é um dos cadastros que vieram sai; o que é fica.
    expect(r.documento.pecas.map((p) => p.responsavel)).toEqual([undefined, FILA, undefined, undefined]);
  });

  it('com os nomes à mostra, o responsável e o canal ficam como estão', () => {
    const doc = { formato: 'journey/2', pecas: [{ id: 'b', tipo: 'atendimento', nome: 'x', x: 0, y: 0, responsavel: 'Ana Souza' }], conexoes: [], grupos: [], notas: [] };
    const r = montarRetrato(base(doc, [], { esconder_nomes: false, pessoas: [] }))!;
    expect(r.documento.pecas[0]!.responsavel).toBe('Ana Souza');
    expect(r.canais[0]!.nome).toBe('WhatsApp da Ana Souza');
  });

  it('o intencional de opções repetidas com nome na condição continua no link (a chave é feita dos ids)', () => {
    const doc: Documento = {
      formato: 'journey/2',
      pecas: [
        { id: 'i', tipo: 'inicio', nome: 'Início', x: 0, y: 0 },
        { id: 'd', tipo: 'decisao', nome: 'D', x: 0, y: 0 },
        { id: 'a', tipo: 'atendimento', nome: 'A', x: 0, y: 0, responsavel: FULANA },
        { id: 'f', tipo: 'fim', nome: 'Fim', x: 0, y: 0 },
      ],
      conexoes: [
        { id: 'c1', de: 'i', para: 'd', regra: 'sempre' },
        { id: 'c2', de: 'd', para: 'a', regra: 'condicao', valor: 'pediu a Ana' },
        { id: 'c3', de: 'd', para: 'f', regra: 'condicao', valor: 'pediu a Ana' },
        { id: 'c4', de: 'a', para: 'f', regra: 'sempre' },
      ],
      grupos: [],
      notas: [],
    };
    const cadastros = [{ id: FULANA, tipo: 'pessoa', nome: 'Ana', campos: {} }];
    const chave = diagnosticar(doc, { cadastros }).find((a) => a.tipo === 'opcoes_repetidas')!.chave;
    const r = montarRetrato(base(doc, cadastros, { pessoas: ['Ana'], intencionais: [{ chave, nota: 'a Ana decide' }] }))!;
    expect(r.intencionais).toEqual([{ chave, nota: 'a Pessoa 1 decide' }]);
  });
});
```

`apps/web/test/lib/link.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinkDoBanco } from '@/compartilhar/retrato';

vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ connection: async () => {} }));
// O cache do React só junta chamadas dentro de um pedido; aqui cada chamada vai pro banco.
vi.mock('react', async (original) => ({ ...(await original<typeof import('react')>()), cache: <T>(f: T) => f }));

let resposta: { data: unknown; error: { message: string } | null } = { data: null, error: null };
const chamadas: { url: string; chave: string; fn: string; args: unknown }[] = [];
vi.mock('@supabase/supabase-js', () => ({
  createClient: (url: string, chave: string) => ({
    rpc: async (fn: string, args: unknown) => {
      chamadas.push({ url, chave, fn, args });
      return resposta;
    },
  }),
}));

const { abrirLink, linkPublicoConfigurado } = await import('@/lib/link');
const TOKEN = 'abcdefghijklmnopqrstuvwx';
const ANA = 'a0000000-0000-0000-0000-000000000001';

const ok = (extra: Partial<LinkDoBanco> = {}): LinkDoBanco => ({
  estado: 'ok',
  empresa: { nome: 'Empresa A' },
  fluxo: { nome: 'Cobrança', canal: 'whatsapp', descricao: '', meta_s: null },
  documento: {
    formato: 'journey/2',
    pecas: [
      { id: 'i', tipo: 'inicio', nome: 'Começo', x: 0, y: 0 },
      { id: 'a', tipo: 'atendimento', nome: 'Atende a Ana', x: 200, y: 0, responsavel: ANA },
    ],
    conexoes: [{ id: 'c', de: 'i', para: 'a', regra: 'sempre' }],
    grupos: [],
    notas: [],
  },
  estilo: {},
  versao: null,
  atual: { revisao: 2, editado_em: '2026-11-13T10:00:00Z' },
  cadastros: [{ id: ANA, tipo: 'pessoa', nome: 'Ana', campos: {} }],
  canais: [],
  intencionais: [],
  esconder_nomes: true,
  cenario: null,
  expira_em: null,
  pessoas: ['Ana', 'Bia'],
  ...extra,
});

describe('abrirLink', () => {
  beforeEach(() => {
    chamadas.length = 0;
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_teste';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  });

  it('token fora do formato nem vai pro banco', async () => {
    expect(await abrirLink('curto')).toEqual({ estado: 'inexistente' });
    expect(await abrirLink(`${TOKEN.slice(1)}/`)).toEqual({ estado: 'inexistente' });
    expect(chamadas).toEqual([]);
  });

  it('chama só abrir_link, com a chave secreta', async () => {
    resposta = { data: { estado: 'inexistente' }, error: null };
    expect(await abrirLink(TOKEN)).toEqual({ estado: 'inexistente' });
    expect(chamadas).toEqual([{ url: 'http://127.0.0.1:54321', chave: 'sb_secret_teste', fn: 'abrir_link', args: { p_token: TOKEN } }]);
  });

  it('revogado e vencido passam com a data', async () => {
    resposta = { data: { estado: 'revogado', quando: '2026-11-12T10:00:00Z' }, error: null };
    expect(await abrirLink(TOKEN)).toEqual({ estado: 'revogado', quando: '2026-11-12T10:00:00Z' });
    resposta = { data: { estado: 'vencido', quando: '2026-11-01T00:00:00Z' }, error: null };
    expect(await abrirLink(TOKEN)).toEqual({ estado: 'vencido', quando: '2026-11-01T00:00:00Z' });
  });

  it('erro do banco rejeita com a mensagem', async () => {
    resposta = { data: null, error: { message: 'banco fora do ar' } };
    await expect(abrirLink(TOKEN)).rejects.toThrow('banco fora do ar');
  });

  it('link que vale volta como retrato, já sem os nomes', async () => {
    resposta = { data: ok(), error: null };
    const r = await abrirLink(TOKEN);
    expect(r.estado).toBe('ok');
    expect(JSON.stringify(r)).not.toContain('Ana');
  });

  it('sem a chave secreta, erro claro', async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    await expect(abrirLink(TOKEN)).rejects.toThrow('SUPABASE_SECRET_KEY');
  });

  it('documento que não é journey/2 válido não vira página', async () => {
    resposta = { data: ok({ documento: { formato: 'journey/1' } }), error: null };
    await expect(abrirLink(TOKEN)).rejects.toThrow('este link não abre');
  });
});

describe('linkPublicoConfigurado', () => {
  it('diz se o servidor tem a chave secreta', () => {
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_teste';
    expect(linkPublicoConfigurado()).toBe(true);
    process.env.SUPABASE_SECRET_KEY = '';
    expect(linkPublicoConfigurado()).toBe(false);
    delete process.env.SUPABASE_SECRET_KEY;
    expect(linkPublicoConfigurado()).toBe(false);
  });
});
```

`apps/web/test/compartilhar/opcoes.test.ts`:

```diff
diff --git a/apps/web/test/compartilhar/opcoes.test.ts b/apps/web/test/compartilhar/opcoes.test.ts
index e998c6d..6ed2dd9 100644
--- a/apps/web/test/compartilhar/opcoes.test.ts
+++ b/apps/web/test/compartilhar/opcoes.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it } from 'vitest';
-import { descreverLink, ehValidade, enderecoDoLink, expiraEm, situacao, type LinkResumo } from '@/compartilhar/opcoes';
+import { descreverLink, ehValidade, enderecoDoLink, escolhasDoFormulario, expiraEm, situacao, type LinkResumo } from '@/compartilhar/opcoes';
 
 const AGORA = new Date('2026-11-12T15:00:00Z');
 const base: LinkResumo = {
@@ -29,7 +29,7 @@ describe('opções do link', () => {
   });
 
   it('descreve em uma linha, com a data de São Paulo', () => {
-    expect(descreverLink(base, AGORA)).toBe('sempre a versão mais recente · nomes escondidos · sem cenário · sem prazo');
+    expect(descreverLink(base, AGORA)).toBe('o fluxo de agora · nomes escondidos · sem cenário · sem prazo');
     expect(descreverLink({ ...base, versao: 3, esconder_nomes: false, cenario_nome: 'E se?', expira_em: '2026-12-13T02:00:00Z' }, AGORA)).toBe(
       'versão 3 · com os nomes · cenário “E se?” · vale até 12/12/2026',
     );
@@ -40,4 +40,11 @@ describe('opções do link', () => {
   it('endereço', () => {
     expect(enderecoDoLink('https://journey.exemplo.com', 'abc')).toBe('https://journey.exemplo.com/l/abc');
   });
+
+  it('o formulário vira as opções do link', () => {
+    expect(escolhasDoFormulario({ versao: '', cenario: '', esconder: true, validade: '30' })).toEqual({ versao: null, cenarioId: null, esconderNomes: true, validade: 30 });
+    expect(escolhasDoFormulario({ versao: '3', cenario: 'k1', esconder: false, validade: 'sem' })).toEqual({ versao: 3, cenarioId: 'k1', esconderNomes: false, validade: null });
+    // Validade fora da lista volta pro padrão.
+    expect(escolhasDoFormulario({ versao: '', cenario: '', esconder: true, validade: '1' }).validade).toBe(30);
+  });
 });
```

`apps/web/test/chave-secreta.test.ts` (de volta à forma estrita: só o `lib/link.ts`, e com `server-only`):

```diff
diff --git a/apps/web/test/chave-secreta.test.ts b/apps/web/test/chave-secreta.test.ts
index 434c9e1..b16b059 100644
--- a/apps/web/test/chave-secreta.test.ts
+++ b/apps/web/test/chave-secreta.test.ts
@@ -17,10 +17,8 @@ function arquivos(pasta: string): string[] {
 describe('chave secreta', () => {
   const todos = arquivos(SRC).map((f) => [f.slice(SRC.length + 1), readFileSync(f, 'utf8')] as const);
 
-  const leem = todos.filter(([, texto]) => /SUPABASE_SECRET_KEY|SERVICE_ROLE|sb_secret_/.test(texto));
-
   it('só src/lib/link.ts lê SUPABASE_SECRET_KEY', () => {
-    expect(leem.map(([nome]) => nome).filter((nome) => nome !== 'lib/link.ts')).toEqual([]);
+    expect(todos.filter(([, texto]) => /SUPABASE_SECRET_KEY|SERVICE_ROLE|sb_secret_/.test(texto)).map(([nome]) => nome)).toEqual(['lib/link.ts']);
   });
 
   it('o next.config não tem env: (iria pro bundle do navegador)', () => {
@@ -29,7 +27,8 @@ describe('chave secreta', () => {
   });
 
   it('e ele é só do servidor', () => {
-    expect(leem.filter(([, texto]) => !texto.startsWith("import 'server-only';")).map(([nome]) => nome)).toEqual([]);
+    const [, link] = todos.find(([nome]) => nome === 'lib/link.ts')!;
+    expect(link.startsWith("import 'server-only';")).toBe(true);
   });
 
   it('nenhum componente de cliente importa lib/link', () => {
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/compartilhar test/lib/link.test.ts test/chave-secreta.test.ts`
Expected: FAIL, `Failed to resolve import "@/compartilhar/retrato"` e `"@/lib/link"`; o texto novo de `opcoes`.

- [ ] **Passo 3: as opções do link**

`apps/web/src/compartilhar/opcoes.ts`:

```diff
diff --git a/apps/web/src/compartilhar/opcoes.ts b/apps/web/src/compartilhar/opcoes.ts
index f678982..67ceee1 100644
--- a/apps/web/src/compartilhar/opcoes.ts
+++ b/apps/web/src/compartilhar/opcoes.ts
@@ -40,7 +40,7 @@ export const dataCurta = (iso: string) => dia.format(new Date(iso));
 /** "versão 3 · nomes escondidos · cenário “E se…” · vale até 12/12/2026". */
 export function descreverLink(l: LinkResumo, agora: Date): string {
   const partes = [
-    l.versao === null ? 'sempre a versão mais recente' : `versão ${l.versao}`,
+    l.versao === null ? 'o fluxo de agora' : `versão ${l.versao}`,
     l.esconder_nomes ? 'nomes escondidos' : 'com os nomes',
     l.cenario_nome ? `cenário “${l.cenario_nome}”` : 'sem cenário',
   ];
@@ -53,3 +53,26 @@ export function descreverLink(l: LinkResumo, agora: Date): string {
 
 /** O endereço do link a partir da origem do app. */
 export const enderecoDoLink = (origem: string, token: string) => `${origem}/l/${token}`;
+
+/** Uma linha com o que "esconder nomes" não pega (os limites estão em compartilhar/retrato.ts, seção "Nomes"). */
+export const LIMITES_ESCONDER =
+  'Troca o nome de cada pessoa cadastrada, inteiro ou por partes, em todo texto do fluxo; apelidos, abreviações, e-mails e telefones escritos no texto ficam.';
+
+/** O que o formulário do "Compartilhar" manda, já no formato da ação criarLink. */
+export interface EscolhasDoLink {
+  versao: number | null;
+  esconderNomes: boolean;
+  cenarioId: string | null;
+  validade: Validade;
+}
+
+/** Lê o formulário: versão e cenário vazios são "o fluxo de agora" e "nenhum"; validade "sem" é sem prazo. */
+export function escolhasDoFormulario(f: { versao: string; cenario: string; esconder: boolean; validade: string }): EscolhasDoLink {
+  const validade = f.validade === 'sem' ? null : Number(f.validade);
+  return {
+    versao: f.versao ? Number(f.versao) : null,
+    esconderNomes: f.esconder,
+    cenarioId: f.cenario || null,
+    validade: ehValidade(validade) ? validade : VALIDADE_PADRAO,
+  };
+}
```

- [ ] **Passo 4: o retrato**

`apps/web/src/compartilhar/retrato.ts`:

```ts
import { diagnosticar, lerDocumento, type Cadastro, type Documento, type Modo } from '@journey/fluxo';
import { lerEstilo, type CanalEditor, type Estilo } from '@/editor/estilo';

/** O cenário inicial guardado no link: a cópia do cenário salvo, sem o resultado esperado. */
export interface CenarioDoLink {
  nome: string;
  inicio: string;
  quando: string;
  modo: Modo;
  escolhas: string[];
}

/** O que `abrir_link` devolve quando o link vale (migração 20261115000000). O documento e o estilo vêm sem conferir. */
export interface LinkDoBanco {
  estado: 'ok';
  empresa: { nome: string };
  fluxo: { nome: string; canal: string | null; descricao: string; meta_s: number | null };
  documento: unknown;
  estilo: unknown;
  /** A versão fixa do link; null quando o link mostra o fluxo de agora. */
  versao: { numero: number; nome: string; criada_em: string } | null;
  /** O fluxo de agora (link sem versão fixa); null com versão fixa. */
  atual: { revisao: number; editado_em: string } | null;
  /** Só os cadastros que o documento usa. */
  cadastros: Cadastro[];
  canais: (CanalEditor & { arquivado: boolean })[];
  intencionais: { chave: string; nota: string }[];
  esconder_nomes: boolean;
  cenario: CenarioDoLink | null;
  expira_em: string | null;
  /**
   * Com "esconder nomes", o nome de toda Pessoa da empresa (vazio com os nomes à mostra): pra sair também do texto
   * livre que cita quem não é responsável de nenhuma peça. Só o servidor usa; não vai pro retrato.
   */
  pessoas: string[];
}

/** O retrato só de leitura que a página do link mostra. É tudo o que vai pro navegador de quem abre. */
export interface Retrato {
  empresa: { nome: string };
  fluxo: { nome: string; canal: string | null; descricao: string; meta_s: number | null };
  /** A versão fixa (número e nome) ou null: o fluxo de agora. */
  versao: { numero: number; nome: string } | null;
  /** De quando é o que o link mostra: a data da versão, ou a da última edição do fluxo. */
  de: string;
  esconderNomes: boolean;
  expiraEm: string | null;
  documento: Documento;
  estilo: Estilo;
  cadastros: Cadastro[];
  canais: CanalEditor[];
  /** Só os dos achados deste documento. */
  intencionais: { chave: string; nota: string }[];
  cenario: CenarioDoLink | null;
}

/** "versão 3 · antes do horário novo", ou "o fluxo de agora". */
export const rotuloDaVersao = (v: Retrato['versao']): string => (v ? `versão ${v.numero} · ${v.nome}` : 'o fluxo de agora');

// Nomes ----------------------------------------------------------------------------------------------------------

/*
 * Esconder nomes troca, em todo texto livre, o nome de cada Pessoa da empresa: o nome inteiro e cada palavra dele
 * com 3 letras ou mais (menos da, de, do, das, dos, e), sem diferença de caixa, sem o acento que o nome tem
 * ("Joao" acha "João"), e com espaço, hífen, sublinhado ou espaço de largura zero entre as palavras. Trocar a mais é o
 * lado seguro: o sobrenome "Rosa" também troca a cor rosa.
 *
 * O que fica de fora (limites conhecidos):
 * - apelido, diminutivo, abreviação ou erro de digitação ("Aninha", "A. Souza", "Ana Sousa");
 * - nome grudado em outra coisa ("AnaSouza", "@ana.souza", "ana.souza@empresa.com") e telefones ou e-mails no texto;
 * - palavra do nome com menos de 3 letras sozinha ("Li" de "Li Wang"; o nome "Li" inteiro troca);
 * - acento que o texto tem e o nome não ("Anã" não é "Ana");
 * - quem não é cadastro do tipo Pessoa (gente cadastrada como equipe, sistema ou num tipo próprio da empresa);
 * - o nome da empresa, cores, ids e o que não é texto.
 */

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Entre as palavras de um nome: espaço (NBSP e tab também), hífen, sublinhado ou espaço de largura zero. */
const SEPARADOR = '[\\s\\u200B-\\u200D\\u2060\\u2010-\\u2015_-]+';
const ehSeparador = (c: string) => new RegExp(`^${SEPARADOR}$`, 'u').test(c);

/** Letra, número ou acento combinante: o que não pode vir colado num nome pra ele contar como palavra inteira. */
const LETRA = '[\\p{L}\\p{N}\\p{M}]';

/** As partículas não trocam sozinhas: "da" e "de" estão em todo texto. */
const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/**
 * O padrão de um nome, pra casar no texto em NFD (letra e acento separados). Letra com acento no nome aceita qualquer
 * acento ou nenhum ("João" acha "Joao"); letra sem acento só casa sem ("Ana" não acha "Anã"). Separadores viram
 * SEPARADOR, e um apóstrofo casa com o outro.
 */
function padrao(nome: string): string {
  const cs = [...nome.normalize('NFD').trim()];
  let out = '';
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]!;
    if (/\p{M}/u.test(c)) continue;
    if (ehSeparador(c)) {
      if (!out.endsWith(SEPARADOR)) out += SEPARADOR;
    } else if (c === "'" || c === '’') out += "['’]";
    else out += escapar(c) + (/\p{M}/u.test(cs[i + 1] ?? '') ? '\\p{M}*' : '');
  }
  return out;
}

const letras = (s: string) => [...s.normalize('NFD').replace(/\p{M}/gu, '')].filter((c) => /\p{L}/u.test(c)).length;

/** As palavras de um nome que trocam sozinhas: 3 letras ou mais, menos as partículas. */
const palavras = (nome: string) =>
  nome
    .split(new RegExp(SEPARADOR, 'u'))
    .filter((p) => letras(p) >= 3 && !PARTICULAS.has(p.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()));

/** No lugar de quem não é responsável de nenhuma peça: sem número, pra não contar quantas pessoas a empresa tem. */
export const PESSOA = 'Pessoa';

/**
 * Quem o link esconde: os cadastros do tipo Pessoa que as peças usam viram "Pessoa 1", "Pessoa 2"… na ordem em que
 * aparecem nas peças (a ordem do documento não muda entre aberturas e não conta nada do nome, como contaria a ordem
 * alfabética). Pessoa que nenhuma peça usa vira só "Pessoa". Devolve id → o nome que aparece no lugar.
 */
export function pessoasEscondidas(cadastros: readonly Cadastro[], doc: Documento): Map<string, string> {
  const pessoas = new Set(cadastros.filter((k) => k.tipo === 'pessoa').map((k) => k.id));
  const ordem: string[] = [];
  for (const p of doc.pecas) if (p.responsavel && pessoas.has(p.responsavel) && !ordem.includes(p.responsavel)) ordem.push(p.responsavel);
  const nomes = new Map(ordem.map((id, i) => [id, `Pessoa ${i + 1}`]));
  for (const id of pessoas) if (!nomes.has(id)) nomes.set(id, PESSOA);
  return nomes;
}

/**
 * Troca cada nome (inteiro, e cada palavra dele: ver os limites acima) pelo que aparece no lugar. O texto sai em NFC.
 * Os nomes inteiros vêm antes das palavras, e o maior antes do menor: "Ana Paula" antes de "Ana". Quando dois casam
 * igual, fica a primeira troca (a ordem do mapa: os responsáveis das peças primeiro). Cada padrão é um grupo da
 * regex, e o grupo que casou diz qual troca usar. Nome de uma letra só não troca nada (trocaria toda letra solta).
 */
export function trocadorDeNomes(nomes: ReadonlyMap<string, string>): (texto: string) => string {
  const vistos = new Set<string>();
  const lista: { padrao: string; tamanho: number; troca: string }[] = [];
  const pôr = (nome: string, troca: string) => {
    const p = padrao(nome);
    const k = p.toLowerCase();
    if (!p || vistos.has(k)) return;
    vistos.add(k);
    lista.push({ padrao: p, tamanho: [...nome.normalize('NFD').replace(/\p{M}/gu, '')].length, troca });
  };
  const validos = [...nomes].filter(([nome]) => letras(nome) >= 2);
  for (const [nome, troca] of validos) pôr(nome, troca);
  for (const [nome, troca] of validos) for (const p of palavras(nome)) pôr(p, troca);
  // sort é estável: no empate de tamanho, fica a ordem de cima.
  lista.sort((a, b) => b.tamanho - a.tamanho);
  if (lista.length === 0) return (t) => t.normalize('NFC');
  const re = new RegExp(`(?<!${LETRA})(?:${lista.map((n) => `(${n.padrao})`).join('|')})(?!${LETRA})`, 'giu');
  return (t) =>
    t
      .normalize('NFD')
      .replace(re, (achado, ...resto: unknown[]) => {
        const i = resto.findIndex((g, j) => j < lista.length && g !== undefined);
        return i < 0 ? achado : lista[i]!.troca;
      })
      .normalize('NFC');
}

/** Cada texto dentro de um valor (objeto, lista) passa pela troca: os campos de um cadastro são livres. */
function trocarEmTudo(v: unknown, trocar: (t: string) => string): unknown {
  if (typeof v === 'string') return trocar(v);
  if (Array.isArray(v)) return v.map((x) => trocarEmTudo(x, trocar));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trocarEmTudo(x, trocar)]));
  return v;
}

/**
 * O documento sem os nomes: em todo texto livre (nome e descrição da peça, texto no cano, valor da regra, nome do
 * grupo, nota), o nome de cada Pessoa vira o que aparece no lugar.
 */
function semNomes(doc: Documento, trocar: (t: string) => string, cadastros: ReadonlySet<string>): Documento {
  const t = (s: string | undefined) => (s === undefined ? s : trocar(s));
  const sem = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  return {
    formato: doc.formato,
    // Responsável que não é um dos cadastros que vieram (texto solto, apagado, de outra empresa) pode ser um nome: sai.
    pecas: doc.pecas.map((p) => sem({ ...p, nome: trocar(p.nome), descricao: t(p.descricao), responsavel: p.responsavel && cadastros.has(p.responsavel) ? p.responsavel : undefined })),
    // O valor de toda regra: o código de uma opção também é texto que a pessoa escreveu.
    conexoes: doc.conexoes.map((c) => sem({ ...c, rotulo: t(c.rotulo), valor: t(c.valor) })),
    grupos: doc.grupos.map((g) => ({ ...g, nome: trocar(g.nome) })),
    notas: doc.notas.map((n) => ({ ...n, texto: trocar(n.texto) })),
  };
}

/**
 * O retrato do link, montado no servidor (null: o documento não é um journey/2 válido, e o link não abre).
 * Com "esconder nomes", cada cadastro do tipo Pessoa vira "Pessoa N" (sem os campos) e o nome de toda Pessoa da
 * empresa (`pessoas`; quem não está no documento vira só "Pessoa") sai de todo texto livre: do documento, dos outros
 * cadastros, dos nomes dos canais, do nome e da descrição do fluxo, do nome da versão e do cenário e das notas dos
 * intencionais. Nada de quem foi escondido vai pro navegador, nem a lista das pessoas (os limites estão em "Nomes").
 */
export function montarRetrato(l: LinkDoBanco): Retrato | null {
  const lido = lerDocumento(l.documento);
  if (!lido.documento) return null;
  let documento = lido.documento;
  let cadastros = l.cadastros.map((k) => ({ id: k.id, tipo: k.tipo, nome: k.nome, campos: k.campos ?? {} }));
  let trocar = (t: string) => t;
  if (l.esconder_nomes) {
    const escondidas = pessoasEscondidas(cadastros, documento);
    // Os do documento primeiro: o mesmo nome em `pessoas` fica com o número (o trocador guarda a primeira troca).
    const nomes = new Map(cadastros.flatMap((k) => (escondidas.has(k.id) ? [[k.nome, escondidas.get(k.id)!] as const] : [])));
    for (const nome of l.pessoas ?? []) if (typeof nome === 'string' && !nomes.has(nome)) nomes.set(nome, PESSOA);
    trocar = trocadorDeNomes(nomes);
    documento = semNomes(documento, trocar, new Set(cadastros.map((k) => k.id)));
    cadastros = cadastros.map((k) =>
      escondidas.has(k.id) ? { id: k.id, tipo: k.tipo, nome: escondidas.get(k.id)!, campos: {} } : { ...k, nome: trocar(k.nome), campos: trocarEmTudo(k.campos, trocar) as Record<string, unknown> },
    );
  }
  // As chaves dos achados não dependem de nome; o que não é achado deste documento (uma versão fixa antiga) não vai.
  const chaves = new Set(diagnosticar(documento, { cadastros, ...(l.fluxo.meta_s && { meta_s: l.fluxo.meta_s }) }).map((a) => a.chave));
  return {
    empresa: { nome: l.empresa.nome },
    fluxo: { nome: trocar(l.fluxo.nome), canal: l.fluxo.canal, descricao: trocar(l.fluxo.descricao), meta_s: l.fluxo.meta_s },
    versao: l.versao && { numero: l.versao.numero, nome: trocar(l.versao.nome) },
    de: l.versao?.criada_em ?? l.atual?.editado_em ?? '',
    esconderNomes: l.esconder_nomes,
    expiraEm: l.expira_em,
    documento,
    estilo: lerEstilo(l.estilo),
    cadastros,
    canais: l.canais.map(({ chave, nome, cor }) => ({ chave, nome: trocar(nome), cor })),
    intencionais: l.intencionais.filter((i) => chaves.has(i.chave)).map((i) => ({ chave: i.chave, nota: trocar(i.nota) })),
    // Campo a campo: o que mais a cópia guardada tiver não vai.
    cenario: l.cenario && { nome: trocar(l.cenario.nome), inicio: l.cenario.inicio, quando: l.cenario.quando, modo: l.cenario.modo, escolhas: l.cenario.escolhas },
  };
}
```

- [ ] **Passo 5: abrir o link com a chave secreta**

`apps/web/src/lib/link.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { montarRetrato, type LinkDoBanco, type Retrato } from '@/compartilhar/retrato';

export type LinkAberto =
  | { estado: 'ok'; retrato: Retrato }
  | { estado: 'revogado' | 'vencido'; quando: string }
  | { estado: 'inexistente' };

/** O banco gera 24 caracteres de base64 de URL; qualquer outra coisa nem vai pro banco. */
const TOKEN = /^[A-Za-z0-9_-]{24}$/;

/** Se o servidor tem a chave secreta: sem ela, o link público não abre, e criar link é recusado. */
export function linkPublicoConfigurado(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}

/**
 * O link público, pelo token, já como o retrato que a página mostra.
 * É o único lugar do app que usa a chave secreta (SUPABASE_SECRET_KEY): quem abre o link não tem sessão, e a função
 * abrir_link só aceita a service_role. Aqui ela só chama abrir_link; os nomes saem em `montarRetrato`, antes de
 * qualquer coisa ir pro navegador. Um pedido, uma ida ao banco (a página e o título chamam; o cache do React junta).
 */
export const abrirLink = cache(async (token: string): Promise<LinkAberto> => {
  // Cada pedido lê o banco: um link revogado deixa de abrir na hora.
  await connection();
  if (!TOKEN.test(token)) return { estado: 'inexistente' };
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error('SUPABASE_SECRET_KEY não está configurada: o link público precisa dela no servidor');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc('abrir_link', { p_token: token });
  if (error) throw new Error(error.message);
  const r = data as LinkDoBanco | { estado: 'revogado' | 'vencido'; quando: string } | { estado: 'inexistente' };
  if (r.estado !== 'ok') return r;
  const retrato = montarRetrato(r);
  // O banco só confere a forma do documento: um que o lerDocumento recusa não vira página (o erro do link aparece).
  if (!retrato) throw new Error('este link não abre: o documento do fluxo não é um journey/2 válido');
  return { estado: 'ok', retrato };
});
```

- [ ] **Passo 6: rodar e ver passar**

Run: `cd apps/web && npx vitest run test/compartilhar test/lib/link.test.ts test/chave-secreta.test.ts test/banco/links.test.ts && npx tsc --noEmit`
Expected: `Tests  46 passed (46)` (com o Supabase no ar e `SUPABASE_SECRET_KEY` no `.env.local`); `tsc` sem saída.

- [ ] **Passo 7: commit**

```bash
git add apps/web/src/compartilhar apps/web/src/lib/link.ts apps/web/test
git commit -m "compartilhar: o retrato do link sobre o fluxo (pessoas escondidas) e o abrir_link com a chave secreta" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 6: o servidor (leituras e ações)

**Arquivos:**
- Modificar: `apps/web/src/lib/dados.ts`, `apps/web/test/acoes/banco-falso.ts`, `apps/web/test/lib/dados.test.ts`
- Criar: `apps/web/src/acoes/{versoes,cenarios,intencionais,links}.ts` e os testes `apps/web/test/acoes/{versoes,cenarios,intencionais,links}.test.ts`

- [ ] **Passo 1: os testes**

`apps/web/test/acoes/banco-falso.ts` (aceita o filtro `.is`):

```diff
diff --git a/apps/web/test/acoes/banco-falso.ts b/apps/web/test/acoes/banco-falso.ts
index 76adcca..7338b59 100644
--- a/apps/web/test/acoes/banco-falso.ts
+++ b/apps/web/test/acoes/banco-falso.ts
@@ -25,7 +25,7 @@ export function bancoFalso() {
       select: () => q,
       order: () => q,
     };
-    for (const m of ['eq', 'in', 'ilike']) q[m] = (c: string, v: unknown) => (f.filtros.push([c, v]), q);
+    for (const m of ['eq', 'in', 'ilike', 'is']) q[m] = (c: string, v: unknown) => (f.filtros.push([c, v]), q);
     for (const m of ['insert', 'update', 'delete', 'upsert'])
       q[m] = (valores?: unknown) => {
         f.op = m;
```

`apps/web/test/acoes/versoes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bancoFalso } from './banco-falso';

const b = bancoFalso();
vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: b.supabase, usuario: { id: 'u1', email: 'ana@exemplo.com' } }) }));
const { marcarVersao } = await import('@/acoes/versoes');
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('acoes/versoes', () => {
  beforeEach(() => b.limpar());

  it('marca pela função do banco e devolve a versão como a lista mostra', async () => {
    b.quando('rpc.marcar_versao', { data: 3, error: null });
    b.quando('fluxo_versoes.select', { data: { numero: 3, nome: 'antes do horário novo', criada_em: '2026-11-13T10:00:00Z' }, error: null });
    expect(await marcarVersao('e1', 'f1', '  antes do horário novo ')).toEqual({
      versao: { numero: 3, nome: 'antes do horário novo', autor: 'ana@exemplo.com', criada_em: '2026-11-13T10:00:00Z' },
    });
    expect(b.feitas[0]).toMatchObject({ tabela: 'rpc:marcar_versao', valores: { p_fluxo: 'f1', p_nome: 'antes do horário novo' } });
    expect(b.feitas[1]!.filtros).toEqual([['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['numero', 3]]);
  });

  it('nome vazio ou comprido nem vai pro banco', async () => {
    expect(await marcarVersao('e1', 'f1', '   ')).toEqual({ erro: 'O nome da versão vai de 1 a 120 letras.' });
    expect(await marcarVersao('e1', 'f1', 'x'.repeat(121))).toEqual({ erro: 'O nome da versão vai de 1 a 120 letras.' });
    expect(await marcarVersao('e1', 'f1', 7 as unknown as string)).toEqual({ erro: 'O nome da versão vai de 1 a 120 letras.' });
    expect(b.feitas).toEqual([]);
  });

  it('fluxo que sumiu (ou de outra empresa) vira texto pra pessoa', async () => {
    b.quando('rpc.marcar_versao', { error: { code: 'P0002', message: 'fluxo não encontrado' } });
    expect(await marcarVersao('e1', 'f1', 'x')).toEqual({ erro: 'Este fluxo não existe mais.' });
  });
});
```

`apps/web/test/acoes/cenarios.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CenarioNovo } from '@/editor/cenarios';
import { bancoFalso } from './banco-falso';

const b = bancoFalso();
vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: b.supabase }) }));
const { apagarCenario, aprovarCenario, renomearCenario, salvarCenario } = await import('@/acoes/cenarios');
vi.spyOn(console, 'error').mockImplementation(() => {});

const ESPERADO = { caminho: ['i', 'a', 'f'], fim: { motivo: 'fim' as const, peca: 'f' }, tempo_s: 60 };
const NOVO: CenarioNovo = { inicio: 'i', quando: '2026-11-23T10:00', modo: 'relogio', escolhas: ['c2'], esperado: ESPERADO };

describe('acoes/cenarios', () => {
  beforeEach(() => b.limpar());

  it('salva com o nome, o caminho e a revisão; devolve o cenário', async () => {
    const linha = { id: 'k1', nome: 'Paga na hora', ...NOVO, revisao_aprovada: 4, atualizado_em: '2026-11-13T10:00:00Z' };
    b.quando('cenarios.insert', { data: linha, error: null });
    expect(await salvarCenario('e1', 'f1', ' Paga na hora ', NOVO, 4)).toEqual({ cenario: linha });
    expect(b.feitas[0]!.valores).toEqual({ empresa_id: 'e1', fluxo_id: 'f1', nome: 'Paga na hora', ...NOVO, revisao_aprovada: 4 });
  });

  it('o que o banco recusaria é recusado antes, com o motivo', async () => {
    const casos: [string, CenarioNovo, number, string][] = [
      ['  ', NOVO, 4, 'O nome do cenário vai de 1 a 200 letras.'],
      ['x'.repeat(201), NOVO, 4, 'O nome do cenário vai de 1 a 200 letras.'],
      ['ok', { ...NOVO, inicio: '' }, 4, 'O cenário precisa de um Início.'],
      ['ok', { ...NOVO, quando: '23/11/2026 10:00' }, 4, 'A data e hora do cenário não estão no formato certo.'],
      ['ok', { ...NOVO, modo: 'cenario' as never }, 4, 'O modo do cenário é "relógio" ou "livre".'],
      ['ok', { ...NOVO, escolhas: [1] as never }, 4, 'As escolhas do cenário não estão no formato certo.'],
      ['ok', { ...NOVO, esperado: { ...ESPERADO, fim: null } as never }, 4, 'O resultado do cenário não está no formato certo: dá play até o fim e salva de novo.'],
      ['ok', NOVO, -1, 'Revisão inválida.'],
      ['ok', null as never, 4, 'O cenário não está no formato certo.'],
    ];
    for (const [nome, c, rev, erro] of casos) expect(await salvarCenario('e1', 'f1', nome, c, rev), erro).toEqual({ erro });
    expect(b.feitas).toEqual([]);
  });

  it('fluxo que sumiu', async () => {
    b.quando('cenarios.insert', { error: { code: '23503', message: 'fk' } });
    expect(await salvarCenario('e1', 'f1', 'x', NOVO, 0)).toEqual({ erro: 'Este fluxo não existe mais.' });
  });

  it('aprovar o resultado novo: as escolhas aceitas, o esperado e a revisão, só neste fluxo e empresa', async () => {
    const novo = { escolhas: ['c3'], esperado: ESPERADO };
    b.quando('cenarios.update', { data: [{ id: 'k1' }], error: null }, { data: [], error: null });
    expect(await aprovarCenario('e1', 'f1', 'k1', novo, 5)).toEqual({});
    expect(b.feitas[0]).toMatchObject({ valores: { escolhas: ['c3'], esperado: ESPERADO, revisao_aprovada: 5 }, filtros: [['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['id', 'k1']] });
    expect(await aprovarCenario('e1', 'f1', 'k1', novo, 5)).toEqual({ erro: 'Este cenário não existe mais.' });
    expect(await aprovarCenario('e1', 'f1', 'k1', { ...novo, esperado: { ...ESPERADO, tempo_s: -1 } }, 5)).toEqual({ erro: 'O resultado não está no formato certo: dá play até o fim e aprova de novo.' });
    expect(await aprovarCenario('e1', 'f1', 'k1', { ...novo, escolhas: [['c3']] as never }, 5)).toEqual({ erro: 'As escolhas do cenário não estão no formato certo.' });
    expect(await aprovarCenario('e1', 'f1', 'k1', null as never, 5)).toEqual({ erro: 'As escolhas do cenário não estão no formato certo.' });
    expect(b.feitas).toHaveLength(2);
  });

  it('renomear e apagar', async () => {
    expect(await renomearCenario('e1', 'f1', 'k1', '')).toEqual({ erro: 'O nome do cenário vai de 1 a 200 letras.' });
    b.quando('cenarios.update', { data: [{ id: 'k1' }], error: null });
    expect(await renomearCenario('e1', 'f1', 'k1', ' Novo ')).toEqual({});
    expect(b.feitas[0]).toMatchObject({ valores: { nome: 'Novo' }, filtros: [['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['id', 'k1']] });
    b.quando('cenarios.delete', { data: [{ id: 'k1' }], error: null }, { data: [], error: null });
    expect(await apagarCenario('e1', 'f1', 'k1')).toEqual({});
    expect(b.feitas[1]).toMatchObject({ op: 'delete', filtros: [['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['id', 'k1']] });
    expect(await apagarCenario('e1', 'f1', 'k1')).toEqual({ erro: 'Este cenário não existe mais.' });
  });
});
```

`apps/web/test/acoes/intencionais.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bancoFalso } from './banco-falso';

const b = bancoFalso();
vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: b.supabase, usuario: { id: 'u1', email: 'ana@exemplo.com' } }) }));
const { desmarcarIntencional, marcarIntencional } = await import('@/acoes/intencionais');
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('acoes/intencionais', () => {
  beforeEach(() => b.limpar());

  it('marca com a nota (upsert das quatro colunas) e devolve com o e-mail de quem marcou', async () => {
    b.quando('achados_intencionais.upsert', { data: { chave: 'beco_sem_saida:a', nota: 'de propósito', autor: 'u1', criado_em: '2026-11-13T10:00:00Z' }, error: null });
    expect(await marcarIntencional('e1', 'f1', 'beco_sem_saida:a', ' de propósito ')).toEqual({
      intencional: { chave: 'beco_sem_saida:a', nota: 'de propósito', autor: 'ana@exemplo.com', criado_em: '2026-11-13T10:00:00Z' },
    });
    expect(b.feitas[0]).toMatchObject({ op: 'upsert', valores: { empresa_id: 'e1', fluxo_id: 'f1', chave: 'beco_sem_saida:a', nota: 'de propósito' } });
  });

  it('marcar de novo o que outra pessoa marcou: quem marcou continua sendo ela', async () => {
    b.quando('achados_intencionais.upsert', { data: { chave: 'k', nota: 'nova', autor: 'u2', criado_em: '2026-11-12T10:00:00Z' }, error: null });
    b.quando('membros.select', { data: { email: 'caio@exemplo.com' }, error: null });
    expect((await marcarIntencional('e1', 'f1', 'k', 'nova')).intencional?.autor).toBe('caio@exemplo.com');
    expect(b.feitas[1]!.filtros).toEqual([['empresa_id', 'e1'], ['usuario_id', 'u2']]);
  });

  it('chave ou nota fora do que o banco aceita nem vai', async () => {
    expect(await marcarIntencional('e1', 'f1', '', 'x')).toEqual({ erro: 'Achado inválido.' });
    expect(await marcarIntencional('e1', 'f1', 'x'.repeat(2001), 'x')).toEqual({ erro: 'Achado inválido.' });
    expect(await marcarIntencional('e1', 'f1', 'k', 'x'.repeat(5001))).toEqual({ erro: 'A nota vai até 5000 letras.' });
    expect(await marcarIntencional('e1', 'f1', 'k', null as unknown as string)).toEqual({ erro: 'A nota vai até 5000 letras.' });
    expect(b.feitas).toEqual([]);
  });

  it('desmarca só neste fluxo e empresa; já desmarcado também dá certo', async () => {
    expect(await desmarcarIntencional('e1', 'f1', 'k')).toEqual({});
    expect(b.feitas[0]).toMatchObject({ op: 'delete', filtros: [['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['chave', 'k']] });
    b.quando('achados_intencionais.delete', { error: { code: '42501', message: 'rls' } });
    expect(await desmarcarIntencional('e1', 'f1', 'k')).toEqual({ erro: 'Sem acesso a esta empresa.' });
  });
});
```

`apps/web/test/acoes/links.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bancoFalso } from './banco-falso';

const b = bancoFalso();
vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: b.supabase }) }));
// O lib/link de verdade importa server-only e lê a chave; aqui só a resposta importa.
let configurado = true;
vi.mock('@/lib/link', () => ({ linkPublicoConfigurado: () => configurado }));
const { criarLink, revogarLink } = await import('@/acoes/links');

const log = vi.spyOn(console, 'error').mockImplementation(() => {});
const OPCOES = { versao: null, esconderNomes: true, cenarioId: null, validade: 30 };
const CENARIO = { nome: 'E se?', inicio: 'i', quando: '2026-11-23T16:57', modo: 'relogio', escolhas: ['c2'] };
/** A versão 2: Início → decisão (c2 ou c3) → Fim. */
const VERSAO = {
  documento: {
    formato: 'journey/2',
    pecas: [
      { id: 'i', tipo: 'inicio', nome: 'Início', x: 0, y: 0 },
      { id: 'd', tipo: 'decisao', nome: 'Qual?', x: 0, y: 0 },
      { id: 'f', tipo: 'fim', nome: 'Fim', x: 0, y: 0 },
    ],
    conexoes: [
      { id: 'c1', de: 'i', para: 'd', regra: 'sempre' },
      { id: 'c2', de: 'd', para: 'f', regra: 'opcao', valor: '1' },
      { id: 'c3', de: 'd', para: 'f', regra: 'opcao', valor: '2' },
    ],
    grupos: [],
    notas: [],
  },
};
const RESUMO = { id: 'l1', token: 'abcdefghijklmnopqrstuvwx', versao: null, esconder_nomes: true, cenario_nome: null, expira_em: null, revogado_em: null, criado_em: '2026-11-13T10:00:00Z' };

describe('acoes/links', () => {
  beforeEach(() => {
    b.limpar();
    log.mockClear();
    configurado = true;
  });

  it('sem a chave secreta no servidor, nem tenta criar e avisa', async () => {
    configurado = false;
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1' })).toEqual({
      erro: 'Os links públicos ainda não estão configurados neste servidor (falta a chave secreta). Avisa quem cuida do Journey.',
    });
    expect(b.feitas).toEqual([]);
    expect(log).toHaveBeenCalled();
  });

  it('cria o link com as opções e devolve como a lista mostra; a validade vira data', async () => {
    b.quando('links.insert', { data: RESUMO, error: null });
    const antes = Date.now();
    expect(await criarLink('e1', 'f1', OPCOES)).toEqual({ link: RESUMO });
    const v = b.feitas[0]!.valores as { expira_em: string };
    expect(v).toMatchObject({ empresa_id: 'e1', fluxo_id: 'f1', versao: null, esconder_nomes: true, cenario: null });
    expect(new Date(v.expira_em).getTime() - antes).toBeGreaterThanOrEqual(30 * 86_400_000 - 1000);
  });

  it('o cenário inicial é copiado do banco, deste fluxo e desta empresa', async () => {
    b.quando('cenarios.select', { data: CENARIO, error: null });
    b.quando('links.insert', { data: RESUMO, error: null });
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', validade: null })).toEqual({ link: RESUMO });
    expect(b.feitas[0]!.filtros).toEqual([['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['id', 'k1']]);
    expect(b.feitas[1]!.valores).toMatchObject({ cenario: CENARIO, expira_em: null, versao: null });
  });

  it('com versão fixa, o cenário tem que tocar nela (com os Horários da empresa)', async () => {
    b.quando('cenarios.select', { data: CENARIO, error: null });
    b.quando('fluxo_versoes.select', { data: VERSAO, error: null });
    b.quando('cadastros.select', { data: [], error: null });
    b.quando('links.insert', { data: RESUMO, error: null });
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', versao: 2 })).toEqual({ link: RESUMO });
    expect(b.feitas.map((f) => f.tabela)).toEqual(['cenarios', 'fluxo_versoes', 'cadastros', 'links']);
    expect(b.feitas[1]!.filtros).toEqual([['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['numero', 2]]);
    expect(b.feitas[2]!.filtros).toEqual([['empresa_id', 'e1'], ['tipo', 'horario']]);
    expect(b.feitas[3]!.valores).toMatchObject({ cenario: CENARIO, versao: 2 });
  });

  it('cenário que começa numa peça que a versão não tem, ou com escolha que ela não tem: recusa', async () => {
    b.quando('cenarios.select', { data: { ...CENARIO, inicio: 'outro' }, error: null }, { data: { ...CENARIO, escolhas: ['c2', 'c9'] }, error: null }, { data: { ...CENARIO, escolhas: ['c9'] }, error: null });
    b.quando('fluxo_versoes.select', { data: VERSAO, error: null }, { data: VERSAO, error: null }, { data: VERSAO, error: null });
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', versao: 2 })).toEqual({
      erro: 'O cenário “E se?” começa numa peça que não existe na versão 2. Escolhe outra versão ou outro cenário.',
    });
    const naoToca = { erro: 'O cenário “E se?” não toca na versão 2: alguma escolha dele não existe nela. Escolhe outra versão ou outro cenário.' };
    // Uma escolha a mais depois do fim também não serve: o motor não a aceita.
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', versao: 2 })).toEqual(naoToca);
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', versao: 2 })).toEqual(naoToca);
    expect(b.feitas.some((f) => f.tabela === 'links')).toBe(false);
  });

  it('versão que sumiu ou que não abre: recusa antes de criar', async () => {
    b.quando('cenarios.select', { data: CENARIO, error: null }, { data: CENARIO, error: null });
    b.quando('fluxo_versoes.select', { data: null, error: null }, { data: { documento: { formato: 'journey/1' } }, error: null });
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', versao: 2 })).toEqual({ erro: 'Esta versão não existe mais neste fluxo.' });
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1', versao: 2 })).toEqual({ erro: 'A versão 2 não abre: o documento dela não é válido.' });
  });

  it('cenário que sumiu não vira link', async () => {
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 'k1' })).toEqual({ erro: 'Este cenário não existe mais.' });
    expect(b.feitas.map((f) => f.tabela)).toEqual(['cenarios']);
  });

  it('esconder nomes só desliga com false', async () => {
    await criarLink('e1', 'f1', { ...OPCOES, esconderNomes: 'nao' as unknown as boolean });
    expect(b.feitas[0]!.valores).toMatchObject({ esconder_nomes: true });
  });

  it('validade fora da lista, versão e cenário inválidos são recusados antes do banco', async () => {
    expect(await criarLink('e1', 'f1', { ...OPCOES, validade: 1 })).toEqual({ erro: 'Escolhe uma validade da lista.' });
    expect(await criarLink('e1', 'f1', { ...OPCOES, versao: 0 })).toEqual({ erro: 'Versão inválida.' });
    expect(await criarLink('e1', 'f1', { ...OPCOES, versao: 1.5 })).toEqual({ erro: 'Versão inválida.' });
    expect(await criarLink('e1', 'f1', { ...OPCOES, cenarioId: 3 as unknown as string })).toEqual({ erro: 'Cenário inválido.' });
    expect(await criarLink('e1', 'f1', null as never)).toEqual({ erro: 'Opções inválidas.' });
    expect(await criarLink('e1', 'f1', 'x' as never)).toEqual({ erro: 'Opções inválidas.' });
    expect(b.feitas).toEqual([]);
  });

  it('versão que não existe vira texto pra pessoa; sem versão fixa, é o fluxo que sumiu', async () => {
    b.quando('links.insert', { error: { code: '23503', message: 'violates foreign key' } }, { error: { code: '23503', message: 'violates foreign key' } });
    expect(await criarLink('e1', 'f1', { ...OPCOES, versao: 9 })).toEqual({ erro: 'Esta versão não existe mais neste fluxo.' });
    expect(await criarLink('e1', 'f1', OPCOES)).toEqual({ erro: 'Este fluxo não existe mais.' });
    expect(log).toHaveBeenCalled();
  });

  it('revogar marca a data, só se ainda não foi revogado, neste fluxo e empresa; devolve a data do banco', async () => {
    b.quando('links.update', { data: [{ revogado_em: '2026-11-13T10:00:00.123Z' }], error: null });
    expect(await revogarLink('e1', 'f1', 'l1')).toEqual({ revogado_em: '2026-11-13T10:00:00.123Z' });
    expect(b.feitas[0]!.filtros).toEqual([['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['id', 'l1'], ['revogado_em', null]]);
    expect(typeof (b.feitas[0]!.valores as { revogado_em: string }).revogado_em).toBe('string');
  });

  it('revogar de novo avisa', async () => {
    b.quando('links.update', { data: [], error: null });
    expect(await revogarLink('e1', 'f1', 'l1')).toEqual({ erro: 'Este link não existe mais ou já foi revogado.' });
  });
});
```

`apps/web/test/lib/dados.test.ts`:

```diff
diff --git a/apps/web/test/lib/dados.test.ts b/apps/web/test/lib/dados.test.ts
index f724736..1d70dc7 100644
--- a/apps/web/test/lib/dados.test.ts
+++ b/apps/web/test/lib/dados.test.ts
@@ -38,7 +38,7 @@ vi.mock('@/lib/supabase/servidor', () => ({
   supabaseServidor: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: consulta }),
 }));
 
-const { cadastros, empresa, fluxoParaEditar } = await import('@/lib/dados');
+const { cadastros, cenarios, empresa, fluxoParaEditar, intencionais, links, versoes } = await import('@/lib/dados');
 
 const uuidInvalido: Resposta = { data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid: "x"' } };
 
@@ -74,4 +74,52 @@ describe('dados', () => {
       ['range', 2000, 2999],
     ]);
   });
+
+  it('versões: da mais nova pra mais velha, com o e-mail de quem marcou (quem saiu fica null)', async () => {
+    respostas.fluxo_versoes = {
+      data: [
+        { numero: 2, nome: 'depois', autor: 'u1', criada_em: '2026-11-13T10:00:00Z' },
+        { numero: 1, nome: 'antes', autor: 'u-saiu', criada_em: '2026-11-12T10:00:00Z' },
+      ],
+      error: null,
+    };
+    respostas.membros = { data: [{ usuario_id: 'u1', email: 'ana@exemplo.com' }], error: null };
+    expect(await versoes('e1', 'f1')).toEqual([
+      { numero: 2, nome: 'depois', autor: 'ana@exemplo.com', criada_em: '2026-11-13T10:00:00Z' },
+      { numero: 1, nome: 'antes', autor: null, criada_em: '2026-11-12T10:00:00Z' },
+    ]);
+    expect(filtros).toContainEqual(['order', 'numero', { ascending: false }]);
+    expect(filtros).toContainEqual(['eq', 'fluxo_id', 'f1']);
+  });
+
+  it('intencionais: chave, nota, e-mail de quem marcou e data', async () => {
+    respostas.achados_intencionais = {
+      data: [
+        { chave: 'k1', nota: 'de propósito', autor: 'u1', criado_em: '2026-11-12T10:00:00Z' },
+        { chave: 'k2', nota: '', autor: null, criado_em: '2026-11-12T11:00:00Z' },
+      ],
+      error: null,
+    };
+    respostas.membros = { data: [{ usuario_id: 'u1', email: 'ana@exemplo.com' }], error: null };
+    expect(await intencionais('e1', 'f1')).toEqual([
+      { chave: 'k1', nota: 'de propósito', autor: 'ana@exemplo.com', criado_em: '2026-11-12T10:00:00Z' },
+      { chave: 'k2', nota: '', autor: null, criado_em: '2026-11-12T11:00:00Z' },
+    ]);
+  });
+
+  it('cenários e links: só os do fluxo, da empresa, em páginas', async () => {
+    respostas.cenarios = { data: [], error: null };
+    respostas.links = { data: [], error: null };
+    await cenarios('e1', 'f1');
+    await links('e1', 'f1');
+    expect(filtros.filter((f) => f[0] === 'eq')).toEqual([
+      ['eq', 'empresa_id', 'e1'],
+      ['eq', 'fluxo_id', 'f1'],
+      ['eq', 'empresa_id', 'e1'],
+      ['eq', 'fluxo_id', 'f1'],
+    ]);
+    expect(filtros.filter((f) => f[0] === 'range')).toHaveLength(2);
+    // O nome do cenário do link vem da cópia guardada nele.
+    expect(filtros).toContainEqual(['select', 'id, token, versao, esconder_nomes, cenario_nome:cenario->>nome, expira_em, revogado_em, criado_em']);
+  });
 });
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/acoes test/lib/dados.test.ts`
Expected: FAIL nos quatro arquivos novos (`Failed to resolve import "@/acoes/versoes"`…) e nas leituras novas do `dados.test.ts`.

- [ ] **Passo 3: as leituras**

`apps/web/src/lib/dados.ts`:

```diff
diff --git a/apps/web/src/lib/dados.ts b/apps/web/src/lib/dados.ts
index 8f9b083..3c2cf27 100644
--- a/apps/web/src/lib/dados.ts
+++ b/apps/web/src/lib/dados.ts
@@ -2,7 +2,10 @@ import 'server-only';
 import { cache } from 'react';
 import { notFound, redirect } from 'next/navigation';
 import { lerDocumento, type Cadastro, type Documento } from '@journey/fluxo';
+import type { LinkResumo } from '@/compartilhar/opcoes';
 import type { TipoCadastro } from '@/editor/cadastros';
+import type { Cenario } from '@/editor/cenarios';
+import type { Intencional } from '@/editor/diagnostico';
 import type { CanalEditor } from '@/editor/estilo';
 import { supabaseServidor } from './supabase/servidor';
 
@@ -177,3 +180,70 @@ export async function usosDosCadastros(empresaId: string): Promise<Map<string, {
   }
   return m;
 }
+
+// Versões, cenários, intencionais e links de um fluxo (etapa C) ----------------------------------------------------
+
+export interface VersaoResumo {
+  numero: number;
+  nome: string;
+  /** E-mail de quem marcou (null se não é mais membro, ou foi apagado). */
+  autor: string | null;
+  criada_em: string;
+}
+
+/** As versões marcadas do fluxo, da mais nova pra mais velha (sem os documentos). */
+export async function versoes(empresaId: string, fluxoId: string): Promise<VersaoResumo[]> {
+  const { supabase } = await usuarioAtual();
+  const [linhas, emails] = await Promise.all([
+    todas<{ numero: number; nome: string; autor: string | null; criada_em: string }>((de, ate) =>
+      supabase.from('fluxo_versoes').select('numero, nome, autor, criada_em').eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).order('numero', { ascending: false }).range(de, ate),
+    ),
+    emailsDosMembros(empresaId),
+  ]);
+  return linhas.map((l) => ({ ...l, autor: (l.autor && emails.get(l.autor)) ?? null }));
+}
+
+/** Os cenários do fluxo, por nome. A forma do resultado esperado o banco já conferiu (cenarios_esperado). */
+export async function cenarios(empresaId: string, fluxoId: string): Promise<Cenario[]> {
+  const { supabase } = await usuarioAtual();
+  return todas<Cenario>((de, ate) =>
+    supabase
+      .from('cenarios')
+      .select('id, nome, inicio, quando, modo, escolhas, esperado, revisao_aprovada, atualizado_em')
+      .eq('empresa_id', empresaId)
+      .eq('fluxo_id', fluxoId)
+      .order('nome')
+      .order('id')
+      .range(de, ate),
+  );
+}
+
+/** Os achados marcados como intencionais no fluxo, com o e-mail de quem marcou. */
+export async function intencionais(empresaId: string, fluxoId: string): Promise<Intencional[]> {
+  const { supabase } = await usuarioAtual();
+  const [linhas, emails] = await Promise.all([
+    todas<{ chave: string; nota: string; autor: string | null; criado_em: string }>((de, ate) =>
+      supabase.from('achados_intencionais').select('chave, nota, autor, criado_em').eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).order('chave').range(de, ate),
+    ),
+    emailsDosMembros(empresaId),
+  ]);
+  return linhas.map((l) => ({ ...l, autor: (l.autor && emails.get(l.autor)) ?? null }));
+}
+
+/**
+ * Os links do fluxo, do mais novo pro mais velho (vencidos e revogados também: a lista conta o que já foi mandado).
+ * O nome do cenário vem da cópia guardada no link, não do cenário (que pode ter mudado ou sumido).
+ */
+export async function links(empresaId: string, fluxoId: string): Promise<LinkResumo[]> {
+  const { supabase } = await usuarioAtual();
+  return todas<LinkResumo>((de, ate) =>
+    supabase
+      .from('links')
+      .select('id, token, versao, esconder_nomes, cenario_nome:cenario->>nome, expira_em, revogado_em, criado_em')
+      .eq('empresa_id', empresaId)
+      .eq('fluxo_id', fluxoId)
+      .order('criado_em', { ascending: false })
+      .order('id')
+      .range(de, ate),
+  );
+}
```

- [ ] **Passo 4: as ações**

`apps/web/src/acoes/versoes.ts`:

```ts
'use server';

import { usuarioAtual, type VersaoResumo } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

/**
 * Marca uma versão com nome: a foto do documento e do estilo que estão no banco agora (o editor manda o que falta
 * salvar antes de chamar). Devolve a versão como a lista mostra. Sem revalidatePath: a lista de versões só aparece no
 * editor, que acrescenta a versão nova no lugar (refazer a página leria o documento inteiro de novo à toa).
 */
export async function marcarVersao(empresaId: string, fluxoId: string, nome: string): Promise<{ versao?: VersaoResumo; erro?: string }> {
  const n = typeof nome === 'string' ? nome.trim() : '';
  if (!n || n.length > 120) return { erro: 'O nome da versão vai de 1 a 120 letras.' };
  const { supabase, usuario } = await usuarioAtual();
  // A função confere que quem pede é membro da empresa do fluxo; a leitura de volta filtra pela empresa da página.
  const r = await supabase.rpc('marcar_versao', { p_fluxo: fluxoId, p_nome: n });
  if (r.error) return { erro: mensagemDoErro('marcarVersao', r.error, { P0002: 'Este fluxo não existe mais.', '23514': 'O nome da versão vai de 1 a 120 letras.' }) };
  const v = await supabase.from('fluxo_versoes').select('numero, nome, criada_em').eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).eq('numero', r.data as number).single();
  if (v.error) return { erro: mensagemDoErro('marcarVersao', v.error) };
  return { versao: { ...(v.data as Omit<VersaoResumo, 'autor'>), autor: usuario.email ?? null } };
}
```

`apps/web/src/acoes/cenarios.ts`:

```ts
'use server';

import { ehEsperado, type Cenario, type CenarioNovo } from '@/editor/cenarios';
import { quandoValido } from '@/editor/play';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

/*
 * Os cenários só aparecem no editor, que guarda a lista e muda no lugar com o que estas ações devolvem: sem
 * revalidatePath (refazer a página leria o documento inteiro de novo à toa).
 */

const COLUNAS = 'id, nome, inicio, quando, modo, escolhas, esperado, revisao_aprovada, atualizado_em';
const SUMIU = 'Este cenário não existe mais.';

const nomeValido = (nome: unknown): string | null => {
  const n = typeof nome === 'string' ? nome.trim() : '';
  return n && n.length <= 200 ? n : null;
};
const revisaoValida = (r: unknown): r is number => Number.isInteger(r) && (r as number) >= 0;

/** O que o banco confere (cenarios_*), conferido antes: o erro vira um texto que diz o que está errado. */
function conferir(c: CenarioNovo): string | null {
  if (typeof c.inicio !== 'string' || !c.inicio) return 'O cenário precisa de um Início.';
  if (typeof c.quando !== 'string' || !quandoValido(c.quando)) return 'A data e hora do cenário não estão no formato certo.';
  if (c.modo !== 'relogio' && c.modo !== 'livre') return 'O modo do cenário é "relógio" ou "livre".';
  if (!Array.isArray(c.escolhas) || !c.escolhas.every((e) => typeof e === 'string')) return 'As escolhas do cenário não estão no formato certo.';
  if (!ehEsperado(c.esperado)) return 'O resultado do cenário não está no formato certo: dá play até o fim e salva de novo.';
  return null;
}

/** Salva o caminho do play como cenário, com o resultado aprovado na revisão do fluxo de agora. */
export async function salvarCenario(empresaId: string, fluxoId: string, nome: string, c: CenarioNovo, revisao: number): Promise<{ cenario?: Cenario; erro?: string }> {
  const n = nomeValido(nome);
  if (!n) return { erro: 'O nome do cenário vai de 1 a 200 letras.' };
  const problema = c && typeof c === 'object' ? conferir(c) : 'O cenário não está no formato certo.';
  if (problema) return { erro: problema };
  if (!revisaoValida(revisao)) return { erro: 'Revisão inválida.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase
    .from('cenarios')
    .insert({ empresa_id: empresaId, fluxo_id: fluxoId, nome: n, inicio: c.inicio, quando: c.quando, modo: c.modo, escolhas: c.escolhas, esperado: c.esperado, revisao_aprovada: revisao })
    .select(COLUNAS)
    .single();
  if (r.error) return { erro: mensagemDoErro('salvarCenario', r.error, { '23503': 'Este fluxo não existe mais.', '23514': 'O cenário não está no formato certo.' }) };
  return { cenario: r.data as Cenario };
}

/**
 * O fluxo mudou e o resultado novo é o certo: ele passa a ser o esperado, aprovado nesta revisão, com as escolhas que
 * o motor aceitou (`paraAprovar`). Só o resultado deixaria uma escolha que não serve mais, e o cenário seguiria "mudou".
 */
export async function aprovarCenario(empresaId: string, fluxoId: string, id: string, novo: Pick<Cenario, 'escolhas' | 'esperado'>, revisao: number): Promise<{ erro?: string }> {
  if (!novo || typeof novo !== 'object' || !Array.isArray(novo.escolhas) || !novo.escolhas.every((e) => typeof e === 'string'))
    return { erro: 'As escolhas do cenário não estão no formato certo.' };
  if (!ehEsperado(novo.esperado)) return { erro: 'O resultado não está no formato certo: dá play até o fim e aprova de novo.' };
  if (!revisaoValida(revisao)) return { erro: 'Revisão inválida.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase
    .from('cenarios')
    .update({ escolhas: novo.escolhas, esperado: novo.esperado, revisao_aprovada: revisao })
    .eq('empresa_id', empresaId)
    .eq('fluxo_id', fluxoId)
    .eq('id', id)
    .select('id');
  if (r.error) return { erro: mensagemDoErro('aprovarCenario', r.error, { '23514': 'O cenário não está no formato certo.' }) };
  if (!r.data?.length) return { erro: SUMIU };
  return {};
}

export async function renomearCenario(empresaId: string, fluxoId: string, id: string, nome: string): Promise<{ erro?: string }> {
  const n = nomeValido(nome);
  if (!n) return { erro: 'O nome do cenário vai de 1 a 200 letras.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('cenarios').update({ nome: n }).eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).eq('id', id).select('id');
  if (r.error) return { erro: mensagemDoErro('renomearCenario', r.error) };
  if (!r.data?.length) return { erro: SUMIU };
  return {};
}

export async function apagarCenario(empresaId: string, fluxoId: string, id: string): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('cenarios').delete().eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).eq('id', id).select('id');
  if (r.error) return { erro: mensagemDoErro('apagarCenario', r.error) };
  if (!r.data?.length) return { erro: SUMIU };
  return {};
}
```

`apps/web/src/acoes/intencionais.ts`:

```ts
'use server';

import { LIMITES } from '@journey/fluxo';
import type { Intencional } from '@/editor/diagnostico';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

/*
 * Os intencionais só aparecem no editor (e, só com chave e nota, no link), que muda a lista no lugar com o que estas
 * ações devolvem: sem revalidatePath.
 */

/** O limite da coluna (achados_intencionais.chave): o diagnóstico resume a chave comprida bem antes disso. */
const CHAVE_MAXIMA = 2000;

/**
 * Marca o achado como intencional, com a nota; marcar de novo troca a nota (quem marcou e quando ficam os da
 * primeira vez). Devolve o intencional como a lista mostra.
 */
export async function marcarIntencional(empresaId: string, fluxoId: string, chave: string, nota: string): Promise<{ intencional?: Intencional; erro?: string }> {
  if (typeof chave !== 'string' || !chave || chave.length > CHAVE_MAXIMA) return { erro: 'Achado inválido.' };
  if (typeof nota !== 'string' || nota.length > LIMITES.texto) return { erro: `A nota vai até ${LIMITES.texto} letras.` };
  const { supabase, usuario } = await usuarioAtual();
  // As quatro colunas: o upsert do PostgREST põe todas as enviadas no "do update set" (a migração dá o grant das quatro).
  const r = await supabase
    .from('achados_intencionais')
    .upsert({ empresa_id: empresaId, fluxo_id: fluxoId, chave, nota: nota.trim() }, { onConflict: 'fluxo_id,chave' })
    .select('chave, nota, autor, criado_em')
    .single();
  if (r.error) return { erro: mensagemDoErro('marcarIntencional', r.error, { '23503': 'Este fluxo não existe mais.' }) };
  const linha = r.data as { chave: string; nota: string; autor: string | null; criado_em: string };
  let autor: string | null = null;
  if (linha.autor === usuario.id) autor = usuario.email ?? null;
  else if (linha.autor) {
    // Quem marcou primeiro foi outra pessoa: o e-mail dela, se ainda é membro.
    const m = await supabase.from('membros').select('email').eq('empresa_id', empresaId).eq('usuario_id', linha.autor).maybeSingle();
    if (m.error) mensagemDoErro('marcarIntencional: autor', m.error);
    autor = (m.data as { email: string } | null)?.email ?? null;
  }
  return { intencional: { ...linha, autor } };
}

/** Desmarca. Já desmarcado (por outra pessoa, noutra aba) também é sucesso: o achado volta a ficar aberto. */
export async function desmarcarIntencional(empresaId: string, fluxoId: string, chave: string): Promise<{ erro?: string }> {
  if (typeof chave !== 'string' || !chave) return { erro: 'Achado inválido.' };
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('achados_intencionais').delete().eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).eq('chave', chave);
  if (r.error) return { erro: mensagemDoErro('desmarcarIntencional', r.error) };
  return {};
}
```

`apps/web/src/acoes/links.ts`:

```ts
'use server';

import { lerDocumento, type Cadastro } from '@journey/fluxo';
import { ehValidade, expiraEm, type LinkResumo } from '@/compartilhar/opcoes';
import type { CenarioDoLink } from '@/compartilhar/retrato';
import { playDoCenario } from '@/editor/cenarios';
import { rodar } from '@/editor/play';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';
import { linkPublicoConfigurado } from '@/lib/link';

/*
 * Os links só aparecem no "Compartilhar" do editor, que muda a lista no lugar com o que estas ações devolvem:
 * sem revalidatePath.
 */

/** O que a pessoa escolhe no "Compartilhar". */
export interface OpcoesLink {
  /** null: o fluxo de agora. Número: uma versão marcada. */
  versao: number | null;
  esconderNomes: boolean;
  /** O cenário salvo que toca quando o link abre (copiado pro link agora). */
  cenarioId: string | null;
  /** Dias, ou null sem prazo (só os de VALIDADES). */
  validade: number | null;
}

const RESUMO = 'id, token, versao, esconder_nomes, cenario_nome:cenario->>nome, expira_em, revogado_em, criado_em';

type Supabase = Awaited<ReturnType<typeof usuarioAtual>>['supabase'];

/**
 * Com versão fixa, o cenário tem que tocar nela: o Início dele existe na versão e cada escolha guardada serve (o motor
 * aceita todas). Senão quem abre o link veria o play parar no começo ou numa pergunta que o cenário não responde.
 * Os Horários da empresa entram porque, no modo relógio, é o horário que decide algumas saídas.
 * Devolve o motivo da recusa, ou null. (Sem versão fixa, o link mostra o fluxo de agora, que ainda vai mudar.)
 */
async function cenarioNaVersao(supabase: Supabase, empresaId: string, fluxoId: string, versao: number, cenario: CenarioDoLink): Promise<string | null> {
  const v = await supabase.from('fluxo_versoes').select('documento').eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).eq('numero', versao).maybeSingle();
  if (v.error) return mensagemDoErro('criarLink', v.error);
  if (!v.data) return 'Esta versão não existe mais neste fluxo.';
  const doc = lerDocumento((v.data as { documento: unknown }).documento).documento;
  if (!doc) return `A versão ${versao} não abre: o documento dela não é válido.`;
  if (!doc.pecas.some((p) => p.id === cenario.inicio)) return `O cenário “${cenario.nome}” começa numa peça que não existe na versão ${versao}. Escolhe outra versão ou outro cenário.`;
  const h = await supabase.from('cadastros').select('id, tipo, nome, campos').eq('empresa_id', empresaId).eq('tipo', 'horario');
  if (h.error) return mensagemDoErro('criarLink', h.error);
  const x = rodar(doc, { cadastros: (h.data ?? []) as Cadastro[], canal: null }, playDoCenario(cenario));
  if (x.escolhas.length !== cenario.escolhas.length) return `O cenário “${cenario.nome}” não toca na versão ${versao}: alguma escolha dele não existe nela. Escolhe outra versão ou outro cenário.`;
  return null;
}

/**
 * Cria o link e devolve como a lista mostra (com o token). O cenário inicial é copiado do banco (não do navegador)
 * pra dentro do link. O token, o autor e as datas são do banco; o membro só manda as opções.
 * Sem a chave secreta no servidor o link não abriria pra ninguém: nem cria.
 */
export async function criarLink(empresaId: string, fluxoId: string, o: OpcoesLink): Promise<{ link?: LinkResumo; erro?: string }> {
  if (!linkPublicoConfigurado()) {
    console.error('[criarLink] a chave secreta do Supabase não está configurada neste servidor: o link público não abriria');
    return { erro: 'Os links públicos ainda não estão configurados neste servidor (falta a chave secreta). Avisa quem cuida do Journey.' };
  }
  if (!o || typeof o !== 'object') return { erro: 'Opções inválidas.' };
  if (!ehValidade(o.validade)) return { erro: 'Escolhe uma validade da lista.' };
  if (o.versao !== null && !(Number.isInteger(o.versao) && o.versao > 0)) return { erro: 'Versão inválida.' };
  if (o.cenarioId !== null && typeof o.cenarioId !== 'string') return { erro: 'Cenário inválido.' };
  const { supabase } = await usuarioAtual();
  let cenario: CenarioDoLink | null = null;
  if (o.cenarioId) {
    const c = await supabase.from('cenarios').select('nome, inicio, quando, modo, escolhas').eq('empresa_id', empresaId).eq('fluxo_id', fluxoId).eq('id', o.cenarioId).maybeSingle();
    if (c.error) return { erro: mensagemDoErro('criarLink', c.error) };
    if (!c.data) return { erro: 'Este cenário não existe mais.' };
    cenario = c.data as CenarioDoLink;
    if (o.versao !== null) {
      const problema = await cenarioNaVersao(supabase, empresaId, fluxoId, o.versao, cenario);
      if (problema) return { erro: problema };
    }
  }
  const r = await supabase
    .from('links')
    .insert({ empresa_id: empresaId, fluxo_id: fluxoId, versao: o.versao, esconder_nomes: o.esconderNomes !== false, cenario, expira_em: expiraEm(o.validade, new Date()) })
    .select(RESUMO)
    .single();
  // 23503 é a FK: com versão fixa, é a versão; sem ela, só pode ser o fluxo.
  if (r.error) return { erro: mensagemDoErro('criarLink', r.error, { '23503': o.versao !== null ? 'Esta versão não existe mais neste fluxo.' : 'Este fluxo não existe mais.' }) };
  return { link: r.data as LinkResumo };
}

/** Revoga pra sempre: quem abrir depois vê a página de link revogado. Devolve a data, que é a do banco. */
export async function revogarLink(empresaId: string, fluxoId: string, linkId: string): Promise<{ revogado_em?: string; erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase
    .from('links')
    .update({ revogado_em: new Date().toISOString() })
    .eq('empresa_id', empresaId)
    .eq('fluxo_id', fluxoId)
    .eq('id', linkId)
    .is('revogado_em', null)
    .select('revogado_em');
  if (r.error) return { erro: mensagemDoErro('revogarLink', r.error) };
  const linha = (r.data as { revogado_em: string }[] | null)?.[0];
  if (!linha) return { erro: 'Este link não existe mais ou já foi revogado.' };
  return { revogado_em: linha.revogado_em };
}
```

- [ ] **Passo 5: rodar e ver passar**

Run: `cd apps/web && npx vitest run test/acoes test/lib/dados.test.ts && npx tsc --noEmit`
Expected: `Tests  43 passed (43)`; `tsc` sem saída.

- [ ] **Passo 6: commit**

```bash
git add apps/web/src/lib/dados.ts apps/web/src/acoes apps/web/test
git commit -m "servidor: versões, cenários, intencionais e links do fluxo" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 7: as telas do editor (play num hook, diagnóstico, cenários, versões, compartilhar)

**Arquivos:**
- Criar: `apps/web/e2e/diagnostico.spec.ts`, `apps/web/e2e/cenarios.spec.ts`
- Criar: `apps/web/src/componentes/editor/{usePlay.ts,useAnuncioAdiado.ts,Pop.tsx,Confirmacao.tsx,Gaveta.tsx,Cenarios.tsx,Versoes.tsx,Compartilhar.tsx}`
- Modificar: `apps/web/src/componentes/editor/{CartaoPlay.tsx,Pecas.tsx,Quadro.tsx}`, `apps/web/src/app/e/[empresa]/f/[fluxo]/page.tsx`
- Substituir: `apps/web/src/componentes/editor/Editor.tsx`, `apps/web/src/componentes/editor/editor.css`

- [ ] **Passo 1: os testes de ponta a ponta**

`apps/web/e2e/diagnostico.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const peca = (page: Page, nome: string) => page.getByRole('button', { name: new RegExp(`: ${esc(nome)}$`) });
const salvo = (page: Page) => expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });

test('diagnóstico: um beco aparece, ver no quadro, simular até aqui, marcar como intencional e desmarcar', async ({ page, request }) => {
  test.setTimeout(120_000);
  await entrar(page, request, emailNovo('diagnostico'));
  await page.getByLabel('Nome da empresa').fill('Empresa do diagnóstico');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('button', { name: /SAC por e-mail/ }).click();
  await expect(page).toHaveURL(/\/f\//);
  await salvo(page);
  const botao = page.getByTestId('botao-diagnostico');
  await expect(botao).toHaveText('sem achados');

  // Uma etapa nova depois da Triagem, sem saída: um beco.
  await peca(page, 'Triagem').hover();
  await page.getByRole('button', { name: 'Criar a próxima etapa ligada a Triagem' }).click();
  await page.getByRole('menuitem', { name: 'Etapa', exact: true }).click();
  await page.getByLabel('Nome da peça').fill('Beco do teste');
  await page.getByLabel('Nome da peça').press('Enter');
  await salvo(page);
  await expect(botao).toHaveText('1 achado');

  await botao.click();
  const gaveta = page.getByRole('region', { name: 'Diagnóstico' });
  const achado = gaveta.getByRole('listitem').filter({ hasText: 'Beco do teste não tem saída' });
  await expect(achado).toContainText('Grave');
  await page.keyboard.press('Escape');
  await achado.getByRole('button', { name: 'Ver no quadro' }).click();
  await expect(peca(page, 'Beco do teste')).toHaveAttribute('aria-pressed', 'true');

  await achado.getByRole('button', { name: 'Simular até aqui' }).click();
  const sim = page.getByRole('region', { name: 'Simulação' });
  await expect(sim.locator('.pergunta')).toHaveText('Beco do teste', { timeout: 20_000 });
  await sim.getByRole('button', { name: 'Parar' }).first().click();

  await achado.getByRole('button', { name: 'Marcar como intencional' }).click();
  await gaveta.getByLabel('Por que é de propósito? (opcional)').fill('ainda vai ganhar saída');
  await gaveta.getByRole('button', { name: 'Marcar', exact: true }).click();
  await expect(botao).toHaveText('sem achados');
  await expect(gaveta.getByText('Intencionais (1)')).toBeVisible();
  await expect(gaveta.getByText('“ainda vai ganhar saída”')).toBeVisible();

  // Recarregar: a marcação veio do banco, e a gaveta lembra que estava aberta.
  await page.reload();
  await expect(page.getByTestId('botao-diagnostico')).toHaveText('sem achados');
  await expect(page.getByRole('region', { name: 'Diagnóstico' }).getByText('Intencionais (1)')).toBeVisible();
  await page.getByRole('region', { name: 'Diagnóstico' }).getByRole('button', { name: 'Desmarcar' }).click();
  await expect(page.getByTestId('botao-diagnostico')).toHaveText('1 achado');
});
```

`apps/web/e2e/cenarios.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

const salvo = (page: Page) => expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });

test('cenário: salvo no fim do play; o fluxo muda e ele diz "mudou"; aprovar o novo volta pra "igual"', async ({ page, request }) => {
  test.setTimeout(120_000);
  await entrar(page, request, emailNovo('cenarios'));
  await page.getByLabel('Nome da empresa').fill('Empresa dos cenários');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('button', { name: /SAC por e-mail/ }).click();
  await expect(page).toHaveURL(/\/f\//);
  await salvo(page);

  await page.getByRole('button', { name: 'Dar play' }).click();
  const sim = page.getByRole('region', { name: 'Simulação' });
  await sim.getByRole('button', { name: /cliente confirmou/ }).click({ timeout: 20_000 });
  await expect(page.getByTestId('fim')).toContainText('Chegou em: Resolvido', { timeout: 20_000 });
  await sim.getByRole('button', { name: 'Salvar cenário' }).click();
  await sim.getByLabel('Nome do cenário').fill('Cliente confirma');
  await sim.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cenários (1)' })).toBeVisible();
  await sim.getByRole('button', { name: 'Fechar' }).click();

  await page.getByRole('button', { name: 'Cenários (1)' }).click();
  const pop = page.getByRole('dialog', { name: 'Cenários' });
  const item = pop.getByTestId('cenario').filter({ hasText: 'Cliente confirma' });
  await expect(item).toContainText('igual');
  await pop.getByRole('button', { name: 'Fechar' }).click();

  // A resposta automática passa a levar 30 s: o mesmo caminho dá outro tempo. (A câmera seguiu a água: volta pro todo.)
  await page.getByRole('button', { name: 'Ver o fluxo inteiro' }).click();
  await page.getByRole('button', { name: 'Mensagem: Resposta automática com protocolo' }).click();
  await page.getByLabel('Tempo nesta peça (pra simulação): quantidade').fill('30');
  await page.getByLabel('Tempo nesta peça (pra simulação): quantidade').press('Tab');
  await salvo(page);
  await page.getByRole('button', { name: 'Cenários (1)' }).click();
  await expect(item).toContainText('mudou');
  await item.getByRole('button', { name: 'Aprovar o novo' }).click();
  await expect(item).toContainText('igual');

  // Tocar: o play refaz o caminho até o fim.
  await item.getByRole('button', { name: 'Tocar' }).click();
  await expect(page.getByTestId('fim')).toContainText('Chegou em: Resolvido', { timeout: 20_000 });

  // Depois de recarregar, o cenário continua aprovado.
  await page.reload();
  await page.getByRole('button', { name: 'Cenários (1)' }).click();
  await expect(page.getByRole('dialog', { name: 'Cenários' }).getByTestId('cenario')).toContainText('igual');
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd apps/web && npx playwright test e2e/diagnostico.spec.ts e2e/cenarios.spec.ts --trace=off`
Expected: FAIL nos dois (não há botão de achados nem de cenários).

- [ ] **Passo 3: o play num hook**

`apps/web/src/componentes/editor/usePlay.ts`:

```ts
'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Documento } from '@journey/fluxo';
import { agora, espera, opcaoDaTecla, rodar, visual as verVisual, voltar as voltarPlay, type Contexto, type Play } from '@/editor/play';
import type { QuadroApi } from './Quadro';

export interface OpcoesPlay {
  /** O documento de agora: o play tira uma cópia dele ao começar (mexer no desenho não muda o play em andamento). */
  doc: Documento;
  ctx: Contexto;
  velocidade: number;
  /** Segundos até seguir sozinho pela primeira opção; 0 é nunca. */
  autoEscolha: number;
  camera: boolean;
  quadro: RefObject<QuadroApi | null>;
  avisar: (texto: string) => void;
  /** Chamado ao começar um play (o editor fecha o campo de nome aberto). */
  aoComecar?: () => void;
}

/**
 * A máquina do play, sem tela: o editor e a página do link usam a mesma. O motor roda tudo de uma vez a partir das
 * escolhas (`rodar`); a tela mostra os eventos um a um (`mostrados`), com a água correndo nos canos.
 */
export function usePlay(o: OpcoesPlay) {
  const [play, setPlay] = useState<Play | null>(null);
  const [docPlay, setDocPlay] = useState<Documento>(o.doc);
  const [mostrados, setMostrados] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [escolhendoInicio, setEscolhendoInicio] = useState<string[] | null>(null);
  // "Simular até aqui": a água para (pausa) quando chega nesta peça pela primeira vez.
  const [pararEm, setPararEm] = useState<string | null>(null);
  const exec = useMemo(() => (play ? rodar(docPlay, o.ctx, play) : null), [play, docPlay, o.ctx]);
  const vis = useMemo(() => (exec ? verVisual(exec.eventos, mostrados) : null), [exec, mostrados]);

  const parar = () => {
    setPlay(null);
    setMostrados(0);
    setEscolhendoInicio(null);
    setPararEm(null);
  };

  /** Toca um play pronto (cenário, "simular até aqui", o cenário inicial do link), do começo, com a água andando. */
  const tocar = (p: Play, ate: string | null = null) => {
    setDocPlay(o.doc);
    setPlay(p);
    setMostrados(0);
    setPausado(false);
    setEscolhendoInicio(null);
    setPararEm(ate);
    o.aoComecar?.();
  };

  const comecarEm = (inicio: string) => tocar({ inicio, quando: play?.quando ?? agora(), modo: play?.modo ?? 'relogio', escolhas: [] });

  /** Dá play no Início selecionado, no único, ou pergunta por qual começar. */
  const darPlay = (selecionado: string | null) => {
    const inicios = o.doc.pecas.filter((p) => p.tipo === 'inicio').map((p) => p.id);
    if (selecionado && inicios.includes(selecionado)) return comecarEm(selecionado);
    if (!inicios.length) return o.avisar('Cria uma peça Início pra dar play.');
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
    const t = setTimeout(() => setMostrados((m) => m + 1), e / o.velocidade);
    return () => clearTimeout(t);
  }, [exec, mostrados, pausado, o.velocidade]);

  // "Simular até aqui": chegou na peça, pausa (dá pra continuar dali).
  useEffect(() => {
    if (!pararEm || vis?.atual !== pararEm) return;
    setPausado(true);
    setPararEm(null);
  }, [vis?.atual, pararEm]);

  // A água que chegou é a do evento `i`: um aviso repetido (ou atrasado, de um cano que já passou) não pula evento.
  const aguaChegou = (i: number) => setMostrados((m) => (m === i ? m + 1 : m));

  const escolher = (conexao: string) => {
    if (!play || !exec?.pendente?.opcoes.some((x) => x.conexao === conexao)) return;
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
    setMostrados(rodar(docPlay, o.ctx, p).eventos.length);
    setPausado(false);
  };

  const recomecar = () => {
    if (!play) return;
    setPlay({ ...play, escolhas: [] });
    setMostrados(0);
    setPausado(false);
  };

  const mudarQuando = (q: string) => {
    if (!play) return;
    setPlay({ ...play, quando: q, escolhas: [] });
    setMostrados(0);
  };

  const mudarRelogio = (decide: boolean) => {
    if (!play) return;
    setPlay({ ...play, modo: decide ? 'relogio' : 'livre', escolhas: [] });
    setMostrados(0);
  };

  // Escolha automática (pra apresentar) e câmera seguindo a água.
  const escolherRef = useRef(escolher);
  escolherRef.current = escolher;
  useEffect(() => {
    if (!vis?.pergunta || pausado || !o.autoEscolha) return;
    const primeira = vis.pergunta.opcoes[0]!.conexao;
    const t = setTimeout(() => escolherRef.current(primeira), o.autoEscolha * 1000);
    return () => clearTimeout(t);
  }, [vis?.pergunta, pausado, o.autoEscolha]);

  useEffect(() => {
    if (!vis?.atual || !o.camera) return;
    const destinos = docPlay.conexoes.filter((c) => c.de === vis.atual).map((c) => c.para);
    o.quadro.current?.enquadrar([vis.atual, ...destinos]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis?.atual, o.camera, docPlay]);

  /** Tecla com a pergunta na tela: o código de uma opção ou a posição. Devolve se tratou. */
  const tecla = (e: KeyboardEvent): boolean => {
    if (!vis?.pergunta || e.ctrlKey || e.metaKey) return false;
    const valores = new Map(docPlay.conexoes.map((c) => [c.id, c.valor]));
    const x = opcaoDaTecla(vis.pergunta.opcoes, e.key, valores);
    if (!x) return false;
    e.preventDefault();
    escolher(x.conexao);
    return true;
  };

  return {
    play,
    docPlay,
    exec,
    vis,
    mostrados,
    pausado,
    escolhendoInicio,
    /** Está tocando ou perguntando por onde começar. */
    ativo: !!play || !!escolhendoInicio,
    tocar,
    comecarEm,
    darPlay,
    parar,
    escolher,
    voltar,
    recomecar,
    pausar: () => setPausado((p) => !p),
    aguaChegou: () => aguaChegou(mostrados),
    mudarQuando,
    mudarRelogio,
    tecla,
  };
}

export type PlayDaTela = ReturnType<typeof usePlay>;
```

- [ ] **Passo 4: peças pequenas**

`apps/web/src/componentes/editor/useAnuncioAdiado.ts`:

```ts
'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * O texto pra uma região viva, só depois que ele parou de mudar por `ms` (digitar um nome muda o diagnóstico a cada
 * tecla: o leitor de tela ouve só o resultado). O texto do primeiro desenho não é anunciado: a região começa vazia.
 */
export function useAnuncioAdiado(texto: string, ms = 1500): string {
  const [anuncio, setAnuncio] = useState('');
  // Comparar com o último anunciado (e não "pular o primeiro efeito"): no modo estrito o efeito roda duas vezes ao montar.
  const ultimo = useRef(texto);
  useEffect(() => {
    if (texto === ultimo.current) return;
    const t = setTimeout(() => {
      ultimo.current = texto;
      setAnuncio(texto);
    }, ms);
    return () => clearTimeout(t);
  }, [texto, ms]);
  return anuncio;
}
```

`apps/web/src/componentes/editor/Pop.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { Icone } from '@/componentes/Icone';

/**
 * Um painel que abre embaixo de um botão do topo (Cenários, Versões). Ao abrir, o foco vai pro primeiro controle;
 * Esc ou "Fechar" fecham e devolvem o foco pro botão que abriu (`voltarPara`). Clicar fora (menos no próprio botão,
 * que já alterna) também fecha, sem mexer no foco: quem clicou foi pra outro lugar.
 */
export function Pop({ titulo, voltarPara, aoFechar, children }: { titulo: string; voltarPara: React.RefObject<HTMLElement | null>; aoFechar: () => void; children: React.ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;
  useEffect(() => {
    caixa.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (caixa.current?.contains(alvo) || voltarPara.current?.contains(alvo)) return;
      fecharRef.current();
    };
    // Esc com o foco fora do pop (no body, depois de um item sumir): o pop fecha do mesmo jeito.
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || caixa.current?.contains(e.target as Node) || (e.target as Element | null)?.closest?.('dialog, input, textarea, select')) return;
      fecharRef.current();
      voltarPara.current?.focus();
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [voltarPara]);
  const fechar = () => {
    aoFechar();
    voltarPara.current?.focus();
  };
  return (
    <div
      ref={caixa}
      className="pop"
      role="dialog"
      aria-label={titulo}
      // Pra receber o foco quando o item em que ele estava some (apagar um cenário): o Esc continua fechando.
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        // Esc é do pop: não chega no atalho do editor (que soltaria a seleção).
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        fechar();
      }}
    >
      <div className="pop-cab">
        <h2>{titulo}</h2>
        <button className="bi" type="button" aria-label="Fechar" onClick={fechar}>
          <Icone nome="fechar" />
        </button>
      </div>
      {children}
    </div>
  );
}
```

`apps/web/src/componentes/editor/Confirmacao.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';

/**
 * Os dois botões de uma confirmação no lugar (apagar, revogar, restaurar). A escolha segura vem primeiro e recebe o
 * foco: o segundo clique de um duplo clique no botão que abriu a confirmação cai nela, e não na que confirma. E os
 * dois ignoram o clique que já é o segundo (`detail` > 1); pelo teclado o `detail` é 0 e vale.
 */
export function Confirmacao({ nao, sim, aoCancelar, aoConfirmar }: { nao: string; sim: string; aoCancelar: () => void; aoConfirmar: () => void }) {
  const seguro = useRef<HTMLButtonElement>(null);
  useEffect(() => seguro.current?.focus(), []);
  return (
    <>
      <button ref={seguro} className="botao pequeno" type="button" onClick={(e) => e.detail <= 1 && aoCancelar()}>
        {nao}
      </button>
      <button className="botao pequeno perigo" type="button" onClick={(e) => e.detail <= 1 && aoConfirmar()}>
        {sim}
      </button>
    </>
  );
}

/** Foca um elemento depois do próximo desenho (o botão que volta a aparecer, a lista que sobrou). */
export const focarDepois = (achar: () => HTMLElement | null | undefined) => requestAnimationFrame(() => achar()?.focus());
```

- [ ] **Passo 5: a gaveta do diagnóstico**

`apps/web/src/componentes/editor/Gaveta.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import type { Achado } from '@journey/fluxo';
import { Icone } from '@/componentes/Icone';
import { GRAVIDADES, type Intencional } from '@/editor/diagnostico';
import { FUSO } from '@/lib/fuso';
import { focarDepois } from './Confirmacao';

export interface AcoesGaveta {
  verNoQuadro(a: Achado): void;
  simularAte(a: Achado): void;
  marcar(chave: string, nota: string): Promise<boolean>;
  desmarcar(chave: string): void;
}

const dataCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * O diagnóstico ao vivo, numa gaveta em cima do quadro: os achados abertos, os marcados como intencionais (com a nota,
 * quem e quando) e os antigos (marcações de achados que o documento não tem mais). Só leitura: vê, mostra no quadro e
 * simula; não marca nem desmarca.
 */
export function Gaveta({
  id,
  abertos,
  intencionais,
  antigos,
  marcas,
  podeSimular,
  soLeitura,
  acoes,
}: {
  id: string;
  abertos: readonly Achado[];
  intencionais: readonly Achado[];
  antigos: readonly Pick<Intencional, 'chave' | 'nota'>[];
  /** A marcação de cada achado intencional (nota, quem, quando), pela chave. */
  marcas: ReadonlyMap<string, Pick<Intencional, 'nota' | 'autor' | 'criado_em'>>;
  podeSimular: (a: Achado) => boolean;
  soLeitura: boolean;
  acoes: AcoesGaveta;
}) {
  return (
    <section className="gaveta" id={id} aria-label="Diagnóstico" tabIndex={-1}>
      {abertos.length === 0 ? (
        <p className="dica">Nenhum problema aberto neste fluxo.</p>
      ) : (
        <ul className="achados">
          {abertos.map((a) => (
            <ItemAchado key={a.chave} a={a} podeSimular={podeSimular(a)} soLeitura={soLeitura} acoes={acoes} />
          ))}
        </ul>
      )}
      {intencionais.length > 0 && (
        <details className="det" open>
          <summary>Intencionais ({intencionais.length})</summary>
          <ul className="achados">
            {intencionais.map((a) => {
              const m = marcas.get(a.chave);
              return (
                <li key={a.chave} className="achado intencional">
                  <div className="achado-titulo">{a.titulo}</div>
                  {m?.nota && <p className="nota-intencional">“{m.nota}”</p>}
                  {m && (m.autor || m.criado_em) && (
                    <small className="mudo">
                      {[m.autor && `marcado por ${m.autor}`, m.criado_em && `em ${dataCurta.format(new Date(m.criado_em))}`].filter(Boolean).join(' ')}
                    </small>
                  )}
                  <div className="acoes-achado">
                    <button className="botao pequeno" type="button" onClick={() => acoes.verNoQuadro(a)}>
                      Ver no quadro
                    </button>
                    {!soLeitura && (
                      <button className="botao pequeno" type="button" onClick={() => acoes.desmarcar(a.chave)}>
                        Desmarcar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {antigos.length > 0 && (
        <details className="det">
          <summary>{antigos.length === 1 ? '1 marcação antiga' : `${antigos.length} marcações antigas`}</summary>
          <p className="dica">Achados marcados como intencionais que este fluxo não tem mais.</p>
          <ul className="achados">
            {antigos.map((i) => (
              <li key={i.chave} className="achado antigo">
                <code>{i.chave}</code>
                {i.nota && <p className="nota-intencional">“{i.nota}”</p>}
                {!soLeitura && (
                  <button className="botao pequeno" type="button" onClick={() => acoes.desmarcar(i.chave)}>
                    Desmarcar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ItemAchado({ a, podeSimular, soLeitura, acoes }: { a: Achado; podeSimular: boolean; soLeitura: boolean; acoes: AcoesGaveta }) {
  const [marcando, setMarcando] = useState(false);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const item = useRef<HTMLLIElement>(null);
  const g = GRAVIDADES[a.gravidade];
  const desistir = () => {
    setMarcando(false);
    focarDepois(() => item.current?.querySelector<HTMLElement>('[data-marcar]'));
  };
  return (
    <li className={`achado g-${a.gravidade}`} ref={item}>
      <div className="achado-titulo">
        <span className={`selo-g ${a.gravidade}`}>
          <Icone nome={g.icone} />
          {g.nome}
        </span>
        {a.titulo}
      </div>
      <p className="achado-texto">{a.texto}</p>
      <div className="acoes-achado">
        <button className="botao pequeno" type="button" onClick={() => acoes.verNoQuadro(a)} disabled={!a.refs.length}>
          Ver no quadro
        </button>
        <button className="botao pequeno" type="button" onClick={() => acoes.simularAte(a)} disabled={!podeSimular} title={podeSimular ? undefined : 'Nenhum Início chega aqui'}>
          Simular até aqui
        </button>
        {!soLeitura && !marcando && (
          <button className="botao pequeno" type="button" data-marcar onClick={() => setMarcando(true)}>
            Marcar como intencional
          </button>
        )}
      </div>
      {marcando && !soLeitura && (
        <form
          className="marcar"
          onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), desistir())}
          onSubmit={async (e) => {
            e.preventDefault();
            // O achado vai pra "Intencionais" (este item some): o foco fica na gaveta.
            const gaveta = item.current?.closest<HTMLElement>('.gaveta');
            setEnviando(true);
            const ok = await acoes.marcar(a.chave, nota);
            setEnviando(false);
            if (!ok) return;
            setMarcando(false);
            focarDepois(() => gaveta);
          }}
        >
          <input className="entrada-texto" type="text" aria-label="Por que é de propósito? (opcional)" placeholder="Por que é de propósito? (opcional)" maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} autoFocus />
          <button className="botao pequeno primario" type="submit" disabled={enviando}>
            Marcar
          </button>
          <button className="botao pequeno" type="button" onClick={desistir}>
            Cancelar
          </button>
        </form>
      )}
    </li>
  );
}
```

- [ ] **Passo 6: cenários, versões e compartilhar**

`apps/web/src/componentes/editor/Cenarios.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { formatarTempo } from '@journey/fluxo';
import { paraAprovar, type Cenario, type Situacao } from '@/editor/cenarios';
import { tituloDoFim } from '@/editor/play';
import { Confirmacao, focarDepois } from './Confirmacao';

export interface AcoesCenarios {
  tocar(c: Cenario): void;
  aprovar(c: Cenario, s: Situacao): Promise<void>;
  renomear(c: Cenario, nome: string): Promise<boolean>;
  apagar(c: Cenario): Promise<void>;
}

/**
 * A lista dos cenários do fluxo, cada um com a situação contra o documento de agora: "igual" (o caminho dá o mesmo
 * resultado) ou "mudou" (com o que dá agora e "aprovar o novo"). Só leitura: só tocar.
 */
export function Cenarios({
  cenarios,
  situacoes,
  nomeDaPeca,
  soLeitura,
  acoes,
}: {
  cenarios: readonly Cenario[];
  situacoes: ReadonlyMap<string, Situacao>;
  nomeDaPeca: (id: string | null) => string;
  soLeitura: boolean;
  acoes: AcoesCenarios;
}) {
  if (!cenarios.length) return <p className="dica">Nenhum cenário ainda. No fim de um play, “Salvar cenário” guarda o caminho pra tocar de novo e conferir quando o fluxo mudar.</p>;
  return (
    <ul className="lista-pop">
      {cenarios.map((c) => (
        <ItemCenario key={c.id} c={c} s={situacoes.get(c.id)} nomeDaPeca={nomeDaPeca} soLeitura={soLeitura} acoes={acoes} />
      ))}
    </ul>
  );
}

function ItemCenario({ c, s, nomeDaPeca, soLeitura, acoes }: { c: Cenario; s: Situacao | undefined; nomeDaPeca: (id: string | null) => string; soLeitura: boolean; acoes: AcoesCenarios }) {
  const [renomeando, setRenomeando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const item = useRef<HTMLLIElement>(null);
  /** Depois de renomear ou desistir, o foco volta pro botão que abriu (e não pro body, onde o Esc não fecha o pop). */
  const voltarPara = (seletor: string) => focarDepois(() => item.current?.querySelector<HTMLElement>(seletor));
  const fim = (f: Cenario['esperado']['fim'] | null) => (f ? `${tituloDoFim(f.motivo)}: ${nomeDaPeca(f.peca)}` : 'para numa pergunta');
  const novo = s && s.situacao === 'mudou' ? paraAprovar(s) : null;
  const ocupar = async (f: () => Promise<unknown>) => {
    setOcupado(true);
    await f();
    setOcupado(false);
  };
  return (
    <li className="item-pop" data-testid="cenario" ref={item}>
      {renomeando && !soLeitura ? (
        <form
          className="linha-pop"
          onSubmit={(e) => {
            e.preventDefault();
            const nome = new FormData(e.currentTarget).get('nome') as string;
            void ocupar(async () => {
              if (!(await acoes.renomear(c, nome))) return;
              setRenomeando(false);
              voltarPara('[data-renomear]');
            });
          }}
        >
          <input className="entrada-texto" name="nome" aria-label="Nome do cenário" defaultValue={c.nome} maxLength={200} autoFocus />
          <button className="botao pequeno primario" type="submit" disabled={ocupado}>
            Salvar
          </button>
          <button
            className="botao pequeno"
            type="button"
            onClick={() => {
              setRenomeando(false);
              voltarPara('[data-renomear]');
            }}
          >
            Cancelar
          </button>
        </form>
      ) : (
        <div className="linha-pop">
          <b>{c.nome}</b>
          {s && <span className={`selo-s ${s.situacao}`}>{s.situacao === 'igual' ? 'igual' : 'mudou'}</span>}
        </div>
      )}
      <small className="mudo">
        {fim(c.esperado.fim)} · {formatarTempo(c.esperado.tempo_s)}
        {s?.situacao === 'mudou' && ` → agora: ${fim(s.resultado.fim)} · ${formatarTempo(s.resultado.tempo_s)}`}
      </small>
      <div className="acoes-achado">
        <button className="botao pequeno" type="button" onClick={() => acoes.tocar(c)}>
          Tocar
        </button>
        {!soLeitura && novo && (
          <button className="botao pequeno" type="button" disabled={ocupado} onClick={() => s && void ocupar(() => acoes.aprovar(c, s))}>
            Aprovar o novo
          </button>
        )}
        {!soLeitura && !renomeando && (
          <button className="botao pequeno" type="button" data-renomear onClick={() => setRenomeando(true)}>
            Renomear
          </button>
        )}
        {!soLeitura &&
          (apagando ? (
            <Confirmacao
              nao="Não apagar"
              sim={`Apagar “${c.nome}”`}
              aoCancelar={() => {
                setApagando(false);
                voltarPara('[data-apagar]');
              }}
              aoConfirmar={() => {
                // Apagado, o item some e o foco vai pro pop (pego antes); se não deu, volta pro Apagar.
                const pop = item.current?.closest<HTMLElement>('.pop');
                setApagando(false);
                void ocupar(() => acoes.apagar(c)).then(() => focarDepois(() => (item.current?.isConnected ? item.current.querySelector<HTMLElement>('[data-apagar]') : pop)));
              }}
            />
          ) : (
            <button className="botao pequeno" type="button" data-apagar onClick={() => setApagando(true)}>
              Apagar
            </button>
          ))}
      </div>
    </li>
  );
}
```

`apps/web/src/componentes/editor/Versoes.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { VersaoResumo } from '@/lib/dados';
import { FUSO } from '@/lib/fuso';
import { Confirmacao, focarDepois } from './Confirmacao';

const quando = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * As versões marcadas do fluxo (a mais nova primeiro), "Marcar versão" e "Restaurar" (com confirmação). Só leitura:
 * só a lista.
 */
export function Versoes({
  versoes,
  soLeitura,
  acoes,
}: {
  versoes: readonly VersaoResumo[];
  soLeitura: boolean;
  acoes: { marcar(nome: string): Promise<boolean>; restaurar(v: VersaoResumo): Promise<void> };
}) {
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState<number | null>(null);
  return (
    <>
      {!soLeitura && (
        <form
          className="linha-pop"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const nome = (new FormData(form).get('nome') as string).trim();
            if (!nome) return;
            setEnviando(true);
            if (await acoes.marcar(nome)) form.reset();
            setEnviando(false);
          }}
        >
          <input className="entrada-texto" name="nome" aria-label="Nome da versão" placeholder="Ex.: antes do horário novo" maxLength={120} required />
          <button className="botao pequeno primario" type="submit" disabled={enviando}>
            Marcar versão
          </button>
        </form>
      )}
      {versoes.length === 0 ? (
        <p className="dica">Nenhuma versão marcada. O editor salva sozinho; marcar uma versão é guardar uma foto com nome, pra voltar nela ou mandar num link.</p>
      ) : (
        <ul className="lista-pop">
          {versoes.map((v) => (
            <li key={v.numero} className="item-pop" data-testid="versao">
              <div className="linha-pop">
                <b>
                  {v.numero}. {v.nome}
                </b>
              </div>
              <small className="mudo">
                {quando.format(new Date(v.criada_em))}
                {v.autor && ` · ${v.autor}`}
              </small>
              {!soLeitura && (
                <div className="acoes-achado">
                  {confirmar === v.numero ? (
                    <Confirmacao
                      nao="Não restaurar"
                      sim={`Restaurar a versão ${v.numero}`}
                      aoCancelar={() => {
                        setConfirmar(null);
                        focarDepois(() => document.querySelector<HTMLElement>(`[data-restaurar="${v.numero}"]`));
                      }}
                      aoConfirmar={async () => {
                        setConfirmar(null);
                        await acoes.restaurar(v);
                        // Restaurada, o pop fecha e o editor devolve o foco pro botão Versões; se não deu, volta pro Restaurar.
                        focarDepois(() => document.querySelector<HTMLElement>(`[data-restaurar="${v.numero}"]`));
                      }}
                    />
                  ) : (
                    <button className="botao pequeno" type="button" data-restaurar={v.numero} onClick={() => setConfirmar(v.numero)}>
                      Restaurar
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

`apps/web/src/componentes/editor/Compartilhar.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { criarLink, revogarLink } from '@/acoes/links';
import { LIMITES_ESCONDER, VALIDADE_PADRAO, VALIDADES, descreverLink, enderecoDoLink, escolhasDoFormulario, rotuloValidade, situacao, type LinkResumo } from '@/compartilhar/opcoes';
import { Icone } from '@/componentes/Icone';
import { Confirmacao, focarDepois } from './Confirmacao';
import type { Cenario } from '@/editor/cenarios';
import type { VersaoResumo } from '@/lib/dados';

/**
 * O "Compartilhar": cria um link público só de leitura (a versão, o cenário inicial, esconder nomes e a validade) e
 * lista os que já foram criados, com copiar e revogar. É um <dialog> modal: o navegador prende o foco nele e o Esc
 * fecha; ao fechar, o foco volta pro botão que abriu. Sem a chave secreta no servidor, explica e não cria.
 */
export function Compartilhar({
  empresaId,
  fluxoId,
  aberto,
  aoFechar,
  voltarPara,
  configurado,
  versoes,
  cenarios,
  links,
  setLinks,
  soLeitura,
}: {
  empresaId: string;
  fluxoId: string;
  aberto: boolean;
  aoFechar: () => void;
  voltarPara: React.RefObject<HTMLElement | null>;
  configurado: boolean;
  versoes: readonly VersaoResumo[];
  cenarios: readonly Cenario[];
  links: readonly LinkResumo[];
  setLinks: (f: (ls: readonly LinkResumo[]) => readonly LinkResumo[]) => void;
  soLeitura: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [revogando, setRevogando] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberto && !d.open) {
      d.showModal();
      setAgora(new Date());
    } else if (!aberto && d.open) d.close();
  }, [aberto]);

  const endereco = (token: string) => enderecoDoLink(location.origin, token);
  const copiar = async (token: string) => {
    try {
      await navigator.clipboard.writeText(endereco(token));
      setCopiado(token);
    } catch {
      setErro('Não deu pra copiar: seleciona o endereço e copia à mão.');
    }
  };

  return (
    <dialog
      ref={dialogo}
      className="dialogo"
      aria-labelledby="titulo-compartilhar"
      // Esc (cancel) e o "Fechar" passam por aqui: o estado acompanha e o foco volta pro botão.
      onClose={() => {
        aoFechar();
        voltarPara.current?.focus();
      }}
    >
      <div className="pop-cab">
        <h2 id="titulo-compartilhar">Compartilhar</h2>
        <button className="bi" type="button" aria-label="Fechar" onClick={() => dialogo.current?.close()}>
          <Icone nome="fechar" />
        </button>
      </div>
      {!configurado ? (
        <p className="aviso-caixa info">Os links públicos ainda não estão configurados neste servidor (falta a chave secreta). Avisa quem cuida do Journey.</p>
      ) : soLeitura ? (
        <p className="dica">Pra criar um link, abra o fluxo pra editar (agora ele está só leitura).</p>
      ) : (
        <form
          className="form-link"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setErro(null);
            setCriando(true);
            const r = await criarLink(
              empresaId,
              fluxoId,
              escolhasDoFormulario({ versao: f.get('versao') as string, cenario: f.get('cenario') as string, esconder: f.get('esconder') === 'on', validade: f.get('validade') as string }),
            );
            setCriando(false);
            if (!r.link) return setErro(r.erro ?? 'Não deu pra criar o link.');
            const l = r.link;
            setLinks((ls) => [l, ...ls]);
            setNovo(l.token);
            setAgora(new Date());
          }}
        >
          <label className="campo">
            Versão
            <select name="versao" aria-label="Versão" defaultValue="">
              <option value="">o fluxo de agora (muda quando o fluxo mudar)</option>
              {versoes.map((v) => (
                <option key={v.numero} value={v.numero}>
                  versão {v.numero} — {v.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Cenário que toca ao abrir
            <select name="cenario" aria-label="Cenário que toca ao abrir" defaultValue="">
              <option value="">nenhum</option>
              {cenarios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="interruptor">
            Esconder os nomes das pessoas
            <input type="checkbox" name="esconder" defaultChecked />
          </label>
          <p className="dica">{LIMITES_ESCONDER}</p>
          <label className="campo">
            Validade
            <select name="validade" aria-label="Validade" defaultValue={String(VALIDADE_PADRAO)}>
              {VALIDADES.map((v) => (
                <option key={String(v)} value={v === null ? 'sem' : v}>
                  {rotuloValidade(v)}
                </option>
              ))}
            </select>
          </label>
          <button className="botao primario" type="submit" disabled={criando}>
            {criando ? 'Criando…' : 'Criar link'}
          </button>
        </form>
      )}
      <div role="status">{erro && <p className="aviso-caixa erro">{erro}</p>}</div>
      {novo && (
        <div className="link-novo">
          <label className="campo">
            Link criado
            <input className="entrada-texto" readOnly value={endereco(novo)} onFocus={(e) => e.currentTarget.select()} data-testid="link-novo" />
          </label>
          <button className="botao" type="button" onClick={() => void copiar(novo)}>
            {copiado === novo ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
      <h3 className="rotulo-secao">Links deste fluxo ({links.length})</h3>
      {links.length === 0 ? (
        <p className="dica">Nenhum link ainda.</p>
      ) : (
        <ul className="lista-pop" ref={lista} tabIndex={-1} aria-label="Links deste fluxo">
          {links.map((l) => {
            const s = situacao(l, agora);
            return (
              <li key={l.id} className="item-pop" data-testid="link">
                <div className="linha-pop">
                  <span className={`selo-s ${s === 'ativo' ? 'igual' : 'mudou'}`}>{s}</span>
                  <small className="mudo">{descreverLink(l, agora)}</small>
                </div>
                {s === 'ativo' && (
                  <div className="acoes-achado">
                    <button className="botao pequeno" type="button" onClick={() => void copiar(l.token)}>
                      {copiado === l.token ? 'Copiado' : 'Copiar'}
                    </button>
                    {!soLeitura &&
                      (revogando === l.id ? (
                        <Confirmacao
                          nao="Não revogar"
                          sim="Revogar pra sempre"
                          aoCancelar={() => {
                            setRevogando(null);
                            focarDepois(() => lista.current?.querySelector<HTMLElement>(`[data-revogar="${l.id}"]`));
                          }}
                          aoConfirmar={async () => {
                            setRevogando(null);
                            const r = await revogarLink(empresaId, fluxoId, l.id);
                            if (!r.revogado_em) {
                              setErro(r.erro ?? 'Não deu pra revogar.');
                              return focarDepois(() => lista.current?.querySelector<HTMLElement>(`[data-revogar="${l.id}"]`));
                            }
                            const quando = r.revogado_em;
                            setLinks((ls) => ls.map((x) => (x.id === l.id ? { ...x, revogado_em: quando } : x)));
                            // O link revogado não tem mais botões: o foco fica na lista.
                            focarDepois(() => lista.current);
                          }}
                        />
                      ) : (
                        <button className="botao pequeno" type="button" data-revogar={l.id} onClick={() => setRevogando(l.id)}>
                          Revogar
                        </button>
                      ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </dialog>
  );
}
```

- [ ] **Passo 7: o que muda no cartão do play, nas peças e no quadro**

`apps/web/src/componentes/editor/CartaoPlay.tsx`:

```diff
diff --git a/apps/web/src/componentes/editor/CartaoPlay.tsx b/apps/web/src/componentes/editor/CartaoPlay.tsx
index 29e7381..356548f 100644
--- a/apps/web/src/componentes/editor/CartaoPlay.tsx
+++ b/apps/web/src/componentes/editor/CartaoPlay.tsx
@@ -1,9 +1,11 @@
 'use client';
 
+import { useRef, useState } from 'react';
 import { formatarTempo, type Documento } from '@journey/fluxo';
 import { Icone } from '@/componentes/Icone';
 import { VELOCIDADES, type CanalEditor } from '@/editor/estilo';
 import { quandoValido, tituloDoFim, type Play, type Visual } from '@/editor/play';
+import { focarDepois } from './Confirmacao';
 
 export interface AcoesPlay {
   escolher(conexao: string): void;
@@ -28,6 +30,7 @@ export function CartaoPlay({
   corAgua,
   canais,
   inicios,
+  salvarCenario,
   acoes,
 }: {
   doc: Documento;
@@ -40,8 +43,17 @@ export function CartaoPlay({
   canais: readonly CanalEditor[];
   /** Quando há mais de um Início e nenhum selecionado: a pergunta "por onde começa?". */
   inicios: string[] | null;
+  /** No fim, guarda o caminho como cenário (só com a trava). Devolve se salvou. */
+  salvarCenario?: (nome: string) => Promise<boolean>;
   acoes: AcoesPlay;
 }) {
+  const [salvando, setSalvando] = useState<'nome' | 'enviando' | null>(null);
+  const cartao = useRef<HTMLDivElement>(null);
+  // Depois de salvar ou desistir, o foco volta pro "Salvar cenário" (e não pro body).
+  const fecharForm = () => {
+    setSalvando(null);
+    focarDepois(() => cartao.current?.querySelector<HTMLElement>('[data-salvar-cenario]'));
+  };
   const nome = (id: string | null | undefined) => doc.pecas.find((p) => p.id === id)?.nome ?? '';
   const nomeCanal = (k: string | null) => canais.find((c) => c.chave === k)?.nome ?? 'sem canal';
 
@@ -122,7 +134,33 @@ export function CartaoPlay({
           <button className="botao" type="button" onClick={acoes.parar}>
             Fechar
           </button>
+          {salvarCenario && !salvando && (
+            <button className="botao" type="button" data-salvar-cenario onClick={() => setSalvando('nome')}>
+              Salvar cenário
+            </button>
+          )}
         </div>
+        {salvarCenario && salvando && (
+          <form
+            className="controles"
+            onSubmit={async (e) => {
+              e.preventDefault();
+              const nome = (new FormData(e.currentTarget).get('nome') as string).trim();
+              if (!nome) return;
+              setSalvando('enviando');
+              if (await salvarCenario(nome)) fecharForm();
+              else setSalvando('nome');
+            }}
+          >
+            <input className="entrada-texto" name="nome" aria-label="Nome do cenário" placeholder="Ex.: pede a 2ª via fora do horário" maxLength={200} required autoFocus />
+            <button className="botao primario" type="submit" disabled={salvando === 'enviando'}>
+              Salvar
+            </button>
+            <button className="botao" type="button" onClick={fecharForm}>
+              Cancelar
+            </button>
+          </form>
+        )}
       </div>
     );
   } else if (visual.pergunta) {
@@ -161,7 +199,7 @@ export function CartaoPlay({
   }
 
   return (
-    <div className="cartao-sim" role="region" aria-label="Simulação" style={{ ['--agua' as string]: corAgua(canal) }}>
+    <div ref={cartao} className="cartao-sim" role="region" aria-label="Simulação" style={{ ['--agua' as string]: corAgua(canal) }}>
       <div className="cab">
         <span className="pilula" style={{ ['--c' as string]: corAgua(canal) }}>
           <span className="ponto-cor" />
```

`apps/web/src/componentes/editor/Pecas.tsx`:

```diff
diff --git a/apps/web/src/componentes/editor/Pecas.tsx b/apps/web/src/componentes/editor/Pecas.tsx
index 40bd4f5..3b62a39 100644
--- a/apps/web/src/componentes/editor/Pecas.tsx
+++ b/apps/web/src/componentes/editor/Pecas.tsx
@@ -113,6 +113,7 @@ export const RotuloCano = memo(function RotuloCano({
   y,
   selecionado,
   escolhivel,
+  destacado = false,
   corAgua,
 }: {
   conexao: Conexao;
@@ -120,13 +121,15 @@ export const RotuloCano = memo(function RotuloCano({
   y: number;
   selecionado: boolean;
   escolhivel: boolean;
+  /** No holofote de um achado. */
+  destacado?: boolean;
   corAgua?: string;
 }) {
   const t = textoRegra(c);
   if (!t) return null;
   return (
     <div
-      className={`rotulo-cano${selecionado ? ' sel' : ''}${escolhivel ? ' escolhivel foco' : ''}`}
+      className={`rotulo-cano${selecionado ? ' sel' : ''}${escolhivel ? ' escolhivel foco' : destacado ? ' foco' : ''}`}
       data-rotulo={c.id}
       style={{ left: x, top: y, ...(escolhivel && corAgua && { ['--agua' as string]: corAgua }) }}
       role="button"
```

`apps/web/src/componentes/editor/Quadro.tsx`:

```diff
diff --git a/apps/web/src/componentes/editor/Quadro.tsx b/apps/web/src/componentes/editor/Quadro.tsx
index 8c3ad19..b656500 100644
--- a/apps/web/src/componentes/editor/Quadro.tsx
+++ b/apps/web/src/componentes/editor/Quadro.tsx
@@ -65,6 +65,8 @@ export interface PropsQuadro {
   pausado: boolean;
   aoAguaChegar: () => void;
   renomeando: string | null;
+  /** "Ver no quadro" de um achado: estas peças e conexões ficam no holofote. */
+  destaque?: ReadonlySet<string> | null;
   acoes: AcoesQuadro;
   ref?: React.Ref<QuadroApi>;
   children?: React.ReactNode;
@@ -94,7 +96,7 @@ const ZOOM_MIN = 0.2;
 const ZOOM_MAX = 2.5;
 const limitar = (v: number, m: number) => Math.max(-m, Math.min(m, v));
 
-export function Quadro({ doc, estilo, canais, canalFluxo, nomesCadastros, sel, ferramenta, soLeitura, play, pausado, aoAguaChegar, renomeando, acoes, ref, children }: PropsQuadro) {
+export function Quadro({ doc, estilo, canais, canalFluxo, nomesCadastros, sel, ferramenta, soLeitura, play, pausado, aoAguaChegar, renomeando, destaque = null, acoes, ref, children }: PropsQuadro) {
   const palco = useRef<HTMLElement>(null);
   const [vista, setVista] = useState<Vista>({ x: 120, y: 260, k: 1 });
   const vistaRef = useRef(vista);
@@ -456,6 +458,7 @@ export function Quadro({ doc, estilo, canais, canalFluxo, nomesCadastros, sel, f
           pausado={pausado}
           aoAguaChegar={aoAguaChegar}
           renomeando={renomeando}
+          destaque={destaque}
           temp={temp}
           acoes={acoes}
         />
@@ -537,6 +540,7 @@ interface PropsMundo {
   pausado: boolean;
   aoAguaChegar: () => void;
   renomeando: string | null;
+  destaque: ReadonlySet<string> | null;
   temp: { d: string; alvo: string | null } | null;
   acoes: AcoesQuadro;
 }
@@ -545,7 +549,7 @@ interface PropsMundo {
  * O que está dentro do mundo (grupos, canos, peças, rótulos). Memorizado e sem a vista: andar e dar zoom só mudam o
  * transform do `.mundo`, sem redesenhar os canos a cada quadro.
  */
-const Mundo = memo(function Mundo({ doc, estilo, canais, canalFluxo, nomesCadastros, sel, soLeitura, play, pausado, aoAguaChegar, renomeando, temp, acoes }: PropsMundo) {
+const Mundo = memo(function Mundo({ doc, estilo, canais, canalFluxo, nomesCadastros, sel, soLeitura, play, pausado, aoAguaChegar, renomeando, destaque, temp, acoes }: PropsMundo) {
   const pecas = useMemo(() => new Map(doc.pecas.map((p) => [p.id, p])), [doc.pecas]);
   const canos = useMemo(() => {
     // Ida e volta entre as mesmas peças: cada cano vai pra um lado, senão ficam um em cima do outro.
@@ -559,8 +563,8 @@ const Mundo = memo(function Mundo({ doc, estilo, canais, canalFluxo, nomesCadast
     });
   }, [doc.conexoes, pecas, estilo.curva]);
 
-  // A simulação: o que está molhado, a pergunta (holofote) e a água.
-  const foco = new Set<string>();
+  // A simulação: o que está molhado, a pergunta (holofote) e a água. Sem pergunta, o holofote é o do achado.
+  const foco = new Set<string>(play?.pergunta ? [] : (destaque ?? []));
   if (play?.pergunta) {
     foco.add(play.pergunta.peca);
     for (const o of play.pergunta.opcoes) foco.add(o.para);
@@ -611,7 +615,7 @@ const Mundo = memo(function Mundo({ doc, estilo, canais, canalFluxo, nomesCadast
             const selecionado = sel?.tipo === 'conexao' && sel.id === c.id;
             const seta = `url(#${selecionado ? 'seta-sel' : 'seta'})`;
             return (
-              <g key={c.id} className={`cano${selecionado ? ' sel' : ''}${escolhiveis.has(c.id) ? ' foco' : ''}`} data-cano={c.id}>
+              <g key={c.id} className={`cano${selecionado ? ' sel' : ''}${escolhiveis.has(c.id) || foco.has(c.id) ? ' foco' : ''}`} data-cano={c.id}>
                 {estilo.cano === 'cano' ? (
                   <>
                     <path className="parede" d={geo.d} strokeWidth={esp} markerEnd={seta} />
@@ -659,8 +663,8 @@ const Mundo = memo(function Mundo({ doc, estilo, canais, canalFluxo, nomesCadast
                 ...(play.molhadas.has(p.id) && { agua: cor(play.molhadas.get(p.id)) }),
                 atual: play.atual === p.id,
                 perguntando: play.pergunta?.peca === p.id,
-                foco: foco.has(p.id),
               })}
+              foco={foco.has(p.id)}
               soLeitura={soLeitura || !!play}
             />
           );
@@ -673,6 +677,7 @@ const Mundo = memo(function Mundo({ doc, estilo, canais, canalFluxo, nomesCadast
             y={geo.meio.y}
             selecionado={sel?.tipo === 'conexao' && sel.id === c.id}
             escolhivel={escolhiveis.has(c.id)}
+            destacado={foco.has(c.id)}
             {...(play && { corAgua: cor(play.canal) })}
           />
         ))}
```

- [ ] **Passo 8: o editor e o CSS** (substituir os dois arquivos inteiros)

`apps/web/src/componentes/editor/Editor.tsx`:

```tsx
'use client';

import './editor.css';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { diagnosticar, lerDocumento, type Achado, type Cadastro, type Documento, type TipoPeca } from '@journey/fluxo';
import { criarCadastro, renomearCadastro } from '@/acoes/cadastros';
import { apagarFluxo, mudarFluxo, type DadosDoFluxo } from '@/acoes/fluxos';
import { apagarCenario, aprovarCenario, renomearCenario, salvarCenario } from '@/acoes/cenarios';
import { desmarcarIntencional, marcarIntencional } from '@/acoes/intencionais';
import { marcarVersao } from '@/acoes/versoes';
import type { LinkResumo } from '@/compartilhar/opcoes';
import { Icone } from '@/componentes/Icone';
import type { TipoCadastro } from '@/editor/cadastros';
import { cenarioDoPlay, paraAprovar, playDoCenario, situacao as situacaoDoCenario, type Cenario, type Situacao as SituacaoCenario } from '@/editor/cenarios';
import { antigos, caminhoAte, focoDoAchado, gavetaAberta, lembrarGaveta, pecaDoAchado, rotuloAchados, separar, simulaveis, type Intencional } from '@/editor/diagnostico';
import * as D from '@/editor/documento';
import { corDoCanal, lerEstilo, type CanalEditor, type Estilo } from '@/editor/estilo';
import { comecar, desfazer, refazer, registrar, substituir, type Historico } from '@/editor/historico';
import { FORMAS, ORDEM_FORMAS } from '@/editor/pecas';
import { agora } from '@/editor/play';
import { Salvamento, copiaValida, mesmoJson, motivoDoErro, type Situacao } from '@/editor/salvamento';
import type { VersaoResumo } from '@/lib/dados';
import { FUSO } from '@/lib/fuso';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { CartaoPlay } from './CartaoPlay';
import { Cenarios } from './Cenarios';
import { Compartilhar } from './Compartilhar';
import { Gaveta } from './Gaveta';
import { Pop } from './Pop';
import { Versoes } from './Versoes';
import { Painel, type Aba, type DadosFluxo } from './Painel';
import { Quadro, criaAlgo, type Ferramenta, type QuadroApi } from './Quadro';
import { useAnuncioAdiado } from './useAnuncioAdiado';
import { usePlay } from './usePlay';

export interface PropsEditor {
  empresaId: string;
  fluxo: { id: string; revisao: number; documento: Documento; estilo: unknown } & DadosFluxo;
  canais: readonly CanalEditor[];
  cadastros: readonly Cadastro[];
  tipos: readonly TipoCadastro[];
  intencionais: readonly Intencional[];
  cenarios: readonly Cenario[];
  versoes: readonly VersaoResumo[];
  links: readonly LinkResumo[];
  /** Se o servidor tem a chave secreta: sem ela, o link público não abre e o "Compartilhar" explica. */
  linkConfigurado: boolean;
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

export function Editor({ empresaId, fluxo, canais, cadastros: cadastrosIniciais, tipos, intencionais: intencionaisIniciais, cenarios: cenariosIniciais, versoes: versoesIniciais, links: linksIniciais, linkConfigurado }: PropsEditor) {
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
  // A de agora, pra uma mensagem montada depois de um await (o `situacao` do desenho em que a ação nasceu é velho).
  const situacaoRef = useRef(situacao);
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
    aoMudar: (s, mensagem) => {
      situacaoRef.current = { s, ...(mensagem && { mensagem }) };
      setSituacao(situacaoRef.current);
    },
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
    const { documento, orfas } = D.semResponsaveisQueSumiram(copia.documento, new Set(cadastrosIniciais.map((k) => k.id)));
    mudarHist(comecar(documento));
    trocarEstilo(lerEstilo(copia.estilo));
    salv.current!.mudou(documento, lerEstilo(copia.estilo));
    avisar(orfas ? `Voltaram as mudanças que não tinham chegado ao banco (sem o responsável apagado em ${pecas(orfas)}).` : 'Voltaram as mudanças que não tinham chegado ao banco.');
  }

  const pecas = (n: number) => (n === 1 ? '1 peça' : `${n} peças`);

  // ---------- Mudanças no documento ----------
  const parar = () => pl.parar();

  /** Toda mudança no documento parte do mais recente (`docAtual()`), nunca do `doc` deste desenho. */
  const editar = (novo: Documento, selecao?: D.Selecao) => {
    const v = vivo.current;
    if (v.soLeitura || novo === docAtual()) return;
    if (v.play) parar();
    setDestaque(null);
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
    setDestaque(null);
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
  const ctx = useMemo(() => ({ cadastros, canal: dados.canal }), [cadastros, dados.canal]);
  const pl = usePlay({
    doc,
    ctx,
    velocidade: estiloVisto.velocidade,
    autoEscolha: estilo.autoEscolha,
    camera: estilo.camera,
    quadro,
    avisar,
    aoComecar: () => {
      setRenomeando(null);
      setDestaque(null);
    },
  });
  const { play, docPlay, vis, escolhendoInicio, escolher } = pl;
  // Pro `editar` chamado depois de um await: a trava e o play de agora, não os de quando a ação nasceu.
  const vivo = useRef({ soLeitura, play });
  vivo.current = { soLeitura, play };

  const darPlay = () => pl.darPlay(sel?.tipo === 'peca' ? sel.id : null);

  // ---------- Diagnóstico ----------
  // Adiado: digitar um nome não espera o diagnóstico (500 peças levam poucos milissegundos, mas a cada tecla).
  const docDiag = useDeferredValue(doc);
  const achados = useMemo(() => diagnosticar(docDiag, { cadastros, ...(dados.meta_s && { meta_s: dados.meta_s }) }), [docDiag, cadastros, dados.meta_s]);
  const [marcados, setMarcados] = useState<readonly Intencional[]>(intencionaisIniciais);
  const separados = useMemo(() => separar(achados, marcados), [achados, marcados]);
  const marcasAntigas = useMemo(() => antigos(achados, marcados), [achados, marcados]);
  const marcas = useMemo(() => new Map(marcados.map((i) => [i.chave, i])), [marcados]);
  const [gaveta, setGaveta] = useState(false);
  // Depois de montar: o servidor não sabe o que este navegador lembra (e o primeiro desenho tem que ser igual ao dele).
  useEffect(() => setGaveta(gavetaAberta(fluxo.id)), [fluxo.id]);
  const botaoDiagnostico = useRef<HTMLButtonElement>(null);
  /** Fechar a gaveta tira o holofote do achado junto. */
  const mudarGaveta = (aberta: boolean) => {
    lembrarGaveta(fluxo.id, aberta);
    setGaveta(aberta);
    if (!aberta) setDestaque(null);
  };
  const [destaque, setDestaque] = useState<ReadonlySet<string> | null>(null);
  // "Simular até aqui" só pra peça que um Início alcança: uma busca pro documento; o caminho é feito no clique.
  const comCaminho = useMemo(() => (gaveta ? simulaveis(docDiag, achados) : new Set<string>()), [gaveta, docDiag, achados]);
  // A contagem muda a cada tecla: o leitor de tela ouve a de quando parou de mudar.
  const anuncio = useAnuncioAdiado(`Diagnóstico: ${rotuloAchados(separados.abertos.length)}`);
  // Tela pequena nos dois sentidos: com o play, a gaveta fecha pra não cobrir o cartão (sem lembrar). Deitado e mais
  // largo, as duas cabem lado a lado (editor.css).
  useEffect(() => {
    if (pl.ativo && matchMedia('(max-height: 600px) and (max-width: 599px)').matches) {
      setGaveta(false);
      setDestaque(null);
    }
  }, [pl.ativo]);

  const verNoQuadro = (a: Achado) => {
    const f = focoDoAchado(docAtual(), a);
    if (!f) return;
    if (play) parar();
    setSel(f.sel);
    setDestaque(f.destaque);
    quadro.current?.enquadrar(f.enquadrar);
  };

  const simularAte = (a: Achado) => {
    const d = docAtual();
    const alvo = pecaDoAchado(d, a);
    const p = alvo && caminhoAte(d, ctx, alvo, play?.quando ?? agora());
    if (!alvo || !p) return avisar('Nenhum Início chega nesta peça.');
    pl.tocar(p, alvo);
  };

  const marcar = async (chave: string, nota: string) => {
    if (vivo.current.soLeitura) return false;
    const r = await marcarIntencional(empresaId, fluxo.id, chave, nota);
    if (!r.intencional) {
      avisar(r.erro ?? 'Não deu pra marcar.');
      return false;
    }
    const i = r.intencional;
    setMarcados((ms) => [...ms.filter((m) => m.chave !== chave), i]);
    return true;
  };

  // ---------- Cenários ----------
  const [cens, setCens] = useState<readonly Cenario[]>(cenariosIniciais);
  // Contra o documento de agora (adiado como o diagnóstico): igual ou mudou.
  const situacoes = useMemo(() => new Map<string, SituacaoCenario>(cens.map((c) => [c.id, situacaoDoCenario(c, docDiag, ctx)])), [cens, docDiag, ctx]);
  const [aberto, setAberto] = useState<'cenarios' | 'versoes' | null>(null);
  const botaoCenarios = useRef<HTMLButtonElement>(null);
  const porNome = (a: Cenario, b: Cenario) => a.nome.localeCompare(b.nome, 'pt-BR');

  /** Manda o que falta e diz se o banco está com o documento de agora (pra revisão de um cenário ou de uma versão). */
  const salvarAntes = async (oQue: string) => {
    await salv.current!.agora();
    if (!salv.current!.sujo && !salv.current!.parado) return true;
    avisar(`O fluxo ainda não chegou no banco (${textoSituacao[situacaoRef.current.s]}): ${oQue} fica pra quando salvar.`);
    return false;
  };

  const salvarUmCenario = async (nome: string) => {
    if (vivo.current.soLeitura) return false;
    const novo = play && pl.exec ? cenarioDoPlay(play, pl.exec) : null;
    if (!novo) {
      avisar('Dá play até o fim pra salvar o cenário.');
      return false;
    }
    if (!(await salvarAntes('o cenário'))) return false;
    const r = await salvarCenario(empresaId, fluxo.id, nome, novo, salv.current!.revisao);
    if (!r.cenario) {
      avisar(r.erro ?? 'Não deu pra salvar o cenário.');
      return false;
    }
    const c = r.cenario;
    setCens((cs) => [...cs, c].sort(porNome));
    avisar(`Cenário “${c.nome}” salvo. Ele fica em Cenários.`);
    return true;
  };

  const acoesCenarios = {
    tocar: (c: Cenario) => {
      setAberto(null);
      pl.tocar(playDoCenario(c));
    },
    aprovar: async (c: Cenario, s: SituacaoCenario) => {
      const novo = paraAprovar(s);
      if (vivo.current.soLeitura || !novo || !(await salvarAntes('a aprovação'))) return;
      // A que vai pro banco: um salvamento no meio da ida mudaria `salv.revisao` antes da volta.
      const revisao = salv.current!.revisao;
      const r = await aprovarCenario(empresaId, fluxo.id, c.id, novo, revisao);
      if (r.erro) return avisar(r.erro);
      setCens((cs) => cs.map((x) => (x.id === c.id ? { ...x, ...novo, revisao_aprovada: revisao } : x)));
    },
    renomear: async (c: Cenario, nome: string) => {
      if (vivo.current.soLeitura) return false;
      const r = await renomearCenario(empresaId, fluxo.id, c.id, nome);
      if (r.erro) {
        avisar(r.erro);
        return false;
      }
      setCens((cs) => cs.map((x) => (x.id === c.id ? { ...x, nome: nome.trim() } : x)).sort(porNome));
      return true;
    },
    apagar: async (c: Cenario) => {
      if (vivo.current.soLeitura) return;
      const r = await apagarCenario(empresaId, fluxo.id, c.id);
      if (r.erro) return avisar(r.erro);
      setCens((cs) => cs.filter((x) => x.id !== c.id));
    },
  };

  // ---------- Versões ----------
  const [vers, setVers] = useState<readonly VersaoResumo[]>(versoesIniciais);
  const botaoVersoes = useRef<HTMLButtonElement>(null);

  /** A versão é a foto do que está no banco: só marca depois que o que falta chegou. */
  const marcarUmaVersao = async (nome: string) => {
    if (vivo.current.soLeitura || !(await salvarAntes('a versão'))) return false;
    const r = await marcarVersao(empresaId, fluxo.id, nome);
    if (!r.versao) {
      avisar(r.erro ?? 'Não deu pra marcar a versão.');
      return false;
    }
    const v = r.versao;
    setVers((vs) => [v, ...vs]);
    avisar(`Versão ${v.numero} marcada.`);
    return true;
  };

  /**
   * Restaurar é uma edição como outra qualquer (Ctrl+Z desfaz): o documento da versão, lido pelo navegador (a regra
   * de acesso vale), entra no histórico, e o estilo dela também (o estilo não entra no desfazer). Responsável que não
   * é mais cadastro sai, como na cópia local: senão o banco recusaria o salvamento.
   */
  const restaurar = async (v: VersaoResumo) => {
    const r = await supabase.from('fluxo_versoes').select('documento, estilo').eq('fluxo_id', fluxo.id).eq('numero', v.numero).maybeSingle();
    if (r.error || !r.data) return avisar('Não deu pra ler essa versão. Tenta de novo.');
    const lido = lerDocumento(r.data.documento);
    if (!lido.documento) return avisar(`A versão ${v.numero} não abre: o documento dela não é válido.`);
    const { documento, orfas } = D.semResponsaveisQueSumiram(lido.documento, new Set(cadastros.map((k) => k.id)));
    if (vivo.current.soLeitura) return;
    const est = lerEstilo(r.data.estilo);
    // Igual ao de agora: nada a restaurar (e nenhum passo vazio no desfazer).
    if (mesmoJson(documento, docAtual()) && mesmoJson(est, estiloRef.current)) return avisar(`A versão ${v.numero} é igual ao fluxo de agora: nada mudou.`);
    setAberto(null);
    botaoVersoes.current?.focus();
    if (!mesmoJson(documento, docAtual())) editar(documento, null);
    mudarEstilo(est);
    avisar(`Voltou a versão ${v.numero} (“${v.nome}”)${orfas ? `, sem o responsável apagado em ${pecas(orfas)}` : ''}. Ctrl+Z desfaz.`);
  };

  // ---------- Compartilhar ----------
  const [lnks, setLinks] = useState<readonly LinkResumo[]>(linksIniciais);
  const [compartilhando, setCompartilhando] = useState(false);
  const botaoCompartilhar = useRef<HTMLButtonElement>(null);

  const desmarcar = async (chave: string) => {
    if (vivo.current.soLeitura) return;
    const r = await desmarcarIntencional(empresaId, fluxo.id, chave);
    if (r.erro) return avisar(r.erro);
    setMarcados((ms) => ms.filter((m) => m.chave !== chave));
  };

  // ---------- Teclado ----------
  const teclas = useRef<(e: KeyboardEvent) => void>(() => {});
  teclas.current = (e: KeyboardEvent) => {
    // Dentro de um campo, de um pop (Cenários, Versões) ou do diálogo, a tecla é deles: Delete num botão do pop não
    // pode apagar a peça selecionada no quadro.
    const alvo = e.target as Element | null;
    if (alvo?.closest?.('input, textarea, select, [contenteditable="true"], .pop, dialog')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    // Na gaveta: Esc tira o holofote (ou fecha a gaveta) e desfazer/refazer seguem valendo; Delete, Enter e as teclas
    // das opções do play ficam com os botões dela.
    if (alvo?.closest?.('.gaveta')) {
      if (e.key === 'Escape') {
        if (destaque) return setDestaque(null);
        mudarGaveta(false);
        return botaoDiagnostico.current?.focus();
      }
      if (!(mod && (k === 'z' || k === 'y'))) return;
    }
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
    if (pl.tecla(e)) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !play) {
      e.preventDefault();
      quadro.current?.encerrarGesto();
      return apagarSelecao();
    }
    if (e.key === 'Escape') {
      if (destaque) return setDestaque(null);
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
    <div className={`editor${estilo.ondas ? ' ondas' : ''}${estilo.holofote ? ' holofote-on' : ''}${vis?.pergunta ? ' escolhendo' : destaque ? ' destacando' : ''}${pl.ativo ? ' com-play' : ''}${gaveta ? ' com-gaveta' : ''}`}>
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
            <button
              ref={botaoDiagnostico}
              className="botao"
              type="button"
              aria-expanded={gaveta}
              aria-controls={gaveta ? 'gaveta-diagnostico' : undefined}
              onClick={() => mudarGaveta(!gaveta)}
              data-testid="botao-diagnostico"
            >
              <Icone nome="alerta" />
              {rotuloAchados(separados.abertos.length)}
            </button>
            <button ref={botaoCenarios} className="botao" type="button" aria-expanded={aberto === 'cenarios'} onClick={() => setAberto(aberto === 'cenarios' ? null : 'cenarios')}>
              Cenários ({cens.length})
            </button>
            <button ref={botaoVersoes} className="botao" type="button" aria-expanded={aberto === 'versoes'} onClick={() => setAberto(aberto === 'versoes' ? null : 'versoes')}>
              Versões
            </button>
            <button ref={botaoCompartilhar} className="botao" type="button" aria-haspopup="dialog" onClick={() => setCompartilhando(true)}>
              <Icone nome="link" />
              Compartilhar
            </button>
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
        {aberto === 'versoes' && (
          <Pop titulo="Versões" voltarPara={botaoVersoes} aoFechar={() => setAberto(null)}>
            <Versoes versoes={vers} soLeitura={soLeitura} acoes={{ marcar: marcarUmaVersao, restaurar }} />
          </Pop>
        )}
        {aberto === 'cenarios' && (
          <Pop titulo="Cenários" voltarPara={botaoCenarios} aoFechar={() => setAberto(null)}>
            <Cenarios
              cenarios={cens}
              situacoes={situacoes}
              nomeDaPeca={(id) => docDiag.pecas.find((p) => p.id === id)?.nome ?? 'peça que não existe mais'}
              soLeitura={soLeitura}
              acoes={acoesCenarios}
            />
          </Pop>
        )}
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

        <div className="quadro-e-gaveta">
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
          pausado={pl.pausado}
          aoAguaChegar={pl.aguaChegou}
          renomeando={renomeando}
          destaque={destaque}
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
              pausado={pl.pausado}
              velocidade={estiloVisto.velocidade}
              autoEscolha={estilo.autoEscolha}
              corAgua={corAgua}
              canais={canais}
              inicios={escolhendoInicio}
              {...(!soLeitura && { salvarCenario: salvarUmCenario })}
              acoes={{
                escolher,
                pausar: pl.pausar,
                voltar: pl.voltar,
                recomecar: pl.recomecar,
                parar,
                velocidade: mudarVelocidade,
                quando: pl.mudarQuando,
                relogio: pl.mudarRelogio,
                comecarEm: pl.comecarEm,
              }}
            />
          )}
        </Quadro>
        {gaveta && (
          <Gaveta
            id="gaveta-diagnostico"
            abertos={separados.abertos}
            intencionais={separados.intencionais}
            antigos={marcasAntigas}
            marcas={marcas}
            podeSimular={(a) => comCaminho.has(a.chave)}
            soLeitura={soLeitura}
            acoes={{ verNoQuadro, simularAte, marcar, desmarcar: (chave) => void desmarcar(chave) }}
          />
        )}
        </div>

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
      <Compartilhar
        empresaId={empresaId}
        fluxoId={fluxo.id}
        aberto={compartilhando}
        aoFechar={() => setCompartilhando(false)}
        voltarPara={botaoCompartilhar}
        configurado={linkConfigurado}
        versoes={vers}
        cenarios={cens}
        links={lnks}
        setLinks={setLinks}
        soLeitura={soLeitura}
      />
      <div role="status">{aviso && <div className="aviso">{aviso}</div>}</div>
      {/* Montada vazia: a contagem dos achados, quando muda (adiada). */}
      <div className="so-leitor" role="status">
        {anuncio}
      </div>
    </div>
  );
}
```

`apps/web/src/componentes/editor/editor.css`:

```css
/* Editor de fluxos (v2): o protótipo aprovado (barra de formas, quadro, painel, play). Tudo dentro de .editor, pra não
   esbarrar no CSS das outras telas. Os tokens (--accent, --nota, --grupo, --mistura) estão no globals.css. */
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

/* O quadro e, por cima dele, a gaveta do diagnóstico (fora do palco: os gestos do quadro não pegam nela). */
.editor .quadro-e-gaveta { position: relative; display: grid; min-width: 0; min-height: 0; }
.editor .gaveta { position: absolute; left: 12px; top: 52px; width: min(360px, calc(100% - 24px)); max-height: calc(100% - 116px); overflow: auto; z-index: 30; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); padding: 12px; display: grid; gap: 10px; align-content: start; }
/* Com o play, a gaveta para antes do cartão de baixo. */
.editor.com-play .gaveta { max-height: calc(100% - 360px); min-height: 140px; }
.editor .achados { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.editor .achado { display: grid; gap: 6px; padding: 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--node); }
.editor .achado.g-grave { border-left: 4px solid var(--bad); }
.editor .achado.g-alerta { border-left: 4px solid var(--warn); }
.editor .achado.g-observacao { border-left: 4px solid var(--info); }
.editor .achado-titulo { font-weight: 600; font-size: 13px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.editor .achado-texto { margin: 0; font-size: 12.5px; color: var(--ink-2); }
.editor .acoes-achado { display: flex; gap: 6px; flex-wrap: wrap; }
.editor .selo-g { display: inline-flex; align-items: center; gap: 4px; font: 600 10.5px var(--f-mono); letter-spacing: .05em; text-transform: uppercase; padding: 2px 6px; border-radius: 6px; }
.editor .selo-g .icone { width: 12px; height: 12px; }
.editor .selo-g.grave { background: var(--bad-soft); color: var(--bad); }
.editor .selo-g.alerta { background: var(--warn-soft); color: var(--warn); }
.editor .selo-g.observacao { background: var(--info-soft); color: var(--info); }
.editor .marcar { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.editor .marcar .entrada-texto { flex: 1 1 160px; padding: 6px 9px; }
.editor .nota-intencional { margin: 0; font-size: 12.5px; color: var(--ink-2); font-style: italic; }
.editor .achado.antigo code { font: 500 11px var(--f-mono); color: var(--ink-3); word-break: break-all; }
/* "Ver no quadro": o resto do quadro apaga, o achado fica no holofote. */
.editor.destacando .no:not(.foco), .editor.destacando .grupo, .editor.destacando .rotulo-cano:not(.foco) { opacity: .22; }
.editor.destacando svg.canos .cano:not(.foco) { opacity: .22; }

/* Pops do topo (Cenários, Versões): embaixo dos botões, por cima do quadro. */
.editor .cabeca-editor { position: relative; }
.editor .pop { position: absolute; right: 0; top: calc(100% + 6px); z-index: 45; width: min(440px, 100%); max-height: min(70vh, 560px); overflow: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); padding: 12px; display: grid; gap: 10px; align-content: start; }
.editor .pop-cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.editor .pop-cab h2 { font-size: 15px; }
.editor .lista-pop { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.editor .item-pop { display: grid; gap: 6px; padding: 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--node); }
.editor .linha-pop { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.editor .linha-pop .entrada-texto { flex: 1 1 160px; padding: 6px 9px; }
.editor .selo-s { font: 600 10.5px var(--f-mono); letter-spacing: .05em; text-transform: uppercase; padding: 2px 7px; border-radius: 6px; }
.editor .selo-s.igual { background: var(--ok-soft); color: var(--ok); }
.editor .selo-s.mudou { background: var(--warn-soft); color: var(--warn); }
.editor .cartao-sim form.controles .entrada-texto { flex: 1 1 180px; padding: 6px 9px; }

/* O "Compartilhar": diálogo modal. */
.editor dialog.dialogo { width: min(520px, calc(100vw - 24px)); max-height: calc(100vh - 32px); overflow: auto; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); color: var(--ink); padding: 16px; box-shadow: var(--shadow); }
.editor dialog.dialogo[open] { display: grid; gap: 12px; align-content: start; }
.editor dialog.dialogo::backdrop { background: rgba(10, 16, 20, .45); }
.editor .form-link { display: grid; gap: 10px; }
.editor .form-link select { width: 100%; padding: 8px 10px; border-radius: 9px; border: 1px solid var(--line); background: var(--node); font-size: 13.5px; }
.editor .link-novo { display: flex; gap: 8px; align-items: end; flex-wrap: wrap; }
.editor .link-novo .campo { flex: 1 1 260px; }
.editor .link-novo .entrada-texto { font: 500 12.5px var(--f-mono); }

/* O link público: o quadro inteiro, com a marca, o nome do fluxo e as condições do link em cima. */
.editor.visualizador { height: 100dvh; padding: 12px 16px; grid-template-rows: auto minmax(0, 1fr) auto; }
.editor .topo-link { gap: 8px 16px; }
.editor .titulo-link { display: grid; min-width: 0; }
.editor .titulo-link .mudo { font-size: 12px; }
.editor .titulo-link h1 { font-size: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.editor .selos-link { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; font-size: 12.5px; }
.editor .rodape-link { text-align: center; font: 500 11px var(--f-mono); color: var(--ink-3); letter-spacing: .04em; }
@media (max-width: 820px) {
  .editor.visualizador { padding: 8px; }
  .editor .topo-link .empurra { margin-left: 0; width: 100%; }
}
/* Tela baixa (celular deitado): a gaveta à esquerda e o cartão do play à direita, lado a lado, sem um cobrir o outro. */
@media (max-height: 600px) and (min-width: 600px) {
  .editor.com-gaveta .gaveta { width: calc(50% - 18px); max-height: calc(100% - 24px); top: 12px; min-height: 0; }
  .editor.com-gaveta .cartao-sim { left: auto; right: 12px; transform: none; width: min(440px, calc(50% - 18px)); max-height: calc(100% - 26px); overflow: auto; }
}
```

- [ ] **Passo 9: a página do editor carrega as listas**

`apps/web/src/app/e/[empresa]/f/[fluxo]/page.tsx`:

```diff
diff --git a/apps/web/src/app/e/[empresa]/f/[fluxo]/page.tsx b/apps/web/src/app/e/[empresa]/f/[fluxo]/page.tsx
index 7fcc4b6..c440207 100644
--- a/apps/web/src/app/e/[empresa]/f/[fluxo]/page.tsx
+++ b/apps/web/src/app/e/[empresa]/f/[fluxo]/page.tsx
@@ -2,7 +2,8 @@ import type { Metadata } from 'next';
 import { unstable_rethrow } from 'next/navigation';
 import { cache } from 'react';
 import { Editor } from '@/componentes/editor/Editor';
-import { cadastros, canais, fluxoParaEditar, tiposCadastro } from '@/lib/dados';
+import { cadastros, canais, cenarios, fluxoParaEditar, intencionais, links, tiposCadastro, versoes } from '@/lib/dados';
+import { linkPublicoConfigurado } from '@/lib/link';
 
 type Props = { params: Promise<{ empresa: string; fluxo: string }> };
 
@@ -25,7 +26,16 @@ export async function generateMetadata({ params }: Props): Promise<Metadata> {
 
 export default async function PaginaEditor({ params }: Props) {
   const { empresa: empresaId, fluxo: fluxoId } = await params;
-  const [f, cs, ks, ts] = await Promise.all([fluxoDoPedido(empresaId, fluxoId), canais(empresaId), cadastros(empresaId), tiposCadastro(empresaId)]);
+  const [f, cs, ks, ts, is, cens, vs, ls] = await Promise.all([
+    fluxoDoPedido(empresaId, fluxoId),
+    canais(empresaId),
+    cadastros(empresaId),
+    tiposCadastro(empresaId),
+    intencionais(empresaId, fluxoId),
+    cenarios(empresaId, fluxoId),
+    versoes(empresaId, fluxoId),
+    links(empresaId, fluxoId),
+  ]);
   // Canal arquivado some da lista, a não ser que o fluxo ainda use (como principal ou numa peça).
   const usados = new Set([f.canal, ...f.documento.pecas.map((p) => p.canal)]);
   return (
@@ -35,6 +45,11 @@ export default async function PaginaEditor({ params }: Props) {
       canais={cs.filter((c) => !c.arquivado || usados.has(c.chave)).map(({ chave, nome, cor }) => ({ chave, nome, cor }))}
       cadastros={ks}
       tipos={ts}
+      intencionais={is}
+      cenarios={cens}
+      versoes={vs}
+      links={ls}
+      linkConfigurado={linkPublicoConfigurado()}
     />
   );
 }
```

- [ ] **Passo 10: rodar e ver passar**

Run: `npm run typecheck && cd apps/web && npx playwright test e2e/editor.spec.ts e2e/fluxos.spec.ts e2e/cadastros.spec.ts e2e/diagnostico.spec.ts e2e/cenarios.spec.ts --trace=off`
Expected: `tsc` limpo; `8 passed` (os do editor, fluxos e cadastros seguem passando: o play saiu do Editor sem mudar).

- [ ] **Passo 11: commit**

```bash
git add apps/web
git commit -m "editor: o play num hook; diagnóstico, cenários, versões e compartilhar" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 8: a página do link público

**Arquivos:**
- Criar: `apps/web/e2e/compartilhar.spec.ts`
- Criar: `apps/web/src/componentes/editor/Visualizador.tsx`, `apps/web/src/app/l/[token]/{page.tsx,error.tsx,not-found.tsx}`

- [ ] **Passo 1: o teste de ponta a ponta** (critério 3, revogar, versão fixa, celular)

`apps/web/e2e/compartilhar.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

const salvo = (page: Page) => expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });

async function empresaComSac(page: Page, request: Parameters<typeof entrar>[1], prefixo: string) {
  await entrar(page, request, emailNovo(prefixo));
  await page.getByLabel('Nome da empresa').fill(`Empresa ${prefixo}`);
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('button', { name: /SAC por e-mail/ }).click();
  await expect(page).toHaveURL(/\/f\//);
  await salvo(page);
}

/** Abre o "Compartilhar", escolhe as opções e cria; devolve o endereço. */
async function criarLink(page: Page, opcoes: { versao?: string; cenario?: string } = {}) {
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Compartilhar' });
  if (opcoes.versao) await dialogo.getByLabel('Versão').selectOption({ label: opcoes.versao });
  if (opcoes.cenario) await dialogo.getByLabel('Cenário que toca ao abrir').selectOption({ label: opcoes.cenario });
  await dialogo.getByRole('button', { name: 'Criar link' }).click();
  const endereco = await dialogo.getByTestId('link-novo').inputValue();
  expect(endereco).toMatch(/\/l\/[A-Za-z0-9_-]{24}$/);
  return endereco;
}

test('critério 3: o cenário salvo vai num link; sem conta, ele toca até o fim, sem o nome da pessoa; revogado, não abre', async ({ page, request, browser }) => {
  test.setTimeout(150_000);
  await empresaComSac(page, request, 'compartilhar');
  // A Triagem passa a ser de uma pessoa: o link (com nomes escondidos) não pode mostrar o nome dela.
  await page.getByRole('button', { name: 'Atendimento: Triagem' }).click();
  const resp = page.getByRole('combobox', { name: /Quem atende/ });
  await resp.fill('Marta Quitéria');
  await resp.press('Enter');
  await expect(page.getByRole('button', { name: 'Atendimento: Triagem' })).toContainText('Marta Quitéria');
  await salvo(page);

  await page.getByRole('button', { name: 'Dar play' }).click();
  const sim = page.getByRole('region', { name: 'Simulação' });
  await sim.getByRole('button', { name: /cliente confirmou/ }).click({ timeout: 20_000 });
  await expect(page.getByTestId('fim')).toContainText('Chegou em: Resolvido', { timeout: 20_000 });
  await sim.getByRole('button', { name: 'Salvar cenário' }).click();
  await sim.getByLabel('Nome do cenário').fill('Cliente confirma');
  await sim.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cenários (1)' })).toBeVisible();
  await sim.getByRole('button', { name: 'Fechar' }).click();

  const endereco = await criarLink(page, { cenario: 'Cliente confirma' });
  const dialogo = page.getByRole('dialog', { name: 'Compartilhar' });
  await expect(dialogo.getByTestId('link')).toHaveCount(1);

  // Sem conta: o cenário toca sozinho até o fim.
  const anonimo = await browser.newContext();
  const p2 = await anonimo.newPage();
  await p2.goto(endereco);
  await expect(p2.getByRole('heading', { name: 'SAC por e-mail' })).toBeVisible();
  await expect(p2.getByTestId('fim')).toContainText('Chegou em: Resolvido', { timeout: 30_000 });
  await expect(p2.getByRole('button', { name: 'Atendimento: Triagem' })).toContainText('Pessoa 1');
  const html = await p2.content();
  expect(html).not.toContain('Marta');
  expect(html).not.toContain('Quitéria');

  // Duplo clique em "Revogar" não confirma sozinho: o segundo clique cai no "Não revogar" (que fica com o foco) e é ignorado.
  await dialogo.getByRole('button', { name: 'Revogar', exact: true }).dblclick();
  await expect(dialogo.getByRole('button', { name: 'Não revogar' })).toBeFocused();
  await expect(dialogo.getByTestId('link')).toContainText('ativo');
  // Revogar: o link deixa de abrir.
  await dialogo.getByRole('button', { name: 'Revogar pra sempre' }).click();
  await expect(dialogo.getByTestId('link')).toContainText('revogado');
  await p2.reload();
  await expect(p2.getByRole('heading', { name: 'Este link foi revogado' })).toBeVisible();
  // Token que não existe: a página explica (404).
  const nada = await p2.goto(endereco.replace(/[^/]+$/, 'a'.repeat(24)));
  expect(nada?.status()).toBe(404);
  await expect(p2.getByRole('heading', { name: 'Este link não existe' })).toBeVisible();
  await anonimo.close();
});

test('versão: o link da versão marcada mostra o de antes; restaurar volta e Ctrl+Z desfaz', async ({ page, request, browser }) => {
  test.setTimeout(150_000);
  await empresaComSac(page, request, 'versoes');
  await page.getByRole('button', { name: 'Versões' }).click();
  const pop = page.getByRole('dialog', { name: 'Versões' });
  await pop.getByLabel('Nome da versão').fill('antes da triagem nova');
  await pop.getByRole('button', { name: 'Marcar versão' }).click();
  await expect(pop.getByTestId('versao')).toContainText('1. antes da triagem nova');
  await pop.getByRole('button', { name: 'Fechar' }).click();

  await page.getByRole('button', { name: 'Atendimento: Triagem' }).dblclick();
  await page.getByLabel('Nome da peça').fill('Triagem nova');
  await page.getByLabel('Nome da peça').press('Enter');
  await salvo(page);

  const endereco = await criarLink(page, { versao: 'versão 1 — antes da triagem nova' });
  await page.getByRole('dialog', { name: 'Compartilhar' }).getByRole('button', { name: 'Fechar' }).click();
  // No celular: dá pra ver e dar play, sem rolar pro lado.
  const anonimo = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await anonimo.newPage();
  await p2.goto(endereco);
  await expect(p2.getByRole('button', { name: 'Atendimento: Triagem' })).toBeAttached();
  await expect(p2.getByRole('button', { name: 'Atendimento: Triagem nova' })).toHaveCount(0);
  await expect(p2.getByText(/versão 1 — antes da triagem nova/)).toBeVisible();
  expect(await p2.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await p2.getByRole('button', { name: 'Dar play' }).click();
  await expect(p2.getByRole('region', { name: 'Simulação' })).toBeVisible();
  await anonimo.close();

  await page.getByRole('button', { name: 'Versões' }).click();
  await pop.getByRole('button', { name: 'Restaurar' }).click();
  await pop.getByRole('button', { name: 'Restaurar a versão 1' }).click();
  await expect(page.getByRole('button', { name: 'Atendimento: Triagem' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atendimento: Triagem nova' })).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Atendimento: Triagem nova' })).toBeVisible();
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd apps/web && npx playwright test e2e/compartilhar.spec.ts --trace=off`
Expected: FAIL (o link criado dá 404: a página não existe).

- [ ] **Passo 3: o visualizador**

`apps/web/src/componentes/editor/Visualizador.tsx`:

```tsx
'use client';

import './editor.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { diagnosticar, type Achado } from '@journey/fluxo';
import { dataCurta } from '@/compartilhar/opcoes';
import type { Retrato } from '@/compartilhar/retrato';
import { Icone } from '@/componentes/Icone';
import { Marca } from '@/componentes/Marca';
import { playDoCenario } from '@/editor/cenarios';
import { caminhoAte, focoDoAchado, pecaDoAchado, rotuloAchados, separar, simulaveis } from '@/editor/diagnostico';
import type { Selecao } from '@/editor/documento';
import { corDoCanal } from '@/editor/estilo';
import { agora } from '@/editor/play';
import { CartaoPlay } from './CartaoPlay';
import { Gaveta } from './Gaveta';
import { Quadro, type QuadroApi } from './Quadro';
import { useAnuncioAdiado } from './useAnuncioAdiado';
import { usePlay } from './usePlay';

const nada = () => {};

/**
 * O link público: o fluxo só de leitura (o quadro do editor), o play (o cenário inicial toca sozinho) e o diagnóstico
 * só leitura, com os intencionais e a nota. Sem trava, sem salvamento, sem painel. Tudo vem do retrato montado no
 * servidor: o navegador de quem abre não fala com o banco.
 */
export function Visualizador({ retrato: r }: { retrato: Retrato }) {
  const quadro = useRef<QuadroApi>(null);
  const [sel, setSel] = useState<Selecao>(null);
  const [destaque, setDestaque] = useState<ReadonlySet<string> | null>(null);
  const [gaveta, setGaveta] = useState(false);
  const [velocidade, setVelocidade] = useState(r.estilo.velocidade);
  const [aviso, setAviso] = useState<string | null>(null);
  const doc = r.documento;
  const ctx = useMemo(() => ({ cadastros: r.cadastros, canal: r.fluxo.canal }), [r]);
  const nomesCadastros = useMemo(() => new Map(r.cadastros.map((k) => [k.id, k.nome])), [r]);
  const estilo = useMemo(() => ({ ...r.estilo, velocidade }), [r, velocidade]);

  const pl = usePlay({
    doc,
    ctx,
    velocidade,
    autoEscolha: r.estilo.autoEscolha,
    camera: r.estilo.camera,
    quadro,
    avisar: setAviso,
    aoComecar: () => setDestaque(null),
  });

  // O cenário inicial toca sozinho, uma vez.
  const tocou = useRef(false);
  useEffect(() => {
    if (tocou.current || !r.cenario) return;
    tocou.current = true;
    pl.tocar(playDoCenario(r.cenario));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2600);
    return () => clearTimeout(t);
  }, [aviso]);

  const botaoDiagnostico = useRef<HTMLButtonElement>(null);
  /** Fechar a gaveta tira o holofote do achado junto. */
  const mudarGaveta = (aberta: boolean) => {
    setGaveta(aberta);
    if (!aberta) setDestaque(null);
  };
  // Tela pequena nos dois sentidos: com o play, a gaveta fecha pra não cobrir o cartão. Deitado e mais largo, as
  // duas cabem lado a lado (editor.css).
  useEffect(() => {
    if (pl.ativo && matchMedia('(max-height: 600px) and (max-width: 599px)').matches) mudarGaveta(false);
  }, [pl.ativo]);

  // Teclas das opções do play; Esc tira o holofote. Na gaveta, só o Esc (tira o holofote, ou fecha a gaveta).
  const teclas = useRef<(e: KeyboardEvent) => void>(nada);
  teclas.current = (e) => {
    const alvo = e.target as Element | null;
    if (alvo?.closest?.('input, textarea, select')) return;
    if (alvo?.closest?.('.gaveta')) {
      if (e.key !== 'Escape') return;
      if (destaque) return setDestaque(null);
      mudarGaveta(false);
      return botaoDiagnostico.current?.focus();
    }
    if (pl.tecla(e)) return;
    if (e.key === 'Escape') setDestaque(null);
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => teclas.current(e);
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, []);

  const achados = useMemo(() => diagnosticar(doc, { cadastros: r.cadastros, ...(r.fluxo.meta_s && { meta_s: r.fluxo.meta_s }) }), [doc, r]);
  const separados = useMemo(() => separar(achados, r.intencionais), [achados, r]);
  const marcas = useMemo(() => new Map(r.intencionais.map((i) => [i.chave, { nota: i.nota, autor: null, criado_em: '' }])), [r]);
  // Uma busca pro documento; o caminho (que roda o motor) só no clique.
  const comCaminho = useMemo(() => simulaveis(doc, achados), [doc, achados]);
  const anuncio = useAnuncioAdiado(`Diagnóstico: ${rotuloAchados(separados.abertos.length)}`);
  const verNoQuadro = (a: Achado) => {
    const f = focoDoAchado(doc, a);
    if (!f) return;
    pl.parar();
    setSel(f.sel);
    setDestaque(f.destaque);
    quadro.current?.enquadrar(f.enquadrar);
  };
  const simularAte = (a: Achado) => {
    const alvo = pecaDoAchado(doc, a);
    const p = alvo && caminhoAte(doc, ctx, alvo, pl.play?.quando ?? agora());
    if (!alvo || !p) return setAviso('Nenhum Início chega nesta peça.');
    pl.tocar(p, alvo);
  };

  const versao = r.versao ? `versão ${r.versao.numero} — ${r.versao.nome}, de ${dataCurta(r.de)}` : 'o fluxo de agora';
  const corAgua = (canal: string | null) => corDoCanal(r.estilo, r.canais, canal ?? r.fluxo.canal);

  return (
    <div className={`editor visualizador${r.estilo.ondas ? ' ondas' : ''}${r.estilo.holofote ? ' holofote-on' : ''}${pl.vis?.pergunta ? ' escolhendo' : destaque ? ' destacando' : ''}${pl.ativo ? ' com-play' : ''}${gaveta ? ' com-gaveta' : ''}`}>
      <header className="topo topo-link">
        <Marca href={null} />
        <div className="titulo-link">
          <span className="mudo">{r.empresa.nome}</span>
          <h1>{r.fluxo.nome}</h1>
        </div>
        <div className="selos-link">
          <span className="selo info">só leitura</span>
          <span className="mudo">{versao}</span>
          {r.esconderNomes && <span className="selo info">nomes escondidos</span>}
          <span className="mudo">{r.expiraEm ? `vale até ${dataCurta(r.expiraEm)}` : 'sem prazo'}</span>
        </div>
        <div className="empurra">
          <button
            ref={botaoDiagnostico}
            className="botao"
            type="button"
            aria-expanded={gaveta}
            aria-controls={gaveta ? 'gaveta-diagnostico' : undefined}
            onClick={() => mudarGaveta(!gaveta)}
            data-testid="botao-diagnostico"
          >
            <Icone nome="alerta" />
            {rotuloAchados(separados.abertos.length)}
          </button>
          <button className="botao primario b-play" type="button" onClick={pl.ativo ? pl.parar : () => pl.darPlay(sel?.tipo === 'peca' ? sel.id : null)}>
            <Icone nome={pl.ativo ? 'parar' : 'play'} />
            {pl.ativo ? 'Parar' : 'Dar play'}
          </button>
        </div>
      </header>
      <div className="quadro-e-gaveta">
        <Quadro
          ref={quadro}
          doc={pl.play ? pl.docPlay : doc}
          estilo={estilo}
          canais={r.canais}
          canalFluxo={r.fluxo.canal}
          nomesCadastros={nomesCadastros}
          sel={sel}
          ferramenta="selecionar"
          soLeitura
          play={pl.vis}
          pausado={pl.pausado}
          aoAguaChegar={pl.aguaChegou}
          renomeando={null}
          destaque={destaque}
          acoes={{
            selecionar: (s) => {
              setSel(s);
              setDestaque(null);
            },
            criar: nada,
            criarLigada: nada,
            ligar: nada,
            mudar: nada,
            renomear: nada,
            gravarNome: nada,
            escolher: pl.escolher,
            usarFerramenta: nada,
          }}
        >
          {pl.ativo && (
            <CartaoPlay
              doc={pl.docPlay}
              play={pl.play}
              visual={pl.vis}
              pausado={pl.pausado}
              velocidade={velocidade}
              autoEscolha={r.estilo.autoEscolha}
              corAgua={corAgua}
              canais={r.canais}
              inicios={pl.escolhendoInicio}
              acoes={{
                escolher: pl.escolher,
                pausar: pl.pausar,
                voltar: pl.voltar,
                recomecar: pl.recomecar,
                parar: pl.parar,
                velocidade: setVelocidade,
                quando: pl.mudarQuando,
                relogio: pl.mudarRelogio,
                comecarEm: pl.comecarEm,
              }}
            />
          )}
        </Quadro>
        {gaveta && (
          <Gaveta
            id="gaveta-diagnostico"
            abertos={separados.abertos}
            intencionais={separados.intencionais}
            antigos={[]}
            marcas={marcas}
            podeSimular={(a) => comCaminho.has(a.chave)}
            soLeitura
            acoes={{ verNoQuadro, simularAte, marcar: async () => false, desmarcar: nada }}
          />
        )}
      </div>
      <footer className="rodape-link">Feito com Journey</footer>
      <div role="status">{aviso && <div className="aviso">{aviso}</div>}</div>
      <div className="so-leitor" role="status">
        {anuncio}
      </div>
    </div>
  );
}
```

- [ ] **Passo 4: a página**

`apps/web/src/app/l/[token]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dataCurta } from '@/compartilhar/opcoes';
import { Marca } from '@/componentes/Marca';
import { Visualizador } from '@/componentes/editor/Visualizador';
import { abrirLink, type LinkAberto } from '@/lib/link';

type Props = { params: Promise<{ token: string }> };

const INDISPONIVEL = { title: 'Link indisponível · Journey' };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Se o link não abre por falha, o título não fica vazio: a página estoura o mesmo erro e cai no error.tsx.
  const l = await abrirLink((await params).token).catch(() => null);
  if (l?.estado !== 'ok') return INDISPONIVEL;
  return { title: `${l.retrato.cenario?.nome ?? l.retrato.fluxo.nome} · Journey` };
}

const AVISOS: Record<'revogado' | 'vencido', { titulo: string; texto: (quando: string) => string }> = {
  revogado: { titulo: 'Este link foi revogado', texto: (q) => `Quem compartilhou tirou o acesso em ${dataCurta(q)}. Pede um link novo pra quem te mandou.` },
  vencido: { titulo: 'Este link venceu', texto: (q) => `Ele valia até ${dataCurta(q)}. Pede um link novo pra quem te mandou.` },
};

/** Revogado ou vencido: uma página que explica, com a data, sem nada do fluxo. */
function Indisponivel({ l }: { l: Extract<LinkAberto, { estado: 'revogado' | 'vencido' }> }) {
  const a = AVISOS[l.estado];
  return (
    <main className="entrar">
      <div className="cartao" data-testid="link-indisponivel">
        <Marca href={null} />
        <h1>{a.titulo}</h1>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>{a.texto(l.quando)}</p>
      </div>
    </main>
  );
}

/**
 * O link público (spec, 14): um retrato só de leitura montado no servidor. Quem abre não tem conta e o navegador
 * dele não fala com o banco; os nomes já saíram em `abrirLink`. O título e a página leem o link uma vez (cache do React).
 */
export default async function PaginaLink({ params }: Props) {
  const l = await abrirLink((await params).token);
  if (l.estado === 'inexistente') notFound();
  if (l.estado !== 'ok') return <Indisponivel l={l} />;
  return <Visualizador retrato={l.retrato} />;
}
```

`apps/web/src/app/l/[token]/error.tsx`:

```tsx
'use client';

import { Marca } from '@/componentes/Marca';

/**
 * Quando o link não abre por falha (banco fora do ar, chave secreta faltando no servidor, documento do fluxo que não
 * é um journey/2 válido). Revogado, vencido e inexistente não chegam aqui: a página explica cada um. Em produção o
 * Next esconde a mensagem: só o código.
 */
export default function ErroDoLink({ error, retry }: { error: unknown; retry: () => void }) {
  const codigo = error instanceof Error && 'digest' in error ? String(error.digest) : null;
  return (
    <main className="entrar">
      {/* Sem metadata num componente cliente: o React 19 leva o <title> pro <head>. */}
      <title>Link indisponível · Journey</title>
      <div className="cartao">
        <Marca href={null} />
        <h1>Não deu pra abrir este link agora</h1>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>
          Tenta de novo em instantes. Se continuar, avisa quem te mandou o link.
          {codigo && <span className="mono"> (código {codigo})</span>}
        </p>
        <button className="botao primario" onClick={() => retry()}>
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
```

`apps/web/src/app/l/[token]/not-found.tsx`:

```tsx
import { Marca } from '@/componentes/Marca';

/** Token que não existe (ou que não tem o formato de um): explica sem dizer mais nada. */
export default function LinkInexistente() {
  return (
    <main className="entrar">
      <title>Link indisponível · Journey</title>
      <div className="cartao" data-testid="link-indisponivel">
        <Marca href={null} />
        <h1>Este link não existe</h1>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>Confere se o endereço chegou inteiro. Se chegou, pede um link novo pra quem te mandou.</p>
      </div>
    </main>
  );
}
```

- [ ] **Passo 5: rodar e ver passar**

Run: `npm run typecheck && npm run build && cd apps/web && npx playwright test e2e/compartilhar.spec.ts --trace=off`
Expected: `tsc` limpo; build com `/l/[token]` dinâmica (`ƒ`); `2 passed`.

Confira também que a chave não foi pro navegador: `grep -rl "SUPABASE_SECRET_KEY\|abrir_link" apps/web/.next/static` não acha nada.

- [ ] **Passo 6: commit**

```bash
git add apps/web
git commit -m "link público: o quadro só leitura, o play do cenário inicial e o diagnóstico" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 9: a página de entrar

**Arquivos:**
- Modificar: `apps/web/e2e/entrar.spec.ts`, `apps/web/e2e/apoio.ts`
- Substituir: `apps/web/src/app/entrar/page.tsx`, `apps/web/src/app/entrar/formulario.tsx`
- Criar: `apps/web/src/app/entrar/{mensagens.ts,animacao.tsx,previa.tsx,entrar.css}`, `apps/web/test/app/entrar.test.ts`

- [ ] **Passo 1: os testes**

`apps/web/test/app/entrar.test.ts` (o erro do Supabase em português, sem ler o texto em inglês):

```ts
import { describe, expect, it } from 'vitest';
import { mensagemDoErro } from '@/app/entrar/mensagens';

describe('entrar: o erro ao pedir o link', () => {
  it('limite do Supabase (429 ou o código): em português, e o "enviado" continua valendo', () => {
    const limite = { texto: 'Já mandamos um link há pouco. Espera um minuto e manda de novo.', limite: true };
    expect(mensagemDoErro({ status: 429, message: 'For security purposes, you can only request this after 58 seconds.' })).toEqual(limite);
    expect(mensagemDoErro({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' })).toEqual(limite);
  });

  it('e-mail inválido e o resto: em português, sem o texto em inglês', () => {
    expect(mensagemDoErro({ status: 400, code: 'email_address_invalid', message: 'Email address "x" is invalid' })).toEqual({ texto: 'Confere o e-mail: ele não parece certo.', limite: false });
    expect(mensagemDoErro({ status: 500, message: 'Error sending magic link email' })).toEqual({ texto: 'Não deu pra mandar o link agora. Tenta de novo em instantes.', limite: false });
  });
});
```

`apps/web/e2e/entrar.spec.ts`:

```diff
diff --git a/apps/web/e2e/entrar.spec.ts b/apps/web/e2e/entrar.spec.ts
index 89b3437..08bce8e 100644
--- a/apps/web/e2e/entrar.spec.ts
+++ b/apps/web/e2e/entrar.spec.ts
@@ -11,3 +11,52 @@ test('quem entra pela primeira vez cai em criar a empresa', async ({ page, reque
   await expect(page).toHaveURL(/\/empresa\/nova$/);
   await expect(page.getByRole('heading', { name: 'Tua empresa' })).toBeVisible();
 });
+
+test('no celular, sem rolar pro lado: pede o link, vê pra onde foi e pode usar outro e-mail', async ({ browser }) => {
+  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
+  const page = await ctx.newPage();
+  await page.goto('/entrar');
+  await expect(page.getByRole('heading', { name: 'Desenha o fluxo e dá play.' })).toBeVisible();
+  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
+  const email = emailNovo('celular');
+  await expect(page.getByRole('button', { name: 'Receber o link' })).toBeEnabled();
+  await page.getByLabel('E-mail').fill(email);
+  await page.getByRole('button', { name: 'Receber o link' }).click();
+  await expect(page.getByRole('status')).toContainText(`Link enviado para ${email}`);
+  // O e-mail fica no campo, pra conferir (e mandar de novo, se precisar).
+  await expect(page.getByLabel('E-mail')).toHaveValue(email);
+  // Logo depois, o botão espera (o Supabase recusa outro pedido em menos de um minuto) e diz quanto falta.
+  await expect(page.getByRole('button', { name: /Mandar de novo em \d+ s/ })).toHaveAttribute('aria-disabled', 'true');
+  await page.getByRole('button', { name: 'Usar outro e-mail' }).click();
+  await expect(page.getByLabel('E-mail')).toHaveValue('');
+  await expect(page.getByLabel('E-mail')).toBeFocused();
+  await ctx.close();
+});
+
+test('link expirado: a página diz e deixa pedir outro', async ({ page }) => {
+  await page.goto('/entrar?erro=link');
+  await expect(page.getByRole('alert').filter({ hasText: 'O link expirou ou já foi usado' })).toBeVisible();
+  await expect(page.getByRole('button', { name: 'Receber o link' })).toBeEnabled();
+});
+
+test('antes de a página ficar pronta, o Enter não manda o e-mail pela URL', async ({ browser }) => {
+  // Sem JavaScript é a janela de antes da hidratação, esticada: o botão vem desligado do servidor.
+  const ctx = await browser.newContext({ javaScriptEnabled: false });
+  const page = await ctx.newPage();
+  await page.goto('/entrar?erro=link');
+  await expect(page.getByRole('button', { name: 'Receber o link' })).toBeDisabled();
+  await page.getByLabel('E-mail').fill('alguem@exemplo.com');
+  await page.getByLabel('E-mail').press('Enter');
+  await page.waitForLoadState('load');
+  expect(page.url()).not.toContain('alguem');
+  await ctx.close();
+});
+
+test('movimento reduzido: a prévia é decorativa e fica parada', async ({ browser }) => {
+  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
+  const page = await ctx.newPage();
+  await page.goto('/entrar');
+  await expect(page.locator('.previa[aria-hidden="true"]')).toBeVisible();
+  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
+  await ctx.close();
+});
```

`apps/web/e2e/apoio.ts` (o `entrar()` espera o botão ligar: ele só liga depois de a página hidratar):

```diff
diff --git a/apps/web/e2e/apoio.ts b/apps/web/e2e/apoio.ts
index e74451a..108e17b 100644
--- a/apps/web/e2e/apoio.ts
+++ b/apps/web/e2e/apoio.ts
@@ -5,6 +5,8 @@ const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
 /** Entra pelo link mágico: pede o link na tela e abre o que chegou no Mailpit do Supabase local. */
 export async function entrar(page: Page, request: APIRequestContext, email: string) {
   await page.goto('/entrar');
+  // O botão só liga depois que a página fica pronta (antes, o Enter mandaria o formulário pelo navegador).
+  await expect(page.getByRole('button', { name: 'Receber o link' })).toBeEnabled();
   await page.getByLabel('E-mail').fill(email);
   await page.getByRole('button', { name: 'Receber o link' }).click();
   await expect(page.getByRole('status')).toContainText('Link enviado');
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/app/entrar.test.ts; npx playwright test e2e/entrar.spec.ts --trace=off`
Expected: FAIL, `Failed to resolve import "@/app/entrar/mensagens"`; na ponta a ponta, os casos novos ("Link enviado para …", a espera do reenvio, o envio antes da hidratação, a prévia parada com movimento reduzido, sem rolagem lateral em 390 px).

- [ ] **Passo 3: as mensagens**

`apps/web/src/app/entrar/mensagens.ts`:

```ts
/** O erro do Supabase ao pedir o link, como chega no navegador: o status HTTP e o código, quando há. */
export interface ErroDoLink {
  status?: number;
  code?: string;
  message: string;
}

/** Quanto o botão espera depois de mandar (o Supabase recusa outro pedido pro mesmo e-mail por 60 s). */
export const ESPERA_REENVIO_S = 30;
/** Depois de uma recusa por limite, o tempo inteiro do Supabase. */
export const ESPERA_LIMITE_S = 60;

/**
 * O texto pra pessoa, em português, pelo código e pelo status (nunca pelo texto, que é em inglês e muda). `limite`:
 * o pedido foi recusado por ter vindo cedo demais; o aviso de "enviado" continua valendo.
 */
export function mensagemDoErro(e: ErroDoLink): { texto: string; limite: boolean } {
  if (e.status === 429 || e.code === 'over_email_send_rate_limit' || e.code === 'over_request_rate_limit')
    return { texto: 'Já mandamos um link há pouco. Espera um minuto e manda de novo.', limite: true };
  if (e.code === 'email_address_invalid' || e.code === 'validation_failed') return { texto: 'Confere o e-mail: ele não parece certo.', limite: false };
  return { texto: 'Não deu pra mandar o link agora. Tenta de novo em instantes.', limite: false };
}
```

- [ ] **Passo 4: a página**

`apps/web/src/app/entrar/page.tsx`:

```tsx
import './entrar.css';
import { Marca } from '@/componentes/Marca';
import { FormularioEntrar } from './formulario';
import { PreviaFluxo } from './previa';

export const metadata = { title: 'Entrar · Journey' };

/**
 * Entrar: de um lado o que o Journey é e o formulário (link por e-mail, Google se estiver ligado), do outro uma
 * prévia do quadro com a água andando. A página é leve: nada do editor nem do pacote do fluxo.
 */
export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="entrada">
      <div className="lado-form">
        <Marca href={null} />
        <div className="chamada">
          <h1>Desenha o fluxo e dá play.</h1>
          <p className="lead">
            Um quadro pro atendimento de qualquer canal: telefonia, WhatsApp, e-mail, chat ou uma esteira interna. No play, a água anda pelos canos, muda de cor
            quando o canal muda, para nas decisões e mostra quanto tempo o cliente levou.
          </p>
        </div>
        {/* O aviso do link vencido fica no formulário: some quando a pessoa pede outro. */}
        <FormularioEntrar google={process.env.NEXT_PUBLIC_LOGIN_GOOGLE === 'sim'} linkVencido={erro === 'link'} />
      </div>
      <PreviaFluxo />
    </main>
  );
}
```

`apps/web/src/app/entrar/formulario.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { ESPERA_LIMITE_S, ESPERA_REENVIO_S, mensagemDoErro } from './mensagens';

/**
 * O pedido do link sai do navegador: o código do PKCE fica num cookie deste navegador,
 * e o /auth/callback troca o código pela sessão. Pedido pelo servidor, o cookie não chega aqui.
 */
export function FormularioEntrar({ google, linkVencido }: { google: boolean; linkVencido: boolean }) {
  // Antes de o React assumir a página, o botão fica desligado: um Enter ali mandaria o formulário pelo navegador
  // (pra URL). Com o botão de envio desligado, o navegador não manda nem pelo Enter.
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  // Controlado e sem `name`: o e-mail continua no campo depois de enviar, e nunca vai pra URL.
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(linkVencido ? 'O link expirou ou já foi usado. Pede outro.' : null);
  // Até quando (relógio daqui) o botão espera pra mandar de novo pro mesmo e-mail.
  const [esperaAte, setEsperaAte] = useState(0);
  const [agora, setAgora] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const destino = () => `${window.location.origin}/auth/callback`;

  // O relógio da espera anda de segundo em segundo, só enquanto há espera.
  useEffect(() => {
    if (!esperaAte) return;
    setAgora(Date.now());
    const t = setInterval(() => {
      const n = Date.now();
      setAgora(n);
      if (n >= esperaAte) {
        setEsperaAte(0);
        clearInterval(t);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [esperaAte]);

  const para = email.trim();
  const mesmoEmail = enviadoPara !== null && para.toLowerCase() === enviadoPara.toLowerCase();
  const faltam = mesmoEmail && esperaAte > agora ? Math.ceil((esperaAte - agora) / 1000) : 0;
  // aria-disabled, e não disabled: o botão continua com o foco (o leitor de tela não perde onde estava).
  const ocupado = enviando || faltam > 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado || !para) return;
    setEnviando(true);
    setErro(null);
    const { error } = await supabaseNavegador().auth.signInWithOtp({ email: para, options: { emailRedirectTo: destino() } });
    setEnviando(false);
    if (error) {
      console.error('[entrar: link por e-mail]', error.status, error.code, error.message);
      const m = mensagemDoErro(error);
      setErro(m.texto);
      // Cedo demais: o link de antes ainda vale, e o aviso de "enviado" fica.
      if (m.limite) setEsperaAte(Date.now() + ESPERA_LIMITE_S * 1000);
      return;
    }
    setEnviadoPara(para);
    setEsperaAte(Date.now() + ESPERA_REENVIO_S * 1000);
  }

  // Dando certo, o navegador sai pro Google; só volta aqui com erro (provedor desligado, rede).
  async function comGoogle() {
    setErro(null);
    const { error } = await supabaseNavegador().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: destino() } });
    if (error) {
      console.error('[entrar com Google]', error.message);
      setErro('Não deu pra entrar com o Google agora. Tenta de novo ou recebe o link por e-mail.');
    }
  }

  return (
    <div className="form-entrar">
      <form onSubmit={enviar} className="form-entrar-email">
        <label className="campo">
          E-mail
          <input ref={campo} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="botao primario" type="submit" disabled={!pronto} aria-disabled={ocupado || undefined}>
          {enviando ? 'Enviando…' : !mesmoEmail ? 'Receber o link' : faltam ? `Mandar de novo em ${faltam} s` : 'Mandar de novo'}
        </button>
        <p className="dica-entrar">Sem senha: chega um link no teu e-mail, e é só abrir.</p>
      </form>
      {/* Montadas vazias: o leitor de tela anuncia o que entra numa região que já existia. */}
      <div role="status">
        {enviadoPara && (
          <p className="aviso-caixa ok enviado">
            Link enviado para <b>{enviadoPara}</b>. Abre o e-mail e o link neste navegador.
          </p>
        )}
      </div>
      {enviadoPara && (
        <button
          className="botao pequeno outro-email"
          type="button"
          onClick={() => {
            setEmail('');
            setEnviadoPara(null);
            setErro(null);
            setEsperaAte(0);
            campo.current?.focus();
          }}
        >
          Usar outro e-mail
        </button>
      )}
      <div role="alert">{erro && <p className="aviso-caixa erro">{erro}</p>}</div>
      {google && (
        <>
          <div className="ou" aria-hidden="true">
            ou
          </div>
          <button className="botao" type="button" disabled={!pronto} onClick={comGoogle}>
            Entrar com Google
          </button>
        </>
      )}
    </div>
  );
}
```

`apps/web/src/app/entrar/previa.tsx`:

```tsx
/**
 * A prévia do quadro na página de entrar: um fluxo pequeno do protótipo (WhatsApp → decisão → e-mail), com a água
 * correndo pelos canos, parando na decisão e trocando de cor quando o fluxo troca de canal. Só SVG e CSS (entrar.css):
 * a página de entrar não carrega o editor nem o pacote do fluxo (o único JavaScript é o `ControleDaAnimacao`, que pausa
 * fora da tela e para depois de algumas voltas). Decorativa: fora do leitor de tela e do Tab. Com movimento reduzido, a
 * água fica parada, já no fim do caminho.
 */

// Os ícones das peças, os mesmos do protótipo (Icone.tsx), desenhados em 24×24.
import { ControleDaAnimacao } from './animacao';

const ICONES = {
  inicio: 'M8 5.2v13.6L19 12z',
  mensagem: 'M4 5h16v11H9.5L5 19.5V16H4z M8 9.5h8 M8 12.5h5',
  atendimento: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4.5 20.5a7.5 7.5 0 0 1 15 0',
  fim: 'M5 21V4 M5 4h11l-2 4 2 4H5',
} as const;

function Peca({ x, y, w, nome, sub, icone, canal, molha }: { x: number; y: number; w: number; nome: string; sub: string; icone: keyof typeof ICONES; canal?: 'wa' | 'email'; molha?: string }) {
  const redonda = icone === 'inicio' || icone === 'fim';
  return (
    <g className={`pv-peca${molha ? ` molha-${molha}` : ''}`} transform={`translate(${x} ${y})`}>
      <rect className="pv-placa" x="0" y="3" width={w} height="52" rx={redonda ? 26 : 12} />
      <rect className="pv-corpo" x="0" y="0" width={w} height="52" rx={redonda ? 26 : 12} />
      {/* O nível da água: aparece quando a água chega na peça. */}
      <rect className={`pv-nivel ${canal === 'email' ? 'c-email' : 'c-wa'}`} x="1.5" y="24" width={w - 3} height="26.5" rx={redonda ? 24 : 10} />
      <rect className={`pv-tile${icone === 'inicio' ? ' c-wa-cheio' : ''}`} x="10" y="10" width="32" height="32" rx={icone === 'inicio' ? 16 : 9} />
      <path className={`pv-icone${icone === 'inicio' ? ' cheio' : ''}`} d={ICONES[icone]} transform="translate(16 16) scale(0.83)" />
      <text className="pv-nome" x="52" y="24">
        {nome}
      </text>
      <text className="pv-sub" x="52" y="40">
        {canal && <tspan className={canal === 'email' ? 'pv-ponto-email' : 'pv-ponto-wa'}>● </tspan>}
        {sub}
      </text>
    </g>
  );
}

/** Um cano: parede, miolo e a água (que enche do começo ao fim, com `pathLength` 1). */
function Cano({ d, agua, cor }: { d: string; agua: string; cor: 'wa' | 'email' }) {
  return (
    <g>
      <path className="pv-parede" d={d} />
      <path className="pv-miolo" d={d} />
      <path className={`pv-agua c-${cor} agua-${agua}`} d={d} pathLength={1} />
    </g>
  );
}

export function PreviaFluxo() {
  return (
    <div className="previa" aria-hidden="true">
      <svg viewBox="0 0 560 400" focusable="false" role="presentation">
        <Cano d="M206 62 H330" agua="a" cor="wa" />
        <Cano d="M425 88 V138" agua="b" cor="wa" />
        <Cano d="M425 252 V300" agua="c" cor="wa" />
        <Cano d="M330 326 H190" agua="d" cor="email" />
        {/* O caminho que a água não toma fica seco. */}
        <Cano d="M368 195 H216" agua="seca" cor="wa" />

        <Peca x={24} y={36} w={182} nome="Cliente chama" sub="WhatsApp" icone="inicio" canal="wa" molha="1" />
        <Peca x={330} y={36} w={192} nome="Boas-vindas" sub="Mensagem" icone="mensagem" molha="2" />
        <Peca x={24} y={169} w={192} nome="Atende o suporte" sub="Fila Suporte" icone="atendimento" />
        <Peca x={330} y={300} w={192} nome="Manda o protocolo" sub="E-mail" icone="mensagem" canal="email" molha="4" />
        <Peca x={24} y={300} w={166} nome="Resolvido" sub="Fim" icone="fim" molha="5" />

        {/* A decisão: um losango, que pulsa enquanto a água espera a escolha. */}
        <g className="pv-decisao" transform="translate(425 195)">
          <rect className="pv-pulso" x="-40" y="-40" width="80" height="80" rx="12" transform="rotate(45)" />
          <rect className="pv-placa" x="-40" y="-37" width="80" height="80" rx="12" transform="rotate(45)" />
          <rect className="pv-losango" x="-40" y="-40" width="80" height="80" rx="12" transform="rotate(45)" />
          <text className="pv-nome" x="0" y="-2" textAnchor="middle">
            Qual
          </text>
          <text className="pv-nome" x="0" y="14" textAnchor="middle">
            assunto?
          </text>
        </g>

        {/* As opções no cano: a escolhida acende. */}
        <g className="pv-opcao" transform="translate(292 195)">
          <rect x="-40" y="-12" width="80" height="24" rx="12" />
          <text x="0" y="4" textAnchor="middle">
            Suporte
          </text>
        </g>
        <g className="pv-opcao pv-escolhida" transform="translate(425 276)">
          <rect x="-46" y="-12" width="92" height="24" rx="12" />
          <text x="0" y="4" textAnchor="middle">
            Protocolo
          </text>
        </g>

        <g className="pv-tempo" transform="translate(24 374)">
          <text x="0" y="0">
            O cliente levou 4 min, do WhatsApp ao e-mail.
          </text>
        </g>
      </svg>
      <ControleDaAnimacao />
    </div>
  );
}
```

`apps/web/src/app/entrar/animacao.tsx` (pausa a prévia fora da tela ou com a aba escondida; para no quadro final depois de três voltas):

```tsx
'use client';

import { useEffect, useRef } from 'react';

/**
 * Quem manda na animação da prévia (que é só CSS): pausa quando a aba some ou a prévia sai da tela (no celular ela
 * fica embaixo do formulário, e a água não precisa correr enquanto a pessoa digita) e, quando as voltas acabam
 * (`animation-iteration-count` no CSS), deixa o quadro final parado. Não desenha nada.
 */
export function ControleDaAnimacao() {
  const marca = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const previa = marca.current?.parentElement;
    if (!previa) return;
    let visivel = document.visibilityState === 'visible';
    let naTela = true;
    const aplicar = () => previa.classList.toggle('pausada', !(visivel && naTela));
    const io = new IntersectionObserver(([e]) => {
      naTela = !!e?.isIntersecting;
      aplicar();
    });
    io.observe(previa);
    const mudouAba = () => {
      visivel = document.visibilityState === 'visible';
      aplicar();
    };
    // As animações têm todas a mesma duração e acabam juntas: a do primeiro cano avisa. Dali em diante, o quadro final.
    const acabou = (e: AnimationEvent) => e.animationName === 'agua-a' && previa.classList.add('terminou');
    document.addEventListener('visibilitychange', mudouAba);
    previa.addEventListener('animationend', acabou);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', mudouAba);
      previa.removeEventListener('animationend', acabou);
    };
  }, []);
  return <span ref={marca} hidden />;
}
```

`apps/web/src/app/entrar/entrar.css`:

```css
/* Entrar: o formulário de um lado, a prévia do quadro do outro. Tokens do globals.css; as duas cores de canal da
   prévia são as dos canais padrão (WhatsApp e E-mail), aqui porque a página não lê os canais de empresa nenhuma. */
.entrada {
  --wa: #159e5a;
  --mail: #c98410;
  /* O texto em cima da água (a opção escolhida): claro no tema claro, escuro no escuro, onde a água é mais clara. */
  --na-agua: #ffffff;
  /* O verde das formas cheias (o Início, a opção escolhida): mais escuro no claro, pro texto branco ter contraste. */
  --wa-forte: #11804a;
  min-height: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: clamp(20px, 5vw, 64px) clamp(16px, 4vw, 56px);
  display: grid;
  grid-template-columns: minmax(0, 430px) minmax(0, 1fr);
  gap: clamp(28px, 6vw, 88px);
  align-items: center;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .entrada { --wa: #2cc274; --mail: #eda63a; --na-agua: #0a1014; --wa-forte: #2cc274; }
}
:root[data-theme='dark'] .entrada { --wa: #2cc274; --mail: #eda63a; --na-agua: #0a1014; --wa-forte: #2cc274; }

.entrada .lado-form { display: grid; gap: 28px; align-content: center; }
.entrada .chamada { display: grid; gap: 14px; }
.entrada h1 { font-size: clamp(36px, 4.4vw, 54px); font-weight: 800; line-height: 1; letter-spacing: -0.035em; text-wrap: balance; }
.entrada .lead { margin: 0; max-width: 44ch; font-size: 15.5px; line-height: 1.55; color: var(--ink-2); }

.entrada .form-entrar { display: flex; flex-direction: column; padding: 18px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; }
.entrada .form-entrar-email { display: grid; gap: 10px; }
/* O espaço vai só entre o que aparece: as regiões vivas ficam montadas mesmo vazias, e vazias não abrem espaço. */
.entrada .form-entrar > :not(:first-child):not(:empty) { margin-top: 12px; }
.entrada .form-entrar .campo input { font-size: 15px; padding: 10px 12px; }
.entrada .form-entrar .botao { padding: 10px 14px; font-size: 14px; }
.entrada .dica-entrar { margin: 0; font-size: 12.5px; color: var(--ink-2); }
.entrada .outro-email { align-self: flex-start; }
.entrada .enviado { display: grid; gap: 10px; justify-items: start; line-height: 1.45; }
.entrada .enviado b { word-break: break-all; }
.entrada .ou { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; font-size: 12.5px; color: var(--ink-2); }
.entrada .ou::before, .entrada .ou::after { content: ''; height: 1px; background: var(--line); }

/* A prévia: o palco do editor (pontos sobre o canvas) com um fluxo pequeno dentro. */
.previa { position: relative; aspect-ratio: 560 / 400; border-radius: 22px; border: 1px solid var(--line); background-color: var(--canvas); background-image: radial-gradient(var(--dot) 1.1px, transparent 1.2px); background-size: 18px 18px; box-shadow: var(--shadow); overflow: hidden; }
.previa svg { display: block; width: 100%; height: 100%; }
.previa text { font-family: var(--f-body); }
.previa .pv-nome { font-size: 13.5px; font-weight: 600; fill: var(--ink); }
.previa .pv-sub { font-size: 11px; fill: var(--ink-2); }
.previa .pv-ponto-wa { fill: var(--wa); }
.previa .pv-ponto-email { fill: var(--mail); }
.previa .pv-placa { fill: var(--plate); }
.previa .pv-corpo { fill: var(--node); stroke: var(--node-line); stroke-width: 1.4; }
.previa .pv-tile { fill: var(--tile); }
.previa .pv-tile.c-wa-cheio { fill: var(--wa-forte); }
.previa .pv-icone { fill: none; stroke: var(--ink-2); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.previa .pv-icone.cheio { fill: #fff; stroke: none; }
.previa .pv-nivel { opacity: 0; }
.previa .pv-nivel.c-wa { fill: var(--wa); }
.previa .pv-nivel.c-email { fill: var(--mail); }
.previa .pv-losango { fill: var(--node); stroke: var(--ink-2); stroke-width: 1.6; }
.previa .pv-pulso { fill: none; stroke: var(--wa); stroke-width: 2.4; opacity: 0; transform-box: fill-box; transform-origin: center; }
.previa .pv-parede { fill: none; stroke: var(--pipe-wall); stroke-width: 12; stroke-linecap: round; }
.previa .pv-miolo { fill: none; stroke: var(--pipe-core); stroke-width: 7; stroke-linecap: round; }
.previa .pv-agua { fill: none; stroke-width: 6; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; }
.previa .pv-agua.c-wa { stroke: var(--wa); }
.previa .pv-agua.c-email { stroke: var(--mail); }
.previa .pv-agua.agua-seca { display: none; }
.previa .pv-opcao rect { fill: var(--node); stroke: var(--node-line); }
.previa .pv-opcao text { font: 500 11.5px var(--f-mono); fill: var(--ink-2); }
.previa .pv-tempo text { font-size: 12.5px; fill: var(--ink-2); opacity: 0; }

/* O play, uma volta de 9 s: a água enche cano por cano, espera na decisão, escolhe "Protocolo", vira e-mail no
   protocolo (a cor muda), chega no fim e mostra o tempo; depois esvazia e recomeça. */
.previa .agua-a { animation: agua-a 9s linear 3; }
.previa .agua-b { animation: agua-b 9s linear 3; }
.previa .agua-c { animation: agua-c 9s linear 3; }
.previa .agua-d { animation: agua-d 9s linear 3; }
.previa .molha-1 .pv-nivel { animation: molha-1 9s linear 3; }
.previa .molha-2 .pv-nivel { animation: molha-2 9s linear 3; }
.previa .molha-4 .pv-nivel { animation: molha-4 9s linear 3; }
.previa .molha-5 .pv-nivel { animation: molha-5 9s linear 3; }
.previa .pv-pulso { animation: pulso-pv 9s ease-out 3; }
.previa .pv-escolhida rect { animation: escolha-rect 9s linear 3; }
.previa .pv-escolhida text { animation: escolha-texto 9s linear 3; }
.previa .pv-tempo text { animation: tempo-pv 9s linear 3; }

@keyframes agua-a { 0% { stroke-dashoffset: 1; opacity: 1; } 11% { stroke-dashoffset: 0; } 88% { stroke-dashoffset: 0; opacity: 1; } 96%, 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes agua-b { 0%, 13% { stroke-dashoffset: 1; opacity: 1; } 19% { stroke-dashoffset: 0; } 88% { stroke-dashoffset: 0; opacity: 1; } 96%, 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes agua-c { 0%, 37% { stroke-dashoffset: 1; opacity: 1; } 43% { stroke-dashoffset: 0; } 88% { stroke-dashoffset: 0; opacity: 1; } 96%, 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes agua-d { 0%, 46% { stroke-dashoffset: 1; opacity: 1; } 57% { stroke-dashoffset: 0; } 88% { stroke-dashoffset: 0; opacity: 1; } 96%, 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes molha-1 { 0% { opacity: 0; } 3%, 88% { opacity: .2; } 96%, 100% { opacity: 0; } }
@keyframes molha-2 { 0%, 11% { opacity: 0; } 13%, 88% { opacity: .2; } 96%, 100% { opacity: 0; } }
@keyframes molha-4 { 0%, 43% { opacity: 0; } 45%, 88% { opacity: .2; } 96%, 100% { opacity: 0; } }
@keyframes molha-5 { 0%, 57% { opacity: 0; } 59%, 88% { opacity: .2; } 96%, 100% { opacity: 0; } }
@keyframes pulso-pv { 0%, 19% { opacity: 0; transform: rotate(45deg) scale(1); } 23% { opacity: .75; } 27% { opacity: 0; transform: rotate(45deg) scale(1.12); } 28% { opacity: 0; transform: rotate(45deg) scale(1); } 31% { opacity: .75; } 35%, 100% { opacity: 0; transform: rotate(45deg) scale(1.12); } }
@keyframes escolha-rect { 0%, 33% { fill: var(--node); stroke: var(--node-line); } 35%, 88% { fill: var(--wa-forte); stroke: var(--wa-forte); } 96%, 100% { fill: var(--node); stroke: var(--node-line); } }
@keyframes escolha-texto { 0%, 33% { fill: var(--ink-2); } 35%, 88% { fill: var(--na-agua); } 96%, 100% { fill: var(--ink-2); } }
@keyframes tempo-pv { 0%, 58% { opacity: 0; } 62%, 88% { opacity: 1; } 96%, 100% { opacity: 0; } }

/* Fora da tela ou com a aba escondida, a água para onde está (ControleDaAnimacao). */
.previa.pausada * { animation-play-state: paused !important; }

/* Movimento reduzido, ou depois das três voltas: a água parada, já no fim do caminho. */
.previa.terminou .pv-agua { stroke-dashoffset: 0; animation: none !important; }
.previa.terminou .pv-nivel, .previa.terminou .pv-pulso, .previa.terminou .pv-tempo text, .previa.terminou .pv-escolhida rect, .previa.terminou .pv-escolhida text { animation: none !important; }
.previa.terminou .molha-1 .pv-nivel, .previa.terminou .molha-2 .pv-nivel, .previa.terminou .molha-4 .pv-nivel, .previa.terminou .molha-5 .pv-nivel { opacity: .2; }
.previa.terminou .pv-escolhida rect { fill: var(--wa-forte); stroke: var(--wa-forte); }
.previa.terminou .pv-escolhida text { fill: var(--na-agua); }
.previa.terminou .pv-tempo text { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .previa .pv-agua { stroke-dashoffset: 0; animation: none !important; }
  .previa .pv-nivel, .previa .pv-pulso, .previa .pv-tempo text, .previa .pv-escolhida rect, .previa .pv-escolhida text { animation: none !important; }
  .previa .molha-1 .pv-nivel, .previa .molha-2 .pv-nivel, .previa .molha-4 .pv-nivel, .previa .molha-5 .pv-nivel { opacity: .2; }
  .previa .pv-escolhida rect { fill: var(--wa-forte); stroke: var(--wa-forte); }
  .previa .pv-escolhida text { fill: var(--na-agua); }
  .previa .pv-tempo text { opacity: 1; }
}

/* Celular: uma coluna, o formulário primeiro e a prévia menor embaixo. */
@media (max-width: 820px) {
  .entrada { grid-template-columns: minmax(0, 1fr); align-items: start; gap: 28px; }
  .entrada .lado-form { gap: 22px; }
  .previa { max-width: 560px; width: 100%; justify-self: center; box-shadow: none; }
}
/* Bem estreito, a prévia (decorativa) teria letra de 6 px: sai. */
@media (max-width: 419px) {
  .previa { display: none; }
}
```

- [ ] **Passo 5: rodar e ver passar**

Run: `npm run typecheck && cd apps/web && npx vitest run test/app/entrar.test.ts && npx playwright test e2e/entrar.spec.ts --trace=off`
Expected: `tsc` limpo; `Tests  2 passed (2)`; `6 passed`.

- [ ] **Passo 6: commit**

```bash
git add apps/web
git commit -m "entrar: a página redesenhada (formulário e prévia do quadro), sem carregar o editor" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 10: entrar com e-mail e senha, Google e o link (e a conta não se toma)

Pedido do Bruno na aprovação ("só magic link é chato: tem que dar pra logar com Google, e-mail, senha"). Passou por três revisões de segurança: a primeira achou que quem cadastrava o e-mail de outra pessoa antes dela ficava com uma senha que valia depois da confirmação (e entrava na empresa pelo convite); a segunda, o mesmo pela troca de e-mail. As duas estão fechadas no banco e cobertas por pgTAP e ponta a ponta.

**Arquivos:**
- Criar: `supabase/migrations/20261116000000_journey_v2_senha.sql`, `supabase/tests/database/senha.test.sql`, `supabase/templates/{confirmacao,recuperacao,link}.html`
- Modificar: `supabase/config.toml`
- Criar: `apps/web/src/lib/acesso.ts`, `apps/web/src/app/auth/confirm/page.tsx`, `apps/web/src/app/auth/confirmar/route.ts`, `apps/web/src/app/conta/senha/{page.tsx,formulario.tsx}`
- Modificar: `apps/web/src/app/auth/callback/route.ts`, `apps/web/src/app/entrar/{page.tsx,formulario.tsx,entrar.css}`, `apps/web/src/app/e/[empresa]/layout.tsx`, `apps/web/src/app/empresa/nova/page.tsx`, `apps/web/src/app/globals.css`, `apps/web/next.config.ts`
- Apagar: `apps/web/src/app/entrar/mensagens.ts`, `apps/web/test/app/entrar.test.ts` (foram pro `lib/acesso.ts` e `test/lib/acesso.test.ts`)
- Testes: `apps/web/test/lib/acesso.test.ts`, `apps/web/test/app/{callback,confirmar}.test.ts`, `apps/web/e2e/conta.spec.ts` (novos), `apps/web/e2e/{entrar.spec.ts,apoio.ts}`

- [ ] **Passo 1: o banco (a senha some na confirmação; ninguém troca o próprio e-mail)**

`supabase/tests/database/senha.test.sql`:

```sql
-- A senha some quando o e-mail é confirmado, e a pessoa não troca o e-mail (migração 20261116000000).
-- Roda com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- O teste todo é uma transação só: a marca de "conta criada nesta transação" fica com a última conta inserida.
-- Pra simular a confirmação numa transação depois, a marca é limpa antes.
create function pg_temp.outra_transacao() returns void language sql as $$
  select set_config('journey.conta_nova', '', true);
$$;
create function pg_temp.senha(p_id uuid) returns text language sql as $$
  select encrypted_password from auth.users where id = p_id;
$$;

-- Quem cadastrou primeiro (a senha é dele), ainda sem confirmar.
insert into auth.users (id, email, aud, role, encrypted_password, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000e1', 'alvo@exemplo.com', 'authenticated', 'authenticated', 'hash-de-quem-chegou-antes', null);
select is(current_setting('journey.conta_nova'), '00000000-0000-0000-0000-0000000000e1', 'a conta nova fica marcada na transação que a criou');
select pg_temp.outra_transacao();

update auth.users set last_sign_in_at = now() where id = '00000000-0000-0000-0000-0000000000e1';
select is(pg_temp.senha('00000000-0000-0000-0000-0000000000e1'), 'hash-de-quem-chegou-antes', 'mexer em outra coluna não apaga a senha');

update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000e1';
select is(pg_temp.senha('00000000-0000-0000-0000-0000000000e1'), '', 'confirmar o e-mail apaga a senha (como a de quem só entrou por link)');

-- Já confirmada: escolhe a senha dela, e uma confirmação de novo não apaga.
update auth.users set encrypted_password = 'hash-da-dona' where id = '00000000-0000-0000-0000-0000000000e1';
update auth.users set email_confirmed_at = now() + interval '1 minute' where id = '00000000-0000-0000-0000-0000000000e1';
select is(pg_temp.senha('00000000-0000-0000-0000-0000000000e1'), 'hash-da-dona', 'quem já era confirmado fica com a senha');

-- Nasce confirmada num insert só.
insert into auth.users (id, email, aud, role, encrypted_password, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000e2', 'pronta@exemplo.com', 'authenticated', 'authenticated', 'hash-pronta', now());
select is(pg_temp.senha('00000000-0000-0000-0000-0000000000e2'), 'hash-pronta', 'conta que nasce confirmada fica com a senha');

-- Como a API de admin (e o painel) faz: insert e confirmação na mesma transação.
insert into auth.users (id, email, aud, role, encrypted_password, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000e3', 'admin@exemplo.com', 'authenticated', 'authenticated', 'hash-do-admin', null);
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000e3';
select is(pg_temp.senha('00000000-0000-0000-0000-0000000000e3'), 'hash-do-admin', 'criada e confirmada na mesma transação (admin): a senha fica');

-- A marca é só da última conta criada: outra conta, ainda não confirmada, perde a senha ao confirmar.
insert into auth.users (id, email, aud, role, encrypted_password, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000e4', 'outra@exemplo.com', 'authenticated', 'authenticated', 'hash-outra', null);
insert into auth.users (id, email, aud, role, encrypted_password, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000e5', 'depois@exemplo.com', 'authenticated', 'authenticated', 'hash-depois', null);
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000e4';
select is(pg_temp.senha('00000000-0000-0000-0000-0000000000e4'), '', 'a marca de outra conta não protege esta');

-- Troca de e-mail: o pedido da pessoa (o Supabase grava email_change) é recusado; o admin troca `email` direto.
select throws_ok($$ update auth.users set email_change = 'convidada@exemplo.com' where id = '00000000-0000-0000-0000-0000000000e1' $$,
  'P0001', 'trocar o e-mail da conta não é permitido no Journey', 'a pessoa não troca o e-mail da conta');
select lives_ok($$ update auth.users set email_change = '' where id = '00000000-0000-0000-0000-0000000000e1' $$, 'limpar o pedido de troca passa');
select lives_ok($$ update auth.users set email = 'alvo-novo@exemplo.com' where id = '00000000-0000-0000-0000-0000000000e1' $$, 'o admin troca o e-mail direto');
select ok(not has_function_privilege('authenticated', 'public.troca_de_email_recusada()', 'execute'), 'ninguém de fora chama a função da troca de e-mail');

select ok(not has_function_privilege('anon', 'public.senha_some_na_confirmacao()', 'execute')
  and not has_function_privilege('authenticated', 'public.senha_some_na_confirmacao()', 'execute'), 'ninguém de fora chama a função da senha');
select ok(not has_function_privilege('anon', 'public.conta_nasceu_agora()', 'execute')
  and not has_function_privilege('authenticated', 'public.conta_nasceu_agora()', 'execute'), 'nem a da marca');

select * from finish();
rollback;
```

`supabase/migrations/20261116000000_journey_v2_senha.sql`:

```sql
-- Journey v2: a senha de quem cadastrou um e-mail antes da dona não sobrevive à confirmação.
--
-- O Supabase deixa qualquer um chamar o cadastro (/signup) com qualquer e-mail e uma senha. Enquanto o e-mail não
-- é confirmado essa senha não entra, mas quando a dona confirma (pelo cadastro dela, pelo link mágico ou pelo Google)
-- a conta passa a valer com a senha de quem chegou primeiro, e o convite da empresa põe essa conta pra dentro.
-- O Supabase não troca a senha num cadastro repetido ("não dá pra ter certeza de quem é"), então quem apaga é o banco:
-- na hora em que o e-mail é confirmado, a senha some, como a de quem só entrou por link (''). A senha da pessoa
-- ela escolhe depois, já com a sessão do link (/conta/senha).
--
-- Só na passagem de "não confirmado" pra "confirmado", e não pra conta que nasce confirmada (pelo painel ou pela API
-- de admin): o Supabase grava essa conta em duas etapas na mesma transação (insert e depois a confirmação), então a
-- conta criada nesta transação fica marcada e a senha dela fica. Quem já era confirmado troca a senha normalmente.

-- Sem security definer nas duas: só mexem na linha que está sendo gravada e numa configuração da transação.
create function public.conta_nasceu_agora() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Local (true): some no fim da transação, e outra transação nunca vê.
  perform set_config('journey.conta_nova', new.id::text, true);
  return null;
end;
$$;

create function public.senha_some_na_confirmacao() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('journey.conta_nova', true) is distinct from old.id::text then
    new.encrypted_password := '';
  end if;
  return new;
end;
$$;

-- Função de trigger não é pra ninguém chamar; a trigger dispara sem olhar essa permissão.
revoke all on function public.conta_nasceu_agora() from public, anon, authenticated;
revoke all on function public.senha_some_na_confirmacao() from public, anon, authenticated;

create trigger conta_nasceu_agora
  after insert on auth.users
  for each row
  execute function public.conta_nasceu_agora();

create trigger senha_some_na_confirmacao
  before update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.senha_some_na_confirmacao();

-- A troca de e-mail pelo próprio usuário (PUT /auth/v1/user com outro e-mail) fica recusada. O app não oferece, e ela
-- reabriria o mesmo buraco por outro lado: alguém logado pede pra trocar o e-mail dele pro da pessoa convidada, ela
-- clica no "confirme o novo e-mail" que chegou sem pedir, e a conta (com a senha dele) passa a ter o e-mail dela. Aqui a
-- trigger da senha não ajuda: o e-mail já era confirmado. O Supabase só grava email_change nesse pedido; o admin e o
-- painel trocam `email` direto e continuam podendo.
create function public.troca_de_email_recusada() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'trocar o e-mail da conta não é permitido no Journey' using errcode = 'P0001';
end;
$$;

revoke all on function public.troca_de_email_recusada() from public, anon, authenticated;

create trigger troca_de_email_recusada
  before update of email_change on auth.users
  for each row
  when (coalesce(new.email_change, '') <> '')
  execute function public.troca_de_email_recusada();
```

Run: `npx supabase migration up --local && npx supabase test db`
Expected: aplica `20261116000000_journey_v2_senha.sql`; `Files=4`, `Result: PASS`.

- [ ] **Passo 2: os e-mails e a configuração do Auth local**

`supabase/templates/confirmacao.html`:

```html
<h2>Confirma teu e-mail</h2>
<p>Alguém (tomara que tu) pediu uma conta no Journey com este e-mail.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/conta/senha" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#13212b;color:#ffffff;text-decoration:none;font-weight:600">Confirmar e escolher a senha</a></p>
<p style="color:#55636d;font-size:13px">Se o botão não abrir, copia e cola este endereço no navegador:<br><span style="word-break:break-all">{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/conta/senha</span></p>
<p>Se não foi tu, é só ignorar: sem abrir o link, nada acontece.</p>
```

`supabase/templates/recuperacao.html`:

```html
<h2>Trocar a senha</h2>
<p>Pediram pra trocar a senha da tua conta no Journey.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/conta/senha" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#13212b;color:#ffffff;text-decoration:none;font-weight:600">Escolher uma senha nova</a></p>
<p style="color:#55636d;font-size:13px">Se o botão não abrir, copia e cola este endereço no navegador:<br><span style="word-break:break-all">{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/conta/senha</span></p>
<p>Se não foi tu, é só ignorar: a senha de agora continua valendo.</p>
```

`supabase/templates/link.html`:

```html
<h2>Teu link pra entrar</h2>
<p>Pediram um link pra entrar no Journey com este e-mail.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#13212b;color:#ffffff;text-decoration:none;font-weight:600">Entrar no Journey</a></p>
<p style="color:#55636d;font-size:13px">Se o botão não abrir, copia e cola este endereço no navegador:<br><span style="word-break:break-all">{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/</span></p>
<p>O link vale uma vez só. Se não foi tu que pediu, é só ignorar.</p>
```

`supabase/config.toml` (senha mínima 8 e os três modelos):

```diff
diff --git a/supabase/config.toml b/supabase/config.toml
index 77bb314..3a8e427 100644
--- a/supabase/config.toml
+++ b/supabase/config.toml
@@ -180,7 +180,7 @@ enable_anonymous_sign_ins = false
 # Allow/disallow testing manual linking of accounts
 enable_manual_linking = false
 # Passwords shorter than this value will be rejected as weak. Minimum 6, recommended 8 or more.
-minimum_password_length = 6
+minimum_password_length = 8
 # Passwords that do not meet the following requirements will be rejected as weak. Supported values
 # are: `letters_digits`, `lower_upper_letters_digits`, `lower_upper_letters_digits_symbols`
 password_requirements = ""
@@ -244,10 +244,22 @@ otp_expiry = 3600
 # admin_email = "admin@email.com"
 # sender_name = "Admin"
 
-# Uncomment to customize email template
-# [auth.email.template.invite]
-# subject = "You have been invited"
-# content_path = "./supabase/templates/invite.html"
+# Os e-mails do login apontam pro /auth/confirm do app (token_hash), e não pro /auth/v1/verify: o servidor do app
+# confirma (no botão da página, um POST), então o link abre em qualquer navegador ou aparelho (o PKCE só abre no
+# navegador que pediu). Cada modelo leva o `next`: a confirmação e a recuperação vão pra escolher a senha
+# (/conta/senha), o link de entrar pra raiz. Os arquivos são o corpo do e-mail inteiro: comentário neles chega a quem
+# recebe. No hospedado, os mesmos textos vão no painel (README, "Publicar"). Mudou aqui: npm run banco:parar && npm run banco.
+[auth.email.template.confirmation]
+subject = "Confirma teu e-mail no Journey"
+content_path = "./supabase/templates/confirmacao.html"
+
+[auth.email.template.recovery]
+subject = "Trocar a senha do Journey"
+content_path = "./supabase/templates/recuperacao.html"
+
+[auth.email.template.magic_link]
+subject = "Teu link pra entrar no Journey"
+content_path = "./supabase/templates/link.html"
 
 # Uncomment to customize notification email template
 # [auth.email.notification.password_changed]
```

O Auth local só lê o `config.toml` ao subir: `npm run banco:parar && npm run banco` (e confira `npx supabase status`).

- [ ] **Passo 3: os testes**

`apps/web/test/lib/acesso.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { avisoDaVolta, caminhoInterno, mensagemDoErro, tipoDoEmail } from '@/lib/acesso';

describe('acesso: os erros do Supabase Auth', () => {
  it('limite de e-mail: em português, e o que foi mandado continua valendo', () => {
    expect(mensagemDoErro({ status: 429, code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 58 seconds.' })).toEqual({
      texto: 'Já mandamos um e-mail há pouco. Espera um minuto e tenta de novo.',
      limite: true,
    });
  });

  it('limite de pedidos (tentativas de senha), ou 429 sem código: muitas tentativas, e não "já mandamos um e-mail"', () => {
    for (const e of [{ status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' }, { status: 429, message: 'Too many requests' }])
      expect(mensagemDoErro(e)).toEqual({ texto: 'Muitas tentativas seguidas. Espera um pouco e tenta de novo.', limite: true });
  });

  it('senha errada, e-mail não confirmado, senha fraca, senha igual, reautenticação', () => {
    expect(mensagemDoErro({ status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }).texto).toBe('E-mail ou senha não conferem.');
    expect(mensagemDoErro({ status: 400, code: 'email_not_confirmed', message: 'Email not confirmed' }).texto).toContain('Usa “Criar conta”');
    expect(mensagemDoErro({ status: 422, code: 'weak_password', message: 'Password should be at least 8 characters.' }).texto).toBe('Senha fraca: use pelo menos 8 caracteres.');
    expect(mensagemDoErro({ status: 422, code: 'same_password', message: 'New password should be different' }).texto).toBe('A senha nova é igual à de antes.');
    expect(mensagemDoErro({ status: 401, code: 'reauthentication_needed', message: 'Password update requires reauthentication' }).texto).toContain('entra de novo');
  });

  it('o resto: genérico, sem o texto em inglês', () => {
    expect(mensagemDoErro({ status: 500, message: 'Error sending magic link email' })).toEqual({ texto: 'Não deu certo agora. Tenta de novo em instantes.', limite: false });
  });
});

describe('acesso: a volta pro entrar', () => {
  it('link que não valeu, Google que não terminou, e nada', () => {
    expect(avisoDaVolta('link')).toBe('O link expirou ou já foi usado. Pede outro.');
    expect(avisoDaVolta('google')).toContain('O Google não completou a entrada');
    expect(avisoDaVolta(undefined)).toBeNull();
    expect(avisoDaVolta('<script>')).toBeNull();
  });

  it('os tipos do link do e-mail: só os dos modelos (email e recovery)', () => {
    expect(tipoDoEmail('email')).toBe('email');
    expect(tipoDoEmail('recovery')).toBe('recovery');
    for (const t of ['signup', 'magiclink', 'invite', 'email_change', 'sms', '', null]) expect(tipoDoEmail(t), String(t)).toBeNull();
  });
});

describe('acesso: o next da volta', () => {
  it('caminho deste app passa', () => {
    expect(caminhoInterno('/conta/senha')).toBe('/conta/senha');
    expect(caminhoInterno('/e/123?x=1')).toBe('/e/123?x=1');
  });

  it('outro site, ou nada, vira a raiz', () => {
    for (const n of ['//evil.com', '//evil.com/conta', '/\\evil.com', 'https://evil.com', 'evil.com', '', null, undefined, '/\tevil', '/\nevil']) expect(caminhoInterno(n), String(n)).toBe('/');
  });
});
```

`apps/web/test/app/callback.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

let erro: { message: string } | null = null;
const exchangeCodeForSession = vi.fn(async (_code: string) => ({ error: erro }));
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ auth: { exchangeCodeForSession } }) }));
const { GET } = await import('@/app/auth/callback/route');

const volta = (consulta: string) => GET(new NextRequest(`http://127.0.0.1:3000/auth/callback${consulta}`, { headers: { host: '127.0.0.1:3000' } }));

describe('GET /auth/callback', () => {
  beforeEach(() => vi.stubEnv('APP_URL', ''));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    erro = null;
    exchangeCodeForSession.mockClear();
  });

  it('troca o código pela sessão e segue pro next', async () => {
    const r = await volta('?code=abc&next=%2Fconta%2Fsenha');
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(r.headers.get('location')).toBe('http://127.0.0.1:3000/conta/senha');
  });

  it('next de outro site vira a raiz deste', async () => {
    for (const next of ['%2F%2Fevil.com', 'https%3A%2F%2Fevil.com', '%2F%5Cevil.com']) {
      const r = await volta(`?code=abc&next=${next}`);
      expect(r.headers.get('location')).toBe('http://127.0.0.1:3000/');
    }
  });

  it('o Google cancelado (ou recusado) volta com error e sem código: o aviso é o do Google', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await volta('?error=access_denied&error_code=access_denied&error_description=The+user+denied');
    expect(r.headers.get('location')).toBe('http://127.0.0.1:3000/entrar?erro=google');
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('sem código, ou código que não vale: volta pro entrar com o aviso', async () => {
    expect((await volta('?next=%2F%2Fevil.com')).headers.get('location')).toBe('http://127.0.0.1:3000/entrar?erro=link');
    erro = { message: 'invalid flow state' };
    expect((await volta('?code=velho')).headers.get('location')).toBe('http://127.0.0.1:3000/entrar?erro=link');
  });
});
```

`apps/web/test/app/confirmar.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

let erro: { status?: number; code?: string; message: string } | null = null;
const verifyOtp = vi.fn(async (_p: { type: string; token_hash: string }) => ({ error: erro }));
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ auth: { verifyOtp } }) }));
const { POST } = await import('@/app/auth/confirmar/route');

const APP = 'http://127.0.0.1:3000';
/** O POST do botão da página /auth/confirm, com o Origin que o navegador manda (ou outro, ou nenhum). */
function botao(campos: Record<string, string>, origin: string | null = APP) {
  const corpo = new URLSearchParams(campos);
  const headers: Record<string, string> = { host: '127.0.0.1:3000', 'content-type': 'application/x-www-form-urlencoded' };
  if (origin !== null) headers.origin = origin;
  return POST(new NextRequest(`${APP}/auth/confirmar`, { method: 'POST', headers, body: corpo }));
}

describe('POST /auth/confirmar', () => {
  beforeEach(() => {
    vi.stubEnv('APP_URL', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    erro = null;
    verifyOtp.mockClear();
  });

  it('confirma o token no servidor (sem PKCE) e segue pro next com 303', async () => {
    const r = await botao({ token_hash: 'abc', type: 'recovery', next: '/conta/senha' });
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'abc' });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe(`${APP}/conta/senha`);
    expect((await botao({ token_hash: 'abc', type: 'email', next: '/' })).headers.get('location')).toBe(`${APP}/`);
  });

  it('de outro site, ou sem Origin: recusa sem tocar no token (login CSRF)', async () => {
    for (const origin of ['https://evil.com', 'null', null]) {
      const r = await botao({ token_hash: 'abc', type: 'email', next: '/' }, origin);
      expect(r.status, String(origin)).toBe(403);
    }
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('next de outro site vira a raiz deste', async () => {
    for (const next of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
      const r = await botao({ token_hash: 'abc', type: 'email', next });
      expect(r.headers.get('location')).toBe(`${APP}/`);
    }
  });

  it('sem token, tipo fora dos modelos ou token que não vale: volta pro entrar com o aviso', async () => {
    expect((await botao({ type: 'email' })).headers.get('location')).toBe(`${APP}/entrar?erro=link`);
    for (const type of ['signup', 'magiclink', 'invite', 'email_change', 'sms'])
      expect((await botao({ token_hash: 'abc', type })).headers.get('location'), type).toBe(`${APP}/entrar?erro=link`);
    expect(verifyOtp).not.toHaveBeenCalled();
    erro = { status: 403, code: 'otp_expired', message: 'Email link is invalid or has expired' };
    expect((await botao({ token_hash: 'velho', type: 'email' })).headers.get('location')).toBe(`${APP}/entrar?erro=link`);
  });
});
```

```bash
git rm -q apps/web/test/app/entrar.test.ts apps/web/src/app/entrar/mensagens.ts
```

`apps/web/e2e/conta.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { SENHA, abrirLink, authPublico, contaConfirmada, emailNovo, emailsPara, entrar, linkDoEmail } from './apoio';

/** Na tela de entrar, com os botões já ligados. */
async function telaDeEntrar(page: Page) {
  await page.goto('/entrar');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
}

async function comSenha(page: Page, email: string, senha: string) {
  await telaDeEntrar(page);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

/** "Criar conta" na tela: só o e-mail. Devolve o link que chegou (confirmação, ou o de entrar pra quem já tem conta). */
async function criarConta(page: Page, request: Parameters<typeof linkDoEmail>[0], email: string) {
  await telaDeEntrar(page);
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  // Sem senha no cadastro: ela é escolhida depois de confirmar o e-mail.
  await expect(page.getByLabel('Senha', { exact: true })).toHaveCount(0);
  const antes = await emailsPara(request, email);
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('status')).toContainText(`Confirma o e-mail: mandamos um link para ${email}. Pelo link, tu escolhe a senha.`);
  return linkDoEmail(request, email, antes);
}

/** Na página da senha (depois do link): escolhe e salva. */
async function escolherSenha(page: Page, senha: string) {
  await expect(page).toHaveURL(/\/conta\/senha$/);
  await expect(page.getByRole('heading', { name: 'Tua senha' })).toBeVisible();
  await page.getByLabel('Senha nova').fill(senha);
  await page.getByRole('button', { name: 'Salvar a senha' }).click();
}

/** O aviso do formulário (o Next tem outra região de alerta, a do anúncio de rota). */
const alerta = (page: Page) => page.getByRole('main').getByRole('alert');

const sair = (page: Page) => page.getByRole('button', { name: 'Sair' }).click();

test('criar conta: só o e-mail; o link confirma e leva a escolher a senha; sai e entra com ela; senha errada dá a mensagem', async ({ page, request }) => {
  test.setTimeout(90_000);
  const email = emailNovo('cadastro');
  await abrirLink(page, await criarConta(page, request, email));
  await page.getByLabel('Senha nova').fill('curta');
  await expect(page.getByLabel('Senha nova')).toHaveAttribute('minlength', '8');
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await expect(page.getByLabel('Senha nova')).toHaveAttribute('type', 'text');
  await escolherSenha(page, SENHA);
  await expect(page).toHaveURL(/\/empresa\/nova$/);
  // Sem empresa ainda, a conta (senha e sair) fica embaixo do cartão.
  await expect(page.getByRole('link', { name: 'Senha' })).toHaveAttribute('href', '/conta/senha');
  await page.getByLabel('Nome da empresa').fill('Empresa da senha');
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page).toHaveURL(/\/e\/[0-9a-f-]+$/);
  await sair(page);
  await expect(page).toHaveURL(/\/entrar$/);

  await comSenha(page, email, 'senha-errada-123');
  await expect(alerta(page)).toHaveText('E-mail ou senha não conferem.');
  await comSenha(page, email, SENHA);
  await expect(page).toHaveURL(/\/e\/[0-9a-f-]+$/);
});

test('esqueci a senha: o link aberto em outro navegador leva à senha nova, e ela vale', async ({ page, request, browser }) => {
  test.setTimeout(90_000);
  const email = emailNovo('esqueci');
  await contaConfirmada(request, email);
  await telaDeEntrar(page);
  await page.getByRole('button', { name: 'Esqueci a senha' }).click();
  // Fora das abas: um título, e nenhum painel de aba.
  await expect(page.getByRole('heading', { name: 'Esqueci a senha' })).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.getByRole('tabpanel')).toHaveCount(0);
  const antes = await emailsPara(request, email);
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Mandar o link pra trocar a senha' }).click();
  await expect(page.getByRole('status')).toContainText('mandamos um link pra trocar a senha');

  // O e-mail aberto no celular, por exemplo: outro navegador, sem nada do que pediu.
  const outro = await browser.newContext();
  const p2 = await outro.newPage();
  await abrirLink(p2, await linkDoEmail(request, email, antes));
  await escolherSenha(p2, 'outra-senha-456');
  await expect(p2).toHaveURL(/\/empresa\/nova$/);
  await outro.close();

  await comSenha(page, email, SENHA);
  await expect(alerta(page)).toHaveText('E-mail ou senha não conferem.');
  await comSenha(page, email, 'outra-senha-456');
  await expect(page).toHaveURL(/\/empresa\/nova$/);
});

test('quem cadastrou antes o e-mail da convidada não entra com a senha dele; ela cria a conta, cai na empresa e entra com a dela', async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(120_000);
  await entrar(page, request, emailNovo('dono-convite'));
  await page.getByLabel('Nome da empresa').fill('Empresa do convite');
  await page.getByRole('button', { name: 'Criar' }).click();
  const colega = emailNovo('convidada');
  await page.getByRole('link', { name: 'Membros' }).click();
  await page.getByLabel('E-mail').fill(colega);
  await page.getByRole('button', { name: 'Convidar' }).click();
  await expect(page.getByText(`Convite pra ${colega} criado`)).toBeVisible();
  const empresa = /\/e\/([0-9a-f-]+)/.exec(page.url())![1]!;

  // O atacante chega primeiro: cadastra o e-mail dela com a senha dele, direto na API (a chave pública é de todos).
  const ATACANTE = 'senha-do-atacante-1';
  expect((await authPublico(request, 'signup', { email: colega, password: ATACANTE })).status()).toBe(200);
  // O cadastro dele já mandou uma confirmação pra ela: espera chegar, pra pegar depois só o e-mail do pedido dela.
  await linkDoEmail(request, colega);
  // O Supabase recusa outro e-mail pro mesmo endereço por um tempo (max_frequency: 1 s aqui, 60 s no hospedado).
  await new Promise((r) => setTimeout(r, 1500));

  // Ela faz o caminho dela: criar conta, confirmar pelo e-mail, escolher a senha. O convite vale (está na empresa).
  const ela = await browser.newContext();
  const p2 = await ela.newPage();
  await abrirLink(p2, await criarConta(p2, request, colega));
  await escolherSenha(p2, SENHA);
  await expect(p2).toHaveURL(new RegExp(`/e/${empresa}$`));
  // Logada: "Senha" no topo leva à troca.
  await p2.getByRole('link', { name: 'Senha' }).click();
  await expect(p2).toHaveURL(/\/conta\/senha$/);
  await ela.close();

  // A senha do atacante não vale mais (nem na API, nem na tela); a dela vale.
  const r = await authPublico(request, 'token?grant_type=password', { email: colega, password: ATACANTE });
  expect(r.status()).toBe(400);
  expect(((await r.json()) as { error_code?: string }).error_code).toBe('invalid_credentials');
  const limpo = await browser.newContext();
  const p3 = await limpo.newPage();
  await comSenha(p3, colega, ATACANTE);
  await expect(alerta(p3)).toHaveText('E-mail ou senha não conferem.');
  await comSenha(p3, colega, SENHA);
  await expect(p3).toHaveURL(new RegExp(`/e/${empresa}$`));
  await limpo.close();
});

test('a volta do Google não leva pra fora do app (next=//evil.com)', async ({ request }) => {
  for (const next of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
    const r = await request.get(`/auth/callback?code=nao-vale&next=${encodeURIComponent(next)}`, { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(new URL(r.headers().location!, 'http://127.0.0.1:3000').host).toBe('127.0.0.1:3000');
  }
});

test('o link do e-mail só entra pelo botão: abrir não entra nem gasta o token; de outro site é recusado; next de fora vira a raiz', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const email = emailNovo('botao');
  await contaConfirmada(request, email);
  const antes = await emailsPara(request, email);
  expect((await authPublico(request, 'otp', { email, create_user: false })).status()).toBe(200);
  // O link com o next trocado por outro site (como alguém mal-intencionado faria).
  const link = new URL(await linkDoEmail(request, email, antes));
  link.searchParams.set('next', '//evil.com');
  const campos = Object.fromEntries(link.searchParams);

  // Abrir (o leitor de links do e-mail, ou alguém que recebeu o link de outro): só a página, sem sessão.
  const aberto = await request.get(link.toString(), { maxRedirects: 0 });
  expect(aberto.status()).toBe(200);
  expect(aberto.headers()['set-cookie'] ?? '').not.toContain('auth-token');
  expect(aberto.headers()['referrer-policy']).toBe('same-origin');
  // O POST de outro site (login CSRF) é recusado e não toca no token.
  const deFora = await request.post('/auth/confirmar', { form: campos, headers: { origin: 'https://evil.com' }, maxRedirects: 0 });
  expect(deFora.status()).toBe(403);

  // O token continua valendo: o botão entra, e o next de fora vira a raiz deste app.
  await page.goto(link.toString());
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3000\/empresa\/nova$/);
});

test('nova senha sem sessão manda pro entrar', async ({ page }) => {
  await page.goto('/conta/senha');
  await expect(page).toHaveURL(/\/entrar$/);
});
```

`apps/web/e2e/entrar.spec.ts`:

```diff
diff --git a/apps/web/e2e/entrar.spec.ts b/apps/web/e2e/entrar.spec.ts
index 08bce8e..826c19b 100644
--- a/apps/web/e2e/entrar.spec.ts
+++ b/apps/web/e2e/entrar.spec.ts
@@ -1,5 +1,5 @@
 import { expect, test } from '@playwright/test';
-import { entrar, emailNovo } from './apoio';
+import { abrirLink, contaConfirmada, emailNovo, entrar, pedirLink } from './apoio';
 
 test('sem sessão, qualquer página manda pra entrar', async ({ page }) => {
   await page.goto('/e/00000000-0000-0000-0000-000000000000');
@@ -12,6 +12,24 @@ test('quem entra pela primeira vez cai em criar a empresa', async ({ page, reque
   await expect(page.getByRole('heading', { name: 'Tua empresa' })).toBeVisible();
 });
 
+test('o link mágico continua: pede aqui, abre em outro navegador e entra lá', async ({ page, request, browser }) => {
+  const email = emailNovo('link');
+  await contaConfirmada(request, email);
+  const link = await pedirLink(page, request, email);
+  // Outro navegador (sem os cookies deste): o link confirma no servidor, sem o PKCE de quem pediu.
+  const outro = await browser.newContext();
+  const p2 = await outro.newPage();
+  await abrirLink(p2, link);
+  await expect(p2).toHaveURL(/\/empresa\/nova$/);
+  await outro.close();
+});
+
+test('o Google cancelado volta pro entrar com o aviso dele', async ({ page }) => {
+  await page.goto('/auth/callback?error=access_denied&error_code=access_denied&error_description=The+user+denied');
+  await expect(page).toHaveURL(/\/entrar\?erro=google$/);
+  await expect(page.getByRole('main').getByRole('alert')).toContainText('O Google não completou a entrada');
+});
+
 test('no celular, sem rolar pro lado: pede o link, vê pra onde foi e pode usar outro e-mail', async ({ browser }) => {
   const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
   const page = await ctx.newPage();
@@ -19,7 +37,8 @@ test('no celular, sem rolar pro lado: pede o link, vê pra onde foi e pode usar
   await expect(page.getByRole('heading', { name: 'Desenha o fluxo e dá play.' })).toBeVisible();
   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
   const email = emailNovo('celular');
-  await expect(page.getByRole('button', { name: 'Receber o link' })).toBeEnabled();
+  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
+  await page.getByRole('button', { name: 'Receber um link por e-mail' }).click();
   await page.getByLabel('E-mail').fill(email);
   await page.getByRole('button', { name: 'Receber o link' }).click();
   await expect(page.getByRole('status')).toContainText(`Link enviado para ${email}`);
@@ -36,7 +55,7 @@ test('no celular, sem rolar pro lado: pede o link, vê pra onde foi e pode usar
 test('link expirado: a página diz e deixa pedir outro', async ({ page }) => {
   await page.goto('/entrar?erro=link');
   await expect(page.getByRole('alert').filter({ hasText: 'O link expirou ou já foi usado' })).toBeVisible();
-  await expect(page.getByRole('button', { name: 'Receber o link' })).toBeEnabled();
+  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
 });
 
 test('antes de a página ficar pronta, o Enter não manda o e-mail pela URL', async ({ browser }) => {
@@ -44,11 +63,13 @@ test('antes de a página ficar pronta, o Enter não manda o e-mail pela URL', as
   const ctx = await browser.newContext({ javaScriptEnabled: false });
   const page = await ctx.newPage();
   await page.goto('/entrar?erro=link');
-  await expect(page.getByRole('button', { name: 'Receber o link' })).toBeDisabled();
+  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeDisabled();
   await page.getByLabel('E-mail').fill('alguem@exemplo.com');
-  await page.getByLabel('E-mail').press('Enter');
+  await page.getByLabel('Senha', { exact: true }).fill('uma-senha-qualquer');
+  await page.getByLabel('Senha', { exact: true }).press('Enter');
   await page.waitForLoadState('load');
   expect(page.url()).not.toContain('alguem');
+  expect(page.url()).not.toContain('senha');
   await ctx.close();
 });
 
```

`apps/web/e2e/apoio.ts` (o `entrar()` cria a conta já confirmada pela API de administração e entra com senha; `abrirLink()` abre o e-mail do Mailpit e clica no botão):

```diff
diff --git a/apps/web/e2e/apoio.ts b/apps/web/e2e/apoio.ts
index 108e17b..316ac1a 100644
--- a/apps/web/e2e/apoio.ts
+++ b/apps/web/e2e/apoio.ts
@@ -1,31 +1,113 @@
+import { execSync } from 'node:child_process';
+import { join } from 'node:path';
 import { expect, type APIRequestContext, type Page } from '@playwright/test';
 
 const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
+const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
+/** A senha das contas que os testes criam. */
+export const SENHA = 'senha-de-teste-123';
 
-/** Entra pelo link mágico: pede o link na tela e abre o que chegou no Mailpit do Supabase local. */
+let status: { SECRET_KEY?: string; PUBLISHABLE_KEY?: string } | null = null;
+/**
+ * As chaves do Supabase local, lidas da própria CLI (como em test/banco/apoio.ts): não ficam no código. A secreta só os
+ * testes usam (pra criar contas já confirmadas pela API de administração); a pública é a que qualquer um tem.
+ */
+function chaves() {
+  if (status === null) {
+    const raiz = join(import.meta.dirname, '..', '..', '..');
+    status = JSON.parse(execSync('npx supabase status -o json', { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] }).toString()) as typeof status;
+  }
+  return {
+    secreta: process.env.SUPABASE_SECRET_KEY || (status!.SECRET_KEY ?? ''),
+    publica: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || (status!.PUBLISHABLE_KEY ?? ''),
+  };
+}
+const chaveSecreta = () => chaves().secreta;
+
+/** Chama o Auth do Supabase direto, com a chave pública: o que qualquer pessoa (ou um atacante) consegue fazer. */
+export async function authPublico(request: APIRequestContext, caminho: string, dados: object) {
+  return request.post(`${SUPABASE}/auth/v1/${caminho}`, { headers: { apikey: chaves().publica }, data: dados, failOnStatusCode: false });
+}
+
+/**
+ * Uma conta com e-mail já confirmado e a SENHA, pela API de administração (sem e-mail, sem limite por IP). Ela nasce
+ * confirmada, então o banco não apaga a senha (só apaga na confirmação de uma conta que já existia).
+ */
+export async function contaConfirmada(request: APIRequestContext, email: string) {
+  const r = await request.post(`${SUPABASE}/auth/v1/admin/users`, {
+    headers: { apikey: chaveSecreta(), Authorization: `Bearer ${chaveSecreta()}` },
+    data: { email, password: SENHA, email_confirm: true },
+  });
+  // 422: a conta já existe (o mesmo teste entrou de novo).
+  expect([200, 422]).toContain(r.status());
+}
+
+/**
+ * Entra com e-mail e senha pela tela (criando a conta antes, já confirmada). É o caminho principal do app e o mais
+ * rápido nos testes: sem esperar e-mail e sem os limites por IP do link mágico (o repositório principal roda os mesmos
+ * testes no mesmo Supabase). O link mágico tem o teste dele (entrar.spec.ts).
+ */
 export async function entrar(page: Page, request: APIRequestContext, email: string) {
+  await contaConfirmada(request, email);
   await page.goto('/entrar');
-  // O botão só liga depois que a página fica pronta (antes, o Enter mandaria o formulário pelo navegador).
-  await expect(page.getByRole('button', { name: 'Receber o link' })).toBeEnabled();
+  // Os botões só ligam depois que a página fica pronta (antes, o Enter mandaria o formulário pelo navegador).
+  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
   await page.getByLabel('E-mail').fill(email);
-  await page.getByRole('button', { name: 'Receber o link' }).click();
-  await expect(page.getByRole('status')).toContainText('Link enviado');
+  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
+  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
+  await page.waitForURL((url) => !url.pathname.startsWith('/entrar'));
+}
+
+/** Quantos e-mails o endereço já recebeu (pra esperar o próximo). */
+export async function emailsPara(request: APIRequestContext, email: string): Promise<number> {
+  const r = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
+  return ((await r.json()) as { messages?: unknown[] }).messages?.length ?? 0;
+}
+
+/**
+ * O link do e-mail mais novo pro endereço, depois de `antes` e-mails (link mágico, confirmação ou recuperação). Os
+ * modelos (supabase/templates) apontam pro /auth/confirm do app.
+ */
+export async function linkDoEmail(request: APIRequestContext, email: string, antes = 0): Promise<string> {
   let link = '';
   await expect
     .poll(
       async () => {
         const r = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
         const { messages } = (await r.json()) as { messages?: { ID: string }[] };
-        if (!messages?.length) return '';
-        const m = (await (await request.get(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)).json()) as { Text: string };
-        link = (/https?:\/\/\S+verify\S+/.exec(m.Text) ?? [''])[0];
+        if (!messages || messages.length <= antes) return '';
+        const m = (await (await request.get(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)).json()) as { HTML: string };
+        link = (/href="([^"]*\/auth\/confirm\?[^"]*)"/.exec(m.HTML)?.[1] ?? '').replaceAll('&amp;', '&');
         return link;
       },
       { timeout: 20_000 },
     )
     .not.toBe('');
+  return link;
+}
+
+/**
+ * Abre o link do e-mail e aperta o botão da página (/auth/confirm só mostra a página; quem entra é o POST do botão).
+ */
+export async function abrirLink(page: Page, link: string) {
   await page.goto(link);
+  await page.getByRole('button', { name: /^(Confirmar e entrar|Continuar pra trocar a senha)$/ }).click();
+  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
 }
 
-export const emailNovo = (prefixo: string) => `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@exemplo.com`;
+/**
+ * Pede o link mágico na tela e devolve o que chegou no Mailpit do Supabase local (quem abre escolhe o navegador: o
+ * link confirma no servidor e abre em qualquer um).
+ */
+export async function pedirLink(page: Page, request: APIRequestContext, email: string): Promise<string> {
+  await page.goto('/entrar');
+  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
+  await page.getByRole('button', { name: 'Receber um link por e-mail' }).click();
+  const antes = await emailsPara(request, email);
+  await page.getByLabel('E-mail').fill(email);
+  await page.getByRole('button', { name: 'Receber o link' }).click();
+  await expect(page.getByRole('status')).toContainText('Link enviado');
+  return linkDoEmail(request, email, antes);
+}
 
+export const emailNovo = (prefixo: string) => `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@exemplo.com`;
```

- [ ] **Passo 4: rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/lib/acesso.test.ts test/app/callback.test.ts test/app/confirmar.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/acesso"` e `"@/app/auth/confirmar/route"`.

- [ ] **Passo 5: o acesso e as rotas**

`apps/web/src/lib/acesso.ts`:

```ts
/**
 * Entrar e a conta: os textos dos erros do Supabase Auth em português, a senha mínima, os avisos de quem volta de um
 * link ou do Google e o `next` das voltas (/auth/confirm e /auth/callback). Sem nada de servidor: as páginas de entrar e da
 * senha usam no navegador, e as rotas de volta no servidor.
 */

/** O erro do Supabase Auth, como chega no navegador: o status HTTP e o código, quando há. */
export interface ErroDoAuth {
  status?: number;
  code?: string;
  message: string;
}

/**
 * A senha mínima do app. O Supabase confere a dele (`minimum_password_length`: 8 no config.toml local; no hospedado o
 * padrão é 6, e o README manda subir pra 8); o app pede 8 antes de mandar.
 */
export const SENHA_MINIMA = 8;

/** Quanto o botão espera depois de mandar um e-mail (o Supabase recusa outro pro mesmo e-mail por 60 s). */
export const ESPERA_REENVIO_S = 30;
/** Depois de uma recusa por limite, o tempo inteiro do Supabase. */
export const ESPERA_LIMITE_S = 60;

export interface MensagemDoAuth {
  texto: string;
  /** Recusado por ter vindo cedo demais: o que foi mandado antes continua valendo, e o botão espera. */
  limite: boolean;
}

const msg = (texto: string, limite = false): MensagemDoAuth => ({ texto, limite });

/**
 * O texto pra pessoa, pelo código e pelo status (nunca pelo texto, que é em inglês e muda). O que o Supabase esconde
 * (se um e-mail tem conta, num cadastro com confirmação) continua escondido: a tela só repete o que ele devolve.
 */
export function mensagemDoErro(e: ErroDoAuth): MensagemDoAuth {
  // Dois limites diferentes: o de e-mails (por endereço e por hora) e o de pedidos (tentativas de senha, por IP).
  if (e.code === 'over_email_send_rate_limit') return msg('Já mandamos um e-mail há pouco. Espera um minuto e tenta de novo.', true);
  if (e.code === 'over_request_rate_limit' || e.status === 429) return msg('Muitas tentativas seguidas. Espera um pouco e tenta de novo.', true);
  switch (e.code) {
    case 'invalid_credentials':
      return msg('E-mail ou senha não conferem.');
    case 'email_not_confirmed':
      // Só acontece com conta de antes da confirmação sem senha: o "Criar conta" de agora manda o link de novo.
      return msg('Esse e-mail ainda não foi confirmado. Usa “Criar conta” pra receber o link de confirmação.');
    case 'weak_password':
      return msg(`Senha fraca: use pelo menos ${SENHA_MINIMA} caracteres.`);
    case 'same_password':
      return msg('A senha nova é igual à de antes.');
    case 'reauthentication_needed':
      // Só com "Secure password change" ligado no painel (aqui fica desligado: quem está logado troca sem a atual).
      return msg('Pra trocar a senha, entra de novo: sai, entra e troca logo em seguida.');
    case 'signup_disabled':
    case 'email_provider_disabled':
      return msg('Criar conta com e-mail está desligado neste servidor.');
    case 'email_address_invalid':
    case 'validation_failed':
      return msg('Confere o e-mail: ele não parece certo.');
    case 'session_not_found':
    case 'session_expired':
      return msg('A sessão venceu. Entra de novo, ou pede um link novo pra trocar a senha.');
    default:
      return msg('Não deu certo agora. Tenta de novo em instantes.');
  }
}

/** O aviso de quem volta pro entrar (`/entrar?erro=…`): o link do e-mail que não valeu, ou o Google que não terminou. */
export function avisoDaVolta(erro: string | undefined): string | null {
  if (erro === 'link') return 'O link expirou ou já foi usado. Pede outro.';
  if (erro === 'google') return 'O Google não completou a entrada (cancelada ou recusada). Tenta de novo, ou entra com o e-mail.';
  return null;
}

/** Os tipos do link do e-mail que o /auth/confirm aceita: só os dos modelos em supabase/templates. */
const TIPOS_DO_EMAIL = ['email', 'recovery'] as const;
export type TipoDoEmail = (typeof TIPOS_DO_EMAIL)[number];
export const tipoDoEmail = (t: string | null): TipoDoEmail | null => ((TIPOS_DO_EMAIL as readonly string[]).includes(t ?? '') ? (t as TipoDoEmail) : null);

/**
 * O `next` do /auth/confirm e do /auth/callback (pra onde ir depois de entrar): só caminho deste app. "//outro.site" e "/\\outro.site"
 * seriam outro site pro navegador, e "https://…" também; nesses casos (e sem `next`), a raiz.
 */
export function caminhoInterno(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f]/.test(next)) return '/';
  return next;
}
```

`apps/web/src/app/auth/callback/route.ts` (só o Google volta por aqui):

```diff
diff --git a/apps/web/src/app/auth/callback/route.ts b/apps/web/src/app/auth/callback/route.ts
index 416bb3a..f098a23 100644
--- a/apps/web/src/app/auth/callback/route.ts
+++ b/apps/web/src/app/auth/callback/route.ts
@@ -1,14 +1,24 @@
 import { NextResponse, type NextRequest } from 'next/server';
+import { caminhoInterno } from '@/lib/acesso';
 import { origemDe } from '@/lib/origem';
 import { supabaseServidor } from '@/lib/supabase/servidor';
 
+/**
+ * A volta do Google (OAuth com PKCE): troca o código pela sessão e segue pro `next` (só caminho deste app), ou pra raiz.
+ * Os e-mails do login voltam pelo /auth/confirm (e o botão dele, /auth/confirmar). Quem cancela (ou recusa) no Google volta com `error` e sem código.
+ */
 export async function GET(request: NextRequest) {
   const origem = origemDe(request);
-  const code = request.nextUrl.searchParams.get('code');
+  const p = request.nextUrl.searchParams;
+  if (p.get('error')) {
+    console.error('[auth/callback]', p.get('error'), p.get('error_code'), p.get('error_description'));
+    return NextResponse.redirect(new URL('/entrar?erro=google', origem));
+  }
+  const code = p.get('code');
   if (code) {
     const supabase = await supabaseServidor();
     const { error } = await supabase.auth.exchangeCodeForSession(code);
-    if (!error) return NextResponse.redirect(new URL('/', origem));
+    if (!error) return NextResponse.redirect(new URL(caminhoInterno(p.get('next')), origem));
   }
   return NextResponse.redirect(new URL('/entrar?erro=link', origem));
 }
```

`apps/web/src/app/auth/confirm/page.tsx` (o link do e-mail abre uma página; nada é confirmado no GET):

```tsx
import { redirect } from 'next/navigation';
import { Marca } from '@/componentes/Marca';
import { caminhoInterno, tipoDoEmail } from '@/lib/acesso';

export const metadata = { title: 'Entrar · Journey', robots: { index: false, follow: false } };

/**
 * Onde chegam os links dos e-mails do login (modelos em supabase/templates). Abrir o link só mostra esta página: quem
 * confirma é o botão, num POST pro /auth/confirmar. Assim um link aberto sozinho não gasta o token (o leitor de links
 * do provedor de e-mail abre tudo o que chega) nem põe ninguém na conta de outra pessoa (um link com o token de alguém,
 * aberto sem querer, entraria na conta dele).
 */
export default async function ConfirmarEmail({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const p = await searchParams;
  const tipo = tipoDoEmail(p.type ?? null);
  if (!p.token_hash || !tipo) redirect('/entrar?erro=link');
  const recuperacao = tipo === 'recovery';
  return (
    <main className="entrar">
      <div className="cartao">
        <Marca />
        <h1>{recuperacao ? 'Trocar a senha' : 'Entrar no Journey'}</h1>
        <p className="mudo">{recuperacao ? 'Falta um passo: continua pra escolher a senha nova.' : 'Falta um passo: confirma pra entrar com este e-mail.'}</p>
        {/* Formulário comum, sem JavaScript: funciona antes de a página ficar pronta. */}
        <form method="post" action="/auth/confirmar" style={{ display: 'grid' }}>
          <input type="hidden" name="token_hash" value={p.token_hash} />
          <input type="hidden" name="type" value={tipo} />
          <input type="hidden" name="next" value={caminhoInterno(p.next)} />
          <button className="botao primario" type="submit">
            {recuperacao ? 'Continuar pra trocar a senha' : 'Confirmar e entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
```

`apps/web/src/app/auth/confirmar/route.ts` (o botão: POST com o Origin conferido, `verifyOtp`, 303):

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { caminhoInterno, tipoDoEmail } from '@/lib/acesso';
import { origemDe } from '@/lib/origem';
import { supabaseServidor } from '@/lib/supabase/servidor';

/**
 * O botão da página /auth/confirm: confirma o token do e-mail com o Supabase no servidor (`verifyOtp`, sem o PKCE, então
 * vale em qualquer navegador), grava a sessão no cookie e segue pro `next` (só caminho deste app), ou pra raiz.
 * Só aceita pedido desta origem: um formulário de outro site não põe o visitante na conta de outra pessoa (login CSRF).
 * Diferente do Sair, sem Origin também recusa: todo navegador de hoje manda Origin num POST.
 */
export async function POST(request: NextRequest) {
  const origem = origemDe(request);
  if (request.headers.get('origin') !== origem) return new NextResponse('Origem não confere.', { status: 403 });
  const dados = await request.formData().catch(() => null);
  const token_hash = dados?.get('token_hash');
  const type = tipoDoEmail(typeof dados?.get('type') === 'string' ? (dados!.get('type') as string) : null);
  if (typeof token_hash === 'string' && token_hash && type) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    const next = dados!.get('next');
    if (!error) return NextResponse.redirect(new URL(caminhoInterno(typeof next === 'string' ? next : null), origem), { status: 303 });
    console.error('[auth/confirmar]', error.status, error.code, error.message);
  }
  return NextResponse.redirect(new URL('/entrar?erro=link', origem), { status: 303 });
}
```

`apps/web/next.config.ts`:

```diff
diff --git a/apps/web/next.config.ts b/apps/web/next.config.ts
index 990cbb1..abc9cc1 100644
--- a/apps/web/next.config.ts
+++ b/apps/web/next.config.ts
@@ -11,6 +11,15 @@ const config: NextConfig = {
         { key: 'Referrer-Policy', value: 'no-referrer' },
       ],
     },
+    // A página do link dos e-mails do login: o token está no endereço e não vai pra outro site. "same-origin", e não
+    // "no-referrer": com no-referrer o navegador manda `Origin: null` no POST do botão, e o /auth/confirmar recusa.
+    {
+      source: '/auth/confirm',
+      headers: [
+        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
+        { key: 'Referrer-Policy', value: 'same-origin' },
+      ],
+    },
   ],
 };
 
```

- [ ] **Passo 6: as telas**

`apps/web/src/app/entrar/page.tsx`:

```tsx
import './entrar.css';
import { Marca } from '@/componentes/Marca';
import { avisoDaVolta } from '@/lib/acesso';
import { FormularioEntrar } from './formulario';
import { PreviaFluxo } from './previa';

export const metadata = { title: 'Entrar · Journey' };

/**
 * Entrar: de um lado o que o Journey é e o formulário (e-mail e senha, criar conta, o link por e-mail e o Google se
 * estiver ligado), do outro uma prévia do quadro com a água andando. A página é leve: nada do editor nem do pacote do fluxo.
 */
export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="entrada">
      <div className="lado-form">
        <Marca href={null} />
        <div className="chamada">
          <h1>Desenha o fluxo e dá play.</h1>
          <p className="lead">
            Um quadro pro atendimento de qualquer canal: telefonia, WhatsApp, e-mail, chat ou uma esteira interna. No play, a água anda pelos canos, muda de cor
            quando o canal muda, para nas decisões e mostra quanto tempo o cliente levou.
          </p>
        </div>
        {/* O aviso do link vencido (ou do Google cancelado) fica no formulário: some quando a pessoa tenta de novo. */}
        <FormularioEntrar google={process.env.NEXT_PUBLIC_LOGIN_GOOGLE === 'sim'} aviso={avisoDaVolta(erro)} />
      </div>
      <PreviaFluxo />
    </main>
  );
}
```

`apps/web/src/app/entrar/formulario.tsx`:

```tsx
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ESPERA_LIMITE_S, ESPERA_REENVIO_S, mensagemDoErro, type ErroDoAuth } from '@/lib/acesso';
import { supabaseNavegador } from '@/lib/supabase/navegador';

/**
 * - entrar: e-mail e senha (o caminho principal);
 * - criar: só o e-mail; o link de confirmação leva a escolher a senha (/conta/senha). A senha não vai no cadastro:
 *   quem cadastrou o e-mail antes da dona não pode ficar com uma senha que vale depois que ela confirma (o banco apaga
 *   a senha na confirmação, migração 20261116000000);
 * - esqueci: manda o link de recuperação, que também leva a /conta/senha;
 * - link: o link mágico por e-mail, como alternativa.
 */
type Modo = 'entrar' | 'criar' | 'esqueci' | 'link';
type Enviado = 'link' | 'confirmacao' | 'recuperacao';

const BOTAO: Record<Modo, string> = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Mandar o link pra trocar a senha', link: 'Receber o link' };
const ENVIA: Record<Exclude<Modo, 'entrar'>, Enviado> = { criar: 'confirmacao', esqueci: 'recuperacao', link: 'link' };
const ABAS = ['entrar', 'criar'] as const;

/**
 * Os e-mails voltam pelo /auth/confirm (os modelos em supabase/templates dizem pra onde): a página tem um botão, e o
 * POST dele (/auth/confirmar) confirma no servidor, então o link abre em qualquer navegador. O Google volta pelo /auth/callback, com o código do PKCE que fica neste navegador.
 */
export function FormularioEntrar({ google, aviso }: { google: boolean; aviso: string | null }) {
  // Antes de o React assumir a página, os botões ficam desligados: um Enter ali mandaria o formulário pelo navegador.
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  const [modo, setModo] = useState<Modo>('entrar');
  // Controlados e sem `name`: nada vai pra URL, e o e-mail continua no campo entre os modos e depois de enviar.
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // O que foi mandado por e-mail (e pra quem): o aviso de "enviado" fica enquanto vale.
  const [enviado, setEnviado] = useState<{ tipo: Enviado; para: string } | null>(null);
  const [erro, setErro] = useState<string | null>(aviso);
  // Até quando (relógio daqui) o botão espera pra mandar outro e-mail pro mesmo endereço.
  const [esperaAte, setEsperaAte] = useState(0);
  const [agora, setAgora] = useState(0);
  const campoEmail = useRef<HTMLInputElement>(null);
  const idSenha = useId();
  const idExplica = useId();
  const idPainel = useId();

  // O relógio da espera anda de segundo em segundo, só enquanto há espera.
  useEffect(() => {
    if (!esperaAte) return;
    setAgora(Date.now());
    const t = setInterval(() => {
      const n = Date.now();
      setAgora(n);
      if (n >= esperaAte) {
        setEsperaAte(0);
        clearInterval(t);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [esperaAte]);

  const para = email.trim();
  const mandaEmail = modo !== 'entrar';
  const comAbas = modo === 'entrar' || modo === 'criar';
  const mesmoEmail = enviado !== null && para.toLowerCase() === enviado.para.toLowerCase();
  const faltam = mesmoEmail && esperaAte > agora ? Math.ceil((esperaAte - agora) / 1000) : 0;
  // aria-disabled, e não disabled: o botão continua com o foco enquanto envia ou espera.
  const ocupado = enviando || (mandaEmail && faltam > 0);

  const trocarModo = (m: Modo) => {
    setModo(m);
    setErro(null);
    setVerSenha(false);
  };

  const falhou = (e: ErroDoAuth, onde: string) => {
    console.error(`[entrar: ${onde}]`, e.status, e.code, e.message);
    const m = mensagemDoErro(e);
    setErro(m.texto);
    // Cedo demais: o e-mail de antes ainda vale, e o aviso de "enviado" fica.
    if (m.limite) setEsperaAte(Date.now() + ESPERA_LIMITE_S * 1000);
  };

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado || !para) return;
    if (modo === 'entrar' && !senha) return;
    const auth = supabaseNavegador().auth;
    setEnviando(true);
    setErro(null);
    try {
      if (modo === 'entrar') {
        const { error } = await auth.signInWithPassword({ email: para, password: senha });
        if (error) return falhou(error, 'senha');
        // Página nova (e não só a rota): o servidor lê a sessão do cookie, e a raiz aceita os convites.
        return window.location.assign('/');
      }
      // Criar conta e o link mágico são o mesmo pedido: conta nova recebe a confirmação (que leva a escolher a senha),
      // e quem já tem conta recebe o link de entrar. A tela diz o mesmo nos dois casos: não conta quem tem conta.
      const { error } =
        modo === 'esqueci' ? await auth.resetPasswordForEmail(para) : await auth.signInWithOtp({ email: para, options: { shouldCreateUser: true } });
      if (error) return falhou(error, modo);
      setEnviado({ tipo: ENVIA[modo], para });
      setEsperaAte(Date.now() + ESPERA_REENVIO_S * 1000);
    } finally {
      setEnviando(false);
    }
  }

  // Dando certo, o navegador sai pro Google; só volta aqui com erro (provedor desligado, rede).
  async function comGoogle() {
    setErro(null);
    const { error } = await supabaseNavegador().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) {
      console.error('[entrar com Google]', error.message);
      setErro('Não deu pra entrar com o Google agora. Tenta de novo, ou entra com o e-mail.');
    }
  }

  const textoBotao = enviando
    ? 'Enviando…'
    : mandaEmail && mesmoEmail && enviado?.tipo === ENVIA[modo]
      ? faltam
        ? `Mandar de novo em ${faltam} s`
        : 'Mandar de novo'
      : BOTAO[modo];

  const avisoEnviado =
    enviado &&
    (enviado.tipo === 'link'
      ? 'Link enviado para'
      : enviado.tipo === 'confirmacao'
        ? 'Confirma o e-mail: mandamos um link para'
        : 'Se houver uma conta com esse e-mail, mandamos um link pra trocar a senha para');

  const explica: Record<Exclude<Modo, 'entrar'>, string> = {
    criar: 'Chega um link no teu e-mail pra confirmar a conta; por ele tu escolhe a senha.',
    esqueci: 'Chega um link no teu e-mail pra escolher uma senha nova.',
    link: 'Sem senha: chega um link no teu e-mail, e é só abrir.',
  };

  return (
    <div className="form-entrar">
      {comAbas ? (
        // Abas (e não botões): "Entrar" e "Criar conta" também são os botões de envio, e o leitor de tela diferencia.
        <div
          className="modos"
          role="tablist"
          aria-label="Entrar ou criar conta"
          onKeyDown={(e) => {
            // Setas trocam de aba; Home e End vão pra primeira e a última, como em qualquer lista de abas.
            const proximo =
              e.key === 'Home' ? 'entrar' : e.key === 'End' ? 'criar' : e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? (modo === 'criar' ? 'entrar' : 'criar') : null;
            if (!proximo) return;
            e.preventDefault();
            trocarModo(proximo);
            e.currentTarget.querySelector<HTMLElement>(`[data-modo="${proximo}"]`)?.focus();
          }}
        >
          {ABAS.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              data-modo={m}
              aria-selected={modo === m}
              aria-controls={idPainel}
              tabIndex={modo === m ? 0 : -1}
              onClick={() => trocarModo(m)}
            >
              {BOTAO[m]}
            </button>
          ))}
        </div>
      ) : (
        // Fora das abas, um título: o formulário não é painel de aba nenhuma.
        <h2 className="titulo-modo">{modo === 'esqueci' ? 'Esqueci a senha' : 'Entrar com um link'}</h2>
      )}
      <form
        onSubmit={enviar}
        className="form-entrar-email"
        id={idPainel}
        role={comAbas ? 'tabpanel' : undefined}
        aria-label={comAbas ? BOTAO[modo] : undefined}
      >
        <label className="campo">
          E-mail
          <input ref={campoEmail} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {modo === 'entrar' && (
          <div className="campo">
            <label htmlFor={idSenha}>Senha</label>
            <div className="senha">
              <input
                id={idSenha}
                type={verSenha ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button type="button" className="ver-senha" aria-pressed={verSenha} aria-controls={idSenha} onClick={() => setVerSenha(!verSenha)}>
                {verSenha ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
        )}
        {modo !== 'entrar' && (
          <p className="explica-modo" id={idExplica}>
            {explica[modo]}
          </p>
        )}
        <button
          className="botao primario"
          type="submit"
          disabled={!pronto}
          aria-disabled={ocupado || undefined}
          aria-describedby={modo !== 'entrar' ? idExplica : undefined}
        >
          {textoBotao}
        </button>
      </form>
      <div className="outros-modos">
        {modo === 'entrar' && (
          <>
            <button type="button" className="link-modo" onClick={() => trocarModo('esqueci')}>
              Esqueci a senha
            </button>
            <button type="button" className="link-modo" onClick={() => trocarModo('link')}>
              Receber um link por e-mail
            </button>
          </>
        )}
        {!comAbas && (
          <button type="button" className="link-modo" onClick={() => trocarModo('entrar')}>
            Entrar com a senha
          </button>
        )}
      </div>
      {/* Montadas vazias: o leitor de tela anuncia o que entra numa região que já existia. */}
      <div role="status">
        {enviado && (
          <p className="aviso-caixa ok enviado">
            {avisoEnviado} <b>{enviado.para}</b>.{enviado.tipo === 'confirmacao' ? ' Pelo link, tu escolhe a senha.' : ''}
          </p>
        )}
      </div>
      {enviado && (
        <div className="acoes-enviado">
          <button
            className="botao pequeno"
            type="button"
            onClick={() => {
              setEmail('');
              setEnviado(null);
              setErro(null);
              setEsperaAte(0);
              campoEmail.current?.focus();
            }}
          >
            Usar outro e-mail
          </button>
        </div>
      )}
      <div role="alert">{erro && <div className="aviso-caixa erro">{erro}</div>}</div>
      {google && (
        <>
          <div className="ou" aria-hidden="true">
            ou
          </div>
          <button className="botao" type="button" disabled={!pronto} onClick={comGoogle}>
            Entrar com Google
          </button>
        </>
      )}
    </div>
  );
}
```

`apps/web/src/app/entrar/entrar.css`:

```css
/* Entrar: o formulário de um lado, a prévia do quadro do outro. Tokens do globals.css; as duas cores de canal da
   prévia são as dos canais padrão (WhatsApp e E-mail), aqui porque a página não lê os canais de empresa nenhuma. */
.entrada {
  --wa: #159e5a;
  --mail: #c98410;
  /* O texto em cima da água (a opção escolhida): claro no tema claro, escuro no escuro, onde a água é mais clara. */
  --na-agua: #ffffff;
  /* O verde das formas cheias (o Início, a opção escolhida): mais escuro no claro, pro texto branco ter contraste. */
  --wa-forte: #11804a;
  min-height: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: clamp(20px, 5vw, 64px) clamp(16px, 4vw, 56px);
  display: grid;
  grid-template-columns: minmax(0, 430px) minmax(0, 1fr);
  gap: clamp(28px, 6vw, 88px);
  align-items: center;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .entrada { --wa: #2cc274; --mail: #eda63a; --na-agua: #0a1014; --wa-forte: #2cc274; }
}
:root[data-theme='dark'] .entrada { --wa: #2cc274; --mail: #eda63a; --na-agua: #0a1014; --wa-forte: #2cc274; }

.entrada .lado-form { display: grid; gap: 28px; align-content: center; }
.entrada .chamada { display: grid; gap: 14px; }
.entrada h1 { font-size: clamp(36px, 4.4vw, 54px); font-weight: 800; line-height: 1; letter-spacing: -0.035em; text-wrap: balance; }
.entrada .lead { margin: 0; max-width: 44ch; font-size: 15.5px; line-height: 1.55; color: var(--ink-2); }

.entrada .form-entrar { display: flex; flex-direction: column; padding: 18px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; }
.entrada .form-entrar-email { display: grid; gap: 10px; }
/* O espaço vai só entre o que aparece: as regiões vivas ficam montadas mesmo vazias, e vazias não abrem espaço. */
.entrada .form-entrar > :not(:first-child):not(:empty) { margin-top: 12px; }
.entrada .form-entrar .campo input { font-size: 15px; padding: 10px 12px; }
.entrada .form-entrar .botao { padding: 10px 14px; font-size: 14px; }
/* Entrar ou criar conta: um segmentado, como os do editor. */
.entrada .modos { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; padding: 3px; border: 1px solid var(--line); border-radius: 11px; background: var(--node); }
.entrada .modos button { border: 0; background: none; border-radius: 8px; padding: 7px 10px; font-size: 13.5px; font-weight: 500; color: var(--ink-2); cursor: pointer; }
.entrada .modos button[aria-selected='true'] { background: var(--btn); color: var(--btn-ink); }
/* Esqueci a senha e o link: fora das abas, com título. */
.entrada .titulo-modo { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.entrada .explica-modo { margin: 0; font-size: 13px; color: var(--ink-2); }
.entrada .senha { display: flex; gap: 6px; }
.entrada .senha input { flex: 1; min-width: 0; }
.entrada .ver-senha { flex: none; border: 1px solid var(--line); background: var(--node); color: var(--ink-2); border-radius: 10px; padding: 0 12px; font-size: 12.5px; cursor: pointer; }
.entrada .ver-senha[aria-pressed='true'] { color: var(--ink); border-color: var(--ink-3); }
/* Os outros jeitos (esqueci a senha, link por e-mail): discretos, como links. */
.entrada .outros-modos { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.entrada .link-modo { border: 0; background: none; padding: 2px 0; font-size: 13px; color: var(--ink-2); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.entrada .link-modo:hover { color: var(--ink); }
.entrada .acoes-enviado { display: flex; flex-wrap: wrap; gap: 8px; }
.entrada .aviso-caixa.erro { display: grid; gap: 8px; justify-items: start; }
.entrada .enviado { display: grid; gap: 10px; justify-items: start; line-height: 1.45; }
.entrada .enviado b { word-break: break-all; }
.entrada .ou { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; font-size: 12.5px; color: var(--ink-2); }
.entrada .ou::before, .entrada .ou::after { content: ''; height: 1px; background: var(--line); }

/* A prévia: o palco do editor (pontos sobre o canvas) com um fluxo pequeno dentro. */
.previa { position: relative; aspect-ratio: 560 / 400; border-radius: 22px; border: 1px solid var(--line); background-color: var(--canvas); background-image: radial-gradient(var(--dot) 1.1px, transparent 1.2px); background-size: 18px 18px; box-shadow: var(--shadow); overflow: hidden; }
.previa svg { display: block; width: 100%; height: 100%; }
.previa text { font-family: var(--f-body); }
.previa .pv-nome { font-size: 13.5px; font-weight: 600; fill: var(--ink); }
.previa .pv-sub { font-size: 11px; fill: var(--ink-2); }
.previa .pv-ponto-wa { fill: var(--wa); }
.previa .pv-ponto-email { fill: var(--mail); }
.previa .pv-placa { fill: var(--plate); }
.previa .pv-corpo { fill: var(--node); stroke: var(--node-line); stroke-width: 1.4; }
.previa .pv-tile { fill: var(--tile); }
.previa .pv-tile.c-wa-cheio { fill: var(--wa-forte); }
.previa .pv-icone { fill: none; stroke: var(--ink-2); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.previa .pv-icone.cheio { fill: #fff; stroke: none; }
.previa .pv-nivel { opacity: 0; }
.previa .pv-nivel.c-wa { fill: var(--wa); }
.previa .pv-nivel.c-email { fill: var(--mail); }
.previa .pv-losango { fill: var(--node); stroke: var(--ink-2); stroke-width: 1.6; }
.previa .pv-pulso { fill: none; stroke: var(--wa); stroke-width: 2.4; opacity: 0; transform-box: fill-box; transform-origin: center; }
.previa .pv-parede { fill: none; stroke: var(--pipe-wall); stroke-width: 12; stroke-linecap: round; }
.previa .pv-miolo { fill: none; stroke: var(--pipe-core); stroke-width: 7; stroke-linecap: round; }
.previa .pv-agua { fill: none; stroke-width: 6; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; }
.previa .pv-agua.c-wa { stroke: var(--wa); }
.previa .pv-agua.c-email { stroke: var(--mail); }
.previa .pv-agua.agua-seca { display: none; }
.previa .pv-opcao rect { fill: var(--node); stroke: var(--node-line); }
.previa .pv-opcao text { font: 500 11.5px var(--f-mono); fill: var(--ink-2); }
.previa .pv-tempo text { font-size: 12.5px; fill: var(--ink-2); opacity: 0; }

/* O play, uma volta de 9 s: a água enche cano por cano, espera na decisão, escolhe "Protocolo", vira e-mail no
   protocolo (a cor muda), chega no fim e mostra o tempo; depois esvazia e recomeça. */
.previa .agua-a { animation: agua-a 9s linear 3; }
.previa .agua-b { animation: agua-b 9s linear 3; }
.previa .agua-c { animation: agua-c 9s linear 3; }
.previa .agua-d { animation: agua-d 9s linear 3; }
.previa .molha-1 .pv-nivel { animation: molha-1 9s linear 3; }
.previa .molha-2 .pv-nivel { animation: molha-2 9s linear 3; }
.previa .molha-4 .pv-nivel { animation: molha-4 9s linear 3; }
.previa .molha-5 .pv-nivel { animation: molha-5 9s linear 3; }
.previa .pv-pulso { animation: pulso-pv 9s ease-out 3; }
.previa .pv-escolhida rect { animation: escolha-rect 9s linear 3; }
.previa .pv-escolhida text { animation: escolha-texto 9s linear 3; }
.previa .pv-tempo text { animation: tempo-pv 9s linear 3; }

@keyframes agua-a { 0% { stroke-dashoffset: 1; opacity: 1; } 11% { stroke-dashoffset: 0; } 88% { stroke-dashoffset: 0; opacity: 1; } 96%, 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes agua-b { 0%, 13% { stroke-dashoffset: 1; opacity: 1; } 19% { stroke-dashoffset: 0; } 88% { stroke-dashoffset: 0; opacity: 1; } 96%, 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes agua-c { 0%, 37% { stroke-dashoffset: 1; opacity: 1; } 43% { stroke-dashoffset: 0; } 88% { stroke-dashoffset: 0; opacity: 1; } 96%, 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes agua-d { 0%, 46% { stroke-dashoffset: 1; opacity: 1; } 57% { stroke-dashoffset: 0; } 88% { stroke-dashoffset: 0; opacity: 1; } 96%, 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes molha-1 { 0% { opacity: 0; } 3%, 88% { opacity: .2; } 96%, 100% { opacity: 0; } }
@keyframes molha-2 { 0%, 11% { opacity: 0; } 13%, 88% { opacity: .2; } 96%, 100% { opacity: 0; } }
@keyframes molha-4 { 0%, 43% { opacity: 0; } 45%, 88% { opacity: .2; } 96%, 100% { opacity: 0; } }
@keyframes molha-5 { 0%, 57% { opacity: 0; } 59%, 88% { opacity: .2; } 96%, 100% { opacity: 0; } }
@keyframes pulso-pv { 0%, 19% { opacity: 0; transform: rotate(45deg) scale(1); } 23% { opacity: .75; } 27% { opacity: 0; transform: rotate(45deg) scale(1.12); } 28% { opacity: 0; transform: rotate(45deg) scale(1); } 31% { opacity: .75; } 35%, 100% { opacity: 0; transform: rotate(45deg) scale(1.12); } }
@keyframes escolha-rect { 0%, 33% { fill: var(--node); stroke: var(--node-line); } 35%, 88% { fill: var(--wa-forte); stroke: var(--wa-forte); } 96%, 100% { fill: var(--node); stroke: var(--node-line); } }
@keyframes escolha-texto { 0%, 33% { fill: var(--ink-2); } 35%, 88% { fill: var(--na-agua); } 96%, 100% { fill: var(--ink-2); } }
@keyframes tempo-pv { 0%, 58% { opacity: 0; } 62%, 88% { opacity: 1; } 96%, 100% { opacity: 0; } }

/* Fora da tela ou com a aba escondida, a água para onde está (ControleDaAnimacao). */
.previa.pausada * { animation-play-state: paused !important; }

/* Movimento reduzido, ou depois das três voltas: a água parada, já no fim do caminho. */
.previa.terminou .pv-agua { stroke-dashoffset: 0; animation: none !important; }
.previa.terminou .pv-nivel, .previa.terminou .pv-pulso, .previa.terminou .pv-tempo text, .previa.terminou .pv-escolhida rect, .previa.terminou .pv-escolhida text { animation: none !important; }
.previa.terminou .molha-1 .pv-nivel, .previa.terminou .molha-2 .pv-nivel, .previa.terminou .molha-4 .pv-nivel, .previa.terminou .molha-5 .pv-nivel { opacity: .2; }
.previa.terminou .pv-escolhida rect { fill: var(--wa-forte); stroke: var(--wa-forte); }
.previa.terminou .pv-escolhida text { fill: var(--na-agua); }
.previa.terminou .pv-tempo text { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .previa .pv-agua { stroke-dashoffset: 0; animation: none !important; }
  .previa .pv-nivel, .previa .pv-pulso, .previa .pv-tempo text, .previa .pv-escolhida rect, .previa .pv-escolhida text { animation: none !important; }
  .previa .molha-1 .pv-nivel, .previa .molha-2 .pv-nivel, .previa .molha-4 .pv-nivel, .previa .molha-5 .pv-nivel { opacity: .2; }
  .previa .pv-escolhida rect { fill: var(--wa-forte); stroke: var(--wa-forte); }
  .previa .pv-escolhida text { fill: var(--na-agua); }
  .previa .pv-tempo text { opacity: 1; }
}

/* Celular: uma coluna, o formulário primeiro e a prévia menor embaixo. */
@media (max-width: 820px) {
  .entrada { grid-template-columns: minmax(0, 1fr); align-items: start; gap: 28px; }
  .entrada .lado-form { gap: 22px; }
  .previa { max-width: 560px; width: 100%; justify-self: center; box-shadow: none; }
}
/* Bem estreito, a prévia (decorativa) teria letra de 6 px: sai. */
@media (max-width: 419px) {
  .previa { display: none; }
}
```

`apps/web/src/app/conta/senha/page.tsx`:

```tsx
import Link from 'next/link';
import { Marca } from '@/componentes/Marca';
import { usuarioAtual } from '@/lib/dados';
import { FormularioSenha } from './formulario';

export const metadata = { title: 'Senha · Journey' };

/**
 * Escolher (ou trocar) a senha: quem acabou de confirmar o cadastro ("Criar conta"), quem veio de "Esqueci a senha"
 * (o /auth/confirmar já gravou a sessão) e quem está logado e quer uma senha (entrou pelo Google ou pelo link). Sem
 * sessão, `usuarioAtual` manda pro entrar. A senha é opcional: "Agora não" segue pra raiz, que aceita os convites.
 */
export default async function PaginaSenha() {
  const { usuario } = await usuarioAtual();
  return (
    <main className="entrar">
      <div className="cartao">
        <Marca />
        <h1>Tua senha</h1>
        <p className="mudo">
          Pra entrar com o e-mail <b>{usuario.email}</b> e uma senha. Os outros jeitos de entrar continuam valendo.
        </p>
        <FormularioSenha email={usuario.email ?? ''} />
        <Link className="link-discreto" href="/">
          Agora não
        </Link>
      </div>
    </main>
  );
}
```

`apps/web/src/app/conta/senha/formulario.tsx`:

```tsx
'use client';

import { useEffect, useId, useState } from 'react';
import { SENHA_MINIMA, mensagemDoErro } from '@/lib/acesso';
import { supabaseNavegador } from '@/lib/supabase/navegador';

/** A senha nova vai pelo navegador (`updateUser`, com a sessão daqui); salva, volta pra casa da empresa. */
export function FormularioSenha({ email }: { email: string }) {
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const id = useId();
  const idRequisito = useId();

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`);
    setEnviando(true);
    setErro(null);
    const { error } = await supabaseNavegador().auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      console.error('[senha nova]', error.status, error.code, error.message);
      return setErro(mensagemDoErro(error).texto);
    }
    window.location.assign('/');
  }

  return (
    <form onSubmit={salvar} style={{ display: 'grid', gap: 10 }}>
      {/* Pro gerenciador de senhas saber de qual conta é a senha nova. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <label className="campo" htmlFor={id}>
        Senha nova
      </label>
      <div style={{ display: 'flex', gap: 6, marginTop: -6 }}>
        <input
          id={id}
          className="entrada-texto"
          type={ver ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={SENHA_MINIMA}
          aria-describedby={idRequisito}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <button className="botao" type="button" aria-pressed={ver} aria-controls={id} onClick={() => setVer(!ver)}>
          {ver ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      <small id={idRequisito} style={{ color: 'var(--ink-2)', fontSize: 12.5 }}>
        Pelo menos {SENHA_MINIMA} caracteres.
      </small>
      <button className="botao primario" type="submit" disabled={!pronto} aria-disabled={enviando || undefined}>
        {enviando ? 'Salvando…' : 'Salvar a senha'}
      </button>
      <div role="alert">{erro && <p className="aviso-caixa erro">{erro}</p>}</div>
    </form>
  );
}
```

`apps/web/src/app/e/[empresa]/layout.tsx`:

```diff
diff --git a/apps/web/src/app/e/[empresa]/layout.tsx b/apps/web/src/app/e/[empresa]/layout.tsx
index 32a0cc3..cb87104 100644
--- a/apps/web/src/app/e/[empresa]/layout.tsx
+++ b/apps/web/src/app/e/[empresa]/layout.tsx
@@ -1,3 +1,4 @@
+import Link from 'next/link';
 import { Marca } from '@/componentes/Marca';
 import { Nav } from '@/componentes/Nav';
 import { empresa } from '@/lib/dados';
@@ -11,9 +12,15 @@ export default async function LayoutEmpresa({ children, params }: { children: Re
         <Marca href={`/e/${id}`} />
         <span className="migalhas">{e.nome}</span>
         <Nav empresaId={id} />
-        <form action="/sair" method="post" className="empurra">
-          <button className="botao pequeno">Sair</button>
-        </form>
+        <div className="empurra conta">
+          {/* Definir ou trocar a senha (quem entrou pelo Google ou pelo link também pode ter uma). */}
+          <Link className="botao pequeno" href="/conta/senha">
+            Senha
+          </Link>
+          <form action="/sair" method="post">
+            <button className="botao pequeno">Sair</button>
+          </form>
+        </div>
       </header>
       {children}
     </div>
```

`apps/web/src/app/empresa/nova/page.tsx`:

```diff
diff --git a/apps/web/src/app/empresa/nova/page.tsx b/apps/web/src/app/empresa/nova/page.tsx
index fa01879..8b47807 100644
--- a/apps/web/src/app/empresa/nova/page.tsx
+++ b/apps/web/src/app/empresa/nova/page.tsx
@@ -1,3 +1,4 @@
+import Link from 'next/link';
 import { Marca } from '@/componentes/Marca';
 import { FormularioEmpresa } from './formulario';
 
@@ -9,6 +10,15 @@ export default function NovaEmpresa() {
         <h1>Tua empresa</h1>
         <p className="mudo">É o espaço onde ficam os fluxos, os cadastros e quem pode editar. Depois tu convida os colegas.</p>
         <FormularioEmpresa />
+        {/* Quem ainda não tem empresa também escolhe a senha e sai daqui (o topo da empresa só existe depois). */}
+        <div className="conta-rodape">
+          <Link className="botao pequeno" href="/conta/senha">
+            Senha
+          </Link>
+          <form action="/sair" method="post">
+            <button className="botao pequeno">Sair</button>
+          </form>
+        </div>
       </div>
     </main>
   );
```

`apps/web/src/app/globals.css`:

```diff
diff --git a/apps/web/src/app/globals.css b/apps/web/src/app/globals.css
index d690ed8..2d3fc21 100644
--- a/apps/web/src/app/globals.css
+++ b/apps/web/src/app/globals.css
@@ -72,6 +72,10 @@ h2 { font-size: 18px; font-weight: 700; }
 .nav a, .nav button { display: flex; align-items: center; gap: 7px; border: 0; background: none; border-radius: 8px; padding: 5px 11px; font-size: 12.5px; font-weight: 500; color: var(--ink-2); cursor: pointer; text-decoration: none; }
 .nav a[aria-current='page'], .nav button[aria-pressed='true'], .nav button[aria-selected='true'] { background: var(--node); color: var(--ink); box-shadow: 0 1px 0 var(--line); }
 .empurra { margin-left: auto; }
+.empurra.conta { display: flex; gap: 8px; align-items: center; }
+/* Fora do editor (empresa nova, senha): o que é da conta fica embaixo do cartão, discreto. */
+.link-discreto { justify-self: start; font-size: 13px; color: var(--ink-2); text-underline-offset: 3px; }
+.conta-rodape { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
 
 /* Páginas comuns. */
 .pagina { max-width: 1080px; width: 100%; margin: 0 auto; display: grid; gap: 16px; align-content: start; padding-bottom: 32px; }
```

- [ ] **Passo 7: rodar e ver passar**

Run: `npm run typecheck && cd apps/web && npx vitest run test/lib/acesso.test.ts test/app/callback.test.ts test/app/confirmar.test.ts && npx playwright test e2e/conta.spec.ts e2e/entrar.spec.ts --trace=off`
Expected: `tsc` limpo; `Tests  16 passed (16)`; `14 passed` (conta 6, entrar 8), entre eles: quem cadastrou o e-mail da convidada antes dela não entra; o link aberto em outro navegador funciona; abrir o link (GET) não entra nem gasta o token, e o POST de outro site dá 403.

- [ ] **Passo 8: commit**

```bash
git add -A supabase apps/web
git commit -m "entrar: e-mail e senha, Google e o link; a senha some na confirmação e ninguém troca o próprio e-mail; e-mails pelo /auth/confirm com botão" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 11: documentação e fechamento

**Arquivos:**
- Modificar: `README.md`, `apps/web/README.md`, `packages/nucleo/README.md`

- [ ] **Passo 1: os READMEs**

`README.md`:

````diff
diff --git a/README.md b/README.md
index 67608f1..82cf44a 100644
--- a/README.md
+++ b/README.md
@@ -2,11 +2,13 @@
 
 O fluxo de atendimento, de qualquer canal, como um encanamento: desenha o fluxo, dá play e a água anda pelos canos. Serve pra desenhar, entender e explicar um fluxo, testar cenários ("e se…") e encontrar problemas sozinho. White label: cada empresa tem os seus fluxos, cadastros e canais.
 
+Hoje (etapa C da v2): a empresa cria fluxos em branco ou a partir de um modelo, desenha no editor, dá play, salva cenários, marca versões, vê o diagnóstico ao vivo e manda um link público só de leitura, com um cenário que toca sozinho e os nomes das pessoas escondidos.
+
 - Spec: [v2, o editor no centro](docs/superpowers/specs/2026-11-13-journey-v2-editor.md) (substitui a [v1](docs/superpowers/specs/2026-11-12-journey-design.md))
 - `packages/fluxo`: o modelo genérico da v2 (documento, motor, diagnóstico e modelos), sem tela ([README](packages/fluxo/README.md))
-- `packages/nucleo`: formato, importação, modelos, motor e diagnóstico, de telefonia, sem tela; na v2 vira o importador de central ([README](packages/nucleo/README.md))
-- `apps/web`: o app (Next.js + Supabase): fluxos, editor, cadastros ([README](apps/web/README.md))
-- `supabase/`: migração, regras de acesso e testes do banco
+- `packages/nucleo`: o formato e a leitura da planilha da central (v1), de telefonia, sem tela. O app não usa: fica no repositório pro importador de central (etapa E) ([README](packages/nucleo/README.md))
+- `apps/web`: o app (Next.js + Supabase): fluxos, editor, cadastros, cenários, versões, diagnóstico e link público ([README](apps/web/README.md))
+- `supabase/`: migrações, regras de acesso e testes do banco (pgTAP)
 
 ## Rodar
 
@@ -18,17 +20,34 @@ sed -i "s|^SUPABASE_SECRET_KEY=.*|SUPABASE_SECRET_KEY=$(npx supabase status -o j
 npm run dev        # http://127.0.0.1:3000
 ```
 
-Testes: `npm test`, `npm run banco:testes`, `npm run e2e`, `npm run typecheck` e `npm run build` (detalhes no [README do app](apps/web/README.md)).
+Testes: `npm test` (539: fluxo 84, núcleo 253, app 202), `npm run banco:testes` (181), `npm run e2e` (25), `npm run typecheck` e `npm run build` (detalhes no [README do app](apps/web/README.md)).
 
 ## Publicar
 
 Uma vez, com as contas da empresa:
 
-1. **Supabase:** criar o projeto (região São Paulo). Em Authentication → URL Configuration, pôr o domínio de produção do app em Site URL e `https://<domínio de produção>/auth/callback` em Redirect URLs. Em Authentication → Providers → Email, deixar **Confirm email** ligado: o convite só vale pra e-mail confirmado, e sem a confirmação alguém entraria com o e-mail de outra pessoa. Pra entrar com Google, ligar o provedor Google com o cliente OAuth da empresa.
-2. **E-mail do login:** em Authentication → SMTP Settings, ligar o SMTP próprio (ex.: o SMTP relay do Google Workspace da empresa, `smtp-relay.gmail.com`, com o remetente de um domínio dela) e, em Authentication → Rate Limits, subir o limite de e-mails por hora. O carteiro que vem com o Supabase só entrega pra quem é da equipe do projeto e manda pouquíssimos e-mails por hora: sem SMTP próprio, o link mágico não chega pra ninguém de fora.
-3. **Banco:** `npx supabase link --project-ref <ref>` e `npx supabase db push` (aplica `supabase/migrations`).
-4. **Vercel:** importar o repositório com Root Directory `apps/web`. Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (do projeto), `SUPABASE_SECRET_KEY` (a secret key do projeto, em Project Settings → API Keys; marcada como Sensitive, sem `NEXT_PUBLIC_`: os links públicos precisam dela no servidor) e, se o Google estiver ligado, `NEXT_PUBLIC_LOGIN_GOOGLE=sim`. `APP_URL` vai **só no ambiente Production**, com o domínio de produção (ex.: `https://journey.exemplo.com`), e o app passa a ser usado só por esse domínio: os redirecionamentos e a conferência do Sair usam ela, então num preview com a `APP_URL` de produção o login voltaria pra produção e o Sair recusaria o pedido. Sem `APP_URL` (os previews), o app confia nos cabeçalhos do pedido. Crie e compartilhe os links públicos pelo domínio de produção: o endereço do link usa o endereço em que o membro está, e um link criado num preview aponta pro preview (que a proteção da Vercel pode fechar pra quem não tem conta).
-5. **Previews (se quiser entrar neles):** pôr também `https://*-<time>.vercel.app/**` em Redirect URLs no Supabase; sem isso o link mágico de um preview cai na Site URL.
-6. Entrar, criar a empresa e importar a planilha da central (até 4 MB somando os arquivos: a Vercel corta o corpo do pedido em 4,5 MB; mais que isso pede upload direto pro Storage, que fica pra depois).
-
-A cada etapa nova que traz migração, rode `npx supabase db push` **antes** de publicar o app na Vercel: o app novo lê tabelas novas e, sem a migração, a página da jornada dá erro.
+1. **Supabase:** criar o projeto (região São Paulo). No painel (o nome antigo de cada tela entre parênteses):
+   1. Authentication → URL Configuration: **Site URL** = o domínio de produção (`https://<domínio de produção>`; os links dos e-mails usam ela) e, em **Redirect URLs**, `https://<domínio de produção>/**` (a volta do Google, no `/auth/callback`).
+   2. Authentication → Sign In / Providers → Email (antes: Authentication → Providers → Email):
+      - **Confirm email** ligado: o convite só vale pra e-mail confirmado;
+      - **Secure password change** desligado (o padrão): quem está logado troca a senha sem digitar a atual;
+      - **Minimum password length** = **8** (o padrão é 6; o app já pede 8).
+   3. Authentication → Emails → Templates (antes: Authentication → Email Templates): trocar três modelos pelos do repositório, que mandam o link pro `/auth/confirm` do app: uma página com um botão, que confirma no servidor (assim o link abre em qualquer navegador ou aparelho, e não só no que pediu, e o leitor de links do provedor de e-mail não gasta o link só de abrir). Em cada um, o assunto e o HTML do arquivo, inteiro:
+      - **Confirm signup**: assunto `Confirma teu e-mail no Journey`, corpo `supabase/templates/confirmacao.html`;
+      - **Magic Link**: assunto `Teu link pra entrar no Journey`, corpo `supabase/templates/link.html`;
+      - **Reset Password**: assunto `Trocar a senha do Journey`, corpo `supabase/templates/recuperacao.html`.
+      Os outros (Invite user, Change email address, Reauthentication) o app não usa. Com o app já no ar, troque os modelos logo depois de publicar a versão que tem o `/auth/confirm`.
+   4. **Conferir que o cadastro direto pela API não conta quem tem conta:** com um e-mail que já tem conta confirmada, `curl -s -X POST https://<ref do projeto>.supabase.co/auth/v1/signup -H "apikey: <publishable key>" -H "content-type: application/json" -d '{"email":"<e-mail com conta>","password":"qualquer-coisa-123"}'`. Se a resposta for `user_already_exists` (no Supabase local é), a API conta quem tem conta. O app não usa esse cadastro (o "Criar conta" responde igual pra todo e-mail), então isso só aparece pra quem chama a API direto; anote como risco conhecido.
+   5. **Cuidados no painel:** criar gente pelo painel (Authentication → Users → Add user) só com **Create new user** e **Auto Confirm User** marcado, se for dar uma senha: com "Send invitation" (Invite user) ou sem confirmar na hora, a senha posta pelo painel some quando a pessoa confirma o e-mail (a trigger da migração `20261116000000`), e ela escolhe outra pelo link ou em "Esqueci a senha". Trocar o e-mail de alguém pelo painel funciona; pela própria pessoa, não (o app não oferece, e o banco recusa).
+2. **E-mail do login (SMTP):** o Supabase manda os e-mails de confirmar o cadastro, trocar a senha e do link de entrar. O carteiro que vem com ele só entrega pra quem é da equipe do projeto e manda pouquíssimos e-mails por hora (e recusa outro e-mail pro mesmo endereço em menos de 60 s): sem SMTP próprio, ninguém de fora consegue criar conta nem trocar a senha. Em Authentication → Emails → SMTP Settings (antes: Project Settings → Authentication → SMTP Settings), ligar **Enable custom SMTP**: host, porta, usuário e senha do provedor (ex.: o SMTP relay do Google Workspace da empresa, `smtp-relay.gmail.com`, porta 587), remetente com um endereço do domínio da empresa e nome `Journey`. Depois, em Authentication → Rate Limits, subir o limite de e-mails por hora (ex.: 100).
+3. **Entrar com Google (opcional):**
+   1. No Google Cloud Console da empresa, em Google Auth Platform (antes: APIs e serviços → Tela de permissão OAuth): em **Branding**, nome do app, e-mail de suporte e o domínio de produção em domínios autorizados; em **Audience**, tipo Externo, e **Publicar o app** (em teste, só entram os e-mails da lista de teste).
+   2. Em **Clients** → Criar cliente (antes: APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth) → Aplicativo da Web. Em **Origens JavaScript autorizadas**, `https://<domínio de produção>`; em **URIs de redirecionamento autorizados**, `https://<ref do projeto>.supabase.co/auth/v1/callback` (a URL exata aparece no Supabase, no passo seguinte, como "Callback URL"). Guardar o ID do cliente e a chave secreta.
+   3. No Supabase: Authentication → Sign In / Providers → Google (antes: Providers → Google) → ligar, colar o ID do cliente e a chave secreta, salvar.
+   4. Na Vercel: `NEXT_PUBLIC_LOGIN_GOOGLE=sim` (e publicar de novo: a variável entra no build). Sem ela, o botão não aparece.
+4. **Banco:** `npx supabase link --project-ref <ref>` e `npx supabase db push` (aplica `supabase/migrations`). A migração da etapa C (`20261115000000`) apaga as tabelas e o bucket da v1 e para sozinha se achar dado neles; rode-a antes uma vez dentro de `begin; … rollback;` (no SQL Editor) pra conferir. A `20261116000000` põe duas travas em `auth.users`: apaga a senha na hora em que o e-mail é confirmado, e recusa a troca de e-mail pedida pela própria pessoa. Sem elas, quem cadastrasse antes o e-mail de uma pessoa convidada (com uma senha dele), ou trocasse o e-mail da conta dele pro dela, entraria na conta e na empresa dela depois que ela clicasse no e-mail.
+5. **Vercel:** importar o repositório com Root Directory `apps/web`. Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (do projeto), `SUPABASE_SECRET_KEY` (a secret key do projeto, em Project Settings → API Keys; marcada como Sensitive, sem `NEXT_PUBLIC_`: os links públicos precisam dela no servidor) e, se o Google estiver ligado, `NEXT_PUBLIC_LOGIN_GOOGLE=sim`. `APP_URL` vai **só no ambiente Production**, com o domínio de produção (ex.: `https://journey.exemplo.com`), e o app passa a ser usado só por esse domínio: os redirecionamentos e a conferência do Sair usam ela, então num preview com a `APP_URL` de produção o login voltaria pra produção e o Sair recusaria o pedido. Sem `APP_URL` (os previews), o app confia nos cabeçalhos do pedido. Crie e compartilhe os links públicos pelo domínio de produção: o endereço do link usa o endereço em que o membro está, e um link criado num preview aponta pro preview (que a proteção da Vercel pode fechar pra quem não tem conta).
+6. **Previews (se quiser entrar neles):** com e-mail e senha, entra direto. Os links dos e-mails vão sempre pra Site URL (produção): "Esqueci a senha" pedido num preview troca a senha lá, e vale nos dois (o Supabase é o mesmo). Pro Google num preview, pôr também `https://*-<time>.vercel.app/**` em Redirect URLs.
+7. Criar a conta (Criar conta, abrir o link do e-mail, escolher a senha), a empresa e o primeiro fluxo (em branco ou a partir de um modelo).
+
+A cada etapa nova que traz migração, rode `npx supabase db push` e publique o app na Vercel logo em seguida, nessa ordem: o app novo lê tabelas novas e, sem a migração, o editor dá erro; e o app velho lê tabelas que a migração nova apaga.
````

`apps/web/README.md`:

````diff
diff --git a/apps/web/README.md b/apps/web/README.md
index beaddec..84740f8 100644
--- a/apps/web/README.md
+++ b/apps/web/README.md
@@ -1,8 +1,6 @@
 # @journey/web
 
-O app do Journey. Desde a v2 (etapa B), a casa da empresa é a tela **Fluxos**: criar um fluxo em branco ou a partir de um modelo, desenhar no **editor** (peças, ligações com regra, grupos, notas, estilo da água), dar play e ver a água andar, com os **Cadastros** (pessoas, filas, equipes, sistemas, horários) nascendo do desenho. A lógica do fluxo vem do `@journey/fluxo`.
-
-As telas da v1 (import da central, catálogo, jornadas, links públicos das jornadas) continuam no código e saíram do menu: a etapa C leva os links e os cenários pros fluxos e tira a v1. A lógica delas vem do `@journey/nucleo`.
+O app do Journey (v2). A casa da empresa é a tela **Fluxos**: criar um fluxo em branco ou a partir de um modelo e desenhar no **editor** (peças, ligações com regra, grupos, notas, estilo da água), dar play e ver a água andar, com os **Cadastros** (pessoas, filas, equipes, sistemas, horários) nascendo do desenho. No editor também ficam o **diagnóstico** ao vivo, os **cenários** (caminhos salvos do play, conferidos a cada mudança), as **versões** marcadas e o **Compartilhar**, que cria o **link público** só de leitura (`/l/<token>`). A lógica do fluxo vem do `@journey/fluxo`.
 
 ## Rodar
 
@@ -16,104 +14,111 @@ sed -i "s|^SUPABASE_SECRET_KEY=.*|SUPABASE_SECRET_KEY=$(npx supabase status -o j
 npm run dev                         # http://127.0.0.1:3000
 ```
 
-O link mágico chega no Mailpit local: http://127.0.0.1:54324. Abre o app em `127.0.0.1`, não em `localhost`: sem `APP_URL`, o link volta pro endereço do pedido e a sessão é por endereço.
+Os e-mails do login (confirmação, link, recuperação) chegam no Mailpit local: http://127.0.0.1:54324. Os links apontam pra Site URL do `config.toml` (`http://127.0.0.1:3000`): abre o app em `127.0.0.1`, não em `localhost`, porque a sessão é por endereço.
 
 ## Testes
 
 ```bash
-npm test                 # unitários do núcleo e do app; os de banco rodam se o Supabase local estiver no ar
+npm test                 # unitários do fluxo, do núcleo e do app; os de banco rodam se o Supabase local estiver no ar
 npm run banco:testes     # regras de acesso e funções do banco (pgTAP)
 npm run e2e              # ponta a ponta (Playwright), com o Supabase local no ar
 npm run typecheck
 npm run build
 ```
 
-`CAPTURAS=<pasta> npm run e2e -- e2e/capturas.spec.ts` tira capturas das telas principais (revisão, mapa, decisão, diagnóstico, celular, escuro, o "Compartilhar" e o link público). Sem `CAPTURAS`, o teste fica pulado.
+Hoje: app 202 testes de unidade (31 arquivos), pgTAP 181 (`compartilhar`, `empresas`, `fluxos`, `senha`), ponta a ponta 25 (critérios 1, 2, 3 e 5, cadastros, cenários, diagnóstico, versões e link, trava, entrar e conta, membros). Passe `--trace=off` direto pro Playwright (`npx playwright test --trace=off`), não `npm run e2e -- --trace off`, que o npm come.
 
 ## Partes
 
 | Pasta | O que faz |
 |---|---|
-| `src/editor` | O editor sem tela (v2): formas e tamanhos (`pecas`), desenho dos canos (`geometria`), estilo (`estilo`), mudanças no documento (`documento`), desfazer e refazer (`historico`), o play em cima do motor (`play`), salvamento automático (`salvamento`) e busca e tipo sugerido dos cadastros (`cadastros`) |
-| `src/componentes/editor` | O editor (v2): quadro com peças, canos e água (`Quadro`, `Pecas`, `Agua`), painel (`Painel`, `Campos`), cartão do play (`CartaoPlay`) e o componente que junta tudo (`Editor`) |
-| `src/mapa` | `montarMapa`: o documento vira árvore da esquerda pra direita (o algoritmo do protótipo), com atalhos, faixas por regime de horário e canos que seguem o motor |
-| `src/simulacao` | Sessão (refazer as escolhas = mesma execução), passos da animação, estado visual, textos da linha do tempo, comparação com o resultado aprovado e `vinculo` (se a tela ainda é o caminho de um cenário) |
-| `src/diagnostico` | `cenarioAte`: o caminho de uma entrada até o ponto de um achado (o "Simular"); `pontosComAgenda`: as regras de horário que as entradas encontram primeiro, passando por áudios de saída única |
-| `src/importacao` | Jornadas por canal, refs usadas, revisão, relatório e o teto de 4 MB |
-| `src/compartilhar` | O retrato do link público (`montarRetrato`: sem observações e, com "esconder nomes", sem os nomes das pessoas) e as opções do link (validade, situação, a linha que descreve cada um) |
+| `src/editor` | O editor sem tela: formas e tamanhos (`pecas`), desenho dos canos (`geometria`), estilo (`estilo`), mudanças no documento (`documento`), desfazer e refazer (`historico`), o play em cima do motor (`play`), salvamento automático (`salvamento`), cadastros (`cadastros`), cenários (`cenarios`: resultado, situação, aprovar) e diagnóstico (`diagnostico`: abertos e intencionais, o que dá pra simular, o caminho até uma peça, "ver no quadro") |
+| `src/componentes/editor` | O editor: quadro com peças, canos e água (`Quadro`, `Pecas`, `Agua`), painel (`Painel`, `Campos`), o play (`usePlay`, `CartaoPlay`), a gaveta do diagnóstico (`Gaveta`), os pops do topo (`Pop`, `Cenarios`, `Versoes`), o `Compartilhar`, a confirmação no lugar (`Confirmacao`), o componente que junta tudo (`Editor`) e o do link público (`Visualizador`) |
+| `src/compartilhar` | O retrato do link público (`montarRetrato`: o documento conferido e, com "esconder nomes", sem as pessoas) e as opções do link (validade, situação, a linha que descreve cada um) |
 | `src/lib` | Clientes do Supabase, leituras do servidor (`dados.ts`), o link público (`link.ts`, o único com a chave secreta), origem do app, mensagens de erro, fuso |
-| `src/acoes` | Server actions: fluxos e cadastros (v2); import, cenários, intencionais, convites, empresa, links (v1) |
-| `src/componentes` | Mapa em React Flow (peças e canos), player, cartão da decisão, painéis |
-| `src/app` | Rotas |
-| `supabase/` (na raiz) | Migração, regras de acesso (RLS) e testes pgTAP |
+| `src/acoes` | Server actions: fluxos, cadastros, versões, cenários, intencionais, links, convites, empresa |
+| `src/app` | Rotas: Fluxos (`e/[empresa]`), editor (`e/[empresa]/f/[fluxo]`), Cadastros, Membros, entrar, link público (`l/[token]`) |
+| `supabase/` (na raiz) | Migrações, regras de acesso (RLS) e testes pgTAP |
+
+O `@journey/nucleo` (a planilha da central, da v1) não entra no app: fica no repositório pro importador de central da etapa E.
 
 ## Decisões
 
-### Editor de fluxos (v2, etapa B)
+### Editor de fluxos (etapa B)
 
-- **Quadro próprio, não React Flow.** O editor é o protótipo aprovado em React: peças em HTML, canos em SVG com âncora no lado mais direto de cada peça, água quadro a quadro. O React Flow continua só no mapa da v1.
+- **Quadro próprio, não React Flow.** O editor é o protótipo aprovado em React: peças em HTML, canos em SVG com âncora no lado mais direto de cada peça, água quadro a quadro.
 - **O documento é a fonte da verdade** e toda mudança é uma função pura (`editor/documento.ts`) que devolve outro documento. O histórico guarda as versões por referência (120 passos); num arrasto, o primeiro quadro entra no histórico e os seguintes substituem.
 - **Salvamento automático pelo navegador**, direto no `salvar_fluxo` (RPC), meio segundo depois da última mudança, um envio por vez, com a revisão. Sem rede, a cópia fica no `localStorage` e o envio tenta de novo (2 s, 4 s… até 30 s); ao abrir, uma cópia que partiu da mesma revisão volta. Conflito (40001), trava perdida (P0001) ou recusa param o salvamento e a tela pede pra recarregar. Nome, canal, descrição e meta são colunas: vão por server action.
-- **Trava:** ao abrir, `pegar_trava`; renova a cada 4 minutos; ao sair, `soltar_trava` com `fetch(..., { keepalive: true })`. Sem a trava, o editor fica só de leitura (dá pra ver e dar play) e diz quem está editando.
+- **Trava:** ao abrir, `pegar_trava`; renova a cada 4 minutos; ao sair, `soltar_trava` com `fetch(..., { keepalive: true })`. Sem a trava, o editor fica só de leitura (dá pra ver, dar play, tocar cenário e ver o diagnóstico) e diz quem está editando.
 - **Cadastros nascem do desenho:** o campo do responsável busca nos cadastros da empresa e oferece "Criar" com o tipo sugerido pelo nome ("Fila …", "Equipe …", "Horário …") ou pela peça. A peça guarda o id; renomear em Cadastros muda em todos os fluxos. Horário nasce de segunda a sexta, 8h às 18h.
-- **Play:** o motor (`@journey/fluxo`) roda a simulação inteira de uma vez a partir das escolhas; a tela mostra os eventos um a um (`editor/play.ts`). Voltar tira a última escolha e refaz; o play usa uma cópia do documento de quando começou, e mexer no desenho para o play.
+- **Play:** o motor (`@journey/fluxo`) roda a simulação inteira de uma vez a partir das escolhas; a tela mostra os eventos um a um. A máquina fica no hook `usePlay`, usado pelo editor e pelo link público. Voltar tira a última escolha e refaz; o play usa uma cópia do documento de quando começou, e mexer no desenho para o play.
 - **Fluxo a partir de modelo:** os cadastros do modelo viram cadastros da empresa (o que já existe com o mesmo tipo e nome é reaproveitado), o fluxo nasce e o documento é salvo com `instanciarModelo`. Se salvar falha, o fluxo criado é apagado.
 - **Dois cuidados do quadro:** o palco tem `overflow: hidden`, mas o navegador ainda o rola pra mostrar um elemento com foco, então ele volta a (0, 0) a cada rolagem; e, com o ponteiro capturado pelo palco (o arrasto começa no primeiro clique), o duplo clique chega no palco, então o alvo é o elemento sob o mouse (`elementFromPoint`).
-- **CSS do editor dentro de `.editor`**, pra não esbarrar no da v1, que ainda existe.
-
-### Telas da v1
-
-- **A tela importa o núcleo só pelos subcaminhos** (`@journey/nucleo/formato`, `/motor`, `/diagnostico`). A raiz reexporta `importacao` e `modelos`, que puxam o exceljs (~1 MB) pro navegador. O teste `test/cliente-sem-exceljs.test.ts` barra a raiz, `importacao` e `modelos` em `src/componentes`, `src/mapa`, `src/simulacao` e `src/diagnostico`; depois do build, `grep -rl ExcelJS apps/web/.next/static` tem que vir vazio. O servidor (páginas, `acoes`, `lib`, `importacao`) pode importar a raiz.
-- **A tela nunca grava no catálogo nem nas versões:** só a função `confirmar_import` (security definer) troca o catálogo e cria versões. O catálogo guarda as colunas do formato em `dados` (jsonb), então coluna nova no formato não pede migração.
-- **`confirmar_import` só aceita documento `journey/1`:** `formato` certo e as 8 listas (entradas, horários, feriados, ramais, filas, grupos, peças, saídas). Com outra forma a jornada não abriria. O conteúdo de cada lista é conferido pelo app.
-- **Uma jornada por canal das entradas**, criada no primeiro import; cada import confirmado cria uma versão nova em cada uma. Cada jornada leva só as entradas do seu canal, mas o "não recebe ligação" olha o documento inteiro: o que só o outro canal alcança não aparece como órfão.
-- **A lista de jornadas vem da view `jornadas_resumo`** (`security_invoker`, vale a RLS de quem pergunta): a última versão de cada jornada e os graves contados no banco, sem trazer o diagnóstico de todas as versões.
-- **Intencional mostra quem marcou** (spec 12.4): o `autor` vira o e-mail pelos membros da empresa; quem saiu (ou foi apagado) aparece como "alguém que saiu".
-- **Tempo de toque vem do núcleo** (`toqueDoRamal`, `toqueDoGrupo`): o painel de ramais mostra o mesmo tempo que o motor usa (siga-me completo = só o ramal + com a lista; senão `toque_s` ou 20 s).
-- **Convite só vale pra e-mail confirmado** (`email_confirmado()` lê `auth.users`, não o token) e o Supabase fica com `enable_confirmations = true`. Sem isso, alguém criaria conta com o e-mail de outra pessoa e entraria na empresa dela.
-- **Chaves estrangeiras compostas por empresa:** tabela filha liga o pai pela dupla `(id, empresa_id)`, então uma linha nunca aponta pra linha de outra empresa. Quem criou fica `null` se a pessoa for apagada.
-- **Membro só muda algumas colunas:** em `imports`, `status` e `arquivos` (descartar o rascunho); em `empresas`, `nome`; em `achados_intencionais`, as quatro que o upsert manda (`empresa_id`, `jornada_id`, `chave`, `nota`). O resto não se reescreve pela API.
-- **Arquivos originais no Storage**, bucket `imports` privado, só `application/octet-stream` e até 4 MB: o arquivo nunca volta como página que o navegador roda.
-- **Upload até 4 MB somando os arquivos.** A Vercel corta o corpo de uma função em 4,5 MB, então mais que isso não chegaria no servidor. O formulário avisa antes de enviar e o servidor confere de novo; o proxy (`proxyClientMaxBodySize`) e a server action (`bodySizeLimit`) aceitam 5 MB, a folga das bordas do multipart. Planilha maior pede upload direto do navegador pro Storage (URL assinada), que fica pra depois.
-- **`APP_URL` em produção:** os redirecionamentos e a conferência do Origin (no Sair) usam ela. Sem ela o app cai nos cabeçalhos do pedido (`X-Forwarded-*`, `Host`), que o cliente forja; serve só no desenvolvimento.
-- **Sair só neste aparelho** (`scope: 'local'`): as outras sessões da pessoa continuam.
-- **O mapa já é React Flow** (só leitura nesta etapa): a etapa 4 liga a edição nas mesmas peças e canos.
-- **Mapa leve:** os nós e canos dependem só do mapa e ficam guardados enquanto a versão é a mesma; o holofote e o passo da água viram classe nos elementos de dentro (`NoPonto`, `Cano`), e o contexto se divide em ações estáveis e vista por passo. Dar um passo não recria os nós.
-- **Pontas (fim, celular externo, destino que não existe) se repetem** onde aparecem; os outros pontos aparecem uma vez e a segunda chegada vira atalho ("segue em" ou "volta pra").
-- **Cenário aberto só enquanto o caminho é o dele** (`vinculo.ts`): mesma entrada, hora e modo, e as escolhas são o começo das dele. Outra escolha solta o cenário e o fim oferece salvar de novo. Aprovar grava o caminho inteiro (entrada, hora, modo e escolhas) junto com o esperado. A comparação com o aprovado aparece no fim e também no cartão da decisão e no "Fora deste mapa" (quando a água sai pra um ponto que não está neste mapa).
-- **A decisão é um cartão** (região "Decisão", com a pergunta em `aria-live`), não um balão no nó: no computador fica por cima do mapa, no celular embaixo dele. Os chips nos canos que o motor usa também escolhem.
+- **CSS do editor dentro de `.editor`** (o link público também usa: `.editor.visualizador`).
 
-### Links públicos (etapa 3)
+### Diagnóstico, cenários, versões e link (etapa C)
+
+- **Diagnóstico ao vivo** (`diagnosticar` do pacote, sobre o documento adiado com `useDeferredValue`; uns 2 ms pra 500 peças). O botão do topo conta os abertos e abre uma gaveta em cima do quadro, lembrada por fluxo no navegador; a contagem é anunciada pro leitor de tela quando para de mudar. Cada achado tem "ver no quadro" (seleciona, enquadra e põe no holofote), "simular até aqui" e "marcar como intencional" (com nota, quem e quando). Marcação de achado que o documento não tem mais aparece como "antiga", com desmarcar.
+- **"Simular até aqui" só pra peça que um Início alcança**: uma busca em largura por documento (`simulaveis`); o caminho em si (`caminhoAte`: a busca até a peça e o motor escolhendo a saída do caminho) só no clique, e o play toca em modo livre (no relógio, a escolha do horário não valeria) e pausa quando a água chega.
+- **A chave de um achado não leva texto livre** (opções repetidas são chaveadas pelos ids das conexões; ciclo grande vira começo + FNV-1a): a marcação sobrevive a renomear e casa no link com os nomes escondidos.
+- **Cenário:** "Salvar cenário" no fim do play guarda início, hora, modo, as escolhas que o motor aceitou e o resultado (caminho das peças, como terminou, tempo do cliente). A lista refaz cada cenário contra o documento de agora: "igual" ou "mudou" (uma escolha guardada que não serve mais também é "mudou"). "Aprovar o novo" grava o resultado e as escolhas novas; sem fim, ou com o Início que sumiu, não há o que aprovar.
+- **Versão:** marcar é a foto do que está no banco, então o editor manda o que falta antes (`salv.agora()`) e só marca se chegou. Restaurar lê o documento da versão pelo navegador (vale a RLS), tira responsável que não é mais cadastro e entra como uma edição desfazível (o estilo da versão volta junto, mas não entra no Ctrl+Z).
+- **As listas do editor ficam no estado dele**: cada ação devolve o que mudou (cenário, versão, link, intencional) e a tela atualiza no lugar, sem `revalidatePath` (refazer a página leria o documento inteiro de novo).
+- **Confirmação no lugar** (apagar cenário, restaurar versão, revogar link): a escolha segura vem primeiro e fica com o foco, e os dois botões ignoram o segundo clique de um duplo clique (`detail > 1`). Depois, o foco volta pro botão que abriu ou pra lista.
+
+### Link público
 
 - **O link é lido no servidor com a chave secreta**, e só por `src/lib/link.ts`: quem abre não tem sessão, e a função `abrir_link` só aceita a `service_role`. Assim ninguém com o token na mão chama a API e lê o que o servidor esconderia (com a chave pública, `abrir_link` e a tabela `links` dão 42501). O teste `test/chave-secreta.test.ts` barra a chave em qualquer outro arquivo e em componente de cliente.
-- **O navegador de quem abre recebe só o retrato** (`montarRetrato`): o documento da versão sem a coluna `observacao` (nota interna, a tela não mostra) e, com "esconder nomes" (ligado por padrão), sem o nome de quem usa cada ramal. Ramal de tipo `setor` fica com o nome. A entrada que disca direto em qualquer ramal que não seja um setor conhecido perde o nome (o número continua), inclusive o ramal sem nome ou fora do export: o que falta não tem o que trocar. Pelo mesmo motivo, o rótulo de uma saída pra ramal desconhecido (sem nome ou fora do export) sai. Nos outros nomes, nos textos dos áudios, nos rótulos das opções e nos nomes da jornada e do cenário, o nome da pessoa, escrito inteiro, vira "ramal 2001". A troca compara em Unicode NFC, ignora a caixa sem depender de minúsculas do idioma, junta espaços repetidos (o NBSP também) e trata `'` e `’` como iguais. Com "esconder nomes", as notas dos intencionais saem (com os nomes à mostra, a nota vai); quem marcou nunca vai.
-- **Limite do "esconder nomes":** só some o nome inteiro de quem usa um ramal.
-  - O primeiro nome sozinho não some: "Fale com a Ana" num áudio, com o ramal "Ana Souza", continua com "Ana".
-  - Nome escrito sem acento ou com hífen não é reconhecido: com o ramal "José Silva", "Jose Silva" ou "José-Silva" num texto continuam; o mesmo vale pra "Ana-Souza".
-  - Ids, opções (`Saida.opcao`), variáveis (`quando`/`define`, `guarda_variavel`) e `id_central` não são trocados.
-  - O nome de uma pessoa cujo ramal não veio no export, citado num texto ou rótulo que não aponta pra ramal, continua.
-  - Ramal de setor sem `tipo: setor` é tratado como pessoa e perde o nome (o erro vai pro lado seguro).
-- **O diagnóstico do link é refeito sobre o documento sem nomes** (os textos dos achados citam "ramal 2001 (Ana)"), mas só com as chaves que a versão guardou: as chaves não dependem de nome, e a jornada de um canal não ganha de volta o "não recebe ligação" do que só o outro canal alcança. Dos intencionais, só vão os desses achados (os de achados que não estão nesta versão ficam no servidor).
-- **O cenário inicial é uma cópia** (nome, entrada, hora, modo e escolhas) feita pelo servidor quando o link é criado: o link mostra o que foi mandado mesmo se o cenário mudar ou for apagado. No link não há "aprovar" nem comparação.
-- **Token de 24 caracteres** (18 bytes aleatórios, base64 de URL), gerado pelo banco; o membro só escolhe as opções (`grant insert` só nessas colunas). Depois de criado, o link só muda pra revogado, e revogar é pra sempre. A data da revogação é a do banco (um trigger grava `now()`, não vale a que o cliente mandar), e o nome do cenário copiado tem de 1 a 200 caracteres.
-- **Cada abertura lê o banco** (`connection()`): revogar vale na hora. `/l/*` vai com `X-Robots-Tag: noindex, nofollow` e `Referrer-Policy: no-referrer`.
+- **Uma ida ao banco:** `abrir_link` devolve o fluxo (da versão fixa ou o de agora), o estilo, os cadastros que o documento usa (dos campos, só os do Horário), os canais, os intencionais (chave e nota, sem quem marcou), as opções do link e, com "esconder nomes", os nomes de todas as pessoas da empresa (só pro servidor).
+- **O navegador de quem abre recebe só o retrato** (`montarRetrato`): o documento passado no `lerDocumento` (campo desconhecido não vai; documento inválido = "este link não abre") e, com "esconder nomes" (ligado por padrão), sem as pessoas. Cada responsável do tipo Pessoa vira "Pessoa 1", "Pessoa 2"… na ordem em que aparece nas peças; quem só é citado no texto vira "Pessoa". O nome sai de todo texto livre (peças, canos, valores das regras, grupos, notas, outros cadastros, canais, nome e descrição do fluxo, versão, cenário, notas dos intencionais): inteiro e cada palavra com 3 letras ou mais (menos as partículas), sem acento e com espaço, hífen, sublinhado ou espaço de largura zero no meio. Responsável que não é um dos cadastros devolvidos sai.
+- **Limites do "esconder nomes"** (também no diálogo, numa linha): apelido, abreviação ou erro de digitação; nome grudado em outra coisa, e-mail ou telefone; palavra do nome com menos de 3 letras sozinha; acento que só o texto tem; gente que não é cadastro do tipo Pessoa; o nome da empresa. A lista completa está em `src/compartilhar/retrato.ts`.
+- **O cenário inicial é uma cópia** (nome, início, hora, modo e escolhas) feita pelo servidor quando o link é criado, e toca sozinho quando o link abre. Com versão fixa, o servidor confere que ele toca naquela versão (o Início existe e as escolhas servem) antes de criar.
+- **Token de 24 caracteres** (18 bytes aleatórios, base64 de URL), gerado pelo banco; o membro só escolhe as opções (`grant insert` só nessas colunas). Depois de criado, o link só muda pra revogado, e revogar é pra sempre, com a data do banco.
+- **Cada abertura lê o banco** (`connection()`): revogar vale na hora. Revogado e vencido mostram uma página com a data; token que não existe dá 404 com uma página que explica. `/l/*` vai com `X-Robots-Tag: noindex, nofollow` e `Referrer-Policy: no-referrer`.
+- **O endereço do link usa a origem em que o membro está** (`location.origin`): crie os links pelo domínio de produção.
+
+### Entrar
+
+- **Três jeitos de entrar:** e-mail e senha (o principal, com as abas "Entrar" e "Criar conta"), Google (se `NEXT_PUBLIC_LOGIN_GOOGLE=sim`) e o link por e-mail, como alternativa discreta, junto com "Esqueci a senha". A raiz aceita os convites depois de qualquer um dos três.
+- **Os e-mails voltam pelo `/auth/confirm`**, e o Google pelo `/auth/callback`. Os modelos de e-mail (`supabase/templates`, ligados no `config.toml`; no hospedado, colados no painel) mandam o `token_hash` pro `/auth/confirm`, uma página com um botão; o POST do botão (`/auth/confirmar`) confirma no servidor (`verifyOtp`) e grava a sessão no cookie: o link abre em qualquer navegador ou aparelho. Com o link padrão do Supabase (PKCE), só abriria no navegador que pediu. Abrir o link não entra: o leitor de links do provedor de e-mail não gasta o token, e um link com o token de outra pessoa não põe ninguém na conta dela. O POST só vale da origem do app (Origin igual; sem Origin, recusa), contra login CSRF. Os tipos aceitos são só os dos modelos (`email` e `recovery`). As voltas só seguem pra caminho deste app (`caminhoInterno`: nada de `//outro.site`); o Google cancelado volta com `error` e a tela diz (`/entrar?erro=google`).
+- **Criar conta pede só o e-mail.** O link de confirmação leva a `/conta/senha`, onde a pessoa escolhe a senha (ou "Agora não"). A senha não vai no cadastro porque o Supabase deixa qualquer um cadastrar qualquer e-mail com uma senha, e não troca essa senha quando a dona aparece: quem chegou antes entraria na conta (e na empresa que a convidou) depois que ela confirmasse. Por isso o banco apaga a senha na hora em que o e-mail é confirmado (trigger em `auth.users`, migração `20261116000000`), e a senha de verdade vem depois, já com a sessão do link. Conta criada já confirmada (painel, API de admin) fica com a senha. "Criar conta" e o link usam o mesmo pedido (`signInWithOtp`): e-mail novo recebe a confirmação; e-mail que já tem conta recebe o link de entrar. A tela diz o mesmo nos dois casos, sem contar quem tem conta.
+- **Senha mínima de 8** (`SENHA_MINIMA`; `minimum_password_length = 8` no config.toml; no hospedado, o README da raiz manda subir). Campos com `autocomplete` certo pro gerenciador de senhas (`email`, `current-password`, `new-password`) e "Mostrar" a senha.
+- **`/conta/senha`** (só com sessão; sem ela, o proxy manda pro entrar): depois de criar a conta, de "Esqueci a senha", ou pelo link "Senha" (no topo da empresa, ao lado de "Sair", e embaixo do cartão de criar a empresa). Quem está logado troca sem digitar a atual (`secure_password_change` desligado: a sessão basta); se alguém ligar no painel, o Supabase pede reautenticação e a tela diz pra sair e entrar de novo. Trocar a senha encerra as outras sessões da pessoa (o Supabase recusa o refresh delas), mas o token de acesso que cada uma já tem vale até vencer (até 1 h).
+- **Os erros do Supabase Auth em português** (`lib/acesso.ts`, pelo código e pelo status): e-mail ou senha que não conferem, e-mail não confirmado, senha fraca, senha igual, limite de e-mail (`over_email_send_rate_limit`: "já mandamos um e-mail") separado do limite de tentativas (`over_request_rate_limit`: "muitas tentativas"). O erro cru vai só pro `console.error`.
+- **A página de entrar mostra o produto:** o formulário de um lado e, do outro, uma prévia do quadro com a água andando, trocando de cor do WhatsApp pro e-mail e parando na decisão. A prévia é SVG e CSS próprios (`app/entrar/previa.tsx` e `entrar.css`), decorativa e parada com movimento reduzido: a página não carrega o editor nem o `@journey/fluxo` (só o React, o Next e o cliente do Supabase, pro PKCE, e um componente pequeno que pausa a animação com a aba escondida ou a prévia fora da tela e para depois de três voltas, no quadro final). Abaixo de 420 px a prévia sai: a letra ficaria pequena demais.
+- **"Esqueci a senha" e o link ficam fora das abas,** com título próprio e "Entrar com a senha" pra voltar. As abas andam com as setas, Home e End.
+- **Depois de pedir o link,** o e-mail continua no campo, o aviso diz pra qual e-mail foi, e "Usar outro e-mail" limpa e volta o foco pro campo. As regiões de aviso (`role=status`, `role=alert`) ficam montadas vazias.
+- **O botão só liga depois da hidratação:** antes, um Enter mandaria o formulário pelo navegador. O campo não tem `name`, então o e-mail nunca vai pra URL.
+- **Mandar de novo espera 30 s** pro mesmo e-mail (o Supabase recusa outro pedido em menos de 60 s); se mesmo assim vier o limite (429 ou `over_email_send_rate_limit`), a mensagem é em português, a espera vira 60 s e o aviso de "enviado" fica. Os erros viram texto pelo código e pelo status, nunca pelo texto em inglês. Ocupado, o botão fica com `aria-disabled` (e não `disabled`), pra não perder o foco.
+
+### Banco e acesso
+
+- **Chaves estrangeiras compostas por empresa:** tabela filha liga o pai pela dupla `(id, empresa_id)` (cenários, intencionais e links pela dupla `(fluxo_id, empresa_id)`), então uma linha nunca aponta pra linha de outra empresa. Apagar o fluxo apaga os cenários, os intencionais e os links dele.
+- **Membro só muda algumas colunas:** em `empresas`, `nome`; em `cenarios`, `nome`, `escolhas`, `esperado` e `revisao_aprovada` (o começo não muda); em `achados_intencionais`, as quatro que o upsert manda; em `links`, só `revogado_em`. O resto não se reescreve pela API.
+- **Convite só vale pra e-mail confirmado** (`email_confirmado()` lê `auth.users`, não o token) e o Supabase fica com `enable_confirmations = true`. Sem isso, alguém criaria conta com o e-mail de outra pessoa e entraria na empresa dela. A confirmação sozinha não basta: quem cadastrou o e-mail antes com uma senha entraria depois que a dona confirmasse. Por isso a senha some na confirmação (trigger `senha_some_na_confirmacao` em `auth.users`; a conta criada na mesma transação, como a do painel, fica marcada e não perde a senha). E a pessoa não troca o e-mail da conta (trigger `troca_de_email_recusada`, quando o Supabase grava `email_change`): trocar o e-mail da conta dele pro da convidada, com ela clicando no "confirme o novo e-mail", daria no mesmo. O admin e o painel trocam `email` direto e continuam podendo; o pedido recusado ainda manda os e-mails de confirmação (o Supabase manda antes de gravar), mas os links não valem.
+- **`APP_URL` em produção:** os redirecionamentos e a conferência do Origin (no Sair) usam ela. Sem ela o app cai nos cabeçalhos do pedido (`X-Forwarded-*`, `Host`), que o cliente forja; serve só no desenvolvimento.
+- **Sair só neste aparelho** (`scope: 'local'`): as outras sessões da pessoa continuam.
 
 ## Risco aceito
 
-Qualquer membro pode chamar o banco direto (PostgREST e as funções RPC) e gravar um import ou uma versão com o conteúdo que quiser, desde que tenha a forma `journey/1`. O app confere o conteúdo; o banco só a forma.
+Qualquer membro pode chamar o banco direto (PostgREST e as funções RPC) e gravar um documento, um cenário ou um intencional com o conteúdo que quiser, desde que tenha a forma que o banco confere. O app confere o conteúdo; o banco, a forma e a empresa.
 
-Hoje isso é aceitável porque todo membro é editor: quem pode fazer isso pela API já pode pela tela. Quando existir um papel só de leitura (etapa seguinte), o import tem que passar a ser só do servidor: tirar de `authenticated` o insert direto em `imports` e o `execute` de `confirmar_import`, e gravar pelo servidor com a conferência dele.
+Hoje isso é aceitável porque todo membro é editor: quem pode fazer isso pela API já pode pela tela. Quando existir um papel só de leitura, as escritas desse papel têm que ser barradas pelas regras de acesso, não só pela tela.
 
 ## Gotchas
 
-- **O pedido do link mágico sai do navegador:** o código do PKCE fica num cookie dele, e o `/auth/callback` troca o código pela sessão. Pedido por server action, o cookie não chega e o login volta pra tela de entrar.
+- **O Google sai do navegador:** o código do PKCE fica num cookie dele, e o `/auth/callback` troca o código pela sessão. Pedido por server action, o cookie não chega e o login volta pra tela de entrar. Os e-mails não dependem disso: o `/auth/confirm` confirma pelo `token_hash`.
+- **Mudou o modelo de e-mail?** Mude também no painel do hospedado (o README da raiz tem o passo a passo): `supabase/templates` só vale no local.
 - **Sem `APP_URL`, o redirecionamento usa o host do pedido** (`origemDe`): no `next dev`, `request.url` vem como `localhost` mesmo com o navegador em `127.0.0.1`, e a sessão (cookie por host) se perde.
-- **jsonb reordena as chaves:** comparar o resultado guardado de um cenário com o de agora é por valor (`comparar`), não por texto, senão todo cenário aparece como "mudou".
-- **Next 16: `proxyClientMaxBodySize` é 10 MB por padrão.** Com o `proxy.ts` no meio, o corpo maior é cortado em silêncio e o import chega quebrado; por isso está em 5 MB no `next.config.ts` (um pouco acima do teto de 4 MB).
+- **Os testes ponta a ponta entram com senha** (`entrar()` no `e2e/apoio.ts`): a conta nasce já confirmada pela API de administração (com a chave secreta lida da CLI) e entra pela tela, sem esperar e-mail e sem gastar os limites por IP do link mágico (30 a cada 5 minutos), que outro clone rodando os mesmos testes no mesmo Supabase também gasta. O link mágico, a confirmação e a recuperação têm os testes deles, pelo Mailpit (o link e a recuperação abertos em outro navegador), e o cadastro antecipado por outra pessoa também (`conta.spec.ts`).
+- **A senha some em qualquer confirmação de e-mail de conta que já existia:** convite do painel ("Invite user"), "Add user" sem "Auto Confirm User", e também um dia em que o Supabase preencha `email_confirmed_at` de contas antigas numa migração dele (um backfill): essas contas ficariam sem senha e entrariam pelo link ou por "Esqueci a senha". Não acontece hoje; vale olhar as notas de versão do Auth.
+- **Mudou o `config.toml` do Auth?** Só vale depois de reiniciar o Supabase local (`npm run banco:parar` e `npm run banco`).
 - **Upsert do PostgREST pede UPDATE em toda coluna que ele manda:** o `on conflict do update set` leva todas, e sem permissão em uma delas até o primeiro upsert falha. Por isso as quatro colunas em `achados_intencionais`.
-- **Sem `SUPABASE_SECRET_KEY` no servidor, o link público não abre** (aparece a tela de falha do link, `l/[token]/error.tsx`) e criar link é recusado, com um aviso pra pessoa. Local: a linha do `sed` em "Rodar"; no `next dev` já aberto, reinicie depois de mudar o `.env.local`.
+- **Sem `SUPABASE_SECRET_KEY` no servidor, o link público não abre** (aparece a tela de falha do link, `l/[token]/error.tsx`) e o "Compartilhar" explica e não cria. Local: a linha do `sed` em "Rodar"; no `next dev` já aberto, reinicie depois de mudar o `.env.local`.
 - **`<dialog>` com `showModal()` deixa o resto da página inerte:** feche o "Compartilhar" antes de clicar fora dele (nos testes também).
-- **O Supabase devolve no máximo 1000 linhas por pedido** (`max_rows = 1000`): o catálogo vem em páginas com `.range()` e a contagem por aba é feita no banco.
+- **O Supabase devolve no máximo 1000 linhas por pedido** (`max_rows = 1000`): as listas que crescem (cadastros, versões, cenários, intencionais, links) vêm em páginas (`todas`, no `dados.ts`).
+- **A câmera segue a água:** depois de um play, a peça que um teste quer clicar pode estar fora da tela; "Ver o fluxo inteiro" volta pro todo.
+- **Teclas e foco:** os atalhos do editor ignoram o que vem de um campo, de um pop ou do diálogo (Delete num botão do pop não apaga a peça); na gaveta, só o Esc e o desfazer/refazer passam.
 
 ## Publicar
 
````

`packages/nucleo/README.md`:

```diff
diff --git a/packages/nucleo/README.md b/packages/nucleo/README.md
index 04d43b3..1ec50a5 100644
--- a/packages/nucleo/README.md
+++ b/packages/nucleo/README.md
@@ -1,6 +1,8 @@
 # @journey/nucleo
 
 O núcleo do Journey, sem tela: o formato dos dados, a importação, os modelos pra baixar, o motor de simulação e o diagnóstico.
+
+É o núcleo da v1 (telefonia). Desde a v2 o app não usa: ele fica no repositório pra virar o importador de central da etapa E (a planilha da central vira um fluxo genérico do `@journey/fluxo`).
 Nada aqui conhece React, Next.js ou Supabase. Tudo recebe dados e devolve dados.
 
 ## Partes
```

- [ ] **Passo 2: tudo de novo**

Run (da raiz): `npx supabase test db && npm test && npm run typecheck && npm run build && cd apps/web && npx playwright test --trace=off`
Expected: pgTAP `Tests=181`, `Result: PASS`; fluxo 84, núcleo 253, app 202; `tsc` limpo; build com `/l/[token]`, `/auth/confirm`, `/auth/confirmar`, `/conta/senha` e sem as rotas da v1; ponta a ponta `25 passed`. O pgTAP vem antes da ponta a ponta (a ponta a ponta deixa fluxos e links de teste no banco local; o pgTAP não depende deles, mas começar limpo ajuda a ler uma falha).

- [ ] **Passo 3: commit e push**

```bash
git add README.md apps/web/README.md packages/nucleo/README.md
git commit -m "docs: os READMEs da v2 depois da etapa C" -m "$(cat .git/atribuicao.txt)"
git push -u origin claude/journey-etapa-3-public-links-5wx03t
```

## Produção

1. Antes de mesclar: conferir no banco de produção que a v1 está vazia e o bucket `imports` não tem arquivos, e rodar a migração uma vez dentro de `begin; … rollback;` (prova as permissões do Storage hospedado).
2. No painel do Supabase, antes de mesclar: os passos do README da raiz ("Publicar": URL do site e de volta, e-mail com confirmação e senha mínima 8, os três modelos de e-mail de `supabase/templates`, SMTP próprio; Google é opcional).
3. Mesclar o PR; aplicar as duas migrações (`apply_migration` com o conteúdo de cada arquivo, na ordem) e, logo em seguida, a Vercel publica (entre um e outro, as telas da v1 do deploy antigo dão erro: são poucos minutos, sem uso em produção).
4. Conferir: `/entrar` nova (criar uma conta de teste, confirmar pelo e-mail, escolher a senha, sair e entrar com ela); um fluxo com cenário salvo; um link criado abre numa janela anônima e toca o cenário.

## Cobertura do spec

| Spec | Onde |
|---|---|
| §3 critério 3 (colega entende pelo link) | Tarefas 5, 6, 8 (e2e `compartilhar.spec.ts`) |
| §8 cenários (salvar, tocar, avisar quando muda, aprovar o novo) | Tarefas 4, 6, 7 (e2e `cenarios.spec.ts`) |
| §9 diagnóstico ao vivo, ver no quadro, simular até aqui, intencional com nota e quem | Tarefas 1, 4, 6, 7 (e2e `diagnostico.spec.ts`) |
| §5/§11 versão nomeada | Tarefas 6, 7 (e2e de versão no `compartilhar.spec.ts`) |
| §11 cenarios, links, achados_intencionais sobre fluxos; a v1 some do banco | Tarefa 2 |
| §14 links públicos: token, revogação, validade, esconder nomes (pessoas) | Tarefas 2, 5, 6, 8 |
| §15 C | Todas |

**Fica pra D:** marca da empresa, canais e tipos de cadastro próprios, estilo padrão, seleção múltipla, copiar e colar, alinhar, minimapa. **Fica pra depois:** duas abas do mesmo usuário editando, o salvamento que segue tentando sem rede depois de sair do editor, miniatura dos fluxos na grade.
