# Testes de Performance (k6)

Este diretório contém scripts de carga/performance usando k6 para as principais rotas da API: auth, horários, compromissos e serviços.

## Dashboard Web do k6 (recomendado)
Utilize o dashboard embutido do k6 para visualizar resultados em tempo real e ao final da execução:

- Linux/macOS/Git Bash (Windows):
```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.htm k6 run tests/perf/k6/servicos.k6.js
```

- PowerShell (Windows):
```powershell
$env:K6_WEB_DASHBOARD = "true"; $env:K6_WEB_DASHBOARD_EXPORT = "html-report.htm"; k6 run tests/perf/k6/servicos.k6.js
```

Opções úteis:
- `K6_WEB_DASHBOARD_EXPORT=html-report.htm` para salvar o HTML ao final (nome sugerido pelo projeto).

Exemplos:
```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.htm k6 run tests/perf/k6/servicos.k6.js
```

## Como rodar (exemplos)

- Tudo de uma vez (gera 4 relatórios HTML: auth.html, servicos.html, horarios.html, compromissos.html):
```bash
npm run perf:all
```

- Personalizar BASE_URL/DURATION:
  - Git Bash/Linux/macOS:
```bash
BASE_URL=http://localhost:3001 DURATION=45s npm run perf:all
```
  - PowerShell (Windows):
```powershell
$env:BASE_URL = "http://localhost:3001"; $env:DURATION = "45s"; npm run perf:all
```

- Usar um único nome de arquivo base para todos os relatórios via perf:all:
  - Git Bash/Linux/macOS:
```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.htm npm run perf:all
```
  - PowerShell (Windows):
```powershell
$env:K6_WEB_DASHBOARD = "true"; $env:K6_WEB_DASHBOARD_EXPORT = "html-report.htm"; npm run perf:all
```
  O runner adiciona automaticamente o sufixo do endpoint a cada arquivo, gerando:
  html-report-auth.htm, html-report-servicos.htm, html-report-horarios.htm, html-report-compromissos.htm.
  Para manter um arquivo por script com nomes distintos próprios, simplesmente não defina K6_WEB_DASHBOARD_EXPORT (o runner usa nomes por padrão).

- Auth:
```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.htm k6 run tests/perf/k6/auth.k6.js
```

- Horários:
```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.htm k6 run tests/perf/k6/horarios.k6.js
```

- Compromissos:
```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.htm k6 run tests/perf/k6/compromissos.k6.js
```

- Serviços:
```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.htm k6 run tests/perf/k6/servicos.k6.js
```

## Variáveis de ambiente úteis
- BASE_URL: URL base da API (padrão: http://localhost:3000)
- Credenciais por script (exemplos):
  - Auth: `LOGIN_EMAIL`, `LOGIN_SENHA`
  - Horários: `CAB_EMAIL`, `CAB_SENHA`
  - Compromissos: `CLIENT_EMAIL`, `CLIENT_SENHA`
  - Serviços: `ADMIN_EMAIL`, `ADMIN_SENHA`
- VUS/DURATION por cenário (consulte cada script para nomes como `VUS_CREATE`, `VUS_LIST`, etc.)

## Caminho feliz
Os checks de cada script foram ajustados para validar apenas o caminho feliz:
- 201 para criações (POST)
- 200 para leituras (GET) e atualizações (PUT)

Para aumentar a previsibilidade:
- Os scripts criam dados quando necessário (ex.: criar serviço antes de atualizar/remover) e usam usuários seed por padrão.

## Dicas
- Para testes mais longos, ajuste `DURATION` (ex.: `DURATION=2m`).
- Para paralelismo, ajuste `VUS_*` conforme o cenário.
- Para salvar o relatório HTML do dashboard automaticamente, use `K6_WEB_DASHBOARD_EXPORT=arquivo.html`.
