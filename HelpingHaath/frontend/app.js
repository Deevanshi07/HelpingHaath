// ===================== CONFIG =====================
const API = 'http://localhost:3000'; // change to your Render URL in prod
// ==================================================

// ---------- helpers ----------
async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function getJSON(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function go(path) {
  window.location.href = path;
}

// ---------- page wiring ----------
document.addEventListener('DOMContentLoaded', () => {
  // ========== REGISTER (frame31.html) ==========
  const regForm = document.getElementById('regForm');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(regForm);
      const email = String(fd.get('email') || '').trim();
      const name  = String(fd.get('name')  || '').trim();
      if (!email) return alert('Please enter your @thapar.edu email');

      try {
        await postJSON(`${API}/api/register`, { email, name });
        go('frame2.html');
      } catch (err) {
        console.error('register error:', err);
        alert(err.message);
      }
    });
  }

  // ========== LOGIN (frame6.html) ==========
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(loginForm);
      const email = String(fd.get('email') || '').trim();
      const password = String(fd.get('password') || '').trim(); // currently ignored by backend

      if (!email) return alert('Please enter your @thapar.edu email');

      try {
        const data = await postJSON(`${API}/api/login`, { email, password });
        if (data?.ok) go('frame3.html');
        else alert(data?.error || 'Login failed');
      } catch (err) {
        console.error('login error:', err);
        alert(err.message || 'Failed to fetch');
      }
    });
  }

  // ========== UPLOAD (frame21.html) ==========
  // Requires:
  //  <form id="uploadForm" enctype="multipart/form-data">
  //    <div class="upload-box">
  //      <input id="files" name="files" type="file" hidden multiple required>
  //      <label class="upload-label" for="files">Select Documents To Upload</label>
  //      <p>or drag & drop</p>
  //    </div>
  //    <ul id="fileList"></ul>
  //    <button class="submit-btn" type="submit">Save and Submit</button>
  //  </form>
  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    const input = document.getElementById('files');
    const list  = document.getElementById('fileList');
    const label = document.querySelector('.upload-label');
    const box   = document.querySelector('.upload-box');
    const btn   = uploadForm.querySelector('.submit-btn');

    // show selected file names before uploading (optional)
    input?.addEventListener('change', () => {
      if (!list) return;
      list.innerHTML = [...input.files].map(f => `<li>${f.name}</li>`).join('');
    });

    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('[upload] submit fired');

      if (!input || !input.files?.length) {
        return alert('Please choose at least one file.');
      }

      btn.disabled = true;
      btn.textContent = 'Uploading...';

      try {
        const fd  = new FormData(uploadForm);
        const res = await fetch(`${API}/api/upload`, { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        // Build links to uploaded files (served from /uploads by the backend)
        const filesHtml = (data.files || [])
          .map(f => `<li><a href="${API}/uploads/${f.savedAs}" target="_blank">${f.original}</a></li>`)
          .join('');

        // Replace the grey box with “Uploaded” state + links
        box.innerHTML = `
          <div style="text-align:center; padding:18px 10px">
            <div style="font-size:32px; line-height:1">✅</div>
            <div style="font-weight:600; margin:6px 0 8px">Uploaded</div>
            <ul style="list-style:none; padding:0; margin:0">${filesHtml}</ul>
          </div>
        `;

        // Lock the form visually
        input.disabled = true;
        if (label) {
          label.textContent = 'Files uploaded';
          label.style.pointerEvents = 'none';
        }
        btn.textContent = 'Uploaded';
        btn.disabled = true;
        box.classList?.remove('drag');
        box.style.opacity = 0.8;

        // Optional toast
        alert('✅ Uploaded successfully!');

        // Redirect to thank-you page
        setTimeout(() => go('frame33.html'), 1200);
      } catch (err) {
        console.error('upload error:', err);
        alert(err.message || 'Upload failed');
        btn.textContent = 'Save and Submit';
        btn.disabled = false;
      }
    });
  }

  // ========== DONATE (frame20.html) ==========
  // Supports:
  //  A) <form id="donationForm"> with #name, #email, #phone, #amount
  //  B) Legacy controls: #donationAmount, #donorEmail and #donateBtn
  const donationForm = document.getElementById('donationForm');
  const donateBtn    = document.getElementById('donateBtn');

  async function startDonation(amount, userEmail, prefill = {}) {
    let data;
    try {
      // Preferred: create Razorpay order
      data = await postJSON(`${API}/api/razorpay/create-order`, { amount, userEmail });
    } catch (e) {
      // Fallback: placeholder “record only”
      const placeholder = await postJSON(`${API}/api/donate`, { amount, userEmail });
      alert('Donation recorded (placeholder backend). Add Razorpay routes to enable payments.');
      return;
    }

    // Checkout script must be loaded on the page
    if (typeof window.Razorpay !== 'function') {
      alert('Razorpay script not loaded. Include checkout.js on this page.');
      return;
    }

    const options = {
      key: data.key,
      order_id: data.order.id,
      amount: data.order.amount,                 // paise
      currency: data.order.currency || 'INR',
      name: 'HelpingHaath',
      description: 'Donation',
      prefill: {
        name:   prefill.name  || '',
        email:  prefill.email || userEmail || '',
        contact: prefill.phone || ''
      },
      theme: { color: '#3399cc' },
      handler: async (resp) => {
        try {
          const vr = await postJSON(`${API}/api/razorpay/verify`, resp);
          if (vr.ok) go('frame29.html');        // success page
          else alert('Verification failed');
        } catch (err) {
          alert(err.message || 'Verification failed');
        }
      }
    };

    new window.Razorpay(options).open();
  }

  // A) New donation form
  if (donationForm) {
    donationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name   = String(document.getElementById('name')?.value || '').trim();
      const email  = String(document.getElementById('email')?.value || '').trim();
      const phone  = String(document.getElementById('phone')?.value || '').trim();
      const amount = Number(document.getElementById('amount')?.value || 0);
      if (!amount || !email) return alert('Enter amount and email');
      startDonation(amount, email, { name, email, phone });
    });
  }

  // B) Legacy button + 2 inputs
  if (donateBtn) {
    donateBtn.addEventListener('click', () => {
      const amount = Number(document.getElementById('donationAmount')?.value || 0);
      const userEmail = String(document.getElementById('donorEmail')?.value || '').trim();
      if (!amount || !userEmail) return alert('Enter amount and email');
      startDonation(amount, userEmail, { email: userEmail });
    });
  }
});
