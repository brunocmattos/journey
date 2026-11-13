import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
/** A senha das contas que os testes criam. */
export const SENHA = 'senha-de-teste-123';

let status: { SECRET_KEY?: string; PUBLISHABLE_KEY?: string } | null = null;
/**
 * As chaves do Supabase local, lidas da própria CLI (como em test/banco/apoio.ts): não ficam no código. A secreta só os
 * testes usam (pra criar contas já confirmadas pela API de administração); a pública é a que qualquer um tem.
 */
function chaves() {
  if (status === null) {
    const raiz = join(import.meta.dirname, '..', '..', '..');
    status = JSON.parse(execSync('npx supabase status -o json', { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] }).toString()) as typeof status;
  }
  return {
    secreta: process.env.SUPABASE_SECRET_KEY || (status!.SECRET_KEY ?? ''),
    publica: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || (status!.PUBLISHABLE_KEY ?? ''),
  };
}
const chaveSecreta = () => chaves().secreta;

/** Chama o Auth do Supabase direto, com a chave pública: o que qualquer pessoa (ou um atacante) consegue fazer. */
export async function authPublico(request: APIRequestContext, caminho: string, dados: object) {
  return request.post(`${SUPABASE}/auth/v1/${caminho}`, { headers: { apikey: chaves().publica }, data: dados, failOnStatusCode: false });
}

/**
 * Uma conta com e-mail já confirmado e a SENHA, pela API de administração (sem e-mail, sem limite por IP). Ela nasce
 * confirmada, então o banco não apaga a senha (só apaga na confirmação de uma conta que já existia).
 */
export async function contaConfirmada(request: APIRequestContext, email: string) {
  const r = await request.post(`${SUPABASE}/auth/v1/admin/users`, {
    headers: { apikey: chaveSecreta(), Authorization: `Bearer ${chaveSecreta()}` },
    data: { email, password: SENHA, email_confirm: true },
  });
  // 422: a conta já existe (o mesmo teste entrou de novo).
  expect([200, 422]).toContain(r.status());
}

/**
 * Entra com e-mail e senha pela tela (criando a conta antes, já confirmada). É o caminho principal do app e o mais
 * rápido nos testes: sem esperar e-mail e sem os limites por IP do link mágico (o repositório principal roda os mesmos
 * testes no mesmo Supabase). O link mágico tem o teste dele (entrar.spec.ts).
 */
export async function entrar(page: Page, request: APIRequestContext, email: string) {
  await contaConfirmada(request, email);
  await page.goto('/entrar');
  // Os botões só ligam depois que a página fica pronta (antes, o Enter mandaria o formulário pelo navegador).
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/entrar'));
}

/** Quantos e-mails o endereço já recebeu (pra esperar o próximo). */
export async function emailsPara(request: APIRequestContext, email: string): Promise<number> {
  const r = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  return ((await r.json()) as { messages?: unknown[] }).messages?.length ?? 0;
}

/**
 * O link do e-mail mais novo pro endereço, depois de `antes` e-mails (link mágico, confirmação ou recuperação). Os
 * modelos (supabase/templates) apontam pro /auth/confirm do app.
 */
export async function linkDoEmail(request: APIRequestContext, email: string, antes = 0): Promise<string> {
  let link = '';
  await expect
    .poll(
      async () => {
        const r = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
        const { messages } = (await r.json()) as { messages?: { ID: string }[] };
        if (!messages || messages.length <= antes) return '';
        const m = (await (await request.get(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)).json()) as { HTML: string };
        link = (/href="([^"]*\/auth\/confirm\?[^"]*)"/.exec(m.HTML)?.[1] ?? '').replaceAll('&amp;', '&');
        return link;
      },
      { timeout: 20_000 },
    )
    .not.toBe('');
  return link;
}

/**
 * Abre o link do e-mail e aperta o botão da página (/auth/confirm só mostra a página; quem entra é o POST do botão).
 */
export async function abrirLink(page: Page, link: string) {
  await page.goto(link);
  await page.getByRole('button', { name: /^(Confirmar e entrar|Continuar pra trocar a senha)$/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
}

/**
 * Pede o link mágico na tela e devolve o que chegou no Mailpit do Supabase local (quem abre escolhe o navegador: o
 * link confirma no servidor e abre em qualquer um).
 */
export async function pedirLink(page: Page, request: APIRequestContext, email: string): Promise<string> {
  await page.goto('/entrar');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Receber um link por e-mail' }).click();
  const antes = await emailsPara(request, email);
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Receber o link' }).click();
  await expect(page.getByRole('status')).toContainText('Link enviado');
  return linkDoEmail(request, email, antes);
}

export const emailNovo = (prefixo: string) => `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@exemplo.com`;
