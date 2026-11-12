import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { empresaComImport, entrar, emailNovo } from './apoio';

const PEQUENA = join(import.meta.dirname, 'fixtures', 'pequena.json');

/** Segunda às 10h, tecla 2, o r1 atende; salva como cenário (o nome cita a pessoa de propósito). */
async function cenarioComNome(page: Page) {
  await page.getByLabel('Dia e hora').fill('2026-11-23T10:00');
  await page.getByRole('button', { name: 'Dar play', exact: true }).click();
  const decisao = page.getByRole('region', { name: 'Decisão' });
  await expect(decisao).toContainText('O que a pessoa digita?', { timeout: 30_000 });
  await page.keyboard.press('2');
  await expect(decisao).toContainText('O ramal r1 (Atendente Um) atende?');
  await decisao.getByRole('button', { name: /^.\s*Atende/ }).click();
  const fim = page.getByTestId('fim');
  await expect(fim).toContainText('Atendido');
  await fim.getByLabel('Nome do cenário').fill('E se pedirem o Atendente Um?');
  await fim.getByRole('button', { name: 'Salvar como cenário' }).click();
  await expect(page.getByRole('button', { name: /^E se pedirem o Atendente Um\?/ })).toBeVisible();
}

/** Abre o "Compartilhar", escolhe as opções e devolve o endereço do link novo. */
async function criarLink(page: Page, o: { cenario?: string; esconder?: boolean; fixa?: boolean }) {
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Compartilhar' });
  await expect(dialogo.getByLabel('Esconder nomes')).toBeChecked();
  if (o.esconder === false) await dialogo.getByLabel('Esconder nomes').uncheck();
  if (o.fixa) await dialogo.getByLabel(/Só a versão/).check();
  if (o.cenario) await dialogo.getByLabel('Cenário inicial').selectOption({ label: o.cenario });
  await dialogo.getByRole('button', { name: 'Criar link' }).click();
  const campo = dialogo.getByLabel('Endereço do link');
  await expect(campo).toHaveValue(/\/l\/[A-Za-z0-9_-]{24}$/);
  const endereco = await campo.inputValue();
  await dialogo.getByRole('button', { name: 'Fechar' }).click();
  await expect(dialogo).toBeHidden();
  return endereco;
}

test('link com nomes escondidos e cenário: abre sem login, simula, não mostra nomes; revogado, explica', async ({ page, request, browser }) => {
  test.setTimeout(150_000);
  await entrar(page, request, emailNovo('links'));
  await empresaComImport(page, [PEQUENA]);
  await cenarioComNome(page);

  // Um achado marcado como intencional, com nota que cita a pessoa.
  await page.getByRole('tab', { name: /Diagnóstico/ }).click();
  const ciclo = page.locator('[data-chave="ciclo_transbordo:r1+r2"]');
  await ciclo.getByRole('button', { name: 'Marcar como intencional' }).click();
  await ciclo.getByLabel('Nota').fill('o Atendente Um pediu assim');
  await ciclo.getByRole('button', { name: 'Marcar', exact: true }).click();
  await expect(ciclo).toHaveCount(0);

  const endereco = await criarLink(page, { cenario: 'E se pedirem o Atendente Um?' });

  // Quem abre não tem conta: outro navegador, sem cookies.
  const fora = await browser.newContext();
  const visita = await fora.newPage();
  const resposta = await visita.goto(endereco);
  expect(resposta!.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(resposta!.headers()['referrer-policy']).toBe('no-referrer');
  await expect(visita).toHaveTitle('E se pedirem o ramal r1? · Journey');
  await expect(visita.getByText('só leitura')).toBeVisible();
  await expect(visita.getByText('nomes escondidos')).toBeVisible();

  // O cenário inicial toca sozinho até o fim; dá pra voltar e escolher outra opção.
  await expect(visita.getByTestId('fim')).toContainText('Atendido', { timeout: 30_000 });
  await visita.getByRole('button', { name: 'Voltar uma decisão' }).click();
  await expect(visita.getByRole('region', { name: 'Decisão' })).toContainText('O ramal r1 atende?');

  // Os nomes não saíram do servidor: nem na tela, nem no HTML (que leva os dados da página).
  expect(await visita.content()).not.toContain('Atendente');
  await expect(visita.getByRole('button', { name: 'Compartilhar' })).toHaveCount(0);
  await expect(visita.getByRole('button', { name: 'Salvar como cenário' })).toHaveCount(0);

  // Diagnóstico: vê os achados e o intencional, sem marcar, sem a nota e sem quem marcou.
  await visita.getByRole('tab', { name: /Diagnóstico/ }).click();
  await expect(visita.getByTestId('diagnostico')).toBeVisible();
  await expect(visita.getByRole('button', { name: 'Marcar como intencional' })).toHaveCount(0);
  await visita.getByText('Intencionais (1)').click();
  const marcado = visita.locator('[data-intencional="ciclo_transbordo:r1+r2"]');
  await expect(marcado).toContainText('Marcado como intencional pela equipe.');
  await expect(marcado).not.toContainText('por ');

  // Revogado: a página explica e não mostra nada da jornada.
  await page.getByRole('button', { name: 'Compartilhar' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Compartilhar' });
  const item = dialogo.getByTestId('links').locator('.achado').first();
  await expect(item).toContainText('cenário “E se pedirem o Atendente Um?”');
  page.once('dialog', (d) => d.accept());
  await item.getByRole('button', { name: 'Revogar' }).click();
  await expect(item).toContainText('revogado em');
  await visita.reload();
  await expect(visita.getByTestId('link-indisponivel')).toContainText('Este link foi revogado');
  expect(await visita.content()).not.toContain('ramal r1');
  await fora.close();
});

test('link com os nomes, na versão fixa e sem cenário: abre parado e mostra os nomes', async ({ page, request, browser }) => {
  test.setTimeout(90_000);
  await entrar(page, request, emailNovo('links-nomes'));
  await empresaComImport(page, [PEQUENA]);
  const endereco = await criarLink(page, { esconder: false, fixa: true });
  const fora = await browser.newContext();
  const visita = await fora.newPage();
  await visita.goto(endereco);
  await expect(visita.locator('.migalhas')).toHaveText('Telefonia/versão 1');
  await expect(visita.getByText('nomes escondidos')).toHaveCount(0);
  await expect(visita.getByText('Dá play numa entrada pra ver pra onde a ligação vai')).toBeVisible();
  await visita.getByRole('tab', { name: 'Ramais' }).click();
  await expect(visita.getByTestId('ramais')).toContainText('Atendente Um');
  await fora.close();
});

test('link que não existe explica, sem login', async ({ page }) => {
  await page.goto('/l/abcdefghijklmnopqrstuvwx');
  await expect(page.getByTestId('link-indisponivel')).toContainText('Este link não existe');
  await expect(page).toHaveTitle('Link indisponível · Journey');
});
