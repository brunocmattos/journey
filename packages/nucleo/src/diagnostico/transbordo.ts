import { existe, nomeDe, type Indice } from '../formato/indice';
import { lerRef } from '../formato/refs';
import { achado, type Achado } from './tipos';

/** Campos em que a lista só toca: o que não existe ali não é caminho (ver alcance.ts). */
const CAMPOS_DE_MEMBROS = new Set(['membros', 'siga_me_lista']);

/**
 * Ramais, filas e grupos que transbordam pra algo que não existe (grave) ou listam membro que não existe (alerta).
 * Se o mesmo alvo aparece nos dois tipos de campo, saem dois achados, cada um com a sua chave.
 */
export function destinosInexistentes(idx: Indice): Achado[] {
  const out: Achado[] = [];
  const registrar = (dono: string, campos: [string, string | string[] | undefined][]) => {
    const porAlvo = new Map<string, { destino: string[]; membro: string[] }>();
    for (const [campo, valor] of campos) {
      for (const alvo of Array.isArray(valor) ? valor : valor ? [valor] : []) {
        if (existe(idx, alvo)) continue;
        const entrada = porAlvo.get(alvo) ?? { destino: [], membro: [] };
        entrada[CAMPOS_DE_MEMBROS.has(campo) ? 'membro' : 'destino'].push(campo);
        porAlvo.set(alvo, entrada);
      }
    }
    const nome = nomeDe(idx, dono);
    for (const [alvo, { destino, membro }] of porAlvo) {
      if (destino.length > 0) {
        out.push(
          achado(
            'destino_inexistente',
            `${dono}>${alvo}`,
            `${nome} aponta pra ${alvo}, que não existe`,
            `Em ${destino.join(', ')}, ${nome} aponta pra ${alvo}, que não está no catálogo (pode ter sido apagado). A ligação não tem pra onde ir.`,
            [dono, alvo],
            destino,
          ),
        );
      }
      if (membro.length > 0) {
        out.push(
          achado(
            'membro_inexistente',
            `${dono}>${alvo}`,
            `${nome} lista ${alvo}, que não existe`,
            `Em ${membro.join(', ')}, ${nome} lista como membro ${alvo}, que não está no catálogo (pode ter sido apagado); ele não vai tocar. Os outros da lista continuam tocando.`,
            [dono, alvo],
            membro,
          ),
        );
      }
    }
  };
  for (const r of idx.doc.ramais) {
    registrar(`ramal:${r.id}`, [
      ['ao_nao_atender', r.ao_nao_atender],
      ['ao_ocupado', r.ao_ocupado],
      ['ao_indisponivel', r.ao_indisponivel],
      ['siga_me_lista', r.siga_me_lista],
    ]);
  }
  for (const f of idx.doc.filas) {
    registrar(`fila:${f.id}`, [
      ['ao_esgotar', f.ao_esgotar],
      ['pesquisa_ao_desligar', f.pesquisa_ao_desligar],
      ['membros', f.membros],
    ]);
  }
  for (const g of idx.doc.grupos) {
    registrar(`grupo:${g.id}`, [
      ['ao_esgotar', g.ao_esgotar],
      ['membros', g.membros],
    ]);
  }
  return out;
}

/** Ramais que transbordam uns pros outros em círculo, e quem cai nesses círculos. */
export function ciclosDeTransbordo(idx: Indice): Achado[] {
  const ciclos = new Map<string, { membros: string[]; afetados: Set<string> }>();
  for (const inicio of idx.doc.ramais) {
    const caminho: string[] = [];
    let atual: string | undefined = inicio.id;
    while (atual !== undefined && idx.ramais.has(atual)) {
      const pos = caminho.indexOf(atual);
      if (pos >= 0) {
        const membros = caminho.slice(pos);
        const chave = [...membros].sort().join('+');
        const ciclo = ciclos.get(chave) ?? { membros, afetados: new Set<string>() };
        caminho.forEach((c) => ciclo.afetados.add(c));
        ciclos.set(chave, ciclo);
        break;
      }
      caminho.push(atual);
      const proximo: string | undefined = idx.ramais.get(atual)!.ao_nao_atender;
      const r: ReturnType<typeof lerRef> = proximo ? lerRef(proximo) : null;
      atual = r?.tipo === 'ramal' ? r.id : undefined;
    }
  }
  return [...ciclos.entries()].map(([chave, { membros, afetados }]) => {
    const refs = [...membros, ...[...afetados].filter((a) => !membros.includes(a)).sort()].map((id) => `ramal:${id}`);
    return achado(
      'ciclo_transbordo',
      chave,
      `Ciclo entre ${membros.join(' ↔ ')}`,
      `Se ninguém atende, a ligação fica pulando entre ${membros.map((m) => `ramal ${m}`).join(' e ')} sem fim. ${afetados.size} ramais caem nesse ciclo.`,
      refs,
    );
  });
}

/** Ramais que transbordam pra uma fila da qual eles mesmos são membros. */
export function voltaPropriaFila(idx: Indice): Achado[] {
  const out: Achado[] = [];
  for (const r of idx.doc.ramais) {
    if (r.transbordo_anti_loop || !r.ao_nao_atender) continue;
    const alvo = lerRef(r.ao_nao_atender);
    const fila = alvo?.tipo === 'fila' ? idx.filas.get(alvo.id) : undefined;
    if (!fila || !(fila.membros ?? []).includes(`ramal:${r.id}`)) continue;
    out.push(
      achado(
        'volta_propria_fila',
        `ramal:${r.id}>fila:${fila.id}`,
        `Ramal ${r.id} transborda pra fila ${fila.id}, da qual é membro`,
        `Se a ligação veio da fila ${fila.id} e o ramal ${r.id} não atende, ela volta pra mesma fila.`,
        [`ramal:${r.id}`, `fila:${fila.id}`],
      ),
    );
  }
  return out;
}

/** Grupos que desligam quando ninguém atende: ao_esgotar = fim:desliga ou vazio (o motor trata os dois igual). */
export function gruposQueDesligam(idx: Indice): Achado[] {
  return idx.doc.grupos
    .filter((g) => g.ao_esgotar === undefined || g.ao_esgotar === 'fim:desliga')
    .map((g) =>
      achado(
        'grupo_desliga',
        `grupo:${g.id}`,
        `${nomeDe(idx, `grupo:${g.id}`)} desliga se ninguém atende`,
        `Todos do grupo tocam por ${g.toque_s ?? 20} s. Se ninguém atende, a central desliga a ligação${g.ao_esgotar === undefined ? ': não há destino em ao_esgotar' : ''}.`,
        [`grupo:${g.id}`],
        ['ao_esgotar'],
      ),
    );
}

/** Filas sem tempo máximo de espera. */
export function esperaSemLimite(idx: Indice): Achado[] {
  return idx.doc.filas
    .filter((f) => f.espera_maxima_s === undefined)
    .map((f) =>
      achado('espera_sem_limite', `fila:${f.id}`, `${nomeDe(idx, `fila:${f.id}`)} não tem tempo máximo`, 'A pessoa fica na fila até alguém atender ou ela desistir.', [`fila:${f.id}`]),
    );
}

/** Filas com destino de falha que nunca é usado, porque não há tempo máximo. */
export function planoBQueNaoDispara(idx: Indice): Achado[] {
  return idx.doc.filas
    .filter((f) => f.ao_esgotar && f.ao_esgotar !== 'fim:desliga' && f.espera_maxima_s === undefined)
    .map((f) =>
      achado(
        'plano_b_nao_dispara',
        `fila:${f.id}`,
        `${nomeDe(idx, `fila:${f.id}`)}: o destino de falha nunca dispara`,
        `A fila manda pra ${nomeDe(idx, f.ao_esgotar!)} quando a espera acaba, mas não tem tempo máximo. Esse destino nunca é usado.`,
        [`fila:${f.id}`, f.ao_esgotar!],
      ),
    );
}

/**
 * Ramais e filas alcançáveis sem destino pra quando ninguém atende: a ligação desliga.
 * Os ramais saem num achado só (chave sem_transbordo:ramais, refs em ordem), pra uma lista grande não virar uma enxurrada; cada fila sai no seu.
 * Fila sem tempo máximo fica de fora: a espera não acaba, e quem avisa é espera_sem_limite.
 * Grupo fica de fora: grupo sem ao_esgotar é grupo_desliga, igual ao que tem fim:desliga.
 * Ramais, filas e grupos não têm a coluna ativo; não há inativo a pular.
 */
export function semTransbordo(idx: Indice, alc: Set<string>): Achado[] {
  const out: Achado[] = [];
  const ramais = idx.doc.ramais
    .filter((r) => r.ao_nao_atender === undefined && alc.has(`ramal:${r.id}`))
    .map((r) => `ramal:${r.id}`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (ramais.length > 0) {
    const um = ramais.length === 1;
    out.push(
      achado(
        'sem_transbordo',
        'ramais',
        um ? `${nomeDe(idx, ramais[0]!)} desliga se ninguém atende` : `${ramais.length} ramais desligam se ninguém atende`,
        um
          ? 'Se ninguém atende o ramal, a central desliga a ligação: não há destino em ao_nao_atender.'
          : `Se ninguém atende, a central desliga a ligação: estes ramais não têm destino em ao_nao_atender (${ramais.map((r) => r.slice('ramal:'.length)).join(', ')}).`,
        ramais,
        ['ao_nao_atender'],
      ),
    );
  }
  for (const f of idx.doc.filas) {
    const ref = `fila:${f.id}`;
    if (!alc.has(ref) || f.ao_esgotar !== undefined || f.espera_maxima_s === undefined) continue;
    out.push(
      achado(
        'sem_transbordo',
        ref,
        `${nomeDe(idx, ref)} desliga se ninguém atende`,
        `Se ninguém atende em ${f.espera_maxima_s} s, a central desliga a ligação: não há destino em ao_esgotar.`,
        [ref],
        ['ao_esgotar'],
      ),
    );
  }
  return out;
}
