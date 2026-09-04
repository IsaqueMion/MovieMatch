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

Este produto utiliza dados da API do TMDB.

**Este produto usa a API do TMDB, mas não é endossado ou certificado pelo TMDB.**

## Autor

Desenvolvido por [Isaque Mion](https://github.com/IsaqueMion).
