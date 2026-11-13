'use client';

import { useRef, useState } from 'react';
import { formatarTempo } from '@journey/fluxo';
import { paraAprovar, type Cenario, type Situacao } from '@/editor/cenarios';
import { tituloDoFim } from '@/editor/play';
import { Confirmacao, focarDepois } from './Confirmacao';

export interface AcoesCenarios {
  tocar(c: Cenario): void;
  aprovar(c: Cenario, s: Situacao): Promise<void>;
  renomear(c: Cenario, nome: string): Promise<boolean>;
  apagar(c: Cenario): Promise<void>;
}

/**
 * A lista dos cenários do fluxo, cada um com a situação contra o documento de agora: "igual" (o caminho dá o mesmo
 * resultado) ou "mudou" (com o que dá agora e "aprovar o novo"). Só leitura: só tocar.
 */
export function Cenarios({
  cenarios,
  situacoes,
  nomeDaPeca,
  soLeitura,
  acoes,
}: {
  cenarios: readonly Cenario[];
  situacoes: ReadonlyMap<string, Situacao>;
  nomeDaPeca: (id: string | null) => string;
  soLeitura: boolean;
  acoes: AcoesCenarios;
}) {
  if (!cenarios.length) return <p className="dica">Nenhum cenário ainda. No fim de um play, “Salvar cenário” guarda o caminho pra tocar de novo e conferir quando o fluxo mudar.</p>;
  return (
    <ul className="lista-pop">
      {cenarios.map((c) => (
        <ItemCenario key={c.id} c={c} s={situacoes.get(c.id)} nomeDaPeca={nomeDaPeca} soLeitura={soLeitura} acoes={acoes} />
      ))}
    </ul>
  );
}

function ItemCenario({ c, s, nomeDaPeca, soLeitura, acoes }: { c: Cenario; s: Situacao | undefined; nomeDaPeca: (id: string | null) => string; soLeitura: boolean; acoes: AcoesCenarios }) {
  const [renomeando, setRenomeando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const item = useRef<HTMLLIElement>(null);
  /** Depois de renomear ou desistir, o foco volta pro botão que abriu (e não pro body, onde o Esc não fecha o pop). */
  const voltarPara = (seletor: string) => focarDepois(() => item.current?.querySelector<HTMLElement>(seletor));
  const fim = (f: Cenario['esperado']['fim'] | null) => (f ? `${tituloDoFim(f.motivo)}: ${nomeDaPeca(f.peca)}` : 'para numa pergunta');
  const novo = s && s.situacao === 'mudou' ? paraAprovar(s) : null;
  const ocupar = async (f: () => Promise<unknown>) => {
    setOcupado(true);
    await f();
    setOcupado(false);
  };
  return (
    <li className="item-pop" data-testid="cenario" ref={item}>
      {renomeando && !soLeitura ? (
        <form
          className="linha-pop"
          onSubmit={(e) => {
            e.preventDefault();
            const nome = new FormData(e.currentTarget).get('nome') as string;
            void ocupar(async () => {
              if (!(await acoes.renomear(c, nome))) return;
              setRenomeando(false);
              voltarPara('[data-renomear]');
            });
          }}
        >
          <input className="entrada-texto" name="nome" aria-label="Nome do cenário" defaultValue={c.nome} maxLength={200} autoFocus />
          <button className="botao pequeno primario" type="submit" disabled={ocupado}>
            Salvar
          </button>
          <button
            className="botao pequeno"
            type="button"
            onClick={() => {
              setRenomeando(false);
              voltarPara('[data-renomear]');
            }}
          >
            Cancelar
          </button>
        </form>
      ) : (
        <div className="linha-pop">
          <b>{c.nome}</b>
          {s && <span className={`selo-s ${s.situacao}`}>{s.situacao === 'igual' ? 'igual' : 'mudou'}</span>}
        </div>
      )}
      <small className="mudo">
        {fim(c.esperado.fim)} · {formatarTempo(c.esperado.tempo_s)}
        {s?.situacao === 'mudou' && ` → agora: ${fim(s.resultado.fim)} · ${formatarTempo(s.resultado.tempo_s)}`}
      </small>
      <div className="acoes-achado">
        <button className="botao pequeno" type="button" onClick={() => acoes.tocar(c)}>
          Tocar
        </button>
        {!soLeitura && novo && (
          <button className="botao pequeno" type="button" disabled={ocupado} onClick={() => s && void ocupar(() => acoes.aprovar(c, s))}>
            Aprovar o novo
          </button>
        )}
        {!soLeitura && !renomeando && (
          <button className="botao pequeno" type="button" data-renomear onClick={() => setRenomeando(true)}>
            Renomear
          </button>
        )}
        {!soLeitura &&
          (apagando ? (
            <Confirmacao
              nao="Não apagar"
              sim={`Apagar “${c.nome}”`}
              aoCancelar={() => {
                setApagando(false);
                voltarPara('[data-apagar]');
              }}
              aoConfirmar={() => {
                // Apagado, o item some e o foco vai pro pop (pego antes); se não deu, volta pro Apagar.
                const pop = item.current?.closest<HTMLElement>('.pop');
                setApagando(false);
                void ocupar(() => acoes.apagar(c)).then(() => focarDepois(() => (item.current?.isConnected ? item.current.querySelector<HTMLElement>('[data-apagar]') : pop)));
              }}
            />
          ) : (
            <button className="botao pequeno" type="button" data-apagar onClick={() => setApagando(true)}>
              Apagar
            </button>
          ))}
      </div>
    </li>
  );
}
