const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Serve uploaded files
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

/* ---------------- MEDIA ---------------- */
app.get("/media", (req, res) => {
  const gallery = readJSON(GALLERY_JSON, []);
  // Ensure every item has name, path, type
  const data = gallery.map(item => ({
    name: item.name || "unknown",
    path: item.path,
    type: item.type || "image"
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
/* ---------------- NEWS UPLOAD ---------------- */
const NEWS_UPLOAD_DIR = path.join(__dirname, "uploads", "news");
fs.mkdirSync(NEWS_UPLOAD_DIR, { recursive: true });

const newsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, NEWS_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const newsUpload = multer({ storage: newsStorage });

// Upload news (title, content, optional image)
app.post("/upload-news", newsUpload.single("image"), (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Missing title or content" });

  const news = readJSON(NEWS_JSON, []);
  const newItem = {
    id: Date.now().toString(),
    title,
    content,
    date: Date.now(),
    image: req.file ? `uploads/news/${req.file.filename}` : null
  };

  news.unshift(newItem);
  writeJSON(NEWS_JSON, news);
  res.json(newItem);
});

// Delete news by id
app.post("/delete-news", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing news id" });

  let news = readJSON(NEWS_JSON, []);
  const item = news.find(n => n.id === id);
  if (!item) return res.status(404).json({ error: "News item not found" });

  // Remove the news item from array
  news = news.filter(n => n.id !== id);
  writeJSON(NEWS_JSON, news);

  // Delete image file if exists
  if (item.image) {
    const imgPath = path.join(__dirname, item.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  res.json({ success: true });
});

/* ---------------- START SERVER ---------------- */
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));