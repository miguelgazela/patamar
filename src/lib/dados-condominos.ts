import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Data } from "@/lib/datas";

export interface PessoaLista {
  id: string;
  nome: string;
  email: string | null;
  telemovel: string | null;
  nif: string | null;
  fracoes: string[];
  fracaoIds: string[];
  administrador: boolean;
  /** sem_acesso: sem conta; convidado: conta criada, nunca entrou; ativo: já entrou. */
  acesso: "sem_acesso" | "convidado" | "ativo";
}

export async function listarPessoas(condominioId: string, hoje: Data): Promise<PessoaLista[]> {
  const supabase = await criarClienteServidor();
  const [pessoas, props, adm] = await Promise.all([
    supabase.from("pessoas").select("id, nome, email, telemovel, nif, auth_user_id").eq("condominio_id", condominioId).order("nome"),
    supabase.from("propriedades").select("pessoa_id, fracao_id, fracoes(identificacao)").eq("condominio_id", condominioId),
    supabase.from("administracoes").select("pessoa_id").eq("condominio_id", condominioId).lte("inicio", hoje).or(`fim.is.null,fim.gte.${hoje}`),
  ]);
  for (const r of [pessoas, props, adm]) if (r.error) throw r.error;

  const servico = criarClienteAdmin();
  return Promise.all(
    pessoas.data!.map(async (p) => {
      let acesso: PessoaLista["acesso"] = "sem_acesso";
      if (p.auth_user_id) {
        const { data } = await servico.auth.admin.getUserById(p.auth_user_id);
        acesso = data.user?.last_sign_in_at ? "ativo" : "convidado";
      }
      return {
        id: p.id,
        nome: p.nome,
        email: p.email,
        telemovel: p.telemovel,
        nif: p.nif,
        fracaoIds: props.data!.filter((x) => x.pessoa_id === p.id).map((x) => x.fracao_id as string),
        fracoes: props.data!
          .filter((x) => x.pessoa_id === p.id)
          .map((x) => (x.fracoes as unknown as { identificacao: string } | null)?.identificacao)
          .filter((f): f is string => !!f),
        administrador: adm.data!.some((a) => a.pessoa_id === p.id),
        acesso,
      };
    }),
  );
}
