'use client';

import './editor.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { lerDocumento, type Cadastro, type Documento, type TipoPeca } from '@journey/fluxo';
import { criarCadastro, renomearCadastro } from '@/acoes/cadastros';
import { apagarFluxo, mudarFluxo, type DadosDoFluxo } from '@/acoes/fluxos';
import { Icone } from '@/componentes/Icone';
import type { TipoCadastro } from '@/editor/cadastros';
import * as D from '@/editor/documento';
import { corDoCanal, lerEstilo, type CanalEditor, type Estilo } from '@/editor/estilo';
import { comecar, desfazer, refazer, registrar, substituir, type Historico } from '@/editor/historico';
import { FORMAS, ORDEM_FORMAS } from '@/editor/pecas';
import { agora, espera, opcaoDaTecla, rodar, visual as verVisual, voltar as voltarPlay, type Play } from '@/editor/play';
import { Salvamento, copiaValida, motivoDoErro, type Situacao } from '@/editor/salvamento';
import { FUSO } from '@/lib/fuso';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { CartaoPlay } from './CartaoPlay';
import { Painel, type Aba, type DadosFluxo } from './Painel';
import { Quadro, criaAlgo, type Ferramenta, type QuadroApi } from './Quadro';

export interface PropsEditor {
  empresaId: string;
  fluxo: { id: string; revisao: number; documento: Documento; estilo: unknown } & DadosFluxo;
  canais: readonly CanalEditor[];
  cadastros: readonly Cadastro[];
  tipos: readonly TipoCadastro[];
}

/** Ids curtos e únicos o bastante dentro de um fluxo. */
const novoId = (prefixo: string) => `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const chaveLocal = (id: string) => `journey:fluxo:${id}`;
/** A trava vale 10 minutos; o editor renova antes de vencer. */
const RENOVAR_TRAVA = 4 * 60 * 1000;

type Trava = { estado: 'pegando' } | { estado: 'minha' } | { estado: 'outra'; por: string | null; ate: string | null };

export function Editor({ empresaId, fluxo, canais, cadastros: cadastrosIniciais, tipos }: PropsEditor) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseNavegador(), []);
  const quadro = useRef<QuadroApi>(null);

  const [hist, setHist] = useState<Historico>(() => comecar(fluxo.documento));
  const doc = hist.atual;
  const [estilo, setEstilo] = useState<Estilo>(() => lerEstilo(fluxo.estilo));
  const [dados, setDados] = useState<DadosFluxo>({ nome: fluxo.nome, descricao: fluxo.descricao, canal: fluxo.canal, meta_s: fluxo.meta_s });
  const [cadastros, setCadastros] = useState<readonly Cadastro[]>(cadastrosIniciais);
  const [sel, setSel] = useState<D.Selecao>(null);
  const [ferramenta, setFerramenta] = useState<Ferramenta>('selecionar');
  const [aba, setAba] = useState<Aba>('prop');
  const [painelAberto, setPainelAberto] = useState(false);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<{ s: Situacao; mensagem?: string }>({ s: 'salvo' });
  const [aviso, setAviso] = useState<string | null>(null);
  const [trava, setTrava] = useState<Trava>({ estado: 'pegando' });
  const [fantasma, setFantasma] = useState<{ t: Ferramenta; x: number; y: number } | null>(null);

  const parado = situacao.s === 'conflito' || situacao.s === 'sem_trava' || situacao.s === 'recusado';
  const soLeitura = trava.estado !== 'minha' || parado;

  const avisar = (t: string) => setAviso(t);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2600);
    return () => clearTimeout(t);
  }, [aviso]);

  // Salvamento automático: o documento e o estilo vão pelo salvar_fluxo, com a revisão.
  const salv = useRef<Salvamento | null>(null);
  salv.current ??= new Salvamento({
    revisao: fluxo.revisao,
    enviar: async (revisao, documento, est, sinal) => {
      // O banco só confere a forma: um documento que o lerDocumento recusa salvaria e depois não abriria mais.
      const lido = lerDocumento(documento);
      if (!lido.documento) return { ok: false, motivo: 'recusado', mensagem: lido.problemas.map((p) => p.mensagem).join(' ') };
      const r = await supabase.rpc('salvar_fluxo', { p_fluxo: fluxo.id, p_revisao: revisao, p_documento: documento, p_estilo: est }).abortSignal(sinal);
      return r.error ? motivoDoErro(r.error, r.status) : { ok: true, revisao: r.data as number };
    },
    // Pra saber se um envio que ficou sem resposta chegou (senão o próximo daria um falso conflito).
    ler: async () => {
      const r = await supabase.from('fluxos').select('revisao, documento, estilo').eq('id', fluxo.id).maybeSingle();
      return r.data;
    },
    aoMudar: (s, mensagem) => setSituacao({ s, ...(mensagem && { mensagem }) }),
    guardar: (copia) => {
      try {
        if (copia) localStorage.setItem(chaveLocal(fluxo.id), JSON.stringify(copia));
        else localStorage.removeItem(chaveLocal(fluxo.id));
      } catch {
        // Sem armazenamento no navegador: segue sem a cópia.
      }
    },
  });

  // Trava: pega ao abrir e renova; quem não tem a trava só vê (e dá play). Ao sair, solta.
  const token = useRef<string | null>(null);
  const minha = useRef(false);
  useEffect(() => {
    let vivo = true;
    const pegar = async () => {
      const r = await supabase.rpc('pegar_trava', { p_fluxo: fluxo.id });
      if (!vivo) return;
      const d = r.data as { ok: boolean; por?: string | null; ate?: string | null } | null;
      if (r.error || !d) return setTrava({ estado: 'outra', por: null, ate: null });
      if (!d.ok) {
        minha.current = false;
        return setTrava({ estado: 'outra', por: d.por ?? null, ate: d.ate ?? null });
      }
      if (!minha.current) {
        minha.current = true;
        recuperarCopia();
      }
      setTrava({ estado: 'minha' });
    };
    void pegar();
    void supabase.auth.getSession().then(({ data }) => (token.current = data.session?.access_token ?? null));
    const intervalo = setInterval(() => void pegar(), RENOVAR_TRAVA);
    const soltar = () => {
      if (!minha.current || !token.current) return;
      // keepalive: o pedido segue mesmo com a página fechando.
      void fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/soltar_trava`, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${token.current}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_fluxo: fluxo.id }),
      }).catch(() => {});
    };
    const antesDeSair = (e: BeforeUnloadEvent) => {
      if (salv.current?.sujo) {
        void salv.current.agora();
        e.preventDefault();
      }
    };
    addEventListener('pagehide', soltar);
    addEventListener('beforeunload', antesDeSair);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      removeEventListener('pagehide', soltar);
      removeEventListener('beforeunload', antesDeSair);
      // Saindo pra outra tela: espera o que falta chegar e solta a trava. Sem `parar`: no modo estrito do React a
      // limpeza roda uma vez ao montar, e sem rede o salvamento segue tentando (a cópia está no navegador).
      void salv.current?.agora().finally(soltar);
    };
    // Uma vez por fluxo aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fluxo.id]);

  /** O que não chegou no banco da última vez (sem rede) e partiu da mesma revisão volta pro quadro. */
  function recuperarCopia() {
    let copia = null;
    try {
      copia = copiaValida(JSON.parse(localStorage.getItem(chaveLocal(fluxo.id)) ?? 'null'), fluxo.revisao);
    } catch {
      return;
    }
    if (!copia) return;
    setHist(comecar(copia.documento));
    setEstilo(lerEstilo(copia.estilo));
    salv.current!.mudou(copia.documento, lerEstilo(copia.estilo));
    avisar('Voltaram as mudanças que não tinham chegado ao banco.');
  }

  // ---------- Mudanças no documento ----------
  const parar = () => {
    setPlay(null);
    setMostrados(0);
    setEscolhendoInicio(null);
  };

  const editar = (novo: Documento, selecao?: D.Selecao) => {
    if (soLeitura || novo === doc) return;
    if (play) parar();
    setHist(registrar(hist, novo));
    salv.current!.mudou(novo, estilo);
    if (selecao !== undefined) setSel(selecao);
  };

  const mudarEstilo = (e: Estilo) => {
    setEstilo(e);
    if (!soLeitura) salv.current!.mudou(doc, e);
  };

  const historia = (f: (h: Historico) => Historico) => {
    if (soLeitura) return;
    if (play) parar();
    const h = f(hist);
    if (h === hist) return;
    setHist(h);
    salv.current!.mudou(h.atual, estilo);
    if (!D.existe(h.atual, sel)) setSel(null);
  };

  const criar = (f: TipoPeca | 'grupo' | 'nota', x: number, y: number) => {
    const id = novoId(f === 'grupo' ? 'g' : f === 'nota' ? 'n' : 'p');
    if (f === 'grupo') return editar(D.criarGrupo(doc, id, x, y), { tipo: 'grupo', id });
    if (f === 'nota') {
      editar(D.criarNota(doc, id, x, y), { tipo: 'nota', id });
      return setRenomeando(id);
    }
    editar(D.criarPeca(doc, id, f, x, y), { tipo: 'peca', id });
    setRenomeando(id);
  };

  const ligar = (de: string, para: string) => {
    const r = D.ligar(doc, novoId('c'), de, para);
    if ('erro' in r) return r.erro === 'repetida' && avisar('Essas duas peças já estão ligadas.');
    editar(r.doc, { tipo: 'conexao', id: r.conexao.id });
  };

  const criarLigada = (origem: string, tipo: TipoPeca, onde?: { x: number; y: number }) => {
    const id = novoId('p');
    editar(D.criarLigada(doc, id, novoId('c'), origem, tipo, onde), { tipo: 'peca', id });
    setRenomeando(id);
  };

  const apagarSelecao = () => {
    if (!sel) return;
    editar(D.apagar(doc, sel), null);
  };

  const duplicar = (id: string) => {
    const novo = novoId('p');
    editar(D.duplicar(doc, id, novo), { tipo: 'peca', id: novo });
  };

  const selecionar = (s: D.Selecao) => {
    setSel(s);
    if (s) setAba('prop');
    if (s && innerWidth <= 820) setPainelAberto(true);
  };

  // ---------- Dados do fluxo (colunas) e cadastros ----------
  const mudarDados = async (d: DadosDoFluxo) => {
    const antes = dados;
    setDados({ ...dados, ...d } as DadosFluxo);
    const r = await mudarFluxo(empresaId, fluxo.id, d);
    if (r.erro) {
      setDados(antes);
      avisar(r.erro);
    }
  };

  const criarUmCadastro = async (tipo: string, nome: string): Promise<Cadastro | null> => {
    const r = await criarCadastro(empresaId, tipo, nome);
    if (!r.cadastro) {
      avisar(r.erro ?? 'Não deu pra cadastrar.');
      return null;
    }
    const k = r.cadastro;
    setCadastros((ks) => (ks.some((x) => x.id === k.id) ? ks : [...ks, k].sort((a, b) => a.nome.localeCompare(b.nome))));
    avisar(`“${k.nome}” virou cadastro (${tipos.find((t) => t.chave === k.tipo)?.nome ?? k.tipo}). Dá pra usar em outras peças.`);
    return k;
  };

  const renomearUmCadastro = async (id: string, nome: string) => {
    const r = await renomearCadastro(empresaId, id, nome);
    if (r.erro) return avisar(r.erro);
    setCadastros((ks) => ks.map((k) => (k.id === id ? { ...k, nome: nome.trim() } : k)));
  };

  const verCadastro = (id: string) => {
    const ids = doc.pecas.filter((p) => p.responsavel === id).map((p) => p.id);
    if (!ids.length) return avisar('Nenhuma peça deste fluxo usa esse cadastro.');
    setSel({ tipo: 'peca', id: ids[0]! });
    quadro.current?.enquadrar(ids);
  };

  const nomesCadastros = useMemo(() => new Map(cadastros.map((k) => [k.id, k.nome])), [cadastros]);

  // ---------- Play ----------
  const [play, setPlay] = useState<Play | null>(null);
  const [docPlay, setDocPlay] = useState<Documento>(doc);
  const [mostrados, setMostrados] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [escolhendoInicio, setEscolhendoInicio] = useState<string[] | null>(null);
  const ctx = useMemo(() => ({ cadastros, canal: dados.canal }), [cadastros, dados.canal]);
  const exec = useMemo(() => (play ? rodar(docPlay, ctx, play) : null), [play, docPlay, ctx]);
  const vis = useMemo(() => (exec ? verVisual(exec.eventos, mostrados) : null), [exec, mostrados]);

  const comecarEm = (inicio: string) => {
    setDocPlay(doc);
    setPlay({ inicio, quando: play?.quando ?? agora(), modo: play?.modo ?? 'relogio', escolhas: [] });
    setMostrados(0);
    setPausado(false);
    setEscolhendoInicio(null);
    setRenomeando(null);
  };

  const darPlay = () => {
    const inicios = doc.pecas.filter((p) => p.tipo === 'inicio').map((p) => p.id);
    const escolhido = sel?.tipo === 'peca' && inicios.includes(sel.id) ? sel.id : null;
    if (escolhido) return comecarEm(escolhido);
    if (!inicios.length) return avisar('Cria uma peça Início pra dar play.');
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
    const t = setTimeout(() => setMostrados((m) => m + 1), e / estilo.velocidade);
    return () => clearTimeout(t);
  }, [exec, mostrados, pausado, estilo.velocidade]);

  const aguaChegou = () => setMostrados((m) => m + 1);

  const escolher = (conexao: string) => {
    if (!play || !exec?.pendente?.opcoes.some((o) => o.conexao === conexao)) return;
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
    setMostrados(rodar(docPlay, ctx, p).eventos.length);
    setPausado(false);
  };

  const recomecar = () => {
    if (!play) return;
    setPlay({ ...play, escolhas: [] });
    setMostrados(0);
    setPausado(false);
  };

  // Escolha automática (pra apresentar) e câmera seguindo a água.
  useEffect(() => {
    if (!vis?.pergunta || pausado || !estilo.autoEscolha) return;
    const primeira = vis.pergunta.opcoes[0]!.conexao;
    const t = setTimeout(() => escolher(primeira), estilo.autoEscolha * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis?.pergunta, pausado, estilo.autoEscolha]);

  useEffect(() => {
    if (!vis?.atual || !estilo.camera) return;
    const destinos = docPlay.conexoes.filter((c) => c.de === vis.atual).map((c) => c.para);
    quadro.current?.enquadrar([vis.atual, ...destinos]);
  }, [vis?.atual, estilo.camera, docPlay]);

  // ---------- Teclado ----------
  const teclas = useRef<(e: KeyboardEvent) => void>(() => {});
  teclas.current = (e: KeyboardEvent) => {
    if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') {
      e.preventDefault();
      return historia(e.shiftKey ? refazer : desfazer);
    }
    if (mod && k === 'y') {
      e.preventDefault();
      return historia(refazer);
    }
    if (mod && k === 'd' && sel?.tipo === 'peca') {
      e.preventDefault();
      return duplicar(sel.id);
    }
    if (vis?.pergunta && !mod) {
      const valores = new Map(docPlay.conexoes.map((c) => [c.id, c.valor]));
      const o = opcaoDaTecla(vis.pergunta.opcoes, e.key, valores);
      if (o) {
        e.preventDefault();
        return escolher(o.conexao);
      }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !play) {
      e.preventDefault();
      return apagarSelecao();
    }
    if (e.key === 'Escape') {
      if (ferramenta !== 'selecionar') return setFerramenta('selecionar');
      if (sel) return setSel(null);
      return;
    }
    if (e.key === 'Enter' && (sel?.tipo === 'peca' || sel?.tipo === 'nota') && !soLeitura && !play) {
      e.preventDefault();
      return setRenomeando(sel.id);
    }
    if (!mod && k === 'v') setFerramenta('selecionar');
    if (!mod && k === 'h') setFerramenta('mao');
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => teclas.current(e);
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, []);

  // ---------- Barra de formas: clique escolhe, arrastar solta a forma no quadro ----------
  const apertarFerramenta = (t: Ferramenta, e: React.PointerEvent) => {
    const x0 = e.clientX;
    const y0 = e.clientY;
    let arrastou = false;
    const mover = (ev: PointerEvent) => {
      if (!arrastou && criaAlgo(t) && !soLeitura && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) arrastou = true;
      if (arrastou) setFantasma({ t, x: ev.clientX, y: ev.clientY });
    };
    const soltar = (ev: PointerEvent) => {
      removeEventListener('pointermove', mover);
      removeEventListener('pointerup', soltar);
      setFantasma(null);
      if (arrastou && criaAlgo(t)) {
        if (quadro.current?.contem(ev.clientX, ev.clientY)) {
          const w = quadro.current.paraMundo(ev.clientX, ev.clientY);
          criar(t, w.x, w.y);
        }
        return setFerramenta('selecionar');
      }
      const nova = ferramenta === t && criaAlgo(t) ? 'selecionar' : t;
      setFerramenta(nova);
      if (criaAlgo(nova)) avisar(`Clique no quadro pra pôr ${nova === 'grupo' ? 'o grupo' : nova === 'nota' ? 'a nota' : FORMAS[nova].nome}.`);
    };
    addEventListener('pointermove', mover);
    addEventListener('pointerup', soltar);
  };

  const botaoFerramenta = (t: Ferramenta, nome: string, icone: string, dica: string) => (
    <button
      key={t}
      className="ferr"
      type="button"
      aria-pressed={ferramenta === t}
      aria-label={nome}
      disabled={soLeitura && criaAlgo(t)}
      onPointerDown={(e) => apertarFerramenta(t, e)}
    >
      <Icone nome={icone} />
      <span className="dica-ferr">
        {nome} · {dica}
      </span>
    </button>
  );

  const textoSituacao: Record<Situacao, string> = {
    salvo: 'salvo',
    esperando: 'salvando…',
    salvando: 'salvando…',
    sem_rede: 'sem conexão: guardado neste navegador, tentando de novo',
    sem_sessao: 'o login venceu: entre de novo (em outra aba) pra salvar; está guardado neste navegador',
    conflito: 'não salvo',
    sem_trava: 'não salvo',
    recusado: 'não salvo',
  };
  const corAgua = (canal: string | null) => corDoCanal(estilo, canais, canal ?? dados.canal);

  return (
    <div className={`editor${estilo.ondas ? ' ondas' : ''}${estilo.holofote ? ' holofote-on' : ''}${vis?.pergunta ? ' escolhendo' : ''}`}>
      <div className="cabeca-editor">
        {trava.estado === 'outra' && !parado && (
          <div className="faixa" role="status">
            {trava.por ? `${trava.por} está editando este fluxo` : 'Outra pessoa está editando este fluxo'}
            {trava.ate && ` (até ${new Date(trava.ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })}, se parar de mexer)`}. Dá pra ver e dar play; a
            edição libera quando a trava vencer ou a pessoa fechar o fluxo.
          </div>
        )}
        {parado && (
          <div className="faixa erro" role="alert">
            {situacao.s === 'conflito'
              ? 'Outra pessoa salvou este fluxo enquanto ele estava aberto aqui. As últimas mudanças daqui não foram salvas: recarregue pra continuar da versão dela.'
              : situacao.s === 'sem_trava'
                ? 'Outra pessoa pegou a edição deste fluxo. As últimas mudanças daqui não foram salvas: recarregue pra ver como ficou.'
                : `O banco recusou as últimas mudanças${situacao.mensagem ? ` (${situacao.mensagem})` : ''}. Recarregue pra continuar.`}
            <button className="botao pequeno" type="button" onClick={() => location.reload()}>
              Recarregar
            </button>
          </div>
        )}
        <header className="topo">
          <input
            key={dados.nome}
            className="nome-fluxo"
            type="text"
            aria-label="Nome do fluxo"
            defaultValue={dados.nome}
            disabled={soLeitura}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              if (!v) e.currentTarget.value = dados.nome;
              else if (v !== dados.nome) void mudarDados({ nome: v });
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <span className={`salvo${parado ? ' erro' : ''}`} role="status" data-testid="salvamento">
            {trava.estado === 'pegando' ? 'abrindo…' : soLeitura && !parado ? 'só leitura' : textoSituacao[situacao.s]}
          </span>
          <div className="empurra">
            <button className="bi" type="button" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={soLeitura || !hist.antes.length} onClick={() => historia(desfazer)}>
              <Icone nome="desfazer" />
            </button>
            <button className="bi" type="button" aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled={soLeitura || !hist.depois.length} onClick={() => historia(refazer)}>
              <Icone nome="refazer" />
            </button>
            <button className="botao so-celular" type="button" onClick={() => setPainelAberto((a) => !a)}>
              Painel
            </button>
            <button className="botao primario b-play" type="button" onClick={play || escolhendoInicio ? parar : darPlay}>
              <Icone nome={play || escolhendoInicio ? 'parar' : 'play'} />
              {play || escolhendoInicio ? 'Parar' : 'Dar play'}
            </button>
          </div>
        </header>
      </div>

      <div className="area">
        <nav className="ferramentas" aria-label="Formas">
          {botaoFerramenta('selecionar', 'Selecionar', 'selecionar', 'V')}
          {botaoFerramenta('mao', 'Mover o quadro', 'mao', 'H')}
          <span className="sep" />
          {ORDEM_FORMAS.map((t) => botaoFerramenta(t, FORMAS[t].nome, t, 'clique ou arraste'))}
          <span className="sep" />
          {botaoFerramenta('grupo', 'Grupo', 'grupo', 'moldura que junta peças')}
          {botaoFerramenta('nota', 'Nota', 'nota', 'recado no quadro')}
        </nav>

        <Quadro
          ref={quadro}
          doc={play ? docPlay : doc}
          estilo={estilo}
          canais={canais}
          canalFluxo={dados.canal}
          nomesCadastros={nomesCadastros}
          sel={sel}
          ferramenta={ferramenta}
          soLeitura={soLeitura}
          play={vis}
          pausado={pausado}
          aoAguaChegar={aguaChegou}
          renomeando={renomeando}
          acoes={{
            selecionar,
            criar,
            criarLigada,
            ligar,
            mudar: (d, primeiro) => {
              if (soLeitura) return;
              setHist((h) => (primeiro ? registrar(h, d) : substituir(h, d)));
              salv.current!.mudou(d, estilo);
            },
            renomear: setRenomeando,
            gravarNome: (id, texto) => {
              setRenomeando(null);
              const t = texto.trim();
              if (!t) return;
              if (doc.pecas.some((p) => p.id === id)) {
                if (doc.pecas.find((p) => p.id === id)!.nome !== t) editar(D.mudarPeca(doc, id, { nome: t }));
              } else if (doc.notas.find((n) => n.id === id)?.texto !== t) editar(D.mudarNota(doc, id, { texto: t }));
            },
            escolher,
            usarFerramenta: setFerramenta,
          }}
        >
          {(play || escolhendoInicio) && (
            <CartaoPlay
              doc={docPlay}
              play={play}
              visual={vis}
              pausado={pausado}
              velocidade={estilo.velocidade}
              autoEscolha={estilo.autoEscolha}
              corAgua={corAgua}
              canais={canais}
              inicios={escolhendoInicio}
              acoes={{
                escolher,
                pausar: () => setPausado((p) => !p),
                voltar,
                recomecar,
                parar,
                velocidade: (v) => mudarEstilo({ ...estilo, velocidade: v }),
                quando: (q) => {
                  if (!play) return;
                  setPlay({ ...play, quando: q, escolhas: [] });
                  setMostrados(0);
                },
                relogio: (decide) => {
                  if (!play) return;
                  setPlay({ ...play, modo: decide ? 'relogio' : 'livre', escolhas: [] });
                  setMostrados(0);
                },
                comecarEm,
              }}
            />
          )}
        </Quadro>

        <Painel
          aba={aba}
          setAba={setAba}
          aberto={painelAberto}
          doc={doc}
          sel={sel}
          fluxo={dados}
          estilo={estilo}
          canais={canais}
          cadastros={cadastros}
          tipos={tipos}
          soLeitura={soLeitura}
          acoes={{
            mudarPeca: (id, patch) => editar(D.mudarPeca(doc, id, patch)),
            mudarConexao: (id, patch) => editar(D.mudarConexao(doc, id, patch)),
            inverter: (id) => editar(D.inverterConexao(doc, id)),
            mudarGrupo: (id, patch) => editar(D.mudarGrupo(doc, id, patch)),
            mudarNota: (id, patch) => editar(D.mudarNota(doc, id, patch)),
            apagar: apagarSelecao,
            duplicar,
            selecionar,
            mudarFluxo: (d) => void mudarDados(d),
            apagarFluxo: async () => {
              salv.current!.parar();
              const r = await apagarFluxo(empresaId, fluxo.id);
              if (r.erro) {
                salv.current!.retomar();
                return avisar(r.erro);
              }
              router.push(`/e/${empresaId}`);
            },
            criarCadastro: criarUmCadastro,
            renomearCadastro: renomearUmCadastro,
            verCadastro,
            mudarEstilo,
          }}
        />
      </div>

      {fantasma && criaAlgo(fantasma.t) && (
        <div className="fantasma" style={{ left: fantasma.x - 30, top: fantasma.y - 20 }} aria-hidden="true">
          {fantasma.t === 'grupo' ? (
            <div className="grupo" style={{ position: 'static', width: 200, height: 120 }} />
          ) : fantasma.t === 'nota' ? (
            <div className="no t-nota" style={{ position: 'relative', width: 190, height: 110 }} />
          ) : (
            <div className={`no t-${fantasma.t}`} style={{ position: 'relative', width: FORMAS[fantasma.t].w, height: FORMAS[fantasma.t].h }}>
              <span className="tile">
                <Icone nome={fantasma.t} />
              </span>
              <span className="textos">
                <span className="titulo">{FORMAS[fantasma.t].nome}</span>
              </span>
            </div>
          )}
        </div>
      )}
      {aviso && (
        <div className="aviso" role="status">
          {aviso}
        </div>
      )}
    </div>
  );
}
