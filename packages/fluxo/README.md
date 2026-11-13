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
- **Modelos são congelados.** Um fluxo novo começa de `instanciarModelo(modelo, ids)`, que copia o documento e troca cada responsável pelo cadastro da empresa (achado ou criado pelo mesmo nome e tipo).
