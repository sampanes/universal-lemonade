import { dayCrowds, type StandCrowd } from './dayScene';
import { copyCustomer, customersReady, freshenCustomers, pauseCustomers } from './customerArt';
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
const OPEN_WAIT_MS = 4000;     // the scene opens by then even if its first pictures are not in
const HOLD_MS = 3000;          // longest pause between stands while the next one's pictures load
const SIGN_MS = 1900;          // a closed stand, or one nobody came to
const STAND_MAX_MS = 15000;    // a stand always ends by then
const LOOKS = 8;               // customer looks wanted right away (drawn even while the scene plays)
const FIRST_LOOKS = 2;         // the scene opens once this many are drawn
const WALK = 0.075;            // walking speed, % of the stage width per ms
const GAP = 10.5;              // space between people in line, % of the stage width
const TALK_MS = 1300;          // how long words stay up
const POP_MS = 900;            // the "+3" over the counter

// What people say. Each buyer's line that teaches something (taste, ice, a good price) is said
// once a day, by every other buyer who speaks until they are all said (the Day Report has
// them too); the rest is chatter that fits the day.
function sceneLines(summary: DaySummary, sky: string) {
  const hot = summary.tempF >= 85, cold = summary.tempF < 60;
  const teach = summary.reviews
    .filter(r => r.topic === 'taste' || r.topic === 'ice' || (r.topic === 'price' && r.sentiment === 'positive'))
    .map(r => r.bubble).filter((line): line is string => !!line);
  const price = summary.reviews.find(r => r.topic === 'price');
  const gripe = price && price.sentiment !== 'positive' ? price.bubble || 'Too pricey!' : null;
  const buying = ['One cup, please!', 'Two, please!', 'Lemonade, please!', 'Ooh, lemonade!', 'Yum!',
    'My favorite!', 'One for my sister!', 'Thank you!', 'Smells so good!'];
  if (hot) buying.push('So thirsty!', 'Perfect for today!', 'Ahh, nice and cold!');
  else if (summary.tempF >= 75) buying.push('Just what I needed!');
  if (sky === 'RAINY') buying.push('Worth getting wet!');
  if (sky === 'SNOWY') buying.push('Brr! One, please!');
  else if (cold) buying.push('Still want one!');
  const passing = ['Maybe later!', 'Not thirsty.', 'Gotta go!', 'Late for soccer!', 'No money today.', 'Next time!'];
  if (sky === 'RAINY') passing.push('Too wet out!');
  if (sky === 'SNOWY' || cold) passing.push('Too cold for that!');
  const item = summary.soldOutItem;
  const missed = [item ? `Out of ${item}!` : 'All gone!', 'Aw, I missed it!', 'None left?', 'Maybe tomorrow!', 'Aww!'];
  return { teach, gripe, buying: deck(buying), passing: deck(passing), missed: deck(missed) };
}

// Draws lines in a shuffled order and reshuffles when they run out, so nothing repeats soon.
function deck(lines: string[]): () => string {
  let left: string[] = [];
  return () => {
    if (!left.length) left = [...lines].sort(() => Math.random() - 0.5);
    return left.pop()!;
  };
}

type Role = 'buy' | 'miss' | 'pass';
interface Walker {
  role: Role;
  el: HTMLElement; person: HTMLElement; canvas: HTMLCanvasElement | null; bubble: HTMLElement;
  seated: boolean;
  width: number;      // % of the stage width
  x: number;          // left edge, % of the stage width
  dir: number;        // 1 walks right, -1 walks left (drawn mirrored)
  speed: number;      // % of the stage width per ms
  share: number;      // the real people (cups, for a buyer) this one stands for
  state: 'coming' | 'served' | 'sad' | 'going';
  timer: number;
  talk: number;       // ms left on the speech bubble
  says: string;       // what a passer-by says on the way past (empty: nothing)
  stride: number;     // distance walked, for the bob
  still: boolean;     // standing in line
  drawn: string;      // last transform written
}

// The day at every stand: a line of buyers (longer on a busier day), people walking past,
// and, if the stand runs out, the rest of the line turning away. The counters under the scene
// add up the real numbers.
//
// Nothing shows half loaded: each stand's pictures are fetched before the scene shows that
// stand (one stand after another while the earlier ones play), and the customers are copies
// of looks drawn ahead of time (src/scene/customerArt.ts), so nobody waits on their art.
export async function playDayScene(summary: DaySummary, location: (id: string) => LocationArt): Promise<void> {
  const crowds = dayCrowds(summary.standVisits, summary.friends);
  if (!crowds.length) return;
  const sky = skyCondition(summary.weather, summary.tempF);
  const arts = new Map<string, LocationArt>();
  for (const crowd of crowds) if (!arts.has(crowd.stand)) arts.set(crowd.stand, location(crowd.stand));
  const ready = new Set<string>();
  let loading: Promise<void> = Promise.resolve();
  let firstLoaded: Promise<void> | null = null;
  for (const [id, art] of arts) {
    const pictures = [art.host, art.table, ...(art.house ? art.houseImages ?? [] : [art.backdrop])];
    if (sky !== 'SUNNY') pictures.push(CLOUD);
    loading = loading.then(() => preloadImages(pictures, Infinity, 'high')).then(() => { ready.add(id); });
    firstLoaded ??= loading;
  }
  void customersReady(LOOKS);
  await Promise.race([
    Promise.all([firstLoaded, customersReady(FIRST_LOOKS)]),
    new Promise(resolve => setTimeout(resolve, OPEN_WAIT_MS)),
  ]);
  pauseCustomers(true);

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
    <div class="scene-crowd" aria-hidden="true"></div>
    <strong class="scene-sign"></strong></div>
    <footer><div class="scene-tally"><span>People <b data-people>0</b></span><span>Cups sold <b data-cups>0</b></span></div>
    <div class="scene-buttons"><button type="button" data-speed aria-pressed="false">Fast forward</button><button type="button" data-skip>Skip</button></div></footer>`;
  const find = <T extends Element>(selector: string) => dialog.querySelector<T>(selector)!;
  const title = find<HTMLElement>('#scene-title');
  const stage = find<HTMLElement>('.scene-stage');
  const backdrop = find<HTMLImageElement>('.scene-backdrop');
  const house = find<HTMLElement>('.scene-house');
  const host = find<HTMLImageElement>('.scene-host');
  const booth = find<HTMLElement>('.scene-booth');
  const soldOutSign = find<HTMLElement>('.scene-sold-out');
  const table = find<HTMLImageElement>('.scene-table');
  const crowdLayer = find<HTMLElement>('.scene-crowd');
  const sign = find<HTMLElement>('.scene-sign');
  const tally = find<HTMLElement>('.scene-tally');
  const peopleCount = find<HTMLElement>('[data-people]');
  const cupsCount = find<HTMLElement>('[data-cups]');
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
  const lines = sceneLines(summary, sky);
  const friendNames = new Map(summary.friends.map(f => [f.id, f.workerName]));
  let taught = 0;                    // teaching lines said so far (each once a day)
  let nextLook = Math.floor(Math.random() * 16);
  let stageW = 540, stageH = 260;    // px, kept current by the observer below
  const sizes = new ResizeObserver(([entry]) => {
    stageW = entry.contentRect.width || stageW;
    stageH = entry.contentRect.height || stageH;
  });
  sizes.observe(stage);

  // The stand on screen.
  let index = 0;
  let crowd: StandCrowd = crowds[0];
  let plan: { at: number; role: Role; share: number }[] = [];
  let planned = 0;                   // people in plan already sent on stage
  let clock = 0;                     // ms since this stand came up
  let walkers: Walker[] = [];
  let line: Walker[] = [];           // buyers and sold-out customers, front first
  let front = 0;                     // where the first in line stands (% of the stage width)
  let inward = 1;                    // the way the line walks up to the counter
  let serveMs = 900;
  let served = 0;
  let soldOut = false;
  let sadOnes = 0;
  let buyerTalks = 0;
  let passerTalks = 0;
  let people = 0, cups = 0, shownPeople = 0, shownCups = 0;

  function showStand(next: StandCrowd) {
    crowd = next;
    const art = arts.get(crowd.stand)!;
    dialog.style.setProperty('--seller-x', art.sellerX + '%');
    title.textContent = art.name;
    host.hidden = crowd.closed || !art.host;
    if (art.host) host.src = art.host;
    house.hidden = !art.house;
    backdrop.hidden = !!art.house;
    if (art.house) {
      if (house.dataset.html !== art.house) { house.innerHTML = art.house; house.dataset.html = art.house; }
      dialog.style.setProperty('--stand-x', String(art.standX ?? 0.5));
    } else {
      backdrop.src = art.backdrop;
    }
    booth.dataset.stand = crowd.stand;
    table.src = art.table;
    // The line forms on the open side of the counter and walks up to it from that edge.
    const nb = crowd.buyers.length, nm = crowd.missed.length, np = crowd.passers.length;
    inward = art.sellerX > 50 ? 1 : -1;
    front = inward > 0 ? art.sellerX - (nm ? 37 : 30) : art.sellerX + 14;   // 37: the sold-out sign stays visible
    // A long line is served faster and fills up faster.
    serveMs = Math.min(950, Math.max(420, 1100 - 90 * nb));
    const every = serveMs * Math.max(0.45, 1.3 - 0.12 * nb);
    const busy = Math.max(1600, 900 + nb * serveMs);
    plan = [
      ...crowd.buyers.map((share, i) => ({ at: i * every, role: 'buy' as Role, share })),
      ...crowd.missed.map((share, i) => ({ at: (nb + i) * every, role: 'miss' as Role, share })),
      ...crowd.passers.map((share, i) => ({ at: busy * (i + 0.15 + 0.7 * Math.random()) / np, role: 'pass' as Role, share })),
    ].sort((a, b) => a.at - b.at);
    planned = 0;
    clock = 0;
    walkers = [];
    line = [];
    served = 0;
    soldOut = nb === 0 && nm > 0;
    soldOutSign.textContent = soldOut ? 'Sold out!' : '';
    sadOnes = buyerTalks = passerTalks = 0;
    people = cups = shownPeople = shownCups = 0;
    peopleCount.textContent = cupsCount.textContent = '0';
    tally.classList.toggle('off', crowd.closed);
    sign.textContent = crowd.closed ? 'Closed today' : !(nb + nm + np) ? 'Quiet today' : !(nb + nm) ? 'No sales today' : '';
  }

  function arrive({ role, share }: { role: Role; share: number }) {
    const el = document.createElement('div');
    el.className = 'scene-walker';
    const person = document.createElement('div');
    person.className = 'scene-person';
    const bubble = document.createElement('span');
    bubble.className = 'scene-bubble';
    el.append(person, bubble);
    const look = copyCustomer(nextLook++);
    if (look) person.append(look.canvas);
    else el.style.visibility = 'hidden';   // no art at all (it failed to load): counted, not drawn
    // Passers-by walk a step farther back, so the line stands in front of them.
    const passing = role === 'pass';
    const height = passing ? 37 + Math.random() * 8 : 42 + Math.random() * 10;
    el.style.height = height + '%';
    el.style.bottom = passing ? '6%' : '1%';
    el.style.zIndex = passing ? '1' : '2';
    const width = height * stageH * 0.8 / stageW;
    const dir = passing ? (Math.random() < 0.5 ? 1 : -1) : inward;
    let says = '';
    if (passing) {
      // The first one to speak at each stand complains about a high price; after that some
      // of them say something.
      if (lines.gripe && (!passerTalks || Math.random() < 0.3)) says = lines.gripe;
      else if (Math.random() < 0.4) says = lines.passing();
      if (says) passerTalks++;
    }
    const walker: Walker = {
      role, el, person, bubble, canvas: look?.canvas ?? null, seated: !!look?.seated,
      width, x: dir > 0 ? -width - 1 : 101, dir,
      // Everyone in line walks at one speed (nobody overtakes on the way to the line).
      speed: passing ? WALK * (0.85 + Math.random() * 0.3) : WALK,
      share, state: passing ? 'going' : 'coming', timer: 0, talk: 0, says,
      stride: Math.random() * 20, still: false, drawn: '',
    };
    face(walker, dir);
    crowdLayer.append(el);
    walkers.push(walker);
    if (!passing) line.push(walker);
    people += share;
  }

  function face(w: Walker, dir: number) {
    w.dir = dir;
    if (w.canvas) w.canvas.style.transform = dir < 0 ? 'scaleX(-1)' : '';
  }

  // Up to two speech bubbles at once, never on top of each other.
  function say(w: Walker, text: string, sad = false): boolean {
    if (!text || walkers.filter(o => o.talk > 0).length >= 2) return false;
    if (walkers.some(o => o !== w && o.talk > 0 && Math.abs(o.x - w.x) < 24)) return false;
    w.bubble.textContent = text;
    w.bubble.classList.toggle('sad', sad);
    w.talk = TALK_MS;
    return true;
  }

  function serve(w: Walker) {
    w.state = 'served';
    w.timer = serveMs;
    if (buyerTalks > 0 && Math.random() < 0.4) return;
    const name = friendNames.get(crowd.stand);
    const teaching = buyerTalks % 2 === 0 && taught < lines.teach.length;
    const text = teaching ? lines.teach[taught] : buyerTalks === 1 && name ? `Hi, ${name}!` : lines.buying();
    if (say(w, text)) {
      if (teaching) taught++;
      buyerTalks++;
    }
  }

  function pop(text: string) {
    const el = document.createElement('b');
    el.className = 'scene-pop';
    el.textContent = text;
    crowdLayer.append(el);
    setTimeout(() => el.remove(), POP_MS);
  }

  function move(w: Walker, dx: number) {
    w.x += dx;
    w.stride += Math.abs(dx);
  }

  function update(dt: number) {
    clock += dt;
    while (planned < plan.length && plan[planned].at <= clock) arrive(plan[planned++]);
    for (let k = 0; k < line.length; k++) {
      const w = line[k];
      if (w.state !== 'coming') continue;
      const spot = front - inward * GAP * k;
      const gap = spot - w.x;
      w.still = Math.abs(gap) <= w.speed * dt;
      if (!w.still) { move(w, Math.sign(gap) * w.speed * dt); continue; }
      move(w, gap);
      w.x = spot;
      if (w.role === 'miss' && soldOut) {
        w.state = 'sad';
        w.timer = 450 + 200 * sadOnes++;
        w.person.classList.add('disappointed');
        if (sadOnes === 1 || Math.random() < 0.5) say(w, lines.missed(), true);
      } else if (w.role === 'buy' && k === 0) {
        serve(w);
      }
    }
    for (const w of walkers) {
      if (w.talk > 0 && (w.talk -= dt) <= 0) w.bubble.textContent = '';
      if (w.state === 'served' || w.state === 'sad') {
        if ((w.timer -= dt) > 0) continue;
        line.splice(line.indexOf(w), 1);
        if (w.state === 'served') {
          cups += w.share;
          pop('+' + w.share.toLocaleString('en-US'));
          if (++served === crowd.buyers.length && crowd.missed.length) {
            soldOut = true;
            soldOutSign.textContent = 'Sold out!';
          }
          face(w, inward);
        } else {
          face(w, -inward);
        }
        w.state = 'going';
      } else if (w.state === 'going') {
        move(w, w.dir * w.speed * dt);
        if (w.says && w.x > 18 && w.x < 62 && say(w, w.says)) w.says = '';
      }
    }
    // Gone off the edge.
    walkers = walkers.filter(w => {
      const gone = w.state === 'going' && (w.x > 101 || w.x < -w.width - 1);
      if (gone) w.el.remove();
      return !gone;
    });
  }

  function draw(dt: number) {
    for (const w of walkers) {
      const walking = w.state === 'going' || (w.state === 'coming' && !w.still);
      const bob = walking && !w.seated && !reduced ? -Math.abs(Math.sin(w.stride * 0.16)) * 4 : 0;
      const transform = `translate3d(${(w.x * stageW / 100).toFixed(1)}px,${bob.toFixed(1)}px,0)`;
      if (transform !== w.drawn) { w.el.style.transform = transform; w.drawn = transform; }
    }
    // The counters roll up to the real numbers.
    const roll = (shown: number, real: number) => shown + Math.ceil((real - shown) * Math.min(1, dt / 160));
    const nextPeople = roll(shownPeople, people), nextCups = roll(shownCups, cups);
    if (nextPeople !== shownPeople) peopleCount.textContent = (shownPeople = nextPeople).toLocaleString('en-US');
    if (nextCups !== shownCups) cupsCount.textContent = (shownCups = nextCups).toLocaleString('en-US');
  }

  function standOver(): boolean {
    if (clock >= STAND_MAX_MS) {
      for (const w of walkers) w.el.remove();
      walkers = [];
      line = [];
      people = shownPeople = crowd.closed ? 0 : people + plan.slice(planned).reduce((n, p) => n + p.share, 0);
      cups = shownCups = crowd.buyers.reduce((n, c) => n + c, 0);
      peopleCount.textContent = people.toLocaleString('en-US');
      cupsCount.textContent = cups.toLocaleString('en-US');
      return true;
    }
    const empty = !plan.length;
    return planned === plan.length && !walkers.length && shownPeople === people && shownCups === cups && (!empty || clock >= SIGN_MS);
  }

  document.body.append(dialog);
  dialog.showModal();
  stageW = stage.clientWidth || stageW;
  stageH = stage.clientHeight || stageH;
  showStand(crowds[0]);
  return new Promise(resolve => {
    let frame = 0, last = performance.now(), held = 0, rate = 1;
    function finish() {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      dialog.close();
      dialog.remove();
      pauseCustomers(false);
      freshenCustomers(4);   // a few new faces for tomorrow
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
      // A long frame (a hidden tab) never jumps anyone across the stage.
      const dt = Math.min(100, now - last) * rate;
      last = now;
      if (standOver()) {
        const next = crowds[index + 1];
        if (!next) { finish(); return; }
        // Hold on the empty stage until the next stand's pictures are in.
        if (!ready.has(next.stand) && held < HOLD_MS) held += dt;
        else {
          index++;
          held = 0;
          showStand(next);
        }
      } else {
        update(dt);
      }
      draw(dt);
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  });
}
