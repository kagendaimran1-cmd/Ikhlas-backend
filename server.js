// server.js
const axios = require("axios");
const FormData = require("form-data");
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Phone storage server URL (Termux storage)
const PHONE_STORAGE = "http://192.168.180.104:9000/upload"; // replace with your phone IP

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Serve uploaded files from Render server
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const GALLERY_JSON = path.join(__dirname, "data", "gallery.json");
const NEWS_JSON = path.join(__dirname, "data/news.json");

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

/* ---------------- Multer for media ---------------- */
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

/* ---------------- Phone upload helper ---------------- */
async function sendToPhone(filePath, filename) {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), filename);

    const res = await axios.post(PHONE_STORAGE, form, {
      headers: form.getHeaders(),
      timeout: 8000
    });

    return res.data;
  } catch (err) {
    console.log("Phone upload failed, using Render backup.");
    return null;
  }
}

/* ---------------- MEDIA ROUTES ---------------- */
app.get("/media", (req, res) => {
  const gallery = readJSON(GALLERY_JSON, []);
  const data = gallery.map(item => ({
    name: item.name || "unknown",
    path: item.path,
    type: item.type || "image"
  }));
  res.json(data);
});

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const type = req.body.type || "image";
  const gallery = readJSON(GALLERY_JSON, []);
  const localPath = path.join(__dirname, req.file.path);

  // Send file to phone storage
  const phoneResult = await sendToPhone(localPath, req.file.filename);

  const item = {
    name: req.file.originalname,
    type,
    path: phoneResult
      ? `PHONE:/videos/${req.file.filename}`   // hosted on phone
      : `uploads/${type}/${req.file.filename}` // fallback to Render
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

  // Only delete local Render file if it exists
  const fullPath = path.join(__dirname, filePath.replace("PHONE:", ""));
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  res.json({ success: true });
});

/* ---------------- NEWS ROUTES ---------------- */
app.get("/news", (req, res) => {
  const news = readJSON(NEWS_JSON, []);
  res.json(news);
});

const NEWS_UPLOAD_DIR = path.join(__dirname, "uploads", "news");
fs.mkdirSync(NEWS_UPLOAD_DIR, { recursive: true });

const newsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, NEWS_UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const newsUpload = multer({ storage: newsStorage });

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

app.post("/delete-news", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing news id" });

  let news = readJSON(NEWS_JSON, []);
  const item = news.find(n => n.id === id);
  if (!item) return res.status(404).json({ error: "News item not found" });

  news = news.filter(n => n.id !== id);
  writeJSON(NEWS_JSON, news);

  if (item.image) {
    const imgPath = path.join(__dirname, item.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  res.json({ success: true });
});

/* ---------------- START SERVER ---------------- */
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));