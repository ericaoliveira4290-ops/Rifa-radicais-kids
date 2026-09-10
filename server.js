const express=require("express");
const fs=require("fs");
const path=require("path");
const multer=require("multer");
const nodemailer=require("nodemailer");
const QRCode=require("qrcode");

const app=express();
const PORT=process.env.PORT||10000;
const DB=path.join(__dirname,"rifa.json");
const INITIAL={title:"Rifa Encontro Com Deus - Radicais Kids | Juvenis",prize:"R$ 200,00",quantity:100,price:10,drawDate:"03/10/2026",drawMethod:"Sorteador",responsible:"Fernanda Maria Alves de Souza",pixKey:"62996251975",pixName:"Fernanda Maria Alves de Souza",pixCity:"GOIANIA",reservations:{}};

function data(){if(!fs.existsSync(DB))fs.writeFileSync(DB,JSON.stringify(INITIAL,null,2));try{return JSON.parse(fs.readFileSync(DB,"utf8"))}catch(e){return {...INITIAL}}}
function save(d){fs.writeFileSync(DB,JSON.stringify(d,null,2))}
function money(v){return Number(v).toFixed(2).replace(".",",")}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function crc16(s){let c=0xffff;for(let i=0;i<s.length;i++){c^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=(c&0x8000)?((c<<1)^0x1021)&0xffff:(c<<1)&0xffff}return c.toString(16).toUpperCase().padStart(4,"0")}
function pf(id,v){v=String(v);return id+String(v.length).padStart(2,"0")+v}
function makePix(amount,txid){const d=data();let key=d.pixKey.replace(/\D/g,"");if(key.length===11)key="+55"+key;const name=d.pixName.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9 ]/g,"").slice(0,25);const city=d.pixCity.slice(0,15);const merchant=pf("00","br.gov.bcb.pix")+pf("01",key);const add=pf("05",txid);let p=pf("00","01")+pf("26",merchant)+pf("52","0000")+pf("53","986")+pf("54",Number(amount).toFixed(2))+pf("58","BR")+pf("59",name)+pf("60",city)+pf("62",add)+"6304";return p+crc16(p)}
function rows(){const m={};Object.values(data().reservations||{}).forEach(r=>{if(r&&r.id)m[r.id]=r});return Object.values(m)}
function transport(){if(!process.env.EMAIL_USER||!process.env.EMAIL_PASS)return null;return nodemailer.createTransport({service:"gmail",auth:{user:process.env.EMAIL_USER,pass:process.env.EMAIL_PASS}})}
function table(){const rs=rows();if(!rs.length)return "<p>Nenhuma reserva.</p>";let h='<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%"><tr><th>Nome</th><th>WhatsApp</th><th>Números</th><th>Valor</th><th>Status</th><th>Data</th></tr>';rs.forEach(r=>h+="<tr><td>"+esc(r.name)+"</td><td>"+esc(r.phone)+"</td><td>"+esc(r.numbers.join(", "))+"</td><td>R$ "+money(r.amount)+"</td><td>"+esc(r.status)+"</td><td>"+new Date(r.createdAt).toLocaleString("pt-BR")+"</td></tr>");return h+"</table>"}
async function emailReservation(r){const t=transport();if(!t)return;await t.sendMail({from:process.env.EMAIL_USER,to:process.env.EMAIL_TO||"Oliveira.ericamenezes@gmail.com",subject:"Nova reserva - "+r.id,html:"<h2>🎟️ Nova reserva</h2><p><b>Nome:</b> "+esc(r.name)+"</p><p><b>WhatsApp:</b> "+esc(r.phone)+"</p><p><b>Números:</b> "+r.numbers.join(", ")+"</p><p><b>Valor:</b> R$ "+money(r.amount)+"</p><p><b>Código:</b> "+r.id+"</p><p><b>Status:</b> "+r.status+"</p><hr><h3>Relação atual</h3>"+table()})}
async function emailProof(r,f){const t=transport();if(!t)return;await t.sendMail({from:process.env.EMAIL_USER,to:process.env.EMAIL_TO||"Oliveira.ericamenezes@gmail.com",subject:"Comprovante Pix - "+r.id,html:"<h2>🧾 Comprovante recebido</h2><p><b>Nome:</b> "+esc(r.name)+"</p><p><b>WhatsApp:</b> "+esc(r.phone)+"</p><p><b>Números:</b> "+r.numbers.join(", ")+"</p><p><b>Valor:</b> R$ "+money(r.amount)+"</p><p><b>Código:</b> "+r.id+"</p><hr><h3>Relação atual</h3>"+table(),attachments:[{filename:f.originalname,content:f.buffer,contentType:f.mimetype}]})}

app.use(express.json());app.use(express.urlencoded({extended:true}));
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024}});
app.get("/",(q,s)=>s.sendFile(path.join(__dirname,"index.html")));
app.get("/imagem-rifa",(q,s)=>{const p=path.join(__dirname,"IMG-20260909-WA0152.png");if(fs.existsSync(p))s.sendFile(p);else s.status(404).send("Imagem não encontrada")});
app.get("/api/rifa",(q,s)=>{const d=data();s.json({title:d.title,prize:d.prize,quantity:d.quantity,price:d.price,drawDate:d.drawDate,drawMethod:d.drawMethod,responsible:d.responsible,sold:Object.keys(d.reservations).map(Number)})});
app.get("/api/pix",async(q,s)=>{try{const d=data();const n=[...new Set(String(q.query.numbers||"").split(",").map(Number).filter(Number.isInteger))].sort((a,b)=>a-b);if(!n.length)return s.status(400).json({error:"Selecione um número."});const busy=n.filter(x=>d.reservations[String(x)]);if(busy.length)return s.status(409).json({error:"Número já reservado: "+busy.join(", ")});const amount=n.length*d.price;const txid="R"+Date.now();const pix=makePix(amount,txid);s.json({amount,pix,qr:await QRCode.toDataURL(pix)})}catch(e){console.error(e);s.status(500).json({error:"Erro ao gerar Pix."})}});
app.post("/api/reservar",async(q,s)=>{try{const d=data(),name=String(q.body.name||"").trim(),phone=String(q.body.phone||"").trim(),n=[...new Set((q.body.numbers||[]).map(Number).filter(Number.isInteger))].sort((a,b)=>a-b);if(!name||!phone||!n.length)return s.status(400).json({error:"Preencha nome, WhatsApp e números."});const busy=n.filter(x=>d.reservations[String(x)]);if(busy.length)return s.status(409).json({error:"Número já reservado: "+busy.join(", ")});const r={id:"RIFA-"+Math.random().toString(36).slice(2,10).toUpperCase(),name,phone,numbers:n,amount:n.length*d.price,status:"Aguardando pagamento",createdAt:new Date().toISOString()};n.forEach(x=>d.reservations[String(x)]=r);save(d);try{await emailReservation(r)}catch(e){console.error("email",e)}s.json({ok:true,reserva:r})}catch(e){console.error(e);s.status(500).json({error:"Erro ao reservar."})}});
app.post("/api/comprovante",upload.single("comprovante"),async(q,s)=>{try{if(!q.file)return s.status(400).json({error:"Selecione o comprovante."});const r=rows().find(x=>x.id===String(q.body.id));if(!r)return s.status(404).json({error:"Reserva não encontrada."});const d=data();r.status="Comprovante enviado";r.numbers.forEach(n=>d.reservations[String(n)]=r);save(d);try{await emailProof(r,q.file)}catch(e){console.error("email",e)}s.json({ok:true})}catch(e){console.error(e);s.status(500).json({error:"Erro ao enviar comprovante."})}});
app.listen(PORT,"0.0.0.0",()=>console.log("Rifa online na porta "+PORT));
