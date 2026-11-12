# @journey/web

O app de simulação do Journey (etapa 2): login por link mágico, empresa e convites, import com revisão, catálogo com "onde é usado", mapa em encanamento com a água animada, cenários "E se…", diagnóstico e ramais diretos.
A lógica vem do `@journey/nucleo`; aqui fica a tela, o banco (Supabase) e o que liga os dois.

## Rodar

Precisa de Docker (pro Supabase local) e Node 22.

```bash
npm install
npm run banco                       # sobe o Supabase local e aplica supabase/migrations
cp apps/web/.env.example apps/web/.env.local
npm run dev                         # http://127.0.0.1:3000
```

O link mágico chega no Mailpit local: http://127.0.0.1:54324. Abre o app em `127.0.0.1`, não em `localhost`: sem `APP_URL`, o link volta pro endereço do pedido e a sessão é por endereço.

## Testes

```bash
npm test                 # unitários do núcleo e do app; os de banco rodam se o Supabase local estiver no ar
npm run banco:testes     # regras de acesso e funções do banco (pgTAP)
npm run e2e              # ponta a ponta (Playwright), com o Supabase local no ar
npm run typecheck
npm run build
```

`CAPTURAS=<pasta> npm run e2e -- e2e/capturas.spec.ts` tira capturas das telas principais (revisão, mapa, decisão, diagnóstico, celular e escuro). Sem `CAPTURAS`, o teste fica pulado.

## Partes

| Pasta | O que faz |
|---|---|
| `src/mapa` | `montarMapa`: o documento vira árvore da esquerda pra direita (o algoritmo do protótipo), com atalhos, faixas por regime de horário e canos que seguem o motor |
| `src/simulacao` | Sessão (refazer as escolhas = mesma execução), passos da animação, estado visual, textos da linha do tempo, comparação com o resultado aprovado e `vinculo` (se a tela ainda é o caminho de um cenário) |
| `src/diagnostico` | `cenarioAte`: o caminho de uma entrada até o ponto de um achado (o "Simular"); `pontosComAgenda`: as regras de horário que as entradas encontram primeiro, passando por áudios de saída única |
| `src/importacao` | Jornadas por canal, refs usadas, revisão, relatório e o teto de 4 MB |
| `src/lib` | Clientes do Supabase, leituras do servidor (`dados.ts`), origem do app, mensagens de erro, fuso |
| `src/acoes` | Server actions: import, cenários, intencionais, convites, empresa |
| `src/componentes` | Mapa em React Flow (peças e canos), player, cartão da decisão, painéis |
| `src/app` | Rotas |
| `supabase/` (na raiz) | Migração, regras de acesso (RLS) e testes pgTAP |

## Decisões

- **A tela importa o núcleo só pelos subcaminhos** (`@journey/nucleo/formato`, `/motor`, `/diagnostico`). A raiz reexporta `importacao` e `modelos`, que puxam o exceljs (~1 MB) pro navegador. O teste `test/cliente-sem-exceljs.test.ts` barra a raiz, `importacao` e `modelos` em `src/componentes`, `src/mapa`, `src/simulacao` e `src/diagnostico`; depois do build, `grep -rl ExcelJS apps/web/.next/static` tem que vir vazio. O servidor (páginas, `acoes`, `lib`, `importacao`) pode importar a raiz.
- **A tela nunca grava no catálogo nem nas versões:** só a função `confirmar_import` (security definer) troca o catálogo e cria versões. O catálogo guarda as colunas do formato em `dados` (jsonb), então coluna nova no formato não pede migração.
- **`confirmar_import` só aceita documento `journey/1`:** `formato` certo e as 8 listas (entradas, horários, feriados, ramais, filas, grupos, peças, saídas). Com outra forma a jornada não abriria. O conteúdo de cada lista é conferido pelo app.
- **Uma jornada por canal das entradas**, criada no primeiro import; cada import confirmado cria uma versão nova em cada uma. Cada jornada leva só as entradas do seu canal, mas o "não recebe ligação" olha o documento inteiro: o que só o outro canal alcança não aparece como órfão.
- **A lista de jornadas vem da view `jornadas_resumo`** (`security_invoker`, vale a RLS de quem pergunta): a última versão de cada jornada e os graves contados no banco, sem trazer o diagnóstico de todas as versões.
- **Intencional mostra quem marcou** (spec 12.4): o `autor` vira o e-mail pelos membros da empresa; quem saiu (ou foi apagado) aparece como "alguém que saiu".
- **Tempo de toque vem do núcleo** (`toqueDoRamal`, `toqueDoGrupo`): o painel de ramais mostra o mesmo tempo que o motor usa (siga-me completo = só o ramal + com a lista; senão `toque_s` ou 20 s).
- **Convite só vale pra e-mail confirmado** (`email_confirmado()` lê `auth.users`, não o token) e o Supabase fica com `enable_confirmations = true`. Sem isso, alguém criaria conta com o e-mail de outra pessoa e entraria na empresa dela.
- **Chaves estrangeiras compostas por empresa:** tabela filha liga o pai pela dupla `(id, empresa_id)`, então uma linha nunca aponta pra linha de outra empresa. Quem criou fica `null` se a pessoa for apagada.
- **Membro só muda algumas colunas:** em `imports`, `status` e `arquivos` (descartar o rascunho); em `empresas`, `nome`; em `achados_intencionais`, as quatro que o upsert manda (`empresa_id`, `jornada_id`, `chave`, `nota`). O resto não se reescreve pela API.
- **Arquivos originais no Storage**, bucket `imports` privado, só `application/octet-stream` e até 4 MB: o arquivo nunca volta como página que o navegador roda.
- **Upload até 4 MB somando os arquivos.** A Vercel corta o corpo de uma função em 4,5 MB, então mais que isso não chegaria no servidor. O formulário avisa antes de enviar e o servidor confere de novo; o proxy (`proxyClientMaxBodySize`) e a server action (`bodySizeLimit`) aceitam 5 MB, a folga das bordas do multipart. Planilha maior pede upload direto do navegador pro Storage (URL assinada), que fica pra depois.
- **`APP_URL` em produção:** os redirecionamentos e a conferência do Origin (no Sair) usam ela. Sem ela o app cai nos cabeçalhos do pedido (`X-Forwarded-*`, `Host`), que o cliente forja; serve só no desenvolvimento.
- **Sair só neste aparelho** (`scope: 'local'`): as outras sessões da pessoa continuam.
- **O mapa já é React Flow** (só leitura nesta etapa): a etapa 4 liga a edição nas mesmas peças e canos.
- **Mapa leve:** os nós e canos dependem só do mapa e ficam guardados enquanto a versão é a mesma; o holofote e o passo da água viram classe nos elementos de dentro (`NoPonto`, `Cano`), e o contexto se divide em ações estáveis e vista por passo. Dar um passo não recria os nós.
- **Pontas (fim, celular externo, destino que não existe) se repetem** onde aparecem; os outros pontos aparecem uma vez e a segunda chegada vira atalho ("segue em" ou "volta pra").
- **Cenário aberto só enquanto o caminho é o dele** (`vinculo.ts`): mesma entrada, hora e modo, e as escolhas são o começo das dele. Outra escolha solta o cenário e o fim oferece salvar de novo. Aprovar grava o caminho inteiro (entrada, hora, modo e escolhas) junto com o esperado. A comparação com o aprovado aparece no fim e também no cartão da decisão e no "Fora deste mapa" (quando a água sai pra um ponto que não está neste mapa).
- **A decisão é um cartão** (região "Decisão", com a pergunta em `aria-live`), não um balão no nó: no computador fica por cima do mapa, no celular embaixo dele. Os chips nos canos que o motor usa também escolhem.

## Risco aceito

Qualquer membro pode chamar o banco direto (PostgREST e as funções RPC) e gravar um import ou uma versão com o conteúdo que quiser, desde que tenha a forma `journey/1`. O app confere o conteúdo; o banco só a forma.

Hoje isso é aceitável porque todo membro é editor: quem pode fazer isso pela API já pode pela tela. Quando existir um papel só de leitura (etapa seguinte), o import tem que passar a ser só do servidor: tirar de `authenticated` o insert direto em `imports` e o `execute` de `confirmar_import`, e gravar pelo servidor com a conferência dele.

## Gotchas

- **O pedido do link mágico sai do navegador:** o código do PKCE fica num cookie dele, e o `/auth/callback` troca o código pela sessão. Pedido por server action, o cookie não chega e o login volta pra tela de entrar.
- **Sem `APP_URL`, o redirecionamento usa o host do pedido** (`origemDe`): no `next dev`, `request.url` vem como `localhost` mesmo com o navegador em `127.0.0.1`, e a sessão (cookie por host) se perde.
- **jsonb reordena as chaves:** comparar o resultado guardado de um cenário com o de agora é por valor (`comparar`), não por texto, senão todo cenário aparece como "mudou".
- **Next 16: `proxyClientMaxBodySize` é 10 MB por padrão.** Com o `proxy.ts` no meio, o corpo maior é cortado em silêncio e o import chega quebrado; por isso está em 5 MB no `next.config.ts` (um pouco acima do teto de 4 MB).
- **Upsert do PostgREST pede UPDATE em toda coluna que ele manda:** o `on conflict do update set` leva todas, e sem permissão em uma delas até o primeiro upsert falha. Por isso as quatro colunas em `achados_intencionais`.
- **O Supabase devolve no máximo 1000 linhas por pedido** (`max_rows = 1000`): o catálogo vem em páginas com `.range()` e a contagem por aba é feita no banco.

## Publicar

Supabase (projeto novo) + Vercel. Passos no README da raiz do repositório, seção "Publicar".
