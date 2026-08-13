# Relatório de Auditoria: Mapeamento de Gráficos e Dados (Orion System)

## 1. Gráficos Atuais na Página de Relatórios (`Reports.tsx`)

A página de relatórios atualmente suporta dois modos: **Resumido** e **Detalhado**. Todos os dados são extraídos diretamente via chamadas ao Supabase pelo front-end.

### Visão Geral / Resumido
*   **KPIs Principais (Cards):** Total de Chamados, Abertos/Ativos, Resolvidos/Fechados, Tempo Médio de Resolução (MTTR), Chamados com SLA Estourado. (Fonte: `tickets`)
*   **Cumprimento de SLA (Gauge Chart):** Mostra a porcentagem de chamados resolvidos dentro do prazo em relação a uma meta percentual. (Fonte: `tickets`)
*   **Tempo de Resolução vs. Meta Contratual (Bullet Chart):** Compara o MTTR por prioridade com as metas configuradas. (Fontes: `tickets`, `sla_configs`)
*   **Ativos Críticos (Cards):** Visão executiva de servidores offline ou em alerta. (Fonte: `assets`)
*   **Evolução do Volume (Line Chart):** Série temporal do volume de chamados por período. (Fonte: `tickets`)
*   **Chamados por Categoria (Bar Chart Horizontal):** Distribuição do volume por categoria. (Fonte: `tickets`)

### Visão Detalhada (Inclui os acima e adiciona)
*   **Comparativo de Técnicos (Chart Customizado):** Compara a performance dos técnicos cruzando métricas como tempo de resolução, reabertura e nota de satisfação (CSAT). (Fontes: `tickets`, `ticket_ratings`)
*   **Tempo Médio por Categoria (Bar Chart):** MTTR isolado por categoria. (Fonte: `tickets`)
*   **Taxa de Reabertura por Técnico (Bar Chart):** Porcentagem de chamados reabertos por cada técnico. (Fonte: `tickets`)
*   **SLA ao Longo do Tempo (Area Chart):** Tendência de SLA (No Prazo vs Atenção vs Estourado) ao longo de semanas/dias. (Fonte: `tickets`)
*   **Volume por Empresa (Bar Chart):** (Fonte: `tickets`)
*   **Distribuição por Prioridade (Bar Chart):** (Fonte: `tickets`)
*   **Horas Lançadas por Técnico (Bar Chart):** Total de horas apontadas por técnico. (Fonte: `time_entries`)

---

## 2. Dados Existentes no Backend/DB Não Visualizados Hoje

Com base na análise do schema do banco e código-fonte, o sistema possui uma rica base de dados que ainda não foi exposta na página de relatórios. Dividi as oportunidades de visualização em duas categorias:

### A. Prontos para Uso Imediato (Apenas criar hook/component no Frontend)
Como o sistema já lê dados diretamente do Supabase via hooks no Frontend (ex: `useReportSources.ts`), estes dados podem ser puxados e exibidos sem alterar o backend em Go:

*   **Tempo Médio de Primeira Resposta (MTTA):** A tabela `tickets` já armazena o `first_response_at`. É possível criar gráficos de MTTA geral, por técnico ou empresa.
*   **Horas Faturáveis vs Não Faturáveis:** O gráfico atual de "Horas Lançadas" soma tudo. A tabela `time_entries` possui o campo `billable`, permitindo um gráfico de barras empilhadas separando o tempo faturável do não-faturável.
*   **Desempenho e Deflexão de Knowledge Base (KB):** Usando `knowledge_base_articles` e `ticket_kb_links`, pode-se criar métricas de "Artigos que mais resolveram chamados".
*   **Atuação das Automações:** A tabela `automation_logs` permite visualizar a "Porcentagem de chamados roteados ou resolvidos sem intervenção humana".
*   **Gargalos de Status (Tempo em cada fase):** A tabela `ticket_status_history` grava a transição de status. Pode-se extrair quanto tempo o chamado costuma ficar pendente com o cliente versus em análise interna.
*   **Saúde do Parque de Máquinas (Inventário):** Tabelas como `machine_hardware` e `machines` permitem exibir relatórios como "Sistemas Operacionais mais defasados" ou "Dispositivos sem antivírus", e `package_deployments` permite ver a taxa de sucesso das instalações de software.

### B. Exigem Novo Endpoint, Query ou Refatoração no Backend (Go)
Estes relatórios processariam um volume de dados muito alto ou requerem complexas agregações que travariam o frontend se puxados brutos pelo Supabase:

*   **Séries Temporais de Consumo de Máquinas (RMM Metrics):** O agente coleta CPU, Memória e Disco na tabela `machine_metrics`. Para exibir gráficos históricos detalhados, seria necessário criar um endpoint no Go que faça *downsampling* (ex: médias por hora/dia) direto no SQL, evitando trafegar milhões de linhas.
*   **Relatórios de Lucratividade / Contratos:** Os tickets possuem `contract_id` e `service_id`. Para visualizar o saldo de horas de um contrato vs. o apontado, precisaria de uma view no Postgres ou um endpoint no Go combinando dados de `time_entries`, `contracts` e `services`.
*   **Auditoria e Conformidade (Security Reports):** A tabela `audit_log` captura acessos e mudanças. Relatórios como "Histórico de Acessos Críticos" ou relatórios para compliance geram muito peso e requerem processamento assíncrono no backend (ex: geração direta de CSV via Go).
