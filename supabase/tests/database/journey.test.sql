-- Regras de acesso e funções do Journey. Roda com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

-- Duas pessoas, cada uma na sua empresa, mais o Caio (convidado) e o Davi (e-mail ainda não confirmado).
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-00000000000b', 'beto@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-00000000000c', 'caio@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-00000000000d', 'davi@exemplo.com', 'authenticated', 'authenticated', null);

select is((select file_size_limit from storage.buckets where id = 'imports'), 20971520::bigint, 'o bucket de imports aceita até 20 MB por arquivo');
select is((select allowed_mime_types from storage.buckets where id = 'imports'), array['application/octet-stream'], 'e só como octet-stream');

create function pg_temp.entrar(p_id uuid, p_email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true);
$$;

-- O menor documento journey/1 que o confirmar_import aceita.
select set_config('teste.doc', '{"formato":"journey/1","entradas":[],"horarios":[],"feriados":[],"ramais":[],"filas":[],"grupos":[],"pecas":[],"saidas":[]}', true);
create function pg_temp.jornadas(p_doc jsonb, p_nome text default 'Telefonia') returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('nome', p_nome, 'canal', 'telefonia', 'documento', p_doc, 'diagnostico', '[]'::jsonb, 'refs', '[]'::jsonb));
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
       jsonb_build_array(jsonb_build_object('nome', 'Telefonia', 'canal', 'telefonia', 'documento', current_setting('teste.doc')::jsonb,
         'diagnostico', '[]'::jsonb, 'refs', '["entrada:e1","fila:f1","ramal:r1"]'::jsonb))) $$,
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

-- Rascunho novo: as escritas que o app faz e as que não pode fazer.
select pg_temp.entrar('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com');
select set_config('teste.jornada_a', (select id::text from public.jornadas), true);
select lives_ok(
  $$ delete from public.imports where empresa_id = current_setting('teste.empresa_a')::uuid and status = 'revisao' $$,
  'membro apaga o rascunho');
select lives_ok(
  $$ insert into public.imports (id, empresa_id, parcial, anterior_id, relatorio, base, efetivo, arquivos)
     values ('10000000-0000-0000-0000-000000000003', current_setting('teste.empresa_a')::uuid, false,
             '10000000-0000-0000-0000-000000000001', '{}', '{}', '{}', '[]') $$,
  'membro analisa um import novo em cima do último');
select throws_ok(
  $$ select public.confirmar_import('10000000-0000-0000-0000-000000000003', null) $$,
  '22023', null, 'confirmar sem a lista de jornadas não vale');
select throws_ok(
  $$ select public.confirmar_import('10000000-0000-0000-0000-000000000003',
       pg_temp.jornadas(current_setting('teste.doc')::jsonb) || pg_temp.jornadas(current_setting('teste.doc')::jsonb)) $$,
  '22023', 'p_jornadas tem nome de jornada repetido', 'nem com nome de jornada repetido');
select throws_ok(
  $$ select public.confirmar_import('10000000-0000-0000-0000-000000000003',
       pg_temp.jornadas(current_setting('teste.doc')::jsonb || '{"formato":"journey/2"}')) $$,
  '22023', 'p_jornadas tem documento que não é journey/1', 'nem com documento de outro formato');
select throws_ok(
  $$ select public.confirmar_import('10000000-0000-0000-0000-000000000003',
       pg_temp.jornadas(current_setting('teste.doc')::jsonb - 'saidas')) $$,
  '22023', null, 'nem com documento sem uma das listas');
select throws_ok(
  $$ select public.confirmar_import('10000000-0000-0000-0000-000000000003',
       pg_temp.jornadas(current_setting('teste.doc')::jsonb || '{"pecas":{}}')) $$,
  '22023', null, 'nem com lista que não é lista');
select throws_ok(
  $$ select public.confirmar_import('10000000-0000-0000-0000-000000000003',
       pg_temp.jornadas(current_setting('teste.doc')::jsonb) || pg_temp.jornadas('"journey/1"', 'WhatsApp')) $$,
  '22023', null, 'nem com documento que não é objeto, mesmo numa jornada só de várias');
select is((select status from public.imports where id = '10000000-0000-0000-0000-000000000003'), 'revisao', 'e o import recusado continua em revisão');
select throws_ok(
  $$ update public.imports set empresa_id = current_setting('teste.empresa_b')::uuid $$,
  '42501', null, 'o rascunho não muda de empresa');
select throws_ok(
  $$ update public.imports set relatorio = '{"ok":true}' where id = '10000000-0000-0000-0000-000000000003' $$,
  '42501', null, 'nem tem o relatório reescrito');
select lives_ok(
  $$ update public.imports set arquivos = '[{"nome":"a.csv","tamanho":1,"caminho":null}]' where id = '10000000-0000-0000-0000-000000000003' $$,
  'membro anota os arquivos do rascunho');
select lives_ok(
  $$ update public.imports set status = 'descartado'
     where empresa_id = current_setting('teste.empresa_a')::uuid and id = '10000000-0000-0000-0000-000000000003' and status = 'revisao' $$,
  'membro descarta o rascunho');
select is((select status from public.imports where id = '10000000-0000-0000-0000-000000000003'), 'descartado', 'e ele fica descartado');

-- Cenários e intencionais: só na jornada da própria empresa.
select lives_ok(
  $$ insert into public.cenarios (empresa_id, jornada_id, nome, entrada, inicio, modo, escolhas, esperado, versao_aprovada)
     values (current_setting('teste.empresa_a')::uuid, current_setting('teste.jornada_a')::uuid, 'Liga e atende',
             'entrada:e1', '2026-11-12T10:00', 'cenario', '[]', '[]', 1) $$,
  'membro cria cenário na sua jornada');
select lives_ok(
  $$ insert into public.achados_intencionais (empresa_id, jornada_id, chave, nota)
     values (current_setting('teste.empresa_a')::uuid, current_setting('teste.jornada_a')::uuid, 'fila-sem-transbordo', 'de propósito')
     on conflict (jornada_id, chave) do update set nota = excluded.nota $$,
  'membro marca um achado como intencional');
select pg_temp.entrar('00000000-0000-0000-0000-00000000000b', 'beto@exemplo.com');
select throws_ok(
  $$ insert into public.cenarios (empresa_id, jornada_id, nome, entrada, inicio, esperado, versao_aprovada)
     values (current_setting('teste.empresa_b')::uuid, current_setting('teste.jornada_a')::uuid, 'Intruso',
             'entrada:e1', '2026-11-12T10:00', '[]', 1) $$,
  '23503', null, 'cenário não aponta pra jornada de outra empresa');
select throws_ok(
  $$ insert into public.achados_intencionais (empresa_id, jornada_id, chave)
     values (current_setting('teste.empresa_b')::uuid, current_setting('teste.jornada_a')::uuid, 'outra-chave') $$,
  '23503', null, 'nem achado intencional');
-- Marcar de novo, como o upsert do app (todas as colunas enviadas no "do update set").
select throws_ok(
  $$ insert into public.achados_intencionais (empresa_id, jornada_id, chave, nota)
     values (current_setting('teste.empresa_a')::uuid, current_setting('teste.jornada_a')::uuid, 'fila-sem-transbordo', 'invasão')
     on conflict (jornada_id, chave) do update
       set empresa_id = excluded.empresa_id, jornada_id = excluded.jornada_id, chave = excluded.chave, nota = excluded.nota $$,
  '42501', null, 'quem não é membro não muda a nota do intencional');
select pg_temp.entrar('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com');
select lives_ok(
  $$ insert into public.achados_intencionais (empresa_id, jornada_id, chave, nota)
     values (current_setting('teste.empresa_a')::uuid, current_setting('teste.jornada_a')::uuid, 'fila-sem-transbordo', 'nota nova')
     on conflict (jornada_id, chave) do update
       set empresa_id = excluded.empresa_id, jornada_id = excluded.jornada_id, chave = excluded.chave, nota = excluded.nota $$,
  'membro marca de novo o mesmo achado');
select is((select nota from public.achados_intencionais where chave = 'fila-sem-transbordo'), 'nota nova', 'e a nota é atualizada');

-- Empresa: só o nome muda. E ninguém esvazia tabela por fora das regras.
select pg_temp.entrar('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com');
select throws_ok(
  $$ update public.empresas set criada_por = auth.uid() $$,
  '42501', null, 'membro não troca quem criou a empresa');
select throws_ok($$ truncate public.achados_intencionais $$, '42501', null, 'nem esvazia uma tabela');

-- Sem sessão (anon): não vê nada nem chama as funções.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.empresas) + (select count(*)::int from public.catalogo), 0, 'anon não vê empresas nem catálogo');
select throws_ok($$ select public.criar_empresa('X') $$, '42501', null, 'anon não cria empresa');
select throws_ok($$ select public.aceitar_convites() $$, '42501', null, 'anon não aceita convite');
select throws_ok($$ select public.confirmar_import('10000000-0000-0000-0000-000000000003', '[]') $$, '42501', null, 'anon não confirma import');
select throws_ok($$ select * from public.onde_usado(current_setting('teste.empresa_a')::uuid, 'ramal:r1') $$, '42501', null, 'anon não pergunta onde é usado');

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
