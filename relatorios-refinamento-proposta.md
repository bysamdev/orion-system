# Proposta de Refinamento de Relatórios (Orion System)

Este documento consolida a auditoria, design de dados e revisão visual conduzida pelos subagentes autônomos.

---

## 1. Inventário: Dados e Gráficos Atuais (Subagente 1)

### Visão Geral / Resumido
*   **KPIs Principais (Cards):** Total de Chamados, Abertos/Ativos, Resolvidos/Fechados, Tempo Médio de Resolução (MTTR), Chamados com SLA Estourado. (Fonte: `tickets`)
*   **Cumprimento de SLA (Gauge Chart):** Porcentagem de chamados resolvidos dentro do prazo em relação a uma meta percentual. (Fonte: `tickets`)
*   **Tempo de Resolução vs. Meta Contratual (Bullet Chart):** Compara o MTTR por prioridade com as metas configuradas. (Fontes: `tickets`, `sla_configs`)
*   **Ativos Críticos (Cards):** Visão executiva de servidores offline ou em alerta. (Fonte: `assets`)
*   **Evolução do Volume (Line Chart):** Série temporal do volume de chamados por período. (Fonte: `tickets`)
*   **Chamados por Categoria (Bar Chart Horizontal):** Distribuição do volume por categoria. (Fonte: `tickets`)

### Visão Detalhada (Existente)
*   **Comparativo de Técnicos (Chart Customizado):** Performance cruzando MTTR, reabertura e nota CSAT.
*   **Tempo Médio por Categoria (Bar Chart):** MTTR isolado por categoria.
*   **Taxa de Reabertura por Técnico (Bar Chart):** Porcentagem de reabertura por técnico.
*   **SLA ao Longo do Tempo (Area Chart):** Tendência de SLA (No Prazo vs Atenção vs Estourado) ao longo do tempo.
*   **Volume por Empresa & Distribuição por Prioridade (Bar Charts).**
*   **Horas Lançadas por Técnico (Bar Chart).**

---

## 2. Oportunidades: Dados Prontos vs. Novos Endpoints

### 🟢 Prontos para Uso Imediato (Via Supabase Frontend)
- **Tempo Médio de Primeira Resposta (MTTA):** Já capturado em `first_response_at`.
- **Horas Faturáveis vs Não Faturáveis:** A tabela `time_entries` possui a flag `billable`.
- **Efetividade da Base de Conhecimento (KB) e Automações:** Relacionamentos entre `knowledge_base_articles`, `automation_logs` e `ticket_kb_links` já existem no modelo.

### 🔴 Exigem Novo Endpoint no Backend Go (NÃO IMPLEMENTAR AGORA)
> [!WARNING]
> Os seguintes relatórios foram mapeados, mas **requerem desenvolvimento de endpoints no backend Go** para processamento assíncrono ou agregação via SQL no Postgres. Não serão implementados nesta etapa de frontend:
- **Séries Temporais de Consumo de RMM:** Histórico de CPU/Memória/Disco (Tabela `machine_metrics`). Puxar via front geraria gargalo (milhões de linhas); requer downsampling no backend.
- **Relatórios de Lucratividade / Contratos:** Exige views e cruzamentos complexos de saldo de horas (`time_entries` vs `contracts`).
- **Auditoria e Conformidade (Security Reports):** Relatórios de compliance e logs exigem exportações pesadas via Go.

---

## 3. Lista Final de Gráficos Propostos (Novos + Ajustados)

Baseado no mapeamento acima, as seguintes visualizações são propostas (Regras de UI: KPI = Gauge/Bullet, Trend <=6 séries, Grouped Bar para comparação, Horizontal Bar para 5+ cats).

### Resumo Executivo (Visão Principal / Painel Superior)
1. **[Mantido/Ajustado] Cumprimento de SLA (Taxa de Sucesso)** 
   * **Tipo:** Gauge Chart. 
   * **Propósito:** Mostrar rapidamente se a operação bateu a meta global.
2. **[Novo] Tempo Médio de Resolução (MTTR) e Primeira Resposta (MTTA) vs Metas**
   * **Tipo:** Grid de Bullet Charts (Lado a lado).
   * **Propósito:** Compara o tempo efetivo de cada prioridade com sua respectiva meta contratual (linha de corte).
3. **[Ajustado] Tendência do Volume e Quebras de SLA no Tempo**
   * **Tipo:** Area Chart (Máx. 3 séries empilhadas: No Prazo, Atenção, Estourado).
   * **Propósito:** Demonstrar se o volume está subindo e como isso impacta o SLA ao longo das semanas.

### Visão Detalhada (Investigação Profunda)
1. **[Novo] Comparativo de Reaberturas e Satisfação (CSAT) por Técnico**
   * **Tipo:** Grouped Bar Chart.
   * **Propósito:** Comparar a qualidade do atendimento e resolutividade no primeiro contato agrupado por analista.
2. **[Novo] Horas Lançadas por Empresa (Faturável vs Não Faturável)**
   * **Tipo:** Grouped Bar Chart.
   * **Propósito:** Demonstrar o equilíbrio de esforço produtivo agrupado por cliente.
3. **[Ajustado] Distribuição de Volume e MTTR por Categoria**
   * **Tipo:** Bar Chart Horizontal.
   * **Propósito:** Barras horizontais acomodam melhor nomes de categorias longos, melhorando a leitura vertical.
4. **[Ajustado] Volume de Chamados por Nível de Prioridade**
   * **Tipo:** Bar Chart Horizontal.
   * **Propósito:** Visualizar onde está o peso da fila atual (Crítica, Alta, Média, Baixa).
5. **[Novo] Adoção de Automações e KB ao Longo do Tempo**
   * **Tipo:** Line Chart (2 séries).
   * **Propósito:** Analisar se o autoatendimento está desviando a carga da intervenção humana.

---

## 4. Hierarquia Visual, Layout e Acessibilidade (Revisão UX)

### Organização e Regra dos 5 Segundos
* **Primeira Dobra (O que está pegando fogo agora?):** O *Gauge Chart (SLA)* e os *Bullet Charts (MTTR/MTTA)* devem dominar a porção superior. O *Area Chart (Volume/SLA)* fechará a primeira vista.

### Agrupamento (Mitigação de Poluição Visual)
Para evitar uma "parede de gráficos" ininteligível, a Visão Detalhada será dividida obrigatoriamente em **Abas (Tabs)** na própria página:
1. **Aba: Análise de Chamados** (Foco no Serviço: Volume por Categorias e Prioridades).
2. **Aba: Performance da Equipe** (Foco no Recurso: KPIs de Técnicos, CSAT e Horas Faturáveis).
3. **Aba: Plataforma e Autoatendimento** (Foco na Automação: Rastreamento do uso de KB e roteamentos).

### Acessibilidade (a11y)
* **Valores Visíveis (Data Labels):** Todos os *Grouped Bar Charts* e *Area Charts* terão legendas numéricas explícitas no topo das colunas. A informação não deve depender do mouse (hover) para ser descoberta.
* **Dependência de Cor:** O Gráfico de SLA e os Bullet Charts não usarão apenas vermelho/amarelo/verde. Ícones e hachuras devem ser empregados (ex: `(!)` ou `(✓)`) nos tooltips e labels, garantindo a compreensão por daltônicos. (Contraste 4.5:1 exigido).
