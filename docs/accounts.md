# Contas e perfis

Visitantes continuam criando salas, entrando por código, votando e marcando assistidos. Uma conta com e-mail confirmado habilita salvar salas, publicar avaliações e votar nas opiniões da comunidade.

- `/conta`: cadastro, entrada e recuperação de senha.
- `/salas`: salas pessoais salvas. Uma sala permanece sem expiração enquanto alguém a mantiver salva; depois da última remoção, expira em 24 horas.
- `/perfil`: foto, capa, nome público, endereço, bio, até cinco gêneros e quatro filmes favoritos.
- `/p/:handle`: perfil público, com controles para ocultar o perfil, favoritos e a seção de avaliações. Avaliações publicadas continuam públicas no filme; histórico e salas não são publicados. Imagens enviadas são públicas por URL.

O visitante recebe um comprovante privado de uso único, válido por 24 horas, antes da troca de identidade. Ao entrar em uma conta confirmada na mesma aba, seus votos, participação e assistidos são transferidos em uma transação. Em filmes repetidos, prevalece o histórico existente da conta; avaliações antigas do visitante são preservadas. A transferência não concede privilégios premium ou autorização para conteúdo adulto.

Fotos são convertidas para WebP no navegador, sem metadados, limitadas a 512 px para avatar e 1600 px para capa. As políticas de Storage e do banco verificam propriedade; nome e autor de avaliações são definidos no servidor. Nenhum e-mail ou ID privado de autenticação aparece no perfil público.

## Configuração de e-mail antes da publicação

Cadastro por e-mail está habilitado no projeto, com confirmação obrigatória. O transporte de e-mails e a configuração administrativa de redirects não foram validados nesta entrega. Conferir no Supabase:

1. Site URL: `https://moviematch-three.vercel.app`.
2. Autorizar `https://moviematch-three.vercel.app/conta**` e o endereço específico do preview para confirmação e recuperação. Não liberar todos os domínios.
3. Verificar SMTP e entrega real a um endereço de teste. O serviço padrão tem restrições para destinatários; não assumir que atende novos clientes.
4. Testar cadastro → confirmação → entrada e recuperação → nova senha. A senha é digitada somente no site.

Referências oficiais: [redirects](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [contas anônimas](https://supabase.com/docs/guides/auth/auth-anonymous).

## Validação

Lint, build e 87 testes de lógica/navegador passaram sobre o conjunto exato de arquivos destinado ao preview. Três scripts SQL transacionais verificaram histórico, votos, propriedade, restrição de visitantes, persistência de salas e privacidade; todos os dados de teste foram revertidos. As rotas de conta/perfil são `noindex`, inclusive antes do JavaScript. A busca de favoritos é a Edge Function `search_movies`, autenticada e restrita a contas confirmadas.

Os avisos do Supabase para RPCs com `SECURITY DEFINER` são intencionais nesta API, com `search_path` fixo e verificações explícitas de acesso. Permanecem as tarefas anteriores de atualização do Postgres e revisão de proteção contra senhas vazadas. A conferência administrativa de e-mail acima é o requisito externo ainda pendente.
