# WIKI — API do Salão de Beleza

Bem-vindo(a) à documentação wiki do projeto API do Salão de Beleza. Este documento reúne informações de alto nível sobre o produto, requisitos, épicos, critérios de aceite e um plano de testes detalhado.

---

## Home

Resumo: API REST para agendamento de serviços em um salão de beleza. Fornece cadastro/autenticação de usuários (clientes e cabeleireiros), gerenciamento de serviços, registro de horários disponíveis por cabeleireiros e agendamento de compromissos por clientes. Documentação interativa via Swagger em `/docs`.

---

## Requisitos

### Requisitos Funcionais (RF)

RF1 - Cadastro de Usuário
- O sistema deve permitir o cadastro de um novo usuário com nome, email, senha e papel (cliente ou cabeleireiro).

RF2 - Autenticação
- O sistema deve permitir login com email e senha e retornar um token JWT válido.

RF3 - Gerenciamento de Serviços
- O sistema deve permitir listar serviços disponíveis.
- O sistema deve permitir que cabeleireiros adicionem, atualizem e removam serviços.

RF4 - Horários Disponíveis
- Cabeleireiros devem registrar horários disponíveis.
- O sistema deve disponibilizar uma API para listar horários de um cabeleireiro.

RF5 - Agendamento
- Clientes devem poder criar compromissos para serviços em horários disponíveis.
- Ao agendar, o horário deve ser removido dos horários disponíveis.

RF6 - Consulta de Compromissos
- Clientes podem listar seus compromissos.
- Cabeleireiros podem listar os compromissos agendados com eles.

### Requisitos Não Funcionais (RNF)

RNF1 - Segurança
- Autenticação por JWT; rotas protegidas devem validar token.

RNF2 - Persistência
- Implementação atual usa banco em memória (dados voláteis). Em produção, usar banco persistente.

RNF3 - Desempenho
- Latência alvo: respostas em < 200ms em ambiente local para operações CRUD simples.

RNF4 - Documentação
- API documentada com OpenAPI/Swagger em `resources/swagger.yaml` e servida em `/docs`.

RNF5 - Testabilidade
- Projeto deve ser testável via testes unitários e de integração (Jest + Supertest sugeridos).

---

## Épicos e User Stories

Épico 1 — Autenticação e Autorização
- US-1.1: Como usuário, quero me cadastrar para usar a aplicação.
- US-1.2: Como usuário, quero fazer login para receber um token que autorize minhas ações.

Épico 2 — Serviços
- US-2.1: Como cliente, quero listar serviços para escolher um.
- US-2.2: Como cabeleireiro, quero cadastrar serviços que ofereço.

Épico 3 — Horários e Agendamentos
- US-3.1: Como cabeleireiro, quero registrar horários disponíveis.
- US-3.2: Como cliente, quero agendar um serviço em um horário disponível.
- US-3.3: Como usuário, quero ver meus agendamentos.

---

## Critérios de Aceite

- Todos os endpoints documentados no Swagger devem responder conforme os schemas definidos.
- Rotas protegidas exigem token válido; respostas 401/403 conforme necessário.
- Criar compromisso exige que o horário esteja presente em `horariosDisponiveis`; após agendamento, o horário é removido.
- Serviços só podem ser criados/alterados/removidos por usuários com papel `cabeleireiro`.

---

## Plano de Testes

Objetivo: validar as regras de negócio, fluxos críticos (cadastro, login, registro de horário, agendamento) e garantir que erros esperados retornem códigos corretos.

Abordagem:
- Unit tests: serviços (authService, servicosService, compromissosService, cabeleireirosService)
- Integration tests: endpoints via Supertest (rotas + middlewares)
- Smoke tests: rota raiz `/` e `/docs`

Ferramentas:
- Jest
- Supertest

Ambiente de teste:
- Exportar `app` sem chamar `listen()` para permitir testes com Supertest.
- Resetar `db` antes de cada teste (módulo `src/models/db.js` deve permitir reinicialização ou os testes devem mockar o módulo).

Métricas de sucesso:
- Todos os testes unitários e de integração passam
- Cobertura alvo: >= 80% (opcional)

---

## Casos de Teste (exemplos selecionados)

Para cada caso abaixo descrever entrada, passos, saída esperada e pré-condições.

1) CT-Auth-01: Cadastro de usuário (happy path)
- Pré-condição: email não cadastrado
- Passos: POST /auth/cadastrar com {nome,email,senha,papel}
- Esperado: 201 + corpo com {id,nome,email,papel} (sem senha)

2) CT-Auth-02: Login com credenciais válidas
- Pré-condição: usuário cadastrado
- Passos: POST /auth/login com {email,senha}
- Esperado: 200 + {token} (token válido JWT)

3) CT-Serv-01: Listar serviços
- Passos: GET /servicos
- Esperado: 200 + array de serviços com campos esperados

4) CT-Serv-02: Criar serviço sem token
- Passos: POST /servicos sem header Authorization
- Esperado: 401

5) CT-Hor-01: Cabeleireiro registra horário
- Pré-condição: token do cabeleireiro
- Passos: POST /cabeleireiros/horarios {dataHora}
- Esperado: 201 + horário criado

6) CT-Comp-01: Cliente agenda compromisso (happy path)
- Pré-condição: horário disponível registrado, token do cliente
- Passos: POST /compromissos {cabeleireiroId,servicoId,dataHora}
- Esperado: 201 + compromisso criado e o horário removido de `horariosDisponiveis`

7) CT-Comp-02: Cliente tenta agendar horário indisponível
- Passos: POST /compromissos com dataHora não presente
- Esperado: 400 + erro 'Horário não disponível'

(Adicionar mais casos para PUT/DELETE/erros 404/403 etc.)

---

## Swagger

Arquivo: `resources/swagger.yaml` contém a especificação OpenAPI 3.0.0. A documentação é servida em `/docs`.

Sugestão: mantenha o swagger sincronizado com as mudanças de rota e modelos; use validação com AJV se desejar validar payloads automaticamente.

---

## Dashboard

Sugestão de dashboard mínimo para o produto (visão de negócio e operacional):
- Contagem de agendamentos por dia/semana
- Lista de serviços mais agendados
- Cabeleireiros com maior número de compromissos
- Número de usuários (clientes/cabeleireiros)

Implementação: pode ser uma página simples que consome endpoints adicionais (ex.: `/dashboard/stats`) — não implementado neste exemplo.

---

## Histórico de Bugs

Modelo para registrar bugs encontrados durante desenvolvimento/testes:

- BUG-001: Descrição: Erro ao iniciar servidor quando porta já em uso — Observação: comportamento observado ao tentar iniciar o servidor em background; solução: detectar e usar porta alternativa ou falhar com mensagem clara.
- BUG-002: Descrição: Senhas armazenadas em texto — Observação: melhorar para hashing com bcrypt.

(Manter lista atualizada com reproduções, prioridade e status.)

---

Se quiser, eu posso também:
- Gerar os arquivos de testes (Jest + Supertest) com base nos casos de teste aqui listados.
- Criar um template de dashboard com rotas de estatísticas.
- Adicionar uma página wiki no GitHub (criar GitHub wiki pages) — para isso preciso de permissão/ações no repositório remoto.
