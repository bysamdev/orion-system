# Orion System - Ideação de Produto e Inovação (Brainstorming)

**Data:** 11 de Agosto de 2026
**Foco:** Triagem por IA, Relatórios de SLA, Auto-atendimento e Automações
**Objetivo:** Explorar oportunidades de evolução do produto com base na arquitetura e capacidades atuais do sistema.

---

## 1. Triagem por Inteligência Artificial (AI Triage)

Atualmente o Orion System conta com um motor de automação baseado em regras estáticas (IF-THEN). A introdução de IA na camada de triagem pode reduzir drasticamente o tempo de despacho (dispatch time) e o erro humano.

* **Categorização e Priorização Automática:** Utilizar um modelo de LLM (ex: integração via API) para interpretar a descrição livre inserida pelo cliente. A IA define automaticamente a Categoria, Subcategoria e a Prioridade do ticket baseando-se no contexto. Pode-se salvar o "nível de confiança" (confidence score) no campo `metadata` JSONB já existente.
* **Análise de Sentimento e Escalada VIP:** A IA avalia o tom do ticket. Se detectar frustração extrema ou uso de termos críticos ("urgente", "parado", "prejuízo"), o sistema eleva a prioridade proativamente e alerta o gestor da conta.
* **Skill-based Routing (Roteamento Inteligente):** Em vez de um simples round-robin, a IA analisa o histórico de resolução dos técnicos e atribui o chamado ao analista com a melhor performance histórica naquele tipo específico de problema.
* **Deduplicação e Detecção de Incidentes Massivos:** A IA monitora a fila de entrada em tempo real. Se vários usuários abrirem chamados com sintomas semelhantes ("sem internet" ou "sistema X fora do ar"), o sistema agrupa os tickets sob um "Incidente Maior", alertando a equipe de infraestrutura rapidamente.

## 2. Relatórios de SLA Mais Robustos

O sistema já possui SLAs básicos atrelados à prioridade, mas clientes corporativos exigem métricas de nível empresarial e transparência.

* **Previsão de Quebra de SLA (SLA Risk Prediction):** Um dashboard ou alerta visual que não exibe apenas os SLAs já violados, mas projeta tickets "Em Risco de Quebra" nas próximas horas, considerando a carga de trabalho atual da equipe.
* **Múltiplas Métricas (FRT, NRT, TTR):** Expandir os relatórios para rastrear o ciclo de vida completo:
  * *First Response Time (FRT):* Tempo até a primeira interação humana com o cliente.
  * *Next Response Time (NRT):* Tempo médio de resposta entre interações contínuas.
  * *Time to Resolution (TTR):* Tempo total até o fechamento.
* **SLA por Contrato/Empresa:** Cruzar os dados das tabelas `contracts` e `companies` para permitir configurações de SLA dinâmicas (ex: 2h para empresa Platinum, 8h para Standard) e gerar relatórios executivos de Compliance (QBRs).
* **SLA Calendar & Pause Tracking:** Relatórios que contabilizam o SLA apenas em horário comercial real e quantificam exatamente quanto tempo o ticket ficou retido aguardando aprovação ou feedback do cliente (status "Aguardando Cliente").

## 3. Evolução do Auto-atendimento (Self-Service)

Reduzir o volume de chamados de baixa complexidade (Ticket Deflection) é fundamental para escalar a operação.

* **Tier 0 Support com Chatbot (Base de Conhecimento):** Antes do usuário criar o ticket, um assistente virtual pesquisa na tabela `knowledge_base_articles` e sugere os tutoriais exatos baseados na dúvida descrita, promovendo o auto-reparo.
* **Catálogo de Serviços Aprovados:** Substituir o formulário genérico de abertura de chamados por um "e-commerce" de serviços de TI (ex: "Solicitar Licença de Software", "Liberação de VPN"). Isso padroniza os dados de entrada e direciona para os fluxos corretos.
* **Diagnóstico One-Click via Agent:** Aproveitar o binário local em Go no Windows. O menu do System Tray pode oferecer atalhos como "Testar minha internet" ou "Limpar disco". O Orion Agent roda um script de remediação local antes que o usuário sinta a necessidade de acionar o suporte humano.
* **Self-Healing Direto do Portal:** Clientes podem solicitar scripts via Portal, com o backend conectando o pedido diretamente à API de comandos remotos (RMM), resolvendo o problema no background.

## 4. Expansão das Automações

O motor atual processa gatilhos simples via triggers (BEFORE/AFTER INSERT). A meta é transformá-lo em um verdadeiro orquestrador.

* **Automações Baseadas em Tempo (Cron Rules):** Introduzir regras de avaliação temporal. Exemplo: "Se status for 'Aguardando Cliente' por > 48h, enviar email de lembrete"; "Se > 72h, fechar ticket automaticamente".
* **Automações Orientadas a RMM (Remediação de Alertas):** Interligar a tabela de alertas `machine_alerts` com o motor de execução remota de scripts. Se o agente alertar que o disco está com 95% de uso contínuo, a plataforma engatilha um comando PowerShell de limpeza e documenta a ação fechando um ticket automatizado.
* **Workflows Multi-etapa com Aprovação:** Evoluir o motor para suportar dependências lógicas. Exemplo: Solicitação de Acesso -> Envio de Email ao Gestor para Aprovação -> Ao Aprovar, dispara script de RMM para criação no Active Directory e encerra o ticket.
* **Integrações (Webhooks Outbound):** Permitir que automações acionem webhooks externos (ex: notificar no canal de P1s do Microsoft Teams, criar Issues no Jira para tickets categorizados como Bug).
