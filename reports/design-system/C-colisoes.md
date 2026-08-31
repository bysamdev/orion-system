# Relatório C — Matriz de Colisão e Consistência Semântica
**Auditoria de Cores de Estado e Design Tokens — Orion System**  
**Data:** 31 de Agosto de 2026  
**Auditor:** Subagente C (Matriz de Colisão, Consistência Semântica e Labels)  
**Status:** FASE 1 — Diagnóstico Completo (Strictly Read-Only no Código)

---

## 1. Sumário Executivo

Esta auditoria realizou o cruzamento multidimensional de todas as cores de estado, tokens visuais, componentes de badges, gráficos do Recharts e rótulos textuais (*labels*) da interface do **Orion System**.

O objetivo central foi mapear **colisões semânticas** (quando a mesma cor carrega significados contraditórios ou conflitantes no mesmo contexto) e **inconsistências de nomenclatura** (quando o mesmo estado recebe nomes divergentes em diferentes telas ou quando valores crus em inglês são expostos ao usuário final).

### Principais Descobertas:
1. **Colisão Crítica de Âmbar/Amarelo:** A cor âmbar/amarela é sobrecarregada com **12 significados distintos** no sistema. O mais prejudicial é a sobreposição de **Status "Em Atendimento"** (operação saudável), **Prioridade "Média"** (gravidade normal) e **SLA "Atenção/Crítico"** (risco operacional). Na mesma tabela, um chamado pode exibir 3 badges amarelos idênticos lado a lado, gerando cegueira a alertas (*alert fatigue*).
2. **Inversão 180° de Cores entre Gráficos Recharts e Tabelas:** Em `Reports.tsx` e `TechnicianDashboard.tsx`, as fatias dos gráficos de pizza/donut invertem diretamente as cores dos badges da tabela na mesma tela. Por exemplo, em `Reports.tsx`, a fatia de "Em Atendimento" é Roxa e "Aguardando Cliente" é Amarela, enquanto na tabela logo abaixo, o badge de "Em Atendimento" é Amarelo e o de "Aguardando Cliente" é Roxo.
3. **Conflito do Roxo da Marca (Brand/Primary):** O roxo principal (`--primary`), que representa a identidade do Orion e os botões de ação primária (CTA), é reaproveitado como cor de status passivo bloqueado ("Aguardando Cliente"), cor de fatia de "Em Atendimento" em gráficos e cor de métricas de CPU/RAM em monitoramento de hardware, enfraquecendo a hierarquia de ação da interface.
4. **Dispersão e Ambiguidade de Labels:** Foram identificadas múltiplas variações para o mesmo conceito, tais como `"Em Atendimento"` vs `"Em andamento"`, `"Aguard. Cliente"` vs `"Aguardando Cliente"` vs `"Aguardando Resposta"`, `"Concluído"` vs `"Fechado"`, e `"Colaborador"` vs `"Cliente"`.
5. **Vazamento de Strings Cruas em Inglês:** Telas críticas como `Assets.tsx` e `WebMonitoring.tsx` renderizam strings brutas do banco de dados (`"urgent"`, `"high"`, `"medium"`, `"low"`, `"ONLINE"`, `"OFFLINE"`, `"WARNING"`) diretamente para o usuário final sem tradução ou formatação semântica.

---

## 2. Tabela Invertida de Cores (Color-to-Meaning Matrix)

A matriz a seguir mapeia cada família cromática utilizada na UI do Orion, enumerando todos os estados e entidades que ela representa, com as respectivas evidências de código e o mapeamento de colisões no mesmo contexto visual.

```
+----------------------------------------------------------------------------------------------------+
| MATRIZ INVERTIDA DE CORES DA INTERFACE DO ORION SYSTEM                                             |
+--------------------+-------------------------------------------+-----------------------------------+
| Família Cromática  | Entidades e Significados Representados    | Colisões no Mesmo Contexto Visual |
+--------------------+-------------------------------------------+-----------------------------------+
| ÂMBAR / AMARELO    | 1. Status: Em Atendimento (in-progress)   | ⚠️ CRÍTICA: Tabela de chamados     |
| (warning, #eab308, | 2. Prioridade: Média (medium)             | exibe Prioridade Média (âmbar)    |
| yellow-500,        | 3. SLA: Atenção (<= 25% tempo restante)   | + Status Em Atendimento (âmbar)   |
| amber-500)         | 4. SLA: Crítico (< 10% tempo restante)    | + SLA Atenção (âmbar com pulso)   |
|                    | 5. Máquinas: Alerta de Telemetria         | na mesma linha de visualização!   |
|                    | 6. Gráficos: Aguardando Cliente (Reports) |                                   |
|                    | 7. Gráficos: Chamados Abertos (Dashboard) | ⚠️ Inversão total Gráfico x Tabela|
|                    | 8. Hardware: Uso de Disco (%)             |                                   |
|                    | 9. Relatórios: MTTR (Tempo Médio)         |                                   |
|                    | 10. Relatórios: CSAT / Satisfação         |                                   |
|                    | 11. Botão: Hover de Escalação de Chamado  |                                   |
|                    | 12. Rede: Dispositivo Roteador            |                                   |
+--------------------+-------------------------------------------+-----------------------------------+
| ROXO / ÍNDIGO      | 1. Marca: Cor Institucional Orion System  | ⚠️ ALTA: Botão de Ação Primária   |
| (primary, brand-*, | 2. CTA: Botões Primários (variant=default)| (CTA de salvar/atender) compete   |
| purple-500,        | 3. Status: Aguardando Cliente (Badge)     | visualmente com badge de estado   |
| indigo-500,        | 4. Status: Aguardando Terceiro (Badge)    | bloqueado (Aguardando Cliente).   |
| #906090, #483078)  | 5. Gráficos: Em Atendimento (Dashboard)   |                                   |
|                    | 6. Gráficos: Em Atendimento (Reports)     | ⚠️ Roxo é "Em Atendimento" no     |
|                    | 7. Hardware: Uso de CPU e RAM (%)         | gráfico e "Aguard. Cliente" na tab|
|                    | 8. Automação: Badges de Ação / Regras     |                                   |
|                    | 9. Stepper: Passo Ativo do Fluxo          |                                   |
|                    | 10. Relatórios: Volume e Satisfação       |                                   |
+--------------------+-------------------------------------------+-----------------------------------+
| VERDE / ESMERALDA  | 1. Status: Resolvido (resolved)           | ⚠️ MÉDIA: Em aggregations.ts,    |
| (success, #22c55e, | 2. SLA: No Prazo (ok)                     | prioridade "Baixa" é verde,       |
| emerald-500,       | 3. Máquinas/Web: Status Online / Ativo    | confundindo chamado aberto        |
| green-500)         | 4. Prioridade: Baixa (em aggregations.ts) | com chamado resolvido / no prazo. |
|                    | 5. Financeiro: Horas Faturáveis           |                                   |
|                    | 6. Empresas: Contrato Ativo               |                                   |
|                    | 7. Checklist: Item Concluído              |                                   |
+--------------------+-------------------------------------------+-----------------------------------+
| VERMELHO / ROSE    | 1. Prioridade: Urgente (urgent)           | ⚠️ ALTA: Vermelho destrutivo      |
| (destructive,      | 2. Prioridade: Alta (Assets.tsx fallback) | é usado para chamado cancelado    |
| #ef4444, rose-500, | 3. Status: Cancelado (cancelled)          | (descarte neutro), SLA estourado  |
| red-500)           | 4. Gráficos: Reabertos (Dashboard)        | (emergência) e botão de timer     |
|                    | 5. SLA: Vencido / Estourado (breached)    | ativo (ação em andamento).        |
|                    | 6. Máquinas/Web: Offline / Inacessível    |                                   |
|                    | 7. Relatórios: Taxa de Reabertura (%)     |                                   |
|                    | 8. Botão: Parar Timer Ativo (Cronógrafo)  |                                   |
|                    | 9. Ações: Exclusão de Registro (Delete)   |                                   |
+--------------------+-------------------------------------------+-----------------------------------+
| AZUL / SKY / INFO  | 1. Status: Aberto (open)                  | ⚠️ MÉDIA: Azul representa "Aberto"|
| (info, blue-500,   | 2. SLA Config: Prioridade Média (Méd:)    | no StatusBadge, mas é usado para  |
| sky-500, #3b82f6)  | 3. Rede: Link Dedicado (WebMonitoring)    | prioridade "Média" na config de   |
|                    | 4. Ativos: Equipamento de Rede/Switch     | SLA em SLAConfiguration.tsx.      |
|                    | 5. Fallback: StatusBadge variant="info"   |                                   |
+--------------------+-------------------------------------------+-----------------------------------+
| LARANJA            | 1. Prioridade: Alta (high)                | ⚠️ ALTA: Laranja é "Alta" na lista|
| (orange-500,       | 2. Status: Reaberto (reopened)            | de chamados, mas é "Reaberto" no  |
| #f97316)           | 3. Gráficos: Aguardando Terceiro (Reports)| badge de status e "Aguard. Terc." |
|                    | 4. SLA: Nível Crítico (no JSDoc de SLA)   | no gráfico de relatórios.         |
+--------------------+-------------------------------------------+-----------------------------------+
| CINZA / SLATE      | 1. Status: Concluído (closed)             | Sem colisão crítica. Usado como   |
| (muted, slate-500, | 2. Prioridade: Baixa (low)                | estado neutro/inativo/base.       |
| border)            | 3. Gráficos: Cancelados / Não Atribuídos  |                                   |
|                    | 4. Máquinas: Desconectada / Inativa       |                                   |
|                    | 5. Relatórios: Horas Totais (neutro)      |                                   |
+--------------------+-------------------------------------------+-----------------------------------+
```

---

## 3. Comprovação com Evidências de Código das Colisões Suspeitas

### 3.1. Colisão 1: Âmbar em Prioridade "Média" vs Status "Em Atendimento" vs SLA "Atenção"

- **Status da Hipótese:** **CONFIRMADA E CRÍTICA**
- **Evidências de Código:**
  1. `src/components/shared/StatusBadge.tsx` (linhas 16-20):
     ```typescript
     'in-progress': {
       label: 'Em Atendimento',
       dotColor: 'bg-yellow-500',
       badgeClass: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400',
     }
     ```
  2. `src/components/shared/PriorityBadge.tsx` (linhas 20-23):
     ```typescript
     medium: {
       label: 'Média',
       className: 'bg-warning/10 text-warning border-warning/30',
     }
     ```
  3. `src/components/dashboard/SLABadge.tsx` (linhas 59-72):
     ```typescript
     warning: {
       label: 'Atenção',
       color: 'bg-warning/15 text-warning border-warning/30',
       dot: 'bg-warning'
     },
     attention: {
       label: 'Crítico',
       color: 'bg-warning/20 text-warning border-warning/40',
       dot: 'bg-warning'
     }
     ```
  4. `src/components/monitoring/MachineCard.tsx` (linhas 361-363):
     ```typescript
     alerting ? 'bg-warning/15 text-warning border border-warning/30' : ...
     ```
  5. `src/components/dashboard/TechnicianDashboard.tsx` (linhas 142-151) e `src/pages/Reports.tsx` (linhas 1154-1163):
     ```tsx
     <PriorityBadge priority={ticket.priority} size="sm" />
     <StatusBadge status={ticket.status} />
     <SLABadge slaStatus={ticket.sla_status} slaDueDate={ticket.sla_due_date} ... />
     ```

#### Análise de Impacto Cognitivo e de Negócio:
* **Falso Alerta Operacional:** "Em Atendimento" é o estado operacional **mais positivo e desejado** de um chamado aberto (significa que o analista de suporte já acolheu o incidente e está trabalhando ativamente na resolução). Ao pintá-lo de Amarelo/Âmbar (o sinal global de advertência e perigo iminente), a interface condiciona o cérebro do operador a interpretar trabalho produtivo como uma situação de alerta.
* **Cegueira a Alertas (Alert Blindness):** Em uma mesma linha de tabela (ex: no painel do técnico ou na auditoria de relatórios), um chamado com prioridade regular (`Média` = Âmbar), em trabalho normal (`Em Atendimento` = Âmbar) e com prazo aproximando-se do limite (`SLA Atenção` = Âmbar pulsante) apresenta **três badges amarelos simultâneos**. A perda de contraste semântico impede que o olho humano identifique instantaneamente qual dimensão exige atenção imediata.

---

### 3.2. Colisão 2: Roxo da Marca vs "Aguardando Cliente" vs Ações Primárias vs Fatias de Gráficos

- **Status da Hipótese:** **CONFIRMADA E GRAVE**
- **Evidências de Código:**
  1. **Token da Marca e Botões Primários:** `tailwind.config.ts` (linhas 26-38 e 45-47) e `src/index.css` (linhas 23 e 77) definem `--primary` como o roxo oficial (`260 43% 33%` no Light, `260 60% 56%` no Dark). Todos os botões primários `<Button variant="default">` (ex: "Salvar", "Criar Chamado", "Assumir Chamado") usam essa cor.
  2. **Badge de Status "Aguardando Cliente":** `src/components/shared/StatusBadge.tsx` (linhas 21-25) define:
     ```typescript
     'awaiting-customer': {
       label: 'Aguard. Cliente',
       dotColor: 'bg-purple-500',
       badgeClass: 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400',
     }
     ```
     E em `src/components/ticket/TicketHeroHeader.tsx` (linha 264):
     ```tsx
     className={cn("gap-2", ticket.status === 'awaiting-customer' && "bg-purple-500/10 text-purple-600 border-purple-200")}
     ```
  3. **Gráficos Recharts usando Roxo para "Em Atendimento":**
     - Em `src/hooks/useTechnicianStats.ts` (linha 137):
       `{ name: 'Em Atendimento', value: statusCount['in-progress'], color: 'hsl(var(--primary))' }`
     - Em `src/pages/Reports.tsx` (linha 117):
       `'in-progress': '#906090'` *(Roxo claro da marca Orion)*
  4. **Hardware e Telemetria usando Roxo:**
     - Em `src/components/monitoring/PerformanceChart.tsx` (linhas 28-29, 300, 313): CPU usa `#906090` (Roxo Orion) e RAM usa `#7c529e` (Roxo/Índigo).

#### Análise de Impacto Cognitivo:
* **Erosão da Força do CTA:** A cor primária de um Design System deve guiar o olhar para ações assertivas e conversões do fluxo de trabalho. Quando a mesma tonalidade roxa é usada para indicar que um chamado está **paralisado e passivo** aguardando resposta do cliente, o usuário perde a clareza de onde estão os elementos interativos primários.
* **Sobrecarga de Papéis:** Roxo representa simultaneamente: (1) Identidade da Empresa, (2) Botão de Salvar/Confirmar, (3) Chamado Pausado/Bloqueado no cliente, (4) Chamado Ativo no Gráfico Donut, e (5) Carga de Processador CPU no Gráfico de Linha.

---

### 3.3. Colisão 3: Fatias de Recharts em Desacordo Total com Badges da Tabela

- **Status da Hipótese:** **CONFIRMADA E CRÍTICA (Inversão Diametral)**
- **Evidências de Código:**

#### Comparativo de Cores: Mesma Entidade em Diferentes Componentes

| Status do Chamado | `StatusBadge.tsx` (Tabelas e Detalhes) | `Reports.tsx` (Donut Chart) | `useTechnicianStats.ts` (Dashboard Donut) |
| :--- | :--- | :--- | :--- |
| **`open`** | 🔵 Azul (`bg-blue-500`) | 🔵 Azul (`#3b82f6`) | 🟡 **Amarelo** (`hsl(var(--warning))`) |
| **`in-progress`** | 🟡 **Amarelo** (`bg-yellow-500`) | 🟣 **Roxo** (`#906090`) | 🟣 **Roxo** (`hsl(var(--primary))`) |
| **`awaiting-customer`** | 🟣 **Roxo** (`bg-purple-500`) | 🟡 **Amarelo** (`#eab308`) | 🟣 Roxo Claro (`#906090`) |
| **`awaiting-third-party`**| 🔵 Índigo (`bg-indigo-500`) | 🟠 **Laranja** (`#f97316`) | 🟣 Roxo Escuro (`#604878`) |
| **`resolved`** | 🟢 Verde (`bg-green-500`) | 🟢 Verde (`#22c55e`) | *(Omitido)* |
| **`closed`** | ⚪ Cinza (`bg-muted-foreground`)| ⚪ Slate (`#64748b`) | *(Omitido)* |
| **`reopened`** | 🟠 **Laranja** (`bg-orange-500`) | 🌸 **Rosa** (`#ec4899`) | 🔴 **Vermelho** (`hsl(var(--destructive))`) |
| **`cancelled`** | 🔴 **Vermelho** (`bg-destructive`) | ⚪ **Cinza/Slate** (`#94a3b8`) | *(Omitido)* |

#### Evidência na Mesma Página (`src/pages/Reports.tsx`):
- **Topo da Página (Linhas 578-585):** O Donut Chart "Distribuição por Status" renderiza a fatia `in-progress` em **Roxo** (`#906090`) e `awaiting-customer` em **Amarelo** (`#eab308`).
- **Base da Página (Linha 1155):** A tabela de listagem de chamados renderiza `<StatusBadge status={ticket.status} />`, onde `in-progress` é exibido em **Amarelo** (`bg-yellow-500`) e `awaiting-customer` é exibido em **Roxo** (`bg-purple-500`).
- **Impacto:** O analista que visualiza uma fatia amarela de 30% no gráfico e desce para a tabela esperando encontrar os chamados amarelos descobre que a tabela classifica esses mesmos chamados com o badge roxo.

---

### 3.4. Colisão 4: Prioridade em `SLAConfiguration.tsx` e `aggregations.ts` vs `PriorityBadge.tsx`

- **Status da Hipótese:** **CONFIRMADA**
- **Evidências de Código:**
  1. Em `src/components/shared/PriorityBadge.tsx` (linhas 11-28):
     - `urgent` = Vermelho (`destructive`)
     - `high` = Laranja (`orange-500`)
     - `medium` = Âmbar (`warning`)
     - `low` = Cinza (`muted`)
  2. Em `src/components/admin/SLAConfiguration.tsx` (linhas 205 e 247):
     - Prioridade **Média** é configurada com classe `text-blue-500` no formulário e renderizada com Badge **Azul** (`border-blue-500/30 text-blue-700 bg-blue-500/10`), colidindo com o azul de chamados abertos.
  3. Em `src/lib/reports/aggregations.ts` (linhas 212-217):
     ```typescript
     const COR_PRIORIDADE: Record<PriorityKey, string> = {
       urgent: '#ef4444', // Vermelho
       high: '#f97316',   // Laranja
       medium: '#eab308', // Amarelo
       low: '#22c55e',    // VERDE!
     };
     ```
     A prioridade **Baixa** recebe a cor **Verde** (`#22c55e`), a mesma cor semântica de "Resolvido", "SLA No Prazo" e "Máquina Online".

---

## 4. Verificação de Consistência de Labels e Textos

### 4.1. Divergências de Nomenclatura para o Mesmo Estado

```
+--------------------------------------------------------------------------------------------------------------------------------+
| INVENTÁRIO DE DIVERGÊNCIAS DE LABELS NO ORION SYSTEM                                                                           |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| Chave / Entidade     | Variações Encontradas    | Arquivos e Linhas de Ocorrência                                              |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| in-progress          | "Em Atendimento"         | StatusBadge.tsx:17, TechnicianDashboard.tsx:389, TicketDetails.tsx:474,996  |
|                      | "Em andamento"           | exportXlsx.ts:71, ClientPortal.tsx:166, validation.ts:8                      |
|                      | "Em Atendimento Ativo"   | TechnicianDashboard.tsx:390                                                  |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| awaiting-customer    | "Aguard. Cliente"        | StatusBadge.tsx:22, useTechnicianStats.ts:139                                |
|                      | "Aguardando Cliente"     | TechnicianDashboard.tsx:588, TicketDetails.tsx:474,997, aggregations.ts:512  |
|                      | "Aguardando Resposta"    | UnifiedTimeline.tsx:38                                                       |
|                      | "Aguardar Cliente"       | TicketHeroHeader.tsx:268                                                     |
|                      | "Aguardando cliente"     | exportXlsx.ts:72, validation.ts:8                                            |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| awaiting-third-party | "Aguard. Terceiro"       | StatusBadge.tsx:27, useTechnicianStats.ts:140                                |
|                      | "Aguardando Terceiro"    | TechnicianDashboard.tsx:589, TicketDetails.tsx:475,998, aggregations.ts:513  |
|                      | "Aguardando terceiro"    | exportXlsx.ts:73, validation.ts:8                                            |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| closed               | "Concluído"              | StatusBadge.tsx:37, TechnicianDashboard.tsx:590, TicketDetails.tsx:475,1000  |
|                      | "Fechado"                | exportXlsx.ts:75, validation.ts:8                                            |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| open                 | "Aberto"                 | StatusBadge.tsx:12, TicketDetails.tsx:474,995, exportXlsx.ts:70              |
|                      | "Abertos" (plural)       | useTechnicianStats.ts:136, aggregations.ts:511                               |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| reopened             | "Reaberto"               | StatusBadge.tsx:42, TicketDetails.tsx:476,1001, exportXlsx.ts:76             |
|                      | "Reabertos" (plural)     | useTechnicianStats.ts:138                                                    |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| SLA: warning         | "Atenção"                | SLABadge.tsx:61, ticket-helpers.ts:87                                        |
|                      | "Alerta"                 | exportXlsx.ts:89                                                             |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| SLA: attention       | "Crítico"                | SLABadge.tsx:68, ticket-helpers.ts:86                                        |
|                      | "Atenção"                | Reports.tsx:702, exportXlsx.ts:90                                            |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| SLA: breached        | "Vencido"                | SLABadge.tsx:75, ticket-helpers.ts:85                                        |
|                      | "Estourado"              | Reports.tsx:703, exportXlsx.ts:91                                            |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| Role: customer       | "Cliente"                | Sidebar.tsx:106                                                              |
|                      | "Colaborador"            | UserManagement.tsx:461, 943                                                  |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| Role: admin          | "Admin"                  | Sidebar.tsx:108                                                              |
|                      | "Gestor"                 | UserManagement.tsx:463, 945                                                  |
+----------------------+--------------------------+------------------------------------------------------------------------------+
| Prioridades          | "Urgente / Alta / ..."   | PriorityBadge.tsx:13-25, SLAConfiguration.tsx:197-209                        |
|                      | "Urg: / Alta: / Méd: ..."| SLAConfiguration.tsx:245-248                                                 |
+----------------------+--------------------------+------------------------------------------------------------------------------+
```

---

### 4.2. Exposição de Valores Crus em Inglês para o Usuário Final

Foram detectados pontos no código onde strings brutas do backend ou banco de dados são renderizadas sem tradução:

1. **`src/pages/Assets.tsx` (linhas 1093-1104):**
   No modal de histórico de chamados do dispositivo:
   ```tsx
   {ticket.priority && (
     <Badge
       variant={
         ticket.priority === "critica" || ticket.priority === "urgent" || ticket.priority === "alta"
           ? "destructive"
           : "secondary"
       }
       className="text-micro font-bold uppercase tracking-wider px-2 py-0.5"
     >
       {ticket.priority}
     </Badge>
   )}
   ```
   **Problema:** O badge renderiza diretamente `{ticket.priority}`, exibindo `"URGENT"`, `"HIGH"`, `"MEDIUM"` e `"LOW"` em inglês para o usuário em ambiente PT-BR.
2. **`src/pages/WebMonitoring.tsx` (linhas 53-56 e 759):**
   Na lista de endpoints e links monitorados:
   ```typescript
   function statusLabel(status: string) {
     if (status === 'pending') return 'PENDENTE';
     return status.toUpperCase();
   }
   ```
   ```tsx
   <Badge ...>{statusLabel(endpoint.status)}</Badge>
   ```
   **Problema:** Endpoints com status `"online"`, `"offline"` ou `"warning"` exibem `"ONLINE"`, `"OFFLINE"`, `"WARNING"`, misturando inglês com o restante da interface totalmente em português.
3. **`src/components/shared/StatusBadge.tsx` (linha 55):**
   ```typescript
   const config = statusConfig[normalizedStatus] || { label: status, dotColor: 'bg-muted-foreground', badgeClass: '' };
   ```
   **Problema:** Se o backend retornar um status não mapeado ou fora do padrão (ex: `"in_progress"` com underscore em vez de hífen), o badge exibe `"in_progress"` cru na interface.
4. **`src/components/ui/status-badge.tsx` (linha 73):**
   Componente genérico renderiza `{children}` sem qualquer camada de dicionário ou internacionalização.

---

## 5. Proposta da Matriz Harmonizada (Contrato Semântico Canônico)

Para solucionar de forma definitiva todas as colisões semânticas, sobreposições de cores e inconsistências de labels, propõe-se o seguinte **Contrato Semântico de Cores e Rótulos** estruturado na arquitetura de 3 camadas (*Primitive -> Semantic -> Component*).

### 5.1. Papéis Semânticos Canônicos (Cores)

```
+--------------------------------------------------------------------------------------------------------------------+
| CONTRATO SEMÂNTICO DE CORES HARMONIZADAS — ORION SYSTEM                                                           |
+--------------------+------------------------+------------------------------------+---------------------------------+
| Família Semântica  | Token CSS / Classe     | Uso Exclusivo Permitido            | PROIBIDO Usar Para              |
+--------------------+------------------------+------------------------------------+---------------------------------+
| PRIMARY (Marca)    | hsl(var(--primary))    | - Botões de Ação Primária (CTA)    | ❌ Badges de Status Passivo     |
|                    |                        | - Links em Destaque / Hover Ativo  | ❌ Status "Aguardando Cliente"  |
|                    |                        | - Indicadores de Seleção / Foco    | ❌ Métricas de Hardware         |
+--------------------+------------------------+------------------------------------+---------------------------------+
| INFO / AZUL        | hsl(var(--info))       | - Status: Aberto (open)            | ❌ Prioridade Média             |
|                    |                        | - Links de Rede / Conectividade    | ❌ Botão de Ação Primária       |
|                    |                        | - Mensagens Informativas Neutras   |                                 |
+--------------------+------------------------+------------------------------------+---------------------------------+
| EM ATENDIMENTO     | hsl(var(--accent-blue))| - Status: Em Atendimento           | ❌ Alertas ou Erros             |
| (Cyan / Teal)      | ou sky-500 / cyan-600  | - Operação Técnica em Curso Ativo  | ❌ SLA em Risco                 |
|                    |                        | - Timer de Atendimento em Execução |                                 |
+--------------------+------------------------+------------------------------------+---------------------------------+
| WARNING / ÂMBAR    | hsl(var(--warning))    | - SLA: Atenção (<= 25% restantes)  | ❌ Status "Em Atendimento"      |
|                    |                        | - Máquinas: Alerta de Telemetria   | ❌ Prioridade Média             |
|                    |                        | - Hardware: Carga Alta (> 80%)     | ❌ Ações Normais                |
+--------------------+------------------------+------------------------------------+---------------------------------+
| ESPERA EXTERNA     | amber-600 / orange-500 | - Status: Aguardando Cliente       | ❌ Identidade da Marca (Roxo)   |
| (Laranja Suave)    |                        | - Status: Aguardando Terceiro      | ❌ SLA Vencido                  |
+--------------------+------------------------+------------------------------------+---------------------------------+
| SUCCESS / VERDE    | hsl(var(--success))    | - Status: Resolvido / Concluído    | ❌ Prioridade Baixa             |
|                    |                        | - SLA: No Prazo (> 25% restantes)  |                                 |
|                    |                        | - Máquinas / Links: Online         |                                 |
|                    |                        | - Contratos: Ativo                 |                                 |
+--------------------+------------------------+------------------------------------+---------------------------------+
| DESTRUCTIVE / RED  | hsl(var(--destructive))| - SLA: Vencido / Estourado         | ❌ Status "Cancelado" (neutro)  |
|                    |                        | - Prioridade: Urgente              | ❌ Timer Ativo Rodando          |
|                    |                        | - Máquinas / Links: Offline        |                                 |
|                    |                        | - Ações Destrutivas (Delete)       |                                 |
+--------------------+------------------------+------------------------------------+---------------------------------+
| NEUTRAL / SLATE    | hsl(var(--muted))      | - Status: Cancelado (cancelado)    | ❌ Alertas ou Sucesso           |
|                    | hsl(var(--border))     | - Prioridade: Baixa (low)          |                                 |
|                    |                        | - Status: Fechado / Arquivado      |                                 |
+--------------------+------------------------+------------------------------------+---------------------------------+
```

---

### 5.2. Tabela Canônica de Labels e Chaves (Dicionário Oficial)

Todos os componentes, relatórios, exports em Excel/PDF e gráficos devem consumir exclusivamente este dicionário centralizado (a ser exportado em `@/lib/status-dictionary.ts` na Fase 2):

```typescript
// DICIONÁRIO CANÔNICO PROPOSTO PARA A FASE 2:
export const STATUS_CANONICO = {
  open: {
    chave: 'open',
    rotulo: 'Aberto',
    rotuloPlural: 'Abertos',
    corGrafico: '#3b82f6', // blue-500
    token: 'info',
  },
  'in-progress': {
    chave: 'in-progress',
    rotulo: 'Em Atendimento',
    rotuloPlural: 'Em Atendimento',
    corGrafico: '#0ea5e9', // sky-500 (desacoplado do warning e do primary)
    token: 'in-progress',
  },
  'awaiting-customer': {
    chave: 'awaiting-customer',
    rotulo: 'Aguardando Cliente',
    rotuloCurto: 'Aguard. Cliente',
    rotuloPlural: 'Aguardando Cliente',
    corGrafico: '#f59e0b', // amber-500
    token: 'awaiting-customer',
  },
  'awaiting-third-party': {
    chave: 'awaiting-third-party',
    rotulo: 'Aguardando Terceiro',
    rotuloCurto: 'Aguard. Terceiro',
    rotuloPlural: 'Aguardando Terceiro',
    corGrafico: '#ea580c', // orange-600
    token: 'awaiting-third-party',
  },
  resolved: {
    chave: 'resolved',
    rotulo: 'Resolvido',
    rotuloPlural: 'Resolvidos',
    corGrafico: '#22c55e', // green-500
    token: 'success',
  },
  closed: {
    chave: 'closed',
    rotulo: 'Concluído',
    rotuloPlural: 'Concluídos',
    corGrafico: '#64748b', // slate-500
    token: 'muted',
  },
  reopened: {
    chave: 'reopened',
    rotulo: 'Reaberto',
    rotuloPlural: 'Reabertos',
    corGrafico: '#ec4899', // pink-500
    token: 'reopened',
  },
  cancelled: {
    chave: 'cancelled',
    rotulo: 'Cancelado',
    rotuloPlural: 'Cancelados',
    corGrafico: '#94a3b8', // slate-400
    token: 'cancelled',
  },
} as const;

export const PRIORIDADE_CANONICA = {
  urgent: { chave: 'urgent', rotulo: 'Urgente', rotuloCurto: 'Urg', corGrafico: '#ef4444', token: 'destructive' },
  high:   { chave: 'high',   rotulo: 'Alta',    rotuloCurto: 'Alta', corGrafico: '#f97316', token: 'orange' },
  medium: { chave: 'medium', rotulo: 'Média',   rotuloCurto: 'Méd',  corGrafico: '#eab308', token: 'warning' },
  low:    { chave: 'low',    rotulo: 'Baixa',   rotuloCurto: 'Bxa',  corGrafico: '#64748b', token: 'muted' },
} as const;

export const SLA_STATUS_CANONICO = {
  ok:        { chave: 'ok',        rotulo: 'No Prazo',  corGrafico: '#22c55e', token: 'success' },
  warning:   { chave: 'warning',   rotulo: 'Atenção',   corGrafico: '#eab308', token: 'warning' },
  attention: { chave: 'attention', rotulo: 'Crítico',   corGrafico: '#f97316', token: 'orange' },
  breached:  { chave: 'breached',  rotulo: 'Vencido',   corGrafico: '#ef4444', token: 'destructive' },
} as const;

export const ROLES_CANONICOS = {
  customer:   { chave: 'customer',   rotulo: 'Cliente' },
  technician: { chave: 'technician', rotulo: 'Técnico' },
  admin:      { chave: 'admin',      rotulo: 'Gestor' },
  developer:  { chave: 'developer',  rotulo: 'Desenvolvedor' },
} as const;
```

---

## 6. Conclusão e Próximos Passos para a Fase 2

Este diagnóstico encerra a **Fase 1 (Auditoria e Mapeamento)** do Subagente C. Todas as colisões cromáticas, inversões de gráficos e inconsistências de rótulos foram isoladas e referenciadas com número de arquivo e linha.

### Recomendações Prioritárias para a Fase 2 (Execução):
1. **Criar a Fonte Única de Verdade:** Centralizar os dicionários em `src/lib/status-dictionary.ts` e exportar helpers tipados (`getStatusConfig`, `getPriorityConfig`, `getSlaConfig`, `getRoleLabel`).
2. **Desacoplar "Em Atendimento" do Âmbar:** Migrar o status "Em Atendimento" para uma tonalidade Cyan/Teal/Sky exclusiva, garantindo que o Âmbar fique restrito a alertas e SLAs em risco.
3. **Harmonizar Recharts com as Tabelas:** Fazer com que `STATUS_COLORS` em `Reports.tsx`, `useTechnicianStats.ts` e `exportPdf.ts` leiam diretamente do dicionário canônico unificado.
4. **Erradicar Exibição de Strings Cruas:** Substituir a renderização crua em `Assets.tsx:1102` e `WebMonitoring.tsx:759` pelos helpers canônicos de tradução.
