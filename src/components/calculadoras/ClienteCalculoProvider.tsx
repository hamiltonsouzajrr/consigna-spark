import { createContext, useContext, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Save, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buscarClientesParaCalculo, salvarCalculoCliente, type ClienteCarteira } from "@/lib/prospeccao/carteira-clientes.functions";

type Calculadora = "bancos" | "contracheque" | "banese";
type Contexto = { cliente: ClienteCarteira | null; salvar: (calculadora: Calculadora, entradas: Record<string, unknown>, resultado: Record<string, unknown>) => void; salvando: boolean };
const ClienteContext = createContext<Contexto | null>(null);

export function useClienteCalculo() {
  return useContext(ClienteContext) ?? { cliente: null, salvar: () => toast.error("Selecione o cliente acima."), salvando: false };
}

export function BotaoSalvarCalculo({ calculadora, entradas, resultado, disabled = false }: { calculadora: Calculadora; entradas: Record<string, unknown>; resultado: Record<string, unknown>; disabled?: boolean }) {
  const ctx = useClienteCalculo();
  return <Button type="button" variant="outline" className="gap-2" disabled={disabled || ctx.salvando} onClick={() => ctx.salvar(calculadora, entradas, resultado)}><Save className="h-4 w-4" />Salvar cálculo{ctx.cliente ? ` para ${ctx.cliente.nome.split(" ")[0]}` : ""}</Button>;
}

export function ClienteCalculoProvider({ children }: { children: ReactNode }) {
  const buscar = useServerFn(buscarClientesParaCalculo);
  const salvarFn = useServerFn(salvarCalculoCliente);
  const [termo, setTermo] = useState("");
  const [cliente, setCliente] = useState<ClienteCarteira | null>(null);
  const { data: clientes = [], isFetching } = useQuery({ queryKey: ["clientes-calculo", termo], queryFn: () => buscar({ data: { termo } }), enabled: termo.trim().length >= 2 });
  const mutation = useMutation({
    mutationFn: (v: { calculadora: Calculadora; entradas: Record<string, unknown>; resultado: Record<string, unknown> }) => {
      if (!cliente) throw new Error("Selecione o cliente deste cálculo.");
      return salvarFn({ data: { leadId: cliente.id, ...v } });
    },
    onSuccess: () => toast.success("Cálculo salvo na ficha do cliente."),
    onError: (e: Error) => toast.error(e.message || "Não foi possível salvar o cálculo."),
  });
  return <ClienteContext.Provider value={{ cliente, salvar: (calculadora, entradas, resultado) => mutation.mutate({ calculadora, entradas, resultado }), salvando: mutation.isPending }}>
    <Card className="mb-5 border-primary/30"><CardContent className="space-y-3 pt-5">
      <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /><div><p className="text-sm font-semibold">Identificar este cálculo</p><p className="text-xs text-muted-foreground">Pesquise nome ou CPF de um cliente da sua carteira.</p></div></div>
      {cliente ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3"><span className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-primary" />{cliente.nome} · {cliente.cpf ?? "CPF não informado"}</span><Button size="sm" variant="ghost" onClick={() => { setCliente(null); setTermo(""); }}>Trocar</Button></div> : <><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Nome ou CPF" /></div>{termo.trim().length >= 2 && <div className="max-h-44 overflow-y-auto rounded-md border">{clientes.map((item) => <Button key={item.id} variant="ghost" className="h-auto w-full justify-start rounded-none px-3 py-2 text-left" onClick={() => setCliente(item)}><span><strong className="block">{item.nome}</strong><span className="text-xs text-muted-foreground">{item.cpf ?? "CPF não informado"}</span></span></Button>)}{!clientes.length && !isFetching && <p className="p-3 text-sm text-muted-foreground">Nenhum cliente na sua carteira.</p>}</div>}</>}
    </CardContent></Card>
    {children}
  </ClienteContext.Provider>;
}