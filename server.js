const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Ensure folders exist
["uploads/gallery", "uploads/news", "data"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helpers
const readJSON = file =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];

const writeJSON = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Multer storage
const galleryStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/gallery"),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const newsStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/news"),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const galleryUpload = multer({ storage: galleryStorage });
const newsUpload = multer({ storage: newsStorage });

/* =========================
   🔹 UNIFIED MEDIA (FOR GALLERY + UPLOAD.HTML)
========================= */

// Upload (USED BY upload.html)
app.post("/upload", galleryUpload.single("file"), (req, res) => {
  try {
    const dataFile = "data/gallery.json";
    const gallery = readJSON(dataFile);

    const type = req.body.type || "image";
    const item = {
      id: Date.now(),
      name: req.file.originalname,
      path: `uploads/gallery/${req.file.filename}`,
      type
    };

    gallery.unshift(item);
    writeJSON(dataFile, gallery);

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

// Fetch media (USED BY gallery.html & upload.html)
app.get("/media", (_, res) => {
  res.json(readJSON("data/gallery.json"));
});

// Delete media (USED BY upload.html)
app.post("/delete", (req, res) => {
  try {
    const { path: filePath } = req.body;
    const dataFile = "data/gallery.json";

    let gallery = readJSON(dataFile);
    const item = gallery.find(i => i.path === filePath);

    if (!item) return res.status(404).json({ error: "Not found" });

    const fullPath = path.join(__dirname, item.path);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    gallery = gallery.filter(i => i.path !== filePath);
    writeJSON(dataFile, gallery);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

/* =========================
   🔹 NEWS (KEEP AS-IS)
========================= */

// Upload news
app.post("/upload/news", newsUpload.single("file"), (req, res) => {
  const dataFile = "data/news.json";
  const news = readJSON(dataFile);

  const item = {
    id: Date.now(),
    title: req.body.title || "",
    description: req.body.description || "",
    filename: req.file ? req.file.filename : null,
    url: req.file ? `/uploads/news/${req.file.filename}` : null,
    createdAt: new Date()
  };

  news.unshift(item);
  writeJSON(dataFile, news);

  res.json({ success: true, item });
});

// Fetch news
app.get("/news", (_, res) => {
  res.json(readJSON("data/news.json"));
});

// Delete news
app.delete("/news/:id", (req, res) => {
  const dataFile = "data/news.json";
  let news = readJSON(dataFile);

  const item = news.find(n => n.id == req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });

  if (item.filename) {
    const fp = `uploads/news/${item.filename}`;
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  news = news.filter(n => n.id != req.params.id);
  writeJSON(dataFile, news);

  res.json({ success: true });
});

// Health
app.get("/", (_, res) => res.send("Ikhlas Backend Running ✅"));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});