/** Remove espaços e passa a maiúsculas. */
export function normalizarIban(iban: string): string {
  return iban.replace(/\s/g, "").toUpperCase();
}

/** IBAN português: PT + 23 dígitos, com dígitos de controlo válidos (módulo 97). */
export function ibanValido(iban: string): boolean {
  const i = normalizarIban(iban);
  if (!/^PT\d{23}$/.test(i)) return false;
  const rodado = i.slice(4) + i.slice(0, 4);
  const numerico = [...rodado].map((c) => (c >= "A" ? String(c.charCodeAt(0) - 55) : c)).join("");
  let resto = 0;
  for (const d of numerico) resto = (resto * 10 + Number(d)) % 97; // evita BigInt
  return resto === 1;
}

/** "PT50000201231234567890154" -> "PT50 0002 0123 1234 5678 9015 4". */
export function formatarIban(iban: string): string {
  return normalizarIban(iban).replace(/(.{4})/g, "$1 ").trim();
}
