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

## 🧪 Testes

Integração (automatizados):

- Execute a suíte completa de testes (Jest + Supertest):

```bash
npm test
```

- Os testes de integração estão em `tests/integration/*` e cobrem autenticação, serviços, agendamento, autorização e casos de erro.

Performance (teste de carga) — k6

Adicionamos um conjunto de scripts de carga com k6 em `tests/perf/k6/`, agrupados por feature. Cada script contém vários cenários (um por tipo de requisição) para simular cargas representativas:

- `tests/perf/k6/auth.k6.js` — cenários para `POST /auth/cadastrar` e `POST /auth/login`
- `tests/perf/k6/servicos.k6.js` — cenários para `GET /servicos`, `POST /servicos`, `GET /servicos/{id}`, `PUT /servicos/{id}`, `DELETE /servicos/{id}`
- `tests/perf/k6/horarios.k6.js` — cenários para `POST /cabeleireiros/horarios` e `GET /cabeleireiros/horarios/{cabeleireiroId}`
- `tests/perf/k6/compromissos.k6.js` — cenários para `POST /compromissos` e `GET /compromissos`

Requisitos
- Ter o binário `k6` instalado na máquina. Veja https://k6.io/docs/getting-started/installation

Execução local (exemplos)

```bash
# executar o script de auth (cada cenário tem VUs separados configuráveis via env)
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.htm BASE_URL=http://localhost:3000 VUS_LOGIN=10 VUS_CAD=5 DURATION=30s k6 run tests/perf/k6/auth.k6.js

# executar o script de serviços com VUs por cenário
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.htm BASE_URL=http://localhost:3000 VUS_LIST=10 VUS_CREATE=3 VUS_GET=5 VUS_UPDATE=2 VUS_DELETE=1 DURATION=30s k6 run tests/perf/k6/servicos.k6.js

# executar todos de uma vez e gerar 4 relatórios HTML (auth.html, servicos.html, horarios.html, compromissos.html)
npm run perf:all

# Personalizar BASE_URL/DURATION antes de rodar (Git Bash/Linux/macOS):
BASE_URL=http://localhost:3001 DURATION=45s npm run perf:all

# Personalizar BASE_URL/DURATION no PowerShell (Windows):
$env:BASE_URL="http://localhost:3001"; $env:DURATION="45s"; npm run perf:all

# Usar um único nome de arquivo para todos os relatórios com perf:all (será sobrescrito a cada script)
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.htm npm run perf:all

# PowerShell:
$env:K6_WEB_DASHBOARD="true"; $env:K6_WEB_DASHBOARD_EXPORT="html-report.htm"; npm run perf:all
```

Variáveis de ambiente úteis
- `BASE_URL`: URL base da API (padrão: `http://localhost:3000`)
- `DURATION`: duração padrão para cada cenário (ex: `30s`, `1m`)
- `auth.k6.js`: `VUS_LOGIN`, `VUS_CAD`
- `servicos.k6.js`: `VUS_LIST`, `VUS_CREATE`, `VUS_GET`, `VUS_UPDATE`, `VUS_DELETE`
- `horarios.k6.js`: `VUS_CREATE`, `VUS_LIST`, `CAB_EMAIL`, `CAB_SENHA`
- `compromissos.k6.js`: `VUS_CREATE`, `VUS_LIST`, `CLIENT_EMAIL`, `CLIENT_SENHA`

Notas
- Os scripts usam por padrão os usuários seededs do DB em memória (por ex.: `joana@cliente.com` e `cabeleireiro@salon.com`, senha `senha123`). Ajuste as variáveis de ambiente para apontar para outros usuários se necessário.
- Os checks dos scripts foram ajustados para validar o caminho feliz (201/200), ideal para medir throughput em rotas saudáveis.
- Para salvar o HTML do dashboard automaticamente, adicione `K6_WEB_DASHBOARD_EXPORT=report.html` às execuções.
- Para gerar relatórios mais detalhados (JSON/CSV) ou integrar ao Grafana, rode k6 com output apropriado e exporte os resultados.

