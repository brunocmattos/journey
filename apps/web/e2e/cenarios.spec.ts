import { expect, test, type Page } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

const salvo = (page: Page) => expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });

test('cenário: salvo no fim do play; o fluxo muda e ele diz "mudou"; aprovar o novo volta pra "igual"', async ({ page, request }) => {
  test.setTimeout(120_000);
  await entrar(page, request, emailNovo('cenarios'));
  await page.getByLabel('Nome da empresa').fill('Empresa dos cenários');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('button', { name: /SAC por e-mail/ }).click();
  await expect(page).toHaveURL(/\/f\//);
  await salvo(page);

  await page.getByRole('button', { name: 'Dar play' }).click();
  const sim = page.getByRole('region', { name: 'Simulação' });
  await sim.getByRole('button', { name: /cliente confirmou/ }).click({ timeout: 20_000 });
  await expect(page.getByTestId('fim')).toContainText('Chegou em: Resolvido', { timeout: 20_000 });
  await sim.getByRole('button', { name: 'Salvar cenário' }).click();
  await sim.getByLabel('Nome do cenário').fill('Cliente confirma');
  await sim.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cenários (1)' })).toBeVisible();
  await sim.getByRole('button', { name: 'Fechar' }).click();

  await page.getByRole('button', { name: 'Cenários (1)' }).click();
  const pop = page.getByRole('dialog', { name: 'Cenários' });
  const item = pop.getByTestId('cenario').filter({ hasText: 'Cliente confirma' });
  await expect(item).toContainText('igual');
  await pop.getByRole('button', { name: 'Fechar' }).click();

  // A resposta automática passa a levar 30 s: o mesmo caminho dá outro tempo. (A câmera seguiu a água: volta pro todo.)
  await page.getByRole('button', { name: 'Ver o fluxo inteiro' }).click();
  await page.getByRole('button', { name: 'Mensagem: Resposta automática com protocolo' }).click();
  await page.getByLabel('Tempo nesta peça (pra simulação): quantidade').fill('30');
  await page.getByLabel('Tempo nesta peça (pra simulação): quantidade').press('Tab');
  await salvo(page);
  await page.getByRole('button', { name: 'Cenários (1)' }).click();
  await expect(item).toContainText('mudou');
  await item.getByRole('button', { name: 'Aprovar o novo' }).click();
  await expect(item).toContainText('igual');

  // Tocar: o play refaz o caminho até o fim.
  await item.getByRole('button', { name: 'Tocar' }).click();
  await expect(page.getByTestId('fim')).toContainText('Chegou em: Resolvido', { timeout: 20_000 });

  // Depois de recarregar, o cenário continua aprovado.
  await page.reload();
  await page.getByRole('button', { name: 'Cenários (1)' }).click();
  await expect(page.getByRole('dialog', { name: 'Cenários' }).getByTestId('cenario')).toContainText('igual');
});
