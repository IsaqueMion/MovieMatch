# AdSense — verificação do MovieMatch

## Ativação após aprovação — 19/10/2026

O responsável apresentou o site como **Pronto**, `ads.txt` **Autorizado** e verificação de identidade em andamento. O status da conta e a propriedade das unidades só podem ser confirmados no painel do Google.

- Conta integrada: `ca-pub-8257200313072326`. Unidades existentes: `8357155401` e `4497801440`.
- Na votação, telas a partir de 1400 px usam dois anúncios de 300 × 250. Telas menores usam uma faixa de 300 × 50 acima do pôster, separada das interações. A faixa não aparece em janelas de até 700 px de altura, para preservar o espaço do pôster e da votação.
- A faixa do celular pode ser fechada por sessão no navegador. O botão fica fora da área do anúncio.
- O card central agora contém uma unidade real de 300 × 250, ou 300 × 50 em janelas de até 500 px de altura. O anúncio permanece parado. Curtir, recusar e deslizar pela moldura avançam ao próximo filme sem registrar votos; os gestos e cliques dentro do criativo são preservados. A unidade inicializada é preservada ao revisitar o card: não há refresh periódico nem exigência de aguardar um tempo mínimo.
- O celular e o card central reutilizam a primeira unidade; não é preciso inventar um identificador nem habilitar anúncios automáticos. Se os IDs do painel diferirem, atualizar as chamadas de `AdSlot` em `Swipe.tsx`, `SwipeBannerAd.tsx` e `AdSwipeCard.tsx`.
- Apenas espaços visíveis solicitam anúncios. Dimensões fixas seguem o código de tamanho específico do Google, sem `data-ad-format="auto"` ou expansão de largura. Não há atualizações periódicas de anúncios; `unfilled` e falhas de carregamento ocultam o espaço sem impedir o voto.
- Anúncios não são montados sem filme, para premium ou com o filtro de conteúdo adulto ativo. As páginas de conta continuam sem unidades.
- Os testes simulam o script do Google e as APIs: validam carregamento, tamanhos, separação dos votos e estados sem anúncios, sem gerar impressões nem clicar em anúncios reais. Não comprovam preenchimento comercial ou liberação administrativa.

Para diagnosticar no site público: conferir **Pagamentos → Verificação**, **Anúncios → Por bloco de anúncios** e a central de políticas. No navegador sem bloqueador, verificar `adsbygoogle.js` e requisições `ads?client` na aba Rede. Erros `403` exigem verificar conta/políticas; `ERR_BLOCKED_BY_CLIENT` indica bloqueio local. Não alterar as escolhas de consentimento para forçar veiculação.

Referências: [configuração e identidade](https://support.google.com/adsense/answer/7402256?hl=pt-BR), [tamanhos de unidades](https://support.google.com/adsense/answer/9185043?hl=pt-BR), [modificações de código permitidas](https://support.google.com/adsense/answer/9183363?hl=pt-BR), [posicionamento](https://support.google.com/adsense/answer/1346295?hl=pt-BR), [diagnóstico de veiculação](https://support.google.com/adsense/answer/10858959?hl=pt-BR).

## Histórico de verificação — 02/10/2026

Em 02/10/2026, a página inicial, `ads.txt` e `robots.txt` de `https://moviematch-three.vercel.app` responderam HTTP 200 a uma requisição com User-Agent `Mediapartners-Google`, sem login. A página contém a metatag `google-adsense-account` com `ca-pub-8257200313072326`. O arquivo `ads.txt` contém:

```
google.com, pub-8257200313072326, DIRECT, f08c47fec0942fa0
```

O status informado pelo responsável foi **Precisa de revisão / Não encontrado**, com rastreamento de março. Segundo a documentação do Google, o primeiro indica que a verificação/revisão ainda precisa ser solicitada; o segundo indica que o último rastreamento não encontrou o arquivo `ads.txt`. Não comprova reprovação por conteúdo.

No AdSense, abrir **Sites → moviematch-three.vercel.app → Metatag**, comparar o identificador exibido com o acima, marcar que a tag foi inserida e usar **Verificar / Solicitar revisão**. Em `ads.txt`, usar **Verificar se há atualizações**. Se o identificador da conta for diferente, corrigir também a metatag, o arquivo, Funding Choices e os espaços de anúncio antes de solicitar revisão.

Usar o domínio principal público, não uma prévia com autenticação Vercel. Um domínio próprio é recomendado para a marca e uma URL estável, mas não garante aprovação. Google admite subdomínios de plataformas na Public Suffix List; `vercel.app` consta nela. Não há evidência neste status de que a hospedagem Vercel tenha causado uma recusa.

As unidades estão integradas na tela de votação. O preenchimento depende da conta, da revisão do site e das configurações de consentimento no AdSense/Funding Choices. O aplicativo não confirma esses estados administrativos. Slots não são substituídos por tempo decorrido: só se ocultam quando o Google sinaliza `unfilled` ou o carregamento falha. Login, cadastro, páginas vazias e conteúdo adulto não devem receber anúncios. Não clicar nos próprios anúncios durante os testes.

Antes da revisão editorial, publicar o contato real de suporte/privacidade e finalizar os documentos em `legal-review.md`; privilegiar conteúdo público original e útil, além dos metadados do catálogo. Isso não é uma garantia de aprovação.

Fontes: [status dos sites](https://support.google.com/adsense/answer/12170222?hl=pt-BR), [verificação por metatag](https://support.google.com/adsense/answer/13996652?hl=pt-BR), [ads.txt](https://support.google.com/adsense/answer/12171612?hl=pt-BR), [domínios aceitos](https://support.google.com/adsense/answer/12170421?hl=en), [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat), [conteúdo para revisão](https://support.google.com/adsense/answer/7299563?hl=pt-BR).
