# Arquitetura

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript |
| Estilo | Tailwind CSS |
| Lint | ESLint |
| Gerenciador de pacotes | npm |

---

## Estrutura de diretórios

```
/
├── src/
│   ├── app/                    # Rotas e páginas (App Router)
│   │   ├── layout.tsx          # Layout raiz
│   │   ├── page.tsx            # Landing page (/)
│   │   ├── diagnostico/        # Formulário de diagnóstico
│   │   │   └── page.tsx
│   │   ├── resultado/          # Tela de resultado
│   │   │   └── page.tsx
│   │   └── dashboard/          # Dashboard da viagem
│   │       └── page.tsx
│   ├── components/
│   │   └── ui/                 # Componentes genéricos reutilizáveis
│   ├── lib/
│   │   └── calculations.ts     # Lógica financeira
│   └── types/
│       └── travel.ts           # Tipos do domínio
├── docs/                       # Documentação do produto
├── public/                     # Arquivos estáticos
├── CLAUDE.md                   # Guia para o agente de IA
└── README.md                   # Documentação geral
```

---

## Rotas planejadas

| Rota | Descrição |
|---|---|
| `/` | Landing page |
| `/diagnostico` | Formulário de diagnóstico |
| `/resultado` | Tela de resultado com projeção |
| `/dashboard` | Dashboard da viagem planejada |

---

## Fluxo de dados (MVP sem banco)

No MVP, os dados trafegam via estado local (React) e/ou `localStorage`. Não há banco de dados nem autenticação.

```
Formulário (/diagnostico)
    ↓  dados do usuário (TravelDiagnostic)
calculateTravelPlan() em src/lib/calculations.ts
    ↓  resultado calculado (TravelPlan)
Tela de resultado (/resultado)
    ↓  dados salvos em localStorage
Dashboard (/dashboard)
```

---

## Tipos principais

### TravelDiagnostic
Dados brutos coletados pelo formulário de diagnóstico.

```ts
type TravelDiagnostic = {
  destination: string;
  departureDate: string;
  returnDate: string;
  estimatedFlightCost: number;
  estimatedAccommodationCost: number;
  estimatedFoodCost: number;
  estimatedActivitiesCost: number;
  monthlySavings: number;
};
```

### TravelPlan
Resultado calculado pelo sistema.

```ts
type TravelPlan = {
  totalCost: number;
  monthsUntilTrip: number;
  requiredMonthlySavings: number;
  isSavingsSufficient: boolean;
  monthsNeededIfInsufficient: number | null;
  summaryMessage: string;
};
```

---

## Decisões técnicas

**Por que App Router?**
Padrão atual do Next.js. Permite layouts aninhados, Server Components e carregamento mais granular por rota.

**Por que sem banco de dados no MVP?**
Para validar o produto sem infraestrutura. O `localStorage` é suficiente para uma viagem por vez. O banco entra quando houver necessidade de persistência multi-sessão ou múltiplos destinos.

**Por que sem autenticação no MVP?**
Reduz complexidade inicial. A lógica de cálculo e a experiência do usuário são validadas antes de adicionar conta e login.
