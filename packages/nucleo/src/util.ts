/** Igualdade de valores de célula: primitivos, listas e expressões. */
export function igual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
