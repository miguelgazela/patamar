import "server-only";
import { papelDoUtilizador } from "@/lib/dados";
import { hojeEmLisboa } from "@/lib/datas";

/** Garante que quem chama é o administrador atual; lança erro caso contrário. */
export async function exigirAdmin() {
  const papel = await papelDoUtilizador(hojeEmLisboa());
  if (papel.tipo !== "administrador") throw new Error("Sem permissão.");
  return papel;
}
