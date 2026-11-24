'use strict';
/* ============================================================================
   YOUR COMPANIES (v0.19): the screen behind your company's name, and the names on the map. The rules are in 36_group.js.
   ========================================================================== */
function fndPick() { return UI.fnd || (UI.fnd = { name: '', start: 'wood', amt: GRP_MIN, by: 'co' }); }
Object.assign(LIVE, {
  wallet: () => money(wallet(), false),
  cow: i => { const c = allCos()[+i]; return c ? money(withCo(c, companyValue), false) : ''; },
  coc: i => { const c = allCos()[+i]; return c ? money(c.cash, false) : ''; },
  cop(i) { const c = allCos()[+i]; if (!c) return ''; const v = withCo(c, profitPerMin); return { text: (v >= 0 ? '+' : '') + money(v) + '/min', cls: v >= 0 ? 'olive' : 'red' }; },
  fndamt: () => money(fndPick().amt, false), fndhave: () => money(foundMoney(fndPick().by), false),
  coclv: i => { const c = allCos()[+i]; return c ? money(closeValue(c), false) : ''; },
});
// the names on the map: one tap to switch. Only with two or more companies
function renderCobar() {
  const el = $('#cobar'); if (!el) return;
  const l = allCos(), sig = l.length < 2 ? '' : l.map(c => c.company + (c === S ? '*' : '')).join('|') + (UI.sheet && isPhone() ? 's' : '');
  if (el.dataset.sig === sig) return; el.dataset.sig = sig; el.hidden = !sig || (UI.sheet && isPhone());
  el.innerHTML = l.length < 2 ? '' : l.map((c, i) => `<button type="button" data-act="gogo" data-i="${i}" aria-pressed="${c === S}" title="${esc(c.company)}">${esc(c.company)}</button>`).join('') + '<button type="button" data-act="group" title="Your companies" aria-label="Your companies">☰</button>';
}
Object.assign(MODAL, {
  group() {
    const l = allCos(), why = nextSlotWhy(), conf = UI.confirm, f = fndPick(), here = l.indexOf(S), most = Math.max(GRP_MIN, Math.floor(foundMoney(f.by))), hasW = !!(ROOT && ROOT.grp), mine = allYours(S), own = parentOf(S), byCo = foundBy(f.by) === 'co', pc = c => Math.round(ownFrac(c) * 1000) / 10 + '%';
    f.amt = clamp(f.amt, GRP_MIN, most);
    const card = (c, i) => {
      const m = mgrOf(c), me = c === S, P = parentOf(c), next = MGR_TRAIN[m.tr], sp = Math.round(MGR_SPEED[m.tr] * 100);
      return `<section class="card"><div class="corow"><h3>${esc(c.company)} ${me ? '<span class="chip gold">YOU’RE HERE</span>' : ''}</h3>${me ? '' : `<button class="btn small" type="button" data-act="gogo" data-i="${i}">Go there</button>`}</div>
        <div class="kv"><span>Level</span><b>${c.level} · ${LEVELS[c.level].name}</b><span>Worth${subsOf(c).length ? ', with what it owns' : ''}</span><b data-live="cow:${i}"></b><span>Cash</span><b data-live="coc:${i}"></b><span>Profit</span><b data-live="cop:${i}" data-base=""></b>
          <span>Yours</span><b>${P ? `${pc(P)} · owned by ${esc(P.company)}` : c.pub ? `${pc(c)} · public as ${c.pub.ticker}` : 'all of it'}</b>
          ${l.length > 1 ? `<span>Speed</span><b>${me ? 'full' : sp + '% under its manager'}</b>` : ''}</div>
        ${P && me ? `<div class="trade"><span class="muted" style="font-size:13px">Send ${esc(P.company)}</span>${[[.25, '25%'], [.5, '50%'], [1, 'All']].map(([v, t]) => `<button class="btn ghost small" type="button" data-act="cotake" data-v="${v}">${t}</button>`).join('')}</div>
        <div class="trade"><span class="muted" style="font-size:13px">${esc(P.company)} puts in</span>${[[.1, '10%'], [.25, '25%'], [.5, '50%']].map(([v, t]) => `<button class="btn ghost small" type="button" data-act="coput" data-v="${v}">${t}</button>`).join('')}</div>` : ''}
        ${l.length > 1 ? `<div class="corow"><div class="seg" role="group" aria-label="What its manager does">${Object.keys(MGR_ORDERS).map(o => `<button type="button" data-act="morder" data-i="${i}" data-v="${o}" aria-pressed="${m.order === o}">${MGR_ORDERS[o]}</button>`).join('')}</div></div>
        <p class="muted" style="font-size:12px">${m.order === 'grow' ? 'When you’re not there, its manager spends its own cash on room, products and buildings.' : m.order === 'home' ? (c.pub ? 'It’s public, so its cash stays in it: it pays you dividends instead.' : P ? `When you’re not there, its spare cash goes to ${esc(P.company)}.` : 'When you’re not there, its spare cash becomes yours.') : 'When you’re not there, its cash piles up.'} The manager takes ${MGR_FEE * 100}% of its profit.</p>
        <div class="trade">${next != null ? `<button class="btn ghost small" type="button" data-act="mtrain" data-i="${i}" ${c.cash < next ? `data-cost="0" data-block="${esc(c.company)} needs ${money(next, false)}"` : ''}>Train its manager to ${Math.round(MGR_SPEED[m.tr + 1] * 100)}% · ${money(next, false)}</button>` : '<span class="chip olive">Manager fully trained</span>'}
          ${i > 0 && !c.pub ? `<button class="btn ${conf === 'close' + i ? 'danger' : 'ghost'} small" type="button" data-act="coclose" data-i="${i}">${conf === 'close' + i ? 'Tap again: close it for ' : 'Close it for '}<b data-live="coclv:${i}"></b></button>` : ''}</div>` : ''}</section>`;
    };
    const sig = `grp|${l.map(c => c.company + c.level + JSON.stringify(c.mgr || 0).replace(/"(paid|t)":[^,}]*/g, '') + (c.pub ? c.pub.own / c.pub.total : '') + (c.subOf || '') + (MGR_TRAIN[mgrOf(c).tr] != null && c.cash >= MGR_TRAIN[mgrOf(c).tr])).join()}|${here}|${why}|${conf}|${f.start}|${f.by}|${hasW}|${mine}|${Math.floor(most / 5000)}|${wallet() >= 1}`;
    return { sig, title: 'Your companies', html: `
      <p class="m-sub">Run more than one company. The one you’re in runs at full speed; the others carry on under a manager. Your net worth is your own money and your part of each.</p>
      ${hasW ? `<section class="card"><h3>Your own money <b class="gold" data-live="wallet"></b></h3><p class="muted" style="font-size:13px">It’s yours, not any company’s. Found companies with it, or put it into one that’s all yours.${mine ? '' : own ? ` ${esc(S.company)} belongs to ${esc(own.company)}, so its money goes there.` : ` ${esc(S.company)} is public, so money leaves it as dividends (Invest → Your company).`}</p>
        ${mine ? `<div class="trade"><span class="muted" style="font-size:13px">${esc(S.company)}: take out</span>${[[.25, '25%'], [.5, '50%'], [1, 'All']].map(([v, t]) => `<button class="btn ghost small" type="button" data-act="cotake" data-v="${v}">${t}</button>`).join('')}</div>
        ${wallet() >= 1 ? `<div class="trade"><span class="muted" style="font-size:13px">Put in</span>${[[.5, 'Half'], [1, 'All']].map(([v, t]) => `<button class="btn ghost small" type="button" data-act="coput" data-v="${v}">${t}</button>`).join('')}</div>` : ''}
        <p class="muted" style="font-size:12px">Money you put in doesn’t count toward a company’s next level. What it makes with it does, and money you take out still counts.</p>` : ''}</section>` : ''}
      ${l.map(card).join('')}
      <section class="card"><h3>Found a company</h3>${why ? `<p class="muted" style="font-size:13px">${why}</p>`
        : `<p class="muted" style="font-size:13px">A new town, from the start: its own HQ, five products and levels. You’ll go straight there.${byCo ? ` ${esc(S.company)} pays and owns it, so you have ${pc(S)} of it, the same as of ${esc(S.company)}.` : mine ? '' : own ? ` Go to ${esc(own.company)} to use its money.` : ' It’s all yours.'}</p>${S.pub ? `
        <div class="seg" role="group" aria-label="Who pays"><button type="button" data-act="fby" data-v="co" aria-pressed="${byCo}">${esc(S.company)} pays</button><button type="button" data-act="fby" data-v="me" aria-pressed="${!byCo}">I pay</button></div>` : ''}
        <label class="sld"><span>Name</span><b></b><input type="text" data-slide="fnd.name" maxlength="24" autocomplete="off" spellcheck="false" style="text-transform:none" value="${esc(f.name)}" aria-label="Company name"></label>
        <div class="seg" role="group" aria-label="What it starts with">${['wood', 'wheat', 'ore'].map(p => `<button type="button" data-act="fstart" data-p="${p}" aria-pressed="${f.start === p}">${iconImg(p, 18)} ${PRODUCTS[p].name}</button>`).join('')}</div>
        <label class="sld"><span>Put in (you have <b data-live="fndhave"></b>)</span><b data-live="fndamt"></b><input type="range" data-slide="fnd.amt" min="${GRP_MIN}" max="${most}" step="${Math.max(1000, Math.round((most - GRP_MIN) / 40 / 1000) * 1000)}" value="${f.amt}" aria-label="How much to put in"></label>
        <button class="btn gold" type="button" data-act="found" style="align-self:flex-start">Found it</button>`}</section>` };
  },
});
