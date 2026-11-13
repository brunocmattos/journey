import { expect, type APIRequestContext, type Page } from '@playwright/test';

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

/** Entra pelo link mágico: pede o link na tela e abre o que chegou no Mailpit do Supabase local. */
export async function entrar(page: Page, request: APIRequestContext, email: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Receber o link' }).click();
  await expect(page.getByRole('status')).toContainText('Link enviado');
  let link = '';
  await expect
    .poll(
      async () => {
        const r = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
        const { messages } = (await r.json()) as { messages?: { ID: string }[] };
        if (!messages?.length) return '';
        const m = (await (await request.get(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)).json()) as { Text: string };
        link = (/https?:\/\/\S+verify\S+/.exec(m.Text) ?? [''])[0];
        return link;
      },
      { timeout: 20_000 },
    )
    .not.toBe('');
  await page.goto(link);
}

/**
 * As telas da v1 (importar, catálogo) saíram do menu na etapa B e continuam até a C: os testes delas chegam pelo endereço.
 */
export async function irPara(page: Page, secao: 'importar' | 'catalogo') {
  await page.waitForURL(/\/e\/[0-9a-f-]+/);
  const empresa = /\/e\/([0-9a-f-]+)/.exec(page.url())![1];
  await page.goto(`/e/${empresa}/${secao}`);
}

export const emailNovo = (prefixo: string) => `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@exemplo.com`;

/** Cria a empresa e importa os arquivos; termina na página da jornada. */
export async function empresaComImport(page: Page, arquivos: string[], nome = 'Empresa de teste') {
  await expect(page).toHaveURL(/\/empresa\/nova/);
  await page.getByLabel('Nome da empresa').fill(nome);
  await page.getByRole('button', { name: 'Criar' }).click();
  await irPara(page, 'importar');
  await page.getByLabel('Arquivos').setInputFiles(arquivos);
  await page.getByRole('button', { name: 'Analisar' }).click();
  await expect(page.getByText('pode confirmar')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Confirmar import' }).click();
  await expect(page.getByTestId('mapa')).toBeVisible({ timeout: 30_000 });
}
