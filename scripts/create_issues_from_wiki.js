const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Script que lê docs/WIKI.md (ou docs/Historico-de-Bugs.md) e cria issues no GitHub.
// Uso: GH_TOKEN=ghp_xxx node scripts/create_issues_from_wiki.js
// ATENÇÃO: este script cria issues reais no repositório remoto. Forneça GH_TOKEN com permissão 'repo'.

const REPO = process.env.REPO || 'LucasCarvalhoCorreia/ppp-turma2';
const TOKEN = process.env.GH_TOKEN;
const WIKI_PATH = path.join(__dirname, '..', 'docs', 'WIKI.md');

function parseBugs(content) {
  const bugs = [];
  const lines = content.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^##\s+BUG-?(\d+)/i);
    if (m) {
      const id = m[1];
      let title = '';
      let description = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('## ')) {
        const l = lines[i];
        if (l.startsWith('- Título:')) title = l.replace('- Título:', '').trim();
        if (l.startsWith('- Descrição:')) description += l.replace('- Descrição:', '').trim() + '\n';
        if (l.startsWith('- Status:')) description += '\nStatus: ' + l.replace('- Status:', '').trim() + '\n';
        i++;
      }
      if (!title) title = `BUG-${id}`;
      bugs.push({ title, body: description });
    } else {
      i++;
    }
  }
  return bugs;
}

async function createIssue(bug) {
  if (!TOKEN) {
    console.log('Sem GH_TOKEN — listando issues que seriam criadas:');
    console.log('-', bug.title);
    return;
  }

  const url = `https://api.github.com/repos/${REPO}/issues`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ppp-turma2-bot'
    },
    body: JSON.stringify({ title: bug.title, body: bug.body })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Erro ao criar issue: ${res.status} ${txt}`);
  }
  return await res.json();
}

(async () => {
  if (!fs.existsSync(WIKI_PATH)) {
    console.error('Arquivo WIKI.md não encontrado em docs/');
    process.exit(1);
  }
  const content = fs.readFileSync(WIKI_PATH, 'utf8');
  const bugs = parseBugs(content);
  for (const bug of bugs) {
    try {
      const created = await createIssue(bug);
      if (created && created.html_url) console.log('Criada:', created.html_url);
    } catch (err) {
      console.error('Erro:', err.message);
    }
  }
})();
