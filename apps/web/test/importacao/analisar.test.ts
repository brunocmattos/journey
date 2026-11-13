import { describe, expect, it, vi } from 'vitest';

// analisar.ts só roda no servidor; no Vitest o guarda do Next não existe.
vi.mock('server-only', () => ({}));

const { analisarArquivos } = await import('@/importacao/analisar');

const csv = (nome: string, linhas: string[]) => ({ nome, conteudo: new TextEncoder().encode(linhas.join('\n')) });

describe('analisarArquivos', () => {
  it('import com referência inválida não quebra: a revisão lista o erro e não calcula jornadas', async () => {
    const a = await analisarArquivos(
      [
        csv('entradas.csv', ['id;numero;destino', 'e;5133;peca:m']),
        csv('pecas.csv', ['id;tipo', 'm;audio']),
        csv('saidas.csv', ['id;de;opcao;para', 'm-1;peca:m;sempre;não é ref']),
      ],
      null,
      false,
    );
    expect(a.revisao.ok).toBe(false);
    expect(a.revisao.erros.map((p) => [p.aba, p.coluna])).toContainEqual(['saidas', 'para']);
    expect(a.revisao.jornadas).toEqual([]);
  });

  it('import sem erro calcula as jornadas', async () => {
    const a = await analisarArquivos([csv('entradas.csv', ['id;numero;destino', 'e;5133;fim:desliga'])], null, false);
    expect(a.revisao.ok).toBe(true);
    expect(a.revisao.jornadas.map((j) => j.nome)).toEqual(['Telefonia']);
  });
});
