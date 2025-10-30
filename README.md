# API do Salão de Beleza (Português Brasileiro)

API REST para agendamento de serviços em um salão de beleza. Esta implementação é um projeto de exemplo com banco em memória, JWT para autenticação e documentação Swagger.

## Funcionalidades

- Cadastro de usuários: clientes e cabeleireiros (`POST /auth/cadastrar`).
- Autenticação com JWT (`POST /auth/login`) para proteger rotas.
- Gerenciamento de serviços (`/servicos`): listar, criar, atualizar e remover serviços (somente cabeleireiros podem criar/editar/remover).
- Registro de horários disponíveis pelos cabeleireiros (`POST /cabeleireiros/horarios`) e consulta pública desses horários (`GET /cabeleireiros/horarios/{cabeleireiroId}`).
- Agendamento de serviços pelos clientes (`POST /compromissos`) — consome horários disponíveis e registra compromissos.
- Consulta de compromissos para clientes e cabeleireiros (`GET /compromissos`).
- Documentação interativa via Swagger em `/docs`.

## 🚀 Tecnologias Utilizadas

- Node.js (v16+ recomendado)
- Express
- JSON Web Tokens (JWT) — `jsonwebtoken`
- Swagger UI — `swagger-ui-express` e `yamljs`
- In-memory DB (arrays em `src/models/db.js`)
- UUIDs (`uuid`)

## 📁 Estrutura do Projeto

```
ppp-turma2/
├─ src/
│  ├─ controllers/        # Lógica dos endpoints
│  ├─ routes/             # Definição de rotas
│  ├─ services/           # Regras de negócio
│  ├─ middlewares/        # Autenticação JWT
│  └─ models/             # DB em memória
├─ resources/
│  └─ swagger.yaml        # Especificação OpenAPI
├─ package.json
└─ README.md
```

## 🛠️ Instalação e Execução

1. Clone o repositório (se ainda não fez):

```bash
git clone https://github.com/LucasCarvalhoCorreia/ppp-turma2.git
cd ppp-turma2
```

2. Instale as dependências:

```bash
npm install
```

3. Execute a aplicação:

```bash
npm start
```

A aplicação por padrão roda em: http://localhost:3000

Abra a documentação em: http://localhost:3000/docs

> Nota: o banco é em memória — todos os dados são perdidos ao reiniciar.

## 📚 Documentação da API

Toda a API é descrita em `resources/swagger.yaml` e pode ser acessada via navegador em `/docs`.

Endpoints principais:
- `POST /auth/cadastrar` — cadastrar usuário (cliente/cabeleireiro)
- `POST /auth/login` — autenticar e receber token JWT
- `GET /servicos` — listar serviços
- `GET /servicos/{id}` — detalhes de um serviço
- `POST /servicos` — criar serviço (cabeleireiro)
- `PUT /servicos/{id}` — atualizar serviço (cabeleireiro)
- `DELETE /servicos/{id}` — remover serviço (cabeleireiro)
- `POST /cabeleireiros/horarios` — cabeleireiro registra horários disponíveis
- `GET /cabeleireiros/horarios/{cabeleireiroId}` — listar horários de um cabeleireiro
- `POST /compromissos` — cliente cria agendamento
- `GET /compromissos` — lista compromissos do usuário autenticado

## 🔐 Autenticação

- Para rotas protegidas, envie o header HTTP `Authorization: Bearer <token>`.
- Obtenha o token via `POST /auth/login` com `email` e `senha`.
- Tokens expiram em 8 horas (configuração em `src/services/authService.js`).

### Papéis
- `cliente`: pode se cadastrar, fazer login, listar serviços, consultar horários, criar/agendar compromissos e consultar seus compromissos.
- `cabeleireiro`: pode se cadastrar, fazer login, cadastrar/editar/remover serviços, registrar horários disponíveis e consultar compromissos atribuídos.

## 💡 Exemplos de Uso

1) Cadastro (cliente):

POST /auth/cadastrar

```json
{
	"nome": "Joana Cliente",
	"email": "joana@cliente.com",
	"senha": "senha123",
	"papel": "cliente"
}
```

2) Login:

POST /auth/login

```json
{
	"email": "joana@cliente.com",
	"senha": "senha123"
}
```

Resposta:

```json
{
	"token": "eyJhbGciOi..."
}
```

3) Cabeleireiro registra horário (exige token de cabeleireiro):

POST /cabeleireiros/horarios

Headers:
```
Authorization: Bearer <token-do-cabeleireiro>
```

Body:

```json
{
	"dataHora": "2025-11-01T10:00:00Z"
}
```

4) Cliente cria compromisso (exige token de cliente):

POST /compromissos

```json
{
	"cabeleireiroId": "<id-do-cabeleireiro>",
	"servicoId": "<id-do-servico>",
	"dataHora": "2025-11-01T10:00:00Z"
}
```

## 📊 Estrutura de Dados

Modelos principais (resumo):

- Usuario
	- id: string (uuid)
	- nome: string
	- email: string
	- senha: string (armazenada em texto neste exemplo)
	- papel: 'cliente' | 'cabeleireiro'

- Servico
	- id: string (uuid)
	- nome: string
	- duracao: integer (minutos)
	- preco: number
	- categoria: string
	- descricao: string

- HorarioDisponivel
	- id: string (uuid)
	- cabeleireiroId: string
	- dataHora: string (ISO 8601)

- Compromisso
	- id: string (uuid)
	- clienteId: string
	- cabeleireiroId: string
	- servicoId: string
	- dataHora: string (ISO 8601)
	- status: string (e.g., 'agendado')
