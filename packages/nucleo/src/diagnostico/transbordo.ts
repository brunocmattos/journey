import { existe, nomeDe, type Indice } from '../formato/indice';
import { lerRef } from '../formato/refs';
import { achado, type Achado } from './tipos';

/** Ramais, filas e grupos que transbordam (ou chamam membros) que não existem. */
export function destinosInexistentes(idx: Indice): Achado[] {
  const out: Achado[] = [];
  const registrar = (dono: string, campos: [string, string | string[] | undefined][]) => {
    const porAlvo = new Map<string, string[]>();
    for (const [campo, valor] of campos) {
      for (const alvo of Array.isArray(valor) ? valor : valor ? [valor] : []) {
        if (existe(idx, alvo)) continue;
        const lista = porAlvo.get(alvo);
        if (lista) lista.push(campo);
        else porAlvo.set(alvo, [campo]);
      }
    }
    for (const [alvo, nomes] of porAlvo) {
      out.push(
        achado(
          'destino_inexistente',
          `${dono}>${alvo}`,
          `${nomeDe(idx, dono)} aponta pra ${alvo}, que não existe`,
          `Em ${nomes.join(', ')}, ${nomeDe(idx, dono)} aponta pra ${alvo}, que não está no catálogo (pode ter sido apagado). A ligação não tem pra onde ir.`,
          [dono, alvo],
          nomes,
        ),
      );
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

/** Grupos que desligam quando ninguém atende. */
export function gruposQueDesligam(idx: Indice): Achado[] {
  return idx.doc.grupos
    .filter((g) => g.ao_esgotar === 'fim:desliga')
    .map((g) =>
      achado(
        'grupo_desliga',
        `grupo:${g.id}`,
        `${nomeDe(idx, `grupo:${g.id}`)} desliga se ninguém atende`,
        `Todos do grupo tocam por ${g.toque_s ?? 20} s. Se ninguém atende, a central desliga a ligação.`,
        [`grupo:${g.id}`],
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
