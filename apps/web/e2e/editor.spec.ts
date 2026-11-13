import { expect, test, type Page } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const peca = (page: Page, nome: string) => page.getByRole('button', { name: new RegExp(`: ${esc(nome)}$`) });
const salvo = (page: Page) => expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });

/** O + de uma peça cria a próxima já ligada; o nome fica em edição. */
async function proxima(page: Page, de: string, tipo: string, nome: string) {
  await peca(page, de).hover();
  await page.getByRole('button', { name: `Criar a próxima etapa ligada a ${de}` }).click();
  await page.getByRole('menuitem', { name: tipo, exact: true }).click();
  await page.getByLabel('Nome da peça').fill(nome);
  await page.getByLabel('Nome da peça').press('Enter');
  await expect(peca(page, nome)).toBeVisible();
}

test('critério 1: fluxo novo do zero, 10 peças com 2 decisões, play até o fim', async ({ page, request }) => {
  test.setTimeout(120_000);
  await entrar(page, request, emailNovo('editor'));
  await page.getByLabel('Nome da empresa').fill('Empresa do editor');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByLabel('Nome do fluxo').fill('Onboarding');
  await page.getByRole('button', { name: 'Criar e abrir' }).click();
  await expect(page).toHaveURL(/\/f\//);
  await salvo(page);

  await page.getByRole('button', { name: 'Início', exact: true }).click();
  await page.getByTestId('quadro').click({ position: { x: 200, y: 300 } });
  await page.getByLabel('Nome da peça').fill('Cliente chama');
  await page.getByLabel('Nome da peça').press('Enter');
  await proxima(page, 'Cliente chama', 'Mensagem', 'Boas-vindas');
  await proxima(page, 'Boas-vindas', 'Decisão', 'Já é cliente?');
  await proxima(page, 'Já é cliente?', 'Atendimento', 'Atende cliente');
  await proxima(page, 'Já é cliente?', 'Etapa', 'Cadastra');
  await proxima(page, 'Cadastra', 'Decisão', 'Aprovado?');
  await proxima(page, 'Aprovado?', 'Fim', 'Bem-vindo');
  await proxima(page, 'Aprovado?', 'Fim', 'Recusado');
  await proxima(page, 'Atende cliente', 'Espera', 'Aguarda retorno');
  await proxima(page, 'Aguarda retorno', 'Fim', 'Resolvido');
  await expect(page.locator('[data-peca]')).toHaveCount(10);
  await salvo(page);

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Dar play' }).click();
  const sim = page.getByRole('region', { name: 'Simulação' });
  await expect(sim.getByRole('button', { name: /Cadastra/ })).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('2');
  await sim.getByRole('button', { name: /Recusado/ }).click();
  await expect(page.getByTestId('fim')).toContainText('Chegou em: Recusado', { timeout: 15_000 });
  await sim.getByRole('button', { name: 'Voltar e escolher outro caminho' }).click();
  await expect(sim.locator('.pergunta')).toHaveText('Aprovado?');
  await page.getByRole('button', { name: 'Parar' }).first().click();
});

test('apaga, desfaz, e depois de recarregar o desenho está igual', async ({ page, request }) => {
  test.setTimeout(90_000);
  await entrar(page, request, emailNovo('desfazer'));
  await page.getByLabel('Nome da empresa').fill('Empresa');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('button', { name: /SAC por e-mail/ }).click();
  await expect(page).toHaveURL(/\/f\//);
  await salvo(page);
  await peca(page, 'Resolvido').click();
  await page.keyboard.press('Delete');
  await expect(peca(page, 'Resolvido')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(peca(page, 'Resolvido')).toBeVisible();
  await peca(page, 'Triagem').dblclick();
  await page.getByLabel('Nome da peça').fill('Triagem do SAC');
  await page.getByLabel('Nome da peça').press('Enter');
  await salvo(page);
  await page.reload();
  await expect(peca(page, 'Triagem do SAC')).toBeVisible();
  await expect(peca(page, 'Resolvido')).toBeVisible();
});
