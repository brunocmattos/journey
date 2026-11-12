import { expect, test } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

test('sem sessão, qualquer página manda pra entrar', async ({ page }) => {
  await page.goto('/e/00000000-0000-0000-0000-000000000000');
  await expect(page).toHaveURL(/\/entrar$/);
});

test('quem entra pela primeira vez cai em criar a empresa', async ({ page, request }) => {
  await entrar(page, request, emailNovo('primeira'));
  await expect(page).toHaveURL(/\/empresa\/nova$/);
  await expect(page.getByRole('heading', { name: 'Tua empresa' })).toBeVisible();
});
