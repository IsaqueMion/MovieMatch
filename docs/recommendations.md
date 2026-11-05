# Recomendações pessoais — content-v2

O motor usa os likes e dislikes da identidade autenticada do Supabase para ordenar
filmes e ampliar o catálogo consultado. O primeiro modelo é baseado no conteúdo
dos filmes, com aprendizado imediato e persistência entre sessões. Não é um
modelo treinado na escala do TikTok; a eficácia precisa ser medida com uso real.

## Comportamento

- Gêneros representam 90% da afinidade; década de lançamento representa 10%.
- Likes têm peso +1; dislikes têm peso -0,65, pois uma recusa isolada não significa
  rejeitar todo um gênero. Gêneros duplicados não multiplicam o sinal.
- Evidências perdem metade do peso a cada 60 dias. O perfil considera até 500
  registros recentes e apenas a decisão mais recente por filme.
- Confiança cresce gradualmente (`evidência / (evidência + 6)`), com suavização por
  gênero. O primeiro like já altera a ordem; sem evidência de gênero, permanece
  o catálogo com embaralhamento atual.
- As oito escolhas mais recentes têm peso específico para que uma mudança de
  gosto apareça mesmo depois de muitos votos.
- A ordem usa afinidade, um pequeno peso do catálogo e diversidade entre os três
  filmes anteriores. Uma posição a cada cinco usa exploração determinística;
  esse parâmetro é uma hipótese inicial, não uma taxa ótima comprovada.
- Depois de salvar um voto, a parte ainda não exibida da fila é recalculada.
  O filme atual e os filmes consumidos permanecem estáveis. Falhas não treinam
  o perfil. Desfazer remove o sinal da sessão e preserva votos de outras sessões.
- A busca sempre inclui o catálogo compartilhado. Com confiança suficiente,
  também consulta um dos três gêneros favoritos. Streaming, região, idade,
  anos, duração e exclusões continuam nos filtros dessa consulta. Falhas nessa
  busca adicional não bloqueiam o catálogo compartilhado.
- Filtros explícitos de gênero não são substituídos. Ordenações explícitas,
  como nota ou data de lançamento, têm prioridade sobre a personalização.
- Filmes já votados ficam fora da fila da sessão atual. Filmes votados em outra
  sessão podem reaparecer: os integrantes precisam poder votar nos mesmos filmes
  para chegar a um match. O requisito de consenso do grupo permanece intacto.
- A retomada usa as reações salvas, pois um índice antigo não representa a mesma
  posição depois que as recomendações aprendem.

## Dados e implantação

A migração `personalized_recommendations` cria `recommendation_feedback` e três
RPCs: `record_movie_reaction`, `undo_movie_reaction` e
`list_my_recommendation_feedback`. Gravação e desfazer são transações: o voto e
seu sinal de treinamento mudam juntos. As funções usam `SECURITY INVOKER`, as
políticas existentes de participação na sessão e RLS para acesso ao próprio
histórico. A leitura limita o resultado a 500 registros e usa índice por usuário
e data. Outros integrantes não recebem esse histórico pessoal.

O histórico não tem FK para a sessão: expiração e exclusão da sala não apagam
o gosto aprendido. A exclusão da conta remove o histórico por cascata. Votos
anteriores são importados sem inventar gêneros que o banco antigo não guardava.
Com pouco histórico enriquecido, o cliente consulta os gêneros de até seis
likes e dois dislikes antigos. Os votos futuros incluem os gêneros retornados
pelo catálogo.

O Supabase de produção já aplicou esta migração como `20260930152445`. Se as RPCs
ainda não existirem em outro ambiente, o cliente usa a gravação antiga e aprende apenas na página atual.
Outros erros de permissão ou conexão não acionam esse fallback.

A identidade atual é anônima e persistida no navegador pelo Supabase. Trocar
de aparelho, limpar o armazenamento ou criar outra identidade perde a continuidade
do perfil. Continuidade entre aparelhos requer login e vínculo da conta anônima.

Na revisão de segurança, os avisos de
[visibilidade do schema GraphQL](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed)
e [contas anônimas autenticadas](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins)
são compatíveis com o desenho do app: a tabela pode ser descoberta, mas suas
linhas são limitadas ao dono por RLS. O teste verifica tanto leitura direta da
tabela quanto a RPC com outra identidade. As novas funções não elevam privilégios.

## Validação e evolução

`pnpm test` verifica sinais positivos/negativos, recência, confiança, repetição,
exploração, deduplicação e estabilidade da fila. `pnpm test:browser` cobre votos,
desfazer, recarga, filtros explícitos, falhas e compatibilidade com o banco antigo,
com APIs simuladas. `tests/recommendation-feedback.sql` verifica transações,
RLS, expiração, remoção de salas e contas, revertendo todos os dados de teste.

Para avaliar retenção, executar um experimento com usuários divididos de forma
estável entre o catálogo atual e o motor pessoal. Registrar impressões reais,
decisões, matches e retornos, com versão e braço do experimento. Comparar taxa
de likes por impressão, swipes até o primeiro match, sessões que chegam a match
e retorno em 1/7 dias. Essas métricas e o experimento ainda não estão instrumentados.
Mais swipes sem encontrar um filme não devem ser tratados como sucesso.

Os próximos sinais úteis são confirmação de filme assistido, avaliação após
assistir, temas/atores/diretores e similaridade entre usuários com histórico
suficiente. Tempo olhando um card não é, sozinho, prova de preferência. Adicionar
esses sinais depois de instrumentar resultados permite calibrar pesos e comparar
modelos com evidências, sem prometer ganho de retenção antes de medi-lo.
