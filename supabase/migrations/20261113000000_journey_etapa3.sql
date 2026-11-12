-- Journey, etapa 3: links públicos, só de leitura, de uma jornada.
-- O membro cria e revoga pelo app (com a sessão dele, sob a RLS). Quem abre o link não tem conta:
-- o servidor do app lê o link pela função abrir_link, que só a chave secreta (service_role) chama.
-- O navegador de quem abre nunca fala com o banco.

create table public.links (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  jornada_id uuid not null,
  -- 18 bytes aleatórios em base64 de URL: 24 caracteres, sem "=". Só o banco gera (a coluna não tem grant de insert).
  token text not null unique default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  -- null: sempre a versão mais recente. Número: a versão fixa.
  versao int,
  esconder_nomes boolean not null default true,
  -- Cenário inicial, copiado do cenário salvo quando o link foi criado: { nome, entrada, inicio, modo, escolhas }.
  -- Cópia, e não referência: o link continua mostrando o que foi mandado mesmo se o cenário mudar ou for apagado.
  cenario jsonb,
  -- null: sem prazo.
  expira_em timestamptz,
  revogado_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (id, empresa_id),
  foreign key (jornada_id, empresa_id) references public.jornadas (id, empresa_id) on delete cascade,
  -- Versão fixa tem que existir nesta jornada (com versao null, a chave não é conferida).
  foreign key (jornada_id, versao) references public.jornada_versoes (jornada_id, numero) on delete cascade,
  constraint links_validade check (expira_em is null or expira_em > criado_em),
  -- coalesce: com uma chave faltando, a comparação dá null, e null passaria no check.
  constraint links_cenario check (cenario is null or coalesce(
    jsonb_typeof(cenario) = 'object'
    and jsonb_typeof(cenario -> 'nome') = 'string'
    and length(btrim(cenario ->> 'nome')) between 1 and 200
    and jsonb_typeof(cenario -> 'entrada') = 'string'
    and (cenario ->> 'inicio') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
    and (cenario ->> 'modo') in ('cenario', 'livre', 'ninguem_atende')
    and jsonb_typeof(cenario -> 'escolhas') = 'array', false))
);
create index links_jornada on public.links (jornada_id, criado_em desc);
create index links_empresa on public.links (empresa_id);

alter table public.links enable row level security;
create policy "membro vê os links" on public.links for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria link" on public.links for insert to authenticated
  with check (public.eh_membro(empresa_id) and criado_por = auth.uid() and revogado_em is null);
-- Revogar é pra sempre: só muda link ainda não revogado, e só pra revogado.
create policy "membro revoga link" on public.links for update to authenticated
  using (public.eh_membro(empresa_id) and revogado_em is null)
  with check (public.eh_membro(empresa_id) and revogado_em is not null);

-- Na criação, o membro escolhe só as opções; token, autor e datas são do banco. Depois, só revoga,
-- e a data da revogação também é do banco (pelo trigger abaixo).
revoke all on public.links from anon;
revoke insert, update, delete, truncate, trigger, references on public.links from authenticated;
grant insert (empresa_id, jornada_id, versao, esconder_nomes, cenario, expira_em) on public.links to authenticated;
grant update (revogado_em) on public.links to authenticated;

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

-- O que o link mostra, pelo token. Devolve { estado } e, quando o link vale, a versão e as opções.
-- security invoker: quem chama é o servidor do app com a chave secreta (service_role, que passa pela RLS).
-- Nenhum outro papel executa: com o token na mão, ninguém lê pela API o que o servidor esconderia.
create function public.abrir_link(p_token text) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_link public.links%rowtype;
  v_jornada public.jornadas%rowtype;
  v_versao public.jornada_versoes%rowtype;
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
  select * into v_jornada from public.jornadas where id = v_link.jornada_id;
  if v_link.versao is null then
    select * into v_versao from public.jornada_versoes where jornada_id = v_link.jornada_id order by numero desc limit 1;
  else
    select * into v_versao from public.jornada_versoes where jornada_id = v_link.jornada_id and numero = v_link.versao;
  end if;
  if not found then
    return jsonb_build_object('estado', 'inexistente');
  end if;
  return jsonb_build_object(
    'estado', 'ok',
    'jornada', jsonb_build_object('nome', v_jornada.nome, 'canal', v_jornada.canal),
    'versao', jsonb_build_object(
      'numero', v_versao.numero,
      'criada_em', v_versao.criada_em,
      'documento', v_versao.documento,
      'diagnostico', v_versao.diagnostico),
    'mais_recente', v_link.versao is null,
    'esconder_nomes', v_link.esconder_nomes,
    'cenario', v_link.cenario,
    'expira_em', v_link.expira_em,
    -- Só chave e nota: quem marcou (autor) não sai daqui.
    'intencionais', coalesce((
      select jsonb_agg(jsonb_build_object('chave', i.chave, 'nota', i.nota) order by i.chave)
      from public.achados_intencionais i where i.jornada_id = v_link.jornada_id), '[]'::jsonb));
end;
$$;

revoke execute on function public.abrir_link(text) from public, anon, authenticated;
grant execute on function public.abrir_link(text) to service_role;
