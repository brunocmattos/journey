import { expect, type APIRequestContext, type Page } from '@playwright/test';

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

/** Entra pelo link mágico: pede o link na tela e abre o que chegou no Mailpit do Supabase local. */
export async function entrar(page: Page, request: APIRequestContext, email: string) {
  await page.goto('/entrar');
  // O botão só liga depois que a página fica pronta (antes, o Enter mandaria o formulário pelo navegador).
  await expect(page.getByRole('button', { name: 'Receber o link' })).toBeEnabled();
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

export const emailNovo = (prefixo: string) => `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@exemplo.com`;

