# Planejamento: Gestão Administrativa de Leads

Este plano detalha a implementação de uma área administrativa completa para upload, processamento e gestão de leads, conforme solicitado.

## Etapas de Implementação

### 1. Banco de Dados e Segurança
- Criar tabela `lead_batches` para gerenciar o histórico de arquivos carregados.
- Criar tabela `leads_raw` para armazenar os dados extraídos dos arquivos.
- Configurar RLS e Grants para acesso administrativo.

### 2. Infraestrutura de Upload e Processamento
- Criar função de servidor para processar arquivos CSV/XLSX.
- Integrar com o Storage para armazenamento seguro dos arquivos originais.

### 3. Interface Administrativa
- Desenvolver painel de controle com métricas e histórico de arquivos.
- Criar formulário de upload com feedback em tempo real.
- Desenvolver tabela de listagem de leads com filtros, busca e edição em linha.

### 4. Exportação e Integrações
- Implementar funcionalidade de exportação para CSV e XLSX.
- Preparar estrutura para futuras integrações via API.

## Detalhes Técnicos

- **Framework:** TanStack Start (React 19).
- **Processamento:** Server Functions para extração de dados.
- **UI:** Tailwind CSS + Shadcn UI para uma interface responsiva e intuitiva.
- **Banco de Dados:** Supabase (PostgreSQL) com RLS ativado.
