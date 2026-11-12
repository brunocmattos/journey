# Etapa 1: núcleo do Journey — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans pra executar este plano tarefa por tarefa. Os passos usam caixas de seleção (`- [ ]`) pra acompanhar o progresso.

**Objetivo:** construir o núcleo sem tela do Journey (formato `journey/1`, importação de `.xlsx`/`.csv`/`.json`, modelos pra baixar, motor de simulação e diagnóstico) e provar com a central real de 11/11/2026 que o diagnóstico encontra sozinho os achados da seção 12.3 do spec.

**Arquitetura:** um pacote TypeScript (`@journey/nucleo`) num monorepo com workspaces do npm. As colunas de cada aba (`src/formato/abas.ts`) são a única definição do modelo: delas saem a leitura das células, a validação, a planilha modelo e o esquema JSON. Nada no pacote conhece React, Next.js ou Supabase; tudo recebe dados e devolve dados.

**Tecnologia:** Node 22, TypeScript 5.9, Vitest 3.2, ExcelJS 4.4, tsx.

**Spec:** `docs/superpowers/specs/2026-11-12-journey-design.md` (seções 6, 7, 8, 11, 12, 16, 17 e 19, etapa 1).

---

## Antes de começar

- Trabalhe em `/home/user/journey` (o repositório já existe, com o spec commitado). Todos os comandos rodam a partir dessa pasta.
- **Todo o código deste plano já foi escrito e testado num ensaio**: 142 testes passando, `tsc --noEmit` limpo. Copie os arquivos exatamente como estão. Se um teste falhar, investigue antes de mudar o teste.
- **Commits:** a tarefa 1 cria `.git/atribuicao.txt` com as linhas de atribuição. Todo commit usa `-m "$(cat .git/atribuicao.txt)"` como segundo parágrafo da mensagem.
- **Fixture já pronta:** os 8 arquivos de `packages/nucleo/test/fixtures/central/` já estão no repositório, sem nomes. Numa sessão sem o export, a tarefa 21 só cria `scripts/gerar-fixture.ts` e pula o passo 3 (gerar); os passos 1 e 4 continuam valendo (o conteúdo é idêntico).
- **Dados reais:** a tarefa 21 lê o export da central em `/tmp/claude-0/-home-user/0302ec4b-b3f8-5cbc-96d5-dba779a4b010/scratchpad/export`. Esse export tem nomes de pessoas; ele **não** entra no repositório. A fixture gerada troca os nomes por "Pessoa NNN" e não tem nenhum número de celular.
- Os testes rodam com `npm test -w packages/nucleo -- <arquivo>` (um arquivo) ou `npm test` (tudo).

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/nucleo/src/formato/refs.ts` | Referências `tipo:id`, ids válidos, referências embutidas |
| `packages/nucleo/src/formato/documento.ts` | Tipos das 8 abas e do documento `journey/1` |
| `packages/nucleo/src/formato/abas.ts` | Colunas de cada aba e exemplos: a definição única do modelo |
| `packages/nucleo/src/formato/celulas.ts` | Texto de célula ↔ valor tipado |
| `packages/nucleo/src/formato/indice.ts` | Índice por id, existência de referência, nomes legíveis |
| `packages/nucleo/src/formato/completude.ts` | Dados que faltam pra simular (menu sem tempo, fila sem toque…) |
| `packages/nucleo/src/util.ts` | Igualdade de valores |
| `packages/nucleo/src/importacao/problemas.ts` | Tipo `Problema` (erro/aviso com aba, linha, coluna) |
| `packages/nucleo/src/importacao/csv.ts` | Ler e escrever CSV |
| `packages/nucleo/src/importacao/ler-arquivos.ts` | `.xlsx`, `.csv`, `.json` → linhas brutas por aba |
| `packages/nucleo/src/importacao/analisar.ts` | Linhas brutas → documento tipado + problemas por célula |
| `packages/nucleo/src/importacao/validar.ts` | Regras que olham o documento inteiro |
| `packages/nucleo/src/importacao/juntar.ts` | Base anterior + import (completo ou parcial) e diferenças |
| `packages/nucleo/src/importacao/ajustes.ts` | Ajustes manuais por cima da base: conflitos, órfãos, redundantes |
| `packages/nucleo/src/importacao/importar.ts` | O fluxo inteiro do import |
| `packages/nucleo/src/modelos/json.ts`, `xlsx.ts` | Modelos pra baixar e esquema JSON |
| `packages/nucleo/src/motor/relogio.ts` | Hora de parede, janelas de horário, feriados |
| `packages/nucleo/src/motor/execucao.ts` | O motor de simulação |
| `packages/nucleo/src/diagnostico/*.ts` | Alcance, regras de peças, de transbordo e de horário, e `diagnosticar` |
| `packages/nucleo/src/index.ts` | O que o pacote exporta |
| `packages/nucleo/scripts/gerar-modelos.ts` | `npm run modelos` |
| `packages/nucleo/scripts/gerar-fixture.ts` | Gera a parte da fixture que vem das tabelas da central |
| `packages/nucleo/test/fixtures/central/*.csv` | A central de 11/11/2026, sem nomes |
| `packages/nucleo/test/aceitacao.test.ts` | Os achados da seção 12.3 e os cenários "E se…" |

---

### Tarefa 1: Estrutura do monorepo

Cria o monorepo com workspaces do npm e o pacote `@journey/nucleo`, com TypeScript estrito, Vitest e ExcelJS.

**Arquivos:**
- Criar: `package.json`, `.gitignore`
- Criar: `packages/nucleo/package.json`, `packages/nucleo/tsconfig.json`

- [ ] **Passo 1: Criar os arquivos da raiz**

Criar `package.json`:

```json
{
  "name": "journey",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "test": "npm test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  }
}
```

Criar `.gitignore`:

```
node_modules/
dist/
saida/
*.log
.DS_Store
```

- [ ] **Passo 2: Criar o pacote**

Criar `packages/nucleo/package.json`:

```json
{
  "name": "@journey/nucleo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "modelos": "tsx scripts/gerar-modelos.ts",
    "fixture": "tsx scripts/gerar-fixture.ts"
  },
  "dependencies": {
    "exceljs": "4.4.0"
  },
  "devDependencies": {
    "@types/node": "22.20.5",
    "tsx": "^4.19.0",
    "typescript": "5.9.3",
    "vitest": "3.2.7"
  }
}
```

Criar `packages/nucleo/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "test", "scripts"]
}
```

- [ ] **Passo 3: Instalar as dependências**

Rodar: `npm install`

Esperado: cria `node_modules/` e `package-lock.json`, sem erro.

Rodar: `npx vitest --version`

Esperado: `vitest/3.2.7`.

- [ ] **Passo 4: Guardar as linhas de atribuição dos commits**

```bash
printf 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_016wAgjUn6kRoxnxJVdHBQcx\n' > .git/atribuicao.txt
```

- [ ] **Passo 5: Commit**

```bash
git add package.json .gitignore package-lock.json packages/nucleo/package.json packages/nucleo/tsconfig.json
git commit -m "chore: monorepo com o pacote @journey/nucleo" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 2: Referências

Toda ligação entre coisas do Journey é uma referência `tipo:id` (`fila:90011`, `peca:fase-16`). Algumas existem sem linha em nenhuma aba (`fim:desliga`, `externo:celular`).

**Arquivos:**
- Criar: `packages/nucleo/src/formato/refs.ts`
- Teste: `packages/nucleo/test/formato/refs.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/formato/refs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ehEmbutida, lerRef, montarRef } from '../../src/formato/refs';

describe('refs', () => {
  it('lê tipo e id', () => {
    expect(lerRef('fila:90011')).toEqual({ tipo: 'fila', id: '90011' });
  });
  it('aceita ponto, hífen e sublinhado no id', () => {
    expect(lerRef('peca:fase-16_a.b')?.id).toBe('fase-16_a.b');
  });
  it('recusa tipo desconhecido, falta de dois-pontos e id com espaço', () => {
    expect(lerRef('telefone:123')).toBeNull();
    expect(lerRef('90011')).toBeNull();
    expect(lerRef('fila:900 11')).toBeNull();
  });
  it('monta a referência', () => {
    expect(montarRef('ramal', '9019')).toBe('ramal:9019');
  });
  it('conhece as referências embutidas', () => {
    expect(ehEmbutida('fim:desliga')).toBe(true);
    expect(ehEmbutida('externo:celular')).toBe(true);
    expect(ehEmbutida('fim:outro')).toBe(false);
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/formato/refs.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/formato/refs.ts`:

```ts
export const TIPOS_REF = ['entrada', 'horario', 'ramal', 'fila', 'grupo', 'peca', 'saida', 'fim', 'externo'] as const;
export type TipoRef = (typeof TIPOS_REF)[number];

/** Referências que existem sem precisar de linha em nenhuma aba. */
export const REFS_EMBUTIDAS = ['fim:desliga', 'fim:atendido', 'fim:caixa_postal', 'externo:celular'] as const;

/** Formato de um id: começa com letra ou número; depois letras, números, ponto, hífen ou sublinhado. */
export const PADRAO_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface RefLida {
  tipo: TipoRef;
  id: string;
}

export function lerRef(texto: string): RefLida | null {
  const m = /^([a-z]+):(.+)$/.exec(texto.trim());
  if (!m) return null;
  const tipo = m[1] as TipoRef;
  const id = m[2] as string;
  if (!(TIPOS_REF as readonly string[]).includes(tipo) || !PADRAO_ID.test(id)) return null;
  return { tipo, id };
}

export function montarRef(tipo: TipoRef, id: string): string {
  return `${tipo}:${id}`;
}

export function ehEmbutida(ref: string): boolean {
  return (REFS_EMBUTIDAS as readonly string[]).includes(ref);
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/formato/refs.test.ts`

Esperado: PASSA, 5 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/formato/refs.ts packages/nucleo/test/formato/refs.test.ts
git commit -m "feat(nucleo): referências tipo:id" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 3: Documento e abas

Define os tipos das 8 abas e, em `abas.ts`, as colunas de cada uma com tipo, obrigatoriedade, valores aceitos, descrição e exemplos. É a definição única do modelo. Os exemplos de todas as abas formam um fluxo pequeno e coerente, que vira o conteúdo dos modelos pra baixar.

**Arquivos:**
- Criar: `packages/nucleo/src/formato/documento.ts`
- Criar: `packages/nucleo/src/formato/abas.ts`
- Teste: `packages/nucleo/test/formato/abas.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/formato/abas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ABAS } from '../../src/formato/abas';
import { NOMES_ABAS } from '../../src/formato/documento';

describe('abas', () => {
  it('tem uma definição por aba, na ordem', () => {
    expect(Object.keys(ABAS)).toEqual([...NOMES_ABAS]);
  });

  it.each(NOMES_ABAS)('%s começa com id obrigatório e não repete coluna', (aba) => {
    const colunas = ABAS[aba].colunas;
    expect(colunas[0]).toMatchObject({ nome: 'id', obrigatoria: true });
    expect(new Set(colunas.map((c) => c.nome)).size).toBe(colunas.length);
  });

  it.each(NOMES_ABAS)('%s tem exemplos só com colunas conhecidas', (aba) => {
    const nomes = new Set(ABAS[aba].colunas.map((c) => c.nome));
    expect(ABAS[aba].exemplos.length).toBeGreaterThan(0);
    for (const ex of ABAS[aba].exemplos) for (const k of Object.keys(ex)) expect(nomes.has(k), `${aba}.${k}`).toBe(true);
  });

  it('listas e referências declaram os valores aceitos', () => {
    for (const aba of NOMES_ABAS) {
      for (const c of ABAS[aba].colunas) {
        if (c.tipo === 'enum') expect(c.valores?.length, `${aba}.${c.nome}`).toBeGreaterThan(0);
        if (c.tipo === 'ref' || c.tipo === 'refs') expect(c.refs?.length, `${aba}.${c.nome}`).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/formato/abas.test.ts`

Esperado: FALHA. `src/formato/abas.ts` ainda não existe.

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/formato/documento.ts`:

```ts
export const NOMES_ABAS = ['entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos', 'pecas', 'saidas'] as const;
export type NomeAba = (typeof NOMES_ABAS)[number];

export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
export type Dia = (typeof DIAS)[number];

export const CANAIS = ['telefonia', 'whatsapp', 'email', 'ocorrencia'] as const;
export type Canal = (typeof CANAIS)[number];

export const TIPOS_PECA = ['audio', 'menu', 'regra_horario', 'regra_feriado', 'consulta', 'transferencia', 'atalho', 'pesquisa', 'fim'] as const;
export type TipoPeca = (typeof TIPOS_PECA)[number];

export const TIPOS_RAMAL = ['pessoa', 'webphone', 'setor'] as const;
export const ESTRATEGIAS_FILA = ['ringall', 'rrmemory', 'linear', 'leastrecent', 'fewestcalls', 'random', 'wrandom'] as const;
export const ESTRATEGIAS_GRUPO = ['ringall', 'hunt', 'memoryhunt', 'firstavailable', 'random'] as const;

export interface Expressao {
  chave: string;
  valor: string;
}

export interface Entrada {
  id: string;
  numero: string;
  nome?: string;
  canal: Canal;
  destino: string;
  ativo: boolean;
  observacao?: string;
}

export interface Horario {
  id: string;
  grupo: string;
  nome?: string;
  dias: Dia[];
  inicio: string;
  fim: string;
  observacao?: string;
}

export interface Feriado {
  id: string;
  calendario: string;
  data: string;
  nome?: string;
  todo_ano: boolean;
  observacao?: string;
}

export interface Ramal {
  id: string;
  nome?: string;
  tipo?: (typeof TIPOS_RAMAL)[number];
  toque_s?: number;
  siga_me_so_ramal_s?: number;
  siga_me_com_lista_s?: number;
  siga_me_lista?: string[];
  ao_nao_atender?: string;
  ao_ocupado?: string;
  ao_indisponivel?: string;
  transbordo_anti_loop: boolean;
  observacao?: string;
}

export interface Fila {
  id: string;
  nome?: string;
  estrategia: string;
  toque_por_membro_s?: number;
  espera_maxima_s?: number;
  ao_esgotar?: string;
  membros?: string[];
  membros_dinamicos: boolean;
  pesquisa_ao_desligar?: string;
  observacao?: string;
}

export interface Grupo {
  id: string;
  nome?: string;
  estrategia: string;
  toque_s?: number;
  ao_esgotar?: string;
  membros?: string[];
  observacao?: string;
}

export interface Peca {
  id: string;
  tipo: TipoPeca;
  nome?: string;
  horario?: string;
  calendario?: string;
  espera_s?: number;
  tentativas?: number;
  texto?: string;
  duracao_s?: number;
  guarda_variavel?: string;
  canal?: Canal;
  id_central?: string;
  ativo: boolean;
  observacao?: string;
}

export interface Saida {
  id: string;
  de: string;
  opcao: string;
  rotulo?: string;
  quando?: Expressao;
  define?: Expressao;
  para: string;
  ativo: boolean;
  observacao?: string;
}

export interface Documento {
  formato: 'journey/1';
  entradas: Entrada[];
  horarios: Horario[];
  feriados: Feriado[];
  ramais: Ramal[];
  filas: Fila[];
  grupos: Grupo[];
  pecas: Peca[];
  saidas: Saida[];
}

export function documentoVazio(): Documento {
  return { formato: 'journey/1', entradas: [], horarios: [], feriados: [], ramais: [], filas: [], grupos: [], pecas: [], saidas: [] };
}

/** Acesso genérico às abas, para código que trata todas do mesmo jeito. */
export type LinhaGenerica = { id: string } & Record<string, unknown>;
export function tabelasDe(doc: Documento): Record<NomeAba, LinhaGenerica[]> {
  return doc as unknown as Record<NomeAba, LinhaGenerica[]>;
}
```

Criar `packages/nucleo/src/formato/abas.ts`:

```ts
import { CANAIS, ESTRATEGIAS_FILA, ESTRATEGIAS_GRUPO, TIPOS_PECA, TIPOS_RAMAL, type NomeAba } from './documento';
import type { TipoRef } from './refs';

export type TipoColuna = 'texto' | 'inteiro' | 'booleano' | 'enum' | 'ref' | 'refs' | 'hora' | 'data' | 'dias' | 'expressao' | 'opcao';

export interface Coluna {
  nome: string;
  tipo: TipoColuna;
  obrigatoria?: boolean;
  /** Valor usado quando a célula vem vazia. */
  padrao?: string;
  /** Valores permitidos (tipo enum). */
  valores?: readonly string[];
  /** Tipos de referência aceitos (tipos ref e refs). */
  refs?: readonly TipoRef[];
  descricao: string;
}

export interface Aba {
  nome: NomeAba;
  descricao: string;
  colunas: Coluna[];
  /** Linhas de exemplo, como texto de célula. Os exemplos de todas as abas formam um fluxo coerente. */
  exemplos: Record<string, string>[];
}

const ID: Coluna = { nome: 'id', tipo: 'texto', obrigatoria: true, descricao: 'Identificador estável. Use o mesmo da central, pra os ajustes sobreviverem ao próximo import.' };
const ATIVO: Coluna = { nome: 'ativo', tipo: 'booleano', padrao: 'sim', descricao: 'Use "nao" pra itens marcados como inativos na central.' };
const OBS: Coluna = { nome: 'observacao', tipo: 'texto', descricao: 'Nota livre.' };
const DESTINOS: readonly TipoRef[] = ['peca', 'fila', 'grupo', 'ramal', 'fim', 'externo'];
const MEMBROS: readonly TipoRef[] = ['ramal', 'externo'];

export const ABAS: Record<NomeAba, Aba> = {
  entradas: {
    nome: 'entradas',
    descricao: 'Números que recebem ligação e pra onde cada um vai.',
    colunas: [
      ID,
      { nome: 'numero', tipo: 'texto', obrigatoria: true, descricao: 'Número completo, só dígitos.' },
      { nome: 'nome', tipo: 'texto', descricao: 'Nome pra mostrar no mapa.' },
      { nome: 'canal', tipo: 'enum', valores: CANAIS, padrao: 'telefonia', descricao: 'Canal da entrada.' },
      { nome: 'destino', tipo: 'ref', refs: DESTINOS, obrigatoria: true, descricao: 'Primeiro passo da ligação. Ex.: peca:feriado, ramal:2001.' },
      ATIVO,
      OBS,
    ],
    exemplos: [{ id: 'did-5130000001', numero: '5130000001', nome: 'Comercial', canal: 'telefonia', destino: 'peca:feriado' }],
  },
  horarios: {
    nome: 'horarios',
    descricao: 'Janelas de horário. Várias linhas com o mesmo grupo formam um grupo de horário.',
    colunas: [
      ID,
      { nome: 'grupo', tipo: 'texto', obrigatoria: true, descricao: 'Grupo de horário ao qual a janela pertence. É o que as peças usam: horario:<grupo>.' },
      { nome: 'nome', tipo: 'texto', descricao: 'Nome do grupo de horário.' },
      { nome: 'dias', tipo: 'dias', obrigatoria: true, descricao: 'Dias da semana: dom seg ter qua qui sex sab, ou faixa como seg-sex.' },
      { nome: 'inicio', tipo: 'hora', obrigatoria: true, descricao: 'Hora de início, HH:MM.' },
      { nome: 'fim', tipo: 'hora', obrigatoria: true, descricao: 'Hora de fim, HH:MM (não incluída).' },
      OBS,
    ],
    exemplos: [
      { id: 'atendimento-semana', grupo: 'atendimento', nome: 'Atendimento', dias: 'seg-sex', inicio: '08:30', fim: '18:00' },
      { id: 'atendimento-sabado', grupo: 'atendimento', nome: 'Atendimento', dias: 'sab', inicio: '09:00', fim: '12:00' },
    ],
  },
  feriados: {
    nome: 'feriados',
    descricao: 'Datas de feriado, agrupadas em calendários.',
    colunas: [
      ID,
      { nome: 'calendario', tipo: 'texto', obrigatoria: true, descricao: 'Nome do calendário. É o que as regras de feriado usam.' },
      { nome: 'data', tipo: 'data', obrigatoria: true, descricao: 'Data, AAAA-MM-DD.' },
      { nome: 'nome', tipo: 'texto', descricao: 'Nome do feriado.' },
      { nome: 'todo_ano', tipo: 'booleano', padrao: 'nao', descricao: 'Use "sim" se o feriado cai no mesmo dia todo ano.' },
      OBS,
    ],
    exemplos: [{ id: 'nacional-natal', calendario: 'nacional', data: '2026-12-25', nome: 'Natal', todo_ano: 'sim' }],
  },
  ramais: {
    nome: 'ramais',
    descricao: 'Ramais, quanto tempo tocam e pra onde vão se ninguém atende.',
    colunas: [
      ID,
      { nome: 'nome', tipo: 'texto', descricao: 'Nome de quem usa o ramal.' },
      { nome: 'tipo', tipo: 'enum', valores: TIPOS_RAMAL, descricao: 'pessoa, webphone ou setor.' },
      { nome: 'toque_s', tipo: 'inteiro', descricao: 'Segundos que o ramal toca antes de transbordar.' },
      { nome: 'siga_me_so_ramal_s', tipo: 'inteiro', descricao: 'Siga-me: segundos que toca só o ramal.' },
      { nome: 'siga_me_com_lista_s', tipo: 'inteiro', descricao: 'Siga-me: segundos que toca o ramal junto com a lista.' },
      { nome: 'siga_me_lista', tipo: 'refs', refs: MEMBROS, descricao: 'Siga-me: quem toca junto. Ex.: ramal:2001 externo:celular.' },
      { nome: 'ao_nao_atender', tipo: 'ref', refs: DESTINOS, descricao: 'Pra onde vai se ninguém atende.' },
      { nome: 'ao_ocupado', tipo: 'ref', refs: DESTINOS, descricao: 'Pra onde vai se o ramal está ocupado.' },
      { nome: 'ao_indisponivel', tipo: 'ref', refs: DESTINOS, descricao: 'Pra onde vai se o ramal está desconectado.' },
      { nome: 'transbordo_anti_loop', tipo: 'booleano', padrao: 'nao', descricao: 'Use "sim" se o transbordo não volta pra fila quando a ligação veio dela.' },
      OBS,
    ],
    exemplos: [
      { id: '2001', nome: 'Ana', tipo: 'pessoa', toque_s: '20', ao_nao_atender: 'fila:100' },
      { id: '2002', nome: 'Beto', tipo: 'pessoa', toque_s: '27', siga_me_so_ramal_s: '7', siga_me_com_lista_s: '20', siga_me_lista: 'ramal:2001', ao_nao_atender: 'fim:caixa_postal' },
    ],
  },
  filas: {
    nome: 'filas',
    descricao: 'Filas de atendimento.',
    colunas: [
      ID,
      { nome: 'nome', tipo: 'texto', descricao: 'Nome da fila.' },
      { nome: 'estrategia', tipo: 'enum', valores: ESTRATEGIAS_FILA, obrigatoria: true, descricao: 'Como a fila escolhe quem toca.' },
      { nome: 'toque_por_membro_s', tipo: 'inteiro', descricao: 'Segundos que cada membro toca antes de passar pro próximo.' },
      { nome: 'espera_maxima_s', tipo: 'inteiro', descricao: 'Tempo máximo de espera. Vazio = sem limite.' },
      { nome: 'ao_esgotar', tipo: 'ref', refs: DESTINOS, descricao: 'Pra onde vai quando a espera máxima acaba.' },
      { nome: 'membros', tipo: 'refs', refs: MEMBROS, descricao: 'Membros fixos. Ex.: ramal:2001 ramal:2002.' },
      { nome: 'membros_dinamicos', tipo: 'booleano', padrao: 'nao', descricao: 'Use "sim" se atendentes entram e saem da fila sozinhos.' },
      { nome: 'pesquisa_ao_desligar', tipo: 'ref', refs: ['peca'], descricao: 'Peça de pesquisa que roda quando o atendente desliga.' },
      OBS,
    ],
    exemplos: [{ id: '100', nome: 'Atendimento', estrategia: 'rrmemory', toque_por_membro_s: '15', espera_maxima_s: '180', ao_esgotar: 'grupo:200', membros: 'ramal:2001 ramal:2002' }],
  },
  grupos: {
    nome: 'grupos',
    descricao: 'Grupos de toque.',
    colunas: [
      ID,
      { nome: 'nome', tipo: 'texto', descricao: 'Nome do grupo.' },
      { nome: 'estrategia', tipo: 'enum', valores: ESTRATEGIAS_GRUPO, obrigatoria: true, descricao: 'Como o grupo toca.' },
      { nome: 'toque_s', tipo: 'inteiro', descricao: 'Segundos que o grupo toca.' },
      { nome: 'ao_esgotar', tipo: 'ref', refs: DESTINOS, descricao: 'Pra onde vai se ninguém atende.' },
      { nome: 'membros', tipo: 'refs', refs: MEMBROS, descricao: 'Membros do grupo.' },
      OBS,
    ],
    exemplos: [{ id: '200', nome: 'Plantão', estrategia: 'ringall', toque_s: '20', ao_esgotar: 'fim:caixa_postal', membros: 'ramal:2001 ramal:2002' }],
  },
  pecas: {
    nome: 'pecas',
    descricao: 'Os passos do fluxo.',
    colunas: [
      ID,
      { nome: 'tipo', tipo: 'enum', valores: TIPOS_PECA, obrigatoria: true, descricao: 'Tipo da peça.' },
      { nome: 'nome', tipo: 'texto', descricao: 'Nome pra mostrar no mapa.' },
      { nome: 'horario', tipo: 'ref', refs: ['horario'], descricao: 'Regra de horário: o grupo de horário. Ex.: horario:atendimento.' },
      { nome: 'calendario', tipo: 'texto', descricao: 'Regra de feriado: o calendário. Ex.: nacional.' },
      { nome: 'espera_s', tipo: 'inteiro', descricao: 'Menu: segundos que espera a tecla.' },
      { nome: 'tentativas', tipo: 'inteiro', descricao: 'Menu: quantas vezes repete antes de esgotar.' },
      { nome: 'texto', tipo: 'texto', descricao: 'O que o áudio fala.' },
      { nome: 'duracao_s', tipo: 'inteiro', descricao: 'Duração do áudio em segundos.' },
      { nome: 'guarda_variavel', tipo: 'texto', descricao: 'Menu: nome da variável que a escolha guarda.' },
      { nome: 'canal', tipo: 'enum', valores: CANAIS, descricao: 'Canal em que a jornada segue a partir desta peça.' },
      { nome: 'id_central', tipo: 'texto', descricao: 'Identificador original na central, pra conferência.' },
      ATIVO,
      OBS,
    ],
    exemplos: [
      { id: 'feriado', tipo: 'regra_feriado', nome: 'Feriado?', calendario: 'nacional' },
      { id: 'horario', tipo: 'regra_horario', nome: 'Dentro do horário?', horario: 'horario:atendimento' },
      { id: 'menu-principal', tipo: 'menu', nome: 'Menu principal', espera_s: '5', tentativas: '3', texto: 'Digite 1 para atendimento ou 2 para falar com a Ana.' },
      { id: 'fora-do-horario', tipo: 'audio', nome: 'Fora do horário', texto: 'Nosso horário é de segunda a sexta, das 8h30 às 18h.', duracao_s: '9' },
      { id: 'encerra', tipo: 'fim', nome: 'Encerra' },
    ],
  },
  saidas: {
    nome: 'saidas',
    descricao: 'Os canos: de qual peça, por qual opção e pra onde.',
    colunas: [
      ID,
      { nome: 'de', tipo: 'ref', refs: ['peca'], obrigatoria: true, descricao: 'Peça de onde a saída parte.' },
      { nome: 'opcao', tipo: 'opcao', obrigatoria: true, descricao: 'Tecla (0-9, *, #) ou resultado: esgotou, sim, nao, ok, sempre…' },
      { nome: 'rotulo', tipo: 'texto', descricao: 'Nome da opção. Ex.: Boleto.' },
      { nome: 'quando', tipo: 'expressao', descricao: 'Só vale se a variável tiver esse valor. Ex.: tipo=aluguel.' },
      { nome: 'define', tipo: 'expressao', descricao: 'Guarda um valor numa variável ao passar. Ex.: tipo=aluguel.' },
      { nome: 'para', tipo: 'ref', refs: DESTINOS, obrigatoria: true, descricao: 'Pra onde a saída leva.' },
      ATIVO,
      OBS,
    ],
    exemplos: [
      { id: 'feriado-sim', de: 'peca:feriado', opcao: 'sim', para: 'peca:fora-do-horario' },
      { id: 'feriado-nao', de: 'peca:feriado', opcao: 'nao', para: 'peca:horario' },
      { id: 'horario-sim', de: 'peca:horario', opcao: 'sim', para: 'peca:menu-principal' },
      { id: 'horario-nao', de: 'peca:horario', opcao: 'nao', para: 'peca:fora-do-horario' },
      { id: 'menu-1', de: 'peca:menu-principal', opcao: '1', rotulo: 'Atendimento', para: 'fila:100' },
      { id: 'menu-2', de: 'peca:menu-principal', opcao: '2', rotulo: 'Falar com a Ana', para: 'ramal:2001' },
      { id: 'menu-esgotou', de: 'peca:menu-principal', opcao: 'esgotou', para: 'peca:encerra' },
      { id: 'fora-sempre', de: 'peca:fora-do-horario', opcao: 'sempre', para: 'peca:encerra' },
    ],
  },
};
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/formato/abas.test.ts`

Esperado: PASSA, 18 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/formato/documento.ts packages/nucleo/src/formato/abas.ts packages/nucleo/test/formato/abas.test.ts
git commit -m "feat(nucleo): abas e colunas do formato journey/1" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 4: Leitura de células

Converte o texto de uma célula no valor tipado da coluna (inteiro, sim/não, lista, referência, hora, data, dias, `chave=valor`, opção) e de volta. Mensagens de erro dizem o que é aceito.

**Arquivos:**
- Criar: `packages/nucleo/src/formato/celulas.ts`
- Teste: `packages/nucleo/test/formato/celulas.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/formato/celulas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ABAS, type Coluna } from '../../src/formato/abas';
import { lerCelula, paraCelula } from '../../src/formato/celulas';
import { NOMES_ABAS } from '../../src/formato/documento';

const col = (c: Partial<Coluna> & Pick<Coluna, 'tipo'>): Coluna => ({ nome: 'x', descricao: '', ...c });

describe('lerCelula', () => {
  it('vazio sem padrão devolve null; com padrão usa o padrão', () => {
    expect(lerCelula(col({ tipo: 'texto' }), '  ')).toBeNull();
    expect(lerCelula(col({ tipo: 'booleano', padrao: 'sim' }), '')).toEqual({ ok: true, valor: true });
  });
  it('inteiro', () => {
    expect(lerCelula(col({ tipo: 'inteiro' }), '20')).toEqual({ ok: true, valor: 20 });
    expect(lerCelula(col({ tipo: 'inteiro' }), '2,5')).toMatchObject({ ok: false });
  });
  it('booleano aceita sim, não, s e n', () => {
    expect(lerCelula(col({ tipo: 'booleano' }), 'Não')).toEqual({ ok: true, valor: false });
    expect(lerCelula(col({ tipo: 'booleano' }), 'S')).toEqual({ ok: true, valor: true });
    expect(lerCelula(col({ tipo: 'booleano' }), 'talvez')).toMatchObject({ ok: false });
  });
  it('lista ignora maiúsculas e mostra os valores aceitos no erro', () => {
    const c = col({ tipo: 'enum', valores: ['telefonia', 'email'] });
    expect(lerCelula(c, 'EMAIL')).toEqual({ ok: true, valor: 'email' });
    expect(lerCelula(c, 'fax')).toMatchObject({ ok: false, erro: expect.stringContaining('telefonia, email') });
  });
  it('referência confere o tipo permitido', () => {
    const c = col({ tipo: 'ref', refs: ['fila', 'ramal'] });
    expect(lerCelula(c, ' fila:90011 ')).toEqual({ ok: true, valor: 'fila:90011' });
    expect(lerCelula(c, 'peca:x')).toMatchObject({ ok: false, erro: expect.stringContaining('fila, ramal') });
    expect(lerCelula(c, '90011')).toMatchObject({ ok: false, erro: expect.stringContaining('tipo:id') });
  });
  it('várias referências separadas por espaço ou vírgula', () => {
    expect(lerCelula(col({ tipo: 'refs', refs: ['ramal'] }), 'ramal:1 ramal:2,ramal:3')).toEqual({ ok: true, valor: ['ramal:1', 'ramal:2', 'ramal:3'] });
  });
  it('hora completa o zero e aceita 24:00', () => {
    expect(lerCelula(col({ tipo: 'hora' }), '8:30')).toEqual({ ok: true, valor: '08:30' });
    expect(lerCelula(col({ tipo: 'hora' }), '24:00')).toEqual({ ok: true, valor: '24:00' });
    expect(lerCelula(col({ tipo: 'hora' }), '25:00')).toMatchObject({ ok: false });
  });
  it('data confere o calendário', () => {
    expect(lerCelula(col({ tipo: 'data' }), '2026-11-20')).toEqual({ ok: true, valor: '2026-11-20' });
    expect(lerCelula(col({ tipo: 'data' }), '2026-02-30')).toMatchObject({ ok: false });
  });
  it('dias aceita lista, nome por extenso e faixa', () => {
    expect(lerCelula(col({ tipo: 'dias' }), 'seg-sex')).toEqual({ ok: true, valor: ['seg', 'ter', 'qua', 'qui', 'sex'] });
    expect(lerCelula(col({ tipo: 'dias' }), 'Sábado, domingo')).toEqual({ ok: true, valor: ['dom', 'sab'] });
    expect(lerCelula(col({ tipo: 'dias' }), 'feriado')).toMatchObject({ ok: false });
  });
  it('expressão chave=valor', () => {
    expect(lerCelula(col({ tipo: 'expressao' }), 'Tipo = aluguel')).toEqual({ ok: true, valor: { chave: 'tipo', valor: 'aluguel' } });
    expect(lerCelula(col({ tipo: 'expressao' }), 'aluguel')).toMatchObject({ ok: false });
  });
  it('opção aceita tecla e palavra', () => {
    expect(lerCelula(col({ tipo: 'opcao' }), '#')).toEqual({ ok: true, valor: '#' });
    expect(lerCelula(col({ tipo: 'opcao' }), 'Não')).toEqual({ ok: true, valor: 'nao' });
    expect(lerCelula(col({ tipo: 'opcao' }), 'tecla 1')).toMatchObject({ ok: false });
  });
  it.each(NOMES_ABAS)('os exemplos de %s são válidos', (aba) => {
    for (const ex of ABAS[aba].exemplos) {
      for (const c of ABAS[aba].colunas) {
        const r = lerCelula(c, ex[c.nome]);
        if (r) expect(r, `${aba}.${c.nome}`).toMatchObject({ ok: true });
      }
    }
  });
});

describe('paraCelula', () => {
  it('converte valores tipados de volta pra texto', () => {
    expect(paraCelula(true)).toBe('sim');
    expect(paraCelula(['ramal:1', 'ramal:2'])).toBe('ramal:1 ramal:2');
    expect(paraCelula({ chave: 'tipo', valor: 'aluguel' })).toBe('tipo=aluguel');
    expect(paraCelula(20)).toBe('20');
    expect(paraCelula(undefined)).toBe('');
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/formato/celulas.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/formato/celulas.ts`:

```ts
import type { Coluna } from './abas';
import { DIAS, type Dia, type Expressao } from './documento';
import { TIPOS_REF, lerRef, montarRef } from './refs';

export type ResultadoCelula = { ok: true; valor: unknown } | { ok: false; erro: string };

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Converte o texto de uma célula no valor tipado da coluna.
 * Devolve null quando a célula está vazia e a coluna não tem valor padrão.
 */
export function lerCelula(coluna: Coluna, bruto: string | undefined): ResultadoCelula | null {
  let texto = (bruto ?? '').trim();
  if (texto === '') {
    if (coluna.padrao === undefined) return null;
    texto = coluna.padrao;
  }
  switch (coluna.tipo) {
    case 'texto':
      return { ok: true, valor: texto };
    case 'inteiro':
      return /^\d+$/.test(texto) ? { ok: true, valor: Number(texto) } : { ok: false, erro: `"${texto}" não é um número inteiro` };
    case 'booleano': {
      const v = semAcento(texto.toLowerCase());
      if (['sim', 's', 'true', '1'].includes(v)) return { ok: true, valor: true };
      if (['nao', 'n', 'false', '0'].includes(v)) return { ok: true, valor: false };
      return { ok: false, erro: `"${texto}" não é sim nem não` };
    }
    case 'enum': {
      const v = semAcento(texto.toLowerCase());
      const valores = coluna.valores ?? [];
      return valores.includes(v) ? { ok: true, valor: v } : { ok: false, erro: `"${texto}" não é permitido. Use: ${valores.join(', ')}` };
    }
    case 'ref':
      return lerUmaRef(coluna, texto);
    case 'refs': {
      const lista: string[] = [];
      for (const parte of texto.split(/[\s,]+/).filter(Boolean)) {
        const r = lerUmaRef(coluna, parte);
        if (!r.ok) return r;
        lista.push(r.valor as string);
      }
      return { ok: true, valor: lista };
    }
    case 'hora': {
      const m = /^(\d{1,2}):(\d{2})$/.exec(texto);
      if (!m) return { ok: false, erro: `"${texto}" não é uma hora no formato HH:MM` };
      const h = Number(m[1]);
      const min = Number(m[2]);
      if (h > 24 || min > 59 || (h === 24 && min > 0)) return { ok: false, erro: `"${texto}" não é uma hora válida` };
      return { ok: true, valor: `${String(h).padStart(2, '0')}:${m[2]}` };
    }
    case 'data': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
      if (m) {
        const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
        if (d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])) return { ok: true, valor: texto };
      }
      return { ok: false, erro: `"${texto}" não é uma data no formato AAAA-MM-DD` };
    }
    case 'dias':
      return lerDias(texto);
    case 'expressao': {
      const m = /^([a-z_][a-z0-9_]*)\s*=\s*(.+)$/i.exec(texto);
      if (!m) return { ok: false, erro: `"${texto}" não está no formato chave=valor` };
      const valor: Expressao = { chave: (m[1] as string).toLowerCase(), valor: (m[2] as string).trim() };
      return { ok: true, valor };
    }
    case 'opcao': {
      const v = semAcento(texto.toLowerCase());
      return /^([0-9*#]|[a-z][a-z0-9_]*)$/.test(v)
        ? { ok: true, valor: v }
        : { ok: false, erro: `"${texto}" não é uma opção válida. Use um dígito, * ou #, ou uma palavra como esgotou, sim, nao` };
    }
  }
}

function lerUmaRef(coluna: Coluna, texto: string): ResultadoCelula {
  const r = lerRef(texto);
  if (!r) return { ok: false, erro: `"${texto}" não é uma referência. Escreva tipo:id, por exemplo fila:90011` };
  const permitidos = coluna.refs ?? TIPOS_REF;
  if (!permitidos.includes(r.tipo)) return { ok: false, erro: `"${texto}" não pode ser usado aqui. Tipos aceitos: ${permitidos.join(', ')}` };
  return { ok: true, valor: montarRef(r.tipo, r.id) };
}

function lerDias(texto: string): ResultadoCelula {
  const dias = new Set<Dia>();
  for (const parte of semAcento(texto.toLowerCase()).split(/[\s,]+/).filter(Boolean)) {
    const faixa = /^([a-z]{3})-([a-z]{3})$/.exec(parte);
    if (faixa) {
      const a = DIAS.indexOf(faixa[1] as Dia);
      const b = DIAS.indexOf(faixa[2] as Dia);
      if (a < 0 || b < 0 || b < a) return { ok: false, erro: `"${parte}" não é uma faixa de dias válida, por exemplo seg-sex` };
      for (let i = a; i <= b; i++) dias.add(DIAS[i] as Dia);
    } else {
      const d = parte.slice(0, 3) as Dia;
      if (!DIAS.includes(d)) return { ok: false, erro: `"${parte}" não é um dia. Use dom, seg, ter, qua, qui, sex, sab` };
      dias.add(d);
    }
  }
  if (dias.size === 0) return { ok: false, erro: 'nenhum dia informado' };
  return { ok: true, valor: DIAS.filter((d) => dias.has(d)) };
}

/** Converte um valor tipado de volta para o texto de uma célula. */
export function paraCelula(valor: unknown): string {
  if (valor === undefined || valor === null) return '';
  if (typeof valor === 'boolean') return valor ? 'sim' : 'nao';
  if (Array.isArray(valor)) return valor.map(String).join(' ');
  if (typeof valor === 'object') {
    const e = valor as Partial<Expressao>;
    return e.chave !== undefined ? `${e.chave}=${e.valor ?? ''}` : JSON.stringify(valor);
  }
  return String(valor);
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/formato/celulas.test.ts`

Esperado: PASSA, 20 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/formato/celulas.ts packages/nucleo/test/formato/celulas.test.ts
git commit -m "feat(nucleo): leitura de células" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 5: Índice e completude

O índice dá acesso por id a tudo do documento e responde se uma referência existe. A completude lista dados que faltam pra simular (menu sem tempo ou sem saída "esgotou", fila sem toque). O arquivo `test/apoio.ts` monta documentos pequenos pros testes de todas as tarefas seguintes.

**Arquivos:**
- Criar: `packages/nucleo/src/formato/indice.ts`
- Criar: `packages/nucleo/src/formato/completude.ts`
- Teste: `packages/nucleo/test/apoio.ts`
- Teste: `packages/nucleo/test/formato/indice.test.ts`

- [ ] **Passo 1: Criar o apoio dos testes**

Criar `packages/nucleo/test/apoio.ts`:

```ts
import { documentoVazio, type Documento, type Entrada, type Fila, type Grupo, type Horario, type Peca, type Ramal, type Saida, type TipoPeca } from '../src/formato/documento';

/** Documento com só as abas informadas. */
export const doc = (abas: Partial<Omit<Documento, 'formato'>>): Documento => ({ ...documentoVazio(), ...abas });

export const entrada = (id: string, destino: string, extra: Partial<Entrada> = {}): Entrada => ({ id, numero: id, canal: 'telefonia', destino, ativo: true, ...extra });

export const peca = (id: string, tipo: TipoPeca, extra: Partial<Peca> = {}): Peca => ({ id, tipo, ativo: true, ...extra });

/** Saída da peça `de` (id sem "peca:"). O id é "<de>-<opcao>", mais "-<valor>" quando há condição. */
export const saida = (de: string, opcao: string, para: string, extra: Partial<Saida> = {}): Saida => ({
  id: `${de}-${opcao}${extra.quando ? `-${extra.quando.valor}` : ''}`,
  de: `peca:${de}`,
  opcao,
  para,
  ativo: true,
  ...extra,
});

export const ramal = (id: string, extra: Partial<Ramal> = {}): Ramal => ({ id, transbordo_anti_loop: false, ...extra });

export const fila = (id: string, extra: Partial<Fila> = {}): Fila => ({ id, estrategia: 'rrmemory', toque_por_membro_s: 15, membros_dinamicos: false, ...extra });

export const grupo = (id: string, extra: Partial<Grupo> = {}): Grupo => ({ id, estrategia: 'ringall', toque_s: 20, ...extra });

export const janela = (grupo: string, dias: Horario['dias'], inicio: string, fim: string): Horario => ({ id: `${grupo}-${dias.join('')}-${inicio}`, grupo, dias, inicio, fim });
```

- [ ] **Passo 2: Escrever o teste que falha**

Criar `packages/nucleo/test/formato/indice.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { completude } from '../../src/formato/completude';
import { existe, indexar, nomeDe } from '../../src/formato/indice';
import { doc, fila, janela, peca, saida } from '../apoio';

describe('indexar', () => {
  const idx = indexar(
    doc({
      pecas: [peca('menu', 'menu', { nome: 'Menu' }), peca('fim', 'fim')],
      saidas: [saida('menu', '1', 'peca:fim'), saida('menu', 'esgotou', 'fim:desliga')],
      filas: [fila('100', { nome: 'Atendimento' })],
      horarios: [janela('h', ['seg'], '08:00', '12:00'), janela('h', ['ter'], '08:00', '12:00')],
    }),
  );

  it('agrupa as saídas por peça, na ordem do arquivo', () => {
    expect(idx.saidasDe.get('menu')!.map((s) => s.opcao)).toEqual(['1', 'esgotou']);
  });
  it('agrupa as janelas pelo grupo de horário', () => {
    expect(idx.janelas.get('h')).toHaveLength(2);
  });
  it('existe confere cada tipo e as embutidas', () => {
    expect(existe(idx, 'peca:menu')).toBe(true);
    expect(existe(idx, 'peca:nada')).toBe(false);
    expect(existe(idx, 'horario:h')).toBe(true);
    expect(existe(idx, 'fim:desliga')).toBe(true);
    expect(existe(idx, 'fim:outro')).toBe(false);
    expect(existe(idx, 'lixo')).toBe(false);
  });
  it('dá nomes legíveis', () => {
    expect(nomeDe(idx, 'peca:menu')).toBe('Menu');
    expect(nomeDe(idx, 'fila:100')).toBe('fila 100 (Atendimento)');
    expect(nomeDe(idx, 'ramal:1')).toBe('ramal 1');
    expect(nomeDe(idx, 'fim:desliga')).toBe('desligar');
  });
});

describe('completude', () => {
  it('aponta menu sem tempo, menu sem esgotou e fila sem toque', () => {
    const idx = indexar(
      doc({
        pecas: [peca('m', 'menu'), peca('ok', 'menu', { espera_s: 5, tentativas: 2 })],
        saidas: [saida('ok', 'esgotou', 'fim:desliga')],
        filas: [fila('1', { toque_por_membro_s: undefined })],
      }),
    );
    expect(completude(idx).map((p) => `${p.regra}:${p.ref}`)).toEqual(['menu_sem_tempo:peca:m', 'menu_sem_esgotou:peca:m', 'fila_sem_toque:fila:1']);
  });
});
```

- [ ] **Passo 3: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/formato/indice.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 4: Implementar**

Criar `packages/nucleo/src/formato/indice.ts`:

```ts
import type { Documento, Entrada, Feriado, Fila, Grupo, Horario, Peca, Ramal, Saida } from './documento';
import { ehEmbutida, lerRef } from './refs';

export interface Indice {
  doc: Documento;
  entradas: Map<string, Entrada>;
  /** Janelas de horário por grupo. */
  janelas: Map<string, Horario[]>;
  /** Feriados por calendário. */
  feriados: Map<string, Feriado[]>;
  ramais: Map<string, Ramal>;
  filas: Map<string, Fila>;
  grupos: Map<string, Grupo>;
  pecas: Map<string, Peca>;
  saidas: Map<string, Saida>;
  /** Saídas por id da peça de origem, na ordem do arquivo. */
  saidasDe: Map<string, Saida[]>;
}

function agrupar<T>(itens: T[], chave: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of itens) {
    const k = chave(item);
    const lista = m.get(k);
    if (lista) lista.push(item);
    else m.set(k, [item]);
  }
  return m;
}

const porId = <T extends { id: string }>(itens: T[]) => new Map(itens.map((i) => [i.id, i] as const));

export function indexar(doc: Documento): Indice {
  const saidasDe = new Map<string, Saida[]>();
  for (const s of doc.saidas) {
    const r = lerRef(s.de);
    if (!r) continue;
    const lista = saidasDe.get(r.id);
    if (lista) lista.push(s);
    else saidasDe.set(r.id, [s]);
  }
  return {
    doc,
    entradas: porId(doc.entradas),
    janelas: agrupar(doc.horarios, (h) => h.grupo),
    feriados: agrupar(doc.feriados, (f) => f.calendario),
    ramais: porId(doc.ramais),
    filas: porId(doc.filas),
    grupos: porId(doc.grupos),
    pecas: porId(doc.pecas),
    saidas: porId(doc.saidas),
    saidasDe,
  };
}

export function existe(idx: Indice, ref: string): boolean {
  if (ehEmbutida(ref)) return true;
  const r = lerRef(ref);
  if (!r) return false;
  switch (r.tipo) {
    case 'entrada':
      return idx.entradas.has(r.id);
    case 'horario':
      return idx.janelas.has(r.id);
    case 'ramal':
      return idx.ramais.has(r.id);
    case 'fila':
      return idx.filas.has(r.id);
    case 'grupo':
      return idx.grupos.has(r.id);
    case 'peca':
      return idx.pecas.has(r.id);
    case 'saida':
      return idx.saidas.has(r.id);
    default:
      return false;
  }
}

const NOMES_EMBUTIDOS: Record<string, string> = {
  'fim:desliga': 'desligar',
  'fim:atendido': 'atendido',
  'fim:caixa_postal': 'caixa postal',
  'externo:celular': 'celular externo',
};

/** Nome legível de uma referência, pra mensagens. */
export function nomeDe(idx: Indice, ref: string): string {
  const embutido = NOMES_EMBUTIDOS[ref];
  if (embutido) return embutido;
  const r = lerRef(ref);
  if (!r) return ref;
  const comNome = (rotulo: string, nome?: string) => (nome ? `${rotulo} (${nome})` : rotulo);
  switch (r.tipo) {
    case 'peca':
      return idx.pecas.get(r.id)?.nome ?? ref;
    case 'fila':
      return comNome(`fila ${r.id}`, idx.filas.get(r.id)?.nome);
    case 'grupo':
      return comNome(`grupo ${r.id}`, idx.grupos.get(r.id)?.nome);
    case 'ramal':
      return comNome(`ramal ${r.id}`, idx.ramais.get(r.id)?.nome);
    case 'entrada': {
      const e = idx.entradas.get(r.id);
      return e?.nome ?? e?.numero ?? ref;
    }
    default:
      return ref;
  }
}
```

Criar `packages/nucleo/src/formato/completude.ts`:

```ts
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
```

- [ ] **Passo 5: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/formato/indice.test.ts`

Esperado: PASSA, 5 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 6: Commit**

```bash
git add packages/nucleo/src/formato/indice.ts packages/nucleo/src/formato/completude.ts packages/nucleo/test/apoio.ts packages/nucleo/test/formato/indice.test.ts
git commit -m "feat(nucleo): índice e completude" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 6: CSV

Lê CSV com aspas e quebras de linha dentro do campo, detectando `;` ou `,` pelo cabeçalho, e escreve CSV com `;`.

**Arquivos:**
- Criar: `packages/nucleo/src/importacao/csv.ts`
- Teste: `packages/nucleo/test/importacao/csv.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/importacao/csv.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { escreverCsv, lerCsv } from '../../src/importacao/csv';

describe('csv', () => {
  it('usa ponto e vírgula quando o cabeçalho tem', () => {
    expect(lerCsv('a;b\n1;2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('usa vírgula quando o cabeçalho não tem ponto e vírgula', () => {
    expect(lerCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('respeita aspas, aspas duplas e quebra de linha dentro do campo', () => {
    expect(lerCsv('a;b\n"x;y";"diz ""oi""\nok"\n')).toEqual([
      ['a', 'b'],
      ['x;y', 'diz "oi"\nok'],
    ]);
  });
  it('tira a marca BOM', () => {
    expect(lerCsv('﻿id;nome\n1;A')[0]).toEqual(['id', 'nome']);
  });
  it('escreve e lê de volta', () => {
    const m = [
      ['id', 'texto'],
      ['1', 'a;b "c"'],
    ];
    expect(lerCsv(escreverCsv(m))).toEqual(m);
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/importacao/csv.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/importacao/csv.ts`:

```ts
/**
 * Lê CSV com aspas. O separador é ";" quando a primeira linha tem ";", senão ",".
 * Devolve uma matriz de células de texto, sem a marca BOM.
 */
export function lerCsv(texto: string): string[][] {
  const conteudo = texto.replace(/^﻿/, '');
  const primeira = conteudo.split(/\r?\n/, 1)[0] ?? '';
  const sep = primeira.includes(';') ? ';' : ',';
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < conteudo.length; i++) {
    const c = conteudo[i];
    if (aspas) {
      if (c === '"') {
        if (conteudo[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && conteudo[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

/** Escreve CSV com ";", pondo aspas só onde precisa. */
export function escreverCsv(linhas: string[][]): string {
  const celula = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return linhas.map((l) => l.map(celula).join(';')).join('\n') + '\n';
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/importacao/csv.test.ts`

Esperado: PASSA, 5 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/importacao/csv.ts packages/nucleo/test/importacao/csv.test.ts
git commit -m "feat(nucleo): leitura e escrita de CSV" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 7: Leitura dos arquivos

Transforma `.xlsx` (uma planilha por aba, ignorando as outras), `.csv` (um arquivo por aba, pelo nome) e `.json` (formato `journey/1`) em linhas brutas por aba, com o número da linha de origem.

**Arquivos:**
- Criar: `packages/nucleo/src/importacao/problemas.ts`
- Criar: `packages/nucleo/src/importacao/ler-arquivos.ts`
- Teste: `packages/nucleo/test/importacao/ler-arquivos.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/importacao/ler-arquivos.test.ts`:

```ts
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { lerArquivos } from '../../src/importacao/ler-arquivos';

describe('lerArquivos', () => {
  it('lê csv pelo nome do arquivo e pula linhas vazias', async () => {
    const r = await lerArquivos([{ nome: 'filas.csv', conteudo: 'id;estrategia\n100;rrmemory\n\n;\n' }]);
    expect(r.problemas).toEqual([]);
    expect(r.tabelas.filas).toEqual([{ linha: 2, valores: { id: '100', estrategia: 'rrmemory' } }]);
  });

  it('recusa csv cujo nome não é uma aba', async () => {
    const r = await lerArquivos([{ nome: 'clientes.csv', conteudo: 'id\n1' }]);
    expect(r.problemas).toEqual([expect.objectContaining({ gravidade: 'erro', mensagem: expect.stringContaining('filas.csv') })]);
  });

  it('recusa extensão desconhecida', async () => {
    const r = await lerArquivos([{ nome: 'fluxo.pdf', conteudo: '' }]);
    expect(r.problemas[0]?.mensagem).toContain('.xlsx, .csv ou .json');
  });

  it('lê json do formato journey/1 convertendo os valores pra texto', async () => {
    const json = JSON.stringify({ formato: 'journey/1', ramais: [{ id: '2001', toque_s: 20, siga_me_lista: ['ramal:1', 'ramal:2'], transbordo_anti_loop: false }] });
    const r = await lerArquivos([{ nome: 'dados.json', conteudo: json }]);
    expect(r.problemas).toEqual([]);
    expect(r.tabelas.ramais).toEqual([{ linha: 1, valores: { id: '2001', toque_s: '20', siga_me_lista: 'ramal:1 ramal:2', transbordo_anti_loop: 'nao' } }]);
  });

  it('recusa json sem "formato": "journey/1" e json quebrado', async () => {
    const r = await lerArquivos([
      { nome: 'a.json', conteudo: '{"filas":[]}' },
      { nome: 'b.json', conteudo: '{' },
    ]);
    expect(r.problemas.map((p) => p.mensagem)).toEqual([expect.stringContaining('journey/1'), expect.stringContaining('não é um JSON válido')]);
  });

  it('lê xlsx com uma planilha por aba e ignora as outras', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('leia-me').addRow(['qualquer coisa']);
    const ws = wb.addWorksheet('Horarios');
    ws.addRow(['id', 'grupo', 'dias', 'inicio', 'fim']);
    ws.addRow(['h1', 'atendimento', 'seg-sex', '08:30', '18:00']);
    ws.getCell('A4').value = 'h2';
    ws.getCell('B4').value = 'atendimento';
    ws.getCell('C4').value = 'sab';
    ws.getCell('D4').value = new Date(Date.UTC(1899, 11, 30, 9, 0));
    ws.getCell('E4').value = '12:00';
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer());

    const r = await lerArquivos([{ nome: 'modelo.xlsx', conteudo: bytes }]);
    expect(r.problemas).toEqual([]);
    expect(Object.keys(r.tabelas)).toEqual(['horarios']);
    expect(r.tabelas.horarios).toEqual([
      { linha: 2, valores: { id: 'h1', grupo: 'atendimento', dias: 'seg-sex', inicio: '08:30', fim: '18:00' } },
      { linha: 4, valores: { id: 'h2', grupo: 'atendimento', dias: 'sab', inicio: '09:00', fim: '12:00' } },
    ]);
  });

  it('acusa a mesma aba em dois arquivos', async () => {
    const r = await lerArquivos([
      { nome: 'filas.csv', conteudo: 'id\n1' },
      { nome: 'FILAS.csv', conteudo: 'id\n2' },
    ]);
    expect(r.problemas[0]?.mensagem).toContain('mais de um arquivo');
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/importacao/ler-arquivos.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/importacao/problemas.ts`:

```ts
import type { NomeAba } from '../formato/documento';

export interface Problema {
  /** Erro bloqueia o import. Aviso não bloqueia. */
  gravidade: 'erro' | 'aviso';
  aba?: NomeAba;
  linha?: number;
  coluna?: string;
  mensagem: string;
}

/** "saidas, linha 14, coluna para: …" */
export function descrever(p: Problema): string {
  const onde = [p.aba, p.linha !== undefined ? `linha ${p.linha}` : undefined, p.coluna ? `coluna ${p.coluna}` : undefined].filter(Boolean).join(', ');
  return onde ? `${onde}: ${p.mensagem}` : p.mensagem;
}
```

Criar `packages/nucleo/src/importacao/ler-arquivos.ts`:

```ts
import ExcelJS from 'exceljs';
import { paraCelula } from '../formato/celulas';
import { NOMES_ABAS, type NomeAba } from '../formato/documento';
import { lerCsv } from './csv';
import type { Problema } from './problemas';

export interface ArquivoEntrada {
  nome: string;
  conteudo: Uint8Array | string;
}

export interface LinhaBruta {
  /** Número da linha no arquivo (cabeçalho = 1). No JSON, a posição do item (primeiro = 1). */
  linha: number;
  valores: Record<string, string>;
}

export type Tabelas = Partial<Record<NomeAba, LinhaBruta[]>>;

const ehAba = (nome: string): nome is NomeAba => (NOMES_ABAS as readonly string[]).includes(nome);
const paraTexto = (c: Uint8Array | string) => (typeof c === 'string' ? c : new TextDecoder('utf-8').decode(c));
const paraBytes = (c: Uint8Array | string) => (typeof c === 'string' ? new TextEncoder().encode(c) : c);

/** Matriz [cabeçalho, ...linhas] → linhas brutas. Pula linhas totalmente vazias. */
export function linhasDeMatriz(matriz: string[][]): LinhaBruta[] {
  const cabecalho = (matriz[0] ?? []).map((c) => c.trim().toLowerCase());
  const out: LinhaBruta[] = [];
  for (let i = 1; i < matriz.length; i++) {
    const celulas = matriz[i] ?? [];
    if (celulas.every((c) => c.trim() === '')) continue;
    const valores: Record<string, string> = {};
    cabecalho.forEach((nome, j) => {
      if (nome) valores[nome] = celulas[j] ?? '';
    });
    out.push({ linha: i + 1, valores });
  }
  return out;
}

function textoDaCelula(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    const iso = valor.toISOString();
    return valor.getUTCFullYear() <= 1900 ? iso.slice(11, 16) : iso.slice(0, 10);
  }
  if (typeof valor === 'boolean') return valor ? 'sim' : 'nao';
  if (typeof valor === 'object') {
    if ('richText' in valor) return valor.richText.map((p) => p.text).join('');
    if ('result' in valor) return textoDaCelula(valor.result as ExcelJS.CellValue);
    if ('text' in valor) return String(valor.text);
    return '';
  }
  return String(valor);
}

async function lerXlsx(bytes: Uint8Array): Promise<[NomeAba, LinhaBruta[]][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const out: [NomeAba, LinhaBruta[]][] = [];
  wb.eachSheet((ws) => {
    const aba = ws.name.trim().toLowerCase();
    if (!ehAba(aba)) return;
    const matriz: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const celulas: string[] = [];
      for (let j = 1; j <= row.cellCount; j++) celulas.push(textoDaCelula(row.getCell(j).value));
      matriz[n - 1] = celulas;
    });
    out.push([aba, linhasDeMatriz(Array.from({ length: matriz.length }, (_, i) => matriz[i] ?? []))]);
  });
  return out;
}

function lerJson(arquivo: ArquivoEntrada, problemas: Problema[]): [NomeAba, LinhaBruta[]][] {
  let dados: unknown;
  try {
    dados = JSON.parse(paraTexto(arquivo.conteudo));
  } catch (e) {
    problemas.push({ gravidade: 'erro', mensagem: `o arquivo ${arquivo.nome} não é um JSON válido: ${(e as Error).message}` });
    return [];
  }
  const obj = dados as Record<string, unknown> | null;
  if (!obj || obj.formato !== 'journey/1') {
    problemas.push({ gravidade: 'erro', mensagem: `o arquivo ${arquivo.nome} não está no formato journey/1 (falta "formato": "journey/1")` });
    return [];
  }
  const out: [NomeAba, LinhaBruta[]][] = [];
  for (const aba of NOMES_ABAS) {
    const lista = obj[aba];
    if (lista === undefined) continue;
    if (!Array.isArray(lista)) {
      problemas.push({ gravidade: 'erro', aba, mensagem: `"${aba}" precisa ser uma lista` });
      continue;
    }
    out.push([
      aba,
      lista.map((item, i) => ({
        linha: i + 1,
        valores: Object.fromEntries(Object.entries((item ?? {}) as Record<string, unknown>).map(([k, v]) => [k.toLowerCase(), paraCelula(v)])),
      })),
    ]);
  }
  return out;
}

/** Lê .xlsx (uma aba por planilha), .csv (um arquivo por aba) e .json (formato journey/1). */
export async function lerArquivos(arquivos: ArquivoEntrada[]): Promise<{ tabelas: Tabelas; problemas: Problema[] }> {
  const tabelas: Tabelas = {};
  const problemas: Problema[] = [];
  const guardar = (aba: NomeAba, linhas: LinhaBruta[], origem: string) => {
    if (tabelas[aba]) {
      problemas.push({ gravidade: 'erro', aba, mensagem: `a aba ${aba} veio em mais de um arquivo (de novo em ${origem})` });
      return;
    }
    tabelas[aba] = linhas;
  };
  for (const arquivo of arquivos) {
    const partes = arquivo.nome.split(/[\\/]/).pop()!.split('.');
    const ext = partes.length > 1 ? partes.pop()!.toLowerCase() : '';
    const base = partes.join('.').trim().toLowerCase();
    if (ext === 'xlsx') {
      for (const [aba, linhas] of await lerXlsx(paraBytes(arquivo.conteudo))) guardar(aba, linhas, arquivo.nome);
    } else if (ext === 'csv') {
      if (!ehAba(base)) {
        problemas.push({ gravidade: 'erro', mensagem: `o arquivo ${arquivo.nome} não corresponde a nenhuma aba. Use um destes nomes: ${NOMES_ABAS.map((a) => `${a}.csv`).join(', ')}` });
        continue;
      }
      guardar(base, linhasDeMatriz(lerCsv(paraTexto(arquivo.conteudo))), arquivo.nome);
    } else if (ext === 'json') {
      for (const [aba, linhas] of lerJson(arquivo, problemas)) guardar(aba, linhas, arquivo.nome);
    } else {
      problemas.push({ gravidade: 'erro', mensagem: `o arquivo ${arquivo.nome} está num formato não aceito. Use .xlsx, .csv ou .json` });
    }
  }
  return { tabelas, problemas };
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/importacao/ler-arquivos.test.ts`

Esperado: PASSA, 7 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/importacao/problemas.ts packages/nucleo/src/importacao/ler-arquivos.ts packages/nucleo/test/importacao/ler-arquivos.test.ts
git commit -m "feat(nucleo): leitura de xlsx, csv e json" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 8: Análise das linhas

Converte as linhas brutas em itens tipados, coluna por coluna, acusando com aba, linha e coluna: obrigatório vazio, coluna obrigatória ausente, coluna desconhecida, valor inválido, id repetido ou inválido.

**Arquivos:**
- Criar: `packages/nucleo/src/importacao/analisar.ts`
- Teste: `packages/nucleo/test/importacao/analisar.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/importacao/analisar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { NomeAba } from '../../src/formato/documento';
import { analisar } from '../../src/importacao/analisar';
import type { Tabelas } from '../../src/importacao/ler-arquivos';

/** Linhas brutas de uma aba, começando na linha 2 (a 1 é o cabeçalho). */
const tab = (aba: NomeAba, ...linhas: Record<string, string>[]): Tabelas => ({ [aba]: linhas.map((valores, i) => ({ linha: i + 2, valores })) });

describe('analisar', () => {
  it('converte os valores, aplica padrões e guarda a linha de origem', () => {
    const a = analisar(tab('saidas', { id: 's1', de: 'peca:menu', opcao: '1', para: 'fila:100', quando: 'tipo=aluguel' }));
    expect(a.problemas).toEqual([]);
    expect(a.documento.saidas).toEqual([{ id: 's1', de: 'peca:menu', opcao: '1', quando: { chave: 'tipo', valor: 'aluguel' }, para: 'fila:100', ativo: true }]);
    expect(a.presentes).toEqual(['saidas']);
    expect(a.linhas.get('saidas/s1')).toBe(2);
  });

  it('acusa campo obrigatório vazio com linha e coluna', () => {
    const a = analisar(tab('filas', { id: '100', estrategia: '' }));
    expect(a.problemas).toEqual([{ gravidade: 'erro', aba: 'filas', linha: 2, coluna: 'estrategia', mensagem: 'campo obrigatório vazio' }]);
  });

  it('acusa coluna obrigatória ausente uma vez só', () => {
    const a = analisar(tab('filas', { id: '1' }, { id: '2' }));
    expect(a.problemas.filter((p) => p.coluna === 'estrategia')).toEqual([{ gravidade: 'erro', aba: 'filas', coluna: 'estrategia', mensagem: 'falta a coluna obrigatória "estrategia"' }]);
  });

  it('avisa coluna desconhecida', () => {
    const a = analisar(tab('filas', { id: '1', estrategia: 'ringall', cor: 'azul' }));
    expect(a.problemas).toEqual([expect.objectContaining({ gravidade: 'aviso', coluna: 'cor' })]);
  });

  it('acusa id repetido apontando a primeira linha', () => {
    const a = analisar(tab('filas', { id: '1', estrategia: 'ringall' }, { id: '1', estrategia: 'linear' }));
    expect(a.problemas[0]?.mensagem).toBe('o id "1" se repete (já usado na linha 2)');
    expect(a.documento.filas).toHaveLength(1);
  });

  it('acusa id com caractere inválido', () => {
    const a = analisar(tab('filas', { id: 'fila 1', estrategia: 'ringall' }));
    expect(a.problemas[0]).toMatchObject({ gravidade: 'erro', coluna: 'id' });
  });

  it('acusa valor inválido e continua lendo o resto', () => {
    const a = analisar(tab('ramais', { id: '1', toque_s: 'vinte' }, { id: '2', toque_s: '20' }));
    expect(a.problemas).toEqual([expect.objectContaining({ linha: 2, coluna: 'toque_s' })]);
    expect(a.documento.ramais.map((r) => r.id)).toEqual(['1', '2']);
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/importacao/analisar.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/importacao/analisar.ts`:

```ts
import { ABAS } from '../formato/abas';
import { lerCelula } from '../formato/celulas';
import { NOMES_ABAS, documentoVazio, tabelasDe, type Documento, type LinhaGenerica, type NomeAba } from '../formato/documento';
import { PADRAO_ID } from '../formato/refs';
import type { Tabelas } from './ler-arquivos';
import type { Problema } from './problemas';

export interface Analise {
  documento: Documento;
  problemas: Problema[];
  /** Abas que vieram nos arquivos. */
  presentes: NomeAba[];
  /** Linha de origem de cada item, por "aba/id". */
  linhas: Map<string, number>;
}

/** Converte as linhas brutas em itens tipados, coluna por coluna. */
export function analisar(tabelas: Tabelas): Analise {
  const documento = documentoVazio();
  const destino = tabelasDe(documento);
  const problemas: Problema[] = [];
  const presentes: NomeAba[] = [];
  const linhas = new Map<string, number>();

  for (const aba of NOMES_ABAS) {
    const brutas = tabelas[aba];
    if (!brutas) continue;
    presentes.push(aba);
    const spec = ABAS[aba];
    const conhecidas = new Set(spec.colunas.map((c) => c.nome));
    const cabecalho = new Set(brutas.flatMap((l) => Object.keys(l.valores)));

    for (const nome of cabecalho) {
      if (!conhecidas.has(nome)) problemas.push({ gravidade: 'aviso', aba, coluna: nome, mensagem: `a coluna "${nome}" não existe nesta aba e foi ignorada` });
    }
    const faltando = new Set<string>();
    for (const c of spec.colunas) {
      if (c.obrigatoria && brutas.length > 0 && !cabecalho.has(c.nome)) {
        faltando.add(c.nome);
        problemas.push({ gravidade: 'erro', aba, coluna: c.nome, mensagem: `falta a coluna obrigatória "${c.nome}"` });
      }
    }

    const vistos = new Map<string, number>();
    for (const bruta of brutas) {
      const item: Record<string, unknown> = {};
      for (const c of spec.colunas) {
        if (faltando.has(c.nome)) continue;
        const r = lerCelula(c, bruta.valores[c.nome]);
        if (r === null) {
          if (c.obrigatoria) problemas.push({ gravidade: 'erro', aba, linha: bruta.linha, coluna: c.nome, mensagem: 'campo obrigatório vazio' });
          continue;
        }
        if (!r.ok) {
          problemas.push({ gravidade: 'erro', aba, linha: bruta.linha, coluna: c.nome, mensagem: r.erro });
          continue;
        }
        item[c.nome] = r.valor;
      }
      const id = item.id as string | undefined;
      if (id === undefined) continue;
      if (!PADRAO_ID.test(id)) {
        problemas.push({ gravidade: 'erro', aba, linha: bruta.linha, coluna: 'id', mensagem: `o id "${id}" tem caracteres inválidos. Use letras, números, ponto, hífen ou sublinhado` });
        continue;
      }
      const anterior = vistos.get(id);
      if (anterior !== undefined) {
        problemas.push({ gravidade: 'erro', aba, linha: bruta.linha, coluna: 'id', mensagem: `o id "${id}" se repete (já usado na linha ${anterior})` });
        continue;
      }
      vistos.set(id, bruta.linha);
      linhas.set(`${aba}/${id}`, bruta.linha);
      destino[aba].push(item as LinhaGenerica);
    }
  }
  return { documento, problemas, presentes, linhas };
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/importacao/analisar.test.ts`

Esperado: PASSA, 7 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/importacao/analisar.ts packages/nucleo/test/importacao/analisar.test.ts
git commit -m "feat(nucleo): análise das linhas importadas" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 9: Validação do documento

Regras que olham o documento inteiro. Referência que não existe é **aviso**, não erro: dado real tem isso, e o diagnóstico marca como grave (spec 8.3).

**Arquivos:**
- Criar: `packages/nucleo/src/importacao/validar.ts`
- Teste: `packages/nucleo/test/importacao/validar.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/importacao/validar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Documento } from '../../src/formato/documento';
import { indexar } from '../../src/formato/indice';
import { validar } from '../../src/importacao/validar';
import { doc, entrada, fila, janela, peca, saida } from '../apoio';

const problemas = (d: Documento) => validar(indexar(d));

describe('validar', () => {
  it('documento coerente não tem problemas', () => {
    const d = doc({
      entradas: [entrada('e', 'peca:m')],
      pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 2 })],
      saidas: [saida('m', '1', 'fila:1'), saida('m', 'esgotou', 'fim:desliga')],
      filas: [fila('1')],
    });
    expect(problemas(d)).toEqual([]);
  });

  it('referência que não existe é aviso, não erro', () => {
    expect(problemas(doc({ entradas: [entrada('e', 'peca:nada')] }))).toEqual([
      expect.objectContaining({ gravidade: 'aviso', aba: 'entradas', coluna: 'destino', mensagem: expect.stringContaining('peca:nada') }),
    ]);
  });

  it('usa a linha de origem quando informada', () => {
    const p = validar(indexar(doc({ entradas: [entrada('e', 'peca:nada')] })), new Map([['entradas/e', 7]]));
    expect(p[0]?.linha).toBe(7);
  });

  it('regra de horário sem horário e regra de feriado sem calendário são erro', () => {
    const p = problemas(
      doc({
        pecas: [peca('h', 'regra_horario'), peca('f', 'regra_feriado')],
        saidas: [saida('h', 'sim', 'fim:desliga'), saida('f', 'sim', 'fim:desliga')],
      }),
    );
    expect(p.filter((x) => x.gravidade === 'erro').map((x) => x.coluna)).toEqual(['horario', 'calendario']);
  });

  it('saída repetida é erro; com condição diferente, não', () => {
    const p = problemas(
      doc({
        pecas: [peca('c', 'consulta')],
        saidas: [
          saida('c', 'ok', 'fim:desliga', { id: 'a' }),
          saida('c', 'ok', 'fim:desliga', { id: 'b' }),
          saida('c', 'ok', 'fim:desliga', { id: 'c', quando: { chave: 'tipo', valor: 'x' } }),
        ],
      }),
    );
    expect(p.filter((x) => x.gravidade === 'erro')).toEqual([expect.objectContaining({ aba: 'saidas', mensagem: expect.stringContaining('já existe na saída a') })]);
  });

  it('janela que termina antes de começar é erro', () => {
    expect(problemas(doc({ horarios: [janela('h', ['seg'], '18:00', '08:00')] }))).toEqual([expect.objectContaining({ gravidade: 'erro', aba: 'horarios', coluna: 'fim' })]);
  });

  it('peça sem saída e dados incompletos são avisos', () => {
    const p = problemas(doc({ pecas: [peca('m', 'menu')] }));
    expect(p.every((x) => x.gravidade === 'aviso')).toBe(true);
    expect(p.map((x) => x.mensagem)).toEqual([expect.stringContaining('não tem nenhuma saída'), expect.stringContaining('espera_s'), expect.stringContaining('esgotou')]);
  });

  it('calendário sem nenhum feriado é aviso', () => {
    const p = problemas(doc({ pecas: [peca('f', 'regra_feriado', { calendario: 'nacional' })], saidas: [saida('f', 'nao', 'fim:desliga')] }));
    expect(p).toEqual([expect.objectContaining({ gravidade: 'aviso', coluna: 'calendario' })]);
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/importacao/validar.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/importacao/validar.ts`:

```ts
import { completude } from '../formato/completude';
import type { NomeAba } from '../formato/documento';
import { existe, type Indice } from '../formato/indice';
import type { Problema } from './problemas';

/**
 * Regras que olham o documento inteiro.
 * Referência que não existe é aviso: o import continua e o diagnóstico marca o problema.
 */
export function validar(idx: Indice, linhas: Map<string, number> = new Map()): Problema[] {
  const out: Problema[] = [];
  const doc = idx.doc;
  const onde = (aba: NomeAba, id: string, coluna?: string) => ({ aba, linha: linhas.get(`${aba}/${id}`), coluna });
  const checar = (aba: NomeAba, id: string, coluna: string, ref: string | undefined) => {
    if (ref !== undefined && !existe(idx, ref)) {
      out.push({ gravidade: 'aviso', ...onde(aba, id, coluna), mensagem: `aponta pra ${ref}, que não existe. O import continua e o diagnóstico vai marcar isso` });
    }
  };

  for (const e of doc.entradas) checar('entradas', e.id, 'destino', e.destino);
  for (const r of doc.ramais) {
    checar('ramais', r.id, 'ao_nao_atender', r.ao_nao_atender);
    checar('ramais', r.id, 'ao_ocupado', r.ao_ocupado);
    checar('ramais', r.id, 'ao_indisponivel', r.ao_indisponivel);
    for (const m of r.siga_me_lista ?? []) checar('ramais', r.id, 'siga_me_lista', m);
  }
  for (const f of doc.filas) {
    checar('filas', f.id, 'ao_esgotar', f.ao_esgotar);
    checar('filas', f.id, 'pesquisa_ao_desligar', f.pesquisa_ao_desligar);
    for (const m of f.membros ?? []) checar('filas', f.id, 'membros', m);
  }
  for (const g of doc.grupos) {
    checar('grupos', g.id, 'ao_esgotar', g.ao_esgotar);
    for (const m of g.membros ?? []) checar('grupos', g.id, 'membros', m);
  }
  for (const p of doc.pecas) {
    if (p.tipo === 'regra_horario' && !p.horario) out.push({ gravidade: 'erro', ...onde('pecas', p.id, 'horario'), mensagem: 'regra de horário sem a coluna horario' });
    if (p.tipo === 'regra_feriado' && !p.calendario) out.push({ gravidade: 'erro', ...onde('pecas', p.id, 'calendario'), mensagem: 'regra de feriado sem a coluna calendario' });
    checar('pecas', p.id, 'horario', p.horario);
    if (p.calendario && !idx.feriados.has(p.calendario)) {
      out.push({ gravidade: 'aviso', ...onde('pecas', p.id, 'calendario'), mensagem: `o calendário "${p.calendario}" não tem nenhum feriado na aba feriados` });
    }
    if (p.tipo !== 'fim' && !(idx.saidasDe.get(p.id)?.length)) {
      out.push({ gravidade: 'aviso', ...onde('pecas', p.id), mensagem: `a peça "${p.nome ?? p.id}" não tem nenhuma saída` });
    }
  }
  const combinacoes = new Map<string, string>();
  for (const s of doc.saidas) {
    checar('saidas', s.id, 'de', s.de);
    checar('saidas', s.id, 'para', s.para);
    const chave = `${s.de}|${s.opcao}|${s.quando ? `${s.quando.chave}=${s.quando.valor}` : ''}`;
    const outra = combinacoes.get(chave);
    if (outra) out.push({ gravidade: 'erro', ...onde('saidas', s.id, 'opcao'), mensagem: `a opção "${s.opcao}" de ${s.de} já existe na saída ${outra}` });
    else combinacoes.set(chave, s.id);
  }
  for (const h of doc.horarios) {
    if (h.fim <= h.inicio) out.push({ gravidade: 'erro', ...onde('horarios', h.id, 'fim'), mensagem: `a janela termina (${h.fim}) antes de começar (${h.inicio})` });
  }
  for (const p of completude(idx)) out.push({ gravidade: 'aviso', ...onde(p.aba, p.id), mensagem: p.mensagem });
  return out;
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/importacao/validar.test.ts`

Esperado: PASSA, 8 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/importacao/validar.ts packages/nucleo/test/importacao/validar.test.ts
git commit -m "feat(nucleo): validação do documento" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 10: Junção e diferenças

Monta a nova base: import completo substitui tudo; import parcial só mexe nas abas que vieram e junta pelo id. `diferencas` lista o que é novo, removido e alterado, pra tela de revisão.

**Arquivos:**
- Criar: `packages/nucleo/src/util.ts`
- Criar: `packages/nucleo/src/importacao/juntar.ts`
- Teste: `packages/nucleo/test/importacao/juntar.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/importacao/juntar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { diferencas, juntar } from '../../src/importacao/juntar';
import { doc, fila, ramal } from '../apoio';

describe('juntar', () => {
  const anterior = doc({ filas: [fila('1', { nome: 'A' }), fila('2', { nome: 'B' })], ramais: [ramal('9')] });
  const novo = doc({ filas: [fila('2', { nome: 'B2' }), fila('3', { nome: 'C' })] });

  it('import completo substitui tudo, inclusive abas que não vieram', () => {
    const b = juntar(anterior, novo, { presentes: ['filas'], parcial: false });
    expect(b.filas.map((f) => f.id)).toEqual(['2', '3']);
    expect(b.ramais).toEqual([]);
  });

  it('import parcial só mexe nas abas presentes e junta pelo id', () => {
    const b = juntar(anterior, novo, { presentes: ['filas'], parcial: true });
    expect(b.filas.map((f) => [f.id, f.nome])).toEqual([
      ['1', 'A'],
      ['2', 'B2'],
      ['3', 'C'],
    ]);
    expect(b.ramais.map((r) => r.id)).toEqual(['9']);
  });

  it('não altera os documentos recebidos', () => {
    juntar(anterior, novo, { presentes: ['filas'], parcial: true });
    expect(anterior.filas[1]!.nome).toBe('B');
  });
});

describe('diferencas', () => {
  it('lista novos, removidos e campos alterados', () => {
    const anterior = doc({ filas: [fila('1', { nome: 'A' }), fila('2', { nome: 'B' })], ramais: [ramal('9')] });
    const depois = doc({ filas: [fila('2', { nome: 'B2' }), fila('3', { nome: 'C' })] });
    expect(diferencas(anterior, depois)).toEqual({
      novos: ['filas/3'],
      removidos: ['ramais/9', 'filas/1'],
      alterados: [{ chave: 'filas/2', campos: ['nome'] }],
    });
  });
  it('sem base anterior, tudo é novo', () => {
    expect(diferencas(null, doc({ filas: [fila('2'), fila('3')] })).novos).toEqual(['filas/2', 'filas/3']);
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/importacao/juntar.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/util.ts`:

```ts
/** Igualdade de valores de célula: primitivos, listas e expressões. */
export function igual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
```

Criar `packages/nucleo/src/importacao/juntar.ts`:

```ts
import { NOMES_ABAS, documentoVazio, tabelasDe, type Documento, type NomeAba } from '../formato/documento';
import { igual } from '../util';

export interface OpcoesJuntar {
  /** Abas que vieram no import. */
  presentes: readonly NomeAba[];
  /** Parcial: só as abas presentes mudam, e o que não veio nelas fica. Completo: o arquivo substitui tudo. */
  parcial: boolean;
}

/** Monta a nova base a partir da base anterior e do que veio no import. */
export function juntar(anterior: Documento | null | undefined, novo: Documento, opcoes: OpcoesJuntar): Documento {
  const out = documentoVazio();
  const destino = tabelasDe(out);
  const antes = tabelasDe(anterior ?? documentoVazio());
  const agora = tabelasDe(novo);
  for (const aba of NOMES_ABAS) {
    if (!opcoes.parcial) {
      destino[aba] = structuredClone(agora[aba]);
      continue;
    }
    if (!opcoes.presentes.includes(aba)) {
      destino[aba] = structuredClone(antes[aba]);
      continue;
    }
    const novos = new Map(agora[aba].map((l) => [l.id, l] as const));
    const juntas = antes[aba].map((l) => structuredClone(novos.get(l.id) ?? l));
    const jaTinha = new Set(antes[aba].map((l) => l.id));
    for (const l of agora[aba]) if (!jaTinha.has(l.id)) juntas.push(structuredClone(l));
    destino[aba] = juntas;
  }
  return out;
}

export interface Diferencas {
  /** Chaves "aba/id". */
  novos: string[];
  removidos: string[];
  alterados: { chave: string; campos: string[] }[];
}

/** O que mudou entre duas versões da base, pra tela de revisão. */
export function diferencas(antes: Documento | null | undefined, depois: Documento): Diferencas {
  const out: Diferencas = { novos: [], removidos: [], alterados: [] };
  const a = tabelasDe(antes ?? documentoVazio());
  const b = tabelasDe(depois);
  for (const aba of NOMES_ABAS) {
    const velhos = new Map(a[aba].map((l) => [l.id, l] as const));
    const atuais = new Map(b[aba].map((l) => [l.id, l] as const));
    for (const [id, l] of atuais) {
      const v = velhos.get(id);
      if (!v) {
        out.novos.push(`${aba}/${id}`);
        continue;
      }
      const campos = [...new Set([...Object.keys(v), ...Object.keys(l)])].filter((k) => !igual(v[k], l[k]));
      if (campos.length) out.alterados.push({ chave: `${aba}/${id}`, campos });
    }
    for (const id of velhos.keys()) if (!atuais.has(id)) out.removidos.push(`${aba}/${id}`);
  }
  return out;
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/importacao/juntar.test.ts`

Esperado: PASSA, 5 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/util.ts packages/nucleo/src/importacao/juntar.ts packages/nucleo/test/importacao/juntar.test.ts
git commit -m "feat(nucleo): junção de imports e diferenças" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 11: Ajustes manuais

Aplica ajustes por cima da base sem mexer nela (spec 7.2): ajuste de campo e criação de linha. Aponta conflitos (a central mudou desde o ajuste), órfãos (o alvo sumiu) e redundantes (a central já traz o mesmo valor).

**Arquivos:**
- Criar: `packages/nucleo/src/importacao/ajustes.ts`
- Teste: `packages/nucleo/test/importacao/ajustes.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/importacao/ajustes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { aplicarAjustes, type Ajuste } from '../../src/importacao/ajustes';
import { doc, fila, peca } from '../apoio';

describe('aplicarAjustes', () => {
  const base = doc({ filas: [fila('90011')], pecas: [peca('m', 'menu')] });

  it('aplica ajuste de campo sem mexer na base', () => {
    const r = aplicarAjustes(base, [{ tipo: 'campo', aba: 'filas', id: '90011', campo: 'espera_maxima_s', valor: 180 }]);
    expect(r.efetivo.filas[0]!.espera_maxima_s).toBe(180);
    expect(base.filas[0]!.espera_maxima_s).toBeUndefined();
    expect(r.conflitos).toEqual([]);
  });

  it('ajuste sem alvo é órfão e não é aplicado', () => {
    const a: Ajuste = { tipo: 'campo', aba: 'filas', id: '999', campo: 'nome', valor: 'X' };
    expect(aplicarAjustes(base, [a]).orfaos).toEqual([a]);
  });

  it('ajuste igual ao que a central traz é redundante', () => {
    const a: Ajuste = { tipo: 'campo', aba: 'filas', id: '90011', campo: 'toque_por_membro_s', valor: 15 };
    expect(aplicarAjustes(base, [a]).redundantes).toEqual([a]);
  });

  it('central mudou desde o ajuste: vira conflito, mas o ajuste continua valendo', () => {
    const a: Ajuste = { tipo: 'campo', aba: 'filas', id: '90011', campo: 'toque_por_membro_s', valor: 20, valorDaCentral: 12 };
    const r = aplicarAjustes(base, [a]);
    expect(r.conflitos).toEqual([{ ajuste: a, atualDaCentral: 15 }]);
    expect(r.efetivo.filas[0]!.toque_por_membro_s).toBe(20);
  });

  it('central igual ao valor registrado no ajuste: sem conflito', () => {
    const r = aplicarAjustes(base, [{ tipo: 'campo', aba: 'filas', id: '90011', campo: 'toque_por_membro_s', valor: 20, valorDaCentral: 15 }]);
    expect(r.conflitos).toEqual([]);
  });

  it('valor undefined apaga o campo', () => {
    const r = aplicarAjustes(base, [{ tipo: 'campo', aba: 'filas', id: '90011', campo: 'toque_por_membro_s', valor: undefined }]);
    expect('toque_por_membro_s' in r.efetivo.filas[0]!).toBe(false);
  });

  it('criar adiciona a linha, e ajustes de campo valem pra ela', () => {
    const r = aplicarAjustes(base, [
      { tipo: 'criar', aba: 'pecas', linha: { id: 'manual-1', tipo: 'fim', ativo: true } },
      { tipo: 'campo', aba: 'pecas', id: 'manual-1', campo: 'nome', valor: 'Encerra' },
    ]);
    expect(r.efetivo.pecas.map((p) => [p.id, p.nome])).toEqual([
      ['m', undefined],
      ['manual-1', 'Encerra'],
    ]);
  });

  it('criar com id que a central já tem vira conflito', () => {
    const r = aplicarAjustes(base, [{ tipo: 'criar', aba: 'pecas', linha: { id: 'm', tipo: 'fim', ativo: true } }]);
    expect(r.conflitos).toHaveLength(1);
    expect(r.efetivo.pecas).toHaveLength(1);
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/importacao/ajustes.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/importacao/ajustes.ts`:

```ts
import { tabelasDe, type Documento, type NomeAba } from '../formato/documento';
import { igual } from '../util';

export type AjusteCampo = {
  tipo: 'campo';
  aba: NomeAba;
  id: string;
  campo: string;
  /** Novo valor tipado. undefined apaga o campo. */
  valor: unknown;
  /** Valor da central quando o ajuste foi feito. Se a central mudar depois, vira conflito. */
  valorDaCentral?: unknown;
  nota?: string;
};

export type AjusteCriar = {
  tipo: 'criar';
  aba: NomeAba;
  linha: { id: string } & Record<string, unknown>;
  nota?: string;
};

export type Ajuste = AjusteCampo | AjusteCriar;

export interface Conflito {
  ajuste: Ajuste;
  /** O que a central traz agora. */
  atualDaCentral: unknown;
}

export interface ResultadoAjustes {
  efetivo: Documento;
  /** O ajuste continua valendo, mas a central mudou desde que ele foi feito. */
  conflitos: Conflito[];
  /** O alvo do ajuste não existe mais. Não foi aplicado. */
  orfaos: Ajuste[];
  /** A central já traz o mesmo valor do ajuste. */
  redundantes: Ajuste[];
}

/** Aplica os ajustes manuais por cima da base, sem mexer na base. */
export function aplicarAjustes(base: Documento, ajustes: readonly Ajuste[]): ResultadoAjustes {
  const efetivo = structuredClone(base);
  const t = tabelasDe(efetivo);
  const conflitos: Conflito[] = [];
  const orfaos: Ajuste[] = [];
  const redundantes: Ajuste[] = [];

  for (const a of ajustes) {
    if (a.tipo !== 'criar') continue;
    const existente = t[a.aba].find((l) => l.id === a.linha.id);
    if (existente) {
      conflitos.push({ ajuste: a, atualDaCentral: existente });
      continue;
    }
    t[a.aba].push(structuredClone(a.linha));
  }

  for (const a of ajustes) {
    if (a.tipo !== 'campo') continue;
    const linha = t[a.aba].find((l) => l.id === a.id);
    if (!linha) {
      orfaos.push(a);
      continue;
    }
    const atual = linha[a.campo];
    if (igual(atual, a.valor)) {
      redundantes.push(a);
      continue;
    }
    if ('valorDaCentral' in a && !igual(atual, a.valorDaCentral)) conflitos.push({ ajuste: a, atualDaCentral: atual });
    if (a.valor === undefined) delete linha[a.campo];
    else linha[a.campo] = structuredClone(a.valor);
  }
  return { efetivo, conflitos, orfaos, redundantes };
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/importacao/ajustes.test.ts`

Esperado: PASSA, 8 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/importacao/ajustes.ts packages/nucleo/test/importacao/ajustes.test.ts
git commit -m "feat(nucleo): ajustes manuais em camada" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 12: Import completo

Junta as peças anteriores no fluxo do import: ler, analisar, juntar, validar, aplicar ajustes e calcular diferenças.

**Arquivos:**
- Criar: `packages/nucleo/src/importacao/importar.ts`
- Teste: `packages/nucleo/test/importacao/importar.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/importacao/importar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { importar } from '../../src/importacao/importar';

const csv = (nome: string, ...linhas: string[]) => ({ nome, conteudo: linhas.join('\n') });

describe('importar', () => {
  it('lê, valida, monta a base e aplica os ajustes', async () => {
    const r = await importar(
      [
        csv('entradas.csv', 'id;numero;destino', 'e1;5130000001;peca:menu'),
        csv('pecas.csv', 'id;tipo;espera_s;tentativas', 'menu;menu;5;2'),
        csv('saidas.csv', 'id;de;opcao;para', 's1;peca:menu;1;fila:100', 's2;peca:menu;esgotou;fim:desliga'),
        csv('filas.csv', 'id;estrategia;toque_por_membro_s', '100;rrmemory;15'),
      ],
      { ajustes: [{ tipo: 'campo', aba: 'filas', id: '100', campo: 'espera_maxima_s', valor: 120 }] },
    );
    expect(r.problemas).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.base.filas[0]!.espera_maxima_s).toBeUndefined();
    expect(r.efetivo.filas[0]!.espera_maxima_s).toBe(120);
    expect(r.diferencas.novos).toHaveLength(5);
  });

  it('não fica ok quando há erro', async () => {
    const r = await importar([csv('filas.csv', 'id;estrategia', '100;fila-boba')]);
    expect(r.ok).toBe(false);
  });

  it('sem nenhuma aba reconhecida é erro', async () => {
    const r = await importar([]);
    expect(r.ok).toBe(false);
    expect(r.problemas[0]?.mensagem).toContain('nenhuma aba');
  });

  it('import parcial mantém o resto da base anterior e mostra o que mudou', async () => {
    const primeiro = await importar([csv('filas.csv', 'id;estrategia;toque_por_membro_s', '1;ringall;10', '2;ringall;10')]);
    const segundo = await importar([csv('filas.csv', 'id;estrategia;toque_por_membro_s', '2;linear;12')], { anterior: primeiro.base, parcial: true });
    expect(segundo.base.filas.map((f) => [f.id, f.estrategia])).toEqual([
      ['1', 'ringall'],
      ['2', 'linear'],
    ]);
    expect(segundo.diferencas.alterados).toEqual([{ chave: 'filas/2', campos: ['estrategia', 'toque_por_membro_s'] }]);
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/importacao/importar.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/importacao/importar.ts`:

```ts
import type { Documento } from '../formato/documento';
import { indexar } from '../formato/indice';
import { aplicarAjustes, type Ajuste, type Conflito } from './ajustes';
import { analisar } from './analisar';
import { diferencas, juntar, type Diferencas } from './juntar';
import { lerArquivos, type ArquivoEntrada } from './ler-arquivos';
import type { Problema } from './problemas';
import { validar } from './validar';

export interface OpcoesImport {
  /** Base do import anterior. */
  anterior?: Documento | null;
  ajustes?: readonly Ajuste[];
  parcial?: boolean;
}

export interface ResultadoImport {
  /** Sem nenhum erro: pode confirmar. */
  ok: boolean;
  problemas: Problema[];
  /** Nova base: o que a central diz. */
  base: Documento;
  /** Base mais os ajustes manuais. */
  efetivo: Documento;
  /** Base anterior → nova base. */
  diferencas: Diferencas;
  conflitos: Conflito[];
  orfaos: Ajuste[];
  redundantes: Ajuste[];
}

export async function importar(arquivos: ArquivoEntrada[], opcoes: OpcoesImport = {}): Promise<ResultadoImport> {
  const lidos = await lerArquivos(arquivos);
  const analise = analisar(lidos.tabelas);
  const base = juntar(opcoes.anterior, analise.documento, { presentes: analise.presentes, parcial: opcoes.parcial ?? false });
  const problemas: Problema[] = [...lidos.problemas, ...analise.problemas, ...validar(indexar(base), analise.linhas)];
  if (analise.presentes.length === 0 && !problemas.some((p) => p.gravidade === 'erro')) {
    problemas.push({ gravidade: 'erro', mensagem: 'nenhuma aba reconhecida nos arquivos enviados' });
  }
  const ajustados = aplicarAjustes(base, opcoes.ajustes ?? []);
  return {
    ok: !problemas.some((p) => p.gravidade === 'erro'),
    problemas,
    base,
    efetivo: ajustados.efetivo,
    diferencas: diferencas(opcoes.anterior, base),
    conflitos: ajustados.conflitos,
    orfaos: ajustados.orfaos,
    redundantes: ajustados.redundantes,
  };
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/importacao/importar.test.ts`

Esperado: PASSA, 4 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/importacao/importar.ts packages/nucleo/test/importacao/importar.test.ts
git commit -m "feat(nucleo): fluxo de import" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 13: Modelos pra baixar

Gera a planilha `.xlsx` (aba de instruções, uma aba por tipo, nota em cada cabeçalho, lista de valores nas colunas de lista e sim/não, exemplos), o exemplo `.json` e o esquema JSON. O teste prova que os dois modelos passam no import sem nenhum problema.

**Arquivos:**
- Criar: `packages/nucleo/src/modelos/json.ts`
- Criar: `packages/nucleo/src/modelos/xlsx.ts`
- Criar: `packages/nucleo/scripts/gerar-modelos.ts`
- Teste: `packages/nucleo/test/modelos/modelos.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/modelos/modelos.test.ts`:

```ts
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { NOMES_ABAS } from '../../src/formato/documento';
import { importar } from '../../src/importacao/importar';
import { gerarEsquemaJson, gerarModeloJson } from '../../src/modelos/json';
import { gerarModeloXlsx } from '../../src/modelos/xlsx';

describe('modelo .json', () => {
  it('passa no import sem nenhum problema', async () => {
    const r = await importar([{ nome: 'modelo-journey.json', conteudo: JSON.stringify(gerarModeloJson()) }]);
    expect(r.problemas).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('o esquema descreve todas as abas e os obrigatórios', () => {
    const e = gerarEsquemaJson() as { properties: Record<string, { items: { required: string[]; properties: Record<string, unknown> } }> };
    expect(Object.keys(e.properties)).toEqual(['formato', ...NOMES_ABAS]);
    expect(e.properties.saidas!.items.required).toEqual(['id', 'de', 'opcao', 'para']);
    expect(e.properties.filas!.items.properties.membros).toMatchObject({ type: 'array' });
  });
});

describe('modelo .xlsx', () => {
  it('passa no import sem nenhum problema', async () => {
    const r = await importar([{ nome: 'modelo-journey.xlsx', conteudo: await gerarModeloXlsx() }]);
    expect(r.problemas).toEqual([]);
    expect(r.base.saidas).toHaveLength(8);
  });

  it('tem instruções, uma aba por tipo, nota no cabeçalho e lista de valores', async () => {
    const bytes = await gerarModeloXlsx();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['instrucoes', ...NOMES_ABAS]);
    const pecas = wb.getWorksheet('pecas')!;
    expect(pecas.getCell('B1').value).toBe('tipo');
    expect(JSON.stringify(pecas.getCell('B1').note)).toContain('Tipo da peça');
    expect(pecas.getCell('B2').dataValidation?.formulae?.[0]).toContain('menu');
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/modelos/modelos.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/modelos/json.ts`:

```ts
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
```

Criar `packages/nucleo/src/modelos/xlsx.ts`:

```ts
import ExcelJS from 'exceljs';
import { ABAS, type Coluna, type TipoColuna } from '../formato/abas';
import { NOMES_ABAS } from '../formato/documento';

const TIPO_LEGIVEL: Record<TipoColuna, string> = {
  texto: 'texto',
  inteiro: 'número inteiro',
  booleano: 'sim ou nao',
  enum: 'lista',
  ref: 'referência',
  refs: 'referências',
  hora: 'hora HH:MM',
  data: 'data AAAA-MM-DD',
  dias: 'dias da semana',
  expressao: 'chave=valor',
  opcao: 'opção',
};

const REGRAS_GERAIS = [
  'Como preencher o modelo do Journey',
  'Cada aba descreve um tipo de coisa. Toda linha precisa de um id único e estável na aba: use o mesmo da central, pra os ajustes feitos no Journey sobreviverem ao próximo import.',
  'Referências apontam pra outras linhas no formato tipo:id, por exemplo fila:90011, ramal:2001, peca:menu-principal, horario:atendimento. Também existem fim:desliga, fim:atendido, fim:caixa_postal e externo:celular.',
  'Listas são separadas por espaço. Tempos em segundos. Horas em HH:MM. Datas em AAAA-MM-DD.',
  'Pode enviar só algumas abas (import parcial). As linhas se juntam pelo id.',
  'Abaixo, cada coluna de cada aba. As linhas de exemplo de todas as abas formam um fluxo pequeno e completo.',
];

function descricaoCompleta(c: Coluna): string {
  const partes = [c.descricao];
  if (c.valores) partes.push(`Valores: ${c.valores.join(', ')}.`);
  if (c.refs) partes.push(`Aceita: ${c.refs.map((r) => `${r}:…`).join(', ')}.`);
  if (c.padrao !== undefined) partes.push(`Vazio = ${c.padrao}.`);
  return partes.join(' ');
}

const obrigatoria = (c: Coluna) => c.obrigatoria === true && c.padrao === undefined;

/** Planilha modelo: aba de instruções e uma aba por tipo, com listas de valores e exemplos. */
export async function gerarModeloXlsx(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Journey';

  const instr = wb.addWorksheet('instrucoes');
  instr.columns = [
    { header: 'aba', key: 'aba', width: 12 },
    { header: 'coluna', key: 'coluna', width: 24 },
    { header: 'obrigatória', key: 'obrigatoria', width: 12 },
    { header: 'tipo', key: 'tipo', width: 18 },
    { header: 'descrição', key: 'descricao', width: 100 },
  ];
  instr.getRow(1).font = { bold: true };
  for (const regra of REGRAS_GERAIS) instr.addRow({ descricao: regra });
  for (const aba of NOMES_ABAS) {
    instr.addRow({});
    instr.addRow({ aba, descricao: ABAS[aba].descricao }).font = { bold: true };
    for (const c of ABAS[aba].colunas) {
      instr.addRow({ aba, coluna: c.nome, obrigatoria: obrigatoria(c) ? 'sim' : 'não', tipo: TIPO_LEGIVEL[c.tipo], descricao: descricaoCompleta(c) });
    }
  }

  for (const aba of NOMES_ABAS) {
    const colunas = ABAS[aba].colunas;
    const ws = wb.addWorksheet(aba, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = colunas.map((c) => ({ header: c.nome, key: c.nome, width: Math.max(14, c.nome.length + 4) }));
    const cabecalho = ws.getRow(1);
    cabecalho.font = { bold: true };
    colunas.forEach((c, i) => {
      cabecalho.getCell(i + 1).note = descricaoCompleta(c);
    });
    for (const ex of ABAS[aba].exemplos) {
      ws.addRow(Object.fromEntries(colunas.map((c) => [c.nome, c.tipo === 'inteiro' && ex[c.nome] ? Number(ex[c.nome]) : (ex[c.nome] ?? '')])));
    }
    colunas.forEach((c, i) => {
      const lista = c.tipo === 'enum' ? c.valores : c.tipo === 'booleano' ? ['sim', 'nao'] : undefined;
      if (!lista) return;
      for (let linha = 2; linha <= 500; linha++) {
        ws.getCell(linha, i + 1).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${lista.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Valor não permitido',
          error: `Use: ${lista.join(', ')}`,
        };
      }
    });
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
```

Criar `packages/nucleo/scripts/gerar-modelos.ts`:

```ts
/**
 * Gera os modelos pra baixar: planilha .xlsx, exemplo .json e o esquema JSON.
 * Uso: npm run modelos [-- <pasta>]   (padrão: saida/modelos)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gerarEsquemaJson, gerarModeloJson } from '../src/modelos/json';
import { gerarModeloXlsx } from '../src/modelos/xlsx';

const pasta = process.argv[2] ?? 'saida/modelos';
await mkdir(pasta, { recursive: true });
await writeFile(join(pasta, 'modelo-journey.xlsx'), await gerarModeloXlsx());
await writeFile(join(pasta, 'modelo-journey.json'), JSON.stringify(gerarModeloJson(), null, 2) + '\n');
await writeFile(join(pasta, 'esquema-journey.json'), JSON.stringify(gerarEsquemaJson(), null, 2) + '\n');
console.log(`modelos gerados em ${pasta}`);
```


Rodar: `npm run modelos -w packages/nucleo`

Esperado: `modelos gerados em saida/modelos`, com `modelo-journey.xlsx`, `modelo-journey.json` e `esquema-journey.json` em `packages/nucleo/saida/modelos/` (a pasta `saida/` não vai pro git).

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/modelos/modelos.test.ts`

Esperado: PASSA, 4 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/modelos/json.ts packages/nucleo/src/modelos/xlsx.ts packages/nucleo/scripts/gerar-modelos.ts packages/nucleo/test/modelos/modelos.test.ts
git commit -m "feat(nucleo): modelos xlsx e json pra baixar" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 14: Relógio

O relógio da simulação é hora de parede, sem fuso ("2026-11-24T14:10" é 14h10 em qualquer máquina). Responde se um instante está numa janela de horário e se é feriado.

**Arquivos:**
- Criar: `packages/nucleo/src/motor/relogio.ts`
- Teste: `packages/nucleo/test/motor/relogio.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/motor/relogio.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Feriado } from '../../src/formato/documento';
import { dentroDoHorario, ehFeriado, formatarRelogio, lerInicio, somar } from '../../src/motor/relogio';
import { janela } from '../apoio';

describe('relógio', () => {
  it('lê hora de parede e soma segundos', () => {
    const ms = lerInicio('2026-11-24T16:57');
    expect(formatarRelogio(ms)).toBe('ter 16:57');
    expect(formatarRelogio(somar(ms, 180))).toBe('ter 17:00');
  });

  it('recusa início mal escrito', () => {
    expect(() => lerInicio('24/11/2026')).toThrow('AAAA-MM-DDTHH:MM');
  });

  it('dentro do horário: o início conta, o fim não', () => {
    const j = [janela('h', ['ter'], '08:30', '16:55')];
    expect(dentroDoHorario(j, lerInicio('2026-11-24T08:30'))).toBe(true);
    expect(dentroDoHorario(j, lerInicio('2026-11-24T16:55'))).toBe(false);
    expect(dentroDoHorario(j, lerInicio('2026-11-25T10:00'))).toBe(false);
  });

  it('feriado pela data exata ou todo ano', () => {
    const f: Feriado[] = [
      { id: 'a', calendario: 'c', data: '2025-12-25', todo_ano: true },
      { id: 'b', calendario: 'c', data: '2026-11-20', todo_ano: false },
    ];
    expect(ehFeriado(f, lerInicio('2026-12-25T10:00'))).toBe(true);
    expect(ehFeriado(f, lerInicio('2026-11-20T10:00'))).toBe(true);
    expect(ehFeriado(f, lerInicio('2027-11-20T10:00'))).toBe(false);
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/motor/relogio.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/motor/relogio.ts`:

```ts
import { DIAS, type Dia, type Feriado, type Horario } from '../formato/documento';

/**
 * O relógio da simulação é hora de parede, sem fuso: "2026-11-24T14:10" é 14h10 em qualquer máquina.
 * Internamente é um número de milissegundos tratado como UTC.
 */
export function lerInicio(texto: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(texto);
  if (!m) throw new Error(`início inválido: "${texto}". Use AAAA-MM-DDTHH:MM`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
}

export const somar = (ms: number, segundos: number): number => ms + segundos * 1000;
export const diaDaSemana = (ms: number): Dia => DIAS[new Date(ms).getUTCDay()] as Dia;
export const minutosDoDia = (ms: number): number => {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
export const dataIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const paraMinutos = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
export const paraHora = (minutos: number): string => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
export const formatarRelogio = (ms: number): string => `${diaDaSemana(ms)} ${paraHora(minutosDoDia(ms))}`;

export function dentroDoHorario(janelas: readonly Horario[], ms: number): boolean {
  const dia = diaDaSemana(ms);
  const min = minutosDoDia(ms);
  return janelas.some((j) => j.dias.includes(dia) && min >= paraMinutos(j.inicio) && min < paraMinutos(j.fim));
}

export function ehFeriado(feriados: readonly Feriado[], ms: number): boolean {
  const iso = dataIso(ms);
  return feriados.some((f) => f.data === iso || (f.todo_ano && f.data.slice(5) === iso.slice(5)));
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/motor/relogio.test.ts`

Esperado: PASSA, 4 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/motor/relogio.ts packages/nucleo/test/motor/relogio.test.ts
git commit -m "feat(nucleo): relógio da simulação" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 15: Motor de simulação

O motor do spec 11.1: anda pelo fluxo emitindo eventos (`chegou`, `decisao`, `escolheu`, `definiu`, `correu`, `trocou_canal`, `terminou`), decide sozinho o que o relógio, o cenário ou o modo "ninguém atende" resolvem, e para numa decisão quando precisa de resposta. Previsível: as mesmas entradas dão os mesmos eventos.

**Arquivos:**
- Criar: `packages/nucleo/src/motor/execucao.ts`
- Teste: `packages/nucleo/test/motor/execucao.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/motor/execucao.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { executar, type Execucao } from '../../src/motor/execucao';
import { doc, entrada, fila, grupo, janela, peca, ramal, saida } from '../apoio';

/**
 * Entrada → feriado? → horário? → menu
 *   menu 1 → fila 100 (espera 60 s → grupo 200 → caixa postal)
 *   menu 2 → ramal 2001 ↔ 2002 (ciclo)
 *   menu 3 → tipo (guarda variável) → busca → e-mail (troca de canal) ou falha conforme o tipo
 *   menu esgotou → fim
 *   fora do horário ou feriado → áudio de 9 s → fim
 */
const base = doc({
  entradas: [entrada('e', 'peca:feriado')],
  horarios: [janela('h', ['seg', 'ter', 'qua', 'qui', 'sex'], '08:00', '18:00')],
  feriados: [{ id: 'natal', calendario: 'nacional', data: '2026-12-25', todo_ano: true }],
  pecas: [
    peca('feriado', 'regra_feriado', { calendario: 'nacional' }),
    peca('horario', 'regra_horario', { horario: 'horario:h' }),
    peca('menu', 'menu', { espera_s: 5, tentativas: 2 }),
    peca('fora', 'audio', { duracao_s: 9 }),
    peca('tipo', 'menu', { espera_s: 3, tentativas: 1, guarda_variavel: 'tipo' }),
    peca('busca', 'consulta'),
    peca('email', 'fim', { canal: 'email' }),
    peca('fim', 'fim'),
  ],
  saidas: [
    saida('feriado', 'sim', 'peca:fora'),
    saida('feriado', 'nao', 'peca:horario'),
    saida('horario', 'sim', 'peca:menu'),
    saida('horario', 'nao', 'peca:fora'),
    saida('menu', '1', 'fila:100'),
    saida('menu', '2', 'ramal:2001'),
    saida('menu', '3', 'peca:tipo'),
    saida('menu', 'esgotou', 'peca:fim'),
    saida('fora', 'sempre', 'peca:fim'),
    saida('tipo', '1', 'peca:busca', { define: { chave: 'tipo', valor: 'aluguel' } }),
    saida('tipo', '2', 'peca:busca', { define: { chave: 'tipo', valor: 'condominio' } }),
    saida('busca', 'ok', 'peca:email'),
    saida('busca', 'falha', 'fila:100', { quando: { chave: 'tipo', valor: 'aluguel' } }),
    saida('busca', 'falha', 'peca:nada', { quando: { chave: 'tipo', valor: 'condominio' } }),
  ],
  filas: [fila('100', { espera_maxima_s: 60, ao_esgotar: 'grupo:200' })],
  grupos: [grupo('200', { ao_esgotar: 'fim:caixa_postal' })],
  ramais: [ramal('2001', { toque_s: 20, ao_nao_atender: 'ramal:2002' }), ramal('2002', { siga_me_so_ramal_s: 7, siga_me_com_lista_s: 20, ao_nao_atender: 'ramal:2001' })],
});

const terca10h = { entrada: 'entrada:e', inicio: '2026-11-24T10:00' };
const chegadas = (e: Execucao) => e.eventos.flatMap((x) => (x.tipo === 'chegou' ? [x.ref] : []));

describe('motor', () => {
  it('o relógio decide feriado e horário; o menu espera quem liga', () => {
    const e = executar(base, terca10h);
    expect(e.terminou).toBe(false);
    expect(e.pendente?.ref).toBe('peca:menu');
    expect(e.eventos.filter((x) => x.tipo === 'escolheu')).toEqual([
      expect.objectContaining({ ref: 'peca:feriado', opcao: 'nao', como: 'relogio' }),
      expect.objectContaining({ ref: 'peca:horario', opcao: 'sim', como: 'relogio' }),
    ]);
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'decisao', quem: 'quem_liga' });
  });

  it('fora do horário passa pelo áudio e soma a duração', () => {
    const e = executar(base, { ...terca10h, inicio: '2026-11-24T20:00' });
    expect(e.motivo).toBe('fim');
    expect(e.segundos).toBe(9);
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'peca:fim' });
  });

  it('feriado de todo ano vale em qualquer ano', () => {
    const e = executar(base, { ...terca10h, inicio: '2027-12-25T10:00' });
    expect(e.eventos.find((x) => x.tipo === 'escolheu')).toMatchObject({ ref: 'peca:feriado', opcao: 'sim' });
  });

  it('respostas do cenário, variável guardada e saída condicionada', () => {
    const e = executar(base, { ...terca10h, respostas: { 'peca:menu': '3', 'peca:tipo': '2', 'peca:busca': 'falha' } });
    expect(e.variaveis).toEqual({ tipo: 'condominio' });
    expect(e.motivo).toBe('destino_inexistente');
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'peca:nada' });
  });

  it('esgotar o menu custa espera × tentativas', () => {
    const e = executar(base, { ...terca10h, respostas: { 'peca:menu': 'esgotou' } });
    expect(e.segundos).toBe(10);
    expect(e.motivo).toBe('fim');
  });

  it('responde uma decisão pendente e recusa opção inexistente', () => {
    const e = executar(base, terca10h);
    expect(e.avancar('1')[0]).toMatchObject({ tipo: 'escolheu', opcao: '1', como: 'resposta' });
    expect(e.pendente?.ref).toBe('fila:100');
    expect(() => e.avancar('9')).toThrow('não é uma opção');
    e.avancar('atende');
    expect(e.motivo).toBe('atendido');
  });

  it('ninguém atende: a fila transborda pelo tempo máximo, o grupo vai pro destino', () => {
    const e = executar(base, { ...terca10h, modo: 'ninguem_atende', respostas: { 'peca:menu': '1' } });
    expect(chegadas(e)).toEqual(['entrada:e', 'peca:feriado', 'peca:horario', 'peca:menu', 'fila:100', 'grupo:200', 'fim:caixa_postal']);
    expect(e.motivo).toBe('fim');
    expect(e.segundos).toBe(3 + 60 + 20);
  });

  it('ciclo entre ramais termina na terceira visita, contando o siga-me', () => {
    const e = executar(base, { entrada: 'ramal:2001', inicio: '2026-11-24T10:00', modo: 'ninguem_atende' });
    expect(e.motivo).toBe('ciclo');
    expect(chegadas(e)).toEqual(['ramal:2001', 'ramal:2002', 'ramal:2001', 'ramal:2002', 'ramal:2001']);
    expect(e.segundos).toBe(20 + 27 + 20 + 27);
  });

  it('modo livre pergunta até o relógio e sugere a resposta', () => {
    const e = executar(base, { ...terca10h, modo: 'livre' });
    expect(e.pendente?.ref).toBe('peca:feriado');
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'decisao', quem: 'relogio', sugestao: 'nao' });
  });

  it('troca de canal ao chegar numa peça de outro canal', () => {
    const e = executar(base, { ...terca10h, respostas: { 'peca:menu': '3', 'peca:tipo': '1', 'peca:busca': 'ok' } });
    expect(e.eventos).toContainEqual(expect.objectContaining({ tipo: 'trocou_canal', de: 'telefonia', para: 'email' }));
    expect(e.motivo).toBe('fim');
  });

  it('becos, destinos que saem da central e peça sem saída', () => {
    expect(executar(doc({ ramais: [ramal('1')] }), { entrada: 'ramal:1', inicio: '2026-11-24T10:00', modo: 'ninguem_atende' }).motivo).toBe('beco');
    expect(executar(doc({ pecas: [peca('a', 'audio')] }), { entrada: 'peca:a', inicio: '2026-11-24T10:00' }).motivo).toBe('beco');
    expect(executar(doc({}), { entrada: 'externo:celular', inicio: '2026-11-24T10:00' }).motivo).toBe('saiu_da_central');
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/motor/execucao.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/motor/execucao.ts`:

```ts
import type { Canal, Documento, Expressao, Peca } from '../formato/documento';
import { existe, indexar, type Indice } from '../formato/indice';
import { lerRef } from '../formato/refs';
import { dentroDoHorario, ehFeriado, lerInicio, somar } from './relogio';

export type QuemDecide = 'quem_liga' | 'relogio' | 'sistema' | 'fila' | 'grupo' | 'ramal';
export type Motivo = 'fim' | 'atendido' | 'desistiu' | 'beco' | 'destino_inexistente' | 'ciclo' | 'saiu_da_central';
export type Como = 'cenario' | 'relogio' | 'unica' | 'resposta' | 'ninguem_atende';

export interface Opcao {
  opcao: string;
  rotulo: string;
  /** Pra onde leva. Sem para e sem termina = beco sem saída. */
  para?: string;
  termina?: 'atendido' | 'desistiu';
  /** false quando a condição "quando" não bate com as variáveis. */
  disponivel: boolean;
  /** Tempo que a escolha consome. */
  segundos: number;
  /** O tempo é um exemplo, não vem da central. */
  exemplo?: boolean;
  define?: Expressao;
}

export type Evento =
  | { tipo: 'chegou'; ref: string; visita: number; t: number }
  | { tipo: 'trocou_canal'; ref: string; de: Canal; para: Canal; t: number }
  | { tipo: 'decisao'; ref: string; quem: QuemDecide; opcoes: Opcao[]; sugestao?: string; t: number }
  | { tipo: 'escolheu'; ref: string; opcao: string; como: Como; t: number }
  | { tipo: 'definiu'; ref: string; chave: string; valor: string; t: number }
  | { tipo: 'correu'; de: string; para: string; opcao: string; t: number }
  | { tipo: 'terminou'; ref: string; motivo: Motivo; detalhe?: string; t: number };

type SemT<E> = E extends unknown ? Omit<E, 't'> : never;

export interface OpcoesExecucao {
  /** Por onde a ligação entra: entrada:…, ou qualquer outra referência (ramal:9004, peca:…). */
  entrada: string;
  /** Hora de parede do início, AAAA-MM-DDTHH:MM. */
  inicio: string;
  /** cenario (padrão): relógio e respostas decidem sozinhos. livre: tudo é perguntado. ninguem_atende: filas, grupos e ramais não atendem. */
  modo?: 'cenario' | 'livre' | 'ninguem_atende';
  /** Respostas por referência. Lista = uma resposta por visita. */
  respostas?: Record<string, string | readonly string[]>;
  /** Termina como ciclo quando um ponto é alcançado esta quantidade de vezes. Padrão 3; no modo livre, sem limite. */
  limiteVisitas?: number;
}

export class Execucao {
  readonly eventos: Evento[] = [];
  readonly inicioMs: number;
  private readonly idx: Indice;
  private readonly modo: 'cenario' | 'livre' | 'ninguem_atende';
  private readonly limite: number;
  private readonly respostas = new Map<string, string[]>();
  private atual: string;
  private t = 0;
  private canal: Canal = 'telefonia';
  private vars: Record<string, string> = {};
  private visitas = new Map<string, number>();
  private aguardando: { ref: string; opcoes: Opcao[] } | null = null;
  private motivoFim: Motivo | null = null;

  constructor(fonte: Documento | Indice, opcoes: OpcoesExecucao) {
    this.idx = 'formato' in fonte ? indexar(fonte) : fonte;
    this.inicioMs = lerInicio(opcoes.inicio);
    this.modo = opcoes.modo ?? 'cenario';
    this.limite = opcoes.limiteVisitas ?? (this.modo === 'livre' ? Infinity : 3);
    for (const [ref, r] of Object.entries(opcoes.respostas ?? {})) this.respostas.set(ref, typeof r === 'string' ? [r] : [...r]);
    this.atual = opcoes.entrada;
  }

  get terminou(): boolean {
    return this.motivoFim !== null;
  }
  get motivo(): Motivo | null {
    return this.motivoFim;
  }
  /** A decisão esperando resposta, se houver. */
  get pendente(): { ref: string; opcoes: Opcao[] } | null {
    return this.aguardando;
  }
  get variaveis(): Record<string, string> {
    return { ...this.vars };
  }
  get segundos(): number {
    return this.t;
  }
  relogio(t: number = this.t): number {
    return somar(this.inicioMs, t);
  }

  /** Anda até terminar ou parar numa decisão sem resposta. Devolve os eventos novos. */
  avancar(resposta?: string): Evento[] {
    const inicio = this.eventos.length;
    if (this.aguardando) {
      if (resposta === undefined) return [];
      const o = this.aguardando.opcoes.find((x) => x.opcao === resposta && x.disponivel);
      if (!o) throw new Error(`"${resposta}" não é uma opção disponível em ${this.aguardando.ref}`);
      const ref = this.aguardando.ref;
      this.aguardando = null;
      this.emitir({ tipo: 'escolheu', ref, opcao: o.opcao, como: 'resposta' });
      this.aplicar(ref, o);
    }
    for (let guarda = 0; !this.motivoFim && !this.aguardando; guarda++) {
      if (guarda > 10_000) throw new Error('a execução não terminou em 10.000 passos');
      this.passo();
    }
    return this.eventos.slice(inicio);
  }

  private emitir(e: SemT<Evento>): void {
    this.eventos.push({ ...e, t: this.t } as Evento);
  }

  private terminar(ref: string, motivo: Motivo, detalhe?: string): void {
    this.motivoFim = motivo;
    this.emitir(detalhe ? { tipo: 'terminou', ref, motivo, detalhe } : { tipo: 'terminou', ref, motivo });
  }

  private seguir(de: string, para: string, opcao: string): void {
    this.emitir({ tipo: 'correu', de, para, opcao });
    this.atual = para;
  }

  private passo(): void {
    const ref = this.atual;
    const visita = (this.visitas.get(ref) ?? 0) + 1;
    this.visitas.set(ref, visita);
    this.emitir({ tipo: 'chegou', ref, visita });
    if (visita >= this.limite) return this.terminar(ref, 'ciclo', `${ref} recebeu a ligação ${visita} vezes`);
    if (ref === 'fim:atendido') return this.terminar(ref, 'atendido');
    if (ref.startsWith('fim:')) return this.terminar(ref, 'fim');
    if (ref.startsWith('externo:')) return this.terminar(ref, 'saiu_da_central');
    if (!existe(this.idx, ref)) return this.terminar(ref, 'destino_inexistente');

    const r = lerRef(ref)!;
    if (r.tipo === 'entrada') {
      const e = this.idx.entradas.get(r.id)!;
      this.canal = e.canal;
      return this.seguir(ref, e.destino, 'sempre');
    }
    if (r.tipo === 'peca') {
      const p = this.idx.pecas.get(r.id)!;
      if (p.canal && p.canal !== this.canal) {
        this.emitir({ tipo: 'trocou_canal', ref, de: this.canal, para: p.canal });
        this.canal = p.canal;
      }
      if (p.tipo === 'fim') return this.terminar(ref, 'fim');
      this.t += p.duracao_s ?? 0;
    }

    const opcoes = this.opcoesDe(ref);
    if (opcoes.length === 0) return this.terminar(ref, 'beco');
    const quem = this.quemDecide(ref);
    if (quem === null) return this.aplicar(ref, opcoes[0]!);

    const disponiveis = opcoes.filter((o) => o.disponivel);
    const auto = this.respostaAutomatica(ref, disponiveis, opcoes.length);
    const sugestao = this.respostaDoRelogio(ref);
    this.emitir(sugestao ? { tipo: 'decisao', ref, quem, opcoes, sugestao } : { tipo: 'decisao', ref, quem, opcoes });
    if (!auto) {
      this.aguardando = { ref, opcoes };
      return;
    }
    const o = disponiveis.find((x) => x.opcao === auto.opcao);
    if (!o) return this.terminar(ref, 'beco', `não existe saída "${auto.opcao}"`);
    this.emitir({ tipo: 'escolheu', ref, opcao: o.opcao, como: auto.como });
    this.aplicar(ref, o);
  }

  private aplicar(ref: string, o: Opcao): void {
    this.t += o.segundos;
    if (o.define) {
      this.vars[o.define.chave] = o.define.valor;
      this.emitir({ tipo: 'definiu', ref, chave: o.define.chave, valor: o.define.valor });
    }
    if (o.termina) return this.terminar(ref, o.termina);
    if (!o.para) return this.terminar(ref, 'beco', `"${o.rotulo}" não leva a lugar nenhum`);
    this.seguir(ref, o.para, o.opcao);
  }

  private quemDecide(ref: string): QuemDecide | null {
    const r = lerRef(ref)!;
    if (r.tipo === 'fila' || r.tipo === 'grupo' || r.tipo === 'ramal') return r.tipo;
    if (r.tipo !== 'peca') return null;
    const p = this.idx.pecas.get(r.id)!;
    if (p.tipo === 'menu') return 'quem_liga';
    if (p.tipo === 'regra_horario' || p.tipo === 'regra_feriado') return 'relogio';
    return (this.idx.saidasDe.get(r.id)?.length ?? 0) > 1 ? 'sistema' : null;
  }

  private opcoesDe(ref: string): Opcao[] {
    const r = lerRef(ref)!;
    if (r.tipo === 'peca') {
      const p = this.idx.pecas.get(r.id)!;
      return (this.idx.saidasDe.get(r.id) ?? []).map((s) => {
        const o: Opcao = {
          opcao: s.opcao,
          rotulo: s.rotulo ?? s.opcao,
          para: s.para,
          disponivel: !s.quando || this.vars[s.quando.chave] === undefined || this.vars[s.quando.chave] === s.quando.valor,
          segundos: p.tipo === 'menu' ? (s.opcao === 'esgotou' ? (p.espera_s ?? 5) * (p.tentativas ?? 1) : 3) : 0,
        };
        if (s.define) o.define = s.define;
        return o;
      });
    }
    if (r.tipo === 'fila') {
      const f = this.idx.filas.get(r.id)!;
      const espera = f.espera_maxima_s;
      return [
        { opcao: 'atende', rotulo: 'Alguém atende', termina: 'atendido', disponivel: true, segundos: 30, exemplo: true },
        espera !== undefined
          ? { opcao: 'nao_atende', rotulo: `Ninguém atende em ${espera} s`, para: f.ao_esgotar ?? 'fim:desliga', disponivel: true, segundos: espera }
          : { opcao: 'nao_atende', rotulo: 'Ninguém atende e a fila não tem tempo máximo', termina: 'desistiu', disponivel: true, segundos: 180, exemplo: true },
      ];
    }
    if (r.tipo === 'grupo') {
      const g = this.idx.grupos.get(r.id)!;
      const toque = g.toque_s ?? 20;
      return [
        { opcao: 'atende', rotulo: 'Alguém atende', termina: 'atendido', disponivel: true, segundos: Math.min(toque, 10), exemplo: true },
        { opcao: 'nao_atende', rotulo: `Ninguém atende em ${toque} s`, para: g.ao_esgotar, disponivel: true, segundos: toque },
      ];
    }
    if (r.tipo === 'ramal') {
      const x = this.idx.ramais.get(r.id)!;
      const toque = x.siga_me_so_ramal_s !== undefined && x.siga_me_com_lista_s !== undefined ? x.siga_me_so_ramal_s + x.siga_me_com_lista_s : (x.toque_s ?? 20);
      return [
        { opcao: 'atende', rotulo: 'Atende', termina: 'atendido', disponivel: true, segundos: Math.min(toque, 8), exemplo: true },
        { opcao: 'nao_atende', rotulo: `Não atende em ${toque} s`, para: x.ao_nao_atender, disponivel: true, segundos: toque },
      ];
    }
    return [];
  }

  private respostaDoRelogio(ref: string): string | undefined {
    const r = lerRef(ref);
    if (r?.tipo !== 'peca') return undefined;
    const p: Peca | undefined = this.idx.pecas.get(r.id);
    const agora = this.relogio();
    if (p?.tipo === 'regra_horario') {
      const grupo = p.horario ? lerRef(p.horario)?.id : undefined;
      return dentroDoHorario(this.idx.janelas.get(grupo ?? '') ?? [], agora) ? 'sim' : 'nao';
    }
    if (p?.tipo === 'regra_feriado') return ehFeriado(this.idx.feriados.get(p.calendario ?? '') ?? [], agora) ? 'sim' : 'nao';
    return undefined;
  }

  private respostaAutomatica(ref: string, disponiveis: Opcao[], total: number): { opcao: string; como: Como } | null {
    const fila = this.respostas.get(ref);
    if (fila && fila.length > 0) {
      const opcao = fila.shift()!;
      if (disponiveis.some((o) => o.opcao === opcao)) return { opcao, como: 'cenario' };
    }
    if (this.modo !== 'livre') {
      const doRelogio = this.respostaDoRelogio(ref);
      if (doRelogio) return { opcao: doRelogio, como: 'relogio' };
    }
    const tipo = lerRef(ref)?.tipo;
    if (this.modo === 'ninguem_atende' && (tipo === 'fila' || tipo === 'grupo' || tipo === 'ramal')) return { opcao: 'nao_atende', como: 'ninguem_atende' };
    if (disponiveis.length === 1 && total > 1) return { opcao: disponiveis[0]!.opcao, como: 'unica' };
    return null;
  }
}

/** Cria a execução e anda até terminar ou parar numa decisão. */
export function executar(fonte: Documento | Indice, opcoes: OpcoesExecucao): Execucao {
  const e = new Execucao(fonte, opcoes);
  e.avancar();
  return e;
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/motor/execucao.test.ts`

Esperado: PASSA, 11 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/motor/execucao.ts packages/nucleo/test/motor/execucao.test.ts
git commit -m "feat(nucleo): motor de simulação" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 16: Diagnóstico: tipos e alcance

Os tipos de achado com gravidade fixa (spec 12.2), e o alcance: pra onde a ligação pode ir a partir de cada ponto, o que as entradas alcançam e o destino final de uma peça de saída única.

**Arquivos:**
- Criar: `packages/nucleo/src/diagnostico/tipos.ts`
- Criar: `packages/nucleo/src/diagnostico/alcance.ts`
- Teste: `packages/nucleo/test/diagnostico/alcance.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/diagnostico/alcance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { indexar } from '../../src/formato/indice';
import { alcancaveis, destinoFinal, vizinhos } from '../../src/diagnostico/alcance';
import { doc, entrada, fila, grupo, peca, ramal, saida } from '../apoio';

describe('alcance', () => {
  const idx = indexar(
    doc({
      entradas: [entrada('e', 'peca:a')],
      pecas: [peca('a', 'audio'), peca('m', 'menu'), peca('solta', 'audio')],
      saidas: [saida('a', 'sempre', 'peca:m'), saida('m', '1', 'ramal:1'), saida('m', '2', 'fila:9')],
      ramais: [ramal('1', { ao_nao_atender: 'grupo:5', ao_ocupado: 'fim:desliga' })],
      filas: [fila('9', { ao_esgotar: 'fila:10', pesquisa_ao_desligar: 'peca:nps' })],
      grupos: [grupo('5', { ao_esgotar: 'fim:caixa_postal' })],
    }),
  );

  it('vizinhos de cada tipo', () => {
    expect(vizinhos(idx, 'entrada:e')).toEqual(['peca:a']);
    expect(vizinhos(idx, 'peca:m')).toEqual(['ramal:1', 'fila:9']);
    expect(vizinhos(idx, 'ramal:1')).toEqual(['grupo:5', 'fim:desliga']);
    expect(vizinhos(idx, 'fila:9')).toEqual(['fila:10', 'peca:nps']);
    expect(vizinhos(idx, 'grupo:5')).toEqual(['fim:caixa_postal']);
  });

  it('alcançáveis a partir das entradas', () => {
    const alc = alcancaveis(idx);
    expect(alc.has('grupo:5')).toBe(true);
    expect(alc.has('peca:solta')).toBe(false);
  });

  it('destino final atravessa peças de saída única e para no menu', () => {
    expect(destinoFinal(idx, 'peca:a')).toBe('peca:m');
    expect(destinoFinal(idx, 'fila:9')).toBe('fila:9');
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/diagnostico/alcance.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/diagnostico/tipos.ts`:

```ts
export type Gravidade = 'grave' | 'alerta' | 'observacao';

export type TipoAchado =
  | 'beco_sem_saida'
  | 'destino_inexistente'
  | 'ciclo_transbordo'
  | 'volta_sem_limite'
  | 'redundancia'
  | 'sem_entrada'
  | 'no_inativo'
  | 'volta_propria_fila'
  | 'grupo_desliga'
  | 'buraco_horario'
  | 'espera_sem_limite'
  | 'plano_b_nao_dispara'
  | 'dado_incompleto';

export const GRAVIDADE: Record<TipoAchado, Gravidade> = {
  beco_sem_saida: 'grave',
  destino_inexistente: 'grave',
  ciclo_transbordo: 'grave',
  volta_sem_limite: 'alerta',
  redundancia: 'alerta',
  sem_entrada: 'alerta',
  no_inativo: 'alerta',
  volta_propria_fila: 'alerta',
  grupo_desliga: 'alerta',
  buraco_horario: 'observacao',
  espera_sem_limite: 'observacao',
  plano_b_nao_dispara: 'observacao',
  dado_incompleto: 'observacao',
};

export interface Achado {
  tipo: TipoAchado;
  gravidade: Gravidade;
  /** Estável entre imports: tipo + referências. Usada pra marcar como intencional. */
  chave: string;
  titulo: string;
  texto: string;
  /** Referências envolvidas, a principal primeiro. */
  refs: string[];
  /** Campos de origem, quando o achado vem de colunas específicas (ex.: ao_nao_atender). */
  campos?: string[];
}

export function achado(tipo: TipoAchado, chave: string, titulo: string, texto: string, refs: string[], campos?: string[]): Achado {
  const a: Achado = { tipo, gravidade: GRAVIDADE[tipo], chave: `${tipo}:${chave}`, titulo, texto, refs };
  if (campos) a.campos = campos;
  return a;
}
```

Criar `packages/nucleo/src/diagnostico/alcance.ts`:

```ts
import type { Indice } from '../formato/indice';
import { lerRef } from '../formato/refs';

const definidos = (...refs: (string | undefined)[]) => refs.filter((r): r is string => r !== undefined);

/** Pra onde a ligação pode ir a partir de uma referência. */
export function vizinhos(idx: Indice, ref: string): string[] {
  const r = lerRef(ref);
  if (!r) return [];
  switch (r.tipo) {
    case 'entrada': {
      const e = idx.entradas.get(r.id);
      return e ? [e.destino] : [];
    }
    case 'peca':
      return (idx.saidasDe.get(r.id) ?? []).map((s) => s.para);
    case 'ramal': {
      const x = idx.ramais.get(r.id);
      return x ? definidos(x.ao_nao_atender, x.ao_ocupado, x.ao_indisponivel) : [];
    }
    case 'fila': {
      const f = idx.filas.get(r.id);
      return f ? definidos(f.ao_esgotar, f.pesquisa_ao_desligar) : [];
    }
    case 'grupo': {
      const g = idx.grupos.get(r.id);
      return g ? definidos(g.ao_esgotar) : [];
    }
    default:
      return [];
  }
}

/** Tudo que alguma entrada alcança. */
export function alcancaveis(idx: Indice): Set<string> {
  const vistos = new Set<string>();
  const pilha = idx.doc.entradas.map((e) => `entrada:${e.id}`);
  while (pilha.length > 0) {
    const ref = pilha.pop()!;
    if (vistos.has(ref)) continue;
    vistos.add(ref);
    for (const v of vizinhos(idx, ref)) if (!vistos.has(v)) pilha.push(v);
  }
  return vistos;
}

/** Segue peças de saída única (que não são menu) até um ponto de decisão ou destino. */
export function destinoFinal(idx: Indice, ref: string): string {
  let atual = ref;
  for (let i = 0; i < 30; i++) {
    const r = lerRef(atual);
    if (r?.tipo !== 'peca') return atual;
    const p = idx.pecas.get(r.id);
    const saidas = idx.saidasDe.get(r.id) ?? [];
    if (!p || p.tipo === 'menu' || saidas.length !== 1) return atual;
    atual = saidas[0]!.para;
  }
  return atual;
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/diagnostico/alcance.test.ts`

Esperado: PASSA, 3 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/diagnostico/tipos.ts packages/nucleo/src/diagnostico/alcance.ts packages/nucleo/test/diagnostico/alcance.test.ts
git commit -m "feat(nucleo): tipos de achado e alcance" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 17: Diagnóstico das peças

Becos sem saída, volta sem limite (só a saída que fecha o círculo), redundância (opções do mesmo menu que terminam no mesmo lugar), sem entrada, nó inativo e dados incompletos.

**Arquivos:**
- Criar: `packages/nucleo/src/diagnostico/pecas.ts`
- Teste: `packages/nucleo/test/diagnostico/pecas.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/diagnostico/pecas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { indexar } from '../../src/formato/indice';
import { alcancaveis } from '../../src/diagnostico/alcance';
import { becos, dadosIncompletos, nosInativos, redundancias, semEntrada, voltasSemLimite } from '../../src/diagnostico/pecas';
import { doc, entrada, fila, peca, saida } from '../apoio';

describe('diagnóstico das peças', () => {
  const idx = indexar(
    doc({
      entradas: [entrada('e', 'peca:menu')],
      pecas: [
        peca('menu', 'menu', { nome: 'Menu', espera_s: 5, tentativas: 2 }),
        peca('sub', 'menu', { nome: 'Sub', espera_s: 5, tentativas: 2 }),
        peca('aviso', 'audio', { nome: 'Aviso' }),
        peca('mudo', 'audio', { nome: 'Mudo' }),
        peca('solta', 'audio'),
      ],
      saidas: [
        saida('menu', '1', 'peca:sub'),
        saida('menu', '2', 'peca:aviso'),
        saida('menu', '3', 'fila:1'),
        saida('menu', 'esgotou', 'peca:apagada'),
        saida('menu', '9', 'peca:mudo'),
        saida('sub', '0', 'peca:menu'),
        saida('sub', '1', 'fila:1'),
        saida('sub', 'esgotou', 'fila:2', { ativo: false }),
        saida('aviso', 'sempre', 'fila:1'),
      ],
      filas: [fila('1'), fila('2')],
    }),
  );
  const alc = alcancaveis(idx);

  it('becos: peça alcançável sem saída e saída pra peça que não existe', () => {
    expect(becos(idx, alc).map((a) => a.chave)).toEqual(['beco_sem_saida:peca:mudo', 'beco_sem_saida:saida:menu-esgotou']);
  });

  it('volta sem limite só na saída que fecha o círculo', () => {
    expect(voltasSemLimite(idx, alc).map((a) => a.chave)).toEqual(['volta_sem_limite:saida:sub-0']);
  });

  it('redundância atravessa peças de saída única', () => {
    const r = redundancias(idx, alc);
    expect(r.map((a) => a.chave)).toEqual(['redundancia:peca:menu>fila:1']);
    expect(r[0]!.texto).toBe('As opções 2 e 3 de Menu terminam no mesmo lugar: fila 1.');
  });

  it('sem entrada', () => {
    expect(semEntrada(idx, alc).map((a) => a.chave)).toEqual(['sem_entrada:peca:solta']);
  });

  it('nó inativo no caminho', () => {
    expect(nosInativos(idx, alc).map((a) => a.chave)).toEqual(['no_inativo:saida:sub-esgotou']);
  });

  it('dados incompletos viram observação', () => {
    const a = dadosIncompletos(indexar(doc({ pecas: [peca('m', 'menu')] })));
    expect(a.map((x) => x.chave)).toEqual(['dado_incompleto:menu_sem_tempo:peca:m', 'dado_incompleto:menu_sem_esgotou:peca:m']);
    expect(a[0]!.gravidade).toBe('observacao');
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/diagnostico/pecas.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/diagnostico/pecas.ts`:

```ts
import { completude } from '../formato/completude';
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
    if (!alc.has(s.de) || existe(idx, s.para)) continue;
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

/** Dados que faltam pra simular direito. */
export function dadosIncompletos(idx: Indice): Achado[] {
  return completude(idx).map((p) => achado('dado_incompleto', `${p.regra}:${p.ref}`, `${nomeDe(idx, p.ref)}: falta informação`, p.mensagem[0]!.toUpperCase() + p.mensagem.slice(1) + '.', [p.ref]));
}
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/diagnostico/pecas.test.ts`

Esperado: PASSA, 6 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/diagnostico/pecas.ts packages/nucleo/test/diagnostico/pecas.test.ts
git commit -m "feat(nucleo): diagnóstico das peças" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 18: Diagnóstico de transbordo

Destino inexistente (com os campos de origem), ciclos entre ramais e quem cai neles, volta pra própria fila (respeitando anti-loop), grupo que desliga, espera sem limite e plano B que não dispara.

**Arquivos:**
- Criar: `packages/nucleo/src/diagnostico/transbordo.ts`
- Teste: `packages/nucleo/test/diagnostico/transbordo.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/diagnostico/transbordo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { indexar } from '../../src/formato/indice';
import { ciclosDeTransbordo, destinosInexistentes, esperaSemLimite, gruposQueDesligam, planoBQueNaoDispara, voltaPropriaFila } from '../../src/diagnostico/transbordo';
import { doc, fila, grupo, ramal } from '../apoio';

describe('diagnóstico de transbordo', () => {
  const idx = indexar(
    doc({
      ramais: [
        ramal('1', { ao_nao_atender: 'ramal:2' }),
        ramal('2', { ao_nao_atender: 'ramal:3' }),
        ramal('3', { ao_nao_atender: 'ramal:2' }),
        ramal('4', { ao_nao_atender: 'ramal:99', siga_me_lista: ['ramal:98'] }),
        ramal('5', { ao_nao_atender: 'fila:10' }),
        ramal('6', { ao_nao_atender: 'fila:10', transbordo_anti_loop: true }),
      ],
      filas: [fila('10', { membros: ['ramal:5', 'ramal:6'], ao_esgotar: 'fila:11' }), fila('11', { espera_maxima_s: 60, ao_esgotar: 'fim:desliga' })],
      grupos: [grupo('20', { ao_esgotar: 'fim:desliga' }), grupo('21', { ao_esgotar: 'fim:caixa_postal' })],
    }),
  );

  it('destino inexistente, agrupado por alvo, com os campos de origem', () => {
    expect(destinosInexistentes(idx).map((a) => [a.chave, a.campos])).toEqual([
      ['destino_inexistente:ramal:4>ramal:99', ['ao_nao_atender']],
      ['destino_inexistente:ramal:4>ramal:98', ['siga_me_lista']],
    ]);
  });

  it('ciclo com quem cai nele', () => {
    const c = ciclosDeTransbordo(idx);
    expect(c).toHaveLength(1);
    expect(c[0]!.titulo).toBe('Ciclo entre 2 ↔ 3');
    expect(c[0]!.refs).toEqual(['ramal:2', 'ramal:3', 'ramal:1']);
    expect(c[0]!.texto).toContain('3 ramais caem nesse ciclo');
  });

  it('volta pra própria fila, menos com anti-loop', () => {
    expect(voltaPropriaFila(idx).map((a) => a.chave)).toEqual(['volta_propria_fila:ramal:5>fila:10']);
  });

  it('grupo que desliga', () => {
    expect(gruposQueDesligam(idx).map((a) => a.chave)).toEqual(['grupo_desliga:grupo:20']);
  });

  it('espera sem limite e plano B que não dispara', () => {
    expect(esperaSemLimite(idx).map((a) => a.chave)).toEqual(['espera_sem_limite:fila:10']);
    expect(planoBQueNaoDispara(idx).map((a) => a.chave)).toEqual(['plano_b_nao_dispara:fila:10']);
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/diagnostico/transbordo.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/diagnostico/transbordo.ts`:

```ts
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
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/diagnostico/transbordo.test.ts`

Esperado: PASSA, 5 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/diagnostico/transbordo.ts packages/nucleo/test/diagnostico/transbordo.test.ts
git commit -m "feat(nucleo): diagnóstico de transbordo" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 19: Agenda e buracos de horário

A agenda semanal "quem atende quando" (ignorando feriados) e o achado de buraco: janela de menos de 60 minutos que cai num destino diferente dos vizinhos.

**Arquivos:**
- Criar: `packages/nucleo/src/diagnostico/horario.ts`
- Teste: `packages/nucleo/test/diagnostico/horario.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/diagnostico/horario.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { indexar } from '../../src/formato/indice';
import { alcancaveis } from '../../src/diagnostico/alcance';
import { agendaSemanal, buracosDeHorario, destinoNoHorario } from '../../src/diagnostico/horario';
import { lerInicio } from '../../src/motor/relogio';
import { doc, entrada, janela, peca, saida } from '../apoio';

describe('agenda e buracos de horário', () => {
  const idx = indexar(
    doc({
      entradas: [entrada('e', 'peca:feriado')],
      horarios: [janela('dia', ['seg', 'ter', 'qua', 'qui', 'sex'], '08:30', '16:55'), janela('est', ['seg', 'ter', 'qua', 'qui', 'sex'], '17:00', '18:00'), janela('est', ['sab'], '09:00', '12:00')],
      feriados: [{ id: 'f', calendario: 'nacional', data: '2024-01-01', todo_ano: true }],
      pecas: [
        peca('feriado', 'regra_feriado', { calendario: 'nacional' }),
        peca('dia', 'regra_horario', { horario: 'horario:dia' }),
        peca('est', 'regra_horario', { horario: 'horario:est' }),
        peca('ura-dia', 'audio', { nome: 'URA dia' }),
        peca('ura-est', 'audio', { nome: 'URA estendido' }),
        peca('ura-fora', 'audio', { nome: 'URA fora' }),
      ],
      saidas: [
        saida('feriado', 'sim', 'peca:ura-fora'),
        saida('feriado', 'nao', 'peca:dia'),
        saida('dia', 'sim', 'peca:ura-dia'),
        saida('dia', 'nao', 'peca:est'),
        saida('est', 'sim', 'peca:ura-est'),
        saida('est', 'nao', 'peca:ura-fora'),
      ],
    }),
  );

  it('agenda semanal, ignorando feriados', () => {
    const a = agendaSemanal(idx, 'peca:feriado');
    expect(a[0]).toEqual([
      { inicio: 0, fim: 510, destino: 'peca:ura-fora' },
      { inicio: 510, fim: 1015, destino: 'peca:ura-dia' },
      { inicio: 1015, fim: 1020, destino: 'peca:ura-fora' },
      { inicio: 1020, fim: 1080, destino: 'peca:ura-est' },
      { inicio: 1080, fim: 1440, destino: 'peca:ura-fora' },
    ]);
    expect(a[6]).toEqual([{ inicio: 0, fim: 1440, destino: 'peca:ura-fora' }]);
  });

  it('acha o buraco de 5 minutos nos dias úteis', () => {
    const b = buracosDeHorario(idx, alcancaveis(idx));
    expect(b).toHaveLength(1);
    expect(b[0]!.titulo).toBe('seg, ter, qua, qui, sex 16:55–17:00');
    expect(b[0]!.texto).toBe('Nesses 5 minutos a ligação que passa por peca:feriado cai em URA fora, entre URA dia e URA estendido.');
  });

  it('destinoNoHorario respeita o feriado quando pedido', () => {
    const quintaFeriado = lerInicio('2026-01-01T10:00');
    expect(destinoNoHorario(idx, 'peca:feriado', quintaFeriado, false)).toBe('peca:ura-fora');
    expect(destinoNoHorario(idx, 'peca:feriado', quintaFeriado, true)).toBe('peca:ura-dia');
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/diagnostico/horario.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/diagnostico/horario.ts`:

```ts
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
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/diagnostico/horario.test.ts`

Esperado: PASSA, 3 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/diagnostico/horario.ts packages/nucleo/test/diagnostico/horario.test.ts
git commit -m "feat(nucleo): agenda semanal e buracos de horário" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 20: Diagnosticar e exportações do pacote

`diagnosticar` junta todas as regras e ordena do mais grave pro mais leve. `src/index.ts` define o que o pacote exporta.

**Arquivos:**
- Criar: `packages/nucleo/src/diagnostico/diagnosticar.ts`
- Criar: `packages/nucleo/src/index.ts`
- Teste: `packages/nucleo/test/diagnostico/diagnosticar.test.ts`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `packages/nucleo/test/diagnostico/diagnosticar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { diagnosticar } from '../../src/diagnostico/diagnosticar';
import { doc, entrada, fila, peca, ramal, saida } from '../apoio';

describe('diagnosticar', () => {
  it('junta todas as regras, do mais grave pro mais leve', () => {
    const achados = diagnosticar(
      doc({
        entradas: [entrada('e', 'peca:menu')],
        pecas: [peca('menu', 'menu', { espera_s: 5, tentativas: 2 })],
        saidas: [saida('menu', '1', 'fila:1'), saida('menu', '2', 'fila:1'), saida('menu', 'esgotou', 'peca:apagada')],
        filas: [fila('1')],
        ramais: [ramal('7', { ao_nao_atender: 'ramal:8' }), ramal('8', { ao_nao_atender: 'ramal:7' })],
      }),
    );
    expect(achados.map((a) => a.tipo)).toEqual(['beco_sem_saida', 'ciclo_transbordo', 'redundancia', 'espera_sem_limite']);
    expect(achados.map((a) => a.gravidade)).toEqual(['grave', 'grave', 'alerta', 'observacao']);
  });
});
```

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npm test -w packages/nucleo -- test/diagnostico/diagnosticar.test.ts`

Esperado: FALHA. O módulo ainda não existe ("Failed to resolve import").

- [ ] **Passo 3: Implementar**

Criar `packages/nucleo/src/diagnostico/diagnosticar.ts`:

```ts
import type { Documento } from '../formato/documento';
import { indexar, type Indice } from '../formato/indice';
import { alcancaveis } from './alcance';
import { buracosDeHorario } from './horario';
import { becos, dadosIncompletos, nosInativos, redundancias, semEntrada, voltasSemLimite } from './pecas';
import type { Achado } from './tipos';
import { ciclosDeTransbordo, destinosInexistentes, esperaSemLimite, gruposQueDesligam, planoBQueNaoDispara, voltaPropriaFila } from './transbordo';

const ORDEM = { grave: 0, alerta: 1, observacao: 2 } as const;

/** Todos os achados, do mais grave pro mais leve. */
export function diagnosticar(fonte: Documento | Indice): Achado[] {
  const idx = 'formato' in fonte ? indexar(fonte) : fonte;
  const alc = alcancaveis(idx);
  const todos = [
    ...becos(idx, alc),
    ...destinosInexistentes(idx),
    ...ciclosDeTransbordo(idx),
    ...voltasSemLimite(idx, alc),
    ...redundancias(idx, alc),
    ...semEntrada(idx, alc),
    ...nosInativos(idx, alc),
    ...voltaPropriaFila(idx),
    ...gruposQueDesligam(idx),
    ...buracosDeHorario(idx, alc),
    ...esperaSemLimite(idx),
    ...planoBQueNaoDispara(idx),
    ...dadosIncompletos(idx),
  ];
  return todos.sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade] || a.chave.localeCompare(b.chave));
}
```

Criar `packages/nucleo/src/index.ts`:

```ts
export * from './formato/refs';
export * from './formato/documento';
export * from './formato/abas';
export * from './formato/celulas';
export * from './formato/indice';
export * from './formato/completude';
export * from './importacao/problemas';
export * from './importacao/csv';
export * from './importacao/ler-arquivos';
export * from './importacao/analisar';
export * from './importacao/validar';
export * from './importacao/juntar';
export * from './importacao/ajustes';
export * from './importacao/importar';
export * from './modelos/json';
export * from './modelos/xlsx';
export * from './motor/relogio';
export * from './motor/execucao';
export * from './diagnostico/tipos';
export * from './diagnostico/alcance';
export * from './diagnostico/horario';
export * from './diagnostico/diagnosticar';
```

- [ ] **Passo 4: Rodar o teste e ver passar**

Rodar: `npm test -w packages/nucleo -- test/diagnostico/diagnosticar.test.ts`

Esperado: PASSA, 1 testes.

Rodar: `npm run typecheck -w packages/nucleo`

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/src/diagnostico/diagnosticar.ts packages/nucleo/src/index.ts packages/nucleo/test/diagnostico/diagnosticar.test.ts
git commit -m "feat(nucleo): diagnosticar e exportações" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 21: Fixture da central de 11/11/2026

A central real, sem nomes, vira material de teste (spec 17). A parte da URA (`pecas`, `saidas`, `horarios`, `feriados`) foi escrita à mão a partir do `fluxo.json` do export. A parte das tabelas (`entradas`, `ramais`, `filas`, `grupos`) é gerada por script, trocando os nomes por "Pessoa NNN" e os celulares por `externo:celular`.

**Arquivos:**
- Criar: `packages/nucleo/test/fixtures/central/pecas.csv`, `saidas.csv`, `horarios.csv`, `feriados.csv`
- Criar: `packages/nucleo/scripts/gerar-fixture.ts`
- Gerar: `packages/nucleo/test/fixtures/central/entradas.csv`, `ramais.csv`, `filas.csv`, `grupos.csv`

- [ ] **Passo 1: Criar a parte escrita à mão**

Criar `packages/nucleo/test/fixtures/central/pecas.csv`:

```csv
id;tipo;nome;horario;calendario;espera_s;tentativas;guarda_variavel;canal;id_central;observacao
tc-3;regra_feriado;Feriado?;;padrao;;;;;timeconditions 3;
tc-2;regra_horario;Seg–sex 8h30–16h55?;horario:tg1;;;;;;timeconditions 2;
tc-1;regra_horario;Horário estendido?;horario:tg2;;;;;;timeconditions 1;
fase-11;audio;URA 8889 · entrada padrão;;;;;;;wf2 fase 11;
fase-305;menu;Oferta WhatsApp;;;4;1;;;wf2 fase 305;
fase-311;fim;Áudio com o número do WhatsApp;;;;;;whatsapp;wf2 fases 311/310;fala 51 3327-9001 e desliga
fase-16;menu;Menu principal;;;5;3;;;wf2 fase 16;
fase-1;audio;URA 8888 · 2ª via do boleto;;;;;;;wf1 fase 1;
fase-252;menu;Boleto de quê?;;;3;2;tipo;;wf1 fase 252;
fase-252-fim;fim;Encerra (esgotou);;;;;;;wf1 fase 252;
fase-206;menu;Digite CPF/CNPJ;;;7;2;;;wf1 fase 206;
fase-5;consulta;Busca 2ª via e manda por e-mail;;;;;;;wf1 fases 5/7;
fase-8;fim;Boleto por e-mail · protocolo Plusoft;;;;;;email;wf1 fases 8/209/211;
fase-341;consulta;Agência Virtual: é proprietário?;;;;;;;wf2 fases 341/340/339;
fase-30;menu;Submenu Aluguéis;;;4;2;;;wf2 fase 30;
fase-31;menu;Submenu Condomínios;;;2;2;;;wf2 fase 31;
fase-62;audio;URA 8887 · fim de semana e estendido;;;;;;;wf3 fase 62;
fase-64;menu;Menu estendido;;;4;2;;;wf3 fase 64;
fase-76;menu;Alugar (estendido);;;4;2;;;wf3 fase 76;
fase-103;regra_feriado;URA 8886 · feriado?;;padrao;;;;;wf4 fase 103;
fase-342;fim;Áudio de feriado;;;;;;;wf4 fase 342;disparado pelo motor da URA
fase-105;menu;Menu fora do horário;;;7;2;;;wf4 fase 105;
fase-160;audio;URA 8885 · boleto fora do horário;;;;;;;wf5 fase 160;
fase-205;consulta;CPF/CNPJ e busca (fora do horário);;;;;;;wf5 fase 205;
fase-170;fim;Boleto por e-mail · protocolo Plusoft;;;;;;email;wf5 fases 170/210;
fase-166;fim;“Ligue no próximo dia útil”;;;;;;;wf5 fases 166/175;
fase-117;menu;Emergência 24 h (síndico);;;5;2;;;wf4 fase 117;
fase-180;menu;Emergência POA;;;5;2;;;wf4 fase 180;
fase-191;menu;Emergência Litoral;;;5;2;;;wf4 fase 191;
tc-7;regra_feriado;Feriado? (NS);;padrao;;;;;timeconditions 7;
tc-6;regra_horario;Seg–sex 8h30–16h55? (NS);horario:tg1;;;;;;timeconditions 6;
fase-265;audio;URA 8882 · NS entrada;;;;;;;wf12 fase 265;
fase-267;menu;Menu NS;;;;2;;;wf12 fases 267/274/275;o export não traz o tempo de espera
fase-299;audio;URA 8881 · NS fora do horário;;;;;;;wf11 fase 299;
fase-300;fim;“Não estamos disponíveis”;;;;;;;wf11 fase 300;
nps-8851;pesquisa;Pesquisa 8851 (Aluguéis);;;;;;;wf8;
nps-8850;pesquisa;Pesquisa 8850 (Contact Center);;;;;;;wf9;
ura-8883;audio;URA 8883 · Corretora fora do horário;;;;;;;miscdests 23;nenhuma rota aponta pra cá
ura-8890;audio;URA 8890 · áudio de instabilidade;;;;;;;miscdests 34;contingência; nenhuma rota aponta pra cá
```

Criar `packages/nucleo/test/fixtures/central/saidas.csv`:

```csv
id;de;opcao;rotulo;quando;define;para;ativo
tc-3-sim;peca:tc-3;sim;É feriado;;;peca:fase-103;
tc-3-nao;peca:tc-3;nao;Não é feriado;;;peca:tc-2;
tc-2-sim;peca:tc-2;sim;Dia útil;;;peca:fase-11;
tc-2-nao;peca:tc-2;nao;Fora do dia útil;;;peca:tc-1;
tc-1-sim;peca:tc-1;sim;Horário estendido;;;peca:fase-62;
tc-1-nao;peca:tc-1;nao;Fora do horário;;;peca:fase-103;
fase-11-sempre;peca:fase-11;sempre;;;;peca:fase-305;
fase-305-1;peca:fase-305;1;Ouvir o número do WhatsApp;;;peca:fase-311;
fase-305-esgotou;peca:fase-305;esgotou;Nada ou outra tecla;;;peca:fase-16;
fase-16-1;peca:fase-16;1;Boleto;;;peca:fase-1;
fase-16-2;peca:fase-16;2;Aluguéis;;;peca:fase-341;
fase-16-3;peca:fase-16;3;Condomínios;;;peca:fase-31;
fase-16-4;peca:fase-16;4;Vendas;;;fila:90015;
fase-16-5;peca:fase-16;5;Seguros;;;fila:90015;
fase-16-esgotou;peca:fase-16;esgotou;;;;fila:90015;
fase-1-sempre;peca:fase-1;sempre;;;;peca:fase-252;
fase-252-1;peca:fase-252;1;Aluguel;;tipo=aluguel;peca:fase-206;
fase-252-2;peca:fase-252;2;Condomínio;;tipo=condominio;peca:fase-206;
fase-252-esgotou;peca:fase-252;esgotou;;;;peca:fase-252-fim;
fase-206-ok;peca:fase-206;ok;Digita o documento;;;peca:fase-5;
fase-206-esgotou;peca:fase-206;esgotou;;tipo=aluguel;;fila:90015;
fase-5-ok;peca:fase-5;ok;Achou e mandou;;;peca:fase-8;
fase-5-sem-cadastro-aluguel;peca:fase-5;sem_cadastro;Sem cadastro;tipo=aluguel;;fila:90011;
fase-5-falha-email-aluguel;peca:fase-5;falha_email;Falha no e-mail;tipo=aluguel;;fila:90015;
fase-5-sem-cadastro-condominio;peca:fase-5;sem_cadastro;Sem cadastro;tipo=condominio;;fila:90012;
fase-5-falha-email-condominio;peca:fase-5;falha_email;Falha no e-mail;tipo=condominio;;fila:90012;
fase-341-sim;peca:fase-341;sim;É proprietário;;;fila:90020;
fase-341-nao;peca:fase-341;nao;Não é proprietário;;;peca:fase-30;
fase-30-1;peca:fase-30;1;Alugar;;;fila:97778;
fase-30-2;peca:fase-30;2;Disponibilizar imóvel;;;fila:97777;
fase-30-3;peca:fase-30;3;Proprietário;;;fila:90011;
fase-30-4;peca:fase-30;4;Inquilino;;;fila:90011;
fase-30-6;peca:fase-30;6;Atendente;;;fila:90011;
fase-30-8;peca:fase-30;8;Oculto (TI);;;ramal:9594;
fase-30-0;peca:fase-30;0;Voltar;;;peca:fase-16;
fase-30-esgotou;peca:fase-30;esgotou;;;;peca:fase-29;
fase-31-1;peca:fase-31;1;Proposta de administração;;;fila:97776;
fase-31-6;peca:fase-31;6;Atendente;;;fila:90012;
fase-31-0;peca:fase-31;0;Voltar;;;peca:fase-16;
fase-31-esgotou;peca:fase-31;esgotou;;;;peca:fase-29;
fase-62-sempre;peca:fase-62;sempre;;;;peca:fase-64;
fase-64-1;peca:fase-64;1;Boleto;;;peca:fase-160;
fase-64-2;peca:fase-64;2;Alugar imóvel;;;peca:fase-76;
fase-64-3;peca:fase-64;3;Condomínios (emergência);;;peca:fase-117;
fase-64-esgotou;peca:fase-64;esgotou;;;;peca:fase-29;
fase-76-1;peca:fase-76;1;Alugar;;;fila:97778;
fase-76-2;peca:fase-76;2;Disponibilizar imóvel;;;fila:97779;
fase-76-0;peca:fase-76;0;Voltar;;;peca:fase-64;
fase-103-sim;peca:fase-103;sim;Feriado;;;peca:fase-342;
fase-103-nao;peca:fase-103;nao;Não é feriado;;;peca:fase-105;
fase-105-1;peca:fase-105;1;Boleto;;;peca:fase-160;
fase-105-2;peca:fase-105;2;Emergência no condomínio;;;peca:fase-117;
fase-160-sempre;peca:fase-160;sempre;;;;peca:fase-205;
fase-205-ok;peca:fase-205;ok;Achou e mandou;;;peca:fase-170;
fase-205-nao;peca:fase-205;nao_encontrado;Sem boleto, falha ou esgotou;;;peca:fase-166;
fase-117-1;peca:fase-117;1;Porto Alegre;;;peca:fase-180;
fase-117-2;peca:fase-117;2;Litoral;;;peca:fase-191;
fase-117-3;peca:fase-117;3;Seguro;;;fila:99960;nao
fase-180-1;peca:fase-180;1;Elétrica;;;fila:99951;
fase-180-2;peca:fase-180;2;Hidráulica;;;fila:99951;
fase-180-3;peca:fase-180;3;Chaveiro;;;fila:99952;
fase-180-4;peca:fase-180;4;Portão;;;fila:99953;
fase-180-5;peca:fase-180;5;Outros;;;fila:99954;nao
fase-191-1;peca:fase-191;1;Elétrica;;;fila:99955;nao
fase-191-2;peca:fase-191;2;Hidráulica;;;fila:99956;nao
fase-191-3;peca:fase-191;3;Chaveiro;;;fila:99957;nao
fase-191-4;peca:fase-191;4;Portão;;;fila:99958;nao
fase-191-5;peca:fase-191;5;Outros;;;fila:99959;nao
tc-7-sim;peca:tc-7;sim;É feriado;;;peca:fase-299;
tc-7-nao;peca:tc-7;nao;Não é feriado;;;peca:tc-6;
tc-6-sim;peca:tc-6;sim;Dia útil;;;peca:fase-265;
tc-6-nao;peca:tc-6;nao;Fora do dia útil;;;peca:fase-299;
fase-265-sempre;peca:fase-265;sempre;;;;peca:fase-267;
fase-267-1;peca:fase-267;1;Aluguéis;;;fila:90019;
fase-267-2;peca:fase-267;2;Condomínios;;;fila:90019;
fase-267-9;peca:fase-267;9;Atendente;;;fila:90019;
fase-267-esgotou;peca:fase-267;esgotou;;;;fila:90019;
fase-299-sempre;peca:fase-299;sempre;;;;peca:fase-300;
nps-8851-sempre;peca:nps-8851;sempre;;;;fim:desliga;
nps-8850-sempre;peca:nps-8850;sempre;;;;fim:desliga;
```

Criar `packages/nucleo/test/fixtures/central/horarios.csv`:

```csv
id;grupo;nome;dias;inicio;fim;observacao
tg1-semana;tg1;Dia útil;seg-sex;08:30;16:55;timegroup 1
tg2-sabado;tg2;Horário estendido;sab;09:00;12:00;timegroup 2
tg2-semana;tg2;Horário estendido;seg-sex;17:00;18:00;timegroup 2
```

Criar `packages/nucleo/test/fixtures/central/feriados.csv`:

```csv
id;calendario;data;nome;todo_ano;observacao
padrao-confraternizacao;padrao;2026-01-01;Confraternização Universal;sim;o calendário real da central não veio no export: nacionais e do RS
padrao-sexta-santa-2026;padrao;2026-04-03;Sexta-feira Santa;nao;
padrao-tiradentes;padrao;2026-04-21;Tiradentes;sim;
padrao-trabalho;padrao;2026-05-01;Dia do Trabalho;sim;
padrao-independencia;padrao;2026-09-07;Independência;sim;
padrao-farroupilha;padrao;2026-09-20;Revolução Farroupilha (RS);sim;
padrao-aparecida;padrao;2026-10-12;Nossa Senhora Aparecida;sim;
padrao-finados;padrao;2026-11-02;Finados;sim;
padrao-republica;padrao;2026-11-15;Proclamação da República;sim;
padrao-consciencia-negra;padrao;2026-11-20;Consciência Negra;sim;
padrao-natal;padrao;2026-12-25;Natal;sim;
```

- [ ] **Passo 2: Criar o gerador**

Criar `packages/nucleo/scripts/gerar-fixture.ts`:

```ts
/**
 * Gera a parte da fixture que vem das tabelas da central (entradas, ramais, filas, grupos),
 * a partir do export de 11/11/2026, trocando os nomes das pessoas por "Pessoa NNN"
 * e sem nenhum número de celular.
 *
 * Uso: npx tsx scripts/gerar-fixture.ts <pasta-do-export> test/fixtures/central
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { escreverCsv, lerCsv } from '../src/importacao/csv';

const [origem, destino] = process.argv.slice(2);
if (!origem || !destino) {
  console.error('uso: npx tsx scripts/gerar-fixture.ts <pasta-do-export> <pasta-da-fixture>');
  process.exit(1);
}

async function tabela(nome: string): Promise<Record<string, string>[]> {
  const [cabecalho = [], ...linhas] = lerCsv(await readFile(join(origem!, nome), 'utf-8'));
  return linhas.filter((l) => l.some((c) => c.trim())).map((l) => Object.fromEntries(cabecalho.map((c, i) => [c.trim(), (l[i] ?? '').trim()])));
}

const ehRamal = (t: string) => /^\d{3,5}$/.test(t.replace(/#$/, ''));
const MISC: Record<string, string> = { '19': 'peca:fase-11' };

/** Destino no formato do FreePBX ("ext-queues,90011,1") → referência do Journey. */
function destinoFreepbx(d: string): { ref?: string; antiLoop?: boolean } {
  const [contexto, n = ''] = d.split(',');
  switch (contexto) {
    case 'from-did-direct':
      return { ref: `ramal:${n}` };
    case 'ext-queues':
      return { ref: `fila:${n}` };
    case 'transbordo-fila':
      return { ref: `fila:${n}`, antiLoop: true };
    case 'ext-group':
      return { ref: `grupo:${n}` };
    case 'ext-miscdests':
      return { ref: MISC[n] ?? 'externo:celular' };
    case 'app-blackhole':
      return { ref: 'fim:desliga' };
    case 'timeconditions':
      return { ref: `peca:tc-${n}` };
    default:
      return {};
  }
}

const NOMES_ENTRADA: Record<string, string> = {
  'peca:tc-3': 'Números comerciais',
  'peca:tc-7': 'Nóbrega e Soares',
  'peca:fase-11': 'URA direto, sem horário',
  'fim:desliga': 'Desliga direto',
};

const dids = await tabela('dids.csv');
const entradas = [['id', 'numero', 'nome', 'destino']];
for (const d of dids) {
  const { ref } = destinoFreepbx(d.destino_freepbx ?? '');
  if (!ref) {
    console.warn(`entrada ignorada: ${d.did} → ${d.destino_freepbx}`);
    continue;
  }
  const numero = d.did ?? '';
  if (/^\d+$/.test(numero)) entradas.push([`did-${numero}`, numero, NOMES_ENTRADA[ref] ?? '', ref]);
  else entradas.push(['did-catch-all', 'catch-all', 'Todo número sem rota própria', ref]);
}

const sigaMe = new Map((await tabela('siga-me.csv')).map((s) => [s.ramal ?? '', s]));
const ramaisCsv = (await tabela('ramais-transbordo.csv')).sort((a, b) => (a.ramal ?? '').localeCompare(b.ramal ?? ''));
const ramais = [['id', 'nome', 'toque_s', 'siga_me_so_ramal_s', 'siga_me_com_lista_s', 'siga_me_lista', 'ao_nao_atender', 'ao_ocupado', 'transbordo_anti_loop']];
ramaisCsv.forEach((r, i) => {
  const id = r.ramal ?? '';
  const naoAtende = destinoFreepbx(r.nao_atende ?? '');
  const ocupado = r.ocupado && r.ocupado !== r.nao_atende ? (destinoFreepbx(r.ocupado).ref ?? '') : '';
  const s = sigaMe.get(id);
  const lista = (s?.lista ?? '')
    .split(/[\s,-]+/)
    .filter(Boolean)
    .map((t) => (ehRamal(t) ? `ramal:${t.replace(/#$/, '')}` : 'externo:celular'))
    .filter((t) => t !== `ramal:${id}`);
  ramais.push([
    id,
    `Pessoa ${String(i + 1).padStart(3, '0')}`,
    r.toca_antes_de_transbordar_s ?? '',
    s?.toca_so_o_ramal_s ?? '',
    s?.depois_ramal_mais_lista_s ?? '',
    lista.join(' '),
    naoAtende.ref ?? '',
    ocupado,
    naoAtende.antiLoop ? 'sim' : 'nao',
  ]);
});

const PESQUISA: Record<string, string> = { '90011': 'peca:nps-8851', '90020': 'peca:nps-8851', '90012': 'peca:nps-8850', '90015': 'peca:nps-8850' };
const filas = [['id', 'nome', 'estrategia', 'toque_por_membro_s', 'ao_esgotar', 'membros', 'membros_dinamicos', 'pesquisa_ao_desligar', 'observacao']];
for (const f of await tabela('filas.csv')) {
  const dinamicos = (f.membros_fixos ?? '').includes('din');
  const membros = dinamicos ? [] : (f.membros_fixos ?? '').split(/\s+/).filter(Boolean).map((t) => (ehRamal(t) ? `ramal:${t}` : 'externo:celular'));
  const semToque = f.timeout_s === '0';
  filas.push([
    f.fila ?? '',
    f.nome ?? '',
    f.estrategia ?? '',
    semToque ? '' : (f.timeout_s ?? ''),
    destinoFreepbx(f.destino_de_falha ?? '').ref ?? '',
    membros.join(' '),
    dinamicos ? 'sim' : 'nao',
    PESQUISA[f.fila ?? ''] ?? '',
    semToque ? 'timeout 0 na central: toca sem limite' : '',
  ]);
}

const fluxo = JSON.parse(await readFile(join(origem, 'fluxo.json'), 'utf-8')) as { nodes: { label: string; ref: string }[] };
const grupos = [['id', 'nome', 'estrategia', 'toque_s', 'ao_esgotar']];
for (const n of fluxo.nodes) {
  const id = /^ringgroups (\d+)$/.exec(n.ref)?.[1];
  const m = /\n(.+?) \((\w+) (\d+) s\)/.exec(n.label);
  if (id && m) grupos.push([id, m[1] ?? '', m[2] ?? '', m[3] ?? '', 'fim:desliga']);
}

for (const [nome, linhas] of [
  ['entradas', entradas],
  ['ramais', ramais],
  ['filas', filas],
  ['grupos', grupos],
] as const) {
  await writeFile(join(destino, `${nome}.csv`), escreverCsv(linhas));
  console.log(`${nome}.csv: ${linhas.length - 1} linhas`);
}
```

- [ ] **Passo 3: Gerar a parte das tabelas**

Se o export não estiver nesta máquina, pule este passo: `entradas.csv`, `ramais.csv`, `filas.csv` e `grupos.csv` já estão commitados.

Rodar: `npm run fixture -w packages/nucleo -- /tmp/claude-0/-home-user/0302ec4b-b3f8-5cbc-96d5-dba779a4b010/scratchpad/export test/fixtures/central`

Esperado:

```
entradas.csv: 242 linhas
ramais.csv: 180 linhas
filas.csv: 38 linhas
grupos.csv: 5 linhas
```

- [ ] **Passo 4: Conferir que não vazou nome nem celular**

Rodar: `grep -cE "[0-9]{8,}" packages/nucleo/test/fixtures/central/ramais.csv packages/nucleo/test/fixtures/central/filas.csv packages/nucleo/test/fixtures/central/grupos.csv`

Esperado: `0` nos três arquivos. (`entradas.csv` tem os números da empresa, que são públicos.)

Rodar: `cut -d';' -f2 packages/nucleo/test/fixtures/central/ramais.csv | sort -u | head -3`

Esperado: `Pessoa 001`, `Pessoa 002`… e o cabeçalho `nome`. Nenhum nome real.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/test/fixtures/central packages/nucleo/scripts/gerar-fixture.ts
git commit -m "test(nucleo): fixture da central de 11/11/2026, sem nomes" -m "$(cat .git/atribuicao.txt)"
```

### Tarefa 22: Aceitação e fechamento da etapa

O critério de pronto da etapa 1 (spec 19): com a central real, o diagnóstico encontra sozinho os achados da seção 12.3, e o motor percorre os cenários "E se…". Este teste cobre código que já existe; ele deve passar de primeira. Se falhar, a fixture ou uma regra está errada: investigue antes de mudar o teste.

**Arquivos:**
- Teste: `packages/nucleo/test/aceitacao.test.ts`
- Criar: `packages/nucleo/README.md`

- [ ] **Passo 1: Escrever o teste de aceitação**

Criar `packages/nucleo/test/aceitacao.test.ts`:

```ts
/**
 * Aceitação da etapa 1 (spec, seção 12.3): com a central real (sem nomes),
 * o diagnóstico precisa encontrar sozinho os problemas que o protótipo mostrou,
 * e o motor precisa percorrer os cenários "E se…".
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { diagnosticar } from '../src/diagnostico/diagnosticar';
import type { Achado } from '../src/diagnostico/tipos';
import type { Documento } from '../src/formato/documento';
import { importar } from '../src/importacao/importar';
import { executar } from '../src/motor/execucao';

const PASTA = join(import.meta.dirname, 'fixtures', 'central');
let central: Documento;
let achados: Achado[];
const doTipo = (tipo: Achado['tipo']) => achados.filter((a) => a.tipo === tipo);

beforeAll(async () => {
  const nomes = (await readdir(PASTA)).filter((n) => n.endsWith('.csv'));
  const r = await importar(await Promise.all(nomes.map(async (nome) => ({ nome, conteudo: await readFile(join(PASTA, nome), 'utf-8') }))));
  expect(r.problemas.filter((p) => p.gravidade === 'erro')).toEqual([]);
  central = r.efetivo;
  achados = diagnosticar(central);
});

describe('aceitação: diagnóstico da central de 11/11/2026', () => {
  it('1. fase 29 apagada, alcançada pelos menus Aluguéis, Condomínios e estendido ao esgotar', () => {
    const f29 = doTipo('beco_sem_saida').filter((a) => a.refs.includes('peca:fase-29'));
    expect(f29.map((a) => a.refs[0]).sort()).toEqual(['saida:fase-30-esgotou', 'saida:fase-31-esgotou', 'saida:fase-64-esgotou']);
  });

  it('2. 25 ramais em ciclo, incluindo 9019 ↔ 9507', () => {
    const ciclos = doTipo('ciclo_transbordo');
    expect(new Set(ciclos.flatMap((a) => a.refs)).size).toBe(25);
    expect(ciclos.some((a) => a.refs.slice(0, 2).sort().join() === 'ramal:9019,ramal:9507')).toBe(true);
  });

  it('3. 24 ramais transbordam pra ramal fora da lista', () => {
    const ramais = doTipo('destino_inexistente').filter((a) => a.refs[0]!.startsWith('ramal:') && a.campos?.includes('ao_nao_atender'));
    expect(new Set(ramais.map((a) => a.refs[0])).size).toBe(24);
  });

  it('4. emergência POA: elétrica e hidráulica na fila 99951; a 99950 sem entrada', () => {
    expect(doTipo('redundancia').map((a) => a.chave)).toContain('redundancia:peca:fase-180>fila:99951');
    expect(doTipo('sem_entrada').map((a) => a.refs[0])).toContain('fila:99950');
  });

  it('5. seg–sex 16h55–17h sem atendimento', () => {
    expect(doTipo('buraco_horario').map((a) => a.titulo)).toEqual(['seg, ter, qua, qui, sex 16:55–17:00']);
  });

  it('6. menus com opções que vão pro mesmo lugar', () => {
    expect(doTipo('redundancia').map((a) => a.chave)).toEqual(
      expect.arrayContaining(['redundancia:peca:fase-16>fila:90015', 'redundancia:peca:fase-30>fila:90011', 'redundancia:peca:fase-267>fila:90019']),
    );
  });

  it('7. sete transferências por nó inativo (99954 a 99960)', () => {
    const inativos = doTipo('no_inativo').filter((a) => a.refs[0]!.startsWith('saida:'));
    expect(inativos.map((a) => a.refs[2]).sort()).toEqual(['fila:99954', 'fila:99955', 'fila:99956', 'fila:99957', 'fila:99958', 'fila:99959', 'fila:99960']);
  });

  it('25 ramais voltam pra própria fila (sem contar os de anti-loop)', () => {
    expect(doTipo('volta_propria_fila')).toHaveLength(25);
  });
});

describe('aceitação: cenários "E se…" na central', () => {
  const comercial = 'entrada:did-5133279001';

  it('2ª via do boleto numa terça às 14h10 termina no e-mail', () => {
    const e = executar(central, {
      entrada: comercial,
      inicio: '2026-11-24T14:10',
      respostas: { 'peca:fase-305': 'esgotou', 'peca:fase-16': '1', 'peca:fase-252': '1', 'peca:fase-206': 'ok', 'peca:fase-5': 'ok' },
    });
    expect(e.motivo).toBe('fim');
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'peca:fase-8' });
    expect(e.eventos).toContainEqual(expect.objectContaining({ tipo: 'trocou_canal', para: 'email' }));
  });

  it('não digitar nada no Submenu Aluguéis cai na fase 29, que não existe', () => {
    const e = executar(central, { entrada: comercial, inicio: '2026-11-24T15:40', respostas: { 'peca:fase-305': 'esgotou', 'peca:fase-16': '2', 'peca:fase-341': 'nao', 'peca:fase-30': 'esgotou' } });
    expect(e.motivo).toBe('destino_inexistente');
    expect(e.eventos.at(-1)).toMatchObject({ ref: 'peca:fase-29' });
  });

  it('falta de luz em POA num domingo às 21h30 cai na fila do hidráulico', () => {
    const e = executar(central, { entrada: comercial, inicio: '2026-11-29T21:30', respostas: { 'peca:fase-105': '2', 'peca:fase-117': '1', 'peca:fase-180': '1', 'fila:99951': 'atende' } });
    expect(e.motivo).toBe('atendido');
    expect(e.eventos.filter((x) => x.tipo === 'chegou').map((x) => (x as { ref: string }).ref)).toEqual(
      expect.arrayContaining(['peca:tc-3', 'peca:tc-2', 'peca:tc-1', 'peca:fase-103', 'peca:fase-105', 'fila:99951']),
    );
  });

  it('ligação às 16h57 de uma terça vai pro menu de fora do horário', () => {
    const e = executar(central, { entrada: comercial, inicio: '2026-11-24T16:57' });
    expect(e.pendente?.ref).toBe('peca:fase-105');
  });

  it('ninguém atende no ramal 9004: a ligação termina presa no ciclo 9019 ↔ 9507', () => {
    const e = executar(central, { entrada: 'ramal:9004', inicio: '2026-11-24T10:00', modo: 'ninguem_atende' });
    expect(e.motivo).toBe('ciclo');
    expect(e.eventos.at(-1)).toMatchObject({ tipo: 'terminou', ref: 'ramal:9019' });
  });
});
```

- [ ] **Passo 2: Rodar a aceitação**

Rodar: `npm test -w packages/nucleo -- test/aceitacao.test.ts`

Esperado: PASSA, 13 testes.

- [ ] **Passo 3: Escrever o README do pacote**

Criar `packages/nucleo/README.md`:

````markdown
# @journey/nucleo

O núcleo do Journey, sem tela: o formato dos dados, a importação, os modelos pra baixar, o motor de simulação e o diagnóstico.
Nada aqui conhece React, Next.js ou Supabase. Tudo recebe dados e devolve dados.

## Partes

| Pasta | O que faz |
|---|---|
| `src/formato` | O formato `journey/1`: abas, colunas, referências (`fila:90011`), leitura de células e índice |
| `src/importacao` | Lê `.xlsx`, `.csv` e `.json`; valida; junta com a base anterior; aplica ajustes manuais |
| `src/modelos` | Gera a planilha modelo `.xlsx`, o exemplo `.json` e o esquema JSON |
| `src/motor` | Simula uma ligação: relógio, decisões, variáveis, ciclos |
| `src/diagnostico` | Encontra becos sem saída, ciclos, redundâncias, buracos de horário e o resto da seção 12 do spec |

## Comandos

```bash
npm test                  # todos os testes
npm run typecheck         # checagem de tipos
npm run modelos           # gera saida/modelos/{modelo-journey.xlsx, modelo-journey.json, esquema-journey.json}
npm run fixture -- <pasta-do-export> test/fixtures/central   # refaz a parte gerada da fixture
```

## Uso

```ts
import { importar, diagnosticar, executar } from '@journey/nucleo';

const r = await importar([{ nome: 'central.xlsx', conteudo: bytes }]);
if (!r.ok) console.log(r.problemas);

const achados = diagnosticar(r.efetivo);

const e = executar(r.efetivo, { entrada: 'entrada:did-5133279001', inicio: '2026-11-24T16:57' });
console.log(e.eventos, e.pendente);
e.avancar('1');
```

## Fixture da central

`test/fixtures/central` é a central exportada em 11/11/2026, sem nomes de pessoas e sem números de celular.

- `pecas.csv`, `saidas.csv`, `horarios.csv` e `feriados.csv` foram escritos à mão a partir do `fluxo.json` do export.
- `entradas.csv`, `ramais.csv`, `filas.csv` e `grupos.csv` são gerados por `scripts/gerar-fixture.ts`.

O export só traz os ramais que têm transbordo configurado. Por isso parte das entradas e dos membros de fila aponta pra ramais "fora da lista".
````

- [ ] **Passo 4: Verificação final**

Rodar: `npm test`

Esperado: `Test Files  20 passed (20)` e `Tests  142 passed (142)`.

Rodar: `npm run typecheck`

Esperado: sem erros.

Rodar: `npm run modelos -w packages/nucleo`

Esperado: `modelos gerados em saida/modelos`.

- [ ] **Passo 5: Commit**

```bash
git add packages/nucleo/test/aceitacao.test.ts packages/nucleo/README.md
git commit -m "test(nucleo): aceitação da etapa 1 com a central real" -m "$(cat .git/atribuicao.txt)"
```

---

## Cobertura do spec

| Spec | Onde |
|---|---|
| 6. Fronteiras (pacotes puros, esquema único) | Tarefas 1–20; `abas.ts` gera leitura, validação e modelos |
| 7.2 Base, ajustes e versões (parte do núcleo) | Tarefas 10, 11, 12 |
| 8.1 Abas e colunas | Tarefas 3, 4 |
| 8.2 Referências embutidas | Tarefa 2 |
| 8.3 Regras de validação | Tarefas 8, 9 |
| 8.4 Import parcial | Tarefas 10, 12 |
| 8.5 Modelos pra baixar | Tarefa 13 |
| 11. Motor (quem decide, tempo, variáveis, ciclos, peça incompleta) | Tarefas 14, 15 |
| 12.2 Regras do diagnóstico | Tarefas 16–20 |
| 12.3 Achados da central real | Tarefas 21, 22 |
| 12.4 Agenda "quem atende quando" (dados) | Tarefa 19 (`agendaSemanal`) |
| 17. Testes unitários e fixture sem nomes | Todas; tarefa 21 |

Fora desta etapa, como o spec define: conversores (etapa 5), tela, banco e login (etapas 2–4), roteiro de extração (etapa 6).
