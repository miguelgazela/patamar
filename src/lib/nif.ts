/** Valida um NIF português (9 dígitos, dígito de controlo módulo 11). */
export function nifValido(nif: string | null | undefined): boolean {
  if (!nif || !/^\d{9}$/.test(nif)) return false;
  if (!"1235689".includes(nif[0]) && !["45", "70", "71", "72", "74", "75", "77", "79", "90", "91", "98", "99"].includes(nif.slice(0, 2))) {
    return false;
  }
  const soma = [...nif.slice(0, 8)].reduce((a, d, i) => a + Number(d) * (9 - i), 0);
  const resto = soma % 11;
  const controlo = resto < 2 ? 0 : 11 - resto;
  return controlo === Number(nif[8]);
}

/** Remove espaços, pontos e o prefixo "PT". */
export function normalizarNif(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const t = texto.toUpperCase().replace(/^PT/, "").replace(/\D/g, "");
  return t.length > 0 ? t : null;
}
