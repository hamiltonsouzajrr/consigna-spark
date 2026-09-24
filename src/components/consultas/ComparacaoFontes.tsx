import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ConsultaResultado } from "@/lib/consultas/rockdata.functions";
import type { ClienteBusca } from "@/lib/prospeccao/busca-cliente.functions";

type Estado = "Igual" | "Diferente" | "Só na planilha" | "Só na RockData";
const digits = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");
const texto = (v: string | null | undefined) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const valor = (v: string | null | undefined) => v?.trim() || "—";
const estado = (interno: string, externo: string, iguais?: boolean): Estado => {
  if (!interno) return "Só na RockData";
  if (!externo) return "Só na planilha";
  return (iguais ?? texto(interno) === texto(externo)) ? "Igual" : "Diferente";
};
const variante = (e: Estado) => e === "Igual" ? "default" : e === "Diferente" ? "destructive" : "secondary";

export function ComparacaoFontes({ interno, rockdata }: { interno: ClienteBusca | null; rockdata: ConsultaResultado }) {
  const ficha = rockdata.ficha;
  if (!ficha) return null;
  const internosTel = interno?.telefones.map(digits).filter(Boolean) ?? [];
  const externosTel = ficha.telefones.map(digits).filter(Boolean);
  const comuns = internosTel.filter((n) => externosTel.includes(n));
  const somenteInternos = internosTel.filter((n) => !externosTel.includes(n));
  const somenteExternos = externosTel.filter((n) => !internosTel.includes(n));
  const telefonesI = internosTel.join(" · ");
  const telefonesR = externosTel.join(" · ");
  const telefoneEstado: Estado = !telefonesI ? "Só na RockData" : !telefonesR ? "Só na planilha" : somenteInternos.length || somenteExternos.length ? "Diferente" : "Igual";
  const margensInternas = interno?.margens.filter((m) => m.valor != null).map((m) => `${m.tipo}: ${Number(m.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`).join(" · ") ?? "";
  const margensReais = (rockdata.margensCarteira ?? []).filter((m) => m.margemRestante != null).map((m) => `${m.tipo ?? "Margem"}: ${Number(m.margemRestante).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`).join(" · ");
  const linhas = [
    { campo: "Nome", interno: interno?.nome ?? "", externo: ficha.pessoa.nome ?? "", status: estado(interno?.nome ?? "", ficha.pessoa.nome ?? "") },
    { campo: "CPF", interno: interno?.cpf ?? "", externo: ficha.pessoa.cpf ?? rockdata.cpf ?? "", status: estado(digits(interno?.cpf), digits(ficha.pessoa.cpf ?? rockdata.cpf), digits(interno?.cpf) === digits(ficha.pessoa.cpf ?? rockdata.cpf)) },
    { campo: "Telefones", interno: telefonesI, externo: telefonesR, status: telefoneEstado },
    { campo: "Endereço", interno: interno?.endereco ?? "", externo: ficha.enderecos[0] ?? "", status: estado(interno?.endereco ?? "", ficha.enderecos[0] ?? "") },
    { campo: "Margens", interno: margensInternas, externo: margensReais, status: estado(margensInternas, margensReais) },
  ];
  return <Card>
    <CardHeader><CardTitle className="text-base">Comparação RockData × planilha</CardTitle></CardHeader>
    <CardContent>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Dado</TableHead><TableHead>Planilha/Carteira</TableHead><TableHead>RockData</TableHead><TableHead>Diferença</TableHead></TableRow></TableHeader>
          <TableBody>{linhas.map((linha) => <TableRow key={linha.campo}><TableCell className="font-medium">{linha.campo}</TableCell><TableCell className="min-w-52">{valor(linha.interno)}</TableCell><TableCell className="min-w-52">{valor(linha.externo)}</TableCell><TableCell><Badge variant={variante(linha.status)}>{linha.status}</Badge></TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      {(somenteInternos.length > 0 || somenteExternos.length > 0) && <p className="mt-3 text-xs text-muted-foreground">Telefones em comum: {comuns.join(", ") || "nenhum"}. Só na planilha: {somenteInternos.join(", ") || "nenhum"}. Só na RockData: {somenteExternos.join(", ") || "nenhum"}.</p>}
      <p className="mt-2 text-xs text-muted-foreground">A comparação não altera a planilha original.</p>
    </CardContent>
  </Card>;
}