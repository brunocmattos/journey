import { completude } from '../formato/completude';
import type { NomeAba } from '../formato/documento';
import { existe, type Indice } from '../formato/indice';
import type { Problema } from './problemas';

/**
 * Regras que olham o documento inteiro. Cada problema leva o código da regra (`regra`), estável entre imports.
 * Referência que não existe é aviso: o import continua e o diagnóstico marca o problema.
 */
export function validar(idx: Indice, linhas: Map<string, number> = new Map()): Problema[] {
  const out: Problema[] = [];
  const doc = idx.doc;
  const onde = (aba: NomeAba, id: string, coluna?: string) => ({ aba, linha: linhas.get(`${aba}/${id}`), id, coluna });
  const checar = (aba: NomeAba, id: string, coluna: string, ref: string | undefined) => {
    if (ref !== undefined && !existe(idx, ref)) {
      out.push({ gravidade: 'aviso', ...onde(aba, id, coluna), mensagem: `aponta pra ${ref}, que não existe. O import continua e o diagnóstico vai marcar isso`, regra: 'ref_inexistente' });
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
    if (p.tipo === 'regra_horario' && !p.horario) out.push({ gravidade: 'erro', ...onde('pecas', p.id, 'horario'), mensagem: 'regra de horário sem a coluna horario', regra: 'regra_sem_horario' });
    if (p.tipo === 'regra_feriado' && !p.calendario) out.push({ gravidade: 'erro', ...onde('pecas', p.id, 'calendario'), mensagem: 'regra de feriado sem a coluna calendario', regra: 'regra_sem_calendario' });
    checar('pecas', p.id, 'horario', p.horario);
    if (p.calendario && !idx.feriados.has(p.calendario)) {
      out.push({ gravidade: 'aviso', ...onde('pecas', p.id, 'calendario'), mensagem: `o calendário "${p.calendario}" não tem nenhum feriado na aba feriados`, regra: 'calendario_sem_feriado' });
    }
    if (p.tipo !== 'fim' && !(idx.saidasDe.get(p.id)?.length)) {
      out.push({ gravidade: 'aviso', ...onde('pecas', p.id), mensagem: `a peça "${p.nome ?? p.id}" não tem nenhuma saída`, regra: 'peca_sem_saida' });
    }
  }
  const combinacoes = new Map<string, string>();
  for (const s of doc.saidas) {
    checar('saidas', s.id, 'de', s.de);
    checar('saidas', s.id, 'para', s.para);
    const chave = `${s.de}|${s.opcao}|${s.quando ? `${s.quando.chave}=${s.quando.valor}` : ''}`;
    const outra = combinacoes.get(chave);
    if (outra) out.push({ gravidade: 'erro', ...onde('saidas', s.id, 'opcao'), mensagem: `a opção "${s.opcao}" de ${s.de} já existe na saída ${outra}`, regra: 'saida_repetida' });
    else combinacoes.set(chave, s.id);
  }
  for (const h of doc.horarios) {
    if (h.fim <= h.inicio) out.push({ gravidade: 'erro', ...onde('horarios', h.id, 'fim'), mensagem: `a janela termina (${h.fim}) antes de começar (${h.inicio})`, regra: 'janela_invertida' });
  }
  for (const p of completude(idx)) out.push({ gravidade: 'aviso', ...onde(p.aba, p.id), mensagem: p.mensagem, regra: p.regra });
  return out;
}
