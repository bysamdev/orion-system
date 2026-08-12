# Auditoria de Permissões e RBAC (Role-Based Access Control)

## 1. Visão Geral da Arquitetura de Permissões
O Orion System implementa um modelo de RBAC robusto centrado no banco de dados, utilizando o recurso de **Row Level Security (RLS)** do PostgreSQL/Supabase como camada primária de defesa, associado a um controle de rotas no frontend. As permissões não estão atreladas apenas à interface do usuário (UI), garantindo que requisições diretas à API ou ao banco de dados sempre respeitem as regras de acesso estritas da aplicação.

## 2. Tipos de Papéis (Roles)
O sistema trabalha com o enum `app_role` no banco de dados, que define quatro níveis principais de acesso:

1. **`customer`**: Cliente final. Tem acesso restrito apenas aos seus próprios chamados (tickets), atualizações relacionadas aos mesmos e visualização restrita de seu próprio perfil e empresa.
2. **`technician`**: Técnico de suporte. Tem acesso à fila de chamados global, interage com tickets de todos os clientes, atualiza status e acessa a base de conhecimento.
3. **`admin`**: Administrador geral. Possui privilégios totais de gestão sobre usuários, empresas, configurações globais e exclusão de dados.
4. **`developer`**: (Adicionado nas migrações posteriores) Acesso irrestrito voltado para gestão sistêmica, debug e administração de módulos sensíveis da infraestrutura (como regras de automação CMDB, scripts, pacotes de software e monitoramento remoto).

## 3. Implementação Backend (Banco de Dados e RLS)
A camada mais crítica de segurança está construída no Supabase via PostgreSQL:

*   **Tabela Separada (`user_roles`)**:
    Para evitar vulnerabilidades de escalação de privilégios (*Privilege Escalation*), o sistema armazena o papel (role) do usuário na tabela separada `user_roles` e não em `profiles`. Se a role ficasse em `profiles`, a RLS ("O usuário pode editar o próprio perfil") permitiria que um atacante se tornasse "admin" via uma requisição PATCH. A segregação resolve este vetor de ataque.
*   **Função `has_role()` e Prevenção de Recursão**:
    Uma função *SECURITY DEFINER* (`has_role(_user_id, _role)`) foi implementada para que o banco possa validar papéis sem gerar recursão infinita na interpretação da segurança por nível de linha (RLS Recursion).
*   **Row Level Security (RLS)**:
    - **`tickets`**: Clientes (`user_id = auth.uid()`) visualizam e inserem tickets; Técnicos, Admins e Developers visualizam e atualizam todos os tickets. Apenas admins deletam.
    - **`profiles`**: Usuários podem editar informações próprias exceto sua vinculação de empresa; Admins podem editar qualquer perfil e vínculo livremente.
    - **`user_roles`**: Somente `admin` tem controle para visualizar todas e alterar as permissões no sistema.
    - **`machines`, `custom_fields`, `kb_articles`**: Acessos definidos estritamente para gestão do back-office via a diretiva `has_role(auth.uid(), 'developer'::app_role)` e `technician`.

## 4. Implementação Frontend (React/Vite)
No React, a UI se adapta dinamicamente e barra acessos com bloqueio de rota:

*   **Hook `useUserRole.ts`**:
    Utiliza o React Query (Tanstak Query) para buscar a role do usuário no primeiro acesso (`select('role').eq('user_id', user.id)`). Conta com proteção via `import.meta.env.DEV` garantindo que mocks de teste via URL (ex: `?testRole=admin`) não vazem e abram brechas no ambiente de produção.
*   **Componente `<ProtectedRoute />`**:
    Atua como um *Guard* no React Router. Recebe o array `allowedRoles`. Se a role do usuário logado não estiver presente na lista permitida, bloqueia imediatamente a renderização (retornando `null` ou fallback loading), dispara uma notificação (*toast*) de negação de acesso e redireciona para a raiz.
*   **Mapeamento de Rotas (`App.tsx`)**:
    - Rotas como `/admin`, `/relatorios`, `/automacoes` exigem explicitamente `['admin', 'developer']`.
    - Rotas técnicas operacionais como `/sistemas`, `/assets`, `/monitoramento-web`, `/patches` exigem `['admin', 'developer', 'technician']`.
    - As rotas restantes de tickets operam naturalmente para todas as sessões autenticadas, isolando os dados exclusivamente via RLS do backend.

## 5. Conclusão da Auditoria
O modelo de segurança e autorizações examinado reflete excelentes práticas arquiteturais de "Secure by Design":

1. **Defesa em Profundidade**: Ocultação de rotas e botões no Frontend complementada por bloqueio severo (RLS) no Backend em endpoints diretos.
2. **Isolamento Eficiente de Roles**: Abordagem correta ao separar a relação `auth.users` -> `user_roles` da base exposta de dados cadastrais `profiles`.
3. **Escalabilidade**: O sistema pode acomodar novas tabelas com confiança apenas aplicando as roles existentes nas policies.

Não foram encontrados desvios críticos nas permissões sistêmicas durante a presente análise da estrutura de banco e fluxo da aplicação. A aplicação está apta do ponto de vista de RBAC.
