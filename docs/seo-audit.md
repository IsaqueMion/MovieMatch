# SEO do MovieMatch — 1 de outubro de 2026

Referência: checklist fornecido pelo usuário. A revisão cobre as páginas públicas e preserva o `noindex` das sessões e da lista pessoal de assistidos.

## Diagnóstico e ajustes

| Item | Resultado e localização |
|---|---|
| Indexação pública | A home não tinha `noindex` por engano. `index.html:11` declara `index,follow`. |
| Conteúdo antes do JavaScript | O HTML da home vinha com o `root` vazio. `scripts/prerender.mjs:19` renderiza a própria tela React durante o build, sem chamadas ao banco. O cliente continua escolhendo pôsteres a cada visita. |
| Sessões e assistidos | `scripts/prerender.mjs:11` gera um HTML separado sem conteúdo da home ou canonical. `vercel.json:9` adiciona `X-Robots-Tag: noindex, nofollow, noarchive` às rotas privadas, antes de executar JavaScript. Isso complementa os controles de acesso existentes; `noindex` não é autenticação. |
| Sitemap | `public/sitemap.xml:3` já lista as quatro páginas públicas reais: home, privacidade, termos e publicidade. Sessões e assistidos permanecem fora dele. |
| Robots | `public/robots.txt:3` permite rastreamento das páginas públicas e informa o sitemap. Não bloqueia a leitura do `noindex` nas rotas privadas. |
| HTTPS | A URL de produção já redireciona HTTP para HTTPS com status 308. Nenhuma configuração adicional foi necessária. |
| Endereços inexistentes | O fallback global devolvia a home com status 200. `vercel.json:2` mantém apenas as rotas reais da aplicação; páginas e arquivos ausentes passam a retornar 404 na Vercel. |
| Títulos, descrições e canonical | `index.html:6`, `public/privacy.html:6`, `public/terms.html:6` e `public/ads.html:6` têm metadados próprios e endereços canônicos de produção. `src/hooks/usePageMeta.ts:48` também atualiza os metadados ao navegar e remove o canonical público nas telas privadas. |
| Cabeçalhos | As páginas públicas têm um H1. O swipe tinha dois: `src/pages/Swipe.tsx:2000` mantém apenas um, acessível em todas as larguras. As demais páginas da aplicação já tinham um H1. |
| Links internos | A navegação da home e os links entre páginas públicas já existem. Mantidos, sem criar páginas artificiais apenas para SEO. |
| Dados estruturados | `index.html:31` descreve o produto como `WebApplication`, com idioma, categoria e gratuidade. Não adiciona notas ou avaliações fictícias do aplicativo. |
| Compartilhamento | `index.html:18` e as três páginas estáticas usam URLs absolutas para Open Graph e Twitter, com título, descrição, imagem e idioma. A imagem existente tem 1200 × 630 px e 30.151 bytes. |
| Imagens, fontes e mobile | Miniaturas locais, tamanhos proporcionais, carregamento progressivo e fontes WOFF2 com `font-display: swap` já estavam implementados. Verificados em 390, 768 e 1440 px; a suíte existente também cobre 320 px e atraso no carregamento dos pôsteres. |
| Rastreadores de IA | Preservada a política existente de permitir todos, incluindo OAI-SearchBot e GPTBot. Permitir busca por IA e permitir uso para treinamento são decisões distintas; o arquivo atual permite ambos. |

Entregar conteúdo pronto evita depender exclusivamente da renderização por JavaScript para a leitura inicial. A implementação usa o [SSR nativo do Vite](https://vite.dev/guide/ssr.html), seguindo as [orientações do Google para JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). A separação entre busca e treinamento está descrita na [documentação dos robôs da OpenAI](https://developers.openai.com/api/docs/bots).

## Verificações

- Lint, build de produção e 79 testes aprovados: 15 de lógica e 64 de navegador.
- Os testes de SEO leem as páginas com JavaScript desativado, verificam sitemap, canonical, títulos, descrições, Open Graph e o HTML privado.
- Scripts atrasados não escondem o conteúdo da home nem criam usuário anônimo. O HTML inicial usa apenas miniaturas embutidas, para não baixar um segundo conjunto de pôsteres antes do sorteio do visitante. A navegação da tela privada de volta à home restaura os metadados públicos.
- As suítes existentes verificam sessão, votação, filtros, matches, assistidos e avaliações com APIs simuladas, sem gravar dados de visitantes reais.
- A conferência remota usa o preview para validar os cabeçalhos da Vercel e o status 404. Preview protegido não é uma URL a enviar ao Google.

## Pendências externas

As alterações estão no preview da PR #3, aguardando publicação em produção. Para fechar a confirmação de indexação, depois da publicação:

1. Abrir a propriedade `https://moviematch-three.vercel.app/` no [Search Console](https://search.google.com/search-console) com acesso de proprietário ou usuário completo.
2. Enviar `sitemap.xml` e usar a Inspeção de URL na home, com teste ao vivo e solicitação de indexação.
3. Acompanhar o relatório de indexação. Solicitar rastreamento não garante inclusão imediata nos resultados, conforme o [Google](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).
4. Medir Core Web Vitals em produção com os anúncios reais. Os testes com atraso verificam apresentação e funcionamento; não substituem métricas de tráfego real ou uma pontuação de PageSpeed.

Não há acesso ao Search Console configurado nesta sessão. A indexação efetiva e a aparência final no Google e no WhatsApp ainda dependem da publicação, rastreamento e caches desses serviços.
