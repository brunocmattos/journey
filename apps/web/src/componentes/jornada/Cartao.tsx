'use client';

import { useState } from 'react';
import type { Canal, Evento, Indice, Opcao } from '@journey/nucleo';
import type { Divergencia } from '@/simulacao/comparar';
import { duracao, FIM, nomeLegivel, pergunta, QUEM, resumir } from '@/simulacao/descrever';
import type { EstadoVisual } from '@/simulacao/estado';

/** O que aparece no selo da opção; quando é letra ou número, é também a tecla que a escolhe. */
export const tecla = (o: Opcao) => (o.opcao.length === 1 ? o.opcao : o.opcao === 'esgotou' ? '…' : o.opcao === 'sim' ? 'S' : o.opcao === 'nao' ? 'N' : '·');

/** A opção que a tecla escolhe: a do selo (dígito, *, #, S ou N), se estiver disponível. */
export function opcaoDaTecla(opcoes: readonly Opcao[], chave: string): Opcao | undefined {
  if (chave.length !== 1 || chave === '·' || chave === '…') return undefined;
  return opcoes.find((o) => o.disponivel && tecla(o).toLowerCase() === chave.toLowerCase());
}

export interface CenarioNoCartao {
  nome: string;
  versao: number;
  divergencia: Divergencia | null;
  /** Grava o resultado de agora como o esperado; devolve o erro, se houver. */
  aprovar: () => Promise<string | undefined>;
}

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
  /** Cenário aberto e refeito até a última escolha: comparação com o esperado. */
  cenario: CenarioNoCartao | null;
  salvar: ((nome: string) => Promise<string | undefined>) | null;
}

/** "Igual ao aprovado" ou "mudou", com o botão de aprovar. Aparece em qualquer cartão em que o cenário termine de ser refeito. */
function Comparacao({ cenario }: { cenario: CenarioNoCartao }) {
  const [aprovando, setAprovando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (!cenario.divergencia) {
    return (
      <p className="aviso-caixa ok" style={{ marginTop: 10 }} data-testid="comparacao">
        Igual ao resultado aprovado de “{cenario.nome}”.
      </p>
    );
  }
  return (
    <div className="aviso-caixa erro" style={{ marginTop: 10 }} data-testid="comparacao">
      O resultado mudou desde a versão {cenario.versao} (evento {cenario.divergencia.indice + 1}).{' '}
      <button
        className="botao pequeno"
        type="button"
        disabled={aprovando}
        onClick={async () => {
          setAprovando(true);
          setErro(null);
          const e = await cenario.aprovar();
          setAprovando(false);
          if (e) setErro(e);
        }}
      >
        Aprovar este resultado
      </button>
      {erro && (
        <span role="alert" style={{ display: 'block', marginTop: 6 }}>
          {erro}
        </span>
      )}
    </div>
  );
}

export function Cartao(p: PropsCartao) {
  const [nome, setNome] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
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
  const comparacao = p.cenario && <Comparacao cenario={p.cenario} />;
  if (perguntando && p.noFim) {
    const sug = perguntando.sugestao;
    const comTecla = perguntando.opcoes.some((o) => o.disponivel && opcaoDaTecla([o], tecla(o)) !== undefined);
    return (
      <div className="cartao-decisao" role="region" aria-label="Decisão">
        <div className="quem">
          {QUEM[perguntando.quem]} decide <span className="ref">· {nomeLegivel(p.idx, perguntando.ref)}</span>
        </div>
        <div className="pergunta" aria-live="polite">
          {pergunta(p.idx, perguntando.quem, perguntando.ref)}
        </div>
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
        {comTecla && <p className="dica">Dá pra usar o teclado: as teclas valem como opção.</p>}
        {comparacao}
      </div>
    );
  }
  if (fora && p.noFim && !fim) {
    return (
      <div className="cartao-decisao" role="region" aria-label="Fora deste mapa">
        <div className="quem">Fora deste mapa</div>
        <div className="pergunta" aria-live="polite">
          A ligação foi pra {nomeLegivel(p.idx, fora)}
        </div>
        {fora.startsWith('ramal:') && (
          <div className="opcoes">
            <button className="botao" type="button" onClick={() => p.verRamal(fora)}>
              Seguir no mapa do ramal
            </button>
          </div>
        )}
        {comparacao}
      </div>
    );
  }
  if (fim && p.noFim) {
    const f = FIM[fim.motivo];
    const r = resumir(p.eventos, p.canal);
    const classe = f.tom === 'grave' ? 'grave' : f.tom === 'aviso' ? 'aviso' : 'ok';
    return (
      <div className="cartao-decisao" data-testid="fim" role="region" aria-label="Fim da ligação">
        <div className={`quem ${classe}`}>Fim · {nomeLegivel(p.idx, fim.ref)}</div>
        <div className="pergunta" aria-live="polite">
          {f.titulo}
        </div>
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
        {comparacao}
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
              setSalvando(true);
              const erro = await p.salvar!(nome);
              setSalvando(false);
              setMsg(erro ?? 'Cenário salvo em “E se…”.');
            }}
          >
            <input className="entrada-texto" style={{ flex: '1 1 200px' }} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="E se ligarem às 16h57?" aria-label="Nome do cenário" />
            <button className="botao primario" disabled={salvando}>
              Salvar como cenário
            </button>
          </form>
        )}
        {msg && <p className="dica">{msg}</p>}
      </div>
    );
  }
  return null;
}
