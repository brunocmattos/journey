'use client';

import { useMemo, useState } from 'react';
import { lerRef, nomeDe, type Indice } from '@journey/nucleo/formato';

/**
 * Ramais diretos (spec, 7.3): vem do catálogo, não é documento. Cada ramal mostra pra onde transborda,
 * quanto toca, se tem siga-me e quais números discam direto nele.
 */
export function PainelRamais({ idx, atual, abrir }: { idx: Indice; atual: string | null; abrir: (ref: string, modo: 'ninguem_atende' | 'cenario') => void }) {
  const [busca, setBusca] = useState('');
  const diretos = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of idx.doc.entradas) if (lerRef(e.destino)?.tipo === 'ramal') m.set(e.destino, [...(m.get(e.destino) ?? []), e.numero]);
    return m;
  }, [idx]);
  const q = busca.trim().toLowerCase();
  const ramais = idx.doc.ramais.filter((r) => !q || `${r.id} ${r.nome ?? ''}`.toLowerCase().includes(q));
  const sel = atual ? idx.ramais.get(lerRef(atual)?.id ?? '') : undefined;
  return (
    <div data-testid="ramais">
      <div className="rotulo-secao">Ramal</div>
      <input className="entrada-texto" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca por número ou nome" aria-label="Buscar ramal" />
      {sel && (
        <div className="achado" style={{ marginTop: 10 }}>
          <b>
            {sel.nome ?? `Ramal ${sel.id}`} <span className="mono mudo">{sel.id}</span>
          </b>
          <p>
            Toca {sel.toque_s ?? 20} s
            {sel.siga_me_so_ramal_s !== undefined && `; siga-me: ${sel.siga_me_so_ramal_s} s só o ramal, ${sel.siga_me_com_lista_s ?? 0} s com a lista`}.
          </p>
          <p>Não atende → {sel.ao_nao_atender ? nomeDe(idx, sel.ao_nao_atender) : 'desliga (sem transbordo)'}</p>
          {diretos.get(`ramal:${sel.id}`) && <p>Discam direto: {diretos.get(`ramal:${sel.id}`)!.join(', ')}</p>}
          <div className="acoes">
            <button className="botao pequeno primario" type="button" onClick={() => abrir(`ramal:${sel.id}`, 'ninguem_atende')}>
              Ninguém atende
            </button>
            <button className="botao pequeno" type="button" onClick={() => abrir(`ramal:${sel.id}`, 'cenario')}>
              Simular
            </button>
          </div>
        </div>
      )}
      <div className="lista-botoes" style={{ marginTop: 10 }}>
        {ramais.slice(0, 300).map((r) => (
          <button key={r.id} type="button" className="item-lista" aria-pressed={atual === `ramal:${r.id}`} onClick={() => abrir(`ramal:${r.id}`, 'ninguem_atende')}>
            <b>
              <span className="mono">{r.id}</span> {r.nome}
            </b>
            <span>{r.ao_nao_atender ? `→ ${nomeDe(idx, r.ao_nao_atender)}` : 'sem transbordo'}</span>
          </button>
        ))}
      </div>
      {ramais.length > 300 && <p className="dica">Mostrando 300 de {ramais.length}: refina a busca.</p>}
    </div>
  );
}
