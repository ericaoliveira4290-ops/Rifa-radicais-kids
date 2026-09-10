const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 10000;

const file = path.join(__dirname, "rifa.json");

const dadosIniciais = {
  title: "Rifa Encontro Com Deus - Radicais Kids | Juvenis",
  prize: "R$ 200,00",
  quantity: 100,
  price: 10,
  drawDate: "03/10/2026",
  drawMethod: "Sorteador",
  responsible: "Fernanda Maria Alves de Souza",
  pix: "62 996251975",
  pixNome: "Fernanda Maria Alves de Souza",
  pixCidade: "GOIANIA",
  email: "Oliveira.ericamenezes@gmail.com",
  reservations: {}
};

if (!fs.existsSync(file)) {
  fs.writeFileSync(file, JSON.stringify(dadosIniciais, null, 2));
}

function lerRifa() {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return dadosIniciais;
  }
}

function salvarRifa(rifa) {
  fs.writeFileSync(file, JSON.stringify(rifa, null, 2));
}

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

app.get("/imagem-rifa", (req, res) => {
  res.sendFile(path.join(__dirname, "IMG-20260909-WA0152.jpg"));
});

function escapar(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   E-MAIL
========================= */

function criarTransportador() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

function gerarRelacao() {
  const rifa = lerRifa();
  const mapa = {};

  Object.values(rifa.reservations || {}).forEach((reserva) => {
    if (!reserva || !reserva.id) return;
    mapa[reserva.id] = reserva;
  });

  return Object.values(mapa).sort((a, b) => {
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

function tabelaRelacao() {
  const relacao = gerarRelacao();

  if (!relacao.length) {
    return "<p>Nenhuma reserva registrada ainda.</p>";
  }

  let html = `
    <table border="1" cellpadding="7" cellspacing="0"
      style="border-collapse:collapse;width:100%;font-family:Arial;font-size:13px;">
      <tr>
        <th>Nome</th>
        <th>WhatsApp</th>
        <th>Números</th>
        <th>Valor</th>
        <th>Status</th>
        <th>Data</th>
      </tr>
  `;

  relacao.forEach((r) => {
    html += `
      <tr>
        <td>${escapar(r.name)}</td>
        <td>${escapar(r.phone)}</td>
        <td>${escapar(r.numbers.join(", "))}</td>
        <td>R$ ${Number(r.amount).toFixed(2).replace(".", ",")}</td>
        <td>${escapar(r.status)}</td>
        <td>${new Date(r.createdAt).toLocaleString("pt-BR")}</td>
      </tr>
    `;
  });

  html += "</table>";

  return html;
}

async function enviarEmailReserva(reserva) {
  const transporter = criarTransportador();

  if (!transporter) {
    console.log("E-mail não configurado. Configure EMAIL_USER e EMAIL_PASS no Render.");
    return;
  }

  const destino =
    process.env.EMAIL_TO ||
    "Oliveira.ericamenezes@gmail.com";

  const assunto =
    `Nova reserva - ${reserva.numbers.join(", ")} - ${reserva.name}`;

  const html = `
    <div style="font-family:Arial,sans-serif">
      <h2>🎟️ Nova reserva da Rifa</h2>

      <p><strong>Nome:</strong> ${escapar(reserva.name)}</p>
      <p><strong>WhatsApp:</strong> ${escapar(reserva.phone)}</p>
      <p><strong>Números:</strong> ${escapar(reserva.numbers.join(", "))}</p>
      <p><strong>Quantidade:</strong> ${reserva.numbers.length}</p>
      <p><strong>Valor:</strong> R$ ${Number(reserva.amount).toFixed(2).replace(".", ",")}</p>
      <p><strong>Código da reserva:</strong> ${escapar(reserva.id)}</p>
      <p><strong>Status:</strong> ${escapar(reserva.status)}</p>
      <p><strong>Data/hora:</strong> ${new Date(reserva.createdAt).toLocaleString("pt-BR")}</p>

      <hr>

      <h3>📋 Relação atual da rifa</h3>

      ${tabelaRelacao()}
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: destino,
      subject: assunto,
      html
    });

    console.log("E-mail da reserva enviado.");
  } catch (erro) {
    console.error("Erro ao enviar e-mail:", erro);
  }
}

async function enviarComprovante(reserva, arquivo) {
  const transporter = criarTransportador();

  if (!transporter) {
    console.log("E-mail não configurado.");
    return;
  }

  const destino =
    process.env.EMAIL_TO ||
    "Oliveira.ericamenezes@gmail.com";

  const html = `
    <div style="font-family:Arial,sans-serif">
      <h2>🧾 Comprovante de Pix recebido</h2>

      <p><strong>Nome:</strong> ${escapar(reserva.name)}</p>
      <p><strong>WhatsApp:</strong> ${escapar(reserva.phone)}</p>
      <p><strong>Números:</strong> ${escapar(reserva.numbers.join(", "))}</p>
      <p><strong>Valor:</strong> R$ ${Number(reserva.amount).toFixed(2).replace(".", ",")}</p>
      <p><strong>Código da reserva:</strong> ${escapar(reserva.id)}</p>

      <hr>

      <h3>📋 Relação atual da rifa</h3>

      ${tabelaRelacao()}
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: destino,
      subject: `Comprovante Pix - ${reserva.name} - ${reserva.id}`,
      html,
      attachments: [
        {
          filename: arquivo.originalname,
          content: arquivo.buffer,
          contentType: arquivo.mimetype
        }
      ]
    });

    console.log("Comprovante enviado por e-mail.");
  } catch (erro) {
    console.error("Erro ao enviar comprovante:", erro);
  }
}

/* =========================
   PIX
========================= */

function crc16(payload) {
  let crc = 0xffff;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;

    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function campoPix(id, valor) {
  const tamanho = String(valor).length
    .toString()
    .padStart(2, "0");

  return `${id}${tamanho}${valor}`;
}

function gerarPix(valor, txid) {
  const rifa = lerRifa();

  let chave = String(rifa.pix).replace(/\D/g, "");

  if (chave.length === 11) {
    chave = "+55" + chave;
  }

  const nome = String(rifa.pixNome)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .substring(0, 25);

  const cidade = String(rifa.pixCidade)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .substring(0, 15);

  const valorFormatado = Number(valor).toFixed(2);

  const merchantAccount =
    campoPix("00", "br.gov.bcb.pix") +
    campoPix("01", chave);

  const additionalData =
    campoPix("05", txid);

  let payload =
    campoPix("00", "01") +
    campoPix("26", merchantAccount) +
    campoPix("52", "0000") +
    campoPix("53", "986") +
    campoPix("54", valorFormatado) +
    campoPix("58", "BR") +
    campoPix("59", nome) +
    campoPix("60", cidade) +
    campoPix("62", additionalData) +
    "6304";

  payload += crc16(payload);

  return payload;
}

/* =========================
   API DA RIFA
========================= */

app.get("/api/rifa", (req, res) => {
  const rifa = lerRifa();

  const reservados = Object.keys(rifa.reservations || {})
    .map(Number)
    .sort((a, b) => a - b);

  res.json({
    title: rifa.title,
    prize: rifa.prize,
    quantity: rifa.quantity,
    price: rifa.price,
    drawDate: rifa.drawDate,
    drawMethod: rifa.drawMethod,
    responsible: rifa.responsible,
    sold: reservados
  });
});

/* =========================
   GERAR PIX
========================= */

app.get("/api/pix", async (req, res) => {
  try {
    const rifa = lerRifa();

    let numbers = String(req.query.numbers || "")
      .split(",")
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n));

    numbers = [...new Set(numbers)];

    if (!numbers.length) {
      return res.status(400).json({
        error: "Selecione pelo menos um número."
      });
    }

    const amount = numbers.length * Number(rifa.price);

    const txid =
      "R" +
      Date.now()
        .toString()
        .slice(-24);

    const pix = gerarPix(amount, txid);

    const qr = await QRCode.toDataURL(pix);

    res.json({
      numbers,
      amount,
      pix,
      qr,
      txid
    });
  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      error: "Não foi possível gerar o Pix."
    });
  }
});

/* =========================
   RESERVAR NÚMEROS
========================= */

app.post("/api/reservar", async (req, res) => {
  try {
    const rifa = lerRifa();

    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").trim();

    let numbers = Array.isArray(req.body.numbers)
      ? req.body.numbers.map(Number)
      : [];

    numbers = [...new Set(numbers)]
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);

    if (!name) {
      return res.status(400).json({
        error: "Informe seu nome."
      });
    }

    if (!phone) {
      return res.status(400).json({
        error: "Informe seu WhatsApp."
      });
    }

    if (!numbers.length) {
      return res.status(400).json({
        error: "Selecione pelo menos um número."
      });
    }

    const invalidos = numbers.filter(
      (n) => n < 1 || n > rifa.quantity
    );

    if (invalidos.length) {
      return res.status(400).json({
        error: "Existe número inválido na seleção."
      });
    }

    const ocupados = numbers.filter(
      (n) => rifa.reservations[String(n)]
    );

    if (ocupados.length) {
      return res.status(409).json({
        error:
          `Os números ${ocupados.join(", ")} já foram reservados.`
      });
    }

    const id =
      "RIFA-" +
      Math.random()
        .toString(36)
        .substring(2, 10)
        .toUpperCase();

    const reserva = {
      id,
      name,
      phone,
      numbers,
      amount: numbers.length * Number(rifa.price),
      status: "Aguardando pagamento",
      createdAt: new Date().toISOString()
    };

    numbers.forEach((number) => {
      rifa.reservations[String(number)] = reserva;
    });

    salvarRifa(rifa);

    await enviarEmailReserva(reserva);

    res.json({
      ok: true,
      reserva
    });
  } catch (erro) {
    console.error(erro);

    res.status(500).json({
      error: "Não foi possível fazer a reserva."
    });
  }
});

/* =========================
   ENVIAR COMPROVANTE
   SOMENTE DEPOIS DA RESERVA
========================= */

app.post(
  "/api/comprovante",
  upload.single("comprovante"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Selecione o comprovante."
        });
      }

      const id = String(req.body.id || "").trim();

      if (!id) {
        return res.status(400).json({
          error: "Código da reserva não informado."
        });
      }

      const rifa = lerRifa();

      let reserva = null;

      for (const item of Object.values(rifa.reservations || {})) {
        if (item && item.id === id) {
          reserva = item;
          break;
        }
      }

      if (!reserva) {
        return res.status(404).json({
          error: "Reserva não encontrada."
        });
      }

      reserva.status = "Comprovante enviado";
      reserva.proofSentAt = new Date().toISOString();

      reserva.numbers.forEach((number) => {
        rifa.reservations[String(number)] = reserva;
      });

      salvarRifa(rifa);

      await enviarComprovante(reserva, req.file);

      res.json({
        ok: true,
        message: "Comprovante enviado com sucesso!"
      });
    } catch (erro) {
      console.error(erro);

      res.status(500).json({
        error: "Não foi possível enviar o comprovante."
      });
    }
  }
);

/* =========================
   RELAÇÃO
========================= */

app.get("/api/reservas", (req, res) => {
  res.json(gerarRelacao());
});

/* =========================
   PÁGINA
========================= */

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">

<title>Rifa Encontro Com Deus</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f4f1ff;
  color: #222;
}

.container {
  width: 94%;
  max-width: 700px;
  margin: 20px auto 50px;
}

.card {
  background: white;
  border-radius: 18px;
  padding: 18px;
  margin-top: 16px;
  box-shadow: 0 4px 18px rgba(0,0,0,.08);
}

img {
  width: 100%;
  display: block;
  border-radius: 18px;
}

h1 {
  font-size: 25px;
  margin: 0 0 12px;
  text-align: center;
}

.info {
  text-align: center;
  line-height: 1.7;
}

.info strong {
  color: #5b2ca0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-top: 15px;
}

.number {
  border: 0;
  border-radius: 10px;
  padding: 12px 4px;
  font-weight: bold;
  cursor: pointer;
  background: #eee;
}

.number:hover {
  transform: scale(1.03);
}

.number.selected {
  background: #6b35b8;
  color: white;
}

.number.reserved {
  background: #bdbdbd;
  color: white;
  cursor: not-allowed;
}

input {
  width: 100%;
  padding: 13px;
  margin-top: 10px;
  border: 1px solid #ccc;
  border-radius: 10px;
  font-size: 16px;
}

button.main {
  width: 100%;
  margin-top: 15px;
  padding: 14px;
  border: 0;
  border-radius: 12px;
  background: #6b35b8;
  color: white;
  font-size: 17px;
  font-weight: bold;
  cursor: pointer;
}

button.copy {
  width: 100%;
  margin-top: 10px;
  padding: 13px;
  border: 0;
  border-radius: 10px;
  background: #eee;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
}

#pagamento {
  display: none;
}

#comprovante {
  display: none;
}

#qr {
  display: block;
  width: 240px;
  max-width: 80%;
  margin: 15px auto;
}

.pixcode {
  background: #f3f3f3;
  border-radius: 10px;
  padding: 12px;
  font-size: 12px;
  word-break: break-all;
}

.valor {
  text-align: center;
  font-size: 24px;
  font-weight: bold;
  color: #5b2ca0;
}

.mensagem {
  margin-top: 12px;
  padding: 12px;
  border-radius: 10px;
  background: #f0f0f0;
  text-align: center;
}

.sucesso {
  background: #e5f7e9;
  color: #1d6b2d;
}

.erro {
  background: #ffe7e7;
  color: #a30000;
}

.small {
  font-size: 13px;
  color: #666;
  text-align: center;
  margin-top: 8px;
}

</style>
</head>

<body>

<div class="container">

  <img src="/imagem-rifa" alt="Rifa Encontro Com Deus">

  <div class="card">

    <h1>🎟️ Rifa Online</h1>

    <div class="info">
      <div><strong>Prêmio:</strong> R$ 200,00 no Pix</div>
      <div><strong>Valor por número:</strong> R$ 10,00</div>
      <div><strong>Sorteio:</strong> 03/10/2026</div>
      <div><strong>Método:</strong> Sorteador</div>
      <div><strong>Responsável:</strong> Fernanda Maria Alves de Souza</div>
    </div>

  </div>

  <div class="card">

    <h2>Escolha seus números</h2>

    <div id="grid" class="grid"></div>

    <div id="selecionados" class="mensagem">
      Nenhum número selecionado.
    </div>

  </div>

  <div class="card">

    <h2>Seus dados</h2>

    <input
      id="nome"
      type="text"
      placeholder="Seu nome"
    >

    <input
      id="whatsapp"
      type="tel"
      placeholder="Seu WhatsApp"
    >

    <button class="main" onclick="gerarPagamento()">
      💳 Continuar para o Pix
    </button>

    <div id="mensagemDados"></div>

  </div>

  <div id="pagamento" class="card">

    <h2>💜 Pagamento via Pix</h2>

    <div class="valor" id="valor"></div>

    <p class="small">
      Escaneie o QR Code ou copie o código Pix abaixo.
    </p>

    <img id="qr" alt="QR Code Pix">

    <div id="pixcode" class="pixcode"></div>

    <button class="copy" onclick="copiarPix()">
      📋 Copiar Pix Copia e Cola
    </button>

    <button class="main" onclick="confirmarReserva()">
      ✅ Confirmar meus números
    </button>

    <div id="mensagemReserva"></div>

  </div>

  <div id="comprovante" class="card">

    <h2>🧾 Enviar comprovante do Pix</h2>

    <p class="small">
      Se você já realizou o pagamento, envie o comprovante para conferência.
    </p>

    <input
      id="arquivo"
      type="file"
      accept="image/*,.pdf"
    >

    <button class="main" onclick="enviarComprovante()">
      📤 Enviar comprovante
    </button>

    <div id="mensagemComprovante"></div>

  </div>

</div>

<script>

let rifa = null;
let reservados = new Set();
let selecionados = [];
let pixAtual = "";
let reservaAtual = null;

async function carregarRifa() {

  const resposta = await fetch("/api/rifa");

  rifa = await resposta.json();

  reservados = new Set(rifa.sold);

  criarGrid();

}

function criarGrid() {

  const grid = document.getElementById("grid");

  grid.innerHTML = "";

  for (let i = 1; i <= rifa.quantity; i++) {

    const button = document.createElement("button");

    button.className = "number";
    button.textContent = String(i).padStart(2, "0");

    if (reservados.has(i)) {

      button.classList.add("reserved");
      button.disabled = true;

    } else {

      button.onclick = () => selecionarNumero(i, button);

    }

    grid.appendChild(button);

  }

}

function selecionarNumero(numero, button) {

  if (selecionados.includes(numero)) {

    selecionados =
      selecionados.filter(n => n !== numero);

    button.classList.remove("selected");

  } else {

    selecionados.push(numero);

    selecionados.sort((a,b) => a-b);

    button.classList.add("selected");

  }

  atualizarSelecionados();

}

function atualizarSelecionados() {

  const area =
    document.getElementById("selecionados");

  if (!selecionados.length) {

    area.textContent =
      "Nenhum número selecionado.";

    return;

  }

  const valor =
    selecionados.length * Number(rifa.price);

  area.innerHTML =
    `<strong>Números:</strong>
     ${selecionados.map(n => String(n).padStart(2,"0")).join(", ")}
     <br>
     <strong>Total:</strong>
     R$ ${valor.toFixed(2).replace(".", ",")}`;

}

async function gerarPagamento() {

  const nome =
    document.getElementById("nome").value.trim();

  const whatsapp =
    document.getElementById("whatsapp").value.trim();

  const mensagem =
    document.getElementById("mensagemDados");

  if (!selecionados.length) {

    mensagem.className = "mensagem erro";

    mensagem.textContent =
      "Selecione pelo menos um número.";

    return;

  }

  if (!nome) {

    mensagem.className = "mensagem erro";

    mensagem.textContent =
      "Informe seu nome.";

    return;

  }

  if (!whatsapp) {

    mensagem.className = "mensagem erro";

    mensagem.textContent =
      "Informe seu WhatsApp.";

    return;

  }

  mensagem.className = "mensagem";
  mensagem.textContent = "Gerando seu Pix...";

  try {

    const resposta = await fetch(
      "/api/pix?numbers=" +
      encodeURIComponent(selecionados.join(","))
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.error);
    }

    pixAtual = dados.pix;

    document.getElementById("valor").textContent =
      "R$ " +
      Number(dados.amount)
        .toFixed(2)
        .replace(".", ",");

    document.getElementById("qr").src =
      dados.qr;

    document.getElementById("pixcode").textContent =
      dados.pix;

    document.getElementById("pagamento").style.display =
      "block";

    document.getElementById("pagamento")
      .scrollIntoView({
        behavior: "smooth"
      });

    mensagem.className = "mensagem sucesso";

    mensagem.textContent =
      "Pix gerado! Faça o pagamento e depois confirme seus números.";

  } catch (erro) {

    mensagem.className = "mensagem erro";

    mensagem.textContent =
      erro.message ||
      "Erro ao gerar Pix.";

  }

}

async function copiarPix() {

  if (!pixAtual) return;

  try {

    await navigator.clipboard.writeText(pixAtual);

    alert("Pix Copia e Cola copiado!");

  } catch {

    alert(
      "Não foi possível copiar automaticamente. Selecione e copie o código."
    );

  }

}

async function confirmarReserva() {

  const nome =
    document.getElementById("nome").value.trim();

  const whatsapp =
    document.getElementById("whatsapp").value.trim();

  const mensagem =
    document.getElementById("mensagemReserva");

  mensagem.className = "mensagem";

  mensagem.textContent =
    "Confirmando sua reserva...";

  try {

    const resposta = await fetch(
      "/api/reservar",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: nome,
          phone: whatsapp,
          numbers: selecionados
        })
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.error);
    }

    reservaAtual = dados.reserva;

    mensagem.className =
      "mensagem sucesso";

    mensagem.innerHTML = `
      <strong>Reserva realizada com sucesso! 🎉</strong><br><br>
      Código da reserva:
      <strong>${dados.reserva.id}</strong><br>
      Números:
      <strong>${dados.reserva.numbers.join(", ")}</strong><br>
      Valor:
      <strong>
        R$ ${Number(dados.reserva.amount)
          .toFixed(2)
          .replace(".", ",")}
      </strong>
    `;

    document.getElementById("comprovante").style.display =
      "block";

    document.getElementById("comprovante")
      .scrollIntoView({
        behavior: "smooth"
      });

    selecionados.forEach(n => reservados.add(n));

  } catch (erro) {

    mensagem.className =
      "mensagem erro";

    mensagem.textContent =
      erro.message ||
      "Não foi possível realizar a reserva.";

  }

}

async function enviarComprovante() {

  if (!reservaAtual) {

    alert("Primeiro faça sua reserva.");

    return;

  }

  const arquivo =
    document.getElementById("arquivo").files[0];

  const mensagem =
    document.getElementById("mensagemComprovante");

  if (!arquivo) {

    mensagem.className =
      "mensagem erro";

    mensagem.textContent =
      "Selecione o comprovante do Pix.";

    return;

  }

  const formData = new FormData();

  formData.append(
    "comprovante",
    arquivo
  );

  formData.append(
    "id",
    reservaAtual.id
  );

  mensagem.className =
    "mensagem";

  mensagem.textContent =
    "Enviando comprovante...";

  try {

    const resposta = await fetch(
      "/api/comprovante",
      {
        method: "POST",
        body: formData
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.error);
    }

    mensagem.className =
      "mensagem sucesso";

    mensagem.textContent =
      "Comprovante enviado com sucesso! Obrigada.";

  } catch (erro) {

    mensagem.className =
      "mensagem erro";

    mensagem.textContent =
      erro.message ||
      "Erro ao enviar comprovante.";

  }

}

carregarRifa();

</script>

</body>
</html>
  `);
});

/* =========================
   SERVIDOR
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Rifa online funcionando na porta ${PORT}`
  );
});
