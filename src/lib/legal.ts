/** Versão dos textos legais aceites no registo. Subir quando os textos mudarem materialmente. */
export const VERSAO_TEXTOS_LEGAIS = "2026-11";

/**
 * Identificação da entidade que presta o serviço. PREENCHER antes do lançamento
 * (e rever os textos de /privacidade e /termos com um jurista).
 */
export const ENTIDADE = {
  nome: "[Nome da entidade que presta o Patamar]",
  nif: "[NIF]",
  morada: "[Morada]",
  email: "[email de contacto para privacidade]",
};

export interface Subcontratante {
  nome: string;
  finalidade: string;
  dados: string;
  localizacao: string;
}

/** Subcontratantes que tratam dados pessoais. Manter em sintonia com a infraestrutura real. */
export const SUBCONTRATANTES: Subcontratante[] = [
  { nome: "Supabase", finalidade: "Base de dados, autenticação e armazenamento de ficheiros", dados: "Todos os dados da aplicação", localizacao: "União Europeia [confirmar a região do projeto]" },
  { nome: "Resend", finalidade: "Envio de emails (códigos de acesso, convites e lembretes)", dados: "Nome, email e o conteúdo dos emails", localizacao: "[confirmar a região; preferir União Europeia]" },
  { nome: "Anthropic (Claude API)", finalidade: "Leitura de faturas fotografadas, apenas quando o administrador usa esta função", dados: "A imagem da fatura (fornecedor, NIF do fornecedor, valores)", localizacao: "[confirmar a região e o acordo de tratamento de dados]" },
  { nome: "Fornecedor de alojamento da aplicação", finalidade: "Execução da aplicação web", dados: "Pedidos à aplicação (endereço IP, registos técnicos)", localizacao: "União Europeia [confirmar]" },
];
