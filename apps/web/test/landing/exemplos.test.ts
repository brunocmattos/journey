import { describe, expect, it } from 'vitest';
import { diagnosticar, lerDocumento } from '@journey/fluxo';
import { lerEstilo } from '@/editor/estilo';
import { CHAVES_EXEMPLO, EXEMPLOS, quandoDoExemplo } from '@/landing/exemplos';

/**
 * O que o diagnóstico tem que achar em cada exemplo (spec, seção 6): o tipo e as peças. Os ciclos que o motor marca
 * são os que andam sozinhos sem o tempo passar (o relógio decide, ninguém escolhe): por isso a volta de cada exemplo que
 * vira achado passa pela decisão do horário. A volta com escolha (Opção inválida → Menu, Não entendi → Qual assunto?,
 * Pede documento → Análise) aparece no play, mas não é achado: a pessoa pode escolher outra coisa.
 */
const ESPERADO = {
  ura: [
    { tipo: 'beco_sem_saida', pecas: ['transferindo'] },
    { tipo: 'ciclo_sem_tempo', pecas: ['fechado', 'horario'] },
  ],
  whatsapp: [
    { tipo: 'ciclo_sem_tempo', pecas: ['boas-vindas', 'fechado', 'horario'] },
    { tipo: 'passou_do_prazo', pecas: ['inicio', 'boas-vindas', 'horario', 'assunto', 'suporte', 'aguardando', 'protocolo', 'inatividade'] },
  ],
  email: [{ tipo: 'passou_do_prazo', pecas: ['chega', 'automatica', 'triagem', 'aguardando', 'escala', 'encerrado'] }],
  credito: [
    { tipo: 'ciclo_sem_tempo', pecas: ['espera-expediente', 'expediente'] },
    { tipo: 'passou_do_prazo', pecas: ['pedido', 'score', 'faixa', 'expediente', 'analise', 'analista', 'aviso', 'liberado'] },
  ],
} as const;

const ESTILOS = {
  ura: { cano: 'linha', curva: 'reta', espessura: 6 },
  whatsapp: { cano: 'cano', curva: 'suave', espessura: 10 },
  email: { cano: 'cano', curva: 'cotovelo', espessura: 12 },
  credito: { cano: 'tracejado', curva: 'cotovelo', espessura: 8 },
} as const;

const METAS = { ura: null, whatsapp: 30 * 60, email: 24 * 3600, credito: 2 * 3600 };

describe('landing: os retratos de exemplo', () => {
  it('são os quatro, na ordem das abas', () => {
    expect(CHAVES_EXEMPLO).toEqual(['ura', 'whatsapp', 'email', 'credito']);
  });

  describe.each(CHAVES_EXEMPLO)('%s', (chave) => {
    const r = EXEMPLOS[chave];

    it('passa pela mesma validação do link (documento e estilo), sem problema nenhum', () => {
      const lido = lerDocumento(r.documento);
      expect(lido.problemas).toEqual([]);
      expect(lido.documento).toEqual(r.documento);
      expect(lerEstilo(r.estilo)).toEqual(r.estilo);
    });

    it('é um retrato de exemplo: empresa "Exemplo", sem versão, sem prazo, sem intencionais e sem cenário', () => {
      expect(r.empresa).toEqual({ nome: 'Exemplo' });
      expect(r).toMatchObject({ versao: null, esconderNomes: false, expiraEm: null, intencionais: [], cenario: null });
      expect(r.canais.map((c) => [c.chave, c.cor])).toEqual([
        ['telefonia', '#1e8bdc'],
        ['whatsapp', '#159e5a'],
        ['email', '#c98410'],
        ['chat', '#7650d6'],
        ['interno', '#3a6a88'],
      ]);
      expect(r.fluxo.meta_s).toBe(METAS[chave]);
    });

    it('tem o estilo da tabela', () => {
      expect(r.estilo).toMatchObject(ESTILOS[chave]);
    });

    it('o diagnóstico acha exatamente os achados da tabela', () => {
      const achados = diagnosticar(r.documento, { cadastros: r.cadastros, ...(r.fluxo.meta_s && { meta_s: r.fluxo.meta_s }) });
      const comoTabela = (pecas: readonly string[], tipo: string) => (tipo === 'passou_do_prazo' ? pecas : [...pecas].sort());
      expect(achados.map((a) => ({ tipo: a.tipo, pecas: comoTabela(a.refs, a.tipo) })).sort((a, b) => a.tipo.localeCompare(b.tipo))).toEqual(ESPERADO[chave]);
    });

    it('cada responsável é um dos cadastros do retrato', () => {
      const ids = new Set(r.cadastros.map((k) => k.id));
      for (const p of r.documento.pecas) if (p.responsavel) expect(ids).toContain(p.responsavel);
    });
  });

  it('não muda o modelo de onde saiu (os modelos são congelados e o exemplo é uma cópia)', async () => {
    const { MODELOS } = await import('@journey/fluxo');
    expect(MODELOS.find((m) => m.chave === 'ura')!.documento.pecas.some((p) => p.id === 'transferindo')).toBe(false);
  });
});

describe('landing: a hora do play dos exemplos', () => {
  // O play começa às 10h do primeiro dia dentro do Horário comercial dos modelos (seg a sex 8h–18h, sáb 9h–12h, Natal fechado).
  it.each([
    ['2026-11-16T22:40', '2026-11-16T10:00'], // segunda de noite: a mesma segunda, às 10h
    ['2026-11-14T21:00', '2026-11-14T10:00'], // sábado: abre às 10h
    ['2026-11-15T15:00', '2026-11-16T10:00'], // domingo: a segunda
    ['2026-12-25T10:00', '2026-12-26T10:00'], // Natal (feriado do horário): o sábado depois
    ['2026-12-31T08:00', '2026-12-31T10:00'],
  ])('de %s, %s', (agora, esperado) => {
    expect(quandoDoExemplo(agora)).toBe(esperado);
  });
});

describe('landing: o exemplo não divide nada com o modelo', () => {
  it('o Horário que a esteira ganha é uma cópia (o do modelo é congelado e fica igual)', async () => {
    const { MODELOS } = await import('@journey/fluxo');
    const doModelo = MODELOS.find((m) => m.chave === 'ura')!.cadastros.find((k) => k.tipo === 'horario')!;
    const daEsteira = EXEMPLOS.credito.cadastros.find((k) => k.tipo === 'horario')!;
    expect(daEsteira).toEqual(doModelo);
    expect(daEsteira).not.toBe(doModelo);
    expect(Object.isFrozen(daEsteira)).toBe(false);
  });
});
