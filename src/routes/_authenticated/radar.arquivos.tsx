import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2, FileText } from "lucide-react";
import {
  getArquivos, deletarArquivo, reprocessarArquivo, analisarDiarioAI, salvarRegistros,
  type DoArquivo,
} from "@/lib/radar/radar.functions";

export const Route = createFileRoute("/_authenticated/radar/arquivos")({
  component: ArquivosPage,
});

function ArquivosPage() {
  const { user } = useAuth();
  const { isAdmin } = useRhAccess();
  const fetchArqs = useServerFn(getArquivos);
  const delFn = useServerFn(deletarArquivo);
  const reprocFn = useServerFn(reprocessarArquivo);
  const aiFn = useServerFn(analisarDiarioAI);
  const salvarFn = useServerFn(salvarRegistros);

  const [list, setList] = useState<DoArquivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setList(await fetchArqs());
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar arquivos.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const reprocessar = async (id: string) => {
    setBusyId(id);
    const toastId = toast.loading("Reprocessando com IA…");
    try {
      const { texto, data_publicacao, orgao } = await reprocFn({ data: { id } });
      const { registros } = await aiFn({ data: { text: texto, data_publicacao, orgao } });
      if (registros.length === 0) {
        toast.warning("Nenhuma movimentação identificada no reprocessamento.", { id: toastId });
      } else {
        const { inserted, duplicados } = await salvarFn({ data: { arquivo_id: id, registros } });
        toast.success(`${inserted} registro(s) reprocessado(s). ${duplicados} duplicado(s).`, { id: toastId });
      }
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao reprocessar.", { id: toastId });
    } finally {
      setBusyId(null);
    }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este arquivo e todos os registros extraídos dele?")) return;
    setBusyId(id);
    try {
      await delFn({ data: { id } });
      setList((l) => l.filter((a) => a.id !== id));
      toast.success("Arquivo excluído.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Nenhum arquivo importado ainda.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((a) => (
        <Card key={a.id} className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{a.nome_arquivo}</p>
              <p className="text-xs text-muted-foreground">
                Enviado em {new Date(a.data_upload).toLocaleString("pt-BR")}
                {a.data_publicacao ? ` · DO ${a.data_publicacao}` : ""}
                {a.orgao_detectado ? ` · ${a.orgao_detectado}` : ""}
                {a.numero_edicao ? ` · Edição ${a.numero_edicao}` : ""}
              </p>
            </div>
            <Badge variant="outline">{a.tipo_arquivo}</Badge>
            <Badge variant="secondary">{a.total_registros_extraidos} encontrados</Badge>
            <Badge className="bg-emerald-600 text-white">{a.total_aprovados} aprovados</Badge>
            {a.total_erros > 0 && <Badge className="bg-red-600 text-white">{a.total_erros} erros</Badge>}
            <Badge variant={a.status_processamento === "concluido" ? "default" : "outline"}>
              {a.status_processamento}
            </Badge>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => reprocessar(a.id)}>
                {busyId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-1 hidden sm:inline">Reprocessar</span>
              </Button>
              {isAdmin && (
                <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => excluir(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
