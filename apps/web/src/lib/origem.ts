import type { NextRequest } from 'next/server';

/**
 * A origem que o navegador usou (host e protocolo do pedido). `request.url` no `next dev` vem como localhost
 * mesmo quando o navegador abriu 127.0.0.1, e os cookies da sessão não atravessam de um host pro outro.
 */
export function origemDe(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host;
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return `${proto}://${host}`;
}
