import { expect, test } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

test('critério 2: o nome escrito na peça vira cadastro; renomear lá muda no fluxo', async ({ page, request }) => {
  test.setTimeout(90_000);
  await entrar(page, request, emailNovo('cadastros'));
  await page.getByLabel('Nome da empresa').fill('Empresa dos cadastros');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByLabel('Nome do fluxo').fill('Cobrança');
  await page.getByRole('button', { name: 'Criar e abrir' }).click();
  await expect(page).toHaveURL(/\/f\//);
  const fluxo = page.url();

  await page.getByRole('button', { name: 'Atendimento', exact: true }).click();
  await page.getByTestId('quadro').click({ position: { x: 300, y: 300 } });
  await page.getByLabel('Nome da peça').fill('Cobra o cliente');
  await page.getByLabel('Nome da peça').press('Enter');
  const resp = page.getByRole('combobox', { name: /Quem atende/ });
  await resp.fill('Fila Cobrança');
  await expect(page.getByRole('option', { name: /Criar “Fila Cobrança”/ })).toContainText('Fila');
  await resp.press('Enter');
  await expect(page.getByText('“Fila Cobrança” virou cadastro (Fila)')).toBeVisible();
  const naPeca = page.getByRole('button', { name: 'Atendimento: Cobra o cliente' });
  await expect(naPeca).toContainText('Fila Cobrança');
  await expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });

  await page.getByRole('link', { name: 'Cadastros' }).click();
  await expect(page.getByRole('link', { name: 'Cobrança' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apagar' })).toBeDisabled();
  const nome = page.getByLabel('Nome de Fila Cobrança');
  await nome.fill('Fila Recuperação');
  await nome.press('Enter');
  await expect(page.getByText('Agora é “Fila Recuperação” em todos os fluxos.')).toBeVisible();

  await page.goto(fluxo);
  await expect(page.getByRole('button', { name: 'Atendimento: Cobra o cliente' })).toContainText('Fila Recuperação');
});

test('horário: janelas editadas na tela de Cadastros', async ({ page, request }) => {
  test.setTimeout(60_000);
  await entrar(page, request, emailNovo('horario'));
  await page.getByLabel('Nome da empresa').fill('Empresa do horário');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('link', { name: 'Cadastros' }).click();
  await page.getByLabel('Novo cadastro').fill('Plantão');
  await page.getByLabel('Tipo', { exact: true }).selectOption('horario');
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await page.getByRole('button', { name: 'Janelas e feriados' }).click();
  await page.getByLabel('Fim').fill('24:00');
  await page.getByRole('button', { name: 'Salvar horário' }).click();
  await expect(page.getByText('Horário salvo.')).toBeVisible();
  await page.getByLabel('Fim').fill('07:00');
  await page.getByRole('button', { name: 'Salvar horário' }).click();
  await expect(page.getByText('Confere as janelas')).toBeVisible();
});
