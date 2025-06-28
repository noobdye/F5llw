const express = require("express");
const multer = require("multer");
const unzipper = require("unzipper");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const axios = require("axios");

const app = express();
const upload = multer({ dest: "uploads/" });

const DISCLOUD_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEwOTg3NDUzODQ4NDg4NTkyNTgiLCJrZXkiOiJhYzRmYTIzZGVjZGFkMjE3ODZlNzY3ZjNiYTk0In0.MPy6WoCQRlts4bHoVRLYyb8gqw9m6eRu3CuQFv7u_JY";

app.use(express.static("public"));

app.post("/upload", upload.single("zipfile"), async (req, res) => {
  if (!req.file || path.extname(req.file.originalname) !== ".zip") {
    return res.status(400).send("❌ Envie um arquivo .zip válido.");
  }

  const zipPath = req.file.path;
  const extractPath = `uploads/${req.file.filename}_unzipped`;

  try {
    fs.mkdirSync(extractPath);

    await fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: extractPath }))
      .promise();

    const buscarArquivos = (dir) => {
      let resultados = [];
      const arquivos = fs.readdirSync(dir);
      for (const arquivo of arquivos) {
        const caminho = path.join(dir, arquivo);
        if (fs.statSync(caminho).isDirectory()) {
          resultados = resultados.concat(buscarArquivos(caminho));
        } else {
          resultados.push(path.relative(extractPath, caminho));
        }
      }
      return resultados;
    };

    const arquivosExtraidos = buscarArquivos(extractPath).map(f => f.toLowerCase());

    const temMain = arquivosExtraidos.includes("main.py");
    const temRequirements = arquivosExtraidos.includes("requirements.txt");

    if (!temMain || !temRequirements) {
      fs.rmSync(extractPath, { recursive: true, force: true });
      fs.unlinkSync(zipPath);
      return res.status(400).send("❌ O ZIP deve conter 'main.py' e 'requirements.txt'");
    }

    // Envia para a Discloud
    const form = new FormData();
    form.append("file", fs.createReadStream(zipPath));
    form.append("ram", "150");
    form.append("main", "main.py");

    const resposta = await axios.post("https://api.discloud.app/v2/app/create", form, {
      headers: {
        "api-token": DISCLOUD_TOKEN,
        ...form.getHeaders(),
      },
    });

    // Apaga os arquivos locais após o envio
    fs.rmSync(extractPath, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

    const respostaDiscloud = resposta.data;

    if (respostaDiscloud.success) {
      res.send("✅ Bot enviado e hospedado na Discloud com sucesso!");
    } else {
      res.status(500).send("❌ Erro na hospedagem Discloud: " + JSON.stringify(respostaDiscloud));
    }

  } catch (erro) {
    console.error("Erro:", erro);
    res.status(500).send("❌ Erro interno ao processar o ZIP ou enviar para a Discloud.");
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
