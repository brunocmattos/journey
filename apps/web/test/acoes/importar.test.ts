import { beforeEach, describe, expect, it, vi } from 'vitest';
import { documentoVazio } from '@journey/nucleo';

type Resposta = { data?: unknown; error: { code?: string; message: string } | null };
let respostas: Record<string, Resposta> = {};
const upload = vi.fn(async (_caminho: string, _conteudo: unknown, _op: unknown): Promise<Resposta> => ({ data: {}, error: null }));

/** Cliente falso: a resposta vem por "tabela.operação" (select, insert, update, delete) ou pelo nome da função. */
function consulta(tabela: string) {
  let op = 'select';
  const r = () => respostas[`${tabela}.${op}`] ?? { data: null, error: null };
  const q: Record<string, unknown> = {
    then: (ok: (v: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(r()).then(ok, falha),
    maybeSingle: async () => r(),
    single: async () => r(),
  };
  for (const m of ['eq', 'order', 'limit']) q[m] = () => q;
  q.select = () => q;
  for (const m of ['insert', 'update', 'delete'])
    q[m] = () => {
      op = m;
      return q;
    };
  return q;
}
const supabase = {
  from: consulta,
  rpc: async (nome: string) => respostas[nome] ?? { data: null, error: null },
  storage: { from: () => ({ upload }) },
};

vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase }) }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock('@/importacao/analisar', () => ({
  analisarArquivos: async () => ({ revisao: { ok: true }, base: documentoVazio(), efetivo: documentoVazio() }),
}));
const { analisarImport, confirmarImport, descartarImport } = await import('@/acoes/importar');

const log = vi.spyOn(console, 'error').mockImplementation(() => {});
const formulario = () => {
  const f = new FormData();
  f.append('arquivos', new File(['id;nome'], 'ramais.html', { type: 'text/html' }));
  return f;
};

describe('acoes/importar', () => {
  beforeEach(() => {
    respostas = {};
    upload.mockClear();
    log.mockClear();
  });

  it('outro rascunho gravado ao mesmo tempo vira mensagem, não o erro do banco', async () => {
    respostas['imports.insert'] = { error: { code: '23505', message: 'duplicate key value violates unique constraint "imports_um_rascunho_por_vez"' } };
    expect(await analisarImport('e1', null, formulario())).toEqual({ erro: 'Outro import está em revisão nesta empresa; abre ele ou descarta antes.' });
  });

  it('guarda o arquivo sempre como octet-stream e registra quando o Storage falha', async () => {
    respostas['imports.insert'] = { data: { id: 'i1' }, error: null };
    upload.mockResolvedValueOnce({ error: { message: 'mime type text/html is not supported' } });
    respostas['imports.update'] = { error: { code: '42501', message: 'permission denied' } };
    await expect(analisarImport('e1', null, formulario())).rejects.toThrow('REDIRECT /e/e1/importar/i1');
    expect(upload.mock.calls[0]![2]).toEqual({ contentType: 'application/octet-stream' });
    expect(log).toHaveBeenCalledWith('[analisarImport: guardar arquivo]', 'e1/i1/01-ramais.html', 'mime type text/html is not supported');
    expect(log).toHaveBeenCalledWith('[analisarImport: anotar arquivos]', '42501', 'permission denied');
  });

  it('confirmar um import que sumiu diz que ele saiu de revisão', async () => {
    respostas['imports.select'] = { data: null, error: null };
    expect(await confirmarImport('e1', 'i1')).toEqual({ erro: 'Este import não está mais em revisão (outro import o substituiu).' });
  });

  it('o erro da confirmação vira texto pra pessoa', async () => {
    respostas['imports.select'] = { data: { efetivo: documentoVazio(), relatorio: { ok: true } }, error: null };
    respostas.confirmar_import = { error: { code: 'P0001', message: 'outro import foi confirmado depois desta análise: analise de novo' } };
    expect(await confirmarImport('e1', 'i1')).toEqual({ erro: 'Outro import foi confirmado depois desta análise: importa de novo.' });
    respostas.confirmar_import = { error: { code: '22023', message: 'p_jornadas tem documento que não é journey/1' } };
    expect(await confirmarImport('e1', 'i1')).toEqual({ erro: 'Não deu certo agora. Tenta de novo em instantes.' });
  });

  it('descartar que falha não volta pra lista calado', async () => {
    respostas['imports.update'] = { error: { code: '42501', message: 'permission denied' } };
    expect(await descartarImport('e1', 'i1')).toEqual({ erro: 'Sem acesso a esta empresa.' });
    respostas['imports.update'] = { error: null };
    await expect(descartarImport('e1', 'i1')).rejects.toThrow('REDIRECT /e/e1/importar');
  });
});
