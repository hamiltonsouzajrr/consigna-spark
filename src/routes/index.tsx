import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  
  /**
   * **Prompt Melhorado:**
   *
   * Analise e resolva o problema ocorrido ao importar uma planilha, que está apresentando um erro após a importação. Siga os passos abaixo para diagnosticar e corrigir a situação:
   *
   * - **Descrição do problema:**
   *   - Ao importar a planilha, os dados estão sendo exibidos de forma incorreta ou incompleta.
   *   - Logo após a importação, é apresentado um erro (especificar o tipo de erro, se conhecido, ou descrever o comportamento anômalo).
   *
   * - **Informações necessárias para análise:**
   *   - Formato original da planilha (ex: .xlsx, .csv, .ods).
   *   - Ferramenta ou sistema utilizado para a importação (ex: Excel, Google Sheets, Python, sistema personalizado).
   *   - Versão do software ou linguagem de programação envolvida.
   *   - Trecho do código ou configuração utilizada para a importação (se aplicável).
   *   - Captura de tela ou descrição detalhada do erro apresentado.
   *
   * - **Possíveis causas a investigar:**
   *   - Incompatibilidade entre o formato da planilha e a ferramenta de importação.
   *   - Erros de codificação ou caracteres especiais não suportados.
   *   - Limitações de tamanho ou estrutura da planilha.
   *   - Problemas de permissão ou configuração do ambiente de importação.
   *
   * - **Solicitação de correção:**
   *   - Identifique a causa raiz do problema.
   *   - Proponha uma solução detalhada, incluindo:
   *     - Ajustes na planilha original (se necessário).
   *     - Alterações no processo de importação (código, configurações ou ferramenta).
   *     - Passos para validar a correção.
   *
   * - **Formato de resposta esperado:**
   *   - Explicação clara do problema identificado.
   *   - Solução passo a passo para corrigi-lo.
   *   - Recomendações para evitar recorrência.
   */

  
  return <Navigate to={user ? "/rh/portal" : "/login"} />;
}
