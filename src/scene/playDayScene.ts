import { dayBeats } from './dayScene';
import { dressCustomer } from './customerArt';
import type { DaySummary } from '../types';
import './dayScene.css';

interface LocationArt { name: string; host: string | null; table: string }

export function playDayScene(summary: DaySummary, location: (id: string) => LocationArt): Promise<void> {
  const beats = dayBeats(summary.standVisits ?? []);
  if (!beats.length) return Promise.resolve();
  const dialog = document.createElement('dialog');
  dialog.className = 'day-scene';
  dialog.setAttribute('aria-labelledby', 'scene-title');
  dialog.innerHTML = `<header><span>Day ${summary.day}</span><strong id="scene-title"></strong></header>
    <div class="scene-stage"><div class="scene-cloud"></div><div class="scene-hill"></div>
    <img class="scene-host" alt=""><img class="scene-table" alt="">
    <div class="scene-walker"><div class="scene-person"></div><span class="scene-bubble"></span></div>
    <strong class="scene-sign"></strong></div>
    <footer><button type="button" data-speed aria-pressed="false">Fast forward</button><button type="button" data-skip>Skip</button></footer>`;
  const find = <T extends Element>(selector: string) => dialog.querySelector<T>(selector)!;
  const title = find<HTMLElement>('strong');
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
  function showBeat() {
    const { stand, visit } = beats[index];
    const art = location(stand);
    title.textContent = art.name;
    host.hidden = !art.host;
    if (art.host) host.src = art.host;
    table.src = art.table;
    walker.hidden = visit === 'quiet';
    sign.textContent = visit === 'quiet' ? 'Quiet today' : visit === 'short' ? 'Sold out!' : '';
    dressCustomer(person);
    person.classList.toggle('disappointed', visit === 'short');
    const sales = summary.recipeQuality >= 0.8 ? ['Yum!', 'So good!', 'Love it!'] : ['One cup, please!', 'Thank you!'];
    const lines = visit === 'sale' ? sales : visit === 'short' ? ['Aw, sold out!', 'Aw, I missed it!'] : ['Maybe later!', 'Just looking!'];
    bubble.textContent = lines[Math.floor(Math.random() * lines.length)];
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
      speed.textContent = rate === 3 ? '3Ã— speed' : 'Fast forward';
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
