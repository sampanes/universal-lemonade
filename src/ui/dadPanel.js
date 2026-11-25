// src/ui/dadPanel.js -- Dad Mode's business panels.
import { setHTMLIfChanged, STORE_LOCK } from './dom.js';

// Dad Mode's third column and the stage sections under the pantry: every business detail
// (hiring, store contracts, the squeezer, the factory, the Stand Shop in any order, the log).
// Hidden in kid mode, so it is only drawn while Dad Mode is on.
// storeWait(): why the next store purchase is not open yet ('' when it is).
export function renderDadPanel(engine, storeWait) {
  const s = engine.state;
  // One section per stage reached: friends' stands, stores, the squeezer, the factory.
  let expansionHTML = '';

  if (s.phase >= 2) {
    expansionHTML += `<div style="font-weight: bold; margin-top: 12px; color: #ffd700;">Friends' stands:</div>`;
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
    expansionHTML += `<div style="font-weight: bold; margin-top: 12px; color: #ffd700;">Stores:</div>`;
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
        <strong style="color: #ffd700;">Lemon Squeezer</strong>
        <span class="badge">LEVEL ${engine.patent.level}</span>
      </div>
      <div class="stat">
        <span>Each sold: <strong>$${engine.patent.royaltyPerUnit.toFixed(2)}</strong></span>
        <span>About ${engine.patent.baseUnitsPerDay.toLocaleString('en-US')} a day</span>
      </div>
    </div>`;
  }

  if (s.phase >= 5 && engine.copacker.active) {
    expansionHTML += `<div class="card" style="border-color: #4ade80;">
      <div class="stat">
        <strong style="color: #4ade80;">Lemonade Factory</strong>
        <span class="badge">x${engine.flavorMult().toFixed(1)} FLAVORS</span>
      </div>
      <div class="stat">
        <span>About <strong>${engine.copacker.casesPerDay.toLocaleString('en-US')} cases</strong> a day</span>
        <span>Each case: <strong>+$${engine.copacker.netPerCase.toFixed(2)}</strong></span>
      </div>
    </div>`;
  }

  setHTMLIfChanged(document.getElementById('expansion-sections'), expansionHTML);

  // Everything the Stand Shop sells that is open now, in any order (the kid's shop offers one
  // at a time; src/ui/kidShop.js). The big dreams are here in Stage 5, to test the ending.
  const projectHTML = engine.projects
    .filter(p => !p.purchased && p.unlocked(s))
    .map(p => `<div class="card">
      <div style="font-weight:bold; color:#ffd700;">${p.name}</div>
      <div style="font-size:12px; color:#ccc; margin: 4px 0;">${p.desc}</div>
      <button type="button" data-dad="project" data-id="${p.id}" ${s.cash.lt(p.costCash) ? 'disabled' : ''} style="width:100%; margin-top:4px; font-weight:bold; background:#2e442e; border-color:#4ade80;">
        Buy ($${p.costCash.toLocaleString('en-US')})
      </button>
    </div>`).join('');
  setHTMLIfChanged(document.getElementById('project-list'), projectHTML);

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
  });
}
