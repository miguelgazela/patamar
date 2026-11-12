import Link from "next/link";
import { ENTIDADE, SUBCONTRATANTES, VERSAO_TEXTOS_LEGAIS } from "@/lib/legal";

export const metadata = { title: "Política de privacidade · Patamar" };

function Seccao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-brand">{titulo}</h2>
      {children}
    </section>
  );
}

export default function Privacidade() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8 leading-relaxed">
      <header>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-brand underline">← Início</Link>
        <h1 className="font-display text-3xl font-semibold">Política de privacidade</h1>
        <p className="text-sm text-muted">Versão {VERSAO_TEXTOS_LEGAIS}</p>
      </header>

      <Seccao titulo="Quem é responsável pelos seus dados">
        <p>O Patamar é uma aplicação para a gestão de condomínios. Há dois papéis diferentes no tratamento dos dados:</p>
        <ul className="list-disc pl-5">
          <li><strong>O condomínio</strong> é o responsável pelo tratamento dos dados dos condóminos (identificação, contactos, quotas, pagamentos e contas do prédio). O administrador age em nome do condomínio e decide quem entra e que dados se registam.</li>
          <li><strong>{ENTIDADE.nome}</strong> (NIF {ENTIDADE.nif}, {ENTIDADE.morada}) presta o serviço e trata esses dados por conta do condomínio, como subcontratante. É responsável pelo tratamento dos dados da conta do próprio administrador e dos dados técnicos de utilização da aplicação.</li>
        </ul>
        <p>Contacto para questões de privacidade: {ENTIDADE.email}.</p>
      </Seccao>

      <Seccao titulo="Que dados tratamos">
        <ul className="list-disc pl-5">
          <li><strong>Identificação e contacto:</strong> nome, email, telemóvel e, opcionalmente, NIF dos condóminos.</li>
          <li><strong>Frações e propriedade:</strong> identificação, tipo e permilagem das frações, anexos (box, arrecadação) e quem são os proprietários.</li>
          <li><strong>Contas do condomínio:</strong> quotas, pagamentos recebidos (valor, data, descrição do extrato bancário), despesas e as respetivas faturas (ficheiros).</li>
          <li><strong>Comunicações:</strong> registo dos lembretes de atraso enviados.</li>
          <li><strong>Atividade:</strong> registo de quem fez o quê e quando, para a transparência das contas.</li>
          <li><strong>Dados técnicos:</strong> endereço IP e registos técnicos necessários ao funcionamento e à segurança.</li>
        </ul>
        <p>Guardamos só o necessário. O NIF dos condóminos é opcional. <strong>A aplicação nunca recebe nem guarda dinheiro</strong>, nem números de cartões ou de contas bancárias dos condóminos: o IBAN que aparece é o do condomínio.</p>
      </Seccao>

      <Seccao titulo="Para que usamos os dados e com que fundamento">
        <ul className="list-disc pl-5">
          <li><strong>Gerir o condomínio</strong> (quotas, contas, avisos, documentos): interesse legítimo do condomínio e cumprimento das obrigações legais da administração do edifício (regime da propriedade horizontal).</li>
          <li><strong>Enviar lembretes de quotas em atraso e avisos:</strong> execução das obrigações do condomínio perante os condóminos e interesse legítimo na cobrança das contribuições.</li>
          <li><strong>Autenticar e proteger as contas</strong> (código por email): execução do contrato e interesse legítimo na segurança.</li>
          <li><strong>Ler faturas por fotografia:</strong> só quando o administrador usa esta função. A imagem é enviada a um serviço de inteligência artificial que propõe os dados; o administrador confirma sempre antes de guardar.</li>
        </ul>
        <p>Não vendemos dados, não os usamos para publicidade e não tomamos decisões automatizadas que o afetem.</p>
      </Seccao>

      <Seccao titulo="Quem vê os seus dados">
        <ul className="list-disc pl-5">
          <li>O <strong>administrador</strong> vê os dados do condomínio que administra.</li>
          <li>Cada <strong>condómino</strong> vê o seu próprio saldo, as suas quotas e pagamentos e os totais do prédio (saldo, fundo de reserva, despesas por categoria). <strong>Não vê as dívidas nem os dados individuais dos vizinhos.</strong></li>
          <li>Os dados de condomínios diferentes estão totalmente separados.</li>
        </ul>
      </Seccao>

      <Seccao titulo="Subcontratantes e localização">
        <p>Usamos os fornecedores seguintes, ao abrigo de contratos de tratamento de dados. Os dados da aplicação ficam em servidores na União Europeia.</p>
        <ul className="flex flex-col gap-2">
          {SUBCONTRATANTES.map((s) => (
            <li key={s.nome} className="rounded-md border border-line bg-surface p-3 text-sm">
              <strong>{s.nome}</strong> · {s.finalidade}<br />
              <span className="text-muted">Dados: {s.dados}. Localização: {s.localizacao}.</span>
            </li>
          ))}
        </ul>
      </Seccao>

      <Seccao titulo="Durante quanto tempo guardamos os dados">
        <ul className="list-disc pl-5">
          <li>Os dados do condomínio mantêm-se enquanto o condomínio usar a aplicação. Quando o administrador elimina o condomínio, apagamos todos os dados associados, incluindo ficheiros e contas de acesso. [Confirmar prazo das cópias de segurança.]</li>
          <li>Se um condómino pedir a eliminação da sua conta, removemos o acesso e <strong>anonimizamos os seus dados pessoais</strong> (nome, email, telemóvel, NIF). Mantêm-se, sem identificação, os registos contabilísticos do condomínio (quotas e pagamentos), que o condomínio tem de conservar.</li>
          <li>Os registos técnicos são mantidos pelo período estritamente necessário à segurança.</li>
        </ul>
      </Seccao>

      <Seccao titulo="Os seus direitos">
        <p>Pode pedir o acesso, a retificação, a eliminação, a limitação e a portabilidade dos seus dados, e opor-se ao tratamento, nos termos do RGPD.</p>
        <ul className="list-disc pl-5">
          <li><strong>Exportar:</strong> em «Privacidade e dados» descarrega uma cópia dos dados a que tem acesso, em formato JSON.</li>
          <li><strong>Eliminar:</strong> na mesma página elimina a sua conta (condóminos) ou o condomínio inteiro (administrador).</li>
          <li><strong>Retificar:</strong> peça ao administrador para corrigir os seus dados, ou contacte-nos em {ENTIDADE.email}.</li>
        </ul>
        <p>Se considerar que os seus direitos não foram respeitados, pode apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD), <span className="whitespace-nowrap">www.cnpd.pt</span>.</p>
      </Seccao>

      <Seccao titulo="Segurança">
        <p>O acesso é por código de uso único enviado por email, sem palavra-passe. As ligações são cifradas, o acesso aos dados é separado por condomínio ao nível da base de dados e o registo de atividade permite auditar alterações.</p>
      </Seccao>

      <p className="text-sm text-muted">Esta política pode ser atualizada; a versão em vigor indica-se no topo. Ver também os <Link href="/termos" className="text-brand underline">Termos de utilização</Link>.</p>
    </main>
  );
}
