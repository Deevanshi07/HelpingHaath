/* ===================== CONFIG ===================== */
const API = 'http://localhost:3000'; // change to your Render URL in prod
/* ================================================== */

/* ---------------- helpers ---------------- */
function go(path){ location.href = path; }
function q(name){ const u = new URL(location.href); return u.searchParams.get(name); }

async function postJSON(url, body){
  const res  = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
async function getJSON(url){
  const res  = await fetch(url);
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ---------------- UI helpers ---------------- */
function money(n){ 
  n = Number(n || 0);
  return '₹ ' + n.toLocaleString('en-IN');
}
function pct(raised, goal){
  const r = Number(raised||0), g = Number(goal||0);
  return g ? Math.max(0, Math.min(100, Math.round((r/g)*100))) : 0;
}

/* ---------- requests list (frame3) ---------- */
/* If your page has <div id="requestsGrid"></div>, it will auto-fill */
async function loadRequestsIfAny(){
  const grid  = document.getElementById('requestsGrid');
  const empty = document.getElementById('requestsEmpty');
  if(!grid) return;

  try{
    const data = await getJSON(`${API}/api/requests`);
    const items = Array.isArray(data) ? data : (data.requests || []);
    grid.innerHTML = '';

    if (!items.length){
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    for (const it of items){
      const imgSrc = it.photoFileId ? `${API}/api/files/${it.photoFileId}/view` : 'images/placeholder.jpg';
      const p = pct(it.raisedAmount, it.goalAmount);

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="${imgSrc}" alt="${(it.name||'Person')}" onerror="this.src='images/placeholder.jpg'"/>
        <div class="card-body">
          <div class="badge">${it.type || 'Student'}</div>
          <h3 style="margin:0;font-size:1.1rem;">${it.name || 'Anonymous'}</h3>
          <p style="margin:0;color:#555">${(it.description || '').slice(0,120)}${(it.description||'').length>120?'…':''}</p>
          <div class="money">
            <span>${money(it.raisedAmount || 0)} raised</span>
            <span>Goal: ${money(it.goalAmount || 0)}</span>
          </div>
          <div class="progress-wrap"><div class="progress" style="width:${p}%"></div></div>
        </div>
        <a href="frame23.html?id=${encodeURIComponent(it._id)}" class="login-btn" style="text-decoration:none;">
          <button class="donate-btn">Donate Now</button>
        </a>
      `;
      grid.appendChild(card);
    }
  }catch(e){
    console.error('loadRequestsIfAny error', e);
    grid.innerHTML = '<div class="empty">Could not load requests.</div>';
  }
}

/* ---------- campaigns list (optional page) ---------- */
/* If your page has <div id="campaignsList"></div>, it will auto-fill */
async function loadCampaignsIfAny(){
  const wrap = document.getElementById('campaignsList');
  if(!wrap) return;
  try{
    const data = await getJSON(`${API}/api/campaigns?status=active`);
    wrap.innerHTML = (data.campaigns || []).map(c => `
      <div class="campaign-card" style="border:1px solid #eee;padding:12px;border-radius:10px;margin:10px 0;">
        <h3 style="margin:0 0 6px;">${c.title}</h3>
        ${c.coverUrl ? `<img src="${c.coverUrl}" alt="${c.title}" style="max-width:260px;border-radius:8px;margin:6px 0;">` : ``}
        <p>${c.description || ''}</p>
        <div style="margin:.5rem 0">
          <strong>${money(c.raised)} / ${money(c.goal)}</strong>
          <div style="height:8px;background:#eee;border-radius:6px;overflow:hidden;margin-top:6px;">
            <div style="height:8px;background:#0b57d0;width:${Math.min(100,(c.raised/c.goal)*100)}%"></div>
          </div>
        </div>
        <button class="donate-now" data-id="${c._id}" style="padding:8px 14px;border-radius:8px;border:0;background:#0b57d0;color:#fff;cursor:pointer">
          Donate Now
        </button>
      </div>
    `).join('');

    wrap.querySelectorAll('.donate-now').forEach(btn=>{
      btn.addEventListener('click',()=> go(`frame20.html?campaignId=${encodeURIComponent(btn.dataset.id)}`));
    });
  }catch(e){
    wrap.innerHTML = `<div style="color:#c00">Failed to load campaigns</div>`;
    console.error(e);
  }
}

/* ---------- donation flow (frame20.html) ---------- */
async function startDonation(amount, userEmail, prefill = {}, campaignId){
  // also support requestId (direct donation to a seeker)
  const requestId = q('requestId');
  let orderData;
  try{
    orderData = await postJSON(`${API}/api/razorpay/create-order`, { amount, userEmail, campaignId, requestId });
  }catch(e){
    await postJSON(`${API}/api/donate`, { amount, userEmail, campaignId, requestId });
    alert('Donation recorded (no Razorpay on server).');
    return go('frame29.html');
  }

  if(typeof window.Razorpay !== 'function'){
    alert('Razorpay script not loaded on this page.');
    return;
  }

  const options = {
    key: orderData.key,
    order_id: orderData.order.id,
    amount: orderData.order.amount, // paise
    currency: orderData.order.currency || 'INR',
    name: 'HelpingHaath',
    description: 'Donation',
    prefill: { name: prefill.name || '', email: prefill.email || userEmail || '', contact: prefill.phone || '' },
    theme: { color: '#3399cc' },
    handler: async (resp) => {
      try{
        const vr = await postJSON(`${API}/api/razorpay/verify`, resp);
        if (vr.ok) go('frame29.html');
        else alert('Verification failed');
      }catch(err){
        alert(err.message || 'Verification failed');
      }
    }
  };
  new window.Razorpay(options).open();
}

/* --------------- page wiring --------------- */
document.addEventListener('DOMContentLoaded', () => {
  /* ===== Register (frame31.html) ===== */
  const regForm = document.getElementById('regForm');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd    = new FormData(regForm);
      const email = String(fd.get('email') || '').trim();
      const name  = String(fd.get('name')  || '').trim();
      if (!email) return alert('Please enter your @thapar.edu email');
      try{
        await postJSON(`${API}/api/register`, { email, name });
        go('frame2.html');
      }catch(err){
        console.error('register error:', err);
        alert(err.message);
      }
    });
  }

  /* ===== Login (frame6.html) ===== */
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd      = new FormData(loginForm);
      const email   = String(fd.get('email') || '').trim();
      const password= String(fd.get('password') || '').trim(); // currently ignored by backend
      if (!email) return alert('Please enter your @thapar.edu email');
      try{
        const data = await postJSON(`${API}/api/login`, { email, password });
        if (data?.ok) go('frame3.html'); else alert(data?.error || 'Login failed');
      }catch(err){
        console.error('login error:', err);
        alert(err.message || 'Failed to fetch');
      }
    });
  }

  /* ===== SEEK HELP form (frame4.html) =====
     Form must have id="helpForm" and these input names/ids:
       #name, [name="type"], #contact, #email, #description, [name="income"]
     Optional: #goal for target amount
  */
  const helpForm = document.getElementById('helpForm');
  if (helpForm){
    helpForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd   = new FormData(helpForm);
      const body = {
        name:        String(document.getElementById('name')?.value || '').trim(),
        type:        String(fd.get('type') || '').trim(),
        contact:     String(document.getElementById('contact')?.value || '').trim(),
        email:       String(document.getElementById('email')?.value || '').trim(),
        description: String(document.getElementById('description')?.value || '').trim(),
        income:      String(fd.get('income') || '').trim(),
        goalAmount:  Number(document.getElementById('goal')?.value || 0) || 25000
      };

      if (!body.name || !body.type || !body.contact || !body.email || !body.description || !body.income){
        return alert('Please fill all required fields.');
      }

      try{
        const resp = await postJSON(`${API}/api/requests`, body);
        const id = resp?.request?._id || resp?.id;
        if (!id) alert('Saved, but no id returned'); 
        // remember for next page & redirect to upload with requestId
        if (id) localStorage.setItem('currentRequestId', id);
        go(`frame21.html${id ? `?requestId=${encodeURIComponent(id)}` : ''}`);
      }catch(err){
        console.error('helpForm error:', err);
        alert(err.message || 'Failed to save');
      }
    });
  }

  /* ===== Upload (frame21.html) ===== */
  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    const input = document.getElementById('files');
    const list  = document.getElementById('fileList');
    const label = document.querySelector('.upload-label');
    const box   = document.querySelector('.upload-box');
    const btn   = uploadForm.querySelector('.submit-btn');

    input?.addEventListener('change', () => {
      if (!list) return;
      list.innerHTML = [...input.files].map(f => `<li>${f.name}</li>`).join('');
    });

    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!input || !input.files?.length) return alert('Please choose at least one file.');

      btn.disabled = true;
      btn.textContent = 'Uploading...';

      try {
        const fd  = new FormData(uploadForm);
        // attach requestId if present
        const rid = q('requestId') || localStorage.getItem('currentRequestId');
        if (rid) fd.append('requestId', rid);

        const res = await fetch(`${API}/api/upload`, { method:'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        const filesHtml = (data.files || []).map(f => {
          const url = f.viewUrl ? `${API}${f.viewUrl}` :
                     f.savedAs ? `${API}/uploads/${f.savedAs}` : '#';
          const name = f.original || f.filename || 'file';
          return `<li><a href="${url}" target="_blank">${name}</a></li>`;
        }).join('');

        box.innerHTML = `
          <div style="text-align:center; padding:18px 10px">
            <div style="font-size:32px; line-height:1">✅</div>
            <div style="font-weight:600; margin:6px 0 8px">Uploaded</div>
            <ul style="list-style:none; padding:0; margin:0">${filesHtml}</ul>
          </div>
        `;

        input.disabled = true;
        if (label) { label.textContent = 'Files uploaded'; label.style.pointerEvents = 'none'; }
        btn.textContent = 'Uploaded';
        btn.disabled = true;
        box.classList?.remove('drag');
        box.style.opacity = 0.8;

        setTimeout(()=> go('frame33.html'), 1000); // thank-you page
      } catch (err) {
        console.error('upload error:', err);
        alert(err.message || 'Upload failed');
        btn.textContent = 'Save and Submit';
        btn.disabled = false;
      }
    });
  }

  /* ===== Requests & Campaigns lists (if present) ===== */
  loadRequestsIfAny();
  loadCampaignsIfAny();

  /* ===== Donation (frame20.html) ===== */
  const donationForm = document.getElementById('donationForm');
  const donateBtn    = document.getElementById('donateBtn'); // legacy optional
  const campaignId   = q('campaignId'); // passed via frame20.html?campaignId=...

  if (donationForm) {
    donationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name   = String(document.getElementById('name')?.value || '').trim();
      const email  = String(document.getElementById('email')?.value || '').trim();
      const phone  = String(document.getElementById('phone')?.value || '').trim();
      const amount = Number(document.getElementById('amount')?.value || 0);
      if (!amount || !email) return alert('Enter amount and email');
      startDonation(amount, email, { name, email, phone }, campaignId);
    });
  }

  if (donateBtn) {
    donateBtn.addEventListener('click', () => {
      const amount    = Number(document.getElementById('donationAmount')?.value || 0);
      const userEmail = String(document.getElementById('donorEmail')?.value || '').trim();
      if (!amount || !userEmail) return alert('Enter amount and email');
      startDonation(amount, userEmail, { email: userEmail }, campaignId);
    });
  }
});
