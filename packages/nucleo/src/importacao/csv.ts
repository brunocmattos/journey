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
