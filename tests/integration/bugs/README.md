Este diretório contém testes de integração que automatizam, de ponta a ponta, os cenários de bug descritos em `wiki/Historico-de-Bugs.md`, cobrindo APIs, services e regras de negócio afetadas.

Visão geral
- Padrão da suíte: MODO ESTRITO — cada teste descreve o COMPORTAMENTO ESPERADO do software e FALHA enquanto o bug existir.
- Modo permissivo (opcional): defina `BUGS_LOOSE=1` para executar em modo "expected-fail"; útil quando você quer reproduzir os bugs sem quebrar o pipeline.
- Frameworks: Jest 29 + supertest 7. Banco em memória (`src/models/db.js`).

Como rodar
- Rodar apenas a suíte de bugs (estrito, padrão):
```bash
npm run test:bugs
```

- Rodar em modo permissivo (expected-fail):
```bash
BUGS_LOOSE=1 npm run test:bugs
```

Observações de ambiente
- No Windows usando bash (Git Bash), a sintaxe acima funciona. Em PowerShell, use: `$env:BUGS_LOOSE=1; npm run test:bugs`.
- A suíte inicia processos Node adicionais em BUG-001; portas aleatórias na faixa 41000-41999 são usadas para evitar conflitos com o ambiente local.

Estado atual (04/11/2025)
- Modo estrito: 9/9 testes FALHAM — coerente com a existência dos bugs.
- Modo permissivo (`BUGS_LOOSE=1`): 9/9 testes PASSAM — cada teste está marcado com expected-fail dinamicamente via alias `tf` no início da suíte.

Mapeamento e critérios por bug
- BUG-001 — Porta em uso ao iniciar (EADDRINUSE)
	- Rotas/arquivo: `src/index.js` (bootstrap do servidor).
	- Cenário atual: iniciar 2 processos na mesma porta faz o segundo sair com erro (EADDRINUSE).
	- Comportamento esperado: tratamento gracioso (exit code 0 sem EADDRINUSE) ou fallback de porta com mensagem clara.
	- Critério do teste: segundo processo não deve terminar com erro nem escrever EADDRINUSE no stderr.

- BUG-002 — Senhas armazenadas em texto
	- Rotas/arquivo: `src/services/authService.js` e `db.js`.
	- Cenário atual: senha fica em texto puro no DB em memória.
	- Comportamento esperado: senha com hash (ex.: bcrypt, prefixo `$2a|$2b|$2y$`).
	- Critério do teste: senha persistida deve ser diferente da informada e casar com regex de hash bcrypt.

- BUG-003 — Double-booking (condição de corrida em compromissos)
	- Rotas/arquivo: `src/services/compromissosService.js` e `/compromissos`.
	- Cenário atual: lógica não atômica; em teoria duas requisições simultâneas podem usar o mesmo slot.
	- Comportamento esperado: exatamente uma 201 e a outra 409 com mensagem clara de indisponibilidade; DB com apenas 1 compromisso para o slot.
	- Nota: o teste simula paralelismo no mesmo processo. Corridas entre processos/instâncias exigem estratégia de lock/transação no armazenamento.

- BUG-004 — Validação fraca de data/hora (timezone/offset)
	- Rotas/arquivo: `cabeleireirosService.registrarHorario`, `compromissosService.criar`.
	- Cenário atual: comparação de strings impede equivalência de fuso/offset.
	- Comportamento esperado: normalização para instante (UTC) e equivalência de offsets.
	- Critério do teste: agendar com offset equivalente retorna 201.

- BUG-005 — Falta validar papel do `cabeleireiroId`
	- Rotas/arquivo: `compromissosService.criar` (validação do id e papel).
	- Cenário atual: é possível agendar usando id de cliente como se fosse cabeleireiro.
	- Comportamento esperado: rejeição do agendamento (400/403/404) quando o id não for de um cabeleireiro válido.

- BUG-006 — Remoção de serviço com compromissos existentes
	- Rotas/arquivo: `servicosService.remover` e `/servicos/:id`.
	- Cenário atual: permite remover serviço deixando compromissos órfãos.
	- Comportamento esperado: bloquear remoção (409/400) se houver compromissos vinculados (especialmente futuros), ou tratar em cascata conforme regra.

- BUG-007 — Atualização de serviço não normaliza tipos
	- Rotas/arquivo: `servicosService.atualizar`.
	- Cenário atual: `preco` atualizado pode permanecer string.
	- Comportamento esperado: coerção para number e validações de limite/formato.

- BUG-008 — Falta de validação/sanitização de entrada
	- Rotas/arquivo: vários endpoints, ex.: `POST /cabeleireiros/horarios`, `POST /servicos`.
	- Cenário atual: aceita `dataHora` inválido e `preco` não numérico (vira `null` no JSON por `NaN`).
	- Comportamento esperado: rejeitar com 400 e mensagem clara de validação.

Boas práticas para correção
- Autenticação: usar `bcrypt` para hash de senha; ajustar `login` para `bcrypt.compare`.
- Datas: normalizar para UTC com bibliotecas (Luxon/date-fns) ou `Date` + validação ISO 8601; armazenar timestamps/instantes.
- Atomicidade: checagem/remoção de slot de forma atômica (lock por chave de slot, transação ou verificação pós-inserção com rollback).
- Validação: introduzir camadas de validação (Joi/celebrate) nas rotas; retornar mensagens claras (ex.: `{ erro: "campo X inválido" }`).
- Integridade referencial: impedir DELETE de serviço vinculado a compromissos futuros ou definir regra de cascata.

Fluxo de manutenção dos testes
1) Implementou a correção? Rode em modo estrito: `npm run test:bugs`.
2) Quando o teste passar, mantenha-o como está (ele já descreve o comportamento esperado). O alias `tf` continuará usando `test` em modo estrito e `test.failing` em modo permissivo.
3) Se quiser, pode simplificar removendo a necessidade do alias para casos já corrigidos (trocando `tf` por `test`).

Scripts disponíveis (package.json)
- `test:bugs`: executa somente a suíte de bugs em modo estrito.
- `test:bugs:loose`: executa a suíte com `BUGS_LOOSE=1` (expected-fail).

Traceabilidade
- Origem dos cenários: `wiki/Historico-de-Bugs.md`.
- Implementação dos testes: `tests/integration/bugs/bugs.spec.js`.

Limitações conhecidas
- BUG-003 ainda não simula concorrência entre processos/instâncias; para isso, use ferramentas de carga (k6/autocannon) e/ou storage transacional.
