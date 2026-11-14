import { CANAIS_PADRAO, MODELOS, camposHorario, dentroDoHorario, lerQuando, type Cadastro, type Conexao, type Documento, type Modelo, type Peca } from '@journey/fluxo';
import type { Retrato } from '@/compartilhar/retrato';
import { ESTILO_PADRAO, type Estilo } from '@/editor/estilo';

/**
 * Os exemplos da landing: retratos (o mesmo tipo do link público) montados aqui, sem banco e sem chave secreta. Cada um
 * é uma cópia de um modelo com problemas postos de propósito, pra o diagnóstico ter o que mostrar. Este arquivo puxa o
 * @journey/fluxo: só o visualizador dos exemplos (carregado quando a seção chega perto da tela) importa ele.
 *
 * Os ciclos que o diagnóstico marca são os que andam sozinhos sem o tempo passar: o relógio decide e ninguém escolhe.
 * Por isso a volta que vira achado em cada exemplo passa pela decisão do horário, sem tempo nenhum na peça. As voltas com
 * escolha (Opção inválida → Menu, Não entendi → Qual assunto?, Pede documento → Análise) aparecem no play, mas não são
 * achado: a pessoa pode escolher outro caminho.
 */
export const CHAVES_EXEMPLO = ['ura', 'whatsapp', 'email', 'credito'] as const;
export type ChaveExemplo = (typeof CHAVES_EXEMPLO)[number];

/** O que muda num modelo: peças e ligações novas, ligações que trocam de destino, peças que perdem o tempo ou saem. */
interface Mudancas {
  pecas?: Peca[];
  conexoes?: Conexao[];
  destino?: Record<string, string>;
  semTempo?: string[];
  semPeca?: string[];
  cadastros?: Cadastro[];
}

function copiar(m: Modelo, x: Mudancas): { documento: Documento; cadastros: Cadastro[] } {
  const d = structuredClone(m.documento) as Documento;
  const sem = new Set(x.semPeca ?? []);
  d.pecas = d.pecas.filter((p) => !sem.has(p.id)).map((p) => (x.semTempo?.includes(p.id) ? (({ tempo_s: _, ...resto }) => resto)(p) : p));
  d.conexoes = d.conexoes.map((c) => ({ ...c, ...(x.destino?.[c.id] && { para: x.destino[c.id] }) })).filter((c) => !sem.has(c.de) && !sem.has(c.para));
  d.pecas.push(...(x.pecas ?? []));
  d.conexoes.push(...(x.conexoes ?? []));
  return { documento: d, cadastros: [...(structuredClone(m.cadastros) as Cadastro[]), ...(x.cadastros ?? [])] };
}

const HORARIO = MODELOS.find((m) => m.chave === 'ura')!.cadastros.find((k) => k.tipo === 'horario')!;

const MUDANCAS: Record<ChaveExemplo, Mudancas> = {
  // A opção 9 não leva a lugar nenhum; fora do horário, o aviso volta pro horário sem esperar (e de novo, e de novo).
  ura: {
    pecas: [{ id: 'transferindo', tipo: 'mensagem', nome: 'Transferindo…', x: 840, y: -300, tempo_s: 5 }],
    conexoes: [{ id: 'c13', de: 'menu', para: 'transferindo', regra: 'opcao', valor: '9', rotulo: 'Falar com atendente' }],
    destino: { c11: 'horario', c12: 'menu' },
    semTempo: ['fechado'],
  },
  // O bot que manda o cliente de volta pro começo: fora do horário, o aviso volta pras boas-vindas; e "Outro assunto"
  // diz que não entendeu e volta pro menu.
  whatsapp: {
    pecas: [{ id: 'nao-entendi', tipo: 'mensagem', nome: 'Não entendi', x: 1160, y: -260, tempo_s: 3 }],
    conexoes: [
      { id: 'c13', de: 'assunto', para: 'nao-entendi', regra: 'opcao', valor: '3', rotulo: 'Outro assunto' },
      { id: 'c14', de: 'nao-entendi', para: 'assunto', regra: 'sempre' },
    ],
    destino: { c12: 'boas-vindas' },
    semTempo: ['boas-vindas', 'fechado'],
    semPeca: ['encerra'],
  },
  // O modelo como é: a escalação de 48 h passa da meta de 24 h.
  email: {},
  // A análise manual só no expediente (e o pedido que chega fora espera sem tempo, voltando pro horário); o analista
  // pode pedir um documento, e o pedido volta pra análise.
  credito: {
    cadastros: [structuredClone(HORARIO) as Cadastro],
    pecas: [
      { id: 'expediente', tipo: 'decisao', nome: 'Dentro do expediente?', x: 450, y: 300, responsavel: HORARIO.id },
      { id: 'espera-expediente', tipo: 'espera', nome: 'Espera o expediente', x: 420, y: 520 },
      { id: 'documento', tipo: 'mensagem', nome: 'Cliente manda o documento', x: 990, y: 500, tempo_s: 3600 },
    ],
    conexoes: [
      { id: 'c12', de: 'analista', para: 'documento', regra: 'opcao', valor: 'D', rotulo: 'Pede documento' },
      { id: 'c13', de: 'documento', para: 'analise', regra: 'sempre' },
      { id: 'c14', de: 'expediente', para: 'analise', regra: 'horario', horario: 'dentro' },
      { id: 'c15', de: 'expediente', para: 'espera-expediente', regra: 'horario', horario: 'fora' },
      { id: 'c16', de: 'espera-expediente', para: 'expediente', regra: 'sempre' },
    ],
    destino: { c4: 'expediente' },
  },
};

const ESTILOS: Record<ChaveExemplo, Partial<Estilo>> = {
  ura: { cano: 'linha', curva: 'reta', espessura: 6 },
  whatsapp: {},
  email: { cano: 'cano', curva: 'cotovelo', espessura: 12 },
  credito: { cano: 'tracejado', curva: 'cotovelo', espessura: 8 },
};

const METAS: Record<ChaveExemplo, number | null> = { ura: null, whatsapp: 30 * 60, email: 24 * 3600, credito: 2 * 3600 };

function retrato(chave: ChaveExemplo): Retrato {
  const m = MODELOS.find((x) => x.chave === chave)!;
  const { documento, cadastros } = copiar(m, MUDANCAS[chave]);
  return {
    empresa: { nome: 'Exemplo' },
    fluxo: { nome: m.nome, canal: m.canal, descricao: m.descricao, meta_s: METAS[chave] },
    versao: null,
    de: '',
    esconderNomes: false,
    expiraEm: null,
    documento,
    estilo: { ...ESTILO_PADRAO, canais: {}, ...ESTILOS[chave] },
    cadastros,
    canais: CANAIS_PADRAO.map((c) => ({ ...c })),
    intencionais: [],
    cenario: null,
  };
}

export const EXEMPLOS: Record<ChaveExemplo, Retrato> = Object.fromEntries(CHAVES_EXEMPLO.map((k) => [k, retrato(k)])) as Record<ChaveExemplo, Retrato>;

/**
 * A hora em que o play dos exemplos começa: o dia de `agora` (AAAA-MM-DDTHH:MM) às 10h, ou o próximo dia que às 10h
 * está dentro do Horário comercial dos modelos (o mesmo relógio do motor: janelas e feriados). Assim quem abre de noite
 * ou no domingo vê o menu, e não o aviso de fechado. A pessoa muda a hora no cartão do play.
 */
export function quandoDoExemplo(agora: string): string {
  const h = camposHorario(HORARIO)!;
  let ms = lerQuando(`${agora.slice(0, 10)}T10:00`);
  // Duas semanas de folga: um horário sem dia nenhum às 10h fica no dia de hoje.
  for (let i = 0; i < 14 && !dentroDoHorario(h, ms); i++) ms += 86_400_000;
  return new Date(ms).toISOString().slice(0, 16);
}
