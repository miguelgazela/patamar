/** Compara o texto escrito pelo utilizador com o nome a confirmar (sem diferenciar maiúsculas nem espaços nas pontas). */
export function confirmaNome(escrito: string, esperado: string): boolean {
  const norm = (t: string) => t.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-PT");
  return norm(esperado).length > 0 && norm(escrito) === norm(esperado);
}
