# PrimeCoat Interiors website (Cloudflare Pages)

A fast static website with a built-in **admin page** where you post new work (photos and videos) yourself. No coding needed after setup.

```
public/      the website (home page, Our work page, admin page, styles, images)
functions/   the small server code that powers the admin login and the gallery
```

## One-time setup (about 20 minutes)

### 1. Put the files on GitHub
1. Open your GitHub repository. Delete the old `index.html` and `images` folder from the earlier version.
2. Click **Add file > Upload files** and drag in the **`public`** folder, the **`functions`** folder and this `README.md`. Commit.

### 2. Create the Cloudflare Pages site
1. Go to https://dash.cloudflare.com > **Workers & Pages** > **Create** > **Pages** > **Connect to Git** and choose your repository.
2. Settings: Framework preset **None**. Build command: **leave empty**. Build output directory: **`public`**.
3. Click **Save and Deploy**. Your site is now live at `https://YOURNAME.pages.dev`. (The gallery shows sample projects until you post your own. Admin does not work yet. Continue below.)

### 3. Create storage for your posts and photos (free)
1. **Workers & Pages > KV > Create a namespace**. Name it `primecoat`.
2. Open your Pages project > **Settings > Bindings > Add > KV namespace**.
   Variable name: **`KV`** (exactly, capital letters). Namespace: `primecoat`. Save.

### 4. Set your admin password
Pages project > **Settings > Variables and Secrets > Add** (for Production), type **Secret**:

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | A long password you will remember (14+ characters). This is your admin login |
| `SESSION_SECRET` | Any long random text (40+ characters). You never type this again |

### 5. Redeploy once
Pages project > **Deployments** > the latest deployment > **Retry deployment**. (Bindings and secrets only apply to new deployments.)

### 6. Try it
Open `https://YOURNAME.pages.dev/admin/`, log in with your password and post your first project.

## Posting new work
1. Go to `/admin/` on your website (bookmark it on your phone).
2. Enter a title, choose a category, add photos (and short videos), tap **Publish to website**.
3. It appears on the home page and the Our work page within about a minute, newest first. Visitors can filter by category.

* Photos are shrunk automatically on your phone before upload.
* Videos can be up to **25 MB**. For longer videos, upload to YouTube (Unlisted is fine) and paste the link in the YouTube box.
* To fix a title or delete a post, use **Edit** or **Delete** in "Your posts".
* Change gallery categories in `functions/_lib.js` (the `CATEGORIES` list), then commit to GitHub.

## Facebook and Instagram
Edit `public/assets/config.js`:
* Instagram is already set to `@primecoatinteriors2026`.
* **Facebook:** open your Facebook page, tap the three dots (...) > **Copy link**, and paste it as the `facebook:` value. Until you do, the Facebook button opens a Facebook search for "PrimeCoat Interiors".

## Your own domain (optional)
Pages project > **Custom domains > Set up a domain**. Use that address on WhatsApp Business and your Google Business Profile.

## Security
* The admin login uses your secret password. After 5 wrong attempts from one device/IP, login is blocked for 15 minutes, and each wrong try is slowed down.
* A successful login lasts 12 hours (secure, HttpOnly, same-site cookie). Admin actions also require a request header that other websites cannot send.
* Uploaded files are checked by their real content (JPEG, MP4 or WebM only).
* The site sends strict browser security headers (Content-Security-Policy and more).
* Recommended: in Cloudflare, add a **rate limiting rule** for the path `/api/login` (Security > WAF > Rate limiting rules). The free plan includes a small number of rules.
* Use a password you use nowhere else. Log out on shared phones.

## Limits of the free setup
* Cloudflare's free plan allows about 100,000 function requests a day and 100,000 KV reads a day. Static pages and files are not counted. One gallery page view uses roughly 15 requests, so this comfortably covers a small business site.
* Photos and videos are stored in Cloudflare KV (about 1 GB free; check your dashboard). If you ever run out, ask me to switch storage to Cloudflare R2. R2 needs a card on file.
* Keep the original photos on your phone or Instagram. This is not a backup system.
* Billing and quotations are **not** part of this website. They stay in your separate billing app.
