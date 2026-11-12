# Patamar: app de gestão de condomínio para prédios autogeridos

Este ficheiro é o ponto de partida do projeto. Lê-o inteiro antes de escrever código.
O plano de produto completo está em: https://claude.ai/artifact/RSfqZnmxCGmQ3Wu8eU1n61

## Contexto

O dono do projeto administra o condomínio do prédio onde vive. O prédio é autogerido pelos moradores e a gestão é feita hoje num ficheiro Excel. A ideia é transformar essa experiência numa app que outros administradores voluntários possam usar e pagar.

O mercado-alvo são os prédios portugueses geridos pelos próprios moradores, sem empresa de administração. O software português existente (Gecond, SolidSoft GC, GOcondomínios, um módulo de Odoo, Unitify) é pensado sobretudo para empresas de administração. A lacuna é uma ferramenta simples e barata para o morador-administrador.

## Visão

Gerir o condomínio em 15 minutos por mês, com contas transparentes para todos os condóminos e o que a lei pede pronto a imprimir.

- **Cliente principal:** condómino eleito administrador num prédio de 4 a 20 frações, sem formação na área.
- **Quem paga:** o condomínio, como despesa aprovada em assembleia (subscrição de 6 a 9 €/mês por prédio, a validar).
- **O que a app não é:** contabilidade completa nem conta bancária. A app nunca recebe nem guarda dinheiro.

## Papéis

| Papel | O que faz | Acesso |
| --- | --- | --- |
| Administrador | Configura o prédio, regista despesas e pagamentos, gera documentos, envia avisos | Conta própria |
| Condómino | Vê o seu saldo e as contas do prédio, descarrega documentos | Código de 6 dígitos por email, sem password |
| Administrador seguinte | Recebe o prédio com todo o histórico quando o cargo muda | Convite do administrador anterior |

Um condómino pode ter várias frações e uma fração pode ter vários proprietários.

## Caso de teste real (o prédio do dono do projeto)

Usa estes dados para o seed de desenvolvimento, com nomes fictícios. Nunca guardes dados reais de condóminos no repositório.

- 5 frações de habitação, sem lojas, sem elevador.
- Garagem com boxes privadas e arrecadações associadas a algumas frações.
- Quota mensal igual para todas as frações, decidida em assembleia; o valor tem sido o mesmo todos os meses.
- Condomínio com NIF e conta bancária própria; todos pagam por transferência.
- Despesas correntes: luz, água, limpeza.
- Faturas guardadas em papel; hoje são registadas à mão no Excel. **Esta é a maior dor.**
- Fundo de reserva não está separado do saldo.
- Uma assembleia por ano, sem ata.
- Um condómino costuma acumular meses em atraso e pagar tudo junto; hoje o lembrete é feito por WhatsApp. O administrador quer que isto seja oficial e que a gestão pareça mais profissional.

## Âmbito da v1: substituir o Excel

Por ordem de prioridade:

1. **Prédio e frações:** frações com identificação, tipo e permilagem; box e arrecadação associadas a uma fração; proprietários e contactos.
2. **Quotas:** quota mensal fixa (igual para todos) ou calculada pela permilagem, escolhida por condomínio. Geração automática das quotas de cada mês.
3. **Despesas por foto:** o administrador tira uma foto à fatura; a app lê valor, data, fornecedor e NIF (Claude API com visão) e propõe a despesa; o administrador confirma ou corrige. Despesas recorrentes (luz, água, limpeza) já configuradas.
4. **Pagamentos por transferência:** importação do extrato bancário (CSV ou Excel) com mapeamento de colunas configurável, porque cada banco usa um formato. A app sugere a que quota corresponde cada transferência; o administrador confirma. Registo manual também possível.
5. **Saldo e fundo de reserva:** saldo do condomínio, saldo de cada fração, fundo comum de reserva separado (percentagem configurável, por defeito 10% da quota).
6. **Lembretes de atraso:** email automático e com aspeto oficial, em nome do condomínio, a quem tem quotas em atraso; contagem de dias desde o primeiro incumprimento.
7. **Portal do condómino:** saldo pessoal, contas do prédio e documentos, acessível com código por email.
8. **Documentos em PDF:** relatório de contas anual, declaração de encargos para venda de fração, modelo de ata com montante anual da quota e datas de vencimento.

Critério de sucesso da v1: o administrador usa a app durante 2 a 3 meses no seu prédio e deixa de abrir o Excel.

## Fora do âmbito por agora

- Pagamentos por referência Multibanco ou MB WAY (fase seguinte, via gateway como Easypay ou ifthenpay; o dinheiro vai sempre direto para a conta do condomínio).
- Votações online, registo de avarias, orçamentos de obras, plano para vários prédios.
- Apps nativas nas lojas: a v1 é uma aplicação web responsiva (PWA), pensada primeiro para telemóvel.

## Modelo de dados inicial

| Entidade | Campos principais |
| --- | --- |
| Condomínio | Nome, morada, NIF, IBAN, modo de quota (fixa ou permilagem), valor da quota, % do fundo de reserva |
| Fração | Identificação, tipo, permilagem, anexos (box, arrecadação) |
| Pessoa | Nome, email, telemóvel, NIF opcional |
| Propriedade | Liga pessoa a fração (muitos para muitos) |
| Administração | Liga pessoa a condomínio, com datas de início e fim do mandato |
| Quota | Fração, mês, valor, data-limite, estado |
| Pagamento | Valor, data, meio, referência do extrato; liga a uma ou várias quotas |
| Despesa | Data, valor, categoria, fornecedor, fatura (ficheiro), recorrente sim/não, paga pelo fundo de reserva sim/não |
| Documento | Tipo, data, ficheiro |
| Registo de atividade | Quem fez o quê e quando |

## Regras legais a respeitar

Fonte principal: Lei n.º 8/2022 (revê o regime da propriedade horizontal) e Decreto-Lei n.º 268/94. Os modelos de documentos devem ser revistos por um jurista antes do lançamento; a app informa, não dá aconselhamento jurídico.

- Convocatórias de assembleia podem ser enviadas por email.
- O administrador emite declaração de encargos e dívidas da fração quando esta é vendida.
- O administrador deve avançar com a cobrança judicial das dívidas no prazo de 90 dias a partir do primeiro incumprimento: a app mostra esta contagem.
- A ata que aprova as contribuições deve indicar o montante anual de cada condómino e as datas de vencimento.
- Fundo comum de reserva obrigatório e separado das despesas correntes.
- Por regra a lei reparte as despesas pela permilagem; a divisão em partes iguais tem requisitos próprios. A app suporta os dois modos.
- Seguro de incêndio do edifício obrigatório (alerta de renovação numa fase seguinte).

## RGPD e segurança

- Servidores e base de dados na União Europeia.
- Guardar só o necessário; NIF dos condóminos opcional.
- Isolamento total entre condomínios (por exemplo, Row Level Security).
- Um condómino vê o seu próprio saldo e as contas agregadas do prédio, não as dívidas individuais dos vizinhos.
- Exportação e eliminação de dados a pedido.

## Stack proposta (confirmar com o dono do projeto antes de começar)

- Next.js com TypeScript e Tailwind, como PWA.
- Supabase na região UE: Postgres, autenticação por código de uso único enviado por email (OTP; não usar link mágico: scanners de email invalidam-no e a PWA no iOS não partilha sessão com o browser), armazenamento das faturas.
- Claude API (visão) para ler faturas, sempre com confirmação humana.
- Resend (ou semelhante) para emails transacionais.
- Geração de PDF no servidor.
- Alojamento com região UE.

## Convenções

- Interface em português de Portugal (não português do Brasil): "condómino", "fração", "quota", "ata", "telemóvel".
- Valores guardados em cêntimos inteiros; apresentados como `1 234,56 €`.
- Datas `dd/mm/aaaa`, fuso horário `Europe/Lisbon`.
- Testes para todo o cálculo de quotas, saldos e fundo de reserva.

## Primeiros passos

1. Confirma com o dono do projeto a stack e o nível de experiência técnica dele, para ajustares as explicações.
2. Cria o projeto e a estrutura base.
3. Cria o esquema da base de dados e um seed com o prédio de teste acima.
4. Constrói os ecrãs da v1 por esta ordem: início do administrador, nova despesa por foto, quotas do mês, importação do extrato, portal do condómino.
5. Quando houver uma primeira versão utilizável, pede ao dono do projeto o Excel atual (com nomes trocados por fictícios) e cria a importação a partir dele.

## Questões em aberto

- Nome escolhido: Patamar. Falta verificar se o domínio .pt está livre e se a marca está disponível no INPI.
- Que bancos usam os primeiros clientes e em que formato exportam o extrato.
- Pesquisa mais funda sobre concorrência portuguesa para prédios autogeridos.
