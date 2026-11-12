import { gerarEsquemaJson, gerarModeloJson, gerarModeloXlsx } from '@journey/nucleo';

/** Modelos pra baixar, gerados do formato (spec, 8.5). Públicos: não têm dado de ninguém. */
export async function GET(_: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params;
  const baixar = (corpo: BodyInit, tipo: string) =>
    new Response(corpo, { headers: { 'content-type': tipo, 'content-disposition': `attachment; filename="${arquivo}"` } });
  switch (arquivo) {
    case 'modelo-journey.xlsx':
      return baixar(new Uint8Array(await gerarModeloXlsx()), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    case 'modelo-journey.json':
      return baixar(JSON.stringify(gerarModeloJson(), null, 2), 'application/json; charset=utf-8');
    case 'esquema-journey.json':
      return baixar(JSON.stringify(gerarEsquemaJson(), null, 2), 'application/json; charset=utf-8');
    default:
      return new Response('não encontrado', { status: 404 });
  }
}
