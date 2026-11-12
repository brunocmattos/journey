'use client';

import './jornada.css';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { indexar, lerRef, type Achado, type Documento, type Opcao } from '@journey/nucleo';
import { Icone } from '@/componentes/Icone';
import { MapaFluxo } from '@/componentes/mapa/MapaFluxo';
import { cenarioAte } from '@/diagnostico/caminho';
import type { Cenario, Intencional } from '@/lib/dados';
import { montarMapa } from '@/mapa/montar';
import { comparar } from '@/simulacao/comparar';
import { descrever, duracao, horaEm } from '@/simulacao/descrever';
import { estadoAte } from '@/simulacao/estado';
import { passosDe } from '@/simulacao/passos';
import { canalInicial, escolher as escolherNa, inicioDe, rodar, voltar as voltarNa, type Modo, type Sessao } from '@/simulacao/sessao';
import { aprovarResultado, apagarCenario, desmarcarIntencional, marcarIntencional, salvarCenario } from '@/acoes/jornada';
import { Cartao } from './Cartao';
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

export function Jornada(p: PropsJornada) {
  const router = useRouter();
  const busca = useSearchParams();
  const [, iniciar] = useTransition();
  const idx = useMemo(() => indexar(p.documento), [p.documento]);

  // O que o mapa mostra: o fluxo das entradas, ou a cadeia a partir de um ponto (ramal, fila…).
  const [raiz, setRaiz] = useState<string | null>(null);
  const mapa = useMemo(() => montarMapa(p.documento, raiz ? { raizes: [raiz] } : {}), [p.documento, raiz]);

  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [cenarioAberto, setCenarioAberto] = useState<Cenario | null>(null);
  const execucao = useMemo(() => (sessao ? rodar(idx, sessao) : null), [idx, sessao]);
  /** O canal da entrada: o motor o assume calado, então o desenho e o resumo precisam dele. */
  const canal = useMemo(() => (sessao ? canalInicial(idx, sessao.entrada) : 'telefonia'), [idx, sessao]);
  const passos = useMemo(() => (execucao ? passosDe(mapa, execucao.eventos, canal) : []), [mapa, execucao, canal]);

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

  const [inicio, setInicio] = useState('');
  // Padrão: a primeira entrada que vai pra uma peça (passa pela URA); senão, a primeira.
  const [entradaEscolhida, setEntradaEscolhida] = useState(() => {
    const e = p.documento.entradas.find((x) => lerRef(x.destino)?.tipo === 'peca') ?? p.documento.entradas[0];
    return e ? `entrada:${e.id}` : '';
  });
  const [modo, setModo] = useState<Modo>('cenario');
  useEffect(() => setInicio(inicioDe(new Date())), []);

  /** Começa uma simulação nova. */
  const comecar = useCallback(
    (s: Sessao, novaRaiz: string | null, cenario: Cenario | null = null) => {
      setRaiz(novaRaiz);
      setDestaque(null);
      setCenarioAberto(cenario);
      setPausado(false);
      setSessao(s);
      irPara(0);
    },
    [irPara],
  );

  // ?cenario=<id> abre e toca o cenário.
  useEffect(() => {
    const id = busca.get('cenario');
    const c = id ? p.cenarios.find((x) => x.id === id) : undefined;
    if (c) comecar({ entrada: c.entrada, inicio: c.inicio, modo: c.modo, escolhas: c.escolhas }, raizDoCenario(c.entrada), c);
    // Só quando a página abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Entrada que não é uma entrada (ramal no modo "ninguém atende") começa no mapa daquele ponto. */
  const raizDoCenario = (entrada: string) => (lerRef(entrada)?.tipo === 'entrada' ? null : entrada);

  const escolher = useCallback(
    (o: Opcao) => {
      if (!sessao) return;
      setSessao(escolherNa(sessao, o));
    },
    [sessao],
  );

  const voltar = () => {
    if (!sessao || sessao.escolhas.length === 0) return;
    const s = voltarNa(sessao);
    const ps = passosDe(mapa, rodar(idx, s).eventos, canalInicial(idx, s.entrada));
    setSessao(s);
    irPara(ps.length);
  };

  // Teclado numérico: quando quem liga decide, a tecla escolhe.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest('input, textarea, select')) return;
      const pg = estado.perguntando;
      if (!pg || !noFim || pg.quem !== 'quem_liga') return;
      const o = pg.opcoes.find((x) => x.disponivel && x.opcao === e.key);
      if (o) escolher(o);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [estado.perguntando, noFim, escolher]);

  const foco = useMemo(() => {
    if (destaque) return destaque;
    const pg = estado.perguntando;
    // Decisão num ponto fora deste mapa: não há válvula pra acender.
    if (!pg || !noFim || pg.no === null) return null;
    const canos = mapa.canos.filter((c) => c.de === pg.no);
    return new Set<string>([pg.no, ...canos.map((c) => c.id), ...canos.flatMap((c) => (c.para ? [c.para] : []))]);
  }, [destaque, estado.perguntando, noFim, mapa]);

  // Na decisão, a câmera mostra a válvula e pra onde cada opção leva (os chips ficam à vista).
  const perguntaNo = noFim ? (estado.perguntando?.no ?? undefined) : undefined;
  useEffect(() => {
    if (!perguntaNo || !seguir) return;
    const destinos = mapa.canos.filter((c) => c.de === perguntaNo && c.para).map((c) => c.para!);
    pedirEnquadrar('nos', [perguntaNo, ...destinos]);
  }, [perguntaNo, seguir, mapa]);

  const tocar = (noId: string) => {
    const n = mapa.nos.find((x) => x.id === noId);
    if (!n) return;
    if (n.tipo === 'ramais_diretos') {
      setAba('ramais');
      return;
    }
    const entrada = n.entradas?.[0] ?? n.ref;
    comecar({ entrada, inicio: inicio || inicioDe(new Date()), modo, escolhas: [] }, raiz);
  };

  const abrirPonto = (ref: string, m: 'ninguem_atende' | 'cenario') => {
    comecar({ entrada: ref, inicio: inicio || inicioDe(new Date()), modo: m, escolhas: [] }, ref);
  };

  const refsDoAchado = (a: Achado) => {
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
    return ids;
  };

  const verNoMapa = (a: Achado) => {
    let ids = refsDoAchado(a);
    if (ids.size === 0 && raiz === null) {
      // O ponto não está no fluxo das entradas: mostra a cadeia a partir dele.
      const principal = a.refs[0]!;
      if (['ramal', 'fila', 'grupo', 'peca'].includes(lerRef(principal)?.tipo ?? '')) {
        setRaiz(principal);
        setDestaque(new Set([principal]));
        pedirEnquadrar('nos', [principal]);
        return;
      }
    }
    if (ids.size === 0) ids = new Set();
    setDestaque(ids);
    pedirEnquadrar('nos', [...ids].filter((id) => mapa.nos.some((n) => n.id === id)));
  };

  /**
   * "Simular" de um achado. Ramal, fila ou grupo: o que acontece quando ninguém atende ali (ciclos e transbordos aparecem).
   * O resto: um caminho de alguma entrada até o ponto, no modo livre (as escolhas forçam o caminho, sem depender da hora).
   */
  const simularAchado = (a: Achado) => {
    const alvo = a.refs[0]!;
    setAba('simular');
    if (['ramal', 'fila', 'grupo'].includes(lerRef(alvo)?.tipo ?? '')) return abrirPonto(alvo, 'ninguem_atende');
    const c = cenarioAte(p.documento, alvo);
    if (c) comecar({ entrada: c.entrada, inicio: inicio || inicioDe(new Date()), modo: 'livre', escolhas: c.escolhas }, null);
    else verNoMapa(a);
  };

  const encerrar = () => {
    setSessao(null);
    setCenarioAberto(null);
    irPara(0);
  };

  const divergencia = cenarioAberto && execucao && noFim ? comparar(cenarioAberto.esperado, execucao.eventos) : null;
  const linhas = execucao
    ? execucao.eventos
        .filter((e) => noFim || e.t <= estado.t)
        .map((e) => descrever(idx, execucao.inicioMs, e))
        .filter((l) => l !== null)
    : [];
  const abertos = p.diagnostico.filter((a) => !p.intencionais.some((i) => i.chave === a.chave) && a.gravidade !== 'observacao').length;
  const entradas = p.documento.entradas;

  return (
    <main className="jornada">
      <section className="palco" aria-label="Mapa do fluxo">
        <div className="palco-mapa">
        <MapaFluxo
          mapa={mapa}
          estado={estado}
          foco={foco}
          duracaoCano={semMovimento ? 0 : 750 / velocidade}
          podeEscolher={noFim && estado.perguntando !== null}
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
        <div className="hud" aria-live="polite">
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
            <button className="bi" type="button" aria-label="Recomeçar" title="Recomeçar" onClick={() => irPara(0)}>
              <Icone nome="recomecar" />
            </button>
            <span className="sep" />
            <button className="bi largo" type="button" aria-label="Velocidade" onClick={() => setVelocidade(VELOCIDADES[(VELOCIDADES.indexOf(velocidade) + 1) % VELOCIDADES.length]!)}>
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
          idx={idx}
          rodando={sessao !== null}
          estado={estado}
          noFim={noFim}
          eventos={execucao?.eventos ?? []}
          canal={canal}
          livre={sessao?.modo === 'livre'}
          escolher={escolher}
          recomecar={() => irPara(0)}
          verRamal={(ref) => sessao && comecar({ ...sessao, entrada: ref, escolhas: [], modo: 'ninguem_atende' }, ref)}
          cenario={
            cenarioAberto && execucao
              ? {
                  nome: cenarioAberto.nome,
                  versao: cenarioAberto.versao_aprovada,
                  divergencia,
                  aprovar: () => iniciar(async () => void (await aprovarResultado(p.empresaId, p.jornadaId, cenarioAberto.id, execucao.eventos, p.versao), router.refresh())),
                }
              : null
          }
          salvar={
            sessao && execucao
              ? async (nome) => {
                  const r = await salvarCenario(p.empresaId, p.jornadaId, { nome, ...sessao, escolhas: [...sessao.escolhas], esperado: execucao.eventos, versao: p.versao });
                  router.refresh();
                  return r.erro;
                }
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
                if (entradaEscolhida) comecar({ entrada: entradaEscolhida, inicio: inicio || inicioDe(new Date()), modo, escolhas: [] }, null);
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
                  <div key={c.id} style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="item-lista"
                      aria-pressed={cenarioAberto?.id === c.id}
                      onClick={() => {
                        comecar({ entrada: c.entrada, inicio: c.inicio, modo: c.modo, escolhas: c.escolhas }, raizDoCenario(c.entrada), c);
                        router.replace(`?cenario=${c.id}`, { scroll: false });
                      }}
                    >
                      <b>{c.nome}</b>
                      <span>
                        {c.inicio.replace('T', ' ')} · versão {c.versao_aprovada}
                      </span>
                    </button>
                    <button className="bi" type="button" aria-label={`Apagar ${c.nome}`} onClick={() => iniciar(async () => void (await apagarCenario(p.empresaId, p.jornadaId, c.id)))}>
                      <Icone nome="fechar" />
                    </button>
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
            marcar={async (chave, nota) => {
              await marcarIntencional(p.empresaId, p.jornadaId, chave, nota);
              router.refresh();
            }}
            desmarcar={async (chave) => {
              await desmarcarIntencional(p.empresaId, p.jornadaId, chave);
              router.refresh();
            }}
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
