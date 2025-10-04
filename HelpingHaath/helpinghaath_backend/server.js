// // import 'dotenv/config';
// // import express from 'express';
// // import mongoose from 'mongoose';
// // import cors from 'cors';
// // import multer from 'multer';

// // // ensure uploads dir exists on Render too
// // import fs from 'fs';
// // fs.mkdirSync('uploads', { recursive: true });

// // const upload = multer({ dest: 'uploads/' });   // <-- bas yeh ek hi baar


// // const app = express();
// // app.use((req, res, next) => { 
// //   console.log(req.method, req.url); 
// //   next(); 
// // });

// // const PORT = process.env.PORT || 3000;
// // const ORIGIN = process.env.ALLOW_ORIGIN?.split(',') || '*';

// // // ---------- MIDDLEWARE ----------
// // app.use(cors({ origin: ORIGIN, credentials: true }));
// // app.use(express.json());
// // app.use(express.urlencoded({ extended: true }));

// // // ---------- DATABASE ----------
// // if (!process.env.MONGODB_URI) {
// //   console.error("❌ Missing MONGODB_URI env var");
// //   process.exit(1);
// // }

// // try {
// //   await mongoose.connect(process.env.MONGODB_URI);
// //   console.log("✅ MongoDB Connected");
// // } catch (err) {
// //   console.error("❌ MongoDB Connection Error:", err.message);
// //   process.exit(1);
// // }

// // // ---------- MODELS ----------
// // const User = mongoose.model('User', new mongoose.Schema({
// //   email: { type: String, unique: true, required: true },
// //   name: String,
// //   createdAt: { type: Date, default: Date.now }
// // }));

// // const Donation = mongoose.model('Donation', new mongoose.Schema({
// //   amount: Number,
// //   userEmail: String,
// //   status: { type: String, default: 'created' },
// //   createdAt: { type: Date, default: Date.now }
// // }));

// // // ---------- ROUTES ----------

// // // Health check
// // app.get('/', (req, res) => res.send('OK'));
// // app.get('/health', (req, res) => res.json({ ok: true }));

// // // Register
// // app.post('/api/register', async (req, res) => {
// //   try {
// //     const { email, name } = req.body;
// //     if (!/^[^@]+@thapar\.edu$/.test(email)) {
// //       return res.status(400).json({ error: "Only @thapar.edu emails allowed" });
// //     }
// //     const user = await User.findOneAndUpdate(
// //       { email },
// //       { name },
// //       { upsert: true, new: true }
// //     );
// //     res.status(201).json({ ok: true, user });
// //   } catch (e) {
// //     res.status(400).json({ error: e.message });
// //   }
// // });

// // // Login
// // app.post('/api/login', async (req, res) => {
// //   try {
// //     const { email } = req.body;
// //     const user = await User.findOne({ email });
// //     if (!user) return res.status(404).json({ error: "User not found" });
// //     res.json({ ok: true, user });
// //   } catch (e) {
// //     res.status(400).json({ error: e.message });
// //   }
// // });

// // // Upload — for now, local only (Cloudinary later)
// // // const upload = multer({ dest: 'uploads/' });
// // app.post('/api/upload', upload.array('files', 10), (req, res) => {
// //   const files = (req.files || []).map(f => ({
// //     original: f.originalname,
// //     savedAs: f.filename
// //   }));
// //   res.json({ ok: true, files });
// // });

// // // Root route for Render testing
// // app.get('/', (req, res) => {
// //   res.status(200).send(`
// //     <h1>HelpingHaath Backend Live 🚀</h1>
// //     <p>MongoDB Connected ✅</p>
// //     <p>Try <a href="/health">/health</a> for JSON check.</p>
// //   `);
// // });

// // // Donation placeholder
// // app.post('/api/donate', async (req, res) => {
// //   try {
// //     const { amount, userEmail } = req.body;
// //     if (!amount || amount <= 0)
// //       return res.status(400).json({ error: "Invalid amount" });
// //     const entry = await Donation.create({ amount, userEmail, status: 'success' });
// //     res.json({ ok: true, donation: entry });
// //   } catch (e) {
// //     res.status(400).json({ error: e.message });
// //   }
// // });

// // // ---------- START ----------
// // app.listen(PORT, () => console.log(`🚀 Backend running on ${PORT}`));














// // server.js (ESM)

// import 'dotenv/config';
// import express from 'express';
// import mongoose from 'mongoose';
// import cors from 'cors';
// import multer from 'multer';
// import fs from 'fs';
// import Razorpay from 'razorpay';
// import crypto from 'crypto';

// // ---------- CONFIG ----------
// const PORT = process.env.PORT || 3000;
// const ORIGIN = process.env.ALLOW_ORIGIN?.split(',') || '*';

// // ensure uploads dir exists locally / on Render
// fs.mkdirSync('uploads', { recursive: true });

// // Razorpay (initialized only if keys exist)
// const hasRzp =
//   !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;

// const razorpay = hasRzp
//   ? new Razorpay({
//       key_id: process.env.RAZORPAY_KEY_ID,
//       key_secret: process.env.RAZORPAY_KEY_SECRET,
//     })
//   : null;

// // ---------- APP ----------
// const app = express();

// // log each request (handy on Render)
// app.use((req, _res, next) => {
//   console.log(req.method, req.url);
//   next();
// });

// app.use(cors({ origin: ORIGIN, credentials: true }));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // ---------- DATABASE ----------
// if (!process.env.MONGODB_URI) {
//   console.error('❌ Missing MONGODB_URI env var');
//   process.exit(1);
// }
// try {
//   await mongoose.connect(process.env.MONGODB_URI);
//   console.log('✅ MongoDB Connected');
// } catch (err) {
//   console.error('❌ MongoDB Connection Error:', err.message);
//   process.exit(1);
// }

// // ---------- MODELS ----------
// const User = mongoose.model(
//   'User',
//   new mongoose.Schema({
//     email: { type: String, unique: true, required: true },
//     name: String,
//     createdAt: { type: Date, default: Date.now },
//   })
// );

// // Store Razorpay lifecycle
// const Donation = mongoose.model(
//   'Donation',
//   new mongoose.Schema({
//     amount: Number, // rupees
//     userEmail: String,
//     orderId: String, // Razorpay order id
//     paymentId: String, // Razorpay payment id
//     status: { type: String, default: 'created' }, // created | paid | failed
//     createdAt: { type: Date, default: Date.now },
//   })
// );

// // ---------- UPLOAD ----------
// const upload = multer({ dest: 'uploads/' });

// // ---------- ROUTES ----------

// // Health / root
// app.get('/', (_req, res) => {
//   res
//     .status(200)
//     .send(
//       `<h1>HelpingHaath Backend Live 🚀</h1><p>MongoDB Connected ✅</p><p>Try <a href="/health">/health</a> for JSON check.</p>`
//     );
// });
// app.get('/health', (_req, res) => res.json({ ok: true }));

// // Register
// app.post('/api/register', async (req, res) => {
//   try {
//     const { email, name } = req.body;
//     if (!/^[^@]+@thapar\.edu$/i.test(email)) {
//       return res.status(400).json({ error: 'Only @thapar.edu emails allowed' });
//     }
//     const user = await User.findOneAndUpdate(
//       { email },
//       { name },
//       { upsert: true, new: true }
//     );
//     res.status(201).json({ ok: true, user });
//   } catch (e) {
//     res.status(400).json({ error: e.message });
//   }
// });

// // Login (email-only for now)
// app.post('/api/login', async (req, res) => {
//   try {
//     const { email } = req.body;
//     const user = await User.findOne({ email });
//     if (!user) return res.status(404).json({ error: 'User not found' });
//     res.json({ ok: true, user });
//   } catch (e) {
//     res.status(400).json({ error: e.message });
//   }
// });

// // Upload (local disk)
// app.post('/api/upload', upload.array('files', 10), (req, res) => {
//   const files =
//     req.files?.map((f) => ({ original: f.originalname, savedAs: f.filename })) ||
//     [];
//   res.json({ ok: true, files });
// });

// // ---------- RAZORPAY: create order ----------
// app.post('/api/razorpay/create-order', async (req, res) => {
//   try {
//     if (!hasRzp) {
//       return res
//         .status(501)
//         .json({ error: 'Razorpay not configured on server' });
//     }
//     const { amount, userEmail } = req.body;
//     const rupees = Number(amount || 0);
//     if (!rupees || rupees <= 0) {
//       return res.status(400).json({ error: 'Invalid amount' });
//     }

//     const order = await razorpay.orders.create({
//       amount: Math.round(rupees * 100), // paise
//       currency: 'INR',
//       receipt: `donation_${Date.now()}`,
//       notes: { userEmail },
//     });

//     // store record
//     await Donation.create({
//       amount: rupees,
//       userEmail,
//       orderId: order.id,
//       status: 'created',
//     });

//     res.json({ key: process.env.RAZORPAY_KEY_ID, order });
//   } catch (err) {
//     console.error('create-order error:', err);
//     res.status(500).json({ error: 'Razorpay order creation failed' });
//   }
// });

// // ---------- RAZORPAY: verify signature from Checkout handler ----------
// app.post('/api/razorpay/verify', async (req, res) => {
//   try {
//     if (!hasRzp) {
//       return res
//         .status(501)
//         .json({ error: 'Razorpay not configured on server' });
//     }
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
//       req.body || {};

//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return res.status(400).json({ error: 'Missing Razorpay params' });
//     }

//     const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
//     hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
//     const expected = hmac.digest('hex');

//     const ok = expected === razorpay_signature;

//     await Donation.findOneAndUpdate(
//       { orderId: razorpay_order_id },
//       {
//         status: ok ? 'paid' : 'failed',
//         paymentId: razorpay_payment_id,
//       }
//     );

//     res.json({ ok });
//   } catch (err) {
//     console.error('verify error:', err);
//     res.status(500).json({ error: 'Verification failed' });
//   }
// });

// // Optional: simple poll/read status by order id
// app.get('/api/donations/:orderId', async (req, res) => {
//   const d = await Donation.findOne({ orderId: req.params.orderId });
//   if (!d) return res.status(404).json({ error: 'Not found' });
//   res.json({ ok: true, donation: d });
// });

// // ---------- RAZORPAY: webhook (optional, for server-to-server) ----------
// app.post('/api/razorpay/webhook', express.json({ type: '*/*' }), async (req, res) => {
//   try {
//     const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
//     if (!secret) return res.status(501).json({ error: 'Webhook secret not set' });

//     const sig = req.header('x-razorpay-signature');
//     const body = JSON.stringify(req.body);
//     const expected = crypto
//       .createHmac('sha256', secret)
//       .update(body)
//       .digest('hex');

//     if (expected !== sig) return res.status(400).json({ error: 'Bad signature' });

//     const event = req.body?.event;
//     const payload = req.body?.payload;

//     if (event === 'payment.captured') {
//       const orderId = payload?.payment?.entity?.order_id;
//       const paymentId = payload?.payment?.entity?.id;
//       await Donation.findOneAndUpdate(
//         { orderId },
//         { status: 'paid', paymentId }
//       );
//     }
//     if (event === 'payment.failed') {
//       const orderId = payload?.payment?.entity?.order_id;
//       const paymentId = payload?.payment?.entity?.id;
//       await Donation.findOneAndUpdate(
//         { orderId },
//         { status: 'failed', paymentId }
//       );
//     }

//     res.json({ ok: true });
//   } catch (err) {
//     console.error('webhook error:', err);
//     res.status(500).json({ error: 'Webhook error' });
//   }
// });

// // ---------- START ----------
// app.listen(PORT, () => console.log(`🚀 Backend running on ${PORT}`));

















import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// ----------------- CONFIG -----------------
const PORT = process.env.PORT || 3000;

// Allow origins: comma separated in ALLOW_ORIGIN or '*'
const allowedOrigins =
  (process.env.ALLOW_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean)) || ['*'];

const corsOptions = {
  origin(origin, cb) {
    // allow same-origin / curl / Postman (no origin)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error(`CORS blocked for ${origin}`));
  },
  credentials: true,
};

// Ensure uploads directory exists
fs.mkdirSync('uploads', { recursive: true });

// Razorpay client (only if keys exist)
const hasRzp = !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
const razorpay = hasRzp
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

// ----------------- APP -----------------
const app = express();

// tiny request logger
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------------- DATABASE -----------------
if (!process.env.MONGODB_URI) {
  console.error('❌ Missing MONGODB_URI env var');
  process.exit(1);
}
try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB Connected');
} catch (err) {
  console.error('❌ MongoDB Connection Error:', err.message);
  process.exit(1);
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
    amount: Number,          // rupees
    userEmail: String,
    orderId: String,         // Razorpay order id
    paymentId: String,       // Razorpay payment id
    status: { type: String, default: 'created' }, // created | paid | failed | success(placeholder)
    createdAt: { type: Date, default: Date.now },
  })
);

// ----------------- UPLOAD -----------------
const upload = multer({ dest: 'uploads/' });

// ----------------- ROUTES -----------------

// Root & health
app.get('/', (_req, res) => {
  res
    .status(200)
    .send(
      `<h1>HelpingHaath Backend Live 🚀</h1>
       <p>MongoDB Connected ✅</p>
       <p>Try <a href="/health">/health</a> for JSON check.</p>`
    );
});
app.get('/health', (_req, res) => res.json({ ok: true }));

// Register (email-only demo)
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

// Login (email-only demo)
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

// Upload to local /uploads
app.post('/api/upload', upload.array('files', 10), (req, res) => {
  const files =
    req.files?.map(f => ({ original: f.originalname, savedAs: f.filename })) || [];
  res.json({ ok: true, files });
});

// --------- Razorpay: Create Order ----------
app.post('/api/razorpay/create-order', async (req, res) => {
  try {
    if (!hasRzp) {
      // Frontend can fall back to /api/donate if it sees this error
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

// --------- Razorpay: Verify from Checkout handler ----------
app.post('/api/razorpay/verify', async (req, res) => {
  try {
    if (!hasRzp) {
      return res.status(501).json({ error: 'Razorpay not configured on server' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing Razorpay params' });
    }

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const expected = hmac.digest('hex');

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

// Optional polling: check status by order id
app.get('/api/donations/:orderId', async (req, res) => {
  const d = await Donation.findOne({ orderId: req.params.orderId });
  if (!d) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, donation: d });
});

// --------- Razorpay: Webhook (optional) ----------
app.post('/api/razorpay/webhook', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(501).json({ error: 'Webhook secret not set' });

    const sig = req.header('x-razorpay-signature');
    const body = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (expected !== sig) return res.status(400).json({ error: 'Bad signature' });

    const event = req.body?.event;
    const payload = req.body?.payload;

    if (event === 'payment.captured') {
      const orderId = payload?.payment?.entity?.order_id;
      const paymentId = payload?.payment?.entity?.id;
      await Donation.findOneAndUpdate({ orderId }, { status: 'paid', paymentId });
    } else if (event === 'payment.failed') {
      const orderId = payload?.payment?.entity?.order_id;
      const paymentId = payload?.payment?.entity?.id;
      await Donation.findOneAndUpdate({ orderId }, { status: 'failed', paymentId });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('webhook error:', err);
    res.status(500).json({ error: 'Webhook error' });
  }
});

// --------- Fallback (no Razorpay): simple record ---------
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
      status: 'success', // placeholder success
    });
    res.json({ ok: true, donation: entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----------------- START -----------------
app.listen(PORT, () => console.log(`🚀 Backend running on ${PORT}`));
