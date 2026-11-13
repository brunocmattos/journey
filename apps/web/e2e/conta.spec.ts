import { expect, test, type Page } from '@playwright/test';
import { SENHA, abrirLink, authPublico, contaConfirmada, emailNovo, emailsPara, entrar, linkDoEmail } from './apoio';

/** Na tela de entrar, com os botões já ligados. */
async function telaDeEntrar(page: Page) {
  await page.goto('/entrar');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
}

async function comSenha(page: Page, email: string, senha: string) {
  await telaDeEntrar(page);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

/** "Criar conta" na tela: só o e-mail. Devolve o link que chegou (confirmação, ou o de entrar pra quem já tem conta). */
async function criarConta(page: Page, request: Parameters<typeof linkDoEmail>[0], email: string) {
  await telaDeEntrar(page);
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  // Sem senha no cadastro: ela é escolhida depois de confirmar o e-mail.
  await expect(page.getByLabel('Senha', { exact: true })).toHaveCount(0);
  const antes = await emailsPara(request, email);
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('status')).toContainText(`Confirma o e-mail: mandamos um link para ${email}. Pelo link, tu escolhe a senha.`);
  return linkDoEmail(request, email, antes);
}

/** Na página da senha (depois do link): escolhe e salva. */
async function escolherSenha(page: Page, senha: string) {
  await expect(page).toHaveURL(/\/conta\/senha$/);
  await expect(page.getByRole('heading', { name: 'Tua senha' })).toBeVisible();
  await page.getByLabel('Senha nova').fill(senha);
  await page.getByRole('button', { name: 'Salvar a senha' }).click();
}

/** O aviso do formulário (o Next tem outra região de alerta, a do anúncio de rota). */
const alerta = (page: Page) => page.getByRole('main').getByRole('alert');

const sair = (page: Page) => page.getByRole('button', { name: 'Sair' }).click();

test('criar conta: só o e-mail; o link confirma e leva a escolher a senha; sai e entra com ela; senha errada dá a mensagem', async ({ page, request }) => {
  test.setTimeout(90_000);
  const email = emailNovo('cadastro');
  await abrirLink(page, await criarConta(page, request, email));
  await page.getByLabel('Senha nova').fill('curta');
  await expect(page.getByLabel('Senha nova')).toHaveAttribute('minlength', '8');
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await expect(page.getByLabel('Senha nova')).toHaveAttribute('type', 'text');
  await escolherSenha(page, SENHA);
  await expect(page).toHaveURL(/\/empresa\/nova$/);
  // Sem empresa ainda, a conta (senha e sair) fica embaixo do cartão.
  await expect(page.getByRole('link', { name: 'Senha' })).toHaveAttribute('href', '/conta/senha');
  await page.getByLabel('Nome da empresa').fill('Empresa da senha');
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page).toHaveURL(/\/e\/[0-9a-f-]+$/);
  await sair(page);
  await expect(page).toHaveURL(/\/entrar$/);

  await comSenha(page, email, 'senha-errada-123');
  await expect(alerta(page)).toHaveText('E-mail ou senha não conferem.');
  await comSenha(page, email, SENHA);
  await expect(page).toHaveURL(/\/e\/[0-9a-f-]+$/);
});

test('esqueci a senha: o link aberto em outro navegador leva à senha nova, e ela vale', async ({ page, request, browser }) => {
  test.setTimeout(90_000);
  const email = emailNovo('esqueci');
  await contaConfirmada(request, email);
  await telaDeEntrar(page);
  await page.getByRole('button', { name: 'Esqueci a senha' }).click();
  // Fora das abas: um título, e nenhum painel de aba.
  await expect(page.getByRole('heading', { name: 'Esqueci a senha' })).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.getByRole('tabpanel')).toHaveCount(0);
  const antes = await emailsPara(request, email);
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Mandar o link pra trocar a senha' }).click();
  await expect(page.getByRole('status')).toContainText('mandamos um link pra trocar a senha');

  // O e-mail aberto no celular, por exemplo: outro navegador, sem nada do que pediu.
  const outro = await browser.newContext();
  const p2 = await outro.newPage();
  await abrirLink(p2, await linkDoEmail(request, email, antes));
  await escolherSenha(p2, 'outra-senha-456');
  await expect(p2).toHaveURL(/\/empresa\/nova$/);
  await outro.close();

  await comSenha(page, email, SENHA);
  await expect(alerta(page)).toHaveText('E-mail ou senha não conferem.');
  await comSenha(page, email, 'outra-senha-456');
  await expect(page).toHaveURL(/\/empresa\/nova$/);
});

test('quem cadastrou antes o e-mail da convidada não entra com a senha dele; ela cria a conta, cai na empresa e entra com a dela', async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(120_000);
  await entrar(page, request, emailNovo('dono-convite'));
  await page.getByLabel('Nome da empresa').fill('Empresa do convite');
  await page.getByRole('button', { name: 'Criar' }).click();
  const colega = emailNovo('convidada');
  await page.getByRole('link', { name: 'Membros' }).click();
  await page.getByLabel('E-mail').fill(colega);
  await page.getByRole('button', { name: 'Convidar' }).click();
  await expect(page.getByText(`Convite pra ${colega} criado`)).toBeVisible();
  const empresa = /\/e\/([0-9a-f-]+)/.exec(page.url())![1]!;

  // O atacante chega primeiro: cadastra o e-mail dela com a senha dele, direto na API (a chave pública é de todos).
  const ATACANTE = 'senha-do-atacante-1';
  expect((await authPublico(request, 'signup', { email: colega, password: ATACANTE })).status()).toBe(200);
  // O cadastro dele já mandou uma confirmação pra ela: espera chegar, pra pegar depois só o e-mail do pedido dela.
  await linkDoEmail(request, colega);
  // O Supabase recusa outro e-mail pro mesmo endereço por um tempo (max_frequency: 1 s aqui, 60 s no hospedado).
  await new Promise((r) => setTimeout(r, 1500));

  // Ela faz o caminho dela: criar conta, confirmar pelo e-mail, escolher a senha. O convite vale (está na empresa).
  const ela = await browser.newContext();
  const p2 = await ela.newPage();
  await abrirLink(p2, await criarConta(p2, request, colega));
  await escolherSenha(p2, SENHA);
  await expect(p2).toHaveURL(new RegExp(`/e/${empresa}$`));
  // Logada: "Senha" no topo leva à troca.
  await p2.getByRole('link', { name: 'Senha' }).click();
  await expect(p2).toHaveURL(/\/conta\/senha$/);
  await ela.close();

  // A senha do atacante não vale mais (nem na API, nem na tela); a dela vale.
  const r = await authPublico(request, 'token?grant_type=password', { email: colega, password: ATACANTE });
  expect(r.status()).toBe(400);
  expect(((await r.json()) as { error_code?: string }).error_code).toBe('invalid_credentials');
  const limpo = await browser.newContext();
  const p3 = await limpo.newPage();
  await comSenha(p3, colega, ATACANTE);
  await expect(alerta(p3)).toHaveText('E-mail ou senha não conferem.');
  await comSenha(p3, colega, SENHA);
  await expect(p3).toHaveURL(new RegExp(`/e/${empresa}$`));
  await limpo.close();
});

test('a volta do Google não leva pra fora do app (next=//evil.com)', async ({ request }) => {
  for (const next of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
    const r = await request.get(`/auth/callback?code=nao-vale&next=${encodeURIComponent(next)}`, { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(new URL(r.headers().location!, 'http://127.0.0.1:3000').host).toBe('127.0.0.1:3000');
  }
});

test('o link do e-mail só entra pelo botão: abrir não entra nem gasta o token; de outro site é recusado; next de fora vira a raiz', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const email = emailNovo('botao');
  await contaConfirmada(request, email);
  const antes = await emailsPara(request, email);
  expect((await authPublico(request, 'otp', { email, create_user: false })).status()).toBe(200);
  // O link com o next trocado por outro site (como alguém mal-intencionado faria).
  const link = new URL(await linkDoEmail(request, email, antes));
  link.searchParams.set('next', '//evil.com');
  const campos = Object.fromEntries(link.searchParams);

  // Abrir (o leitor de links do e-mail, ou alguém que recebeu o link de outro): só a página, sem sessão.
  const aberto = await request.get(link.toString(), { maxRedirects: 0 });
  expect(aberto.status()).toBe(200);
  expect(aberto.headers()['set-cookie'] ?? '').not.toContain('auth-token');
  expect(aberto.headers()['referrer-policy']).toBe('same-origin');
  expect(aberto.headers()['content-security-policy']).toBe("frame-ancestors 'none'");
  expect(aberto.headers()['x-frame-options']).toBe('DENY');
  // O POST de outro site (login CSRF) é recusado e não toca no token.
  const deFora = await request.post('/auth/confirmar', { form: campos, headers: { origin: 'https://evil.com' }, maxRedirects: 0 });
  expect(deFora.status()).toBe(403);

  // O token continua valendo: o botão entra, e o next de fora vira a raiz deste app.
  await page.goto(link.toString());
  await page.getByRole('button', { name: 'Confirmar e entrar' }).click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3000\/empresa\/nova$/);
});

test('nova senha sem sessão manda pro entrar', async ({ page }) => {
  await page.goto('/conta/senha');
  await expect(page).toHaveURL(/\/entrar$/);
});
