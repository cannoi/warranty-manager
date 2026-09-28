const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Ensure directories exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Database setup
const dbFile = path.join(DATA_DIR, 'warranties.db');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS warranties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      purchase_date TEXT NOT NULL,
      warranty_months INTEGER NOT NULL,
      expiry_date TEXT NOT NULL,
      invoice_image TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpg, png, webp) are allowed!'));
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API: Get all warranties
app.get('/api/warranties', (req, res) => {
  const query = `SELECT * FROM warranties ORDER BY expiry_date ASC`;
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ warranties: rows });
  });
});

// API: Add a warranty
app.post('/api/warranties', upload.single('invoice_image'), (req, res) => {
  const { name, category, purchase_date, warranty_months, notes } = req.body;
  if (!name || !purchase_date || !warranty_months) {
    return res.status(400).json({ error: 'Missing required fields: name, purchase_date, warranty_months' });
  }

  // Calculate expiry date
  const pDate = new Date(purchase_date);
  pDate.setMonth(pDate.getMonth() + parseInt(warranty_months, 10));
  const expiry_date = pDate.toISOString().split('T')[0];

  const invoice_image = req.file ? `/uploads/${req.file.filename}` : null;

  const query = `INSERT INTO warranties (name, category, purchase_date, warranty_months, expiry_date, invoice_image, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [name, category || 'General', purchase_date, parseInt(warranty_months, 10), expiry_date, invoice_image, notes || ''];

  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      message: 'Success',
      id: this.lastID,
      expiry_date
    });
  });
});

// API: Delete warranty
app.delete('/api/warranties/:id', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT invoice_image FROM warranties WHERE id = ?`, [id], (err, row) => {
    if (row && row.invoice_image) {
      const imgPath = path.join(__dirname, row.invoice_image);
      if (fs.existsSync(imgPath)) {
        try { fs.unlinkSync(imgPath); } catch (e) { console.error(e); }
      }
    }
    db.run(`DELETE FROM warranties WHERE id = ?`, [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Deleted', changes: this.changes });
    });
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Warranty Manager server running on port ${PORT}`);
});
