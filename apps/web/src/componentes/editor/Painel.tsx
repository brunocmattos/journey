'use client';

import { useState } from 'react';
import { NOMES_TIPOS, REGRAS, TIPOS_PECA, textoRegra, type Cadastro, type Conexao, type Documento, type Grupo, type Nota, type Peca, type Regra } from '@journey/fluxo';
import type { DadosDoFluxo } from '@/acoes/fluxos';
import { usosNoDocumento, type TipoCadastro } from '@/editor/cadastros';
import type { Selecao } from '@/editor/documento';
import { ESTILO_PADRAO, corDoCanal, type CanalEditor, type Estilo } from '@/editor/estilo';
import { FORMAS, ROTULO_RESPONSAVEL } from '@/editor/pecas';
import { CampoTempo, CampoTexto, Cores, PALETA, PALETA_NOTA, Responsavel } from './Campos';

export type Aba = 'prop' | 'estilo' | 'cad';

export interface AcoesPainel {
  mudarPeca(id: string, patch: Partial<Omit<Peca, 'id'>>): void;
  mudarConexao(id: string, patch: Partial<Omit<Conexao, 'id' | 'de' | 'para'>>): void;
  inverter(id: string): void;
  mudarGrupo(id: string, patch: Partial<Pick<Grupo, 'nome' | 'cor'>>): void;
  mudarNota(id: string, patch: Partial<Pick<Nota, 'texto' | 'cor'>>): void;
  apagar(): void;
  duplicar(id: string): void;
  selecionar(s: Selecao): void;
  mudarFluxo(d: DadosDoFluxo): void;
  apagarFluxo(): void;
  criarCadastro(tipo: string, nome: string): Promise<Cadastro | null>;
  renomearCadastro(id: string, nome: string): Promise<void>;
  verCadastro(id: string): void;
  mudarEstilo(e: Estilo): void;
}

export interface DadosFluxo {
  nome: string;
  descricao: string;
  canal: string | null;
  meta_s: number | null;
}

export interface PropsPainel {
  aba: Aba;
  setAba: (a: Aba) => void;
  aberto: boolean;
  doc: Documento;
  sel: Selecao;
  fluxo: DadosFluxo;
  estilo: Estilo;
  canais: readonly CanalEditor[];
  cadastros: readonly Cadastro[];
  tipos: readonly TipoCadastro[];
  soLeitura: boolean;
  acoes: AcoesPainel;
}

const NOMES_REGRAS: Record<Regra, string> = { sempre: 'Sempre', opcao: 'Opção escolhida', condicao: 'Condição', tempo: 'Depois de um tempo', horario: 'Horário (dentro ou fora)', senao: 'Senão' };

export function Painel(p: PropsPainel) {
  return (
    <aside className={`painel${p.aberto ? '' : ' fechado'}`} aria-label="Painel">
      <div className="abas" role="tablist">
        {(
          [
            ['prop', 'Propriedades'],
            ['estilo', 'Estilo e animação'],
            ['cad', 'Cadastros'],
          ] as const
        ).map(([a, nome]) => (
          <button key={a} className="aba" role="tab" aria-selected={p.aba === a} onClick={() => p.setAba(a)} type="button">
            {nome}
          </button>
        ))}
      </div>
      <fieldset className="conteudo" disabled={p.soLeitura} style={{ border: 0, margin: 0, minWidth: 0 }}>
        {p.aba === 'estilo' ? <PainelEstilo {...p} /> : p.aba === 'cad' ? <PainelCadastros {...p} /> : <Propriedades {...p} />}
      </fieldset>
    </aside>
  );
}

function Propriedades(p: PropsPainel) {
  const { doc, sel } = p;
  if (sel?.tipo === 'peca') {
    const peca = doc.pecas.find((x) => x.id === sel.id);
    if (peca) return <PainelPeca {...p} peca={peca} />;
  }
  if (sel?.tipo === 'conexao') {
    const c = doc.conexoes.find((x) => x.id === sel.id);
    if (c) return <PainelConexao {...p} conexao={c} />;
  }
  if (sel?.tipo === 'grupo') {
    const g = doc.grupos.find((x) => x.id === sel.id);
    if (g) return <PainelGrupo {...p} grupo={g} />;
  }
  if (sel?.tipo === 'nota') {
    const n = doc.notas.find((x) => x.id === sel.id);
    if (n) return <PainelNota {...p} nota={n} />;
  }
  return <PainelFluxo {...p} />;
}

function PainelFluxo({ fluxo, canais, acoes, soLeitura }: PropsPainel) {
  const [confirmar, setConfirmar] = useState(false);
  return (
    <>
      <div className="rotulo-secao">Fluxo</div>
      <CampoTexto rotulo="Nome" valor={fluxo.nome} aoMudar={(nome) => acoes.mudarFluxo({ nome })} />
      <label className="campo">
        Canal principal
        <select aria-label="Canal principal" value={fluxo.canal ?? ''} onChange={(e) => acoes.mudarFluxo({ canal: e.target.value || null })}>
          <option value="">sem canal</option>
          {canais.map((c) => (
            <option key={c.chave} value={c.chave}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      <p className="dica">O canal principal dá a cor da água. Cada peça pode trocar de canal no meio do caminho (ex.: o WhatsApp manda um e-mail).</p>
      <CampoTexto rotulo="Descrição" valor={fluxo.descricao} multilinha aoMudar={(descricao) => acoes.mudarFluxo({ descricao })} />
      <CampoTempo rotulo="Meta de tempo pro cliente (opcional)" valor={fluxo.meta_s ?? undefined} aoMudar={(s) => acoes.mudarFluxo({ meta_s: s ?? null })} />
      <div className="rotulo-secao">Como montar</div>
      <p className="dica">Clique numa forma da barra e depois no quadro, ou arraste a forma até onde quiser. Dois cliques num espaço vazio também criam.</p>
      <p className="dica">Passe o mouse numa peça: puxe a bolinha azul até outra peça pra ligar, ou clique no + pra criar a próxima já ligada. Clique numa ligação pra pôr a regra.</p>
      <p className="dica">Dois cliques numa peça renomeiam. Del apaga o que está selecionado.</p>
      {!soLeitura &&
        (confirmar ? (
          <div className="linha">
            <button className="botao perigo" type="button" onClick={acoes.apagarFluxo}>
              Apagar de vez
            </button>
            <button className="botao" type="button" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button className="botao perigo" type="button" onClick={() => setConfirmar(true)}>
            Apagar este fluxo
          </button>
        ))}
    </>
  );
}

function PainelPeca({ peca: n, doc, canais, cadastros, tipos, acoes }: PropsPainel & { peca: Peca }) {
  const saidas = doc.conexoes.filter((c) => c.de === n.id);
  const rotuloResp = ROTULO_RESPONSAVEL[n.tipo];
  const atual = cadastros.find((k) => k.id === n.responsavel);
  return (
    <>
      <div className="rotulo-secao">{FORMAS[n.tipo].nome}</div>
      <CampoTexto rotulo="Nome" valor={n.nome} aoMudar={(nome) => acoes.mudarPeca(n.id, { nome })} />
      <label className="campo">
        Tipo
        <select aria-label="Tipo" value={n.tipo} onChange={(e) => acoes.mudarPeca(n.id, { tipo: e.target.value as Peca['tipo'] })}>
          {TIPOS_PECA.map((t) => (
            <option key={t} value={t}>
              {NOMES_TIPOS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        Canal
        <select aria-label="Canal" value={n.canal ?? ''} onChange={(e) => acoes.mudarPeca(n.id, { canal: e.target.value || undefined })}>
          <option value="">segue o canal de antes</option>
          {canais.map((c) => (
            <option key={c.chave} value={c.chave}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      {rotuloResp && (
        <Responsavel
          key={`${n.id}:${n.responsavel ?? ''}:${atual?.nome ?? ''}`}
          rotulo={rotuloResp}
          tipoPeca={n.tipo}
          atual={atual}
          cadastros={cadastros}
          tipos={tipos}
          aoEscolher={(id) => acoes.mudarPeca(n.id, { responsavel: id })}
          aoCriar={async (tipo, nome) => {
            const k = await acoes.criarCadastro(tipo, nome);
            if (k) acoes.mudarPeca(n.id, { responsavel: k.id });
          }}
        />
      )}
      {n.responsavel && !atual && <p className="dica">O responsável desta peça foi apagado. Escolha outro.</p>}
      {n.tipo !== 'fim' && n.tipo !== 'inicio' && <CampoTempo rotulo="Tempo nesta peça (pra simulação)" valor={n.tempo_s} aoMudar={(s) => acoes.mudarPeca(n.id, { tempo_s: s })} />}
      <CampoTexto rotulo="Descrição" valor={n.descricao ?? ''} multilinha placeholder="O que acontece aqui" aoMudar={(d) => acoes.mudarPeca(n.id, { descricao: d.trim() || undefined })} />
      {n.tipo !== 'decisao' && <Cores rotulo="Cor da peça" atual={n.cor} cores={PALETA} aoMudar={(cor) => acoes.mudarPeca(n.id, { cor })} />}
      <div className="rotulo-secao">Saídas ({saidas.length})</div>
      {saidas.length ? (
        <div className="lista">
          {saidas.map((c) => (
            <button key={c.id} type="button" className="botao" style={{ justifyContent: 'space-between' }} onClick={() => acoes.selecionar({ tipo: 'conexao', id: c.id })}>
              <span>{textoRegra(c) || 'sempre'}</span>
              <span className="dica">→ {doc.pecas.find((x) => x.id === c.para)?.nome}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="dica">Nenhuma. Puxe a bolinha azul da peça até outra, ou clique no +.</p>
      )}
      <div className="linha">
        <button className="botao" type="button" onClick={() => acoes.duplicar(n.id)}>
          Duplicar
        </button>
        <button className="botao perigo" type="button" onClick={acoes.apagar}>
          Apagar
        </button>
      </div>
    </>
  );
}

function PainelConexao({ conexao: c, doc, acoes }: PropsPainel & { conexao: Conexao }) {
  const de = doc.pecas.find((x) => x.id === c.de);
  const para = doc.pecas.find((x) => x.id === c.para);
  return (
    <>
      <div className="rotulo-secao">Ligação</div>
      <p className="dica">
        {de?.nome} → {para?.nome}
      </p>
      <label className="campo">
        Quando a água passa por aqui
        <select aria-label="Quando a água passa por aqui" value={c.regra} onChange={(e) => acoes.mudarConexao(c.id, { regra: e.target.value as Regra })}>
          {REGRAS.map((r) => (
            <option key={r} value={r}>
              {NOMES_REGRAS[r]}
            </option>
          ))}
        </select>
      </label>
      {c.regra === 'opcao' && (
        <>
          <CampoTexto rotulo="Tecla ou código da opção" valor={c.valor ?? ''} placeholder="1, 2, S, N…" aoMudar={(valor) => acoes.mudarConexao(c.id, { valor: valor.trim() })} />
          <CampoTexto rotulo="Nome da opção" valor={c.rotulo ?? ''} placeholder="Financeiro" aoMudar={(rotulo) => acoes.mudarConexao(c.id, { rotulo: rotulo.trim() })} />
        </>
      )}
      {c.regra === 'condicao' && <CampoTexto rotulo="Condição" valor={c.valor ?? ''} placeholder="pagou, score ≥ 700…" aoMudar={(valor) => acoes.mudarConexao(c.id, { valor: valor.trim() })} />}
      {c.regra === 'tempo' && <CampoTempo rotulo="Depois de" valor={c.tempo_s} aoMudar={(s) => acoes.mudarConexao(c.id, { tempo_s: s ?? 0 })} />}
      {c.regra === 'horario' && (
        <label className="campo">
          Lado do horário
          <select aria-label="Lado do horário" value={c.horario ?? 'dentro'} onChange={(e) => acoes.mudarConexao(c.id, { horario: e.target.value as 'dentro' | 'fora' })}>
            <option value="dentro">Dentro do horário</option>
            <option value="fora">Fora do horário</option>
          </select>
        </label>
      )}
      {(c.regra === 'sempre' || c.regra === 'senao') && <CampoTexto rotulo="Texto no cano (opcional)" valor={c.rotulo ?? ''} aoMudar={(rotulo) => acoes.mudarConexao(c.id, { rotulo: rotulo.trim() })} />}
      <p className="dica">
        Peça com mais de uma saída vira escolha no play: cada regra aparece como opção. &quot;Depois de um tempo&quot; soma esse tempo no relógio do cliente. As de horário, a peça decide sozinha
        pelo cadastro Horário que ela usa.
      </p>
      <div className="linha">
        <button className="botao" type="button" onClick={() => acoes.inverter(c.id)}>
          Inverter direção
        </button>
        <button className="botao perigo" type="button" onClick={acoes.apagar}>
          Apagar ligação
        </button>
      </div>
    </>
  );
}

function PainelGrupo({ grupo: g, acoes }: PropsPainel & { grupo: Grupo }) {
  return (
    <>
      <div className="rotulo-secao">Grupo</div>
      <CampoTexto rotulo="Nome" valor={g.nome} aoMudar={(nome) => acoes.mudarGrupo(g.id, { nome: nome.trim() || 'Grupo' })} />
      <Cores rotulo="Cor" atual={g.cor} cores={PALETA} aoMudar={(cor) => acoes.mudarGrupo(g.id, { cor })} />
      <p className="dica">Arraste o grupo pra mover tudo que está dentro. Puxe o canto de baixo pra mudar o tamanho.</p>
      <button className="botao perigo" type="button" onClick={acoes.apagar}>
        Apagar grupo (as peças ficam)
      </button>
    </>
  );
}

function PainelNota({ nota: n, acoes }: PropsPainel & { nota: Nota }) {
  return (
    <>
      <div className="rotulo-secao">Nota</div>
      <CampoTexto rotulo="Texto" valor={n.texto} multilinha aoMudar={(texto) => acoes.mudarNota(n.id, { texto })} />
      <Cores rotulo="Cor da nota" atual={n.cor} cores={PALETA_NOTA} aoMudar={(cor) => acoes.mudarNota(n.id, { cor })} />
      <button className="botao perigo" type="button" onClick={acoes.apagar}>
        Apagar nota
      </button>
    </>
  );
}

function PainelEstilo({ estilo: e, canais, acoes }: PropsPainel) {
  const mudar = (patch: Partial<Estilo>) => acoes.mudarEstilo({ ...e, ...patch });
  const seg = <K extends 'cano' | 'curva'>(chave: K, rotulo: string, opcoes: [Estilo[K], string][]) => (
    <div className="campo">
      {rotulo}
      <div className="segmentado" role="group" aria-label={rotulo}>
        {opcoes.map(([v, nome]) => (
          <button key={v} type="button" aria-pressed={e[chave] === v} onClick={() => mudar({ [chave]: v } as Partial<Estilo>)}>
            {nome}
          </button>
        ))}
      </div>
    </div>
  );
  const inter = (chave: 'bolhas' | 'brilho' | 'ondas' | 'holofote' | 'camera', rotulo: string) => (
    <label className="interruptor">
      {rotulo}
      <input type="checkbox" checked={e[chave]} onChange={(ev) => mudar({ [chave]: ev.target.checked })} />
    </label>
  );
  return (
    <>
      <div className="rotulo-secao">Cor da água por canal</div>
      <div className="lista">
        {canais.map((c) => (
          <label key={c.chave} className="canal-cor">
            {c.nome}
            <input type="color" value={corDoCanal(e, canais, c.chave)} onChange={(ev) => mudar({ canais: { ...e.canais, [c.chave]: ev.target.value } })} />
          </label>
        ))}
      </div>
      <div className="rotulo-secao">Canos</div>
      {seg('cano', 'Desenho', [
        ['cano', 'Cano'],
        ['linha', 'Linha'],
        ['tracejado', 'Tracejado'],
      ])}
      {seg('curva', 'Curva', [
        ['suave', 'Suave'],
        ['cotovelo', 'Cotovelo'],
        ['reta', 'Reta'],
      ])}
      <label className="campo">
        Espessura · {e.espessura}
        <input type="range" min={4} max={20} step={1} value={e.espessura} onChange={(ev) => mudar({ espessura: Number(ev.target.value) })} />
      </label>
      <div className="rotulo-secao">Água</div>
      <label className="campo">
        Velocidade · {e.velocidade}×
        <input type="range" min={0.25} max={4} step={0.25} value={e.velocidade} onChange={(ev) => mudar({ velocidade: Number(ev.target.value) })} />
      </label>
      {inter('bolhas', 'Bolhas correndo junto')}
      {inter('brilho', 'Brilho correndo no cano cheio')}
      {inter('ondas', 'Nível ondulando nas peças')}
      <div className="rotulo-secao">Decisões e câmera</div>
      {inter('holofote', 'Holofote: apaga o resto na decisão')}
      {inter('camera', 'Câmera segue a água')}
      <label className="campo">
        Escolher sozinho depois de · {e.autoEscolha ? `${e.autoEscolha} s` : 'nunca'}
        <input type="range" min={0} max={10} step={1} value={e.autoEscolha} onChange={(ev) => mudar({ autoEscolha: Number(ev.target.value) })} />
      </label>
      <p className="dica">Pra apresentar sem clicar: a água segue pela primeira opção depois desse tempo.</p>
      <button className="botao" type="button" onClick={() => acoes.mudarEstilo(ESTILO_PADRAO)}>
        Voltar ao estilo padrão
      </button>
    </>
  );
}

function PainelCadastros({ doc, cadastros, tipos, acoes }: PropsPainel) {
  const usos = usosNoDocumento(doc);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState(tipos[0]?.chave ?? 'pessoa');
  const [erro, setErro] = useState('');
  const grupos = tipos.map((t) => [t, cadastros.filter((k) => k.tipo === t.chave)] as const).filter(([, l]) => l.length);
  return (
    <>
      <p className="dica">Pessoas, filas, equipes, sistemas e horários que as peças usam. São da empresa: valem pra todos os fluxos. Renomeando aqui, muda em todos.</p>
      {grupos.length ? (
        grupos.map(([t, lista]) => (
          <div key={t.chave} className="lista">
            <div className="rotulo-secao">{t.nome}</div>
            {lista.map((k) => {
              const n = usos.get(k.id) ?? 0;
              return (
                <div key={k.id} className="cad">
                  <span className="tipo">{t.nome}</span>
                  <input
                    key={k.nome}
                    type="text"
                    defaultValue={k.nome}
                    aria-label={`Nome do cadastro ${k.nome}`}
                    onBlur={(e) => {
                      const v = e.currentTarget.value.trim();
                      if (!v) e.currentTarget.value = k.nome;
                      else if (v !== k.nome) void acoes.renomearCadastro(k.id, v);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                  <small>
                    <button className="botao pequeno" type="button" onClick={() => acoes.verCadastro(k.id)} disabled={!n}>
                      {n} {n === 1 ? 'uso' : 'usos'} aqui
                    </button>
                  </small>
                </div>
              );
            })}
          </div>
        ))
      ) : (
        <p className="dica">Nenhum cadastro ainda.</p>
      )}
      <div className="rotulo-secao">Novo cadastro</div>
      <form
        className="lista"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!nome.trim()) return;
          const k = await acoes.criarCadastro(tipo, nome);
          if (k) {
            setNome('');
            setErro('');
          } else setErro('Não deu pra cadastrar.');
        }}
      >
        <label className="campo">
          Nome
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Fila Cobrança, Maria, ERP…" />
        </label>
        <label className="campo">
          Tipo
          <select aria-label="Tipo do cadastro" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {tipos.map((t) => (
              <option key={t.chave} value={t.chave}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <button className="botao primario" type="submit">
          Cadastrar
        </button>
        {erro && <p className="dica">{erro}</p>}
      </form>
    </>
  );
}
