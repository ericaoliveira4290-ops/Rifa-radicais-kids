const express = require('express');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_TO = process.env.EMAIL_TO || 'Oliveira.ericamenezes@gmail.com';

const CONFIG = {
  title: 'Rifa Radicais Kids | Juvenil — Encontro com Deus',
  prize: 'R$ 100,00',
  quantity: 100,
  price: 10,
  responsible: 'Fernanda Maria Alves de Souza',
  pix: '62996251975',
  pixName: 'Fernanda Maria Alves de Souza',
  pixCity: 'GOIANIA',
  drawTarget: 70
};

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.warn('Supabase não configurado: defina SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY).');
}
const supabase = (SUPABASE_URL && SUPABASE_SECRET_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
  : null;

app.use(express.json({ limit: '200kb' }));
app.use(express.static(__dirname));

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function field(id, value) {
  const s = String(value);
  return id + String(s.length).padStart(2, '0') + s;
}
function pixPayload(amount) {
  const merchant = field('26', field('00', 'BR.GOV.BCB.PIX') + field('01', CONFIG.pix));
  const add = field('62', field('05', 'RIFA'));
  const base = field('00', '01') + merchant + field('52', '0000') + field('53', '986') + field('54', Number(amount).toFixed(2)) + field('58', 'BR') + field('59', CONFIG.pixName.slice(0,25)) + field('60', CONFIG.pixCity.slice(0,15)) + add;
  return base + '6304' + crc16(base + '6304');
}
function admin(req, res, next) {
  if (!ADMIN_PASSWORD) return res.status(503).send('Área do organizador indisponível: configure ADMIN_PASSWORD no Render.');
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) { res.set('WWW-Authenticate', 'Basic realm="Área do Organizador"'); return res.status(401).send('Login necessário.'); }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');
  if (user !== 'admin' || pass !== ADMIN_PASSWORD) { res.set('WWW-Authenticate', 'Basic realm="Área do Organizador"'); return res.status(401).send('Usuário ou senha inválidos.'); }
  next();
}
async function getSold() {
  if (!supabase) throw new Error('Banco de dados ainda não configurado no Render.');
  const { data, error } = await supabase.from('rifa_numeros').select('number,reservation_id').order('number');
  if (error) throw error;
  return (data || []).map(r => Number(r.number));
}

async function getDbSnapshot() {
  if (!supabase) throw new Error('Banco de dados ainda não configurado no Render.');
  const { data: nums, error: nerr } = await supabase.from('rifa_numeros').select('number,reservation_id').order('number');
  if (nerr) throw nerr;
  const { data: reservations, error: rerr } = await supabase.from('rifa_reservas').select('id,name,phone,email,amount,status,created_at').order('created_at', { ascending:false });
  if (rerr) throw rerr;
  return { numbers: nums || [], reservations: reservations || [] };
}
async function sendReservationEmail(r) {
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) return;
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: EMAIL_USER, pass: EMAIL_PASS }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000 });
  await transporter.sendMail({
    from: `Rifa Radicais Kids <${EMAIL_USER}>`, to: EMAIL_TO,
    subject: `Nova reserva — números ${r.numbers.map(n => String(n).padStart(2,'0')).join(', ')}`,
    text: `Nova reserva registrada.\n\nNome: ${r.name}\nWhatsApp: ${r.phone}\nE-mail: ${r.email}\nNúmeros: ${r.numbers.join(', ')}\nQuantidade: ${r.numbers.length}\nValor: R$ ${r.amount.toFixed(2).replace('.', ',')}\nStatus: reservado\nData/hora: ${r.createdAt}`
  });
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/imagem-rifa', (req, res) => {
  const p = path.join(__dirname, 'IMG-20260909-WA0152.png');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).end();
});

app.get('/api/rifa', async (req, res) => {
  try {
    const sold = await getSold();
    res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma','no-cache');
    res.set('Expires','0');
    res.json({ ...CONFIG, sold, serverTime: new Date().toISOString() });
  } catch (e) { console.error('GET /api/rifa:', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/status', async (req, res) => {
  try {
    const db = await getDbSnapshot();
    res.set('Cache-Control','no-store');
    res.json({ ok:true, serverTime:new Date().toISOString(), supabaseUrl:SUPABASE_URL, numbers:db.numbers, reservations:db.reservations });
  } catch(e) { console.error('GET /api/status:', e); res.status(500).json({ ok:false, error:e.message }); }
});

app.post('/api/reservar', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Banco de dados ainda não configurado.' });
    const { name, phone, email, numbers } = req.body || {};
    const nums = [...new Set((numbers || []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= CONFIG.quantity))].sort((a,b)=>a-b);
    if (!name?.trim() || !phone?.trim() || !email?.trim() || !nums.length) return res.status(400).json({ error: 'Preencha nome, WhatsApp, e-mail e selecione pelo menos um número.' });
    const amount = nums.length * CONFIG.price;
    const { data, error } = await supabase.rpc('reservar_numeros', {
      p_numbers: nums, p_name: name.trim(), p_phone: phone.trim(), p_email: email.trim(), p_amount: amount
    });
    if (error) {
      const msg = String(error.message || '');
      if (/já reservado|reservado|duplicate|unique/i.test(msg)) return res.status(409).json({ error: 'Um ou mais números escolhidos já foram reservados. Atualize a página e escolha outros.' });
      throw error;
    }
    const createdAt = new Date().toISOString();
    const reserva = { id: data.id, numbers: nums, name: name.trim(), phone: phone.trim(), email: email.trim(), amount, status: 'reservado', createdAt };
    const pix = pixPayload(amount);
    const qr = await QRCode.toDataURL(pix, { width: 320, margin: 1 });
    // Entrega a reserva/Pix imediatamente. O e-mail é enviado em segundo plano para não travar o botão.
    res.json({ ok: true, reserva, pix, qr });
    sendReservationEmail(reserva).catch(mailErr => console.error('Falha ao enviar e-mail:', mailErr.message));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Não foi possível registrar a reserva agora. Tente novamente.' }); }
});

app.get('/admin', admin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).send('Banco de dados ainda não configurado.');
    const db = await getDbSnapshot();
    const reservations = db.reservations;
    const nums = db.numbers;
    const grouped = reservations.map(r => ({...r, numbers:nums.filter(n=>n.reservation_id===r.id).map(n=>n.number).sort((a,b)=>a-b)}));
    const sold = nums?.length || 0, pct = Math.round(sold/CONFIG.quantity*100), total = grouped.reduce((s,r)=>s+Number(r.amount||0),0);
    res.type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><title>Área do Organizador</title><style>*{box-sizing:border-box;font-family:Montserrat,Arial,sans-serif}body{margin:0;background:#f4f0ff;color:#3b2a4b}.wrap{max-width:1100px;margin:auto;padding:25px}.head,.card{background:#fff;border-radius:22px;padding:22px;margin-bottom:18px;box-shadow:0 10px 30px #4b237f14}.head h1{margin:0;color:#7440c7}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat{padding:18px;border-radius:16px;background:#f8f5ff}.stat b{display:block;font-size:25px;color:#7440c7}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:11px;border-bottom:1px solid #eee;text-align:left;font-size:13px}.btn{border:0;border-radius:12px;padding:12px 16px;background:#7440c7;color:#fff;font-weight:800;cursor:pointer}@media(max-width:750px){.stats{grid-template-columns:1fr 1fr}.table{display:block;overflow:auto;white-space:nowrap}}</style></head><body><div class="wrap"><div class="head"><h1>Área do Organizador</h1><p>Rifa Radicais Kids | Juvenil — Encontro com Deus</p><button class="btn" onclick="downloadCSV()">Baixar lista CSV</button></div><div class="card"><div class="stats"><div class="stat"><b>${sold}</b>Números reservados</div><div class="stat"><b>${CONFIG.quantity-sold}</b>Disponíveis</div><div class="stat"><b>${pct}%</b>Percentual vendido</div><div class="stat"><b>R$ ${total.toFixed(2).replace('.',',')}</b>Total reservado</div></div></div><div class="card"><table class="table"><thead><tr><th>Data/hora</th><th>Nome</th><th>WhatsApp</th><th>E-mail</th><th>Números</th><th>Valor</th><th>Status</th></tr></thead><tbody>${grouped.map(r=>`<tr><td>${new Date(r.created_at).toLocaleString('pt-BR')}</td><td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td>${esc(r.email)}</td><td>${r.numbers.map(n=>String(n).padStart(2,'0')).join(', ')}</td><td>R$ ${Number(r.amount).toFixed(2).replace('.',',')}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table></div></div><script>const rows=${JSON.stringify(grouped).replace(/</g,'\\u003c')};function esc(s){return String(s).replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}function downloadCSV(){const h=['Data/hora','Nome','WhatsApp','E-mail','Números','Valor','Status'];const lines=[h,...rows.map(r=>[new Date(r.created_at).toLocaleString('pt-BR'),r.name,r.phone,r.email,r.numbers.join(' '),Number(r.amount).toFixed(2),r.status])].map(a=>a.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';'));const b=new Blob(['\\ufeff'+lines.join('\\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='rifa-radicais-kids.csv';a.click()}</script></body></html>`);
  } catch(e) { res.status(500).send('Não foi possível carregar a área do organizador.'); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Rifa online na porta ${PORT}`));
