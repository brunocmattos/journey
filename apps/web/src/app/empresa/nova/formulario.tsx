'use client';

import { useActionState } from 'react';
import { criarEmpresa } from '@/acoes/empresa';

export function FormularioEmpresa() {
  const [estado, acao, pendente] = useActionState(criarEmpresa, null);
  return (
    <form action={acao} style={{ display: 'grid', gap: 10 }}>
      <label className="campo">
        Nome da empresa
        <input name="nome" required maxLength={120} />
      </label>
      {estado?.erro && <p className="aviso-caixa erro">{estado.erro}</p>}
      <button className="botao primario" disabled={pendente}>
        Criar
      </button>
    </form>
  );
}
