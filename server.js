const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 10000;

const file = "rifa.json";

const dadosIniciais = {
  title: "Rifa Encontro Com Deus - Radicais Kids | Juvenis",
  prize: "R$ 200,00",
  quantity: 100,
  price: 10,
  drawDate: "03/10/2026",
  drawMethod: "Sorteador",
  responsible: "Fernanda Souza",
  pix: "62 996251975",
  pixNome: "Fernanda Maria Alves de Souza",
  reservations: {}
};

if (!fs.existsSync(file)) {
  fs.writeFileSync(file, JSON.stringify(dadosIniciais, null, 2));
}

function ler() {
  return JSON.parse(fs.readFileSync(file));
}

function salvar(dados) {
  fs.writeFileSync(file, JSON.stringify(dados, null, 2));
}

app.use(express.json());
app.get("/imagem-rifa", (req, res) => {
  res.sendFile(path.join(__dirname, "IMG-20260909-WA0152.jpg"));
});
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rifa Radicais Kids</title>

<style>
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: linear-gradient(#dff7ff, #b9ecff);
  color: #49335f;
}

header {
  text-align: center;
  padding: 25px 10px;
  background: #ffffff88;
}

h1 {
  color: #995fe0;
}

main {
  max-width: 900px;
  margin: auto;
  padding: 15px;
}

.card {
  background: white;
  border-radius: 22px;
  padding: 20px;
  margin: 15px 0;
  box-shadow: 0 5px 20px #0001;
  text-align: center;
}

.numbers {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 6px;
}

.num {
  padding: 10px 2px;
  border: 0;
  border-radius: 8px;
  background: #d8f8df;
  color: #196b37;
  font-weight: bold;
}

.sold {
  background: #efb5b5;
  color: #8b2525;
}

input {
  padding: 13px;
  margin: 6px;
  width: 90%;
  max-width: 500px;
  border: 1px solid #ddd;
  border-radius: 10px;
}

button {
  padding: 12px 18px;
  border: 0;
  border-radius: 10px;
  background: #8b55d6;
  color: white;
  font-weight: bold;
}

@media(max-width:600px) {
  .numbers {
    grid-template-columns: repeat(5, 1fr);
  }
}
</style>
</head>

<body>

<header>
<img src="/imagem-rifa" alt="Encontro com Deus - Radicais Kids" style="width:100%;max-width:600px;border-radius:20px;">
<h1>☀️ Rifa Encontro Com Deus - Radicais Kids | Juvenis</h1>
</header>

<main>

<div class="card">
<h2>🎁 Prêmio: R$ 200,00</h2>
<p>R$ 10,00 por número</p>
<p>Sorteio: 03/10/2026</p>
<p>Responsável: <b>Fernanda Souza</b></p>
</div>

<div class="card">
<h2>Escolha seus números</h2>
<p>🟢 Disponível &nbsp; 🔴 Reservado</p>
<div id="nums" class="numbers"></div>
</div>

<div class="card">

<input id="name" placeholder="Seu nome completo">

<input id="phone" placeholder="WhatsApp">

<br><br>

<button onclick="reserve()">
Reservar números
</button>

<p id="msg"></p>

</div>

<div class="card">

<h2>💚 Pagamento via Pix</h2>

<p><b>62 996251975</b></p>

<p>
Após realizar o pagamento,
envie o comprovante ao responsável.
</p>

</div>

</main>

<script>

let selected = new Set();
let sold = [];

async function load() {

  let d = await (await fetch("/api/rifa")).json();

  sold = d.sold;

  nums.innerHTML = "";

  for (let i = 1; i <= d.quantity; i++) {

    let b = document.createElement("button");

    b.className = "num " + 
      (sold.includes(i) ? "sold" : "");

    b.textContent = String(i).padStart(2, "0");

    if (!sold.includes(i)) {

      b.onclick = () => {

        if (selected.has(i)) {

          selected.delete(i);

          b.style.background = "#d8f8df";
          b.style.color = "#196b37";

        } else {

          selected.add(i);

          b.style.background = "#8b55d6";
          b.style.color = "white";
        }
      };
    }

    nums.appendChild(b);
  }
}

async function reserve() {

  if (
    !selected.size ||
    !name.value ||
    !phone.value
  ) {

    msg.textContent =
      "Selecione números e preencha seus dados.";

    return;
  }

  let r = await fetch("/api/reservar", {

    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({

      numbers: [...selected],

      name: name.value,

      phone: phone.value
    })
  });

  let d = await r.json();

  msg.textContent =
    r.ok
      ? "Reserva feita! Números: " +
        d.numbers.join(", ")
      : d.error;

  if (r.ok) {

    selected.clear();

    load();
  }
}

load();

</script>

</body>
</html>
`);
});

app.get("/api/rifa", (req, res) => {

  let d = ler();

  res.json({

    ...d,

    sold: Object.keys(d.reservations).map(Number)

  });
});

app.post("/api/reservar", (req, res) => {

  let { numbers, name, phone } = req.body;

  let d = ler();

  numbers = [
    ...new Set(
      (numbers || []).map(Number)
    )
  ];

  if (!numbers.length || !name || !phone) {

    return res.status(400).json({
      error: "Preencha os dados."
    });
  }

  let usados = numbers.filter(
    n => d.reservations[n]
  );

  if (usados.length) {

    return res.status(409).json({

      error:
        "Já reservado: " +
        usados.join(", ")
    });
  }

  numbers.forEach(n => {

    d.reservations[n] = {

      name,

      phone,

      createdAt:
        new Date().toISOString()
    };

  });

  salvar(d);

  res.json({

    ok: true,

    numbers
  });
});

app.listen(
  PORT,
  "0.0.0.0",
  () => console.log("Rifa online")
);
