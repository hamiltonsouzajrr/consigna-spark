import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { departamentos, cargos, tiposContrato, perfisAcesso } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/configuracoes")({
  component: Configuracoes,
});

const statusPersonalizados = ["Ativo", "Afastado", "Férias", "Desligado", "Experiência", "Aviso prévio"];

const permissoes: Record<string, string[]> = {
  Administrador: ["Acesso total", "Configurações", "Relatórios", "Folha"],
  RH: ["Colaboradores", "Férias", "Documentos", "Recrutamento"],
  Gestor: ["Equipe", "Aprovar férias", "Avaliações"],
  Colaborador: ["Meus dados", "Solicitar férias", "Meus documentos"],
};

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items.map((i) => <Badge key={i} variant="outline">{i}</Badge>)}
      </CardContent>
    </Card>
  );
}

function Configuracoes() {
  return (
    <div>
      <RhPageHeader title="Configurações" description="Parâmetros do módulo de RH e permissões por perfil." />
      <Tabs defaultValue="geral">
        <TabsList className="flex-wrap">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
        </TabsList>
        <TabsContent value="geral" className="grid gap-4 md:grid-cols-2">
          <ListCard title="Departamentos" items={departamentos.map((d) => d.nome)} />
          <ListCard title="Cargos" items={cargos.map((c) => c.nome)} />
          <ListCard title="Tipos de contrato" items={tiposContrato} />
          <ListCard title="Status personalizados" items={statusPersonalizados} />
        </TabsContent>
        <TabsContent value="permissoes" className="grid gap-4 md:grid-cols-2">
          {perfisAcesso.map((perfil) => (
            <ListCard key={perfil} title={perfil} items={permissoes[perfil]} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
