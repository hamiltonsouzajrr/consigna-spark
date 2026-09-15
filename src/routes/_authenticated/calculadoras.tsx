import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlagoasPage } from "./alagoas";
import { CalculadoraALPage } from "./calculadora-al";
import { SimulacaoAlagoasPage } from "./simulacao-alagoas";

type Aba = "bancos" | "contracheque" | "banese";

export const Route = createFileRoute("/_authenticated/calculadoras")({
  validateSearch: (search: Record<string, unknown>): { aba: Aba } => ({
    aba: search.aba === "contracheque" || search.aba === "banese" ? search.aba : "bancos",
  }),
  head: () => ({ meta: [
    { title: "Calculadoras de consignado | Grupo Positive" },
    { name: "description", content: "Prévia de todos os bancos, cálculo por contracheque e simulação Banese em um só lugar." },
    { property: "og:title", content: "Calculadoras de consignado | Grupo Positive" },
    { property: "og:description", content: "Prévia de todos os bancos, cálculo por contracheque e simulação Banese em um só lugar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: Calculadoras,
});

function Calculadoras() {
  const { aba } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <AppShell>
      <Tabs value={aba} onValueChange={(value) => navigate({ to: "/calculadoras", search: { aba: value as Aba }, replace: true })}>
        <TabsList className="mb-6 grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
          <TabsTrigger value="bancos">Prévia AL — todos os bancos</TabsTrigger>
          <TabsTrigger value="contracheque">Contracheque GOV AL</TabsTrigger>
          <TabsTrigger value="banese">Banese</TabsTrigger>
        </TabsList>
        <TabsContent value="bancos"><AlagoasPage embedded /></TabsContent>
        <TabsContent value="contracheque"><CalculadoraALPage embedded /></TabsContent>
        <TabsContent value="banese"><SimulacaoAlagoasPage embedded /></TabsContent>
      </Tabs>
    </AppShell>
  );
}