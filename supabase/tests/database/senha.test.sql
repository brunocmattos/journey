-- A senha some quando o e-mail é confirmado, e a pessoa não troca o e-mail (migração 20261116000000).
-- Roda com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- A migração limpou as trocas de e-mail pendentes, e nenhuma nova entra.
select is((select count(*)::int from auth.users where coalesce(email_change, '') <> ''), 0, 'nenhuma conta com troca de e-mail pendente');

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
