import { camposHorario, type Cadastro } from './cadastros';
import { indexar, type Indice } from './indice';
import { formatarTempo } from './relogio';
import type { Documento } from './documento';

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

/** De onde cada id chega andando pelas conexões. */
function alcance(idx: Indice, origens: readonly string[], para: 'frente' | 'tras'): Set<string> {
  const vistos = new Set<string>(origens);
  const fila = [...origens];
  while (fila.length) {
    const id = fila.pop()!;
    const prox = para === 'frente' ? idx.saidas.get(id)!.map((c) => c.para) : idx.entradas.get(id)!.map((c) => c.de);
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
      const saidas = idx.saidas.get(v)!;
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
        if (comp.length > 1 || idx.saidas.get(v)!.some((c) => c.para === v)) achados.push(comp.sort());
      }
    }
  }
  return achados;
}

/** O caminho mais demorado de algum Início até algum Fim, sem repetir peça (com um teto de buscas pra fluxo grande). */
function caminhoMaisLongo(idx: Indice, inicios: readonly string[]): { tempo_s: number; pecas: string[] } | null {
  let melhor: { tempo_s: number; pecas: string[] } | null = null;
  let buscas = 0;
  // Busca em profundidade sem recursão (fluxo comprido não estoura a pilha): cada nível é uma peça do caminho,
  // o tempo depois dela e a próxima saída a tentar.
  const caminho: { id: string; tempo: number; saida: number }[] = [];
  const noCaminho = new Set<string>();
  const entrar = (id: string, tempo: number) => {
    buscas++;
    const p = idx.pecas.get(id)!;
    const agora = tempo + (p.tempo_s ?? 0);
    if (p.tipo === 'fim') {
      if (!melhor || agora > melhor.tempo_s) melhor = { tempo_s: agora, pecas: [...caminho.map((n) => n.id), id] };
      return;
    }
    noCaminho.add(id);
    caminho.push({ id, tempo: agora, saida: 0 });
  };
  for (const i of inicios) {
    entrar(i, 0);
    while (caminho.length && buscas <= 50_000) {
      const topo = caminho[caminho.length - 1]!;
      const c = idx.saidas.get(topo.id)![topo.saida++];
      if (!c) { caminho.pop(); noCaminho.delete(topo.id); continue; }
      if (!noCaminho.has(c.para)) entrar(c.para, topo.tempo + (c.regra === 'tempo' ? (c.tempo_s ?? 0) : 0));
    }
    caminho.length = 0;
    noCaminho.clear();
  }
  return melhor;
}

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
    if (inicios.length > 0 && p.tipo !== 'inicio' && !alcancaveis.has(p.id)) achado('inalcancavel', 'alerta', p.id, `Ninguém chega em ${p.nome}`, `Nenhum Início leva até ${p.nome}.`, [p.id]);
    if (p.tipo === 'inicio' && !chegaNoFim.has(p.id)) achado('nao_termina', 'grave', p.id, `${p.nome} nunca chega num Fim`, `Nenhum caminho que começa em ${p.nome} termina num Fim.`, [p.id]);
    if (p.tipo === 'decisao' && saidas.length === 1) achado('decisao_sem_escolha', 'alerta', p.id, `${p.nome} tem um caminho só`, `É uma decisão, mas só tem uma saída: não há o que decidir.`, [p.id]);
    if (p.tipo === 'atendimento' && !p.responsavel) achado('sem_responsavel', 'observacao', p.id, `${p.nome}: quem atende?`, `O atendimento não diz quem atende (uma pessoa, fila ou equipe).`, [p.id]);
    if (p.responsavel && opcoes.cadastros && !opcoes.cadastros.some((k) => k.id === p.responsavel)) achado('responsavel_inexistente', 'alerta', p.id, `${p.nome} aponta pra um cadastro que não existe`, `O responsável de ${p.nome} foi apagado ou é de outra empresa.`, [p.id]);
    if (saidas.some((c) => c.regra === 'horario') && opcoes.cadastros) {
      const k = opcoes.cadastros.find((x) => x.id === p.responsavel);
      if (k?.tipo === 'horario' && !camposHorario(k)) achado('horario_invalido', 'alerta', p.id, `O horário ${k.nome} tem campos inválidos`, `${p.nome} decide pelo horário ${k.nome}, mas uma janela ou um feriado dele está errado: o relógio não tem como decidir.`, [p.id]);
      else if (!camposHorario(k)) achado('horario_sem_cadastro', 'alerta', p.id, `${p.nome} decide pelo horário, mas sem um Horário`, `As saídas de ${p.nome} são "dentro" e "fora do horário", mas a peça não usa um cadastro de Horário: o relógio não tem como decidir.`, [p.id]);
    }
    // Opções repetidas: mesma regra e mesmo valor saindo da mesma peça.
    const vistos = new Map<string, string>();
    for (const c of saidas) {
      if (!['opcao', 'condicao', 'horario'].includes(c.regra)) continue;
      const k = `${c.regra}:${((c.regra === 'horario' ? c.horario : c.valor) ?? '').toLowerCase()}`;
      if (k.endsWith(':')) continue;
      const outra = vistos.get(k);
      if (outra) achado('opcoes_repetidas', 'alerta', `${p.id}:${k}`, `${p.nome} tem duas saídas iguais`, `Duas saídas de ${p.nome} têm a mesma ${c.regra === 'opcao' ? 'opção' : 'condição'}: não dá pra saber qual seguir.`, [p.id, outra, c.id]);
      else vistos.set(k, c.id);
    }
  }

  for (const c of doc.conexoes) {
    if (!idx.pecas.has(c.de) || !idx.pecas.has(c.para)) continue;
    const vazia = (c.regra === 'opcao' && !c.valor && !c.rotulo) || (c.regra === 'condicao' && !c.valor) || (c.regra === 'tempo' && !c.tempo_s) || (c.regra === 'horario' && !c.horario);
    if (vazia) achado('regra_vazia', 'observacao', c.id, `Saída de ${nome(c.de)} sem regra preenchida`, `A ligação de ${nome(c.de)} pra ${nome(c.para)} tem a regra pela metade.`, [c.de, c.id]);
  }

  for (const comp of ciclos(idx)) {
    if (comp.some((id) => chegaNoFim.has(id))) continue;
    achado('ciclo_sem_saida', 'grave', comp.join('+'), `Ciclo sem saída: ${comp.map(nome).join(', ')}`, 'Essas peças levam umas às outras e nenhuma chega num Fim: a jornada fica rodando pra sempre.', comp);
  }

  if (opcoes.meta_s && opcoes.meta_s > 0) {
    const longo = caminhoMaisLongo(idx, inicios);
    if (longo && longo.tempo_s > opcoes.meta_s)
      achado('passou_do_prazo', 'alerta', 'fluxo', `O caminho mais longo passa da meta`, `Indo por ${longo.pecas.map(nome).join(' → ')}, o cliente leva ${formatarTempo(longo.tempo_s)}; a meta é ${formatarTempo(opcoes.meta_s)}.`, longo.pecas);
  }

  return out.sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade] || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));
}
