# PrimeCoat Interiors website (Cloudflare Worker + static files)

A fast website with a built-in **admin page** where you post new work (photos and videos) yourself.

```
public/         the website (home page, Our work page, admin page, styles, images)
functions/      the code behind admin login and the gallery
src/worker.js   connects the website to that code (needed for Cloudflare Workers)
wrangler.jsonc  Cloudflare settings (storage connection lives here)
```

## One-time setup

### 1. Put the files on GitHub
In your repository, delete the old files, then **Add file > Upload files** and drag in `public`, `functions`, `src`, `wrangler.jsonc` and this README. Commit.

### 2. Connect your storage (KV)
1. Cloudflare dashboard > **Workers & Pages > KV**. Open the namespace **primecoat** and **copy its ID**.
2. On GitHub, open `wrangler.jsonc`, click the pencil (edit) icon and replace `PASTE_YOUR_KV_NAMESPACE_ID_HERE` with that ID. Commit.

You do **not** add the binding in the dashboard. A Worker that has only static files cannot take bindings there, and this project fixes that by declaring them in `wrangler.jsonc`.

### 3. Check your Worker settings
Worker `primecoat-interiors` > **Settings > Build**: build command empty, deploy command `npx wrangler deploy`, root directory `/`. The Worker name must match the `name` in `wrangler.jsonc`.

### 4. Add your admin password (runtime secrets)
Worker > **Settings > Variables and Secrets > Add**, type **Secret**:

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | A long password you will remember (14+ characters). This is your admin login |
| `SESSION_SECRET` | Any long random text (40+ characters). You never type it again |

**Important:** "Build variables" (in the Build section) are only visible while building. The website cannot read them. The two values must be added here under **Variables and Secrets**. You can delete the build variables.

### 5. Deploy
Committing to GitHub starts a build. Or open **Deployments** and retry the latest one. The build log should mention bindings `KV` and `ASSETS`.

### 6. Try it
Open `https://primecoat-interiors.YOURSUBDOMAIN.workers.dev/admin/`, log in and post your first project.

## Troubleshooting

| What you see | Cause and fix |
|---|---|
| Login says 404 | The old static-only version is still deployed. Check that `src/worker.js` and `wrangler.jsonc` are in the repo root and redeploy |
| Build fails mentioning KV or an id | Step 2: the namespace ID is missing or wrong |
| "Storage is not connected" | Same as above: check the KV id in `wrangler.jsonc` |
| "Admin is not set up yet" | Step 4: add both secrets under Variables and Secrets, then redeploy |
| "Wrong password" with the right password | Re-enter the `ADMIN_PASSWORD` secret and redeploy |
| "Too many wrong attempts" | Wait 15 minutes |

## Online signing for your billing app (quotations and invoices)

Your billing app (on your computer) can send a quotation or invoice here and get back a private link. The client opens it on their phone, reads the document and signs. Later the billing app collects the signature.

1. In your Worker go to **Settings > Variables and Secrets** and add a **Secret** named `ESIGN_API_KEY`. Use a long password you make up (30+ characters).
2. Redeploy (commit to GitHub or retry the latest deployment).
3. In the billing app open **Business details > Online e-sign**. Enter your website address (like `https://primecoat-interiors.yourname.workers.dev`) and the same password. Press **Test the connection**.

Notes:
* Signing links work for 45 days. Signed records are kept for 60 days so the billing app can collect them. Collect signatures within that time.
* The document copy contains the items, totals, terms and your business details. It never contains your costs, profit or bank details.
* Pages used: `/s/<private link>` (client signing page) and `/api/esign/*`. These are in `wrangler.jsonc` under `run_worker_first`. Keep your own KV id in that file when you replace it.

## Backing up your website data (posts, photos, videos)

Everything you post is stored in Cloudflare KV. Cloudflare keeps it safe, but a deleted post or a mistake cannot be undone, so keep your own copy.

1. Open `/admin/` on your website and log in.
2. Scroll to **Backup and restore** and press **Download backup**.
3. A zip file downloads (`primecoat-website-backup-DATE.zip`). It contains `posts.json` and all your photos, thumbnails and uploaded videos. Keep it in Google Drive or on your computer.

To restore, press **Restore from a backup file** on the same page and choose the zip. It only adds what is missing and never deletes anything, so running it twice is safe. A restore uses your free upload allowance (roughly 1,000 files a day on the free plan), so a very large restore may need to be done over two days.

How often: after a batch of new posts, and at least once a month. Also keep the original photos on your phone.

Videos you added as YouTube links stay on YouTube. The backup keeps the link, not the video itself.

Advanced (optional): developers can also list or export KV with Cloudflare's command line tool (`npx wrangler kv key list --namespace-id=YOUR_ID`).

## Posting new work
1. Go to `/admin/` on your website (bookmark it on your phone).
2. Enter a title, choose a category, add photos and short videos, tap **Publish to website**.
3. It appears on the home page and the Our work page within about a minute, newest first. Visitors can filter by category.

* Photos are shrunk automatically on your phone before upload.
* Videos can be up to **25 MB**. For longer videos, upload to YouTube (Unlisted is fine) and paste the link in the YouTube box.
* Use **Edit** or **Delete** under "Your posts" to fix or remove a post.
* To change the categories, edit the `CATEGORIES` list in `functions/_lib.js` on GitHub.

## Facebook and Instagram
Edit `public/assets/config.js`:
* Instagram is already set to `@primecoatinteriors2026`.
* **Facebook:** open your page, tap the three dots (...) > **Copy link**, and paste it as the `facebook:` value. Until then the button opens a Facebook search for "PrimeCoat Interiors".

## Your own domain (optional)
Worker > **Settings > Domains & Routes > Add > Custom domain**. Use that address on WhatsApp Business and your Google Business Profile.

## Security
* Login uses your secret password. After 5 wrong attempts from one device/IP, login is blocked for 15 minutes, and each wrong try is slowed down.
* A login lasts 12 hours (secure, HttpOnly, same-site cookie). Admin actions also need a request header that other websites cannot send.
* Uploaded files are checked by their real content (JPEG, MP4 or WebM only).
* Strict browser security headers are sent (Content-Security-Policy and more).
* Login is also limited by Cloudflare's built-in Workers rate limiter (5 attempts a minute) and a quick in-memory limiter.
* Only `/api/*` and `/media/*` run Worker code. Random addresses that bots probe (like `/wp-login.php`) are answered by the static files alone and do not use your free Worker requests.
* There is no public form that stores anything. The quote form opens WhatsApp, so nobody can fill your site or database with spam.
* **Note:** Cloudflare's firewall (WAF) and rate-limiting *rules* only work on your own domain, not on the free `workers.dev` address. For the strongest protection, add a custom domain (see below).

## Stronger protection with your own domain (recommended)
A domain such as primecoatinteriors.in costs roughly ₹600 to ₹800 a year. With it on Cloudflare you can switch on, for free:
1. **Security > Bots > Bot Fight Mode** (challenges known bots).
2. **Security > WAF > Rate limiting rules**: a rule for the path `/api/login` and another for `/api/*`.
3. Then, so nobody can bypass these rules through the old address, set `"workers_dev": false,` in `wrangler.jsonc` (only after the custom domain works).

## After every deploy: quick check
* `/api/status` shows JSON (not a web page).
* `/work.html` and `/admin/` open.
* `/some-wrong-address` shows the "Page not found" page.
* Use a password you use nowhere else.

## Limits of the free setup
* Free plan: about 100,000 Worker requests a day and 100,000 KV reads a day. Static pages and files are not counted. One gallery page view uses roughly 15 requests.
* Photos and videos are stored in KV (about 1 GB free; check your dashboard). If you outgrow it, ask me to switch to R2, which needs a card on file.
* Keep your original photos on your phone or Instagram. This is not a backup system.
* Billing and quotations are **not** part of this website.
