# Relatório de Auditoria: Site em Produção (Subagente 16)

## Escopo
Inspeção GET read-only em `https://orion.bysam.dev/` comparada com o build local.

## Achados

### [Medium] `robots.txt` Permite Indexação Global de Rotas Internas
- **URL**: `https://orion.bysam.dev/robots.txt`
- **Descrição**: O arquivo `robots.txt` está configurado com `User-agent: * Allow: /`, permitindo que crawlers indexem telas do sistema e portal.
- **Recomendação**: Atualizar `robots.txt` para desautorizar indexação de `/admin`, `/dashboard`, `/tickets` (`Disallow: /admin`, `Disallow: /dashboard`).

### [Low] Redirecionamento SPA em `sitemap.xml`
- **URL**: `https://orion.bysam.dev/sitemap.xml`
- **Descrição**: A requisição de sitemap retorna o HTML da SPA (HTTP 200) em vez de um arquivo XML ou 404 apropriado.
- **Recomendação**: Adicionar um `sitemap.xml` estático em `public/` ou configurar rewrite no `vercel.json`.

## RESUMO EXECUTIVO
- **Critical**: 0
- **High**: 0
- **Medium**: 1
- **Low**: 1
- **Total de Achados**: 2
