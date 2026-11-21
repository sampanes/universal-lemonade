import { dayBeats } from './dayScene';
import { drawCustomer, type Customer } from './customerArt';
import { skyCondition, temperatureBand } from './forecastArt';
import { preloadImages } from '../preload';
import type { DaySummary } from '../types';
import './dayScene.css';

// house: the kid's own stand stands in front of the family house (its HTML, whose pictures are
// houseImages), with the house's driveway stand at standX (0 to 1 across the picture) under
// the booth.
interface LocationArt {
  name: string; host: string | null; sellerX: number; table: string; backdrop: string;
  house?: string | null; houseImages?: string[]; standX?: number;
}

const CLOUD = './sprites/morning_prep/cloud_puff.png';
const BEAT_MS = 1900;            // one visitor
const OPEN_WAIT_MS = 4000;       // the scene opens by then even if its first pictures are not in
const HOLD_MS = 3000;            // longest pause between visitors while something loads

// A customer being drawn ahead of time: canvas once painted, failed if the art never loaded.
interface PendingCustomer { customer: Customer | null; failed: boolean }
function startCustomer(): PendingCustomer {
  const job: PendingCustomer = { customer: null, failed: false };
  drawCustomer().then(c => { job.customer = c; }, error => {
    job.failed = true;
    console.warn('Customer art could not load', error);
  });
  return job;
}

// Nothing shows half loaded. Each stand's pictures are fetched before the scene shows that
// stand (one stand after another, in the order they come up, while the earlier ones play),
// and each customer is drawn on a canvas of its own while the one before walks. If something
// is still loading when its turn comes, the scene waits on the empty moment between visitors
// (the walker is off screen then) instead of showing a gap.
export async function playDayScene(summary: DaySummary, location: (id: string) => LocationArt): Promise<void> {
  const beats = dayBeats(summary.standVisits, summary.friends);
  if (!beats.length) return;
  const sky = skyCondition(summary.weather, summary.tempF);
  const arts = new Map<string, LocationArt>();
  for (const beat of beats) if (!arts.has(beat.stand)) arts.set(beat.stand, location(beat.stand));
  const ready = new Set<string>();
  let loading: Promise<void> = Promise.resolve();
  let firstLoaded: Promise<void> | null = null;
  for (const [id, art] of arts) {
    const pictures = [art.host, art.table, ...(art.house ? art.houseImages ?? [] : [art.backdrop])];
    if (sky !== 'SUNNY') pictures.push(CLOUD);
    loading = loading.then(() => preloadImages(pictures, Infinity, 'high')).then(() => { ready.add(id); });
    firstLoaded ??= loading;
  }
  let upcoming = startCustomer();
  // Open once the first stand is ready (its first customer can arrive a moment later: the
  // walker waits off screen).
  await Promise.race([firstLoaded, new Promise(resolve => setTimeout(resolve, OPEN_WAIT_MS))]);

  const dialog = document.createElement('dialog');
  dialog.className = 'day-scene';
  dialog.setAttribute('aria-labelledby', 'scene-title');
  dialog.innerHTML = `<header><span>Day ${summary.day}</span><strong id="scene-title"></strong></header>
    <div class="scene-stage"><img class="scene-backdrop" alt="">
    <div class="scene-clouds" aria-hidden="true"></div>
    <div class="scene-house" hidden></div>
    <img class="scene-host" alt="">
    <div class="scene-booth"><img class="scene-table" alt=""><strong class="scene-sold-out"></strong></div>
    <div class="scene-precipitation" aria-hidden="true"></div>
    <div class="scene-walker"><div class="scene-person"></div><span class="scene-bubble"></span></div>
    <strong class="scene-sign"></strong></div>
    <footer><button type="button" data-speed aria-pressed="false">Fast forward</button><button type="button" data-skip>Skip</button></footer>`;
  const find = <T extends Element>(selector: string) => dialog.querySelector<T>(selector)!;
  const title = find<HTMLElement>('strong');
  const backdrop = find<HTMLImageElement>('.scene-backdrop');
  const house = find<HTMLElement>('.scene-house');
  const host = find<HTMLImageElement>('.scene-host');
  const booth = find<HTMLElement>('.scene-booth');
  const soldOut = find<HTMLElement>('.scene-sold-out');
  const table = find<HTMLImageElement>('.scene-table');
  const walker = find<HTMLElement>('.scene-walker');
  const person = find<HTMLElement>('.scene-person');
  const bubble = find<HTMLElement>('.scene-bubble');
  const sign = find<HTMLElement>('.scene-sign');
  const speed = find<HTMLButtonElement>('[data-speed]');
  dialog.dataset.weather = sky;
  dialog.dataset.heat = temperatureBand(summary.tempF);
  if (sky !== 'SUNNY') {
    const clouds = find<HTMLElement>('.scene-clouds');
    const count = sky === 'CLOUDY' ? 5 : 2;
    for (let i = 0; i < count; i++) {
      const puff = new Image();
      puff.alt = '';
      puff.src = CLOUD;
      clouds.append(puff);
    }
  }
  if (sky === 'RAINY' || sky === 'SNOWY') {
    const layer = find<HTMLElement>('.scene-precipitation');
    const count = sky === 'SNOWY' ? 24 : 32;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('i');
      // Stagger position, speed and phase so the first frame is already mid-storm.
      const duration = (sky === 'SNOWY' ? 4 : 0.7) * (1 + (i * 7 % 11) / 20);
      particle.style.left = `${(i + 0.5) * 100 / count}%`;
      particle.style.animationDuration = `${duration}s`;
      particle.style.animationDelay = `${-duration * ((i * 19 + 5) % count) / count}s`;
      layer.append(particle);
    }
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let rate = 1;
  let index = 0;
  let stopX = 0;
  const price = summary.reviews.find(r => r.topic === 'price');
  const buyerLines = summary.reviews
    .filter(r => r.topic === 'taste' || r.topic === 'ice' || (r.topic === 'price' && r.sentiment === 'positive'))
    .map(r => r.bubble).filter((line): line is string => !!line);
  let buyer = 0, disappointed = 0;
  const item = summary.soldOutItem;
  const missedLines = [item ? `Out of ${item}!` : 'All gone!', 'Aw, I missed it!', 'None left?', 'Maybe tomorrow!'];
  let current: PendingCustomer | null = null;   // this beat's customer (null: nobody walks)
  let dressed = false;                           // its canvas is on the walker
  function showBeat() {
    const { stand, visit } = beats[index];
    const art = arts.get(stand)!;
    dialog.style.setProperty('--seller-x', art.sellerX + '%');
    // The walker is positioned by its left edge. Queue on the open side of the counter.
    const leftQueueOffset = visit === 'short' ? 37 : 30; // Leave the table sign visible.
    stopX = art.sellerX > 50 ? art.sellerX - leftQueueOffset : art.sellerX + 14;
    title.textContent = art.name;
    host.hidden = visit === 'closed' || !art.host;
    if (art.host) host.src = art.host;
    house.hidden = !art.house;
    backdrop.hidden = !!art.house;
    if (art.house) {
      if (house.dataset.html !== art.house) { house.innerHTML = art.house; house.dataset.html = art.house; }
      dialog.style.setProperty('--stand-x', String(art.standX ?? 0.5));
    } else {
      backdrop.src = art.backdrop;
    }
    booth.dataset.stand = stand;
    table.src = art.table;
    soldOut.textContent = visit === 'short' ? 'Sold out!' : '';
    walker.hidden = visit === 'quiet' || visit === 'closed';
    sign.textContent = visit === 'closed' ? 'Closed today' : visit === 'quiet' ? 'Quiet today' : '';
    current = null;
    if (walker.hidden) return;
    walker.style.height = (41 + Math.random() * 12) + '%';
    // This customer was drawn while the last one walked; start drawing the next one now.
    current = upcoming;
    upcoming = startCustomer();
    dressed = false;
    dress();
    person.classList.toggle('disappointed', visit === 'short');
    if (visit === 'sale') bubble.textContent = buyerLines.length ? buyerLines[buyer++ % buyerLines.length] : 'One cup, please!';
    if (visit === 'short') bubble.textContent = missedLines[disappointed++ % missedLines.length];
    if (visit === 'walk') bubble.textContent = price && price.sentiment !== 'positive' ? price.bubble || 'Too pricey!' : '';
    bubble.classList.toggle('sad', visit === 'short');
  }
  // Put the customer's canvas on the walker once it is painted (true when there is nothing to
  // wait for). The walker stays invisible until then.
  function dress(): boolean {
    if (!current || dressed) return true;
    if (current.customer) {
      person.replaceChildren(current.customer.canvas);
      person.classList.toggle('rolling', current.customer.seated);
    }
    dressed = !!current.customer || current.failed;
    walker.style.visibility = dressed ? '' : 'hidden';
    return dressed;
  }
  document.body.append(dialog);
  dialog.showModal();
  showBeat();
  return new Promise(resolve => {
    let frame = 0, elapsed = 0, last = performance.now();
    function finish() {
      cancelAnimationFrame(frame);
      dialog.close();
      dialog.remove();
      resolve();
    }
    speed.onclick = () => {
      rate = rate === 1 ? 3 : 1;
      speed.setAttribute('aria-pressed', String(rate === 3));
      speed.textContent = rate === 3 ? '3x speed' : 'Fast forward';
    };
    find<HTMLButtonElement>('[data-skip]').onclick = finish;
    dialog.oncancel = e => { e.preventDefault(); finish(); };
    let held = 0;   // ms spent waiting for pictures at this switch
    function tick(now: number) {
      const step = (now - last) * rate;
      last = now;
      // Hold before a customer walks in until they are drawn (the walker is off screen).
      if (elapsed === 0 && !dress() && held < HOLD_MS) held += step;
      else elapsed += step;
      if (elapsed >= BEAT_MS) {
        const next = beats[index + 1];
        // Hold before a new stand until its pictures are in (the walker has left).
        if (next && next.stand !== beats[index].stand && !ready.has(next.stand) && held < HOLD_MS) {
          held += step;
          elapsed = BEAT_MS;
        } else {
          if (++index === beats.length) { finish(); return; }
          elapsed = 0;
          held = 0;
          showBeat();
        }
      }
      const t = Math.min(1, elapsed / BEAT_MS);
      const atCounter = t >= 0.26 && t <= 0.76;
      const passing = beats[index].visit === 'walk';
      const walking = passing || !atCounter;
      let x = stopX;
      if (passing) x = -32 + 148 * t;
      else if (t < 0.26) x = -32 + (stopX + 32) * t / 0.26;
      else if (t > 0.76) x = stopX + (116 - stopX) * (t - 0.76) / 0.24;
      walker.style.left = (reduced ? stopX : x) + '%';
      person.style.transform = !reduced && walking && !person.classList.contains('rolling') ? `translateY(${-Math.abs(Math.sin(t * 24)) * 4}px)` : '';
      bubble.style.visibility = reduced || atCounter ? 'visible' : 'hidden';
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  });
}
