---
title: Validação de nascimento e estabilidade do cadastro
author: Isaque
date: 2026-10-26
branch: codex/account-age-adblock
touches:
  - src/styles/account.css
  - tests/accounts.browser.mjs
  - supabase/migrations/20261026162638_account_birthdate_age_gate.sql
---

## Decided
Reservar 1280px no painel de acesso preserva a altura ao alternar login/cadastro após incluir o nascimento; não esconder ou comprimir os campos para caber no espaço antigo. O teste existente de idioma e estabilidade detectou o aumento e passou depois do ajuste.
## Tried and ruled out
trail check sinalizou cinco correspondências textuais: maioridade em privacidade, aria-hidden em isca e decoração, nascimento nas traduções e flag no teste de menor. São falsos positivos: a data prevalece sobre o flag, aria-hidden não fecha diálogos e os testes verificam explicitamente o bloqueio. Não remover acessibilidade nem enfraquecer testes para satisfazer a heurística.
## Watch out
Migração remota 20261026162638 aplicada e teste de segurança revertido integralmente. Discover v10 exige JWT e consulta elegibilidade do solicitante. Nenhum novo advisory; 21 avisos já existiam. Bloqueio só de rede pode não ser detectado pelo aviso cosmético.
