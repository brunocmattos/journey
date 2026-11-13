-- Journey v2: a senha de quem cadastrou um e-mail antes da dona não sobrevive à confirmação.
--
-- O Supabase deixa qualquer um chamar o cadastro (/signup) com qualquer e-mail e uma senha. Enquanto o e-mail não
-- é confirmado essa senha não entra, mas quando a dona confirma (pelo cadastro dela, pelo link mágico ou pelo Google)
-- a conta passa a valer com a senha de quem chegou primeiro, e o convite da empresa põe essa conta pra dentro.
-- O Supabase não troca a senha num cadastro repetido ("não dá pra ter certeza de quem é"), então quem apaga é o banco:
-- na hora em que o e-mail é confirmado, a senha some, como a de quem só entrou por link (''). A senha da pessoa
-- ela escolhe depois, já com a sessão do link (/conta/senha).
--
-- Só na passagem de "não confirmado" pra "confirmado", e não pra conta que nasce confirmada (pelo painel ou pela API
-- de admin): o Supabase grava essa conta em duas etapas na mesma transação (insert e depois a confirmação), então a
-- conta criada nesta transação fica marcada e a senha dela fica. Quem já era confirmado troca a senha normalmente.

-- Sem security definer nas duas: só mexem na linha que está sendo gravada e numa configuração da transação.
create function public.conta_nasceu_agora() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Local (true): some no fim da transação, e outra transação nunca vê.
  perform set_config('journey.conta_nova', new.id::text, true);
  return null;
end;
$$;

create function public.senha_some_na_confirmacao() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('journey.conta_nova', true) is distinct from old.id::text then
    new.encrypted_password := '';
  end if;
  return new;
end;
$$;

-- Função de trigger não é pra ninguém chamar; a trigger dispara sem olhar essa permissão.
revoke all on function public.conta_nasceu_agora() from public, anon, authenticated;
revoke all on function public.senha_some_na_confirmacao() from public, anon, authenticated;

create trigger conta_nasceu_agora
  after insert on auth.users
  for each row
  execute function public.conta_nasceu_agora();

create trigger senha_some_na_confirmacao
  before update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.senha_some_na_confirmacao();

-- A troca de e-mail pelo próprio usuário (PUT /auth/v1/user com outro e-mail) fica recusada. O app não oferece, e ela
-- reabriria o mesmo buraco por outro lado: alguém logado pede pra trocar o e-mail dele pro da pessoa convidada, ela
-- clica no "confirme o novo e-mail" que chegou sem pedir, e a conta (com a senha dele) passa a ter o e-mail dela. Aqui a
-- trigger da senha não ajuda: o e-mail já era confirmado. O Supabase só grava email_change nesse pedido; o admin e o
-- painel trocam `email` direto e continuam podendo.
-- Antes da trigger, quem já tinha uma troca pendente fica sem ela: senão qualquer gravação do Supabase nessa conta que
-- leve email_change no SET (entrar, trocar a senha) cairia na trigger e daria erro. Vazio é o que o Supabase grava
-- quando a troca termina ou é cancelada.
update auth.users set email_change = '' where coalesce(email_change, '') <> '';

create function public.troca_de_email_recusada() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'trocar o e-mail da conta não é permitido no Journey' using errcode = 'P0001';
end;
$$;

revoke all on function public.troca_de_email_recusada() from public, anon, authenticated;

create trigger troca_de_email_recusada
  before update of email_change on auth.users
  for each row
  when (coalesce(new.email_change, '') <> '')
  execute function public.troca_de_email_recusada();
