# Journey

O fluxo de atendimento, de qualquer canal, como um encanamento: desenha o fluxo, dá play e a água anda pelos canos. Serve pra desenhar, entender e explicar um fluxo, testar cenários ("e se…") e encontrar problemas sozinho. White label: cada empresa tem os seus fluxos, cadastros e canais.

- Spec: [v2, o editor no centro](docs/superpowers/specs/2026-11-13-journey-v2-editor.md) (substitui a [v1](docs/superpowers/specs/2026-11-12-journey-design.md))
- `packages/fluxo`: o modelo genérico da v2 (documento, motor, diagnóstico e modelos), sem tela ([README](packages/fluxo/README.md))
- `packages/nucleo`: formato, importação, modelos, motor e diagnóstico, de telefonia, sem tela; na v2 vira o importador de central ([README](packages/nucleo/README.md))
- `apps/web`: o app (Next.js + Supabase): fluxos, editor, cadastros ([README](apps/web/README.md))
- `supabase/`: migração, regras de acesso e testes do banco

## Rodar

```bash
npm install
npm run banco      # Supabase local (Docker)
cp apps/web/.env.example apps/web/.env.local
sed -i "s|^SUPABASE_SECRET_KEY=.*|SUPABASE_SECRET_KEY=$(npx supabase status -o json | node -pe 'JSON.parse(require("fs").readFileSync(0)).SECRET_KEY')|" apps/web/.env.local
npm run dev        # http://127.0.0.1:3000
```

Testes: `npm test`, `npm run banco:testes`, `npm run e2e`, `npm run typecheck` e `npm run build` (detalhes no [README do app](apps/web/README.md)).

## Publicar

Uma vez, com as contas da empresa:

1. **Supabase:** criar o projeto (região São Paulo). Em Authentication → URL Configuration, pôr o domínio de produção do app em Site URL e `https://<domínio de produção>/auth/callback` em Redirect URLs. Em Authentication → Providers → Email, deixar **Confirm email** ligado: o convite só vale pra e-mail confirmado, e sem a confirmação alguém entraria com o e-mail de outra pessoa. Pra entrar com Google, ligar o provedor Google com o cliente OAuth da empresa.
2. **E-mail do login:** em Authentication → SMTP Settings, ligar o SMTP próprio (ex.: o SMTP relay do Google Workspace da empresa, `smtp-relay.gmail.com`, com o remetente de um domínio dela) e, em Authentication → Rate Limits, subir o limite de e-mails por hora. O carteiro que vem com o Supabase só entrega pra quem é da equipe do projeto e manda pouquíssimos e-mails por hora: sem SMTP próprio, o link mágico não chega pra ninguém de fora.
3. **Banco:** `npx supabase link --project-ref <ref>` e `npx supabase db push` (aplica `supabase/migrations`).
4. **Vercel:** importar o repositório com Root Directory `apps/web`. Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (do projeto), `SUPABASE_SECRET_KEY` (a secret key do projeto, em Project Settings → API Keys; marcada como Sensitive, sem `NEXT_PUBLIC_`: os links públicos precisam dela no servidor) e, se o Google estiver ligado, `NEXT_PUBLIC_LOGIN_GOOGLE=sim`. `APP_URL` vai **só no ambiente Production**, com o domínio de produção (ex.: `https://journey.exemplo.com`), e o app passa a ser usado só por esse domínio: os redirecionamentos e a conferência do Sair usam ela, então num preview com a `APP_URL` de produção o login voltaria pra produção e o Sair recusaria o pedido. Sem `APP_URL` (os previews), o app confia nos cabeçalhos do pedido. Crie e compartilhe os links públicos pelo domínio de produção: o endereço do link usa o endereço em que o membro está, e um link criado num preview aponta pro preview (que a proteção da Vercel pode fechar pra quem não tem conta).
5. **Previews (se quiser entrar neles):** pôr também `https://*-<time>.vercel.app/**` em Redirect URLs no Supabase; sem isso o link mágico de um preview cai na Site URL.
6. Entrar, criar a empresa e importar a planilha da central (até 4 MB somando os arquivos: a Vercel corta o corpo do pedido em 4,5 MB; mais que isso pede upload direto pro Storage, que fica pra depois).

A cada etapa nova que traz migração, rode `npx supabase db push` **antes** de publicar o app na Vercel: o app novo lê tabelas novas e, sem a migração, a página da jornada dá erro.
