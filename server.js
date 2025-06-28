const express = require("express");
const multer = require("multer");
const unzipper = require("unzipper");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const axios = require("axios");

const app = express();
const upload = multer({ dest: "uploads/" });

const DISCLOUD_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEwOTg3NDUzODQ4NDg4NTkyNTgiLCJrZXkiOiJhYzRmYTIzZGVjZGFkMjE3ODZlNzY3ZjNiYTk0In0.MPy6WoCQRlts4bHoVRLYyb8gqw9m6eR";

app.use(express.static("public"));

// Função auxiliar para apagar arquivos/pastas (sincrona)
function apagarLocal(caminho) {
  try {
    if (fs.existsSync(caminho)) {
      const stat = fs.statSync(caminho);
      if (stat.isDirectory()) {
        fs.rmSync(caminho, { recursive: true, force: true });
      } else {
        fs.unlinkSync(caminho);
      }
    }
  } catch (e) {
    console.error("Falha ao apagar:", caminho, e.message);
  }
}

// Função auxiliar para buscar arquivos dentro da pasta recursivamente
function buscarArquivos(dir, baseDir = dir) {
  let resultados = [];
  if (!fs.existsSync(dir)) return resultados;

  const arquivos = fs.readdirSync(dir);
  for (const arquivo of arquivos) {
    const caminho = path.join(dir, arquivo);
    if (fs.statSync(caminho).isDirectory()) {
      resultados = resultados.concat(buscarArquivos(caminho, baseDir));
    } else {
      resultados.push(path.relative(baseDir, caminho).toLowerCase());
    }
  }
  return resultados;
}

app.post("/upload", upload.single("zipfile"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("❌ Nenhum arquivo enviado.");
  }
  if (path.extname(req.file.originalname).toLowerCase() !== ".zip") {
    apagarLocal(req.file.path);
    return res.status(400).send("❌ Envie um arquivo com extensão .zip.");
  }

  const zipPath = req.file.path;
  const extractPath = `uploads/${req.file.filename}_unzipped`;

  try {
    // Cria pasta para extrair
    fs.mkdirSync(extractPath);

    // Extrai arquivo zip
    await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: extractPath })).promise();

    // Valida arquivos essenciais
    const arquivosExtraidos = buscarArquivos(extractPath);
    if (!arquivosExtraidos.includes("main.py") || !arquivosExtraidos.includes("requirements.txt")) {
      apagarLocal(extractPath);
      apagarLocal(zipPath);
      return res.status(400).send("❌ O arquivo .zip deve conter main.py e requirements.txt");
    }

    // Preparar envio para Discloud
    const form = new FormData();
    form.append("file", fs.createReadStream(zipPath));
    form.append("ram", "150");
    form.append("main", "main.py");

    const headers = {
      "api-token": DISCLOUD_TOKEN,
      ...form.getHeaders(),
    };

    // Envia para a Discloud
    const resposta = await axios.post("https://api.discloud.app/v2/app/create", form, { headers });

    apagarLocal(extractPath);
    apagarLocal(zipPath);

    if (resposta.data.success) {
      return res.send(`✅ Bot hospedado com sucesso! ID: ${resposta.data.apps[0].id || "N/A"}`);
    } else {
      return res.status(500).send(`❌ Erro da Discloud: ${JSON.stringify(resposta.data)}`);
    }
  } catch (erro) {
    console.error("Erro durante upload:", erro.message);

    // Limpa tudo no erro
    apagarLocal(extractPath);
    apagarLocal(zipPath);

    return res.status(500).send(`❌ Erro interno: ${erro.message}`);
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
