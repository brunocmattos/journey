import { Suspense } from 'react';
import { Jornada } from '@/componentes/jornada/Jornada';
import { cenarios, intencionais, links, versaoAtual } from '@/lib/dados';

export default async function PaginaJornada({ params }: { params: Promise<{ empresa: string; jornada: string }> }) {
  const { empresa, jornada } = await params;
  const [v, cs, is, ls] = await Promise.all([versaoAtual(empresa, jornada), cenarios(jornada), intencionais(empresa, jornada), links(jornada)]);
  return (
    <Suspense>
      <Jornada
        versao={v.numero}
        documento={v.documento}
        diagnostico={v.diagnostico}
        cenarios={cs}
        intencionais={is}
        membro={{ empresaId: empresa, jornadaId: jornada, links: ls }}
      />
    </Suspense>
  );
}
