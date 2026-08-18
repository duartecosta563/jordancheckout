const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const LOG_FILE = path.join(__dirname, 'pagamentos.txt');

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Página não encontrada.');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    return serveFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && req.url === '/style.css') {
    return serveFile(res, path.join(PUBLIC_DIR, 'style.css'), 'text/css; charset=utf-8');
  }

  if (req.method === 'POST' && req.url === '/api/pagamento') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10_000) req.destroy();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const nome = String(data.nome || '').trim();
        const valor = String(data.valor || '').trim();
        const cartao = String(data.cartao || '').trim();
        const validade = String(data.validade || '').trim();
        const cvv = String(data.cvv || '').trim();

        if (!nome || !cartao || cartao.length !== 16 || !validade || !cvv) {
          return sendJson(res, 400, { ok: false, erro: 'Dados inválidos.' });
        }

        const id = crypto.randomBytes(4).toString('hex');
        const dataHora = new Date().toLocaleString('pt-PT');
        const linha = [
          `ID: ${id}`,
          `Nome: ${nome}`,
          `Valor: ${valor || 'Não indicado'}`,
          `Cartão: ${cartao}`,
          `Validade: ${validade}`,
          `CVV: ${cvv}`,
          `Data: ${dataHora}`,
          '------------------------------',
          ''
        ].join('\n');

        const { error } = await supabase
  .from('pagamentos')
  .insert({
    nome: nome,
    valor: valor,
    data: new Date().toISOString()
  });

if (error) {
  console.error('Erro Supabase:', error);
  return sendJson(res, 500, {
    ok: false,
    erro: 'Erro ao guardar pagamento.'
  });
}

return sendJson(res, 200, { ok: true, id });
      } catch {
        return sendJson(res, 400, { ok: false, erro: 'Pedido inválido.' });
      }
    });

    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Não encontrado.');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor ativo em http://localhost:${PORT}`);
  console.log(`Registos seguros: ${LOG_FILE}`);
});
