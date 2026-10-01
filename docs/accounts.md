# Contas e perfis

Visitantes continuam criando salas, entrando por código, votando e marcando assistidos. Uma conta com e-mail confirmado habilita salvar salas, publicar avaliações e votar nas opiniões da comunidade.

- `/conta`: entrada e recuperação de senha. `/conta?modo=cadastro` abre o cadastro diretamente; o parâmetro `voltar` é preservado entre formulários.
- `/#minhas-salas`: seção pessoal da home, visível apenas para contas, com salas salvas e ação para retomar. `/salas` redireciona para essa seção. Uma sala permanece sem expiração enquanto alguém a mantiver salva; depois da última remoção, expira em 24 horas.
- `/perfil`: foto, capa, nome público, endereço, bio, até cinco gêneros e quatro filmes favoritos.
- `/p/:handle`: perfil público, com controles para ocultar o perfil, favoritos e a seção de avaliações. Avaliações publicadas continuam públicas no filme; histórico e salas não são publicados. Imagens enviadas são públicas por URL.

O visitante recebe um comprovante privado de uso único, válido por 24 horas, antes da troca de identidade. Ao entrar em uma conta confirmada na mesma aba, seus votos, participação e assistidos são transferidos em uma transação. Em filmes repetidos, prevalece o histórico existente da conta; avaliações antigas do visitante são preservadas. A transferência não concede privilégios premium ou autorização para conteúdo adulto.

Após entrar e concluir a transferência, a navegação sempre termina na home (`/`). O parâmetro `voltar` orienta somente a ação de continuar como visitante. A home mantém criar sessão e entrar por código para ambos os públicos; visitantes não consultam perfis/salas nem criam uma identidade anônima antes de agir.

Fotos são convertidas para WebP no navegador, sem metadados, limitadas a 512 px para avatar e 1600 px para capa. As políticas de Storage e do banco verificam propriedade; nome e autor de avaliações são definidos no servidor. Nenhum e-mail ou ID privado de autenticação aparece no perfil público.

## Configuração de e-mail antes da publicação

Cadastro por e-mail está habilitado no projeto, com confirmação obrigatória. Em 01/10/2026, o proprietário confirmou que o SMTP personalizado está desabilitado. A entrega real de e-mails e a configuração administrativa de redirects ainda precisam ser validadas. Conferir no Supabase:

1. Site URL: `https://moviematch-three.vercel.app`.
2. Autorizar `https://moviematch-three.vercel.app/conta**` e o endereço específico do preview para confirmação e recuperação. Não liberar todos os domínios.
3. Verificar SMTP e entrega real a um endereço de teste. O serviço padrão tem restrições para destinatários; não assumir que atende novos clientes.
4. Testar cadastro → confirmação → entrada e recuperação → nova senha. A senha é digitada somente no site.

Referências oficiais: [redirects](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [contas anônimas](https://supabase.com/docs/guides/auth/auth-anonymous).

## Referência de interface

Entrada e cadastro adaptam a composição do [Efferd auth-2](https://legacy.efferd.com/view/auth-2), com o [código do registry](https://legacy.efferd.com/r/auth-2.json): painel lateral com linhas animadas e formulário compacto. A marca, textos, campos e ações são do MovieMatch. `FloatingPaths` reutiliza `motion`, já instalado, com duração determinística e preferência por movimento reduzido. Botões e campos existentes substituem os exemplos de login social, mantendo e-mail/senha e sem alterar o tema global ou adicionar dependências.

Os formulários usam ícone de e-mail, com a recuperação depois do campo de senha na ordem de Tab. Cadastro e redefinição exigem confirmação exata da senha; os pontos animados adaptam a [confirmação assistida](https://github.com/wundercorp/awesome-components/tree/main/components/l/ln-dev7/assisted-password-confirmation/default). O indicador segmentado adapta o [Password Strength do interior.dev](https://www.interior.dev/docs/password-strength), usando `motion` existente. O mínimo permanece oito caracteres; mistura de letras, números e símbolos são sugestões. Nenhuma senha é armazenada no navegador ou enviada para medir a força.

Editar perfil abre um diálogo nativo, na home ou no perfil, inspirado no [Origin UI edit-profile-dialog](https://github.com/wundercorp/awesome-components/tree/main/components/o/originui/dialog/edit-profile-dialog). Fotos ficam em prévia local até salvar; Cancelar descarta o rascunho. Falhas preservam textos e a foto anterior; se uma foto tiver sido salva antes de outra operação falhar, a mensagem informa a atualização parcial. O avatar aumenta e só então revela uma prévia com capa, nome e bio, sem e-mail. A referência é [User Avatars](https://github.com/wundercorp/awesome-components/tree/main/components/u/user_hardp/user-avatars/default). Escape dispensa a prévia; no toque, o clique abre o menu. A lista de participantes do swipe permanece para outra etapa.

## Validação

A navegação da home adapta o [Origin UI navbar3](https://github.com/wundercorp/awesome-components/tree/main/components/o/originui/navigation-menu-4/navbar3); o menu do avatar usa como referência o [Kokonut profile-dropdown](https://github.com/wundercorp/awesome-components/tree/main/components/k/kokonutd/profile-dropdown/default). As ações levam ao perfil, edição, assistidos, salas na home e saída da conta. O menu de perfil suporta teclado, Escape e clique fora; o menu móvel usa `details` nativo. Nenhuma dependência nova foi adicionada.

Lint, build e 100 testes de lógica/navegador passaram sobre o conjunto exato de arquivos destinado ao preview, com APIs simuladas nos testes de interface. Três scripts SQL transacionais verificaram histórico, votos, propriedade, restrição de visitantes, persistência de salas e privacidade; todos os dados de teste foram revertidos. As rotas de conta/perfil são `noindex`, inclusive antes do JavaScript. A busca de favoritos é a Edge Function `search_movies`, autenticada e restrita a contas confirmadas.

Os avisos do Supabase para RPCs com `SECURITY DEFINER` são intencionais nesta API, com `search_path` fixo e verificações explícitas de acesso. Permanecem as tarefas anteriores de atualização do Postgres e revisão de proteção contra senhas vazadas. A conferência administrativa de e-mail acima é o requisito externo ainda pendente.
