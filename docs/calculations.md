# Cálculos

Documentação da lógica financeira implementada em `src/lib/calculations.ts`.

---

## Entradas

O cálculo recebe um objeto `TravelDiagnostic` com os seguintes campos:

| Campo | Tipo | Descrição |
|---|---|---|
| `destination` | string | Nome do destino |
| `departureDate` | string | Data de ida (ISO 8601) |
| `returnDate` | string | Data de volta (ISO 8601) |
| `estimatedFlightCost` | number | Custo estimado da passagem (R$) |
| `estimatedAccommodationCost` | number | Custo estimado da hospedagem (R$) |
| `estimatedFoodCost` | number | Custo estimado da alimentação (R$) |
| `estimatedActivitiesCost` | number | Custo estimado de passeios (R$) |
| `monthlySavings` | number | Quanto o usuário consegue guardar por mês (R$) |

---

## Fórmulas

### 1. Custo total da viagem

```
custoTotal = passagem + hospedagem + alimentação + passeios
```

### 2. Meses até a viagem

```
mesesAtéViagem = ceil((dataIda - hoje) / 30 dias)
mínimo = 1 (nunca negativo)
```

### 3. Quanto precisa guardar por mês

```
economiasMensaisNecessárias = custoTotal / mesesAtéViagem
```

### 4. O valor guardado é suficiente?

```
suficiente = (economiasMensaisDoUsuário >= economiasMensaisNecessárias)
```

### 5. Caso não seja suficiente: em quantos meses conseguiria viajar?

```
mesesNecessários = ceil(custoTotal / economiasMensaisDoUsuário)
```

### 6. Mensagem de resumo

Se suficiente:
> "Você vai para [destino]. Com base nas suas informações, precisa guardar R$ [economiasMensaisNecessárias] por mês durante [mesesAtéViagem] meses."

Se insuficiente:
> "Você vai para [destino]. Com base nas suas informações, precisa guardar R$ [economiasMensaisDoUsuário] por mês durante [mesesNecessários] meses."

---

## Exemplos

### Exemplo 1 — Valor suficiente

| Entrada | Valor |
|---|---|
| Destino | Cancún |
| Data de ida | daqui a 10 meses |
| Passagem | R$ 2.000 |
| Hospedagem | R$ 1.500 |
| Alimentação | R$ 800 |
| Passeios | R$ 700 |
| Guarda por mês | R$ 600 |

**Cálculo:**
- Custo total: R$ 5.000
- Meses até a viagem: 10
- Precisa guardar: R$ 500/mês
- Guarda R$ 600 → suficiente

**Resultado:**
> "Você vai para Cancún. Com base nas suas informações, precisa guardar R$ 500 por mês durante 10 meses."

---

### Exemplo 2 — Valor insuficiente

| Entrada | Valor |
|---|---|
| Destino | Maldivas |
| Data de ida | daqui a 6 meses |
| Passagem | R$ 8.000 |
| Hospedagem | R$ 4.000 |
| Alimentação | R$ 1.500 |
| Passeios | R$ 500 |
| Guarda por mês | R$ 500 |

**Cálculo:**
- Custo total: R$ 14.000
- Meses até a viagem: 6
- Precisaria guardar: R$ 2.334/mês
- Guarda R$ 500 → insuficiente
- Com R$ 500/mês: precisaria de 28 meses

**Resultado:**
> "Você vai para Maldivas. Com base nas suas informações, precisa guardar R$ 500 por mês durante 28 meses."

---

## Regras de negócio

- O número de meses nunca é menor que 1, mesmo se a data já passou.
- Os valores são sempre arredondados para cima (`Math.ceil`) para garantir que o usuário não fique com déficit.
- A mensagem usa o valor que o usuário consegue guardar quando o cenário é de insuficiência, não o valor ideal.
