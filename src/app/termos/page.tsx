import Link from "next/link";
import { ENTIDADE, VERSAO_TEXTOS_LEGAIS } from "@/lib/legal";

export const metadata = { title: "Termos de utilização · Patamar" };

function Seccao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-brand">{titulo}</h2>
      {children}
    </section>
  );
}

export default function Termos() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8 leading-relaxed">
      <header>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-brand underline">← Início</Link>
        <h1 className="font-display text-3xl font-semibold">Termos de utilização</h1>
        <p className="text-sm text-muted">Versão {VERSAO_TEXTOS_LEGAIS}</p>
      </header>

      <Seccao titulo="O serviço">
        <p>O Patamar, prestado por {ENTIDADE.nome} (NIF {ENTIDADE.nif}), é uma ferramenta de apoio à administração de condomínios: registo de frações e condóminos, quotas, despesas, importação de extratos, avisos de atraso, portal do condómino e documentos em PDF.</p>
      </Seccao>

      <Seccao titulo="O que o Patamar não é">
        <ul className="list-disc pl-5">
          <li>Não é contabilidade certificada nem substitui o técnico oficial de contas, quando exigido.</li>
          <li><strong>Não recebe nem guarda dinheiro.</strong> Os pagamentos são feitos por transferência diretamente para a conta do condomínio.</li>
          <li>Não presta aconselhamento jurídico. Os modelos de documentos (ata, declaração de encargos, avisos) são modelos de apoio: o administrador deve confirmar o seu conteúdo e adequação ao caso, e consultar um jurista quando necessário.</li>
        </ul>
      </Seccao>

      <Seccao titulo="Responsabilidades do administrador">
        <ul className="list-disc pl-5">
          <li>Registar dados corretos e atualizados e rever as sugestões automáticas (leitura de faturas, correspondência de transferências) antes de as confirmar.</li>
          <li>Convidar apenas pessoas que sejam condóminos ou que o condomínio autorize a aceder, e tratar os dados pessoais dos condóminos de acordo com o RGPD, em nome do condomínio.</li>
          <li>Usar os avisos e lembretes apenas para a gestão do condomínio.</li>
          <li>Manter confidencial o acesso à sua conta.</li>
        </ul>
      </Seccao>

      <Seccao titulo="Condóminos">
        <p>O condómino acede com o email que o administrador registou, por código de uso único, e vê apenas os seus dados e os totais do prédio. Deve informar o administrador se detetar dados incorretos.</p>
      </Seccao>

      <Seccao titulo="Disponibilidade e alterações">
        <p>Procuramos manter o serviço disponível, sem garantir funcionamento ininterrupto. Podemos alterar funcionalidades e estes termos; as alterações relevantes são comunicadas por email ao administrador.</p>
      </Seccao>

      <Seccao titulo="Dados pessoais">
        <p>O tratamento de dados pessoais descreve-se na <Link href="/privacidade" className="text-brand underline">Política de privacidade</Link>.</p>
      </Seccao>

      <Seccao titulo="Cessação">
        <p>O administrador pode eliminar o condomínio a qualquer momento em «Privacidade e dados», o que apaga todos os dados associados. Podemos suspender contas que violem estes termos.</p>
      </Seccao>

      <Seccao titulo="Lei aplicável">
        <p>Estes termos regem-se pela lei portuguesa. Contacto: {ENTIDADE.email}.</p>
      </Seccao>
    </main>
  );
}
