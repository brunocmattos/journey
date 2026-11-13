-- Journey v2 (etapa A): canais, cadastros e fluxos do editor.
-- Só acrescenta: as tabelas da v1 (catálogo, jornadas, imports) continuam até a etapa B trocar a tela.
-- Como na v1: toda tabela tem empresa_id, RLS só pra membros, e filha liga o pai pela dupla (id, empresa_id).
-- O documento do fluxo só muda pela função salvar_fluxo (confere a revisão, a trava e os responsáveis).

-- Canais e tipos de cadastro: cada empresa tem os seus ------------------------

create table public.canais (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  nome text not null check (length(btrim(nome)) between 1 and 60),
  cor text not null check (cor ~ '^#[0-9a-fA-F]{6}$'),
  icone text,
  ordem int not null default 0,
  arquivado boolean not null default false,
  primary key (empresa_id, chave)
);

create table public.tipos_cadastro (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  nome text not null check (length(btrim(nome)) between 1 and 60),
  -- Campos próprios do tipo: [{ chave, nome, tipo: texto|numero|opcoes|pessoa, opcoes? }]. O app confere o conteúdo.
  campos jsonb not null default '[]' check (jsonb_typeof(campos) = 'array'),
  -- Os cinco que toda empresa recebe; não se apagam.
  padrao boolean not null default false,
  primary key (empresa_id, chave)
);

-- Os mesmos de CANAIS_PADRAO e TIPOS_CADASTRO_PADRAO (packages/fluxo/src/cadastros.ts).
create function public.semear_empresa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.canais (empresa_id, chave, nome, cor, ordem) values
    (new.id, 'telefonia', 'Telefonia', '#1e8bdc', 1),
    (new.id, 'whatsapp', 'WhatsApp', '#159e5a', 2),
    (new.id, 'email', 'E-mail', '#c98410', 3),
    (new.id, 'chat', 'Chat', '#7650d6', 4),
    (new.id, 'interno', 'Interno', '#3a6a88', 5);
  insert into public.tipos_cadastro (empresa_id, chave, nome, padrao) values
    (new.id, 'pessoa', 'Pessoa', true),
    (new.id, 'fila', 'Fila', true),
    (new.id, 'equipe', 'Equipe', true),
    (new.id, 'sistema', 'Sistema', true),
    (new.id, 'horario', 'Horário', true);
  return new;
end;
$$;
create trigger semear_empresa after insert on public.empresas for each row execute function public.semear_empresa();
revoke execute on function public.semear_empresa() from public, anon, authenticated;

-- As empresas que já existem também recebem os seus.
insert into public.canais (empresa_id, chave, nome, cor, ordem)
select e.id, c.chave, c.nome, c.cor, c.ordem
from public.empresas e
cross join (values ('telefonia', 'Telefonia', '#1e8bdc', 1), ('whatsapp', 'WhatsApp', '#159e5a', 2), ('email', 'E-mail', '#c98410', 3),
  ('chat', 'Chat', '#7650d6', 4), ('interno', 'Interno', '#3a6a88', 5)) c (chave, nome, cor, ordem);
insert into public.tipos_cadastro (empresa_id, chave, nome, padrao)
select e.id, t.chave, t.nome, true
from public.empresas e
cross join (values ('pessoa', 'Pessoa'), ('fila', 'Fila'), ('equipe', 'Equipe'), ('sistema', 'Sistema'), ('horario', 'Horário')) t (chave, nome);

-- Cadastros: as coisas reais que as peças usam ---------------------------------

create table public.cadastros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo text not null,
  nome text not null check (length(btrim(nome)) between 1 and 200),
  -- Horário: { janelas, feriados }; tipos personalizados: os campos do tipo. O app confere o conteúdo.
  campos jsonb not null default '{}' check (jsonb_typeof(campos) = 'object'),
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (id, empresa_id),
  foreign key (empresa_id, tipo) references public.tipos_cadastro (empresa_id, chave)
);
-- O mesmo nome não se repete no mesmo tipo (sem diferença de caixa nem espaços nas pontas).
create unique index cadastros_nome_unico on public.cadastros (empresa_id, tipo, lower(btrim(nome)));

-- Fluxos e versões --------------------------------------------------------------

create table public.fluxos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  descricao text not null default '',
  canal text,
  -- O documento journey/2 inteiro: peças, conexões, grupos e notas. A forma é conferida aqui; o conteúdo, pelo app.
  documento jsonb not null default '{"formato":"journey/2","pecas":[],"conexoes":[],"grupos":[],"notas":[]}',
  -- Estilo e animação do fluxo (o que muda em relação ao padrão).
  estilo jsonb not null default '{}' check (jsonb_typeof(estilo) = 'object'),
  -- Quantas peças o documento tem (pra lista, sem abrir o documento). Só salvar_fluxo mexe.
  total_pecas int not null default 0,
  -- Meta de tempo do fluxo, em segundos (o diagnóstico avisa quando o caminho mais longo passa dela).
  meta_s int check (meta_s > 0),
  -- Sobe a cada salvamento: quem salva manda a revisão que abriu; se mudou no meio, o banco recusa.
  revisao int not null default 0,
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  editado_por uuid references auth.users (id) on delete set null default auth.uid(),
  editado_em timestamptz not null default now(),
  -- Quem está editando e até quando (a trava vence sozinha depois de 10 minutos sem salvar).
  trava_por uuid references auth.users (id) on delete set null,
  trava_ate timestamptz,
  unique (id, empresa_id),
  foreign key (empresa_id, canal) references public.canais (empresa_id, chave),
  -- coalesce: chave faltando dá null, e null passaria no check. case: o Postgres não garante a ordem do and. Os limites são os de LIMITES (packages/fluxo/src/validar.ts).
  constraint fluxos_documento_forma check (coalesce(
    documento ->> 'formato' = 'journey/2'
    and case when jsonb_typeof(documento -> 'pecas') = 'array' then jsonb_array_length(documento -> 'pecas') <= 2000 else false end
    and case when jsonb_typeof(documento -> 'conexoes') = 'array' then jsonb_array_length(documento -> 'conexoes') <= 6000 else false end
    and case when jsonb_typeof(documento -> 'grupos') = 'array' then jsonb_array_length(documento -> 'grupos') <= 500 else false end
    and case when jsonb_typeof(documento -> 'notas') = 'array' then jsonb_array_length(documento -> 'notas') <= 500 else false end, false)),
  constraint fluxos_documento_tamanho check (octet_length(documento::text) <= 8000000),
  constraint fluxos_estilo_tamanho check (octet_length(estilo::text) <= 20000)
);
create index fluxos_empresa on public.fluxos (empresa_id, editado_em desc);

create table public.fluxo_versoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  fluxo_id uuid not null,
  numero int not null check (numero > 0),
  nome text not null check (length(btrim(nome)) between 1 and 120),
  documento jsonb not null,
  estilo jsonb not null,
  autor uuid references auth.users (id) on delete set null default auth.uid(),
  criada_em timestamptz not null default now(),
  unique (fluxo_id, numero),
  unique (id, empresa_id),
  foreign key (fluxo_id, empresa_id) references public.fluxos (id, empresa_id) on delete cascade
);

-- "Onde é usado": os cadastros que cada fluxo usa, refeito a cada salvamento. Cadastro em uso não se apaga.
create table public.fluxo_cadastros (
  fluxo_id uuid not null,
  empresa_id uuid not null,
  cadastro_id uuid not null,
  primary key (fluxo_id, cadastro_id),
  foreign key (fluxo_id, empresa_id) references public.fluxos (id, empresa_id) on delete cascade,
  foreign key (cadastro_id, empresa_id) references public.cadastros (id, empresa_id) on delete restrict
);
create index fluxo_cadastros_cadastro on public.fluxo_cadastros (cadastro_id);
create index fluxo_versoes_empresa on public.fluxo_versoes (empresa_id);

-- Apagar a empresa apaga tudo dela. O "onde é usado" sai antes, senão o cadastro em uso barraria a cascata.
create function public.limpar_uso_da_empresa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.fluxo_cadastros where empresa_id = old.id;
  return old;
end;
$$;
create trigger limpar_uso_da_empresa before delete on public.empresas for each row execute function public.limpar_uso_da_empresa();
revoke execute on function public.limpar_uso_da_empresa() from public, anon, authenticated;

-- Quem mudou o fluxo por último, inclusive nome, canal e meta (que a tela grava direto).
create function public.carimbar_fluxo() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.editado_em := now();
  new.editado_por := coalesce(auth.uid(), new.editado_por);
  return new;
end;
$$;
create trigger carimbar_fluxo before update of nome, descricao, canal, meta_s, documento, estilo on public.fluxos
  for each row execute function public.carimbar_fluxo();

-- A lista de fluxos sem trazer os documentos: só o tamanho. security_invoker: valem as regras de quem pergunta.
create view public.fluxos_resumo with (security_invoker = true) as
  select f.id, f.empresa_id, f.nome, f.descricao, f.canal, f.editado_em, f.editado_por,
    f.total_pecas as pecas,
    case when f.trava_ate > now() then f.trava_por end as editando_por
  from public.fluxos f;

-- Regras de acesso ---------------------------------------------------------------

alter table public.canais enable row level security;
alter table public.tipos_cadastro enable row level security;
alter table public.cadastros enable row level security;
alter table public.fluxos enable row level security;
alter table public.fluxo_versoes enable row level security;
alter table public.fluxo_cadastros enable row level security;

create policy "membro vê os canais" on public.canais for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria canal" on public.canais for insert to authenticated with check (public.eh_membro(empresa_id));
create policy "membro muda canal" on public.canais for update to authenticated using (public.eh_membro(empresa_id)) with check (public.eh_membro(empresa_id));

create policy "membro vê os tipos" on public.tipos_cadastro for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria tipo" on public.tipos_cadastro for insert to authenticated with check (public.eh_membro(empresa_id) and not padrao);
create policy "membro muda tipo" on public.tipos_cadastro for update to authenticated using (public.eh_membro(empresa_id)) with check (public.eh_membro(empresa_id));
create policy "membro apaga tipo próprio" on public.tipos_cadastro for delete to authenticated using (public.eh_membro(empresa_id) and not padrao);

create policy "membro vê os cadastros" on public.cadastros for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria cadastro" on public.cadastros for insert to authenticated with check (public.eh_membro(empresa_id) and criado_por = auth.uid());
create policy "membro muda cadastro" on public.cadastros for update to authenticated using (public.eh_membro(empresa_id)) with check (public.eh_membro(empresa_id));
create policy "membro apaga cadastro" on public.cadastros for delete to authenticated using (public.eh_membro(empresa_id));

create policy "membro vê os fluxos" on public.fluxos for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria fluxo" on public.fluxos for insert to authenticated with check (public.eh_membro(empresa_id) and criado_por = auth.uid());
create policy "membro muda fluxo" on public.fluxos for update to authenticated using (public.eh_membro(empresa_id)) with check (public.eh_membro(empresa_id));
create policy "membro apaga fluxo" on public.fluxos for delete to authenticated using (public.eh_membro(empresa_id));

create policy "membro vê as versões" on public.fluxo_versoes for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro vê onde é usado" on public.fluxo_cadastros for select to authenticated using (public.eh_membro(empresa_id));

-- Por coluna: o que a tela grava direto. Documento, revisão, trava e versões só pelas funções abaixo.
revoke all on public.canais, public.tipos_cadastro, public.cadastros, public.fluxos, public.fluxo_versoes, public.fluxo_cadastros, public.fluxos_resumo from anon;
revoke all on public.fluxos_resumo from authenticated;
grant select on public.fluxos_resumo to authenticated;
revoke insert, update, delete, truncate, trigger, references, maintain on
  public.canais, public.tipos_cadastro, public.cadastros, public.fluxos, public.fluxo_versoes, public.fluxo_cadastros from authenticated;
grant insert (empresa_id, chave, nome, cor, icone, ordem) on public.canais to authenticated;
grant update (nome, cor, icone, ordem, arquivado) on public.canais to authenticated;
grant insert (empresa_id, chave, nome, campos) on public.tipos_cadastro to authenticated;
grant update (nome, campos) on public.tipos_cadastro to authenticated;
grant delete on public.tipos_cadastro to authenticated;
grant insert (empresa_id, tipo, nome, campos) on public.cadastros to authenticated;
grant update (nome, campos) on public.cadastros to authenticated;
grant delete on public.cadastros to authenticated;
grant insert (empresa_id, nome, descricao, canal, estilo, meta_s) on public.fluxos to authenticated;
grant update (nome, descricao, canal, meta_s) on public.fluxos to authenticated;
grant delete on public.fluxos to authenticated;

-- Funções ------------------------------------------------------------------------

-- Grava o documento e o estilo do fluxo. p_revisao é a revisão que o editor abriu: se outra pessoa salvou no meio,
-- recusa (40001) em vez de sobrescrever. Recusa também se a trava é de outra pessoa e não venceu, e se uma peça
-- aponta pra um responsável que não é cadastro desta empresa. Refaz o "onde é usado". Devolve a revisão nova.
create function public.salvar_fluxo(p_fluxo uuid, p_revisao int, p_documento jsonb, p_estilo jsonb default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v public.fluxos%rowtype;
  v_resp text[];
begin
  select * into v from public.fluxos where id = p_fluxo for update;
  if not found or not public.eh_membro(v.empresa_id) then
    raise exception 'fluxo não encontrado' using errcode = 'P0002';
  end if;
  if v.trava_por is not null and v.trava_por <> auth.uid() and v.trava_ate > now()
    and exists (select 1 from public.membros m where m.empresa_id = v.empresa_id and m.usuario_id = v.trava_por) then
    raise exception 'outra pessoa está editando este fluxo' using errcode = 'P0001';
  end if;
  if v.revisao is distinct from p_revisao then
    raise exception 'o fluxo mudou desde que foi aberto: recarregue' using errcode = '40001';
  end if;
  if jsonb_typeof(p_documento -> 'pecas') = 'array' then
    select array_agg(distinct lower(p ->> 'responsavel')) into v_resp
    from jsonb_array_elements(p_documento -> 'pecas') p
    where coalesce(p ->> 'responsavel', '') <> '';
  end if;
  if exists (
    select 1 from unnest(coalesce(v_resp, '{}')) r
    where case when r ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then not exists (select 1 from public.cadastros c where c.id = r::uuid and c.empresa_id = v.empresa_id)
      else true end
  ) then
    raise exception 'uma peça aponta pra um responsável que não é cadastro desta empresa' using errcode = '22023';
  end if;
  update public.fluxos set
    documento = p_documento,
    estilo = coalesce(p_estilo, estilo),
    total_pecas = coalesce(jsonb_array_length(case when jsonb_typeof(p_documento -> 'pecas') = 'array' then p_documento -> 'pecas' end), 0),
    revisao = revisao + 1,
    editado_por = auth.uid(),
    editado_em = now(),
    trava_ate = case when trava_por = auth.uid() then now() + interval '10 minutes' else trava_ate end
  where id = p_fluxo;
  delete from public.fluxo_cadastros where fluxo_id = p_fluxo;
  insert into public.fluxo_cadastros (fluxo_id, empresa_id, cadastro_id)
  select p_fluxo, v.empresa_id, r::uuid from unnest(coalesce(v_resp, '{}')) r;
  return v.revisao + 1;
end;
$$;

-- Pega a trava de edição (ou renova, se já é de quem pede). Se outra pessoa tem a trava e ela não venceu,
-- devolve quem e até quando. { ok, ate } ou { ok: false, por: e-mail, ate }.
create function public.pegar_trava(p_fluxo uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.fluxos%rowtype;
  v_ate timestamptz := now() + interval '10 minutes';
begin
  select * into v from public.fluxos where id = p_fluxo for update;
  if not found or not public.eh_membro(v.empresa_id) then
    raise exception 'fluxo não encontrado' using errcode = 'P0002';
  end if;
  if v.trava_por is null or v.trava_por = auth.uid() or v.trava_ate <= now()
    or not exists (select 1 from public.membros m where m.empresa_id = v.empresa_id and m.usuario_id = v.trava_por) then
    update public.fluxos set trava_por = auth.uid(), trava_ate = v_ate where id = p_fluxo;
    return jsonb_build_object('ok', true, 'ate', v_ate);
  end if;
  return jsonb_build_object('ok', false, 'ate', v.trava_ate,
    'por', (select m.email from public.membros m where m.empresa_id = v.empresa_id and m.usuario_id = v.trava_por));
end;
$$;

-- Solta a trava, se é de quem pede.
create function public.soltar_trava(p_fluxo uuid) returns void
language sql security definer set search_path = '' as $$
  update public.fluxos set trava_por = null, trava_ate = null
  where id = p_fluxo and trava_por = auth.uid() and public.eh_membro(empresa_id);
$$;

-- Marca uma versão com nome: foto do documento e do estilo de agora. Devolve o número.
create function public.marcar_versao(p_fluxo uuid, p_nome text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v public.fluxos%rowtype;
  v_numero int;
begin
  select * into v from public.fluxos where id = p_fluxo for update;
  if not found or not public.eh_membro(v.empresa_id) then
    raise exception 'fluxo não encontrado' using errcode = 'P0002';
  end if;
  select coalesce(max(numero), 0) + 1 into v_numero from public.fluxo_versoes where fluxo_id = p_fluxo;
  insert into public.fluxo_versoes (empresa_id, fluxo_id, numero, nome, documento, estilo)
  values (v.empresa_id, p_fluxo, v_numero, btrim(p_nome), v.documento, v.estilo);
  return v_numero;
end;
$$;

revoke execute on function public.salvar_fluxo(uuid, int, jsonb, jsonb), public.pegar_trava(uuid), public.soltar_trava(uuid), public.marcar_versao(uuid, text) from public, anon;
grant execute on function public.salvar_fluxo(uuid, int, jsonb, jsonb), public.pegar_trava(uuid), public.soltar_trava(uuid), public.marcar_versao(uuid, text) to authenticated;
