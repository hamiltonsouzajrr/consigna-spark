import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  
  /**
   * Mover a importação e a validação para processamento em background e exibir um status/progresso da importação até concluir e mostrar uma barra de progresso e notificar ao admin quando finalizar com pop up
   * 
   * For the code present, I get the error below.
   *
   * Please think step-by-step in order to resolve it.
   * ```
   * Error: aborted
   *
   * {
   *   "timestamp": 1787248523182,
   *   "error_type": "RUNTIME_ERROR",
   *   "filename": "Unknown file",
   *   "lineno": 0,
   *   "colno": 0,
   *   "stack": "Error: aborted\n    at abortIncoming (node:_http_server:838:17)\n    at socketOnClose (node:_http_server:832:3)\n    at Socket.emit (node:events:531:35)\n    at TCP.<anonymous> (node:net:346:12)\n    at TCP.callbackTrampoline (node:internal/async_hooks:130:17)",
   *   "has_blank_screen": true
   * }
   * ```
   * 
   * Contexto:
   * Sou responsável pela prospecção de leads e preciso integrar uma planilha (em qualquer formato) ao sistema de CRM. Ao carregar o arquivo, o sistema deve permitir que eu selecione quais colunas da planilha desejo mapear e exibir no CRM para as consultoras.
   * 
   * Requisitos Detalhados:
   * - Formato de Upload: Aceitar planilhas em qualquer formato comum (Excel, CSV, Google Sheets, etc.).
   * - Seleção de Colunas:
   *   - O sistema deve apresentar uma visualização prévia das colunas identificadas na planilha.
   *   - Permitir que eu selecione apenas as colunas relevantes para importação no CRM (ex.: nome, e-mail, telefone, etc.).
   *   - Exibir um resumo das colunas selecionadas antes da confirmação final.
   * - Validação de Dados:
   *   - Verificar automaticamente se há campos obrigatórios (ex.: e-mail) e alertar caso estejam ausentes ou inválidos.
   *   - Oferecer opção para corrigir ou ignorar inconsistências.
   * - Feedback ao Usuário:
   *   - Confirmar sucesso/erro na importação com detalhes (ex.: "X leads importados; Y registros ignorados por falta de e-mail").
   *   - Permitir download de um relatório de inconsistências, se aplicável.
   * 
   * Objetivo Final:
   * Garantir que as consultoras tenham acesso apenas aos dados estruturados e úteis para prospecção, sem informações desnecessárias ou duplicadas.
   * Implementar uma tela para eu selecionar quais colunas desejo importar e salvar esse mapeamento por usuário para a aba CRM.
   * Exibir na aba CRM apenas os campos que eu selecionei no upload, sem mostrar informações extras para todos os acessos de consultoras.
   * 
   */

  
  return <Navigate to={user ? "/rh/portal" : "/login"} />;
}