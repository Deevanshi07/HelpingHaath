HelpingHaath – Static Deploy (Frontend)

This folder contains the static HTML/CSS pages. We've set `index.html` to the content of `frame1.html` so you have a landing page for hosting.

Quick Deploy Options:
1) Vercel (recommended for static):
   - Push this folder to a new GitHub repo.
   - Import repo on vercel.com → "Deploy".
   - No build command required; output directory is the root.

2) GitHub Pages:
   - Push the contents of this folder to a repo's `main` branch.
   - Enable GitHub Pages (Settings → Pages → "Deploy from a branch").

Next steps for Backend (API + DB):
- Use the backend skeleton we generated (`helpinghaath_backend.zip`).
- After you deploy the backend (Render/Railway), update your HTML/JS to call the API endpoints.
