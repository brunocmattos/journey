import type { NomeAba } from './documento';
import type { Indice } from './indice';

export type RegraCompletude = 'menu_sem_tempo' | 'menu_sem_esgotou' | 'fila_sem_toque';

export interface Pendencia {
  regra: RegraCompletude;
  aba: NomeAba;
  id: string;
  ref: string;
  mensagem: string;
}

/** Dados que faltam pra simular direito. Não impedem o import. */
export function completude(idx: Indice): Pendencia[] {
  const out: Pendencia[] = [];
  for (const p of idx.doc.pecas) {
    if (p.tipo !== 'menu') continue;
    const ref = `peca:${p.id}`;
    const nome = p.nome ?? p.id;
    if (p.espera_s === undefined || p.tentativas === undefined) {
      out.push({ regra: 'menu_sem_tempo', aba: 'pecas', id: p.id, ref, mensagem: `o menu "${nome}" não diz quanto tempo espera a tecla (espera_s) ou quantas tentativas tem (tentativas)` });
    }
    if (!(idx.saidasDe.get(p.id) ?? []).some((s) => s.opcao === 'esgotou')) {
      out.push({ regra: 'menu_sem_esgotou', aba: 'pecas', id: p.id, ref, mensagem: `o menu "${nome}" não diz o que acontece quando as tentativas acabam (saída "esgotou")` });
    }
  }
  for (const f of idx.doc.filas) {
    if (f.toque_por_membro_s === undefined) {
      out.push({ regra: 'fila_sem_toque', aba: 'filas', id: f.id, ref: `fila:${f.id}`, mensagem: `a fila ${f.id} não diz quanto tempo toca cada membro (toque_por_membro_s)` });
    }
  }
  return out;
}
