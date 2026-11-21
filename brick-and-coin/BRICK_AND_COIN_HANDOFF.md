# Brick & Coin: how to keep building it

An Inspirapixel business tycoon, currently **v0.03 (single-player test)**. You run a company in the pixel town of Millbrook: build producers on lots, turn raw goods into better goods, trade on a live market, invest in stocks, PixCoin and real estate, and climb a leaderboard of rival tycoons. The whole game is one self-contained web page. Art is drawn in code, music and sound are synthesized in code, and saves live in the browser.

The source in `src/` was cut from the v0.03 page with nothing changed: `build.py` rebuilds it **byte-for-byte identical** to that file.

## Where things live

| File | What's in it |
|---|---|
| `src/00_style.html` | Fonts and all CSS, including the phone layouts (upright = rotate screen, sideways = compact). |
| `src/01_body.html` | The page markup: top bar, town map, side panel, menus, start screen. |
| `src/10_data.js` | **Every number and list**: `VERSION`, `SAVE_KEY`, products and recipes, costs, levels, HQ and warehouse, town layout, properties, stocks, rivals, goals, news headlines, and the 16×16 icons. Most balancing happens here. |
| `src/20_art.js` | Pixel art in code: building sprites and their animations, how buildings grow with level (`ANCHOR`), houses, town background, walkers and smoke. |
| `src/30_sim.js` | The economy, with no page code in it: production, market prices, events, stock market, real estate, net worth, levels, goals, offline earnings, save and load (`adopt()`). |
| `src/40_audio.js` | Sound effects (`SFX`) and the three chiptunes (`SONGS`), one per area of town. |
| `src/50_ui.js` | Top bar, side panel views, the menus (Production web, Market, Invest, Leaderboard, Menu), stock chart, toasts, start screen. |
| `src/60_tutorial.js` | The five guided steps for a new company (`TUT`). |
| `src/90_main.js` | Game loop, camera, drawing the town, taps, drags and keys, button actions (`act()`), start and boot. |
| `build.py` | Joins `src/` into `dist/brick-and-coin.html` (the whole game) and `dist/artifact.html` (for a Claude artifact). |
| `test/playtest.js` | The automated playtest (below). |

JS parts are joined in name order, so a new part like `35_loans.js` slots in after the sim.

## Making a change

```bash
# 1. edit files in brick-and-coin/src/
python3 brick-and-coin/build.py                 # 2. build
node brick-and-coin/test/playtest.js            # 3. playtest (about 10 seconds), exits 1 on any failure
# 4. look at the screenshots in brick-and-coin/test/out/ for anything visual
# 5. bump VERSION in src/10_data.js when it's a release (v0.04, ...)
# 6. commit src/ and dist/brick-and-coin.html together
```

The playtest drives the real page in a headless browser. It:
- plays the whole tutorial by clicking;
- uses every menu: market buy and sell, Keep/Sell/Auto, stocks, PixCoin, buying and renovating a home, save-code export and import;
- draws every building at every level, every house, icon and town background;
- lets a simple bot play 60 game minutes (`--minutes N` for more), checking every game minute that cash, stock, prices and net worth stay sane;
- closes the game for an hour and reopens it (Continue, offline earnings);
- checks phone-sideways, phone-upright and short-laptop screens.

Add `--verbose` to see what the bot built.

`window.__game` at the end of `90_main.js` is a test hook. Keep it.

## Rules that keep players' saves working

Players' companies live in the browser under `SAVE_KEY`, and a save code can carry one to another device. An update must load every old save.

- **Never change `SAVE_KEY`.**
- **New fields in the save state `S`** need a default in `adopt()` (`30_sim.js`), next to the existing `// v0.03:` lines. `newGame()` sets them for new companies, and `adopt()` sets them for old ones.
- **Some lists are saved by position.** `GOALS` (`S.goal` is an index), `TUT` (`S.tut`), `PLOTS` (`S.props`) and `RIVALS` (`S.rivals`): add to the **end** only. Inserting into the middle shifts every existing player, unless you also write a fix-up in `adopt()`.
- **Never rename ids.** Saves refer to product ids (`wood`, `planks`, ...) and stock tickers (`TSW`, `PXC`, ...). New products and stocks are filled in for old saves automatically.
- Test an old save: before changing anything, play a bit, Menu → Export save code, then import that code in the new build.

## Recipes

**New product.** Everything is checked by the playtest except the news and start-screen lists:
1. `10_data.js`:
   - `PRODUCTS`: name, branch (wood/food/metal), ring (the level it opens at), base price, recipe, output, seconds, building name.
   - `ICONS`: a 16×16 picture using the `PAL` letters (the outline is added automatically).
   - `BLURB`: one line about the building.
   - The branch list in `EV_SECTOR`.
2. `20_art.js`: a `BUILD` entry for the building (`body`, optional `anim` and `smoke`), plus an `ANCHOR` row so it grows with levels.
3. `50_ui.js`: a `WEBPOS` spot (angle and radius) on the Production web.

**New goal.** Append to `GOALS` with `text`, `reward` and `done: s => ...`.

**New stock.** Add to `ASSETS` (and a rival in `RIVALS` and `RIVAL_CO` if someone owns it).

**New home plot.** Append to `PLOTS` (x, y outside the town, and a type from `PROPS`).

**News.** Headlines are in `EV_*` (`10_data.js`). The event odds and effects are in `spawnEvent()` and `stockEvent()` (`30_sim.js`).

**Sound.** `SFX` entries are short functions of time. Songs are text: chords per bar, an 8th-note melody, and 16-step bass, arp and drum patterns.

## Publishing

- `dist/brick-and-coin.html` is the whole game. Open it in any browser, or upload it anywhere that hosts a web page.
- `dist/artifact.html` is the version for a Claude artifact. A page downloaded from claude.ai comes wrapped in an extra `<html>` shell from the viewer. Use the build, not a download, as the starting point.
- It is **not** on olympushunt.com. `public/` in this repo is Olympus Hunt's live site, and anything committed to `main` there goes live. Copying the build to `public/brick-and-coin/index.html` would publish it at olympushunt.com/brick-and-coin/, but only do that once that's decided.

## v0.03 baseline and findings

**Pacing (the bot, 4 games of 150 min).** Level 2 at about game minute 21–23, Level 3 at about 110–130. Run the same command after a balance change and compare. The bot follows the goals and then builds whatever pays best per dollar. It's a rough player, so use its numbers to compare versions, not as real play time. It spends long stretches with the HQ full, saving for the next HQ upgrade ($12k, then $35k).

**Bug: profit estimates ignore the 30% markup on bought inputs.** "Profit about" and "Profit" use the market's *sell* price for inputs. A factory with "Buy missing inputs" on pays 30% more. Measured in v0.03: a Nail Works buying all its iron showed **+$50/min** while the company **lost $32/min**. A player can lose money while the panel says it's fine. Fix: in `estProfit()` (`50_ui.js`), price an input at `buyPrice()` when the building has `autoBuy` and you don't make that input.

**Loose ends in the code:**
- Level 4 "Global" exists in `LEVELS` as `soon: true`, with `MAX_LEVEL = 3`. The top bar already says "Level 4 comes in a later version".
- Rivals on the leaderboard are simulated. Real players would need a server. The Olympus Hunt worker (`src/index.js`, D1) already does accounts and saves, but don't touch it without a clear yes.
- `40_audio.js` mentions a `test/audio_levels.py` loudness check that wasn't part of the v0.03 file.
- `LIVE.goalbar` in `50_ui.js` is an unused stub.
- On phones held sideways, the closed side panel sits off-screen to the right, so `#app` can be scrolled sideways by code (`scrollIntoView`, automation tools). Real taps don't trigger it. The playtest clicks with plain click events there for that reason. `overflow: clip` on `#app` would rule it out completely.
