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

Funcionam da raiz do repositório e de dentro de `packages/nucleo` (na raiz, os caminhos do `fixture` valem a partir de `packages/nucleo`).

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

### Motor

- Cada opção pendente e cada evento `correu` trazem o id da saída (`saida`). `avancar(resposta)` aceita a opção (`'1'`) ou o id da saída; se a opção vale pra mais de uma saída (mesma opção, `quando` diferente), só o id desempata.
- Resposta que não serve (não existe, não vale ou é ambígua) não derruba a execução: vira o evento `resposta_ignorada` e a opção continua pendente.
- Peça com dado faltando termina com o motivo `incompleta`, dizendo o que falta, em vez de seguir por um caminho que não existe.

### Importação

- Cabeçalhos de coluna (e chaves do JSON) ignoram acento, caixa e espaços nas pontas, como já era com os nomes de abas e de `.csv`: `Observação` vale `observacao`.
- `parcial: true` mexe só no que veio, por coluna. Numa linha que já existia, as colunas presentes substituem o valor (célula vazia limpa) e as ausentes ficam como estavam. Linha nova precisa das colunas obrigatórias.
- No `.json`, a presença é por item: chave ausente num item é "não informado" e mantém o valor anterior daquele item (`null` limpa). No `.xlsx` e no `.csv`, as colunas valem pra aba toda. No import completo nada disso muda: o arquivo substitui tudo.
- Os ajustes manuais são checados contra as colunas da aba, pela mesma regra do import. Ajuste que não bate vai pra `invalidos` (e vira aviso em `problemas`) e não é aplicado. O `id` do alvo pode chegar como número (JSON de banco). O documento `efetivo` (base mais ajustes) também é validado, e os problemas que só existem por causa dos ajustes voltam com `origem: 'ajuste'`.

### Diagnóstico

Além dos becos, ciclos e buracos de horário, aponta `membro_inexistente` (alguém listado como membro que não existe no catálogo: não toca, e os outros seguem) e `sem_transbordo` (a central desliga se ninguém atende, porque não há destino de transbordo).

## Subpacotes

`@journey/nucleo` exporta tudo, mas quem só precisa de uma parte importa pelo subcaminho:

```ts
import { executar } from '@journey/nucleo/motor';
import { diagnosticar } from '@journey/nucleo/diagnostico';
import { lerRef } from '@journey/nucleo/formato';
import { importar } from '@journey/nucleo/importacao';   // puxa exceljs
import { gerarModeloXlsx } from '@journey/nucleo/modelos'; // puxa exceljs
```

`formato`, `motor` e `diagnostico` não importam `exceljs`, nem direta nem indiretamente (um teste confere). Assim um componente de tela que só simula ou diagnostica não leva a biblioteca de planilhas no bundle.

## Fixture da central

`test/fixtures/central` é a central exportada em 11/11/2026, sem nomes de pessoas e sem números de celular.

- `pecas.csv`, `saidas.csv`, `horarios.csv` e `feriados.csv` foram escritos à mão a partir do `fluxo.json` do export.
- `entradas.csv`, `ramais.csv`, `filas.csv` e `grupos.csv` são gerados por `scripts/gerar-fixture.ts`.

O export só traz os ramais que têm transbordo configurado. Por isso parte das entradas e dos membros de fila aponta pra ramais "fora da lista".
