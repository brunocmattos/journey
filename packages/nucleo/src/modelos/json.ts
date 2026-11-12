import { ABAS, type Coluna } from '../formato/abas';
import { lerCelula } from '../formato/celulas';
import { DIAS, NOMES_ABAS } from '../formato/documento';
import { TIPOS_REF } from '../formato/refs';

/** Os exemplos das abas no formato JSON, com valores tipados. */
export function gerarModeloJson(): Record<string, unknown> {
  const out: Record<string, unknown> = { formato: 'journey/1' };
  for (const aba of NOMES_ABAS) {
    out[aba] = ABAS[aba].exemplos.map((ex) => {
      const item: Record<string, unknown> = {};
      for (const c of ABAS[aba].colunas) {
        if (ex[c.nome] === undefined) continue;
        const r = lerCelula(c, ex[c.nome]);
        if (r?.ok) item[c.nome] = r.valor;
      }
      return item;
    });
  }
  return out;
}

const padraoRef = (tipos: readonly string[]) => `^(${tipos.join('|')}):[A-Za-z0-9][A-Za-z0-9._-]*$`;

function esquemaColuna(c: Coluna): Record<string, unknown> {
  const base = { description: c.descricao };
  switch (c.tipo) {
    case 'texto':
      return { ...base, type: 'string' };
    case 'inteiro':
      return { ...base, type: 'integer', minimum: 0 };
    case 'booleano':
      return { ...base, type: 'boolean' };
    case 'enum':
      return { ...base, type: 'string', enum: [...(c.valores ?? [])] };
    case 'ref':
      return { ...base, type: 'string', pattern: padraoRef(c.refs ?? TIPOS_REF) };
    case 'refs':
      return { ...base, type: 'array', items: { type: 'string', pattern: padraoRef(c.refs ?? TIPOS_REF) } };
    case 'hora':
      return { ...base, type: 'string', pattern: '^([01]\\d|2[0-4]):[0-5]\\d$' };
    case 'data':
      return { ...base, type: 'string', format: 'date' };
    case 'dias':
      return { ...base, type: 'array', minItems: 1, items: { type: 'string', enum: [...DIAS] } };
    case 'expressao':
      return { ...base, type: 'object', required: ['chave', 'valor'], additionalProperties: false, properties: { chave: { type: 'string' }, valor: { type: 'string' } } };
    case 'opcao':
      return { ...base, type: 'string', pattern: '^([0-9*#]|[a-z][a-z0-9_]*)$' };
  }
}

/** JSON Schema do formato journey/1, gerado das mesmas colunas que validam o import. */
export function gerarEsquemaJson(): Record<string, unknown> {
  const abas = Object.fromEntries(
    NOMES_ABAS.map((aba) => [
      aba,
      {
        description: ABAS[aba].descricao,
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ABAS[aba].colunas.filter((c) => c.obrigatoria && c.padrao === undefined).map((c) => c.nome),
          properties: Object.fromEntries(ABAS[aba].colunas.map((c) => [c.nome, esquemaColuna(c)])),
        },
      },
    ]),
  );
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Journey',
    type: 'object',
    required: ['formato'],
    additionalProperties: false,
    properties: { formato: { const: 'journey/1' }, ...abas },
  };
}
