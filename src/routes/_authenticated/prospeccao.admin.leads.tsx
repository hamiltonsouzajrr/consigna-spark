import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLeadBatches, createLeadBatch, processLeadChunk, getLeadsByBatch, assignBatchToConsultant } from "@/lib/prospeccao/leads-admin.functions";
import { getProspectConsultants } from "@/lib/prospeccao/prospeccao.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, Upload, FileText, CheckCircle2, AlertCircle, Clock, 
  Search, ExternalLink, Download, Trash2, Edit2
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/prospeccao/admin/leads")({
  component: LeadsAdminPage,
});

function LeadsAdminPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedConsultant, setSelectedConsultant] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Column mapping states
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  
  const queryClient = useQueryClient();

  const getBatchesFn = useServerFn(getLeadBatches);
  const createBatchFn = useServerFn(createLeadBatch);
  const processChunkFn = useServerFn(processLeadChunk);
  const getLeadsFn = useServerFn(getLeadsByBatch);
  const getConsultantsFn = useServerFn(getProspectConsultants);
  const assignBatchFn = useServerFn(assignBatchToConsultant);

  const { data: batches, isLoading } = useQuery({
    queryKey: ["lead-batches"],
    queryFn: () => getBatchesFn(),
  });

  const { data: consultants } = useQuery({
    queryKey: ["prospect-consultants"],
    queryFn: () => getConsultantsFn(),
  });

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads-batch", selectedBatchId],
    queryFn: () => getLeadsFn({ data: { batchId: selectedBatchId! } }),
    enabled: !!selectedBatchId,
  });

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    if (!searchTerm) return leads;
    const term = searchTerm.toLowerCase();
    return leads.filter((lead: any) => {
      const dataStr = JSON.stringify(lead.data).toLowerCase();
      return dataStr.includes(term);
    });
  }, [leads, searchTerm]);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCurrentFile(file);
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
          return;
        }
        
        // Identify available columns from the first row
        const cols = Object.keys(data[0] as object);
        setAvailableColumns(cols);
        setPreviewData(data);
        setMappingOpen(true);
      } catch (err: any) {
        toast.error("Erro ao ler o arquivo: " + err.message);
      }
    };
    
    reader.readAsBinaryString(file);
  };


  const confirmImport = async () => {
    if (!currentFile || selectedColumns.length === 0) {
      toast.error("Selecione pelo menos uma coluna para importar.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setMappingOpen(false);

    try {
      // Filter data to include only selected columns
      const mappedLeads = previewData.map(row => {
        const newRow: any = {};
        selectedColumns.forEach(col => {
          newRow[col] = row[col];
        });
        return newRow;
      });

      // Validation: Check for email if present
      const hasEmail = selectedColumns.some(col => 
        col.toLowerCase().includes("email") || col.toLowerCase().includes("e-mail")
      );

      if (!hasEmail) {
        toast.warning("Atenção: Nenhuma coluna de e-mail foi identificada no mapeamento.");
      }

      // 1. Create batch
      const batch = await createBatchFn({
        data: {
          filename: currentFile.name,
          totalLeads: mappedLeads.length,
          columnMapping: selectedColumns
        }
      });

      // 2. Process in chunks
      const chunkSize = 200;
      for (let i = 0; i < mappedLeads.length; i += chunkSize) {
        const chunk = mappedLeads.slice(i, i + chunkSize);
        const isLastChunk = i + chunkSize >= mappedLeads.length;
        
        await processChunkFn({
          data: {
            batchId: batch.id,
            leads: chunk,
            isLastChunk
          }
        });
        
        const progress = Math.min(Math.round(((i + chunk.length) / mappedLeads.length) * 100), 100);
        setUploadProgress(progress);
      }

      queryClient.invalidateQueries({ queryKey: ["lead-batches"] });
      toast.success("Arquivo processado com sucesso!");
      
      // Reset states
      setSelectedColumns([]);
      setPreviewData([]);
      setCurrentFile(null);
    } catch (err: any) {
      toast.error("Erro na importação: " + err.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };


  const toggleColumn = (col: string) => {
    setSelectedColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
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

  const handleAssign = async () => {
    if (!selectedBatchId || !selectedConsultant) {
      toast.error("Selecione uma consultora.");
      return;
    }

    setIsAssigning(true);
    try {
      await assignBatchFn({
        data: {
          batchId: selectedBatchId,
          consultantId: selectedConsultant
        }
      });
      toast.success("Leads atribuídos com sucesso!");
      setAssignOpen(false);
      setSelectedBatchId(null);
      setSelectedConsultant("");
      queryClient.invalidateQueries({ queryKey: ["lead-batches"] });
    } catch (err: any) {
      toast.error("Erro ao atribuir leads: " + err.message);
    } finally {
      setIsAssigning(false);
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
                <div className="mt-4 w-full space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Processando arquivo...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1" />
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
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {batch.status === "completed" ? (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedBatchId(batch.id);
                                  setAssignOpen(true);
                                }}
                              >
                                <Users className="w-4 h-4 mr-2" />
                                Distribuir
                              </Button>
                            ) : null}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedBatchId(batch.id);
                                setDetailsOpen(true);
                              }}
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Detalhes
                            </Button>
                          </div>
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

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes do Arquivo</DialogTitle>
            <DialogDescription>
              Visualize e gerencie os leads importados nesta listagem.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-4 py-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou telefone..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>

          <div className="flex-1 overflow-auto border rounded-md">
            {leadsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLeads.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dados do Lead</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead: any) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="max-w-md overflow-hidden text-ellipsis whitespace-nowrap text-xs font-mono">
                          {JSON.stringify(lead.data)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{lead.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                Nenhum lead encontrado com os filtros atuais.
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Distribution Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Distribuir Leads</DialogTitle>
            <DialogDescription>
              Selecione a consultora para a qual deseja atribuir estes leads.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Consultora</label>
            <select 
              className="w-full p-2 border rounded-md"
              value={selectedConsultant}
              onChange={(e) => setSelectedConsultant(e.target.value)}
            >
              <option value="">Selecione...</option>
              {consultants?.map(c => (
                <option key={c.id} value={c.id}>{c.email}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selectedConsultant || isAssigning}>
              {isAssigning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Distribuir Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column Mapping Dialog */}
      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Mapeamento de Colunas</DialogTitle>
            <DialogDescription>
              Selecione as colunas da planilha que deseja importar para o CRM.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {availableColumns.map(col => (
                <div 
                  key={col}
                  onClick={() => toggleColumn(col)}
                  className={`
                    flex items-center p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedColumns.includes(col) 
                      ? "border-primary bg-primary/5 ring-1 ring-primary" 
                      : "border-muted hover:border-muted-foreground/50"}
                  `}
                >
                  <div className={`
                    w-4 h-4 rounded-sm border mr-3 flex items-center justify-center
                    ${selectedColumns.includes(col) ? "bg-primary border-primary" : "border-muted-foreground/30"}
                  `}>
                    {selectedColumns.includes(col) && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span className="text-sm font-medium truncate">{col}</span>
                </div>
              ))}
            </div>

            {selectedColumns.length > 0 && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-muted">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Resumo da Seleção ({selectedColumns.length} colunas)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedColumns.map(col => (
                    <Badge key={col} variant="secondary" className="px-2 py-1">
                      {col}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {availableColumns.length > 0 && selectedColumns.length === 0 && (
              <div className="mt-8 text-center text-muted-foreground py-10 border-2 border-dashed rounded-lg">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>Selecione pelo menos uma coluna para continuar</p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t gap-2">
            <Button variant="ghost" onClick={() => setMappingOpen(false)}>Cancelar</Button>
            <Button 
              onClick={confirmImport} 
              disabled={selectedColumns.length === 0 || isUploading}
            >
              {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
