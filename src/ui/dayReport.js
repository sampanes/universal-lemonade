// src/ui/dayReport.js -- the Day Report: the docked ticket and the full report.
import { fmtDollars, fmtSigned } from './format.js';
import { skyCondition } from '../scene/forecastArt.ts';
import { FLAVORS, FLAVOR_BOOST } from '../data/flavors.ts';

const SPRITE_DIR = './sprites/kawaii_cat/';

// Five smiling stars with the first `frac` of the row lit (same markup as the reputation meter).
const STAR5 = `<img src="${SPRITE_DIR}star_small.png" alt="" />`.repeat(5);
const starMeter = (frac, label) => `<span class="star-meter" role="img" aria-label="${label}">` +
  `<span class="star-meter-row dim">${STAR5}</span>` +
  `<span class="star-meter-row lit" style="width:${Math.round(frac * 100)}%">${STAR5}</span></span>`;
const isTeamNote = (r) => r.reviewer.includes('(');   // "Timmy (Elm Street)": a friend talking

// Day Report cat: 1 star = calm (0) ... 5 stars = cheering (4); a losing day is always calm.
export function reportCatMood(d) {
  const cust = (d.reviews || []).filter(r => !isTeamNote(r));
  if (d.netProfit <= 0 || cust.length === 0) return 0;
  const avg = cust.reduce((sum, r) => sum + r.stars, 0) / cust.length;
  return Math.max(0, Math.min(4, Math.round(avg) - 1));
}

// Stars everywhere mean one thing: how much the neighborhood likes the stand (reputation).
export const repStars = (d) => starMeter(d.reputationAfter, `Neighbors like the stand ${Math.round(d.reputationAfter * 100)} out of 100`);

// hero(d): the picture at the top (the player's kid with a face for the day).
export function renderFullDayReportHTML(d, s, isModal = false, hero = () => '') {
  if (!d) return '';
  const money = (n) => `$${fmtDollars(n, true)}`;
  const row = (label, amount, cls = '') =>
    `<div class="report-row ${cls}"><span>${label}</span><span class="amt">${amount}</span></div>`;
  const count = (n) => n.toLocaleString('en-US');
  const units = d.drivewayCupsSold + d.franchiseCupsSold + d.bottlesSold;
  const rawRevenue = d.drivewayRevenue + d.franchiseGrossRevenue + d.wholesaleRevenue + d.patentRoyalties + d.copackerNet;
  const brandBonus = d.totalRevenue - rawRevenue;

  // With only the driveway stand, the rows would just repeat the big number above them.
  const showRows = s.phase >= 2 || brandBonus > 0.005;
  // Once a helper runs them (the Stand Captain, the Delivery Route), the stands are one line
  // and the stores are one line: next to the squeezer and the factory they are pocket change.
  const helpers = s.flags || {};
  let rows = '';
  if (helpers.hasStandCaptain) {
    const net = d.drivewayRevenue + d.franchiseGrossRevenue - d.franchiseWagesPaid;
    rows += row(`Lemonade stands (${count(d.drivewayCupsSold + d.franchiseCupsSold)} cups)`, fmtSigned(net, true), net < 0 ? 'cost' : '');
  } else {
    rows += row(`Driveway stand (${count(d.drivewayCupsSold)} cups)`, `+${money(d.drivewayRevenue)}`);
    if (d.friends && d.friends.length) {
      // One row per friend: what their stand took in minus their pay, so a slow rainy
      // day shows up as a friend who cost money.
      d.friends.forEach(f => {
        if (f.dayOff) { rows += row(`${f.workerName} had the day off`, money(0)); return; }
        const net = f.revenue - f.wage;
        rows += row(`${f.workerName} (${count(f.cups)} cups, paid ${money(f.wage)})`, fmtSigned(net, true), net < 0 ? 'cost' : '');
      });
    } else if (s.phase >= 2) {
      rows += row(`Franchise stands (${count(d.franchiseCupsSold)} cups)`, `+${money(d.franchiseGrossRevenue)}`);
      rows += row('Franchise wages', `-${money(d.franchiseWagesPaid)}`, 'cost');
    }
  }
  if (helpers.hasDeliveryRoute) {
    rows += row(`Stores (${count(d.bottlesSold)} bottles)`, `+${money(d.wholesaleRevenue)}`);
  } else if (d.stores && d.stores.length) {
    // One row per store; "12 of 25" when the bottles, lemons or sugar ran out first.
    d.stores.forEach(st => {
      const n = st.bottles < st.wanted ? `${count(st.bottles)} of ${count(st.wanted)}` : count(st.bottles);
      rows += row(`${st.name} (${n} bottles)`, `+${money(st.revenue)}`);
    });
  } else if (s.phase >= 3) {
    rows += row(`Wholesale (${count(d.bottlesSold)} bottles)`, `+${money(d.wholesaleRevenue)}`);
  }
  if (s.phase >= 4) rows += row(`Your Lemon Squeezer (${count(d.patentUnitsSold)} sold)`, `+${money(d.patentRoyalties)}`);
  if (s.phase >= 5) rows += row(`Lemonade factory (${count(d.copackerCasesSold)} cases)`, `+${money(d.copackerNet)}`);
  if (brandBonus > 0.005) rows += row('Famous brand bonus', `+${money(brandBonus)}`);
  rows += row("Today's profit", fmtSigned(d.netProfit, true), `total ${d.netProfit < 0 ? 'neg' : ''}`);

  // At most two comments, the most useful first: taste (how to find golden), then ice,
  // then a stand that ran out, then price, then happy team chatter. No stars on comments:
  // stars only mean how much the neighborhood likes the stand. On the lock day the gold
  // banner already says it, so the taste comment is left out.
  const reviewRank = (r) => {
    if (r.topic === 'taste') return 0;
    if (r.topic === 'ice') return 1;
    if ((r.topic === 'stock' || r.topic === 'team') && r.sentiment !== 'positive') return 2;
    if (r.topic === 'price') return 3;
    return 4;
  };
  const shown = (d.reviews || [])
    .filter(r => !(d.recipeJustLocked && r.topic === 'taste'))
    .map((r, i) => ({ r, i }))
    .sort((a, b) => reviewRank(a.r) - reviewRank(b.r) || a.i - b.i)
    .slice(0, 2)
    .map(x => x.r);
  const reviews = shown.map(r => {
    const team = isTeamNote(r);
    const mood = team ? 'team' : r.sentiment === 'positive' ? 'good' : 'bad';
    const face = r.topic === 'taste' && r.face
      ? `<img class="report-review-face" src="./sprites/faces/taste_${r.face}.png" alt="" />` : '';
    return `<div class="report-review ${mood}">
      ${face}
      <div class="report-review-text">
        <div class="report-review-who">${r.reviewer}</div>
        <div class="report-review-quote">&quot;${r.quote}&quot;</div>
      </div>
    </div>`;
  }).join('');
  // From Stage 4 the cents the ice machine and fridge save are not worth a line.
  const notes = (d.notes || []).filter(n => n !== 'All operations ran smoothly!' && !(s.phase >= 4 && n.startsWith('Your upgrades saved')));
  // The Flavor Lab's tasting (Stage 5): the testers' comment, or the new flavor's big day.
  const ft = d.flavorTaste;
  const flavor = ft && FLAVORS.find(f => f.id === ft.id);
  let flavorHTML = '';
  if (ft && flavor && ft.launched) {
    flavorHTML = `<div class="report-golden report-flavor" style="--drink:${flavor.color}">
      <img src="./sprites/golden_seal.png" class="golden-seal" alt="" />
      <span>${flavor.name} is in the stores! The factory sells ${Math.round(FLAVOR_BOOST * 100)}% more.</span>
    </div>`;
  } else if (ft && flavor) {
    flavorHTML = `<div class="report-section-title">Flavor Lab: ${flavor.name}</div>
      <div class="report-review ${ft.review.sentiment === 'positive' ? 'good' : 'bad'}">
        ${ft.review.face ? `<img class="report-review-face" src="./sprites/faces/taste_${ft.review.face}.png" alt="" />` : ''}
        <div class="report-review-text"><div class="report-review-who">${ft.review.reviewer}</div>
        <div class="report-review-quote">&quot;${ft.review.quote}&quot;</div></div>
      </div>`;
  }

  const sInfo = d.seasonInfo;

  // Small changes are normal; warn only for a meaningful drop.
  let rep = '';
  {
    const trend = d.reputationTrend;
    const [cls, msg] = trend === 'up' ? ['up', 'Going up!']
      : trend === 'down' ? ['down', 'Going down']
      : ['same', d.reputationAfter >= 0.9 ? 'Looking good!' : 'Holding steady'];
    rep = `<div class="report-rep"><span>What neighbors say</span>` +
      starMeter(d.reputationAfter, `Reputation ${Math.round(d.reputationAfter * 100)} out of 100`) +
      `<span class="report-rep-trend ${cls}">${msg}</span></div>`;
  }

  return `<div class="report-card ${isModal ? 'in-modal' : ''}">
    <div class="ratio-banner report-banner">
      <span>DAY ${d.day} REPORT</span>
      <div style="display:flex; align-items:center; gap:6px;">
        <span class="report-weather">${sInfo.icon} ${d.tempF}&deg;F ${skyCondition(d.weather, d.tempF)}</span>
        ${!isModal ? `<button type="button" class="fold-pill-btn" onclick="window._toggleReportInline(event)"><span>Close</span> <span class="fold-arrow" style="transform:rotate(180deg)">\u{25BE}</span></button>` : ''}
      </div>
    </div>
    <div class="report-body">
      ${d.recipeJustLocked ? `<div class="report-golden">
        <img src="./sprites/golden_seal.png" class="golden-seal" alt="" />
        <span>The whole neighborhood agrees: your recipe is GOLDEN!</span>
      </div>` : ''}
      <div class="report-hero">
        ${hero(d)}
        <div class="report-hero-text">
          <div class="report-hero-label">${d.netProfit < 0 ? 'You lost' : 'You made'}</div>
          <div class="report-profit ${d.netProfit < 0 ? 'neg' : 'pos'}" style="--chars:${fmtSigned(d.netProfit).length}">${fmtSigned(d.netProfit)}</div>
          <div class="report-hero-sub">${count(units)} drinks sold today</div>
        </div>
      </div>
      ${showRows ? `<div class="report-rows">${rows}</div>` : ''}
      ${flavorHTML}
      ${rep}
      ${reviews ? `<div class="report-section-title">What people said</div>${reviews}` : ''}
      ${notes.length ? `<ul class="report-notes">${notes.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}
    </div>
  </div>`;
}

// The docked ticket, or the whole report when expanded.
export function renderDayReport(s, expanded, hero) {
  const d = s.lastDaySummary;
  if (!d) {
    return `<div class="report-dock-ticket placeholder">
      <img class="report-dock-cat" src="${SPRITE_DIR}cat0.png" alt="" />
      <div class="report-dock-info">
        <div class="report-dock-top">
          <span class="report-dock-title">DAY REPORT</span>
        </div>
        <div class="report-dock-sub">Open Day 1 to see how your stand performs!</div>
      </div>
    </div>`;
  }

  if (expanded) {
    return renderFullDayReportHTML(d, s, false, hero);
  }

  const count = (n) => n.toLocaleString('en-US');
  const units = d.drivewayCupsSold + d.franchiseCupsSold + d.bottlesSold;

  return `<div class="report-dock-ticket" id="report-dock-ticket" onclick="window._toggleReportInline(event)" role="button" tabindex="0" title="Click to expand Day Report">
    <img class="report-dock-cat" src="${SPRITE_DIR}cat${reportCatMood(d)}.png" alt="" />
    <div class="report-dock-info">
      <div class="report-dock-top">
        <span class="report-dock-title">DAY ${d.day} REPORT</span>
        <span class="report-dock-profit ${d.netProfit < 0 ? 'neg' : 'pos'}">${fmtSigned(d.netProfit)}</span>
      </div>
      <div class="report-dock-sub">
        <span>${count(units)} drinks sold</span> &bull; ${repStars(d)}
      </div>
    </div>
    <button type="button" class="fold-pill-btn report-dock-expand-btn" aria-expanded="false">
      <span>Details</span> <span class="fold-arrow">\u{25BE}</span>
    </button>
  </div>`;
}
