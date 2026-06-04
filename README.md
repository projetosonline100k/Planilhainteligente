# Planejador Financeiro de Viagens

App/SaaS de planejamento financeiro de viagens. Funciona como uma planilha inteligente em formato de aplicativo: o usuário informa os dados da viagem e o sistema calcula automaticamente quanto precisa guardar por mês para chegar lá.

## Stack

- **Next.js 16** com App Router
- **TypeScript**
- **Tailwind CSS**
- **ESLint**
- **npm**

## Estrutura do projeto

```
src/
├── app/           # Rotas e páginas (App Router)
├── components/    # Componentes reutilizáveis
│   └── ui/        # Componentes de interface genéricos
├── lib/           # Lógica de negócio e utilitários
└── types/         # Tipos TypeScript do domínio
docs/              # Documentação do produto e arquitetura
```

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Scripts disponíveis

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção
npm run lint     # verificação de lint
```

## Documentação

- [Produto](docs/product.md) — visão geral, MVP e roadmap
- [Arquitetura](docs/architecture.md) — estrutura técnica e decisões
- [Cálculos](docs/calculations.md) — lógica financeira do sistema
- [Tarefas](docs/tasks.md) — backlog e status das entregas
