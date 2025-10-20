# Configuração de Setores e Permissões

## Visão Geral do Sistema de Permissões

O sistema possui 4 níveis de permissão:

### 1. **Colaborador (Customer)**
- Pode criar e visualizar seus próprios chamados
- Pode adicionar atualizações aos seus chamados
- Acesso limitado apenas aos seus tickets

### 2. **Técnico (Technician)**
- Visualiza todos os chamados do sistema
- Pode atribuir chamados para si mesmo
- Pode atualizar o status dos chamados
- Pode adicionar comentários e soluções
- Não tem acesso à área administrativa

### 3. **Gestor (Admin)**
- Visualiza todos os chamados e estatísticas
- Acessa dashboards e relatórios
- Gerencia usuários e suas permissões
- **NÃO pode** criar, editar ou excluir empresas
- Ideal para gestores de TI que precisam acompanhar e gerenciar o suporte

### 4. **Desenvolvedor (Developer)**
- Acesso total ao sistema
- Pode gerenciar empresas (criar, editar, excluir)
- Pode gerenciar todos os usuários e permissões
- Acesso a todas as funcionalidades administrativas
- Ideal para desenvolvedores e administradores do sistema

## Como Configurar Setores de Usuários

### Acessando a Área de Administração

1. Faça login com uma conta de **Gestor** ou **Desenvolvedor**
2. Navegue até a página de **Administração** no menu superior
3. Clique na aba **"Usuários"**

### Editando o Setor de um Usuário

1. Na lista de usuários, localize o campo **"Setor"** (anteriormente "Departamento")
2. Este campo mostra o setor atual do usuário
3. Para editar o setor:
   - Acesse o banco de dados Supabase diretamente
   - Navegue até a tabela `profiles`
   - Localize o usuário pelo email ou nome
   - Edite o campo `department` com o nome do setor desejado

### Setores Comuns

Exemplos de setores que você pode configurar:
- **TI / Tecnologia da Informação**
- **Recursos Humanos**
- **Financeiro**
- **Comercial / Vendas**
- **Marketing**
- **Operações**
- **Atendimento ao Cliente**
- **Administrativo**

## Como Alterar a Permissão de um Usuário

### Via Interface do Sistema (Recomendado)

1. Acesse **Administração > Usuários**
2. Localize o usuário na lista
3. Na coluna **"Função"**, clique no menu dropdown
4. Selecione a nova permissão:
   - **Colaborador**: Para usuários que apenas abrem chamados
   - **Técnico**: Para membros da equipe de suporte
   - **Gestor**: Para gerentes de TI e líderes de equipe
   - **Desenvolvedor**: Para administradores do sistema

5. A alteração é aplicada imediatamente

### Via Banco de Dados Supabase

Se precisar fazer alterações diretas:

1. Acesse o painel do Supabase
2. Navegue até a tabela `user_roles`
3. Localize o registro do usuário pelo `user_id`
4. Altere o campo `role` para um dos valores:
   - `customer`
   - `technician`
   - `admin`
   - `developer`

## Boas Práticas

### Segurança
- ⚠️ **Importante**: Mantenha o número de **Desenvolvedores** limitado (apenas 1-2 pessoas)
- Desenvolvedores têm acesso total, incluindo exclusão de empresas
- Use a permissão de **Gestor** para líderes de equipe que precisam de visão geral

### Organização
- Mantenha os setores padronizados e consistentes
- Use nomes claros e específicos para os setores
- Documente setores personalizados que sua organização criar

### Gerenciamento de Usuários
- Revise periodicamente as permissões dos usuários
- Remova permissões elevadas quando não forem mais necessárias
- Associe sempre os usuários às empresas corretas

## Fluxo de Trabalho Recomendado

1. **Novo Colaborador**:
   - Permissão: Colaborador
   - Definir empresa e setor
   - Usuário pode abrir chamados

2. **Membro da Equipe de Suporte**:
   - Permissão: Técnico
   - Pode visualizar e resolver chamados

3. **Líder de Equipe / Gerente de TI**:
   - Permissão: Gestor (Admin)
   - Pode gerenciar usuários e acompanhar métricas

4. **Administrador do Sistema**:
   - Permissão: Desenvolvedor
   - Configuração completa do sistema

## Troubleshooting

### Usuário não consegue acessar área administrativa
- Verifique se a permissão é **Gestor** ou **Desenvolvedor**
- Confirme na tabela `user_roles` no Supabase

### Usuário não vê seus chamados
- Verifique se o `user_id` nos tickets corresponde ao ID do usuário
- Confirme se o usuário está associado à empresa correta

### Alterações não aparecem
- Faça logout e login novamente
- As permissões são carregadas na autenticação

## Suporte

Para questões técnicas ou dúvidas sobre configuração, contate o administrador do sistema ou consulte a documentação adicional do Supabase.
