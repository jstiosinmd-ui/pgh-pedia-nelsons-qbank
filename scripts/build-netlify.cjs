/* Keep the validated offline files intact; publish smaller web assets. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp', 'netlify-site');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
fs.mkdirSync(path.join(out, '_studio'), {recursive:true});
const tracked = execFileSync('git', ['ls-files', '-z'], {cwd:root, encoding:'utf8'}).split('\0').filter(Boolean);
for (const name of tracked) {
  if (name.startsWith('.') || name.startsWith('scripts/')) continue;
  const dest = path.join(out, name); fs.mkdirSync(path.dirname(dest), {recursive:true});
  fs.copyFileSync(path.join(root, name), dest);
}
function asset(text, extension) {
  const name = '_studio/' + hash(text) + '.' + extension;
  fs.writeFileSync(path.join(out, name), text);
  return name;
}
const loader = asset(fs.readFileSync(path.join(__dirname, 'netlify-loader.js'), 'utf8'), 'js');
const result = [];
for (const name of ['question-bank.html', 'exam-maker.html', 'boards-mock.html']) {
  const original = fs.readFileSync(path.join(root, name), 'utf8');
  const plan = {blocks:[], scripts:[]};
  let html = original.replace(/<script([^>]*)>([\s\S]*?)<\/script>/g, (full, attrs, body) => {
    if (/type="application\/json"/.test(attrs)) {
      if (Buffer.byteLength(body) < 32768) return full;
      const id = attrs.match(/\bid="([^"]+)"/)[1];
      const parsed = JSON.parse(body), parts = [];
      for (let i = 0; i < body.length; i += 65536) parts.push(asset(JSON.stringify(body.slice(i, i + 65536)), 'json'));
      const block = {id, sha256:hash(body), parts};
      if (id === 'examData' || id === 'bankData') block.bank = 'nelson';
      if (name !== 'boards-mock.html' && id === 'mockBankData') block.bank = 'mock';
      plan.blocks.push(block);
      return '<script' + attrs + '>' + (Array.isArray(parsed) ? '[]' : '{}') + '</script>';
    }
    if (/\bsrc=/.test(attrs)) throw Error('Unexpected external script in ' + name);
    plan.scripts.push(asset(body, 'js'));
    return '';
  });
  // The offline policy allows inline scripts only. Hosted assets stay on this origin.
  html = html.replace(/(<meta http-equiv="Content-Security-Policy" content=")([^"]+)(")/, (_, start, policy, end) =>
    start + policy.replace("script-src 'unsafe-inline'", "script-src 'self'").replace("connect-src 'none'", "connect-src 'self'") + end);
  html = html.replace('<html ', '<html data-delivery-loading ');
  html = html.replace('</head>', '<style>html[data-delivery-loading]{overflow:hidden}#deliveryStatus{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;background:#f7f9fc;color:#172a3a;font:16px Arial,sans-serif;text-align:center}#deliveryStatus h1{font-size:24px}#deliveryProgress{width:min(360px,85vw);height:18px}#deliveryRetry{padding:12px 24px;font:inherit;cursor:pointer}</style></head>');
  const panel = '<section id="deliveryStatus" role="status" aria-live="polite"><h1>Loading your question bank</h1><p id="deliveryMessage">Preparing questions and practice tools…</p><progress id="deliveryProgress" value="0" max="1"></progress><button id="deliveryRetry" hidden>Try again</button></section>';
  html = html.replace(/(<body[^>]*>)/, '$1' + panel);
  html = html.replace('</body>', '<script id="deliveryPlan" type="application/json">' + JSON.stringify(plan) + '</script><script src="' + loader + '"></script></body>');
  fs.writeFileSync(path.join(out, name), html);
  // Reassembly is checked independently of the browser loader.
  for (const b of plan.blocks) {
    const joined = b.parts.map(p => JSON.parse(fs.readFileSync(path.join(out, p), 'utf8'))).join('');
    if (hash(joined) !== b.sha256) throw Error('Bank reassembly failed: ' + b.id);
    const originalData = original.match(new RegExp('<script id="' + b.id + '"[^>]*>([\\s\\S]*?)</script>'))[1];
    if (joined !== originalData) throw Error('Bank changed: ' + b.id);
  }
  result.push({page:name,source_sha256:hash(original),hosted_sha256:hash(html),source_bytes:Buffer.byteLength(original),hosted_bytes:Buffer.byteLength(html),data_blocks:plan.blocks.length,scripts:plan.scripts.length});
}
fs.writeFileSync(path.join(out, 'web-delivery-manifest.json'), JSON.stringify({application_version:'2.3',delivery_version:1,built:new Date().toISOString(),question_content_changed:false,pages:result}, null, 2) + '\n');
console.log(JSON.stringify({publish:'.tmp/netlify-site',pages:result}, null, 2));
