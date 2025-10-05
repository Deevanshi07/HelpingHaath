// server.js
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

// ----------------- CONFIG -----------------
const PORT = process.env.PORT || 3000;

const allowedOrigins =
  (process.env.ALLOW_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean)) ||
  ['http://localhost:5500', 'http://127.0.0.1:5500'];

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // Postman/curl
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error(`CORS blocked for ${origin}`));
  },
  credentials: true,
};

// Razorpay (optional)
const hasRzp = !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
const razorpay = hasRzp
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

// ----------------- APP -----------------
const app = express();
app.use((req, _res, next) => { console.log(`${req.method} ${req.url}`); next(); });
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------------- DATABASE + GRIDFS -----------------
if (!process.env.MONGODB_URI) {
  console.error('❌ Missing MONGODB_URI env var');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
console.log('✅ MongoDB Connected');

let gridfsBucket = null;
let storageReady = false;
try {
  // You can create a GridFSBucket right after a successful connect
  gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads',
  });
  storageReady = true;
  console.log('📦 GridFS bucket ready');
} catch (e) {
  console.error('GridFS init error:', e);
}

// ----------------- MODELS -----------------
const User = mongoose.model(
  'User',
  new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    name: String,
    createdAt: { type: Date, default: Date.now },
  })
);

const Donation = mongoose.model(
  'Donation',
  new mongoose.Schema({
    amount: Number,
    userEmail: String,
    orderId: String,
    paymentId: String,
    status: { type: String, default: 'created' }, // created | paid | failed | success
    createdAt: { type: Date, default: Date.now },
  })
);

// Document metadata (reference GridFS file id)
const Document = mongoose.model(
  'Document',
  new mongoose.Schema({
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true }, // GridFS _id
    filename: String,
    userEmail: String,
    size: Number,
    mime: String,
    uploadedAt: { type: Date, default: Date.now },
  })
);

// ----------------- MULTER (in-memory) -----------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 }, // 15MB/file
});

// ----------------- CORE ROUTES -----------------
app.get('/', (_req, res) => {
  res.status(200).send(`
    <h1>HelpingHaath Backend Live 🚀</h1>
    <p>MongoDB Connected ✅</p>
    <p>Try <a href="/health">/health</a> for JSON check.</p>
  `);
});

app.get('/health', (_req, res) => res.json({ ok: true, storageReady }));

// ---------- Auth (demo) ----------
app.post('/api/register', async (req, res) => {
  try {
    const { email, name } = req.body || {};
    if (!/^[^@]+@thapar\.edu$/i.test(String(email || ''))) {
      return res.status(400).json({ error: 'Only @thapar.edu emails allowed' });
    }
    const user = await User.findOneAndUpdate(
      { email },
      { name },
      { upsert: true, new: true }
    );
    res.status(201).json({ ok: true, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email } = req.body || {};
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- Upload to GridFS ----------
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!storageReady || !gridfsBucket) {
      return res.status(503).json({ error: 'Storage not ready' });
    }

    const userEmail = (req.body?.userEmail || '').trim(); // optional
    const results = [];

    for (const f of req.files || []) {
      const stream = gridfsBucket.openUploadStream(f.originalname, {
        contentType: f.mimetype,
        metadata: { userEmail },
      });

      await new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('finish', resolve);
        stream.end(f.buffer);
      });

      await Document.create({
        fileId: stream.id,
        filename: f.originalname,
        userEmail,
        size: f.size,
        mime: f.mimetype,
      });

      results.push({
        id: String(stream.id),
        filename: f.originalname,
        size: f.size,
        mime: f.mimetype,
        viewUrl: `/api/files/${String(stream.id)}/view`,
        downloadUrl: `/api/files/${String(stream.id)}/download`,
      });
    }

    res.json({ ok: true, files: results });
  } catch (err) {
    console.error('upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ---------- Files list / view / download ----------
app.get('/api/files', async (req, res) => {
  const email = String(req.query.email || '').trim();
  const q = email ? { userEmail: email } : {};
  const docs = await Document.find(q).sort({ uploadedAt: -1 }).lean();
  res.json({
    ok: true,
    files: docs.map(d => ({
      id: String(d.fileId),
      filename: d.filename,
      size: d.size,
      mime: d.mime,
      uploadedAt: d.uploadedAt,
      viewUrl: `/api/files/${String(d.fileId)}/view`,
      downloadUrl: `/api/files/${String(d.fileId)}/download`,
    })),
  });
});

app.get('/api/files/:id/view', async (req, res) => {
  try {
    const _id = new ObjectId(req.params.id);
    const files = await gridfsBucket.find({ _id }).toArray();
    if (!files.length) return res.status(404).json({ error: 'Not found' });

    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    gridfsBucket.openDownloadStream(_id).pipe(res);
  } catch {
    res.status(400).json({ error: 'Bad id' });
  }
});

app.get('/api/files/:id/download', async (req, res) => {
  try {
    const _id = new ObjectId(req.params.id);
    const files = await gridfsBucket.find({ _id }).toArray();
    if (!files.length) return res.status(404).json({ error: 'Not found' });

    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${files[0].filename}"`);
    gridfsBucket.openDownloadStream(_id).pipe(res);
  } catch {
    res.status(400).json({ error: 'Bad id' });
  }
});

// ---------- Razorpay ----------
app.post('/api/razorpay/create-order', async (req, res) => {
  try {
    if (!hasRzp) {
      return res.status(501).json({ error: 'Razorpay not configured on server' });
    }
    const { amount, userEmail } = req.body || {};
    const rupees = Number(amount || 0);
    if (!rupees || rupees <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(rupees * 100), // paise
      currency: 'INR',
      receipt: `donation_${Date.now()}`,
      notes: { userEmail },
    });

    await Donation.create({
      amount: rupees,
      userEmail,
      orderId: order.id,
      status: 'created',
    });

    res.json({ key: process.env.RAZORPAY_KEY_ID, order });
  } catch (err) {
    console.error('create-order error:', err);
    res.status(500).json({ error: 'Razorpay order creation failed' });
  }
});

app.post('/api/razorpay/verify', async (req, res) => {
  try {
    if (!hasRzp) {
      return res.status(501).json({ error: 'Razorpay not configured on server' });
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing Razorpay params' });
    }

    const h = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    h.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const expected = h.digest('hex');

    const ok = expected === razorpay_signature;
    await Donation.findOneAndUpdate(
      { orderId: razorpay_order_id },
      { status: ok ? 'paid' : 'failed', paymentId: razorpay_payment_id }
    );

    res.json({ ok });
  } catch (err) {
    console.error('verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Fallback (no Razorpay): record only
app.post('/api/donate', async (req, res) => {
  try {
    const { amount, userEmail } = req.body || {};
    const rupees = Number(amount || 0);
    if (!rupees || rupees <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const entry = await Donation.create({
      amount: rupees,
      userEmail,
      status: 'success',
    });
    res.json({ ok: true, donation: entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----------------- START -----------------
app.listen(PORT, () => console.log(`🚀 Backend running on ${PORT}`));
