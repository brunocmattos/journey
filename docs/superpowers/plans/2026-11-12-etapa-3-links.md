# Etapa 3: links públicos do Journey — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans pra executar este plano tarefa por tarefa. Os passos usam caixas de seleção (`- [ ]`) pra acompanhar o progresso.

**Objetivo:** a etapa 3 do spec (seção 19): links públicos de uma jornada, só de leitura, com nomes escondidos (ligado por padrão), cenário inicial e validade, criados pelo botão "Compartilhar" (seção 14). Pronto quando o critério 3 da seção 3 pode ser feito: mandar um link "E se ligarem às 16h57?" pra 2 ou 3 colegas, que abrem sem conta, veem a água andar e descrevem o caminho.

**Arquitetura:** uma tabela `links` (token gerado pelo banco, versão fixa ou a mais recente, esconder nomes, cópia do cenário inicial, validade, revogado em) com RLS por empresa; o membro cria e revoga por server actions com a sessão dele. Quem abre o link não tem conta: a rota `/l/[token]` lê o link no servidor pela função `abrir_link`, que só a chave secreta (`service_role`) executa, e monta um retrato só de leitura em TypeScript puro (`montarRetrato`): sem observações e, com "esconder nomes", sem os nomes das pessoas. A tela é a mesma `Jornada` da etapa 2, num modo só leitura (`membro={null}`).

**Tecnologia:** a mesma da etapa 2: Node 22, TypeScript 5.9, Next.js 16.4, React 19.3, `@supabase/supabase-js` 2.119 e `@supabase/ssr` 0.12, Supabase CLI 2.122 (Postgres 17 local em Docker, pgTAP), Vitest 3.2, Playwright 1.63. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-12-journey-design.md` (seções 3 critério 3, 5 "Link público", 7.1 `links`, 14, 15 "Link revogado ou vencido", 17 ponta a ponta "criar um link com nomes escondidos e abrir sem login", 18 "Nomes de colegas no app", 19 etapa 3).

---

## Antes de começar

- **A etapa 2 ainda não está na `main`** (PR brunocmattos/journey#2 em rascunho). Esta etapa parte do branch dela: `git fetch origin claude/journey-etapa-2 && git switch -c claude/journey-etapa-3-public-links-5wx03t origin/claude/journey-etapa-2` (se o branch já existir, `git reset --hard origin/claude/journey-etapa-2` nele). Quando a etapa 2 entrar na `main`, este PR passa a mostrar só o que é da etapa 3.
- **Todo o código deste plano já foi escrito e testado num ensaio**, sobre o `claude/journey-etapa-2` (`a9b2321`): núcleo 253 testes, app 168 (eram 126), pgTAP 84 (eram 60), ponta a ponta 24 passando e 1 pulado (eram 21 + 1), `typecheck` e `next build` limpos, `/l/[token]` dinâmica (`ƒ`) e `grep -rl ExcelJS apps/web/.next/static` vazio. Copie os arquivos exatamente como estão. Se um teste falhar, investigue antes de mudar o teste.
- **Docker e Supabase local:** como na etapa 2. Se `docker info` falhar, `sudo dockerd > /tmp/dockerd.log 2>&1 &` e espere responder. Depois `npm install` e `npm run banco`.
- **`.env.local` com a chave secreta** (a página do link precisa dela; sem ela o e2e do link falha):
  ```bash
  cp apps/web/.env.example apps/web/.env.local
  sed -i "s|^SUPABASE_SECRET_KEY=.*|SUPABASE_SECRET_KEY=$(npx supabase status -o json | node -pe 'JSON.parse(require("fs").readFileSync(0)).SECRET_KEY')|" apps/web/.env.local
  ```
  Nunca ponha essa chave em arquivo versionado: a proteção de segredos do GitHub barra o push (é o motivo do `a9b2321`).
- **Commits:** crie `.git/atribuicao.txt` uma vez, com as duas linhas de atribuição da sessão (`Co-Authored-By: …` e `Claude-Session: …`). Todo commit usa `-m "$(cat .git/atribuicao.txt)"` como segundo parágrafo da mensagem.
- **Next 16:** `proxy.ts` em vez de `middleware.ts`; o `next dev` escreve um `AGENTS.md` pedindo pra ler `node_modules/next/dist/docs/` antes de mexer em API do Next. `connection()` (de `next/server`) faz a página esperar o pedido; `error.tsx` recebe `retry`.
- **Patches:** arquivo novo vem inteiro. Arquivo que já existe vem como diff; aplique da raiz do repositório salvando o bloco num arquivo e rodando `git apply <arquivo>` (ou à mão, linha por linha).
- Comandos: `npm test` (unitários; os de banco rodam sozinhos com o Supabase no ar), `npm run banco:testes` (pgTAP), `npm run e2e` (Playwright, com o Supabase no ar), `npm run typecheck`, `npm run build`.

## Decisões desta etapa

Cada uma foi comparada com a alternativa antes de entrar aqui.

| Decisão | Por quê | Alternativa recusada |
|---|---|---|
| **O servidor lê o link com a chave secreta**, num lugar só (`src/lib/link.ts`), pela função `abrir_link`, que só a `service_role` executa | Quem abre não tem sessão, e o spec quer os nomes removidos no servidor. Com a função liberada pra `anon`, qualquer um com o token chamaria a API com a chave pública (que está no bundle) e leria os nomes que a página esconde | `abrir_link` pra `anon`: vaza os nomes. Esconder os nomes no SQL: duplica o formato em SQL. Guardar um documento sem nomes em cada versão: toda criação de versão (etapa 4 incluída) teria que lembrar de gerar |
| **Esconder nomes = o nome de quem usa cada ramal** (menos ramal de tipo `setor`), tirado do ramal e trocado por "ramal 2001" onde aparece escrito inteiro (nomes, textos dos áudios, rótulos, nome do cenário); a entrada que disca direto num ramal escondido perde o nome | O spec (4) põe o nome da pessoa no ramal; o próprio exemplo do modelo tem "Falar com a Ana" num rótulo. Filas, menus e horários continuam com nome: sem eles o colega não entende o fluxo (critério 3) | Tirar todos os nomes: o mapa vira só ids. Trocar também o primeiro nome ("Ana" de "Ana Souza"): pega "Maria" em "Santa Maria". Fica como limite documentado |
| **Observações nunca vão pro link** | Nota interna; a tela não mostra, mas o documento inteiro vai pro navegador | Mandar e não mostrar |
| **O cenário inicial é copiado pro link** (nome, entrada, hora, modo, escolhas), pelo servidor | O link mostra o que foi mandado, mesmo se o cenário mudar ou for apagado | Referência ao cenário: apagar o cenário mudaria um link já enviado |
| **O diagnóstico do link é refeito sobre o documento sem nomes**, filtrado pelas chaves que a versão guardou | Os textos dos achados citam "ramal 2001 (Ana)"; as chaves não dependem de nome. O filtro mantém o que os membros veem (a jornada de um canal não ganha o "não recebe ligação" do outro canal) | Trocar os nomes no texto guardado: depende do jeito que `nomeDe` escreve |
| **Validade: 7, 30 (padrão), 90 dias ou sem prazo**; revogar é pra sempre, link não se apaga | Poucas opções claras; a lista guarda o que já foi mandado | Data livre: mais tela pra pouco ganho |
| **Intencionais no link: sem quem marcou; a nota só com os nomes à mostra** | O autor é e-mail de colega; a nota é texto livre e pode citar gente | Mostrar como pros membros |
| **"Compartilhar" no alto do painel da jornada**, num `<dialog>` com as opções e a lista de links (copiar, revogar) | Um lugar só, perto do cenário aberto (que já vem escolhido como cenário inicial) | Página própria de links: mais um caminho pra achar |
| **Link revogado, vencido ou inexistente: página que explica**, com `X-Robots-Tag: noindex` e `Referrer-Policy: no-referrer` em `/l/*` | Spec 14 e 15. O token é a chave: não pode ir no Referer pra outro site | 404/410 do Next: tela genérica, sem explicar |

**Gotchas que o ensaio achou:**
- **O `<dialog>` aberto com `showModal()` deixa o resto da página inerte:** feche o "Compartilhar" antes de clicar em outra coisa (o e2e fecha pelo botão "Fechar").
- **`.campo input` dá `width: 100%` a qualquer input:** os botões de rádio da versão ficam num `fieldset.grupo-escolhas`, não em `.campo`.
- **`'observacao'` também é uma gravidade de achado:** ao conferir que a observação saiu, olhe o `documento` do retrato, não o retrato inteiro.
- **A lista de links usa a hora do navegador:** o conteúdo do diálogo só existe com ele aberto, senão o servidor e o navegador desenhariam situações diferentes (hidratação).
- **Check de `jsonb` com chave faltando dá `null`, e `null` passa no `check`:** a forma do cenário vai dentro de `coalesce(…, false)`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20261113000000_journey_etapa3.sql` | Tabela `links`, RLS, grants por coluna e a função `abrir_link` (só `service_role`) |
| `supabase/tests/database/links.test.sql` | Quem cria, quem revoga, o que `abrir_link` devolve e quem pode chamar (pgTAP) |
| `apps/web/src/compartilhar/retrato.ts` | `montarRetrato`: o documento sem observações e, com "esconder nomes", sem nomes; diagnóstico refeito; cenário com id `link` |
| `apps/web/src/compartilhar/opcoes.ts` | Validades, situação do link (ativo, vencido, revogado), a linha que descreve cada um, o endereço |
| `apps/web/src/lib/documento.ts` | `ehDocumento` (saiu de `dados.ts` pra servir também ao link) |
| `apps/web/src/lib/link.ts` | `abrirLink(token)`: o único lugar com a chave secreta |
| `apps/web/src/lib/dados.ts` | `links(jornadaId)` pra lista do "Compartilhar" |
| `apps/web/src/acoes/links.ts` | Server actions `criarLink` e `revogarLink` |
| `apps/web/src/componentes/jornada/Compartilhar.tsx` | Botão e diálogo: opções, link novo com copiar, lista com copiar e revogar |
| `apps/web/src/componentes/jornada/Jornada.tsx`, `PainelDiagnostico.tsx` | Modo só leitura (`membro={null}`) e cenário inicial |
| `apps/web/src/app/l/[token]/page.tsx`, `error.tsx` | A página pública e a de falha |
| `apps/web/src/proxy.ts`, `apps/web/next.config.ts` | `/l/` sem login; cabeçalhos de não indexar e sem Referer |
| `apps/web/test/**`, `apps/web/e2e/links.spec.ts` | Unitários, banco e ponta a ponta |

---

### Tarefa 1: Banco: tabela `links` e a função `abrir_link`

**Arquivos:**
- Criar: `supabase/migrations/20261113000000_journey_etapa3.sql`
- Criar: `supabase/tests/database/links.test.sql`

- [ ] **Passo 1: escrever o teste pgTAP**

`supabase/tests/database/links.test.sql`:

```sql
-- Links públicos (etapa 3): quem cria, quem revoga, o que o abrir_link devolve e quem pode chamá-lo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'ana@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'beto@exemplo.com', 'authenticated', 'authenticated', now());

create function pg_temp.entrar(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- Empresa A (Ana) com a jornada Telefonia em duas versões e um achado marcado como intencional. Empresa B (Beto).
insert into public.empresas (id, nome) values
  ('a0000000-0000-0000-0000-000000000001', 'Empresa A'),
  ('b0000000-0000-0000-0000-000000000001', 'Empresa B');
insert into public.membros (empresa_id, usuario_id, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'ana@exemplo.com'),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'beto@exemplo.com');
insert into public.jornadas (id, empresa_id, nome, canal) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Telefonia', 'telefonia');
insert into public.jornada_versoes (empresa_id, jornada_id, numero, documento, diagnostico, origem) values
  ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, '{"formato":"journey/1","v":1}', '[]', 'import'),
  ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 2, '{"formato":"journey/1","v":2}', '[]', 'import');
insert into public.achados_intencionais (empresa_id, jornada_id, chave, nota, autor) values
  ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'ciclo:ramal:1', 'de propósito', '00000000-0000-0000-0000-0000000000a1');

set local role authenticated;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000a1');

select lives_ok(
  $$ insert into public.links (empresa_id, jornada_id) values ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001') $$,
  'membro cria um link só com a jornada');
select ok((select token ~ '^[A-Za-z0-9_-]{24}$' from public.links), 'o banco gera o token: 24 caracteres de URL');
select ok((select esconder_nomes from public.links), 'esconder nomes vem ligado');
select is((select criado_por from public.links), '00000000-0000-0000-0000-0000000000a1'::uuid, 'o autor é quem está logado');
select set_config('teste.token', (select token from public.links), true);
select throws_ok(
  $$ insert into public.links (empresa_id, jornada_id, token) values ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'escolhido-por-mim-123456') $$,
  '42501', null, 'o membro não escolhe o token');
select throws_ok(
  $$ insert into public.links (empresa_id, jornada_id, versao) values ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 9) $$,
  '23503', null, 'versão fixa tem que existir na jornada');
select throws_ok(
  $$ insert into public.links (empresa_id, jornada_id, cenario) values ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '{"nome":"x","entrada":"entrada:e1"}') $$,
  '23514', null, 'cenário sem hora, modo e escolhas não entra');
select throws_ok(
  $$ insert into public.links (empresa_id, jornada_id, expira_em) values ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', now() - interval '1 day') $$,
  '23514', null, 'validade no passado não entra');
select lives_ok(
  $$ insert into public.links (empresa_id, jornada_id, versao, esconder_nomes, expira_em, cenario)
     values ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, false, now() + interval '7 days',
       '{"nome":"E se ligarem às 16h57?","entrada":"entrada:e1","inicio":"2026-11-23T16:57","modo":"cenario","escolhas":["saida:m-1"]}') $$,
  'link com versão fixa, nomes à mostra, validade e cenário');
select set_config('teste.token_fixo', (select token from public.links where versao = 1), true);

select pg_temp.entrar('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.links), 0, 'quem é de outra empresa não vê os links');
select throws_ok(
  $$ insert into public.links (empresa_id, jornada_id) values ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'nem cria link na jornada dela');
select throws_ok($$ select public.abrir_link(current_setting('teste.token')) $$, '42501', null, 'usuário logado não chama abrir_link');

select pg_temp.entrar('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ update public.links set expira_em = null $$,
  '42501', null, 'a validade não muda depois de criado');
select throws_ok($$ delete from public.links $$, '42501', null, 'link não se apaga: revoga');

-- Como o servidor do app (chave secreta).
set local role service_role;
select is(public.abrir_link(current_setting('teste.token')) ->> 'estado', 'ok', 'o link vale');
select is((public.abrir_link(current_setting('teste.token')) -> 'versao' ->> 'numero')::int, 2, 'sem versão fixa, abre a mais recente');
select is(public.abrir_link(current_setting('teste.token')) -> 'intencionais', '[{"chave":"ciclo:ramal:1","nota":"de propósito"}]'::jsonb,
  'os intencionais vão só com chave e nota, sem quem marcou');
select is((public.abrir_link(current_setting('teste.token_fixo')) -> 'versao' ->> 'numero')::int, 1, 'com versão fixa, abre ela');
select is(public.abrir_link(current_setting('teste.token_fixo')) -> 'cenario' ->> 'nome', 'E se ligarem às 16h57?', 'e leva o cenário inicial');
select is(public.abrir_link('nao-existe') ->> 'estado', 'inexistente', 'token que não existe');

set local role authenticated;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000a1');
update public.links set revogado_em = now() where token = current_setting('teste.token');
update public.links set revogado_em = null where token = current_setting('teste.token');
select isnt((select revogado_em from public.links where token = current_setting('teste.token')), null, 'revogar é pra sempre');

reset role;
update public.links set criado_em = now() - interval '10 days', expira_em = now() - interval '1 day' where token = current_setting('teste.token_fixo');
set local role service_role;
select is(public.abrir_link(current_setting('teste.token')) ->> 'estado', 'revogado', 'link revogado não abre');
select is(public.abrir_link(current_setting('teste.token_fixo')) ->> 'estado', 'vencido', 'link vencido não abre');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.abrir_link(current_setting('teste.token')) $$, '42501', null, 'quem não tem conta não chama abrir_link pela API');

select * from finish();
rollback;
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npm run banco:testes`
Expected: `links.test.sql` falha (`relation "public.links" does not exist`); `journey.test.sql` continua `ok`.

- [ ] **Passo 3: escrever a migração**

`supabase/migrations/20261113000000_journey_etapa3.sql`:

```sql
-- Journey, etapa 3: links públicos, só de leitura, de uma jornada.
-- O membro cria e revoga pelo app (com a sessão dele, sob a RLS). Quem abre o link não tem conta:
-- o servidor do app lê o link pela função abrir_link, que só a chave secreta (service_role) chama.
-- O navegador de quem abre nunca fala com o banco.

create table public.links (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  jornada_id uuid not null,
  -- 18 bytes aleatórios em base64 de URL: 24 caracteres, sem "=". Só o banco gera (a coluna não tem grant de insert).
  token text not null unique default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  -- null: sempre a versão mais recente. Número: a versão fixa.
  versao int,
  esconder_nomes boolean not null default true,
  -- Cenário inicial, copiado do cenário salvo quando o link foi criado: { nome, entrada, inicio, modo, escolhas }.
  -- Cópia, e não referência: o link continua mostrando o que foi mandado mesmo se o cenário mudar ou for apagado.
  cenario jsonb,
  -- null: sem prazo.
  expira_em timestamptz,
  revogado_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (id, empresa_id),
  foreign key (jornada_id, empresa_id) references public.jornadas (id, empresa_id) on delete cascade,
  -- Versão fixa tem que existir nesta jornada (com versao null, a chave não é conferida).
  foreign key (jornada_id, versao) references public.jornada_versoes (jornada_id, numero) on delete cascade,
  constraint links_validade check (expira_em is null or expira_em > criado_em),
  -- coalesce: com uma chave faltando, a comparação dá null, e null passaria no check.
  constraint links_cenario check (cenario is null or coalesce(
    jsonb_typeof(cenario) = 'object'
    and jsonb_typeof(cenario -> 'nome') = 'string'
    and jsonb_typeof(cenario -> 'entrada') = 'string'
    and (cenario ->> 'inicio') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
    and (cenario ->> 'modo') in ('cenario', 'livre', 'ninguem_atende')
    and jsonb_typeof(cenario -> 'escolhas') = 'array', false))
);
create index links_jornada on public.links (jornada_id, criado_em desc);
create index links_empresa on public.links (empresa_id);

alter table public.links enable row level security;
create policy "membro vê os links" on public.links for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria link" on public.links for insert to authenticated
  with check (public.eh_membro(empresa_id) and criado_por = auth.uid() and revogado_em is null);
-- Revogar é pra sempre: só muda link ainda não revogado, e só pra revogado.
create policy "membro revoga link" on public.links for update to authenticated
  using (public.eh_membro(empresa_id) and revogado_em is null)
  with check (public.eh_membro(empresa_id) and revogado_em is not null);

-- Na criação, o membro escolhe só as opções; token, autor e datas são do banco. Depois, só revoga.
revoke all on public.links from anon;
revoke insert, update, delete, truncate, trigger, references on public.links from authenticated;
grant insert (empresa_id, jornada_id, versao, esconder_nomes, cenario, expira_em) on public.links to authenticated;
grant update (revogado_em) on public.links to authenticated;

-- O que o link mostra, pelo token. Devolve { estado } e, quando o link vale, a versão e as opções.
-- security invoker: quem chama é o servidor do app com a chave secreta (service_role, que passa pela RLS).
-- Nenhum outro papel executa: com o token na mão, ninguém lê pela API o que o servidor esconderia.
create function public.abrir_link(p_token text) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_link public.links%rowtype;
  v_jornada public.jornadas%rowtype;
  v_versao public.jornada_versoes%rowtype;
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
  select * into v_jornada from public.jornadas where id = v_link.jornada_id;
  if v_link.versao is null then
    select * into v_versao from public.jornada_versoes where jornada_id = v_link.jornada_id order by numero desc limit 1;
  else
    select * into v_versao from public.jornada_versoes where jornada_id = v_link.jornada_id and numero = v_link.versao;
  end if;
  if not found then
    return jsonb_build_object('estado', 'inexistente');
  end if;
  return jsonb_build_object(
    'estado', 'ok',
    'jornada', jsonb_build_object('nome', v_jornada.nome, 'canal', v_jornada.canal),
    'versao', jsonb_build_object(
      'numero', v_versao.numero,
      'criada_em', v_versao.criada_em,
      'documento', v_versao.documento,
      'diagnostico', v_versao.diagnostico),
    'mais_recente', v_link.versao is null,
    'esconder_nomes', v_link.esconder_nomes,
    'cenario', v_link.cenario,
    'expira_em', v_link.expira_em,
    -- Só chave e nota: quem marcou (autor) não sai daqui.
    'intencionais', coalesce((
      select jsonb_agg(jsonb_build_object('chave', i.chave, 'nota', i.nota) order by i.chave)
      from public.achados_intencionais i where i.jornada_id = v_link.jornada_id), '[]'::jsonb));
end;
$$;

revoke execute on function public.abrir_link(text) from public, anon, authenticated;
grant execute on function public.abrir_link(text) to service_role;
```

- [ ] **Passo 4: aplicar e ver passar**

Run: `npx supabase migration up --local && npm run banco:testes`
Expected: `Applying migration 20261113000000_journey_etapa3.sql...`, depois `Files=2, Tests=84` e `Result: PASS`.

- [ ] **Passo 5: commit**

```bash
git add supabase/migrations/20261113000000_journey_etapa3.sql supabase/tests/database/links.test.sql
git commit -m "feat(banco): links públicos com token do banco, revogação e abrir_link só pra service_role" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 2: Retrato do link e opções (módulos puros)

**Arquivos:**
- Criar: `apps/web/src/compartilhar/retrato.ts`, `apps/web/src/compartilhar/opcoes.ts`
- Teste: `apps/web/test/compartilhar/retrato.test.ts`, `apps/web/test/compartilhar/opcoes.test.ts`

- [ ] **Passo 1: escrever os testes**

`apps/web/test/compartilhar/retrato.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { diagnosticar } from '@journey/nucleo/diagnostico';
import { doc, entrada, fila, peca, ramal, saida } from '@journey/nucleo/teste';
import { esconderNomes, montarRetrato, semObservacoes, trocadorDeNomes, nomesDePessoas, type LinkDoBanco } from '@/compartilhar/retrato';
import { jornadasDoImport } from '@/importacao/jornadas';
import { central } from '../central';

const d = doc({
  entradas: [
    entrada('principal', 'peca:menu', { nome: 'Principal', observacao: 'número da fachada' }),
    entrada('direto-2001', 'ramal:2001', { nome: 'Ana direto' }),
    entrada('recepcao', 'ramal:2003', { nome: 'Recepção' }),
  ],
  ramais: [
    ramal('2001', { nome: 'Ana', ao_nao_atender: 'fila:100' }),
    ramal('2002', { nome: 'Ana Paula', tipo: 'pessoa', ao_nao_atender: 'ramal:9999', observacao: 'sai às 17h' }),
    ramal('2003', { nome: 'Recepção', tipo: 'setor' }),
  ],
  filas: [fila('100', { nome: 'Fila da Ana', espera_maxima_s: 60, ao_esgotar: 'fim:desliga', membros: ['ramal:2001', 'ramal:2002'] })],
  pecas: [peca('menu', 'menu', { nome: 'Menu principal', espera_s: 5, tentativas: 2, texto: 'Digite 1 para Análise, 2 para falar com a ANA ou 3 para a Ana Paula.' })],
  saidas: [
    saida('menu', '1', 'fila:100', { rotulo: 'Análise' }),
    saida('menu', '2', 'ramal:2001', { rotulo: 'Falar com a Ana' }),
    saida('menu', '3', 'ramal:2002', { rotulo: 'Ana Paula' }),
    saida('menu', 'esgotou', 'fim:desliga'),
  ],
});

function link(extra: Partial<LinkDoBanco> = {}, documento = d): LinkDoBanco {
  return {
    estado: 'ok',
    jornada: { nome: 'Telefonia', canal: 'telefonia' },
    versao: { numero: 3, criada_em: '2026-11-12T10:00:00Z', documento, diagnostico: diagnosticar(documento) },
    mais_recente: true,
    esconder_nomes: true,
    cenario: { nome: 'E se a Ana não atender?', entrada: 'entrada:principal', inicio: '2026-11-23T10:00', modo: 'cenario', escolhas: ['saida:menu-2'] },
    expira_em: null,
    intencionais: [{ chave: 'x', nota: 'a Ana pediu' }],
    ...extra,
  };
}

describe('nomes das pessoas', () => {
  it('são os dos ramais, menos os de setor', () => {
    expect([...nomesDePessoas(d)]).toEqual([
      ['ana', 'ramal 2001'],
      ['ana paula', 'ramal 2002'],
    ]);
  });

  it('trocam como palavra inteira, sem caixa, o nome maior primeiro', () => {
    const trocar = trocadorDeNomes(nomesDePessoas(d));
    expect(trocar('Digite 1 para Análise, 2 para falar com a ANA ou 3 para a Ana Paula.')).toBe(
      'Digite 1 para Análise, 2 para falar com a ramal 2001 ou 3 para a ramal 2002.',
    );
    expect(trocar('Banana')).toBe('Banana');
  });
});

describe('esconderNomes', () => {
  const e = esconderNomes(d);

  it('o ramal perde o nome; o de setor fica', () => {
    expect(e.ramais.map((r) => r.nome)).toEqual([undefined, undefined, 'Recepção']);
  });

  it('a entrada direto num ramal escondido perde o nome; as outras trocam o nome da pessoa', () => {
    expect(e.entradas.map((x) => x.nome)).toEqual(['Principal', undefined, 'Recepção']);
    expect(e.filas[0]!.nome).toBe('Fila da ramal 2001');
  });

  it('textos dos áudios e rótulos das opções trocam o nome', () => {
    expect(e.pecas[0]!.texto).toBe('Digite 1 para Análise, 2 para falar com a ramal 2001 ou 3 para a ramal 2002.');
    expect(e.saidas.map((s) => s.rotulo)).toEqual(['Análise', 'Falar com a ramal 2001', 'ramal 2002', undefined]);
  });

  it('não mexe no resto', () => {
    expect(e.saidas.map((s) => s.para)).toEqual(d.saidas.map((s) => s.para));
    expect(e.filas[0]!.membros).toEqual(['ramal:2001', 'ramal:2002']);
    expect(d.ramais[0]!.nome).toBe('Ana');
  });
});

describe('semObservacoes', () => {
  it('tira a observação de todo item', () => {
    const s = semObservacoes(d);
    expect(JSON.stringify(s)).not.toContain('observacao');
    expect(s.entradas[0]!.nome).toBe('Principal');
  });
});

describe('montarRetrato', () => {
  it('com nomes escondidos, nenhum nome de pessoa vai pro navegador', () => {
    const r = montarRetrato(link());
    const tudo = JSON.stringify(r);
    expect(tudo).not.toMatch(/\bAna\b/i);
    expect(JSON.stringify(r.documento)).not.toContain('observacao');
    expect(r.cenario).toMatchObject({ id: 'link', nome: 'E se a ramal 2001 não atender?', escolhas: ['saida:menu-2'], versao_aprovada: 3 });
    expect(r.intencionais).toEqual([{ chave: 'x', nota: '' }]);
  });

  it('o diagnóstico tem as mesmas chaves, com os textos sem nome', () => {
    const l = link();
    const r = montarRetrato(l);
    expect(r.diagnostico.map((a) => a.chave)).toEqual(l.versao.diagnostico.map((a) => a.chave));
    expect(l.versao.diagnostico.some((a) => /Ana Paula/.test(a.titulo + a.texto))).toBe(true);
    expect(r.diagnostico.some((a) => /ramal 2002 aponta pra ramal:9999/.test(a.titulo))).toBe(true);
  });

  it('só os achados que a versão guardou', () => {
    const l = link();
    const guardado = l.versao.diagnostico.slice(1);
    const r = montarRetrato({ ...l, versao: { ...l.versao, diagnostico: guardado } });
    expect(r.diagnostico.map((a) => a.chave)).toEqual(guardado.map((a) => a.chave));
  });

  it('com nomes à mostra, mantém nomes e notas, mas não as observações', () => {
    const r = montarRetrato(link({ esconder_nomes: false, mais_recente: false, expira_em: '2026-12-12T10:00:00Z' }));
    expect(r.documento.ramais[0]!.nome).toBe('Ana');
    expect(r.cenario!.nome).toBe('E se a Ana não atender?');
    expect(r.intencionais).toEqual([{ chave: 'x', nota: 'a Ana pediu' }]);
    expect(JSON.stringify(r.documento)).not.toContain('observacao');
    expect(r).toMatchObject({ versao: 3, maisRecente: false, esconderNomes: false, expiraEm: '2026-12-12T10:00:00Z' });
  });

  it('sem cenário inicial', () => {
    expect(montarRetrato(link({ cenario: null })).cenario).toBeNull();
  });

  it('a central: nenhum "Pessoa NNN" e o mesmo diagnóstico da jornada', async () => {
    const [jornada] = jornadasDoImport(await central());
    const l = link({ cenario: null, intencionais: [] }, jornada!.documento);
    const r = montarRetrato({ ...l, versao: { ...l.versao, diagnostico: jornada!.diagnostico } });
    expect(JSON.stringify(r)).not.toMatch(/Pessoa \d/);
    expect(r.diagnostico.map((a) => a.chave)).toEqual(jornada!.diagnostico.map((a) => a.chave));
  });
});
```

`apps/web/test/compartilhar/opcoes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { descreverLink, ehValidade, enderecoDoLink, expiraEm, situacao, type LinkResumo } from '@/compartilhar/opcoes';

const AGORA = new Date('2026-11-12T15:00:00Z');
const base: LinkResumo = {
  id: 'l1',
  token: 'abcdefghijklmnopqrstuvwx',
  versao: null,
  esconder_nomes: true,
  cenario_nome: null,
  expira_em: null,
  revogado_em: null,
  criado_em: '2026-11-12T12:00:00Z',
};

describe('opções do link', () => {
  it('validade: 7, 30, 90 dias ou sem prazo', () => {
    expect([7, 30, 90, null].every(ehValidade)).toBe(true);
    expect(ehValidade(1)).toBe(false);
    expect(ehValidade('30')).toBe(false);
    expect(expiraEm(7, AGORA)).toBe('2026-11-19T15:00:00.000Z');
    expect(expiraEm(null, AGORA)).toBeNull();
  });

  it('situação: revogado vale mais que vencido', () => {
    expect(situacao(base, AGORA)).toBe('ativo');
    expect(situacao({ ...base, expira_em: '2026-11-12T14:59:00Z' }, AGORA)).toBe('vencido');
    expect(situacao({ ...base, expira_em: '2026-11-12T14:59:00Z', revogado_em: '2026-11-12T13:00:00Z' }, AGORA)).toBe('revogado');
  });

  it('descreve em uma linha, com a data de São Paulo', () => {
    expect(descreverLink(base, AGORA)).toBe('sempre a versão mais recente · nomes escondidos · sem cenário · sem prazo');
    expect(descreverLink({ ...base, versao: 3, esconder_nomes: false, cenario_nome: 'E se?', expira_em: '2026-12-13T02:00:00Z' }, AGORA)).toBe(
      'versão 3 · com os nomes · cenário “E se?” · vale até 12/12/2026',
    );
    expect(descreverLink({ ...base, revogado_em: '2026-11-12T13:00:00Z' }, AGORA)).toContain('revogado em 12/11/2026');
    expect(descreverLink({ ...base, expira_em: '2026-11-10T13:00:00Z' }, AGORA)).toContain('venceu em 10/11/2026');
  });

  it('endereço', () => {
    expect(enderecoDoLink('https://journey.exemplo.com', 'abc')).toBe('https://journey.exemplo.com/l/abc');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npm test -w apps/web -- test/compartilhar`
Expected: FAIL, `Failed to resolve import "@/compartilhar/retrato"` e `"@/compartilhar/opcoes"`.

- [ ] **Passo 3: escrever os módulos**

`apps/web/src/compartilhar/retrato.ts`:

```ts
import { diagnosticar, type Achado } from '@journey/nucleo/diagnostico';
import { lerRef, type Documento } from '@journey/nucleo/formato';
import type { Cenario } from '@/lib/dados';
import type { Modo } from '@/simulacao/sessao';

/** O cenário inicial guardado no link: a cópia do cenário salvo, sem o resultado esperado. */
export interface CenarioDoLink {
  nome: string;
  entrada: string;
  inicio: string;
  modo: Modo;
  escolhas: string[];
}

/** O que `abrir_link` devolve quando o link vale. */
export interface LinkDoBanco {
  estado: 'ok';
  jornada: { nome: string; canal: string };
  versao: { numero: number; criada_em: string; documento: Documento; diagnostico: Achado[] };
  mais_recente: boolean;
  esconder_nomes: boolean;
  cenario: CenarioDoLink | null;
  expira_em: string | null;
  intencionais: { chave: string; nota: string }[];
}

/** O retrato só de leitura que a página do link mostra. É tudo o que vai pro navegador de quem abre. */
export interface Retrato {
  jornada: { nome: string; canal: string };
  versao: number;
  maisRecente: boolean;
  esconderNomes: boolean;
  expiraEm: string | null;
  documento: Documento;
  diagnostico: Achado[];
  intencionais: { chave: string; nota: string }[];
  /** Com id fixo "link": é o único cenário que a página conhece. */
  cenario: Cenario | null;
}

/** Id do cenário inicial na página do link. */
export const CENARIO_DO_LINK = 'link';

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const chave = (s: string) => s.toLocaleLowerCase('pt-BR');

/**
 * Quem o link esconde: o nome de quem usa cada ramal (spec, 4: na primeira versão o nome da pessoa fica no ramal).
 * Ramal de setor ("Recepção") não é pessoa e fica com o nome. Devolve nome → o que aparece no lugar ("ramal 2001");
 * dois ramais com o mesmo nome ficam com o primeiro.
 */
export function nomesDePessoas(doc: Documento): Map<string, string> {
  const nomes = new Map<string, string>();
  for (const r of doc.ramais) {
    const nome = r.nome?.trim();
    if (!nome || nome.length < 2 || r.tipo === 'setor') continue;
    if (!nomes.has(chave(nome))) nomes.set(chave(nome), `ramal ${r.id}`);
  }
  return nomes;
}

/**
 * Troca cada nome, escrito inteiro e como palavra (sem pegar "Ana" dentro de "Análise"), pelo que aparece no lugar.
 * Sem diferença de caixa. Nome maior primeiro: "Ana Paula" antes de "Ana".
 */
export function trocadorDeNomes(nomes: Map<string, string>): (texto: string) => string {
  if (nomes.size === 0) return (t) => t;
  const lista = [...nomes.keys()].sort((a, b) => b.length - a.length).map(escapar);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${lista.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  return (t) => t.replace(re, (achado) => nomes.get(chave(achado)) ?? achado);
}

/** Tira a coluna "observacao" de todos os itens: é nota interna, e a tela não mostra. */
export function semObservacoes(doc: Documento): Documento {
  const tirar = <T extends { observacao?: string }>(lista: T[]): T[] =>
    lista.map((item) => {
      if (item.observacao === undefined) return item;
      const { observacao: _fora, ...resto } = item;
      return resto as T;
    });
  return {
    formato: doc.formato,
    entradas: tirar(doc.entradas),
    horarios: tirar(doc.horarios),
    feriados: tirar(doc.feriados),
    ramais: tirar(doc.ramais),
    filas: tirar(doc.filas),
    grupos: tirar(doc.grupos),
    pecas: tirar(doc.pecas),
    saidas: tirar(doc.saidas),
  };
}

/**
 * O documento sem os nomes das pessoas: o ramal perde o nome; a entrada que disca direto num ramal escondido também
 * (o nome dela costuma ser o da pessoa, e o número continua no mapa); nos outros nomes, nos textos dos áudios e nos
 * rótulos das opções, o nome da pessoa vira "ramal <id>".
 */
export function esconderNomes(doc: Documento): Documento {
  const nomes = nomesDePessoas(doc);
  const trocar = trocadorDeNomes(nomes);
  const escondidos = new Set(doc.ramais.filter((r) => r.nome?.trim() && r.tipo !== 'setor').map((r) => `ramal:${r.id}`));
  const comNome = <T extends { nome?: string }>(item: T): T => (item.nome === undefined ? item : { ...item, nome: trocar(item.nome) });
  const semNome = <T extends { nome?: string }>(item: T): T => {
    if (item.nome === undefined) return item;
    const { nome: _fora, ...resto } = item;
    return resto as T;
  };
  return {
    formato: doc.formato,
    entradas: doc.entradas.map((e) => (lerRef(e.destino)?.tipo === 'ramal' && escondidos.has(e.destino) ? semNome(e) : comNome(e))),
    horarios: doc.horarios.map(comNome),
    feriados: doc.feriados.map(comNome),
    ramais: doc.ramais.map((r) => (r.tipo === 'setor' ? r : semNome(r))),
    filas: doc.filas.map(comNome),
    grupos: doc.grupos.map(comNome),
    pecas: doc.pecas.map((p) => {
      const c = comNome(p);
      return c.texto === undefined ? c : { ...c, texto: trocar(c.texto) };
    }),
    saidas: doc.saidas.map((s) => (s.rotulo === undefined ? s : { ...s, rotulo: trocar(s.rotulo) })),
  };
}

/**
 * O retrato do link, montado no servidor. Sempre sem observações; com "esconder nomes", sem os nomes das pessoas,
 * sem as notas dos intencionais (texto livre) e com o nome do cenário trocado.
 * O diagnóstico é refeito sobre o documento que vai pra tela (os textos dos achados citam nomes), mas só com os
 * achados que a versão guardou: as chaves não dependem de nome, e a jornada de um canal não ganha de volta o
 * "não recebe ligação" do que só o outro canal alcança.
 */
export function montarRetrato(l: LinkDoBanco): Retrato {
  const limpo = semObservacoes(l.versao.documento);
  const documento = l.esconder_nomes ? esconderNomes(limpo) : limpo;
  const trocar = l.esconder_nomes ? trocadorDeNomes(nomesDePessoas(limpo)) : (t: string) => t;
  const guardadas = new Set(l.versao.diagnostico.map((a) => a.chave));
  const diagnostico = diagnosticar(documento).filter((a) => guardadas.has(a.chave));
  const cenario: Cenario | null = l.cenario && {
    id: CENARIO_DO_LINK,
    nome: trocar(l.cenario.nome),
    entrada: l.cenario.entrada,
    inicio: l.cenario.inicio,
    modo: l.cenario.modo,
    escolhas: l.cenario.escolhas,
    esperado: [],
    versao_aprovada: l.versao.numero,
  };
  return {
    jornada: l.jornada,
    versao: l.versao.numero,
    maisRecente: l.mais_recente,
    esconderNomes: l.esconder_nomes,
    expiraEm: l.expira_em,
    documento,
    diagnostico,
    intencionais: l.intencionais.map((i) => ({ chave: i.chave, nota: l.esconder_nomes ? '' : i.nota })),
    cenario,
  };
}
```

`apps/web/src/compartilhar/opcoes.ts`:

```ts
import { FUSO } from '@/lib/fuso';

/** As validades que a tela oferece, em dias; null é sem prazo. */
export const VALIDADES = [7, 30, 90, null] as const;
export type Validade = (typeof VALIDADES)[number];
export const VALIDADE_PADRAO: Validade = 30;

export const ehValidade = (v: unknown): v is Validade => (VALIDADES as readonly unknown[]).includes(v);

export const rotuloValidade = (v: Validade) => (v === null ? 'sem prazo' : `${v} dias`);

/** Quando vence um link criado agora, em ISO; null sem prazo. */
export function expiraEm(dias: Validade, agora: Date): string | null {
  return dias === null ? null : new Date(agora.getTime() + dias * 86_400_000).toISOString();
}

/** Um link na lista do "Compartilhar". */
export interface LinkResumo {
  id: string;
  token: string;
  versao: number | null;
  esconder_nomes: boolean;
  cenario_nome: string | null;
  expira_em: string | null;
  revogado_em: string | null;
  criado_em: string;
}

export type Situacao = 'ativo' | 'vencido' | 'revogado';

export function situacao(l: Pick<LinkResumo, 'expira_em' | 'revogado_em'>, agora: Date): Situacao {
  if (l.revogado_em) return 'revogado';
  if (l.expira_em && new Date(l.expira_em).getTime() <= agora.getTime()) return 'vencido';
  return 'ativo';
}

const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });
export const dataCurta = (iso: string) => dia.format(new Date(iso));

/** "versão 3 · nomes escondidos · cenário “E se…” · vale até 12/12/2026". */
export function descreverLink(l: LinkResumo, agora: Date): string {
  const partes = [
    l.versao === null ? 'sempre a versão mais recente' : `versão ${l.versao}`,
    l.esconder_nomes ? 'nomes escondidos' : 'com os nomes',
    l.cenario_nome ? `cenário “${l.cenario_nome}”` : 'sem cenário',
  ];
  const s = situacao(l, agora);
  if (s === 'revogado') partes.push(`revogado em ${dataCurta(l.revogado_em!)}`);
  else if (s === 'vencido') partes.push(`venceu em ${dataCurta(l.expira_em!)}`);
  else partes.push(l.expira_em ? `vale até ${dataCurta(l.expira_em)}` : 'sem prazo');
  return partes.join(' · ');
}

/** O endereço do link a partir da origem do app. */
export const enderecoDoLink = (origem: string, token: string) => `${origem}/l/${token}`;
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npm test -w apps/web -- test/compartilhar`
Expected: `Tests  17 passed (17)` (13 do retrato, 4 das opções).

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/compartilhar apps/web/test/compartilhar
git commit -m "feat(web): retrato do link sem observações e sem os nomes das pessoas; opções do link" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 3: Servidor: abrir o link, criar e revogar

**Arquivos:**
- Criar: `apps/web/src/lib/documento.ts`, `apps/web/src/lib/link.ts`, `apps/web/src/acoes/links.ts`
- Modificar: `apps/web/src/lib/dados.ts`, `apps/web/test/banco/apoio.ts`, `apps/web/.env.example`
- Teste: `apps/web/test/lib/link.test.ts`, `apps/web/test/acoes/links.test.ts`, `apps/web/test/chave-secreta.test.ts`, `apps/web/test/banco/links.test.ts`

- [ ] **Passo 1: escrever os testes**

`apps/web/test/lib/link.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { doc, ramal } from '@journey/nucleo/teste';

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

const { abrirLink } = await import('@/lib/link');
const TOKEN = 'abcdefghijklmnopqrstuvwx';

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
  });

  it('link que vale volta como retrato, já sem os nomes', async () => {
    const documento = doc({ ramais: [ramal('2001', { nome: 'Ana' })] });
    resposta = {
      data: {
        estado: 'ok',
        jornada: { nome: 'Telefonia', canal: 'telefonia' },
        versao: { numero: 2, criada_em: '2026-11-12T10:00:00Z', documento, diagnostico: [] },
        mais_recente: true,
        esconder_nomes: true,
        cenario: null,
        expira_em: null,
        intencionais: [],
      },
      error: null,
    };
    const r = await abrirLink(TOKEN);
    expect(r.estado).toBe('ok');
    expect(JSON.stringify(r)).not.toContain('Ana');
  });

  it('sem a chave secreta, erro claro', async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    await expect(abrirLink(TOKEN)).rejects.toThrow('SUPABASE_SECRET_KEY');
  });

  it('documento que não é journey/1 não vira página', async () => {
    resposta = {
      data: { estado: 'ok', jornada: { nome: 'x', canal: 'telefonia' }, versao: { numero: 1, criada_em: '', documento: { formato: 'outro' }, diagnostico: [] }, mais_recente: true, esconder_nomes: true, cenario: null, expira_em: null, intencionais: [] },
      error: null,
    };
    await expect(abrirLink(TOKEN)).rejects.toThrow('journey/1');
  });
});
```

`apps/web/test/acoes/links.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Resposta = { data?: unknown; error: { code?: string; message: string } | null };
let respostas: Record<string, Resposta> = {};
/** O que cada consulta fez: tabela, operação, valores e filtros. */
let feitas: { tabela: string; op: string; valores?: unknown; filtros: [string, unknown][] }[] = [];

function consulta(tabela: string) {
  const f: (typeof feitas)[number] = { tabela, op: 'select', filtros: [] };
  feitas.push(f);
  const r = () => respostas[`${tabela}.${f.op}`] ?? { data: null, error: null };
  const q: Record<string, unknown> = {
    then: (ok: (v: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(r()).then(ok, falha),
    single: async () => r(),
    maybeSingle: async () => r(),
    select: () => q,
  };
  for (const m of ['eq', 'is'])
    q[m] = (coluna: string, valor: unknown) => {
      f.filtros.push([coluna, valor]);
      return q;
    };
  for (const m of ['insert', 'update'])
    q[m] = (valores?: unknown) => {
      f.op = m;
      f.valores = valores;
      return q;
    };
  return q;
}

vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: { from: consulta } }) }));
const revalidar = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (c: string) => revalidar(c) }));
const { criarLink, revogarLink } = await import('@/acoes/links');

const log = vi.spyOn(console, 'error').mockImplementation(() => {});
const OPCOES = { versao: null, esconderNomes: true, cenarioId: null, validade: 30 };
const CENARIO = { nome: 'E se?', entrada: 'entrada:e', inicio: '2026-11-23T16:57', modo: 'cenario', escolhas: ['saida:m-1'] };

describe('acoes/links', () => {
  beforeEach(() => {
    respostas = {};
    feitas = [];
    revalidar.mockClear();
    log.mockClear();
  });

  it('cria o link com as opções e devolve o token; a validade vira data', async () => {
    respostas['links.insert'] = { data: { token: 'abcdefghijklmnopqrstuvwx' }, error: null };
    const antes = Date.now();
    expect(await criarLink('e1', 'j1', OPCOES)).toEqual({ token: 'abcdefghijklmnopqrstuvwx' });
    const v = feitas[0]!.valores as { expira_em: string };
    expect(v).toMatchObject({ empresa_id: 'e1', jornada_id: 'j1', versao: null, esconder_nomes: true, cenario: null });
    expect(new Date(v.expira_em).getTime() - antes).toBeGreaterThanOrEqual(30 * 86_400_000 - 1000);
    expect(revalidar).toHaveBeenCalledWith('/e/e1/j/j1');
  });

  it('o cenário inicial é copiado do banco, desta jornada', async () => {
    respostas['cenarios.select'] = { data: CENARIO, error: null };
    respostas['links.insert'] = { data: { token: 't' }, error: null };
    await criarLink('e1', 'j1', { ...OPCOES, cenarioId: 'c1', validade: null, versao: 2 });
    expect(feitas[0]!.filtros).toEqual([
      ['id', 'c1'],
      ['jornada_id', 'j1'],
    ]);
    expect(feitas[1]!.valores).toMatchObject({ cenario: CENARIO, expira_em: null, versao: 2 });
  });

  it('cenário que sumiu não vira link', async () => {
    respostas['cenarios.select'] = { data: null, error: null };
    expect(await criarLink('e1', 'j1', { ...OPCOES, cenarioId: 'c1' })).toEqual({ erro: 'Este cenário não existe mais.' });
    expect(feitas.map((f) => f.tabela)).toEqual(['cenarios']);
  });

  it('esconder nomes só desliga com false', async () => {
    respostas['links.insert'] = { data: { token: 't' }, error: null };
    await criarLink('e1', 'j1', { ...OPCOES, esconderNomes: 'nao' as unknown as boolean });
    expect(feitas[0]!.valores).toMatchObject({ esconder_nomes: true });
  });

  it('validade fora da lista e versão inválida são recusadas antes do banco', async () => {
    expect(await criarLink('e1', 'j1', { ...OPCOES, validade: 1 })).toEqual({ erro: 'Escolhe uma validade da lista.' });
    expect(await criarLink('e1', 'j1', { ...OPCOES, versao: 0 })).toEqual({ erro: 'Versão inválida.' });
    expect(feitas).toEqual([]);
  });

  it('versão que não existe vira texto pra pessoa', async () => {
    respostas['links.insert'] = { error: { code: '23503', message: 'insert or update on table "links" violates foreign key' } };
    expect(await criarLink('e1', 'j1', { ...OPCOES, versao: 9 })).toEqual({ erro: 'Esta versão não existe mais nesta jornada.' });
    expect(log).toHaveBeenCalled();
  });

  it('revogar marca a data, só se ainda não foi revogado, nesta jornada', async () => {
    respostas['links.update'] = { data: [{ id: 'l1' }], error: null };
    expect(await revogarLink('e1', 'j1', 'l1')).toEqual({});
    expect(feitas[0]!.filtros).toEqual([
      ['id', 'l1'],
      ['jornada_id', 'j1'],
      ['revogado_em', null],
    ]);
    expect(typeof (feitas[0]!.valores as { revogado_em: string }).revogado_em).toBe('string');
    expect(revalidar).toHaveBeenCalledWith('/e/e1/j/j1');
  });

  it('revogar de novo avisa', async () => {
    respostas['links.update'] = { data: [], error: null };
    expect(await revogarLink('e1', 'j1', 'l1')).toEqual({ erro: 'Este link já estava revogado.' });
    expect(revalidar).not.toHaveBeenCalled();
  });
});
```

`apps/web/test/chave-secreta.test.ts` (a chave secreta só num arquivo, só do servidor):

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A chave secreta passa por cima das regras de acesso. Só o link público precisa dela, e só num lugar.
const SRC = fileURLToPath(new URL('../src', import.meta.url));

function arquivos(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(pasta, e.name);
    if (e.isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(e.name) ? [caminho] : [];
  });
}

describe('chave secreta', () => {
  const todos = arquivos(SRC).map((f) => [f.slice(SRC.length + 1), readFileSync(f, 'utf8')] as const);

  it('só src/lib/link.ts lê SUPABASE_SECRET_KEY', () => {
    expect(todos.filter(([, texto]) => /SUPABASE_SECRET_KEY|SERVICE_ROLE/.test(texto)).map(([nome]) => nome)).toEqual(['lib/link.ts']);
  });

  it('e ele é só do servidor', () => {
    const [, link] = todos.find(([nome]) => nome === 'lib/link.ts')!;
    expect(link.startsWith("import 'server-only';")).toBe(true);
  });

  it('nenhum componente de cliente importa lib/link', () => {
    const clientes = todos.filter(([, texto]) => texto.startsWith("'use client'"));
    expect(clientes.length).toBeGreaterThan(5);
    expect(clientes.filter(([, texto]) => texto.includes('@/lib/link')).map(([nome]) => nome)).toEqual([]);
  });
});
```

`apps/web/test/banco/links.test.ts` (contra o Supabase local; pulado se ele não estiver no ar):

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { doc, entrada, ramal } from '@journey/nucleo/teste';
import { montarRetrato, type LinkDoBanco } from '@/compartilhar/retrato';
import { jornadasDoImport } from '@/importacao/jornadas';
import { bancoNoAr, clienteAnonimo, clienteSecreto, usuarioNovo } from './apoio';

const noAr = await bancoNoAr();

/** Uma central mínima com o nome de uma pessoa no ramal. */
const CENTRAL = doc({ entradas: [entrada('e1', 'ramal:2001')], ramais: [ramal('2001', { nome: 'Fulana de Tal' })] });

describe.skipIf(!noAr)('links públicos no banco (Supabase local)', () => {
  let u: Awaited<ReturnType<typeof usuarioNovo>>;
  let jornada: string;
  let token: string;
  beforeAll(async () => {
    u = await usuarioNovo();
    const { data: empresa, error } = await u.cliente.rpc('criar_empresa', { p_nome: 'Links' });
    if (error) throw error;
    const jornadas = jornadasDoImport(CENTRAL);
    const { data: imp } = await u.cliente
      .from('imports')
      .insert({ empresa_id: empresa, relatorio: {}, base: CENTRAL, efetivo: CENTRAL })
      .select('id')
      .single();
    const conf = await u.cliente.rpc('confirmar_import', { p_import: imp!.id, p_jornadas: jornadas });
    if (conf.error) throw conf.error;
    jornada = (await u.cliente.from('jornadas').select('id').single()).data!.id as string;
    const l = await u.cliente.from('links').insert({ empresa_id: empresa, jornada_id: jornada }).select('token').single();
    if (l.error) throw l.error;
    token = l.data.token as string;
  });

  it('o membro cria o link e o banco dá o token', () => {
    expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });

  it('sem conta, a API não lê os links nem chama abrir_link', async () => {
    const anonimo = clienteAnonimo();
    const { data } = await anonimo.from('links').select('token');
    expect(data ?? []).toEqual([]);
    const r = await anonimo.rpc('abrir_link', { p_token: token });
    expect(r.error?.code).toBe('42501');
  });

  it('nem o membro logado chama abrir_link', async () => {
    const r = await u.cliente.rpc('abrir_link', { p_token: token });
    expect(r.error?.code).toBe('42501');
  });

  it('com a chave secreta, abre a versão; o retrato sai sem o nome', async () => {
    const { data, error } = await clienteSecreto().rpc('abrir_link', { p_token: token });
    expect(error).toBeNull();
    const l = data as LinkDoBanco;
    expect(l).toMatchObject({ estado: 'ok', mais_recente: true, esconder_nomes: true, versao: { numero: 1 } });
    expect(JSON.stringify(l)).toContain('Fulana de Tal');
    expect(JSON.stringify(montarRetrato(l))).not.toContain('Fulana');
  });

  it('revogado, não abre mais', async () => {
    const r = await u.cliente.from('links').update({ revogado_em: new Date().toISOString() }).eq('token', token).select('id');
    expect(r.data).toHaveLength(1);
    const { data } = await clienteSecreto().rpc('abrir_link', { p_token: token });
    expect(data).toMatchObject({ estado: 'revogado' });
  });
});
```

E os dois clientes novos em `apps/web/test/banco/apoio.ts`:

```diff
diff --git a/apps/web/test/banco/apoio.ts b/apps/web/test/banco/apoio.ts
index 773fadb..e8c053b 100644
--- a/apps/web/test/banco/apoio.ts
+++ b/apps/web/test/banco/apoio.ts
@@ -33,6 +33,12 @@ export async function bancoNoAr(): Promise<boolean> {
   }
 }
 
+/** Cliente com a chave secreta (service_role), como o servidor do app ao abrir um link público. */
+export const clienteSecreto = (): SupabaseClient => createClient(URL_LOCAL, CHAVE_SECRETA, { auth: { persistSession: false } });
+
+/** Cliente sem sessão, só com a chave pública: quem abre um link sem conta, falando direto com a API. */
+export const clienteAnonimo = (): SupabaseClient => createClient(URL_LOCAL, CHAVE_PUBLICA, { auth: { persistSession: false } });
+
 export async function usuarioNovo(): Promise<{ cliente: SupabaseClient; email: string; id: string }> {
   const admin = createClient(URL_LOCAL, CHAVE_SECRETA, { auth: { persistSession: false } });
   const email = `t${Date.now()}${Math.random().toString(36).slice(2, 7)}@exemplo.com`;
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npm test -w apps/web -- test/lib/link.test.ts test/acoes/links.test.ts test/chave-secreta.test.ts test/banco/links.test.ts`
Expected: FAIL: `Failed to resolve import "@/lib/link"` e `"@/acoes/links"`; `chave-secreta` falha com `expected [] to deeply equal [ 'lib/link.ts' ]`.

- [ ] **Passo 3: `ehDocumento` num módulo próprio e a lista de links em `dados.ts`**

`apps/web/src/lib/documento.ts`:

```ts
import type { Documento } from '@journey/nucleo/formato';

const LISTAS_DO_DOCUMENTO = ['entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos', 'pecas', 'saidas'] as const;

/** A forma de um documento journey/1 (o banco já recusa outra; aqui é a segunda trava, antes da tela). */
export function ehDocumento(v: unknown): v is Documento {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return d.formato === 'journey/1' && LISTAS_DO_DOCUMENTO.every((k) => Array.isArray(d[k]));
}
```

`apps/web/src/lib/dados.ts`:

```diff
diff --git a/apps/web/src/lib/dados.ts b/apps/web/src/lib/dados.ts
index 677e14e..30d97c3 100644
--- a/apps/web/src/lib/dados.ts
+++ b/apps/web/src/lib/dados.ts
@@ -2,8 +2,10 @@ import 'server-only';
 import { cache } from 'react';
 import { notFound, redirect } from 'next/navigation';
 import type { Achado, Documento, Evento } from '@journey/nucleo';
+import type { LinkResumo } from '@/compartilhar/opcoes';
 import type { Revisao } from '@/importacao/revisao';
 import type { Modo } from '@/simulacao/sessao';
+import { ehDocumento } from './documento';
 import { supabaseServidor } from './supabase/servidor';
 
 /** Leituras do banco pelo servidor, com a sessão de quem está logado: a regra de acesso (RLS) vale em todas. */
@@ -37,15 +39,6 @@ function talvez<T>(r: { data: T | null; error: ErroBanco }): T | null {
   return r.data;
 }
 
-const LISTAS_DO_DOCUMENTO = ['entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos', 'pecas', 'saidas'] as const;
-
-/** A forma de um documento journey/1 (o banco já recusa outra; aqui é a segunda trava, antes da tela). */
-function ehDocumento(v: unknown): v is Documento {
-  if (typeof v !== 'object' || v === null) return false;
-  const d = v as Record<string, unknown>;
-  return d.formato === 'journey/1' && LISTAS_DO_DOCUMENTO.every((k) => Array.isArray(d[k]));
-}
-
 export interface EmpresaResumo {
   id: string;
   nome: string;
@@ -140,6 +133,18 @@ export async function intencionais(empresaId: string, jornadaId: string): Promis
   return linhas.map((l) => ({ chave: l.chave, nota: l.nota, criado_em: l.criado_em, autor: (l.autor && emails.get(l.autor)) ?? null }));
 }
 
+/** Os links da jornada, do mais novo pro mais velho (vencidos e revogados também: a lista conta o que já foi mandado). */
+export async function links(jornadaId: string): Promise<LinkResumo[]> {
+  const { supabase } = await usuarioAtual();
+  return ok<LinkResumo>(
+    await supabase
+      .from('links')
+      .select('id, token, versao, esconder_nomes, cenario_nome:cenario->>nome, expira_em, revogado_em, criado_em')
+      .eq('jornada_id', jornadaId)
+      .order('criado_em', { ascending: false }),
+  );
+}
+
 export interface ImportRevisao {
   id: string;
   status: 'revisao' | 'confirmado' | 'descartado';
```

- [ ] **Passo 4: abrir o link (a chave secreta) e as ações**

`apps/web/src/lib/link.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { montarRetrato, type LinkDoBanco, type Retrato } from '@/compartilhar/retrato';
import { ehDocumento } from './documento';

export type LinkAberto =
  | { estado: 'ok'; retrato: Retrato }
  | { estado: 'revogado' | 'vencido'; quando: string }
  | { estado: 'inexistente' };

/** O banco gera 24 caracteres de base64 de URL; qualquer outra coisa nem vai pro banco. */
const TOKEN = /^[A-Za-z0-9_-]{24}$/;

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
  if (!ehDocumento(r.versao.documento)) throw new Error(`a versão ${r.versao.numero} do link não é um documento journey/1`);
  return { estado: 'ok', retrato: montarRetrato(r) };
});
```

`apps/web/src/acoes/links.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { ehValidade, expiraEm } from '@/compartilhar/opcoes';
import type { CenarioDoLink } from '@/compartilhar/retrato';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

/** O que a pessoa escolhe no "Compartilhar". */
export interface OpcoesLink {
  /** null: sempre a versão mais recente. */
  versao: number | null;
  esconderNomes: boolean;
  cenarioId: string | null;
  /** Dias, ou null sem prazo (só os de VALIDADES). */
  validade: number | null;
}

const caminho = (empresaId: string, jornadaId: string) => `/e/${empresaId}/j/${jornadaId}`;

/**
 * Cria o link e devolve o token. O cenário inicial é copiado do banco (não do navegador) pra dentro do link.
 * O token, o autor e as datas são do banco; o membro só manda as opções.
 */
export async function criarLink(empresaId: string, jornadaId: string, o: OpcoesLink): Promise<{ token?: string; erro?: string }> {
  if (!ehValidade(o.validade)) return { erro: 'Escolhe uma validade da lista.' };
  if (o.versao !== null && !(Number.isInteger(o.versao) && o.versao > 0)) return { erro: 'Versão inválida.' };
  const { supabase } = await usuarioAtual();
  let cenario: CenarioDoLink | null = null;
  if (o.cenarioId) {
    const c = await supabase.from('cenarios').select('nome, entrada, inicio, modo, escolhas').eq('id', o.cenarioId).eq('jornada_id', jornadaId).maybeSingle();
    if (c.error) return { erro: mensagemDoErro('criarLink', c.error) };
    if (!c.data) return { erro: 'Este cenário não existe mais.' };
    cenario = c.data as CenarioDoLink;
  }
  const r = await supabase
    .from('links')
    .insert({
      empresa_id: empresaId,
      jornada_id: jornadaId,
      versao: o.versao,
      esconder_nomes: o.esconderNomes !== false,
      cenario,
      expira_em: expiraEm(o.validade, new Date()),
    })
    .select('token')
    .single();
  if (r.error) return { erro: mensagemDoErro('criarLink', r.error, { '23503': 'Esta versão não existe mais nesta jornada.' }) };
  revalidatePath(caminho(empresaId, jornadaId));
  return { token: r.data.token as string };
}

/** Revoga pra sempre: quem abrir depois vê a página de link revogado. */
export async function revogarLink(empresaId: string, jornadaId: string, linkId: string): Promise<{ erro?: string }> {
  const { supabase } = await usuarioAtual();
  const r = await supabase
    .from('links')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', linkId)
    .eq('jornada_id', jornadaId)
    .is('revogado_em', null)
    .select('id');
  if (r.error) return { erro: mensagemDoErro('revogarLink', r.error) };
  if (!r.data?.length) return { erro: 'Este link já estava revogado.' };
  revalidatePath(caminho(empresaId, jornadaId));
  return {};
}
```

`apps/web/.env.example`:

```diff
diff --git a/apps/web/.env.example b/apps/web/.env.example
index d438e1a..e351208 100644
--- a/apps/web/.env.example
+++ b/apps/web/.env.example
@@ -6,3 +6,6 @@ NEXT_PUBLIC_LOGIN_GOOGLE=nao
 # Em produção, a URL pública do app (ex.: https://journey.exemplo.com); vazio no desenvolvimento.
 # Com ela, os redirecionamentos e a conferência do Origin não confiam nos cabeçalhos X-Forwarded-*.
 APP_URL=
+# Só no servidor, nunca com NEXT_PUBLIC_: a chave secreta do Supabase. O link público (/l/…) lê o link com ela,
+# porque quem abre não tem sessão. Local: o SECRET_KEY de `npx supabase status -o json`; em produção, a secret key do projeto.
+SUPABASE_SECRET_KEY=
```

- [ ] **Passo 5: rodar e ver passar**

Run: `npm test -w apps/web -- test/lib test/acoes test/chave-secreta.test.ts test/banco`
Expected: tudo passa; `test/banco/links.test.ts` com `5 passed` (com o Supabase no ar e a migração da tarefa 1 aplicada).

Run: `npm run typecheck -w apps/web`
Expected: sem erros.

- [ ] **Passo 6: commit**

```bash
git add apps/web/src/lib apps/web/src/acoes/links.ts apps/web/.env.example apps/web/test/lib/link.test.ts apps/web/test/acoes/links.test.ts apps/web/test/chave-secreta.test.ts apps/web/test/banco
git commit -m "feat(web): link público lido no servidor com a chave secreta; criar e revogar link" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 4: Tela: "Compartilhar" e a jornada só de leitura

**Arquivos:**
- Criar: `apps/web/src/componentes/jornada/Compartilhar.tsx`
- Modificar: `apps/web/src/componentes/jornada/Jornada.tsx`, `apps/web/src/componentes/jornada/PainelDiagnostico.tsx`, `apps/web/src/componentes/jornada/jornada.css`, `apps/web/src/componentes/Icone.tsx`, `apps/web/src/componentes/Marca.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/app/e/[empresa]/j/[jornada]/page.tsx`

Tela sem teste unitário próprio (como na etapa 2): quem cobre é o ponta a ponta da tarefa 6. Aqui a verificação é `typecheck`, os testes que já existem e o build.

- [ ] **Passo 1: o diálogo "Compartilhar"**

`apps/web/src/componentes/jornada/Compartilhar.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { criarLink, revogarLink } from '@/acoes/links';
import { dataCurta, descreverLink, enderecoDoLink, rotuloValidade, situacao, VALIDADE_PADRAO, VALIDADES, type LinkResumo, type Validade } from '@/compartilhar/opcoes';
import { Icone } from '@/componentes/Icone';

export interface PropsCompartilhar {
  empresaId: string;
  jornadaId: string;
  /** A versão na tela: é a que fica fixa quando a pessoa escolhe "só esta versão". */
  versao: number;
  cenarios: { id: string; nome: string }[];
  /** O cenário aberto agora, se houver: vem escolhido como cenário inicial. */
  cenarioAberto: string | null;
  links: LinkResumo[];
}

/** Copia; sem a API de área de transferência (página fora de HTTPS), seleciona o texto do campo pra copiar à mão. */
async function copiar(texto: string, campo: HTMLInputElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    campo?.select();
    return false;
  }
}

/**
 * "Compartilhar" (spec, 14): cria um link só de leitura da jornada, com versão fixa ou a mais recente, nomes escondidos
 * (ligado por padrão), cenário inicial e validade; lista os links já criados, com copiar e revogar.
 */
export function Compartilhar(p: PropsCompartilhar) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  // O conteúdo só existe com o diálogo aberto: a lista usa a hora de agora, que no servidor seria outra.
  const [aberto, setAberto] = useState<{ agora: Date } | null>(null);
  const [fixa, setFixa] = useState(false);
  const [esconder, setEsconder] = useState(true);
  const [cenarioId, setCenarioId] = useState('');
  const [validade, setValidade] = useState<Validade>(VALIDADE_PADRAO);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<{ de: string; texto: string } | null>(null);
  const [novo, setNovo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const abrir = () => {
    setCenarioId(p.cenarioAberto ?? '');
    setNovo(null);
    setErro(null);
    setCopiado(null);
    setAberto({ agora: new Date() });
    dialogo.current?.showModal();
  };

  const criar = async () => {
    setEnviando('novo');
    setErro(null);
    const r = await criarLink(p.empresaId, p.jornadaId, { versao: fixa ? p.versao : null, esconderNomes: esconder, cenarioId: cenarioId || null, validade });
    setEnviando(null);
    if (r.erro || !r.token) {
      setErro({ de: 'novo', texto: r.erro ?? 'Não deu certo agora. Tenta de novo em instantes.' });
      return;
    }
    const endereco = enderecoDoLink(window.location.origin, r.token);
    setNovo(endereco);
    setCopiado((await copiar(endereco, campo.current)) ? endereco : null);
    setAberto({ agora: new Date() });
  };

  const revogar = async (l: LinkResumo) => {
    if (!window.confirm('Revogar este link? Quem abrir depois vê que ele foi revogado. Não tem volta.')) return;
    setEnviando(l.id);
    setErro(null);
    const r = await revogarLink(p.empresaId, p.jornadaId, l.id);
    setEnviando(null);
    if (r.erro) setErro({ de: l.id, texto: r.erro });
    if (novo?.endsWith(`/l/${l.token}`)) setNovo(null);
    setAberto({ agora: new Date() });
  };

  const erroDe = (de: string) =>
    erro?.de === de && (
      <p className="aviso-caixa erro" role="alert">
        {erro.texto}
      </p>
    );

  return (
    <>
      <div className="compartilhar">
        <button className="botao pequeno" type="button" onClick={abrir}>
          <Icone nome="link" /> Compartilhar
        </button>
      </div>
      <dialog ref={dialogo} className="dialogo" aria-labelledby="titulo-compartilhar" onClose={() => setAberto(null)}>
        {aberto && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="cabeca">
              <h2 id="titulo-compartilhar">Compartilhar</h2>
              <button className="bi" type="button" aria-label="Fechar" onClick={() => dialogo.current?.close()}>
                <Icone nome="fechar" />
              </button>
            </div>
            <p className="mudo" style={{ margin: 0 }}>
              Quem abre o link não precisa de conta: vê o mapa, simula e vê o diagnóstico. Não vê o histórico, os ajustes nem os outros cenários.
            </p>
            <form
              style={{ display: 'grid', gap: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                void criar();
              }}
            >
              <fieldset className="grupo-escolhas">
                <legend>Versão</legend>
                <label className="escolha">
                  <input type="radio" name="versao" checked={!fixa} onChange={() => setFixa(false)} /> Sempre a mais recente
                </label>
                <label className="escolha">
                  <input type="radio" name="versao" checked={fixa} onChange={() => setFixa(true)} /> Só a versão {p.versao} (a de agora)
                </label>
              </fieldset>
              <label className="escolha">
                <input type="checkbox" checked={esconder} onChange={(e) => setEsconder(e.target.checked)} /> Esconder nomes
              </label>
              <p className="dica" style={{ margin: '-6px 0 0 24px' }}>
                {esconder
                  ? 'O nome de quem usa cada ramal sai do link, também dos textos e das opções do mapa. O número do ramal continua.'
                  : 'Quem abrir vê os nomes das pessoas nos ramais.'}
              </p>
              <label className="campo">
                Cenário inicial
                <select value={cenarioId} onChange={(e) => setCenarioId(e.target.value)}>
                  <option value="">Nenhum: abre o mapa parado</option>
                  {p.cenarios.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Validade
                <select value={String(validade)} onChange={(e) => setValidade(e.target.value === 'null' ? null : (Number(e.target.value) as Validade))}>
                  {VALIDADES.map((v) => (
                    <option key={String(v)} value={String(v)}>
                      {rotuloValidade(v)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="botao primario" disabled={enviando === 'novo'}>
                Criar link
              </button>
              {erroDe('novo')}
            </form>
            {novo && (
              <div className="linha-form" data-testid="link-novo">
                <input ref={campo} className="entrada-texto" style={{ flex: '1 1 240px' }} readOnly value={novo} aria-label="Endereço do link" onFocus={(e) => e.target.select()} />
                <button
                  className="botao"
                  type="button"
                  onClick={async () => setCopiado((await copiar(novo, campo.current)) ? novo : null)}
                >
                  {copiado === novo ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            )}
            <div className="rotulo-secao">Links desta jornada</div>
            {p.links.length === 0 ? (
              <p className="vazio">Nenhum link ainda.</p>
            ) : (
              <div className="lista-botoes" data-testid="links">
                {p.links.map((l) => {
                  const s = situacao(l, aberto.agora);
                  const endereco = enderecoDoLink(window.location.origin, l.token);
                  return (
                    <div className="achado" key={l.id} data-situacao={s}>
                      <b>{l.cenario_nome ?? 'Sem cenário'}</b>
                      <p>{descreverLink(l, aberto.agora)}</p>
                      <p className="mudo" style={{ fontSize: 12 }}>
                        criado em {dataCurta(l.criado_em)}
                      </p>
                      {s === 'ativo' && (
                        <div className="acoes">
                          <button className="botao pequeno" type="button" onClick={async () => setCopiado((await copiar(endereco, null)) ? endereco : null)}>
                            {copiado === endereco ? 'Copiado' : 'Copiar'}
                          </button>
                          <button className="botao pequeno perigo" type="button" disabled={enviando === l.id} onClick={() => void revogar(l)}>
                            Revogar
                          </button>
                        </div>
                      )}
                      {erroDe(l.id)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
```

- [ ] **Passo 2: a jornada com `membro` (null = só leitura) e cenário inicial**

`apps/web/src/componentes/jornada/Jornada.tsx`:

```diff
diff --git a/apps/web/src/componentes/jornada/Jornada.tsx b/apps/web/src/componentes/jornada/Jornada.tsx
index 8153384..40eb5ec 100644
--- a/apps/web/src/componentes/jornada/Jornada.tsx
+++ b/apps/web/src/componentes/jornada/Jornada.tsx
@@ -8,7 +8,8 @@ import type { Achado } from '@journey/nucleo/diagnostico';
 import { Icone } from '@/componentes/Icone';
 import { MapaFluxo } from '@/componentes/mapa/MapaFluxo';
 import { cenarioAte } from '@/diagnostico/caminho';
-import type { Cenario, Intencional } from '@/lib/dados';
+import type { LinkResumo } from '@/compartilhar/opcoes';
+import type { Cenario } from '@/lib/dados';
 import { montarMapa, type Mapa } from '@/mapa/montar';
 import { comparar } from '@/simulacao/comparar';
 import { descrever, duracao, horaEm } from '@/simulacao/descrever';
@@ -18,18 +19,28 @@ import { canalInicial, escolher as escolherNa, inicioDe, rodar, voltar as voltar
 import { vinculo } from '@/simulacao/vinculo';
 import { aprovarResultado, apagarCenario, desmarcarIntencional, marcarIntencional, salvarCenario } from '@/acoes/jornada';
 import { Cartao, opcaoDaTecla, type CenarioNoCartao } from './Cartao';
-import { PainelDiagnostico } from './PainelDiagnostico';
+import { Compartilhar } from './Compartilhar';
+import { PainelDiagnostico, type MarcaIntencional } from './PainelDiagnostico';
 import { PainelRamais } from './PainelRamais';
 import { usePlayer, useSemMovimento } from './usePlayer';
 
-export interface PropsJornada {
+/** Quem é membro grava cenários e intencionais e compartilha a jornada. */
+export interface MembroNaJornada {
   empresaId: string;
   jornadaId: string;
+  links: LinkResumo[];
+}
+
+export interface PropsJornada {
   versao: number;
   documento: Documento;
   diagnostico: Achado[];
   cenarios: Cenario[];
-  intencionais: Intencional[];
+  intencionais: MarcaIntencional[];
+  /** null no link público: a tela é só leitura (simula e vê o diagnóstico, não grava nada). */
+  membro: MembroNaJornada | null;
+  /** Cenário que abre e toca quando a página abre, se a URL não pedir outro (o cenário inicial do link). */
+  cenarioInicial?: string;
 }
 
 type Aba = 'simular' | 'diagnostico' | 'ramais';
@@ -132,9 +143,11 @@ export function Jornada(p: PropsJornada) {
   const [modo, setModo] = useState<Modo>('cenario');
   useEffect(() => setInicio(inicioDe(new Date())), []);
 
+  // No link público o endereço é o do link: o ?cenario= é coisa da tela dos membros.
+  const membro = p.membro;
   const soltarCenario = () => {
     setCenarioId(null);
-    marcarUrl(null);
+    if (membro) marcarUrl(null);
   };
 
   /** Começa uma simulação nova; com cenário, ele fica aberto (e no link) enquanto a simulação for o caminho dele. */
@@ -143,18 +156,18 @@ export function Jornada(p: PropsJornada) {
       setRaiz(novaRaiz);
       setDestaque(null);
       setCenarioId(c?.id ?? null);
-      marcarUrl(c?.id ?? null);
+      if (membro) marcarUrl(c?.id ?? null);
       setPausado(false);
       setSessao(s);
       setRodada((n) => n + 1);
       irPara(0);
     },
-    [irPara],
+    [irPara, membro],
   );
 
-  // ?cenario=<id> abre e toca o cenário.
+  // ?cenario=<id> (ou o cenário inicial do link) abre e toca o cenário.
   useEffect(() => {
-    const id = new URLSearchParams(window.location.search).get('cenario');
+    const id = (membro ? new URLSearchParams(window.location.search).get('cenario') : null) ?? p.cenarioInicial;
     const c = id ? p.cenarios.find((x) => x.id === id) : undefined;
     if (c) comecar(sessaoDo(c), raizDoCenario(c.entrada), c);
     // Só quando a página abre.
@@ -288,24 +301,25 @@ export function Jornada(p: PropsJornada) {
   };
 
   const apagar = async (c: Cenario) => {
-    if (!window.confirm(`Apagar o cenário “${c.nome}”?`)) return;
+    if (!membro || !window.confirm(`Apagar o cenário “${c.nome}”?`)) return;
     setErroCenarios(null);
-    const r = await apagarCenario(p.empresaId, p.jornadaId, c.id);
+    const r = await apagarCenario(membro.empresaId, membro.jornadaId, c.id);
     if (r.erro) setErroCenarios({ id: c.id, texto: r.erro });
     else if (cenarioId === c.id) soltarCenario();
   };
 
   // Comparação: quando a simulação refez todas as escolhas do cenário e a animação chegou ao fim dos passos
   // (no fim da ligação ou numa decisão que ficou pendente, como depois de um import que tirou uma opção).
+  // No link público não há o que aprovar: o cenário do link é só o caminho.
   const cartaoCenario: CenarioNoCartao | null =
-    cenario && ligacao === 'completo' && sessao && execucao && noFim
+    membro && cenario && ligacao === 'completo' && sessao && execucao && noFim
       ? {
           nome: cenario.nome,
           versao: cenario.versao_aprovada,
           divergencia: comparar(cenario.esperado, execucao.eventos),
           aprovar: async () =>
             (
-              await aprovarResultado(p.empresaId, p.jornadaId, cenario.id, {
+              await aprovarResultado(membro.empresaId, membro.jornadaId, cenario.id, {
                 entrada: sessao.entrada,
                 inicio: sessao.inicio,
                 modo: sessao.modo,
@@ -421,14 +435,25 @@ export function Jornada(p: PropsJornada) {
           verRamal={(ref) => sessao && comecar({ ...sessao, entrada: ref, escolhas: [], modo: 'ninguem_atende' }, ref)}
           cenario={cartaoCenario}
           salvar={
-            sessao && execucao
-              ? async (nome) => (await salvarCenario(p.empresaId, p.jornadaId, { nome, ...sessao, escolhas: [...sessao.escolhas], esperado: execucao.eventos, versao: p.versao })).erro
+            membro && sessao && execucao
+              ? async (nome) =>
+                  (await salvarCenario(membro.empresaId, membro.jornadaId, { nome, ...sessao, escolhas: [...sessao.escolhas], esperado: execucao.eventos, versao: p.versao })).erro
               : null
           }
         />
       </section>
 
       <aside className="painel" aria-label="Painel">
+        {membro && (
+          <Compartilhar
+            empresaId={membro.empresaId}
+            jornadaId={membro.jornadaId}
+            versao={p.versao}
+            cenarios={p.cenarios}
+            cenarioAberto={cenario?.id ?? null}
+            links={membro.links}
+          />
+        )}
         <div className="abas" role="tablist">
           <button className="aba" role="tab" aria-selected={aba === 'simular'} onClick={() => setAba('simular')}>
             Simular
@@ -481,7 +506,11 @@ export function Jornada(p: PropsJornada) {
 
             <div className="rotulo-secao">E se…</div>
             {p.cenarios.length === 0 ? (
-              <p className="vazio">No fim de uma simulação, salva o caminho como cenário pra mostrar pra alguém ou conferir depois de um import.</p>
+              <p className="vazio">
+                {membro
+                  ? 'No fim de uma simulação, salva o caminho como cenário pra mostrar pra alguém ou conferir depois de um import.'
+                  : 'Este link não traz cenário: escolhe a entrada, o dia e a hora e dá play.'}
+              </p>
             ) : (
               <div className="lista-botoes">
                 {p.cenarios.map((c) => (
@@ -495,12 +524,15 @@ export function Jornada(p: PropsJornada) {
                       >
                         <b>{c.nome}</b>
                         <span>
-                          {c.inicio.replace('T', ' ')} · versão {c.versao_aprovada}
+                          {c.inicio.replace('T', ' ')}
+                          {membro && ` · versão ${c.versao_aprovada}`}
                         </span>
                       </button>
-                      <button className="bi" type="button" aria-label={`Apagar ${c.nome}`} onClick={() => void apagar(c)}>
-                        <Icone nome="fechar" />
-                      </button>
+                      {membro && (
+                        <button className="bi" type="button" aria-label={`Apagar ${c.nome}`} onClick={() => void apagar(c)}>
+                          <Icone nome="fechar" />
+                        </button>
+                      )}
                     </div>
                     {erroCenarios?.id === c.id && (
                       <p className="aviso-caixa erro" role="alert" style={{ marginTop: 6 }}>
@@ -536,8 +568,10 @@ export function Jornada(p: PropsJornada) {
             intencionais={p.intencionais}
             verNoMapa={verNoMapa}
             simular={simularAchado}
-            marcar={async (chave, nota) => (await marcarIntencional(p.empresaId, p.jornadaId, chave, nota)).erro}
-            desmarcar={async (chave) => (await desmarcarIntencional(p.empresaId, p.jornadaId, chave)).erro}
+            {...(membro && {
+              marcar: async (chave: string, nota: string) => (await marcarIntencional(membro.empresaId, membro.jornadaId, chave, nota)).erro,
+              desmarcar: async (chave: string) => (await desmarcarIntencional(membro.empresaId, membro.jornadaId, chave)).erro,
+            })}
           />
         )}
 
```

`apps/web/src/componentes/jornada/PainelDiagnostico.tsx`:

```diff
diff --git a/apps/web/src/componentes/jornada/PainelDiagnostico.tsx b/apps/web/src/componentes/jornada/PainelDiagnostico.tsx
index e4d669f..6320b0e 100644
--- a/apps/web/src/componentes/jornada/PainelDiagnostico.tsx
+++ b/apps/web/src/componentes/jornada/PainelDiagnostico.tsx
@@ -3,22 +3,30 @@
 import { useState } from 'react';
 import type { Indice } from '@journey/nucleo/formato';
 import type { Achado } from '@journey/nucleo/diagnostico';
-import type { Intencional } from '@/lib/dados';
 import { pontosComAgenda } from '@/diagnostico/agenda';
 import { Agenda } from './Agenda';
 
 const ORDEM = { grave: 0, alerta: 1, observacao: 2 } as const;
 const NOME_GRAVIDADE = { grave: 'grave', alerta: 'alerta', observacao: 'observação' } as const;
 
+/** Um achado marcado como intencional. `autor` só vem pra membros (no link público, quem marcou não aparece). */
+export interface MarcaIntencional {
+  chave: string;
+  nota: string;
+  /** E-mail de quem marcou; null se a pessoa saiu da empresa. */
+  autor?: string | null;
+}
+
 export interface PropsDiagnostico {
   idx: Indice;
   achados: Achado[];
-  intencionais: Intencional[];
+  intencionais: MarcaIntencional[];
   /** As quatro devolvem o aviso pra mostrar junto do achado, quando há. */
   verNoMapa: (a: Achado) => string | undefined;
   simular: (a: Achado) => string | undefined;
-  marcar: (chave: string, nota: string) => Promise<string | undefined>;
-  desmarcar: (chave: string) => Promise<string | undefined>;
+  /** Sem marcar e desmarcar (link público), o painel é só leitura. */
+  marcar?: (chave: string, nota: string) => Promise<string | undefined>;
+  desmarcar?: (chave: string) => Promise<string | undefined>;
 }
 
 export function PainelDiagnostico({ idx, achados, intencionais, verNoMapa, simular, marcar, desmarcar }: PropsDiagnostico) {
@@ -42,7 +50,9 @@ export function PainelDiagnostico({ idx, achados, intencionais, verNoMapa, simul
   return (
     <div data-testid="diagnostico">
       <p className="mudo" style={{ margin: '12px 0 10px' }}>
-        O diagnóstico roda sozinho a cada versão. Marca como intencional o que é assim de propósito: sai da contagem e fica guardado abaixo.
+        {marcar
+          ? 'O diagnóstico roda sozinho a cada versão. Marca como intencional o que é assim de propósito: sai da contagem e fica guardado abaixo.'
+          : 'O diagnóstico roda sozinho a cada versão. O que a equipe marcou como intencional (assim de propósito) fica fora da contagem, guardado abaixo.'}
       </p>
       {pontosComAgenda(idx).map((p) => (
         <Agenda key={p} idx={idx} ponto={p} />
@@ -68,11 +78,13 @@ export function PainelDiagnostico({ idx, achados, intencionais, verNoMapa, simul
               <button className="botao pequeno" type="button" onClick={() => avisar(a.chave, simular(a))}>
                 Simular
               </button>
-              <button className="botao pequeno" type="button" onClick={() => setNotaDe(notaDe === a.chave ? null : a.chave)}>
-                Marcar como intencional
-              </button>
+              {marcar && (
+                <button className="botao pequeno" type="button" onClick={() => setNotaDe(notaDe === a.chave ? null : a.chave)}>
+                  Marcar como intencional
+                </button>
+              )}
             </div>
-            {notaDe === a.chave && (
+            {marcar && notaDe === a.chave && (
               <form
                 className="linha-form"
                 onSubmit={async (e) => {
@@ -107,25 +119,29 @@ export function PainelDiagnostico({ idx, achados, intencionais, verNoMapa, simul
               .map((a) => (
                 <div className="achado" key={a.chave} data-intencional={a.chave}>
                   <b>{a.titulo}</b>
-                  <p>{marcadas.get(a.chave)!.nota || 'Sem nota.'}</p>
-                  <p className="mudo" style={{ fontSize: 12 }}>
-                    por {marcadas.get(a.chave)!.autor ?? 'alguém que saiu'}
-                  </p>
-                  <div className="acoes">
-                    <button
-                      className="botao pequeno"
-                      type="button"
-                      disabled={enviando === a.chave}
-                      onClick={async () => {
-                        setEnviando(a.chave);
-                        const erro = await desmarcar(a.chave);
-                        setEnviando(null);
-                        avisar(a.chave, erro);
-                      }}
-                    >
-                      Voltar pra contagem
-                    </button>
-                  </div>
+                  <p>{marcadas.get(a.chave)!.nota || (desmarcar ? 'Sem nota.' : 'Marcado como intencional pela equipe.')}</p>
+                  {marcadas.get(a.chave)!.autor !== undefined && (
+                    <p className="mudo" style={{ fontSize: 12 }}>
+                      por {marcadas.get(a.chave)!.autor ?? 'alguém que saiu'}
+                    </p>
+                  )}
+                  {desmarcar && (
+                    <div className="acoes">
+                      <button
+                        className="botao pequeno"
+                        type="button"
+                        disabled={enviando === a.chave}
+                        onClick={async () => {
+                          setEnviando(a.chave);
+                          const erro = await desmarcar(a.chave);
+                          setEnviando(null);
+                          avisar(a.chave, erro);
+                        }}
+                      >
+                        Voltar pra contagem
+                      </button>
+                    </div>
+                  )}
                   {avisoDe(a.chave)}
                 </div>
               ))}
```

`apps/web/src/app/e/[empresa]/j/[jornada]/page.tsx`:

```diff
diff --git a/apps/web/src/app/e/[empresa]/j/[jornada]/page.tsx b/apps/web/src/app/e/[empresa]/j/[jornada]/page.tsx
index 47dc46f..a353ed0 100644
--- a/apps/web/src/app/e/[empresa]/j/[jornada]/page.tsx
+++ b/apps/web/src/app/e/[empresa]/j/[jornada]/page.tsx
@@ -1,13 +1,20 @@
 import { Suspense } from 'react';
 import { Jornada } from '@/componentes/jornada/Jornada';
-import { cenarios, intencionais, versaoAtual } from '@/lib/dados';
+import { cenarios, intencionais, links, versaoAtual } from '@/lib/dados';
 
 export default async function PaginaJornada({ params }: { params: Promise<{ empresa: string; jornada: string }> }) {
   const { empresa, jornada } = await params;
-  const [v, cs, is] = await Promise.all([versaoAtual(empresa, jornada), cenarios(jornada), intencionais(empresa, jornada)]);
+  const [v, cs, is, ls] = await Promise.all([versaoAtual(empresa, jornada), cenarios(jornada), intencionais(empresa, jornada), links(jornada)]);
   return (
     <Suspense>
-      <Jornada empresaId={empresa} jornadaId={jornada} versao={v.numero} documento={v.documento} diagnostico={v.diagnostico} cenarios={cs} intencionais={is} />
+      <Jornada
+        versao={v.numero}
+        documento={v.documento}
+        diagnostico={v.diagnostico}
+        cenarios={cs}
+        intencionais={is}
+        membro={{ empresaId: empresa, jornadaId: jornada, links: ls }}
+      />
     </Suspense>
   );
 }
```

- [ ] **Passo 3: ícone, marca sem link e estilos**

`apps/web/src/componentes/Icone.tsx`:

```diff
diff --git a/apps/web/src/componentes/Icone.tsx b/apps/web/src/componentes/Icone.tsx
index a47397f..efdd1fa 100644
--- a/apps/web/src/componentes/Icone.tsx
+++ b/apps/web/src/componentes/Icone.tsx
@@ -26,6 +26,7 @@ const TRACOS: Record<string, string> = {
   fechar: 'M6.5 6.5l11 11 M17.5 6.5l-11 11',
   legenda: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z M8 9h8 M8 13h8 M8 17h5',
   robo: 'M8 8h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3z M12 4.5V8 M9.5 16h5',
+  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2',
 };
 
 const CHEIOS = new Set(['play', 'pausa']);
```

`apps/web/src/componentes/Marca.tsx`:

```diff
diff --git a/apps/web/src/componentes/Marca.tsx b/apps/web/src/componentes/Marca.tsx
index fa0db34..72eb4d1 100644
--- a/apps/web/src/componentes/Marca.tsx
+++ b/apps/web/src/componentes/Marca.tsx
@@ -1,13 +1,21 @@
 import Link from 'next/link';
 
-export function Marca({ href = '/' }: { href?: string }) {
-  return (
-    <Link className="marca" href={href}>
+/** A marca do Journey. Com `href={null}` (link público, sem conta), não leva a lugar nenhum. */
+export function Marca({ href = '/' }: { href?: string | null }) {
+  const desenho = (
+    <>
       <svg viewBox="0 0 32 32" aria-hidden="true">
         <path d="M4 9h11a8 8 0 0 1 8 8v11" fill="none" style={{ stroke: 'var(--pipe-wall)' }} strokeWidth="8" strokeLinecap="round" />
         <path d="M4 9h11a8 8 0 0 1 8 8v11" fill="none" style={{ stroke: 'var(--w-telefonia)' }} strokeWidth="3.4" strokeLinecap="round" />
       </svg>
       <span>Journey</span>
+    </>
+  );
+  return href === null ? (
+    <span className="marca">{desenho}</span>
+  ) : (
+    <Link className="marca" href={href}>
+      {desenho}
     </Link>
   );
 }
```

`apps/web/src/componentes/jornada/jornada.css`:

```diff
diff --git a/apps/web/src/componentes/jornada/jornada.css b/apps/web/src/componentes/jornada/jornada.css
index e66bcb6..2e01ebd 100644
--- a/apps/web/src/componentes/jornada/jornada.css
+++ b/apps/web/src/componentes/jornada/jornada.css
@@ -174,3 +174,13 @@ button.chip:hover, .chip.escolhido { background: var(--lit); border-color: var(-
 @media (prefers-reduced-motion: reduce) {
   .cano-espuma { display: none; }
 }
+
+/* Compartilhar: o botão no alto do painel e o diálogo com as opções e os links. */
+.compartilhar { display: flex; justify-content: flex-end; padding: 8px 0 4px; }
+.escolha { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink); cursor: pointer; }
+.escolha input { margin: 0; accent-color: var(--btn); }
+.grupo-escolhas { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; }
+.grupo-escolhas legend { padding: 0; margin-bottom: 4px; font-size: 12.5px; color: var(--ink-2); }
+dialog.dialogo { width: min(520px, calc(100% - 32px)); max-height: calc(100% - 32px); overflow: auto; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); color: var(--ink); padding: 18px; box-shadow: var(--shadow); }
+dialog.dialogo::backdrop { background: rgb(10 16 20 / 0.45); }
+.achado[data-situacao='revogado'], .achado[data-situacao='vencido'] { opacity: 0.6; }
```

`apps/web/src/app/globals.css`:

```diff
diff --git a/apps/web/src/app/globals.css b/apps/web/src/app/globals.css
index c2cb658..2890591 100644
--- a/apps/web/src/app/globals.css
+++ b/apps/web/src/app/globals.css
@@ -101,6 +101,7 @@ h2 { font-size: 18px; font-weight: 700; }
 .selo.alerta { background: var(--warn-soft); color: var(--warn); }
 .selo.observacao { background: var(--info-soft); color: var(--info); }
 .selo.ok { background: var(--ok-soft); color: var(--ok); }
+.selo.info { background: var(--info-soft); color: var(--info); }
 .tabela-rolagem { overflow-x: auto; }
 table.tabela { width: 100%; border-collapse: collapse; font-size: 13px; }
 .tabela th { text-align: left; font: 600 10.5px var(--f-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
```

- [ ] **Passo 4: verificar**

Run: `npm run typecheck -w apps/web && npm test -w apps/web`
Expected: sem erros de tipo; `Tests  166 passed (166)` (as tarefas 2 e 3 somam 40 aos 126; os 2 da tarefa 5 ainda não existem).

- [ ] **Passo 5: commit**

```bash
git add apps/web/src/componentes apps/web/src/app/globals.css "apps/web/src/app/e/[empresa]/j/[jornada]/page.tsx"
git commit -m "feat(web): botão Compartilhar com opções e lista de links; jornada só de leitura" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 5: Página pública `/l/[token]`

**Arquivos:**
- Criar: `apps/web/src/app/l/[token]/page.tsx`, `apps/web/src/app/l/[token]/error.tsx`
- Modificar: `apps/web/src/proxy.ts`, `apps/web/next.config.ts`
- Teste: `apps/web/test/app/proxy.test.ts`, `apps/web/test/app/config.test.ts`

- [ ] **Passo 1: escrever os testes**

`apps/web/test/app/proxy.test.ts` (acrescentar no fim):

```diff
diff --git a/apps/web/test/app/proxy.test.ts b/apps/web/test/app/proxy.test.ts
index 91ed065..aa14761 100644
--- a/apps/web/test/app/proxy.test.ts
+++ b/apps/web/test/app/proxy.test.ts
@@ -21,3 +21,10 @@ describe('proxy', () => {
     expect(r.cookies.get('sb-token')).toMatchObject({ value: '', maxAge: 0 });
   });
 });
+
+describe('proxy no link público', () => {
+  it('deixa abrir sem sessão', async () => {
+    const r = await proxy(new NextRequest('http://127.0.0.1:3000/l/abcdefghijklmnopqrstuvwx', { headers: { host: '127.0.0.1:3000' } }));
+    expect(r.headers.get('location')).toBeNull();
+  });
+});
```

`apps/web/test/app/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import config from '../../next.config';

describe('next.config', () => {
  it('o link público não é indexado nem vaza o endereço no Referer', async () => {
    const regras = await config.headers!();
    const link = regras.find((r) => r.source === '/l/:token*');
    expect(link?.headers).toEqual([
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
    ]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npm test -w apps/web -- test/app`
Expected: FAIL: o proxy manda `/l/…` pro `/entrar` (`expected 'http://127.0.0.1:3000/entrar' to be null`) e `config.headers` não existe (`config.headers is not a function`).

- [ ] **Passo 3: proxy e cabeçalhos**

`apps/web/src/proxy.ts`:

```diff
diff --git a/apps/web/src/proxy.ts b/apps/web/src/proxy.ts
index a830869..9d2e4d7 100644
--- a/apps/web/src/proxy.ts
+++ b/apps/web/src/proxy.ts
@@ -15,7 +15,8 @@ export async function proxy(request: NextRequest) {
     },
   });
   const { data } = await supabase.auth.getClaims();
-  const publico = ['/entrar', '/auth'].some((p) => request.nextUrl.pathname.startsWith(p));
+  // /l/: o link público, aberto sem conta.
+  const publico = ['/entrar', '/auth', '/l/'].some((p) => request.nextUrl.pathname.startsWith(p));
   if (!data?.claims && !publico) {
     const paraEntrar = NextResponse.redirect(new URL('/entrar', origemDe(request)));
     // Leva os cookies que o Supabase acabou de mexer (sessão vencida apagada), senão o navegador fica com os velhos.
```

`apps/web/next.config.ts`:

```diff
diff --git a/apps/web/next.config.ts b/apps/web/next.config.ts
index f1db9b1..5127ac3 100644
--- a/apps/web/next.config.ts
+++ b/apps/web/next.config.ts
@@ -2,6 +2,16 @@ import type { NextConfig } from 'next';
 
 const config: NextConfig = {
   transpilePackages: ['@journey/nucleo'],
+  // O link público: nenhum buscador indexa, e o endereço (que é a chave) não vai no Referer pra outro site.
+  headers: async () => [
+    {
+      source: '/l/:token*',
+      headers: [
+        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
+        { key: 'Referrer-Policy', value: 'no-referrer' },
+      ],
+    },
+  ],
   serverExternalPackages: ['exceljs'],
   experimental: {
     // O import aceita até 4 MB (importacao/limite.ts; a Vercel corta em 4,5 MB); a folga é das bordas do multipart.
```

- [ ] **Passo 4: a página e a tela de falha**

`apps/web/src/app/l/[token]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { dataCurta } from '@/compartilhar/opcoes';
import { Marca } from '@/componentes/Marca';
import { Jornada } from '@/componentes/jornada/Jornada';
import { abrirLink, type LinkAberto } from '@/lib/link';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await abrirLink((await params).token);
  if (l.estado !== 'ok') return { title: 'Link indisponível · Journey' };
  return { title: `${l.retrato.cenario?.nome ?? l.retrato.jornada.nome} · Journey` };
}

const AVISOS: Record<Exclude<LinkAberto['estado'], 'ok'>, { titulo: string; texto: (quando?: string) => string }> = {
  revogado: { titulo: 'Este link foi revogado', texto: (q) => `Quem compartilhou tirou o acesso em ${dataCurta(q!)}. Pede um link novo pra quem te mandou.` },
  vencido: { titulo: 'Este link venceu', texto: (q) => `Ele valia até ${dataCurta(q!)}. Pede um link novo pra quem te mandou.` },
  inexistente: { titulo: 'Este link não existe', texto: () => 'Confere se o endereço chegou inteiro. Se chegou, pede um link novo pra quem te mandou.' },
};

/** Revogado, vencido ou que não existe (spec, 15): uma página que explica, sem nada da jornada. */
function Indisponivel({ l }: { l: Exclude<LinkAberto, { estado: 'ok' }> }) {
  const a = AVISOS[l.estado];
  return (
    <main className="entrar">
      <div className="cartao" data-testid="link-indisponivel">
        <Marca href={null} />
        <h1>{a.titulo}</h1>
        <p className="mudo" style={{ margin: 0 }}>
          {a.texto('quando' in l ? l.quando : undefined)}
        </p>
      </div>
    </main>
  );
}

/**
 * O link público (spec, 14): um retrato só de leitura montado no servidor. Quem abre não tem conta e o navegador
 * dele não fala com o banco; os nomes já saíram em `abrirLink`.
 */
export default async function PaginaLink({ params }: Props) {
  const l = await abrirLink((await params).token);
  if (l.estado !== 'ok') return <Indisponivel l={l} />;
  const r = l.retrato;
  return (
    <div className="casca cheia">
      <header className="topo">
        <Marca href={null} />
        <span className="migalhas">
          {r.jornada.nome}
          <span className="barra">/</span>
          versão {r.versao}
          {r.maisRecente && ', a mais recente'}
        </span>
        <span className="selo info">só leitura</span>
        {r.esconderNomes && <span className="selo info">nomes escondidos</span>}
        {r.expiraEm && <span className="mudo empurra">vale até {dataCurta(r.expiraEm)}</span>}
      </header>
      <Suspense>
        <Jornada
          versao={r.versao}
          documento={r.documento}
          diagnostico={r.diagnostico}
          cenarios={r.cenario ? [r.cenario] : []}
          intencionais={r.intencionais}
          membro={null}
          {...(r.cenario && { cenarioInicial: r.cenario.id })}
        />
      </Suspense>
    </div>
  );
}
```

`apps/web/src/app/l/[token]/error.tsx`:

```tsx
'use client';

import { Marca } from '@/componentes/Marca';

/**
 * Quando o link não abre por falha (banco fora do ar, chave secreta faltando no servidor). Revogado, vencido e
 * inexistente não chegam aqui: a página explica cada um. Em produção o Next esconde a mensagem: só o código.
 */
export default function ErroDoLink({ error, retry }: { error: unknown; retry: () => void }) {
  const codigo = error instanceof Error && 'digest' in error ? String(error.digest) : null;
  return (
    <main className="entrar">
      <div className="cartao">
        <Marca href={null} />
        <h1>Não deu pra abrir este link agora</h1>
        <p className="mudo" style={{ margin: 0 }}>
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

- [ ] **Passo 5: rodar e ver passar**

Run: `npm test -w apps/web && npm run typecheck -w apps/web && npm run build`
Expected: `Tests  168 passed (168)`; sem erros de tipo; o build lista `ƒ /l/[token]` (dinâmica: cada abertura lê o banco) e `ƒ Proxy (Middleware)`. Depois: `grep -rl ExcelJS apps/web/.next/static` não acha nada.

- [ ] **Passo 6: commit**

```bash
git add "apps/web/src/app/l" apps/web/src/proxy.ts apps/web/next.config.ts apps/web/test/app
git commit -m "feat(web): página do link público, só leitura, sem login e sem indexar" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 6: Ponta a ponta e capturas

**Arquivos:**
- Criar: `apps/web/e2e/links.spec.ts`
- Modificar: `apps/web/e2e/capturas.spec.ts`

- [ ] **Passo 1: escrever o teste**

`apps/web/e2e/links.spec.ts`:

```ts
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { empresaComImport, entrar, emailNovo } from './apoio';

const PEQUENA = join(import.meta.dirname, 'fixtures', 'pequena.json');

/** Segunda às 10h, tecla 2, o r1 atende; salva como cenário (o nome cita a pessoa de propósito). */
async function cenarioComNome(page: Page) {
  await page.getByLabel('Dia e hora').fill('2026-11-23T10:00');
  await page.getByRole('button', { name: 'Dar play', exact: true }).click();
  const decisao = page.getByRole('region', { name: 'Decisão' });
  await expect(decisao).toContainText('O que a pessoa digita?', { timeout: 30_000 });
  await page.keyboard.press('2');
  await expect(decisao).toContainText('O ramal r1 (Atendente Um) atende?');
  await decisao.getByRole('button', { name: /^.\s*Atende/ }).click();
  const fim = page.getByTestId('fim');
  await expect(fim).toContainText('Atendido');
  await fim.getByLabel('Nome do cenário').fill('E se pedirem o Atendente Um?');
  await fim.getByRole('button', { name: 'Salvar como cenário' }).click();
  await expect(page.getByRole('button', { name: /^E se pedirem o Atendente Um\?/ })).toBeVisible();
}

/** Abre o "Compartilhar", escolhe as opções e devolve o endereço do link novo. */
async function criarLink(page: Page, o: { cenario?: string; esconder?: boolean; fixa?: boolean }) {
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Compartilhar' });
  await expect(dialogo.getByLabel('Esconder nomes')).toBeChecked();
  if (o.esconder === false) await dialogo.getByLabel('Esconder nomes').uncheck();
  if (o.fixa) await dialogo.getByLabel(/Só a versão/).check();
  if (o.cenario) await dialogo.getByLabel('Cenário inicial').selectOption({ label: o.cenario });
  await dialogo.getByRole('button', { name: 'Criar link' }).click();
  const campo = dialogo.getByLabel('Endereço do link');
  await expect(campo).toHaveValue(/\/l\/[A-Za-z0-9_-]{24}$/);
  const endereco = await campo.inputValue();
  await dialogo.getByRole('button', { name: 'Fechar' }).click();
  await expect(dialogo).toBeHidden();
  return endereco;
}

test('link com nomes escondidos e cenário: abre sem login, simula, não mostra nomes; revogado, explica', async ({ page, request, browser }) => {
  test.setTimeout(150_000);
  await entrar(page, request, emailNovo('links'));
  await empresaComImport(page, [PEQUENA]);
  await cenarioComNome(page);

  // Um achado marcado como intencional, com nota que cita a pessoa.
  await page.getByRole('tab', { name: /Diagnóstico/ }).click();
  const ciclo = page.locator('[data-chave="ciclo_transbordo:r1+r2"]');
  await ciclo.getByRole('button', { name: 'Marcar como intencional' }).click();
  await ciclo.getByLabel('Nota').fill('o Atendente Um pediu assim');
  await ciclo.getByRole('button', { name: 'Marcar', exact: true }).click();
  await expect(ciclo).toHaveCount(0);

  const endereco = await criarLink(page, { cenario: 'E se pedirem o Atendente Um?' });

  // Quem abre não tem conta: outro navegador, sem cookies.
  const fora = await browser.newContext();
  const visita = await fora.newPage();
  const resposta = await visita.goto(endereco);
  expect(resposta!.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(resposta!.headers()['referrer-policy']).toBe('no-referrer');
  await expect(visita).toHaveTitle('E se pedirem o ramal r1? · Journey');
  await expect(visita.getByText('só leitura')).toBeVisible();
  await expect(visita.getByText('nomes escondidos')).toBeVisible();

  // O cenário inicial toca sozinho até o fim; dá pra voltar e escolher outra opção.
  await expect(visita.getByTestId('fim')).toContainText('Atendido', { timeout: 30_000 });
  await visita.getByRole('button', { name: 'Voltar uma decisão' }).click();
  await expect(visita.getByRole('region', { name: 'Decisão' })).toContainText('O ramal r1 atende?');

  // Os nomes não saíram do servidor: nem na tela, nem no HTML (que leva os dados da página).
  expect(await visita.content()).not.toContain('Atendente');
  await expect(visita.getByRole('button', { name: 'Compartilhar' })).toHaveCount(0);
  await expect(visita.getByRole('button', { name: 'Salvar como cenário' })).toHaveCount(0);

  // Diagnóstico: vê os achados e o intencional, sem marcar, sem a nota e sem quem marcou.
  await visita.getByRole('tab', { name: /Diagnóstico/ }).click();
  await expect(visita.getByTestId('diagnostico')).toBeVisible();
  await expect(visita.getByRole('button', { name: 'Marcar como intencional' })).toHaveCount(0);
  await visita.getByText('Intencionais (1)').click();
  const marcado = visita.locator('[data-intencional="ciclo_transbordo:r1+r2"]');
  await expect(marcado).toContainText('Marcado como intencional pela equipe.');
  await expect(marcado).not.toContainText('por ');

  // Revogado: a página explica e não mostra nada da jornada.
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Compartilhar' });
  const item = dialogo.getByTestId('links').locator('.achado').first();
  await expect(item).toContainText('cenário “E se pedirem o Atendente Um?”');
  page.once('dialog', (d) => d.accept());
  await item.getByRole('button', { name: 'Revogar' }).click();
  await expect(item).toContainText('revogado em');
  await visita.reload();
  await expect(visita.getByTestId('link-indisponivel')).toContainText('Este link foi revogado');
  expect(await visita.content()).not.toContain('ramal r1');
  await fora.close();
});

test('link com os nomes, na versão fixa e sem cenário: abre parado e mostra os nomes', async ({ page, request, browser }) => {
  test.setTimeout(90_000);
  await entrar(page, request, emailNovo('links-nomes'));
  await empresaComImport(page, [PEQUENA]);
  const endereco = await criarLink(page, { esconder: false, fixa: true });
  const fora = await browser.newContext();
  const visita = await fora.newPage();
  await visita.goto(endereco);
  await expect(visita.locator('.migalhas')).toHaveText('Telefonia/versão 1');
  await expect(visita.getByText('nomes escondidos')).toHaveCount(0);
  await expect(visita.getByText('Dá play numa entrada pra ver pra onde a ligação vai')).toBeVisible();
  await visita.getByRole('tab', { name: 'Ramais' }).click();
  await expect(visita.getByTestId('ramais')).toContainText('Atendente Um');
  await fora.close();
});

test('link que não existe explica, sem login', async ({ page }) => {
  await page.goto('/l/abcdefghijklmnopqrstuvwx');
  await expect(page.getByTestId('link-indisponivel')).toContainText('Este link não existe');
  await expect(page).toHaveTitle('Link indisponível · Journey');
});
```

E as capturas novas em `apps/web/e2e/capturas.spec.ts`:

```diff
diff --git a/apps/web/e2e/capturas.spec.ts b/apps/web/e2e/capturas.spec.ts
index 1e37ce6..d1aaea2 100644
--- a/apps/web/e2e/capturas.spec.ts
+++ b/apps/web/e2e/capturas.spec.ts
@@ -8,7 +8,7 @@ const PASTA = process.env.CAPTURAS ?? '';
 
 test.skip(!PASTA, 'só com CAPTURAS=<pasta>');
 
-test('capturas da tela', async ({ page, request }) => {
+test('capturas da tela', async ({ page, request, browser }) => {
   test.setTimeout(180_000);
   await page.setViewportSize({ width: 1440, height: 900 });
   await entrar(page, request, emailNovo('captura'));
@@ -38,4 +38,22 @@ test('capturas da tela', async ({ page, request }) => {
   await page.getByRole('tab', { name: 'Simular' }).click();
   await page.waitForTimeout(500);
   await page.screenshot({ path: join(PASTA, '6-escuro.png') });
+
+  // Etapa 3: o "Compartilhar" e o link público, aberto sem conta (no computador e no celular).
+  await page.emulateMedia({ colorScheme: 'light' });
+  await page.getByRole('button', { name: 'Compartilhar' }).click();
+  const dialogo = page.getByRole('dialog', { name: 'Compartilhar' });
+  await dialogo.getByRole('button', { name: 'Criar link' }).click();
+  const endereco = await dialogo.getByLabel('Endereço do link').inputValue();
+  await page.screenshot({ path: join(PASTA, '7-compartilhar.png') });
+  const fora = await browser.newContext({ viewport: { width: 1440, height: 900 } });
+  const visita = await fora.newPage();
+  await visita.goto(endereco);
+  await expect(visita.getByTestId('mapa')).toBeVisible({ timeout: 30_000 });
+  await visita.waitForTimeout(800);
+  await visita.screenshot({ path: join(PASTA, '8-link-publico.png') });
+  await visita.setViewportSize({ width: 390, height: 844 });
+  await visita.waitForTimeout(500);
+  await visita.screenshot({ path: join(PASTA, '9-link-celular.png'), fullPage: true });
+  await fora.close();
 });
```

- [ ] **Passo 2: rodar**

Com o Supabase no ar e `SUPABASE_SECRET_KEY` no `apps/web/.env.local` (veja "Antes de começar"; se o `next dev` já estava aberto, reinicie).

Run: `npm run e2e -- e2e/links.spec.ts --trace=off`
Expected: `3 passed`.

Run: `npm run e2e -- --trace=off`
Expected: `24 passed`, `1 skipped` (as capturas).

Run: `CAPTURAS=/tmp/capturas npm run e2e -- e2e/capturas.spec.ts --trace=off`
Expected: `1 passed`; em `/tmp/capturas`, além das 6 da etapa 2, `7-compartilhar.png` (o diálogo com o link novo), `8-link-publico.png` (o link aberto sem conta, "só leitura" e "nomes escondidos" no topo) e `9-link-celular.png` (390 px). Olhe as três: os rádios da versão em linha, um embaixo do outro, e nada cortado no celular.

- [ ] **Passo 3: commit**

```bash
git add apps/web/e2e
git commit -m "test(web): link com nomes escondidos aberto sem login, revogado e vencido; capturas" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 7: Documentação e fechamento

**Arquivos:**
- Modificar: `apps/web/README.md`, `README.md`

- [ ] **Passo 1: READMEs**

`apps/web/README.md`:

````diff
diff --git a/apps/web/README.md b/apps/web/README.md
index 34cd471..3bd65a3 100644
--- a/apps/web/README.md
+++ b/apps/web/README.md
@@ -1,6 +1,6 @@
 # @journey/web
 
-O app de simulação do Journey (etapa 2): login por link mágico, empresa e convites, import com revisão, catálogo com "onde é usado", mapa em encanamento com a água animada, cenários "E se…", diagnóstico e ramais diretos.
+O app de simulação do Journey: login por link mágico, empresa e convites, import com revisão, catálogo com "onde é usado", mapa em encanamento com a água animada, cenários "E se…", diagnóstico e ramais diretos (etapa 2), e links públicos só de leitura, com nomes escondidos, cenário inicial e validade (etapa 3).
 A lógica vem do `@journey/nucleo`; aqui fica a tela, o banco (Supabase) e o que liga os dois.
 
 ## Rodar
@@ -11,6 +11,7 @@ Precisa de Docker (pro Supabase local) e Node 22.
 npm install
 npm run banco                       # sobe o Supabase local e aplica supabase/migrations
 cp apps/web/.env.example apps/web/.env.local
+echo "SUPABASE_SECRET_KEY=$(npx supabase status -o json | node -pe 'JSON.parse(require("fs").readFileSync(0)).SECRET_KEY')" >> apps/web/.env.local
 npm run dev                         # http://127.0.0.1:3000
 ```
 
@@ -26,7 +27,7 @@ npm run typecheck
 npm run build
 ```
 
-`CAPTURAS=<pasta> npm run e2e -- e2e/capturas.spec.ts` tira capturas das telas principais (revisão, mapa, decisão, diagnóstico, celular e escuro). Sem `CAPTURAS`, o teste fica pulado.
+`CAPTURAS=<pasta> npm run e2e -- e2e/capturas.spec.ts` tira capturas das telas principais (revisão, mapa, decisão, diagnóstico, celular, escuro, o "Compartilhar" e o link público). Sem `CAPTURAS`, o teste fica pulado.
 
 ## Partes
 
@@ -36,8 +37,9 @@ npm run build
 | `src/simulacao` | Sessão (refazer as escolhas = mesma execução), passos da animação, estado visual, textos da linha do tempo, comparação com o resultado aprovado e `vinculo` (se a tela ainda é o caminho de um cenário) |
 | `src/diagnostico` | `cenarioAte`: o caminho de uma entrada até o ponto de um achado (o "Simular"); `pontosComAgenda`: as regras de horário que as entradas encontram primeiro, passando por áudios de saída única |
 | `src/importacao` | Jornadas por canal, refs usadas, revisão, relatório e o teto de 4 MB |
-| `src/lib` | Clientes do Supabase, leituras do servidor (`dados.ts`), origem do app, mensagens de erro, fuso |
-| `src/acoes` | Server actions: import, cenários, intencionais, convites, empresa |
+| `src/compartilhar` | O retrato do link público (`montarRetrato`: sem observações e, com "esconder nomes", sem os nomes das pessoas) e as opções do link (validade, situação, a linha que descreve cada um) |
+| `src/lib` | Clientes do Supabase, leituras do servidor (`dados.ts`), o link público (`link.ts`, o único com a chave secreta), origem do app, mensagens de erro, fuso |
+| `src/acoes` | Server actions: import, cenários, intencionais, convites, empresa, links |
 | `src/componentes` | Mapa em React Flow (peças e canos), player, cartão da decisão, painéis |
 | `src/app` | Rotas |
 | `supabase/` (na raiz) | Migração, regras de acesso (RLS) e testes pgTAP |
@@ -64,6 +66,16 @@ npm run build
 - **Cenário aberto só enquanto o caminho é o dele** (`vinculo.ts`): mesma entrada, hora e modo, e as escolhas são o começo das dele. Outra escolha solta o cenário e o fim oferece salvar de novo. Aprovar grava o caminho inteiro (entrada, hora, modo e escolhas) junto com o esperado. A comparação com o aprovado aparece no fim e também no cartão da decisão e no "Fora deste mapa" (quando a água sai pra um ponto que não está neste mapa).
 - **A decisão é um cartão** (região "Decisão", com a pergunta em `aria-live`), não um balão no nó: no computador fica por cima do mapa, no celular embaixo dele. Os chips nos canos que o motor usa também escolhem.
 
+### Links públicos (etapa 3)
+
+- **O link é lido no servidor com a chave secreta**, e só por `src/lib/link.ts`: quem abre não tem sessão, e a função `abrir_link` só aceita a `service_role`. Assim ninguém com o token na mão chama a API e lê o que o servidor esconderia (com a chave pública, `abrir_link` e a tabela `links` dão 42501). O teste `test/chave-secreta.test.ts` barra a chave em qualquer outro arquivo e em componente de cliente.
+- **O navegador de quem abre recebe só o retrato** (`montarRetrato`): o documento da versão sem a coluna `observacao` (nota interna, a tela não mostra) e, com "esconder nomes" (ligado por padrão), sem o nome de quem usa cada ramal. Ramal de tipo `setor` fica com o nome. A entrada que disca direto num ramal escondido perde o nome (o número continua). Nos outros nomes, nos textos dos áudios, nos rótulos das opções e no nome do cenário, o nome da pessoa, escrito inteiro, vira "ramal 2001". As notas dos intencionais saem; quem marcou nunca vai.
+- **Limite do "esconder nomes":** só some o nome escrito como está no ramal. "Fale com a Ana" num áudio, com o ramal "Ana Souza", continua com "Ana". Ids não mudam (são os da central).
+- **O diagnóstico do link é refeito sobre o documento sem nomes** (os textos dos achados citam "ramal 2001 (Ana)"), mas só com as chaves que a versão guardou: as chaves não dependem de nome, e a jornada de um canal não ganha de volta o "não recebe ligação" do que só o outro canal alcança.
+- **O cenário inicial é uma cópia** (nome, entrada, hora, modo e escolhas) feita pelo servidor quando o link é criado: o link mostra o que foi mandado mesmo se o cenário mudar ou for apagado. No link não há "aprovar" nem comparação.
+- **Token de 24 caracteres** (18 bytes aleatórios, base64 de URL), gerado pelo banco; o membro só escolhe as opções (`grant insert` só nessas colunas). Depois de criado, o link só muda pra revogado, e revogar é pra sempre.
+- **Cada abertura lê o banco** (`connection()`): revogar vale na hora. `/l/*` vai com `X-Robots-Tag: noindex, nofollow` e `Referrer-Policy: no-referrer`.
+
 ## Risco aceito
 
 Qualquer membro pode chamar o banco direto (PostgREST e as funções RPC) e gravar um import ou uma versão com o conteúdo que quiser, desde que tenha a forma `journey/1`. O app confere o conteúdo; o banco só a forma.
@@ -77,6 +89,8 @@ Hoje isso é aceitável porque todo membro é editor: quem pode fazer isso pela
 - **jsonb reordena as chaves:** comparar o resultado guardado de um cenário com o de agora é por valor (`comparar`), não por texto, senão todo cenário aparece como "mudou".
 - **Next 16: `proxyClientMaxBodySize` é 10 MB por padrão.** Com o `proxy.ts` no meio, o corpo maior é cortado em silêncio e o import chega quebrado; por isso está em 5 MB no `next.config.ts` (um pouco acima do teto de 4 MB).
 - **Upsert do PostgREST pede UPDATE em toda coluna que ele manda:** o `on conflict do update set` leva todas, e sem permissão em uma delas até o primeiro upsert falha. Por isso as quatro colunas em `achados_intencionais`.
+- **Sem `SUPABASE_SECRET_KEY` no servidor, o link público dá erro** (a página de erro do Next). Local: a linha do `echo` em "Rodar"; no `next dev` já aberto, reinicie depois de mudar o `.env.local`.
+- **`<dialog>` com `showModal()` deixa o resto da página inerte:** feche o "Compartilhar" antes de clicar fora dele (nos testes também).
 - **O Supabase devolve no máximo 1000 linhas por pedido** (`max_rows = 1000`): o catálogo vem em páginas com `.range()` e a contagem por aba é feita no banco.
 
 ## Publicar
````

`README.md`:

````diff
diff --git a/README.md b/README.md
index aa289a5..587d353 100644
--- a/README.md
+++ b/README.md
@@ -13,6 +13,7 @@ O fluxo de atendimento como um encanamento: dá play numa entrada e a água anda
 npm install
 npm run banco      # Supabase local (Docker)
 cp apps/web/.env.example apps/web/.env.local
+echo "SUPABASE_SECRET_KEY=$(npx supabase status -o json | node -pe 'JSON.parse(require("fs").readFileSync(0)).SECRET_KEY')" >> apps/web/.env.local
 npm run dev        # http://127.0.0.1:3000
 ```
 
@@ -25,6 +26,6 @@ Uma vez, com as contas da empresa:
 1. **Supabase:** criar o projeto (região São Paulo). Em Authentication → URL Configuration, pôr o domínio de produção do app em Site URL e `https://<domínio de produção>/auth/callback` em Redirect URLs. Em Authentication → Providers → Email, deixar **Confirm email** ligado: o convite só vale pra e-mail confirmado, e sem a confirmação alguém entraria com o e-mail de outra pessoa. Pra entrar com Google, ligar o provedor Google com o cliente OAuth da empresa.
 2. **E-mail do login:** em Authentication → SMTP Settings, ligar o SMTP próprio (ex.: o SMTP relay do Google Workspace da empresa, `smtp-relay.gmail.com`, com o remetente de um domínio dela) e, em Authentication → Rate Limits, subir o limite de e-mails por hora. O carteiro que vem com o Supabase só entrega pra quem é da equipe do projeto e manda pouquíssimos e-mails por hora: sem SMTP próprio, o link mágico não chega pra ninguém de fora.
 3. **Banco:** `npx supabase link --project-ref <ref>` e `npx supabase db push` (aplica `supabase/migrations`).
-4. **Vercel:** importar o repositório com Root Directory `apps/web`. Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (do projeto) e, se o Google estiver ligado, `NEXT_PUBLIC_LOGIN_GOOGLE=sim`. `APP_URL` vai **só no ambiente Production**, com o domínio de produção (ex.: `https://journey.exemplo.com`), e o app passa a ser usado só por esse domínio: os redirecionamentos e a conferência do Sair usam ela, então num preview com a `APP_URL` de produção o login voltaria pra produção e o Sair recusaria o pedido. Sem `APP_URL` (os previews), o app confia nos cabeçalhos do pedido.
+4. **Vercel:** importar o repositório com Root Directory `apps/web`. Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (do projeto), `SUPABASE_SECRET_KEY` (a secret key do projeto, em Project Settings → API Keys; marcada como Sensitive, sem `NEXT_PUBLIC_`: os links públicos precisam dela no servidor) e, se o Google estiver ligado, `NEXT_PUBLIC_LOGIN_GOOGLE=sim`. `APP_URL` vai **só no ambiente Production**, com o domínio de produção (ex.: `https://journey.exemplo.com`), e o app passa a ser usado só por esse domínio: os redirecionamentos e a conferência do Sair usam ela, então num preview com a `APP_URL` de produção o login voltaria pra produção e o Sair recusaria o pedido. Sem `APP_URL` (os previews), o app confia nos cabeçalhos do pedido.
 5. **Previews (se quiser entrar neles):** pôr também `https://*-<time>.vercel.app/**` em Redirect URLs no Supabase; sem isso o link mágico de um preview cai na Site URL.
 6. Entrar, criar a empresa e importar a planilha da central (até 4 MB somando os arquivos: a Vercel corta o corpo do pedido em 4,5 MB; mais que isso pede upload direto pro Storage, que fica pra depois).
````

- [ ] **Passo 2: tudo de novo, do zero**

```bash
npm test
npm run banco:testes
npm run typecheck
npm run build
grep -rl ExcelJS apps/web/.next/static
npm run e2e -- --trace=off
```

Expected: núcleo `Tests  253 passed (253)`, app `Tests  168 passed (168)`; pgTAP `Tests=84`, `Result: PASS`; `typecheck` e `build` limpos, com `ƒ /l/[token]`; o `grep` não acha nada; e2e `24 passed`, `1 skipped`.

- [ ] **Passo 3: commit, push e PR**

```bash
git add README.md apps/web/README.md
git commit -m "docs: links públicos no README do app e a chave secreta no Publicar" -m "$(cat .git/atribuicao.txt)"
git push -u origin claude/journey-etapa-3-public-links-5wx03t
```

Abrir o PR em rascunho pra `main`: "Etapa 3: links públicos". No corpo: que ele parte do `claude/journey-etapa-2` (brunocmattos/journey#2) e por isso mostra os commits dela até ela entrar; o que entrou (por seção do spec); a decisão da chave secreta; o limite do "esconder nomes"; como rodar (o `SUPABASE_SECRET_KEY` no `.env.local`); os resultados dos testes; as capturas 7, 8 e 9; e o que fica pro Bruno (abaixo).

---

## Cobertura do spec

| Spec | Onde |
|---|---|
| 3, critério 3 (um colega entende um cenário sem explicação, por link) | Tarefas 2, 4, 5 (link com cenário inicial que toca sozinho), 6 (`links.spec.ts`); a conferência com os colegas é do Bruno |
| 5. Link público: endereço só de leitura, sem conta | Tarefas 1, 5 |
| 7.1 `links`: token, jornada, versão fixa ou nula, cenário inicial, esconder nomes, validade, revogado em | Tarefa 1 |
| 14. Botão "Compartilhar" com versão fixa ou mais recente, esconder nomes ligado por padrão, cenário inicial e validade | Tarefa 4 (`Compartilhar.tsx`), 3 (`criarLink`) |
| 14. Rota de servidor monta um retrato só de leitura; nomes removidos no servidor; o navegador de quem abre nunca acessa as tabelas | Tarefas 1 (`abrir_link` só `service_role`), 2 (`montarRetrato`), 3 (`abrirLink`), 6 (o HTML não tem os nomes; `anon` leva 42501) |
| 14. Quem abre simula e vê o diagnóstico; não vê histórico, ajustes nem cenários não compartilhados | Tarefas 2, 4 (`membro={null}`), 6 |
| 14 e 15. Revogado ou vencido: página explicando; não indexado | Tarefas 1, 5, 6 |
| 17. Ponta a ponta: criar um link com nomes escondidos e abrir sem login | Tarefa 6 |
| 18. Nomes de colegas: esconder nomes ligado por padrão nos links | Tarefas 1 (`default true`), 2, 4 |

**Fora desta etapa**, como o spec define: editor, ajustes, trava e restauração de versão (etapa 4), conversores (etapa 5), roteiro de extração (etapa 6). Contar quantas vezes um link foi aberto não está no spec e não entrou.

**Fica pro Bruno:**
1. Na Vercel, a variável `SUPABASE_SECRET_KEY` (a secret key do projeto no Supabase, em Project Settings → API Keys), marcada como Sensitive, sem `NEXT_PUBLIC_`. E `npx supabase db push` pra aplicar a migração nova.
2. O critério 3 de verdade: salvar o cenário "E se ligarem às 16h57?" na central importada, compartilhar com nomes escondidos e mandar pra 2 ou 3 colegas; eles descrevem o caminho sem explicação.

## Depois das revisões

O código foi escrito como está acima e depois passou por revisões independentes, uma por camada. O que elas acharam e onde foi consertado:

| Revisão | O que achou | Commits |
|---|---|---|
| Banco | A data da revogação aceitava qualquer valor (agora um trigger grava `now()`); o nome do cenário do link podia ser vazio ou enorme (agora de 1 a 200 caracteres); faltavam testes de isolamento entre empresas (empresa própria com jornada de outra, revogar link de outra empresa, `anon` lendo a tabela) | `65192c3` |
| Retrato | Entrada e rótulo apontando pra ramal sem nome ou fora do export mantinham o nome da pessoa; texto em NFD não trocava; a troca dependia de `toLocaleLowerCase` ("İsmail"); espaços repetidos, NBSP e apóstrofo tipográfico escapavam; o trocador era calculado duas vezes | `260a6b5` |
| Servidor | Toda FK violada virava "Esta versão não existe mais" (agora "Esta jornada não existe mais.", sem versão fixa); revogar um link que não existe dizia "já estava revogado"; faltavam testes de link vencido, de erro do banco, do prefixo `sb_secret_` e de `env:` no `next.config` | `4092364` |
| Tela | Erro de rede travava "Criar link" e "Revogar" até recarregar; copiar da lista sem área de transferência não tinha saída; o diálogo abria sem nome acessível e sem foco; "esconder nomes" não voltava ligado ao reabrir (contra o spec 14); faltava um envio único entre criar e revogar; as teclas da simulação agiam com o diálogo aberto; botões sem contexto pro leitor de tela; o autor dependia de `undefined` | `d66c461` |
| Página pública e polimento | Contraste abaixo do AA no texto da página indisponível e no "vale até"; `<title>` vazio quando o link falha; sem testes de `/lx` e `/l`; sem `h1`; "vale até" numa linha sozinha no celular; a região de status não anunciava a segunda cópia; o aviso de cópia automática orientava mal no Safari | `ce67fd4` |
| Revisão final | A dica do "Esconder nomes" prometia mais do que a troca faz (agora diz que apelido, primeiro nome sozinho e nome escrito de outro jeito continuam); o README não dizia que nome sem acento ou com hífen escapa, nem que a nota do intencional só sai com "esconder nomes"; o nome da jornada não passava pela troca; iam pro navegador intencionais de achados que não estão na versão; sem a chave secreta, criar link funcionava e o link nascia quebrado (agora `criarLink` recusa, via `linkPublicoConfigurado()` em `lib/link.ts`); os links revogados e vencidos no diálogo usavam `opacity` e ficavam abaixo do AA (agora borda tracejada); o `echo >>` do "Rodar" duplicava a linha `SUPABASE_SECRET_KEY=` do `.env.example` (agora um `sed` preenche a linha); o "Publicar" não dizia pra rodar `db push` antes de publicar o app nem pra criar os links pelo domínio de produção | ``3d24991`` |

Ficou de fora, de propósito: link indisponível responde 200 (uma página que explica, com `noindex`), não 404 nem 410; o teste de banco não passa pelas server actions (o ponta a ponta passa); `criarLink` com opções nulas lança em vez de devolver erro (igual a `salvarCenario`); contar quantas vezes o link foi aberto; o endereço do link usa a origem do navegador do membro, não `APP_URL` (por isso o README pede criar os links pelo domínio de produção); o documento da versão de um canal leva o catálogo inteiro, então peças de outros canais vão no retrato (podar quando houver outros canais).

Contagens finais (eram 253, 168, 84 e 24 + 1 no ensaio):

| Suíte | Resultado |
|---|---|
| Núcleo (Vitest) | `Tests  253 passed (253)` |
| App (Vitest) | `Tests  184 passed (184)` |
| Banco (pgTAP) | `Result: PASS`, `Tests=90` |
| Ponta a ponta (Playwright) | `24 passed`, `1 skipped` (as capturas) |
| `typecheck` e `build` | limpos; o build lista `ƒ /l/[token]`; `grep -rl ExcelJS apps/web/.next/static` não acha nada |
