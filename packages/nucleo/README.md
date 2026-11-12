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
