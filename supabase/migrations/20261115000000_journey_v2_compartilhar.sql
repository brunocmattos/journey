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
