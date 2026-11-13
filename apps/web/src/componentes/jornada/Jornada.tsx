'use client';

import './jornada.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { indexar, lerRef, type Documento } from '@journey/nucleo/formato';
import type { Opcao } from '@journey/nucleo/motor';
import type { Achado } from '@journey/nucleo/diagnostico';
import { Icone } from '@/componentes/Icone';
import { MapaFluxo } from '@/componentes/mapa/MapaFluxo';
import { cenarioAte } from '@/diagnostico/caminho';
import type { Cenario, Intencional } from '@/lib/dados';
import { montarMapa, type Mapa } from '@/mapa/montar';
import { comparar } from '@/simulacao/comparar';
import { descrever, duracao, horaEm } from '@/simulacao/descrever';
import { estadoAte } from '@/simulacao/estado';
import { passosComOrigem, passosDe } from '@/simulacao/passos';
import { canalInicial, escolher as escolherNa, inicioDe, rodar, voltar as voltarNa, type Modo, type Sessao } from '@/simulacao/sessao';
import { vinculo } from '@/simulacao/vinculo';
import { aprovarResultado, apagarCenario, desmarcarIntencional, marcarIntencional, salvarCenario } from '@/acoes/jornada';
import { Cartao, opcaoDaTecla, type CenarioNoCartao } from './Cartao';
import { PainelDiagnostico } from './PainelDiagnostico';
import { PainelRamais } from './PainelRamais';
import { usePlayer, useSemMovimento } from './usePlayer';

export interface PropsJornada {
  empresaId: string;
  jornadaId: string;
  versao: number;
  documento: Documento;
  diagnostico: Achado[];
  cenarios: Cenario[];
  intencionais: Intencional[];
}

type Aba = 'simular' | 'diagnostico' | 'ramais';
const VELOCIDADES = [1, 2, 4];
/** Achado que dá pra ver como cadeia a partir dele quando não está no fluxo das entradas. */
const TIPOS_COM_CADEIA = ['ramal', 'fila', 'grupo', 'peca'];

/** Põe (ou tira) o ?cenario= da barra de endereço sem navegar: o Next acompanha o history nativo. */
function marcarUrl(cenarioId: string | null) {
  const u = new URL(window.location.href);
  if (cenarioId) u.searchParams.set('cenario', cenarioId);
  else u.searchParams.delete('cenario');
  if (u.href !== window.location.href) window.history.replaceState(null, '', u);
}

/** Entrada que não é uma entrada (ramal no modo "ninguém atende") começa no mapa daquele ponto. */
const raizDoCenario = (entrada: string) => (lerRef(entrada)?.tipo === 'entrada' ? null : entrada);

const sessaoDo = (c: Cenario): Sessao => ({ entrada: c.entrada, inicio: c.inicio, modo: c.modo, escolhas: c.escolhas });

/** Os nós e canos de um achado num mapa. */
function idsDoAchado(mapa: Mapa, a: Achado): string[] {
  const ids = new Set<string>();
  for (const r of a.refs) {
    for (const id of mapa.porRef.get(r) ?? []) ids.add(id);
    const cano = r.startsWith('saida:') ? mapa.porSaida.get(r.slice(6)) : undefined;
    if (cano) {
      ids.add(cano);
      const c = mapa.canos.find((x) => x.id === cano)!;
      ids.add(c.de);
      if (c.para) ids.add(c.para);
    }
  }
  return [...ids];
}

export function Jornada(p: PropsJornada) {
  // O documento só troca quando a versão troca: um refresh com a mesma versão (depois de salvar ou aprovar)
  // traz um objeto novo, e refazer o mapa no meio da simulação mexeria na câmera e na animação.
  const [base, setBase] = useState({ versao: p.versao, documento: p.documento });
  if (base.versao !== p.versao) setBase({ versao: p.versao, documento: p.documento });
  const documento = base.documento;
  const idx = useMemo(() => indexar(documento), [documento]);

  // O que o mapa mostra: o fluxo das entradas, ou a cadeia a partir de um ponto (ramal, fila…).
  // Um mapa por raiz, guardado enquanto o documento é o mesmo ("ver no mapa" procura em outro mapa antes de trocar).
  const [raiz, setRaiz] = useState<string | null>(null);
  const mapas = useMemo(() => new Map<string | null, Mapa>(), [documento]);
  const mapaPara = useCallback(
    (r: string | null) => {
      let m = mapas.get(r);
      if (!m) {
        m = montarMapa(documento, r ? { raizes: [r] } : {});
        mapas.set(r, m);
      }
      return m;
    },
    [mapas, documento],
  );
  const mapa = useMemo(() => mapaPara(raiz), [mapaPara, raiz]);

  const [sessao, setSessao] = useState<Sessao | null>(null);
  /** Cada play novo conta uma rodada: o cartão começa limpo (nome do cenário, mensagem). */
  const [rodada, setRodada] = useState(0);
  // Só o id: o cenário vem sempre da lista mais recente (aprovar e apagar atualizam a lista).
  const [cenarioId, setCenarioId] = useState<string | null>(null);
  const cenarioAberto = cenarioId ? (p.cenarios.find((c) => c.id === cenarioId) ?? null) : null;
  /** Se a simulação ainda é o caminho do cenário aberto; quando não é, ele não vale (e é solto em `mudarSessao`). */
  const ligacao = cenarioAberto && sessao ? vinculo(sessaoDo(cenarioAberto), sessao) : null;
  const cenario = ligacao ? cenarioAberto : null;

  const execucao = useMemo(() => (sessao ? rodar(idx, sessao) : null), [idx, sessao]);
  /** O canal da entrada: o motor o assume calado, então o desenho e o resumo precisam dele. */
  const canal = useMemo(() => (sessao ? canalInicial(idx, sessao.entrada) : 'telefonia'), [idx, sessao]);
  const { passos, evento: origem } = useMemo(
    () => (execucao ? passosComOrigem(mapa, execucao.eventos, canal) : { passos: [], evento: [] }),
    [mapa, execucao, canal],
  );

  const [velocidade, setVelocidade] = useState(1);
  const [pausado, setPausado] = useState(false);
  const [seguir, setSeguir] = useState(true);
  const semMovimento = useSemMovimento();
  const { k, irPara } = usePlayer(passos, { velocidade, pausado, semMovimento });
  const estado = useMemo(() => estadoAte(passos, k), [passos, k]);
  const noFim = k >= passos.length;

  const [aba, setAba] = useState<Aba>('simular');
  const [destaque, setDestaque] = useState<Set<string> | null>(null);
  const [enquadrar, setEnquadrar] = useState<{ tipo: 'tudo' | 'nos'; ids?: string[]; n: number }>({ tipo: 'tudo', n: 0 });
  const pedirEnquadrar = (tipo: 'tudo' | 'nos', ids?: string[]) => setEnquadrar((e) => ({ tipo, ...(ids && { ids }), n: e.n + 1 }));
  const [erroCenarios, setErroCenarios] = useState<{ id: string; texto: string } | null>(null);

  const [inicio, setInicio] = useState('');
  // Padrão: a primeira entrada que vai pra uma peça (passa pela URA); senão, a primeira.
  const [entradaEscolhida, setEntradaEscolhida] = useState(() => {
    const e = p.documento.entradas.find((x) => lerRef(x.destino)?.tipo === 'peca') ?? p.documento.entradas[0];
    return e ? `entrada:${e.id}` : '';
  });
  const [modo, setModo] = useState<Modo>('cenario');
  useEffect(() => setInicio(inicioDe(new Date())), []);

  const soltarCenario = () => {
    setCenarioId(null);
    marcarUrl(null);
  };

  /** Começa uma simulação nova; com cenário, ele fica aberto (e no link) enquanto a simulação for o caminho dele. */
  const comecar = useCallback(
    (s: Sessao, novaRaiz: string | null, c: Cenario | null = null) => {
      setRaiz(novaRaiz);
      setDestaque(null);
      setCenarioId(c?.id ?? null);
      marcarUrl(c?.id ?? null);
      setPausado(false);
      setSessao(s);
      setRodada((n) => n + 1);
      irPara(0);
    },
    [irPara],
  );

  // ?cenario=<id> abre e toca o cenário.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('cenario');
    const c = id ? p.cenarios.find((x) => x.id === id) : undefined;
    if (c) comecar(sessaoDo(c), raizDoCenario(c.entrada), c);
    // Só quando a página abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Escolher e voltar mudam as escolhas: o cenário aberto continua só se ainda for o caminho dele. */
  const mudarSessao = (s: Sessao) => {
    if (cenarioAberto && !vinculo(sessaoDo(cenarioAberto), s)) soltarCenario();
    setSessao(s);
  };

  const escolher = (o: Opcao) => {
    if (!sessao) return;
    setDestaque(null);
    mudarSessao(escolherNa(sessao, o));
  };

  const voltar = () => {
    if (!sessao || sessao.escolhas.length === 0) return;
    const s = voltarNa(sessao);
    const ps = passosDe(mapa, rodar(idx, s).eventos, canalInicial(idx, s.entrada));
    mudarSessao(s);
    irPara(ps.length);
  };

  const recomecar = () => {
    setPausado(false);
    irPara(0);
  };

  // Teclado: quando a decisão está na tela, a tecla do selo (dígito, *, #, S ou N) escolhe.
  const perguntando = estado.perguntando;
  // Sem lista de dependências: a cada render, o ouvinte usa a sessão e a pergunta de agora.
  useEffect(() => {
    if (!perguntando || !noFim) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const o = opcaoDaTecla(perguntando.opcoes, e.key);
      if (!o) return;
      e.preventDefault();
      escolher(o);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  });

  const foco = useMemo(() => {
    if (destaque) return destaque;
    // Decisão num ponto fora deste mapa: não há válvula pra acender.
    if (!perguntando || !noFim || perguntando.no === null) return null;
    const canos = mapa.canos.filter((c) => c.de === perguntando.no);
    return new Set<string>([perguntando.no, ...canos.map((c) => c.id), ...canos.flatMap((c) => (c.para ? [c.para] : []))]);
  }, [destaque, perguntando, noFim, mapa]);

  // Na decisão, a câmera mostra a válvula e pra onde cada opção leva (os chips ficam à vista).
  const perguntaNo = noFim ? (perguntando?.no ?? undefined) : undefined;
  useEffect(() => {
    if (!perguntaNo || !seguir) return;
    const destinos = mapa.canos.filter((c) => c.de === perguntaNo && c.para).map((c) => c.para!);
    pedirEnquadrar('nos', [perguntaNo, ...destinos]);
  }, [perguntaNo, seguir, mapa]);

  const agora = () => inicio || inicioDe(new Date());

  const tocar = (noId: string) => {
    const n = mapa.nos.find((x) => x.id === noId);
    if (!n) return;
    if (n.tipo === 'ramais_diretos') {
      setAba('ramais');
      return;
    }
    const entrada = n.entradas?.[0] ?? n.ref;
    comecar({ entrada, inicio: agora(), modo, escolhas: [] }, raiz);
  };

  const abrirPonto = (ref: string, m: 'ninguem_atende' | 'cenario') => {
    comecar({ entrada: ref, inicio: agora(), modo: m, escolhas: [] }, ref);
  };

  /**
   * Holofote nas peças do achado. Procura no mapa da tela; se não está e a tela mostra a cadeia de um ponto,
   * no fluxo das entradas; se ainda não, na cadeia a partir do próprio ponto (ramal, fila, grupo, peça).
   * Devolve o aviso quando o achado não aparece em mapa nenhum.
   */
  const verNoMapa = (a: Achado): string | undefined => {
    let r = raiz;
    let ids = idsDoAchado(mapaPara(r), a);
    if (ids.length === 0 && r !== null) {
      r = null;
      ids = idsDoAchado(mapaPara(r), a);
    }
    const principal = a.refs[0];
    if (ids.length === 0 && principal && TIPOS_COM_CADEIA.includes(lerRef(principal)?.tipo ?? '')) {
      r = principal;
      ids = idsDoAchado(mapaPara(r), a);
    }
    const m = mapaPara(r);
    const nos = ids.filter((id) => m.nos.some((n) => n.id === id));
    if (nos.length === 0) return 'Este achado não aparece no mapa.';
    setRaiz(r);
    setDestaque(new Set(ids));
    pedirEnquadrar('nos', nos);
    return undefined;
  };

  /**
   * "Simular" de um achado. Ramal, fila ou grupo: o que acontece quando ninguém atende ali (ciclos e transbordos aparecem).
   * O resto: um caminho de alguma entrada até o ponto, no modo livre (as escolhas forçam o caminho, sem depender da hora).
   */
  const simularAchado = (a: Achado): string | undefined => {
    const alvo = a.refs[0]!;
    if (['ramal', 'fila', 'grupo'].includes(lerRef(alvo)?.tipo ?? '')) {
      setAba('simular');
      abrirPonto(alvo, 'ninguem_atende');
      return undefined;
    }
    const c = cenarioAte(documento, alvo);
    if (!c) return verNoMapa(a);
    setAba('simular');
    comecar({ entrada: c.entrada, inicio: agora(), modo: 'livre', escolhas: c.escolhas }, null);
    return undefined;
  };

  const encerrar = () => {
    setSessao(null);
    soltarCenario();
    irPara(0);
  };

  const apagar = async (c: Cenario) => {
    if (!window.confirm(`Apagar o cenário “${c.nome}”?`)) return;
    setErroCenarios(null);
    const r = await apagarCenario(p.empresaId, p.jornadaId, c.id);
    if (r.erro) setErroCenarios({ id: c.id, texto: r.erro });
    else if (cenarioId === c.id) soltarCenario();
  };

  // Comparação: quando a simulação refez todas as escolhas do cenário e a animação chegou ao fim dos passos
  // (no fim da ligação ou numa decisão que ficou pendente, como depois de um import que tirou uma opção).
  const cartaoCenario: CenarioNoCartao | null =
    cenario && ligacao === 'completo' && sessao && execucao && noFim
      ? {
          nome: cenario.nome,
          versao: cenario.versao_aprovada,
          divergencia: comparar(cenario.esperado, execucao.eventos),
          aprovar: async () =>
            (
              await aprovarResultado(p.empresaId, p.jornadaId, cenario.id, {
                entrada: sessao.entrada,
                inicio: sessao.inicio,
                modo: sessao.modo,
                escolhas: [...sessao.escolhas],
                esperado: execucao.eventos,
                versao: p.versao,
              })
            ).erro,
        }
      : null;

  // A linha do tempo acompanha a animação: os eventos até o que gerou o último passo na tela.
  const mostrados = !execucao ? 0 : noFim ? execucao.eventos.length : k === 0 ? 0 : origem[k - 1]! + 1;
  const linhas = execucao
    ? execucao.eventos
        .slice(0, mostrados)
        .map((e) => descrever(idx, execucao.inicioMs, e))
        .filter((l) => l !== null)
    : [];
  const abertos = p.diagnostico.filter((a) => !p.intencionais.some((i) => i.chave === a.chave) && a.gravidade !== 'observacao').length;
  const entradas = documento.entradas;

  return (
    <main className="jornada">
      <section className="palco" aria-label="Mapa do fluxo">
        <div className="palco-mapa">
        <MapaFluxo
          mapa={mapa}
          estado={estado}
          foco={foco}
          duracaoCano={semMovimento ? 0 : 750 / velocidade}
          podeEscolher={noFim && perguntando !== null}
          tocar={tocar}
          escolher={escolher}
          irPara={(id) => {
            setDestaque(new Set([id]));
            pedirEnquadrar('nos', [id]);
          }}
          seguir={seguir && sessao !== null}
          semMovimento={semMovimento}
          enquadrar={enquadrar}
        />
        <div className="hud">
          <span className="pilula" style={{ ['--c' as string]: `var(--w-${estado.canal})` }}>
            <span className="ponto-cor" />
            {estado.canal}
          </span>
          {raiz && (
            <span className="pilula">
              <span className="rot">a partir de</span> {raiz}
            </span>
          )}
          {execucao && (
            <>
              <span className="pilula">{horaEm(execucao.inicioMs, estado.t)}</span>
              <span className="pilula">
                <span className="rot">na linha</span> {duracao(estado.t)}
              </span>
            </>
          )}
        </div>
        <div className="ferramentas">
          <button className="bi" type="button" aria-label="Ver o mapa inteiro" onClick={() => pedirEnquadrar('tudo')}>
            <Icone nome="enquadrar" />
          </button>
          {raiz && (
            <button className="bi" type="button" aria-label="Voltar ao fluxo das entradas" onClick={() => { setRaiz(null); setDestaque(null); }}>
              <Icone nome="fechar" />
            </button>
          )}
          {destaque && (
            <button className="bi largo" type="button" onClick={() => setDestaque(null)}>
              limpar
            </button>
          )}
        </div>
        {sessao && (
          <div className="doca">
            <button className="bi" type="button" aria-label={pausado ? 'Continuar' : 'Pausar'} onClick={() => setPausado(!pausado)}>
              <Icone nome={pausado ? 'play' : 'pausa'} />
            </button>
            <button className="bi" type="button" aria-label="Voltar uma decisão" title="Voltar uma decisão" disabled={sessao.escolhas.length === 0} onClick={voltar}>
              <Icone nome="desfazer" />
            </button>
            <button className="bi" type="button" aria-label="Recomeçar" title="Recomeçar" onClick={recomecar}>
              <Icone nome="recomecar" />
            </button>
            <span className="sep" />
            <button className="bi largo" type="button" aria-label={`Velocidade ${velocidade}×`} onClick={() => setVelocidade(VELOCIDADES[(VELOCIDADES.indexOf(velocidade) + 1) % VELOCIDADES.length]!)}>
              {velocidade}×
            </button>
            <button className="bi" type="button" aria-label="Câmera segue a água" aria-pressed={seguir} onClick={() => setSeguir(!seguir)}>
              <Icone nome="seguir" />
            </button>
            <span className="sep" />
            <button className="bi" type="button" aria-label="Encerrar simulação" onClick={encerrar}>
              <Icone nome="fechar" />
            </button>
          </div>
        )}
        </div>
        <Cartao
          key={rodada}
          idx={idx}
          rodando={sessao !== null}
          estado={estado}
          noFim={noFim}
          eventos={execucao?.eventos ?? []}
          canal={canal}
          livre={sessao?.modo === 'livre'}
          escolher={escolher}
          recomecar={recomecar}
          verRamal={(ref) => sessao && comecar({ ...sessao, entrada: ref, escolhas: [], modo: 'ninguem_atende' }, ref)}
          cenario={cartaoCenario}
          salvar={
            sessao && execucao
              ? async (nome) => (await salvarCenario(p.empresaId, p.jornadaId, { nome, ...sessao, escolhas: [...sessao.escolhas], esperado: execucao.eventos, versao: p.versao })).erro
              : null
          }
        />
      </section>

      <aside className="painel" aria-label="Painel">
        <div className="abas" role="tablist">
          <button className="aba" role="tab" aria-selected={aba === 'simular'} onClick={() => setAba('simular')}>
            Simular
          </button>
          <button className="aba" role="tab" aria-selected={aba === 'diagnostico'} onClick={() => setAba('diagnostico')}>
            Diagnóstico {abertos > 0 && <span className="contador">{abertos}</span>}
          </button>
          <button className="aba" role="tab" aria-selected={aba === 'ramais'} onClick={() => setAba('ramais')}>
            Ramais
          </button>
        </div>

        {aba === 'simular' && (
          <div>
            <div className="rotulo-secao">Ligação</div>
            <form
              style={{ display: 'grid', gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (entradaEscolhida) comecar({ entrada: entradaEscolhida, inicio: agora(), modo, escolhas: [] }, null);
              }}
            >
              <label className="campo">
                Entrada
                <select value={entradaEscolhida} onChange={(e) => setEntradaEscolhida(e.target.value)}>
                  {entradas.map((e) => (
                    <option key={e.id} value={`entrada:${e.id}`}>
                      {e.numero}
                      {e.nome ? ` · ${e.nome}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Dia e hora
                <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </label>
              <label className="campo">
                Quem decide
                <select value={modo} onChange={(e) => setModo(e.target.value as Modo)}>
                  <option value="cenario">o relógio decide sozinho; o resto, tu</option>
                  <option value="livre">tu decide tudo, inclusive o relógio</option>
                  <option value="ninguem_atende">ninguém atende (filas, grupos e ramais)</option>
                </select>
              </label>
              <button className="botao primario" disabled={!entradaEscolhida}>
                <Icone nome="play" /> Dar play
              </button>
            </form>

            <div className="rotulo-secao">E se…</div>
            {p.cenarios.length === 0 ? (
              <p className="vazio">No fim de uma simulação, salva o caminho como cenário pra mostrar pra alguém ou conferir depois de um import.</p>
            ) : (
              <div className="lista-botoes">
                {p.cenarios.map((c) => (
                  <div key={c.id}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="item-lista"
                        aria-pressed={cenario?.id === c.id}
                        onClick={() => comecar(sessaoDo(c), raizDoCenario(c.entrada), c)}
                      >
                        <b>{c.nome}</b>
                        <span>
                          {c.inicio.replace('T', ' ')} · versão {c.versao_aprovada}
                        </span>
                      </button>
                      <button className="bi" type="button" aria-label={`Apagar ${c.nome}`} onClick={() => void apagar(c)}>
                        <Icone nome="fechar" />
                      </button>
                    </div>
                    {erroCenarios?.id === c.id && (
                      <p className="aviso-caixa erro" role="alert" style={{ marginTop: 6 }}>
                        {erroCenarios.texto}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="rotulo-secao">Linha do tempo</div>
            {linhas.length === 0 ? (
              <p className="vazio">A linha do tempo aparece aqui quando a água começar a correr.</p>
            ) : (
              <ol className="linha-tempo" data-testid="linha-do-tempo">
                {linhas.map((l, i) => (
                  <li key={i} className={l.tom}>
                    <time>{l.hora.slice(4)}</time>
                    <span className="marca-t" />
                    <p>{l.texto}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {aba === 'diagnostico' && (
          <PainelDiagnostico
            idx={idx}
            achados={p.diagnostico}
            intencionais={p.intencionais}
            verNoMapa={verNoMapa}
            simular={simularAchado}
            marcar={async (chave, nota) => (await marcarIntencional(p.empresaId, p.jornadaId, chave, nota)).erro}
            desmarcar={async (chave) => (await desmarcarIntencional(p.empresaId, p.jornadaId, chave)).erro}
          />
        )}

        {aba === 'ramais' && <PainelRamais idx={idx} atual={raiz?.startsWith('ramal:') ? raiz : null} abrir={abrirPonto} />}

        <p className="dica" style={{ marginTop: 18 }}>
          Versão {p.versao}. Tempos de fila e de áudio sem dado da central aparecem como exemplo.
        </p>
      </aside>
    </main>
  );
}
