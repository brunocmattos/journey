'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { DIAS, camposHorario, type Cadastro, type CamposHorario, type Dia } from '@journey/fluxo';
import { apagarCadastro, criarCadastro, mudarHorario, renomearCadastro } from '@/acoes/cadastros';
import type { TipoCadastro } from '@/editor/cadastros';

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const NOME_DIA: Record<Dia, string> = { dom: 'dom', seg: 'seg', ter: 'ter', qua: 'qua', qui: 'qui', sex: 'sex', sab: 'sáb' };

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
  const [ocupado, comecar] = useTransition();
  const nomeTipo = (k: string) => tipos.find((t) => t.chave === k)?.nome ?? k;
  const vistos = cadastros.filter((k) => (!tipo || k.tipo === tipo) && (!busca.trim() || semAcento(k.nome).includes(semAcento(busca.trim()))));

  const fazer = (f: () => Promise<{ erro?: string }>, ok?: string) =>
    comecar(async () => {
      const r = await f();
      setMensagem(r.erro ? { erro: true, texto: r.erro } : ok ? { erro: false, texto: ok } : null);
      if (!r.erro) router.refresh();
    });

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
                          const v = e.currentTarget.value.trim();
                          if (!v) e.currentTarget.value = k.nome;
                          else if (v !== k.nome) fazer(() => renomearCadastro(empresaId, k.id, v), `Agora é “${v}” em todos os fluxos.`);
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
                        <button className="botao pequeno" type="button" aria-expanded={aberto === k.id} onClick={() => setAberto(aberto === k.id ? null : k.id)}>
                          Janelas e feriados
                        </button>
                      )}{' '}
                      <button
                        className="botao pequeno perigo"
                        type="button"
                        disabled={ocupado || u.length > 0}
                        title={u.length ? 'Em uso: troque nas peças antes de apagar' : undefined}
                        onClick={() => fazer(() => apagarCadastro(empresaId, k.id), `“${k.nome}” apagado.`)}
                      >
                        Apagar
                      </button>
                    </td>
                  </tr>,
                  aberto === k.id && (
                    <tr key={`${k.id}:horario`}>
                      <td colSpan={4}>
                        <EditorHorario campos={camposHorario(k) ?? { janelas: [], feriados: [] }} ocupado={ocupado} aoSalvar={(c) => fazer(() => mudarHorario(empresaId, k.id, c), 'Horário salvo.')} />
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
          fazer(async () => {
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
        <button className="botao primario" type="submit" disabled={ocupado}>
          Cadastrar
        </button>
      </form>
    </main>
  );
}

/** Janelas da semana (dias, início e fim) e feriados de um Horário. */
function EditorHorario({ campos, ocupado, aoSalvar }: { campos: CamposHorario; ocupado: boolean; aoSalvar: (c: CamposHorario) => void }) {
  const [c, setC] = useState<CamposHorario>(campos);
  const janela = (i: number, patch: Partial<CamposHorario['janelas'][number]>) => setC({ ...c, janelas: c.janelas.map((j, k) => (k === i ? { ...j, ...patch } : j)) });
  const feriado = (i: number, patch: Partial<CamposHorario['feriados'][number]>) => setC({ ...c, feriados: c.feriados.map((f, k) => (k === i ? { ...f, ...patch } : f)) });
  return (
    <div style={{ display: 'grid', gap: 10, padding: '6px 0' }}>
      <div className="rotulo-secao" style={{ margin: 0 }}>
        Janelas
      </div>
      {c.janelas.map((j, i) => (
        <div key={i} className="linha-form" role="group" aria-label={`Janela ${i + 1}`}>
          {DIAS.map((d) => (
            <label key={d} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12.5 }}>
              <input type="checkbox" checked={j.dias.includes(d)} onChange={(e) => janela(i, { dias: e.target.checked ? DIAS.filter((x) => x === d || j.dias.includes(x)) : j.dias.filter((x) => x !== d) })} />
              {NOME_DIA[d]}
            </label>
          ))}
          <input type="time" aria-label="Início" value={j.inicio} onChange={(e) => janela(i, { inicio: e.target.value })} />
          <span className="mudo">até</span>
          <input type="text" aria-label="Fim" value={j.fim} onChange={(e) => janela(i, { fim: e.target.value })} style={{ width: 70 }} placeholder="18:00" />
          <button className="botao pequeno" type="button" onClick={() => setC({ ...c, janelas: c.janelas.filter((_, k) => k !== i) })}>
            Tirar
          </button>
        </div>
      ))}
      <button className="botao pequeno" type="button" style={{ justifySelf: 'start' }} onClick={() => setC({ ...c, janelas: [...c.janelas, { dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }] })}>
        Mais uma janela
      </button>
      <div className="rotulo-secao" style={{ margin: 0 }}>
        Feriados (fechado o dia todo)
      </div>
      {c.feriados.map((f, i) => (
        <div key={i} className="linha-form" role="group" aria-label={`Feriado ${i + 1}`}>
          <input type="date" aria-label="Data" value={f.data} onChange={(e) => feriado(i, { data: e.target.value })} />
          <input type="text" aria-label="Nome do feriado" value={f.nome ?? ''} placeholder="Natal" onChange={(e) => feriado(i, { nome: e.target.value })} />
          <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12.5 }}>
            <input type="checkbox" checked={!!f.todo_ano} onChange={(e) => feriado(i, { todo_ano: e.target.checked })} />
            todo ano
          </label>
          <button className="botao pequeno" type="button" onClick={() => setC({ ...c, feriados: c.feriados.filter((_, k) => k !== i) })}>
            Tirar
          </button>
        </div>
      ))}
      <button className="botao pequeno" type="button" style={{ justifySelf: 'start' }} onClick={() => setC({ ...c, feriados: [...c.feriados, { data: '' }] })}>
        Mais um feriado
      </button>
      <p className="mudo" style={{ margin: 0, fontSize: 12.5 }}>
        O fim vai até 24:00. Pra passar da meia-noite, use duas janelas (22:00–24:00 num dia, 00:00–06:00 no outro).
      </p>
      <button className="botao primario" type="button" style={{ justifySelf: 'start' }} disabled={ocupado} onClick={() => aoSalvar(c)}>
        Salvar horário
      </button>
    </div>
  );
}
