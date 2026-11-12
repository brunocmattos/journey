-- Journey, etapa 2: empresas, membros, imports, catálogo, jornadas, versões, cenários e achados intencionais.
-- Toda tabela com dado de empresa tem empresa_id e só libera membros daquela empresa (RLS).
-- O catálogo e as versões só mudam pela função confirmar_import: a tela nunca grava direto neles.
-- Tabela filha liga o pai pela dupla (id, empresa_id): assim não aponta pra linha de outra empresa.
-- Quem criou ou escreveu (auth.users) fica null se a pessoa for apagada: apagar gente não trava.

create extension if not exists pgcrypto with schema extensions;

-- Empresas e membros ---------------------------------------------------------

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 1 and 120),
  criada_em timestamptz not null default now(),
  criada_por uuid references auth.users (id) on delete set null
);

create table public.membros (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  entrou_em timestamptz not null default now(),
  primary key (empresa_id, usuario_id)
);
create index membros_usuario on public.membros (usuario_id);

create table public.convites (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  convidado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  primary key (empresa_id, email)
);

-- security definer: a checagem não pode depender da própria regra de acesso de membros (recursão).
create function public.eh_membro(e uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros m where m.empresa_id = e and m.usuario_id = auth.uid());
$$;

-- O e-mail de quem está logado, só se já foi confirmado. Lido de auth.users, não do token: o "email"
-- do token pode ser de uma conta criada com o e-mail de outra pessoa e nunca confirmada.
-- security definer: quem está logado não lê auth.users.
create function public.email_confirmado() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

alter table public.empresas enable row level security;
alter table public.membros enable row level security;
alter table public.convites enable row level security;

create policy "membro vê a empresa" on public.empresas for select to authenticated using (public.eh_membro(id));
create policy "membro renomeia a empresa" on public.empresas for update to authenticated using (public.eh_membro(id)) with check (public.eh_membro(id));
-- Da empresa, só o nome muda.
revoke update on public.empresas from anon, authenticated;
grant update (nome) on public.empresas to authenticated;
create policy "membro vê os membros" on public.membros for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro vê os convites" on public.convites for select to authenticated using (public.eh_membro(empresa_id) or email = public.email_confirmado());
create policy "membro convida" on public.convites for insert to authenticated with check (public.eh_membro(empresa_id) and convidado_por = auth.uid());
create policy "membro desfaz convite" on public.convites for delete to authenticated using (public.eh_membro(empresa_id));

-- Cria a empresa e põe quem criou como membro. Devolve o id.
create function public.criar_empresa(p_nome text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  -- Só pra mostrar na lista de membros: aqui vale o e-mail do token se ainda não houver confirmado.
  v_email text := coalesce(public.email_confirmado(), lower(nullif(auth.jwt() ->> 'email', '')));
begin
  if auth.uid() is null then raise exception 'sem sessão' using errcode = '28000'; end if;
  insert into public.empresas (nome, criada_por) values (btrim(p_nome), auth.uid()) returning id into v_id;
  insert into public.membros (empresa_id, usuario_id, email) values (v_id, auth.uid(), coalesce(v_email, ''));
  return v_id;
end;
$$;

-- Aceita todos os convites do e-mail confirmado de quem está logado. Devolve as empresas em que entrou.
create function public.aceitar_convites() returns setof uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := public.email_confirmado();
begin
  if auth.uid() is null or v_email is null then return; end if;
  return query
    with aceitos as (
      delete from public.convites c where c.email = v_email returning c.empresa_id
    ), novos as (
      insert into public.membros (empresa_id, usuario_id, email)
      select a.empresa_id, auth.uid(), v_email from aceitos a
      on conflict do nothing
      returning empresa_id
    )
    select empresa_id from novos;
end;
$$;

-- Imports --------------------------------------------------------------------

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  status text not null default 'revisao' check (status in ('revisao', 'confirmado', 'descartado')),
  parcial boolean not null default false,
  -- Último import confirmado quando este foi analisado. Confirmar exige que ele ainda seja o último.
  anterior_id uuid,
  -- [{ nome, tamanho, caminho }]: caminho no bucket "imports".
  arquivos jsonb not null default '[]',
  -- Problemas, diferenças e contagens, como a tela de revisão mostra.
  relatorio jsonb not null,
  -- O que a central diz (base) e a base mais os ajustes (efetivo). Na etapa 2 não há ajustes: são iguais.
  base jsonb not null,
  efetivo jsonb not null,
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  confirmado_por uuid references auth.users (id) on delete set null,
  confirmado_em timestamptz,
  unique (id, empresa_id),
  foreign key (anterior_id, empresa_id) references public.imports (id, empresa_id)
);
create index imports_empresa on public.imports (empresa_id, criado_em desc);
create index imports_anterior on public.imports (anterior_id);
create unique index imports_um_rascunho_por_vez on public.imports (empresa_id) where status = 'revisao';

alter table public.imports enable row level security;
create policy "membro vê os imports" on public.imports for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro analisa um import" on public.imports for insert to authenticated
  with check (public.eh_membro(empresa_id) and status = 'revisao' and criado_por = auth.uid());
create policy "membro descarta o rascunho" on public.imports for update to authenticated
  using (public.eh_membro(empresa_id) and status = 'revisao')
  with check (public.eh_membro(empresa_id) and status in ('revisao', 'descartado'));
-- O app só descarta (status) e anota onde guardou os arquivos; o resto do rascunho não se reescreve.
revoke update on public.imports from anon, authenticated;
grant update (status, arquivos) on public.imports to authenticated;
create policy "membro apaga o rascunho" on public.imports for delete to authenticated
  using (public.eh_membro(empresa_id) and status = 'revisao');

-- Catálogo efetivo -----------------------------------------------------------
-- Uma linha por item das abas do catálogo. As colunas do formato ficam em `dados` (jsonb), pra o
-- formato poder ganhar colunas (etapa 6) sem migração. Membros de filas e grupos ficam numa tabela
-- própria, pra responder "onde é usado" com índice.

create table public.catalogo (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  aba text not null check (aba in ('entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos')),
  item_id text not null,
  nome text,
  dados jsonb not null,
  import_id uuid not null,
  primary key (empresa_id, aba, item_id),
  foreign key (import_id, empresa_id) references public.imports (id, empresa_id)
);
create index catalogo_import on public.catalogo (import_id);

create table public.catalogo_membros (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  aba text not null check (aba in ('filas', 'grupos')),
  item_id text not null,
  membro text not null,
  primary key (empresa_id, aba, item_id, membro)
);
create index catalogo_membros_membro on public.catalogo_membros (empresa_id, membro);

alter table public.catalogo enable row level security;
alter table public.catalogo_membros enable row level security;
create policy "membro vê o catálogo" on public.catalogo for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro vê os membros do catálogo" on public.catalogo_membros for select to authenticated using (public.eh_membro(empresa_id));

-- Jornadas e versões ---------------------------------------------------------

create table public.jornadas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  canal text not null,
  -- null: todas as entradas do canal. Lista: só essas (jornadas menores, depois da etapa 2).
  entradas text[],
  criada_em timestamptz not null default now(),
  unique (empresa_id, nome),
  unique (id, empresa_id)
);

create table public.jornada_versoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  jornada_id uuid not null,
  numero int not null check (numero > 0),
  documento jsonb not null,
  diagnostico jsonb not null,
  origem text not null check (origem in ('import', 'edicao', 'restauracao')),
  import_id uuid,
  autor uuid references auth.users (id) on delete set null,
  criada_em timestamptz not null default now(),
  unique (jornada_id, numero),
  unique (id, empresa_id),
  foreign key (jornada_id, empresa_id) references public.jornadas (id, empresa_id) on delete cascade,
  foreign key (import_id, empresa_id) references public.imports (id, empresa_id)
);
create index jornada_versoes_import on public.jornada_versoes (import_id);

create table public.jornada_refs (
  versao_id uuid not null,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  ref text not null,
  primary key (versao_id, ref),
  foreign key (versao_id, empresa_id) references public.jornada_versoes (id, empresa_id) on delete cascade
);
create index jornada_refs_ref on public.jornada_refs (empresa_id, ref);

alter table public.jornadas enable row level security;
alter table public.jornada_versoes enable row level security;
alter table public.jornada_refs enable row level security;
create policy "membro vê as jornadas" on public.jornadas for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro vê as versões" on public.jornada_versoes for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro vê as refs" on public.jornada_refs for select to authenticated using (public.eh_membro(empresa_id));

-- Confirma um import em revisão: troca o catálogo e grava uma versão nova em cada jornada.
-- p_jornadas: [{ nome, canal, documento, diagnostico, refs: [..] }], calculado pelo servidor do app.
-- Jornada que já existe (mesmo nome) ganha versão nova; jornada nova é criada.
create function public.confirmar_import(p_import uuid, p_jornadas jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_imp public.imports%rowtype;
  v_ultimo uuid;
  v_j jsonb;
  v_jornada uuid;
  v_versao uuid;
  v_numero int;
  v_aba text;
begin
  select * into v_imp from public.imports where id = p_import for update;
  if not found or not public.eh_membro(v_imp.empresa_id) then
    raise exception 'import não encontrado' using errcode = 'P0002';
  end if;
  if v_imp.status <> 'revisao' then
    raise exception 'este import já foi %', v_imp.status using errcode = 'P0001';
  end if;
  select id into v_ultimo from public.imports
    where empresa_id = v_imp.empresa_id and status = 'confirmado'
    order by confirmado_em desc limit 1;
  if v_ultimo is distinct from v_imp.anterior_id then
    raise exception 'outro import foi confirmado depois desta análise: analise de novo' using errcode = 'P0001';
  end if;
  if p_jornadas is null or jsonb_typeof(p_jornadas) <> 'array' then
    raise exception 'p_jornadas precisa ser uma lista' using errcode = '22023';
  end if;
  -- Nome repetido viraria duas versões seguidas da mesma jornada.
  if exists (select 1 from jsonb_array_elements(p_jornadas) j group by j ->> 'nome' having count(*) > 1) then
    raise exception 'p_jornadas tem nome de jornada repetido' using errcode = '22023';
  end if;

  -- Catálogo: troca tudo pelo efetivo do import.
  delete from public.catalogo where empresa_id = v_imp.empresa_id;
  delete from public.catalogo_membros where empresa_id = v_imp.empresa_id;
  foreach v_aba in array array['entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos'] loop
    insert into public.catalogo (empresa_id, aba, item_id, nome, dados, import_id)
    select v_imp.empresa_id, v_aba, item ->> 'id', item ->> 'nome', item, v_imp.id
    from jsonb_array_elements(coalesce(v_imp.efetivo -> v_aba, '[]')) item;
  end loop;
  insert into public.catalogo_membros (empresa_id, aba, item_id, membro)
  select distinct v_imp.empresa_id, a.aba, item ->> 'id', m.membro
  from (values ('filas'), ('grupos')) a (aba)
  cross join lateral jsonb_array_elements(coalesce(v_imp.efetivo -> a.aba, '[]')) item
  cross join lateral jsonb_array_elements_text(coalesce(item -> 'membros', '[]')) m (membro);

  -- Jornadas e versões.
  for v_j in select * from jsonb_array_elements(p_jornadas) loop
    insert into public.jornadas (empresa_id, nome, canal)
    values (v_imp.empresa_id, v_j ->> 'nome', v_j ->> 'canal')
    on conflict (empresa_id, nome) do update set canal = excluded.canal
    returning id into v_jornada;
    select coalesce(max(numero), 0) + 1 into v_numero from public.jornada_versoes where jornada_id = v_jornada;
    insert into public.jornada_versoes (empresa_id, jornada_id, numero, documento, diagnostico, origem, import_id, autor)
    values (v_imp.empresa_id, v_jornada, v_numero, v_j -> 'documento', coalesce(v_j -> 'diagnostico', '[]'), 'import', v_imp.id, auth.uid())
    returning id into v_versao;
    insert into public.jornada_refs (versao_id, empresa_id, ref)
    select distinct v_versao, v_imp.empresa_id, r from jsonb_array_elements_text(coalesce(v_j -> 'refs', '[]')) r;
  end loop;

  update public.imports set status = 'confirmado', confirmado_por = auth.uid(), confirmado_em = now() where id = p_import;
end;
$$;

-- Onde uma referência é usada: itens do catálogo que a citam (em qualquer coluna, inclusive listas)
-- e jornadas cuja versão mais recente a usa. Genérico: não conhece as colunas do formato.
create function public.onde_usado(p_empresa uuid, p_ref text)
returns table (tipo text, aba text, item_id text, nome text, campos text[])
language sql stable security invoker set search_path = '' as $$
  select 'catalogo', c.aba, c.item_id, c.nome, array_agg(d.key order by d.key)
  from public.catalogo c
  cross join lateral jsonb_each(c.dados) d
  where c.empresa_id = p_empresa
    and (d.value = to_jsonb(p_ref) or (jsonb_typeof(d.value) = 'array' and d.value ? p_ref))
  group by c.aba, c.item_id, c.nome
  union all
  select 'jornada', null, j.id::text, j.nome, null
  from public.jornadas j
  join lateral (
    select v.id from public.jornada_versoes v where v.jornada_id = j.id order by v.numero desc limit 1
  ) ultima on true
  where j.empresa_id = p_empresa
    and exists (select 1 from public.jornada_refs r where r.versao_id = ultima.id and r.ref = p_ref)
  order by 1, 2, 3;
$$;

-- Cenários e achados intencionais ---------------------------------------------

create table public.cenarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  jornada_id uuid not null,
  nome text not null check (length(btrim(nome)) between 1 and 200),
  -- Por onde entra: entrada:…, ou ramal:… no modo "ninguém atende".
  entrada text not null,
  -- Hora de parede simulada, AAAA-MM-DDTHH:MM.
  inicio text not null check (inicio ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  modo text not null default 'cenario' check (modo in ('cenario', 'livre', 'ninguem_atende')),
  -- As escolhas, em ordem: ['saida:fase-16-tecla-1', 'atende', …]. A execução refaz uma por uma.
  escolhas jsonb not null default '[]' check (jsonb_typeof(escolhas) = 'array'),
  -- Eventos da última execução aprovada.
  esperado jsonb not null check (jsonb_typeof(esperado) = 'array'),
  -- Versão da jornada em que o resultado foi aprovado.
  versao_aprovada int not null,
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (jornada_id, empresa_id) references public.jornadas (id, empresa_id) on delete cascade
);
create index cenarios_jornada on public.cenarios (jornada_id, nome);
create index cenarios_empresa on public.cenarios (empresa_id);

create table public.achados_intencionais (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  jornada_id uuid not null,
  chave text not null,
  nota text not null default '',
  autor uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  primary key (jornada_id, chave),
  foreign key (jornada_id, empresa_id) references public.jornadas (id, empresa_id) on delete cascade
);

alter table public.cenarios enable row level security;
alter table public.achados_intencionais enable row level security;
create policy "membro vê os cenários" on public.cenarios for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria cenário" on public.cenarios for insert to authenticated with check (public.eh_membro(empresa_id) and criado_por = auth.uid());
create policy "membro muda cenário" on public.cenarios for update to authenticated using (public.eh_membro(empresa_id)) with check (public.eh_membro(empresa_id));
create policy "membro apaga cenário" on public.cenarios for delete to authenticated using (public.eh_membro(empresa_id));
create policy "membro vê os intencionais" on public.achados_intencionais for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro marca intencional" on public.achados_intencionais for insert to authenticated with check (public.eh_membro(empresa_id) and autor = auth.uid());
create policy "membro muda a nota do intencional" on public.achados_intencionais for update to authenticated
  using (public.eh_membro(empresa_id)) with check (public.eh_membro(empresa_id));
create policy "membro desmarca intencional" on public.achados_intencionais for delete to authenticated using (public.eh_membro(empresa_id));
-- Marcar de novo (upsert) troca a nota. As quatro colunas porque o upsert do PostgREST põe no
-- "do update set" toda coluna enviada, e sem permissão em alguma delas até o primeiro upsert falha.
-- A regra e a FK composta seguram a empresa; autor e criado_em ficam como estão.
revoke update on public.achados_intencionais from anon, authenticated;
grant update (empresa_id, jornada_id, chave, nota) on public.achados_intencionais to authenticated;

-- Arquivos importados (Storage, privado) -------------------------------------
-- Caminho: <empresa_id>/<import_id>/<nome do arquivo>.

-- A primeira pasta do caminho, se for um uuid; senão null (e ninguém é membro de null).
create function public.empresa_do_caminho(p_nome text) returns uuid
language sql immutable set search_path = '' as $$
  select case when split_part(p_nome, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_nome, '/', 1)::uuid end;
$$;

-- 20 MB por arquivo: o app já recusa mais que isso somando todos.
insert into storage.buckets (id, name, public, file_size_limit) values ('imports', 'imports', false, 20971520)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

create policy "membro lê arquivos de import" on storage.objects for select to authenticated
  using (bucket_id = 'imports' and public.eh_membro(public.empresa_do_caminho(name)));
create policy "membro envia arquivos de import" on storage.objects for insert to authenticated
  with check (bucket_id = 'imports' and public.eh_membro(public.empresa_do_caminho(name)));

-- Funções: só usuário logado chama.
revoke execute on function public.email_confirmado() from public, anon;
grant execute on function public.email_confirmado() to authenticated;
revoke execute on function public.criar_empresa(text) from public, anon;
revoke execute on function public.aceitar_convites() from public, anon;
revoke execute on function public.confirmar_import(uuid, jsonb) from public, anon;
revoke execute on function public.onde_usado(uuid, text) from public, anon;
grant execute on function public.criar_empresa(text) to authenticated;
grant execute on function public.aceitar_convites() to authenticated;
grant execute on function public.confirmar_import(uuid, jsonb) to authenticated;
grant execute on function public.onde_usado(uuid, text) to authenticated;

-- TRUNCATE passa por cima das regras de acesso; TRIGGER e REFERENCES não servem pra tela.
revoke truncate, trigger, references on
  public.empresas, public.membros, public.convites, public.imports, public.catalogo, public.catalogo_membros,
  public.jornadas, public.jornada_versoes, public.jornada_refs, public.cenarios, public.achados_intencionais
from anon, authenticated;
