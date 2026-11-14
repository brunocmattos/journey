'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { ABAS, abaDaTecla, abaDoHash, hashDaAba, idDaAba, type ChaveAba } from './abas';
import { Miniatura } from './Miniatura';
import { SemQuebrar } from './SemQuebrar';

// O visualizador, o editor e o @journey/fluxo ficam num pedaço à parte, que só vem quando a seção chega perto da tela.
const ExemploVivo = dynamic(() => import('./ExemploVivo'), { ssr: false });

/**
 * Os exemplos: quatro abas (uma lista de abas de verdade, como a da /entrar) e, embaixo, o visualizador com o exemplo
 * escolhido. Antes de carregar, a área já tem a altura final e mostra a miniatura do exemplo, pra a página não pular. A
 * aba fica no endereço (`#exemplo-ura`…), pra dar pra mandar o link de um exemplo.
 */
export function Exemplos() {
  const [aba, setAba] = useState<ChaveAba>('ura');
  const [perto, setPerto] = useState(false);
  // O visualizador montou: daí em diante o painel tem botões e sai do Tab ele mesmo.
  const [vivo, setVivo] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const atual = ABAS.find((a) => a.chave === aba)!;

  // A aba do endereço: ao abrir e quando o hash muda (um link de outro exemplo na mesma página). Nenhum elemento tem o
  // id do hash, então quem rola até a seção é daqui.
  useEffect(() => {
    const ler = () => {
      const k = abaDoHash(location.hash);
      if (!k) return;
      setAba(k);
      document.getElementById('exemplos')?.scrollIntoView();
    };
    ler();
    addEventListener('hashchange', ler);
    return () => removeEventListener('hashchange', ler);
  }, []);

  // Carrega o visualizador quando a área chega perto da tela (240 px antes) e não descarrega mais.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        setPerto(true);
        io.disconnect();
      },
      { rootMargin: '0px 0px 240px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const escolher = (k: ChaveAba) => {
    setAba(k);
    // Sem rolar: o hash vai pro endereço, e quem copia o link abre neste exemplo.
    history.replaceState(null, '', hashDaAba(k));
  };

  return (
    <div className="l-exemplos">
      <div
        ref={lista}
        className="l-abas"
        role="tablist"
        aria-label="Exemplos"
        onKeyDown={(e) => {
          const k = abaDaTecla(aba, e.key);
          if (!k) return;
          e.preventDefault();
          escolher(k);
          lista.current?.querySelector<HTMLElement>(`[data-aba="${k}"]`)?.focus();
        }}
      >
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            role="tab"
            id={idDaAba(a.chave)}
            data-aba={a.chave}
            aria-labelledby={`${idDaAba(a.chave)}-nome`}
            aria-describedby={`${idDaAba(a.chave)}-dor`}
            aria-selected={aba === a.chave}
            aria-controls="exemplo-painel"
            tabIndex={aba === a.chave ? 0 : -1}
            className="l-aba"
            style={{ ['--c' as string]: a.cor }}
            onClick={() => escolher(a.chave)}
          >
            {/* O nome é o nome da aba; a dor, a descrição (o leitor de tela lê depois, sem ela virar o nome). */}
            <span className="l-aba-nome" id={`${idDaAba(a.chave)}-nome`}>
              {a.nome}
            </span>
            <span className="l-aba-dor" id={`${idDaAba(a.chave)}-dor`}>
              {a.dor}
            </span>
            <Miniatura chave={a.chave} />
          </button>
        ))}
      </div>
      <div
        ref={area}
        className="l-exemplo-area"
        id="exemplo-painel"
        role="tabpanel"
        aria-labelledby={`${idDaAba(aba)}-nome`}
        // Enquanto o visualizador não chega, o painel não tem nada que receba o foco: ele mesmo recebe.
        tabIndex={vivo ? undefined : 0}
      >
        {/* Por baixo, a miniatura grande: fica à vista até o visualizador chegar e cobrir. */}
        <div className="l-exemplo-espera" style={{ ['--c' as string]: atual.cor }} aria-hidden="true">
          <Miniatura chave={aba} />
        </div>
        {perto && (
          <SemQuebrar>
            <ExemploVivo chave={aba} aoMontar={() => setVivo(true)} />
          </SemQuebrar>
        )}
      </div>
    </div>
  );
}
