// // HelpingHaath client wiring (frontend <-> backend)
// // 1) Set your deployed backend URL here:
// const API = 'http://localhost:3000';

// async function postJSON(url, body) {
//   const res = await fetch(url, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(body)
//   });
//   const data = await res.json();
//   if (!res.ok) throw new Error(data.error || 'Request failed');
//   return data;
// }

// async function checkStatus(orderId) {
//   setTimeout(async () => {
//     const res = await fetch(`${API}/api/donations/${orderId}`);
//     const data = await res.json();
//     if (res.ok && data.donation?.status === 'paid') {
//       window.location.href = 'frame29.html'; // success page
//     } else if (res.ok && data.donation?.status === 'failed') {
//       alert('Payment failed. Please try again.');
//     } else {
//       setTimeout(() => checkStatus(orderId), 2000);
//     }
//   }, 1500);
// }

// document.addEventListener('DOMContentLoaded', () => {
//   // Register form (frame31.html) -> id="regForm"
//   const regForm = document.getElementById('regForm');
//   if (regForm) {
//     regForm.addEventListener('submit', async (e) => {
//       e.preventDefault();
//       const fd = new FormData(regForm);
//       const email = fd.get('email');
//       const name = fd.get('name');
//       try {
//         await postJSON(`${API}/api/register`, { email, name });
//         window.location.href = 'frame2.html';
//       } catch (err) { alert(err.message); }
//     });
//   }

//   // Login form (frame6.html) -> id="loginForm"
//   const loginForm = document.getElementById('loginForm');
//   if (loginForm) {
//     loginForm.addEventListener('submit', async (e) => {
//       e.preventDefault();
//       const fd = new FormData(loginForm);
//       const email = fd.get('email');
//       try {
//         await postJSON(`${API}/api/login`, { email });
//         window.location.href = 'frame3.html';
//       } catch (err) { alert(err.message); }
//     });
//   }

//   // Upload form (frame21.html) -> id="uploadForm" & input name="files"
// const API = 'http://localhost:3000'; // local testing

// document.addEventListener('DOMContentLoaded', () => {
//   const uploadForm = document.getElementById('uploadForm');
//   if (uploadForm) {
//     uploadForm.addEventListener('submit', async (e) => {
//       e.preventDefault();
//       const fd = new FormData(uploadForm); // includes files[]
//       try {
//         const res = await fetch(`${API}/api/upload`, { method: 'POST', body: fd });
//         const data = await res.json();
//         if (!res.ok) throw new Error(data.error || 'Upload failed');
//         // success -> go to thank-you page
//         window.location.href = 'frame33.html';
//       } catch (err) {
//         alert(err.message);
//         console.error('upload error:', err);
//       }
//     });
//   }
// });


//   // Donation button (frame20.html) -> id="donateBtn", fields: donationAmount, donorEmail
//   const donateBtn = document.getElementById('donateBtn');
//   if (donateBtn) {
//     donateBtn.addEventListener('click', async () => {
//       try {
//         const amount = Number(document.getElementById('donationAmount')?.value || 0);
//         const userEmail = document.getElementById('donorEmail')?.value || '';
//         if (!amount || amount <= 0) throw new Error('Enter a valid amount');
//         if (!userEmail) throw new Error('Enter your email');
//         const data = await postJSON(`${API}/api/razorpay/create-order`, { amount, userEmail });
//         const options = {
//           key: data.key,
//           amount: data.order.amount,
//           currency: data.order.currency,
//           name: 'HelpingHaath',
//           description: 'Donation',
//           order_id: data.order.id,
//           prefill: { email: userEmail },
//           handler: () => checkStatus(data.order.id),
//           theme: { color: '#3399cc' }
//         };
//         const rzp = new window.Razorpay(options);
//         rzp.open();
//       } catch (err) { alert(err.message); }
//     });
//   }
// });











const API = 'http://localhost:3000';

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

document.addEventListener('DOMContentLoaded', () => {
  const regForm = document.getElementById('regForm');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(regForm);
      const email = String(fd.get('email') || '').trim();
      const name  = String(fd.get('name')  || '').trim();
      try {
        await postJSON(`${API}/api/register`, { email, name });
        go('frame2.html'); 
      } catch (err) {
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
    const email = String(fd.get('email') || '').trim();      // must exist in the form
    const password = String(fd.get('password') || '').trim(); // backend currently ignores

    if (!email) return alert('Please enter your @thapar.edu email');

    try {
      const data = await postJSON(`${API}/api/login`, { email, password });
      if (data?.ok) {
        go('frame3.html');
      } else {
        alert(data?.error || 'Login failed');
      }
    } catch (err) {
      console.error('login error:', err);
      alert(err.message || 'Failed to fetch');
    }
  });
}


  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(uploadForm); 
      try {
        const res = await fetch(`${API}/api/upload`, { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        go('frame33.html'); 
      } catch (err) {
        alert(err.message || 'Upload failed');
        console.error('upload error:', err);
      }
    });
  }

  const donationForm = document.getElementById('donationForm');
  const donateBtn    = document.getElementById('donateBtn');

  async function startDonation(amount, userEmail, prefill = {}) {
    let data;
    try {
      data = await postJSON(`${API}/api/razorpay/create-order`, { amount, userEmail });
    } catch (e) {
      const placeholder = await postJSON(`${API}/api/donate`, { amount, userEmail });
      alert('Donation recorded (placeholder backend). Add Razorpay routes to enable payments.');
      return;
    }

    if (typeof window.Razorpay !== 'function') {
      alert('Razorpay script not loaded. Include checkout.js on this page.');
      return;
    }

    const options = {
      key: data.key,
      order_id: data.order.id,
      amount: data.order.amount,         
      currency: data.order.currency || 'INR',
      name: 'HelpingHaath',
      description: 'Donation',
      prefill: {
        name:  prefill.name  || '',
        email: prefill.email || userEmail || '',
        contact: prefill.phone || ''
      },
      theme: { color: '#3399cc' },
      handler: async (resp) => {
        try {
          const vr = await postJSON(`${API}/api/razorpay/verify`, resp);
          if (vr.ok) go('frame29.html');  
          else alert('Verification failed');
        } catch (err) {
          alert(err.message || 'Verification failed');
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  if (donationForm) {
    donationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name   = String(document.getElementById('name')?.value || '').trim();
      const email  = String(document.getElementById('email')?.value || '').trim();
      const phone  = String(document.getElementById('phone')?.value || '').trim();
      const amount = Number(document.getElementById('amount')?.value || 0);
      if (!amount || !email) return alert('Enter amount and email');
      startDonation(amount, email, { name, email, phone });
    });
  }

  if (donateBtn) {
    donateBtn.addEventListener('click', async () => {
      const amount = Number(document.getElementById('donationAmount')?.value || 0);
      const userEmail = String(document.getElementById('donorEmail')?.value || '').trim();
      if (!amount || !userEmail) return alert('Enter amount and email');
      startDonation(amount, userEmail, { email: userEmail });
    });
  }
});

