# Brick & Coin: how to keep building it

An Inspirapixel business tycoon, currently **v0.04 (single-player test)**. You run a company in the pixel town of Millbrook: build producers on lots, turn raw goods into better goods, trade on a live market, invest in stocks, PixCoin and real estate, and climb a leaderboard of rival tycoons. The whole game is one self-contained web page. Art is drawn in code, music and sound are synthesized in code, and saves live in the browser.

**Roadmap (agreed):** v0.04 Level 4 Gold Hill and balance (done) → v0.05 going public (IPO, capped at 49% sold) → v0.1 multiplayer (Cloudflare Workers + D1, server is the source of truth, order book, players-only leaderboard).

## Where things live

| File | What's in it |
|---|---|
| `src/00_style.html` | Fonts and all CSS, including the phone layouts (upright = rotate screen, sideways = compact). |
| `src/01_body.html` | The page markup: top bar, town map, side panel, menus, start screen. |
| `src/10_data.js` | **Every number and list**: `VERSION`, `SAVE_KEY`, the 16×16 icons, products and recipes, costs, levels, HQ and warehouse, town layout (zones, lots, Gold Hill), properties, stocks, rivals, goals, news headlines. Most balancing happens here. |
| `src/20_art.js` | Pixel art in code: building sprites and their animations, how buildings grow with level (`ANCHOR`), houses, the town background and Gold Hill (`drawHill`), walkers and smoke. |
| `src/30_sim.js` | The economy, with no page code in it: production, upkeep, market prices, events, stock market, real estate, net worth, levels, goals, offline earnings, save and load (`adopt()` brings old saves up to date). |
| `src/40_audio.js` | Sound effects (`SFX`) and the four chiptunes (`SONGS`), one per area of town. |
| `src/50_ui.js` | Top bar, side panel views, the menus (Production web, Market, Invest, Leaderboard, Menu), profit estimates, stock chart, toasts, start screen. |
| `src/60_tutorial.js` | The five guided steps for a new company (`TUT`). |
| `src/90_main.js` | Game loop, camera, drawing the town, taps, drags and keys, button actions (`act()`), start and boot. |
| `build.py` | Joins `src/` into `dist/brick-and-coin.html` (the whole game) and `dist/artifact.html` (for a Claude artifact). |
| `test/playtest.js` | The automated playtest (below). |
| `test/fixtures/v0.03-save.txt` | A real v0.03 company (Level 3, 23 buildings) for checking that old saves still load. |

JS parts are joined in name order, so a new part like `35_ipo.js` slots in after the sim.

## Making a change

```bash
# 1. edit files in brick-and-coin/src/
python3 brick-and-coin/build.py                 # 2. build
node brick-and-coin/test/playtest.js            # 3. playtest (about 15 seconds), exits 1 on any failure
# 4. look at the screenshots in brick-and-coin/test/out/ for anything visual
# 5. bump VERSION in src/10_data.js when it's a release
# 6. commit src/ and dist/brick-and-coin.html together
```

The playtest drives the real page in a headless browser:
- **Tutorial and menus:** it plays the whole tutorial by clicking, then uses every menu: market buy and sell, Keep/Sell/Auto, stocks, PixCoin, buying and renovating a home, and save-code export and import (including a menu redraw, which must keep a pasted code).
- **Art:** every building at every level, every house, icon and town background.
- **Bot:** lets a simple bot play 60 game minutes (`--minutes N` for more, `--verbose` to see what it built), checking every game minute that cash, stock, prices and net worth stay sane.
- **Offline:** closes the game for an hour and reopens it (Continue, offline earnings).
- **Gold Hill:** a $1M company reaches Level 4, the camera goes there, it unlocks and builds a Grand Piano through the real menus, the piano line makes money buying its materials, it buys a villa, and the hill's tune plays.
- **Old save:** loads the v0.03 fixture through Continue, the way a returning player would.
- **Screens:** phone held sideways (including tapping Gold Hill), phone upright, short laptop window.

**Comparing balance between versions:** `--bot-only` runs just the bot on a fresh company, and `--page FILE` points it at another build. Build the old version from git and run both, several times each, because single games vary a lot:

```bash
git show <old-commit>:brick-and-coin/dist/brick-and-coin.html > /tmp/old.html
node brick-and-coin/test/playtest.js --bot-only --minutes 600 --page /tmp/old.html
node brick-and-coin/test/playtest.js --bot-only --minutes 600
```

The bot follows the goals and builds whatever pays best per dollar. Once its HQ is full, it swaps its weakest building for a far better product it can supply itself. It keeps a little cash back, and stops buying materials when that loses money. It's a rough player, so use it to compare versions, not as real play time.

`window.__game` at the end of `90_main.js` is a test hook. Keep it.

## Rules that keep players' saves working

Players' companies live in the browser under `SAVE_KEY`, and a save code can carry one to another device. An update must load every old save.

- **Never change `SAVE_KEY`.**
- **New fields in the save state `S`** need a default in `adopt()` (`30_sim.js`). `newGame()` sets them for new companies, and `adopt()` sets them for old ones.
- **Some lists are saved by position.** `GOALS` (`S.goal` is an index), `TUT` (`S.tut`), `PLOTS` (`S.props`), `RIVALS` (`S.rivals`) and lots (`S.lots`, 12 per zone). Add to the **end**. If something must go in the middle, bump `SAVE_V` (`30_sim.js`) and move older saves along in `adopt()`, like v0.04 did for its goals.
- **Never rename ids.** Saves refer to product ids (`wood`, `piano`, ...) and stock tickers (`TSW`, `PXC`, ...).
- When a release changes the save format, add a fixture made with the *old* build to `test/fixtures/`, plus a playtest section that loads it.

## Recipes

**New product.** The playtest checks everything except the news and start-screen lists:
1. `10_data.js`:
   - `PRODUCTS`: name, branch (wood/food/metal), ring (the level it opens at), base price, recipe, output, seconds, building name.
   - `ICONS`: a 16×16 picture using the `PAL` letters (the outline is added automatically).
   - `BLURB`: one line about the building.
   - The branch list in `EV_SECTOR`.
2. `20_art.js`: a `BUILD` entry (`body`, optional `anim` and `smoke`), plus an `ANCHOR` row so it grows with levels.
3. `50_ui.js`: a `WEBPOS` spot (angle and radius) on the Production web. Rings sit at radius 72, 128, 188, 248 and 305.

Check that it still earns money when it buys every material at the 30% markup.

**New area of town** (how Gold Hill was done):
1. `10_data.js`:
   - Add to `ZONE_LEVEL` and `ZONE_NAME`, and raise `LOTS` by 12.
   - Give `lotXY()`, `zoneBoxes()`, `zoneLabelSpots()` and `zoneCenter()` a case for it.
   - Grow the world (`HILL_EXTRA` is how far it reaches south).
2. Add a `LEVELS` entry, raise `MAX_LEVEL`, and add the next `MARKET_SIZE`, `BUILD_COST`, `UPKEEP` and `RESEARCH` entries.
3. `20_art.js`: draw the ground in the background, and keep trees off it in `keepOut`.
4. `40_audio.js`: add a tune to `SONGS`. Then `90_main.js`: pick it in `render()` from where the camera is.
5. `adopt()`: pad `S.lots`, and add goals for the new level.

**New goal.** Add it to `GOALS` with `text`, `reward` and `done: s => ...` (see the save rules above).

**New stock.** Add it to `ASSETS` (and a rival in `RIVALS` and `RIVAL_CO` if someone owns it).

**New home plot.** Append to `PLOTS`. Its type comes from `PROPS`, and its house sprite from `HOUSE` in `20_art.js`.

**News.** Headlines are in `EV_*`. The odds and effects are in `spawnEvent()` and `stockEvent()`.

**Sound.** `SFX` entries are short functions of time. Songs are text: chords per bar, an 8th-note melody, and 16-step bass, arp and drum patterns.

## Publishing

- `dist/brick-and-coin.html` is the whole game. Open it in any browser, or upload it anywhere that hosts a web page.
- `dist/artifact.html` is the version for a Claude artifact. A page downloaded from claude.ai comes wrapped in an extra `<html>` shell from the viewer. Use the build, not a download, as the starting point.
- It is **not** on olympushunt.com. `public/` in this repo is Olympus Hunt's live site, and anything committed to `main` there goes live. Copying the build to `public/brick-and-coin/index.html` would publish it at olympushunt.com/brick-and-coin/, but only do that once that's decided.

## Pacing baseline (v0.04)

Measured with the bot: about 25 games each for Level 2, 5 games each of 10 hours for the rest. v0.03 was measured with the same bot.

| | v0.03 | v0.04 |
|---|---|---|
| Level 2 ($10k) | 22–34 min (most 22–28) | 22–40 min (most 22–28) |
| Level 3 ($100k) | 104–154 min | 111–195 min |
| $1M (Level 4 in v0.04) | 346–491 min, 4 of 5 got there | 322–512 min, 5 of 5 |

The bot's longest waits are with the HQ full, saving for the next HQ upgrade ($300k for 95 slots, then $900k for 140).

## Version history

**v0.04: Gold Hill**
- **Gold Hill, Level 4 at $1M net worth.** It's a golden plateau south of town with a stone retaining wall veined with gold. It has 12 new lots in three pairs between the roads, stone gateposts, and fences until it opens. The camera pans there when it opens, and it has its own tune (a march in D).
- **Three Gold Hill products**, each made from Level 3 goods of more than one branch:
  - Grand Piano: Furniture Set + 2 Steel.
  - Gift Hamper: 2 Canned Food + Lunch Box + Books.
  - Motor Car: 3 Steel + Tools + 2 Chairs.
  - Each has its own building that grows with level. Tier 4 costs: build $60k, research $100k, upkeep $90/min per level.
- **Two Hilltop Villas** on Gold Hill ($3M, Level 4).
- **The Production web grew** a fourth ring.
- **Two new goals before the ranking goals:** reach $1M, and build a Gold Hill product. Rivals keep growing, so "top 5" and "richest" can take a long time. Old saves that were past goal 12 go to the Gold Hill goals first. One that had already won "top 5" or "richest" can earn that reward once more.
- **Fixed: profit estimates** ("Profit about", "Profit", the Production web) now count materials you don't make at the price you'd pay. In v0.03 a Nail Works or Toolworks buying its materials showed a profit while *losing* $69–282/min.
- **Fixed: buildings stopped for lack of materials no longer pay upkeep.** Before, a company whose factories had run out of materials and cash sank into debt forever, offline too. Cash turns red when it's below zero.
- **Fixed: a save code pasted into the Menu** no longer vanishes when the menu redraws (a level-up, a sound toggle).
- **Balance:**
  - Nails $17 → $21: it lost money on bought iron, and earned the least of any Level 2 product.
  - Tools $460 → $540: it earned less than Steel, its own input, and lost money on bought inputs.

**v0.03 and before.** The single-file version this project started from. It has the tutorial, sound settings, real estate, stocks and PixCoin.

## Known loose ends

- **Rivals grow forever** (about 5–30% an hour, plus their stocks), so "richest" gets harder the longer you play. This only matters until v0.1, when the leaderboard becomes players-only.
- **A company can still get stuck** if every building needs materials it doesn't make and its cash is gone. It no longer sinks into debt, but nothing restarts until the player sells something or tears a building down. A hint when that happens would help.
- `40_audio.js` mentions a `test/audio_levels.py` loudness check that wasn't part of the v0.03 file. The Gold Hill tune uses the same instruments and volumes as the others.
- `LIVE.goalbar` in `50_ui.js` is an unused stub.
- **Phones held sideways:** the closed side panel sits off-screen to the right, so `#app` can be scrolled sideways by code (automation tools, `scrollIntoView`). Real taps don't do it. The playtest clicks with plain click events there for that reason.
