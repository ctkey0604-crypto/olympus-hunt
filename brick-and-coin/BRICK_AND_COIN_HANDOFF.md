# Brick & Coin: how to keep building it

An Inspirapixel business tycoon, currently **v0.08 (test version)**, made for **brickncoin.com**. You run a company in the pixel town of Millbrook: build producers on lots, turn raw goods into better goods, trade on a live market, invest in stocks, PixCoin and real estate, and climb a leaderboard of tycoons. The whole game is one self-contained web page. Art is drawn in code, music and sound are synthesized in code, and saves live in the browser, and on the server for players who log in (v0.07).

Since v0.05 the **market is one shared world**:
- Stock prices, PixCoin, the index fund, home prices, rival fortunes, every news headline, booms, slumps and weather are the same for every player at the same moment, live.
- It works with no server: every copy of the game computes the world from the same clock and seed (see `src/35_world.js`).

**Roadmap:**
1. v0.04 Gold Hill (done).
2. v0.05 shared world, balance, site package (done).
3. v0.06 the Inspirapixel splash, a proper starting menu and in-game menu (done).
4. v0.07 online (done): log into an Inspirapixel account (the same accounts as Olympus Hunt), companies saved on the
   server, everyone's selling moves goods prices for everyone, a players-only leaderboard, and realistic simulated
   companies in the news. Still to do from the original v0.07 list: the server handing out the world seed bit by bit
   (see "Known loose ends").
5. v0.08 going public (done): sell up to 49% in an IPO, other players buy and sell the shares, dividends, buybacks.
   Still to do: selling your **whole company**, to another player or back to the game to start fresh.
5b. Next for accounts (needs Olympus Hunt's server, where accounts live): an optional, encouraged email for password
   recovery (verified by a link; "forgot password" sends a one-time reset link), and an opt-in mailing list.
6. Then the order book and delivery contracts between players.

## Where things live

| File | What's in it |
|---|---|
| `src/00_style.html` | Fonts and all CSS, including the phone layouts (upright = rotate screen, sideways = compact). |
| `src/01_body.html` | The page markup: top bar, town map, side panel, menus, start screen. |
| `src/10_data.js` | **Every number and list**: `VERSION`, `SAVE_KEY`, the icons, products and recipes, costs, levels, HQ and warehouse, offline and idle rules, town layout, properties, stocks, rivals, goals, news headlines. Most balancing happens here. |
| `src/20_art.js` | Pixel art in code: buildings and how they grow with level (`ANCHOR`), houses, the town background and Gold Hill (`drawHill`), walkers and smoke. |
| `src/30_sim.js` | The company: production, upkeep, goods prices (the world's swings plus your own selling pressure), real estate, net worth, levels, goals, offline earnings, save and load (`adopt()` brings old saves up to date). |
| `src/35_world.js` | **The shared world**: the market, PixCoin, homes, rivals, news and goods price swings as a pure function of world time; the world clock and its sync. Market balance lives at the top (`TAU`, `JUMP`, volatilities). v0.07: the simulated companies (`simOf`, `simNw`, `simBoard`) and their news. |
| `src/37_net.js` | **Online (v0.07)**: the account, talking to the server (sync every minute, save every 3 minutes and on leaving), and the crowd's effect on goods prices (`crowdMult`). |
| `src/55_pub.js` | **Public companies (v0.08)**: share prices (`pubPrice`), going public, selling more and buying back, trading players' shares, dividends (`pubPayDividends`, `pubTake`), and Invest → Players / Your company. |
| `src/40_audio.js` | Sound effects (`SFX`) and the four chiptunes (`SONGS`), one per area of town. |
| `src/50_ui.js` | Top bar, side panel, the game's windows (Production web, Market, Invest, Leaderboard, Menu), profit estimates, stock chart, news ticker. The starting menu (`renderTitle`, `TPAGES`, the town backdrop `townPostcard`, the live market strip, What's New) and what both menus share: How to Play (`HELP`) and settings. |
| `src/60_tutorial.js` | The five guided steps for a new company (`TUT`). |
| `src/85_splash.js` | The Inspirapixel logo before the starting menu, ported from Olympus Hunt (`game-src/94_splash.js`); only its sound calls differ. Add `?nosplash` to the address to skip it (tests, screenshots). |
| `src/90_main.js` | Game loop (keeps the world on the world clock), the idle rule, camera, drawing the town, input, button actions (`act()`), the starting menu's flow (`showTitle`, `startNew`), start and boot. |
| `build.py` | Joins `src/` into `public/index.html` (the website, also playable as a single file) and `dist/artifact.html` (for a Claude artifact). |
| `public/` | Everything brickncoin.com serves: the game, `favicon.svg`, app icons, `og.png` (link preview), `manifest.webmanifest`, `_headers` (caching), `robots.txt`. |
| `tools/site_images.js` | Remakes the favicon, app icons and link preview from the game's art. |
| `server/index.js` | **The server (v0.07)** for `/api/*`: logins through Olympus Hunt's Worker (service binding `OH`), sessions, saves, the crowd totals and the players' leaderboard, in the D1 database `brickncoin`. Everything else on the site is static and runs no code. |
| `wrangler.jsonc` | Cloudflare settings: the static site (free, unlimited visits), the server for `/api/*`, the `OH` binding and the D1 database. |
| `test/playtest.js` | The automated playtest (below). |
| `test/market_check.js` | Is the market lively but not a money machine? (below) |
| `test/server_check.js`, `test/online_check.js` | The server's API, and the online game in a browser, against a local server (below). |
| `test/fixtures/` | Real v0.03, v0.04 and v0.06 companies, for checking that old saves still load. |

JS parts are joined in name order, so a new part like `37_ipo.js` slots in after the world.

## Making a change

```bash
# 1. edit files in brick-and-coin/src/
python3 brick-and-coin/build.py                 # 2. build public/index.html
node brick-and-coin/test/playtest.js            # 3. playtest (about 30 seconds), exits 1 on any failure
node brick-and-coin/test/market_check.js        # 4. only if the market or news changed
# 5. look at the screenshots in brick-and-coin/test/out/ for anything visual
# 6. for a release: bump VERSION in src/10_data.js, add its notes at the top of WHATS_NEW (same file),
#    and run tools/site_images.js (the link preview shows the version)
# 7. commit src/ and public/ together
```

**Testing the online part (v0.07)** needs a local server with a test login (any name, password `secret1`) instead of
Olympus Hunt's. Make a config next to (not in) the repo with absolute paths, no `services`, and `"vars": { "DEV_LOGIN": "1" }`:

```jsonc
{ "name": "brickncoin-dev", "main": "<repo>/brick-and-coin/server/index.js", "compatibility_date": "2025-10-01",
  "assets": { "directory": "<repo>/brick-and-coin/public", "binding": "ASSETS" },
  "d1_databases": [ { "binding": "DB", "database_name": "brickncoin", "database_id": "local-dev" } ],
  "vars": { "DEV_LOGIN": "1" } }
```

```bash
npx wrangler dev -c <that config> --port 8787        # leave it running
node brick-and-coin/test/server_check.js              # the API: accounts, saves, the crowd totals, caps, the leaderboard
node brick-and-coin/test/online_check.js              # the game in a browser: Play Online, another player dumping Wood, both tabs, a second device
```

The test login only works with no `OH` binding and `DEV_LOGIN` set, so it can't exist on brickncoin.com.

The playtest drives the real page in a headless browser:
- **Splash and starting menu:**
  - the Inspirapixel logo, then "Click anywhere to start", and the click switches sound on;
  - the live market strip shows the shared prices;
  - How to Play turns its pages, and Esc goes back;
  - a sound setting is remembered on the device;
  - What's New shows a NEW badge until read;
  - the game's Menu opens on Esc, Main Menu → Continue picks the company up, and starting a new company over a saved one asks first.
- **Tutorial and menus:** the whole tutorial by clicking, then every menu: market buy and sell, Keep/Sell/Auto, stocks, PixCoin, a home, and save codes (export, import, survives a redraw).
- **Art:** every building at every level, every house, icon and town background.
- **Bot:** plays 60 game minutes (`--minutes N`, `--verbose`), checking every game minute that cash, stock, prices and net worth stay sane.
- **Offline:** closes the game for an hour and reopens it (Continue, offline earnings).
- **Gold Hill:** reaches Level 4, unlocks and builds a Grand Piano, buys a villa, and checks the tune.
- **Old saves:** loads the v0.03 and v0.04 fixtures through Continue.
- **One shared world:**
  - two separate browsers agree on every price, home price, rival and headline, now and a year out, and a live game agrees with a fresh page to the cent;
  - a player's own trading leaves the world untouched;
  - a device whose clock is 2 hours fast still lands on world time and gets no free offline pay;
  - a boom doesn't inflate time away;
  - the idle rule works.
- **Screens:** phone held sideways (including Gold Hill), phone upright, short laptop window.

**Comparing balance between versions:** `--bot-only` runs just the bot on a fresh company at a random moment of the world's first month (games started at the same moment play out the same, since the world is shared). `--page FILE` points it at another build. Run each several times:

```bash
git show <old-commit>:brick-and-coin/public/index.html > /tmp/old.html
node brick-and-coin/test/playtest.js --bot-only --minutes 600 --page /tmp/old.html
node brick-and-coin/test/playtest.js --bot-only --minutes 600
```

The bot is a rough player, so use its numbers to compare versions, not as real play time. It:
- follows the goals and builds what pays best per dollar;
- swaps weak buildings for better ones it can supply itself once the HQ is full;
- keeps a little cash back, and stops buying materials when that loses money.

`window.__game` at the end of `90_main.js` is a test hook. Keep it.

## The shared world (how `35_world.js` works)

- **World time** is seconds since `WORLD.epoch` (1 Nov 2026 UTC) on the server's clock. At start the game reads the `date` header of its own page (a free static request), and uses it if the device is more than 2 s out.
- **All chance is hashing** of (seed, stream, slot), using only integer maths and + − × ÷, so every browser gets the same numbers. There's no `Math.random` and nothing about the player.
- **Prices wander as "value noise"** at time scales from 15 s to 3 days, plus news shocks that fade over half a day. They swing like a market but stay around fair values (plus 0.2% a day of growth), so the world can run for months.
- **News comes in 30-second slots.** Each slot's hash decides whether there's an event, what it is, its headline, how long it lasts, and what it moves. There's also a 16-minute "nervous market" spell now and then.
- **Charts** (1 hour, 4 hours) are recomputed from the world when the game starts. Nothing about the world is saved, which shrank save codes from about 88k to 20k characters.
- **Changing it:** changing `WORLD.seed`, the epoch or the models gives everyone a new world as soon as they load the new version. A player on an old cached page would see the old world until they reload.
- **Per player:** your own selling and buying pressure on goods prices (it fades with a 2-minute half-life) hits your own price hardest.
- **The crowd (v0.07):** on top of that, everyone's selling and buying adds up on the server (see "Online" below).
- **Simulated companies (v0.07):** one opens about every 6 hours (`SIM_EVERY`); each has its own pace (hours played per hour, mostly low), its own ceiling ($20k to $5M, mostly low) and its own end (sells up after 3–14 days, or three in ten go bust). Their net worth follows a curve fitted to the bot's pace (about $10k after 30 minutes played, $100k after 3 hours, $1M after a long day). About 25–30 are around at once, median about $100k, a handful over $1M. Their openings, moves to new areas and endings are news. The leaderboard marks them SIM.

## Online (v0.07: `server/index.js` and `src/37_net.js`)

- **Accounts** are Olympus Hunt accounts (a name and a password, no email). The server checks them by calling Olympus Hunt's own `/api/login` and `/api/register` through the service binding `OH`, so Olympus Hunt's code and database are never touched; then it makes its own 60-day session. Playing without an account still works (saved in the browser, and the game just listens to the market every 2 minutes).
- **Saves:** one company per account, the same text as a save code. Sent with the sync every 3 minutes, and on leaving (`keepalive`), on Main Menu and on a new company. On Continue the server's copy wins unless this browser has a newer copy of the same company; two different companies → the player chooses. Start over clears it on the server too.
- **The crowd:** every minute a logged-in game reports what it sold and bought, in building-level minutes (units ÷ what one building level makes a minute). The server keeps each player's flow fading with a 5-minute half-life (`CROWD_HALF`), adds everyone's up at most every 20 s (one database row holds the totals and the leaderboard), and sends each player the total without their own part. The game moves a price by `sqrt((1 + bought/D) / (1 + sold/D))`, the square-root law real markets follow, with D = 300 building levels selling non-stop (`CROWD_R0`), kept within −30% / +35% (`CROWD_MIN`, `CROWD_MAX`). One player selling 10 levels' worth: about −1.6%; a big one with 50: about −7%; a crowd with 300: about −29%. It recovers over 15–20 minutes. Reports are capped (400 building-level minutes a minute) and ignored if they come within 15 s of the last, so a doctored game can't crash a price alone. Big crowd moves (8%+) make the news. Time away runs at plain prices (no crowd).
- **The leaderboard** is real players only: simulated companies and the established tycoons never appear on it, and the "top 5" and "richest" goals count real players only.
- **Costs:** a sync is one Worker request and a few D1 rows (session read, player row read and write, the totals row); the totals are worked out again at most every 20 s. Static files still cost nothing.

## Balance rules (v0.05)

**Time away is worth the same however you're away:**
- **Closed or hidden:** a quarter speed (`OFFLINE_RATE`) for up to 2 hours (`OFFLINE_MAX`).
- **Left open and untouched** for 10 minutes (`IDLE_AFTER`): the same 25%, and after 2 hours more it waits.
- **What you get back:** your next touch shows what you earned while idle.
- **No dividends while away:** neither closed nor idle.
- **Measured on the server's clock**, so moving a device's clock doesn't pay.
- **Plain prices:** booms, slumps and weather don't count while you're away, since public, timed news could otherwise be gamed.

**The market can't be farmed** (checked by `test/market_check.js` over 30 days):

| | v0.05 |
|---|---|
| 1-hour swings | index 4%, shares 5–6%, Nova and PixCoin 10–11% |
| Holding for a day, bought at random (before fees) | index 1.5%, shares 2–3%, Nova and PixCoin 5% |
| Buy right after a crash headline, sell within 3 hours | loses to the fees |
| Flipping homes | loses to the 8% fees |

In v0.04 the market drifted up without limit: the index rose about 50% in 6 hours and some shares quadrupled.

**Pacing** (bot, 5 games of 10 hours at random moments):

| | v0.04 | v0.05 |
|---|---|---|
| Level 2 | 22–40 min | 22–29 min |
| Level 3 | 111–195 min | 99–248 min |
| Level 4 | 322–512 min | 324–574 min |

**Rivals** now rise and fall with their companies' shares around a steady level (before, they grew forever), so "richest" can be won.

## Rules that keep players' saves working

- **Never change `SAVE_KEY`.**
- **New fields in `S`** need a default in `adopt()`. Bump `SAVE_V` (now 3) when the format changes, and tidy older saves in `adopt()`.
- **Lists saved by position:** `GOALS`, `TUT`, `PLOTS` and lots (12 per zone) are saved by position. Add to the end, or move older saves along in `adopt()`.
- **Never rename ids:** product ids and stock tickers stay as they are.
- **The world is never saved.** `serialize()` leaves out `S.assets`, `S.house` and `S.rivals`.
- **Fixtures:** when a release changes the save format, add a fixture made with the *old* build to `test/fixtures/`, plus a playtest section.

## Recipes

**New product.** All in `10_data.js` unless noted:
1. `PRODUCTS` entry, a 16×16 icon in `ICONS`, a line in `BLURB`, and a spot in an `EV_SECTOR` list.
2. A `BUILD` sprite and `ANCHOR` row in `20_art.js`.
3. A `WEBPOS` spot in `50_ui.js` (rings at radius 72, 128, 188, 248 and 305).
4. Check it still earns money when buying every material at the 30% markup.

News picks products from `PROD_PICK` in `35_world.js` (lower rings more often).

**New area of town.** See how Gold Hill did it:
1. `ZONE_LEVEL` and `ZONE_NAME`, `LOTS`, plus cases in `lotXY()`, `zoneBoxes()`, `zoneLabelSpots()` and `zoneCenter()`.
2. A `LEVELS` entry, `MAX_LEVEL`, and the next `MARKET_SIZE`, `BUILD_COST`, `UPKEEP` and `RESEARCH` entries.
3. Ground drawing, plus `keepOut` for trees.
4. A song, and pick it in `render()`.
5. In `adopt()`, pad `S.lots`.

**New stock.** Add it to `ASSETS`, and a rival in `RIVALS`/`RIVAL_CO` if someone owns it. It joins the shared world automatically. Run `market_check.js`.

**New headline or event.** `EV_*` lists in `10_data.js`. The odds, effects and sizes are in `slotEvent()` in `35_world.js`.

**Sound.** `SFX` entries are short functions of time. Songs are text: chords per bar, an 8th-note melody, and 16-step bass, arp and drum patterns.

## Public companies (v0.08: `src/55_pub.js` and the server)

- **Who:** a company at Level 3 (worth $100k), logged in. It sells 10%, 25%, 40% or 49% (`PUB_STEPS`, at most `PUB_MAX`).
- **Valuation:** investors value a company at its whole value plus 15 minutes of its steady profit (`PUB_PREMIUM`, at most 25% more: `PUB_PREM_CAP`; v0.10, it was an hour and up to twice its value; steady profit is `profitSteady()`, a 10-minute average). The IPO issues **new** shares at 10% under that (`IPO_DISCOUNT`), the bank keeps 5% (`IPO_FEE`), and the cash goes into the company. So the owner's part shrinks to match and their net worth dips about 7% at the IPO, in exchange for cash to grow with.
- **Net worth:** `netWorth() = companyValue() × ownFrac()`. Areas of town open with `companyValue()` (the whole company), so going public never costs a level.
- **The share price** (`pubPrice`): (value + 15 minutes of steady profit, at most +25%) ÷ shares, × players' buying and selling (square-root law against 5% of the company's value, fading with a 30-minute half-life, within ×0.6..×1.6), × the market's mood (the Millbrook 10 over 4 hours, ×0.85..×1.18), × the company's own wander (from the shared world, about ±5%). Every player sees the same price.
- **Who holds the shares:** the owner, players, and Millbrook's (simulated) investors, who hold whatever players don't. Players buy from and sell to the investors at today's price (0.5% fee); the server checks the price within a wide band (×0.6..×1.7 of its own idea, which leaves out the mood and wander).
- **Later:** the owner can sell more new shares (up to 49% outside, 5% fee) or buy shares back from the investors (never from players).
- **Dividends:** a public company pays 30% of its profit (`PUB_DIV`) × the outside part, every 10 s, out of its cash. The server adds it to the listing's dividends per share; each holder's next sync collects shares × (dividends per share − what they'd seen). One row per payment, however many holders.
- **Closing:** if the owner starts over, shareholders are bought out at today's price on their next sync.
- **Save format 4:** `S.pub` (the listing: ticker, shares, owner's shares) and `S.pubHold` (shares held in other companies). The server is the truth for both; syncs overwrite them.

## Putting it on brickncoin.com

Live since 21 Nov 2026: the Worker `brickncoin` builds from `main` with root directory `brick-and-coin`, rebuilds only when `brick-and-coin/*` changes, and has the custom domains brickncoin.com and www.brickncoin.com. v0.07 also needs the D1 database `brickncoin` (its id goes in `wrangler.jsonc`); the server makes its own tables. The steps below are how it was first set up.

The page and icons are static files, so visits use none of the free plan's daily requests; only `/api/*` runs code.

1. **Get the domain into Cloudflare:** Cloudflare dashboard → *Add a domain* → brickncoin.com, then follow the instructions to switch the domain's nameservers at the registrar. (Skip if it was bought through Cloudflare.)
2. **Put this work on `main`:** it's on branch `ccr-e1298249-8tqrck`; merge it via a pull request. Olympus Hunt's site doesn't change, since it serves only the repo's top-level `public/`.
3. **Create the Worker:** *Workers & Pages → Create → Import a repository →* `ctkey0604-crypto/olympus-hunt`, with these settings:
   - project name `brickncoin`;
   - **root directory `brick-and-coin`**;
   - no build command;
   - deploy command `npx wrangler deploy`.
4. **Add the domain:** the new Worker → *Settings → Domains & Routes → Add → Custom domain →* `brickncoin.com` (and `www.brickncoin.com`).
5. **Keep the two games from redeploying each other:** under *Settings → Build → Build watch paths*:
   - on `brickncoin`, include `brick-and-coin/*`;
   - on Olympus Hunt's Worker, exclude `brick-and-coin/*`.
6. **Check it:** after that, every commit to `main` that touches `brick-and-coin/` redeploys brickncoin.com in a minute or two. Open https://brickncoin.com, and check the link preview by pasting the link in a chat.

If Brick & Coin moves to its own GitHub repository later, copy the `brick-and-coin/` folder to the new repo's top level, and set the root directory to `/` instead.

## Known loose ends

- **The future can be read from the code.** Because the world is a pure function of time and a seed that's in the page, someone reading the code could work out tomorrow's prices and news. The fix is for the server to hand out seeds bit by bit; but a seed for a whole day still lets a cheater see that day's news, so it needs short blocks (a few minutes, sent with the sync) plus hour keys for the past, which changes every hash in `35_world.js` and the shared-world tests.
- **Net worth on the players' leaderboard comes from the player's own game,** like everything else in a browser game; a doctored game could claim more. The owner could add a way to remove an account from the board.
- **Two devices at once on one account:** the last save wins.
- **A stuck company:** one whose every building needs materials it doesn't make, and has no cash, waits until the player sells something or tears a building down. A hint would help.
- `40_audio.js` mentions a `test/audio_levels.py` loudness check that wasn't part of the v0.03 file.
- `LIVE.goalbar` in `50_ui.js` is an unused stub.
- **Phones held sideways:** the closed side panel sits off-screen to the right, so code can scroll `#app` sideways. Real taps don't. The playtest uses plain click events there for that reason.

## Version history

**v0.10: Fair shares**
- **Share prices line up with the company:** investors pay its value plus 15 minutes of **steady profit** (`profitSteady()`, a 10-minute average), at most +25% (`PUB_PREMIUM`, `PUB_PREM_CAP`, the same on the server). It was an hour of the last minute's profit, up to 3× the value, so market value ran far ahead of the owner's net worth and jumped with every big sale.
- **Your company** shows company value, market value and the gap between them, and explains how the price is worked out.
- **Digits:** every digit in the game comes from "Inspirapixel Digits" (Pixelify Sans digits with a redrawn 5; Pixelify's 5 looks like an S), made by `tools/digits.py`. Olympus Hunt uses the same faces.

**v0.09: Smoother**
- Own selling barely moves a price (`OWN_DEPTH`); the HQ starts with room for 10 building levels; Invest → Portfolio; Sell all spare; the top bar says when factories wait for materials.

**v0.08: Going public**
- **IPO** from Level 3: sell 10–49% of your company in new shares (Invest → Your company); the cash goes into the company.
- **Players' companies** (Invest → Players): buy and sell other players' shares; collect their dividends, even while away.
- **Sell more or buy back** later. **Net worth** is now your part of your company; levels still use the whole company.
- **Leaderboard:** real players only. **Accounts** are called Inspirapixel accounts (the same as Olympus Hunt's).
- **Save format 4**, with a v0.06 fixture and playtest section; server and online tests cover going public.

**v0.07: Online**
- **Accounts:** log in with an Olympus Hunt account (name and password, no email), on the starting menu (Play Online) or Menu → Online. Your company is saved on the server and carries over to any device. Playing without an account still works.
- **A shared market:** everyone's selling and buying of a good moves its price for all players, by the square-root law, capped at −30%/+35%, recovering over 15–20 minutes. The Market shows "players −8%" next to a good the crowd is moving, and big moves make the news.
- **Leaderboard:** real players only (PLAYER, with a green dot when online). It shows the top 10 and the places around you.
- **Simulated companies:** new ones open, grow at a human pace, move into new areas, level off, and sell up or go bust, all in the news. The "top 5" and "richest" goals count them and real players too.
- **Server:** `server/index.js` and the D1 database `brickncoin`; new tests `server_check.js` and `online_check.js`.

**v0.06: Splash and menus**
- **The Inspirapixel splash:** the same as Olympus Hunt's plays first. The wordmark draws in, gold pixels rain into the i-dots, and "Click anywhere to start" fades in. Browsers can't play sound before a click, so that click switches sound on: the chime plays on it, then the menu music.
- **A starting menu:** Millbrook drifts by behind the logo (every area open, buildings at every level), with these buttons:
  - **Continue**, showing your company, level and cash;
  - **New Company**, which asks before replacing a saved company;
  - **How to Play**, **Settings** and **What's New** (the patch notes, with a NEW badge until you've read the latest).
  - A **live market** strip along the bottom shows the shared index, PixCoin and Nova prices and the latest headline.
- **The game's Menu,** with sections down the side (tabs on phones):
  - Resume;
  - How to Play (six short illustrated pages, also on the starting menu);
  - Settings (music, sound effects, full screen);
  - Save & Transfer (with Start over);
  - About (company stats and time played);
  - Main Menu.
  - Esc closes whatever's open, then opens the Menu.
- **Sound settings** are kept on the device instead of in the save.
- **The link preview** (`og.png`) shows the new starting menu.
- **No credits** anywhere in the game.
- **Fixed:** buttons you can't afford no longer flash their colour before turning grey when a panel or window opens. Their state is applied before the browser first draws them.

**v0.05: One shared world**
- **Same world for everyone:** the stock market, PixCoin, the index fund, home prices, rivals, all news, booms, slumps, weather and goods price swings are the same for every player at the same moment, with no server. The world runs on the server's clock.
- **Balance:**
  - The market no longer climbs forever; it wanders around fair values with modest, slow-fading news shocks.
  - Holding pays a few percent a day, and quick crash-flips don't beat the fees.
  - Home prices swing far less.
  - Rivals no longer grow forever.
- **Time away:**
  - measured on the server's clock;
  - offline earnings at plain prices;
  - leaving the game open and untouched now counts as away (25%, then waits after 2 hours), with a summary when you're back;
  - no dividends while away.
- **Smaller saves:** they hold only the company (save codes are about 4× shorter). v0.03 and v0.04 saves load.
- **brickncoin.com package:** `public/` with icons, link preview, app manifest and caching rules, plus a static Cloudflare config. `build.py` now writes `public/index.html`.
- **Start screen:** now says "test version".
- **Market Check:** a new tool, `test/market_check.js`.

**v0.04: Gold Hill**
- **Level 4:** Gold Hill opens at $1M, with 12 lots, its own tune, and two Hilltop Villas.
- **Three new products:** Grand Piano, Gift Hamper and Motor Car.
- **Two goals** before the ranking goals.
- **Fixed:** profit estimates now use the buy price for materials you don't make, stopped buildings pay no upkeep, and a pasted save code survives a menu redraw.
- **Balance:** Nails $21, Tools $540.

**v0.03 and before:** the single-file version this project started from.
