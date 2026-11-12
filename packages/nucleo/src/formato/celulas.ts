import type { Coluna } from './abas';
import { DIAS, type Dia, type Expressao } from './documento';
import { TIPOS_REF, lerRef, montarRef } from './refs';

export type ResultadoCelula = { ok: true; valor: unknown } | { ok: false; erro: string };

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Converte o texto de uma célula no valor tipado da coluna.
 * Devolve null quando a célula está vazia e a coluna não tem valor padrão.
 */
export function lerCelula(coluna: Coluna, bruto: string | undefined): ResultadoCelula | null {
  let texto = (bruto ?? '').trim();
  if (texto === '') {
    if (coluna.padrao === undefined) return null;
    texto = coluna.padrao;
  }
  switch (coluna.tipo) {
    case 'texto':
      return { ok: true, valor: texto };
    case 'inteiro':
      return /^\d+$/.test(texto) ? { ok: true, valor: Number(texto) } : { ok: false, erro: `"${texto}" não é um número inteiro` };
    case 'booleano': {
      const v = semAcento(texto.toLowerCase());
      if (['sim', 's', 'true', '1'].includes(v)) return { ok: true, valor: true };
      if (['nao', 'n', 'false', '0'].includes(v)) return { ok: true, valor: false };
      return { ok: false, erro: `"${texto}" não é sim nem não` };
    }
    case 'enum': {
      const v = semAcento(texto.toLowerCase());
      const valores = coluna.valores ?? [];
      return valores.includes(v) ? { ok: true, valor: v } : { ok: false, erro: `"${texto}" não é permitido. Use: ${valores.join(', ')}` };
    }
    case 'ref':
      return lerUmaRef(coluna, texto);
    case 'refs': {
      const lista: string[] = [];
      for (const parte of texto.split(/[\s,]+/).filter(Boolean)) {
        const r = lerUmaRef(coluna, parte);
        if (!r.ok) return r;
        lista.push(r.valor as string);
      }
      return { ok: true, valor: lista };
    }
    case 'hora': {
      const m = /^(\d{1,2}):(\d{2})$/.exec(texto);
      if (!m) return { ok: false, erro: `"${texto}" não é uma hora no formato HH:MM` };
      const h = Number(m[1]);
      const min = Number(m[2]);
      if (h > 24 || min > 59 || (h === 24 && min > 0)) return { ok: false, erro: `"${texto}" não é uma hora válida` };
      return { ok: true, valor: `${String(h).padStart(2, '0')}:${m[2]}` };
    }
    case 'data': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
      if (m) {
        const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
        if (d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])) return { ok: true, valor: texto };
      }
      return { ok: false, erro: `"${texto}" não é uma data no formato AAAA-MM-DD` };
    }
    case 'dias':
      return lerDias(texto);
    case 'expressao': {
      const m = /^([a-z_][a-z0-9_]*)\s*=\s*(.+)$/i.exec(texto);
      if (!m) return { ok: false, erro: `"${texto}" não está no formato chave=valor` };
      const valor: Expressao = { chave: (m[1] as string).toLowerCase(), valor: (m[2] as string).trim() };
      return { ok: true, valor };
    }
    case 'opcao': {
      const v = semAcento(texto.toLowerCase());
      return /^([0-9*#]|[a-z][a-z0-9_]*)$/.test(v)
        ? { ok: true, valor: v }
        : { ok: false, erro: `"${texto}" não é uma opção válida. Use um dígito, * ou #, ou uma palavra como esgotou, sim, nao` };
    }
  }
}

function lerUmaRef(coluna: Coluna, texto: string): ResultadoCelula {
  const r = lerRef(texto);
  if (!r) return { ok: false, erro: `"${texto}" não é uma referência. Escreva tipo:id, por exemplo fila:90011` };
  const permitidos = coluna.refs ?? TIPOS_REF;
  if (!permitidos.includes(r.tipo)) return { ok: false, erro: `"${texto}" não pode ser usado aqui. Tipos aceitos: ${permitidos.join(', ')}` };
  return { ok: true, valor: montarRef(r.tipo, r.id) };
}

const DIAS_POR_EXTENSO: Record<string, Dia> = {
  domingo: 'dom', segunda: 'seg', terca: 'ter', quarta: 'qua', quinta: 'qui', sexta: 'sex', sabado: 'sab',
};

/** Aceita só a abreviação de 3 letras ou o nome por extenso (já em minúsculas e sem acento). */
function paraDia(t: string): Dia | undefined {
  if (DIAS.includes(t as Dia)) return t as Dia;
  return DIAS_POR_EXTENSO[t];
}

function lerDias(texto: string): ResultadoCelula {
  const dias = new Set<Dia>();
  for (const parte of semAcento(texto.toLowerCase()).split(/[\s,]+/).filter(Boolean)) {
    const faixa = /^([a-z]+)-([a-z]+)$/.exec(parte);
    if (faixa) {
      const da = paraDia(faixa[1] as string);
      const db = paraDia(faixa[2] as string);
      const a = da === undefined ? -1 : DIAS.indexOf(da);
      const b = db === undefined ? -1 : DIAS.indexOf(db);
      if (a < 0 || b < 0 || b < a) return { ok: false, erro: `"${parte}" não é uma faixa de dias válida, por exemplo seg-sex` };
      for (let i = a; i <= b; i++) dias.add(DIAS[i] as Dia);
    } else {
      const d = paraDia(parte);
      if (!d) return { ok: false, erro: `"${parte}" não é um dia. Use dom, seg, ter, qua, qui, sex, sab` };
      dias.add(d);
    }
  }
  if (dias.size === 0) return { ok: false, erro: 'nenhum dia informado' };
  return { ok: true, valor: DIAS.filter((d) => dias.has(d)) };
}

/** Converte um valor tipado de volta para o texto de uma célula. */
export function paraCelula(valor: unknown): string {
  if (valor === undefined || valor === null) return '';
  if (typeof valor === 'boolean') return valor ? 'sim' : 'nao';
  if (Array.isArray(valor)) return valor.map(String).join(' ');
  if (typeof valor === 'object') {
    const e = valor as Partial<Expressao>;
    return e.chave !== undefined ? `${e.chave}=${e.valor ?? ''}` : JSON.stringify(valor);
  }
  return String(valor);
}
