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

// Multer storage factory
const storage = folder =>
  multer.diskStorage({
    destination: (_, __, cb) => cb(null, `uploads/${folder}`),
    filename: (_, file, cb) =>
      cb(null, Date.now() + "-" + file.originalname)
  });

/* ====== GALLERY ====== */
const galleryUpload = multer({ storage: storage("gallery") });

// Upload
app.post("/upload/gallery", galleryUpload.single("file"), (req, res) => {
  const dataFile = "data/gallery.json";
  const gallery = readJSON(dataFile);

  const item = {
    id: Date.now().toString(),
    filename: req.file.filename,
    url: `/uploads/gallery/${req.file.filename}`,
    type: req.file.mimetype.startsWith("image") ? "image" : "file",
    createdAt: Date.now()
  };

  gallery.unshift(item);
  writeJSON(dataFile, gallery);

  res.json({ success: true, item });
});

// Fetch
app.get("/gallery", (_, res) => {
  const gallery = readJSON("data/gallery.json");
  res.json(gallery);  // Must be an array
});

// Delete
app.delete("/gallery/:id", (req, res) => {
  const dataFile = "data/gallery.json";
  let gallery = readJSON(dataFile);

  const item = gallery.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });

  fs.unlinkSync(`uploads/gallery/${item.filename}`);
  gallery = gallery.filter(i => i.id !== req.params.id);
  writeJSON(dataFile, gallery);

  res.json({ success: true });
});

/* ====== NEWS (unchanged) ====== */
// ... your news endpoints ...

// Health check
app.get("/", (_, res) => res.send("Ikhlas Backend Running ✅"));

app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);