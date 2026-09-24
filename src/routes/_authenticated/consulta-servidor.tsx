import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Database, Loader2, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BuscaInternaCards } from "@/components/consultas/BuscaInternaCards";
import { RockdataFichaPanel } from "@/components/consultas/RockdataFichaPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { consultarServidor, type ConsultaResultado } from "@/lib/consultas/rockdata.functions";
import { buscarCliente, type BuscaClienteResultado, type ClienteBusca } from "@/lib/prospeccao/busca-cliente.functions";

export const Route = createFileRoute("/_authenticated/consulta-servidor")({
  validateSearch: (search: Record<string, unknown>): { q: string } => ({ q: typeof search.q === "string" ? search.q : "" }),
  head: () => ({ meta: [
    { title: "Pesquisar Cliente | Grupo Positive" },
    { name: "description", content: "Busque clientes nas bases internas e compare, quando necessário, com a RockData." },
    { name: "robots", content: "noindex, nofollow" },
    { property: "og:title", content: "Pesquisar Cliente | Grupo Positive" },
    { property: "og:description", content: "Busca unificada de clientes e comparação opcional de dados." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ConsultaServidorPage,
});

function ConsultaServidorPage() {
  const { q } = Route.useSearch();
  const [termo, setTermo] = useState(q);
  const [resultadoInterno, setResultadoInterno] = useState<BuscaClienteResultado | null>(null);
  const [plusAberta, setPlusAberta] = useState(false);
  const [termoPlus, setTermoPlus] = useState<string | null>(null);
  const [resultadoPlus, setResultadoPlus] = useState<ConsultaResultado | null>(null);
  const buscarInterno = useServerFn(buscarCliente);
  const consultarPlus = useServerFn(consultarServidor);
  const busca = useMutation({
    mutationFn: (valor: string) => buscarInterno({ data: { termo: valor } }),
    onSuccess: (resultado) => { setResultadoInterno(resultado); setResultadoPlus(null); setPlusAberta(false); },
    onError: (error: Error) => { if (!/aborted|abort/i.test(error.message)) toast.error("Não foi possível pesquisar no sistema agora."); },
  });
  const plus = useMutation({
    mutationFn: ({ valor, forcar = false }: { valor: string; forcar?: boolean }) => consultarPlus({ data: { termo: valor, forcarAtualizacao: forcar } }),
    onSuccess: (resultado) => { setResultadoPlus(resultado); if (resultado.mensagem) toast.info(resultado.mensagem); },
    onError: (error: Error) => { if (!/aborted|abort/i.test(error.message)) toast.error(error.message || "A Busca Plus não respondeu agora."); },
  });
  const pesquisar = (valor = termo) => { const clean = valor.trim(); if (clean.length < 3) return toast.error("Digite CPF, nome ou telefone com DDD."); setTermo(clean); busca.mutate(clean); };
  const abrirPlus = (cliente?: ClienteBusca) => { const valor = cliente?.cpf ?? termo; setTermoPlus(valor); setPlusAberta(true); plus.mutate({ valor }); };
  useEffect(() => { if (q.trim().length >= 3) pesquisar(q); }, []);

  return <div className="mx-auto w-full max-w-5xl space-y-5 p-4">
    <div><h1 className="text-2xl font-bold tracking-tight">Pesquisar Cliente</h1><p className="mt-1 text-sm text-muted-foreground">A pesquisa começa pelas planilhas e carteiras do sistema. Use a Busca Plus somente para comparar com a RockData.</p></div>
    <Card><CardContent className="pt-6"><form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); pesquisar(); }}><Input value={termo} onChange={(event) => setTermo(event.target.value)} placeholder="CPF, nome completo, primeiro nome ou telefone" className="flex-1" autoFocus/><Button type="submit" disabled={busca.isPending} className="gap-2">{busca.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Pesquisar no sistema</Button></form><p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Database className="h-3 w-3" />CRM, Tomadores AL, Recém-promovidos, Minha carteira e fichas já salvas.</p></CardContent></Card>
    {busca.isPending && <div className="flex items-center justify-center gap-2 rounded-md border bg-card py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Procurando nas bases internas...</div>}
    {!busca.isPending && resultadoInterno && <BuscaInternaCards resultado={resultadoInterno} onPlus={abrirPlus} />}
    {!busca.isPending && resultadoInterno && <Card className="border-dashed"><CardContent className="pt-6"><Button variant="ghost" className="w-full justify-between" onClick={() => plusAberta ? setPlusAberta(false) : abrirPlus()}><span className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Busca Plus RockData <Badge variant="secondary">Opcional</Badge></span><ChevronDown className={`h-4 w-4 transition ${plusAberta ? "rotate-180" : ""}`} /></Button>{plusAberta && <div className="mt-4 space-y-4 border-t pt-4"><p className="text-sm text-muted-foreground">Comparação externa para complementar telefones, endereços e dados cadastrais. Consultas por CPF ficam salvas por 90 dias.</p>{plus.isPending && <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Consultando a RockData...</div>}{resultadoPlus && <RockdataFichaPanel resultado={resultadoPlus} onAtualizar={() => termoPlus && plus.mutate({ valor: termoPlus, forcar: true })} />}</div>}</CardContent></Card>}
    {!resultadoInterno && !busca.isPending && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Digite os dados do cliente para iniciar a pesquisa.</CardContent></Card>}
  </div>;
}