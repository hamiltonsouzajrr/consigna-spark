import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Calculator, ChevronDown, Database, Loader2, MapPin, Phone, Search, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RockdataFichaPanel } from "@/components/consultas/RockdataFichaPanel";
import { buscarCliente, type BuscaClienteResultado, type LeadAchado, type PromovidoAchado, type TomadorAchado } from "@/lib/prospeccao/busca-cliente.functions";
import { consultarServidor, type ConsultaResultado } from "@/lib/consultas/rockdata.functions";
import { PRAZO_CARTAO, PRAZO_EMPRESTIMO_PADRAO, valorLiberado } from "@/lib/prospeccao/coeficientes";

export const Route = createFileRoute("/_authenticated/consulta-servidor")({
  head: () => ({ meta: [
    { title: "Pesquisar Cliente | Grupo Positive" },
    { name: "description", content: "Localize clientes nas planilhas e compare os dados com a RockData quando necessário." },
    { name: "robots", content: "noindex, nofollow" },
    { property: "og:title", content: "Pesquisar Cliente" },
    { property: "og:description", content: "Busca interna de clientes com comparação opcional de dados cadastrais." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ConsultaServidorPage,
});

type ClienteSelecionado =
  | { fonte: "CRM"; item: LeadAchado }
  | { fonte: "Tomadores AL"; item: TomadorAchado }
  | { fonte: "Diário Oficial"; item: PromovidoAchado };

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dinheiro = (valor: number | null) => valor == null ? "Não informada na planilha" : BRL.format(valor);

function ConsultaServidorPage() {
  const [termo, setTermo] = useState("");
  const [resultado, setResultado] = useState<BuscaClienteResultado | null>(null);
  const [selecionado, setSelecionado] = useState<ClienteSelecionado | null>(null);
  const [plusAberto, setPlusAberto] = useState(false);
  const [rockdata, setRockdata] = useState<ConsultaResultado | null>(null);
  const buscarInterno = useServerFn(buscarCliente);
  const consultarRockdata = useServerFn(consultarServidor);

  const busca = useMutation({
    mutationFn: (valor: string) => buscarInterno({ data: { termo: valor } }),
    onSuccess: (data) => { setResultado(data); setSelecionado(null); setPlusAberto(false); setRockdata(null); },
    onError: () => toast.error("Não foi possível pesquisar no banco do sistema."),
  });
  const buscaPlus = useMutation({
    mutationFn: (v: { cpf: string; atualizar?: boolean }) => consultarRockdata({ data: { termo: v.cpf.replace(/\D/g, ""), forcarAtualizacao: v.atualizar ?? false } }),
    onSuccess: (data) => setRockdata(data),
    onError: (e: Error) => toast.error(e.message || "Não foi possível comparar com a RockData."),
  });

  const enviar = () => {
    const valor = termo.trim();
    if (valor.length < 3) return toast.error("Digite um CPF, telefone com DDD ou pelo menos 3 letras do nome.");
    busca.mutate(valor);
  };
  const cpfSelecionado = selecionado
    ? selecionado.fonte === "Tomadores AL" ? selecionado.item.documento : selecionado.item.cpf
    : null;
  const total = resultado ? resultado.leads.length + resultado.tomadores.length + resultado.promovidos.length : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4">
      <div>
        <h1 className="text-2xl font-bold">Pesquisar Cliente</h1>
        <p className="mt-1 text-sm text-muted-foreground">Consulte primeiro as planilhas do sistema por CPF, nome ou telefone.</p>
      </div>

      <Card><CardContent className="pt-6">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
          <Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="CPF, nome completo ou telefone com DDD" autoFocus />
          <Button type="submit" disabled={busca.isPending} className="gap-2">
            {busca.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Pesquisar no sistema
          </Button>
        </form>
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Database className="h-3.5 w-3.5" /> Esta busca não consulta nem gera cobrança na RockData.</p>
      </CardContent></Card>

      {resultado && !selecionado && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{total} resultado(s) encontrado(s) nas planilhas importadas.</p>
          {resultado.leads.length > 0 && <Grupo titulo="CRM" quantidade={resultado.leads.length}>
            {resultado.leads.map((item) => <Resultado key={item.id} nome={item.nome} cpf={item.cpf} detalhe={[item.telefone, item.endereco, item.origem].filter(Boolean).join(" · ")} onClick={() => setSelecionado({ fonte: "CRM", item })} />)}
          </Grupo>}
          {resultado.tomadores.length > 0 && <Grupo titulo="Tomadores AL" quantidade={resultado.tomadores.length}>
            {resultado.tomadores.map((item) => <Resultado key={item.id} nome={item.nome} cpf={item.documento} detalhe={[item.telefones[0], item.cargo, item.orgao].filter(Boolean).join(" · ")} onClick={() => setSelecionado({ fonte: "Tomadores AL", item })} />)}
          </Grupo>}
          {resultado.promovidos.length > 0 && <Grupo titulo="Diário Oficial" quantidade={resultado.promovidos.length}>
            {resultado.promovidos.map((item) => <Resultado key={item.id} nome={item.nome} cpf={item.cpf} detalhe={[item.cargo, item.orgao].filter(Boolean).join(" · ")} onClick={() => setSelecionado({ fonte: "Diário Oficial", item })} />)}
          </Grupo>}
          {total === 0 && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum cliente foi encontrado nas planilhas do sistema.</CardContent></Card>}
        </div>
      )}

      {selecionado && (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => { setSelecionado(null); setPlusAberto(false); setRockdata(null); }}>← Voltar aos resultados</Button>
          <FichaInterna selecionado={selecionado} />
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <Button variant="ghost" className="h-auto w-full justify-between p-0 text-left" onClick={() => setPlusAberto((v) => !v)}>
                <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><span><strong>Busca Plus</strong><span className="block text-xs font-normal text-muted-foreground">Comparar os dados com a RockData</span></span></span>
                <ChevronDown className={`h-4 w-4 transition-transform ${plusAberto ? "rotate-180" : ""}`} />
              </Button>
            </CardHeader>
            {plusAberto && <CardContent className="space-y-4 border-t pt-4">
              {!cpfSelecionado && <p className="text-sm text-muted-foreground">Este registro não possui CPF para fazer a comparação.</p>}
              {cpfSelecionado && !rockdata && <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">A consulta só será feita após sua confirmação. Dados salvos por até 90 dias serão reutilizados.</p>
                <Button onClick={() => buscaPlus.mutate({ cpf: cpfSelecionado })} disabled={buscaPlus.isPending} className="gap-2">
                  {buscaPlus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Comparar agora
                </Button>
              </div>}
              {rockdata?.ficha && <RockdataFichaPanel resultado={rockdata} atualizar={() => cpfSelecionado && buscaPlus.mutate({ cpf: cpfSelecionado, atualizar: true })} />}
            </CardContent>}
          </Card>
        </div>
      )}
    </div>
  );
}

function Grupo({ titulo, quantidade, children }: { titulo: string; quantidade: number; children: React.ReactNode }) {
  return <Card className="overflow-hidden"><div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3"><span className="font-semibold">{titulo}</span><Badge variant="secondary">{quantidade}</Badge></div><div>{children}</div></Card>;
}

function Resultado({ nome, cpf, detalhe, onClick }: { nome: string; cpf: string | null; detalhe: string; onClick: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"><div className="min-w-0"><p className="font-semibold">{nome}</p><p className="text-xs text-muted-foreground">{[cpf, detalhe].filter(Boolean).join(" · ") || "Sem detalhes adicionais"}</p></div><Button size="sm" variant="secondary" onClick={onClick}>Ver ficha</Button></div>;
}

function Margem({ titulo, valor, prazo }: { titulo: string; valor: number | null; prazo: number }) {
  const liberado = valorLiberado(valor, prazo);
  return <div className="border-l-2 border-primary pl-3"><p className="text-xs text-muted-foreground">{titulo}</p><p className="font-semibold">{dinheiro(valor)}</p>{liberado != null && <p className="text-xs text-success">≈ {BRL.format(liberado)} liberados em {prazo}x</p>}</div>;
}

function FichaInterna({ selecionado }: { selecionado: ClienteSelecionado }) {
  const item = selecionado.item;
  const nome = item.nome;
  let cpf: string | null = null;
  let telefone: string | null = null;
  let endereco: string | null = null;
  let principal: number | null = null;
  let cartao: number | null = null;
  let beneficio: number | null = null;
  if (selecionado.fonte === "CRM") {
    cpf = selecionado.item.cpf;
    telefone = selecionado.item.telefone;
    endereco = selecionado.item.endereco;
    principal = selecionado.item.orcamento;
  } else if (selecionado.fonte === "Tomadores AL") {
    cpf = selecionado.item.documento;
    telefone = selecionado.item.telefones[0] ?? null;
    principal = selecionado.item.margemEmprestimo;
    cartao = selecionado.item.margemCartao;
    beneficio = selecionado.item.margemCartaoBeneficio;
  } else {
    cpf = selecionado.item.cpf;
  }
  return <Card>
    <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> {nome}</CardTitle><Badge>{selecionado.fonte}</Badge></div></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">CPF</p><p className="font-medium">{cpf ?? "Não informado"}</p></div>
        <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> Telefone</p><p className="font-medium">{telefone ?? "Não informado"}</p></div>
        <div className="sm:col-span-2"><p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> Endereço</p><p className="font-medium">{endereco ?? "Não informado na planilha"}</p></div>
      </div>
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Calculator className="h-4 w-4" /> Margens e valores aproximados</h3>
        <div className="grid gap-4 sm:grid-cols-3"><Margem titulo="Empréstimo" valor={principal} prazo={PRAZO_EMPRESTIMO_PADRAO} /><Margem titulo="Cartão de crédito" valor={cartao} prazo={PRAZO_CARTAO} /><Margem titulo="Cartão benefício" valor={beneficio} prazo={PRAZO_CARTAO} /></div>
        <p className="mt-3 text-xs text-muted-foreground">Estimativas calculadas com os mesmos coeficientes da calculadora. O valor final pode variar conforme o banco.</p>
      </div>
    </CardContent>
  </Card>;
}