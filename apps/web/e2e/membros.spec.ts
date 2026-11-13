import { expect, test } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

test('convidado entra direto na empresa', async ({ page, request, browser }) => {
  await entrar(page, request, emailNovo('dono'));
  await page.getByLabel('Nome da empresa').fill('Empresa do convite');
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page.getByRole('heading', { name: 'Jornadas' })).toBeVisible();
  const convidado = emailNovo('convidado');
  await page.getByRole('link', { name: 'Membros' }).click();
  await page.getByLabel('E-mail').fill(convidado);
  await page.getByRole('button', { name: 'Convidar' }).click();
  await expect(page.getByText(`Convite pra ${convidado} criado`)).toBeVisible();

  const outra = await browser.newContext();
  const p2 = await outra.newPage();
  await entrar(p2, request, convidado);
  await expect(p2.getByText('Empresa do convite')).toBeVisible();
  await expect(p2.getByRole('heading', { name: 'Nada importado ainda' })).toBeVisible();
  await outra.close();
});
