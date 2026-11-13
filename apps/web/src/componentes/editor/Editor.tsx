'use client';

import './editor.css';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { diagnosticar, lerDocumento, type Achado, type Cadastro, type Documento, type TipoPeca } from '@journey/fluxo';
import { criarCadastro, renomearCadastro } from '@/acoes/cadastros';
import { apagarFluxo, mudarFluxo, type DadosDoFluxo } from '@/acoes/fluxos';
import { apagarCenario, aprovarCenario, renomearCenario, salvarCenario } from '@/acoes/cenarios';
import { desmarcarIntencional, marcarIntencional } from '@/acoes/intencionais';
import { marcarVersao } from '@/acoes/versoes';
import type { LinkResumo } from '@/compartilhar/opcoes';
import { Icone } from '@/componentes/Icone';
import type { TipoCadastro } from '@/editor/cadastros';
import { cenarioDoPlay, paraAprovar, playDoCenario, situacao as situacaoDoCenario, type Cenario, type Situacao as SituacaoCenario } from '@/editor/cenarios';
import { antigos, caminhoAte, focoDoAchado, gavetaAberta, lembrarGaveta, pecaDoAchado, rotuloAchados, separar, simulaveis, type Intencional } from '@/editor/diagnostico';
import * as D from '@/editor/documento';
import { corDoCanal, lerEstilo, type CanalEditor, type Estilo } from '@/editor/estilo';
import { comecar, desfazer, refazer, registrar, substituir, type Historico } from '@/editor/historico';
import { FORMAS, ORDEM_FORMAS } from '@/editor/pecas';
import { agora } from '@/editor/play';
import { Salvamento, copiaValida, mesmoJson, motivoDoErro, type Situacao } from '@/editor/salvamento';
import type { VersaoResumo } from '@/lib/dados';
import { FUSO } from '@/lib/fuso';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { CartaoPlay } from './CartaoPlay';
import { Cenarios } from './Cenarios';
import { Compartilhar } from './Compartilhar';
import { Gaveta } from './Gaveta';
import { Pop } from './Pop';
import { Versoes } from './Versoes';
import { Painel, type Aba, type DadosFluxo } from './Painel';
import { Quadro, criaAlgo, type Ferramenta, type QuadroApi } from './Quadro';
import { useAnuncioAdiado } from './useAnuncioAdiado';
import { usePlay } from './usePlay';

export interface PropsEditor {
  empresaId: string;
  fluxo: { id: string; revisao: number; documento: Documento; estilo: unknown } & DadosFluxo;
  canais: readonly CanalEditor[];
  cadastros: readonly Cadastro[];
  tipos: readonly TipoCadastro[];
  intencionais: readonly Intencional[];
  cenarios: readonly Cenario[];
  versoes: readonly VersaoResumo[];
  links: readonly LinkResumo[];
  /** Se o servidor tem a chave secreta: sem ela, o link público não abre e o "Compartilhar" explica. */
  linkConfigurado: boolean;
}

/** Ids curtos e únicos o bastante dentro de um fluxo. */
const novoId = (prefixo: string) => `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const chaveLocal = (id: string) => `journey:fluxo:${id}`;
/** A trava vale 10 minutos; o editor renova antes de vencer. */
const RENOVAR_TRAVA = 4 * 60 * 1000;
/** Até quando conta como minha uma trava que não deu pra renovar: 9 dos 10 minutos, pelo relógio daqui. */
const TRAVA_VALE = 9 * 60 * 1000;
/** Pedido de trava que falhou (rede, 5xx, login): tenta de novo nesse tempo, não só na próxima renovação. */
const DE_NOVO_TRAVA = 20 * 1000;
/** Quanto espera a resposta do pegar_trava antes de desistir (e tratar como sem rede). */
const LIMITE_TRAVA = 15 * 1000;

/**
 * pegando: abrindo; minha: edita; outra: alguém editando (o banco disse); incerta: não deu pra confirmar com o banco
 * (sem rede) e a trava daqui, se havia, já pode ter vencido; liberou: quem só via ganhou a trava, mas o documento
 * na tela é o do carregamento: recarrega pra editar o que está no banco.
 */
type Trava =
  | { estado: 'pegando' }
  | { estado: 'minha' }
  | { estado: 'outra'; por: string | null; ate: string | null }
  | { estado: 'incerta' }
  | { estado: 'liberou' };

export function Editor({ empresaId, fluxo, canais, cadastros: cadastrosIniciais, tipos, intencionais: intencionaisIniciais, cenarios: cenariosIniciais, versoes: versoesIniciais, links: linksIniciais, linkConfigurado }: PropsEditor) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseNavegador(), []);
  const quadro = useRef<QuadroApi>(null);

  const [hist, setHist] = useState<Historico>(() => comecar(fluxo.documento));
  const doc = hist.atual;
  const [estilo, setEstilo] = useState<Estilo>(() => lerEstilo(fluxo.estilo));
  const [velocidadeVista, setVelocidadeVista] = useState<number | null>(null);
  // O que a tela mostra: o estilo, com a velocidade que quem só vê escolheu pro play dele.
  const estiloVisto = useMemo(() => (velocidadeVista === null ? estilo : { ...estilo, velocidade: velocidadeVista }), [estilo, velocidadeVista]);
  const [dados, setDados] = useState<DadosFluxo>({ nome: fluxo.nome, descricao: fluxo.descricao, canal: fluxo.canal, meta_s: fluxo.meta_s });
  // O mais recente, sem esperar o próximo desenho: uma ação chamada depois de um await (ou de um menu aberto antes)
  // traz o `doc` do desenho em que nasceu, e gravar em cima dele apagaria o que mudou nesse meio-tempo. Os refs só
  // mudam junto com o estado (mudarHist, mudarEstilo, mudarDados), nunca no desenho: um desenho atrasado não volta
  // o ref pra trás.
  const histRef = useRef(hist);
  const estiloRef = useRef(estilo);
  const dadosRef = useRef(dados);
  const docAtual = () => histRef.current.atual;
  const mudarHist = (h: Historico) => {
    histRef.current = h;
    setHist(h);
  };
  const trocarEstilo = (e: Estilo) => {
    estiloRef.current = e;
    setEstilo(e);
  };
  /** O último histórico que um quadro de arrasto escreveu: se a cabeça mudou depois dele, o próximo quadro é passo novo. */
  const ultimoQuadro = useRef<Historico | null>(null);
  const [cadastros, setCadastros] = useState<readonly Cadastro[]>(cadastrosIniciais);
  const [sel, setSel] = useState<D.Selecao>(null);
  const [ferramenta, setFerramenta] = useState<Ferramenta>('selecionar');
  const [aba, setAba] = useState<Aba>('prop');
  const [painelAberto, setPainelAberto] = useState(false);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<{ s: Situacao; mensagem?: string }>({ s: 'salvo' });
  // A de agora, pra uma mensagem montada depois de um await (o `situacao` do desenho em que a ação nasceu é velho).
  const situacaoRef = useRef(situacao);
  const [aviso, setAviso] = useState<string | null>(null);
  const [trava, setTrava] = useState<Trava>({ estado: 'pegando' });
  const [fantasma, setFantasma] = useState<{ t: Ferramenta; x: number; y: number } | null>(null);

  const parado = situacao.s === 'conflito' || situacao.s === 'sem_trava' || situacao.s === 'recusado';
  const soLeitura = trava.estado !== 'minha' || parado;

  const avisar = (t: string) => setAviso(t);
  // O título da aba acompanha o nome do fluxo (renomear aqui muda na hora).
  useEffect(() => {
    document.title = `${dados.nome} · Journey`;
  }, [dados.nome]);
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
    aoMudar: (s, mensagem) => {
      situacaoRef.current = { s, ...(mensagem && { mensagem }) };
      setSituacao(situacaoRef.current);
    },
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
  /** Até quando (relógio daqui) a trava confirmada vale, mesmo sem conseguir renovar. */
  const minhaAte = useRef(0);
  /** O banco já disse que era de outra pessoa: o documento na tela pode estar velho. */
  const jaFoiOutra = useRef(false);
  useEffect(() => {
    let vivo = true;
    let pedindo = false;
    let parou = false;
    let deNovo: ReturnType<typeof setTimeout> | undefined;
    const pegar = async () => {
      if (pedindo || parou) return;
      pedindo = true;
      clearTimeout(deNovo);
      let r: { data: unknown; error: unknown };
      // Um pedido que nunca responde (conexão morta) seguraria o `pedindo` pra sempre e nenhuma renovação sairia mais:
      // em 15 s desiste e conta como falha de rede. Com setTimeout (e não AbortSignal.timeout) pra seguir o mesmo
      // relógio dos outros temporizadores.
      const ctl = new AbortController();
      const limite = setTimeout(() => ctl.abort(), LIMITE_TRAVA);
      try {
        r = await supabase.rpc('pegar_trava', { p_fluxo: fluxo.id }).abortSignal(ctl.signal);
      } catch (erro) {
        r = { data: null, error: erro };
      } finally {
        clearTimeout(limite);
        pedindo = false;
      }
      if (!vivo) return;
      const d = r.data as { ok: boolean; por?: string | null; ate?: string | null } | null;
      if (r.error || !d) {
        // Não deu pra perguntar (rede, 5xx, login): não é "outra pessoa". Enquanto a última trava confirmada vale,
        // segue editando; depois, fica só vendo até conseguir confirmar. Tenta de novo logo.
        deNovo = setTimeout(() => void pegar(), DE_NOVO_TRAVA);
        if (minha.current && Date.now() < minhaAte.current) return;
        return setTrava({ estado: 'incerta' });
      }
      if (!d.ok) {
        minha.current = false;
        jaFoiOutra.current = true;
        return setTrava({ estado: 'outra', por: d.por ?? null, ate: d.ate ?? null });
      }
      if (!minha.current && jaFoiOutra.current) {
        // Quem só via ganhou a trava, mas a tela tem o documento (e a revisão) de quando abriu: editar daqui daria
        // um conflito no primeiro salvamento. Solta a trava (pra não segurar à toa) e pede pra recarregar.
        parou = true;
        void supabase.rpc('soltar_trava', { p_fluxo: fluxo.id });
        return setTrava({ estado: 'liberou' });
      }
      minhaAte.current = Date.now() + TRAVA_VALE;
      if (!minha.current) {
        minha.current = true;
        recuperarCopia();
      }
      setTrava({ estado: 'minha' });
    };
    void pegar();
    // O token muda (renova a cada hora): o soltar com keepalive precisa do atual, senão dá 401 ao fechar.
    void supabase.auth.getSession().then(({ data }) => (token.current = data.session?.access_token ?? null));
    const { data: auth } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      token.current = sessao?.access_token ?? null;
    });
    const intervalo = setInterval(() => void pegar(), RENOVAR_TRAVA);
    // A rede voltou, a aba voltou a aparecer ou a página voltou do cache: o intervalo pode ter ficado parado (aba
    // escondida, computador dormindo), então confirma a trava já. Com a rede de volta, o salvamento também tenta já.
    const voltouRede = () => {
      void pegar();
      salv.current?.tentarJa();
    };
    const visivel = () => document.visibilityState === 'visible' && void pegar();
    const voltouDoCache = (e: PageTransitionEvent) => e.persisted && void pegar();
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
      // Parado (conflito, trava perdida, recusa), não há o que esperar: o "Recarregar" da faixa não pode abrir o
      // "sair do site?". A cópia, quando vale, já está no navegador.
      if (salv.current?.sujo && !salv.current.parado) {
        void salv.current.agora();
        e.preventDefault();
      }
    };
    addEventListener('pagehide', soltar);
    addEventListener('beforeunload', antesDeSair);
    addEventListener('online', voltouRede);
    addEventListener('pageshow', voltouDoCache);
    document.addEventListener('visibilitychange', visivel);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      clearTimeout(deNovo);
      auth.subscription.unsubscribe();
      removeEventListener('pagehide', soltar);
      removeEventListener('beforeunload', antesDeSair);
      removeEventListener('online', voltouRede);
      removeEventListener('pageshow', voltouDoCache);
      document.removeEventListener('visibilitychange', visivel);
      // Saindo pra outra tela: espera o que falta chegar e solta a trava. Sem `parar`: no modo estrito do React a
      // limpeza roda uma vez ao montar, e sem rede o salvamento segue tentando (a cópia está no navegador).
      void salv.current?.agora().finally(soltar);
    };
    // Uma vez por fluxo aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fluxo.id]);

  /**
   * O que não chegou no banco da última vez (sem rede, ou recusado porque um responsável foi apagado) e partiu da
   * revisão que o salvamento tem agora volta pro quadro. Responsável que não existe mais sai da peça: senão o banco
   * recusaria de novo.
   */
  function recuperarCopia() {
    let copia = null;
    try {
      copia = copiaValida(JSON.parse(localStorage.getItem(chaveLocal(fluxo.id)) ?? 'null'), salv.current!.revisao);
    } catch {
      return;
    }
    if (!copia) return;
    const { documento, orfas } = D.semResponsaveisQueSumiram(copia.documento, new Set(cadastrosIniciais.map((k) => k.id)));
    mudarHist(comecar(documento));
    trocarEstilo(lerEstilo(copia.estilo));
    salv.current!.mudou(documento, lerEstilo(copia.estilo));
    avisar(orfas ? `Voltaram as mudanças que não tinham chegado ao banco (sem o responsável apagado em ${pecas(orfas)}).` : 'Voltaram as mudanças que não tinham chegado ao banco.');
  }

  const pecas = (n: number) => (n === 1 ? '1 peça' : `${n} peças`);

  // ---------- Mudanças no documento ----------
  const parar = () => pl.parar();

  /** Toda mudança no documento parte do mais recente (`docAtual()`), nunca do `doc` deste desenho. */
  const editar = (novo: Documento, selecao?: D.Selecao) => {
    const v = vivo.current;
    if (v.soLeitura || novo === docAtual()) return;
    if (v.play) parar();
    setDestaque(null);
    mudarHist(registrar(histRef.current, novo));
    salv.current!.mudou(novo, estiloRef.current);
    if (selecao !== undefined) setSel(selecao);
  };

  // Em só leitura o estilo não muda: mudaria aqui e iria junto no primeiro salvamento depois de pegar a trava.
  const mudarEstilo = (e: Estilo) => {
    if (vivo.current.soLeitura) return;
    trocarEstilo(e);
    setVelocidadeVista(null);
    salv.current!.mudou(docAtual(), e);
  };
  /** A velocidade do play: quem só vê também ajusta, só na tela dele (não vai pro estilo nem pro salvamento). */
  const mudarVelocidade = (v: number) => (vivo.current.soLeitura ? setVelocidadeVista(v) : mudarEstilo({ ...estiloRef.current, velocidade: v }));

  const historia = (f: (h: Historico) => Historico) => {
    if (soLeitura) return;
    if (play) parar();
    const antes = histRef.current;
    const h = f(antes);
    if (h === antes) return;
    mudarHist(h);
    salv.current!.mudou(h.atual, estiloRef.current);
    if (!D.existe(h.atual, sel)) setSel(null);
  };

  /** Cria e seleciona. `renomear`: abre o campo de nome (ponteiro); pelo teclado, a peça só ganha o foco. */
  const criar = (f: TipoPeca | 'grupo' | 'nota', x: number, y: number, renomear = true) => {
    const id = novoId(f === 'grupo' ? 'g' : f === 'nota' ? 'n' : 'p');
    if (f === 'grupo') return editar(D.criarGrupo(docAtual(), id, x, y), { tipo: 'grupo', id });
    if (f === 'nota') {
      editar(D.criarNota(docAtual(), id, x, y), { tipo: 'nota', id });
      return renomear ? setRenomeando(id) : setFocar(id);
    }
    editar(D.criarPeca(docAtual(), id, f, x, y), { tipo: 'peca', id });
    if (renomear) setRenomeando(id);
    else setFocar(id);
  };
  // A peça (ou nota) criada pelo teclado recebe o foco depois de aparecer no quadro: Enter nela renomeia.
  const [focar, setFocar] = useState<string | null>(null);
  useEffect(() => {
    if (!focar) return;
    document.querySelector<HTMLElement>(`[data-peca="${focar}"], [data-nota="${focar}"]`)?.focus();
    setFocar(null);
  }, [focar]);

  const ligar = (de: string, para: string) => {
    const r = D.ligar(docAtual(), novoId('c'), de, para);
    if ('erro' in r) return r.erro === 'repetida' && avisar('Essas duas peças já estão ligadas.');
    editar(r.doc, { tipo: 'conexao', id: r.conexao.id });
  };

  const criarLigada = (origem: string, tipo: TipoPeca, onde?: { x: number; y: number }) => {
    const id = novoId('p');
    editar(D.criarLigada(docAtual(), id, novoId('c'), origem, tipo, onde), { tipo: 'peca', id });
    setRenomeando(id);
  };

  const apagarSelecao = () => {
    if (!sel) return;
    editar(D.apagar(docAtual(), sel), null);
  };

  const duplicar = (id: string) => {
    const novo = novoId('p');
    editar(D.duplicar(docAtual(), id, novo), { tipo: 'peca', id: novo });
  };

  const selecionar = (s: D.Selecao) => {
    setSel(s);
    setDestaque(null);
    if (s) setAba('prop');
    if (s && innerWidth <= 820) setPainelAberto(true);
  };

  // ---------- Dados do fluxo (colunas) e cadastros ----------
  // Parte do mais recente: duas mudanças seguidas (nome e descrição no mesmo desenho) não apagam uma à outra. Se o banco recusa,
  // volta só os campos desta mudança.
  const mudarDados = async (d: DadosDoFluxo) => {
    if (vivo.current.soLeitura) return;
    const atual = dadosRef.current;
    const antes = Object.fromEntries(Object.keys(d).map((k) => [k, atual[k as keyof DadosFluxo]])) as Partial<DadosFluxo>;
    dadosRef.current = { ...atual, ...d } as DadosFluxo;
    setDados(dadosRef.current);
    const r = await mudarFluxo(empresaId, fluxo.id, d);
    if (r.erro) {
      dadosRef.current = { ...dadosRef.current, ...antes };
      setDados(dadosRef.current);
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
  const ctx = useMemo(() => ({ cadastros, canal: dados.canal }), [cadastros, dados.canal]);
  const pl = usePlay({
    doc,
    ctx,
    velocidade: estiloVisto.velocidade,
    autoEscolha: estilo.autoEscolha,
    camera: estilo.camera,
    quadro,
    avisar,
    aoComecar: () => {
      setRenomeando(null);
      setDestaque(null);
    },
  });
  const { play, docPlay, vis, escolhendoInicio, escolher } = pl;
  // Pro `editar` chamado depois de um await: a trava e o play de agora, não os de quando a ação nasceu.
  const vivo = useRef({ soLeitura, play });
  vivo.current = { soLeitura, play };

  const darPlay = () => pl.darPlay(sel?.tipo === 'peca' ? sel.id : null);

  // ---------- Diagnóstico ----------
  // Adiado: digitar um nome não espera o diagnóstico (500 peças levam poucos milissegundos, mas a cada tecla).
  const docDiag = useDeferredValue(doc);
  const achados = useMemo(() => diagnosticar(docDiag, { cadastros, ...(dados.meta_s && { meta_s: dados.meta_s }) }), [docDiag, cadastros, dados.meta_s]);
  const [marcados, setMarcados] = useState<readonly Intencional[]>(intencionaisIniciais);
  const separados = useMemo(() => separar(achados, marcados), [achados, marcados]);
  const marcasAntigas = useMemo(() => antigos(achados, marcados), [achados, marcados]);
  const marcas = useMemo(() => new Map(marcados.map((i) => [i.chave, i])), [marcados]);
  const [gaveta, setGaveta] = useState(false);
  // Depois de montar: o servidor não sabe o que este navegador lembra (e o primeiro desenho tem que ser igual ao dele).
  useEffect(() => setGaveta(gavetaAberta(fluxo.id)), [fluxo.id]);
  const botaoDiagnostico = useRef<HTMLButtonElement>(null);
  /** Fechar a gaveta tira o holofote do achado junto. */
  const mudarGaveta = (aberta: boolean) => {
    lembrarGaveta(fluxo.id, aberta);
    setGaveta(aberta);
    if (!aberta) setDestaque(null);
  };
  const [destaque, setDestaque] = useState<ReadonlySet<string> | null>(null);
  // "Simular até aqui" só pra peça que um Início alcança: uma busca pro documento; o caminho é feito no clique.
  const comCaminho = useMemo(() => (gaveta ? simulaveis(docDiag, achados) : new Set<string>()), [gaveta, docDiag, achados]);
  // A contagem muda a cada tecla: o leitor de tela ouve a de quando parou de mudar.
  const anuncio = useAnuncioAdiado(`Diagnóstico: ${rotuloAchados(separados.abertos.length)}`);
  // Tela pequena nos dois sentidos: com o play, a gaveta fecha pra não cobrir o cartão (sem lembrar). Deitado e mais
  // largo, as duas cabem lado a lado (editor.css).
  useEffect(() => {
    if (pl.ativo && matchMedia('(max-height: 600px) and (max-width: 599px)').matches) {
      setGaveta(false);
      setDestaque(null);
    }
  }, [pl.ativo]);

  const verNoQuadro = (a: Achado) => {
    const f = focoDoAchado(docAtual(), a);
    if (!f) return;
    if (play) parar();
    setSel(f.sel);
    setDestaque(f.destaque);
    quadro.current?.enquadrar(f.enquadrar);
  };

  const simularAte = (a: Achado) => {
    const d = docAtual();
    const alvo = pecaDoAchado(d, a);
    const p = alvo && caminhoAte(d, ctx, alvo, play?.quando ?? agora());
    if (!alvo || !p) return avisar('Nenhum Início chega nesta peça.');
    pl.tocar(p, alvo);
  };

  const marcar = async (chave: string, nota: string) => {
    if (vivo.current.soLeitura) return false;
    const r = await marcarIntencional(empresaId, fluxo.id, chave, nota);
    if (!r.intencional) {
      avisar(r.erro ?? 'Não deu pra marcar.');
      return false;
    }
    const i = r.intencional;
    setMarcados((ms) => [...ms.filter((m) => m.chave !== chave), i]);
    return true;
  };

  // ---------- Cenários ----------
  const [cens, setCens] = useState<readonly Cenario[]>(cenariosIniciais);
  // Contra o documento de agora (adiado como o diagnóstico): igual ou mudou.
  const situacoes = useMemo(() => new Map<string, SituacaoCenario>(cens.map((c) => [c.id, situacaoDoCenario(c, docDiag, ctx)])), [cens, docDiag, ctx]);
  const [aberto, setAberto] = useState<'cenarios' | 'versoes' | null>(null);
  const botaoCenarios = useRef<HTMLButtonElement>(null);
  const porNome = (a: Cenario, b: Cenario) => a.nome.localeCompare(b.nome, 'pt-BR');

  /** Manda o que falta e diz se o banco está com o documento de agora (pra revisão de um cenário ou de uma versão). */
  const salvarAntes = async (oQue: string) => {
    await salv.current!.agora();
    if (!salv.current!.sujo && !salv.current!.parado) return true;
    avisar(`O fluxo ainda não chegou no banco (${textoSituacao[situacaoRef.current.s]}): ${oQue} fica pra quando salvar.`);
    return false;
  };

  const salvarUmCenario = async (nome: string) => {
    if (vivo.current.soLeitura) return false;
    const novo = play && pl.exec ? cenarioDoPlay(play, pl.exec) : null;
    if (!novo) {
      avisar('Dá play até o fim pra salvar o cenário.');
      return false;
    }
    if (!(await salvarAntes('o cenário'))) return false;
    const r = await salvarCenario(empresaId, fluxo.id, nome, novo, salv.current!.revisao);
    if (!r.cenario) {
      avisar(r.erro ?? 'Não deu pra salvar o cenário.');
      return false;
    }
    const c = r.cenario;
    setCens((cs) => [...cs, c].sort(porNome));
    avisar(`Cenário “${c.nome}” salvo. Ele fica em Cenários.`);
    return true;
  };

  const acoesCenarios = {
    tocar: (c: Cenario) => {
      setAberto(null);
      pl.tocar(playDoCenario(c));
    },
    aprovar: async (c: Cenario, s: SituacaoCenario) => {
      const novo = paraAprovar(s);
      if (vivo.current.soLeitura || !novo || !(await salvarAntes('a aprovação'))) return;
      // A que vai pro banco: um salvamento no meio da ida mudaria `salv.revisao` antes da volta.
      const revisao = salv.current!.revisao;
      const r = await aprovarCenario(empresaId, fluxo.id, c.id, novo, revisao);
      if (r.erro) return avisar(r.erro);
      setCens((cs) => cs.map((x) => (x.id === c.id ? { ...x, ...novo, revisao_aprovada: revisao } : x)));
    },
    renomear: async (c: Cenario, nome: string) => {
      if (vivo.current.soLeitura) return false;
      const r = await renomearCenario(empresaId, fluxo.id, c.id, nome);
      if (r.erro) {
        avisar(r.erro);
        return false;
      }
      setCens((cs) => cs.map((x) => (x.id === c.id ? { ...x, nome: nome.trim() } : x)).sort(porNome));
      return true;
    },
    apagar: async (c: Cenario) => {
      if (vivo.current.soLeitura) return;
      const r = await apagarCenario(empresaId, fluxo.id, c.id);
      if (r.erro) return avisar(r.erro);
      setCens((cs) => cs.filter((x) => x.id !== c.id));
    },
  };

  // ---------- Versões ----------
  const [vers, setVers] = useState<readonly VersaoResumo[]>(versoesIniciais);
  const botaoVersoes = useRef<HTMLButtonElement>(null);

  /** A versão é a foto do que está no banco: só marca depois que o que falta chegou. */
  const marcarUmaVersao = async (nome: string) => {
    if (vivo.current.soLeitura || !(await salvarAntes('a versão'))) return false;
    const r = await marcarVersao(empresaId, fluxo.id, nome);
    if (!r.versao) {
      avisar(r.erro ?? 'Não deu pra marcar a versão.');
      return false;
    }
    const v = r.versao;
    setVers((vs) => [v, ...vs]);
    avisar(`Versão ${v.numero} marcada.`);
    return true;
  };

  /**
   * Restaurar é uma edição como outra qualquer (Ctrl+Z desfaz): o documento da versão, lido pelo navegador (a regra
   * de acesso vale), entra no histórico, e o estilo dela também (o estilo não entra no desfazer). Responsável que não
   * é mais cadastro sai, como na cópia local: senão o banco recusaria o salvamento.
   */
  const restaurar = async (v: VersaoResumo) => {
    const r = await supabase.from('fluxo_versoes').select('documento, estilo').eq('fluxo_id', fluxo.id).eq('numero', v.numero).maybeSingle();
    if (r.error || !r.data) return avisar('Não deu pra ler essa versão. Tenta de novo.');
    const lido = lerDocumento(r.data.documento);
    if (!lido.documento) return avisar(`A versão ${v.numero} não abre: o documento dela não é válido.`);
    const { documento, orfas } = D.semResponsaveisQueSumiram(lido.documento, new Set(cadastros.map((k) => k.id)));
    if (vivo.current.soLeitura) return;
    const est = lerEstilo(r.data.estilo);
    // Igual ao de agora: nada a restaurar (e nenhum passo vazio no desfazer).
    if (mesmoJson(documento, docAtual()) && mesmoJson(est, estiloRef.current)) return avisar(`A versão ${v.numero} é igual ao fluxo de agora: nada mudou.`);
    setAberto(null);
    botaoVersoes.current?.focus();
    if (!mesmoJson(documento, docAtual())) editar(documento, null);
    mudarEstilo(est);
    avisar(`Voltou a versão ${v.numero} (“${v.nome}”)${orfas ? `, sem o responsável apagado em ${pecas(orfas)}` : ''}. Ctrl+Z desfaz.`);
  };

  // ---------- Compartilhar ----------
  const [lnks, setLinks] = useState<readonly LinkResumo[]>(linksIniciais);
  const [compartilhando, setCompartilhando] = useState(false);
  const botaoCompartilhar = useRef<HTMLButtonElement>(null);

  const desmarcar = async (chave: string) => {
    if (vivo.current.soLeitura) return;
    const r = await desmarcarIntencional(empresaId, fluxo.id, chave);
    if (r.erro) return avisar(r.erro);
    setMarcados((ms) => ms.filter((m) => m.chave !== chave));
  };

  // ---------- Teclado ----------
  const teclas = useRef<(e: KeyboardEvent) => void>(() => {});
  teclas.current = (e: KeyboardEvent) => {
    // Dentro de um campo, de um pop (Cenários, Versões) ou do diálogo, a tecla é deles: Delete num botão do pop não
    // pode apagar a peça selecionada no quadro.
    const alvo = e.target as Element | null;
    if (alvo?.closest?.('input, textarea, select, [contenteditable="true"], .pop, dialog')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    // Na gaveta: Esc tira o holofote (ou fecha a gaveta) e desfazer/refazer seguem valendo; Delete, Enter e as teclas
    // das opções do play ficam com os botões dela.
    if (alvo?.closest?.('.gaveta')) {
      if (e.key === 'Escape') {
        if (destaque) return setDestaque(null);
        mudarGaveta(false);
        return botaoDiagnostico.current?.focus();
      }
      if (!(mod && (k === 'z' || k === 'y'))) return;
    }
    // Desfazer, refazer e apagar no meio de um arrasto encerram o arrasto (a peça fica onde está): senão o quadro
    // seguinte reaplicaria a posição em cima do que acabou de ser desfeito ou apagado.
    if (mod && k === 'z') {
      e.preventDefault();
      quadro.current?.encerrarGesto();
      return historia(e.shiftKey ? refazer : desfazer);
    }
    if (mod && k === 'y') {
      e.preventDefault();
      quadro.current?.encerrarGesto();
      return historia(refazer);
    }
    if (mod && k === 'd' && sel?.tipo === 'peca') {
      e.preventDefault();
      return duplicar(sel.id);
    }
    if (pl.tecla(e)) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !play) {
      e.preventDefault();
      quadro.current?.encerrarGesto();
      return apagarSelecao();
    }
    if (e.key === 'Escape') {
      if (destaque) return setDestaque(null);
      if (ferramenta !== 'selecionar') return setFerramenta('selecionar');
      if (sel) return setSel(null);
      return;
    }
    // Enter num botão ou link (Dar play, Desfazer, Painel, menu) é dele: ativa o botão, não renomeia. A peça focada
    // (também role=button) trata o Enter no quadro e não deixa ele chegar aqui.
    if (e.key === 'Enter' && (e.target as Element | null)?.closest?.('button, a, [role=button], [role=menuitem], [role=option], [role=tab], summary')) return;
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
    const ponteiro = e.pointerId;
    const mover = (ev: PointerEvent) => {
      if (ev.pointerId !== ponteiro) return;
      if (!arrastou && criaAlgo(t) && !soLeitura && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) arrastou = true;
      if (arrastou) setFantasma({ t, x: ev.clientX, y: ev.clientY });
    };
    const largar = () => {
      removeEventListener('pointermove', mover);
      removeEventListener('pointerup', soltar);
      removeEventListener('pointercancel', cancelar);
      setFantasma(null);
    };
    // O sistema tomou o ponteiro (rolagem no toque, alerta): sem os ouvintes pendurados e sem o fantasma na tela.
    const cancelar = (ev: PointerEvent) => ev.pointerId === ponteiro && largar();
    const soltar = (ev: PointerEvent) => {
      if (ev.pointerId !== ponteiro) return;
      largar();
      if (arrastou && criaAlgo(t)) {
        if (quadro.current?.contem(ev.clientX, ev.clientY)) {
          const w = quadro.current.paraMundo(ev.clientX, ev.clientY);
          criar(t, w.x, w.y);
        }
        return setFerramenta('selecionar');
      }
      alternarFerramenta(t);
    };
    addEventListener('pointermove', mover);
    addEventListener('pointerup', soltar);
    addEventListener('pointercancel', cancelar);
  };

  /**
   * Ferramenta ativada sem ponteiro: quem não usa mouse não tem como clicar no quadro, então a forma nasce já no meio
   * da parte visível (na grade), selecionada e com o foco; a ferramenta volta pro Selecionar. Selecionar e Mover o
   * quadro só são escolhidos, como no clique.
   */
  const ativarPeloTeclado = (t: Ferramenta) => {
    if (!criaAlgo(t)) return alternarFerramenta(t);
    const c = quadro.current?.centro();
    if (soLeitura || !c) return;
    criar(t, c.x, c.y, false);
    setFerramenta('selecionar');
  };

  /** Clique numa ferramenta: escolhe; clicar de novo numa forma já escolhida volta pro Selecionar. */
  const alternarFerramenta = (t: Ferramenta) => {
    const nova = ferramenta === t && criaAlgo(t) ? 'selecionar' : t;
    setFerramenta(nova);
    if (criaAlgo(nova)) avisar(`Clique no quadro pra pôr ${nova === 'grupo' ? 'o grupo' : nova === 'nota' ? 'a nota' : FORMAS[nova].nome}.`);
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
      // Teclado (Enter, espaço) e leitor de tela: clique sem ponteiro (`detail` 0). O do mouse o pointerup já tratou.
      onClick={(e) => e.detail === 0 && ativarPeloTeclado(t)}
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
    <div className={`editor${estilo.ondas ? ' ondas' : ''}${estilo.holofote ? ' holofote-on' : ''}${vis?.pergunta ? ' escolhendo' : destaque ? ' destacando' : ''}${pl.ativo ? ' com-play' : ''}${gaveta ? ' com-gaveta' : ''}`}>
      {/* O nome do fluxo como título da página pro leitor de tela (na tela ele é o campo editável). */}
      <h1 className="so-leitor">{dados.nome}</h1>
      <div className="cabeca-editor">
        {/* Região viva montada vazia: o leitor de tela só anuncia o que muda dentro de uma região que já existia. */}
        <div className="vivo" role="status">
          {trava.estado === 'outra' && !parado && (
            <div className="faixa">
              {trava.por ? `${trava.por} está editando este fluxo` : 'Outra pessoa está editando este fluxo'}
              {trava.ate && ` (até ${new Date(trava.ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })}, se parar de mexer)`}. Dá pra ver e dar play; a
              edição libera quando a trava vencer ou a pessoa fechar o fluxo.
            </div>
          )}
          {trava.estado === 'incerta' && !parado && (
            <div className="faixa">Não deu pra confirmar a edição deste fluxo com o banco (sem conexão?). Dá pra ver e dar play; tentando de novo.</div>
          )}
          {trava.estado === 'liberou' && !parado && (
            <div className="faixa">
              A edição deste fluxo liberou. Recarregue pra editar a versão que está no banco.
              <button className="botao pequeno" type="button" onClick={() => location.reload()}>
                Recarregar
              </button>
            </div>
          )}
        </div>
        {parado && (
          <div className="faixa erro" role="alert">
            {situacao.s === 'conflito'
              ? 'Este fluxo foi salvo em outro lugar (outra pessoa ou outra aba) enquanto estava aberto aqui. As últimas mudanças daqui não foram salvas: recarregue pra continuar da versão que está no banco.'
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
            {trava.estado === 'pegando' ? 'abrindo…' : trava.estado === 'incerta' && !parado ? 'não deu pra confirmar a edição' : soLeitura && !parado ? 'só leitura' : textoSituacao[situacao.s]}
          </span>
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
            <button ref={botaoCenarios} className="botao" type="button" aria-expanded={aberto === 'cenarios'} onClick={() => setAberto(aberto === 'cenarios' ? null : 'cenarios')}>
              Cenários ({cens.length})
            </button>
            <button ref={botaoVersoes} className="botao" type="button" aria-expanded={aberto === 'versoes'} onClick={() => setAberto(aberto === 'versoes' ? null : 'versoes')}>
              Versões
            </button>
            <button ref={botaoCompartilhar} className="botao" type="button" aria-haspopup="dialog" onClick={() => setCompartilhando(true)}>
              <Icone nome="link" />
              Compartilhar
            </button>
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
        {aberto === 'versoes' && (
          <Pop titulo="Versões" voltarPara={botaoVersoes} aoFechar={() => setAberto(null)}>
            <Versoes versoes={vers} soLeitura={soLeitura} acoes={{ marcar: marcarUmaVersao, restaurar }} />
          </Pop>
        )}
        {aberto === 'cenarios' && (
          <Pop titulo="Cenários" voltarPara={botaoCenarios} aoFechar={() => setAberto(null)}>
            <Cenarios
              cenarios={cens}
              situacoes={situacoes}
              nomeDaPeca={(id) => docDiag.pecas.find((p) => p.id === id)?.nome ?? 'peça que não existe mais'}
              soLeitura={soLeitura}
              acoes={acoesCenarios}
            />
          </Pop>
        )}
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

        <div className="quadro-e-gaveta">
        <Quadro
          ref={quadro}
          doc={play ? docPlay : doc}
          estilo={estiloVisto}
          canais={canais}
          canalFluxo={dados.canal}
          nomesCadastros={nomesCadastros}
          sel={sel}
          ferramenta={ferramenta}
          soLeitura={soLeitura}
          play={vis}
          pausado={pl.pausado}
          aoAguaChegar={pl.aguaChegou}
          renomeando={renomeando}
          destaque={destaque}
          acoes={{
            selecionar,
            criar,
            criarLigada,
            ligar,
            mudar: (f, primeiro) => {
              if (vivo.current.soLeitura) return;
              const h = histRef.current;
              const d = f(h.atual);
              if (d === h.atual) return;
              // Um passo por arrasto: o primeiro quadro registra, os seguintes substituem a cabeça. Mas se algo entrou
              // no histórico no meio (um responsável que chegou do servidor), a cabeça não é mais deste arrasto:
              // substituir apagaria esse passo do desfazer, então o quadro vira passo novo.
              const novo = primeiro || ultimoQuadro.current !== h ? registrar(h, d) : substituir(h, d);
              ultimoQuadro.current = novo;
              mudarHist(novo);
              salv.current!.mudou(d, estiloRef.current);
            },
            renomear: setRenomeando,
            gravarNome: (id, texto) => {
              setRenomeando(null);
              const t = texto.trim();
              const d = docAtual();
              if (!t) return;
              if (d.pecas.some((p) => p.id === id)) {
                if (d.pecas.find((p) => p.id === id)!.nome !== t) editar(D.mudarPeca(d, id, { nome: t }));
              } else if (d.grupos.some((g) => g.id === id)) {
                if (d.grupos.find((g) => g.id === id)!.nome !== t) editar(D.mudarGrupo(d, id, { nome: t }));
              } else if (d.notas.some((n) => n.id === id) && d.notas.find((n) => n.id === id)!.texto !== t) editar(D.mudarNota(d, id, { texto: t }));
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
              pausado={pl.pausado}
              velocidade={estiloVisto.velocidade}
              autoEscolha={estilo.autoEscolha}
              corAgua={corAgua}
              canais={canais}
              inicios={escolhendoInicio}
              {...(!soLeitura && { salvarCenario: salvarUmCenario })}
              acoes={{
                escolher,
                pausar: pl.pausar,
                voltar: pl.voltar,
                recomecar: pl.recomecar,
                parar,
                velocidade: mudarVelocidade,
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
            antigos={marcasAntigas}
            marcas={marcas}
            podeSimular={(a) => comCaminho.has(a.chave)}
            soLeitura={soLeitura}
            acoes={{ verNoQuadro, simularAte, marcar, desmarcar: (chave) => void desmarcar(chave) }}
          />
        )}
        </div>

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
            mudarPeca: (id, patch) => editar(D.mudarPeca(docAtual(), id, patch)),
            mudarConexao: (id, patch) => editar(D.mudarConexao(docAtual(), id, patch)),
            inverter: (id) => editar(D.inverterConexao(docAtual(), id)),
            mudarGrupo: (id, patch) => editar(D.mudarGrupo(docAtual(), id, patch)),
            mudarNota: (id, patch) => editar(D.mudarNota(docAtual(), id, patch)),
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
      <Compartilhar
        empresaId={empresaId}
        fluxoId={fluxo.id}
        aberto={compartilhando}
        aoFechar={() => setCompartilhando(false)}
        voltarPara={botaoCompartilhar}
        configurado={linkConfigurado}
        versoes={vers}
        cenarios={cens}
        links={lnks}
        setLinks={setLinks}
        soLeitura={soLeitura}
      />
      <div role="status">{aviso && <div className="aviso">{aviso}</div>}</div>
      {/* Montada vazia: a contagem dos achados, quando muda (adiada). */}
      <div className="so-leitor" role="status">
        {anuncio}
      </div>
    </div>
  );
}
