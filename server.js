const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* =========================
   ENSURE FOLDERS
========================= */
["uploads/gallery", "uploads/news", "data"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/* =========================
   HELPERS
========================= */
const readJSON = file =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : [];

const writeJSON = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

/* =========================
   MULTER STORAGE
========================= */
const storage = folder =>
  multer.diskStorage({
    destination: (_, __, cb) => cb(null, `uploads/${folder}`),
    filename: (_, file, cb) =>
      cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"))
  });

/* =========================
   GALLERY UPLOAD
========================= */
const galleryUpload = multer({ storage: storage("gallery") });

app.post("/upload", galleryUpload.single("file"), (req, res) => {
  try {
    const galleryFile = "data/gallery.json";
    const gallery = readJSON(galleryFile);

    const type = req.body.type; // image | video | audio
    if (!type) return res.status(400).json({ error: "Missing type" });

    const item = {
      id: Date.now(),
      name: req.file.originalname,
      path: `uploads/gallery/${req.file.filename}`,
      type,
      createdAt: Date.now()
    };

    gallery.unshift(item);
    writeJSON(galleryFile, gallery);

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

/* =========================
   UNIFIED MEDIA ENDPOINT
   (USED BY GALLERY + UPLOAD)
========================= */
app.get("/media", (_, res) => {
  const gallery = readJSON("data/gallery.json");
  res.json(gallery);
});

/* =========================
   DELETE MEDIA
========================= */
app.post("/delete", (req, res) => {
  try {
    const { path: filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: "Missing path" });

    const galleryFile = "data/gallery.json";
    let gallery = readJSON(galleryFile);

    gallery = gallery.filter(item => item.path !== filePath);
    writeJSON(galleryFile, gallery);

    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

/* =========================
   NEWS (UNCHANGED & SAFE)
========================= */
const newsUpload = multer({ storage: storage("news") });

app.post("/upload/news", newsUpload.single("file"), (req, res) => {
  const newsFile = "data/news.json";
  const news = readJSON(newsFile);

  const item = {
    id: Date.now(),
    title: req.body.title || "",
    description: req.body.description || "",
    image: req.file ? `uploads/news/${req.file.filename}` : null,
    createdAt: Date.now()
  };

  news.unshift(item);
  writeJSON(newsFile, news);

  res.json(item);
});

app.get("/news", (_, res) => {
  res.json(readJSON("data/news.json"));
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (_, res) => {
  res.send("Ikhlas Backend Running ✅");
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});