# Journey

O fluxo de atendimento como um encanamento: dá play numa entrada e a água anda pelos canos. Serve pra entender e explicar um fluxo, testar cenários ("e se…") sem ligar pra central e encontrar problemas sozinho.

- Spec: [docs/superpowers/specs/2026-11-12-journey-design.md](docs/superpowers/specs/2026-11-12-journey-design.md)
- `packages/nucleo`: formato, importação, modelos, motor e diagnóstico, sem tela ([README](packages/nucleo/README.md))
- `apps/web`: o app (Next.js + Supabase) ([README](apps/web/README.md))
- `supabase/`: migração, regras de acesso e testes do banco

## Rodar

```bash
npm install
npm run banco      # Supabase local (Docker)
cp apps/web/.env.example apps/web/.env.local
npm run dev        # http://127.0.0.1:3000
```

Testes: `npm test`, `npm run banco:testes`, `npm run e2e`, `npm run typecheck` e `npm run build` (detalhes no [README do app](apps/web/README.md)).

## Publicar

Uma vez, com as contas da empresa:

1. **Supabase:** criar o projeto (região São Paulo). Em Authentication → URL Configuration, pôr a URL do app em Site URL e `https://<app>/auth/callback` em Redirect URLs. Em Authentication → Providers → Email, deixar **Confirm email** ligado: o convite só vale pra e-mail confirmado, e sem a confirmação alguém entraria com o e-mail de outra pessoa. Pra entrar com Google, ligar o provedor Google com o cliente OAuth da empresa.
2. **Banco:** `npx supabase link --project-ref <ref>` e `npx supabase db push` (aplica `supabase/migrations`).
3. **Vercel:** importar o repositório com Root Directory `apps/web`. Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (do projeto), `APP_URL` com a URL pública do app (ex.: `https://journey.exemplo.com`; os redirecionamentos usam ela, e sem ela o app confia nos cabeçalhos do pedido) e, se o Google estiver ligado, `NEXT_PUBLIC_LOGIN_GOOGLE=sim`.
4. Entrar, criar a empresa e importar a planilha da central (até 4 MB somando os arquivos: a Vercel corta o corpo do pedido em 4,5 MB).
