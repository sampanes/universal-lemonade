// src/ui/dadPanel.js -- Dad Mode's business panels.
import { setHTMLIfChanged, STORE_LOCK } from './dom.js';

// Dad Mode's third column and the stage sections under the pantry: every business detail
// (hiring, store contracts, the patent, the co-packer, upgrades, trophies and the log).
// Hidden in kid mode, so it is only drawn while Dad Mode is on.
// storeWait(): why the next store purchase is not open yet ('' when it is).
export function renderDadPanel(engine, storeWait) {
  const s = engine.state;
  // Expansion sections (Franchise, Wholesale, Patent, CoPacker)
  let expansionHTML = '';

  if (s.phase >= 2) {
    expansionHTML += `<div style="font-weight: bold; margin-top: 12px; color: #ffd700;">Neighborhood Franchise Stands:</div>`;
    Object.values(engine.franchiseStands).forEach(st => {
      expansionHTML += `<div class="card">
        <div class="stat">
          <strong>${st.name} (${st.workerName})</strong>
          <span class="${st.hired ? 'badge' : ''}">${st.hired ? 'ACTIVE' : 'NOT HIRED'}</span>
        </div>
        <div style="font-size: 11px; color: #aaa;">${st.desc}</div>
        <div class="stat" style="margin-top: 4px;">
          <span>Daily Wage: $${st.dailyWage}/day | Max Capacity: ${st.baseCapacity} cups</span>
          ${!st.hired ? `<button type="button" data-dad="hire" data-id="${st.id}" ${s.cash.lt(st.setupCost) ? 'disabled' : ''}>Hire ($${st.setupCost} setup)</button>` : '<span style="color:#4ade80;">On Payroll</span>'}
        </div>
      </div>`;
    });
  }

  if (s.phase >= 3) {
    expansionHTML += `<div style="font-weight: bold; margin-top: 12px; color: #ffd700;">Wholesale Retail Accounts:</div>`;
    const wait = storeWait();
    if (wait && Object.values(engine.wholesaleAccounts).some(acc => !acc.active)) {
      expansionHTML += `<div id="contract-unlock-hint">${wait}</div>`;
    }
    Object.values(engine.wholesaleAccounts).forEach(acc => {
      expansionHTML += `<div class="card">
        <div class="stat">
          <strong>${acc.name}</strong>
          <span class="${acc.active ? 'badge' : ''}">${acc.active ? 'ACTIVE' : 'UNCOMMITTED'}</span>
        </div>
        <div style="font-size: 11px; color: #aaa;">${acc.desc}</div>
        <div class="stat" style="margin-top: 4px;">
          <span>Orders: ${acc.bottlesPerDay} bottles/day @ $${acc.wholesalePrice.toFixed(2)}</span>
          ${!acc.active ? `<button type="button" data-dad="sign" data-id="${acc.id}" ${wait ? 'disabled aria-describedby="contract-unlock-hint"' : s.cash.lt(acc.setupCost) ? 'disabled' : ''}>${wait ? STORE_LOCK : ''}Sign Contract ($${acc.setupCost})</button>` : '<span style="color:#4ade80;">Active Supplier</span>'}
        </div>
      </div>`;
    });
  }

  if (s.phase >= 4 && engine.patent.licensed) {
    expansionHTML += `<div class="card" style="border-color: #ffd700;">
      <div class="stat">
        <strong style="color: #ffd700;">USPTO Patent: "Vortex Citrus Press"</strong>
        <span class="badge">LICENSED</span>
      </div>
      <div style="font-size: 11px; color: #ccc; margin: 4px 0;">Kitchen appliance brand sells your juicer design nationwide. Passive income!</div>
      <div class="stat">
        <span>Royalty: <strong>$${engine.patent.royaltyPerUnit.toFixed(2)} / unit</strong></span>
        <span>Est. Sales: ~${engine.patent.baseUnitsPerDay} units/day</span>
      </div>
    </div>`;
  }

  if (s.phase >= 5 && engine.copacker.active) {
    const v = engine.copacker.casesPerDay;
    const scaleBadge = v >= 350000 ? 'GLOBAL EMPIRE' : v >= 25000 ? 'NATIONAL SCALE' : v >= 1500 ? 'MULTI-STATE' : 'REGIONAL SCALE';
    expansionHTML += `<div class="card" style="border-color: #4ade80;">
      <div class="stat">
        <strong style="color: #4ade80;">Industrial Co-Packing & Distribution</strong>
        <span class="badge">${scaleBadge}</span>
      </div>
      <div style="font-size: 11px; color: #ccc; margin: 4px 0;">Commercial automated bottling plants shipping wholesale cases to supermarket shelves & dispensers worldwide.</div>
      <div class="stat">
        <span>Volume: ~<strong>${v.toLocaleString()} cases/day</strong></span>
        <span>Net Margin: <strong>+$${engine.copacker.netPerCase.toFixed(2)}/case</strong></span>
      </div>
    </div>`;
  }

  setHTMLIfChanged(document.getElementById('expansion-sections'), expansionHTML);

  // Projects
  const projectHTML = engine.projects
    .filter(p => !p.purchased && p.unlocked(s))
    .map(p => `<div class="card">
      <div style="font-weight:bold; color:#ffd700;">${p.name}</div>
      <div style="font-size:12px; color:#ccc; margin: 4px 0;">${p.desc}</div>
      <button type="button" data-dad="project" data-id="${p.id}" ${s.cash.lt(p.costCash) ? 'disabled' : ''} style="width:100%; margin-top:4px; font-weight:bold; background:#2e442e; border-color:#4ade80;">
        Invest ($${p.costCash.toLocaleString()})
      </button>
    </div>`).join('');
  setHTMLIfChanged(document.getElementById('project-list'), projectHTML);

  // Trophy Shelf Display (All 15 Emojis)
  const trophyShelf = document.getElementById('trophy-shelf');
  if (trophyShelf) {
    const shelfHTML = engine.trophies.map(t => {
      const cls = t.purchased ? 'trophy-icon owned' : 'trophy-icon locked';
      return `<div class="${cls}" title="${t.name} ($${t.costCash.toLocaleString()})">${t.emoji}</div>`;
    }).join('');
    setHTMLIfChanged(trophyShelf, shelfHTML);
  }

  // Trophy List (Available in current stage)
  const trophyList = document.getElementById('trophy-list');
  if (trophyList) {
    const catLabels = {
      kid: 'Kid Hustle',
      teen: 'Teen Ambition',
      mogul: 'Industry Mogul',
      billionaire: 'Global Billionaire'
    };
    const availableTrophies = engine.trophies.filter(t => !t.purchased && t.phaseRequired <= s.phase);
    let trophyListHTML = '';
    if (availableTrophies.length === 0) {
      const allBought = engine.trophies.every(t => t.purchased);
      trophyListHTML = `<div style="font-size:12px; color:#888; font-style:italic; padding:4px 0;">${allBought ? '\u{2605} All 15 lifestyle trophies acquired! Complete mastery.' : 'Advance to higher business stages to unlock more lifestyle trophies.'}</div>`;
    } else {
      trophyListHTML = availableTrophies.map(t => `
        <div class="card">
          <div class="stat">
            <strong>${t.emoji} ${t.name}</strong>
            <span class="category-badge category-${t.category}">${catLabels[t.category]}</span>
          </div>
          <div style="font-size:12px; color:#ccc; margin:4px 0;">${t.desc}</div>
          <div style="font-size:12px; color:#4ade80; margin-bottom:6px;">\u{2605} ${t.perkDesc}</div>
          <button type="button" data-dad="trophy" data-id="${t.id}" ${s.cash.lt(t.costCash) ? 'disabled' : ''} style="width:100%; font-weight:bold; background:#2c2413; border-color:#ffd700; color:#ffd700;">
            Buy Trophy ($${t.costCash.toLocaleString()})
          </button>
        </div>
      `).join('');
    }
    setHTMLIfChanged(trophyList, trophyListHTML);
  }

  const logHTML = s.logs.map(l => `<div>${l}</div>`).join('');
  setHTMLIfChanged(document.getElementById('log-box'), logHTML);
}

// The panel's buttons (one listener for all of them; the panel is redrawn often).
export function initDadPanel(getEngine) {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dad]');
    if (!btn || btn.disabled) return;
    const engine = getEngine();
    const id = btn.dataset.id;
    if (btn.dataset.dad === 'hire') engine.hireFranchiseStand(id);
    else if (btn.dataset.dad === 'sign') engine.signWholesaleAccount(id);
    else if (btn.dataset.dad === 'project') engine.buyProject(id);
    else if (btn.dataset.dad === 'trophy') engine.buyTrophy(id);
  });
}
