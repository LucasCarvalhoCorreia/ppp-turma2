# Testes de performance com k6

Este diretório contém um script k6 para executar um fluxo representativo da API:

- Login como cabeleireiro e registro de um horário disponível
- Login como cliente
- Listagem de serviços
- Criação de um compromisso usando o horário registrado

Requisitos
- Ter o binário `k6` instalado na máquina. Veja https://k6.io/docs/getting-started/installation

Execução local (exemplo):

```bash
# executa 20 VUs por 30s
BASE_URL=http://localhost:3000 VUS=20 DURATION=30s k6 run tests/perf/k6/default.k6.js
```

Alternativa via npm (requer k6 disponível no PATH):

```bash
npm run perf:k6
```

Variáveis de ambiente úteis:
- BASE_URL: URL base da API (padrão: http://localhost:3000)
- VUS: número de usuários virtuais
- DURATION: duração do teste (ex: 30s, 1m)

Notas
- O script usa os usuários seededs da base em memória: `carlos@salon.com` (cabeleireiro) e `joana@cliente.com` (cliente), ambos com senha `senha123`.
- O script tenta criar horários e compromissos; se você estiver rodando em paralelo com outros testes, podem ocorrer falhas de disponibilidade (horário já usado) — o k6 reportará as checagens com falhas.
