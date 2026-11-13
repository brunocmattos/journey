'use client';

import { memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Documento, TipoPeca } from '@journey/fluxo';
import { Icone } from '@/componentes/Icone';
import { conteudoDoGrupo, moverGrupoEm, moverNota, moverPeca, redimensionarGrupo, type Selecao } from '@/editor/documento';
import { corDoCanal, type CanalEditor, type Estilo } from '@/editor/estilo';
import { ancora, caminho, envolvente, geometriaCano } from '@/editor/geometria';
import { FORMAS, caixaDe } from '@/editor/pecas';
import type { Visual } from '@/editor/play';
import { AguaCheia, AguaCorrendo } from './Agua';
import { GrupoNoQuadro, NotaNoQuadro, PecaNoQuadro, RotuloCano } from './Pecas';

export type Ferramenta = 'selecionar' | 'mao' | TipoPeca | 'grupo' | 'nota';
export const criaAlgo = (f: Ferramenta): f is TipoPeca | 'grupo' | 'nota' => f !== 'selecionar' && f !== 'mao';

interface Vista {
  x: number;
  y: number;
  k: number;
}

/** O que o editor pede ao quadro: enquadrar, converter coordenadas, o meio da tela, encerrar um arrasto. */
export interface QuadroApi {
  enquadrar(ids: string[] | null, animar?: boolean): void;
  paraMundo(cx: number, cy: number): { x: number; y: number };
  contem(cx: number, cy: number): boolean;
  /** O meio da parte visível do quadro, em coordenadas do mundo. */
  centro(): { x: number; y: number };
  /**
   * Termina o gesto em andamento onde está (sem ligar nem abrir menu). Desfazer ou apagar no meio de um arrasto
   * encerra o arrasto: senão o quadro seguinte reaplicaria a posição em cima do que acabou de ser desfeito.
   */
  encerrarGesto(): void;
}

/** O que o quadro pede ao editor. Mexer no documento é sempre pelo editor (histórico e salvamento). */
export interface AcoesQuadro {
  selecionar(s: Selecao): void;
  criar(f: TipoPeca | 'grupo' | 'nota', x: number, y: number): void;
  criarLigada(origem: string, tipo: TipoPeca, onde?: { x: number; y: number }): void;
  ligar(de: string, para: string): void;
  /**
   * Um quadro de arrasto, como função do documento de AGORA (não de uma cópia do começo do arrasto): o que chega no
   * meio (um responsável vindo do servidor) não some no quadro seguinte. O primeiro entra no histórico, os seguintes
   * substituem.
   */
  mudar(f: (d: Documento) => Documento, primeiro: boolean): void;
  renomear(id: string | null): void;
  gravarNome(id: string, texto: string): void;
  escolher(conexao: string): void;
  usarFerramenta(f: Ferramenta): void;
}

export interface PropsQuadro {
  doc: Documento;
  estilo: Estilo;
  canais: readonly CanalEditor[];
  canalFluxo: string | null;
  nomesCadastros: ReadonlyMap<string, string>;
  sel: Selecao;
  ferramenta: Ferramenta;
  soLeitura: boolean;
  play: Visual | null;
  pausado: boolean;
  aoAguaChegar: () => void;
  renomeando: string | null;
  acoes: AcoesQuadro;
  ref?: React.Ref<QuadroApi>;
  children?: React.ReactNode;
}

/**
 * Um gesto é de um ponteiro só (`ponteiro`): um segundo dedo não mexe no arrasto do primeiro. Cada quadro é aplicado
 * no documento de agora; o grupo guarda só as posições de partida (`inicio`, tirado no primeiro movimento de verdade,
 * depois do texto do painel que grava ao perder o foco), pra o arredondamento na grade não acumular erro.
 */
type Gesto = { ponteiro: number } & (
  | { tipo: 'pan'; x0: number; y0: number; vx: number; vy: number }
  | { tipo: 'ligar'; de: string }
  | { tipo: 'mover'; qual: 'peca' | 'nota'; id: string; dx: number; dy: number; x0: number; y0: number; moveu: boolean }
  | { tipo: 'grupo'; id: string; wx: number; wy: number; inicio: Documento | null; levar: { pecas: string[]; notas: string[] } | null }
  | { tipo: 'redim'; id: string; moveu: boolean }
);

interface Menu {
  x: number;
  y: number;
  titulo: string;
  aoEscolher: (t: TipoPeca) => void;
}

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.5;
const limitar = (v: number, m: number) => Math.max(-m, Math.min(m, v));

export function Quadro({ doc, estilo, canais, canalFluxo, nomesCadastros, sel, ferramenta, soLeitura, play, pausado, aoAguaChegar, renomeando, acoes, ref, children }: PropsQuadro) {
  const palco = useRef<HTMLElement>(null);
  const [vista, setVista] = useState<Vista>({ x: 120, y: 260, k: 1 });
  const vistaRef = useRef(vista);
  vistaRef.current = vista;
  const gesto = useRef<Gesto | null>(null);
  const [temp, setTemp] = useState<{ d: string; alvo: string | null } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [arrastandoQuadro, setArrastandoQuadro] = useState(false);
  const raf = useRef(0);
  const docRef = useRef(doc);
  docRef.current = doc;

  const paraMundo = (cx: number, cy: number) => {
    const r = palco.current!.getBoundingClientRect();
    const v = vistaRef.current;
    return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k };
  };

  /** Zoom em volta de um ponto da tela. Funcional: vários eventos de roda no mesmo quadro se somam. */
  const zoomEm = (k: (atual: number) => number, cx: number, cy: number) => {
    const r = palco.current!.getBoundingClientRect();
    const px = cx - r.left;
    const py = cy - r.top;
    // A pessoa pegou a câmera: a animação (enquadrar, seguir a água) para aqui.
    cancelAnimationFrame(raf.current);
    setVista((v) => {
      const kk = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k(v.k)));
      return { x: px - ((px - v.x) * kk) / v.k, y: py - ((py - v.y) * kk) / v.k, k: kk };
    });
  };

  const animar = (alvo: Vista, comMovimento: boolean) => {
    cancelAnimationFrame(raf.current);
    if (!comMovimento || matchMedia('(prefers-reduced-motion: reduce)').matches) return setVista(alvo);
    const de = vistaRef.current;
    const t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / 520);
      const e = 1 - Math.pow(1 - p, 3);
      setVista({ x: de.x + (alvo.x - de.x) * e, y: de.y + (alvo.y - de.y) * e, k: de.k + (alvo.k - de.k) * e });
      if (p < 1) raf.current = requestAnimationFrame(passo);
    };
    raf.current = requestAnimationFrame(passo);
  };

  /** Na simulação a câmera chega perto (a peça e pra onde ela leva); no "ver tudo", o fluxo inteiro. */
  const enquadrar = (ids: string[] | null, comMovimento = true) => {
    const el = palco.current;
    if (!el) return;
    const d = docRef.current;
    const caixas = ids ? d.pecas.filter((p) => ids.includes(p.id)).map(caixaDe) : [...d.pecas.map(caixaDe), ...d.grupos, ...d.notas];
    const c = envolvente(caixas);
    const W = el.clientWidth;
    const H = el.clientHeight;
    if (!c) return animar({ x: W / 2, y: H / 2, k: 1 }, comMovimento);
    const m = 70;
    const k = ids ? Math.min(1.05, (W - m * 2) / (c.w || 1), (H - m * 2 - 200) / (c.h || 1)) : Math.min(1.2, (W - m * 2) / (c.w || 1), (H - m * 2) / (c.h || 1));
    const kk = Math.max(ids ? 0.55 : 0.25, k);
    animar({ k: kk, x: W / 2 - (c.x + c.w / 2) * kk, y: (ids ? H / 2 - 70 : H / 2) - (c.y + c.h / 2) * kk }, comMovimento);
  };

  const abrirMenu = (cx: number, cy: number, titulo: string, aoEscolher: (t: TipoPeca) => void) => {
    const r = palco.current!.getBoundingClientRect();
    setMenu({ x: Math.max(8, Math.min(cx - r.left, r.width - 270)), y: Math.max(8, Math.min(cy - r.top, r.height - 220)), titulo, aoEscolher });
  };

  useImperativeHandle(ref, () => ({
    enquadrar,
    paraMundo,
    contem: (cx, cy) => {
      const r = palco.current?.getBoundingClientRect();
      return !!r && cx > r.left && cx < r.right && cy > r.top && cy < r.bottom;
    },
    centro: () => paraMundo(...centroTela(palco.current)),
    encerrarGesto: () => cancelar(),
  }));

  // Começa mostrando o fluxo inteiro.
  useEffect(() => {
    enquadrar(null, false);
    return () => cancelAnimationFrame(raf.current);
    // Só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Roda: com Ctrl (ou pinça), zoom; sem, anda. Precisa ser não passivo pra segurar a rolagem da página.
  useEffect(() => {
    const el = palco.current!;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      // Em linhas ou páginas (Firefox), vira pixels. O zoom é limitado por evento: um dente da roda (100 px) não
      // pode dividir o zoom por 2,7; na pinça os passos são pequenos e nem chegam no limite.
      const escala = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dx = e.deltaX * escala;
      const dy = e.deltaY * escala;
      if (e.ctrlKey || e.metaKey) return zoomEm((k) => k * Math.exp(-limitar(dy, 25) * 0.01), e.clientX, e.clientY);
      cancelAnimationFrame(raf.current);
      setVista((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aoApertar = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    // Outro ponteiro já está num gesto (o segundo dedo): fica de fora.
    if (gesto.current && gesto.current.ponteiro !== e.pointerId) return;
    // Um campo do painel com texto ainda não gravado grava agora, contra a seleção de antes. Senão o navegador só
    // tira o foco depois deste pointerdown, com a outra peça já selecionada (e o arrasto já partindo sem o texto).
    const ativo = document.activeElement;
    if (ativo instanceof HTMLElement && ativo.closest('.painel')) ativo.blur();
    if (fim(e.target, '.zoom, .cartao-sim, .menu-rapido, .renomear')) return;
    setMenu(null);
    const w = paraMundo(e.clientX, e.clientY);
    const ponta = fim(e.target, '[data-ponta]');
    const mais = fim(e.target, '[data-mais]');
    const pecaEl = fim(e.target, '[data-peca]');
    const notaEl = fim(e.target, '[data-nota]');
    const rot = fim(e.target, '[data-rotulo]');
    const alvo = fim(e.target, '[data-alvo]');
    const alca = fim(e.target, '[data-alca]');
    const grupoEl = fim(e.target, '[data-grupo]');
    const ponteiro = e.pointerId;
    const capturar = () => palco.current!.setPointerCapture(ponteiro);
    const pan = () => {
      cancelAnimationFrame(raf.current);
      gesto.current = { ponteiro, tipo: 'pan', x0: e.clientX, y0: e.clientY, vx: vistaRef.current.x, vy: vistaRef.current.y };
      setArrastandoQuadro(true);
      capturar();
    };
    if (e.button === 1) {
      e.preventDefault(); // sem a rolagem automática do botão do meio
      return pan();
    }
    if (ferramenta === 'mao') return pan();
    if (play && rot?.classList.contains('escolhivel')) return acoes.escolher(rot.dataset.rotulo!);
    if (mais && !soLeitura) {
      e.preventDefault();
      const id = mais.dataset.mais!;
      const r = mais.getBoundingClientRect();
      return abrirMenu(r.right + 6, r.top - 8, 'Próxima peça', (t) => acoes.criarLigada(id, t));
    }
    if (ponta && !soLeitura) {
      e.preventDefault();
      gesto.current = { ponteiro, tipo: 'ligar', de: ponta.dataset.ponta! };
      capturar();
      return moverLigacao(e.clientX, e.clientY);
    }
    if (criaAlgo(ferramenta) && !pecaEl && !notaEl && !soLeitura) {
      e.preventDefault(); // sem isso o navegador tira o foco do campo de nome logo depois
      acoes.criar(ferramenta, w.x, w.y);
      return acoes.usarFerramenta('selecionar');
    }
    if (pecaEl || notaEl) {
      const qual = pecaEl ? 'peca' : 'nota';
      const id = (pecaEl ?? notaEl)!.dataset[qual]!;
      if (!(sel?.tipo === qual && sel.id === id)) acoes.selecionar({ tipo: qual, id });
      if (play || soLeitura) return;
      const item = qual === 'peca' ? doc.pecas.find((p) => p.id === id)! : doc.notas.find((n) => n.id === id)!;
      gesto.current = { ponteiro, tipo: 'mover', qual, id, dx: w.x - item.x, dy: w.y - item.y, x0: e.clientX, y0: e.clientY, moveu: false };
      return capturar();
    }
    if (rot || alvo) return acoes.selecionar({ tipo: 'conexao', id: (rot ?? alvo)!.dataset.rotulo ?? alvo!.dataset.alvo! });
    if (alca && !soLeitura && !play) {
      gesto.current = { ponteiro, tipo: 'redim', id: alca.dataset.alca!, moveu: false };
      return capturar();
    }
    if (grupoEl) {
      const id = grupoEl.dataset.grupo!;
      acoes.selecionar({ tipo: 'grupo', id });
      if (play || soLeitura) return;
      gesto.current = { ponteiro, tipo: 'grupo', id, wx: w.x, wy: w.y, inicio: null, levar: null };
      return capturar();
    }
    if (sel) acoes.selecionar(null);
    pan();
  };

  const moverLigacao = (cx: number, cy: number) => {
    const g = gesto.current;
    if (g?.tipo !== 'ligar') return;
    const a = docRef.current.pecas.find((p) => p.id === g.de);
    if (!a) return;
    const w = paraMundo(cx, cy);
    const sob = (document.elementFromPoint(cx, cy) as Element | null)?.closest('[data-peca]') as HTMLElement | null;
    const alvo = sob && sob.dataset.peca !== g.de ? sob.dataset.peca! : null;
    setTemp({ d: caminho(ancora(caixaDe(a), 'd'), { x: w.x, y: w.y, nx: -1, ny: 0 }, 'suave'), alvo });
  };

  /** Acaba o gesto sem ligar nem abrir menu (o sistema tomou o ponteiro, ou o botão já estava solto). */
  const cancelar = () => {
    gesto.current = null;
    setTemp(null);
    setArrastandoQuadro(false);
  };
  const doGesto = (e: React.PointerEvent) => gesto.current?.ponteiro === e.pointerId;

  const aoMover = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g || g.ponteiro !== e.pointerId) return;
    // O botão foi solto sem o pointerup chegar aqui (fora da janela, alerta do sistema): o gesto acabou.
    if (e.pointerType === 'mouse' && e.buttons === 0) return cancelar();
    const w = paraMundo(e.clientX, e.clientY);
    if (g.tipo === 'pan') return setVista((v) => ({ ...v, x: g.vx + e.clientX - g.x0, y: g.vy + e.clientY - g.y0 }));
    if (g.tipo === 'ligar') return moverLigacao(e.clientX, e.clientY);
    if (g.tipo === 'mover') {
      if (!g.moveu && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 4) return;
      const primeiro = !g.moveu;
      g.moveu = true;
      // Posição absoluta: aplicar no documento de agora não perde nada do que mudou no meio.
      const mover = g.qual === 'peca' ? moverPeca : moverNota;
      const [id, x, y] = [g.id, w.x - g.dx, w.y - g.dy];
      return acoes.mudar((d) => mover(d, id, x, y), primeiro);
    }
    if (g.tipo === 'grupo') {
      const dx = w.x - g.wx;
      const dy = w.y - g.wy;
      if (!g.inicio && Math.hypot(dx, dy) < 5) return;
      const primeiro = !g.inicio;
      const inicio = (g.inicio ??= docRef.current);
      const levar = (g.levar ??= conteudoDoGrupo(inicio, g.id));
      const id = g.id;
      return acoes.mudar((d) => moverGrupoEm(d, inicio, id, dx, dy, levar), primeiro);
    }
    if (g.tipo === 'redim') {
      const primeiro = !g.moveu;
      g.moveu = true;
      const [id, x, y] = [g.id, w.x, w.y];
      acoes.mudar((d) => {
        const gr = d.grupos.find((k) => k.id === id);
        return gr ? redimensionarGrupo(d, id, x - gr.x, y - gr.y) : d;
      }, primeiro);
    }
  };

  const aoSoltar = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g || g.ponteiro !== e.pointerId) return;
    gesto.current = null;
    setArrastandoQuadro(false);
    if (g.tipo !== 'ligar') return;
    setTemp(null);
    const sob = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-peca]') as HTMLElement | null;
    if (sob && sob.dataset.peca !== g.de) return acoes.ligar(g.de, sob.dataset.peca!);
    if (!sob) {
      const w = paraMundo(e.clientX, e.clientY);
      abrirMenu(e.clientX + 6, e.clientY - 8, 'Criar e ligar', (t) => acoes.criarLigada(g.de, t, w));
    }
  };

  const aoDoisCliques = (e: React.MouseEvent) => {
    // Com o ponteiro capturado pelo palco (o arrasto começa no primeiro clique), o evento chega no palco: o alvo de
    // verdade é o que está debaixo do mouse.
    const alvo = document.elementFromPoint(e.clientX, e.clientY);
    if (fim(alvo, '.zoom, .cartao-sim, .menu-rapido, .renomear') || play) return;
    const pecaEl = fim(alvo, '[data-peca]');
    const notaEl = fim(alvo, '[data-nota]');
    if (pecaEl || notaEl) return soLeitura ? undefined : acoes.renomear((pecaEl?.dataset.peca ?? notaEl?.dataset.nota)!);
    if (fim(alvo, '[data-grupo], [data-rotulo], [data-alvo]') || soLeitura) return;
    const w = paraMundo(e.clientX, e.clientY);
    abrirMenu(e.clientX + 4, e.clientY - 8, 'Criar aqui', (t) => acoes.criar(t, w.x, w.y));
  };

  /**
   * Peça, nota ou rótulo ativados sem ponteiro (teclado, leitor de tela): seleciona; Enter na já selecionada renomeia,
   * como os dois cliques. Na pergunta do play, o rótulo da opção escolhe.
   */
  const ativar = (el: HTMLElement, enter: boolean) => {
    const rotulo = el.dataset.rotulo;
    if (rotulo) return play && el.classList.contains('escolhivel') ? acoes.escolher(rotulo) : acoes.selecionar({ tipo: 'conexao', id: rotulo });
    const qual = el.dataset.peca ? 'peca' : el.dataset.nota ? 'nota' : 'grupo';
    const id = (el.dataset.peca ?? el.dataset.nota ?? el.dataset.grupo)!;
    if (!(sel?.tipo === qual && sel.id === id)) return acoes.selecionar({ tipo: qual, id });
    if (enter && !soLeitura && !play) acoes.renomear(id);
  };

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target as HTMLElement;
    // No + o Enter vira clique (abre o menu); não pode chegar no atalho de renomear do editor.
    if (el.dataset.mais) return e.stopPropagation();
    if (!el.matches('[data-peca], [data-nota], [data-grupo], [data-rotulo]')) return;
    e.preventDefault();
    e.stopPropagation();
    ativar(el, e.key === 'Enter');
  };

  /**
   * Foco pelo teclado (Tab) numa peça, nota, grupo ou rótulo fora da parte visível: anda o quadro até ele, sem mudar o
   * zoom. Só no foco de teclado (`:focus-visible`): o foco de um clique não pode mexer o quadro no meio de um arrasto.
   * Mede no quadro seguinte, depois que o onScroll devolveu o palco a (0, 0) (o navegador rola pra mostrar o foco).
   */
  const aoFocar = (e: React.FocusEvent) => {
    const el = e.target as HTMLElement;
    if (!el.matches('[data-peca], [data-nota], [data-grupo], [data-rotulo]') || !el.matches(':focus-visible')) return;
    requestAnimationFrame(() => {
      const p = palco.current;
      if (!p || !el.isConnected) return;
      const r = p.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const m = 40;
      if (b.left >= r.left + m && b.right <= r.right - m && b.top >= r.top + m && b.bottom <= r.bottom - m) return;
      const v = vistaRef.current;
      animar({ k: v.k, x: v.x + r.left + r.width / 2 - (b.left + b.width / 2), y: v.y + r.top + r.height / 2 - (b.top + b.height / 2) }, true);
    });
  };

  // Clique sem ponteiro (o leitor de tela ativando o botão, Enter no +): `detail` 0. O de mouse o pointerdown já tratou.
  const aoClicar = (e: React.MouseEvent) => {
    if (e.detail !== 0) return;
    const mais = fim(e.target, '[data-mais]');
    if (mais) {
      if (soLeitura || play) return;
      const id = mais.dataset.mais!;
      const r = mais.getBoundingClientRect();
      return abrirMenu(r.right + 6, r.top - 8, 'Próxima peça', (t) => acoes.criarLigada(id, t));
    }
    const alvo = fim(e.target, '[data-peca], [data-nota], [data-grupo], [data-rotulo]');
    if (alvo) ativar(alvo, false);
  };

  const cor = (canal: string | null | undefined) => corDoCanal(estilo, canais, canal ?? canalFluxo);
  const canalPrincipal = canais.find((c) => c.chave === canalFluxo);
  const semInicio = doc.pecas.length > 0 && !doc.pecas.some((p) => p.tipo === 'inicio');

  return (
    <section
      ref={palco}
      className={`palco${ferramenta === 'mao' ? ' mao' : ''}${arrastandoQuadro ? ' arrastando-quadro' : ''}${criaAlgo(ferramenta) ? ' criando' : ''}`}
      aria-label="Quadro do fluxo"
      style={{ backgroundSize: `${24 * vista.k}px ${24 * vista.k}px`, backgroundPosition: `${vista.x}px ${vista.y}px` }}
      onPointerDown={aoApertar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={(e) => doGesto(e) && cancelar()}
      onLostPointerCapture={(e) => doGesto(e) && cancelar()}
      onDoubleClick={aoDoisCliques}
      onKeyDown={aoTeclar}
      onClick={aoClicar}
      onFocus={aoFocar}
      // O palco tem overflow hidden, mas o navegador ainda rola ele pra mostrar um elemento com foco: volta pro lugar.
      onScroll={(e) => {
        e.currentTarget.scrollLeft = 0;
        e.currentTarget.scrollTop = 0;
      }}
      data-testid="quadro"
    >
      <div className="mundo" style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.k})` }}>
        <Mundo
          doc={doc}
          estilo={estilo}
          canais={canais}
          canalFluxo={canalFluxo}
          nomesCadastros={nomesCadastros}
          sel={sel}
          soLeitura={soLeitura}
          play={play}
          pausado={pausado}
          aoAguaChegar={aoAguaChegar}
          renomeando={renomeando}
          temp={temp}
          acoes={acoes}
        />
      </div>

      {doc.pecas.length === 0 && doc.notas.length === 0 && (
        <div className="vazio-quadro">
          <div>
            <b>Quadro em branco</b>
            <span>{soLeitura ? 'Este fluxo ainda não tem peças.' : 'Arraste uma forma da barra da esquerda, ou dê dois cliques aqui pra criar.'}</span>
          </div>
        </div>
      )}
      <div className="hud">
        <span className="pilula" style={{ ['--c' as string]: cor(canalFluxo) }} data-testid="canal-principal">
          <span className="ponto-cor" />
          {canalPrincipal?.nome ?? 'sem canal'}
        </span>
        <span className="pilula">
          {doc.pecas.length} peças · {doc.conexoes.length} ligações
        </span>
        {semInicio && <span className="pilula">sem Início: o play precisa de um</span>}
      </div>
      {!soLeitura && <div className="atalhos">Dois cliques no quadro cria · puxe a bolinha pra ligar · Del apaga · Ctrl+Z desfaz · Ctrl+roda dá zoom</div>}
      <div className="zoom">
        <button className="bi" type="button" aria-label="Diminuir zoom" onClick={() => zoomEm((k) => k / 1.2, ...centroTela(palco.current))}>
          <Icone nome="menos" />
        </button>
        <span>{Math.round(vista.k * 100)}%</span>
        <button className="bi" type="button" aria-label="Aumentar zoom" onClick={() => zoomEm((k) => k * 1.2, ...centroTela(palco.current))}>
          <Icone nome="mais" />
        </button>
        <button className="bi" type="button" aria-label="Ver o fluxo inteiro" title="Ver o fluxo inteiro" onClick={() => enquadrar(null)}>
          <Icone nome="enquadrar" />
        </button>
      </div>
      {menu && (
        <div className="menu-rapido" style={{ left: menu.x, top: menu.y }} role="menu" aria-label={menu.titulo} onPointerDown={(e) => e.stopPropagation()}>
          <div className="titulo-menu">{menu.titulo}</div>
          {(Object.keys(FORMAS) as TipoPeca[]).map((t, i) => (
            <button
              key={t}
              type="button"
              role="menuitem"
              autoFocus={i === 0}
              onClick={() => {
                setMenu(null);
                menu.aoEscolher(t);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return;
                // Fecha só o menu: o Esc do editor tiraria também a seleção.
                e.stopPropagation();
                setMenu(null);
              }}
            >
              <Icone nome={t} />
              {FORMAS[t].nome}
            </button>
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

const fim = (alvo: EventTarget | null, seletor: string) => (alvo as Element | null)?.closest?.(seletor) as HTMLElement | null;

interface PropsMundo {
  doc: Documento;
  estilo: Estilo;
  canais: readonly CanalEditor[];
  canalFluxo: string | null;
  nomesCadastros: ReadonlyMap<string, string>;
  sel: Selecao;
  soLeitura: boolean;
  play: Visual | null;
  pausado: boolean;
  aoAguaChegar: () => void;
  renomeando: string | null;
  temp: { d: string; alvo: string | null } | null;
  acoes: AcoesQuadro;
}

/**
 * O que está dentro do mundo (grupos, canos, peças, rótulos). Memorizado e sem a vista: andar e dar zoom só mudam o
 * transform do `.mundo`, sem redesenhar os canos a cada quadro.
 */
const Mundo = memo(function Mundo({ doc, estilo, canais, canalFluxo, nomesCadastros, sel, soLeitura, play, pausado, aoAguaChegar, renomeando, temp, acoes }: PropsMundo) {
  const pecas = useMemo(() => new Map(doc.pecas.map((p) => [p.id, p])), [doc.pecas]);
  const canos = useMemo(() => {
    // Ida e volta entre as mesmas peças: cada cano vai pra um lado, senão ficam um em cima do outro.
    const pares = new Set(doc.conexoes.map((c) => `${c.de}>${c.para}`));
    return doc.conexoes.flatMap((c) => {
      const a = pecas.get(c.de);
      const b = pecas.get(c.para);
      if (!a || !b) return [];
      const desvio = a.id !== b.id && pares.has(`${c.para}>${c.de}`) ? (c.de < c.para ? -9 : 9) : 0;
      return [{ c, geo: geometriaCano(caixaDe(a), caixaDe(b), estilo.curva, a.id === b.id, desvio) }];
    });
  }, [doc.conexoes, pecas, estilo.curva]);

  // A simulação: o que está molhado, a pergunta (holofote) e a água.
  const foco = new Set<string>();
  if (play?.pergunta) {
    foco.add(play.pergunta.peca);
    for (const o of play.pergunta.opcoes) foco.add(o.para);
  }
  const escolhiveis = new Set(play?.pergunta?.opcoes.map((o) => o.conexao) ?? []);
  const cor = (canal: string | null | undefined) => corDoCanal(estilo, canais, canal ?? canalFluxo);
  const esp = estilo.espessura;
  const marcador = (id: string, cor: string) => (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="6"
      refY="5"
      markerWidth={estilo.cano === 'cano' ? esp * 1.6 : 4.2}
      markerHeight={estilo.cano === 'cano' ? esp * 1.6 : 4.2}
      orient="auto-start-reverse"
      markerUnits={estilo.cano === 'cano' ? 'userSpaceOnUse' : 'strokeWidth'}
    >
      <path d="M0,0 L10,5 L0,10 z" style={{ fill: cor }} />
    </marker>
  );
  // O campo de nome por cima do que está sendo renomeado: peça (no título), nota (o texto todo) ou grupo (na etiqueta).
  const campo = ((): { id: string; valor: string; nota: boolean; rotulo: string; x: number; y: number; w: number; h: number | undefined } | null => {
    if (!renomeando) return null;
    const p = doc.pecas.find((x) => x.id === renomeando);
    if (p) return { id: p.id, valor: p.nome, nota: false, rotulo: 'Nome da peça', x: p.x, y: p.tipo === 'decisao' ? p.y + FORMAS.decisao.h / 2 - 18 : p.y + 2, w: FORMAS[p.tipo].w, h: undefined };
    const n = doc.notas.find((x) => x.id === renomeando);
    if (n) return { id: n.id, valor: n.texto, nota: true, rotulo: 'Texto da nota', x: n.x, y: n.y + 2, w: n.w, h: n.h };
    const g = doc.grupos.find((x) => x.id === renomeando);
    if (g) return { id: g.id, valor: g.nome, nota: false, rotulo: 'Nome do grupo', x: g.x + 10, y: g.y - 18, w: Math.max(140, Math.min(g.w - 20, 280)), h: undefined };
    return null;
  })();

  return (
    <>
      <div className="camada">
        {doc.grupos.map((g) => (
          <GrupoNoQuadro key={g.id} grupo={g} selecionado={sel?.tipo === 'grupo' && sel.id === g.id} />
        ))}
      </div>
      <svg className="canos" aria-hidden="true">
        <defs>
          {marcador('seta', 'var(--pipe-wall)')}
          {marcador('seta-sel', 'var(--accent)')}
        </defs>
        <g transform="translate(20000 20000)">
          {canos.map(({ c, geo }) => {
            const selecionado = sel?.tipo === 'conexao' && sel.id === c.id;
            const seta = `url(#${selecionado ? 'seta-sel' : 'seta'})`;
            return (
              <g key={c.id} className={`cano${selecionado ? ' sel' : ''}${escolhiveis.has(c.id) ? ' foco' : ''}`} data-cano={c.id}>
                {estilo.cano === 'cano' ? (
                  <>
                    <path className="parede" d={geo.d} strokeWidth={esp} markerEnd={seta} />
                    <path className="nucleo" d={geo.d} strokeWidth={Math.max(1, esp - 4)} />
                    <path className="reflexo" d={geo.d} strokeWidth={Math.max(0.6, esp / 6)} transform={`translate(0 ${-esp / 5})`} />
                  </>
                ) : (
                  <path className="linha" d={geo.d} strokeWidth={Math.max(1.4, esp / 3.2)} markerEnd={seta} strokeDasharray={estilo.cano === 'tracejado' ? `${esp * 0.9} ${esp * 0.7}` : undefined} />
                )}
                <path className="alvo" d={geo.d} data-alvo={c.id} />
              </g>
            );
          })}
          {temp && (
            <g className="cano temp">
              <path className="linha" d={temp.d} strokeWidth={2.5} />
            </g>
          )}
        </g>
        <g transform="translate(20000 20000)">
          {play &&
            canos.map(({ c, geo }) => {
              if (play.cheias.has(c.id)) return <AguaCheia key={c.id} d={geo.d} cor={cor(play.cheias.get(c.id))} estilo={estilo} />;
              if (play.correndo?.conexao === c.id)
                return <AguaCorrendo key={`${c.id}:correndo`} d={geo.d} cor={cor(play.correndo.canal)} estilo={estilo} pausado={pausado} aoChegar={aoAguaChegar} />;
              return null;
            })}
        </g>
      </svg>
      <div className="camada">
        {doc.notas.map((n) => (
          <NotaNoQuadro key={n.id} nota={n} selecionada={sel?.tipo === 'nota' && sel.id === n.id} />
        ))}
        {doc.pecas.map((p) => {
          const canal = p.canal ? canais.find((c) => c.chave === p.canal) : undefined;
          return (
            <PecaNoQuadro
              key={p.id}
              peca={p}
              selecionada={(sel?.tipo === 'peca' && sel.id === p.id) || temp?.alvo === p.id}
              {...(p.responsavel && nomesCadastros.has(p.responsavel) && { responsavel: nomesCadastros.get(p.responsavel)! })}
              {...(canal && { canalNome: canal.nome, canalCor: cor(canal.chave) })}
              corInicio={cor(p.canal)}
              {...(play && {
                ...(play.molhadas.has(p.id) && { agua: cor(play.molhadas.get(p.id)) }),
                atual: play.atual === p.id,
                perguntando: play.pergunta?.peca === p.id,
                foco: foco.has(p.id),
              })}
              soLeitura={soLeitura || !!play}
            />
          );
        })}
        {canos.map(({ c, geo }) => (
          <RotuloCano
            key={c.id}
            conexao={c}
            x={geo.meio.x}
            y={geo.meio.y}
            selecionado={sel?.tipo === 'conexao' && sel.id === c.id}
            escolhivel={escolhiveis.has(c.id)}
            {...(play && { corAgua: cor(play.canal) })}
          />
        ))}
        {campo && (
          <CampoNome
            key={campo.id}
            valor={campo.valor}
            nota={campo.nota}
            rotulo={campo.rotulo}
            x={campo.x}
            y={campo.y}
            w={campo.w}
            h={campo.h}
            aoTerminar={(texto) => (texto === null ? acoes.renomear(null) : acoes.gravarNome(campo.id, texto))}
          />
        )}
      </div>
    </>
  );
});

const centroTela = (el: HTMLElement | null): [number, number] => {
  const r = el?.getBoundingClientRect();
  return r ? [r.left + r.width / 2, r.top + r.height / 2] : [0, 0];
};

/** O campo de nome em cima da peça (ou o texto da nota). Enter grava, Esc desiste; sair do campo grava. */
function CampoNome({
  valor,
  nota,
  rotulo,
  x,
  y,
  w,
  h,
  aoTerminar,
}: {
  valor: string;
  nota: boolean;
  rotulo: string;
  x: number;
  y: number;
  w: number;
  h: number | undefined;
  aoTerminar: (texto: string | null) => void;
}) {
  const feito = useRef(false);
  const fim = (texto: string | null) => {
    if (feito.current) return;
    feito.current = true;
    aoTerminar(texto);
  };
  const props = {
    className: 'renomear',
    defaultValue: valor,
    autoFocus: true,
    'aria-label': rotulo,
    style: { left: x, top: y, width: w, height: h ?? 'auto' },
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.currentTarget.select(),
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => fim(e.currentTarget.value),
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !(nota && e.shiftKey)) {
        e.preventDefault();
        fim(e.currentTarget.value);
      }
      if (e.key === 'Escape') fim(null);
    },
  };
  return nota ? <textarea {...props} /> : <input type="text" {...props} />;
}
