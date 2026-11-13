'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { DIAS, camposHorario, type Cadastro, type CamposHorario, type Dia } from '@journey/fluxo';
import { apagarCadastro, criarCadastro, mudarHorario, renomearCadastro } from '@/acoes/cadastros';
import type { TipoCadastro } from '@/editor/cadastros';

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const NOME_DIA: Record<Dia, string> = { dom: 'dom', seg: 'seg', ter: 'ter', qua: 'qua', qui: 'qui', sex: 'sex', sab: 'sáb' };
const INICIO = /^([01]\d|2[0-3]):[0-5]\d$/;
/** O mesmo do pacote: o fim vai até 24:00. Vai no `pattern` do campo (sem as âncoras, que o navegador põe). */
const FIM = '([01]\\d|2[0-3]):[0-5]\\d|24:00';

/** Os cadastros da empresa: por tipo, com busca, onde é usado, renomear, apagar (sem uso) e o Horário. */
export function TabelaCadastros({
  empresaId,
  cadastros,
  tipos,
  usos,
}: {
  empresaId: string;
  cadastros: Cadastro[];
  tipos: TipoCadastro[];
  usos: Record<string, { id: string; nome: string }[]>;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ erro: boolean; texto: string } | null>(null);
  const [nome, setNome] = useState('');
  const [tipoNovo, setTipoNovo] = useState(tipos[0]?.chave ?? 'pessoa');
  // Ocupado por ação e linha (renomear:id, apagar:id, horario:id, criar): o blur de um renomear não desabilita o
  // botão que a pessoa estava clicando (o clique se perdia com o botão desabilitado no meio dele).
  const [ocupados, setOcupados] = useState<Record<string, true>>({});
  const [, comecar] = useTransition();
  const nomeTipo = (k: string) => tipos.find((t) => t.chave === k)?.nome ?? k;
  const vistos = cadastros.filter((k) => (!tipo || k.tipo === tipo) && (!busca.trim() || semAcento(k.nome).includes(semAcento(busca.trim()))));

  const fazer = async (chave: string, f: () => Promise<{ erro?: string }>, ok?: string, aoErrar?: () => void) => {
    if (ocupados[chave]) return;
    setOcupados((o) => ({ ...o, [chave]: true }));
    try {
      const r = await f();
      setMensagem(r.erro ? { erro: true, texto: r.erro } : ok ? { erro: false, texto: ok } : null);
      if (r.erro) aoErrar?.();
      else comecar(() => router.refresh());
    } finally {
      setOcupados(({ [chave]: _, ...resto }) => resto);
    }
  };

  return (
    <main className="pagina">
      <div className="cabeca">
        <h1>Cadastros</h1>
        <input className="entrada-texto" type="search" placeholder="Buscar" aria-label="Buscar cadastro" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: 220 }} />
      </div>
      <p className="mudo" style={{ margin: 0 }}>
        Pessoas, filas, equipes, sistemas e horários que as peças dos fluxos usam. Um nome escrito numa peça vira cadastro aqui; renomear aqui muda em todos os fluxos.
      </p>
      <nav className="nav" aria-label="Tipos" style={{ justifySelf: 'start' }}>
        <button type="button" aria-pressed={tipo === null} onClick={() => setTipo(null)}>
          Todos ({cadastros.length})
        </button>
        {tipos.map((t) => (
          <button key={t.chave} type="button" aria-pressed={tipo === t.chave} onClick={() => setTipo(t.chave)}>
            {t.nome} ({cadastros.filter((k) => k.tipo === t.chave).length})
          </button>
        ))}
      </nav>
      {mensagem && (
        <p className={`aviso-caixa ${mensagem.erro ? 'erro' : 'ok'}`} role={mensagem.erro ? 'alert' : 'status'}>
          {mensagem.texto}
        </p>
      )}
      <div className="cartao tabela-rolagem">
        {vistos.length ? (
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Onde é usado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vistos.map((k) => {
                const u = usos[k.id] ?? [];
                return [
                  <tr key={k.id}>
                    <td>
                      <input
                        key={k.nome}
                        className="entrada-texto"
                        defaultValue={k.nome}
                        aria-label={`Nome de ${k.nome}`}
                        onBlur={(e) => {
                          const campo = e.currentTarget;
                          const v = campo.value.trim();
                          if (!v) campo.value = k.nome;
                          // Recusado (nome repetido, sem permissão): o campo volta pro nome que vale, não fica o recusado.
                          else if (v !== k.nome) void fazer(`renomear:${k.id}`, () => renomearCadastro(empresaId, k.id, v), `Agora é “${v}” em todos os fluxos.`, () => (campo.value = k.nome));
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      />
                    </td>
                    <td>{nomeTipo(k.tipo)}</td>
                    <td>
                      {u.length ? (
                        u.map((f, i) => (
                          <span key={f.id}>
                            {i > 0 && ', '}
                            <Link href={`/e/${empresaId}/f/${f.id}`}>{f.nome}</Link>
                          </span>
                        ))
                      ) : (
                        <span className="mudo">nenhum fluxo</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {k.tipo === 'horario' && (
                        <button
                          className="botao pequeno"
                          type="button"
                          aria-expanded={aberto === k.id}
                          aria-controls={aberto === k.id ? `horario-${k.id}` : undefined}
                          onClick={() => setAberto(aberto === k.id ? null : k.id)}
                        >
                          Janelas e feriados
                        </button>
                      )}{' '}
                      <button
                        className="botao pequeno perigo"
                        type="button"
                        disabled={!!ocupados[`apagar:${k.id}`] || u.length > 0}
                        aria-label={`Apagar ${k.nome}`}
                        title={u.length ? 'Em uso: troque nas peças antes de apagar' : undefined}
                        onClick={() => void fazer(`apagar:${k.id}`, () => apagarCadastro(empresaId, k.id), `“${k.nome}” apagado.`)}
                      >
                        Apagar
                      </button>
                    </td>
                  </tr>,
                  aberto === k.id && (
                    <tr key={`${k.id}:horario`} id={`horario-${k.id}`}>
                      <td colSpan={4}>
                        <EditorHorario
                          campos={camposHorario(k) ?? { janelas: [], feriados: [] }}
                          ocupado={!!ocupados[`horario:${k.id}`]}
                          aoSalvar={(c) => void fazer(`horario:${k.id}`, () => mudarHorario(empresaId, k.id, c), 'Horário salvo.')}
                        />
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        ) : (
          <p className="vazio">{cadastros.length ? 'Nada com essa busca.' : 'Nenhum cadastro ainda. Eles nascem quando alguém escreve um responsável numa peça, ou aqui embaixo.'}</p>
        )}
      </div>
      <form
        className="cartao linha-form"
        onSubmit={(e) => {
          e.preventDefault();
          void fazer('criar', async () => {
            const r = await criarCadastro(empresaId, tipoNovo, nome);
            if (!r.erro) setNome('');
            return r;
          });
        }}
      >
        <label className="campo" style={{ flex: '1 1 220px' }}>
          Novo cadastro
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Fila Cobrança, Maria, ERP…" required />
        </label>
        <label className="campo">
          Tipo
          <select aria-label="Tipo" value={tipoNovo} onChange={(e) => setTipoNovo(e.target.value)}>
            {tipos.map((t) => (
              <option key={t.chave} value={t.chave}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <button className="botao primario" type="submit" disabled={!!ocupados.criar}>
          Cadastrar
        </button>
      </form>
    </main>
  );
}

/** O que está errado numa janela (pra marcar a linha), ou null. */
function erroJanela(j: CamposHorario['janelas'][number]): string | null {
  if (!j.dias.length) return 'Marque pelo menos um dia.';
  if (!INICIO.test(j.inicio)) return 'Início no formato 08:00.';
  if (!new RegExp(`^(${FIM})$`).test(j.fim)) return 'Fim no formato 18:00 (vai até 24:00).';
  if (j.fim <= j.inicio) return 'O fim tem que ser depois do início.';
  return null;
}

/**
 * Janelas da semana (dias, início e fim) e feriados de um Horário. Confere aqui antes de mandar (a mesma regra do
 * pacote, e janela sem dia não vale): a linha errada fica marcada, com o porquê.
 */
function EditorHorario({ campos, ocupado, aoSalvar }: { campos: CamposHorario; ocupado: boolean; aoSalvar: (c: CamposHorario) => void }) {
  const [c, setC] = useState<CamposHorario>(campos);
  const [conferir, setConferir] = useState(false);
  const id = useId();
  const errosJanelas = c.janelas.map(erroJanela);
  const errosFeriados = c.feriados.map((f) => (camposHorario({ id: 'h', tipo: 'horario', nome: 'h', campos: { janelas: [], feriados: [f] } }) ? null : 'Data inválida.'));
  const valido = errosJanelas.every((e) => !e) && errosFeriados.every((e) => !e) && camposHorario({ id: 'h', tipo: 'horario', nome: 'h', campos: { ...c } }) !== null;
  const janela = (i: number, patch: Partial<CamposHorario['janelas'][number]>) => setC({ ...c, janelas: c.janelas.map((j, k) => (k === i ? { ...j, ...patch } : j)) });
  const feriado = (i: number, patch: Partial<CamposHorario['feriados'][number]>) => setC({ ...c, feriados: c.feriados.map((f, k) => (k === i ? { ...f, ...patch } : f)) });
  return (
    <div style={{ display: 'grid', gap: 10, padding: '6px 0' }}>
      <div className="rotulo-secao" style={{ margin: 0 }}>
        Janelas
      </div>
      {c.janelas.map((j, i) => {
        const erro = conferir ? errosJanelas[i] : null;
        return (
        <div key={i} className="linha-form" role="group" aria-label={`Janela ${i + 1}`} aria-invalid={erro ? true : undefined} aria-describedby={erro ? `${id}-j${i}` : undefined}>
          {DIAS.map((d) => (
            <label key={d} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12.5 }}>
              <input type="checkbox" checked={j.dias.includes(d)} onChange={(e) => janela(i, { dias: e.target.checked ? DIAS.filter((x) => x === d || j.dias.includes(x)) : j.dias.filter((x) => x !== d) })} />
              {NOME_DIA[d]}
            </label>
          ))}
          <input type="time" aria-label="Início" value={j.inicio} onChange={(e) => janela(i, { inicio: e.target.value })} aria-invalid={erro ? true : undefined} />
          <span className="mudo">até</span>
          <input
            type="text"
            aria-label="Fim"
            value={j.fim}
            pattern={FIM}
            inputMode="numeric"
            onChange={(e) => janela(i, { fim: e.target.value })}
            style={{ width: 70 }}
            placeholder="18:00"
            aria-invalid={erro ? true : undefined}
          />
          <button className="botao pequeno" type="button" onClick={() => setC({ ...c, janelas: c.janelas.filter((_, k) => k !== i) })}>
            Tirar
          </button>
          {erro && (
            <span id={`${id}-j${i}`} className="erro-campo" style={{ flexBasis: '100%', color: 'var(--bad)', fontSize: 12.5 }}>
              {erro}
            </span>
          )}
        </div>
        );
      })}
      <button className="botao pequeno" type="button" style={{ justifySelf: 'start' }} onClick={() => setC({ ...c, janelas: [...c.janelas, { dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }] })}>
        Mais uma janela
      </button>
      <div className="rotulo-secao" style={{ margin: 0 }}>
        Feriados (fechado o dia todo)
      </div>
      {c.feriados.map((f, i) => {
        const erro = conferir ? errosFeriados[i] : null;
        return (
        <div key={i} className="linha-form" role="group" aria-label={`Feriado ${i + 1}`} aria-invalid={erro ? true : undefined} aria-describedby={erro ? `${id}-f${i}` : undefined}>
          <input type="date" aria-label="Data" value={f.data} onChange={(e) => feriado(i, { data: e.target.value })} aria-invalid={erro ? true : undefined} />
          <input type="text" aria-label="Nome do feriado" value={f.nome ?? ''} placeholder="Natal" onChange={(e) => feriado(i, { nome: e.target.value })} />
          <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12.5 }}>
            <input type="checkbox" checked={!!f.todo_ano} onChange={(e) => feriado(i, { todo_ano: e.target.checked })} />
            todo ano
          </label>
          <button className="botao pequeno" type="button" onClick={() => setC({ ...c, feriados: c.feriados.filter((_, k) => k !== i) })}>
            Tirar
          </button>
          {erro && (
            <span id={`${id}-f${i}`} className="erro-campo" style={{ flexBasis: '100%', color: 'var(--bad)', fontSize: 12.5 }}>
              {erro}
            </span>
          )}
        </div>
        );
      })}
      <button className="botao pequeno" type="button" style={{ justifySelf: 'start' }} onClick={() => setC({ ...c, feriados: [...c.feriados, { data: '' }] })}>
        Mais um feriado
      </button>
      <p className="mudo" style={{ margin: 0, fontSize: 12.5 }}>
        O fim vai até 24:00. Pra passar da meia-noite, use duas janelas (22:00–24:00 num dia, 00:00–06:00 no outro).
      </p>
      {conferir && !valido && (
        <p className="aviso-caixa erro" role="alert" style={{ margin: 0 }}>
          Confere as janelas (o fim depois do início, até 24:00, com pelo menos um dia) e as datas dos feriados.
        </p>
      )}
      <button
        className="botao primario"
        type="button"
        style={{ justifySelf: 'start' }}
        disabled={ocupado}
        onClick={() => {
          setConferir(true);
          if (valido) aoSalvar(c);
        }}
      >
        Salvar horário
      </button>
    </div>
  );
}
