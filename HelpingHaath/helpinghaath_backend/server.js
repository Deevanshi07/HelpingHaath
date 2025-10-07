import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

/* -------------------------- CONFIG -------------------------- */
const PORT = process.env.PORT || 3000;

const allowedOrigins =
  (process.env.ALLOW_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean)) ||
  ['http://localhost:5500', 'http://127.0.0.1:5500'];

const corsOptions = {
  origin(origin, cb) {
    // allow Postman/curl/etc (no Origin header)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error(`CORS blocked for ${origin}`));
  },
  credentials: true,
};

const hasRzp = !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
const razorpay = hasRzp
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

/* --------------------------- APP ---------------------------- */
const app = express();
app.use((req, _res, next) => { console.log(`${req.method} ${req.url}`); next(); });
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -------------------- DB & GridFS Storage ------------------- */
if (!process.env.MONGODB_URI) {
  console.error('❌ Missing MONGODB_URI env var');
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI);
console.log('✅ MongoDB Connected');

let gridfsBucket = null;
let storageReady = false;
try {
  gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads',
  });
  storageReady = true;
  console.log('📦 GridFS bucket ready');
} catch (e) {
  console.error('GridFS init error:', e);
}

/* -------------------------- MODELS -------------------------- */
const User = mongoose.model(
  'User',
  new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    name: String,
    createdAt: { type: Date, default: Date.now },
  })
);

// Donation can optionally be tied to a campaignId
const Donation = mongoose.model(
  'Donation',
  new mongoose.Schema({
    amount: Number,
    userEmail: String,
    orderId: String,
    paymentId: String,
    status: { type: String, default: 'created' }, // created | paid | failed | success
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
    createdAt: { type: Date, default: Date.now },
  })
);

// GridFS file metadata
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

// --- Help Request model (who needs help) ---
const HelpRequest = mongoose.model(
  'HelpRequest',
  new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ['Student','TeachingStaff','NonTeachingStaff'], required: true },
    phone: String,
    email: { type: String, required: true },
    description: String,
    monthlyIncome: String,
    goalAmount: { type: Number, default: 0 },   // optional target
    raisedAmount: { type: Number, default: 0 }, // update after donations if you like
    docs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }], // optional: link uploads
    status: { type: String, default: 'open' },   // open | closed
    createdAt: { type: Date, default: Date.now }
  })
);

// ⭐ Campaigns (requests for help)
const Campaign = mongoose.model(
  'Campaign',
  new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    goal: { type: Number, required: true },        // target in INR
    raised: { type: Number, default: 0 },          // total collected
    status: { type: String, default: 'active' },   // active | funded | closed
    coverUrl: String,                               // optional image url
    createdBy: String,                              // optional email
    createdAt: { type: Date, default: Date.now },
  }, { timestamps: true })
);

/* ------------------------- UPLOADS -------------------------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 }, // 15MB/file, max 10
});

/* ------------------------ HELPERS --------------------------- */
function isValidId(id) {
  try { return !!new ObjectId(id); } catch { return false; }
}

async function applyFundingProgress(campaignId, deltaAmount) {
  if (!campaignId || !isValidId(campaignId)) return;

  const c = await Campaign.findById(campaignId);
  if (!c) return;

  c.raised = (c.raised || 0) + Number(deltaAmount || 0);
  if (c.raised >= c.goal) c.status = 'funded';
  await c.save();
}

// ===== Campaign model =====
const Campaign = mongoose.model(
  'Campaign',
  new mongoose.Schema({
    name: String,              // person who needs help
    type: String,              // Student / TeachingStaff / NonTeachingStaff
    contact: String,
    email: String,
    description: String,
    income: String,
    targetAmount: Number,
    raised: { type: Number, default: 0 },
    coverUrl: String,          // optional image later
    status: { type: String, default: 'active' }, // active | closed
    createdAt: { type: Date, default: Date.now },
  })
);

// ===== Campaign routes =====

// Create a campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    const body = req.body || {};
    // very light validation
    const required = ['name','type','contact','email','description','income','targetAmount'];
    for (const k of required) if (!body[k]) {
      return res.status(400).json({ error: `Missing ${k}` });
    }

    const c = await Campaign.create({
      name: body.name,
      type: body.type,
      contact: body.contact,
      email: body.email,
      description: body.description,
      income: body.income,
      targetAmount: Number(body.targetAmount),
      raised: 0,
      status: 'active',
      coverUrl: body.coverUrl || ''
    });
    res.status(201).json({ ok: true, campaign: c });
  } catch (err) {
    console.error('campaign create error:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// List campaigns (defaults to active)
app.get('/api/campaigns', async (req, res) => {
  const status = (req.query.status || 'active').trim();
  const list = await Campaign.find({ status })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json({ ok: true, campaigns: list });
});

// (optional) get one
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, campaign: c });
  } catch {
    res.status(400).json({ error: 'Bad id' });
  }
});

/* ------------------------ CORE ROUTES ----------------------- */
app.get('/', (_req, res) => {
  res.status(200).send(`
    <h1>HelpingHaath Backend Live 🚀</h1>
    <p>MongoDB Connected ✅</p>
    <p>Try <a href="/health">/health</a> for JSON check.</p>
  `);
});
app.get('/health', (_req, res) => res.json({ ok: true, storageReady }));

/* --------------------- Auth (demo only) --------------------- */
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

// Create new help request (frame4 submit)
app.post('/api/requests', async (req, res) => {
  try {
    const { name, type, phone, email, description, monthlyIncome, goalAmount } = req.body || {};
    if (!name || !email || !type) return res.status(400).json({ error: 'Missing required fields' });

    const doc = await HelpRequest.create({
      name, type, phone, email, description, monthlyIncome,
      goalAmount: Number(goalAmount || 0)
    });

    res.status(201).json({ ok: true, request: doc });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List requests (frame3 shows these)
app.get('/api/requests', async (_req, res) => {
  const items = await HelpRequest.find({ status: 'open' }).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, requests: items });
});

/* --------------------- Uploads to GridFS -------------------- */
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!storageReady || !gridfsBucket) {
      return res.status(503).json({ error: 'Storage not ready' });
    }
    const userEmail = (req.body?.userEmail || '').trim();
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

/* --------------------- ⭐ CAMPAIGNS API --------------------- */

// Create a campaign (called when someone requests help)
app.post('/api/campaigns', async (req, res) => {
  try {
    const body = req.body || {};

    // validate
    if (!body.name || !body.targetAmount || body.targetAmount <= 0) {
      return res.status(400).json({ error: 'Name and positive target amount required' });
    }

    const campaign = await Campaign.create({
      name: body.name,
      type: body.type,
      contact: body.contact,
      email: body.email,
      description: body.description,
      income: body.income,
      targetAmount: Number(body.targetAmount),
      raised: 0,
      status: 'active',
      coverUrl: body.coverUrl || ''
    });

    res.status(201).json({ ok: true, campaign });
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});


// List campaigns (default = active)
app.get('/api/campaigns', async (req, res) => {
  const status = (req.query.status || 'active').toString();
  const q = status === 'all' ? {} : { status };
  const campaigns = await Campaign.find(q).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, campaigns });
});

// Campaign details
app.get('/api/campaigns/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const c = await Campaign.findById(req.params.id).lean();
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, campaign: c });
});

// Optional: close a campaign manually
app.patch('/api/campaigns/:id/close', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const c = await Campaign.findByIdAndUpdate(
    req.params.id,
    { status: 'closed' },
    { new: true }
  );
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, campaign: c });
});

/* ------------------------ RAZORPAY -------------------------- */

// Create order (pass campaignId from frontend)
app.post('/api/razorpay/create-order', async (req, res) => {
  try {
    if (!hasRzp) {
      return res.status(501).json({ error: 'Razorpay not configured on server' });
    }
    const { amount, userEmail, campaignId } = req.body || {};
    const rupees = Number(amount || 0);
    if (!rupees || rupees <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (campaignId && !isValidId(campaignId)) {
      return res.status(400).json({ error: 'Bad campaignId' });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(rupees * 100), // paise
      currency: 'INR',
      receipt: `donation_${Date.now()}`,
      notes: { userEmail, campaignId },
    });

    await Donation.create({
      amount: rupees,
      userEmail,
      orderId: order.id,
      status: 'created',
      campaignId: campaignId || null,
    });

    res.json({ key: process.env.RAZORPAY_KEY_ID, order });
  } catch (err) {
    console.error('create-order error:', err);
    res.status(500).json({ error: 'Razorpay order creation failed' });
  }
});

// Verify from Razorpay Checkout handler
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

    // Update donation
    const donation = await Donation.findOneAndUpdate(
      { orderId: razorpay_order_id },
      { status: ok ? 'paid' : 'failed', paymentId: razorpay_payment_id },
      { new: true }
    );

    // Increment campaign progress on success
    if (ok && donation?.campaignId) {
      await applyFundingProgress(donation.campaignId, donation.amount);
    }

    res.json({ ok });
  } catch (err) {
    console.error('verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/* ------------- Fallback (no Razorpay): record only ---------- */
// You may call this with { amount, userEmail, campaignId }
app.post('/api/donate', async (req, res) => {
  try {
    const { amount, userEmail, campaignId } = req.body || {};
    const rupees = Number(amount || 0);
    if (!rupees || rupees <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (campaignId && !isValidId(campaignId)) {
      return res.status(400).json({ error: 'Bad campaignId' });
    }

    const entry = await Donation.create({
      amount: rupees,
      userEmail,
      status: 'success',
      campaignId: campaignId || null,
    });

    // Apply progress immediately
    if (campaignId) {
      await applyFundingProgress(campaignId, rupees);
    }

    res.json({ ok: true, donation: entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* --------------------------- START -------------------------- */
app.listen(PORT, () => console.log(`🚀 Backend running on ${PORT}`));
