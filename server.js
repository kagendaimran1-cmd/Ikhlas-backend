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
app.use("/uploads", express.static("uploads"));

/* =========================
   ENSURE DIRECTORIES
========================= */
["uploads/gallery", "uploads/news", "data"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/* =========================
   HELPERS
========================= */
const readJSON = file =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];

const writeJSON = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

/* =========================
   MULTER STORAGE
========================= */
const storage = folder =>
  multer.diskStorage({
    destination: (_, __, cb) => cb(null, `uploads/${folder}`),
    filename: (_, file, cb) =>
      cb(null, Date.now() + "-" + file.originalname)
  });

/* =========================
   GALLERY (LEGACY ROUTES)
========================= */
const galleryUpload = multer({ storage: storage("gallery") });

app.post("/upload/gallery", galleryUpload.single("file"), (req, res) => {
  const dataFile = "data/gallery.json";
  const gallery = readJSON(dataFile);

  const item = {
    id: Date.now(),
    filename: req.file.filename,
    url: `/uploads/gallery/${req.file.filename}`,
    type: req.file.mimetype,
    createdAt: new Date()
  };

  gallery.unshift(item);
  writeJSON(dataFile, gallery);

  res.json({ success: true, item });
});

app.get("/gallery", (_, res) => {
  res.json(readJSON("data/gallery.json"));
});

app.delete("/gallery/:id", (req, res) => {
  const dataFile = "data/gallery.json";
  let gallery = readJSON(dataFile);

  const item = gallery.find(i => i.id == req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });

  fs.unlinkSync(`uploads/gallery/${item.filename}`);
  gallery = gallery.filter(i => i.id != req.params.id);
  writeJSON(dataFile, gallery);

  res.json({ success: true });
});

/* =========================
   NEWS (LEGACY ROUTES)
========================= */
const newsUpload = multer({ storage: storage("news") });

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

app.get("/news", (_, res) => {
  res.json(readJSON("data/news.json"));
});

app.delete("/news/:id", (req, res) => {
  const dataFile = "data/news.json";
  let news = readJSON(dataFile);

  const item = news.find(n => n.id == req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });

  if (item.filename) fs.unlinkSync(`uploads/news/${item.filename}`);
  news = news.filter(n => n.id != req.params.id);
  writeJSON(dataFile, news);

  res.json({ success: true });
});

/* =========================
   FRONTEND-COMPATIBLE ROUTES
========================= */

/* ---- MEDIA FEED ---- */
app.get("/media", (_, res) => {
  const gallery = readJSON("data/gallery.json").map(item => ({
    name: item.filename,
    path: item.url.replace(/^\//, ""),
    type: item.type.startsWith("image")
      ? "image"
      : item.type.startsWith("video")
      ? "video"
      : "audio"
  }));

  res.json(gallery);
});

/* ---- GENERIC UPLOAD (upload.html) ---- */
app.post(
  "/upload",
  multer({ storage: storage("gallery") }).single("file"),
  (req, res) => {
    const dataFile = "data/gallery.json";
    const gallery = readJSON(dataFile);

    const fileType = req.body.type || "image";

    const item = {
      id: Date.now(),
      filename: req.file.filename,
      url: `/uploads/gallery/${req.file.filename}`,
      type:
        fileType === "image"
          ? "image/jpeg"
          : fileType === "video"
          ? "video/mp4"
          : "audio/mpeg",
      createdAt: new Date()
    };

    gallery.unshift(item);
    writeJSON(dataFile, gallery);

    res.json({
      name: item.filename,
      path: item.url.replace(/^\//, ""),
      type: fileType
    });
  }
);

/* ---- DELETE (upload.html) ---- */
app.post("/delete", (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: "Path required" });

  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  const dataFile = "data/gallery.json";
  let gallery = readJSON(dataFile);
  gallery = gallery.filter(
    i => !i.url.endsWith(filePath.split("/").pop())
  );
  writeJSON(dataFile, gallery);

  res.json({ success: true });
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (_, res) => res.send("Ikhlas Backend Running ✅"));

app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);