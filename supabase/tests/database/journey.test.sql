-- Regras de acesso e funções do Journey. Roda com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Duas pessoas, cada uma na sua empresa.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'beto@exemplo.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'caio@exemplo.com', 'authenticated', 'authenticated');

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
select is((select array_agg(nome) from public.empresas), array['Empresa B'], 'quem é de outra empresa não vê a primeira');

-- Convite: a Ana convida o Caio; o Caio entra quando loga.
select pg_temp.entrar('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com');
select lives_ok(
  $$ insert into public.convites (empresa_id, email) select id, 'caio@exemplo.com' from public.empresas $$,
  'membro convida por e-mail');
select pg_temp.entrar('00000000-0000-0000-0000-00000000000b', 'beto@exemplo.com');
select throws_ok(
  $$ insert into public.convites (empresa_id, email) values (current_setting('teste.empresa_a')::uuid, 'x@exemplo.com') $$,
  '42501', null, 'quem não é membro não convida');
select pg_temp.entrar('00000000-0000-0000-0000-00000000000c', 'caio@exemplo.com');
select is((select count(*)::int from public.aceitar_convites()), 1, 'o convidado entra ao aceitar');
select is((select array_agg(nome) from public.empresas), array['Empresa A'], 'e passa a ver a empresa');

-- Import em revisão e confirmação.
select pg_temp.entrar('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com');
insert into public.imports (id, empresa_id, relatorio, base, efetivo)
select '10000000-0000-0000-0000-000000000001', id, '{}',
  '{"formato":"journey/1","entradas":[{"id":"e1","numero":"1","canal":"telefonia","destino":"fila:f1","ativo":true}],"horarios":[],"feriados":[],"ramais":[{"id":"r1","transbordo_anti_loop":false}],"filas":[{"id":"f1","nome":"Fila 1","estrategia":"ringall","membros":["ramal:r1"],"membros_dinamicos":false}],"grupos":[],"pecas":[],"saidas":[]}',
  '{"formato":"journey/1","entradas":[{"id":"e1","numero":"1","canal":"telefonia","destino":"fila:f1","ativo":true}],"horarios":[],"feriados":[],"ramais":[{"id":"r1","transbordo_anti_loop":false}],"filas":[{"id":"f1","nome":"Fila 1","estrategia":"ringall","membros":["ramal:r1"],"membros_dinamicos":false}],"grupos":[],"pecas":[],"saidas":[]}'
from public.empresas;
select throws_ok(
  $$ insert into public.catalogo (empresa_id, aba, item_id, dados, import_id) select id, 'filas', 'x', '{}', '10000000-0000-0000-0000-000000000001' from public.empresas $$,
  '42501', null, 'a tela não grava direto no catálogo');
select lives_ok(
  $$ select public.confirmar_import('10000000-0000-0000-0000-000000000001',
       '[{"nome":"Telefonia","canal":"telefonia","documento":{"formato":"journey/1"},"diagnostico":[],"refs":["entrada:e1","fila:f1","ramal:r1"]}]') $$,
  'membro confirma o import');
select is((select count(*)::int from public.catalogo), 3, 'o catálogo tem a entrada, o ramal e a fila');
select is((select membro from public.catalogo_membros), 'ramal:r1', 'os membros da fila vão pra tabela própria');
select is((select numero from public.jornada_versoes), 1, 'a jornada nasce na versão 1');
select is((select count(*)::int from public.jornada_refs where ref = 'ramal:r1'), 1, 'onde é usado: a versão usa o ramal');
select throws_ok(
  $$ select public.confirmar_import('10000000-0000-0000-0000-000000000001', '[]') $$,
  'P0001', 'este import já foi confirmado', 'não confirma duas vezes');

select is(
  (select array_agg(tipo || ':' || coalesce(aba, '') || ':' || nome order by tipo) from public.onde_usado(current_setting('teste.empresa_a')::uuid, 'ramal:r1')),
  array['catalogo:filas:Fila 1', 'jornada::Telefonia'],
  'onde é usado: a fila que tem o ramal como membro e a jornada');
select is(
  (select campos from public.onde_usado(current_setting('teste.empresa_a')::uuid, 'fila:f1') where tipo = 'catalogo'),
  array['destino'],
  'e diz por qual coluna');

-- Import analisado antes do último confirmado não pode ser confirmado.
insert into public.imports (id, empresa_id, relatorio, base, efetivo)
select '10000000-0000-0000-0000-000000000002', id, '{}', '{}', '{}' from public.empresas;
select throws_ok(
  $$ select public.confirmar_import('10000000-0000-0000-0000-000000000002', '[]') $$,
  'P0001', 'outro import foi confirmado depois desta análise: analise de novo', 'base velha não confirma');

-- Outra empresa não vê nada disso.
select pg_temp.entrar('00000000-0000-0000-0000-00000000000b', 'beto@exemplo.com');
select is((select count(*)::int from public.catalogo) + (select count(*)::int from public.jornadas) + (select count(*)::int from public.imports), 0,
  'quem é de outra empresa não vê catálogo, jornadas nem imports');
select throws_ok(
  $$ select public.confirmar_import('10000000-0000-0000-0000-000000000002', '[]') $$,
  'P0002', 'import não encontrado', 'nem confirma o import dos outros');

select * from finish();
rollback;
