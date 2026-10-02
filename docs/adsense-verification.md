# AdSense — verificação do MovieMatch

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
