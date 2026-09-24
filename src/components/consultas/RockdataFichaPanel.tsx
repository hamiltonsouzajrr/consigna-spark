import { Copy, Mail, MapPin, RefreshCw, User, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TelefonesRanking } from "@/components/consultas/TelefonesRanking";
import { PRAZO_CARTAO, PRAZO_EMPRESTIMO_PADRAO, valorLiberado } from "@/lib/prospeccao/coeficientes";
import type { ConsultaResultado } from "@/lib/consultas/rockdata.functions";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const copiar = (valor: string) => { navigator.clipboard?.writeText(valor); toast.success("Copiado"); };
const rotuloMargem = (tipo: string | null) => tipo === "cartao_credito" ? "Cartão de crédito" : tipo === "cartao_beneficio" ? "Cartão benefício" : tipo === "emprestimo" ? "Empréstimo" : "Margem registrada";

export function RockdataFichaPanel({ resultado, onAtualizar }: { resultado: ConsultaResultado; onAtualizar: () => void }) {
  const ficha = resultado.ficha;
  if (!ficha) return (
    <Card><CardContent className="space-y-2 py-5">
      <p className="text-sm font-medium">{resultado.pessoas.length} pessoa(s) encontrada(s) na RockData</p>
      {resultado.pessoas.map((p) => <div key={p.cpf} className="rounded-md border p-2 text-sm"><strong>{p.nome}</strong><p className="text-muted-foreground">{p.cpf}</p></div>)}
      {!resultado.pessoas.length && <p className="text-sm text-muted-foreground">Nenhum dado adicional encontrado.</p>}
    </CardContent></Card>
  );
  return <div className="space-y-4">
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" />{ficha.pessoa.nome ?? "Cliente"}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={resultado.origem === "banco" ? "secondary" : "default"}>{resultado.origem === "banco" ? "Ficha salva" : "Consulta RockData"}</Badge>
          {resultado.consultadoEm && <span className="text-xs text-muted-foreground">{new Date(resultado.consultadoEm).toLocaleDateString("pt-BR")}</span>}
          <Button size="sm" variant="outline" className="gap-2" onClick={onAtualizar}><RefreshCw className="h-4 w-4" />Atualizar na RockData</Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">{ficha.pessoa.campos.map((campo, index) => <div key={`${campo.label}-${index}`} className="rounded-md border p-2"><p className="text-xs uppercase text-muted-foreground">{campo.label}</p><p className="text-sm font-medium">{campo.valor}</p></div>)}</CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><WalletCards className="h-4 w-4" />Margens reais e estimativas</CardTitle></CardHeader><CardContent className="space-y-2">
      {!(resultado.margensCarteira ?? []).length && <p className="text-sm text-muted-foreground">Nenhuma margem real registrada em Minha carteira.</p>}
      {(resultado.margensCarteira ?? []).map((m, index) => { const prazo = m.prazo ?? (m.tipo?.startsWith("cartao") ? PRAZO_CARTAO : PRAZO_EMPRESTIMO_PADRAO); const estimativa = valorLiberado(m.margemRestante, prazo); return <div key={`${m.origem}-${index}`} className="grid gap-2 rounded-md border p-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">{rotuloMargem(m.tipo)}</p><p className="font-semibold">Usada: {m.margemUsada == null ? "Não informada" : BRL.format(m.margemUsada)}</p><p className="text-sm">Restante: {m.margemRestante == null ? "Não informada" : BRL.format(m.margemRestante)}</p></div><div><p className="text-xs text-muted-foreground">Estimativa liberada</p><p className="font-semibold">{estimativa == null ? "Sem cálculo" : BRL.format(estimativa)}</p><p className="text-xs text-muted-foreground">Prazo: {prazo} meses</p></div><div><p className="text-xs text-muted-foreground">Origem</p><p className="text-sm font-medium">{m.origem === "planilha" ? "Cliente importado" : "Conversão registrada"}</p></div></div>; })}
    </CardContent></Card>
    <TelefonesRanking cpf={resultado.cpf} telefones={ficha.telefonesDetalhe?.length ? ficha.telefonesDetalhe : ficha.telefones.map((numero) => ({ numero, tipo: null, whatsapp: false, restricao: false, qualificacao: 0, score: 0, nivel: "desconhecido" as const, sinais: [] }))} />
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" />Endereços ({ficha.enderecos.length})</CardTitle></CardHeader><CardContent className="space-y-2">{ficha.enderecos.length ? ficha.enderecos.map((endereco) => <div key={endereco} className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm"><span>{endereco}</span><Button size="icon" variant="ghost" onClick={() => copiar(endereco)}><Copy className="h-4 w-4" /></Button></div>) : <p className="text-sm text-muted-foreground">Nenhum endereço disponível.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4" />E-mails ({ficha.emails.length})</CardTitle></CardHeader><CardContent className="space-y-2">{ficha.emails.length ? ficha.emails.map((email) => <div key={email} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"><span className="break-all">{email}</span><Button size="icon" variant="ghost" onClick={() => copiar(email)}><Copy className="h-4 w-4" /></Button></div>) : <p className="text-sm text-muted-foreground">Nenhum e-mail disponível.</p>}</CardContent></Card>
    </div>
  </div>;
}