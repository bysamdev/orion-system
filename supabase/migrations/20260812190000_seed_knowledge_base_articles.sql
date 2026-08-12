-- Seed Knowledge Base categories & articles for Orion System
-- Categories: 'Primeiros Passos', 'Abrir Chamado', 'Acesso Remoto', 'Impressoras', 'Rede & Internet', 'Windows & Sistema', 'E-mail & Comunicação'

DO $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_cat_chamado UUID;
  v_cat_remoto UUID;
  v_cat_impressoras UUID;
  v_cat_rede UUID;
  v_cat_windows UUID;
  v_cat_email UUID;
  v_cat_passos UUID;
BEGIN
  -- Get existing company ID
  SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  IF v_company_id IS NULL THEN
    v_company_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Get existing user ID
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    v_user_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Create categories if not exist
  INSERT INTO public.categories (name, company_id, icon, description, sort_order)
  VALUES 
    ('Primeiros Passos', v_company_id, 'Sparkles', 'Guias de orientação inicial para colaboradores', 1),
    ('Abrir Chamado', v_company_id, 'Ticket', 'Como solicitar e acompanhar suporte técnico', 2),
    ('Acesso Remoto', v_company_id, 'Monitor', 'Ferramentas de conexão remota corporativa', 3),
    ('Impressoras', v_company_id, 'Printer', 'Resolução de problemas locais com impressoras', 4),
    ('Rede & Internet', v_company_id, 'Wifi', 'Conectividade, Wi-Fi, VPN e compartilhamento', 5),
    ('Windows & Sistema', v_company_id, 'Laptop', 'Desempenho, travamentos, programas e senhas', 6),
    ('E-mail & Comunicação', v_company_id, 'Mail', 'Outlook, anexos e Microsoft Teams', 7)
  ON CONFLICT DO NOTHING;

  -- Get category IDs
  SELECT id INTO v_cat_passos FROM public.categories WHERE name = 'Primeiros Passos' AND company_id = v_company_id LIMIT 1;
  SELECT id INTO v_cat_chamado FROM public.categories WHERE name = 'Abrir Chamado' AND company_id = v_company_id LIMIT 1;
  SELECT id INTO v_cat_remoto FROM public.categories WHERE name = 'Acesso Remoto' AND company_id = v_company_id LIMIT 1;
  SELECT id INTO v_cat_impressoras FROM public.categories WHERE name = 'Impressoras' AND company_id = v_company_id LIMIT 1;
  SELECT id INTO v_cat_rede FROM public.categories WHERE name = 'Rede & Internet' AND company_id = v_company_id LIMIT 1;
  SELECT id INTO v_cat_windows FROM public.categories WHERE name = 'Windows & Sistema' AND company_id = v_company_id LIMIT 1;
  SELECT id INTO v_cat_email FROM public.categories WHERE name = 'E-mail & Comunicação' AND company_id = v_company_id LIMIT 1;

  -- 1. Tutorial - Como abrir um chamado
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Como abrir um chamado no Orion System',
    '# Como abrir um chamado no Orion System

Este tutorial foi feito para ajudar você a solicitar suporte de forma simples e rápida no **Orion System**.

---

### 1. Onde encontrar o botão ''+ Novo Ticket''

- **Menu Superior:** No topo da tela, clique no botão destacado **"+ Novo Ticket"**.
- **Painel Principal:** Na tela inicial, clique no cartão **"Abrir Chamado / Novo Ticket"**.

[PRINT: Menu superior destacando o botão + Novo Ticket]

---

### 2. Preenchendo os campos do chamado

1. **Categoria:** Selecione a opção que melhor se aproxima do problema (ex: *Sistemas*, *Hardware*, *Rede*, *Acessos*).
2. **Descrição:** Escreva com detalhes simples o que está acontecendo.
   - Qual tela ou módulo apresentou erro?
   - Ocorreu alguma mensagem de erro na tela?
3. **Urgência / Prioridade:**
   - **Baixa:** Dúvidas ou pequenas melhorias.
   - **Média:** Lentidão ou falha parcial, mas consegue trabalhar.
   - **Alta:** Sistema parou totalmente e seu trabalho está bloqueado.

[PRINT: Formulário de abertura de ticket preenchido com exemplo claro]

---

### 3. Como anexar prints e arquivos

- Na seção **"Anexos"**, clique em **"Escolher arquivo"** ou arraste a imagem.
- *Dica no Windows:* Pressione `Windows + Shift + S` para capturar a tela e cole ou salve a imagem.

---

### 4. Acompanhando seu chamado

1. **Histórico:** Clique em **"Meus Chamados"** no menu principal.
2. **Notificações:** Receba atualizações pelo sininho no portal e no seu e-mail corporativo.

> [!NOTE]  
> Se precisar acelerar a solução, responda diretamente nas mensagens do chamado.',
    v_cat_chamado, v_company_id, true, 'published', ARRAY['chamado', 'novo ticket', 'suporte', 'passo a passo'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 2. Tutorial - TeamViewer
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Como permitir acesso remoto via TeamViewer',
    '# Como permitir acesso remoto via TeamViewer

O **TeamViewer** é a ferramenta **OFICIAL E PADRÃO** de suporte corporativo do **Orion System**.

---

### 1. Onde encontrar o TeamViewer na máquina

O TeamViewer já vem instalado de fábrica em todas as máquinas corporativas através das políticas do **Orion System**.

- **Área de Trabalho:** Procure pelo ícone azul do TeamViewer.
- **Menu Iniciar:** Clique em Iniciar e digite `TeamViewer`.

[PRINT: Ícone do TeamViewer na área de trabalho e no Menu Iniciar]

---

### 2. Identificando a ID e a Senha

1. Abra o aplicativo e aguarde a luz indicadora ficar verde no canto inferior esquerdo.
2. Na seção **Permitir Controle Remoto**, localize:
   - **Sua ID:** Código numérico de 9 a 10 dígitos.
   - **Senha:** Senha temporária alterada a cada sessão.

[PRINT: Tela principal do TeamViewer destacando os campos Sua ID e Senha]

---

### 3. Transmitindo os dados com segurança

Envie sua ID e Senha **apenas pelos canais oficiais**:
- No chamado aberto no Orion System.
- No chat corporativo oficial com o analista.
- Por telefone corporativo durante o atendimento.

> [!WARNING]  
> **Segurança:** NUNCA forneça sua ID/Senha para pessoas estranhas. A equipe de TI nunca solicitará acesso fora de um atendimento registrado.',
    v_cat_remoto, v_company_id, true, 'published', ARRAY['teamviewer', 'acesso remoto', 'suporte remoto', 'id teamviewer'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 3. Tutorial - AnyDesk (Alternativo)
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Como usar o AnyDesk como alternativa de acesso remoto',
    '# Como usar o AnyDesk como alternativa de acesso remoto

> [!IMPORTANT]  
> **Aviso de Contingência:** O AnyDesk é uma **opção SECUNDÁRIA / DE CONTINGÊNCIA**. Só deve ser utilizado se a ferramenta principal (**TeamViewer**) estiver indisponível ou bloqueada.

---

### 1. Baixando o AnyDesk (caso necessário)

1. Acesse o site oficial: `https://anydesk.com/pt`
2. Clique no botão verde **"Baixe agora"**.
3. Abra a pasta Downloads e dê dois cliques no arquivo `AnyDesk.exe`.

---

### 2. Localizando o código de 9 dígitos

1. Abra o AnyDesk.
2. Procure pelo quadro **"Este Dispositivo"**.
3. Anote o **código numérico de 9 dígitos** (ex: `123 456 789`).

[PRINT: Tela principal do AnyDesk destacando a seção Este Dispositivo]

---

### 3. Aceitando a conexão

1. Informe o código ao técnico da Orion no chamado ou telefone.
2. Quando a notificação de conexão aparecer na tela, confirme a identidade do técnico e clique em **"Aceitar"**.

[PRINT: Janela de autorização com destaque no botão verde Aceitar]',
    v_cat_remoto, v_company_id, true, 'published', ARRAY['anydesk', 'acesso remoto alternativo', 'contingencia'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 4. Impressora offline
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Impressora aparece offline ou não imprime',
    '# Impressora aparece offline ou não imprime

Siga este passo a passo simples para resolver as causas mais frequentes de impressoras offline.

### Passo a passo para solução:

1. **Verifique os cabos e energia:** Confira se a impressora está ligada e com o cabo USB ou de rede bem conectado.
2. **Verifique a rede:** Se for impressora Wi-Fi, confirme se está conectada na rede da empresa.
3. **Limpe a fila de impressão:** Vá em *Configurações > Impressoras e Scanners*, clique na impressora, escolha *Abrir fila* e cancele documentos travados.
4. **Desmarque "Usar impressora offline":** Na janela da fila, clique no menu *Impressora* e desmarque a opção *Usar impressora offline*.
5. **Reinicie os equipamentos:** Desligue a impressora por 10 segundos, ligue novamente e reinicie o computador.

[PRINT: Fila de impressão do Windows com opção Cancelar destacada]

> [!NOTE]  
> Se o problema persistir após estes passos, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_impressoras, v_company_id, true, 'published', ARRAY['impressora-offline', 'falha-de-impressao', 'fila-de-impressao'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 5. Papel enroscado
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Papel enroscado na impressora: como resolver com segurança',
    '# Papel enroscado na impressora: como resolver com segurança

O atolamento de papel ocorre quando a folha dobra nas engrenagens. Siga os passos para remover com segurança.

### Passo a passo para solução:

1. **Desligue da tomada:** Retire o cabo de energia para evitar choque ou queimaduras em componentes aquecidos.
2. **Abra as tampas:** Puxe a bandeja e abra a tampa frontal (onde fica o toner) e a tampa traseira.
3. **Remova o papel suavemente:** Segure a folha presa com as duas mãos e puxe devagar no sentido natural de saída.
4. **Inspecione pedaços:** Garanta que nenhum pequeno pedaço de papel rasgado ficou preso nas engrenagens.

[PRINT: Remoção correta do papel puxando com as duas mãos]

> [!NOTE]  
> Se o problema persistir após estes passos, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_impressoras, v_company_id, true, 'published', ARRAY['papel-enroscado', 'papel-atolado', 'jam-paper'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 6. Impressora ausente
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Impressora não aparece na lista de dispositivos',
    '# Impressora não aparece na lista de dispositivos

Se a impressora do seu setor sumiu da lista do computador, siga estes passos para localizá-la.

### Passo a passo para solução:

1. **Confirme a conexão:** Verifique se o equipamento está ligado e conectado à rede corporativa.
2. **Acesse Impressoras e Scanners:** No Windows, abra o menu Iniciar e digite *Impressoras e scanners*.
3. **Buscar novos dispositivos:** Clique em *Adicionar dispositivo* e aguarde a busca.
4. **Adição manual:** Se não aparecer, clique em *A impressora que eu quero não está na lista* e digite o nome de rede ou endereço IP fornecido pelo suporte.

[PRINT: Janela de adição de impressoras do Windows]

> [!NOTE]  
> Se o problema persistir após estes passos, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_impressoras, v_company_id, true, 'published', ARRAY['impressora-nao-encontrada', 'dispositivo-ausente', 'mapeamento'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 7. Qualidade de impressão ruim
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Qualidade de impressão ruim (folha riscada, borrada ou fraca)',
    '# Qualidade de impressão ruim (folha riscada, borrada ou fraca)

Falhas na impressão geralmente estão ligadas aos níveis de toner/tinta ou condições do papel.

### Passo a passo para solução:

1. **Verifique os níveis:** Abra as preferências da impressora e confira os níveis de tinta/toner.
2. **Agite o toner (impressoras a laser):** Remova o cartucho de toner e agite suavemente na horizontal 5 a 6 vezes para redistribuir o pó.
3. **Limpeza de cabeçotes (jato de tinta):** Abra as opções de manutenção da impressora e execute a *Limpeza de Cabeçote*.
4. **Verifique o papel:** Use folhas secas e limpas, sem umidade.
5. **Página de teste:** Imprima uma página de teste para validar a qualidade.

[PRINT: Monitor de nível de suprimentos da impressora]

> [!NOTE]  
> Se o problema persistir após estes passos, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_impressoras, v_company_id, true, 'published', ARRAY['qualidade-impressao', 'folha-riscada', 'toner-fraco'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 8. Internet lenta
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Internet lenta ou instável: testes rápidos',
    '# Internet lenta ou instável: testes rápidos

Siga estes passos simples para diagnosticar e tentar resolver falhas de conexão antes de abrir chamado.

### Passo a passo para solução:

1. **Verifique o cabo RJ-45:** Certifique-se de que o cabo de rede está bem encaixado no computador e na tomada.
2. **Reconecte o Wi-Fi:** Desative a rede Wi-Fi corporativa no relógio do Windows, aguarde 10 segundos e ative de novo.
3. **Teste de velocidade:** Acesse `fast.com` ou `speedtest.net` com chamadas de vídeo e downloads fechados.
4. **Reinicie o equipamento:** No Home Office, desligue o modem por 30 segundos. Em seguida, reinicie o computador.
5. **Feche downloads pesados:** Certifique-se de que não há uploads ou vídeos consumindo banda em segundo plano.

[PRINT: Resultado do teste de velocidade do fast.com]

> [!WARNING]  
> Se o problema persistir após estes passos, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_rede, v_company_id, true, 'published', ARRAY['internet-lenta', 'wi-fi', 'conexao-instavel', 'rede'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 9. Site específico indisponível
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Não consigo acessar um site ou sistema específico',
    '# Não consigo acessar um site ou sistema específico

Se sua internet funciona para a maioria das páginas mas falha em um site específico, siga este guia.

### Passo a passo para solução:

1. **Testar outros sites:** Abra `google.com` para descartar queda geral da internet.
2. **Janela Anônima:** Pressione `Ctrl + Shift + N` e tente acessar a página. Se abrir, limpe os dados do navegador.
3. **Limpar Cache e Cookies:** Pressione `Ctrl + Shift + Del`, selecione *Todo o período* e limpe arquivos em cache.
4. **Verificar VPN Corporativa:** Alguns sistemas internos exigem que a VPN da Orion esteja conectada.
5. **Testar outro navegador:** Tente no Microsoft Edge ou Firefox para descartar extensão quebrada.

[PRINT: Tela de limpar dados de navegação do Chrome]

> [!WARNING]  
> Se o problema persistir após estes passos, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_rede, v_company_id, true, 'published', ARRAY['site-fora', 'erro-navegacao', 'limpeza-cache', 'dns'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 10. VPN não conecta
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'VPN corporativa (OpenVPN) não conecta: o que verificar',
    '# VPN corporativa (OpenVPN) não conecta: o que verificar

O **OpenVPN (Community Edition)** é a nossa ferramenta padrão para conexão segura à rede e servidores da empresa em trabalho remoto.

### Passo a passo para solução (OpenVPN Community):

1. **Internet residencial ativa:** Confirme que a internet de casa está funcionando antes de conectar a VPN.
2. **Ícone na barra de tarefas:** Clique na setinha perto do relógio do Windows e localize o ícone do **OpenVPN GUI** (computador com cadeado).
3. **Conectar e Autenticar:** Clique com o botão direito no ícone do OpenVPN GUI, escolha o perfil `.ovpn` da empresa e clique em *Conectar*. Insira seu usuário e senha se solicitado.
4. **Verificar cor do status:**
   - 🟢 **Verde:** Conectado e funcionando.
   - 🟡 **Amarelo:** Conectando/autenticando.
   - 🔴 **Vermelho:** Desconectado ou com erro.
5. **Reiniciar o OpenVPN GUI:** Clique com o botão direito no ícone > *Sair*. Abra novamente o OpenVPN GUI pelo Menu Iniciar como Administrador.

[PRINT: Ícone do OpenVPN GUI verde perto do relógio do Windows]

> [!WARNING]  
> Se o OpenVPN apresentar erro de certificado ou chave expirada, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_rede, v_company_id, true, 'published', ARRAY['vpn', 'openvpn', 'home-office', 'autenticacao-vpn', 'erro-vpn'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 11. Pasta de rede compartilhada
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Sem acesso à pasta de rede compartilhada',
    '# Sem acesso à pasta de rede compartilhada

Não consegue abrir os arquivos no Drive Z: ou caminho `\\servidor\pasta`? Veja o que fazer.

### Passo a passo para solução:

1. **Conexão com a rede corporativa:** As pastas de rede exigem estar no escritório ou com a **VPN Conectada**.
2. **Testar caminho UNC:** Pressione `Windows + R`, digite `\\servidor-arquivos\compartilhado` e dê Enter.
3. **Reconectar mapeamento:** No Explorador de Arquivos (`Win+E`), clique em *Este Computador*, desequipe o disco Z: e re-mapeie.
4. **Verificar troca de senha:** Se aparecer "Acesso Negado", confirme se sua senha trocou recentemente.

[PRINT: Janela Executar com o caminho da pasta de rede]

> [!WARNING]  
> Se o problema persistir após estes passos, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_rede, v_company_id, true, 'published', ARRAY['pasta-compartilhada', 'drive-z', 'mapeamento-rede'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 12. Computador lento
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Computador muito lento: soluções simples',
    '# Computador muito lento: soluções simples

Sinta seu computador mais rápido executando verificações simples de rotina.

### Passo a passo para solução:

1. **Gerenciador de Tarefas:** Pressione `Ctrl + Shift + Esc`, ordene pela coluna *Memória* e finalize tarefas desnecessárias.
2. **Reiniciar o Windows:** Clique no Menu Iniciar > Ligar/Desligar > *Reiniciar* (limpa a memória RAM).
3. **Verificar espaço no Disco C:** No Explorador de Arquivos, confirme se o Disco (C:) possui mais de 10% de espaço livre.
4. **Fechar abas do navegador:** Cada aba do Chrome/Edge consome memória. Feche as guias não utilizadas.

[PRINT: Gerenciador de Tarefas do Windows com foco na coluna Memória]

> [!NOTE]  
> Se o problema persistir após estes passos, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_windows, v_company_id, true, 'published', ARRAY['lentidao', 'desempenho', 'gerenciador-tarefas', 'windows'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 13. Tela azul / travamento
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Tela azul ou travamento repentino: o que fazer',
    '# Tela azul ou travamento repentino: o que fazer

A "Tela Azul" (BSOD) ocorre quando o Windows encontra um erro grave e se protege. Veja como proceder.

### Passo a passo para solução:

1. **Anote o Código de Erro:** Tire uma foto da tela com o celular ou anote o código (ex: `MEMORY_MANAGEMENT`, `CRITICAL_PROCESS_DIED`).
2. **Aguarde o diagnóstico:** O Windows coletará os dados e tentará reiniciar sozinho.
3. **Forçar desligamento (se congelar total):** Segure o botão de Ligar por 10 segundos até o computador desligar.
4. **Remover USBs recentes:** Desconecte pendrives ou adaptadores USB inseridos recentemente.

[PRINT: Tela azul do Windows destacando o QR Code e código de parada]

> [!NOTE]  
> Se a tela azul acontecer com frequência, abra um chamado no Orion System anexando a foto do erro.',
    v_cat_windows, v_company_id, true, 'published', ARRAY['tela-azul', 'bsod', 'travamento', 'codigo-erro'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 14. Programa travado
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Programa travou ou não abre',
    '# Programa travou ou não abre

Saiba como encerrar um aplicativo que parou de responder ("Não está respondendo").

### Passo a passo para solução:

1. **Finalizar tarefa:** Pressione `Ctrl + Shift + Esc`, clique com o botão direito sobre o programa travado e selecione *Finalizar tarefa*.
2. **Aguarde a liberação:** Espere alguns segundos antes de tentar abrir a aplicação novamente.
3. **Executar como Administrador:** Clique com o botão direito no ícone do programa e escolha *Executar como administrador*.
4. **Reiniciar o computador:** Caso continue travado, reinicie o Windows para liberar processos presos.

[PRINT: Gerenciador de Tarefas destacando a opção Finalizar tarefa]

> [!NOTE]  
> Se o problema persistir após estes passos, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_windows, v_company_id, true, 'published', ARRAY['programa-travado', 'aplicativo', 'gerenciador-tarefas'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 15. Esqueceu a senha / conta bloqueada
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Esqueceu a senha ou conta bloqueada',
    '# Esqueceu a senha ou conta bloqueada

Orientações de segurança para recuperar o acesso ao seu usuário corporativo no Windows.

### Passo a passo para solução:

1. **Verifique o Caps Lock:** Na tela de login, confirme se a luz de maiúsculas não está ativa no teclado.
2. **Identifique a mensagem:** Se indicar *"Conta bloqueada atualmente"*, aguarde o tempo de desbloqueio temporário.
3. **Tempo de espera:** Bloqueios de segurança duram de 15 a 30 minutos sem novas tentativas incorretas.
4. **Portal de Autoatendimento:** Se disponível, utilize a redefinição de senha corporativa no portal web.

[PRINT: Mensagem de conta temporariamente bloqueada no Windows]

> [!NOTE]  
> Caso não consiga redefinir, peça para um colega abrir um chamado no Orion System solicitando o reset de senha.',
    v_cat_windows, v_company_id, true, 'published', ARRAY['senha', 'conta-bloqueada', 'login', 'redefinicao'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 16. E-mail não sincroniza
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'E-mail não sincroniza ou mensagens não chegam',
    '# E-mail não sincroniza ou mensagens não chegam

O que fazer quando suas mensagens do Outlook ou Webmail não chegam ou não atualizam.

### Passo a passo para solução:

1. **Conexão:** Confirme se a internet está funcionando normalmente.
2. **Pasta Spam / Lixo Eletrônico:** Verifique se as mensagens foram filtradas por engano e marque como *Não é Lixo Eletrônico*.
3. **Caixa de Saída (Outbox):** Se o envio travou, confira se a mensagem possui anexo muito pesado.
4. **Status do Outlook:** No canto inferior direito, confirme se exibe *Conectado*. Se indicar *Trabalhando Offline*, clique no botão para alternar.
5. **Sincronização Manual:** No Outlook, pressione `F9` ou no navegador pressione `F5`.

[PRINT: Barra de status do Outlook destacando o botão Trabalhando Offline]

> [!NOTE]  
> Se o problema persistir após estes passos, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_email, v_company_id, true, 'published', ARRAY['email', 'sincronizacao', 'outlook', 'webmail', 'spam'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 17. Anexo de e-mail bloqueado
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Anexo de e-mail não abre ou foi bloqueado',
    '# Anexo de e-mail não abre ou foi bloqueado

Entenda os limites de tamanho e extensões bloqueadas por segurança corporativa.

### Passo a passo para solução:

1. **Tamanho do Anexo:** O limite máximo por e-mail é de 25 MB. Para arquivos maiores, compartilhe via **OneDrive/SharePoint**.
2. **Extensões Bloqueadas:** Arquivos `.exe`, `.bat`, `.vbs` e `.zip` com senha são bloqueados para evitar vírus.
3. **Salvar antes de abrir:** Baixe o arquivo na pasta *Downloads* antes de tentar abri-lo.
4. **Programa Compatível:** Confirme se possui Adobe Acrobat (PDF), Excel ou Word instalados no seu computador.

[PRINT: Alerta de segurança de anexo potencialmente perigoso no e-mail]

> [!NOTE]  
> Se o problema persistir após estes passos, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_email, v_company_id, true, 'published', ARRAY['email', 'anexo', 'bloqueio', 'tamanho', 'onedrive'], v_user_id
  ) ON CONFLICT DO NOTHING;

  -- 18. Teams microfone e câmera
  INSERT INTO public.knowledge_base_articles (title, content, category_id, company_id, is_public, status, tags, created_by)
  VALUES (
    'Problemas com microfone ou câmera no Microsoft Teams',
    '# Problemas com microfone ou câmera no Microsoft Teams

Como resolver falhas de áudio e vídeo durante reuniões online no Microsoft Teams.

### Passo a passo para solução:

1. **Botões na reunião:** Confirme se o ícone do Microfone e da Câmera estão ativados na barra do Teams.
2. **Configurações de Dispositivo:** No Teams, vá em *Configurações > Dispositivos* e selecione seu headset/webcam correto.
3. **Permissões no Windows:** Em *Configurações do Windows > Privacidade e Segurança*, permita o acesso do Teams ao Microfone e Câmera.
4. **Fechar outros apps:** Feche Zoom, Meet ou Skype que possam estar prendendo o dispositivo de mídia.
5. **Reiniciar o Teams:** Clique com o botão direito no ícone do Teams no relógio e escolha *Sair*.

[PRINT: Painel de configurações de dispositivos de áudio e vídeo do Teams]

> [!NOTE]  
> Se o problema persistir após estes passos, clique em **+ Novo Ticket** para abrir um chamado.',
    v_cat_email, v_company_id, true, 'published', ARRAY['teams', 'microfone', 'camera', 'audio', 'reuniao'], v_user_id
  ) ON CONFLICT DO NOTHING;

END $$;
