'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { criarDeModelo, criarFluxo } from '@/acoes/fluxos';
import type { FluxoResumo } from '@/lib/dados';
import { FUSO } from '@/lib/fuso';

interface CanalLista {
  chave: string;
  nome: string;
  cor: string;
  arquivado: boolean;
}

interface ModeloLista {
  chave: string;
  nome: string;
  descricao: string;
  canal: string;
  pecas: number;
}

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: FUSO });
const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** A casa da empresa: os fluxos, a busca e o "Novo fluxo" (em branco ou a partir de um modelo). */
export function ListaFluxos({ empresaId, fluxos, canais, modelos }: { empresaId: string; fluxos: FluxoResumo[]; canais: CanalLista[]; modelos: ModeloLista[] }) {
  const router = useRouter();
  const [novo, setNovo] = useState(fluxos.length === 0);
  const [busca, setBusca] = useState('');
  const [nome, setNome] = useState('');
  const [canal, setCanal] = useState(canais.find((c) => !c.arquivado)?.chave ?? '');
  const [erro, setErro] = useState('');
  const [ocupado, comecar] = useTransition();
  const canalDe = (k: string | null) => canais.find((c) => c.chave === k);
  const vistos = busca.trim() ? fluxos.filter((f) => semAcento(`${f.nome} ${f.descricao} ${canalDe(f.canal)?.nome ?? ''}`).includes(semAcento(busca.trim()))) : fluxos;

  const abrir = (r: { id?: string; erro?: string }) => {
    if (r.erro || !r.id) return setErro(r.erro ?? 'Não deu certo agora.');
    router.push(`/e/${empresaId}/f/${r.id}`);
  };

  return (
    <main className="pagina">
      <div className="cabeca">
        <h1>Fluxos</h1>
        <div className="linha-form">
          {fluxos.length > 0 && (
            <input className="entrada-texto" type="search" placeholder="Buscar fluxo" aria-label="Buscar fluxo" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: 220 }} />
          )}
          <button className="botao primario" type="button" onClick={() => setNovo((n) => !n)} aria-expanded={novo}>
            Novo fluxo
          </button>
        </div>
      </div>

      {novo && (
        <section className="cartao" aria-label="Novo fluxo" style={{ display: 'grid', gap: 16 }}>
          <div>
            <h2>Em branco</h2>
            <p className="mudo">Um quadro vazio pra desenhar do zero.</p>
            <form
              className="linha-form"
              onSubmit={(e) => {
                e.preventDefault();
                setErro('');
                comecar(async () => abrir(await criarFluxo(empresaId, nome, canal || null)));
              }}
            >
              <label className="campo" style={{ flex: '1 1 220px' }}>
                Nome do fluxo
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Cobrança no WhatsApp, Onboarding…" required maxLength={120} />
              </label>
              <label className="campo">
                Canal principal
                <select aria-label="Canal principal" value={canal} onChange={(e) => setCanal(e.target.value)}>
                  <option value="">sem canal</option>
                  {canais
                    .filter((c) => !c.arquivado)
                    .map((c) => (
                      <option key={c.chave} value={c.chave}>
                        {c.nome}
                      </option>
                    ))}
                </select>
              </label>
              <button className="botao primario" type="submit" disabled={ocupado}>
                Criar e abrir
              </button>
            </form>
          </div>
          <div>
            <h2>A partir de um modelo</h2>
            <p className="mudo">Um fluxo pronto pra adaptar. Os cadastros dele (filas, equipes, horário) entram nos da empresa.</p>
            <div className="grade" style={{ marginTop: 10 }}>
              {modelos.map((m) => (
                <button
                  key={m.chave}
                  type="button"
                  className="cartao"
                  style={{ textAlign: 'left', display: 'grid', gap: 6, cursor: 'pointer' }}
                  disabled={ocupado}
                  onClick={() => {
                    setErro('');
                    comecar(async () => abrir(await criarDeModelo(empresaId, m.chave)));
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: canalDe(m.canal)?.cor ?? 'var(--ink-3)' }} />
                    <b>{m.nome}</b>
                  </span>
                  <span className="mudo">{m.descricao}</span>
                  <span className="mudo mono" style={{ fontSize: 12 }}>
                    {m.pecas} peças · {canalDe(m.canal)?.nome ?? m.canal}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {erro && (
            <p className="aviso-caixa erro" role="alert">
              {erro}
            </p>
          )}
        </section>
      )}

      {fluxos.length > 0 &&
        (vistos.length ? (
          <div className="grade">
            {vistos.map((f) => {
              const c = canalDe(f.canal);
              return (
                <Link key={f.id} href={`/e/${empresaId}/f/${f.id}`} className="cartao" style={{ textDecoration: 'none', display: 'grid', gap: 6 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: c?.cor ?? 'var(--ink-3)' }} />
                    {c?.nome ?? 'sem canal'}
                  </span>
                  <h2>{f.nome}</h2>
                  {f.descricao && <span className="mudo">{f.descricao}</span>}
                  <span className="mudo" style={{ fontSize: 12.5 }}>
                    {f.pecas} peças · {f.editado_por ? `${f.editado_por}, ` : ''}
                    {quando(f.editado_em)}
                  </span>
                  {f.editando && <span className="selo info">{f.editando} está editando</span>}
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="vazio">Nenhum fluxo com “{busca}”.</p>
        ))}
    </main>
  );
}
