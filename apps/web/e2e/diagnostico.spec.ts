import { expect, test, type Page } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const peca = (page: Page, nome: string) => page.getByRole('button', { name: new RegExp(`: ${esc(nome)}$`) });
const salvo = (page: Page) => expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });

test('diagnóstico: um beco aparece, ver no quadro, simular até aqui, marcar como intencional e desmarcar', async ({ page, request }) => {
  test.setTimeout(120_000);
  await entrar(page, request, emailNovo('diagnostico'));
  await page.getByLabel('Nome da empresa').fill('Empresa do diagnóstico');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('button', { name: /SAC por e-mail/ }).click();
  await expect(page).toHaveURL(/\/f\//);
  await salvo(page);
  const botao = page.getByTestId('botao-diagnostico');
  await expect(botao).toHaveText('sem achados');

  // Uma etapa nova depois da Triagem, sem saída: um beco.
  await peca(page, 'Triagem').hover();
  await page.getByRole('button', { name: 'Criar a próxima etapa ligada a Triagem' }).click();
  await page.getByRole('menuitem', { name: 'Etapa', exact: true }).click();
  await page.getByLabel('Nome da peça').fill('Beco do teste');
  await page.getByLabel('Nome da peça').press('Enter');
  await salvo(page);
  await expect(botao).toHaveText('1 achado');

  await botao.click();
  const gaveta = page.getByRole('region', { name: 'Diagnóstico' });
  const achado = gaveta.getByRole('listitem').filter({ hasText: 'Beco do teste não tem saída' });
  await expect(achado).toContainText('Grave');
  await page.keyboard.press('Escape');
  await achado.getByRole('button', { name: 'Ver no quadro' }).click();
  await expect(peca(page, 'Beco do teste')).toHaveAttribute('aria-pressed', 'true');

  await achado.getByRole('button', { name: 'Simular até aqui' }).click();
  const sim = page.getByRole('region', { name: 'Simulação' });
  await expect(sim.locator('.pergunta')).toHaveText('Beco do teste', { timeout: 20_000 });
  await sim.getByRole('button', { name: 'Parar' }).first().click();

  await achado.getByRole('button', { name: 'Marcar como intencional' }).click();
  await gaveta.getByLabel('Por que é de propósito? (opcional)').fill('ainda vai ganhar saída');
  await gaveta.getByRole('button', { name: 'Marcar', exact: true }).click();
  await expect(botao).toHaveText('sem achados');
  await expect(gaveta.getByText('Intencionais (1)')).toBeVisible();
  await expect(gaveta.getByText('“ainda vai ganhar saída”')).toBeVisible();

  // Recarregar: a marcação veio do banco, e a gaveta lembra que estava aberta.
  await page.reload();
  await expect(page.getByTestId('botao-diagnostico')).toHaveText('sem achados');
  await expect(page.getByRole('region', { name: 'Diagnóstico' }).getByText('Intencionais (1)')).toBeVisible();
  await page.getByRole('region', { name: 'Diagnóstico' }).getByRole('button', { name: 'Desmarcar' }).click();
  await expect(page.getByTestId('botao-diagnostico')).toHaveText('1 achado');
});
