import { relatorioCsv } from '@/importacao/revisao';
import { importDaEmpresa } from '@/lib/dados';

export async function GET(_: Request, { params }: { params: Promise<{ empresa: string; import: string }> }) {
  const { empresa, import: id } = await params;
  const imp = await importDaEmpresa(empresa, id);
  const csv = relatorioCsv([...imp.relatorio.erros, ...imp.relatorio.avisos]);
  return new Response('﻿' + csv, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="relatorio-import-${id.slice(0, 8)}.csv"` },
  });
}
