'use client';

import { useActionState, useState, type FormEvent } from 'react';
import { analisarImport } from '@/acoes/importar';
import { ERRO_LIMITE, passaDoLimite } from '@/importacao/limite';

export function FormularioImport({ empresaId }: { empresaId: string }) {
  const [estado, acao, pendente] = useActionState(analisarImport.bind(null, empresaId), null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  // Confere o tamanho antes de enviar: acima do limite, o envio seria cortado no caminho.
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    const arquivos = (e.currentTarget.elements.namedItem('arquivos') as HTMLInputElement | null)?.files;
    const grande = passaDoLimite([...(arquivos ?? [])].map((f) => f.size));
    setErroLocal(grande ? ERRO_LIMITE : null);
    if (grande) e.preventDefault();
  }

  const erro = erroLocal ?? estado?.erro;
  return (
    <form action={acao} onSubmit={aoEnviar} style={{ display: 'grid', gap: 10 }}>
      <label className="campo">
        Arquivos
        <input name="arquivos" type="file" multiple accept=".xlsx,.csv,.json" required onChange={() => setErroLocal(null)} />
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
        <input type="checkbox" name="parcial" value="sim" />
        Import parcial: só as abas que vieram mudam; o resto fica como está
      </label>
      {erro && <p className="aviso-caixa erro">{erro}</p>}
      <div>
        <button className="botao primario" disabled={pendente}>
          {pendente ? 'Analisando…' : 'Analisar'}
        </button>
      </div>
    </form>
  );
}
