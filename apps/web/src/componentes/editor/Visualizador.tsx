'use client';

import './editor.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

/** Daqui pra cima, o embutido põe a gaveta ao lado do quadro; abaixo, por cima (o mesmo número do @container no editor.css). */
const EMBUTIDO_LARGO = 900;
const estreito = (el: HTMLElement | null) => (el?.clientWidth ?? 0) < EMBUTIDO_LARGO;

/**
 * O link público: o fluxo só de leitura (o quadro do editor), o play (o cenário inicial toca sozinho) e o diagnóstico
 * só leitura, com os intencionais e a nota. Sem trava, sem salvamento, sem painel. Tudo vem do retrato montado no
 * servidor: o navegador de quem abre não fala com o banco.
 *
 * `embutido` (os exemplos da landing): dentro de uma página, sem o cabeçalho e o rodapé do link, na altura de quem o
 * contém, com a gaveta do diagnóstico aberta (fechada quando ele é estreito) e o play parado (o "Dar play" fica numa barra em cima do quadro). A roda
 * solta rola a página, e as teclas do play só valem com o foco dentro dele. `quando` é a hora em que o play começa.
 */
export function Visualizador({ retrato: r, embutido = false, quando }: { retrato: Retrato; embutido?: boolean; quando?: string }) {
  const raiz = useRef<HTMLDivElement>(null);
  const quadro = useRef<QuadroApi>(null);
  const [sel, setSel] = useState<Selecao>(null);
  const [destaque, setDestaque] = useState<ReadonlySet<string> | null>(null);
  const [gaveta, setGaveta] = useState(embutido);
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
    quando,
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
  // Embutido e estreito (a gaveta ficaria por cima do fluxo inteiro), começa fechada: o botão dos achados abre. Antes
  // de pintar, pra não piscar aberta.
  useLayoutEffect(() => {
    if (embutido && estreito(raiz.current)) setGaveta(false);
  }, [embutido]);
  // Tela pequena nos dois sentidos: com o play, a gaveta fecha pra não cobrir o cartão. Deitado e mais largo, as
  // duas cabem lado a lado (editor.css). Embutido, conta a largura de quem o contém (a página é larga, o quadro pode
  // não ser).
  useEffect(() => {
    if (!pl.ativo) return;
    if (embutido ? estreito(raiz.current) : matchMedia('(max-height: 600px) and (max-width: 599px)').matches) mudarGaveta(false);
  }, [pl.ativo]);

  // Teclas das opções do play; Esc tira o holofote. Na gaveta, só o Esc (tira o holofote, ou fecha a gaveta).
  const teclas = useRef<(e: KeyboardEvent) => void>(nada);
  teclas.current = (e) => {
    const alvo = e.target as Element | null;
    // Embutido, a página tem outras coisas (as abas): as teclas só valem com o foco aqui dentro.
    if (embutido && !(alvo instanceof Node && raiz.current?.contains(alvo))) return;
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
    const p = alvo && caminhoAte(doc, ctx, alvo, pl.play?.quando ?? quando ?? agora());
    if (!alvo || !p) return setAviso('Nenhum Início chega nesta peça.');
    pl.tocar(p, alvo);
  };

  const versao = r.versao ? `versão ${r.versao.numero} — ${r.versao.nome}, de ${dataCurta(r.de)}` : 'o fluxo de agora';
  const corAgua = (canal: string | null) => corDoCanal(r.estilo, r.canais, canal ?? r.fluxo.canal);
  // O diagnóstico e o play: no topo do link; embutido, numa barra em cima do quadro.
  const botoes = (
    <>
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
    </>
  );

  return (
    <div
      ref={raiz}
      className={`editor visualizador${embutido ? ' embutido' : ''}${r.estilo.ondas ? ' ondas' : ''}${r.estilo.holofote ? ' holofote-on' : ''}${pl.vis?.pergunta ? ' escolhendo' : destaque ? ' destacando' : ''}${pl.ativo ? ' com-play' : ''}${gaveta ? ' com-gaveta' : ''}`}
    >
      {!embutido && (
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
          <div className="empurra">{botoes}</div>
        </header>
      )}
      <div className="quadro-e-gaveta">
        {embutido && <div className="barra-embutida">{botoes}</div>}
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
          rodaRolaPagina={embutido}
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
      {!embutido && <footer className="rodape-link">Feito com Journey</footer>}
      <div role="status">{aviso && <div className="aviso">{aviso}</div>}</div>
      <div className="so-leitor" role="status">
        {anuncio}
      </div>
    </div>
  );
}
