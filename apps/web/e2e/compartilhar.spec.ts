import { expect, test, type Page } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

const salvo = (page: Page) => expect(page.getByTestId('salvamento')).toHaveText('salvo', { timeout: 20_000 });

async function empresaComSac(page: Page, request: Parameters<typeof entrar>[1], prefixo: string) {
  await entrar(page, request, emailNovo(prefixo));
  await page.getByLabel('Nome da empresa').fill(`Empresa ${prefixo}`);
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('button', { name: /SAC por e-mail/ }).click();
  await expect(page).toHaveURL(/\/f\//);
  await salvo(page);
}

/** Abre o "Compartilhar", escolhe as opções e cria; devolve o endereço. */
async function criarLink(page: Page, opcoes: { versao?: string; cenario?: string } = {}) {
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Compartilhar' });
  if (opcoes.versao) await dialogo.getByLabel('Versão').selectOption({ label: opcoes.versao });
  if (opcoes.cenario) await dialogo.getByLabel('Cenário que toca ao abrir').selectOption({ label: opcoes.cenario });
  await dialogo.getByRole('button', { name: 'Criar link' }).click();
  const endereco = await dialogo.getByTestId('link-novo').inputValue();
  expect(endereco).toMatch(/\/l\/[A-Za-z0-9_-]{24}$/);
  return endereco;
}

test('critério 3: o cenário salvo vai num link; sem conta, ele toca até o fim, sem o nome da pessoa; revogado, não abre', async ({ page, request, browser }) => {
  test.setTimeout(150_000);
  await empresaComSac(page, request, 'compartilhar');
  // A Triagem passa a ser de uma pessoa: o link (com nomes escondidos) não pode mostrar o nome dela.
  await page.getByRole('button', { name: 'Atendimento: Triagem' }).click();
  const resp = page.getByRole('combobox', { name: /Quem atende/ });
  await resp.fill('Marta Quitéria');
  await resp.press('Enter');
  await expect(page.getByRole('button', { name: 'Atendimento: Triagem' })).toContainText('Marta Quitéria');
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

  const endereco = await criarLink(page, { cenario: 'Cliente confirma' });
  const dialogo = page.getByRole('dialog', { name: 'Compartilhar' });
  await expect(dialogo.getByTestId('link')).toHaveCount(1);

  // Sem conta: o cenário toca sozinho até o fim.
  const anonimo = await browser.newContext();
  const p2 = await anonimo.newPage();
  await p2.goto(endereco);
  await expect(p2.getByRole('heading', { name: 'SAC por e-mail' })).toBeVisible();
  await expect(p2.getByTestId('fim')).toContainText('Chegou em: Resolvido', { timeout: 30_000 });
  await expect(p2.getByRole('button', { name: 'Atendimento: Triagem' })).toContainText('Pessoa 1');
  const html = await p2.content();
  expect(html).not.toContain('Marta');
  expect(html).not.toContain('Quitéria');

  // Duplo clique em "Revogar" não confirma sozinho: o segundo clique cai no "Não revogar" (que fica com o foco) e é ignorado.
  await dialogo.getByRole('button', { name: 'Revogar', exact: true }).dblclick();
  await expect(dialogo.getByRole('button', { name: 'Não revogar' })).toBeFocused();
  await expect(dialogo.getByTestId('link')).toContainText('ativo');
  // Revogar: o link deixa de abrir.
  await dialogo.getByRole('button', { name: 'Revogar pra sempre' }).click();
  await expect(dialogo.getByTestId('link')).toContainText('revogado');
  await p2.reload();
  await expect(p2.getByRole('heading', { name: 'Este link foi revogado' })).toBeVisible();
  // Token que não existe: a página explica (404).
  const nada = await p2.goto(endereco.replace(/[^/]+$/, 'a'.repeat(24)));
  expect(nada?.status()).toBe(404);
  await expect(p2.getByRole('heading', { name: 'Este link não existe' })).toBeVisible();
  await anonimo.close();
});

test('versão: o link da versão marcada mostra o de antes; restaurar volta e Ctrl+Z desfaz', async ({ page, request, browser }) => {
  test.setTimeout(150_000);
  await empresaComSac(page, request, 'versoes');
  await page.getByRole('button', { name: 'Versões' }).click();
  const pop = page.getByRole('dialog', { name: 'Versões' });
  await pop.getByLabel('Nome da versão').fill('antes da triagem nova');
  await pop.getByRole('button', { name: 'Marcar versão' }).click();
  await expect(pop.getByTestId('versao')).toContainText('1. antes da triagem nova');
  await pop.getByRole('button', { name: 'Fechar' }).click();

  await page.getByRole('button', { name: 'Atendimento: Triagem' }).dblclick();
  await page.getByLabel('Nome da peça').fill('Triagem nova');
  await page.getByLabel('Nome da peça').press('Enter');
  await salvo(page);

  const endereco = await criarLink(page, { versao: 'versão 1 — antes da triagem nova' });
  await page.getByRole('dialog', { name: 'Compartilhar' }).getByRole('button', { name: 'Fechar' }).click();
  // No celular: dá pra ver e dar play, sem rolar pro lado.
  const anonimo = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await anonimo.newPage();
  await p2.goto(endereco);
  await expect(p2.getByRole('button', { name: 'Atendimento: Triagem' })).toBeAttached();
  await expect(p2.getByRole('button', { name: 'Atendimento: Triagem nova' })).toHaveCount(0);
  await expect(p2.getByText(/versão 1 — antes da triagem nova/)).toBeVisible();
  expect(await p2.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await p2.getByRole('button', { name: 'Dar play' }).click();
  await expect(p2.getByRole('region', { name: 'Simulação' })).toBeVisible();
  await anonimo.close();

  await page.getByRole('button', { name: 'Versões' }).click();
  await pop.getByRole('button', { name: 'Restaurar' }).click();
  await pop.getByRole('button', { name: 'Restaurar a versão 1' }).click();
  await expect(page.getByRole('button', { name: 'Atendimento: Triagem' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atendimento: Triagem nova' })).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Atendimento: Triagem nova' })).toBeVisible();
});
