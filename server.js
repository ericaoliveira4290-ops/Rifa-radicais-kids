const express = require("express");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 10000;
const DB = path.join(__dirname, "rifa.json");

const INITIAL = {
  title: "Rifa Radicais Kids | Juvenil - Encontro com Deus",
  prize: "R$ 100,00",
  quantity: 100,
  price: 10,
  responsible: "Fernanda Maria Alves de Souza",
  pixKey: "62996251975",
  pixName: "Fernanda Maria Alves de Souza",
  pixCity: "GOIANIA",
  reservations: {}
};

function load() {
  if (!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify(INITIAL, null, 2));
  try { return JSON.parse(fs.readFileSync(DB, "utf8")); }
  catch { return JSON.parse(JSON.stringify(INITIAL)); }
}
function save(d) { fs.writeFileSync(DB, JSON.stringify(d, null, 2)); }
function esc(v) {
  return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function money(v) { return Number(v).toFixed(2).replace(".", ","); }

function crc16(s) {
  let crc = 0xffff;
  for (let i=0; i<s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j=0; j<8; j++)
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4,"0");
}
function field(id, value) {
  const s = String(value);
  return id + String(s.length).padStart(2,"0") + s;
}
function makePix(amount, txid) {
  const d = load();
  let key = String(d.pixKey).replace(/\D/g,"");
  if (key.length === 11) key = "+55" + key;
  const name = String(d.pixName).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^A-Za-z0-9 ]/g,"").slice(0,25);
  const city = String(d.pixCity).replace(/[^A-Za-z0-9 ]/g,"").slice(0,15);
  const merchant = field("00","br.gov.bcb.pix") + field("01",key);
  const additional = field("05",txid);
  let p = field("00","01") + field("26",merchant) + field("52","0000")
    + field("53","986") + field("54",Number(amount).toFixed(2))
    + field("58","BR") + field("59",name) + field("60",city)
    + field("62",additional) + "6304";
  return p + crc16(p);
}

function reservations() {
  const d = load(), map = {};
  Object.values(d.reservations || {}).forEach(r => { if (r && r.id) map[r.id] = r; });
  return Object.values(map).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
}
function mailer() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    service:"gmail",
    auth:{user:process.env.EMAIL_USER, pass:process.env.EMAIL_PASS}
  });
}
function relation() {
  const rs = reservations();
  if (!rs.length) return "<p>Nenhuma reserva registrada.</p>";
  let h = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial;font-size:12px"><tr><th>Nome</th><th>WhatsApp</th><th>E-mail</th><th>Números</th><th>Valor</th><th>Status</th><th>Data</th></tr>';
  rs.forEach(r => h += `<tr><td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td>${esc(r.email)}</td><td>${esc(r.numbers.join(", "))}</td><td>R$ ${money(r.amount)}</td><td>${esc(r.status)}</td><td>${new Date(r.createdAt).toLocaleString("pt-BR")}</td></tr>`);
  return h + "</table>";
}
async function sendEmail(r) {
  const t = mailer();
  if (!t) return;
  await t.sendMail({
    from:process.env.EMAIL_USER,
    to:process.env.EMAIL_TO || "Oliveira.ericamenezes@gmail.com",
    subject:`🎟️ Nova reserva - ${r.id}`,
    html:`<h2>🎟️ Nova reserva - Rifa Radicais Kids | Juvenil</h2>
      <p><b>Nome:</b> ${esc(r.name)}</p>
      <p><b>WhatsApp:</b> ${esc(r.phone)}</p>
      <p><b>E-mail:</b> ${esc(r.email)}</p>
      <p><b>Números:</b> ${esc(r.numbers.join(", "))}</p>
      <p><b>Valor:</b> R$ ${money(r.amount)}</p>
      <p><b>Código:</b> ${esc(r.id)}</p>
      <p><b>Status:</b> ${esc(r.status)}</p>
      <hr><h3>Relação atual das reservas</h3>${relation()}`
  });
}

app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));

app.get("/", (req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/imagem-rifa", (req,res)=>{
  const png=path.join(__dirname,"IMG-20260909-WA0152.png");
  const jpg=path.join(__dirname,"IMG-20260909-WA0152.jpg");
  if(fs.existsSync(png)) return res.sendFile(png);
  if(fs.existsSync(jpg)) return res.sendFile(jpg);
  res.status(404).send("Imagem não encontrada.");
});
app.get("/api/rifa",(req,res)=>{
  const d=load();
  res.json({
    title:d.title, prize:d.prize, quantity:d.quantity, price:d.price,
    responsible:d.responsible,
    sold:Object.keys(d.reservations).map(Number).sort((a,b)=>a-b)
  });
});
app.get("/api/pix",async(req,res)=>{
  try {
    const d=load();
    const nums=[...new Set(String(req.query.numbers||"").split(",").map(Number).filter(Number.isInteger))].sort((a,b)=>a-b);
    if(!nums.length) return res.status(400).json({error:"Selecione pelo menos um número."});
    if(nums.some(n=>n<1||n>d.quantity)) return res.status(400).json({error:"Número inválido."});
    const busy=nums.filter(n=>d.reservations[String(n)]);
    if(busy.length) return res.status(409).json({error:"Número(s) já reservado(s): "+busy.join(", ")});
    const amount=nums.length*Number(d.price);
    const txid=("R"+Date.now()).slice(-25);
    const pix=makePix(amount,txid);
    res.json({amount,pix,qr:await QRCode.toDataURL(pix)});
  } catch(e) {
    console.error(e); res.status(500).json({error:"Não foi possível gerar o Pix."});
  }
});

let reservationBusy=false;
app.post("/api/reservar",async(req,res)=>{
  if(reservationBusy) return res.status(409).json({error:"Aguarde um instante e tente novamente."});
  reservationBusy=true;
  try {
    const d=load();
    const name=String(req.body.name||"").trim();
    const phone=String(req.body.phone||"").trim();
    const email=String(req.body.email||"").trim();
    const nums=[...new Set((Array.isArray(req.body.numbers)?req.body.numbers:[]).map(Number).filter(Number.isInteger))].sort((a,b)=>a-b);
    if(!name||!phone||!email||!nums.length) return res.status(400).json({error:"Preencha nome, WhatsApp, e-mail e escolha os números."});
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:"Digite um e-mail válido."});
    const busy=nums.filter(n=>d.reservations[String(n)]);
    if(busy.length) return res.status(409).json({error:"Número(s) já reservado(s): "+busy.join(", ")});
    const r={
      id:"RIFA-"+Math.random().toString(36).slice(2,10).toUpperCase(),
      name,phone,email,numbers:nums,amount:nums.length*Number(d.price),
      status:"Reserva realizada",createdAt:new Date().toISOString()
    };
    nums.forEach(n=>d.reservations[String(n)]=r);
    save(d);
    try { await sendEmail(r); } catch(e) { console.error("Falha no e-mail:",e); }
    res.json({ok:true,reserva:r});
  } catch(e) {
    console.error(e); res.status(500).json({error:"Não foi possível concluir a reserva."});
  } finally { reservationBusy=false; }
});

app.listen(PORT,"0.0.0.0",()=>console.log("Rifa Radicais Kids online na porta "+PORT));
