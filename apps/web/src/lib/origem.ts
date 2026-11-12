import type { NextRequest } from 'next/server';

/**
 * A origem pública do app, pra montar os redirecionamentos e conferir o Origin.
 * Em produção vem do APP_URL: os cabeçalhos X-Forwarded-* chegam do cliente e qualquer um os forja.
 * Sem APP_URL (desenvolvimento), a origem que o navegador usou: `request.url` no `next dev` vem como
 * localhost mesmo quando o navegador abriu 127.0.0.1, e os cookies da sessão não atravessam de um host pro outro.
 */
export function origemDe(request: NextRequest): string {
  const app = process.env.APP_URL?.trim();
  if (app) return new URL(app).origin;
  // Atrás de mais de um proxy vem "a, b": o primeiro é o que o navegador pediu.
  const primeiro = (nome: string) => request.headers.get(nome)?.split(',')[0]?.trim() || null;
  const host = primeiro('x-forwarded-host') ?? primeiro('host') ?? request.nextUrl.host;
  const proto = primeiro('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return `${proto}://${host}`;
}
