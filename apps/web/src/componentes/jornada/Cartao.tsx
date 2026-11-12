'use client';

import { useState } from 'react';
import type { Canal, Evento, Indice, Opcao } from '@journey/nucleo';
import type { Divergencia } from '@/simulacao/comparar';
import { duracao, FIM, nomeLegivel, pergunta, QUEM, resumir } from '@/simulacao/descrever';
import type { EstadoVisual } from '@/simulacao/estado';

const tecla = (o: Opcao) => (o.opcao.length === 1 ? o.opcao : o.opcao === 'esgotou' ? '…' : o.opcao === 'sim' ? 'S' : o.opcao === 'nao' ? 'N' : '·');

export interface PropsCartao {
  idx: Indice;
  rodando: boolean;
  estado: EstadoVisual;
  /** Todos os passos já estão na tela. */
  noFim: boolean;
  eventos: readonly Evento[];
  /** O canal da entrada (o motor o assume calado; o resumo precisa dele). */
  canal: Canal;
  livre: boolean;
  escolher: (o: Opcao) => void;
  recomecar: () => void;
  verRamal: (ref: string) => void;
  /** Cenário aberto: comparação com o esperado. */
  cenario: { nome: string; versao: number; divergencia: Divergencia | null; aprovar: () => void } | null;
  salvar: ((nome: string) => Promise<string | undefined>) | null;
}

export function Cartao(p: PropsCartao) {
  const [nome, setNome] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  if (!p.rodando) {
    return (
      <div className="cartao-decisao parado">
        <div className="quem">Simular</div>
        <div className="pergunta">Dá play numa entrada pra ver pra onde a ligação vai</div>
        <p>Use o botão ▶ nas entradas do mapa ou escolha a entrada, o dia e a hora no painel.</p>
      </div>
    );
  }
  const { perguntando, fim, fora } = p.estado;
  if (perguntando && p.noFim) {
    const sug = perguntando.sugestao;
    return (
      <div className="cartao-decisao" role="dialog" aria-label="Decisão">
        <div className="quem">
          {QUEM[perguntando.quem]} decide <span className="ref">· {nomeLegivel(p.idx, perguntando.ref)}</span>
        </div>
        <div className="pergunta">{pergunta(p.idx, perguntando.quem, perguntando.ref)}</div>
        <div className="opcoes">
          {perguntando.opcoes.map((o) => (
            <button key={o.saida ?? o.opcao} type="button" className={`opcao${sug === o.opcao ? ' sugerida' : ''}`} disabled={!o.disponivel} onClick={() => p.escolher(o)}>
              <span className="tecla">{tecla(o)}</span>
              <span>
                {o.rotulo}
                <small>
                  {o.segundos > 0 ? `${duracao(o.segundos)} na linha${o.exemplo ? ' (exemplo)' : ''}` : 'na hora'}
                  {o.para ? ` → ${nomeLegivel(p.idx, o.para)}` : ''}
                </small>
              </span>
            </button>
          ))}
        </div>
        {sug && p.livre && <p className="dica">O relógio diria “{sug === 'sim' ? 'sim' : 'não'}”.</p>}
        {perguntando.quem === 'quem_liga' && <p className="dica">Dá pra usar o teclado: as teclas valem como opção.</p>}
      </div>
    );
  }
  if (fora && p.noFim && !fim) {
    return (
      <div className="cartao-decisao">
        <div className="quem">Fora deste mapa</div>
        <div className="pergunta">A ligação foi pra {nomeLegivel(p.idx, fora)}</div>
        {fora.startsWith('ramal:') && (
          <div className="opcoes">
            <button className="botao" type="button" onClick={() => p.verRamal(fora)}>
              Seguir no mapa do ramal
            </button>
          </div>
        )}
      </div>
    );
  }
  if (fim && p.noFim) {
    const f = FIM[fim.motivo];
    const r = resumir(p.eventos, p.canal);
    const classe = f.tom === 'grave' ? 'grave' : f.tom === 'aviso' ? 'aviso' : 'ok';
    return (
      <div className="cartao-decisao" data-testid="fim">
        <div className={`quem ${classe}`}>Fim · {nomeLegivel(p.idx, fim.ref)}</div>
        <div className="pergunta">{f.titulo}</div>
        {fim.detalhe && <p>{fim.detalhe}</p>}
        <div className="numeros" style={{ marginTop: 10 }}>
          <span>
            <b>{duracao(r.segundos)}</b>na linha
          </span>
          <span>
            <b>{r.decisoes}</b>decisões
          </span>
          <span>
            <b>{r.canais.length}</b>
            {r.canais.join(', ')}
          </span>
        </div>
        {p.cenario &&
          (p.cenario.divergencia ? (
            <p className="aviso-caixa erro" style={{ marginTop: 10 }}>
              O resultado mudou desde a versão {p.cenario.versao} (evento {p.cenario.divergencia.indice + 1}).{' '}
              <button className="botao pequeno" type="button" onClick={p.cenario.aprovar}>
                Aprovar este resultado
              </button>
            </p>
          ) : (
            <p className="aviso-caixa ok" style={{ marginTop: 10 }}>
              Igual ao resultado aprovado de “{p.cenario.nome}”.
            </p>
          ))}
        <div className="opcoes">
          <button className="botao" type="button" onClick={p.recomecar}>
            Ver de novo
          </button>
        </div>
        {p.salvar && !p.cenario && (
          <form
            className="linha-form"
            style={{ marginTop: 10 }}
            onSubmit={async (e) => {
              e.preventDefault();
              const erro = await p.salvar!(nome);
              setMsg(erro ?? 'Cenário salvo em “E se…”.');
            }}
          >
            <input className="entrada-texto" style={{ flex: '1 1 200px' }} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="E se ligarem às 16h57?" aria-label="Nome do cenário" />
            <button className="botao primario">Salvar como cenário</button>
          </form>
        )}
        {msg && <p className="dica">{msg}</p>}
      </div>
    );
  }
  return null;
}
