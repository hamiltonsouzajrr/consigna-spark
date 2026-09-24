// Consulta de servidor (RockData): busca por CPF ou nome, reaproveitando o banco por 90 dias.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, RefreshCw, Phone, Mail, MapPin, User, History, Loader2, Copy, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  consultarServidor,
  listarConsultasRecentes,
  type ConsultaResultado,
} from "@/lib/consultas/rockdata.functions";
import { formatCpf, normalizeCpf } from "@/lib/cpf";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { TelefonesRanking } from "@/components/consultas/TelefonesRanking";
import { PRAZO_CARTAO, PRAZO_EMPRESTIMO_PADRAO, valorLiberado } from "@/lib/prospeccao/coeficientes";

export const Route = createFileRoute("/_authenticated/consulta-servidor")({
  head: () => ({
    meta: [
      { title: "Pesquisar Cliente | Grupo Positive" },
      { name: "description", content: "Consulte telefones, endereços e dados cadastrais do cliente por CPF, nome ou telefone." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Pesquisar Cliente" },
      { property: "og:description", content: "Consulta de telefones, endereços e dados cadastrais do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsultaServidorPage,
});

function copiar(valor: string) {
  navigator.clipboard?.writeText(valor);
  toast.success("Copiado");
}

function soDigitos(v: string) {
  return v.replace(/\D/g, "");
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function rotuloMargem(tipo: string | null) {
  if (tipo === "cartao_credito") return "Cartão de crédito";
  if (tipo === "cartao_beneficio") return "Cartão benefício";
  if (tipo === "emprestimo") return "Empréstimo";
  return "Margem registrada";
}

function ConsultaServidorPage() {
  const [termo, setTermo] = useState("");
  const [resultado, setResultado] = useState<ConsultaResultado | null>(null);
  const consultar = useServerFn(consultarServidor);
  const listar = useServerFn(listarConsultasRecentes);
  const qc = useQueryClient();

  const historico = useQuery({
    queryKey: ["consultas-recentes"],
    queryFn: () => listar(),
  });

  const busca = useMutation({
    mutationFn: (v: { termo: string; forcarAtualizacao?: boolean }) =>
      consultar({ data: { termo: v.termo, forcarAtualizacao: v.forcarAtualizacao ?? false } }),
    onSuccess: (r) => {
      setResultado(r);
      if (r.mensagem) toast.info(r.mensagem);
      qc.invalidateQueries({ queryKey: ["consultas-recentes"] });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível consultar agora."),
  });

  const enviar = (valor: string, forcar = false) => {
    const t = valor.trim();
    if (t.length < 3) {
      toast.error("Digite um CPF, um telefone com DDD ou pelo menos 3 letras do nome.");
      return;
    }
    setTermo(t);
    busca.mutate({ termo: t, forcarAtualizacao: forcar });
  };

  const ficha = resultado?.ficha ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pesquisar Cliente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Digite o CPF, o nome ou o telefone com DDD do cliente para ver telefones, endereços e dados cadastrais.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              enviar(termo);
            }}
          >
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="CPF, nome ou telefone com DDD"
              className="flex-1"
              autoFocus
            />
            <Button type="submit" disabled={busca.isPending} className="gap-2">
              {busca.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Pesquisar
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Consultas já feitas são reaproveitadas por 90 dias, sem nova cobrança.
          </p>
        </CardContent>
      </Card>

      {busca.isPending && (
        <div className="flex items-center justify-center gap-2 rounded-xl border bg-card py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Consultando...
        </div>
      )}

      {/* Lista de pessoas na busca por nome ou telefone */}
      {!busca.isPending && (resultado?.tipo === "nome" || resultado?.tipo === "telefone") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {resultado.pessoas.length} pessoa(s) encontrada(s) para “{termo}”
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resultado.pessoas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma pessoa encontrada com essa busca.</p>
            )}
            {resultado.pessoas.map((p) => (
              <button
                key={p.cpf}
                type="button"
                onClick={() => enviar(p.cpf)}
                className="flex w-full flex-col items-start gap-1 rounded-lg border p-3 text-left transition hover:bg-accent sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCpf(p.cpf)} {p.idade ? `• ${p.idade}` : ""}{" "}
                    {p.cidade ? `• ${p.bairro ? `${p.bairro}, ` : ""}${p.cidade}${p.uf ? `/${p.uf}` : ""}` : ""}
                  </p>
                </div>
                <Badge variant="secondary">Ver dados</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ficha completa */}
      {!busca.isPending && ficha && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> {ficha.pessoa.nome ?? "Cliente"}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={resultado?.origem === "banco" ? "secondary" : "default"}>
                  {resultado?.origem === "banco" ? "Dados salvos no sistema" : "Consulta nova"}
                </Badge>
                {resultado?.consultadoEm && (
                  <span className="text-xs text-muted-foreground">
                    Consultado em {new Date(resultado.consultadoEm).toLocaleDateString("pt-BR")}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => resultado?.cpf && enviar(resultado.cpf, true)}
                >
                  <RefreshCw className="h-4 w-4" /> Atualizar dados
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {ficha.pessoa.campos.map((c, i) => (
                <div key={`${c.label}-${i}`} className="rounded-lg border p-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
                  <p className="text-sm font-medium">{c.valor}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <WalletCards className="h-4 w-4" /> Margens salvas em Minha carteira
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(resultado?.margensCarteira ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma margem real foi registrada para este CPF em Minha carteira.</p>
              ) : (
                (resultado?.margensCarteira ?? []).map((m, i) => {
                  const prazo = m.prazo ?? (m.tipo?.startsWith("cartao") ? PRAZO_CARTAO : PRAZO_EMPRESTIMO_PADRAO);
                  const estimativa = valorLiberado(m.margemRestante, prazo);
                  return (
                    <div key={`${m.origem}-${m.atualizadoEm ?? i}`} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{rotuloMargem(m.tipo)} · valor real</p>
                        <p className="font-semibold">Usada: {m.margemUsada != null ? BRL.format(m.margemUsada) : "Não informada"}</p>
                        <p className="text-sm">Restante: {m.margemRestante != null ? BRL.format(m.margemRestante) : "Não informada"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Estimativa da calculadora</p>
                        <p className="font-semibold">{estimativa != null ? BRL.format(estimativa) : "Sem margem restante"}</p>
                        <p className="text-xs text-muted-foreground">Prazo considerado: {prazo} meses</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Origem</p>
                        <p className="text-sm font-medium">{m.origem === "planilha" ? "Cliente importado" : "Conversão registrada"}</p>
                        {m.atualizadoEm && <p className="text-xs text-muted-foreground">Atualizada em {new Date(`${m.atualizadoEm}T12:00:00`).toLocaleDateString("pt-BR")}</p>}
                      </div>
                    </div>
                  );
                })
              )}
              <p className="text-xs text-muted-foreground">A estimativa usa a margem restante real e os mesmos coeficientes da calculadora.</p>
            </CardContent>
          </Card>

          <TelefonesRanking
            cpf={resultado?.cpf ?? null}
            telefones={
              ficha.telefonesDetalhe?.length
                ? ficha.telefonesDetalhe
                : ficha.telefones.map((numero) => ({
                    numero, tipo: null, whatsapp: false, restricao: false, qualificacao: 0, score: 0, nivel: "duvidoso" as const, sinais: [],
                  }))
            }
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" /> Endereços ({ficha.enderecos.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ficha.enderecos.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum endereço disponível.</p>
                )}
                {ficha.enderecos.map((e) => (
                  <div key={e} className="flex items-start justify-between gap-2 rounded-lg border p-2 text-sm">
                    <span>{e}</span>
                    <Button size="sm" variant="ghost" onClick={() => copiar(e)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4" /> E-mails ({ficha.emails.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ficha.emails.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum e-mail disponível.</p>
                )}
                {ficha.emails.map((e) => (
                  <div key={e} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                    <span className="break-all">{e}</span>
                    <Button size="sm" variant="ghost" onClick={() => copiar(e)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {ficha.tabelas
            .filter((t) => !/^(telefone|tipos|email|endere)/i.test(t.colunas[0] ?? ""))
            .map((t, i) => (
              <Card key={`tab-${i}`}>
                <CardHeader>
                  <CardTitle className="text-base">Outras informações</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        {t.colunas.map((c) => (
                          <th key={c} className="px-2 py-1 font-medium">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.linhas.map((l, j) => (
                        <tr key={j} className="border-t">
                          {l.map((c, k) => (
                            <td key={k} className="px-2 py-1">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Pesquisas recentes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(historico.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Você ainda não fez consultas.</p>
          )}
          {(historico.data ?? []).map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => enviar(h.cpf ? h.cpf : h.termo)}
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-left text-sm transition hover:bg-accent"
            >
              <span className="font-medium">
                {h.nome && h.tipo === "cpf" ? h.nome : h.termo}
                {h.cpf ? <span className="ml-2 text-muted-foreground">{formatCpf(h.cpf)}</span> : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(h.criadoEm).toLocaleString("pt-BR")} •{" "}
                {h.origem === "banco" ? "do sistema" : "consulta nova"}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export { normalizeCpf };
