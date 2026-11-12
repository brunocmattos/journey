import { completude, regrasDeRelogioIncompletas } from '../formato/completude';
import type { Saida } from '../formato/documento';
import { existe, nomeDe, type Indice } from '../formato/indice';
import { lerRef } from '../formato/refs';
import { destinoFinal } from './alcance';
import { achado, type Achado } from './tipos';

/** "a tecla 4 (Vendas)", "quando as tentativas acabam", "\"sim\"" */
export function descreverOpcao(s: Saida): string {
  if (s.opcao === 'esgotou') return 'quando as tentativas acabam';
  if (/^[0-9*#]$/.test(s.opcao)) return `a tecla ${s.opcao}${s.rotulo ? ` (${s.rotulo})` : ''}`;
  return `"${s.rotulo ?? s.opcao}"`;
}

const juntarLista = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`);

/** Peças alcançáveis sem saída, e saídas ou entradas que apontam pra algo que não existe. */
export function becos(idx: Indice, alc: Set<string>): Achado[] {
  const out: Achado[] = [];
  for (const p of idx.doc.pecas) {
    const ref = `peca:${p.id}`;
    if (!alc.has(ref) || p.tipo === 'fim' || (idx.saidasDe.get(p.id)?.length ?? 0) > 0) continue;
    out.push(achado('beco_sem_saida', ref, `${nomeDe(idx, ref)} não tem saída`, `A ligação chega em ${nomeDe(idx, ref)} e não tem pra onde ir.`, [ref]));
  }
  for (const s of idx.doc.saidas) {
    if (!existe(idx, s.de)) {
      out.push(
        achado(
          'destino_inexistente',
          `saida:${s.id}:origem`,
          `A saída ${s.id} parte de ${s.de}, que não existe`,
          `A saída ${s.id} (${descreverOpcao(s)}) sai de ${s.de}, que não está no catálogo (pode ter sido apagado). Nenhuma ligação chega até ela.`,
          [`saida:${s.id}`, s.de],
        ),
      );
      continue;
    }
    if (existe(idx, s.para)) continue;
    const tipo = lerRef(s.para)?.tipo === 'peca' ? 'beco_sem_saida' : 'destino_inexistente';
    out.push(
      achado(
        tipo,
        `saida:${s.id}`,
        `${nomeDe(idx, s.de)}: ${descreverOpcao(s)} leva a ${s.para}, que não existe`,
        `Em ${nomeDe(idx, s.de)}, ${descreverOpcao(s)} a ligação vai pra ${s.para}, que não existe. A ligação fica sem rumo.`,
        [`saida:${s.id}`, s.de, s.para],
      ),
    );
  }
  for (const e of idx.doc.entradas) {
    if (existe(idx, e.destino)) continue;
    const ref = `entrada:${e.id}`;
    const tipo = lerRef(e.destino)?.tipo === 'peca' ? 'beco_sem_saida' : 'destino_inexistente';
    out.push(achado(tipo, ref, `${nomeDe(idx, ref)} leva a ${e.destino}, que não existe`, `Quem liga em ${e.numero} cai em ${e.destino}, que não existe.`, [ref, e.destino]));
  }
  return out;
}

/** Saídas que voltam pra uma peça anterior do mesmo caminho (ex.: tecla 0 = voltar). */
export function voltasSemLimite(idx: Indice, alc: Set<string>): Achado[] {
  const out: Achado[] = [];
  const estado = new Map<string, 'aberto' | 'fechado'>();
  const visitar = (pecaId: string) => {
    estado.set(pecaId, 'aberto');
    for (const s of idx.saidasDe.get(pecaId) ?? []) {
      const r = lerRef(s.para);
      if (r?.tipo !== 'peca' || !idx.pecas.has(r.id)) continue;
      // O menu que repete a si mesmo ao esgotar já tem contador: as tentativas.
      if (s.opcao === 'esgotou' && r.id === pecaId && idx.pecas.get(pecaId)?.tipo === 'menu') continue;
      const e = estado.get(r.id);
      if (e === 'aberto') {
        out.push(
          achado(
            'volta_sem_limite',
            `saida:${s.id}`,
            `${nomeDe(idx, s.de)}: ${descreverOpcao(s)} volta pra ${nomeDe(idx, s.para)}`,
            `Em ${nomeDe(idx, s.de)}, ${descreverOpcao(s)} leva de volta pra ${nomeDe(idx, s.para)}. Nada conta quantas vezes a pessoa pode voltar.`,
            [`saida:${s.id}`, s.de, s.para],
          ),
        );
      } else if (e === undefined) visitar(r.id);
    }
    estado.set(pecaId, 'fechado');
  };
  for (const e of idx.doc.entradas) {
    const r = lerRef(e.destino);
    if (r?.tipo === 'peca' && idx.pecas.has(r.id) && !estado.has(r.id) && alc.has(e.destino)) visitar(r.id);
  }
  // Peças que só se alcançam depois de fila, grupo ou ramal.
  for (const p of idx.doc.pecas) if (!estado.has(p.id) && alc.has(`peca:${p.id}`)) visitar(p.id);
  return out;
}

/** Opções diferentes do mesmo menu que terminam no mesmo lugar. */
export function redundancias(idx: Indice, alc: Set<string>): Achado[] {
  const out: Achado[] = [];
  for (const p of idx.doc.pecas) {
    const ref = `peca:${p.id}`;
    if (p.tipo !== 'menu' || p.guarda_variavel || !alc.has(ref)) continue;
    const porDestino = new Map<string, Saida[]>();
    for (const s of idx.saidasDe.get(p.id) ?? []) {
      const d = destinoFinal(idx, s.para);
      const lista = porDestino.get(d);
      if (lista) lista.push(s);
      else porDestino.set(d, [s]);
    }
    for (const [destino, saidas] of porDestino) {
      if (saidas.length < 2) continue;
      const opcoes = saidas.map((s) => (s.opcao === 'esgotou' ? 'não digitar nada' : `${s.opcao}${s.rotulo ? ` (${s.rotulo})` : ''}`));
      out.push(
        achado(
          'redundancia',
          `${ref}>${destino}`,
          `${nomeDe(idx, ref)}: ${juntarLista(saidas.map((s) => (s.opcao === 'esgotou' ? 'esgotou' : s.opcao)))} vão pro mesmo lugar`,
          `As opções ${juntarLista(opcoes)} de ${nomeDe(idx, ref)} terminam no mesmo lugar: ${nomeDe(idx, destino)}.`,
          [ref, destino, ...saidas.map((s) => `saida:${s.id}`)],
        ),
      );
    }
  }
  return out;
}

/** Peças, filas e grupos que nenhuma entrada alcança. */
export function semEntrada(idx: Indice, alc: Set<string>): Achado[] {
  const refs = [
    ...idx.doc.pecas.map((p) => `peca:${p.id}`),
    ...idx.doc.filas.map((f) => `fila:${f.id}`),
    ...idx.doc.grupos.map((g) => `grupo:${g.id}`),
  ];
  return refs
    .filter((ref) => !alc.has(ref))
    .map((ref) => achado('sem_entrada', ref, `${nomeDe(idx, ref)} não recebe ligação`, `Nenhuma entrada, saída ou transbordo chega em ${nomeDe(idx, ref)}.`, [ref]));
}

/** Saídas e peças marcadas como inativas no caminho de alguma entrada. */
export function nosInativos(idx: Indice, alc: Set<string>): Achado[] {
  const out: Achado[] = [];
  for (const s of idx.doc.saidas) {
    if (s.ativo || !alc.has(s.de)) continue;
    out.push(
      achado(
        'no_inativo',
        `saida:${s.id}`,
        `${nomeDe(idx, s.de)}: ${descreverOpcao(s)} usa um nó inativo`,
        `A transferência pra ${nomeDe(idx, s.para)} usa um nó marcado como inativo na central. Vale conferir se ainda funciona.`,
        [`saida:${s.id}`, s.de, s.para],
      ),
    );
  }
  for (const p of idx.doc.pecas) {
    const ref = `peca:${p.id}`;
    if (p.ativo || !alc.has(ref)) continue;
    out.push(achado('no_inativo', ref, `${nomeDe(idx, ref)} está inativa`, `${nomeDe(idx, ref)} está marcada como inativa na central, mas a ligação passa por ela.`, [ref]));
  }
  return out;
}

/** Dados que faltam pra simular direito. Horário que não existe não entra: é referência quebrada (horariosInexistentes). */
export function dadosIncompletos(idx: Indice): Achado[] {
  return [...completude(idx), ...regrasDeRelogioIncompletas(idx).filter((p) => p.regra !== 'horario_inexistente')].map((p) =>
    achado('dado_incompleto', `${p.regra}:${p.ref}`, `${nomeDe(idx, p.ref)}: falta informação`, p.mensagem[0]!.toUpperCase() + p.mensagem.slice(1) + '.', [p.ref]),
  );
}

/** Regras de horário que apontam pra um horário que não existe: referência quebrada, como um transbordo pra ramal apagado. */
export function horariosInexistentes(idx: Indice): Achado[] {
  return regrasDeRelogioIncompletas(idx)
    .filter((p) => p.regra === 'horario_inexistente')
    .map((p) => {
      const alvo = idx.pecas.get(p.id)!.horario!;
      const nome = nomeDe(idx, p.ref);
      return achado(
        'destino_inexistente',
        `${p.ref}:horario`,
        `${nome} usa o horário ${alvo}, que não existe`,
        `Em horario, ${nome} aponta pra ${alvo}, que não está no catálogo (nenhuma linha na aba horarios com esse grupo). Sem horário, a regra não sabe pra onde mandar a ligação.`,
        [p.ref, alvo],
        ['horario'],
      );
    });
}
