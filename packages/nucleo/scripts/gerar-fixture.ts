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
