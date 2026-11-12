import { nomeDe, type Indice } from '../formato/indice';
import { lerRef } from '../formato/refs';
import { dentroDoHorario, ehFeriado, paraHora } from '../motor/relogio';
import { achado, type Achado } from './tipos';

export interface SegmentoAgenda {
  /** Minutos desde 00:00. */
  inicio: number;
  fim: number;
  /** Primeiro ponto depois das regras de horário e feriado. */
  destino: string;
}

/** Segunda-feira usada como semana de referência. Feriados são ignorados na agenda. */
const SEGUNDA_REFERENCIA = Date.UTC(2024, 0, 1);
export const DIAS_AGENDA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;

/** Segue as regras de horário e feriado a partir de ref, no instante ms. */
export function destinoNoHorario(idx: Indice, ref: string, ms: number, ignorarFeriados: boolean): string {
  let atual = ref;
  for (let i = 0; i < 20; i++) {
    const r = lerRef(atual);
    const p = r?.tipo === 'peca' ? idx.pecas.get(r.id) : undefined;
    if (!p) return atual;
    let resposta: string;
    if (p.tipo === 'regra_horario') {
      const grupo = p.horario ? lerRef(p.horario)?.id : undefined;
      resposta = dentroDoHorario(idx.janelas.get(grupo ?? '') ?? [], ms) ? 'sim' : 'nao';
    } else if (p.tipo === 'regra_feriado') {
      resposta = !ignorarFeriados && ehFeriado(idx.feriados.get(p.calendario ?? '') ?? [], ms) ? 'sim' : 'nao';
    } else return atual;
    const saida = (idx.saidasDe.get(p.id) ?? []).find((s) => s.opcao === resposta);
    if (!saida) return atual;
    atual = saida.para;
  }
  return atual;
}

/** Pra cada dia (seg…dom), os intervalos e o destino de cada um. */
export function agendaSemanal(idx: Indice, ref: string): SegmentoAgenda[][] {
  const dias: SegmentoAgenda[][] = [];
  for (let d = 0; d < 7; d++) {
    const segmentos: SegmentoAgenda[] = [];
    let atual: string | null = null;
    let inicio = 0;
    for (let m = 0; m < 1440; m++) {
      const destino = destinoNoHorario(idx, ref, SEGUNDA_REFERENCIA + (d * 1440 + m) * 60_000, true);
      if (destino !== atual) {
        if (atual !== null) segmentos.push({ inicio, fim: m, destino: atual });
        atual = destino;
        inicio = m;
      }
    }
    segmentos.push({ inicio, fim: 1440, destino: atual! });
    dias.push(segmentos);
  }
  return dias;
}

/** Janelas curtas (menos de 60 min) que caem num destino diferente dos vizinhos. */
export function buracosDeHorario(idx: Indice, alc: Set<string>): Achado[] {
  const inicios = new Set<string>();
  for (const e of idx.doc.entradas) {
    const r = lerRef(e.destino);
    const p = r?.tipo === 'peca' ? idx.pecas.get(r.id) : undefined;
    if (p && (p.tipo === 'regra_horario' || p.tipo === 'regra_feriado') && alc.has(e.destino)) inicios.add(e.destino);
  }
  const out: Achado[] = [];
  for (const inicio of inicios) {
    const buracos = new Map<string, { dias: string[]; seg: SegmentoAgenda; antes: string; depois: string }>();
    agendaSemanal(idx, inicio).forEach((segmentos, d) => {
      for (let i = 1; i < segmentos.length - 1; i++) {
        const seg = segmentos[i]!;
        const antes = segmentos[i - 1]!.destino;
        const depois = segmentos[i + 1]!.destino;
        if (seg.fim - seg.inicio >= 60 || antes === seg.destino || depois === seg.destino) continue;
        const chave = `${seg.inicio}-${seg.fim}>${seg.destino}`;
        const b = buracos.get(chave) ?? { dias: [], seg, antes, depois };
        b.dias.push(DIAS_AGENDA[d]!);
        buracos.set(chave, b);
      }
    });
    for (const [chave, b] of buracos) {
      const janela = `${paraHora(b.seg.inicio)}–${paraHora(b.seg.fim)}`;
      out.push(
        achado(
          'buraco_horario',
          `${inicio}:${chave}`,
          `${b.dias.join(', ')} ${janela}`,
          `Nesses ${b.seg.fim - b.seg.inicio} minutos a ligação que passa por ${nomeDe(idx, inicio)} cai em ${nomeDe(idx, b.seg.destino)}, entre ${nomeDe(idx, b.antes)} e ${nomeDe(idx, b.depois)}.`,
          [inicio, b.seg.destino, b.antes, b.depois],
        ),
      );
    }
  }
  return out;
}
