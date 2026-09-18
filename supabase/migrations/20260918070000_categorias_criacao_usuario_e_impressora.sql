-- =============================================================================
-- Novas categorias de chamado: criação de usuário e impressora
-- =============================================================================
--
-- Pedidas para o formulário de abertura, cada uma com as próprias perguntas
-- (src/lib/perguntasPorCategoria.ts). Criação de usuário cobre Windows/rede,
-- Senior, e-mail e VPN numa pergunta de múltipla escolha. Impressora saiu de
-- dentro de Hardware e Rede, onde aparecia só como exemplo.
--
-- Só amplia o vocabulário: nenhum chamado existente muda de categoria. As duas
-- constraints andam juntas desde 20260910171000, porque o checklist de
-- resolução é cadastrado por categoria.
-- =============================================================================

ALTER TABLE public.tickets DROP CONSTRAINT tickets_category_valid;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_category_valid
  CHECK (category IN ('erp', 'email', 'hardware', 'software', 'rede', 'outros',
                      'criacao_usuario', 'impressora', 'infraestrutura'));

ALTER TABLE public.resolution_checklists DROP CONSTRAINT resolution_checklists_category_valid;
ALTER TABLE public.resolution_checklists
  ADD CONSTRAINT resolution_checklists_category_valid
  CHECK (category IN ('erp', 'email', 'hardware', 'software', 'rede', 'outros',
                      'criacao_usuario', 'impressora', 'infraestrutura'));
