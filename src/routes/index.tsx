import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  
  /**
   * Mover a importação e a validação para processamento em background e exibir um status/progresso da importação até concluir e mostrar uma barra de progresso e notificar ao admin quando finalizar com pop up
   * 
   * Prompt Aprimorado:
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
   */
  
  return <Navigate to={user ? "/rh/portal" : "/login"} />;
}
