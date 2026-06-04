# CLAUDE.md

Guia para o agente de IA trabalhar neste projeto.

## O que é este projeto

App/SaaS de planejamento financeiro de viagens. O usuário preenche um diagnóstico com dados da viagem (destino, datas, custos estimados, quanto consegue guardar por mês) e o sistema calcula quanto precisa guardar por mês para realizar a viagem na data desejada.

## Stack

- Next.js 16 + App Router
- TypeScript
- Tailwind CSS
- ESLint
- npm (nunca usar yarn ou pnpm)

## Convenções do projeto

- Todo conteúdo voltado ao usuário deve estar em **português**
- Usar `src/` como diretório raiz do código
- Componentes em `src/components/`, lógica de negócio em `src/lib/`, tipos em `src/types/`
- Não usar alias de importação (`@/` já está configurado pelo Next.js)
- Não criar comentários óbvios no código

## Estado atual

- Sem autenticação
- Sem banco de dados
- Sem deploy configurado
- MVP focado em: diagnóstico → cálculo → resultado

## Arquivos de domínio importantes

- `src/types/travel.ts` — tipos `TravelDiagnostic` e `TravelPlan`
- `src/lib/calculations.ts` — função `calculateTravelPlan()`

## Documentação

Toda a documentação do produto está em `docs/`. Consulte antes de implementar novas funcionalidades.
