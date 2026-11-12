'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { criarLink, revogarLink } from '@/acoes/links';
import { dataCurta, descreverLink, enderecoDoLink, rotuloValidade, situacao, VALIDADE_PADRAO, VALIDADES, type LinkResumo, type Validade } from '@/compartilhar/opcoes';
import { Icone } from '@/componentes/Icone';

export interface PropsCompartilhar {
  empresaId: string;
  jornadaId: string;
  /** A versão na tela: é a que fica fixa quando a pessoa escolhe "só esta versão". */
  versao: number;
  cenarios: { id: string; nome: string }[];
  /** O cenário aberto agora, se houver: vem escolhido como cenário inicial. */
  cenarioAberto: string | null;
  links: LinkResumo[];
}

const FALHOU = 'Não deu certo agora. Tenta de novo em instantes.';
const COPIE_A_MAO = 'Não deu pra copiar: seleciona o endereço e copia.';
// A cópia automática do link novo (logo depois de criar) o Safari recusa: o botão Copiar ao lado resolve.
const COPIE_DE_NOVO = 'Clica em Copiar ou seleciona o endereço.';

/** Copia; sem a API de área de transferência (página fora de HTTPS, permissão negada), devolve false. */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/**
 * "Compartilhar" (spec, 14): cria um link só de leitura da jornada, com versão fixa ou a mais recente, nomes escondidos
 * (ligado por padrão), cenário inicial e validade; lista os links já criados, com copiar e revogar.
 */
export function Compartilhar(p: PropsCompartilhar) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const primeiro = useRef<HTMLInputElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const manual = useRef<HTMLInputElement>(null);
  const titulo = useId();
  const dica = useId();
  // Cada abertura conta uma vez: a resposta de um envio de uma abertura anterior não mexe na de agora.
  const vez = useRef(0);
  // Só a lista e o link novo dependem da abertura: usam a hora e o endereço da janela, que no servidor não existem.
  const [aberto, setAberto] = useState<{ agora: Date; origem: string } | null>(null);
  const [fixa, setFixa] = useState(false);
  const [esconder, setEsconder] = useState(true);
  const [cenarioId, setCenarioId] = useState('');
  const [validade, setValidade] = useState<Validade>(VALIDADE_PADRAO);
  /** O que está em envio: 'novo' (criar) e os ids dos links sendo revogados. */
  const [enviando, setEnviando] = useState<ReadonlySet<string>>(new Set());
  /** Um erro por ação ('novo' ou o id do link). */
  const [erros, setErros] = useState<Record<string, string>>({});
  const [novo, setNovo] = useState<string | null>(null);
  /** A última cópia: de onde ('novo' ou o id do link), se deu certo e se foi a automática do link novo. */
  const [copia, setCopia] = useState<{ de: string; ok: boolean; auto: boolean } | null>(null);

  const estaAberto = aberto !== null;
  // O showModal vem depois do render: o diálogo abre já com as opções no padrão, e o foco cai no primeiro controle.
  useEffect(() => {
    const d = dialogo.current;
    if (!estaAberto || !d || d.open) return;
    d.showModal();
    primeiro.current?.focus();
  }, [estaAberto]);

  // Cópia que falhou: o endereço fica selecionado no campo, pronto pra copiar à mão.
  useEffect(() => {
    if (!copia || copia.ok) return;
    const c = copia.de === 'novo' ? campo.current : manual.current;
    c?.focus();
    c?.select();
  }, [copia]);

  const abrir = () => {
    vez.current += 1;
    setFixa(false);
    setEsconder(true);
    setCenarioId(p.cenarioAberto ?? '');
    setValidade(VALIDADE_PADRAO);
    setEnviando(new Set());
    setErros({});
    setNovo(null);
    setCopia(null);
    setAberto({ agora: new Date(), origem: window.location.origin });
  };

  /** Se a resposta ainda é da abertura de agora, com o diálogo à vista. */
  const vigente = (v: number) => vez.current === v && dialogo.current?.open === true;
  const mudarEnvio = (de: string, sim: boolean) =>
    setEnviando((s) => {
      const n = new Set(s);
      if (sim) n.add(de);
      else n.delete(de);
      return n;
    });
  const mostrarErro = (de: string, texto: string | null) =>
    setErros((e) => {
      const n = { ...e };
      if (texto) n[de] = texto;
      else delete n[de];
      return n;
    });
  const atualizarHora = () => setAberto((a) => a && { ...a, agora: new Date() });

  const copiarDe = async (de: string, endereco: string, v = vez.current, auto = false) => {
    const ok = await copiar(endereco);
    if (vigente(v)) setCopia({ de, ok, auto });
  };

  const criar = async () => {
    const v = vez.current;
    mudarEnvio('novo', true);
    mostrarErro('novo', null);
    try {
      const r = await criarLink(p.empresaId, p.jornadaId, { versao: fixa ? p.versao : null, esconderNomes: esconder, cenarioId: cenarioId || null, validade });
      if (!vigente(v)) return;
      if (r.erro || !r.token) {
        mostrarErro('novo', r.erro ?? FALHOU);
        return;
      }
      const endereco = enderecoDoLink(window.location.origin, r.token);
      setNovo(endereco);
      atualizarHora();
      await copiarDe('novo', endereco, v, true);
    } catch {
      if (vigente(v)) mostrarErro('novo', FALHOU);
    } finally {
      if (vez.current === v) mudarEnvio('novo', false);
    }
  };

  const revogar = async (l: LinkResumo) => {
    if (!window.confirm('Revogar este link? Quem abrir depois vê que ele foi revogado. Não tem volta.')) return;
    const v = vez.current;
    mudarEnvio(l.id, true);
    mostrarErro(l.id, null);
    try {
      const r = await revogarLink(p.empresaId, p.jornadaId, l.id);
      if (!vigente(v)) return;
      if (r.erro) mostrarErro(l.id, r.erro);
      else if (novo?.endsWith(`/l/${l.token}`)) setNovo(null);
      atualizarHora();
    } catch {
      if (vigente(v)) mostrarErro(l.id, FALHOU);
    } finally {
      if (vez.current === v) mudarEnvio(l.id, false);
    }
  };

  /** O aviso de uma cópia que falhou. */
  const avisoFalha = copia?.auto ? COPIE_DE_NOVO : COPIE_A_MAO;
  /** O que o leitor de tela ouve: diz qual link foi, pra que copiar outro link também seja anunciado. */
  const anuncio = (() => {
    if (!copia) return '';
    if (!copia.ok) return avisoFalha;
    if (copia.de === 'novo') return 'Copiado: o link novo.';
    const l = p.links.find((x) => x.id === copia.de);
    return `Copiado: o link “${l?.cenario_nome ?? 'sem cenário'}”.`;
  })();

  const erroDe = (de: string) =>
    erros[de] && (
      <p className="aviso-caixa erro" role="alert">
        {erros[de]}
      </p>
    );

  return (
    <>
      <div className="compartilhar">
        <button className="botao pequeno" type="button" onClick={abrir}>
          <Icone nome="link" /> Compartilhar
        </button>
      </div>
      <dialog ref={dialogo} className="dialogo" aria-labelledby={titulo} onClose={() => setAberto(null)}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="cabeca">
            <h2 id={titulo}>Compartilhar</h2>
            <button className="bi" type="button" aria-label="Fechar" onClick={() => dialogo.current?.close()}>
              <Icone nome="fechar" />
            </button>
          </div>
          <p className="mudo" style={{ margin: 0 }}>
            Quem abre o link não precisa de conta: vê o mapa, simula e vê o diagnóstico. Não vê o histórico, os ajustes nem os outros cenários.
          </p>
          <form
            style={{ display: 'grid', gap: 10 }}
            onSubmit={(e) => {
              e.preventDefault();
              void criar();
            }}
          >
            <fieldset className="grupo-escolhas">
              <legend>Versão</legend>
              <label className="escolha">
                <input ref={primeiro} type="radio" name="versao" checked={!fixa} onChange={() => setFixa(false)} /> Sempre a mais recente
              </label>
              <label className="escolha">
                <input type="radio" name="versao" checked={fixa} onChange={() => setFixa(true)} /> Só a versão {p.versao} (a de agora)
              </label>
            </fieldset>
            <label className="escolha">
              <input type="checkbox" checked={esconder} onChange={(e) => setEsconder(e.target.checked)} aria-describedby={dica} /> Esconder nomes
            </label>
            <p id={dica} className="dica" style={{ margin: '-6px 0 0 24px' }}>
              {esconder
                ? 'O nome de quem usa cada ramal sai do link, também dos textos e das opções do mapa. O número do ramal continua.'
                : 'Quem abrir vê os nomes das pessoas nos ramais.'}
            </p>
            <label className="campo">
              Cenário inicial
              <select value={cenarioId} onChange={(e) => setCenarioId(e.target.value)}>
                <option value="">Nenhum: abre o mapa parado</option>
                {p.cenarios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              Validade
              <select value={String(validade)} onChange={(e) => setValidade(e.target.value === 'null' ? null : (Number(e.target.value) as Validade))}>
                {VALIDADES.map((v) => (
                  <option key={String(v)} value={String(v)}>
                    {rotuloValidade(v)}
                  </option>
                ))}
              </select>
            </label>
            <button className="botao primario" disabled={enviando.has('novo')}>
              Criar link
            </button>
            {erroDe('novo')}
          </form>
          {aberto && novo && (
            <div style={{ display: 'grid', gap: 6 }}>
              <div className="linha-form" data-testid="link-novo">
                <input ref={campo} className="entrada-texto" style={{ flex: '1 1 240px' }} readOnly value={novo} aria-label="Endereço do link" onFocus={(e) => e.target.select()} />
                <button className="botao" type="button" onClick={() => void copiarDe('novo', novo)}>
                  {copia?.de === 'novo' && copia.ok ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              {copia?.de === 'novo' && !copia.ok && (
                <p className="dica" style={{ margin: 0 }}>
                  {avisoFalha}
                </p>
              )}
            </div>
          )}
          {/* Uma região de status só, sempre no diálogo: o leitor de tela anuncia cada cópia e a que falhou. */}
          <p role="status" className="so-leitor">
            {anuncio}
          </p>
          <div className="rotulo-secao">Links desta jornada</div>
          {aberto &&
            (p.links.length === 0 ? (
              <p className="vazio">Nenhum link ainda.</p>
            ) : (
              <div className="lista-botoes" data-testid="links">
                {p.links.map((l) => {
                  const s = situacao(l, aberto.agora);
                  const endereco = enderecoDoLink(aberto.origem, l.token);
                  const qual = `“${l.cenario_nome ?? 'sem cenário'}” de ${dataCurta(l.criado_em)}`;
                  return (
                    <div className="achado" key={l.id} data-situacao={s}>
                      <b>{l.cenario_nome ?? 'Sem cenário'}</b>
                      <p>{descreverLink(l, aberto.agora)}</p>
                      <p className="mudo" style={{ fontSize: 12 }}>
                        criado em {dataCurta(l.criado_em)}
                      </p>
                      {s === 'ativo' && (
                        <div className="acoes">
                          <button className="botao pequeno" type="button" aria-label={`Copiar o link ${qual}`} onClick={() => void copiarDe(l.id, endereco)}>
                            {copia?.de === l.id && copia.ok ? 'Copiado' : 'Copiar'}
                          </button>
                          <button
                            className="botao pequeno perigo"
                            type="button"
                            aria-label={`Revogar o link ${qual}`}
                            disabled={enviando.has(l.id)}
                            onClick={() => void revogar(l)}
                          >
                            Revogar
                          </button>
                        </div>
                      )}
                      {s === 'ativo' && copia?.de === l.id && !copia.ok && (
                        <>
                          <input
                            ref={manual}
                            className="entrada-texto"
                            readOnly
                            value={endereco}
                            aria-label={`Endereço pra copiar à mão, ${qual}`}
                            onFocus={(e) => e.target.select()}
                          />
                          <p>{COPIE_A_MAO}</p>
                        </>
                      )}
                      {erroDe(l.id)}
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      </dialog>
    </>
  );
}
