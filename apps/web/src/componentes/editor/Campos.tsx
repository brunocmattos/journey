'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Cadastro, TipoPeca } from '@journey/fluxo';
import { buscar, comNome, tipoSugerido, type TipoCadastro } from '@/editor/cadastros';

/**
 * Grava, ao desmontar, o que foi digitado e não chegou a sair do campo (a seleção mudou com o foco aqui dentro). Usa
 * o `aoMudar` do último desenho deste campo: o da peça que ele mostrava, não o da que foi selecionada agora.
 */
function useGravaAoSair<T>(aoMudar: (v: T) => void) {
  const pendente = useRef<{ v: T } | null>(null);
  const ultimo = useRef(aoMudar);
  ultimo.current = aoMudar;
  useEffect(
    () => () => {
      // No modo estrito esta limpeza roda uma vez ao montar: aí não há nada pendente.
      const p = pendente.current;
      pendente.current = null;
      if (p) ultimo.current(p.v);
    },
    [],
  );
  return pendente;
}

/**
 * Campo de texto que grava ao sair (ou no Enter), como no protótipo: digitar não cria um passo no histórico por
 * letra. `key` por valor faz o campo voltar ao que está no documento depois de desfazer.
 */
export function CampoTexto({
  rotulo,
  valor,
  aoMudar,
  multilinha = false,
  placeholder,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  multilinha?: boolean;
  placeholder?: string;
}) {
  const pendente = useGravaAoSair(aoMudar);
  const props = {
    defaultValue: valor,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      pendente.current = e.currentTarget.value !== valor ? { v: e.currentTarget.value } : null;
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      pendente.current = null;
      if (e.currentTarget.value !== valor) aoMudar(e.currentTarget.value);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !multilinha) e.currentTarget.blur();
    },
  };
  return (
    <label className="campo">
      {rotulo}
      {multilinha ? <textarea key={valor} {...props} /> : <input key={valor} type="text" {...props} />}
    </label>
  );
}

const UNIDADES = { s: 1, min: 60, h: 3600, d: 86400 } as const;
type Unidade = keyof typeof UNIDADES;

/** Segundos em número + unidade, na maior unidade exata (7200 → 2 h). */
export function partesTempo(s: number | undefined): [number, Unidade] {
  const v = s ?? 0;
  if (v && v % 86400 === 0) return [v / 86400, 'd'];
  if (v && v % 3600 === 0) return [v / 3600, 'h'];
  if (v && v % 60 === 0) return [v / 60, 'min'];
  return [v, 's'];
}

/** Tempo em número e unidade. Zero (ou vazio) é sem tempo. */
export function CampoTempo({ rotulo, valor, aoMudar }: { rotulo: string; valor: number | undefined; aoMudar: (s: number | undefined) => void }) {
  const [n, u] = partesTempo(valor);
  const id = useId();
  const segundos = (num: string, uni: Unidade) => {
    const s = Math.round((parseFloat(num) || 0) * UNIDADES[uni]);
    return s > 0 ? s : undefined;
  };
  const pendente = useGravaAoSair(aoMudar);
  const ler = (form: HTMLElement) => {
    pendente.current = null;
    const num = (form.querySelector(`[data-n="${id}"]`) as HTMLInputElement).value;
    const uni = (form.querySelector(`[data-u="${id}"]`) as HTMLSelectElement).value as Unidade;
    const s = segundos(num, uni);
    if (s !== valor) aoMudar(s);
  };
  return (
    <label className="campo">
      {rotulo}
      <span className="linha" key={valor ?? 0}>
        <input
          type="number"
          min={0}
          step={1}
          data-n={id}
          defaultValue={n || ''}
          placeholder="0"
          style={{ flex: 1 }}
          aria-label={`${rotulo}: quantidade`}
          onChange={(e) => {
            const s = segundos(e.currentTarget.value, (e.currentTarget.nextElementSibling as HTMLSelectElement).value as Unidade);
            pendente.current = s !== valor ? { v: s } : null;
          }}
          onBlur={(e) => ler(e.currentTarget.parentElement!)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <select data-u={id} defaultValue={u} style={{ width: 90 }} aria-label={`${rotulo}: unidade`} onChange={(e) => ler(e.currentTarget.parentElement!)}>
          {Object.keys(UNIDADES).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export const PALETA = ['', '#dcecf8', '#ddf3e6', '#fbefd6', '#ece6fb', '#fbe4e2', '#e7eef1'];
export const PALETA_NOTA = ['', '#f6eaa8', '#dcecf8', '#ddf3e6', '#fbe4e2', '#ece6fb'];

export function Cores({ rotulo, atual, cores, aoMudar }: { rotulo: string; atual: string | undefined; cores: readonly string[]; aoMudar: (c: string | undefined) => void }) {
  return (
    <div className="campo">
      {rotulo}
      <div className="cores" role="group" aria-label={rotulo}>
        {cores.map((c) => (
          <button
            key={c || 'padrao'}
            type="button"
            className="cor"
            aria-pressed={(atual ?? '') === c}
            aria-label={c ? `Cor ${c}` : 'Cor padrão'}
            style={{ ['--c' as string]: c || 'var(--node)' }}
            onClick={() => aoMudar(c || undefined)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * O responsável de uma peça: busca nos cadastros da empresa; um nome que não existe vira cadastro novo (com o
 * tipo sugerido, que dá pra trocar) só no Enter ou no "Criar …": sair do campo com um nome que não existe volta ao
 * que estava (criar um cadastro da empresa sem querer é pior que redigitar). Vazio tira o responsável.
 */
export function Responsavel({
  rotulo,
  tipoPeca,
  atual,
  cadastros,
  tipos,
  aoEscolher,
  aoCriar,
}: {
  rotulo: string;
  tipoPeca: TipoPeca;
  atual: Cadastro | undefined;
  cadastros: readonly Cadastro[];
  tipos: readonly TipoCadastro[];
  aoEscolher: (id: string | undefined) => void;
  aoCriar: (tipo: string, nome: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState(atual?.nome ?? '');
  const [aberto, setAberto] = useState(false);
  // -1: nada destacado (o Enter num campo vazio não pega o primeiro cadastro da lista).
  const [destaque, setDestaque] = useState(-1);
  const [tipoNovo, setTipoNovo] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const lista = useId();
  const achados = buscar(cadastros, texto, 6);
  const exato = comNome(cadastros, texto);
  const podeCriar = texto.trim() !== '' && !exato;
  const tipo = tipoNovo ?? tipoSugerido(texto, tipoPeca, tipos);
  const nomeTipo = (k: string) => tipos.find((t) => t.chave === k)?.nome ?? k;
  const opcoes = [...achados.map((k) => ({ k })), ...(podeCriar ? [{ k: null }] : [])];
  const mostrar = aberto && opcoes.length > 0;
  const idOpcao = (i: number) => `${lista}-op-${i}`;

  const voltar = () => {
    setTexto(atual?.nome ?? '');
    setTipoNovo(null);
    setAberto(false);
    setDestaque(-1);
  };

  const escolher = async (i: number) => {
    const o = opcoes[i];
    setAberto(false);
    if (!o) return;
    if (o.k) {
      setTexto(o.k.nome);
      return aoEscolher(o.k.id);
    }
    setCriando(true);
    await aoCriar(tipo, texto.trim());
    setCriando(false);
  };

  /** Enter sem opção destacada: vazio tira, nome que existe vale, nome novo cria. */
  const confirmar = () => {
    const t = texto.trim();
    if (!t) return atual && aoEscolher(undefined);
    if (exato) {
      setTexto(exato.nome);
      return exato.id !== atual?.id && aoEscolher(exato.id);
    }
    void escolher(opcoes.length - 1);
  };

  /** Saiu do campo e da escolha do tipo: vazio tira, nome que existe vale, nome novo volta ao que estava. */
  const sair = () => {
    setAberto(false);
    if (criando) return;
    const t = texto.trim();
    if (t === (atual?.nome ?? '')) return;
    if (!t) return aoEscolher(undefined);
    if (exato) {
      setTexto(exato.nome);
      return exato.id !== atual?.id && aoEscolher(exato.id);
    }
    voltar();
  };

  return (
    <div
      className="campo"
      ref={caixa}
      onBlur={(e) => {
        // O foco foi pro tipo do cadastro novo (ou voltou dele pro campo): ainda está escolhendo.
        if (caixa.current?.contains(e.relatedTarget as Node | null)) return;
        sair();
      }}
    >
      <label htmlFor={`${lista}-campo`}>{rotulo}</label>
      <div className="combo">
        <input
          id={`${lista}-campo`}
          type="text"
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={mostrar ? lista : undefined}
          aria-activedescendant={mostrar && destaque >= 0 && destaque < opcoes.length ? idOpcao(destaque) : undefined}
          aria-autocomplete="list"
          value={texto}
          placeholder="Escreva: vira cadastro"
          disabled={criando}
          onChange={(e) => {
            setTexto(e.target.value);
            setAberto(true);
            setDestaque(e.target.value.trim() ? 0 : -1);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setAberto(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAberto(true);
              setDestaque((d) => Math.min(d + 1, opcoes.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setDestaque((d) => Math.max(d - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (mostrar && destaque >= 0 && opcoes[destaque]) void escolher(destaque);
              else confirmar();
            } else if (e.key === 'Escape') voltar();
          }}
        />
        {/* O tipo fica entre o campo e a lista: a lista aberta não cobre a escolha. */}
        {podeCriar && (
          <label className="linha dica">
            Novo cadastro do tipo
            <select value={tipo} onChange={(e) => setTipoNovo(e.target.value)} aria-label="Tipo do cadastro novo">
              {tipos.map((t) => (
                <option key={t.chave} value={t.chave}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        {mostrar && (
          <div className="sugestoes" id={lista} role="listbox" aria-label={rotulo}>
            {opcoes.map((o, i) => (
              <button
                key={o.k?.id ?? 'novo'}
                id={idOpcao(i)}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={i === destaque}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void escolher(i)}
              >
                {o.k ? (
                  <>
                    <span>{o.k.nome}</span>
                    <small>{nomeTipo(o.k.tipo)}</small>
                  </>
                ) : (
                  <>
                    <span>Criar “{texto.trim()}”</span>
                    <small>{nomeTipo(tipo)}</small>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
