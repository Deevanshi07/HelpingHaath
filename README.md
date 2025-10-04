HelpingHaath – Backend (Express + MongoDB)

Endpoints (minimal placeholders):
- GET  /health
- POST /api/register   { email, name }        # validates @thapar.edu, upserts user
- POST /api/login      { email }
- POST /api/upload     form-data: files[]     # saved locally; replace with S3/Cloudinary
- POST /api/donate     { amount, userEmail }  # placeholder; integrate Razorpay/Stripe

Deploy (Render or Railway):
1) Push this folder to GitHub.
2) Create a Web Service (Node) on Render/Railway.
3) Set environment variables:
   - MONGODB_URI = your MongoDB Atlas connection string
   - ALLOW_ORIGIN = your Vercel/GitHub Pages frontend URL (for CORS)
   - (optional) PORT
4) Start command: npm start

Then update your frontend JS to call the API:
fetch('https://<your-api>.onrender.com/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name }) })
