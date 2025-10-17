# Configuração de Read Replicas no Supabase

Este documento explica como ativar e configurar read replicas para otimizar a performance da aplicação.

## Pré-requisitos

- ✅ Plano Supabase **Pro** ou superior
- ✅ Projeto Supabase ativo

## Benefícios

1. **Performance**: Consultas de leitura não impactam o banco principal
2. **Escalabilidade**: Distribui carga entre múltiplos bancos
3. **Disponibilidade**: Redundância em caso de falha
4. **Latência**: Replicas podem estar mais próximas geograficamente

## Passo 1: Ativar Read Replicas no Supabase

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá para **Settings** → **Database**
4. Na seção **Read Replicas**, clique em **Enable Read Replicas**
5. Escolha a região da replica (preferencialmente próxima aos seus usuários)
6. Aguarde a criação da replica (pode levar alguns minutos)

## Passo 2: Obter a URL da Read Replica

1. Após a replica ser criada, copie a **Read Replica Connection String**
2. A URL será algo como: `https://kcxwealimsfxqstoprdg-read-replica.supabase.co`

## Passo 3: Configurar a Aplicação

### 3.1. Atualizar o Read Client

Edite o arquivo `src/integrations/supabase/read-client.ts`:

```typescript
// Substitua esta URL pela URL da sua read replica
const SUPABASE_READ_URL = "https://kcxwealimsfxqstoprdg-read-replica.supabase.co";
```

### 3.2. Verificar a Configuração

A aplicação já está preparada para usar read replicas! As mudanças incluem:

- ✅ **Queries de Leitura**: Usam `supabaseRead` client
- ✅ **Mutations (Escrita)**: Usam `supabase` client normal
- ✅ **Índices**: Já otimizados para consultas comuns
- ✅ **Cache**: React Query já configurado

## Arquitetura Implementada

```
┌─────────────────────────────────────────┐
│          Frontend (React)               │
│                                         │
│  ┌─────────────┐      ┌──────────────┐ │
│  │   Queries   │      │  Mutations   │ │
│  │  (Leitura)  │      │  (Escrita)   │ │
│  └──────┬──────┘      └──────┬───────┘ │
└─────────┼──────────────────────┼────────┘
          │                      │
          ▼                      ▼
  ┌───────────────┐      ┌──────────────┐
  │  Read Replica │◄─────│  Primary DB  │
  │  (somente     │      │  (leitura e  │
  │   leitura)    │      │   escrita)   │
  └───────────────┘      └──────────────┘
         ▲                        │
         │    Replicação          │
         │    Assíncrona          │
         └────────────────────────┘
```

## Otimizações Adicionais

### Índices Criados

- `idx_tickets_status_created`: Filtragem por status e ordenação
- `idx_tickets_user_status`: Consultas específicas de usuário
- `idx_tickets_assigned_to_user`: Tickets atribuídos
- `idx_ticket_updates_ticket_created`: Histórico de tickets
- `idx_profiles_company`: Consultas de empresa
- `idx_user_roles_role`: Filtragem de roles

### Cache Strategy

A aplicação usa React Query para cache automático:

```typescript
// Queries são cacheadas por 5 minutos (default)
// Refetch automático quando a janela recebe foco
// Retry automático em caso de erro
```

## Monitoramento

### Verificar Uso da Read Replica

No código, use:

```typescript
import { isReadReplicaConfigured } from '@/integrations/supabase/read-client';

if (isReadReplicaConfigured()) {
  console.log('✅ Read replica está ativa');
} else {
  console.log('⚠️ Usando banco principal para tudo');
}
```

### Métricas no Supabase Dashboard

1. Vá para **Database** → **Reports**
2. Monitore:
   - Query performance
   - Connection pool usage
   - Replica lag (latência de replicação)
   - Cache hit rate

## Troubleshooting

### Problema: Dados desatualizados na read replica

**Causa**: Replicação assíncrona pode ter lag de alguns milissegundos

**Solução**: Para dados críticos que precisam estar atualizados imediatamente após escrita, force o uso do banco principal:

```typescript
// Em vez de supabaseRead, use supabase temporariamente
const { data } = await supabase
  .from('tickets')
  .select('*')
  .eq('id', justCreatedId);
```

### Problema: Erro de conexão com read replica

**Causa**: URL incorreta ou replica não está ativa

**Solução**:
1. Verifique se a URL está correta
2. Confirme que a replica está ativa no dashboard
3. Teste a conexão diretamente

### Problema: Performance não melhorou

**Possíveis causas**:
1. Volume de dados ainda pequeno
2. Queries não otimizadas (faltam índices)
3. Read replica na mesma região do banco principal

**Soluções**:
1. Adicione mais índices para suas queries específicas
2. Use explain analyze para identificar queries lentas
3. Considere uma replica em região diferente

## Custos

Read replicas têm custo adicional no Supabase:
- **Pro Plan**: ~$0.01344/hora por replica (~$10/mês)
- **Custos de dados**: Transfer out e storage adicional
- Consulte [pricing oficial](https://supabase.com/pricing)

## Próximos Passos

1. ✅ Ativar read replica no Supabase (quando necessário)
2. ✅ Atualizar URL no código
3. ⚠️ Monitorar performance por 1 semana
4. ⚠️ Ajustar configurações baseado em métricas
5. ⚠️ Considerar múltiplas replicas em diferentes regiões (se global)

## Suporte

- [Documentação Oficial Supabase](https://supabase.com/docs/guides/platform/read-replicas)
- [Community Discord](https://discord.supabase.com/)
- [GitHub Issues](https://github.com/supabase/supabase/issues)
