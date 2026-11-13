import { expect, test } from '@playwright/test';
import { entrar, emailNovo } from './apoio';

test('import com erro mostra aba, linha e coluna e não deixa confirmar', async ({ page, request }) => {
  await entrar(page, request, emailNovo('erro'));
  await page.getByLabel('Nome da empresa').fill('Empresa com erro');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('link', { name: 'Importar' }).first().click();
  await page.getByLabel('Arquivos').setInputFiles({ name: 'saidas.csv', mimeType: 'text/csv', buffer: Buffer.from('id;de;opcao;para\nx;peca:a;tecla-errada;fim:desliga\n') });
  await page.getByRole('button', { name: 'Analisar' }).click();
  const erros = page.getByTestId('problemas-grave');
  await expect(erros).toContainText('saidas');
  await expect(erros).toContainText('opcao');
  await expect(page.getByRole('button', { name: 'Confirmar import' })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Baixar relatório' })).toBeVisible();
});

test('arquivos acima de 4 MB juntos são barrados antes de enviar', async ({ page, request }) => {
  await entrar(page, request, emailNovo('grande'));
  await page.getByLabel('Nome da empresa').fill('Empresa com arquivo grande');
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('link', { name: 'Importar' }).first().click();
  const metade = Buffer.alloc(2 * 1024 * 1024, 'a');
  await page.getByLabel('Arquivos').setInputFiles([
    { name: 'pecas.csv', mimeType: 'text/csv', buffer: metade },
    { name: 'saidas.csv', mimeType: 'text/csv', buffer: Buffer.concat([metade, Buffer.from('a')]) },
  ]);
  await page.getByRole('button', { name: 'Analisar' }).click();
  await expect(page.getByText('Os arquivos passam de 4 MB juntos.')).toBeVisible();
});

test('os modelos pra baixar saem do formato', async ({ request }) => {
  const xlsx = await request.get('/modelos/modelo-journey.xlsx');
  expect(xlsx.status()).toBe(200);
  expect(xlsx.headers()['content-type']).toContain('spreadsheetml');
  const json = await (await request.get('/modelos/modelo-journey.json')).json();
  expect(json.formato).toBe('journey/1');
});
