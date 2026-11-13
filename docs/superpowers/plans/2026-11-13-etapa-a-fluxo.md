# Etapa A: modelo e motor genéricos do Journey v2 — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans pra executar este plano tarefa por tarefa. Os passos usam caixas de seleção (`- [ ]`) pra acompanhar o progresso.

**Objetivo:** a etapa A do spec v2 (seção 15): o pacote `@journey/fluxo`, sem tela, com o documento genérico de um fluxo (`journey/2`), a validação, o relógio de Horário, o motor de simulação, o diagnóstico e os modelos prontos; e a migração do banco com canais, cadastros, fluxos, versões e o salvamento por revisão. Pronto quando os modelos do protótipo simulam e diagnosticam em testes, e o banco guarda e protege um fluxo (pgTAP).

**Arquitetura:** TypeScript puro, sem dependência, num pacote novo ao lado do `@journey/nucleo` (que é de telefonia e vira o importador de central na etapa E). O documento é um JSON só, que o editor da etapa B carrega e salva inteiro; cadastros e canais são da empresa e ficam fora dele (a peça aponta pro cadastro pelo id). O motor é determinístico: só o relógio decide sozinho (saídas de regra `horario` numa peça cujo responsável é um cadastro Horário); o resto pergunta. No banco, a migração só acrescenta: a v1 publicada continua funcionando até a etapa B trocar a tela.

**Tecnologia:** a mesma das etapas anteriores: Node 22, TypeScript 5.9, Vitest 3.2, Supabase CLI 2.122 (Postgres 17 local em Docker, pgTAP). Nenhuma dependência nova de produção.

**Spec:** `docs/superpowers/specs/2026-11-13-journey-v2-editor.md` (seções 5 Conceitos, 7 Editor, 8 Simulação, 9 Diagnóstico, 11 Dados, 12 Modelos, 15 etapa A, 16 Riscos).

---

## Antes de começar

- **Branch:** `claude/journey-etapa-3-public-links-5wx03t`, que já tem o spec v2 (PR brunocmattos/journey#4 em rascunho). Este plano e o código entram no mesmo PR.
- **Todo o código deste plano já foi escrito e testado num ensaio**, sobre esse branch (`10104c3`): `@journey/fluxo` 55 testes, núcleo 253 e app 184 (sem mudança), pgTAP 126 (eram 90), `npm run typecheck` limpo. Copie os arquivos exatamente como estão. Se um teste falhar, investigue antes de mudar o teste.
- **Docker e Supabase local:** como nas etapas anteriores. Se `docker info` falhar, `sudo containerd > /tmp/containerd.log 2>&1 &` e depois `sudo dockerd --containerd=/run/containerd/containerd.sock > /tmp/dockerd.log 2>&1 &`, e espere responder. Depois `npm install` e `npm run banco`.
- **Commits:** crie `.git/atribuicao.txt` uma vez, com as duas linhas de atribuição da sessão (`Co-Authored-By: …` e `Claude-Session: …`). Todo commit usa `-m "$(cat .git/atribuicao.txt)"` como segundo parágrafo da mensagem.
- **Patches:** arquivo novo vem inteiro. Arquivo que já existe vem como diff; aplique da raiz do repositório salvando o bloco num arquivo e rodando `git apply <arquivo>` (ou à mão, linha por linha).
- **TDD por tarefa:** o teste vem primeiro e falha porque o módulo não existe; o código vem em seguida. Como o código já foi ensaiado, o "falha" é só a conferência de que o teste roda de verdade.
- Comandos: `npm test -w packages/fluxo`, `npm run typecheck -w packages/fluxo`, `npm test` (todos os pacotes; os de banco do app rodam sozinhos com o Supabase no ar), `npm run banco:testes` (pgTAP), `npm run typecheck`.

## Decisões desta etapa

Cada uma foi comparada com a alternativa antes de entrar aqui.

| Decisão | Por quê | Alternativa recusada |
|---|---|---|
| **Pacote novo `@journey/fluxo`**, sem tocar no `@journey/nucleo` | O núcleo é todo de telefonia (ramal, URA, discagem); misturar repetiria o erro da v1. Ele fica pro importador de central (etapa E) | Generalizar o núcleo: cada tipo e regra carregaria o legado de telefonia |
| **Oito tipos de peça e seis regras de conexão**, fixos no código (`TIPOS_PECA`, `REGRAS`) | São o vocabulário do protótipo aprovado (spec 5 e 7). O que muda de empresa pra empresa (canais, tipos de cadastro) fica no banco | Tipos de peça configuráveis: mais tela e mais validação sem pedido; o spec 16 deixa pra depois |
| **Cadastros fora do documento**; a peça guarda só o id em `responsavel` | O mesmo cadastro (fila, pessoa, horário) serve a vários fluxos e mostra "onde é usado"; renomear o cadastro não mexe nos fluxos | Copiar o cadastro pra dentro do documento: renomear exigiria varrer todos os fluxos |
| **`lerDocumento` devolve uma cópia só com os campos conhecidos**, com erro (recusa) e aviso (canal ou cadastro que a empresa não tem) | O documento vem do navegador e do banco; o que passa daqui é o que o motor e o diagnóstico entendem. Aviso não recusa: um cadastro apagado não pode travar o editor | Validar com uma biblioteca de esquema: dependência nova pra 130 linhas |
| **Só o relógio decide sozinho**, e só em saídas `horario` de uma peça cujo responsável é um cadastro Horário, com a hora simulada (`quando` + tempo já passado) | Determinístico e explicável: o resto é escolha de quem simula. Feriado é fora do horário | Regras com expressão (`se valor > 1000`): é um interpretador, fora da v1 |
| **Modo `livre`** pergunta também no horário, com a escolha do relógio marcada `sugerida` | Quem explica o fluxo quer mostrar o "fora do horário" sem mudar a hora | Só o modo relógio |
| **Ciclo = terceira chegada na mesma peça sem ninguém escolher no meio**; depois de uma escolha a contagem recomeça | Um menu que volta pra si mesmo ("repetir") não é ciclo; dois passos automáticos que se chamam são | Contar visitas no total: o "repetir" do menu viraria ciclo |
| **`simular(…, escolhas)` refaz do zero** com a lista de conexões escolhidas | É como a tela vai voltar um passo e como um cenário salvo é reproduzido; sem estado escondido | Guardar e restaurar o estado do motor |
| **Chave do achado = tipo + ids** (`beco_sem_saida:e`, `opcoes_repetidas:d:opcao:1`) | Renomear a peça não muda a chave; "marcar como intencional" sobrevive (como na v1) | Chave pelo texto |
| **Ciclo sem saída pelo algoritmo de Tarjan** (componentes fortemente conexos) | Acha todos os ciclos fechados de uma vez, em tempo linear: 500 peças em menos de 100 ms | Procurar ciclos a partir de cada peça: quadrático |
| **"Passou do prazo" usa o caminho mais longo sem repetir peça** até um Fim, contra a meta do fluxo (`meta_s`) | É o pior caso que um cliente vive; com ciclo, a primeira volta já conta | Média dos caminhos: esconde o pior |
| **No banco, o documento é `jsonb` numa coluna só, com `check` da forma** (`formato` `journey/2` e as quatro listas) | O editor salva o documento inteiro; o servidor confere só a forma e os responsáveis. A validação completa é a do pacote, no app | Tabelas de peças e conexões: cada arrasto viraria dezenas de linhas |
| **Salvar só pela função `salvar_fluxo`**, com a revisão que o editor abriu (40001 se outra pessoa salvou), a trava (P0001) e responsáveis que sejam cadastros da empresa (22023) | Sem edição simultânea na v1 (spec 16): a trava avisa, a revisão garante que ninguém sobrescreve sem saber | Update direto da coluna: sobrescreve calado |
| **Trava com validade** (`pegar_trava` renova; vencida passa pra quem pede) | Fechar a aba sem soltar não pode prender o fluxo | Trava sem validade |
| **"Onde é usado" (`fluxo_cadastros`) refeito a cada salvamento**, com `on delete restrict` no cadastro | Apagar um cadastro em uso quebraria os fluxos calado | Procurar no `jsonb` na hora de apagar |
| **Canal não se apaga, se arquiva; tipo de cadastro padrão não se apaga** | Fluxos antigos continuam apontando pra eles | Apagar e deixar órfão |
| **Empresa nova nasce com 5 canais e 5 tipos** (gatilho `semear_empresa`), e as que já existem recebem os mesmos | Ninguém começa de uma tela vazia; os mesmos de `CANAIS_PADRAO` e `TIPOS_CADASTRO_PADRAO` | Semear no app: duas fontes da verdade |

**Gotchas que o ensaio achou:**
- **`noUncheckedIndexedAccess` está ligado no pacote:** `lista[0]` é `T | undefined`. Nos testes, use `!` onde o valor certamente existe; no código, trate o `undefined`.
- **`(a ?? '').toLowerCase()`** precisa dos parênteses: `a ?? ''.toLowerCase()` compila e faz outra coisa.
- **pgTAP não aceita `delete … returning` dentro de `with`** num `select`: apague num comando separado e confira com `ok(exists(…))`.
- **`check` de `jsonb` com chave faltando dá `null`, e `null` passa no `check`:** a forma do documento vai dentro de `coalesce(…, false)`.
- **Hora de parede:** `lerQuando('2026-11-23T10:30')` guarda os números como UTC e o relógio lê com `getUTC*`. Assim o resultado não depende do fuso da máquina que roda o teste.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/fluxo/package.json`, `tsconfig.json` | O pacote, como o `nucleo`, com `noUncheckedIndexedAccess` |
| `packages/fluxo/src/documento.ts` | O documento: peças (8 tipos), conexões (6 regras), grupos e notas; `documentoVazio` |
| `packages/fluxo/src/cadastros.ts` | Cadastros e canais da empresa, os padrão, e `camposHorario` (lê e confere os campos de um cadastro Horário) |
| `packages/fluxo/src/relogio.ts` | Hora de parede, dentro ou fora de um Horário (com feriados), tempo legível |
| `packages/fluxo/src/validar.ts` | `lerDocumento`: confere um documento vindo de fora e devolve uma cópia limpa |
| `packages/fluxo/src/indice.ts` | Saídas e entradas de cada peça; o texto de cada regra |
| `packages/fluxo/src/motor.ts` | `Execucao`, `executar`, `simular` e os eventos |
| `packages/fluxo/src/diagnostico.ts` | `diagnosticar`: os doze tipos de achado |
| `packages/fluxo/src/modelos.ts` | Suporte no WhatsApp, Esteira de crédito, SAC por e-mail e URA telefônica |
| `packages/fluxo/src/index.ts` | O que o pacote exporta |
| `packages/fluxo/test/*.ts` | Testes (Vitest) e os construtores `peca`, `liga`, `doc` |
| `supabase/migrations/20261114000000_journey_v2_fluxos.sql` | Canais, tipos de cadastro, cadastros, fluxos, versões, "onde é usado", RLS, grants e as funções de salvar, travar e marcar versão |
| `supabase/tests/database/fluxos.test.sql` | O banco do fluxo (pgTAP) |
| `packages/fluxo/README.md`, `README.md` | Documentação |

---

### Tarefa 1: o pacote, o documento, os cadastros e o relógio

**Arquivos:**
- Criar: `packages/fluxo/package.json`, `packages/fluxo/tsconfig.json`
- Criar: `packages/fluxo/src/documento.ts`, `packages/fluxo/src/cadastros.ts`, `packages/fluxo/src/relogio.ts`
- Criar: `packages/fluxo/test/apoio.ts`, `packages/fluxo/test/relogio.test.ts`
- Muda: `package-lock.json` (pelo `npm install`)

- [ ] **Passo 1: criar o pacote**

`packages/fluxo/package.json`:

```json
{
  "name": "@journey/fluxo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "22.20.5",
    "typescript": "5.9.3",
    "vitest": "3.2.7"
  }
}
```

`packages/fluxo/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

Rode `npm install` na raiz. O `package-lock.json` ganha só as entradas `node_modules/@journey/fluxo` (link) e `packages/fluxo`; as versões das dependências são as mesmas do `nucleo`, então nada é baixado de novo.

- [ ] **Passo 2: o documento**

`packages/fluxo/src/documento.ts`:

```ts
/** O documento de um fluxo: o que o editor desenha e salva inteiro (formato journey/2). */
export const FORMATO = 'journey/2' as const;

/** O vocabulário comum de peças. A forma é só a aparência: nenhuma traz regra de um canal específico. */
export const TIPOS_PECA = ['inicio', 'mensagem', 'etapa', 'decisao', 'espera', 'atendimento', 'sistema', 'fim'] as const;
export type TipoPeca = (typeof TIPOS_PECA)[number];

export const NOMES_TIPOS: Record<TipoPeca, string> = {
  inicio: 'Início',
  mensagem: 'Mensagem',
  etapa: 'Etapa',
  decisao: 'Decisão',
  espera: 'Espera',
  atendimento: 'Atendimento',
  sistema: 'Sistema',
  fim: 'Fim',
};

/**
 * Quando a água passa por uma conexão:
 * - sempre: sem condição (a única saída, ou um caminho padrão com texto);
 * - opcao: uma escolha com código (tecla 1, S, N…) e nome;
 * - condicao: um texto livre ("cliente respondeu");
 * - tempo: depois de um tempo (soma no relógio do cliente);
 * - horario: dentro ou fora do horário de um cadastro Horário (o relógio decide);
 * - senao: o que sobra.
 */
export const REGRAS = ['sempre', 'opcao', 'condicao', 'tempo', 'horario', 'senao'] as const;
export type Regra = (typeof REGRAS)[number];

export interface Peca {
  id: string;
  tipo: TipoPeca;
  nome: string;
  x: number;
  y: number;
  /** Chave de um canal da empresa. Sem canal: segue o canal de antes. */
  canal?: string;
  /** Id de um cadastro da empresa (pessoa, fila, equipe, sistema, horário…). */
  responsavel?: string;
  /** Quanto tempo o cliente passa aqui, em segundos (pra simulação). */
  tempo_s?: number;
  descricao?: string;
  cor?: string;
}

export interface Conexao {
  id: string;
  de: string;
  para: string;
  regra: Regra;
  /** opcao: o código (1, S…); condicao: o texto da condição. */
  valor?: string;
  /** Nome da opção, ou texto no cano. */
  rotulo?: string;
  /** regra tempo: depois de quantos segundos. */
  tempo_s?: number;
  /** regra horario: qual lado do horário esta saída é. */
  horario?: 'dentro' | 'fora';
}

export interface Grupo {
  id: string;
  nome: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cor?: string;
}

export interface Nota {
  id: string;
  texto: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cor?: string;
}

export interface Documento {
  formato: typeof FORMATO;
  pecas: Peca[];
  conexoes: Conexao[];
  grupos: Grupo[];
  notas: Nota[];
}

export const documentoVazio = (): Documento => ({ formato: FORMATO, pecas: [], conexoes: [], grupos: [], notas: [] });
```

- [ ] **Passo 3: os construtores dos testes**

`packages/fluxo/test/apoio.ts`:

```ts
import { FORMATO, type Conexao, type Documento, type Peca, type TipoPeca } from '../src/documento';

/** Construtores de documentos pequenos pros testes. Posição não importa pro motor nem pro diagnóstico. */
export const peca = (id: string, tipo: TipoPeca, extra: Partial<Peca> = {}): Peca => ({ id, tipo, nome: extra.nome ?? id, x: 0, y: 0, ...extra });
export const liga = (de: string, para: string, extra: Partial<Conexao> = {}): Conexao => ({ id: extra.id ?? `${de}>${para}`, de, para, regra: 'sempre', ...extra });
export const doc = (pecas: Peca[], conexoes: Conexao[] = []): Documento => ({ formato: FORMATO, pecas, conexoes, grupos: [], notas: [] });
```

- [ ] **Passo 4: escrever o teste do relógio**

`packages/fluxo/test/relogio.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { camposHorario } from '../src/cadastros';
import { dentroDoHorario, ehFeriado, formatarTempo, lerQuando } from '../src/relogio';

const comercial = camposHorario({
  id: 'h',
  tipo: 'horario',
  nome: 'Comercial',
  campos: { janelas: [{ dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }], feriados: [{ data: '2026-12-25', todo_ano: true }, { data: '2026-11-20' }] },
})!;

describe('relógio', () => {
  it('lê data e hora de parede', () => {
    expect(new Date(lerQuando('2026-11-23T10:30')).toISOString()).toBe('2026-11-23T10:30:00.000Z');
    expect(() => lerQuando('23/11/2026')).toThrow('AAAA-MM-DDTHH:MM');
  });

  it('dentro e fora do horário, com o fim da janela de fora', () => {
    expect(dentroDoHorario(comercial, lerQuando('2026-11-23T08:00'))).toBe(true); // segunda
    expect(dentroDoHorario(comercial, lerQuando('2026-11-23T17:59'))).toBe(true);
    expect(dentroDoHorario(comercial, lerQuando('2026-11-23T18:00'))).toBe(false);
    expect(dentroDoHorario(comercial, lerQuando('2026-11-22T10:00'))).toBe(false); // domingo
  });

  it('feriado fecha, inclusive o que repete todo ano', () => {
    expect(ehFeriado(comercial, lerQuando('2026-11-20T10:00'))).toBe(true);
    expect(dentroDoHorario(comercial, lerQuando('2026-11-20T10:00'))).toBe(false); // sexta, feriado
    expect(dentroDoHorario(comercial, lerQuando('2027-12-25T10:00'))).toBe(false);
    expect(ehFeriado(comercial, lerQuando('2027-11-20T10:00'))).toBe(false);
  });

  it('cadastro que não é horário, ou com campos ruins, não vira horário', () => {
    expect(camposHorario({ id: 'x', tipo: 'fila', nome: 'Fila' })).toBeNull();
    expect(camposHorario({ id: 'x', tipo: 'horario', nome: 'H', campos: { janelas: [{ dias: ['seg'], inicio: '8h', fim: '18:00' }] } })).toBeNull();
    expect(camposHorario({ id: 'x', tipo: 'horario', nome: 'H', campos: { janelas: [{ dias: ['segunda'], inicio: '08:00', fim: '18:00' }] } })).toBeNull();
    expect(camposHorario({ id: 'x', tipo: 'horario', nome: 'H', campos: { janelas: [] } })).toEqual({ janelas: [], feriados: [] });
  });

  it('formata tempo', () => {
    expect([40, 60, 3600, 7500, 86400, 97200].map(formatarTempo)).toEqual(['40 s', '1 min', '1 h', '2 h 5 min', '1 d', '1 d 3 h']);
  });
});
```

- [ ] **Passo 5: rodar e ver falhar**

Run: `npm test -w packages/fluxo`
Expected: FAIL, `Failed to resolve import "../src/cadastros"`.

- [ ] **Passo 6: os cadastros**

`packages/fluxo/src/cadastros.ts`:

```ts
/** Cadastros e canais: são da empresa toda, não de um fluxo. As peças apontam pra eles pelo id. */

export interface Cadastro {
  id: string;
  /** Chave do tipo: pessoa, fila, equipe, sistema, horario, ou um tipo que a empresa criou. */
  tipo: string;
  nome: string;
  campos?: Record<string, unknown>;
}

export interface Canal {
  chave: string;
  nome: string;
  cor: string;
}

export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
export type Dia = (typeof DIAS)[number];

export interface JanelaHorario {
  dias: Dia[];
  /** HH:MM */
  inicio: string;
  /** HH:MM, não incluída. */
  fim: string;
}

export interface Feriado {
  /** AAAA-MM-DD */
  data: string;
  /** Repete todo ano no mesmo dia e mês. */
  todo_ano?: boolean;
  nome?: string;
}

/** Os campos de um cadastro do tipo Horário: as janelas da semana e os feriados (em que fica fechado). */
export interface CamposHorario {
  janelas: JanelaHorario[];
  feriados: Feriado[];
}

/** Os canais que toda empresa nova recebe. Ela pode mudar nome e cor, criar outros e arquivar. */
export const CANAIS_PADRAO: readonly Canal[] = [
  { chave: 'telefonia', nome: 'Telefonia', cor: '#1e8bdc' },
  { chave: 'whatsapp', nome: 'WhatsApp', cor: '#159e5a' },
  { chave: 'email', nome: 'E-mail', cor: '#c98410' },
  { chave: 'chat', nome: 'Chat', cor: '#7650d6' },
  { chave: 'interno', nome: 'Interno', cor: '#3a6a88' },
];

/** Os tipos de cadastro que toda empresa nova recebe. */
export const TIPOS_CADASTRO_PADRAO = [
  { chave: 'pessoa', nome: 'Pessoa' },
  { chave: 'fila', nome: 'Fila' },
  { chave: 'equipe', nome: 'Equipe' },
  { chave: 'sistema', nome: 'Sistema' },
  { chave: 'horario', nome: 'Horário' },
] as const;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Os campos de um cadastro Horário, se o cadastro é um horário com campos válidos; senão null. */
export function camposHorario(c: Cadastro | undefined): CamposHorario | null {
  if (!c || c.tipo !== 'horario' || !c.campos) return null;
  const { janelas, feriados } = c.campos as { janelas?: unknown; feriados?: unknown };
  if (!Array.isArray(janelas)) return null;
  const js: JanelaHorario[] = [];
  for (const j of janelas) {
    const { dias, inicio, fim } = (j ?? {}) as Record<string, unknown>;
    if (!Array.isArray(dias) || !dias.every((d) => (DIAS as readonly unknown[]).includes(d))) return null;
    if (typeof inicio !== 'string' || typeof fim !== 'string' || !HORA.test(inicio) || !HORA.test(fim)) return null;
    js.push({ dias: dias as Dia[], inicio, fim });
  }
  const fs: Feriado[] = [];
  for (const f of Array.isArray(feriados) ? feriados : []) {
    const { data, todo_ano, nome } = (f ?? {}) as Record<string, unknown>;
    if (typeof data !== 'string' || !DATA.test(data)) return null;
    fs.push({ data, ...(todo_ano === true && { todo_ano: true }), ...(typeof nome === 'string' && { nome }) });
  }
  return { janelas: js, feriados: fs };
}
```

- [ ] **Passo 7: o relógio**

`packages/fluxo/src/relogio.ts`:

```ts
import { DIAS, type CamposHorario, type Dia } from './cadastros';

/**
 * O relógio da simulação é hora de parede, sem fuso: "2026-11-24T14:10" é 14h10 em qualquer máquina.
 * Internamente é um número de milissegundos tratado como UTC.
 */
export function lerQuando(texto: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(texto);
  if (!m) throw new Error(`data e hora inválidas: "${texto}". Use AAAA-MM-DDTHH:MM`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

const diaDaSemana = (ms: number): Dia => DIAS[new Date(ms).getUTCDay()] as Dia;
const minutosDoDia = (ms: number): number => {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const paraMinutos = (hhmm: string): number => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function ehFeriado(h: CamposHorario, ms: number): boolean {
  const iso = new Date(ms).toISOString().slice(0, 10);
  return h.feriados.some((f) => f.data === iso || (f.todo_ano === true && f.data.slice(5) === iso.slice(5)));
}

/** Dentro de alguma janela da semana e fora dos feriados. */
export function dentroDoHorario(h: CamposHorario, ms: number): boolean {
  if (ehFeriado(h, ms)) return false;
  const dia = diaDaSemana(ms);
  const min = minutosDoDia(ms);
  return h.janelas.some((j) => j.dias.includes(dia) && min >= paraMinutos(j.inicio) && min < paraMinutos(j.fim));
}

/** "2 h 5 min", "3 d 4 h", "40 s". */
export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return h ? `${d} d ${h} h` : `${d} d`;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}
```

- [ ] **Passo 8: rodar e ver passar**

Run: `npm test -w packages/fluxo && npm run typecheck -w packages/fluxo`
Expected: `Tests  5 passed (5)` e o `tsc` sem saída.

- [ ] **Passo 9: commit**

```bash
git add package-lock.json packages/fluxo
git commit -m "fluxo: pacote, documento journey/2, cadastros e relógio" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 2: a validação do documento

**Arquivos:**
- Criar: `packages/fluxo/src/validar.ts`
- Criar: `packages/fluxo/test/validar.test.ts`

- [ ] **Passo 1: escrever o teste**

`packages/fluxo/test/validar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lerDocumento } from '../src/validar';
import { doc, liga, peca } from './apoio';

const codigos = (entrada: unknown, conhecidos = {}) => lerDocumento(entrada, conhecidos).problemas.map((p) => p.codigo);

describe('lerDocumento', () => {
  it('aceita um documento válido e devolve uma cópia só com os campos conhecidos', () => {
    const entrada = { ...doc([{ ...peca('a', 'inicio'), extra: 'x', canal: ' whatsapp ' } as never, peca('b', 'fim')], [liga('a', 'b')]), lixo: 1 };
    const r = lerDocumento(entrada);
    expect(r.problemas).toEqual([]);
    expect(r.documento).toEqual({
      formato: 'journey/2',
      pecas: [{ id: 'a', tipo: 'inicio', nome: 'a', x: 0, y: 0, canal: 'whatsapp' }, { id: 'b', tipo: 'fim', nome: 'b', x: 0, y: 0 }],
      conexoes: [{ id: 'a>b', de: 'a', para: 'b', regra: 'sempre' }],
      grupos: [],
      notas: [],
    });
  });

  it('recusa o que não é journey/2', () => {
    expect(codigos(null)).toEqual(['forma']);
    expect(codigos({ formato: 'journey/1', pecas: [], conexoes: [], grupos: [], notas: [] })).toEqual(['formato']);
    expect(codigos({ formato: 'journey/2', pecas: [] })).toEqual(['forma', 'forma', 'forma']);
    expect(lerDocumento(null).documento).toBeNull();
  });

  it('ids: faltando e repetidos', () => {
    expect(codigos(doc([peca('a', 'inicio'), peca('a', 'fim')]))).toContain('id_repetido');
    expect(codigos(doc([{ tipo: 'fim', nome: 'x', x: 0, y: 0 } as never]))).toContain('id');
  });

  it('peça: tipo, nome, posição e tempo', () => {
    expect(codigos(doc([peca('a', 'menu' as never)]))).toEqual(['tipo']);
    expect(codigos(doc([peca('a', 'etapa', { nome: '  ' })]))).toEqual(['nome']);
    expect(codigos(doc([{ ...peca('a', 'etapa'), x: 'a' } as never]))).toEqual(['posicao']);
    expect(codigos(doc([peca('a', 'etapa', { tempo_s: -1 })]))).toEqual(['tempo']);
    expect(lerDocumento(doc([peca('a', 'etapa', { tempo_s: 0 })])).documento!.pecas[0]).not.toHaveProperty('tempo_s');
    expect(lerDocumento(doc([peca('a', 'etapa', { tempo_s: 12.4 })])).documento!.pecas[0]!.tempo_s).toBe(12);
  });

  it('conexão: pontas que não existem, regra, tempo e horário', () => {
    const base = [peca('a', 'inicio'), peca('b', 'fim')];
    expect(codigos(doc(base, [liga('a', 'x')]))).toEqual(['para']);
    expect(codigos(doc(base, [liga('x', 'b')]))).toEqual(['de']);
    expect(codigos(doc(base, [liga('a', 'b', { regra: 'talvez' as never })]))).toEqual(['regra']);
    expect(codigos(doc(base, [liga('a', 'b', { regra: 'tempo' })]))).toEqual(['tempo']);
    expect(codigos(doc(base, [liga('a', 'b', { regra: 'horario' })]))).toEqual(['horario']);
    expect(lerDocumento(doc(base, [{ id: 'c', de: 'a', para: 'b' } as never])).documento!.conexoes[0]!.regra).toBe('sempre');
  });

  it('grupos e notas precisam de posição e tamanho', () => {
    const d = { ...doc([]), grupos: [{ id: 'g', nome: 'G', x: 0, y: 0, w: 0, h: 10 }], notas: [{ id: 'n', texto: 'oi', x: 0, y: 0, w: 10, h: 10 }] };
    expect(codigos(d)).toEqual(['posicao']);
  });

  it('canal e cadastro que a empresa não tem são aviso, não erro', () => {
    const d = doc([peca('a', 'atendimento', { canal: 'fax', responsavel: 'k9' })]);
    const r = lerDocumento(d, { canais: ['whatsapp'], cadastros: ['k1'] });
    expect(r.problemas.map((p) => [p.gravidade, p.codigo])).toEqual([['aviso', 'canal'], ['aviso', 'responsavel']]);
    expect(r.documento).not.toBeNull();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npm test -w packages/fluxo -- validar`
Expected: FAIL, `Failed to resolve import "../src/validar"`.

- [ ] **Passo 3: a validação**

`packages/fluxo/src/validar.ts`:

```ts
import { FORMATO, REGRAS, TIPOS_PECA, type Conexao, type Documento, type Grupo, type Nota, type Peca, type Regra, type TipoPeca } from './documento';

export interface Problema {
  gravidade: 'erro' | 'aviso';
  codigo: string;
  mensagem: string;
  /** Id da peça, conexão, grupo ou nota. */
  ref?: string;
}

export interface Leitura {
  /** O documento só com os campos conhecidos; null quando há erro. */
  documento: Documento | null;
  problemas: Problema[];
}

/** O que a validação confere contra a empresa, quando quem chama sabe: canais e cadastros que existem. */
export interface Conhecidos {
  canais?: readonly string[];
  cadastros?: readonly string[];
}

const LISTAS = ['pecas', 'conexoes', 'grupos', 'notas'] as const;
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ehTexto = (v: unknown): v is string => typeof v === 'string';
const opcional = (v: unknown): string | undefined => (ehTexto(v) && v.trim() !== '' ? v.trim() : undefined);

/**
 * Lê um documento journey/2 vindo de fora (editor, banco, arquivo) sem confiar nele: confere a forma, os ids,
 * as referências e as regras, e devolve uma cópia só com os campos conhecidos.
 * Erro impede o uso; aviso (canal ou cadastro que a empresa não tem) não.
 */
export function lerDocumento(entrada: unknown, conhecidos: Conhecidos = {}): Leitura {
  const problemas: Problema[] = [];
  const erro = (codigo: string, mensagem: string, ref?: string) => problemas.push({ gravidade: 'erro', codigo, mensagem, ...(ref && { ref }) });
  const aviso = (codigo: string, mensagem: string, ref?: string) => problemas.push({ gravidade: 'aviso', codigo, mensagem, ...(ref && { ref }) });

  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    erro('forma', 'O documento não é um objeto.');
    return { documento: null, problemas };
  }
  const bruto = entrada as Record<string, unknown>;
  if (bruto.formato !== FORMATO) erro('formato', `O formato tem que ser "${FORMATO}".`);
  for (const lista of LISTAS) if (!Array.isArray(bruto[lista])) erro('forma', `Falta a lista "${lista}".`);
  if (problemas.length) return { documento: null, problemas };

  const ids = (lista: (typeof LISTAS)[number]) => {
    const vistos = new Set<string>();
    for (const item of bruto[lista] as unknown[]) {
      const id = (item as Record<string, unknown> | null)?.id;
      if (!ehTexto(id) || id.trim() === '') { erro('id', `Item sem id em "${lista}".`); continue; }
      if (vistos.has(id)) erro('id_repetido', `O id "${id}" aparece duas vezes em "${lista}".`, id);
      vistos.add(id);
    }
    return vistos;
  };
  const idsPecas = ids('pecas');
  ids('conexoes');
  ids('grupos');
  ids('notas');

  const canais = conhecidos.canais && new Set(conhecidos.canais);
  const cadastros = conhecidos.cadastros && new Set(conhecidos.cadastros);

  const pecas: Peca[] = [];
  for (const item of bruto.pecas as Record<string, unknown>[]) {
    if (!ehTexto(item?.id)) continue;
    const id = item.id;
    if (!(TIPOS_PECA as readonly unknown[]).includes(item.tipo)) { erro('tipo', `A peça "${id}" tem um tipo que não existe.`, id); continue; }
    if (!ehNumero(item.x) || !ehNumero(item.y)) erro('posicao', `A peça "${id}" não tem posição.`, id);
    const p: Peca = { id, tipo: item.tipo as TipoPeca, nome: ehTexto(item.nome) && item.nome.trim() ? item.nome.trim() : '', x: ehNumero(item.x) ? item.x : 0, y: ehNumero(item.y) ? item.y : 0 };
    if (!p.nome) erro('nome', `A peça "${id}" não tem nome.`, id);
    const canal = opcional(item.canal);
    if (canal) { p.canal = canal; if (canais && !canais.has(canal)) aviso('canal', `A peça "${p.nome}" usa o canal "${canal}", que a empresa não tem.`, id); }
    const resp = opcional(item.responsavel);
    if (resp) { p.responsavel = resp; if (cadastros && !cadastros.has(resp)) aviso('responsavel', `A peça "${p.nome}" aponta pra um cadastro que não existe.`, id); }
    if (item.tempo_s !== undefined && item.tempo_s !== null) {
      if (!ehNumero(item.tempo_s) || item.tempo_s < 0) erro('tempo', `O tempo da peça "${p.nome}" tem que ser um número de segundos, zero ou mais.`, id);
      else if (item.tempo_s > 0) p.tempo_s = Math.round(item.tempo_s);
    }
    const descricao = opcional(item.descricao);
    if (descricao) p.descricao = descricao;
    const cor = opcional(item.cor);
    if (cor) p.cor = cor;
    pecas.push(p);
  }

  const conexoes: Conexao[] = [];
  for (const item of bruto.conexoes as Record<string, unknown>[]) {
    if (!ehTexto(item?.id)) continue;
    const id = item.id;
    if (!ehTexto(item.de) || !idsPecas.has(item.de)) { erro('de', `A conexão "${id}" sai de uma peça que não existe.`, id); continue; }
    if (!ehTexto(item.para) || !idsPecas.has(item.para)) { erro('para', `A conexão "${id}" chega numa peça que não existe.`, id); continue; }
    const regra = item.regra === undefined ? 'sempre' : item.regra;
    if (!(REGRAS as readonly unknown[]).includes(regra)) { erro('regra', `A conexão "${id}" tem uma regra que não existe.`, id); continue; }
    const c: Conexao = { id, de: item.de, para: item.para, regra: regra as Regra };
    const valor = opcional(item.valor);
    if (valor) c.valor = valor;
    const rotulo = opcional(item.rotulo);
    if (rotulo) c.rotulo = rotulo;
    if (c.regra === 'tempo') {
      if (!ehNumero(item.tempo_s) || item.tempo_s < 0) erro('tempo', `A conexão "${id}" é "depois de um tempo" e não diz quanto.`, id);
      else c.tempo_s = Math.round(item.tempo_s);
    }
    if (c.regra === 'horario') {
      if (item.horario !== 'dentro' && item.horario !== 'fora') erro('horario', `A conexão "${id}" é de horário e não diz se é dentro ou fora.`, id);
      else c.horario = item.horario;
    }
    conexoes.push(c);
  }

  const caixa = (item: Record<string, unknown>, tipo: string) => {
    const ok = ehNumero(item.x) && ehNumero(item.y) && ehNumero(item.w) && ehNumero(item.h) && item.w > 0 && item.h > 0;
    if (!ok) erro('posicao', `${tipo} "${String(item.id)}" não tem posição e tamanho.`, String(item.id));
    return ok ? { x: item.x as number, y: item.y as number, w: item.w as number, h: item.h as number } : { x: 0, y: 0, w: 1, h: 1 };
  };
  const grupos: Grupo[] = [];
  for (const item of bruto.grupos as Record<string, unknown>[]) {
    if (!ehTexto(item?.id)) continue;
    const g: Grupo = { id: item.id, nome: ehTexto(item.nome) ? item.nome.trim() : '', ...caixa(item, 'O grupo') };
    const cor = opcional(item.cor);
    if (cor) g.cor = cor;
    grupos.push(g);
  }
  const notas: Nota[] = [];
  for (const item of bruto.notas as Record<string, unknown>[]) {
    if (!ehTexto(item?.id)) continue;
    const n: Nota = { id: item.id, texto: ehTexto(item.texto) ? item.texto : '', ...caixa(item, 'A nota') };
    const cor = opcional(item.cor);
    if (cor) n.cor = cor;
    notas.push(n);
  }

  const temErro = problemas.some((p) => p.gravidade === 'erro');
  return { documento: temErro ? null : { formato: FORMATO, pecas, conexoes, grupos, notas }, problemas };
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npm test -w packages/fluxo && npm run typecheck -w packages/fluxo`
Expected: `Tests  12 passed (12)` e o `tsc` sem saída.

- [ ] **Passo 5: commit**

```bash
git add packages/fluxo
git commit -m "fluxo: lerDocumento confere o documento e devolve uma cópia limpa" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 3: o índice e o motor

**Arquivos:**
- Criar: `packages/fluxo/src/indice.ts`, `packages/fluxo/src/motor.ts`
- Criar: `packages/fluxo/test/motor.test.ts`

- [ ] **Passo 1: escrever o teste**

`packages/fluxo/test/motor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { executar, simular, type Evento } from '../src/motor';
import type { Cadastro } from '../src/cadastros';
import { doc, liga, peca } from './apoio';

const tipos = (es: readonly Evento[]) => es.map((e) => e.tipo);
const ultimo = (es: readonly Evento[]) => es[es.length - 1]!;

const HORARIO: Cadastro = { id: 'h', tipo: 'horario', nome: 'Comercial', campos: { janelas: [{ dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }], feriados: [] } };

describe('motor', () => {
  it('anda sozinho por uma saída só, somando o tempo das peças', () => {
    const d = doc([peca('i', 'inicio'), peca('m', 'mensagem', { tempo_s: 5 }), peca('e', 'etapa', { tempo_s: 60 }), peca('f', 'fim')], [liga('i', 'm'), liga('m', 'e'), liga('e', 'f')]);
    const x = executar(d, {}, { inicio: 'i' });
    expect(x.terminou).toBe(true);
    expect(ultimo(x.eventos)).toEqual({ tipo: 'terminou', motivo: 'fim', peca: 'f', relogio_s: 65 });
    expect(x.eventos.filter((e) => e.tipo === 'chegou').map((e) => (e as { relogio_s: number }).relogio_s)).toEqual([0, 0, 5, 65]);
    expect(x.eventos.filter((e) => e.tipo === 'escolheu').every((e) => (e as { quem: string }).quem === 'unica')).toBe(true);
  });

  it('mais de uma saída: pergunta, e a escolha segue pelo caminho', () => {
    const d = doc(
      [peca('i', 'inicio'), peca('d', 'decisao', { nome: 'Assunto?' }), peca('a', 'fim', { nome: 'Financeiro' }), peca('b', 'fim', { nome: 'Suporte' })],
      [liga('i', 'd'), liga('d', 'a', { id: 'op1', regra: 'opcao', valor: '1', rotulo: 'Financeiro' }), liga('d', 'b', { id: 'op2', regra: 'opcao', valor: '2' })],
    );
    const x = executar(d, {}, { inicio: 'i' });
    expect(x.pendente).toEqual({
      peca: 'd',
      opcoes: [
        { conexao: 'op1', para: 'a', texto: '1 · Financeiro', regra: 'opcao', tempo_s: 0, sugerida: false },
        { conexao: 'op2', para: 'b', texto: '2', regra: 'opcao', tempo_s: 0, sugerida: false },
      ],
    });
    expect(tipos(x.avancar('op2'))).toEqual(['escolheu', 'correu', 'chegou', 'terminou']);
    expect(ultimo(x.eventos)).toMatchObject({ motivo: 'fim', peca: 'b' });
  });

  it('opção sem texto mostra o nome do destino', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'fim', { nome: 'A' }), peca('b', 'fim', { nome: 'B' })], [liga('i', 'a'), liga('i', 'b')]);
    expect(executar(d, {}, { inicio: 'i' }).pendente!.opcoes.map((o) => o.texto)).toEqual(['A', 'B']);
  });

  it('resposta que não é opção vira escolha_ignorada e a pergunta continua', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'fim'), peca('b', 'fim')], [liga('i', 'a'), liga('i', 'b')]);
    const x = executar(d, {}, { inicio: 'i' });
    expect(x.avancar('nao-existe')).toEqual([{ tipo: 'escolha_ignorada', resposta: 'nao-existe' }]);
    expect(x.pendente).not.toBeNull();
    x.avancar('i>a');
    expect(x.avancar('i>b')).toEqual([{ tipo: 'escolha_ignorada', resposta: 'i>b' }]);
  });

  it('conexão "depois de um tempo" soma no relógio', () => {
    const d = doc([peca('i', 'inicio'), peca('w', 'espera'), peca('ok', 'fim'), peca('tarde', 'fim')], [liga('i', 'w'), liga('w', 'ok', { regra: 'condicao', valor: 'respondeu' }), liga('w', 'tarde', { id: 't', regra: 'tempo', tempo_s: 7200 })]);
    const x = executar(d, {}, { inicio: 'i' });
    expect(x.pendente!.opcoes.find((o) => o.conexao === 't')).toMatchObject({ texto: 'após 2 h', tempo_s: 7200 });
    x.avancar('t');
    expect(ultimo(x.eventos)).toMatchObject({ motivo: 'fim', peca: 'tarde', relogio_s: 7200 });
  });

  describe('relógio', () => {
    const d = doc(
      [peca('i', 'inicio', { tempo_s: 0 }), peca('h', 'decisao', { responsavel: 'h', tempo_s: 0 }), peca('aberto', 'fim'), peca('fechado', 'fim')],
      [liga('i', 'h'), liga('h', 'aberto', { id: 'dentro', regra: 'horario', horario: 'dentro' }), liga('h', 'fechado', { id: 'fora', regra: 'horario', horario: 'fora' })],
    );
    it('decide sozinho pela hora simulada', () => {
      expect(ultimo(executar(d, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-23T10:00' }).eventos)).toMatchObject({ peca: 'aberto' });
      const fora = executar(d, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-22T10:00' });
      expect(ultimo(fora.eventos)).toMatchObject({ peca: 'fechado' });
      expect(fora.eventos.find((e) => e.tipo === 'escolheu' && e.peca === 'h')).toMatchObject({ quem: 'relogio', conexao: 'fora' });
    });
    it('conta o tempo que já passou: chegar às 17h58 com 5 min de fila já é fora', () => {
      const comFila = { ...d, pecas: d.pecas.map((p) => (p.id === 'i' ? { ...p, tempo_s: 300 } : p)) };
      expect(ultimo(executar(comFila, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-23T17:58' }).eventos)).toMatchObject({ peca: 'fechado' });
    });
    it('no modo livre pergunta, com a escolha do relógio sugerida', () => {
      const x = executar(d, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-23T10:00', modo: 'livre' });
      expect(x.pendente!.opcoes.map((o) => [o.conexao, o.sugerida])).toEqual([['dentro', true], ['fora', false]]);
    });
    it('sem hora ou sem o cadastro de horário, pergunta', () => {
      expect(executar(d, { cadastros: [HORARIO] }, { inicio: 'i' }).pendente).not.toBeNull();
      expect(executar(d, {}, { inicio: 'i', quando: '2026-11-23T10:00' }).pendente).not.toBeNull();
    });
  });

  it('o canal muda quando a peça diz; sem canal, segue o de antes', () => {
    const d = doc([peca('i', 'inicio', { canal: 'whatsapp' }), peca('m', 'mensagem'), peca('e', 'mensagem', { canal: 'email' }), peca('f', 'fim')], [liga('i', 'm'), liga('m', 'e'), liga('e', 'f')]);
    const canais = executar(d, { canal: 'chat' }, { inicio: 'i' }).eventos.filter((e) => e.tipo === 'chegou').map((e) => (e as { canal: string }).canal);
    expect(canais).toEqual(['whatsapp', 'whatsapp', 'email', 'email']);
    expect(executar(doc([peca('i', 'inicio'), peca('f', 'fim')], [liga('i', 'f')]), { canal: 'chat' }, { inicio: 'i' }).canal).toBe('chat');
  });

  it('peça sem saída que não é Fim termina como beco', () => {
    const x = executar(doc([peca('i', 'inicio'), peca('e', 'etapa')], [liga('i', 'e')]), {}, { inicio: 'i' });
    expect(ultimo(x.eventos)).toMatchObject({ tipo: 'terminou', motivo: 'beco', peca: 'e' });
  });

  it('ciclo andando sozinho termina na terceira volta', () => {
    const x = executar(doc([peca('i', 'inicio'), peca('a', 'etapa'), peca('b', 'etapa')], [liga('i', 'a'), liga('a', 'b'), liga('b', 'a')]), {}, { inicio: 'i' });
    expect(ultimo(x.eventos)).toMatchObject({ motivo: 'ciclo', peca: 'a' });
  });

  it('voltar por escolha de uma pessoa não é ciclo', () => {
    const d = doc([peca('i', 'inicio'), peca('m', 'decisao'), peca('f', 'fim')], [liga('i', 'm'), liga('m', 'm', { id: 'repete', regra: 'opcao', valor: '9' }), liga('m', 'f', { id: 'sai', regra: 'opcao', valor: '1' })]);
    const x = simular(d, {}, { inicio: 'i', escolhas: ['repete', 'repete', 'repete', 'repete', 'sai'] });
    expect(ultimo(x.eventos)).toMatchObject({ motivo: 'fim', peca: 'f' });
  });

  it('início que não existe termina na hora', () => {
    expect(executar(doc([]), {}, { inicio: 'x' }).eventos).toEqual([{ tipo: 'terminou', motivo: 'inexistente', peca: null, relogio_s: 0 }]);
  });

  it('previsível: as mesmas escolhas dão os mesmos eventos', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'fim'), peca('b', 'fim')], [liga('i', 'a'), liga('i', 'b')]);
    expect(simular(d, {}, { inicio: 'i', escolhas: ['i>b'] }).eventos).toEqual(simular(d, {}, { inicio: 'i', escolhas: ['i>b'] }).eventos);
  });

  it('data inválida é erro de quem chama', () => {
    expect(() => executar(doc([peca('i', 'inicio')]), {}, { inicio: 'i', quando: 'ontem' })).toThrow('AAAA-MM-DDTHH:MM');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npm test -w packages/fluxo -- motor`
Expected: FAIL, `Failed to resolve import "../src/motor"`.

- [ ] **Passo 3: o índice**

`packages/fluxo/src/indice.ts`:

```ts
import { formatarTempo } from './relogio';
import type { Conexao, Documento, Peca } from './documento';

/** O documento com acesso rápido: peça por id e saídas e entradas de cada peça (só conexões entre peças que existem). */
export interface Indice {
  doc: Documento;
  pecas: Map<string, Peca>;
  saidas: Map<string, Conexao[]>;
  entradas: Map<string, Conexao[]>;
}

export function indexar(doc: Documento): Indice {
  const pecas = new Map(doc.pecas.map((p) => [p.id, p]));
  const saidas = new Map<string, Conexao[]>(doc.pecas.map((p) => [p.id, []]));
  const entradas = new Map<string, Conexao[]>(doc.pecas.map((p) => [p.id, []]));
  for (const c of doc.conexoes) {
    if (!pecas.has(c.de) || !pecas.has(c.para)) continue;
    saidas.get(c.de)!.push(c);
    entradas.get(c.para)!.push(c);
  }
  return { doc, pecas, saidas, entradas };
}

/** O texto que a conexão mostra no cano e na opção da simulação. Vazio quando não há o que dizer. */
export function textoRegra(c: Conexao): string {
  switch (c.regra) {
    case 'opcao':
      return [c.valor, c.rotulo].filter(Boolean).join(' · ') || 'opção';
    case 'condicao':
      return c.valor ? `se ${c.valor}` : 'se…';
    case 'tempo':
      return `após ${formatarTempo(c.tempo_s ?? 0)}`;
    case 'horario':
      return c.horario === 'fora' ? 'fora do horário' : 'dentro do horário';
    case 'senao':
      return 'senão';
    default:
      return c.rotulo ?? '';
  }
}
```

- [ ] **Passo 4: o motor**

`packages/fluxo/src/motor.ts`:

```ts
import { camposHorario, type Cadastro } from './cadastros';
import { indexar, textoRegra, type Indice } from './indice';
import { dentroDoHorario, lerQuando } from './relogio';
import type { Conexao, Documento, Regra } from './documento';

/** O que o motor sabe da empresa: os cadastros (pros horários) e o canal do fluxo. */
export interface Contexto {
  cadastros?: readonly Cadastro[];
  /** O canal em que a água começa, quando o Início não diz. */
  canal?: string;
}

/**
 * - relogio: decisões com saídas de horário são decididas pelo relógio (precisa de `quando`); o resto pergunta.
 * - livre: tudo pergunta; a escolha do relógio vem marcada como sugerida.
 */
export type Modo = 'relogio' | 'livre';

export interface OpcoesExecucao {
  /** Id da peça onde a água começa (normalmente um Início). */
  inicio: string;
  /** Data e hora simuladas do começo, AAAA-MM-DDTHH:MM. Sem ela, o relógio não decide. */
  quando?: string;
  modo?: Modo;
}

export interface Opcao {
  conexao: string;
  para: string;
  /** O que a opção diz: o texto da regra, ou o nome do destino. */
  texto: string;
  regra: Regra;
  /** Quanto o relógio anda se for por aqui (regra tempo). */
  tempo_s: number;
  /** No modo livre: o que o relógio escolheria. */
  sugerida: boolean;
}

export type QuemEscolheu = 'unica' | 'pessoa' | 'relogio';
export type MotivoFim = 'fim' | 'beco' | 'ciclo' | 'inexistente';

export type Evento =
  | { tipo: 'chegou'; peca: string; canal: string | null; relogio_s: number }
  | { tipo: 'pede_escolha'; peca: string; opcoes: Opcao[] }
  | { tipo: 'escolheu'; peca: string; conexao: string; quem: QuemEscolheu }
  | { tipo: 'correu'; conexao: string; de: string; para: string; relogio_s: number }
  | { tipo: 'escolha_ignorada'; resposta: string }
  | { tipo: 'terminou'; motivo: MotivoFim; peca: string | null; relogio_s: number };

/** Chegar pela terceira vez na mesma peça sem ninguém escolher no meio é ciclo sem fim. */
const VOLTAS_MAXIMAS = 3;
/** Trava de segurança: nenhum fluxo de verdade dá tantos passos sozinho. */
const PASSOS_MAXIMOS = 10_000;

/**
 * Uma simulação. Previsível: o mesmo documento, o mesmo começo e as mesmas escolhas dão os mesmos eventos.
 * Anda sozinha enquanto há uma saída só (ou o relógio decide) e para quando precisa de uma escolha (`pendente`).
 */
export class Execucao {
  readonly eventos: Evento[] = [];
  pendente: { peca: string; opcoes: Opcao[] } | null = null;
  terminou = false;
  relogio_s = 0;
  canal: string | null;

  private readonly idx: Indice;
  private readonly cadastros: Map<string, Cadastro>;
  private readonly inicioMs: number | null;
  private readonly modo: Modo;
  private readonly visitas = new Map<string, number>();
  private passos = 0;

  constructor(doc: Documento, contexto: Contexto, opcoes: OpcoesExecucao) {
    this.idx = indexar(doc);
    this.cadastros = new Map((contexto.cadastros ?? []).map((c) => [c.id, c]));
    this.inicioMs = opcoes.quando ? lerQuando(opcoes.quando) : null;
    this.modo = opcoes.modo ?? 'relogio';
    this.canal = contexto.canal ?? null;
    if (!this.idx.pecas.has(opcoes.inicio)) this.terminar('inexistente', null);
    else this.chegar(opcoes.inicio);
  }

  /** Responde a escolha pendente com o id de uma conexão. Resposta que não serve vira `escolha_ignorada`. Devolve os eventos novos. */
  avancar(conexao: string): Evento[] {
    const antes = this.eventos.length;
    const pend = this.pendente;
    if (this.terminou || !pend || !pend.opcoes.some((o) => o.conexao === conexao)) {
      this.eventos.push({ tipo: 'escolha_ignorada', resposta: conexao });
      return this.eventos.slice(antes);
    }
    this.pendente = null;
    // Depois de uma escolha, a contagem de voltas recomeça: só caminho que anda sozinho vira ciclo.
    this.visitas.clear();
    this.eventos.push({ tipo: 'escolheu', peca: pend.peca, conexao, quem: 'pessoa' });
    this.correr(this.idx.doc.conexoes.find((c) => c.id === conexao)!);
    return this.eventos.slice(antes);
  }

  private terminar(motivo: MotivoFim, peca: string | null) {
    this.terminou = true;
    this.pendente = null;
    this.eventos.push({ tipo: 'terminou', motivo, peca, relogio_s: this.relogio_s });
  }

  private chegar(id: string) {
    const p = this.idx.pecas.get(id)!;
    const voltas = (this.visitas.get(id) ?? 0) + 1;
    this.visitas.set(id, voltas);
    if (p.canal) this.canal = p.canal;
    this.eventos.push({ tipo: 'chegou', peca: id, canal: this.canal, relogio_s: this.relogio_s });
    if (voltas >= VOLTAS_MAXIMAS || ++this.passos > PASSOS_MAXIMOS) return this.terminar('ciclo', id);
    this.relogio_s += p.tempo_s ?? 0;
    if (p.tipo === 'fim') return this.terminar('fim', id);
    const saidas = this.idx.saidas.get(id)!;
    if (saidas.length === 0) return this.terminar('beco', id);
    if (saidas.length === 1) {
      this.eventos.push({ tipo: 'escolheu', peca: id, conexao: saidas[0]!.id, quem: 'unica' });
      return this.correr(saidas[0]!);
    }
    const doRelogio = this.escolhaDoRelogio(id, saidas);
    if (doRelogio && this.modo === 'relogio') {
      this.eventos.push({ tipo: 'escolheu', peca: id, conexao: doRelogio.id, quem: 'relogio' });
      return this.correr(doRelogio);
    }
    const opcoes: Opcao[] = saidas.map((c) => ({
      conexao: c.id,
      para: c.para,
      texto: textoRegra(c) || this.idx.pecas.get(c.para)!.nome,
      regra: c.regra,
      tempo_s: c.regra === 'tempo' ? (c.tempo_s ?? 0) : 0,
      sugerida: doRelogio?.id === c.id,
    }));
    this.pendente = { peca: id, opcoes };
    this.eventos.push({ tipo: 'pede_escolha', peca: id, opcoes });
  }

  /** A saída que o relógio escolhe: a de horário que bate com a hora simulada (com o horário do responsável da peça). */
  private escolhaDoRelogio(id: string, saidas: Conexao[]): Conexao | null {
    if (this.inicioMs === null || !saidas.some((c) => c.regra === 'horario')) return null;
    const horario = camposHorario(this.cadastros.get(this.idx.pecas.get(id)!.responsavel ?? ''));
    if (!horario) return null;
    const lado = dentroDoHorario(horario, this.inicioMs + this.relogio_s * 1000) ? 'dentro' : 'fora';
    return saidas.find((c) => c.regra === 'horario' && c.horario === lado) ?? saidas.find((c) => c.regra === 'senao') ?? null;
  }

  private correr(c: Conexao) {
    if (c.regra === 'tempo') this.relogio_s += c.tempo_s ?? 0;
    this.eventos.push({ tipo: 'correu', conexao: c.id, de: c.de, para: c.para, relogio_s: this.relogio_s });
    this.chegar(c.para);
  }
}

export function executar(doc: Documento, contexto: Contexto, opcoes: OpcoesExecucao): Execucao {
  return new Execucao(doc, contexto, opcoes);
}

/** Refaz uma simulação a partir das escolhas (ids de conexão), em ordem. É assim que cenário, voltar e link refazem o caminho. */
export function simular(doc: Documento, contexto: Contexto, opcoes: OpcoesExecucao & { escolhas?: readonly string[] }): Execucao {
  const e = executar(doc, contexto, opcoes);
  for (const c of opcoes.escolhas ?? []) e.avancar(c);
  return e;
}
```

- [ ] **Passo 5: rodar e ver passar**

Run: `npm test -w packages/fluxo && npm run typecheck -w packages/fluxo`
Expected: `Tests  28 passed (28)` e o `tsc` sem saída.

- [ ] **Passo 6: commit**

```bash
git add packages/fluxo
git commit -m "fluxo: motor genérico com relógio de Horário" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 4: o diagnóstico

**Arquivos:**
- Criar: `packages/fluxo/src/diagnostico.ts`
- Criar: `packages/fluxo/test/diagnostico.test.ts`

- [ ] **Passo 1: escrever o teste**

`packages/fluxo/test/diagnostico.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { diagnosticar } from '../src/diagnostico';
import { doc, liga, peca } from './apoio';

const chaves = (...args: Parameters<typeof diagnosticar>) => diagnosticar(...args).map((a) => a.chave);
const HORARIO = { id: 'h', tipo: 'horario', nome: 'Comercial', campos: { janelas: [], feriados: [] } };

describe('diagnóstico', () => {
  it('fluxo limpo não tem achado', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('f', 'fim')], [liga('i', 'f')]))).toEqual([]);
    expect(chaves(doc([]))).toEqual([]);
  });

  it('sem Início', () => {
    expect(chaves(doc([peca('f', 'fim')]))).toEqual(['sem_inicio:fluxo']);
  });

  it('beco sem saída e Início que não termina', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('e', 'etapa')], [liga('i', 'e')]))).toEqual(['beco_sem_saida:e', 'nao_termina:i']);
  });

  it('peça que ninguém alcança', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('f', 'fim'), peca('solta', 'fim')], [liga('i', 'f')]))).toEqual(['inalcancavel:solta']);
  });

  it('ciclo sem saída, e ciclo com saída não é achado', () => {
    const preso = doc([peca('i', 'inicio'), peca('a', 'etapa'), peca('b', 'etapa'), peca('f', 'fim')], [liga('i', 'a'), liga('a', 'b'), liga('b', 'a')]);
    expect(chaves(preso)).toEqual(['ciclo_sem_saida:a+b', 'nao_termina:i', 'inalcancavel:f']);
    const comSaida = doc(preso.pecas, [liga('i', 'a'), liga('a', 'b'), liga('b', 'a', { regra: 'opcao', valor: '2' }), liga('b', 'f', { regra: 'opcao', valor: '1' })]);
    expect(chaves(comSaida).filter((k) => k.startsWith('ciclo'))).toEqual([]);
  });

  it('laço numa peça só', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('a', 'etapa')], [liga('i', 'a'), liga('a', 'a')]))).toContain('ciclo_sem_saida:a');
  });

  it('decisão com uma saída só', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('d', 'decisao'), peca('f', 'fim')], [liga('i', 'd'), liga('d', 'f')]))).toEqual(['decisao_sem_escolha:d']);
  });

  it('opções repetidas na mesma peça', () => {
    const d = doc(
      [peca('i', 'inicio'), peca('d', 'decisao'), peca('a', 'fim'), peca('b', 'fim')],
      [liga('i', 'd'), liga('d', 'a', { regra: 'opcao', valor: '1' }), liga('d', 'b', { regra: 'opcao', valor: '1' })],
    );
    expect(diagnosticar(d)).toEqual([expect.objectContaining({ chave: 'opcoes_repetidas:d:opcao:1', refs: ['d', 'd>a', 'd>b'] })]);
  });

  it('regra pela metade', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'fim'), peca('b', 'fim')], [liga('i', 'a', { regra: 'condicao' }), liga('i', 'b', { regra: 'opcao', valor: '2' })]);
    expect(chaves(d)).toEqual(['regra_vazia:i>a']);
  });

  it('atendimento sem responsável e responsável que não existe', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'atendimento'), peca('b', 'atendimento', { responsavel: 'k9' }), peca('f', 'fim')], [liga('i', 'a'), liga('a', 'b'), liga('b', 'f')]);
    expect(chaves(d)).toEqual(['sem_responsavel:a']);
    expect(chaves(d, { cadastros: [] })).toEqual(['responsavel_inexistente:b', 'sem_responsavel:a']);
  });

  it('decisão de horário sem um cadastro Horário', () => {
    const pecas = [peca('i', 'inicio'), peca('h', 'decisao', { responsavel: 'k1' }), peca('a', 'fim'), peca('b', 'fim')];
    const conexoes = [liga('i', 'h'), liga('h', 'a', { regra: 'horario', horario: 'dentro' as const }), liga('h', 'b', { regra: 'horario', horario: 'fora' as const })];
    expect(chaves(doc(pecas, conexoes), { cadastros: [{ id: 'k1', tipo: 'fila', nome: 'Fila' }] })).toEqual(['horario_sem_cadastro:h']);
    expect(chaves(doc(pecas.map((p) => (p.id === 'h' ? { ...p, responsavel: 'h' } : p)), conexoes), { cadastros: [HORARIO] })).toEqual([]);
  });

  it('caminho mais longo acima da meta', () => {
    const d = doc(
      [peca('i', 'inicio'), peca('a', 'atendimento', { responsavel: 'k', tempo_s: 3600 }), peca('w', 'espera'), peca('f', 'fim')],
      [liga('i', 'a'), liga('a', 'w'), liga('w', 'f', { regra: 'tempo', tempo_s: 7200 })],
    );
    expect(chaves(d, { meta_s: 4 * 3600 })).toEqual([]);
    const [a] = diagnosticar(d, { meta_s: 2 * 3600 });
    expect(a).toMatchObject({ chave: 'passou_do_prazo:fluxo', refs: ['i', 'a', 'w', 'f'] });
    expect(a!.texto).toContain('3 h');
  });

  it('ordem: grave, alerta, observação; a chave não depende do nome', () => {
    const d = doc([peca('i', 'inicio'), peca('e', 'etapa', { nome: 'X' }), peca('s', 'atendimento'), peca('f', 'fim')], [liga('i', 'e')]);
    const g = diagnosticar(d).map((a) => a.gravidade);
    expect(g).toEqual([...g].sort((a, b) => ['grave', 'alerta', 'observacao'].indexOf(a) - ['grave', 'alerta', 'observacao'].indexOf(b)));
    const renomeado = { ...d, pecas: d.pecas.map((p) => ({ ...p, nome: `${p.nome}!` })) };
    expect(chaves(renomeado)).toEqual(chaves(d));
  });

  it('500 peças em menos de 100 ms', () => {
    const pecas = [peca('i', 'inicio'), ...Array.from({ length: 498 }, (_, k) => peca(`p${k}`, k % 7 === 0 ? 'decisao' : 'etapa')), peca('f', 'fim')];
    const conexoes = [liga('i', 'p0'), ...Array.from({ length: 497 }, (_, k) => liga(`p${k}`, `p${k + 1}`)), ...Array.from({ length: 70 }, (_, k) => liga(`p${k * 7}`, 'f', { regra: 'opcao', valor: '9' })), liga('p497', 'f')];
    const d = doc(pecas, conexoes);
    const t0 = performance.now();
    diagnosticar(d, { meta_s: 60 });
    expect(performance.now() - t0).toBeLessThan(100);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npm test -w packages/fluxo -- diagnostico`
Expected: FAIL, `Failed to resolve import "../src/diagnostico"`.

- [ ] **Passo 3: o diagnóstico**

`packages/fluxo/src/diagnostico.ts`:

```ts
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
  const visitar = (id: string, tempo: number, caminho: string[], vistos: Set<string>) => {
    if (++buscas > 50_000) return;
    const p = idx.pecas.get(id)!;
    const agora = tempo + (p.tempo_s ?? 0);
    if (p.tipo === 'fim') { if (!melhor || agora > melhor.tempo_s) melhor = { tempo_s: agora, pecas: [...caminho] }; return; }
    for (const c of idx.saidas.get(id)!) {
      if (vistos.has(c.para)) continue;
      vistos.add(c.para); caminho.push(c.para);
      visitar(c.para, agora + (c.regra === 'tempo' ? (c.tempo_s ?? 0) : 0), caminho, vistos);
      caminho.pop(); vistos.delete(c.para);
    }
  };
  for (const i of inicios) visitar(i, 0, [i], new Set([i]));
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
      const h = camposHorario(opcoes.cadastros.find((k) => k.id === p.responsavel));
      if (!h) achado('horario_sem_cadastro', 'alerta', p.id, `${p.nome} decide pelo horário, mas sem um Horário`, `As saídas de ${p.nome} são "dentro" e "fora do horário", mas a peça não usa um cadastro de Horário: o relógio não tem como decidir.`, [p.id]);
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
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npm test -w packages/fluxo && npm run typecheck -w packages/fluxo`
Expected: `Tests  42 passed (42)` e o `tsc` sem saída. Se o de 500 peças passar de 100 ms, rode de novo sozinho (`-- diagnostico -t 500`) antes de concluir que é lento: a primeira rodada aquece o JIT.

- [ ] **Passo 5: commit**

```bash
git add packages/fluxo
git commit -m "fluxo: diagnóstico genérico" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 5: os modelos e o que o pacote exporta

**Arquivos:**
- Criar: `packages/fluxo/src/modelos.ts`, `packages/fluxo/src/index.ts`
- Criar: `packages/fluxo/test/modelos.test.ts`

- [ ] **Passo 1: escrever o teste**

Cada modelo tem que ser um documento válido sem aviso, sem achado grave nem alerta, e chegar num Fim escolhendo sempre a primeira opção numa segunda às 10h; os que têm horário mandam pro "fora" num domingo.

`packages/fluxo/test/modelos.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { diagnosticar } from '../src/diagnostico';
import { MODELOS } from '../src/modelos';
import { simular, type Evento } from '../src/motor';
import { lerDocumento } from '../src/validar';

const ultimo = (es: readonly Evento[]) => es[es.length - 1]!;

describe.each(MODELOS.map((m) => [m.nome, m] as const))('modelo %s', (_nome, m) => {
  const conhecidos = { canais: ['telefonia', 'whatsapp', 'email', 'chat', 'interno'], cadastros: m.cadastros.map((k) => k.id) };

  it('é um documento válido, sem aviso', () => {
    const r = lerDocumento(m.documento, conhecidos);
    expect(r.problemas).toEqual([]);
    expect(r.documento).toEqual(m.documento);
  });

  it('não tem achado grave nem alerta', () => {
    expect(diagnosticar(m.documento, { cadastros: m.cadastros }).filter((a) => a.gravidade !== 'observacao')).toEqual([]);
  });

  it('chega num Fim escolhendo sempre a primeira opção, numa segunda às 10h', () => {
    const inicio = m.documento.pecas.find((p) => p.tipo === 'inicio')!.id;
    const ctx = { cadastros: m.cadastros, canal: m.canal };
    const escolhas: string[] = [];
    let x = simular(m.documento, ctx, { inicio, quando: '2026-11-23T10:00' });
    while (x.pendente) {
      escolhas.push(x.pendente.opcoes[0]!.conexao);
      x = simular(m.documento, ctx, { inicio, quando: '2026-11-23T10:00', escolhas });
    }
    expect(ultimo(x.eventos)).toMatchObject({ tipo: 'terminou', motivo: 'fim' });
  });
});

describe('modelos com horário', () => {
  it('num domingo, o relógio manda pro "fora do horário"', () => {
    for (const m of MODELOS.filter((x) => x.documento.conexoes.some((c) => c.regra === 'horario'))) {
      const inicio = m.documento.pecas.find((p) => p.tipo === 'inicio')!.id;
      const x = simular(m.documento, { cadastros: m.cadastros }, { inicio, quando: '2026-11-22T10:00' });
      const pelo = x.eventos.find((e) => e.tipo === 'escolheu' && e.quem === 'relogio');
      expect(m.documento.conexoes.find((c) => c.id === (pelo as { conexao: string }).conexao)!.horario).toBe('fora');
    }
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npm test -w packages/fluxo -- modelos`
Expected: FAIL, `Failed to resolve import "../src/modelos"`.

- [ ] **Passo 3: os modelos**

`packages/fluxo/src/modelos.ts`:

```ts
import { FORMATO, type Conexao, type Documento, type Peca, type TipoPeca } from './documento';
import type { Cadastro } from './cadastros';

/**
 * Fluxos prontos pra começar. Os ids dos cadastros aqui são locais ao modelo: quem copia um modelo pra uma
 * empresa troca cada um por um cadastro da empresa (com o mesmo nome e tipo, criando se precisar).
 */
export interface Modelo {
  chave: 'whatsapp' | 'credito' | 'email' | 'ura';
  nome: string;
  descricao: string;
  canal: string;
  documento: Documento;
  cadastros: Cadastro[];
}

const peca = (id: string, tipo: TipoPeca, x: number, y: number, nome: string, extra: Partial<Peca> = {}): Peca => ({ id, tipo, nome, x, y, ...extra });
const liga = (id: string, de: string, para: string, extra: Partial<Conexao> = {}): Conexao => ({ id, de, para, regra: 'sempre', ...extra });
const doc = (pecas: Peca[], conexoes: Conexao[], extra: Partial<Documento> = {}): Documento => ({ formato: FORMATO, pecas, conexoes, grupos: [], notas: [], ...extra });

const HORARIO_COMERCIAL: Cadastro = {
  id: 'horario-comercial',
  tipo: 'horario',
  nome: 'Horário comercial',
  campos: {
    janelas: [
      { dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' },
      { dias: ['sab'], inicio: '09:00', fim: '12:00' },
    ],
    feriados: [{ data: '2026-12-25', todo_ano: true, nome: 'Natal' }],
  },
};

export const MODELOS: readonly Modelo[] = [
  {
    chave: 'whatsapp',
    nome: 'Suporte no WhatsApp',
    descricao: 'Bot de boas-vindas, horário de atendimento, menu de assuntos, filas e encerramento por inatividade.',
    canal: 'whatsapp',
    cadastros: [HORARIO_COMERCIAL, { id: 'fila-financeiro', tipo: 'fila', nome: 'Fila Financeiro' }, { id: 'fila-suporte', tipo: 'fila', nome: 'Fila Suporte técnico' }],
    documento: doc(
      [
        peca('inicio', 'inicio', 0, 40, 'Cliente manda mensagem', { canal: 'whatsapp' }),
        peca('boas-vindas', 'mensagem', 260, 39, 'Boas-vindas do bot', { tempo_s: 3 }),
        peca('horario', 'decisao', 540, 0, 'Dentro do horário?', { responsavel: 'horario-comercial' }),
        peca('assunto', 'decisao', 900, -80, 'Qual assunto?'),
        peca('financeiro', 'atendimento', 1160, -70, 'Atende o financeiro', { responsavel: 'fila-financeiro', tempo_s: 360 }),
        peca('suporte', 'atendimento', 1160, 120, 'Atende o suporte', { responsavel: 'fila-suporte', tempo_s: 720 }),
        peca('aguardando', 'espera', 1530, 120, 'Aguardando o cliente'),
        peca('resolvido', 'fim', 1820, 20, 'Resolvido'),
        peca('protocolo', 'mensagem', 1820, 220, 'Envia protocolo por e-mail', { canal: 'email', tempo_s: 10 }),
        peca('inatividade', 'fim', 2110, 223, 'Encerrado por inatividade'),
        peca('fechado', 'mensagem', 560, 300, 'Avisa o horário de atendimento', { tempo_s: 4 }),
        peca('encerra', 'fim', 860, 303, 'Encerra a conversa'),
      ],
      [
        liga('c1', 'inicio', 'boas-vindas'),
        liga('c2', 'boas-vindas', 'horario'),
        liga('c3', 'horario', 'assunto', { regra: 'horario', horario: 'dentro' }),
        liga('c4', 'horario', 'fechado', { regra: 'horario', horario: 'fora' }),
        liga('c5', 'assunto', 'financeiro', { regra: 'opcao', valor: '1', rotulo: 'Financeiro' }),
        liga('c6', 'assunto', 'suporte', { regra: 'opcao', valor: '2', rotulo: 'Suporte' }),
        liga('c7', 'financeiro', 'resolvido'),
        liga('c8', 'suporte', 'aguardando'),
        liga('c9', 'aguardando', 'resolvido', { regra: 'condicao', valor: 'respondeu' }),
        liga('c10', 'aguardando', 'protocolo', { regra: 'tempo', tempo_s: 7200 }),
        liga('c11', 'protocolo', 'inatividade'),
        liga('c12', 'fechado', 'encerra'),
      ],
      {
        grupos: [{ id: 'humano', nome: 'Atendimento humano', x: 860, y: -110, w: 600, h: 330, cor: '#dcecf8' }],
        notas: [{ id: 'nota', texto: 'Dá play no Início e escolhe os caminhos. O horário decide sozinho pela data e hora da simulação.', x: 240, y: 230, w: 190, h: 110 }],
      },
    ),
  },
  {
    chave: 'credito',
    nome: 'Esteira de crédito',
    descricao: 'Pedido, consulta de score, aprovação automática, análise manual e aviso ao cliente.',
    canal: 'interno',
    cadastros: [{ id: 'bureau', tipo: 'sistema', nome: 'Bureau de crédito' }, { id: 'analistas', tipo: 'equipe', nome: 'Analistas de crédito' }],
    documento: doc(
      [
        peca('pedido', 'inicio', 0, 70, 'Pedido de crédito criado', { canal: 'interno' }),
        peca('score', 'sistema', 260, 69, 'Consulta o score', { responsavel: 'bureau', tempo_s: 20 }),
        peca('faixa', 'decisao', 540, 30, 'Score?'),
        peca('automatico', 'etapa', 760, -60, 'Aprova automático', { tempo_s: 60 }),
        peca('analise', 'atendimento', 730, 280, 'Análise do pedido', { responsavel: 'analistas', tempo_s: 14400 }),
        peca('analista', 'decisao', 1030, 240, 'Analista aprova?'),
        peca('liberado', 'fim', 1320, -56, 'Crédito liberado'),
        peca('aviso', 'mensagem', 1300, 140, 'Avisa o cliente por e-mail', { canal: 'email', tempo_s: 30 }),
        peca('negado', 'fim', 760, 520, 'Pedido negado'),
      ],
      [
        liga('c1', 'pedido', 'score'),
        liga('c2', 'score', 'faixa'),
        liga('c3', 'faixa', 'automatico', { regra: 'condicao', valor: 'score ≥ 700' }),
        liga('c4', 'faixa', 'analise', { regra: 'condicao', valor: '500 a 699' }),
        liga('c5', 'faixa', 'negado', { regra: 'senao' }),
        liga('c6', 'automatico', 'liberado'),
        liga('c7', 'analise', 'analista'),
        liga('c8', 'analista', 'aviso', { regra: 'opcao', valor: 'S', rotulo: 'Aprova' }),
        liga('c9', 'analista', 'negado', { regra: 'opcao', valor: 'N', rotulo: 'Nega' }),
        liga('c10', 'aviso', 'liberado'),
      ],
      { grupos: [{ id: 'manual', nome: 'Análise manual', x: 690, y: 210, w: 560, h: 250, cor: '#fbefd6' }] },
    ),
  },
  {
    chave: 'email',
    nome: 'SAC por e-mail',
    descricao: 'Resposta automática, triagem, espera pelo cliente e escalonamento pra supervisão.',
    canal: 'email',
    cadastros: [{ id: 'fila-sac', tipo: 'fila', nome: 'Fila SAC' }, { id: 'supervisao', tipo: 'equipe', nome: 'Supervisão SAC' }],
    documento: doc(
      [
        peca('chega', 'inicio', 0, 60, 'E-mail chega no SAC', { canal: 'email' }),
        peca('automatica', 'mensagem', 270, 59, 'Resposta automática com protocolo', { tempo_s: 5 }),
        peca('triagem', 'atendimento', 560, 59, 'Triagem', { responsavel: 'fila-sac', tempo_s: 7200 }),
        peca('aguardando', 'espera', 850, 59, 'Aguardando o cliente'),
        peca('resolvido', 'fim', 1140, -40, 'Resolvido'),
        peca('escala', 'atendimento', 1110, 170, 'Escala pra supervisão', { responsavel: 'supervisao', tempo_s: 3600 }),
        peca('encerrado', 'fim', 1400, 173, 'Encerrado pela supervisão'),
      ],
      [
        liga('c1', 'chega', 'automatica'),
        liga('c2', 'automatica', 'triagem'),
        liga('c3', 'triagem', 'aguardando'),
        liga('c4', 'aguardando', 'resolvido', { regra: 'condicao', valor: 'cliente respondeu' }),
        liga('c5', 'aguardando', 'escala', { regra: 'tempo', tempo_s: 172800 }),
        liga('c6', 'escala', 'encerrado'),
      ],
    ),
  },
  {
    chave: 'ura',
    nome: 'URA telefônica',
    descricao: 'Ligação com horário, menu por tecla, filas e caixa postal quando ninguém atende.',
    canal: 'telefonia',
    cadastros: [HORARIO_COMERCIAL, { id: 'fila-vendas', tipo: 'fila', nome: 'Fila Vendas' }, { id: 'fila-suporte', tipo: 'fila', nome: 'Fila Suporte' }],
    documento: doc(
      [
        peca('liga', 'inicio', 0, 40, 'Cliente liga no 0800', { canal: 'telefonia' }),
        peca('horario', 'decisao', 260, 0, 'Dentro do horário?', { responsavel: 'horario-comercial' }),
        peca('menu', 'decisao', 560, -60, 'Menu principal', { tempo_s: 8, descricao: 'Digite 1 para vendas ou 2 para suporte.' }),
        peca('vendas', 'atendimento', 840, -150, 'Atende vendas', { responsavel: 'fila-vendas', tempo_s: 120 }),
        peca('suporte', 'atendimento', 840, 20, 'Atende suporte', { responsavel: 'fila-suporte' }),
        peca('atendido', 'fim', 1180, -70, 'Atendido'),
        peca('caixa', 'mensagem', 1160, 120, 'Caixa postal', { tempo_s: 30 }),
        peca('desliga', 'fim', 1440, 123, 'Desliga'),
        peca('fechado', 'mensagem', 300, 240, 'Fora do horário', { tempo_s: 9 }),
      ],
      [
        liga('c1', 'liga', 'horario'),
        liga('c2', 'horario', 'menu', { regra: 'horario', horario: 'dentro' }),
        liga('c3', 'horario', 'fechado', { regra: 'horario', horario: 'fora' }),
        liga('c4', 'menu', 'vendas', { regra: 'opcao', valor: '1', rotulo: 'Vendas' }),
        liga('c5', 'menu', 'suporte', { regra: 'opcao', valor: '2', rotulo: 'Suporte' }),
        liga('c6', 'menu', 'desliga', { regra: 'senao' }),
        liga('c7', 'vendas', 'atendido'),
        liga('c8', 'suporte', 'atendido', { regra: 'condicao', valor: 'alguém atendeu' }),
        liga('c9', 'suporte', 'caixa', { regra: 'tempo', tempo_s: 180 }),
        liga('c10', 'caixa', 'desliga'),
        liga('c11', 'fechado', 'desliga'),
      ],
    ),
  },
];
```

- [ ] **Passo 4: o que o pacote exporta**

`packages/fluxo/src/index.ts`:

```ts
export { FORMATO, TIPOS_PECA, NOMES_TIPOS, REGRAS, documentoVazio, type TipoPeca, type Regra, type Peca, type Conexao, type Grupo, type Nota, type Documento } from './documento';
export { DIAS, CANAIS_PADRAO, TIPOS_CADASTRO_PADRAO, camposHorario, type Cadastro, type Canal, type Dia, type JanelaHorario, type Feriado, type CamposHorario } from './cadastros';
export { lerDocumento, type Problema, type Leitura, type Conhecidos } from './validar';
export { indexar, textoRegra, type Indice } from './indice';
export { lerQuando, dentroDoHorario, ehFeriado, formatarTempo } from './relogio';
export { Execucao, executar, simular, type Contexto, type Modo, type OpcoesExecucao, type Opcao, type QuemEscolheu, type MotivoFim, type Evento } from './motor';
export { diagnosticar, type Achado, type Gravidade, type OpcoesDiagnostico } from './diagnostico';
export { MODELOS, type Modelo } from './modelos';
```

- [ ] **Passo 5: rodar e ver passar**

Run: `npm test -w packages/fluxo && npm run typecheck -w packages/fluxo`
Expected: `Tests  55 passed (55)` e o `tsc` sem saída.

- [ ] **Passo 6: commit**

```bash
git add packages/fluxo
git commit -m "fluxo: modelos prontos (WhatsApp, crédito, e-mail, URA) e exportações" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 6: o banco do fluxo

**Arquivos:**
- Criar: `supabase/migrations/20261114000000_journey_v2_fluxos.sql`
- Criar: `supabase/tests/database/fluxos.test.sql`

- [ ] **Passo 1: escrever o teste pgTAP**

`supabase/tests/database/fluxos.test.sql`:

```sql
-- Journey v2 (etapa A): canais, cadastros, fluxos, salvar, trava e versões.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'ana@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000f2', 'caio@exemplo.com', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000f3', 'beto@exemplo.com', 'authenticated', 'authenticated', now());

create function pg_temp.entrar(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.doc(p_pecas jsonb default '[]') returns jsonb language sql as $$
  select jsonb_build_object('formato', 'journey/2', 'pecas', p_pecas, 'conexoes', '[]'::jsonb, 'grupos', '[]'::jsonb, 'notas', '[]'::jsonb);
$$;

set local role authenticated;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000f1');
select set_config('teste.a', public.criar_empresa('Empresa A')::text, true);
select pg_temp.entrar('00000000-0000-0000-0000-0000000000f3');
select set_config('teste.b', public.criar_empresa('Empresa B')::text, true);

reset role;
insert into public.membros (empresa_id, usuario_id, email) values (current_setting('teste.a')::uuid, '00000000-0000-0000-0000-0000000000f2', 'caio@exemplo.com');
set local role authenticated;

-- Empresa nova já vem com canais e tipos.
select pg_temp.entrar('00000000-0000-0000-0000-0000000000f1');
select is((select array_agg(chave order by ordem) from public.canais), array['telefonia', 'whatsapp', 'email', 'chat', 'interno'], 'empresa nova vem com os cinco canais');
select is((select array_agg(chave order by chave) from public.tipos_cadastro where padrao), array['equipe', 'fila', 'horario', 'pessoa', 'sistema'], 'e com os cinco tipos de cadastro');
select is((select count(*)::int from public.canais where empresa_id = current_setting('teste.b')::uuid), 0, 'não vê os canais de outra empresa');

-- Canais: muda e arquiva; não apaga.
select lives_ok($$ update public.canais set cor = '#000000', arquivado = true where chave = 'chat' $$, 'muda a cor e arquiva um canal');
select lives_ok($$ insert into public.canais (empresa_id, chave, nome, cor) values (current_setting('teste.a')::uuid, 'presencial', 'Presencial', '#888888') $$, 'cria um canal');
select throws_ok($$ insert into public.canais (empresa_id, chave, nome, cor) values (current_setting('teste.a')::uuid, 'Com Espaço', 'X', '#888888') $$, '23514', null, 'chave de canal só com minúsculas, números, - e _');
select throws_ok($$ delete from public.canais $$, '42501', null, 'canal não se apaga, se arquiva');

-- Tipos de cadastro: os padrão não se apagam; os próprios sim.
select lives_ok($$ insert into public.tipos_cadastro (empresa_id, chave, nome, campos) values (current_setting('teste.a')::uuid, 'loja', 'Loja', '[{"chave":"cidade","nome":"Cidade","tipo":"texto"}]') $$, 'cria um tipo de cadastro próprio');
delete from public.tipos_cadastro where chave = 'fila';
select ok(exists (select 1 from public.tipos_cadastro where chave = 'fila'), 'tipo padrão não se apaga');

-- Cadastros.
select lives_ok($$ insert into public.cadastros (empresa_id, tipo, nome) values (current_setting('teste.a')::uuid, 'fila', 'Fila Cobrança') $$, 'cria um cadastro');
select throws_ok($$ insert into public.cadastros (empresa_id, tipo, nome) values (current_setting('teste.a')::uuid, 'fila', '  fila cobrança ') $$, '23505', null, 'o mesmo nome no mesmo tipo não se repete, sem caixa nem espaços');
select throws_ok($$ insert into public.cadastros (empresa_id, tipo, nome) values (current_setting('teste.a')::uuid, 'robo', 'R2') $$, '23503', null, 'cadastro de tipo que a empresa não tem não entra');
select set_config('teste.fila', (select id::text from public.cadastros where nome = 'Fila Cobrança'), true);
select lives_ok($$ delete from public.tipos_cadastro where chave = 'loja' $$, 'tipo próprio sem cadastro se apaga');

-- Fluxos: criar só com nome; documento só pelo salvar.
select lives_ok($$ insert into public.fluxos (empresa_id, nome, canal) values (current_setting('teste.a')::uuid, 'Cobrança', 'whatsapp') $$, 'cria um fluxo');
select set_config('teste.f', (select id::text from public.fluxos), true);
select is((select revisao from public.fluxos), 0, 'nasce na revisão 0');
select is((select documento from public.fluxos), pg_temp.doc(), 'com o documento vazio');
select throws_ok($$ insert into public.fluxos (empresa_id, nome, documento) values (current_setting('teste.a')::uuid, 'X', '{}') $$, '42501', null, 'documento não se grava direto');
select throws_ok($$ update public.fluxos set revisao = 9 $$, '42501', null, 'nem a revisão');
select throws_ok($$ insert into public.fluxos (empresa_id, nome, canal) values (current_setting('teste.a')::uuid, 'X', 'fax') $$, '23503', null, 'canal tem que ser da empresa');

-- Salvar.
select is(public.salvar_fluxo(current_setting('teste.f')::uuid, 0,
  pg_temp.doc(jsonb_build_array(jsonb_build_object('id', 'a', 'tipo', 'atendimento', 'nome', 'Cobra', 'x', 0, 'y', 0, 'responsavel', current_setting('teste.fila')))),
  '{"velocidade":2}'), 1, 'salva e devolve a revisão nova');
select is((select array_agg(cadastro_id::text) from public.fluxo_cadastros), array[current_setting('teste.fila')], 'o "onde é usado" vem do documento');
select is((select estilo from public.fluxos), '{"velocidade":2}'::jsonb, 'e o estilo junto');
select throws_ok($$ select public.salvar_fluxo(current_setting('teste.f')::uuid, 0, pg_temp.doc()) $$, '40001', null, 'revisão velha: outra pessoa salvou no meio');
select throws_ok($$ select public.salvar_fluxo(current_setting('teste.f')::uuid, 1, '{"formato":"journey/1","pecas":[]}') $$, '23514', null, 'documento que não é journey/2 não entra');
select throws_ok($$ select public.salvar_fluxo(current_setting('teste.f')::uuid, 1, '{"formato":"journey/2"}') $$, '23514', null, 'nem documento sem as listas');
select throws_ok($$ select public.salvar_fluxo(current_setting('teste.f')::uuid, 1, pg_temp.doc('[{"id":"a","tipo":"etapa","nome":"x","x":0,"y":0,"responsavel":"maria"}]')) $$, '22023', null, 'responsável que não é cadastro não entra');
select throws_ok($$ delete from public.cadastros where id = current_setting('teste.fila')::uuid $$, '23503', null, 'cadastro em uso não se apaga');

select pg_temp.entrar('00000000-0000-0000-0000-0000000000f3');
select throws_ok($$ select public.salvar_fluxo(current_setting('teste.f')::uuid, 1, pg_temp.doc()) $$, 'P0002', null, 'quem é de outra empresa não salva');
select lives_ok($$ insert into public.cadastros (empresa_id, tipo, nome) values (current_setting('teste.b')::uuid, 'pessoa', 'Beto') $$, 'a outra empresa tem os cadastros dela');
select set_config('teste.beto', (select id::text from public.cadastros), true);

-- Trava.
select pg_temp.entrar('00000000-0000-0000-0000-0000000000f1');
select throws_ok(format($$ select public.salvar_fluxo(%L::uuid, 1, pg_temp.doc('[{"id":"a","tipo":"etapa","nome":"x","x":0,"y":0,"responsavel":"%s"}]')) $$, current_setting('teste.f'), current_setting('teste.beto')),
  '22023', null, 'responsável de outra empresa não entra');
select is((public.pegar_trava(current_setting('teste.f')::uuid) ->> 'ok')::boolean, true, 'a Ana pega a trava');
select pg_temp.entrar('00000000-0000-0000-0000-0000000000f2');
select is(public.pegar_trava(current_setting('teste.f')::uuid) ->> 'por', 'ana@exemplo.com', 'o Caio vê quem está editando');
select throws_ok($$ select public.salvar_fluxo(current_setting('teste.f')::uuid, 1, pg_temp.doc()) $$, 'P0001', null, 'e não salva por cima');
reset role;
update public.fluxos set trava_ate = now() - interval '1 minute';
set local role authenticated;
select pg_temp.entrar('00000000-0000-0000-0000-0000000000f2');
select is((public.pegar_trava(current_setting('teste.f')::uuid) ->> 'ok')::boolean, true, 'trava vencida passa pra quem pede');

-- Versões.
select is(public.marcar_versao(current_setting('teste.f')::uuid, 'antes do horário novo'), 1, 'marca a versão 1');
select is((select documento from public.fluxo_versoes), (select documento from public.fluxos), 'a versão guarda o documento de agora');

select * from finish();
rollback;
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npm run banco:testes`
Expected: FAIL em `fluxos.test.sql` (`relation "public.canais" does not exist`); `journey.test.sql` e `links.test.sql` passam.

- [ ] **Passo 3: a migração**

`supabase/migrations/20261114000000_journey_v2_fluxos.sql`:

```sql
-- Journey v2 (etapa A): canais, cadastros e fluxos do editor.
-- Só acrescenta: as tabelas da v1 (catálogo, jornadas, imports) continuam até a etapa B trocar a tela.
-- Como na v1: toda tabela tem empresa_id, RLS só pra membros, e filha liga o pai pela dupla (id, empresa_id).
-- O documento do fluxo só muda pela função salvar_fluxo (confere a revisão, a trava e os responsáveis).

-- Canais e tipos de cadastro: cada empresa tem os seus ------------------------

create table public.canais (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  nome text not null check (length(btrim(nome)) between 1 and 60),
  cor text not null check (cor ~ '^#[0-9a-fA-F]{6}$'),
  icone text,
  ordem int not null default 0,
  arquivado boolean not null default false,
  primary key (empresa_id, chave)
);

create table public.tipos_cadastro (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  nome text not null check (length(btrim(nome)) between 1 and 60),
  -- Campos próprios do tipo: [{ chave, nome, tipo: texto|numero|opcoes|pessoa, opcoes? }]. O app confere o conteúdo.
  campos jsonb not null default '[]' check (jsonb_typeof(campos) = 'array'),
  -- Os cinco que toda empresa recebe; não se apagam.
  padrao boolean not null default false,
  primary key (empresa_id, chave)
);

-- Os mesmos de CANAIS_PADRAO e TIPOS_CADASTRO_PADRAO (packages/fluxo/src/cadastros.ts).
create function public.semear_empresa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.canais (empresa_id, chave, nome, cor, ordem) values
    (new.id, 'telefonia', 'Telefonia', '#1e8bdc', 1),
    (new.id, 'whatsapp', 'WhatsApp', '#159e5a', 2),
    (new.id, 'email', 'E-mail', '#c98410', 3),
    (new.id, 'chat', 'Chat', '#7650d6', 4),
    (new.id, 'interno', 'Interno', '#3a6a88', 5);
  insert into public.tipos_cadastro (empresa_id, chave, nome, padrao) values
    (new.id, 'pessoa', 'Pessoa', true),
    (new.id, 'fila', 'Fila', true),
    (new.id, 'equipe', 'Equipe', true),
    (new.id, 'sistema', 'Sistema', true),
    (new.id, 'horario', 'Horário', true);
  return new;
end;
$$;
create trigger semear_empresa after insert on public.empresas for each row execute function public.semear_empresa();
revoke execute on function public.semear_empresa() from public, anon, authenticated;

-- As empresas que já existem também recebem os seus.
insert into public.canais (empresa_id, chave, nome, cor, ordem)
select e.id, c.chave, c.nome, c.cor, c.ordem
from public.empresas e
cross join (values ('telefonia', 'Telefonia', '#1e8bdc', 1), ('whatsapp', 'WhatsApp', '#159e5a', 2), ('email', 'E-mail', '#c98410', 3),
  ('chat', 'Chat', '#7650d6', 4), ('interno', 'Interno', '#3a6a88', 5)) c (chave, nome, cor, ordem);
insert into public.tipos_cadastro (empresa_id, chave, nome, padrao)
select e.id, t.chave, t.nome, true
from public.empresas e
cross join (values ('pessoa', 'Pessoa'), ('fila', 'Fila'), ('equipe', 'Equipe'), ('sistema', 'Sistema'), ('horario', 'Horário')) t (chave, nome);

-- Cadastros: as coisas reais que as peças usam ---------------------------------

create table public.cadastros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo text not null,
  nome text not null check (length(btrim(nome)) between 1 and 200),
  -- Horário: { janelas, feriados }; tipos personalizados: os campos do tipo. O app confere o conteúdo.
  campos jsonb not null default '{}' check (jsonb_typeof(campos) = 'object'),
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (id, empresa_id),
  foreign key (empresa_id, tipo) references public.tipos_cadastro (empresa_id, chave)
);
-- O mesmo nome não se repete no mesmo tipo (sem diferença de caixa nem espaços nas pontas).
create unique index cadastros_nome_unico on public.cadastros (empresa_id, tipo, lower(btrim(nome)));

-- Fluxos e versões --------------------------------------------------------------

create table public.fluxos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  descricao text not null default '',
  canal text,
  -- O documento journey/2 inteiro: peças, conexões, grupos e notas. A forma é conferida aqui; o conteúdo, pelo app.
  documento jsonb not null default '{"formato":"journey/2","pecas":[],"conexoes":[],"grupos":[],"notas":[]}',
  -- Estilo e animação do fluxo (o que muda em relação ao padrão).
  estilo jsonb not null default '{}' check (jsonb_typeof(estilo) = 'object'),
  -- Meta de tempo do fluxo, em segundos (o diagnóstico avisa quando o caminho mais longo passa dela).
  meta_s int check (meta_s > 0),
  -- Sobe a cada salvamento: quem salva manda a revisão que abriu; se mudou no meio, o banco recusa.
  revisao int not null default 0,
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  editado_por uuid references auth.users (id) on delete set null default auth.uid(),
  editado_em timestamptz not null default now(),
  -- Quem está editando e até quando (a trava vence sozinha depois de 10 minutos sem salvar).
  trava_por uuid references auth.users (id) on delete set null,
  trava_ate timestamptz,
  unique (id, empresa_id),
  foreign key (empresa_id, canal) references public.canais (empresa_id, chave),
  -- coalesce: chave faltando dá null, e null passaria no check.
  constraint fluxos_documento_forma check (coalesce(
    documento ->> 'formato' = 'journey/2'
    and jsonb_typeof(documento -> 'pecas') = 'array'
    and jsonb_typeof(documento -> 'conexoes') = 'array'
    and jsonb_typeof(documento -> 'grupos') = 'array'
    and jsonb_typeof(documento -> 'notas') = 'array', false))
);
create index fluxos_empresa on public.fluxos (empresa_id, editado_em desc);

create table public.fluxo_versoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  fluxo_id uuid not null,
  numero int not null check (numero > 0),
  nome text not null check (length(btrim(nome)) between 1 and 120),
  documento jsonb not null,
  estilo jsonb not null,
  autor uuid references auth.users (id) on delete set null default auth.uid(),
  criada_em timestamptz not null default now(),
  unique (fluxo_id, numero),
  unique (id, empresa_id),
  foreign key (fluxo_id, empresa_id) references public.fluxos (id, empresa_id) on delete cascade
);

-- "Onde é usado": os cadastros que cada fluxo usa, refeito a cada salvamento. Cadastro em uso não se apaga.
create table public.fluxo_cadastros (
  fluxo_id uuid not null,
  empresa_id uuid not null,
  cadastro_id uuid not null,
  primary key (fluxo_id, cadastro_id),
  foreign key (fluxo_id, empresa_id) references public.fluxos (id, empresa_id) on delete cascade,
  foreign key (cadastro_id, empresa_id) references public.cadastros (id, empresa_id) on delete restrict
);
create index fluxo_cadastros_cadastro on public.fluxo_cadastros (cadastro_id);

-- A lista de fluxos sem trazer os documentos: só o tamanho. security_invoker: valem as regras de quem pergunta.
create view public.fluxos_resumo with (security_invoker = true) as
  select f.id, f.empresa_id, f.nome, f.descricao, f.canal, f.editado_em, f.editado_por,
    jsonb_array_length(f.documento -> 'pecas') as pecas,
    case when f.trava_ate > now() then f.trava_por end as editando_por
  from public.fluxos f;

-- Regras de acesso ---------------------------------------------------------------

alter table public.canais enable row level security;
alter table public.tipos_cadastro enable row level security;
alter table public.cadastros enable row level security;
alter table public.fluxos enable row level security;
alter table public.fluxo_versoes enable row level security;
alter table public.fluxo_cadastros enable row level security;

create policy "membro vê os canais" on public.canais for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria canal" on public.canais for insert to authenticated with check (public.eh_membro(empresa_id));
create policy "membro muda canal" on public.canais for update to authenticated using (public.eh_membro(empresa_id)) with check (public.eh_membro(empresa_id));

create policy "membro vê os tipos" on public.tipos_cadastro for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria tipo" on public.tipos_cadastro for insert to authenticated with check (public.eh_membro(empresa_id) and not padrao);
create policy "membro muda tipo" on public.tipos_cadastro for update to authenticated using (public.eh_membro(empresa_id)) with check (public.eh_membro(empresa_id));
create policy "membro apaga tipo próprio" on public.tipos_cadastro for delete to authenticated using (public.eh_membro(empresa_id) and not padrao);

create policy "membro vê os cadastros" on public.cadastros for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria cadastro" on public.cadastros for insert to authenticated with check (public.eh_membro(empresa_id) and criado_por = auth.uid());
create policy "membro muda cadastro" on public.cadastros for update to authenticated using (public.eh_membro(empresa_id)) with check (public.eh_membro(empresa_id));
create policy "membro apaga cadastro" on public.cadastros for delete to authenticated using (public.eh_membro(empresa_id));

create policy "membro vê os fluxos" on public.fluxos for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro cria fluxo" on public.fluxos for insert to authenticated with check (public.eh_membro(empresa_id) and criado_por = auth.uid());
create policy "membro muda fluxo" on public.fluxos for update to authenticated using (public.eh_membro(empresa_id)) with check (public.eh_membro(empresa_id));
create policy "membro apaga fluxo" on public.fluxos for delete to authenticated using (public.eh_membro(empresa_id));

create policy "membro vê as versões" on public.fluxo_versoes for select to authenticated using (public.eh_membro(empresa_id));
create policy "membro vê onde é usado" on public.fluxo_cadastros for select to authenticated using (public.eh_membro(empresa_id));

-- Por coluna: o que a tela grava direto. Documento, revisão, trava e versões só pelas funções abaixo.
revoke all on public.canais, public.tipos_cadastro, public.cadastros, public.fluxos, public.fluxo_versoes, public.fluxo_cadastros, public.fluxos_resumo from anon;
revoke insert, update, delete, truncate, trigger, references on
  public.canais, public.tipos_cadastro, public.cadastros, public.fluxos, public.fluxo_versoes, public.fluxo_cadastros from authenticated;
grant insert (empresa_id, chave, nome, cor, icone, ordem) on public.canais to authenticated;
grant update (nome, cor, icone, ordem, arquivado) on public.canais to authenticated;
grant insert (empresa_id, chave, nome, campos) on public.tipos_cadastro to authenticated;
grant update (nome, campos) on public.tipos_cadastro to authenticated;
grant delete on public.tipos_cadastro to authenticated;
grant insert (empresa_id, tipo, nome, campos) on public.cadastros to authenticated;
grant update (nome, campos) on public.cadastros to authenticated;
grant delete on public.cadastros to authenticated;
grant insert (empresa_id, nome, descricao, canal, estilo, meta_s) on public.fluxos to authenticated;
grant update (nome, descricao, canal, meta_s) on public.fluxos to authenticated;
grant delete on public.fluxos to authenticated;

-- Funções ------------------------------------------------------------------------

-- Grava o documento e o estilo do fluxo. p_revisao é a revisão que o editor abriu: se outra pessoa salvou no meio,
-- recusa (40001) em vez de sobrescrever. Recusa também se a trava é de outra pessoa e não venceu, e se uma peça
-- aponta pra um responsável que não é cadastro desta empresa. Refaz o "onde é usado". Devolve a revisão nova.
create function public.salvar_fluxo(p_fluxo uuid, p_revisao int, p_documento jsonb, p_estilo jsonb default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v public.fluxos%rowtype;
  v_resp text[];
begin
  select * into v from public.fluxos where id = p_fluxo for update;
  if not found or not public.eh_membro(v.empresa_id) then
    raise exception 'fluxo não encontrado' using errcode = 'P0002';
  end if;
  if v.trava_por is not null and v.trava_por <> auth.uid() and v.trava_ate > now() then
    raise exception 'outra pessoa está editando este fluxo' using errcode = 'P0001';
  end if;
  if v.revisao <> p_revisao then
    raise exception 'o fluxo mudou desde que foi aberto: recarregue' using errcode = '40001';
  end if;
  if jsonb_typeof(p_documento -> 'pecas') = 'array' then
    select array_agg(distinct p ->> 'responsavel') into v_resp
    from jsonb_array_elements(p_documento -> 'pecas') p
    where coalesce(p ->> 'responsavel', '') <> '';
  end if;
  if exists (
    select 1 from unnest(coalesce(v_resp, '{}')) r
    where case when r ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then not exists (select 1 from public.cadastros c where c.id = r::uuid and c.empresa_id = v.empresa_id)
      else true end
  ) then
    raise exception 'uma peça aponta pra um responsável que não é cadastro desta empresa' using errcode = '22023';
  end if;
  update public.fluxos set
    documento = p_documento,
    estilo = coalesce(p_estilo, estilo),
    revisao = revisao + 1,
    editado_por = auth.uid(),
    editado_em = now(),
    trava_ate = case when trava_por = auth.uid() then now() + interval '10 minutes' else trava_ate end
  where id = p_fluxo;
  delete from public.fluxo_cadastros where fluxo_id = p_fluxo;
  insert into public.fluxo_cadastros (fluxo_id, empresa_id, cadastro_id)
  select p_fluxo, v.empresa_id, r::uuid from unnest(coalesce(v_resp, '{}')) r;
  return v.revisao + 1;
end;
$$;

-- Pega a trava de edição (ou renova, se já é de quem pede). Se outra pessoa tem a trava e ela não venceu,
-- devolve quem e até quando. { ok, ate } ou { ok: false, por: e-mail, ate }.
create function public.pegar_trava(p_fluxo uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.fluxos%rowtype;
  v_ate timestamptz := now() + interval '10 minutes';
begin
  select * into v from public.fluxos where id = p_fluxo for update;
  if not found or not public.eh_membro(v.empresa_id) then
    raise exception 'fluxo não encontrado' using errcode = 'P0002';
  end if;
  if v.trava_por is null or v.trava_por = auth.uid() or v.trava_ate <= now() then
    update public.fluxos set trava_por = auth.uid(), trava_ate = v_ate where id = p_fluxo;
    return jsonb_build_object('ok', true, 'ate', v_ate);
  end if;
  return jsonb_build_object('ok', false, 'ate', v.trava_ate,
    'por', (select m.email from public.membros m where m.empresa_id = v.empresa_id and m.usuario_id = v.trava_por));
end;
$$;

-- Solta a trava, se é de quem pede.
create function public.soltar_trava(p_fluxo uuid) returns void
language sql security definer set search_path = '' as $$
  update public.fluxos set trava_por = null, trava_ate = null
  where id = p_fluxo and trava_por = auth.uid() and public.eh_membro(empresa_id);
$$;

-- Marca uma versão com nome: foto do documento e do estilo de agora. Devolve o número.
create function public.marcar_versao(p_fluxo uuid, p_nome text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v public.fluxos%rowtype;
  v_numero int;
begin
  select * into v from public.fluxos where id = p_fluxo for update;
  if not found or not public.eh_membro(v.empresa_id) then
    raise exception 'fluxo não encontrado' using errcode = 'P0002';
  end if;
  select coalesce(max(numero), 0) + 1 into v_numero from public.fluxo_versoes where fluxo_id = p_fluxo;
  insert into public.fluxo_versoes (empresa_id, fluxo_id, numero, nome, documento, estilo)
  values (v.empresa_id, p_fluxo, v_numero, btrim(p_nome), v.documento, v.estilo);
  return v_numero;
end;
$$;

revoke execute on function public.salvar_fluxo(uuid, int, jsonb, jsonb), public.pegar_trava(uuid), public.soltar_trava(uuid), public.marcar_versao(uuid, text) from public, anon;
grant execute on function public.salvar_fluxo(uuid, int, jsonb, jsonb), public.pegar_trava(uuid), public.soltar_trava(uuid), public.marcar_versao(uuid, text) to authenticated;
```

- [ ] **Passo 4: aplicar e rodar**

Run: `npx supabase db reset && npm run banco:testes`
Expected: `Files=3, Tests=126` e `Result: PASS`.

- [ ] **Passo 5: a v1 continua de pé**

Run: `npm test && npm run typecheck`
Expected: `@journey/fluxo` 55, `@journey/nucleo` 253 e o app 184 passando (os de banco do app rodam contra a migração nova, que só acrescenta); `tsc` sem saída em todos.

- [ ] **Passo 6: commit**

```bash
git add supabase
git commit -m "banco: canais, cadastros, fluxos, versões e salvar por revisão" -m "$(cat .git/atribuicao.txt)"
```

---

### Tarefa 7: documentação e fechamento

**Arquivos:**
- Criar: `packages/fluxo/README.md`
- Modificar: `README.md`

- [ ] **Passo 1: o README do pacote**

`packages/fluxo/README.md`:

````markdown
# @journey/fluxo

O modelo genérico do Journey v2, sem tela: o documento de um fluxo (formato `journey/2`), a validação, o relógio dos horários, o motor de simulação, o diagnóstico e os modelos prontos.
Vale pra qualquer canal ou esteira: nada aqui é de telefonia. Não conhece React, Next.js nem Supabase.

Spec: [docs/superpowers/specs/2026-11-13-journey-v2-editor.md](../../docs/superpowers/specs/2026-11-13-journey-v2-editor.md).

## Partes

| Arquivo | O que faz |
|---|---|
| `src/documento.ts` | O documento: peças (8 tipos), conexões (6 regras), grupos e notas |
| `src/cadastros.ts` | Cadastros e canais da empresa, os padrão, e os campos do cadastro Horário |
| `src/validar.ts` | `lerDocumento`: confere um documento vindo de fora e devolve uma cópia só com os campos conhecidos |
| `src/indice.ts` | Saídas e entradas de cada peça; o texto de cada regra |
| `src/relogio.ts` | Hora de parede, dentro ou fora de um Horário (com feriados), tempo legível |
| `src/motor.ts` | A simulação: `executar`, `simular` (refaz as escolhas), eventos |
| `src/diagnostico.ts` | Os achados: beco, ninguém chega, não termina, ciclo sem saída, opções repetidas e o resto |
| `src/modelos.ts` | Suporte no WhatsApp, Esteira de crédito, SAC por e-mail e URA telefônica |

## Uso

```ts
import { MODELOS, lerDocumento, simular, diagnosticar } from '@journey/fluxo';

const m = MODELOS[0]!;
const { documento, problemas } = lerDocumento(m.documento, { cadastros: m.cadastros.map((k) => k.id) });

const x = simular(m.documento, { cadastros: m.cadastros }, { inicio: 'inicio', quando: '2026-11-23T10:00' });
x.pendente;          // a pergunta da vez: { peca, opcoes }
x.avancar('c5');     // escolhe pela conexão
x.eventos;           // chegou, pede_escolha, escolheu, correu, escolha_ignorada, terminou

const achados = diagnosticar(m.documento, { cadastros: m.cadastros, meta_s: 4 * 3600 });
```

## Decisões

- **O documento é um JSON só** (`journey/2`), que o editor carrega e salva inteiro. Cadastros e canais não ficam nele: são da empresa, e a peça aponta pro cadastro pelo id.
- **O relógio decide só o que é de horário:** uma peça com saídas de regra `horario` e um responsável do tipo Horário segue sozinha pela hora simulada (modo `relogio`). No modo `livre` pergunta, com a escolha do relógio marcada como sugerida. O resto sempre pergunta.
- **Ciclo** é chegar pela terceira vez na mesma peça sem ninguém escolher no meio; depois de uma escolha, a contagem recomeça.
- **Tempo do cliente:** soma o tempo de cada peça ao chegar e o das conexões "depois de um tempo" ao passar.
- **Chave de achado** é tipo mais ids: não muda quando se renomeia uma peça, e "marcar como intencional" sobrevive.
````

- [ ] **Passo 2: o README da raiz**

```diff
diff --git a/README.md b/README.md
index 1c004da..3a20e21 100644
--- a/README.md
+++ b/README.md
@@ -2,8 +2,9 @@
 
 O fluxo de atendimento como um encanamento: dá play numa entrada e a água anda pelos canos. Serve pra entender e explicar um fluxo, testar cenários ("e se…") sem ligar pra central e encontrar problemas sozinho.
 
-- Spec: [docs/superpowers/specs/2026-11-12-journey-design.md](docs/superpowers/specs/2026-11-12-journey-design.md)
-- `packages/nucleo`: formato, importação, modelos, motor e diagnóstico, sem tela ([README](packages/nucleo/README.md))
+- Spec: [v2, o editor no centro](docs/superpowers/specs/2026-11-13-journey-v2-editor.md) (substitui a [v1](docs/superpowers/specs/2026-11-12-journey-design.md))
+- `packages/fluxo`: o modelo genérico da v2 (documento, motor, diagnóstico e modelos), sem tela ([README](packages/fluxo/README.md))
+- `packages/nucleo`: formato, importação, modelos, motor e diagnóstico, de telefonia, sem tela; na v2 vira o importador de central ([README](packages/nucleo/README.md))
 - `apps/web`: o app (Next.js + Supabase) ([README](apps/web/README.md))
 - `supabase/`: migração, regras de acesso e testes do banco
 
```

- [ ] **Passo 3: conferência final**

Run: `npm test && npm run typecheck && npm run banco:testes`
Expected: fluxo 55, núcleo 253, app 184; `tsc` limpo; pgTAP `Tests=126`, `Result: PASS`.

- [ ] **Passo 4: commit e push**

```bash
git add README.md packages/fluxo/README.md
git commit -m "docs: README do @journey/fluxo" -m "$(cat .git/atribuicao.txt)"
git push -u origin claude/journey-etapa-3-public-links-5wx03t
```

---

## Cobertura do spec

| Spec v2 | Onde |
|---|---|
| 5 Conceitos: peça, conexão, regra, grupo, nota, cadastro, canal | Tarefa 1 (`documento.ts`, `cadastros.ts`) |
| 7 Editor: os 8 tipos de peça e as 6 regras de conexão | Tarefa 1 (`TIPOS_PECA`, `REGRAS`), Tarefa 2 (validação de cada um) |
| 8 Simulação: escolhas, relógio de Horário, tempo do cliente, canal que muda, ciclo, voltar refazendo | Tarefa 3 |
| 9 Diagnóstico: os achados e a chave estável | Tarefa 4 |
| 11 Dados: canais, tipos de cadastro, cadastros, fluxos, versões, "onde é usado", trava, revisão | Tarefa 6 |
| 12 Modelos: em branco e os modelos prontos | Tarefa 1 (`documentoVazio`), Tarefa 5 |
| 15 etapa A: "os exemplos do protótipo simulam e diagnosticam em testes" | Tarefa 5 (`modelos.test.ts`) |
| 16 Riscos: edição simultânea (trava e revisão), arquivo grande (500 peças), feriados no Horário | Tarefas 1, 4 e 6 |

Fica pra etapa B: a tela, o salvamento com espera curta, os cadastros que nascem do uso. Fica pra C: links e cenários sobre o fluxo genérico. A migração não apaga nada da v1; as tabelas antigas saem quando a etapa E trouxer o importador.

**Produção:** a migração é só de acréscimo. Depois do merge, aplica-se no Supabase de produção pelo MCP (`apply_migration`, nome `journey_v2_fluxos`), como as etapas 2 e 3. O app publicado não muda nesta etapa.
