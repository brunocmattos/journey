'use client';

import './editor.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { diagnosticar, type Achado } from '@journey/fluxo';
import { dataCurta } from '@/compartilhar/opcoes';
import type { Retrato } from '@/compartilhar/retrato';
import { Icone } from '@/componentes/Icone';
import { Marca } from '@/componentes/Marca';
import { playDoCenario } from '@/editor/cenarios';
import { caminhoAte, focoDoAchado, pecaDoAchado, rotuloAchados, separar, simulaveis } from '@/editor/diagnostico';
import type { Selecao } from '@/editor/documento';
import { corDoCanal } from '@/editor/estilo';
import { agora } from '@/editor/play';
import { CartaoPlay } from './CartaoPlay';
import { Gaveta } from './Gaveta';
import { Quadro, type QuadroApi } from './Quadro';
import { useAnuncioAdiado } from './useAnuncioAdiado';
import { usePlay } from './usePlay';

const nada = () => {};

/**
 * O link público: o fluxo só de leitura (o quadro do editor), o play (o cenário inicial toca sozinho) e o diagnóstico
 * só leitura, com os intencionais e a nota. Sem trava, sem salvamento, sem painel. Tudo vem do retrato montado no
 * servidor: o navegador de quem abre não fala com o banco.
 */
export function Visualizador({ retrato: r }: { retrato: Retrato }) {
  const quadro = useRef<QuadroApi>(null);
  const [sel, setSel] = useState<Selecao>(null);
  const [destaque, setDestaque] = useState<ReadonlySet<string> | null>(null);
  const [gaveta, setGaveta] = useState(false);
  const [velocidade, setVelocidade] = useState(r.estilo.velocidade);
  const [aviso, setAviso] = useState<string | null>(null);
  const doc = r.documento;
  const ctx = useMemo(() => ({ cadastros: r.cadastros, canal: r.fluxo.canal }), [r]);
  const nomesCadastros = useMemo(() => new Map(r.cadastros.map((k) => [k.id, k.nome])), [r]);
  const estilo = useMemo(() => ({ ...r.estilo, velocidade }), [r, velocidade]);

  const pl = usePlay({
    doc,
    ctx,
    velocidade,
    autoEscolha: r.estilo.autoEscolha,
    camera: r.estilo.camera,
    quadro,
    avisar: setAviso,
    aoComecar: () => setDestaque(null),
  });

  // O cenário inicial toca sozinho, uma vez.
  const tocou = useRef(false);
  useEffect(() => {
    if (tocou.current || !r.cenario) return;
    tocou.current = true;
    pl.tocar(playDoCenario(r.cenario));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2600);
    return () => clearTimeout(t);
  }, [aviso]);

  const botaoDiagnostico = useRef<HTMLButtonElement>(null);
  /** Fechar a gaveta tira o holofote do achado junto. */
  const mudarGaveta = (aberta: boolean) => {
    setGaveta(aberta);
    if (!aberta) setDestaque(null);
  };
  // Tela pequena nos dois sentidos: com o play, a gaveta fecha pra não cobrir o cartão. Deitado e mais largo, as
  // duas cabem lado a lado (editor.css).
  useEffect(() => {
    if (pl.ativo && matchMedia('(max-height: 600px) and (max-width: 599px)').matches) mudarGaveta(false);
  }, [pl.ativo]);

  // Teclas das opções do play; Esc tira o holofote. Na gaveta, só o Esc (tira o holofote, ou fecha a gaveta).
  const teclas = useRef<(e: KeyboardEvent) => void>(nada);
  teclas.current = (e) => {
    const alvo = e.target as Element | null;
    if (alvo?.closest?.('input, textarea, select')) return;
    if (alvo?.closest?.('.gaveta')) {
      if (e.key !== 'Escape') return;
      if (destaque) return setDestaque(null);
      mudarGaveta(false);
      return botaoDiagnostico.current?.focus();
    }
    if (pl.tecla(e)) return;
    if (e.key === 'Escape') setDestaque(null);
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => teclas.current(e);
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, []);

  const achados = useMemo(() => diagnosticar(doc, { cadastros: r.cadastros, ...(r.fluxo.meta_s && { meta_s: r.fluxo.meta_s }) }), [doc, r]);
  const separados = useMemo(() => separar(achados, r.intencionais), [achados, r]);
  const marcas = useMemo(() => new Map(r.intencionais.map((i) => [i.chave, { nota: i.nota, autor: null, criado_em: '' }])), [r]);
  // Uma busca pro documento; o caminho (que roda o motor) só no clique.
  const comCaminho = useMemo(() => simulaveis(doc, achados), [doc, achados]);
  const anuncio = useAnuncioAdiado(`Diagnóstico: ${rotuloAchados(separados.abertos.length)}`);
  const verNoQuadro = (a: Achado) => {
    const f = focoDoAchado(doc, a);
    if (!f) return;
    pl.parar();
    setSel(f.sel);
    setDestaque(f.destaque);
    quadro.current?.enquadrar(f.enquadrar);
  };
  const simularAte = (a: Achado) => {
    const alvo = pecaDoAchado(doc, a);
    const p = alvo && caminhoAte(doc, ctx, alvo, pl.play?.quando ?? agora());
    if (!alvo || !p) return setAviso('Nenhum Início chega nesta peça.');
    pl.tocar(p, alvo);
  };

  const versao = r.versao ? `versão ${r.versao.numero} — ${r.versao.nome}, de ${dataCurta(r.de)}` : 'o fluxo de agora';
  const corAgua = (canal: string | null) => corDoCanal(r.estilo, r.canais, canal ?? r.fluxo.canal);

  return (
    <div className={`editor visualizador${r.estilo.ondas ? ' ondas' : ''}${r.estilo.holofote ? ' holofote-on' : ''}${pl.vis?.pergunta ? ' escolhendo' : destaque ? ' destacando' : ''}${pl.ativo ? ' com-play' : ''}${gaveta ? ' com-gaveta' : ''}`}>
      <header className="topo topo-link">
        <Marca href={null} />
        <div className="titulo-link">
          <span className="mudo">{r.empresa.nome}</span>
          <h1>{r.fluxo.nome}</h1>
        </div>
        <div className="selos-link">
          <span className="selo info">só leitura</span>
          <span className="mudo">{versao}</span>
          {r.esconderNomes && <span className="selo info">nomes escondidos</span>}
          <span className="mudo">{r.expiraEm ? `vale até ${dataCurta(r.expiraEm)}` : 'sem prazo'}</span>
        </div>
        <div className="empurra">
          <button
            ref={botaoDiagnostico}
            className="botao"
            type="button"
            aria-expanded={gaveta}
            aria-controls={gaveta ? 'gaveta-diagnostico' : undefined}
            onClick={() => mudarGaveta(!gaveta)}
            data-testid="botao-diagnostico"
          >
            <Icone nome="alerta" />
            {rotuloAchados(separados.abertos.length)}
          </button>
          <button className="botao primario b-play" type="button" onClick={pl.ativo ? pl.parar : () => pl.darPlay(sel?.tipo === 'peca' ? sel.id : null)}>
            <Icone nome={pl.ativo ? 'parar' : 'play'} />
            {pl.ativo ? 'Parar' : 'Dar play'}
          </button>
        </div>
      </header>
      <div className="quadro-e-gaveta">
        <Quadro
          ref={quadro}
          doc={pl.play ? pl.docPlay : doc}
          estilo={estilo}
          canais={r.canais}
          canalFluxo={r.fluxo.canal}
          nomesCadastros={nomesCadastros}
          sel={sel}
          ferramenta="selecionar"
          soLeitura
          play={pl.vis}
          pausado={pl.pausado}
          aoAguaChegar={pl.aguaChegou}
          renomeando={null}
          destaque={destaque}
          acoes={{
            selecionar: (s) => {
              setSel(s);
              setDestaque(null);
            },
            criar: nada,
            criarLigada: nada,
            ligar: nada,
            mudar: nada,
            renomear: nada,
            gravarNome: nada,
            escolher: pl.escolher,
            usarFerramenta: nada,
          }}
        >
          {pl.ativo && (
            <CartaoPlay
              doc={pl.docPlay}
              play={pl.play}
              visual={pl.vis}
              pausado={pl.pausado}
              velocidade={velocidade}
              autoEscolha={r.estilo.autoEscolha}
              corAgua={corAgua}
              canais={r.canais}
              inicios={pl.escolhendoInicio}
              acoes={{
                escolher: pl.escolher,
                pausar: pl.pausar,
                voltar: pl.voltar,
                recomecar: pl.recomecar,
                parar: pl.parar,
                velocidade: setVelocidade,
                quando: pl.mudarQuando,
                relogio: pl.mudarRelogio,
                comecarEm: pl.comecarEm,
              }}
            />
          )}
        </Quadro>
        {gaveta && (
          <Gaveta
            id="gaveta-diagnostico"
            abertos={separados.abertos}
            intencionais={separados.intencionais}
            antigos={[]}
            marcas={marcas}
            podeSimular={(a) => comCaminho.has(a.chave)}
            soLeitura
            acoes={{ verNoQuadro, simularAte, marcar: async () => false, desmarcar: nada }}
          />
        )}
      </div>
      <footer className="rodape-link">Feito com Journey</footer>
      <div role="status">{aviso && <div className="aviso">{aviso}</div>}</div>
      <div className="so-leitor" role="status">
        {anuncio}
      </div>
    </div>
  );
}
