# Portofolio — Deployment Guide

This repository contains your static portfolio site (HTML/CSS/JS). This README shows step-by-step instructions to publish it publicly (static hosting) and connect it to Supabase for persistent data.

Recommended stack
- Static hosting: Vercel or Netlify (both offer free tiers and custom domain support)
- Backend: Supabase (Postgres + Storage) — you already have `supabase-setup.sql` in the repo to create required tables

Quick checklist
1. Create a GitHub repository and push this project. (Commands below).
2. Create a Supabase project and run `supabase-setup.sql` in the SQL editor.
3. Deploy static site to Vercel or Netlify and set environment variables (SUPABASE_URL, SUPABASE_KEY).
4. (Optional) Add a custom domain in your hosting provider and point DNS to their records.

PowerShell steps to initialize Git and push to GitHub
(you must create an empty repo on GitHub first)

```powershell
# from project root (Windows PowerShell)
cd "c:\CODING\Web Portofolio"
git init
git add -A
git commit -m "Initial portofolio site"
# Replace <your-git-remote-url> with the GitHub repo URL (HTTPS or SSH)
git remote add origin <your-git-remote-url>
git branch -M main
git push -u origin main
```

Deploy to Vercel (recommended)
1. Sign in to https://vercel.com with GitHub and import the repository.
2. During setup, set environment variables in Vercel Dashboard > Project > Settings > Environment Variables:
   - SUPABASE_URL = https://your-project.supabase.co
   - SUPABASE_KEY = <your-supabase-anon-key>
3. Vercel will detect a static project and deploy. The site will be available at `https://<project>.vercel.app`.
4. To configure a custom domain, go to the Domains tab in the project and follow instructions (add A/CNAME records at your DNS provider). Vercel provisions SSL automatically.

Deploy to Netlify
1. Sign in to https://app.netlify.com and click "New site from Git".
2. Connect your GitHub repo and follow the steps; for a static site you can leave the build command blank and publish directory set to `/` (the repo root).
3. Set environment variables in Site settings > Build & deploy > Environment:
   - SUPABASE_URL
   - SUPABASE_KEY
4. Netlify will deploy and give you a `.netlify.app` domain. Add a custom domain in Site settings > Domain management and configure DNS with your registrar. Netlify provisions SSL automatically.

Supabase setup
1. Create a Supabase project at https://app.supabase.com (free tier available).
2. In your project, open the SQL editor and run `supabase-setup.sql` from this repo (copy/paste) to create the required tables.
3. Create a Storage bucket named `assets` (for CV and images) and upload `assets/CV_Ikbaar_Rafi_Hermansyah.pdf` or use the dashboard to upload your files.
4. In Project Settings > API, copy the `URL` and `anon` public `API Key`. Add these to Vercel/Netlify as environment variables.

Security notes
- Never expose the `service_role` key in client-side code. Use the anon key for safe public reads and set RLS (Row Level Security) policies + Supabase Auth for secure writes.
- If you need privileged one-time migration using the `service_role` key, run a server-side script locally (I can generate a migration script for you).

Optional: Automatic migration of existing localStorage data
- I can add a Node.js script that reads exported JSON from localStorage and inserts it into Supabase using the `service_role` key. This must be run locally or on a secure server (not committed with the key).

Files added to help deploy
- `netlify.toml` — minimal Netlify config (redirects)
- `vercel.json` — minimal Vercel config for static deployment
- `.gitignore` — ignores common local files

If you want, I can:
- Create the migration script to copy your localStorage into Supabase (Node.js script using service_role key).
- Walk you through configuring a custom domain step-by-step for a specific registrar (Cloudflare, Namecheap, GoDaddy).
- Connect the repo to Vercel/Netlify if you give me GitHub access (or I can provide the exact UI steps).

Which hosting provider do you prefer (Vercel or Netlify)? Or do you already have a domain registrar so I can provide domain-specific DNS instructions?