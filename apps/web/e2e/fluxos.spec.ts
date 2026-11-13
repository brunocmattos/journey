import { expect, test } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

const MODELOS = ['Suporte no WhatsApp', 'Esteira de crédito', 'URA telefônica'];

test('critério 5: fluxos de canais diferentes convivem, cada um com a cor da água dele', async ({ page, request }) => {
  test.setTimeout(120_000);
  await entrar(page, request, emailNovo('canais'));
  await page.getByLabel('Nome da empresa').fill('Empresa dos canais');
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page).toHaveURL(/\/e\/[0-9a-f-]+$/);
  const casa = page.url();
  const cores: string[] = [];
  for (const nome of MODELOS) {
    await page.goto(casa);
    // Sem lista a região já vem aberta; com fluxos, abre pelo botão. Espera a página responder (o clique antes da
    // hidratação se perde) em vez de olhar uma vez só com isVisible().
    const novo = page.getByRole('button', { name: 'Novo fluxo' });
    await expect(novo).toBeEnabled();
    await expect(async () => {
      if ((await novo.getAttribute('aria-expanded')) !== 'true') await novo.click();
      await expect(page.getByRole('region', { name: 'Novo fluxo' })).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await page.getByRole('button', { name: new RegExp(nome) }).click();
    await expect(page).toHaveURL(/\/f\//);
    await expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Dar play' }).click();
    await page.getByRole('region', { name: 'Simulação' }).getByLabel('Dia e hora').fill('2026-11-23T10:00');
    const agua = page.locator('.agua-trilho').first();
    await agua.waitFor({ state: 'attached', timeout: 15_000 });
    cores.push(await agua.evaluate((el) => (el as SVGPathElement).style.stroke));
  }
  expect(new Set(cores).size).toBe(3);
  await page.goto(casa);
  for (const nome of MODELOS) await expect(page.getByRole('link', { name: new RegExp(nome) })).toBeVisible();
  await page.getByLabel('Buscar fluxo').fill('credito');
  await expect(page.getByRole('link', { name: /Esteira de crédito/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /URA telefônica/ })).toHaveCount(0);
});

test('trava: quem abre depois só vê e dá play; sem rede, guarda e salva quando volta', async ({ page, request, browser, context }) => {
  test.setTimeout(150_000);
  const dono = emailNovo('dono');
  await entrar(page, request, dono);
  await page.getByLabel('Nome da empresa').fill('Empresa da trava');
  await page.getByRole('button', { name: 'Criar' }).click();
  const colega = emailNovo('colega');
  await page.getByRole('link', { name: 'Membros' }).click();
  await page.getByLabel('E-mail').fill(colega);
  await page.getByRole('button', { name: 'Convidar' }).click();
  await expect(page.getByText(`Convite pra ${colega} criado`)).toBeVisible();
  await page.getByRole('link', { name: 'Fluxos' }).click();
  await page.getByRole('button', { name: /URA telefônica/ }).click();
  await expect(page).toHaveURL(/\/f\//);
  await expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });

  const outro = await browser.newContext();
  const p2 = await outro.newPage();
  await entrar(p2, request, colega);
  await p2.goto(page.url());
  await expect(p2.getByText(`${dono} está editando este fluxo`)).toBeVisible({ timeout: 15_000 });
  await expect(p2.getByTestId('salvamento')).toHaveText('só leitura');
  await expect(p2.getByRole('button', { name: 'Desfazer' })).toBeDisabled();
  await p2.getByRole('button', { name: 'Dar play' }).click();
  await expect(p2.getByRole('region', { name: 'Simulação' })).toBeVisible();
  await outro.close();

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Fim: Atendido' }).click();
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('salvamento')).toContainText('sem conexão', { timeout: 15_000 });
  await context.setOffline(false);
  await expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 30_000 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Fim: Desliga' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fim: Atendido' })).toHaveCount(0);
});
