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
