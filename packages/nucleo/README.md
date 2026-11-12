# @journey/nucleo

O núcleo do Journey, sem tela: o formato dos dados, a importação, os modelos pra baixar, o motor de simulação e o diagnóstico.
Nada aqui conhece React, Next.js ou Supabase. Tudo recebe dados e devolve dados.

## Partes

| Pasta | O que faz |
|---|---|
| `src/formato` | O formato `journey/1`: abas, colunas, referências (`fila:90011`), leitura de células e índice |
| `src/importacao` | Lê `.xlsx`, `.csv` e `.json`; valida; junta com a base anterior; aplica ajustes manuais |
| `src/modelos` | Gera a planilha modelo `.xlsx`, o exemplo `.json` e o esquema JSON |
| `src/motor` | Simula uma ligação: relógio, decisões, variáveis, ciclos, quanto cada ramal e grupo toca |
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
if (!r.ok || !r.okEfetivo) console.log(r.problemas);

const achados = diagnosticar(r.efetivo);

const e = executar(r.efetivo, { entrada: 'entrada:did-5133279001', inicio: '2026-11-24T16:57' });
console.log(e.eventos, e.pendente);
e.avancar('1');              // pela opção
e.avancar('saida:fase-30-1'); // ou pela saída
```

### Motor

- Resposta (em `avancar` ou nas `respostas` do cenário) é a opção (`'1'`, `'esgotou'`, `'atende'`) ou `saida:<id>`. Texto sem prefixo é sempre a opção, nunca o id da saída. Se a opção vale pra mais de uma saída (mesma opção, `quando` diferente), só `saida:<id>` desempata.
- Cada opção pendente e cada evento `correu` e `escolheu` trazem o id da saída (`saida`), quando a opção vem de uma peça. Gravando `saida:<id>` (ou a opção, sem `saida`) de cada `escolheu`, a execução se repete igual.
- Resposta que não serve (não existe, não vale ou é ambígua) não lança erro, nem no cenário nem em `avancar`: vira o evento `resposta_ignorada` e a decisão continua pendente. Depois do fim, `avancar` devolve `[]`.
- `pendente` é uma cópia estável: duas leituras devolvem o mesmo objeto, que só muda quando a decisão muda.
- Peça com dado faltando termina com o motivo `incompleta`, dizendo o que falta, em vez de seguir por um caminho que não existe.

### Importação

- Cabeçalhos de coluna (e chaves do JSON) ignoram acento, caixa e espaços nas pontas, como já era com os nomes de abas e de `.csv`: `Observação` vale `observacao`.
- `parcial: true` mexe só no que veio, por coluna. Numa linha que já existia, as colunas presentes substituem o valor (célula vazia limpa) e as ausentes ficam como estavam. Linha nova precisa das colunas obrigatórias.
- No `.json`, a presença é por item: chave ausente num item é "não informado" e mantém o valor anterior daquele item (`null` limpa). No `.xlsx` e no `.csv`, as colunas valem pra aba toda. No import completo nada disso muda: o arquivo substitui tudo.
- Dois cabeçalhos que viram a mesma coluna (`Observação` e `observacao`) geram um aviso; vale o último.
- Os ajustes manuais são checados contra as colunas da aba, pela mesma regra do import. Ajuste que não bate vai pra `invalidos` (e vira aviso em `problemas`) e não é aplicado. O `id` do alvo pode chegar como número (JSON de banco). O documento `efetivo` (base mais ajustes) também é validado, e os problemas que só existem por causa dos ajustes voltam com `origem: 'ajuste'` (comparados pelo código `regra`, não pelo texto: renomear um item não repete o aviso).
- `ok` diz respeito só ao arquivo da central; `okEfetivo` é `false` quando o documento efetivo tem erro, inclusive de origem `'ajuste'`.

### Diagnóstico

Além dos becos, ciclos e buracos de horário, aponta `membro_inexistente` (alguém listado como membro que não existe no catálogo: não toca, e os outros seguem) e quem desliga quando ninguém atende:

- grupo com `ao_esgotar = fim:desliga` ou sem `ao_esgotar`: `grupo_desliga` (alerta), um por grupo;
- fila alcançável com `espera_maxima_s` e sem `ao_esgotar`: `sem_transbordo` (observação), um por fila;
- ramais alcançáveis sem `ao_nao_atender`: um `sem_transbordo` só (chave `sem_transbordo:ramais`), com todos em `refs`.

Regra de horário que aponta pra um horário que não existe é `destino_inexistente` (grave), como qualquer referência quebrada.

## Subpacotes

`@journey/nucleo` exporta toda a API pública (cada pasta lista o que exporta; o que é de uso interno fica de fora), mas quem só precisa de uma parte importa pelo subcaminho:

```ts
import { executar } from '@journey/nucleo/motor';
import { diagnosticar } from '@journey/nucleo/diagnostico';
import { lerRef } from '@journey/nucleo/formato';
import { importar } from '@journey/nucleo/importacao';   // puxa exceljs
import { gerarModeloXlsx } from '@journey/nucleo/modelos'; // puxa exceljs
```

`@journey/nucleo/teste` exporta os construtores de documento dos testes (`doc`, `entrada`, `peca`, `saida`, `ramal`, `fila`, `grupo`, `janela`), pra outros pacotes testarem com documentos pequenos.

`formato`, `motor` e `diagnostico` não importam `exceljs`, nem direta nem indiretamente (um teste confere). Assim um componente de tela que só simula ou diagnostica não leva a biblioteca de planilhas no bundle.

## Fixture da central

`test/fixtures/central` é a central exportada em 11/11/2026, sem nomes de pessoas e sem números de celular.

- `pecas.csv`, `saidas.csv`, `horarios.csv` e `feriados.csv` foram escritos à mão a partir do `fluxo.json` do export.
- `entradas.csv`, `ramais.csv`, `filas.csv` e `grupos.csv` são gerados por `scripts/gerar-fixture.ts`.

O export só traz os ramais que têm transbordo configurado. Por isso parte das entradas e dos membros de fila aponta pra ramais "fora da lista".
