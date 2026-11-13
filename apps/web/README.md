# @journey/web

O app do Journey (v2). A casa da empresa é a tela **Fluxos**: criar um fluxo em branco ou a partir de um modelo e desenhar no **editor** (peças, ligações com regra, grupos, notas, estilo da água), dar play e ver a água andar, com os **Cadastros** (pessoas, filas, equipes, sistemas, horários) nascendo do desenho. No editor também ficam o **diagnóstico** ao vivo, os **cenários** (caminhos salvos do play, conferidos a cada mudança), as **versões** marcadas e o **Compartilhar**, que cria o **link público** só de leitura (`/l/<token>`). A lógica do fluxo vem do `@journey/fluxo`.

## Rodar

Precisa de Docker (pro Supabase local) e Node 22.

```bash
npm install
npm run banco                       # sobe o Supabase local e aplica supabase/migrations
cp apps/web/.env.example apps/web/.env.local
sed -i "s|^SUPABASE_SECRET_KEY=.*|SUPABASE_SECRET_KEY=$(npx supabase status -o json | node -pe 'JSON.parse(require("fs").readFileSync(0)).SECRET_KEY')|" apps/web/.env.local
npm run dev                         # http://127.0.0.1:3000
```

Os e-mails do login (confirmação, link, recuperação) chegam no Mailpit local: http://127.0.0.1:54324. Os links apontam pra Site URL do `config.toml` (`http://127.0.0.1:3000`): abre o app em `127.0.0.1`, não em `localhost`, porque a sessão é por endereço.

## Testes

```bash
npm test                 # unitários do fluxo, do núcleo e do app; os de banco rodam se o Supabase local estiver no ar
npm run banco:testes     # regras de acesso e funções do banco (pgTAP)
npm run e2e              # ponta a ponta (Playwright), com o Supabase local no ar
npm run typecheck
npm run build
```

Hoje: app 202 testes de unidade (31 arquivos), pgTAP 182 (`compartilhar`, `empresas`, `fluxos`, `senha`), ponta a ponta 25 (critérios 1, 2, 3 e 5, cadastros, cenários, diagnóstico, versões e link, trava, entrar e conta, membros). Passe `--trace=off` direto pro Playwright (`npx playwright test --trace=off`), não `npm run e2e -- --trace off`, que o npm come.

## Partes

| Pasta | O que faz |
|---|---|
| `src/editor` | O editor sem tela: formas e tamanhos (`pecas`), desenho dos canos (`geometria`), estilo (`estilo`), mudanças no documento (`documento`), desfazer e refazer (`historico`), o play em cima do motor (`play`), salvamento automático (`salvamento`), cadastros (`cadastros`), cenários (`cenarios`: resultado, situação, aprovar) e diagnóstico (`diagnostico`: abertos e intencionais, o que dá pra simular, o caminho até uma peça, "ver no quadro") |
| `src/componentes/editor` | O editor: quadro com peças, canos e água (`Quadro`, `Pecas`, `Agua`), painel (`Painel`, `Campos`), o play (`usePlay`, `CartaoPlay`), a gaveta do diagnóstico (`Gaveta`), os pops do topo (`Pop`, `Cenarios`, `Versoes`), o `Compartilhar`, a confirmação no lugar (`Confirmacao`), o componente que junta tudo (`Editor`) e o do link público (`Visualizador`) |
| `src/compartilhar` | O retrato do link público (`montarRetrato`: o documento conferido e, com "esconder nomes", sem as pessoas) e as opções do link (validade, situação, a linha que descreve cada um) |
| `src/lib` | Clientes do Supabase, leituras do servidor (`dados.ts`), o link público (`link.ts`, o único com a chave secreta), origem do app, mensagens de erro, fuso |
| `src/acoes` | Server actions: fluxos, cadastros, versões, cenários, intencionais, links, convites, empresa |
| `src/app` | Rotas: Fluxos (`e/[empresa]`), editor (`e/[empresa]/f/[fluxo]`), Cadastros, Membros, entrar, link público (`l/[token]`) |
| `supabase/` (na raiz) | Migrações, regras de acesso (RLS) e testes pgTAP |

O `@journey/nucleo` (a planilha da central, da v1) não entra no app: fica no repositório pro importador de central da etapa E.

## Decisões

### Editor de fluxos (etapa B)

- **Quadro próprio, não React Flow.** O editor é o protótipo aprovado em React: peças em HTML, canos em SVG com âncora no lado mais direto de cada peça, água quadro a quadro.
- **O documento é a fonte da verdade** e toda mudança é uma função pura (`editor/documento.ts`) que devolve outro documento. O histórico guarda as versões por referência (120 passos); num arrasto, o primeiro quadro entra no histórico e os seguintes substituem.
- **Salvamento automático pelo navegador**, direto no `salvar_fluxo` (RPC), meio segundo depois da última mudança, um envio por vez, com a revisão. Sem rede, a cópia fica no `localStorage` e o envio tenta de novo (2 s, 4 s… até 30 s); ao abrir, uma cópia que partiu da mesma revisão volta. Conflito (40001), trava perdida (P0001) ou recusa param o salvamento e a tela pede pra recarregar. Nome, canal, descrição e meta são colunas: vão por server action.
- **Trava:** ao abrir, `pegar_trava`; renova a cada 4 minutos; ao sair, `soltar_trava` com `fetch(..., { keepalive: true })`. Sem a trava, o editor fica só de leitura (dá pra ver, dar play, tocar cenário e ver o diagnóstico) e diz quem está editando.
- **Cadastros nascem do desenho:** o campo do responsável busca nos cadastros da empresa e oferece "Criar" com o tipo sugerido pelo nome ("Fila …", "Equipe …", "Horário …") ou pela peça. A peça guarda o id; renomear em Cadastros muda em todos os fluxos. Horário nasce de segunda a sexta, 8h às 18h.
- **Play:** o motor (`@journey/fluxo`) roda a simulação inteira de uma vez a partir das escolhas; a tela mostra os eventos um a um. A máquina fica no hook `usePlay`, usado pelo editor e pelo link público. Voltar tira a última escolha e refaz; o play usa uma cópia do documento de quando começou, e mexer no desenho para o play.
- **Fluxo a partir de modelo:** os cadastros do modelo viram cadastros da empresa (o que já existe com o mesmo tipo e nome é reaproveitado), o fluxo nasce e o documento é salvo com `instanciarModelo`. Se salvar falha, o fluxo criado é apagado.
- **Dois cuidados do quadro:** o palco tem `overflow: hidden`, mas o navegador ainda o rola pra mostrar um elemento com foco, então ele volta a (0, 0) a cada rolagem; e, com o ponteiro capturado pelo palco (o arrasto começa no primeiro clique), o duplo clique chega no palco, então o alvo é o elemento sob o mouse (`elementFromPoint`).
- **CSS do editor dentro de `.editor`** (o link público também usa: `.editor.visualizador`).

### Diagnóstico, cenários, versões e link (etapa C)

- **Diagnóstico ao vivo** (`diagnosticar` do pacote, sobre o documento adiado com `useDeferredValue`; uns 2 ms pra 500 peças). O botão do topo conta os abertos e abre uma gaveta em cima do quadro, lembrada por fluxo no navegador; a contagem é anunciada pro leitor de tela quando para de mudar. Cada achado tem "ver no quadro" (seleciona, enquadra e põe no holofote), "simular até aqui" e "marcar como intencional" (com nota, quem e quando). Marcação de achado que o documento não tem mais aparece como "antiga", com desmarcar.
- **"Simular até aqui" só pra peça que um Início alcança**: uma busca em largura por documento (`simulaveis`); o caminho em si (`caminhoAte`: a busca até a peça e o motor escolhendo a saída do caminho) só no clique, e o play toca em modo livre (no relógio, a escolha do horário não valeria) e pausa quando a água chega.
- **A chave de um achado não leva texto livre** (opções repetidas são chaveadas pelos ids das conexões; ciclo grande vira começo + FNV-1a): a marcação sobrevive a renomear e casa no link com os nomes escondidos.
- **Cenário:** "Salvar cenário" no fim do play guarda início, hora, modo, as escolhas que o motor aceitou e o resultado (caminho das peças, como terminou, tempo do cliente). A lista refaz cada cenário contra o documento de agora: "igual" ou "mudou" (uma escolha guardada que não serve mais também é "mudou"). "Aprovar o novo" grava o resultado e as escolhas novas; sem fim, ou com o Início que sumiu, não há o que aprovar.
- **Versão:** marcar é a foto do que está no banco, então o editor manda o que falta antes (`salv.agora()`) e só marca se chegou. Restaurar lê o documento da versão pelo navegador (vale a RLS), tira responsável que não é mais cadastro e entra como uma edição desfazível (o estilo da versão volta junto, mas não entra no Ctrl+Z).
- **As listas do editor ficam no estado dele**: cada ação devolve o que mudou (cenário, versão, link, intencional) e a tela atualiza no lugar, sem `revalidatePath` (refazer a página leria o documento inteiro de novo).
- **Confirmação no lugar** (apagar cenário, restaurar versão, revogar link): a escolha segura vem primeiro e fica com o foco, e os dois botões ignoram o segundo clique de um duplo clique (`detail > 1`). Depois, o foco volta pro botão que abriu ou pra lista.

### Link público

- **O link é lido no servidor com a chave secreta**, e só por `src/lib/link.ts`: quem abre não tem sessão, e a função `abrir_link` só aceita a `service_role`. Assim ninguém com o token na mão chama a API e lê o que o servidor esconderia (com a chave pública, `abrir_link` e a tabela `links` dão 42501). O teste `test/chave-secreta.test.ts` barra a chave em qualquer outro arquivo e em componente de cliente.
- **Uma ida ao banco:** `abrir_link` devolve o fluxo (da versão fixa ou o de agora), o estilo, os cadastros que o documento usa (dos campos, só os do Horário), os canais, os intencionais (chave e nota, sem quem marcou), as opções do link e, com "esconder nomes", os nomes de todas as pessoas da empresa (só pro servidor).
- **O navegador de quem abre recebe só o retrato** (`montarRetrato`): o documento passado no `lerDocumento` (campo desconhecido não vai; documento inválido = "este link não abre") e, com "esconder nomes" (ligado por padrão), sem as pessoas. Cada responsável do tipo Pessoa vira "Pessoa 1", "Pessoa 2"… na ordem em que aparece nas peças; quem só é citado no texto vira "Pessoa". O nome sai de todo texto livre (peças, canos, valores das regras, grupos, notas, outros cadastros, canais, nome e descrição do fluxo, versão, cenário, notas dos intencionais): inteiro e cada palavra com 3 letras ou mais (menos as partículas), sem acento e com espaço, hífen, sublinhado ou espaço de largura zero no meio. Responsável que não é um dos cadastros devolvidos sai.
- **Limites do "esconder nomes"** (também no diálogo, numa linha): apelido, abreviação ou erro de digitação; nome grudado em outra coisa, e-mail ou telefone; palavra do nome com menos de 3 letras sozinha; acento que só o texto tem; gente que não é cadastro do tipo Pessoa; o nome da empresa. A lista completa está em `src/compartilhar/retrato.ts`.
- **O cenário inicial é uma cópia** (nome, início, hora, modo e escolhas) feita pelo servidor quando o link é criado, e toca sozinho quando o link abre. Com versão fixa, o servidor confere que ele toca naquela versão (o Início existe e as escolhas servem) antes de criar.
- **Token de 24 caracteres** (18 bytes aleatórios, base64 de URL), gerado pelo banco; o membro só escolhe as opções (`grant insert` só nessas colunas). Depois de criado, o link só muda pra revogado, e revogar é pra sempre, com a data do banco.
- **Cada abertura lê o banco** (`connection()`): revogar vale na hora. Revogado e vencido mostram uma página com a data; token que não existe dá 404 com uma página que explica. `/l/*` vai com `X-Robots-Tag: noindex, nofollow` e `Referrer-Policy: no-referrer`.
- **O endereço do link usa a origem em que o membro está** (`location.origin`): crie os links pelo domínio de produção.

### Entrar

- **Três jeitos de entrar:** e-mail e senha (o principal, com as abas "Entrar" e "Criar conta"), Google (se `NEXT_PUBLIC_LOGIN_GOOGLE=sim`) e o link por e-mail, como alternativa discreta, junto com "Esqueci a senha". A raiz aceita os convites depois de qualquer um dos três.
- **Os e-mails voltam pelo `/auth/confirm`**, e o Google pelo `/auth/callback`. Os modelos de e-mail (`supabase/templates`, ligados no `config.toml`; no hospedado, colados no painel) mandam o `token_hash` pro `/auth/confirm`, uma página com um botão; o POST do botão (`/auth/confirmar`) confirma no servidor (`verifyOtp`) e grava a sessão no cookie: o link abre em qualquer navegador ou aparelho. Com o link padrão do Supabase (PKCE), só abriria no navegador que pediu. Abrir o link não entra: o leitor de links do provedor de e-mail não gasta o token, e um link com o token de outra pessoa não põe ninguém na conta dela. O POST só vale da origem do app (Origin igual; sem Origin, recusa), contra login CSRF. Os tipos aceitos são só os dos modelos (`email` e `recovery`). As voltas só seguem pra caminho deste app (`caminhoInterno`: nada de `//outro.site`); o Google cancelado volta com `error` e a tela diz (`/entrar?erro=google`).
- **Criar conta pede só o e-mail.** O link de confirmação leva a `/conta/senha`, onde a pessoa escolhe a senha (ou "Agora não"). A senha não vai no cadastro porque o Supabase deixa qualquer um cadastrar qualquer e-mail com uma senha, e não troca essa senha quando a dona aparece: quem chegou antes entraria na conta (e na empresa que a convidou) depois que ela confirmasse. Por isso o banco apaga a senha na hora em que o e-mail é confirmado (trigger em `auth.users`, migração `20261116000000`), e a senha de verdade vem depois, já com a sessão do link. Conta criada já confirmada (painel, API de admin) fica com a senha. "Criar conta" e o link usam o mesmo pedido (`signInWithOtp`): e-mail novo recebe a confirmação; e-mail que já tem conta recebe o link de entrar. A tela diz o mesmo nos dois casos, sem contar quem tem conta.
- **Senha mínima de 8** (`SENHA_MINIMA`; `minimum_password_length = 8` no config.toml; no hospedado, o README da raiz manda subir). Campos com `autocomplete` certo pro gerenciador de senhas (`email`, `current-password`, `new-password`) e "Mostrar" a senha.
- **`/conta/senha`** (só com sessão; sem ela, o proxy manda pro entrar): depois de criar a conta, de "Esqueci a senha", ou pelo link "Senha" (no topo da empresa, ao lado de "Sair", e embaixo do cartão de criar a empresa). Quem está logado troca sem digitar a atual (`secure_password_change` desligado: a sessão basta); se alguém ligar no painel, o Supabase pede reautenticação e a tela diz pra sair e entrar de novo. Trocar a senha encerra as outras sessões da pessoa (o Supabase recusa o refresh delas), mas o token de acesso que cada uma já tem vale até vencer (até 1 h).
- **Os erros do Supabase Auth em português** (`lib/acesso.ts`, pelo código e pelo status): e-mail ou senha que não conferem, e-mail não confirmado, senha fraca, senha igual, limite de e-mail (`over_email_send_rate_limit`: "já mandamos um e-mail") separado do limite de tentativas (`over_request_rate_limit`: "muitas tentativas"). O erro cru vai só pro `console.error`.
- **A página de entrar mostra o produto:** o formulário de um lado e, do outro, uma prévia do quadro com a água andando, trocando de cor do WhatsApp pro e-mail e parando na decisão. A prévia é SVG e CSS próprios (`app/entrar/previa.tsx` e `entrar.css`), decorativa e parada com movimento reduzido: a página não carrega o editor nem o `@journey/fluxo` (só o React, o Next e o cliente do Supabase, pro PKCE, e um componente pequeno que pausa a animação com a aba escondida ou a prévia fora da tela e para depois de três voltas, no quadro final). Abaixo de 420 px a prévia sai: a letra ficaria pequena demais.
- **"Esqueci a senha" e o link ficam fora das abas,** com título próprio e "Entrar com a senha" pra voltar. As abas andam com as setas, Home e End.
- **Depois de pedir o link,** o e-mail continua no campo, o aviso diz pra qual e-mail foi, e "Usar outro e-mail" limpa e volta o foco pro campo. As regiões de aviso (`role=status`, `role=alert`) ficam montadas vazias.
- **O botão só liga depois da hidratação:** antes, um Enter mandaria o formulário pelo navegador. O campo não tem `name`, então o e-mail nunca vai pra URL.
- **Mandar de novo espera 30 s** pro mesmo e-mail (o Supabase recusa outro pedido em menos de 60 s); se mesmo assim vier o limite (429 ou `over_email_send_rate_limit`), a mensagem é em português, a espera vira 60 s e o aviso de "enviado" fica. Os erros viram texto pelo código e pelo status, nunca pelo texto em inglês. Ocupado, o botão fica com `aria-disabled` (e não `disabled`), pra não perder o foco.

### Banco e acesso

- **Chaves estrangeiras compostas por empresa:** tabela filha liga o pai pela dupla `(id, empresa_id)` (cenários, intencionais e links pela dupla `(fluxo_id, empresa_id)`), então uma linha nunca aponta pra linha de outra empresa. Apagar o fluxo apaga os cenários, os intencionais e os links dele.
- **Membro só muda algumas colunas:** em `empresas`, `nome`; em `cenarios`, `nome`, `escolhas`, `esperado` e `revisao_aprovada` (o começo não muda); em `achados_intencionais`, as quatro que o upsert manda; em `links`, só `revogado_em`. O resto não se reescreve pela API.
- **Convite só vale pra e-mail confirmado** (`email_confirmado()` lê `auth.users`, não o token) e o Supabase fica com `enable_confirmations = true`. Sem isso, alguém criaria conta com o e-mail de outra pessoa e entraria na empresa dela. A confirmação sozinha não basta: quem cadastrou o e-mail antes com uma senha entraria depois que a dona confirmasse. Por isso a senha some na confirmação (trigger `senha_some_na_confirmacao` em `auth.users`; a conta criada na mesma transação, como a do painel, fica marcada e não perde a senha). E a pessoa não troca o e-mail da conta (trigger `troca_de_email_recusada`, quando o Supabase grava `email_change`): trocar o e-mail da conta dele pro da convidada, com ela clicando no "confirme o novo e-mail", daria no mesmo. O admin e o painel trocam `email` direto e continuam podendo; o pedido recusado ainda manda os e-mails de confirmação (o Supabase manda antes de gravar), mas os links não valem.
- **`APP_URL` em produção:** os redirecionamentos e a conferência do Origin (no Sair) usam ela. Sem ela o app cai nos cabeçalhos do pedido (`X-Forwarded-*`, `Host`), que o cliente forja; serve só no desenvolvimento.
- **Sair só neste aparelho** (`scope: 'local'`): as outras sessões da pessoa continuam.

## Risco aceito

Qualquer membro pode chamar o banco direto (PostgREST e as funções RPC) e gravar um documento, um cenário ou um intencional com o conteúdo que quiser, desde que tenha a forma que o banco confere. O app confere o conteúdo; o banco, a forma e a empresa.

Hoje isso é aceitável porque todo membro é editor: quem pode fazer isso pela API já pode pela tela. Quando existir um papel só de leitura, as escritas desse papel têm que ser barradas pelas regras de acesso, não só pela tela.

## Gotchas

- **O Google sai do navegador:** o código do PKCE fica num cookie dele, e o `/auth/callback` troca o código pela sessão. Pedido por server action, o cookie não chega e o login volta pra tela de entrar. Os e-mails não dependem disso: o `/auth/confirm` confirma pelo `token_hash`.
- **Mudou o modelo de e-mail?** Mude também no painel do hospedado (o README da raiz tem o passo a passo): `supabase/templates` só vale no local.
- **Sem `APP_URL`, o redirecionamento usa o host do pedido** (`origemDe`): no `next dev`, `request.url` vem como `localhost` mesmo com o navegador em `127.0.0.1`, e a sessão (cookie por host) se perde.
- **Os testes ponta a ponta entram com senha** (`entrar()` no `e2e/apoio.ts`): a conta nasce já confirmada pela API de administração (com a chave secreta lida da CLI) e entra pela tela, sem esperar e-mail e sem gastar os limites por IP do link mágico (30 a cada 5 minutos), que outro clone rodando os mesmos testes no mesmo Supabase também gasta. O link mágico, a confirmação e a recuperação têm os testes deles, pelo Mailpit (o link e a recuperação abertos em outro navegador), e o cadastro antecipado por outra pessoa também (`conta.spec.ts`).
- **A senha some em qualquer confirmação de e-mail de conta que já existia:** convite do painel ("Invite user"), "Add user" sem "Auto Confirm User", e também um dia em que o Supabase preencha `email_confirmed_at` de contas antigas numa migração dele (um backfill): essas contas ficariam sem senha e entrariam pelo link ou por "Esqueci a senha". Não acontece hoje; vale olhar as notas de versão do Auth.
- **Mudou o `config.toml` do Auth?** Só vale depois de reiniciar o Supabase local (`npm run banco:parar` e `npm run banco`).
- **Upsert do PostgREST pede UPDATE em toda coluna que ele manda:** o `on conflict do update set` leva todas, e sem permissão em uma delas até o primeiro upsert falha. Por isso as quatro colunas em `achados_intencionais`.
- **Sem `SUPABASE_SECRET_KEY` no servidor, o link público não abre** (aparece a tela de falha do link, `l/[token]/error.tsx`) e o "Compartilhar" explica e não cria. Local: a linha do `sed` em "Rodar"; no `next dev` já aberto, reinicie depois de mudar o `.env.local`.
- **`<dialog>` com `showModal()` deixa o resto da página inerte:** feche o "Compartilhar" antes de clicar fora dele (nos testes também).
- **O Supabase devolve no máximo 1000 linhas por pedido** (`max_rows = 1000`): as listas que crescem (cadastros, versões, cenários, intencionais, links) vêm em páginas (`todas`, no `dados.ts`).
- **A câmera segue a água:** depois de um play, a peça que um teste quer clicar pode estar fora da tela; "Ver o fluxo inteiro" volta pro todo.
- **Teclas e foco:** os atalhos do editor ignoram o que vem de um campo, de um pop ou do diálogo (Delete num botão do pop não apaga a peça); na gaveta, só o Esc e o desfazer/refazer passam.

## Publicar

Supabase (projeto novo) + Vercel. Passos no README da raiz do repositório, seção "Publicar".
