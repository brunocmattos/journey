# Journey

O fluxo de atendimento, de qualquer canal, como um encanamento: desenha o fluxo, dá play e a água anda pelos canos. Serve pra desenhar, entender e explicar um fluxo, testar cenários ("e se…") e encontrar problemas sozinho. White label: cada empresa tem os seus fluxos, cadastros e canais.

Hoje (etapa C da v2): a empresa cria fluxos em branco ou a partir de um modelo, desenha no editor, dá play, salva cenários, marca versões, vê o diagnóstico ao vivo e manda um link público só de leitura, com um cenário que toca sozinho e os nomes das pessoas escondidos.

- Spec: [v2, o editor no centro](docs/superpowers/specs/2026-11-13-journey-v2-editor.md) (substitui a [v1](docs/superpowers/specs/2026-11-12-journey-design.md))
- `packages/fluxo`: o modelo genérico da v2 (documento, motor, diagnóstico e modelos), sem tela ([README](packages/fluxo/README.md))
- `packages/nucleo`: o formato e a leitura da planilha da central (v1), de telefonia, sem tela. O app não usa: fica no repositório pro importador de central (etapa E) ([README](packages/nucleo/README.md))
- `apps/web`: o app (Next.js + Supabase): fluxos, editor, cadastros, cenários, versões, diagnóstico e link público ([README](apps/web/README.md))
- `supabase/`: migrações, regras de acesso e testes do banco (pgTAP)

## Rodar

```bash
npm install
npm run banco      # Supabase local (Docker)
cp apps/web/.env.example apps/web/.env.local
sed -i "s|^SUPABASE_SECRET_KEY=.*|SUPABASE_SECRET_KEY=$(npx supabase status -o json | node -pe 'JSON.parse(require("fs").readFileSync(0)).SECRET_KEY')|" apps/web/.env.local
npm run dev        # http://127.0.0.1:3000
```

Testes: `npm test` (541: fluxo 84, núcleo 253, app 204), `npm run banco:testes` (182), `npm run e2e` (25), `npm run typecheck` e `npm run build` (detalhes no [README do app](apps/web/README.md)).

## Publicar

Uma vez, com as contas da empresa:

1. **Supabase:** criar o projeto (região São Paulo). No painel (o nome antigo de cada tela entre parênteses):
   1. Authentication → URL Configuration: **Site URL** = o domínio de produção (`https://<domínio de produção>`; os links dos e-mails usam ela) e, em **Redirect URLs**, `https://<domínio de produção>/**` (a volta do Google, no `/auth/callback`).
   2. Authentication → Sign In / Providers → Email (antes: Authentication → Providers → Email):
      - **Confirm email** ligado: o convite só vale pra e-mail confirmado;
      - **Secure password change** desligado (o padrão): quem está logado troca a senha sem digitar a atual;
      - **Minimum password length** = **8** (o padrão é 6; o app já pede 8).
   3. Authentication → Emails → Templates (antes: Authentication → Email Templates): trocar três modelos pelos do repositório, que mandam o link pro `/auth/confirm` do app: uma página com um botão, que confirma no servidor (assim o link abre em qualquer navegador ou aparelho, e não só no que pediu, e o leitor de links do provedor de e-mail não gasta o link só de abrir). Em cada um, o assunto e o HTML do arquivo, inteiro:
      - **Confirm signup**: assunto `Confirma teu e-mail no Journey`, corpo `supabase/templates/confirmacao.html`;
      - **Magic Link**: assunto `Teu link pra entrar no Journey`, corpo `supabase/templates/link.html`;
      - **Reset Password**: assunto `Trocar a senha do Journey`, corpo `supabase/templates/recuperacao.html`.
      Os outros (Invite user, Change email address, Reauthentication) o app não usa. Com o app já no ar, troque os modelos logo depois de publicar a versão que tem o `/auth/confirm`.
   4. **Conferir que o cadastro direto pela API não conta quem tem conta:** com um e-mail que já tem conta confirmada, `curl -s -X POST https://<ref do projeto>.supabase.co/auth/v1/signup -H "apikey: <publishable key>" -H "content-type: application/json" -d '{"email":"<e-mail com conta>","password":"qualquer-coisa-123"}'`. Se a resposta for `user_already_exists` (no Supabase local é), a API conta quem tem conta. O app não usa esse cadastro (o "Criar conta" responde igual pra todo e-mail), então isso só aparece pra quem chama a API direto; anote como risco conhecido.
   5. **Cuidados no painel:** criar gente pelo painel (Authentication → Users → Add user) só com **Create new user** e **Auto Confirm User** marcado, se for dar uma senha: com "Send invitation" (Invite user) ou sem confirmar na hora, a senha posta pelo painel some quando a pessoa confirma o e-mail (a trigger da migração `20261116000000`), e ela escolhe outra pelo link ou em "Esqueci a senha". Trocar o e-mail de alguém pelo painel funciona; pela própria pessoa, não (o app não oferece, e o banco recusa).
2. **E-mail do login (SMTP):** o Supabase manda os e-mails de confirmar o cadastro, trocar a senha e do link de entrar. O carteiro que vem com ele só entrega pra quem é da equipe do projeto e manda pouquíssimos e-mails por hora (e recusa outro e-mail pro mesmo endereço em menos de 60 s): sem SMTP próprio, ninguém de fora consegue criar conta nem trocar a senha. Em Authentication → Emails → SMTP Settings (antes: Project Settings → Authentication → SMTP Settings), ligar **Enable custom SMTP**: host, porta, usuário e senha do provedor (ex.: o SMTP relay do Google Workspace da empresa, `smtp-relay.gmail.com`, porta 587), remetente com um endereço do domínio da empresa e nome `Journey`. Depois, em Authentication → Rate Limits, subir o limite de e-mails por hora (ex.: 100).
3. **Entrar com Google (opcional):**
   1. No Google Cloud Console da empresa, em Google Auth Platform (antes: APIs e serviços → Tela de permissão OAuth): em **Branding**, nome do app, e-mail de suporte e o domínio de produção em domínios autorizados; em **Audience**, tipo Externo, e **Publicar o app** (em teste, só entram os e-mails da lista de teste).
   2. Em **Clients** → Criar cliente (antes: APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth) → Aplicativo da Web. Em **Origens JavaScript autorizadas**, `https://<domínio de produção>`; em **URIs de redirecionamento autorizados**, `https://<ref do projeto>.supabase.co/auth/v1/callback` (a URL exata aparece no Supabase, no passo seguinte, como "Callback URL"). Guardar o ID do cliente e a chave secreta.
   3. No Supabase: Authentication → Sign In / Providers → Google (antes: Providers → Google) → ligar, colar o ID do cliente e a chave secreta, salvar.
   4. Na Vercel: `NEXT_PUBLIC_LOGIN_GOOGLE=sim` (e publicar de novo: a variável entra no build). Sem ela, o botão não aparece.
   5. **Só com o Google** (enquanto os e-mails não saem de um domínio próprio, o Hotmail e o Outlook descartam o que sai de um Gmail pessoal): na Vercel, `NEXT_PUBLIC_LOGIN_EMAIL=nao` e publicar de novo; no Supabase, desligar o provedor Email (Authentication → Sign In / Providers → Email), pra ninguém pedir e-mail pela API direto. Quem já tem conta com o mesmo e-mail do Google entra na mesma conta (o Supabase junta as duas).
4. **Banco:** aplicar os arquivos de `supabase/migrations` que faltam, na ordem dos nomes. O projeto de produção recebeu as etapas anteriores pelo `apply_migration` (o MCP do Supabase), que grava a versão com a data em que foi aplicada: o histórico de lá não bate com os nomes dos arquivos, então `npx supabase db push` tentaria reaplicar tudo. Use o `apply_migration` (ou o SQL Editor) arquivo por arquivo; pra passar a usar o `db push`, antes alinhe o histórico com `npx supabase migration repair`. A migração da etapa C (`20261115000000`) apaga as tabelas e o bucket da v1 e para sozinha se achar dado neles; rode-a antes uma vez dentro de `begin; … rollback;` (no SQL Editor) pra conferir. A `20261116000000` põe duas travas em `auth.users`: apaga a senha na hora em que o e-mail é confirmado, e recusa a troca de e-mail pedida pela própria pessoa. Sem elas, quem cadastrasse antes o e-mail de uma pessoa convidada (com uma senha dele), ou trocasse o e-mail da conta dele pro dela, entraria na conta e na empresa dela depois que ela clicasse no e-mail.
5. **Vercel:** importar o repositório com Root Directory `apps/web`. Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (do projeto), `SUPABASE_SECRET_KEY` (a secret key do projeto, em Project Settings → API Keys; marcada como Sensitive, sem `NEXT_PUBLIC_`: os links públicos precisam dela no servidor) e, se o Google estiver ligado, `NEXT_PUBLIC_LOGIN_GOOGLE=sim`. `APP_URL` vai **só no ambiente Production**, com o domínio de produção (ex.: `https://journey.exemplo.com`), e o app passa a ser usado só por esse domínio: os redirecionamentos e a conferência do Sair usam ela, então num preview com a `APP_URL` de produção o login voltaria pra produção e o Sair recusaria o pedido. Sem `APP_URL` (os previews), o app confia nos cabeçalhos do pedido. Crie e compartilhe os links públicos pelo domínio de produção: o endereço do link usa o endereço em que o membro está, e um link criado num preview aponta pro preview (que a proteção da Vercel pode fechar pra quem não tem conta).
6. **Previews (se quiser entrar neles):** com e-mail e senha, entra direto. Os links dos e-mails vão sempre pra Site URL (produção): "Esqueci a senha" pedido num preview troca a senha lá, e vale nos dois (o Supabase é o mesmo). Pro Google num preview, pôr também `https://*-<time>.vercel.app/**` em Redirect URLs.
7. Criar a conta (Criar conta, abrir o link do e-mail, escolher a senha), a empresa e o primeiro fluxo (em branco ou a partir de um modelo).

A cada etapa nova que traz migração, aplique a migração (passo 4) e publique o app na Vercel logo em seguida, nessa ordem: o app novo lê tabelas novas e, sem a migração, o editor dá erro; e o app velho lê tabelas que a migração nova apaga.
