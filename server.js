const express = require("express");
const multer = require("multer");
const JSZip = require("jszip");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const DISCOULD_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEwOTg3NDUzODQ4NDg4NTkyNTgiLCJrZXkiOiJhYzRmYTIzZGVjZGFkMjE3ODZlNzY3ZjNiYTk0In0.MPy6WoCQRlts4bHoVRLYyb8gqw9m6eRu3CuQFv7u_JY";

app.use(express.static("public"));

app.post("/enviar", upload.single("arquivo"), async (req, res) => {
  try {
    const pyCode = req.file.buffer.toString();

    const zip = new JSZip();
    zip.file("main.py", pyCode);
    zip.file("discloud.config", "TYPE=python\nNAME=SiteHost\nRAM=150");

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const formData = new FormData();
    formData.append("file", zipBuffer, {
      filename: "sitehost.zip",
      contentType: "application/zip"
    });

    const uploadRes = await axios.post("https://api.discloud.app/v2/app/upload", formData, {
      headers: {
        "Authorization": DISCOULD_TOKEN,
        ...formData.getHeaders(),
      },
    });

    res.json(uploadRes.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erro interno no servidor" });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando em http://localhost:${PORT}`));
