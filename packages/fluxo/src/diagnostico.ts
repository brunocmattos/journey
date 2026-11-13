import { camposHorario, type Cadastro } from './cadastros';
import { indexar, type Indice } from './indice';
import { formatarTempo } from './relogio';
import type { Conexao, Documento } from './documento';

export type Gravidade = 'grave' | 'alerta' | 'observacao';

export interface Achado {
  tipo: string;
  gravidade: Gravidade;
  /** Estável entre versões (tipo + ids): é o que "marcar como intencional" guarda. */
  chave: string;
  titulo: string;
  texto: string;
  /** Ids das peças e conexões envolvidas (pra "ver no quadro"). */
  refs: string[];
}

export interface OpcoesDiagnostico {
  /** Os cadastros da empresa: sem eles, não se confere responsável nem horário. */
  cadastros?: readonly Cadastro[];
  /** Meta de tempo do fluxo, em segundos: o caminho mais longo acima dela vira achado. */
  meta_s?: number;
}

const ORDEM: Record<Gravidade, number> = { grave: 0, alerta: 1, observacao: 2 };

/** As saídas que a água usa: um Fim encerra a jornada, então as saídas dele não levam a lugar nenhum. */
const proximas = (idx: Indice, id: string): Conexao[] => (idx.pecas.get(id)!.tipo === 'fim' ? [] : idx.saidas.get(id)!);
const tempoDa = (c: Conexao): number => (c.regra === 'tempo' ? (c.tempo_s ?? 0) : 0);

/** De onde cada id chega andando pelas conexões. */
function alcance(idx: Indice, origens: readonly string[], para: 'frente' | 'tras'): Set<string> {
  const vistos = new Set<string>(origens);
  const fila = [...origens];
  while (fila.length) {
    const id = fila.pop()!;
    const prox = para === 'frente' ? proximas(idx, id).map((c) => c.para) : idx.entradas.get(id)!.filter((c) => idx.pecas.get(c.de)!.tipo !== 'fim').map((c) => c.de);
    for (const p of prox) if (!vistos.has(p)) { vistos.add(p); fila.push(p); }
  }
  return vistos;
}

/** Componentes fortemente conexos (Tarjan, iterativo) com mais de uma peça ou com laço na própria peça. */
function ciclos(idx: Indice): string[][] {
  const indice = new Map<string, number>(), baixo = new Map<string, number>(), naPilha = new Set<string>();
  const pilha: string[] = [], achados: string[][] = [];
  let n = 0;
  for (const raiz of idx.pecas.keys()) {
    if (indice.has(raiz)) continue;
    const trabalho: [string, number][] = [[raiz, 0]];
    while (trabalho.length) {
      const topo = trabalho[trabalho.length - 1]!;
      const [v, i] = topo;
      if (i === 0) { indice.set(v, n); baixo.set(v, n); n++; pilha.push(v); naPilha.add(v); }
      const saidas = proximas(idx, v);
      if (i < saidas.length) {
        topo[1]++;
        const w = saidas[i]!.para;
        if (!indice.has(w)) trabalho.push([w, 0]);
        else if (naPilha.has(w)) baixo.set(v, Math.min(baixo.get(v)!, indice.get(w)!));
        continue;
      }
      trabalho.pop();
      if (trabalho.length) { const pai = trabalho[trabalho.length - 1]![0]; baixo.set(pai, Math.min(baixo.get(pai)!, baixo.get(v)!)); }
      if (baixo.get(v) === indice.get(v)) {
        const comp: string[] = [];
        let w: string;
        do { w = pilha.pop()!; naPilha.delete(w); comp.push(w); } while (w !== v);
        if (comp.length > 1 || proximas(idx, v).some((c) => c.para === v)) achados.push(comp.sort());
      }
    }
  }
  return achados;
}

interface Caminho {
  tempo_s: number;
  pecas: string[];
  /** A busca parou no teto: pode haver um caminho mais longo que não foi olhado. */
  estimado: boolean;
}

/** Sem ciclo, o caminho mais longo é exato e linear: ordem topológica e, de trás pra frente, o melhor até um Fim. */
function caminhoSemCiclo(idx: Indice, inicios: readonly string[]): Caminho | null {
  const grau = new Map<string, number>([...idx.pecas.keys()].map((id) => [id, 0]));
  for (const id of idx.pecas.keys()) for (const c of proximas(idx, id)) grau.set(c.para, grau.get(c.para)! + 1);
  const fila = [...grau].filter(([, g]) => g === 0).map(([id]) => id);
  const ordem: string[] = [];
  while (fila.length) {
    const id = fila.pop()!;
    ordem.push(id);
    for (const c of proximas(idx, id)) { const g = grau.get(c.para)! - 1; grau.set(c.para, g); if (g === 0) fila.push(c.para); }
  }
  const ate = new Map<string, number>();
  const seguinte = new Map<string, Conexao>();
  for (const id of ordem.reverse()) {
    const p = idx.pecas.get(id)!;
    if (p.tipo === 'fim') { ate.set(id, p.tempo_s ?? 0); continue; }
    let melhor: Conexao | undefined;
    let valor = -1;
    for (const c of proximas(idx, id)) {
      const resto = ate.get(c.para);
      if (resto !== undefined && tempoDa(c) + resto > valor) { valor = tempoDa(c) + resto; melhor = c; }
    }
    if (melhor) { ate.set(id, (p.tempo_s ?? 0) + valor); seguinte.set(id, melhor); }
  }
  let inicio: string | undefined;
  for (const i of inicios) if (ate.has(i) && (inicio === undefined || ate.get(i)! > ate.get(inicio)!)) inicio = i;
  if (inicio === undefined) return null;
  const pecas = [inicio];
  for (let c = seguinte.get(inicio); c; c = seguinte.get(c.para)) pecas.push(c.para);
  return { tempo_s: ate.get(inicio)!, pecas, estimado: false };
}

/** Teto de conexões olhadas por Início na busca com ciclo. */
const BUSCAS_MAXIMAS = 20_000;

/**
 * Com ciclo, o caminho mais longo sem repetir peça é uma busca: em profundidade, sem recursão (fluxo comprido
 * não estoura a pilha), com um teto por Início. Cada nível é uma peça do caminho, o tempo depois dela e a
 * próxima saída a tentar.
 */
function caminhoComCiclo(idx: Indice, inicios: readonly string[]): Caminho | null {
  let melhor: Caminho | null = null;
  let estimado = false;
  for (const i of inicios) {
    let buscas = 0;
    const caminho: { id: string; tempo: number; saida: number }[] = [];
    const noCaminho = new Set<string>();
    const entrar = (id: string, tempo: number) => {
      const p = idx.pecas.get(id)!;
      const agora = tempo + (p.tempo_s ?? 0);
      if (p.tipo === 'fim') {
        if (!melhor || agora > melhor.tempo_s) melhor = { tempo_s: agora, pecas: [...caminho.map((n) => n.id), id], estimado: false };
        return;
      }
      noCaminho.add(id);
      caminho.push({ id, tempo: agora, saida: 0 });
    };
    entrar(i, 0);
    while (caminho.length) {
      if (++buscas > BUSCAS_MAXIMAS) { estimado = true; break; }
      const topo = caminho[caminho.length - 1]!;
      const c = proximas(idx, topo.id)[topo.saida++];
      if (!c) { caminho.pop(); noCaminho.delete(topo.id); continue; }
      if (!noCaminho.has(c.para)) entrar(c.para, topo.tempo + tempoDa(c));
    }
  }
  return melhor && { ...(melhor as Caminho), estimado };
}

/** A chave que diz se duas saídas da mesma peça são iguais (mesma regra e mesmo valor); vazia quando não se compara. */
function igualdade(c: Conexao): string {
  switch (c.regra) {
    case 'opcao':
    case 'condicao':
      return c.valor ? `${c.regra}:${c.valor.trim().toLowerCase().slice(0, 60)}` : '';
    case 'horario':
      return c.horario ? `horario:${c.horario}` : '';
    case 'senao':
      return 'senao';
    default:
      return '';
  }
}
const COMO_IGUAL: Record<string, string> = { opcao: 'a mesma opção', condicao: 'a mesma condição', horario: 'o mesmo lado do horário', senao: '"senão"' };

/** Os problemas de um fluxo, do mais grave pro mais leve. Vale pra qualquer canal: nada aqui é de telefonia. */
export function diagnosticar(doc: Documento, opcoes: OpcoesDiagnostico = {}): Achado[] {
  const idx = indexar(doc);
  const out: Achado[] = [];
  const nome = (id: string) => idx.pecas.get(id)?.nome || id;
  const achado = (tipo: string, gravidade: Gravidade, sufixo: string, titulo: string, texto: string, refs: string[]) =>
    out.push({ tipo, gravidade, chave: `${tipo}:${sufixo}`, titulo, texto, refs });

  const inicios = doc.pecas.filter((p) => p.tipo === 'inicio').map((p) => p.id);
  const fins = doc.pecas.filter((p) => p.tipo === 'fim').map((p) => p.id);
  const alcancaveis = alcance(idx, inicios, 'frente');
  const chegaNoFim = alcance(idx, fins, 'tras');

  if (doc.pecas.length > 0 && inicios.length === 0) achado('sem_inicio', 'grave', 'fluxo', 'O fluxo não tem Início', 'Sem um Início, não dá pra simular nem saber por onde a jornada começa.', []);

  for (const p of doc.pecas) {
    const saidas = idx.saidas.get(p.id)!;
    if (p.tipo !== 'fim' && saidas.length === 0) achado('beco_sem_saida', 'grave', p.id, `${p.nome} não tem saída`, `A jornada chega em ${p.nome} e não tem pra onde ir. Liga a uma próxima peça ou troca por um Fim.`, [p.id]);
    if (p.tipo === 'fim' && saidas.length > 0) achado('fim_com_saida', 'observacao', p.id, `${p.nome} é um Fim e tem saída`, `A jornada termina em ${p.nome}: as saídas dele nunca são usadas.`, [p.id, ...saidas.map((c) => c.id)]);
    if (inicios.length > 0 && p.tipo !== 'inicio' && !alcancaveis.has(p.id)) achado('inalcancavel', 'alerta', p.id, `Ninguém chega em ${p.nome}`, `Nenhum Início leva até ${p.nome}.`, [p.id]);
    if (p.tipo === 'inicio' && saidas.length > 0 && !chegaNoFim.has(p.id)) achado('nao_termina', 'grave', p.id, `${p.nome} nunca chega num Fim`, `Nenhum caminho que começa em ${p.nome} termina num Fim.`, [p.id]);
    if (p.tipo === 'decisao' && saidas.length === 1 && saidas[0]!.regra !== 'horario') achado('decisao_sem_escolha', 'alerta', p.id, `${p.nome} tem um caminho só`, `É uma decisão, mas só tem uma saída: não há o que decidir.`, [p.id]);
    if (p.tipo === 'atendimento' && !p.responsavel) achado('sem_responsavel', 'observacao', p.id, `${p.nome}: quem atende?`, `O atendimento não diz quem atende (uma pessoa, fila ou equipe).`, [p.id]);
    const cadastro = p.responsavel ? opcoes.cadastros?.find((k) => k.id === p.responsavel) : undefined;
    if (p.responsavel && opcoes.cadastros && !cadastro) achado('responsavel_inexistente', 'alerta', p.id, `${p.nome} aponta pra um cadastro que não existe`, `O responsável de ${p.nome} foi apagado ou é de outra empresa.`, [p.id]);

    const deHorario = saidas.filter((c) => c.regra === 'horario');
    if (deHorario.length) {
      if (!p.responsavel || (cadastro && cadastro.tipo !== 'horario'))
        achado('horario_sem_cadastro', 'alerta', p.id, `${p.nome} decide pelo horário, mas sem um Horário`, `${p.nome} tem saída de horário, mas não usa um cadastro de Horário: o relógio não tem como decidir.`, [p.id]);
      else if (cadastro && !camposHorario(cadastro))
        achado('horario_invalido', 'alerta', p.id, `O horário ${cadastro.nome} tem campos inválidos`, `${p.nome} decide pelo horário ${cadastro.nome}, mas uma janela ou um feriado dele está errado: o relógio não tem como decidir.`, [p.id]);
      // Quando o relógio decide sozinho (só saídas de horário), cada lado precisa de uma saída, ou de um "senão".
      if (saidas.every((c) => c.regra === 'horario')) {
        for (const lado of ['dentro', 'fora'] as const) {
          if (!deHorario.some((c) => c.horario === lado))
            achado('horario_sem_lado', 'alerta', `${p.id}:${lado}`, `${p.nome} não tem saída ${lado} do horário`, `${lado === 'dentro' ? 'Com o atendimento aberto' : 'Com o atendimento fechado'}, a jornada para em ${p.nome}. Liga uma saída "${lado} do horário" ou uma "senão".`, [p.id]);
        }
      }
    }

    // Saídas iguais: mesma regra e mesmo valor saindo da mesma peça (um achado por grupo).
    const iguais = new Map<string, string[]>();
    for (const c of saidas) {
      const k = igualdade(c);
      if (k) iguais.set(k, [...(iguais.get(k) ?? []), c.id]);
    }
    for (const [k, ids] of iguais) {
      if (ids.length < 2) continue;
      const regra = k.split(':')[0]!;
      achado('opcoes_repetidas', 'alerta', `${p.id}:${k}`, `${p.nome} tem ${ids.length} saídas iguais`, `${ids.length} saídas de ${p.nome} são ${COMO_IGUAL[regra]}: não dá pra saber qual seguir.`, [p.id, ...ids]);
    }
  }

  for (const c of doc.conexoes) {
    if (!idx.pecas.has(c.de) || !idx.pecas.has(c.para)) continue;
    const vazia = (c.regra === 'opcao' && !c.valor) || (c.regra === 'condicao' && !c.valor) || (c.regra === 'tempo' && !c.tempo_s) || (c.regra === 'horario' && !c.horario);
    if (vazia) achado('regra_vazia', 'observacao', c.id, `Saída de ${nome(c.de)} sem regra preenchida`, `A ligação de ${nome(c.de)} pra ${nome(c.para)} tem a regra pela metade.`, [c.de, c.id]);
  }

  // O relógio decide sozinho numa peça só com saídas de horário (e "senão") e um responsável Horário.
  const doRelogio = (id: string) => {
    const p = idx.pecas.get(id)!;
    const s = proximas(idx, id);
    const k = opcoes.cadastros?.find((x) => x.id === p.responsavel);
    return s.some((c) => c.regra === 'horario') && s.every((c) => c.regra === 'horario' || c.regra === 'senao') && (opcoes.cadastros ? k?.tipo === 'horario' : !!p.responsavel);
  };
  const comps = ciclos(idx);
  for (const comp of comps) {
    if (comp.some((id) => chegaNoFim.has(id))) {
      // Tem saída, mas ninguém escolhe e o tempo não anda: se o relógio mandar pra dentro do ciclo, ele manda de novo.
      const dentro = new Set(comp);
      const sozinho = comp.every((id) => proximas(idx, id).length === 1 || doRelogio(id));
      const semTempo = comp.every((id) => !idx.pecas.get(id)!.tempo_s && proximas(idx, id).every((c) => !dentro.has(c.para) || tempoDa(c) === 0));
      if (sozinho && semTempo && comp.some(doRelogio))
        achado('ciclo_sem_tempo', 'alerta', comp.join('+'), `Ciclo sem espera: ${comp.map(nome).join(', ')}`, 'O relógio manda a jornada de volta pras mesmas peças sem o tempo andar, então ele decide igual de novo e ela não sai. Põe um tempo na espera (uma peça com tempo ou uma ligação "depois de um tempo").', comp);
      continue;
    }
    achado('ciclo_sem_saida', 'grave', comp.join('+'), `Ciclo sem saída: ${comp.map(nome).join(', ')}`, 'Essas peças levam umas às outras e nenhuma chega num Fim: quem entra aqui não termina a jornada.', comp);
  }

  if (opcoes.meta_s && opcoes.meta_s > 0) {
    const longo = comps.length === 0 ? caminhoSemCiclo(idx, inicios) : caminhoComCiclo(idx, inicios);
    if (longo && longo.tempo_s > opcoes.meta_s) {
      const nomes = longo.pecas.map(nome);
      const trecho = nomes.length > 8 ? [...nomes.slice(0, 3), '…', ...nomes.slice(-3)] : nomes;
      const aviso = longo.estimado ? ' É uma estimativa: o fluxo tem caminhos demais pra conferir um por um.' : '';
      achado('passou_do_prazo', 'alerta', 'fluxo', `O caminho mais longo passa da meta`, `Indo por ${trecho.join(' → ')}, o cliente leva ${formatarTempo(longo.tempo_s)}; a meta é ${formatarTempo(opcoes.meta_s)}.${aviso}`, longo.pecas);
    }
  }

  return out.sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade] || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));
}
