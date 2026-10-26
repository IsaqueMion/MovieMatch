# Compatibilidade de navegadores

## Alvo e alternativas

O alvo de compilação permanece Chrome/Edge 107, Firefox 104 e Safari/iOS 16. Ele está explícito em `vite.config.ts` e em `browserslist` no `package.json`, para que uma atualização de ferramenta não mude a seleção silenciosamente. Esse alvo não equivale a certificar cada versão.

As correções de 23–26/10/2026 incluem:

- Alturas básicas em `vh` antes de `dvh`/`svh`, inclusive páginas e diálogos.
- Tamanho alternativo do cartaz de swipe sem unidades de container, preservando proporção e controles.
- Corredor de cartazes da home com medida em pixels quando `cqw` não existe.
- Expansão de participantes com alternativa sem Popover API e atalhos de swipe sem seletores incompatíveis.
- Listeners de media query compatíveis e resize por evento da janela quando `ResizeObserver` não existe.
- Adaptação de listeners legados antes da inicialização do React, cobrindo também a biblioteca de animação. O adaptador legado cobre callbacks de `change` usados pelo projeto e suas dependências; listener options não fazem parte dessa alternativa.
- Diálogos nativos quando disponíveis e alternativa com foco, Escape, bloqueio de fundo e limpeza de atributos quando não disponíveis. Diálogos sobrepostos mantêm os bloqueios mesmo quando fechados fora de ordem.
- Fotos com extensão/MIME correspondentes ao blob real, limite de 2 MB no resultado e limpeza em falha. APIs antigas de imagem e identificadores têm alternativas com recursos do navegador e aleatoriedade criptográfica.

A publicação parte do commit de produção 2aaa9e2 e preserva seu fundo canvas, convidados persistentes, pré-carregamento de cartazes e cabeçalho compacto. Recursos visuais opcionais ainda podem variar entre versões; o trabalho não introduz suporte formal a Internet Explorer nem a todos os navegadores anteriores ao alvo.

## Ordem de publicação das fotos

**A migração `supabase/migrations/20261026101157_profile_image_formats.sql` deve ser aplicada antes de publicar o frontend corrigido.** O schema anterior aceita apenas WebP; o Safari pode devolver PNG ao solicitar WebP no canvas.

A migração mantém WebP e acrescenta PNG nas validações do caminho, nos MIME permitidos pelo bucket e na policy de inserção. Mantém autenticação, propriedade da pasta e o limite existente de 2 MB. O frontend antigo continua aceito após essa migração.

A migração foi aplicada isoladamente em 26/10/2026 ao projeto MovieMatch e seu nome local foi alinhado à versão 20261026101157 registrada pelo servidor. As duas constraints foram validadas e o bucket permite WebP/PNG com limite de 2 MB. Outras migrações locais pendentes não foram publicadas.

## Verificação local

Não instalar dependências de browser tooling no projeto. Usar a versão de Playwright já declarada e navegadores de teste isolados, sem perfis pessoais.

```powershell
npm test
npm run lint
npm run build
$env:BROWSER_CHANNEL = 'chrome'
npm run test:browser
```

As suítes iniciam seus próprios previews quando `TEST_BASE_URL` não está definido. Usar o build de produção, pois o servidor de desenvolvimento tem requisitos diferentes.

A regressão completa também inclui:

```powershell
$env:BROWSER_CHANNEL = 'chrome'
node --test tests/landing.browser.mjs tests/matches.browser.mjs tests/accounts.browser.mjs tests/movieLibrary.browser.mjs tests/seo.browser.mjs tests/dialogCompatibility.browser.mjs
```

Para Edge, trocar o canal por `msedge`. Sem `BROWSER_CHANNEL`, os testes usam o Chromium do Playwright, que precisa estar previamente disponível no ambiente.

Os testes de compatibilidade retiram recursos CSS/APIs individualmente e verificam cartazes, controles, foco e votação com backend simulado. **Isso não substitui testes em versões antigas reais ou em Safari/iOS.** Chrome e Edge usam o mesmo motor; validar Firefox e Safari separadamente antes de ampliar a promessa de suporte.

O teste de SEO local verifica o arquivo de configuração da Vercel. Configurar `TEST_BASE_URL` ativa também verificações de cabeçalhos e rotas reais da hospedagem, que `vite preview` não implementa.

## Pendências de ambiente

Validação anterior em 23/10: build e lint aprovados, 31/31 testes de lógica, 119/119 testes no Chrome 156 e 22/22 selecionados no Edge 155. Na base atual de produção, 23/23 testes de lógica passaram; a suíte de navegador inclui os novos fluxos publicados desde a auditoria. A suíte inclui nove cenários de retirada de recursos e quatro cenários isolados de modalidade, sobreposição e limpeza de diálogos.

O primeiro `trail check` passou contra o learning da auditoria. Após registrar o learning de implementação, ele retornou conflito em `src/lib/dialogFocus.ts:5`, interpretando a frase sobre snapshots independentes como rejeição de todo controle de scroll/`aria-hidden`. A decisão correta é manter a contagem compartilhada: `openCount` restaura o scroll apenas após o último diálogo; `hiddenElements` conta referências por elemento e restaura seu atributo original apenas ao liberar a última referência. O teste de fechamento fora de ordem reproduziu o defeito antigo e passou com essa implementação. É um falso positivo documentado para a revisão, sem mudança do código apenas para satisfazer a heurística.

- Executar a migração em PostgreSQL de teste e depois pelo processo aprovado de publicação.
- Validar Safari/iOS e navegadores antigos reais, incluindo upload, filtros e modais sobrepostos.
- Atualizar o banco `caniuse-lite` em uma mudança de dependências própria; o build ainda informa dados antigos. Ele não foi atualizado nesta correção.
- A auditoria original permanece no checkout de trabalho anterior como registro; a publicação não inclui trabalho paralelo de recomendações.
