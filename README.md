# MovieMatch

O **MovieMatch** é uma aplicação web para ajudar grupos de pessoas a encontrar um filme que todos queiram assistir.

Os participantes entram em uma sessão compartilhada, avaliam filmes com likes e dislikes e acompanham os matches encontrados entre os membros da sessão.

## Funcionalidades

* Criação e entrada em sessões por código
* Sessões compartilhadas entre vários usuários
* Autenticação anônima com Supabase
* Swipe de filmes com like e dislike
* Sincronização de participantes em tempo real
* Detecção de matches
* Histórico e opção de desfazer o último swipe
* Filtros avançados por:

  * gênero
  * ano
  * avaliação
  * quantidade de votos
  * duração
  * idioma
  * serviços de streaming
  * região
  * tipo de oferta
* Consulta de detalhes dos filmes
* Exibição de provedores de streaming
* Verificação de maioridade para conteúdo adulto
* Interface responsiva
* Suporte a PWA
* Página de matches
* Integração com publicidade
* Páginas públicas de privacidade, termos e publicidade

## Tecnologias

### Frontend

* React 19
* TypeScript
* Vite
* React Router
* Tailwind CSS
* Framer Motion
* Lucide React
* Sonner

### Backend e dados

* Supabase

  * autenticação anônima
  * banco de dados
  * Realtime
  * Edge Functions

### Outras integrações

* TMDB para dados e metadados de filmes
* Google AdSense para publicidade

## Estrutura principal

```text
MovieMatch/
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── offline.html
│   ├── privacy.html
│   ├── terms.html
│   └── ads.html
│
├── src/
│   ├── components/
│   ├── lib/
│   ├── pages/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── .env.example
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.js
└── vite.config.ts
```

## Rotas

| Rota               | Função                     |
| ------------------ | -------------------------- |
| `/`                | Página inicial             |
| `/join`            | Entrada em uma sessão      |
| `/s/:code`         | Sessão e seleção de filmes |
| `/s/:code/matches` | Matches da sessão          |

## Requisitos

Para executar o projeto localmente:

* Node.js
* pnpm
* Projeto Supabase configurado

## Instalação

Clone o repositório:

```bash
git clone https://github.com/IsaqueMion/MovieMatch.git
cd MovieMatch
```

Instale as dependências:

```bash
pnpm install
```

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto usando `.env.example` como referência:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
VITE_ENABLE_ANALYTICS=false
```

Nunca versione chaves ou credenciais privadas.

A chave utilizada pelo frontend deve ser somente a chave pública apropriada para aplicações cliente. A segurança do banco de dados não deve depender do sigilo dessa chave, mas das políticas de acesso configuradas no Supabase.

## Desenvolvimento

Inicie o servidor local:

```bash
pnpm dev
```

## Validação do código

Execute o ESLint:

```bash
pnpm lint
```

Execute os testes automatizados:

```bash
pnpm test
```

Os testes unitários usam o test runner nativo do Node.js e cobrem, inicialmente, a assinatura dos filtros, persistência do progresso de swipe e embaralhamento determinístico.

Os testes de navegador cobrem a home em 390, 768 e 1440 pixels, fontes e pôsteres locais, ausência de autenticação ao abrir a página, movimento reduzido, entrada inválida/expirada, erros de conexão e votação com publicidade bloqueada. Todas as chamadas ao Supabase são simuladas nesta suíte.

```bash
pnpm build
pnpm exec playwright install chromium
pnpm test:browser
```

No Windows, o Edge instalado pode ser usado sem baixar outro navegador:

```powershell
$env:BROWSER_CHANNEL = 'msedge'
pnpm test:browser
```

Por padrão a suíte abre seu próprio servidor de preview na porta 4178. Defina `TEST_BASE_URL` para verificar um servidor já iniciado.

## Build de produção

```bash
pnpm build
```

## Visualizar o build

```bash
pnpm preview
```

## PWA

O MovieMatch possui suporte a Progressive Web App.

O Service Worker é registrado somente em ambiente de produção e oferece cache de recursos estáticos e uma página de fallback para situações offline.

## Privacidade

O MovieMatch utiliza autenticação anônima para permitir participação em sessões sem exigir cadastro convencional.

Quando o usuário opta por habilitar conteúdo adulto, a data de nascimento é utilizada apenas para verificar se ele possui 18 anos ou mais. A data completa não é armazenada pelo aplicativo; somente o status de maioridade é persistido.

Mais informações:

* `/privacy.html`
* `/terms.html`
* `/ads.html`

## Status do projeto

O projeto está passando por uma revisão e modernização de sua base de código.

Entre os trabalhos em andamento estão:

* melhoria da organização interna
* revisão da segurança do Supabase
* redução do tamanho dos componentes principais
* melhoria da experiência mobile
* testes automatizados
* otimização de performance
* revisão das regras de negócio de sessões e matches

A branch utilizada para esse trabalho é:

```text
revival/2026-09
```

## Dados de filmes

### Filmes da página inicial

A home sorteia 18 pôsteres distintos e outro filme para o exemplo de match, usando `src/data/landingMovies.json`. O catálogo é obtido da função `discover` já publicada, com nota mínima 7,5, pelo menos 3.000 votos, ordenação por popularidade e conteúdo adulto desativado. Os pôsteres carregam diretamente do CDN do TMDB; título, ano e imagem são selecionados como um único objeto. O filme de exemplo não repete a visita anterior quando o armazenamento local está disponível.

O sorteio acontece uma vez por abertura. Digitar um código ou pausar a animação não troca os filmes. O catálogo acompanha o deploy, mantendo a home sem autenticação nem consultas ao Supabase antes de uma ação do visitante. Para renovar os títulos e depois publicar um novo preview:

```bash
pnpm refresh:landing-catalog
pnpm build
```

O comando usa somente a URL e a chave pública anon da configuração local; não cria usuários nem grava dados no banco. A chave do TMDB permanece na Edge Function. Os testes de navegador simulam o CDN; a verificação visual final também confere o carregamento real das imagens.

### Analytics opcional

O script de Web Analytics só é carregado quando `VITE_ENABLE_ANALYTICS=true`. Ative primeiro Web Analytics no projeto da Vercel e depois configure essa variável e faça um novo deploy. Isso evita tentar executar a página HTML de fallback quando o endpoint de Analytics não está disponível. [Configuração oficial](https://vercel.com/docs/analytics/quickstart).

### Verificação do consenso no Supabase

O script manual `tests/session-consensus.sql` verifica as RPCs publicadas e as escritas sob RLS com um, dois e três participantes, incluindo entrada em sessão expirada. Todos os dados de teste ficam em uma subtransação revertida, e o próprio script confirma que nenhum registro permaneceu. Ele não executa migrações e não faz parte da CI.

Essa verificação do banco complementa os testes de navegador com APIs simuladas. A validação integrada em dispositivos reais deve ser concluída antes da publicação em produção.

Este produto utiliza dados da API do TMDB.

**Este produto usa a API do TMDB, mas não é endossado ou certificado pelo TMDB.**

## Autor

Desenvolvido por [Isaque Mion](https://github.com/IsaqueMion).
