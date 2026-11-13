-- Journey v2 (etapa A): canais, cadastros, fluxos, salvar, trava e versões.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'ana@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000f2', 'caio@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000f3', 'beto@exemplo.com', 'authenticated', 'authenticated', now());

create function pg_temp.entrar(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.doc(p_pecas jsonb default '[]') returns jsonb language sql as $$
  select jsonb_build_object('formato', 'journey/2', 'pecas', p_pecas, 'conexoes', '[]'::jsonb, 'grupos', '[]'::jsonb, 'notas', '[]'::jsonb);
$$;

set local role authenticated;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000f1');
select set_config('teste.a', public.criar_empresa('Empresa A')::text, true);
select pg_temp.entrar('00000000-0000-0000-0000-0000000000f3');
select set_config('teste.b', public.criar_empresa('Empresa B')::text, true);

reset role;
insert into public.membros (empresa_id, usuario_id, email) values (current_setting('teste.a')::uuid, '00000000-0000-0000-0000-0000000000f2', 'caio@exemplo.com');
set local role authenticated;

-- Empresa nova já vem com canais e tipos.
select pg_temp.entrar('00000000-0000-0000-0000-0000000000f1');
select is((select array_agg(chave order by ordem) from public.canais), array['telefonia', 'whatsapp', 'email', 'chat', 'interno'], 'empresa nova vem com os cinco canais');
select is((select array_agg(chave order by chave) from public.tipos_cadastro where padrao), array['equipe', 'fila', 'horario', 'pessoa', 'sistema'], 'e com os cinco tipos de cadastro');
select is((select count(*)::int from public.canais where empresa_id = current_setting('teste.b')::uuid), 0, 'não vê os canais de outra empresa');

-- Canais: muda e arquiva; não apaga.
select lives_ok($$ update public.canais set cor = '#000000', arquivado = true where chave = 'chat' $$, 'muda a cor e arquiva um canal');
select lives_ok($$ insert into public.canais (empresa_id, chave, nome, cor) values (current_setting('teste.a')::uuid, 'presencial', 'Presencial', '#888888') $$, 'cria um canal');
select throws_ok($$ insert into public.canais (empresa_id, chave, nome, cor) values (current_setting('teste.a')::uuid, 'Com Espaço', 'X', '#888888') $$, '23514', null, 'chave de canal só com minúsculas, números, - e _');
select throws_ok($$ delete from public.canais $$, '42501', null, 'canal não se apaga, se arquiva');

-- Tipos de cadastro: os padrão não se apagam; os próprios sim.
select lives_ok($$ insert into public.tipos_cadastro (empresa_id, chave, nome, campos) values (current_setting('teste.a')::uuid, 'loja', 'Loja', '[{"chave":"cidade","nome":"Cidade","tipo":"texto"}]') $$, 'cria um tipo de cadastro próprio');
delete from public.tipos_cadastro where chave = 'fila';
select ok(exists (select 1 from public.tipos_cadastro where chave = 'fila'), 'tipo padrão não se apaga');

-- Cadastros.
select lives_ok($$ insert into public.cadastros (empresa_id, tipo, nome) values (current_setting('teste.a')::uuid, 'fila', 'Fila Cobrança') $$, 'cria um cadastro');
select throws_ok($$ insert into public.cadastros (empresa_id, tipo, nome) values (current_setting('teste.a')::uuid, 'fila', '  fila cobrança ') $$, '23505', null, 'o mesmo nome no mesmo tipo não se repete, sem caixa nem espaços');
select throws_ok($$ insert into public.cadastros (empresa_id, tipo, nome) values (current_setting('teste.a')::uuid, 'robo', 'R2') $$, '23503', null, 'cadastro de tipo que a empresa não tem não entra');
select set_config('teste.fila', (select id::text from public.cadastros where nome = 'Fila Cobrança'), true);
select lives_ok($$ delete from public.tipos_cadastro where chave = 'loja' $$, 'tipo próprio sem cadastro se apaga');

-- Fluxos: criar só com nome; documento só pelo salvar.
select lives_ok($$ insert into public.fluxos (empresa_id, nome, canal) values (current_setting('teste.a')::uuid, 'Cobrança', 'whatsapp') $$, 'cria um fluxo');
select set_config('teste.f', (select id::text from public.fluxos), true);
select is((select revisao from public.fluxos), 0, 'nasce na revisão 0');
select is((select documento from public.fluxos), pg_temp.doc(), 'com o documento vazio');
select throws_ok($$ insert into public.fluxos (empresa_id, nome, documento) values (current_setting('teste.a')::uuid, 'X', '{}') $$, '42501', null, 'documento não se grava direto');
select throws_ok($$ update public.fluxos set revisao = 9 $$, '42501', null, 'nem a revisão');
select throws_ok($$ insert into public.fluxos (empresa_id, nome, canal) values (current_setting('teste.a')::uuid, 'X', 'fax') $$, '23503', null, 'canal tem que ser da empresa');

-- Salvar.
select is(public.salvar_fluxo(current_setting('teste.f')::uuid, 0,
  pg_temp.doc(jsonb_build_array(jsonb_build_object('id', 'a', 'tipo', 'atendimento', 'nome', 'Cobra', 'x', 0, 'y', 0, 'responsavel', current_setting('teste.fila')))),
  '{"velocidade":2}'), 1, 'salva e devolve a revisão nova');
select is((select array_agg(cadastro_id::text) from public.fluxo_cadastros), array[current_setting('teste.fila')], 'o "onde é usado" vem do documento');
select is((select estilo from public.fluxos), '{"velocidade":2}'::jsonb, 'e o estilo junto');
select throws_ok($$ select public.salvar_fluxo(current_setting('teste.f')::uuid, 0, pg_temp.doc()) $$, '40001', null, 'revisão velha: outra pessoa salvou no meio');
select throws_ok($$ select public.salvar_fluxo(current_setting('teste.f')::uuid, 1, '{"formato":"journey/1","pecas":[]}') $$, '23514', null, 'documento que não é journey/2 não entra');
select throws_ok($$ select public.salvar_fluxo(current_setting('teste.f')::uuid, 1, '{"formato":"journey/2"}') $$, '23514', null, 'nem documento sem as listas');
select throws_ok($$ select public.salvar_fluxo(current_setting('teste.f')::uuid, 1, pg_temp.doc('[{"id":"a","tipo":"etapa","nome":"x","x":0,"y":0,"responsavel":"maria"}]')) $$, '22023', null, 'responsável que não é cadastro não entra');
select throws_ok($$ delete from public.cadastros where id = current_setting('teste.fila')::uuid $$, '23503', null, 'cadastro em uso não se apaga');

select pg_temp.entrar('00000000-0000-0000-0000-0000000000f3');
select throws_ok($$ select public.salvar_fluxo(current_setting('teste.f')::uuid, 1, pg_temp.doc()) $$, 'P0002', null, 'quem é de outra empresa não salva');
select lives_ok($$ insert into public.cadastros (empresa_id, tipo, nome) values (current_setting('teste.b')::uuid, 'pessoa', 'Beto') $$, 'a outra empresa tem os cadastros dela');
select set_config('teste.beto', (select id::text from public.cadastros), true);

-- Trava.
select pg_temp.entrar('00000000-0000-0000-0000-0000000000f1');
select throws_ok(format($$ select public.salvar_fluxo(%L::uuid, 1, pg_temp.doc('[{"id":"a","tipo":"etapa","nome":"x","x":0,"y":0,"responsavel":"%s"}]')) $$, current_setting('teste.f'), current_setting('teste.beto')),
  '22023', null, 'responsável de outra empresa não entra');
select is((public.pegar_trava(current_setting('teste.f')::uuid) ->> 'ok')::boolean, true, 'a Ana pega a trava');
select pg_temp.entrar('00000000-0000-0000-0000-0000000000f2');
select is(public.pegar_trava(current_setting('teste.f')::uuid) ->> 'por', 'ana@exemplo.com', 'o Caio vê quem está editando');
select throws_ok($$ select public.salvar_fluxo(current_setting('teste.f')::uuid, 1, pg_temp.doc()) $$, 'P0001', null, 'e não salva por cima');
reset role;
update public.fluxos set trava_ate = now() - interval '1 minute';
set local role authenticated;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000f2');
select is((public.pegar_trava(current_setting('teste.f')::uuid) ->> 'ok')::boolean, true, 'trava vencida passa pra quem pede');

-- Versões.
select is(public.marcar_versao(current_setting('teste.f')::uuid, 'antes do horário novo'), 1, 'marca a versão 1');
select is((select documento from public.fluxo_versoes), (select documento from public.fluxos), 'a versão guarda o documento de agora');

select * from finish();
rollback;
