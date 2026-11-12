import { lerRef, nomeDe, type Evento, type Indice, type Motivo, type QuemDecide } from '@journey/nucleo';

export type Tom = 'normal' | 'meta' | 'aviso' | 'grave' | 'fim';

export interface Linha {
  /** "seg 16:57:12". */
  hora: string;
  texto: string;
  tom: Tom;
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const p2 = (n: number) => String(n).padStart(2, '0');

/** Hora de parede no instante t (segundos desde o início). O motor conta em UTC: a hora simulada é a de parede. */
export function horaEm(inicioMs: number, t: number): string {
  const d = new Date(inicioMs + t * 1000);
  return `${DIAS[d.getUTCDay()]} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
}

/** "3:05" a partir de segundos. */
export const duracao = (s: number) => `${Math.floor(Math.round(s) / 60)}:${p2(Math.round(s) % 60)}`;

/** Nome pra quem lê: o nome do ponto; peça sem nome aparece pelo id, sem o prefixo. */
export function nomeLegivel(idx: Indice, ref: string): string {
  const r = lerRef(ref);
  if (r?.tipo === 'peca') return idx.pecas.get(r.id)?.nome ?? r.id;
  return nomeDe(idx, ref);
}

export function pergunta(idx: Indice, quem: QuemDecide, ref: string): string {
  const p = lerRef(ref)?.tipo === 'peca' ? idx.pecas.get(lerRef(ref)!.id) : undefined;
  switch (quem) {
    case 'quem_liga':
      return 'O que a pessoa digita?';
    case 'relogio':
      return p?.tipo === 'regra_feriado' ? 'Hoje é feriado?' : 'Está dentro do horário?';
    case 'sistema':
      return 'O que o sistema responde?';
    case 'fila':
      return `Alguém da ${nomeLegivel(idx, ref)} atende?`;
    case 'grupo':
      return `Alguém do ${nomeLegivel(idx, ref)} atende?`;
    case 'ramal':
      return `O ${nomeLegivel(idx, ref)} atende?`;
  }
}

export const QUEM: Record<QuemDecide, string> = {
  quem_liga: 'Quem liga',
  relogio: 'O relógio',
  sistema: 'O sistema',
  fila: 'A fila',
  grupo: 'O grupo',
  ramal: 'O ramal',
};

export const FIM: Record<Motivo, { titulo: string; tom: Tom }> = {
  atendido: { titulo: 'Atendido', tom: 'fim' },
  fim: { titulo: 'A ligação terminou', tom: 'fim' },
  desistiu: { titulo: 'A pessoa desistiu de esperar', tom: 'aviso' },
  beco: { titulo: 'Beco sem saída', tom: 'grave' },
  destino_inexistente: { titulo: 'Foi pra um destino que não existe', tom: 'grave' },
  ciclo: { titulo: 'Ciclo sem fim', tom: 'grave' },
  saiu_da_central: { titulo: 'Saiu da central', tom: 'fim' },
  incompleta: { titulo: 'Falta dado pra seguir', tom: 'aviso' },
};

/** Uma linha da linha do tempo por evento que interessa a quem lê. */
export function descrever(idx: Indice, inicioMs: number, e: Evento): Linha | null {
  const hora = horaEm(inicioMs, e.t);
  const nome = (ref: string) => nomeLegivel(idx, ref);
  switch (e.tipo) {
    case 'chegou':
      return { hora, texto: e.visita > 1 ? `De novo em ${nome(e.ref)} (${e.visita}ª vez)` : `Chegou em ${nome(e.ref)}`, tom: e.visita > 1 ? 'aviso' : 'normal' };
    case 'escolheu': {
      const como = { cenario: 'pelo cenário', relogio: 'pelo relógio', unica: 'só uma saída vale', resposta: 'escolha de quem simula', ninguem_atende: 'ninguém atende' }[e.como];
      return { hora, texto: `${e.opcao === 'sempre' ? 'Seguiu' : `Opção ${e.opcao}`} (${como})`, tom: 'meta' };
    }
    case 'definiu':
      return { hora, texto: `Guardou ${e.chave} = ${e.valor}`, tom: 'meta' };
    case 'trocou_canal':
      return { hora, texto: `A jornada mudou de ${e.de} para ${e.para}`, tom: 'normal' };
    case 'resposta_ignorada':
      return { hora, texto: `Resposta "${e.resposta}" não serve: ${e.motivo}`, tom: 'aviso' };
    case 'terminou': {
      const f = FIM[e.motivo];
      return { hora, texto: `${f.titulo}${e.detalhe ? `: ${e.detalhe}` : ''}`, tom: f.tom };
    }
    default:
      return null;
  }
}

export interface Resumo {
  segundos: number;
  decisoes: number;
  canais: string[];
}

export function resumir(eventos: readonly Evento[]): Resumo {
  const canais = ['telefonia'];
  for (const e of eventos) if (e.tipo === 'trocou_canal' && !canais.includes(e.para)) canais.push(e.para);
  return {
    segundos: eventos.at(-1)?.t ?? 0,
    decisoes: eventos.filter((e) => e.tipo === 'escolheu' && e.como !== 'unica').length,
    canais,
  };
}
