import { Suspense } from 'react';
import { Jornada } from '@/componentes/jornada/Jornada';
import { cenarios, intencionais, versaoAtual } from '@/lib/dados';

export default async function PaginaJornada({ params }: { params: Promise<{ empresa: string; jornada: string }> }) {
  const { empresa, jornada } = await params;
  const [v, cs, is] = await Promise.all([versaoAtual(empresa, jornada), cenarios(jornada), intencionais(jornada)]);
  return (
    <Suspense>
      <Jornada empresaId={empresa} jornadaId={jornada} versao={v.numero} documento={v.documento} diagnostico={v.diagnostico} cenarios={cs} intencionais={is} />
    </Suspense>
  );
}
