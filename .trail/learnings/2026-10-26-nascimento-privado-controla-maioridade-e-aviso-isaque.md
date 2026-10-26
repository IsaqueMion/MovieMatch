---
title: Nascimento privado controla maioridade e aviso adblock por visita
author: Isaque
date: 2026-10-26
branch: codex/account-age-adblock
touches:
  - package.json
  - public/privacy.html
  - src/components/AdblockWall.tsx
  - src/components/AgeGateModal.tsx
  - src/components/swipe/FilterModal.tsx
  - src/components/swipe/SwipeTutorial.tsx
  - src/data/translations.json
  - src/pages/Account.tsx
  - src/pages/Swipe.tsx
  - src/styles/swipe.css
---

## Decided
Cadastro recebe data de nascimento válida. Guardar somente no registro privado public.users (RLS por proprietário), nunca nos perfis públicos. A maioridade é recalculada pelo calendário UTC no cliente e no banco; completar 18 libera a opção, sem selecionar conteúdo adulto automaticamente. Ler metadata apenas como entrada de criação; alterações futuras de user_metadata não mudam a data registrada. RPC de salvamento é idempotente para mesma data, rejeita substituição e acesso de outro usuário.
Discover consulta adult_content_allowed com o token do próprio solicitante antes de include_adult=true. Falha, ausência de autenticação ou resposta diferente de true mantêm o catálogo não adulto; resposta privada/no-store evita cache compartilhado. Conservar compatibilidade de contas antigas sem nascimento e flag legada, enquanto uma data registrada sempre prevalece sobre o flag.
Aviso adblock usa ocultação de isca comparada a controle neutro; erro de rede isolado não prova bloqueio. Dispensa vale para a visita, sem chave persistida que esconda o aviso nas visitas futuras. Card usa dependências existentes e fica no fluxo. Tutorial usa a mesma grade de três colunas para botões e teclas na ordem Passo, Desfazer, Quero assistir.
## Tried and ruled out
Não instalar shadcn/Radix/CVA para reproduzir o card; adaptar a referência usando motion, lucide e botões nativos já disponíveis. Não confiar em flag de maioridade gravado uma vez nem em metadata editável para liberar uma conta com nascimento registrado. Não ativar o filtro por efeito de aniversário. Não tratar falha AdSense ou consentimento como evidência de bloqueador.
## Watch out
Publicar a migração antes da Edge Function e do frontend. Data informada é autodeclarada, não prova documental de idade; calendário UTC evita divergência entre servidor e cliente. Bloqueadores exclusivamente de rede sem ocultação cosmética podem não produzir evidência suficiente para o aviso. Testar aniversário com aba aberta, menores com flag legado true, privacidade/imutabilidade do nascimento, cadastro legado, saída/retorno ao swipe e foco após dispensar.
