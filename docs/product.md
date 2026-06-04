# Produto

## Visão geral

Planejador Financeiro de Viagens é um app/SaaS que funciona como uma planilha inteligente em formato de aplicativo. O objetivo é eliminar a incerteza financeira de quem quer viajar: o usuário informa para onde quer ir, quando, quanto vai custar e quanto consegue guardar por mês — e o sistema diz exatamente o que fazer.

O produto responde a uma pergunta simples e frequente: **"Consigo viajar para X? Quanto preciso guardar por mês?"**

---

## MVP — Escopo da primeira versão

### 1. Landing page
Página de apresentação do produto com proposta de valor clara e chamada para iniciar o diagnóstico.

### 2. Diagnóstico da viagem
Formulário guiado com as seguintes perguntas:

| Campo | Descrição |
|---|---|
| Destino | Nome do lugar desejado |
| Data de ida | Data prevista de partida |
| Data de volta | Data prevista de retorno |
| Custo estimado da passagem | Valor em R$ |
| Custo estimado da hospedagem | Valor em R$ |
| Custo estimado da alimentação | Valor em R$ |
| Custo estimado de passeios | Valor em R$ |
| Quanto consegue guardar por mês | Valor em R$ |

### 3. Cálculo de custo total
Soma automática de todos os custos estimados informados.

### 4. Cálculo de quanto guardar por mês
Com base no custo total e nos meses disponíveis até a viagem, o sistema calcula o valor mensal necessário.

### 5. Resultado com projeção
Tela de resultado com:
- Custo total previsto
- Valor mensal necessário para viajar na data desejada
- Alerta se o valor que consegue guardar não for suficiente
- Projeção alternativa: em quantos meses conseguiria viajar com o valor atual
- Mensagem de resumo em linguagem simples, ex:
  > "Você vai para Maldivas. Com base nas suas informações, precisa guardar R$ 250 por mês durante 8 meses."

### 6. Dashboard da próxima viagem
Tela simples com o resumo da viagem planejada:
- Destino e datas
- Custo total
- Progresso (quanto já foi guardado vs. quanto falta)
- Contagem regressiva em meses

### 7. Múltiplos destinos (futuro)
Possibilidade de o usuário cadastrar e acompanhar mais de uma viagem ao mesmo tempo, priorizando por data ou por meta financeira.

---

## O que está fora do MVP

- Autenticação de usuário
- Banco de dados persistente
- Integração com dados reais de passagens ou câmbio
- Notificações ou lembretes
- Versão mobile nativa
- Pagamento / plano premium

---

## Fluxo principal do usuário (MVP)

```
Landing page
    ↓
Iniciar diagnóstico
    ↓
Preencher formulário (8 campos)
    ↓
Ver resultado com projeção
    ↓
Dashboard da viagem
```
