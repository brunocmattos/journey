-- Links públicos (etapa 3): quem cria, quem revoga, o que o abrir_link devolve e quem pode chamá-lo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'ana@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'beto@exemplo.com', 'authenticated', 'authenticated', now());

create function pg_temp.entrar(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.revogar_tudo() returns int language plpgsql as $$
declare n int;
begin
  update public.links set revogado_em = now();
  get diagnostics n = row_count;
  return n;
end;
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
  $$ insert into public.links (empresa_id, jornada_id, cenario) values ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
       '{"nome":"   ","entrada":"entrada:e1","inicio":"2026-11-23T16:57","modo":"cenario","escolhas":[]}') $$,
  '23514', null, 'nome do cenário só com espaços não entra');
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
select throws_ok(
  $$ insert into public.links (empresa_id, jornada_id) values ('b0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001') $$,
  '23503', null, 'nem com a empresa dele: a jornada tem que ser da mesma empresa');
select is(pg_temp.revogar_tudo(), 0, 'quem é de outra empresa não revoga link');
select throws_ok($$ select public.abrir_link(current_setting('teste.token')) $$, '42501', null, 'usuário logado não chama abrir_link');

select pg_temp.entrar('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.links where revogado_em is not null), 0, 'o link da empresa A segue sem revogação depois do Beto');
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

insert into public.links (empresa_id, jornada_id, esconder_nomes) values ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', false);
update public.links set revogado_em = '1999-01-01' where not esconder_nomes and versao is null;
select ok((select revogado_em >= criado_em from public.links where not esconder_nomes and versao is null), 'a data da revogação é a do banco, não a que o app mandou');

reset role;
update public.links set criado_em = now() - interval '10 days', expira_em = now() - interval '1 day' where token = current_setting('teste.token_fixo');
set local role service_role;
select is(public.abrir_link(current_setting('teste.token')) ->> 'estado', 'revogado', 'link revogado não abre');
select is(public.abrir_link(current_setting('teste.token_fixo')) ->> 'estado', 'vencido', 'link vencido não abre');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.abrir_link(current_setting('teste.token')) $$, '42501', null, 'quem não tem conta não chama abrir_link pela API');
select throws_ok($$ select * from public.links $$, '42501', null, 'quem não tem conta não lê a tabela de links');

select * from finish();
rollback;
