import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { entrar, emailNovo, irPara } from './apoio';

const CENTRAL = join(import.meta.dirname, '..', '..', '..', 'packages', 'nucleo', 'test', 'fixtures', 'central');

/** Os achados da seção 12.3 do spec, pela chave estável do diagnóstico. */
const ACHADOS_12_3 = [
  'beco_sem_saida:saida:fase-30-esgotou',
  'beco_sem_saida:saida:fase-31-esgotou',
  'beco_sem_saida:saida:fase-64-esgotou',
  'ciclo_transbordo:9019+9507',
  'redundancia:peca:fase-180>fila:99951',
  'sem_entrada:fila:99950',
  'redundancia:peca:fase-16>fila:90015',
  'redundancia:peca:fase-30>fila:90011',
  'redundancia:peca:fase-267>fila:90019',
];

test('critérios 1 e 2: a central entra sem redesenhar e o diagnóstico acha os problemas sozinho', async ({ page, request }) => {
  test.setTimeout(120_000);
  await entrar(page, request, emailNovo('aceite'));
  await expect(page).toHaveURL(/\/empresa\/nova/);
  await page.getByLabel('Nome da empresa').fill('Central de teste');
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page.getByRole('heading', { name: 'Fluxos' })).toBeVisible();

  await irPara(page, 'importar');
  const arquivos = readdirSync(CENTRAL).filter((n) => n.endsWith('.csv')).map((n) => join(CENTRAL, n));
  await page.getByLabel('Arquivos').setInputFiles(arquivos);
  await page.getByRole('button', { name: 'Analisar' }).click();
  await expect(page.getByRole('heading', { name: 'Revisão do import' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('pode confirmar')).toBeVisible();
  await expect(page.getByTestId('problemas-grave')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmar import' }).click();

  // Critério 1: o mapa completo, sem redesenhar.
  const mapa = page.getByTestId('mapa');
  await expect(mapa).toBeVisible({ timeout: 30_000 });
  await expect(mapa.locator('[data-no="ramais-diretos"]')).toBeVisible();
  await expect(mapa.locator('[data-no="peca:tc-3"]')).toHaveCount(1);
  await expect(mapa.locator('[data-no="peca:fase-29"]')).toHaveCount(1);

  // Critério 2: os achados da seção 12.3.
  await page.getByRole('tab', { name: /Diagnóstico/ }).click();
  const diag = page.getByTestId('diagnostico');
  for (const chave of ACHADOS_12_3) await expect(diag.locator(`[data-chave="${chave}"]`), chave).toHaveCount(1);
  await expect(diag.locator('[data-chave^="buraco_horario:"]')).toHaveCount(1);
  await expect(diag.locator('[data-chave^="no_inativo:saida:"]')).toHaveCount(7);
  await expect(diag.locator('[data-chave^="destino_inexistente:ramal:"]').first()).toBeVisible();
  await expect(diag.getByText('Quem atende quando', { exact: false }).first()).toBeVisible();
});
