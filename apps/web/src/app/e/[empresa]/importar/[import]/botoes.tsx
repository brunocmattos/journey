'use client';

import { useState, useTransition } from 'react';
import { confirmarImport, descartarImport } from '@/acoes/importar';

export function BotoesRevisao({ empresaId, importId, ok, temProblemas }: { empresaId: string; importId: string; ok: boolean; temProblemas: boolean }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {erro && <p className="aviso-caixa erro">{erro}</p>}
      <div className="linha-form">
        <button
          className="botao primario"
          disabled={!ok || pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await confirmarImport(empresaId, importId);
              if (r?.erro) setErro(r.erro);
            })
          }
        >
          {pendente ? 'Confirmando…' : 'Confirmar import'}
        </button>
        <button className="botao" disabled={pendente} onClick={() => iniciar(() => descartarImport(empresaId, importId))}>
          Descartar
        </button>
        {temProblemas && (
          <a className="botao" href={`/e/${empresaId}/importar/${importId}/relatorio`}>
            Baixar relatório
          </a>
        )}
      </div>
    </div>
  );
}
