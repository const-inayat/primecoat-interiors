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
* Recommended: in Cloudflare add a **rate limiting rule** for `/api/login` (Security > WAF > Rate limiting rules).
* Use a password you use nowhere else.

## Limits of the free setup
* Free plan: about 100,000 Worker requests a day and 100,000 KV reads a day. Static pages and files are not counted. One gallery page view uses roughly 15 requests.
* Photos and videos are stored in KV (about 1 GB free; check your dashboard). If you outgrow it, ask me to switch to R2, which needs a card on file.
* Keep your original photos on your phone or Instagram. This is not a backup system.
* Billing and quotations are **not** part of this website.
