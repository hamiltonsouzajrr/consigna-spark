import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, FileText, Award, TrendingUp, AlertTriangle, ThumbsUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/rh/RhLayout";
import { getColaborador, brl, formatDate, documentos, ocorrencias } from "@/lib/rh/mock";

export const Route = createFileRoute("/_authenticated/rh/colaboradores/$id")({
  loader: ({ params }) => {
    const c = getColaborador(params.id);
    if (!c) throw notFound();
    return c;
  },
  component: Perfil,
  errorComponent: () => <div role="alert" className="p-6">Erro ao carregar colaborador.</div>,
  notFoundComponent: () => (
    <div className="p-6">
      <p className="text-muted-foreground">Colaborador não encontrado.</p>
      <Button asChild variant="link" className="px-0"><Link to="/rh/colaboradores">Voltar</Link></Button>
    </div>
  ),
});

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function Perfil() {
  const c = Route.useLoaderData();
  const docs = documentos.filter((d) => d.colaborador === c.nome);
  const ocorr = ocorrencias.filter((o) => o.colaborador === c.nome);

  const historico = [
    { icon: TrendingUp, tone: "text-emerald-600", titulo: "Promoção", desc: `Promovido para ${c.cargo}`, data: c.admissao },
    { icon: Award, tone: "text-sky-600", titulo: "Alteração salarial", desc: `Reajuste para ${brl(c.salario)}`, data: "2025-01-15" },
    ...ocorr.map((o) => ({
      icon: o.tipo === "Elogio" ? ThumbsUp : AlertTriangle,
      tone: o.tipo === "Elogio" ? "text-emerald-600" : "text-rose-600",
      titulo: o.tipo, desc: o.descricao, data: o.data,
    })),
  ];

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/rh/colaboradores"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
      </Button>

      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
          <Avatar className="h-24 w-24">
            <AvatarImage src={c.foto} alt={c.nome} />
            <AvatarFallback>{c.nome.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <h1 className="text-2xl font-bold">{c.nome}</h1>
              <StatusBadge status={c.status} />
            </div>
            <p className="mt-1 text-muted-foreground">{c.cargo} · {c.departamento}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge variant="outline">{c.matricula}</Badge>
              <Badge variant="outline">{c.tipoContrato}</Badge>
              <Badge variant="outline">{c.email}</Badge>
              <Badge variant="outline">{c.telefone}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pessoais">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pessoais">Dados pessoais</TabsTrigger>
          <TabsTrigger value="profissionais">Dados profissionais</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="pessoais">
          <Card><CardContent className="grid grid-cols-2 gap-4 p-6 md:grid-cols-3">
            <Field label="Nome" value={c.nome} />
            <Field label="CPF" value={c.cpf} />
            <Field label="RG" value={c.rg} />
            <Field label="Data de nascimento" value={formatDate(c.nascimento)} />
            <Field label="Sexo" value={c.sexo} />
            <Field label="Estado civil" value={c.estadoCivil} />
            <Field label="Endereço" value={c.endereco} />
            <Field label="Contato de emergência" value={c.contatoEmergencia} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="profissionais">
          <Card><CardContent className="grid grid-cols-2 gap-4 p-6 md:grid-cols-3">
            <Field label="Matrícula" value={c.matricula} />
            <Field label="Cargo" value={c.cargo} />
            <Field label="Departamento" value={c.departamento} />
            <Field label="Gestor" value={c.gestor} />
            <Field label="Tipo de contrato" value={c.tipoContrato} />
            <Field label="Salário" value={brl(c.salario)} />
            <Field label="Data de admissão" value={formatDate(c.admissao)} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="documentos">
          <Card><CardContent className="p-4">
            {["RG", "CPF", "CNH", "Contrato", "ASO", "Certificados"].map((tipo) => {
              const found = docs.find((d) => d.tipo.includes(tipo));
              return (
                <div key={tipo} className="flex items-center justify-between border-b py-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{tipo}</p>
                      <p className="text-xs text-muted-foreground">
                        {found ? `Emitido em ${formatDate(found.emissao)}` : "Não enviado"}
                      </p>
                    </div>
                  </div>
                  {found
                    ? <Badge variant="secondary" className="border-0 bg-emerald-100 text-emerald-700">Disponível</Badge>
                    : <Badge variant="outline">Pendente</Badge>}
                </div>
              );
            })}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card><CardHeader><CardTitle className="text-base">Linha do tempo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {historico.map((h, i) => {
                const Icon = h.icon;
                return (
                  <div key={i} className="flex gap-3">
                    <span className="mt-0.5"><Icon className={`h-5 w-5 ${h.tone}`} /></span>
                    <div>
                      <p className="text-sm font-medium">{h.titulo}</p>
                      <p className="text-sm text-muted-foreground">{h.desc}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(h.data)}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
