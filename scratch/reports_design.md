# Proposta de Novos Gráficos (Orion System)

Com base na auditoria dos relatórios (`reports_audit.md`), propomos os seguintes novos gráficos e melhorias nas visualizações atuais. A proposta foi desenhada respeitando rigorosamente as diretrizes de componentes visuais estipuladas.

## 1. Resumo Executivo (Visão Principal)

### 1.1 Cumprimento Geral de SLA
* **Título:** Cumprimento de SLA (Taxa de Sucesso)
* **Pergunta de Negócio:** Qual a porcentagem de chamados resolvidos dentro do prazo estabelecido pela meta global?
* **Justificativa do Gráfico:** **Gauge Chart**. (Regra: KPI com meta/threshold). É a visualização mais imediata para demonstrar se o indicador atual de SLA bateu a meta configurada (ex: > 90%).
* **Fonte de Dados:** `tickets` (já existente).

### 1.2 MTTR e MTTA vs Metas Contratuais (Por Prioridade)
* **Título:** Tempo Médio de Resolução e Primeira Resposta vs Metas
* **Pergunta de Negócio:** Nossos tempos médios de resposta (MTTA) e de resolução (MTTR) estão de acordo com o exigido em contrato para cada prioridade?
* **Justificativa do Gráfico:** **Grid de Bullet Charts**. (Regra: KPI com meta/threshold). Permite que o valor numérico visível de MTTR e MTTA de cada prioridade seja comparado lado a lado com sua respectiva "linha de corte" (meta de SLA daquela prioridade).
* **Fonte de Dados:** `tickets`, `sla_configs` (aproveitando `first_response_at` não visualizado atualmente).

### 1.3 Evolução do Volume e Status de SLA no Tempo
* **Título:** Tendência do Volume de Chamados e Quebras de SLA
* **Pergunta de Negócio:** O volume de chamados está subindo? Como está se comportando a quebra de SLAs ao longo das semanas?
* **Justificativa do Gráfico:** **Area Chart**. (Regra: Tendência temporal). Utilizando até 3 séries empilhadas ("No Prazo", "Atenção", "Estourado"), fica dentro do limite de 6 séries e demonstra não só o volume total, mas o comportamento temporal dos SLAs.
* **Fonte de Dados:** `tickets` (SLA ao Longo do Tempo adaptado para visão principal).

---

## 2. Visão Detalhada

### 2.1 Comparativo de Performance: Reabertura e CSAT por Técnico
* **Título:** Comparativo de Reaberturas e Satisfação (CSAT) por Técnico
* **Pergunta de Negócio:** Quais técnicos geram maior qualidade e resolutividade no primeiro contato?
* **Justificativa do Gráfico:** **Grouped Bar Chart**. (Regra: Comparação técnicos/empresas). Permite comparar facilmente dois indicadores (Taxa de Reabertura e Nota CSAT) agrupados sob cada técnico.
* **Fonte de Dados:** `tickets`, `ticket_ratings` (já existente).

### 2.2 Análise de Produtividade: Horas por Empresa (Faturável vs Não Faturável)
* **Título:** Horas Lançadas por Empresa e Faturamento
* **Pergunta de Negócio:** Como está o equilíbrio do esforço (horas faturáveis e não faturáveis) direcionado a cada empresa cliente?
* **Justificativa do Gráfico:** **Grouped Bar Chart**. (Regra: Comparação técnicos/empresas). Compara lado a lado o volume de horas produtivas versus não-faturáveis agrupado por cliente.
* **Fonte de Dados:** `time_entries` (usando o campo `billable` recém-descoberto na auditoria).

### 2.3 Volume e Esforço por Categoria
* **Título:** Distribuição de Volume e MTTR por Categoria
* **Pergunta de Negócio:** Quais categorias concentram o maior volume de trabalho e quais são mais demoradas para serem resolvidas?
* **Justificativa do Gráfico:** **Bar Chart Horizontal**. (Regra: Distribuição por categoria para 5+ categorias). Como existem diversas categorias (muitas vezes com nomes longos), barras horizontais acomodam perfeitamente a leitura no eixo vertical.
* **Fonte de Dados:** `tickets` (já existente).

### 2.4 Distribuição de Volume por Prioridade
* **Título:** Volume de Chamados por Nível de Prioridade
* **Pergunta de Negócio:** A maior parte dos chamados é crítica ou de rotina?
* **Justificativa do Gráfico:** **Bar Chart Horizontal**. (Regra: Distribuição por categoria/prioridade). Similar à visão de categorias, exibe barras horizontais claras por nível de prioridade (Baixa, Média, Alta, Crítica, etc.).
* **Fonte de Dados:** `tickets` (já existente).

### 2.5 Efetividade de Automação e Base de Conhecimento (KB)
* **Título:** Adoção de Automações e KB ao Longo do Tempo
* **Pergunta de Negócio:** As automações e a base de conhecimento estão conseguindo desviar cada vez mais chamados da intervenção humana?
* **Justificativa do Gráfico:** **Line Chart**. (Regra: Tendência temporal). Com 2 linhas de série temporal ("Resolvidos por KB", "Roteados/Resolvidos via Automação"), permite analisar a evolução e aceitação das ferramentas de autoatendimento.
* **Fonte de Dados:** `knowledge_base_articles`, `automation_logs`, `ticket_kb_links` (descoberto na categoria "Prontos para Uso Imediato").
