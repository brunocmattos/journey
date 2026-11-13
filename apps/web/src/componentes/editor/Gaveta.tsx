'use client';

import { useRef, useState } from 'react';
import type { Achado } from '@journey/fluxo';
import { Icone } from '@/componentes/Icone';
import { GRAVIDADES, type Intencional } from '@/editor/diagnostico';
import { FUSO } from '@/lib/fuso';
import { focarDepois } from './Confirmacao';

export interface AcoesGaveta {
  verNoQuadro(a: Achado): void;
  simularAte(a: Achado): void;
  marcar(chave: string, nota: string): Promise<boolean>;
  desmarcar(chave: string): void;
}

const dataCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * O diagnóstico ao vivo, numa gaveta em cima do quadro: os achados abertos, os marcados como intencionais (com a nota,
 * quem e quando) e os antigos (marcações de achados que o documento não tem mais). Só leitura: vê, mostra no quadro e
 * simula; não marca nem desmarca.
 */
export function Gaveta({
  id,
  abertos,
  intencionais,
  antigos,
  marcas,
  podeSimular,
  soLeitura,
  acoes,
}: {
  id: string;
  abertos: readonly Achado[];
  intencionais: readonly Achado[];
  antigos: readonly Pick<Intencional, 'chave' | 'nota'>[];
  /** A marcação de cada achado intencional (nota, quem, quando), pela chave. */
  marcas: ReadonlyMap<string, Pick<Intencional, 'nota' | 'autor' | 'criado_em'>>;
  podeSimular: (a: Achado) => boolean;
  soLeitura: boolean;
  acoes: AcoesGaveta;
}) {
  return (
    <section className="gaveta" id={id} aria-label="Diagnóstico" tabIndex={-1}>
      {abertos.length === 0 ? (
        <p className="dica">Nenhum problema aberto neste fluxo.</p>
      ) : (
        <ul className="achados">
          {abertos.map((a) => (
            <ItemAchado key={a.chave} a={a} podeSimular={podeSimular(a)} soLeitura={soLeitura} acoes={acoes} />
          ))}
        </ul>
      )}
      {intencionais.length > 0 && (
        <details className="det" open>
          <summary>Intencionais ({intencionais.length})</summary>
          <ul className="achados">
            {intencionais.map((a) => {
              const m = marcas.get(a.chave);
              return (
                <li key={a.chave} className="achado intencional">
                  <div className="achado-titulo">{a.titulo}</div>
                  {m?.nota && <p className="nota-intencional">“{m.nota}”</p>}
                  {m && (m.autor || m.criado_em) && (
                    <small className="mudo">
                      {[m.autor && `marcado por ${m.autor}`, m.criado_em && `em ${dataCurta.format(new Date(m.criado_em))}`].filter(Boolean).join(' ')}
                    </small>
                  )}
                  <div className="acoes-achado">
                    <button className="botao pequeno" type="button" onClick={() => acoes.verNoQuadro(a)}>
                      Ver no quadro
                    </button>
                    {!soLeitura && (
                      <button className="botao pequeno" type="button" onClick={() => acoes.desmarcar(a.chave)}>
                        Desmarcar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {antigos.length > 0 && (
        <details className="det">
          <summary>{antigos.length === 1 ? '1 marcação antiga' : `${antigos.length} marcações antigas`}</summary>
          <p className="dica">Achados marcados como intencionais que este fluxo não tem mais.</p>
          <ul className="achados">
            {antigos.map((i) => (
              <li key={i.chave} className="achado antigo">
                <code>{i.chave}</code>
                {i.nota && <p className="nota-intencional">“{i.nota}”</p>}
                {!soLeitura && (
                  <button className="botao pequeno" type="button" onClick={() => acoes.desmarcar(i.chave)}>
                    Desmarcar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ItemAchado({ a, podeSimular, soLeitura, acoes }: { a: Achado; podeSimular: boolean; soLeitura: boolean; acoes: AcoesGaveta }) {
  const [marcando, setMarcando] = useState(false);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const item = useRef<HTMLLIElement>(null);
  const g = GRAVIDADES[a.gravidade];
  const desistir = () => {
    setMarcando(false);
    focarDepois(() => item.current?.querySelector<HTMLElement>('[data-marcar]'));
  };
  return (
    <li className={`achado g-${a.gravidade}`} ref={item}>
      <div className="achado-titulo">
        <span className={`selo-g ${a.gravidade}`}>
          <Icone nome={g.icone} />
          {g.nome}
        </span>
        {a.titulo}
      </div>
      <p className="achado-texto">{a.texto}</p>
      <div className="acoes-achado">
        <button className="botao pequeno" type="button" onClick={() => acoes.verNoQuadro(a)} disabled={!a.refs.length}>
          Ver no quadro
        </button>
        <button className="botao pequeno" type="button" onClick={() => acoes.simularAte(a)} disabled={!podeSimular} title={podeSimular ? undefined : 'Nenhum Início chega aqui'}>
          Simular até aqui
        </button>
        {!soLeitura && !marcando && (
          <button className="botao pequeno" type="button" data-marcar onClick={() => setMarcando(true)}>
            Marcar como intencional
          </button>
        )}
      </div>
      {marcando && !soLeitura && (
        <form
          className="marcar"
          onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), desistir())}
          onSubmit={async (e) => {
            e.preventDefault();
            // O achado vai pra "Intencionais" (este item some): o foco fica na gaveta.
            const gaveta = item.current?.closest<HTMLElement>('.gaveta');
            setEnviando(true);
            const ok = await acoes.marcar(a.chave, nota);
            setEnviando(false);
            if (!ok) return;
            setMarcando(false);
            focarDepois(() => gaveta);
          }}
        >
          <input className="entrada-texto" type="text" aria-label="Por que é de propósito? (opcional)" placeholder="Por que é de propósito? (opcional)" maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} autoFocus />
          <button className="botao pequeno primario" type="submit" disabled={enviando}>
            Marcar
          </button>
          <button className="botao pequeno" type="button" onClick={desistir}>
            Cancelar
          </button>
        </form>
      )}
    </li>
  );
}
