'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Documento } from '@journey/fluxo';
import { agora, espera, opcaoDaTecla, rodar, visual as verVisual, voltar as voltarPlay, type Contexto, type Play } from '@/editor/play';
import type { QuadroApi } from './Quadro';

export interface OpcoesPlay {
  /** O documento de agora: o play tira uma cópia dele ao começar (mexer no desenho não muda o play em andamento). */
  doc: Documento;
  ctx: Contexto;
  velocidade: number;
  /** Segundos até seguir sozinho pela primeira opção; 0 é nunca. */
  autoEscolha: number;
  camera: boolean;
  quadro: RefObject<QuadroApi | null>;
  avisar: (texto: string) => void;
  /** Chamado ao começar um play (o editor fecha o campo de nome aberto). */
  aoComecar?: () => void;
}

/**
 * A máquina do play, sem tela: o editor e a página do link usam a mesma. O motor roda tudo de uma vez a partir das
 * escolhas (`rodar`); a tela mostra os eventos um a um (`mostrados`), com a água correndo nos canos.
 */
export function usePlay(o: OpcoesPlay) {
  const [play, setPlay] = useState<Play | null>(null);
  const [docPlay, setDocPlay] = useState<Documento>(o.doc);
  const [mostrados, setMostrados] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [escolhendoInicio, setEscolhendoInicio] = useState<string[] | null>(null);
  // "Simular até aqui": a água para (pausa) quando chega nesta peça pela primeira vez.
  const [pararEm, setPararEm] = useState<string | null>(null);
  const exec = useMemo(() => (play ? rodar(docPlay, o.ctx, play) : null), [play, docPlay, o.ctx]);
  const vis = useMemo(() => (exec ? verVisual(exec.eventos, mostrados) : null), [exec, mostrados]);

  const parar = () => {
    setPlay(null);
    setMostrados(0);
    setEscolhendoInicio(null);
    setPararEm(null);
  };

  /** Toca um play pronto (cenário, "simular até aqui", o cenário inicial do link), do começo, com a água andando. */
  const tocar = (p: Play, ate: string | null = null) => {
    setDocPlay(o.doc);
    setPlay(p);
    setMostrados(0);
    setPausado(false);
    setEscolhendoInicio(null);
    setPararEm(ate);
    o.aoComecar?.();
  };

  const comecarEm = (inicio: string) => tocar({ inicio, quando: play?.quando ?? agora(), modo: play?.modo ?? 'relogio', escolhas: [] });

  /** Dá play no Início selecionado, no único, ou pergunta por qual começar. */
  const darPlay = (selecionado: string | null) => {
    const inicios = o.doc.pecas.filter((p) => p.tipo === 'inicio').map((p) => p.id);
    if (selecionado && inicios.includes(selecionado)) return comecarEm(selecionado);
    if (!inicios.length) return o.avisar('Cria uma peça Início pra dar play.');
    if (inicios.length === 1) return comecarEm(inicios[0]!);
    setPlay(null);
    setEscolhendoInicio(inicios);
  };

  // A água anda: cada evento aparece depois do tempo do anterior (o cano espera a água chegar).
  useEffect(() => {
    if (!exec || pausado) return;
    const ev = exec.eventos;
    if (mostrados >= ev.length) return;
    if (mostrados === 0) return setMostrados(1);
    const e = espera(ev[mostrados - 1]!);
    if (e === 'cano') return;
    const t = setTimeout(() => setMostrados((m) => m + 1), e / o.velocidade);
    return () => clearTimeout(t);
  }, [exec, mostrados, pausado, o.velocidade]);

  // "Simular até aqui": chegou na peça, pausa (dá pra continuar dali).
  useEffect(() => {
    if (!pararEm || vis?.atual !== pararEm) return;
    setPausado(true);
    setPararEm(null);
  }, [vis?.atual, pararEm]);

  // A água que chegou é a do evento `i`: um aviso repetido (ou atrasado, de um cano que já passou) não pula evento.
  const aguaChegou = (i: number) => setMostrados((m) => (m === i ? m + 1 : m));

  const escolher = (conexao: string) => {
    if (!play || !exec?.pendente?.opcoes.some((x) => x.conexao === conexao)) return;
    setPlay({ ...play, escolhas: [...play.escolhas, conexao] });
  };

  const voltar = () => {
    if (!play) return;
    if (!(exec?.escolhas ?? play.escolhas).length) {
      setPlay({ ...play });
      return setMostrados(0);
    }
    const p = voltarPlay(play, exec?.escolhas);
    setPlay(p);
    setMostrados(rodar(docPlay, o.ctx, p).eventos.length);
    setPausado(false);
  };

  const recomecar = () => {
    if (!play) return;
    setPlay({ ...play, escolhas: [] });
    setMostrados(0);
    setPausado(false);
  };

  const mudarQuando = (q: string) => {
    if (!play) return;
    setPlay({ ...play, quando: q, escolhas: [] });
    setMostrados(0);
  };

  const mudarRelogio = (decide: boolean) => {
    if (!play) return;
    setPlay({ ...play, modo: decide ? 'relogio' : 'livre', escolhas: [] });
    setMostrados(0);
  };

  // Escolha automática (pra apresentar) e câmera seguindo a água.
  const escolherRef = useRef(escolher);
  escolherRef.current = escolher;
  useEffect(() => {
    if (!vis?.pergunta || pausado || !o.autoEscolha) return;
    const primeira = vis.pergunta.opcoes[0]!.conexao;
    const t = setTimeout(() => escolherRef.current(primeira), o.autoEscolha * 1000);
    return () => clearTimeout(t);
  }, [vis?.pergunta, pausado, o.autoEscolha]);

  useEffect(() => {
    if (!vis?.atual || !o.camera) return;
    const destinos = docPlay.conexoes.filter((c) => c.de === vis.atual).map((c) => c.para);
    o.quadro.current?.enquadrar([vis.atual, ...destinos]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis?.atual, o.camera, docPlay]);

  /** Tecla com a pergunta na tela: o código de uma opção ou a posição. Devolve se tratou. */
  const tecla = (e: KeyboardEvent): boolean => {
    if (!vis?.pergunta || e.ctrlKey || e.metaKey) return false;
    const valores = new Map(docPlay.conexoes.map((c) => [c.id, c.valor]));
    const x = opcaoDaTecla(vis.pergunta.opcoes, e.key, valores);
    if (!x) return false;
    e.preventDefault();
    escolher(x.conexao);
    return true;
  };

  return {
    play,
    docPlay,
    exec,
    vis,
    mostrados,
    pausado,
    escolhendoInicio,
    /** Está tocando ou perguntando por onde começar. */
    ativo: !!play || !!escolhendoInicio,
    tocar,
    comecarEm,
    darPlay,
    parar,
    escolher,
    voltar,
    recomecar,
    pausar: () => setPausado((p) => !p),
    aguaChegou: () => aguaChegou(mostrados),
    mudarQuando,
    mudarRelogio,
    tecla,
  };
}

export type PlayDaTela = ReturnType<typeof usePlay>;
