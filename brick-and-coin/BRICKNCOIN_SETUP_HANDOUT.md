# Handout for Claude: Brick & Coin and putting it live at brickncoin.com

You're picking up a project mid-way. This file has everything you need: what the game is, where it lives, what's been decided, and step-by-step instructions to set up **brickncoin.com on Cloudflare** using the owner's computer (their browser, through Claude in Chrome or computer use). Read section 0 before doing anything.

---

## 0. Rules (read first)

- **Who you're helping:** the owner of this project; they make the calls. Keep messages short and batch browser actions, because they're cost-conscious.
- **Logins:** the owner logs in to GitHub, Cloudflare and their domain registrar themselves, in their own browser. Never ask them to paste a password, token or code into chat.
- **Ask first, every time,** before you:
  - buy anything (a domain) or enter payment details;
  - change nameservers at a domain registrar (if the domain already runs email or another site, this can break it);
  - merge anything into the `main` branch on GitHub;
  - delete any DNS record, Worker, repository or file;
  - change any Olympus Hunt setting other than its build watch paths (step 2).
- **Never touch:**
  - Olympus Hunt's database (D1 `olympus-hunt`);
  - its `wrangler.jsonc` and `src/index.js` at the repo root, and its Durable Objects (`Room`, `Lobby`);
  - the `doctrinalcompass` repository.
- **If something fails**, stop and report exactly what the page says. Don't improvise around errors.
- **When done**, close the tabs you opened and report in a few lines: what's live, the links, anything left for the owner.

---

## 1. The project in one minute

**Brick & Coin** is a pixel-art business tycoon in the browser, made by Inspirapixel (the owner's studio, which also makes Olympus Hunt). Current version: **v0.05**.
- **The game:** you run a company in the town of Millbrook. Build producers (wood, wheat, ore), turn goods into better goods (planks, bread, steel, up to Grand Pianos, Gift Hampers and Motor Cars), and trade on a market. Invest in stocks, PixCoin (a crypto) and real estate, and climb a leaderboard. The town has four areas that open with net worth: Main Street, Market Row ($10k), Industrial Park ($100k) and Gold Hill ($1M).
- **One file:** the whole game is a single web page (`index.html`, about 237 KB). Pixel art and music are made in code, and saves live in the player's browser.
- **Shared world (since v0.05):** stock prices, PixCoin, home prices, rival tycoons, news headlines, booms, slumps and price swings are **the same for every player at the same moment**, with no server. Every copy of the game computes the world from the same clock and the same seed. The clock comes from the `date` header of the page itself, a free request.
- **No server needed yet:** brickncoin.com is a plain static site, which costs nothing on Cloudflare's free plan.

---

## 2. Where everything is

**GitHub repository `ctkey0604-crypto/olympus-hunt`** (public). It holds two games:

| Path | What |
|---|---|
| `public/`, `src/index.js`, `wrangler.jsonc`, `game-src/` (repo root) | **Olympus Hunt**, live at https://olympushunt.com. Its Cloudflare Worker is named `olympus-hunt`; it uses Durable Objects and a D1 database. Cloudflare Workers Builds redeploys it on every commit to `main`. **Don't change these.** |
| `brick-and-coin/` | **Brick & Coin**: everything for it, self-contained. |
| `brick-and-coin/public/` | What brickncoin.com serves:<br>• `index.html` (the game)<br>• `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (icons)<br>• `og.png` (link preview)<br>• `manifest.webmanifest`, `_headers` (caching rules), `robots.txt` |
| `brick-and-coin/wrangler.jsonc` | Cloudflare settings: Worker name **`brickncoin`**, static files from `./public`, no server code. |
| `brick-and-coin/src/`, `build.py`, `test/`, `tools/` | Game source, build script, automated tests, image tool. |
| `brick-and-coin/BRICK_AND_COIN_HANDOFF.md` | The full developer guide (architecture, balance, save rules, recipes, version history). Read it before changing the game itself. |

**The work is on branch `ccr-e1298249-8tqrck`, not yet on `main`.** Every change on that branch is inside `brick-and-coin/`. Nothing of Olympus Hunt's changed.

---

## 3. The job: put Brick & Coin live at brickncoin.com

The plan: a **second Cloudflare Worker** called `brickncoin`, built from the same GitHub repository but only from the `brick-and-coin/` folder, with the custom domain brickncoin.com. Olympus Hunt stays exactly as it is.

### Step 1: Check the domain
1. Open https://dash.cloudflare.com (the owner logs in) and look at the account's list of domains for **brickncoin.com**.
   - **Listed and "Active":** go to step 2.
   - **Listed but "Pending":** the nameservers at the registrar aren't switched yet. See part 3 below.
   - **Not listed:** ask the owner whether they own brickncoin.com, and where they bought it.
2. **If they don't own it:** ask before buying. Cloudflare sells domains at cost (*Domain Registration → Register Domains*; check the price shown, about $10 a year for a .com). If the owner says yes, they enter payment details themselves.
3. **If they own it elsewhere:** in Cloudflare, *Add a domain* → `brickncoin.com` → **Free** plan. Cloudflare then shows **two nameservers**.
   - **Ask the owner first:** is anything already using the domain (email, another site)? Cloudflare usually copies existing DNS records, but check the list it shows before continuing.
   - Then change the nameservers at the registrar to Cloudflare's two (the owner logs in there).
   - Activation takes minutes to a few hours. You can carry on with steps 2–5 meanwhile; step 6 needs it active.

### Step 2: Keep Brick & Coin commits from redeploying Olympus Hunt
1. In Cloudflare, go to *Workers & Pages →* **olympus-hunt** *→ Settings → Build → Build watch paths*.
2. Add an **exclude** path: `brick-and-coin/*`. Leave the include as it is (`*`) and save.
   - This is the only Olympus Hunt setting you change. It just stops Brick & Coin commits from rebuilding Olympus Hunt.
   - If you can't find this setting, skip it and tell the owner: an extra Olympus Hunt rebuild is harmless, since its files don't change.

### Step 3: Put the work on `main` (ask the owner first)
1. On GitHub, open https://github.com/ctkey0604-crypto/olympus-hunt and create a pull request: *Pull requests → New pull request →* base **`main`**, compare **`ccr-e1298249-8tqrck`** → *Create pull request*.
2. Check *Files changed*: **every file must be inside `brick-and-coin/`**. If anything outside it appears, stop and report.
3. Ask the owner to OK the merge, then *Merge pull request → Confirm*.

**Option B, if the owner would rather not merge yet:** skip this step. In step 4, set the production branch to `ccr-e1298249-8tqrck` instead of `main`, and switch it to `main` later.

### Step 4: Create the `brickncoin` Worker from the repository
1. In Cloudflare: *Workers & Pages → Create → Import a repository*. If asked, let Cloudflare's GitHub app see `ctkey0604-crypto/olympus-hunt`; the owner may need to approve that on GitHub.
2. Choose `olympus-hunt`, then fill in:
   - **Project / Worker name: `brickncoin`**. This must match exactly (it's the `name` in `brick-and-coin/wrangler.jsonc`), or the build fails.
   - **Production branch:** `main` (or the branch from Option B).
   - **Advanced settings → Path (root directory): `brick-and-coin`**.
   - **Build command:** leave **empty** (the page is already built and committed).
   - **Deploy command:** `npx wrangler deploy` (the default).
3. Create and deploy, then wait for the build to finish (a minute or two).
4. Open the Worker's `….workers.dev` address. You should see the **Brick & Coin** title screen with **"v0.05 · test version"** under the title.

### Step 5: Build watch paths for `brickncoin`
Go to `brickncoin` *→ Settings → Build → Build watch paths →* **include** `brick-and-coin/*` and save. Now only Brick & Coin changes redeploy it.

### Step 6: Attach brickncoin.com (needs the domain "Active")
1. Go to `brickncoin` *→ Settings → Domains & Routes → Add → Custom domain →* `brickncoin.com` *→ Add*.
2. Repeat for `www.brickncoin.com`.
3. **If Cloudflare says a DNS record already exists** for `brickncoin.com` or `www`: open the domain's **DNS** page and show the owner the conflicting record (A, AAAA or CNAME on `@` or `www`).
   - Delete it **only with their OK**. MX and TXT records (email) can stay.
4. The secure certificate can take a few minutes to issue.

### Step 7: Check it
1. **https://brickncoin.com** shows the title screen, v0.05. Start a company (any name), build on a lot, and see money come in.
2. **https://www.brickncoin.com** works too.
3. **https://brickncoin.com/og.png** shows the title-screen picture. Pasting brickncoin.com into a chat should show that preview (it may take a while to appear on some apps).
4. **Optional:** in the browser's developer tools (Network tab), the page response has `cache-control: no-cache` and a `date` header.
5. **https://olympushunt.com** still works exactly as before.

### Step 8: Report back
Tell the owner in a few lines:
- what's live, with the links;
- that Olympus Hunt is untouched;
- anything left to do (for example, waiting on nameservers).

Close the tabs you opened.

### Troubleshooting

| What you see | What it means / what to do |
|---|---|
| Build fails: name doesn't match | The Worker isn't named exactly `brickncoin`. Rename it, or recreate it with that name. |
| Build fails: no Wrangler config / can't find `public` | The root directory isn't `brick-and-coin`. Fix it under Settings → Build. |
| The workers.dev page shows Olympus Hunt | The root directory is empty (it built the repo root). Set it to `brick-and-coin` and redeploy. |
| Custom domain: "zone not found" / can't pick the domain | The domain isn't Active in this Cloudflare account yet (step 1). |
| Custom domain: "record already exists" | See step 6: show the owner the conflicting DNS record before deleting it. |
| Site loads, but the market looks different on two devices | One device has an old cached page. Reload both: the world only matches on the same version. |
| Anything about Olympus Hunt breaking | Stop immediately and tell the owner. Don't try to fix Olympus Hunt's settings. |

---

## 4. Cloudflare costs (free plan)

- **brickncoin.com right now:** a static site. Static files are **free and unlimited**, and visits use **none** of the free plan's daily requests. The game's clock check is a request for its own page, also static, also free.
- **The free plan's limits** (per account, shared with Olympus Hunt; they reset at midnight UTC):
  - 100,000 Worker requests a day;
  - Durable Objects: 100,000 requests and 13,000 GB-s a day;
  - D1 database: 5 million rows read and 100,000 written a day.
- **Going over** isn't billed on the free plan; requests just fail until the reset.
- **Later, for multiplayer:** the planned design batches each player's server calls to about one every 30 seconds. That fits several hundred hours of play a day across all players. If it grows past that, the $5/month Workers Paid plan raises the limits enormously.

---

## 5. How the game works (only needed if you change it)

The full guide is `brick-and-coin/BRICK_AND_COIN_HANDOFF.md`. The essentials:

**Making a change:**
1. Edit `brick-and-coin/src/`.
2. `python3 brick-and-coin/build.py` writes `public/index.html`.
3. `node brick-and-coin/test/playtest.js` runs an automated playtest in a headless browser (about 30 s, needs Playwright).
4. If you changed the market, also run `node brick-and-coin/test/market_check.js`.
5. Commit `src/` and `public/` together.

**Source files:** `10_data.js` (all numbers), `20_art.js` (pixel art), `30_sim.js` (the company), `35_world.js` (the shared world), `40_audio.js` (music), `50_ui.js` (menus), `60_tutorial.js`, `90_main.js` (loop and input).

**Saves:** players' saves are in their browser under a fixed key. **Never change `SAVE_KEY`.** Old saves must keep loading: `adopt()` in `30_sim.js` upgrades them, and the tests load real v0.03 and v0.04 saves.

**Balance rules already in place:**
- Time away pays a quarter speed for up to 2 hours, whether the game is closed or left open untouched for 10 minutes, measured on the server's clock and at plain prices.
- The stock market wanders around fair values, so simply holding pays only a few percent a day.
- News shocks fade slowly, so quick flips don't beat the fees.

---

## 6. Decisions made, what's next, open questions

**Decided by the owner:**
- Level 4 is called Gold Hill.
- Players can **sell their entire company**, to other players or back to the game.
- When going public (IPO), players can sell **at most 49%**.
- Multiplayer accounts use **the same login as Olympus Hunt**.
- Everything shared (stock market, news, price drops) must be **the same for everyone, in real time**.
- Stay on Cloudflare's **free plan**, alongside Olympus Hunt.
- Pay attention to balance, especially that time away from the game isn't a way to get rich.

**Roadmap:**
1. v0.04 Gold Hill, done.
2. v0.05 shared world, balance and site package, done.
3. **v0.06 online:**
   - log in with the Olympus Hunt account and save companies on the server;
   - everyone's selling moves goods prices for everyone;
   - a players-only leaderboard;
   - the server hands out each day's world seed (right now someone reading the public code could work out future prices).
   - This needs new server code next to Olympus Hunt's, so get the owner's explicit OK before editing `src/index.js` or `wrangler.jsonc`.
4. **v0.07:**
   - IPO shares bought by other players;
   - selling whole companies.
5. Then an order book and delivery contracts between players.

**Open questions for the owner:**
- Keep Brick & Coin inside the `olympus-hunt` repository, or move it to its own repository (they'd create an empty one named `brickncoin` on GitHub)? Either works. If it moves, the root directory in step 4 becomes `/`.
- Merge to `main` now, or deploy from the branch first (step 3, option B)?
