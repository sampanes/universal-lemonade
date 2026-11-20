import { dayBeats } from './dayScene';
import { dressCustomer } from './customerArt';
import type { DaySummary } from '../types';
import './dayScene.css';

interface LocationArt { name: string; host: string | null; table: string; backdrop: string }

export function playDayScene(summary: DaySummary, location: (id: string) => LocationArt): Promise<void> {
  const beats = dayBeats(summary.standVisits ?? [], summary.friends);
  if (!beats.length) return Promise.resolve();
  const dialog = document.createElement('dialog');
  dialog.className = 'day-scene';
  dialog.setAttribute('aria-labelledby', 'scene-title');
  dialog.innerHTML = `<header><span>Day ${summary.day}</span><strong id="scene-title"></strong></header>
    <div class="scene-stage"><img class="scene-backdrop" alt="">
    <img class="scene-host" alt=""><img class="scene-table" alt="">
    <div class="scene-walker"><div class="scene-person"></div><span class="scene-bubble"></span></div>
    <strong class="scene-sign"></strong></div>
    <footer><button type="button" data-speed aria-pressed="false">Fast forward</button><button type="button" data-skip>Skip</button></footer>`;
  const find = <T extends Element>(selector: string) => dialog.querySelector<T>(selector)!;
  const title = find<HTMLElement>('strong');
  const backdrop = find<HTMLImageElement>('.scene-backdrop');
  const host = find<HTMLImageElement>('.scene-host');
  const table = find<HTMLImageElement>('.scene-table');
  const walker = find<HTMLElement>('.scene-walker');
  const person = find<HTMLElement>('.scene-person');
  const bubble = find<HTMLElement>('.scene-bubble');
  const sign = find<HTMLElement>('.scene-sign');
  const speed = find<HTMLButtonElement>('[data-speed]');
  dialog.dataset.weather = summary.weather;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let rate = 1;
  let index = 0;
  const price = summary.reviews.find(r => r.topic === 'price');
  const buyerLines = summary.reviews
    .filter(r => r.topic === 'taste' || r.topic === 'ice' || (r.topic === 'price' && r.sentiment === 'positive'))
    .map(r => r.bubble).filter((line): line is string => !!line);
  let buyer = 0, disappointed = 0;
  const item = summary.soldOutItem;
  const missedLines = [item ? `Out of ${item}!` : 'All gone!', 'Aw, I missed it!', 'None left?', 'Maybe tomorrow!'];
  function showBeat() {
    const { stand, visit } = beats[index];
    const art = location(stand);
    title.textContent = art.name;
    host.hidden = visit === 'closed' || !art.host;
    if (art.host) host.src = art.host;
    backdrop.src = art.backdrop;
    table.src = art.table;
    walker.hidden = visit === 'quiet' || visit === 'closed';
    sign.textContent = { closed: 'Closed today', quiet: 'Quiet today', short: 'Sold out!', walk: '', sale: '' }[visit];
    if (walker.hidden) return;
    dressCustomer(person);
    person.classList.toggle('disappointed', visit === 'short');
    if (visit === 'sale') bubble.textContent = buyerLines.length ? buyerLines[buyer++ % buyerLines.length] : 'One cup, please!';
    if (visit === 'short') bubble.textContent = missedLines[disappointed++ % missedLines.length];
    if (visit === 'walk') bubble.textContent = price && price.sentiment !== 'positive' ? price.bubble || 'Too pricey!' : '';
    bubble.classList.toggle('sad', visit === 'short');
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
    function tick(now: number) {
      elapsed += (now - last) * rate;
      last = now;
      if (elapsed >= 1900) {
        if (++index === beats.length) { finish(); return; }
        elapsed = 0;
        showBeat();
      }
      const t = elapsed / 1900;
      const walking = t < 0.26 || t > 0.76;
      const x = t < 0.26 ? -22 + 68 * t / 0.26 : 46 + 70 * Math.max(0, t - 0.76) / 0.24;
      walker.style.left = (reduced ? 46 : x) + '%';
      person.style.transform = !reduced && walking ? `translateY(${-Math.abs(Math.sin(t * 24)) * 4}px)` : '';
      bubble.style.visibility = reduced || !walking ? 'visible' : 'hidden';
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  });
}
