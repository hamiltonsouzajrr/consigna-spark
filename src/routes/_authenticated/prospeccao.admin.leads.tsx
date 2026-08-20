import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLeadBatches, uploadLeadsBatch } from "@/lib/prospeccao/leads-admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, FileText, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/prospeccao/admin/leads")({
  component: LeadsAdminPage,
});

function LeadsAdminPage() {
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  
  const getBatchesFn = useServerFn(getLeadBatches);
  const uploadBatchFn = useServerFn(uploadLeadsBatch);
  
  const { data: batches, isLoading } = useQuery({
    queryKey: ["lead-batches"],
    queryFn: () => getBatchesFn(),
  });
  
  const uploadMutation = useMutation({
    mutationFn: uploadBatchFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-batches"] });
      toast.success("Arquivo processado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro no upload: ${error.message}`);
    },
    onSettled: () => setIsUploading(false),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          toast.error("O arquivo está vazio.");
          setIsUploading(false);
          return;
        }
        
        await uploadMutation.mutateAsync({
          data: {
            filename: file.name,
            leads: data as any[],
          }
        });
      } catch (err: any) {
        toast.error("Erro ao ler o arquivo: " + err.message);
        setIsUploading(false);
      }
    };
    
    reader.readAsBinaryString(file);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Processado</Badge>;
      case "processing":
        return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processando</Badge>;
      case "error":
        return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20"><AlertCircle className="w-3 h-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge className="bg-gray-500/10 text-gray-500 hover:bg-gray-500/20 border-gray-500/20"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Leads</h1>
          <p className="text-muted-foreground">Upload e organização de listagens de leads.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Upload de Listagem</CardTitle>
            <CardDescription>Formatos aceitos: .csv, .xlsx, .xls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-center text-muted-foreground mb-4">
                Clique para selecionar ou arraste o arquivo aqui
              </p>
              <Input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="cursor-pointer"
              />
              {isUploading && (
                <div className="mt-4 flex items-center text-sm text-primary">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando arquivo...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Histórico de Arquivos</CardTitle>
            <CardDescription>Acompanhe o processamento das suas listagens.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : batches && batches.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                            {batch.filename}
                          </div>
                        </TableCell>
                        <TableCell>{batch.total_leads}</TableCell>
                        <TableCell>{getStatusBadge(batch.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {batch.created_at ? new Date(batch.created_at).toLocaleDateString() : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum arquivo carregado ainda.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
