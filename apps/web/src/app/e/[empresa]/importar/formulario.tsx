'use client';

import { useActionState } from 'react';
import { analisarImport } from '@/acoes/importar';

export function FormularioImport({ empresaId }: { empresaId: string }) {
  const [estado, acao, pendente] = useActionState(analisarImport.bind(null, empresaId), null);
  return (
    <form action={acao} style={{ display: 'grid', gap: 10 }}>
      <label className="campo">
        Arquivos
        <input name="arquivos" type="file" multiple accept=".xlsx,.csv,.json" required />
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
        <input type="checkbox" name="parcial" value="sim" />
        Import parcial: só as abas que vieram mudam; o resto fica como está
      </label>
      {estado?.erro && <p className="aviso-caixa erro">{estado.erro}</p>}
      <div>
        <button className="botao primario" disabled={pendente}>
          {pendente ? 'Analisando…' : 'Analisar'}
        </button>
      </div>
    </form>
  );
}
