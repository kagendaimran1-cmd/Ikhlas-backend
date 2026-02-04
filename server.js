const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const GALLERY_JSON = path.join(__dirname, "data", "gallery.json");
const NEWS_JSON = path.join(__dirname, "data", "news.json");

/* ---------------- Helpers ---------------- */
function readJSON(file, fallback = []) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* ---------------- Multer ---------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.body.type || "image";
    const dir = path.join(__dirname, "uploads", type);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

/* ---------------- MEDIA (Gallery) ---------------- */
app.get("/media", (req, res) => {
  const gallery = readJSON(GALLERY_JSON, []);
  const data = gallery.map(item => ({
    name: item.name || item.filename,
    path: item.path || item.url,
    type: item.type
  }));
  res.json(data);
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const type = req.body.type || "image";
  const gallery = readJSON(GALLERY_JSON, []);

  const item = {
    name: req.file.originalname,
    path: `uploads/${type}/${req.file.filename}`,
    type
  };

  gallery.unshift(item);
  writeJSON(GALLERY_JSON, gallery);

  res.json(item);
});

app.post("/delete", (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: "Missing path" });

  const gallery = readJSON(GALLERY_JSON, []);
  const updated = gallery.filter(i => i.path !== filePath);
  writeJSON(GALLERY_JSON, updated);

  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  res.json({ success: true });
});

/* ---------------- NEWS ---------------- */
app.get("/news", (req, res) => {
  const news = readJSON(NEWS_JSON, []);
  res.json(news);
});

/* ---------------- START SERVER ---------------- */
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));