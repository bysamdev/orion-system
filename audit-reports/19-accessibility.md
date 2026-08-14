# Relatório de Auditoria: Acessibilidade (Subagente 19)

## Escopo
Auditoria a11y em componentes interativos, botões de ícone e formulários.

## Achados

### [Medium] Botão de ícone sem `aria-label` em `src/components/ThemeToggle.tsx`
- **Arquivo:Linha**: `src/components/ThemeToggle.tsx:21`
- **Trecho**: `<Button variant="ghost" size="icon" className="hover:bg-primary/10 opa`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

### [Medium] Botão de ícone sem `aria-label` em `src/components/admin/ResolutionChecklistManagement.tsx`
- **Arquivo:Linha**: `src/components/admin/ResolutionChecklistManagement.tsx:174`
- **Trecho**: `<Button type="button" variant="ghost" size="icon" className="h-9 w-9 t`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

### [Medium] Botão de ícone sem `aria-label` em `src/components/admin/ResolutionChecklistManagement.tsx`
- **Arquivo:Linha**: `src/components/admin/ResolutionChecklistManagement.tsx:266`
- **Trecho**: `<Button variant="ghost" size="icon" onClick={() => handleEdit(checklis`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

### [Medium] Botão de ícone sem `aria-label` em `src/components/admin/ResolutionChecklistManagement.tsx`
- **Arquivo:Linha**: `src/components/admin/ResolutionChecklistManagement.tsx:267`
- **Trecho**: `<Button variant="ghost" size="icon" onClick={() => { if(window.confirm`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

### [Medium] Botão de ícone sem `aria-label` em `src/components/admin/RoutingRulesManagement.tsx`
- **Arquivo:Linha**: `src/components/admin/RoutingRulesManagement.tsx:375`
- **Trecho**: `<Button variant="ghost" size="icon" onClick={() => handleEdit(rule)} c`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

### [Medium] Botão de ícone sem `aria-label` em `src/components/admin/RoutingRulesManagement.tsx`
- **Arquivo:Linha**: `src/components/admin/RoutingRulesManagement.tsx:376`
- **Trecho**: `<Button variant="ghost" size="icon" onClick={() => { if(window.confirm`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

### [Medium] Botão de ícone sem `aria-label` em `src/components/automation/RulesTab.tsx`
- **Arquivo:Linha**: `src/components/automation/RulesTab.tsx:152`
- **Trecho**: `<Button variant="ghost" size="icon" className="h-8 w-8 hover:text-prim`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

### [Medium] Botão de ícone sem `aria-label` em `src/components/automation/RulesTab.tsx`
- **Arquivo:Linha**: `src/components/automation/RulesTab.tsx:155`
- **Trecho**: `<Button variant="ghost" size="icon" className="h-8 w-8 hover:text-dest`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

### [Medium] Botão de ícone sem `aria-label` em `src/components/automation/TemplatesTab.tsx`
- **Arquivo:Linha**: `src/components/automation/TemplatesTab.tsx:130`
- **Trecho**: `<Button variant="ghost" size="icon" className="h-7 w-7 hover:text-prim`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

### [Medium] Botão de ícone sem `aria-label` em `src/components/automation/TemplatesTab.tsx`
- **Arquivo:Linha**: `src/components/automation/TemplatesTab.tsx:133`
- **Trecho**: `<Button variant="ghost" size="icon" className="h-7 w-7 hover:text-dest`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

### [Medium] Botão de ícone sem `aria-label` em `src/pages/PatchManagement.tsx`
- **Arquivo:Linha**: `src/pages/PatchManagement.tsx:140`
- **Trecho**: `<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() =>`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

### [Medium] Botão de ícone sem `aria-label` em `src/pages/Settings.tsx`
- **Arquivo:Linha**: `src/pages/Settings.tsx:469`
- **Trecho**: `<Button variant="outline" size="icon" onClick={handleCopyWebhook}>`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

### [Medium] Botão de ícone sem `aria-label` em `src/pages/WebMonitoring.tsx`
- **Arquivo:Linha**: `src/pages/WebMonitoring.tsx:328`
- **Trecho**: `<Button variant="ghost" size="icon" onClick={() => handleDeleteWebEndp`
- **Descrição**: Botão renderiza apenas um ícone gráfico sem texto descritivo nem `aria-label`, prejudicando leitores de tela.
- **Recomendação**: Adicionar atributo descritivo `aria-label="Ação do botão"`.

## RESUMO EXECUTIVO
- **Critical**: 0
- **High**: 0
- **Medium**: 13
- **Low**: 0
- **Total de Achados**: 13
