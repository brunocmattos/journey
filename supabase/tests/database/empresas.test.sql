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
