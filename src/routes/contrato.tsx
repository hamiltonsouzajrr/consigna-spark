import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, FileText, ExternalLink, AlertTriangle, Camera, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/contrato")({
  head: () => ({
    meta: [
      { title: "Gerar Contrato | Grupo Positive" },
      { name: "description", content: "Preencha os dados do contratante e gere o contrato de prestação de serviço pronto para impressão." },
    ],
  }),
  component: ContratoPage,
});

type Form = {
  nome: string;
  profissao: string;
  cpf: string;
  endereco: string;
  cep: string;
  cidade: string;
  uf: string;
  telefone: string;
  valor: string;
};

const inicial: Form = {
  nome: "",
  profissao: "SERVIDOR PÚBLICO",
  cpf: "",
  endereco: "",
  cep: "",
  cidade: "MACEIÓ",
  uf: "AL",
  telefone: "",
  valor: "",
};

function formatarValor(v: string): string {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "____________";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataPorExtenso(): string {
  const meses = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
  ];
  const d = new Date();
  return `${d.getDate()} DE ${meses[d.getMonth()]} DE ${d.getFullYear()}`;
}

function ContratoPage() {
  const [form, setForm] = useState<Form>(inicial);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valorFmt = useMemo(() => formatarValor(form.valor), [form.valor]);
  const data = useMemo(() => dataPorExtenso(), []);

  const ph = (v: string, n = 30) => v.trim() || "_".repeat(n);

  return (
    <AppShell>
      <div className="space-y-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Gerar Contrato
          </h1>
          <p className="text-sm text-muted-foreground">
            Preencha os dados do contratante e o valor. O restante do contrato já está pronto.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do contratante</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" value={form.nome} onChange={set("nome")} placeholder="Ex: João da Silva" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profissao">Profissão / Qualificação</Label>
              <Input id="profissao" value={form.profissao} onChange={set("profissao")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="endereco">Endereço (rua, número, bairro)</Label>
              <Input id="endereco" value={form.endereco} onChange={set("endereco")} placeholder="Rua, nº, complemento, bairro" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" value={form.cep} onChange={set("cep")} placeholder="00000-000" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" value={form.cidade} onChange={set("cidade")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uf">UF</Label>
                <Input id="uf" value={form.uf} onChange={set("uf")} maxLength={2} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Número de telefone</Label>
              <Input id="telefone" value={form.telefone} onChange={set("telefone")} placeholder="(82) 9 0000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor">Valor da prestação de serviço (R$)</Label>
              <Input id="valor" value={form.valor} onChange={set("valor")} placeholder="Ex: 571,00" inputMode="decimal" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Pré-visualização abaixo. Ao imprimir, apenas o contrato é incluído.
        </p>
      </div>

      {/* Documento imprimível */}
      <div className="mt-8 print:mt-0">
        <article className="contrato mx-auto max-w-[800px] rounded-lg border bg-white p-10 text-[13px] leading-relaxed text-black shadow-sm print:border-0 print:shadow-none print:p-0 print:max-w-none">
          <h2 className="text-center font-bold uppercase text-[15px] leading-snug">
            Contrato Particular de Prestação de Serviço de Intermediação, Consultoria e Assessoramento Financeiro
          </h2>

          <p className="mt-6">
            Pelo presente instrumento particular de contrato de prestação de serviços, de um lado:
          </p>

          <p className="mt-3 text-justify">
            <strong>CONTRATANTE:</strong> {ph(form.nome, 40)}, {ph(form.profissao, 18)} portador(a) do CPF nº {ph(form.cpf, 14)}, residente e domiciliado(a) na {ph(form.endereco, 40)} CEP: {ph(form.cep, 9)}, {ph(form.cidade, 12)} – {form.uf || "__"}, telefone: {ph(form.telefone, 12)} doravante denominado(a) simplesmente <strong>CONTRATANTE</strong>.
          </p>

          <p className="mt-3">E de outro lado:</p>

          <p className="mt-3 text-justify">
            <strong>CONTRATADA:</strong> POSITIVE CRED SERVIÇOS FINANCEIROS LTDA., pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 46.135.945/0001-11, com sede na Avenida da Paz, 1864, Centro, Maceió - AL, CEP 57.020-440, Maceió, Alagoas, doravante denominada simplesmente CONTRATADA.
          </p>

          <p className="mt-3 text-justify">
            As partes acima qualificadas, por este instrumento particular, ajustam e contratam a prestação de serviços de intermediação, consultoria e assessoramento financeiro, mediante as cláusulas e condições seguintes:
          </p>

          <Clause titulo="CLÁUSULA PRIMEIRA – DO OBJETO">
            O presente contrato tem por objeto regular a prestação de serviços de consultoria, assessoria e intermediação financeira, consistindo na análise, prospecção e auxílio na contratação de linhas de crédito específicas, tais como crédito consignado e financiamentos, ou outros produtos financeiros mutuamente acordados, junto a instituições financeiras parceiras da CONTRATADA no mercado brasileiro. A CONTRATADA se compromete a buscar e apresentar ao CONTRATANTE as propostas de crédito que melhor se adequem ao seu perfil e às condições de mercado disponíveis no momento da análise, considerando a viabilidade e as condições mais vantajosas de taxa de juros e prazos, dentro dos parâmetros expressamente delimitados pelo CONTRATANTE.
          </Clause>

          <Clause titulo="CLÁUSULA SEGUNDA – DAS OBRIGAÇÕES DA CONTRATADA">
            A CONTRATADA compromete-se a prestar os serviços de consultoria e intermediação com a máxima diligência e boa-fé, buscando identificar e viabilizar as propostas de empréstimo consignado, financiamento ou outros serviços financeiros que apresentem as condições mais favoráveis disponíveis no mercado para o perfil do CONTRATANTE, com base nos critérios de taxa de juros, prazo e valor mutuamente definidos. Obriga-se a cumprir integralmente todas as disposições do presente contrato, bem como as normas legais e regulamentares aplicáveis à atividade de intermediação financeira. Manterá estrito sigilo sobre todas as informações confidenciais do CONTRATANTE, especialmente dados pessoais sensíveis, renda e atividades financeiras, salvo quando houver autorização expressa do CONTRATANTE ou exigência legal. A CONTRATADA, neste ato, declara-se em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), comprometendo-se a tratar os dados pessoais do CONTRATANTE estritamente para as finalidades contratuais, observando os princípios da finalidade, adequação, necessidade e segurança, garantindo ao titular o pleno exercício de seus direitos. Fornecerá ao CONTRATANTE, de forma clara e acessível, todas as informações necessárias sobre o andamento do(s) processo(s) de prospecção e contratação, bem como as especificidades e riscos dos produtos e serviços financeiros propostos pelas instituições financeiras, antes da formalização de qualquer negócio.
          </Clause>

          <Clause titulo="CLÁUSULA TERCEIRA – DAS OBRIGAÇÕES DO CONTRATANTE">
            Realizar o pagamento dos honorários pactuados neste contrato, nos prazos e condições aqui estabelecidos. Entregar à CONTRATADA, nos prazos e moldes solicitados, toda a documentação completa e autêntica necessária para a análise e prospecção de crédito. Autorizar expressamente a CONTRATADA a realizar os contatos e os procedimentos necessários em seu nome junto às instituições financeiras para fins de consulta, análise e formalização das propostas de crédito objeto deste contrato. O CONTRATANTE declara-se ciente e responsável pela veracidade e fidedignidade de todas as informações e documentos por ele fornecidos à CONTRATADA e às instituições financeiras. A CONTRATADA envidará os melhores esforços para conferir a integridade das informações e auxiliar o CONTRATANTE no preenchimento correto dos formulários, mas não será responsável por dados comprovadamente falsos ou fraudulentos fornecidos pelo CONTRATANTE que resultem na negativa ou revogação do crédito, ou em outras irregularidades, desde que sua atuação tenha sido pautada pela boa-fé e diligência.
          </Clause>

          <Clause titulo="CLÁUSULA QUARTA – DOS HONORÁRIOS">
            Pela prestação dos serviços de consultoria, assessoria e intermediação financeira objeto deste contrato, o CONTRATANTE pagará à CONTRATADA o valor correspondente a um valor fixo de <strong>{valorFmt}</strong> conforme aditivo ou termo de contratação específica a ser assinado em conjunto com a proposta de crédito. O pagamento dos honorários deverá ser realizado no prazo máximo de 24 horas a contar da efetiva liberação do valor do crédito na conta bancária do CONTRATANTE.
          </Clause>

          <Clause titulo="CLÁUSULA QUINTA – DA RESCISÃO DO CONTRATO">
            Qualquer das partes poderá solicitar a rescisão unilateral do presente contrato mediante notificação escrita à outra parte, com antecedência. A rescisão operada antes da efetiva contratação e liberação do crédito na conta do CONTRATANTE poderá implicar no pagamento de eventuais despesas administrativas comprovadamente incorridas pela CONTRATADA até o momento da notificação, cujo montante será previamente acordado ou estabelecido em anexo. A rescisão do presente instrumento não extinguirá os direitos e obrigações que as partes tenham entre si e para com terceiros que já tenham sido gerados e consolidados até a data da rescisão. Não será possível a rescisão do contrato após o valor do crédito já ter sido efetivamente liberado e creditado na conta do CONTRATANTE, momento a partir do qual se considera integralmente cumprido o objeto principal da CONTRATADA, restando ao CONTRATANTE a obrigação de adimplir integralmente o valor dos honorários pactuados. O não pagamento dos honorários pela CONTRATANTE no prazo de até 24 horas após o recebimento do crédito, conforme estabelecido na cláusula de honorários, ensejará a aplicação de multa moratória de 10% (dez por cento) sobre o valor total devido, acrescido de juros de mora de 1% (um por cento) ao mês, calculados pro rata die, a partir do primeiro dia útil subsequente ao vencimento. Ultrapassados 30 (trinta) dias de inadimplemento, a CONTRATADA poderá, além dos encargos moratórios já descritos, proceder à negativação do nome do CONTRATANTE junto aos órgãos de proteção ao crédito e ajuizar as medidas judiciais cabíveis para a cobrança do débito, sendo o CONTRATANTE responsável pelo pagamento das custas processuais e honorários advocatícios, estes últimos fixados em 20% (vinte por cento) sobre o valor atualizado do débito em caso de cobrança judicial.
          </Clause>

          <Clause titulo="CLÁUSULA SEXTA – DA CONFIDENCIALIDADE">
            As partes se comprometem a manter sigilo sobre todas as informações confidenciais obtidas durante a vigência deste contrato, não as divulgando a terceiros sem consentimento prévio por escrito da outra parte.
          </Clause>

          <Clause titulo="CLÁUSULA SÉTIMA – DA VIGÊNCIA">
            Este contrato entra em vigor na data de sua assinatura pelas partes e permanecerá em vigor até a conclusão da prestação de serviço pactuada, a qual se tem por concluída, em regra, com o crédito em conta do CONTRATANTE.
          </Clause>

          <Clause titulo="CLÁUSULA OITAVA – DA PROTEÇÃO DE DADOS PESSOAIS">
            As partes reconhecem e declaram que, durante a execução deste contrato, terão acesso a dados pessoais uma da outra, comprometendo-se a tratá-los em estrita conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais – LGPD), bem como com quaisquer outras normas e regulamentos aplicáveis à proteção de dados pessoais. A CONTRATADA, na qualidade de operadora ou controladora de dados, conforme o caso, compromete-se a adotar as medidas de segurança, técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito. O CONTRATANTE, como titular dos dados, reconhece ter sido informado sobre a finalidade do tratamento de seus dados pessoais para a execução do objeto deste contrato e expressamente autoriza o tratamento de seus dados pessoais, incluindo dados bancários, financeiros e de renda, para as finalidades aqui previstas, e conforme a política de privacidade da CONTRATADA, que será disponibilizada para consulta.
          </Clause>

          <Clause titulo="CLÁUSULA NONA – DAS DISPOSIÇÕES GERAIS">
            Este contrato é regido pelas leis da República Federativa do Brasil. As partes elegem o foro da comarca de Maceió, Estado de Alagoas, para dirimir quaisquer questões decorrentes deste contrato, ressalvada, em se tratando de relação de consumo, a faculdade do CONTRATANTE de propor ação em seu próprio domicílio, conforme previsão do Código de Defesa do Consumidor. Quaisquer modificações ou aditamentos a este contrato deverão ser formalizados por escrito e assinados por ambas as partes para que produzam efeitos legais. E, por estarem assim justos e contratados, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das 2 (duas) testemunhas abaixo, para que produza seus jurídicos e legais efeitos.
          </Clause>

          <p className="mt-6">Maceió-AL, {data}</p>

          <div className="mt-12 space-y-10">
            <div>
              <p>POSITIVE CRED SERVIÇOS FINANCEIROS LTDA:</p>
              <div className="mt-8 border-t border-black w-full max-w-[420px]" />
            </div>
            <div>
              <p>CONTRATANTE: {form.nome.trim()}</p>
              <div className="mt-8 border-t border-black w-full max-w-[420px]" />
            </div>
            <div>
              <p>TESTEMUNHAS:</p>
              <div className="mt-8 border-t border-black w-full max-w-[420px]" />
            </div>
          </div>
        </article>
      </div>
    </AppShell>
  );
}

function Clause({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="font-bold uppercase text-[13px]">{titulo}</h3>
      <p className="mt-1 text-justify">{children}</p>
    </section>
  );
}
