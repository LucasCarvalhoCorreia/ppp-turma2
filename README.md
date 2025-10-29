# API do Salão de Beleza (Português Brasileiro)

Projeto de exemplo: API REST para agendamento de serviços em um salão de beleza.

Funcionalidades
- Cadastro e login de usuários (cliente e cabeleireiro) com JWT
- CRUD de serviços (apenas cabeleireiros podem criar/editar/excluir)
- Cabeireiros podem registrar horários disponíveis
- Clientes podem agendar serviços em horários disponíveis
- Documentação Swagger disponível em `/docs`

Como executar
1. Instale dependências:

```bash
cd c:/Projetos/ppp-turma2
npm install
```

2. Inicie o servidor:

```bash
npm start
```

O servidor roda por padrão em http://localhost:3000. A documentação Swagger ficará disponível em http://localhost:3000/docs

Notas
- Banco de dados em memória: todos os dados se perdem ao reiniciar o servidor.
- Para testar facilmente: crie um usuário cabeleireiro via `POST /auth/cadastrar` com `papel: "cabeleireiro"`, faça login em `/auth/login`, e inclua o header `Authorization: Bearer <token>` nas chamadas protegidas.
- A chave JWT padrão é definida em `src/services/authService.js` como fallback. Em produção, sempre use a variável de ambiente `JWT_SECRET`.

Estrutura do projeto
- `src/routes` - define rotas
- `src/controllers` - lógica de entrada HTTP
- `src/services` - regras de negócio
- `src/models` - banco em memória
- `src/middlewares` - autenticação JWT
- `resources/swagger.yaml` - especificação OpenAPI

Swagger
A especificação OpenAPI está em `resources/swagger.yaml` e é servida em `/docs`.

Limitações e próximos passos
- Não há persistência real (usar um DB como SQLite/Postgres/Mongo)
- As senhas são armazenadas em texto simples (aplicar hashing com bcrypt)
- Adicionar validação de entradas e testes automatizados
