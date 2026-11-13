import { expect, test } from '@playwright/test';
import { abrirLink, contaConfirmada, emailNovo, entrar, pedirLink } from './apoio';

test('sem sessão, qualquer página manda pra entrar', async ({ page }) => {
  await page.goto('/e/00000000-0000-0000-0000-000000000000');
  await expect(page).toHaveURL(/\/entrar$/);
});

test('quem entra pela primeira vez cai em criar a empresa', async ({ page, request }) => {
  await entrar(page, request, emailNovo('primeira'));
  await expect(page).toHaveURL(/\/empresa\/nova$/);
  await expect(page.getByRole('heading', { name: 'Tua empresa' })).toBeVisible();
});

test('o link mágico continua: pede aqui, abre em outro navegador e entra lá', async ({ page, request, browser }) => {
  const email = emailNovo('link');
  await contaConfirmada(request, email);
  const link = await pedirLink(page, request, email);
  // Outro navegador (sem os cookies deste): o link confirma no servidor, sem o PKCE de quem pediu.
  const outro = await browser.newContext();
  const p2 = await outro.newPage();
  await abrirLink(p2, link);
  await expect(p2).toHaveURL(/\/empresa\/nova$/);
  await outro.close();
});

test('o Google cancelado volta pro entrar com o aviso dele', async ({ page }) => {
  await page.goto('/auth/callback?error=access_denied&error_code=access_denied&error_description=The+user+denied');
  await expect(page).toHaveURL(/\/entrar\?erro=google$/);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('O Google não completou a entrada');
});

test('no celular, sem rolar pro lado: pede o link, vê pra onde foi e pode usar outro e-mail', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { name: 'Desenha o fluxo e dá play.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const email = emailNovo('celular');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Receber um link por e-mail' }).click();
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Receber o link' }).click();
  await expect(page.getByRole('status')).toContainText(`Link enviado para ${email}`);
  // O e-mail fica no campo, pra conferir (e mandar de novo, se precisar).
  await expect(page.getByLabel('E-mail')).toHaveValue(email);
  // Logo depois, o botão espera (o Supabase recusa outro pedido em menos de um minuto) e diz quanto falta.
  await expect(page.getByRole('button', { name: /Mandar de novo em \d+ s/ })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Usar outro e-mail' }).click();
  await expect(page.getByLabel('E-mail')).toHaveValue('');
  await expect(page.getByLabel('E-mail')).toBeFocused();
  await ctx.close();
});

test('link expirado: a página diz e deixa pedir outro', async ({ page }) => {
  await page.goto('/entrar?erro=link');
  await expect(page.getByRole('alert').filter({ hasText: 'O link expirou ou já foi usado' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
});

test('antes de a página ficar pronta, o Enter não manda o e-mail pela URL', async ({ browser }) => {
  // Sem JavaScript é a janela de antes da hidratação, esticada: o botão vem desligado do servidor.
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/entrar?erro=link');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeDisabled();
  await page.getByLabel('E-mail').fill('alguem@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('uma-senha-qualquer');
  await page.getByLabel('Senha', { exact: true }).press('Enter');
  await page.waitForLoadState('load');
  expect(page.url()).not.toContain('alguem');
  expect(page.url()).not.toContain('senha');
  await ctx.close();
});

test('movimento reduzido: a prévia é decorativa e fica parada', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/entrar');
  await expect(page.locator('.previa[aria-hidden="true"]')).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await ctx.close();
});
