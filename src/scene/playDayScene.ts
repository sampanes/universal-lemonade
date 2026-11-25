import { dayCrowds, type StandCrowd } from './dayScene';
import { copyCustomer, customersReady, freshenCustomers, pauseCustomers } from './customerArt';
import { skyCondition, temperatureBand } from './forecastArt';
import { preloadImages, whenIdle } from '../preload';
import type { DaySummary, WeatherCondition } from '../types';
import './dayScene.css';

// What is behind a stand: a friend's neighborhood (backdrop, its sky cut out), or for the
// kid's own stand the family house (its HTML, whose pictures are houseImages), with the
// house's driveway stand at standX (0 to 1 across the picture) under the booth.
interface LocationArt {
  name: string; host: string | null; sellerX: number; table: string;
  backdrop?: string; house?: string; houseImages?: string[]; standX?: number;
}

// The clouds drift across the sky behind the backdrop and the house: a few on a sunny day, a
// sky full on a gray one. Every other one is farther away (smaller, lower and slower).
const CLOUD = './sprites/morning_prep/cloud_puff.png';
const CLOUDS: Record<ReturnType<typeof skyCondition>, number> = { SUNNY: 3, CLOUDY: 9, RAINY: 10, SNOWY: 8 };
const CLOUD_S = 90;            // seconds for a near cloud to cross the sky
const FAR_CLOUD_S = 150;       // ...and a far one
const NEAR_CLOUDS = [[15, 1], [18, 9], [13, 4], [17, 13], [14, 0]];      // [width, top], % of the stage
const FAR_CLOUDS = [[10, 21], [8, 15], [11, 25], [9, 18], [10, 23]];
const OPEN_WAIT_MS = 4000;     // the scene opens by then even if its first pictures are not in
const HOLD_MS = 3000;          // longest pause between stands while the next one's pictures load
const SIGN_MS = 1900;          // a closed stand, or one nobody came to
const STAND_MAX_MS = 15000;    // a stand always ends by then
const LOOKS = 8;               // customer looks wanted right away (drawn even while the scene plays)
const FIRST_LOOKS = 2;         // the scene opens once this many are drawn
const WALK = 0.075;            // walking speed, % of the stage width per ms
const GAP = 10.5;              // space between people in line, % of the stage width
const TALK_MS = 1300;          // how long a passer-by's words stay up
const READ_MS = 950;           // someone at the counter who talks stands there at least this long
const TALK_PACE = 0.1;         // a passer-by slows to this share of their speed while talking
const SLOW_MS = 220;           // ...and takes about this long to slow down before the words show
const POP_MS = 900;            // the "+3" over the counter
const REHEARSAL_MS = 3000;     // scene time the rehearsal plays (at triple speed: about a second)

// What people say. Each buyer's line that teaches something (taste, ice, a good price) is said
// once a day, by every other buyer who speaks until they are all said (the Day Report has
// them too); the rest is chatter that fits the day.
function sceneLines(summary: Pick<DaySummary, 'tempF' | 'reviews' | 'soldOutItem'>, sky: string) {
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
  pace: number;       // share of that speed right now (a passer-by slows down to talk)
  share: number;      // the real people (cups, for a buyer) this one stands for
  state: 'coming' | 'served' | 'sad' | 'going';
  timer: number;
  talk: number;       // ms left on the speech bubble
  says: string;       // what a passer-by says on the way past (empty: nothing)
  measured: string;   // the words in the bubble (hidden unless talking)...
  half: number;       // ...and half their width, % of the stage width
  lo: number; hi: number;   // the stretch of stage the words cover while up, % of the stage width
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
export function playDayScene(summary: DaySummary, location: (id: string) => LocationArt): Promise<void> {
  scenePlayed = true;
  endRehearsal?.();
  return runScene(summary, location, false);
}

// The first day scene on a page used to freeze for a moment just after it opened (about a
// tenth of a second, and over half a second the first time a computer ever showed it): the
// browser was getting ready to draw it. Later scenes never did. So once the page is idle, a
// short made-up day at the kid's stand plays at triple speed, all but invisible (1% opacity,
// and clicks go through it), and the first real day starts as smoothly as the rest.
let scenePlayed = false;
let rehearsed = false;
let endRehearsal: (() => void) | null = null;
export function rehearseDayScene(weather: WeatherCondition, tempF: number, location: (id: string) => LocationArt): void {
  if (rehearsed || scenePlayed) return;
  rehearsed = true;
  const standVisits = [{ id: 'driveway', traffic: 12, wanted: 6, sold: 4 }];   // 2 buyers, a sold-out customer, 2 passers-by
  void runScene({ day: 0, weather, tempF, standVisits, friends: [], reviews: [] }, location, true);
}

type SceneDay = Pick<DaySummary, 'day' | 'weather' | 'tempF' | 'standVisits' | 'friends' | 'reviews' | 'soldOutItem'>;

async function runScene(summary: SceneDay, location: (id: string) => LocationArt, rehearsal: boolean): Promise<void> {
  let stopped = false;
  if (rehearsal) endRehearsal = () => { stopped = true; };
  const crowds = dayCrowds(summary.standVisits, summary.friends);
  if (!crowds.length) return;
  const sky = skyCondition(summary.weather, summary.tempF);
  const arts = new Map<string, LocationArt>();
  for (const crowd of crowds) if (!arts.has(crowd.stand)) arts.set(crowd.stand, location(crowd.stand));
  const ready = new Set<string>();
  let loading: Promise<void> = Promise.resolve();
  let firstLoaded: Promise<void> | null = null;
  for (const [id, art] of arts) {
    const pictures = [art.host, art.table, art.backdrop, ...(art.houseImages ?? []), CLOUD];
    loading = loading.then(() => preloadImages(pictures, Infinity, 'high')).then(() => { ready.add(id); });
    firstLoaded ??= loading;
  }
  if (rehearsal) {
    await Promise.all([firstLoaded, customersReady(FIRST_LOOKS)]);
    await new Promise<void>(resolve => whenIdle(resolve));
    if (stopped) return;
  } else {
    void customersReady(LOOKS);
    await Promise.race([
      Promise.all([firstLoaded, customersReady(FIRST_LOOKS)]),
      new Promise(resolve => setTimeout(resolve, OPEN_WAIT_MS)),
    ]);
    pauseCustomers(true);
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'day-scene';
  dialog.setAttribute('aria-labelledby', 'scene-title');
  dialog.innerHTML = `<header><span>Day ${summary.day}</span><strong id="scene-title"></strong></header>
    <div class="scene-stage"><div class="scene-clouds" aria-hidden="true"></div>
    <img class="scene-backdrop" alt="" hidden>
    <div class="scene-house" hidden></div>
    <img class="scene-host" alt="">
    <div class="scene-booth"><img class="scene-table" alt=""><strong class="scene-sold-out"></strong></div>
    <div class="scene-precipitation" aria-hidden="true"></div>
    <div class="scene-crowd" aria-hidden="true"></div>
    <strong class="scene-sign"></strong></div>
    <footer><dl class="scene-tally"><dt>People</dt><dd data-people>0</dd><dt>Cups sold</dt><dd data-cups>0</dd></dl>
    <div class="scene-buttons"><button type="button" class="scene-speed" data-speed aria-pressed="false"><span>Fast forward</span><span>3x speed</span></button><button type="button" data-skip>Skip</button></div></footer>`;
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
  // Each cloud starts partway across (spread evenly), so the sky is already full, and some
  // face the other way.
  const clouds = find<HTMLElement>('.scene-clouds');
  const cloudCount = CLOUDS[sky];
  for (let i = 0; i < cloudCount; i++) {
    const far = i % 2 === 1;
    const crossing = far ? FAR_CLOUD_S : CLOUD_S;
    const [width, top] = (far ? FAR_CLOUDS : NEAR_CLOUDS)[(i >> 1) % NEAR_CLOUDS.length];
    const drift = document.createElement('span');
    drift.style.setProperty('--w', `${width}%`);
    drift.style.setProperty('--y', `${top}%`);
    drift.style.animationDuration = `${crossing}s`;
    drift.style.animationDelay = `${-crossing * i / cloudCount}s`;
    const puff = new Image();
    puff.alt = '';
    puff.src = CLOUD;
    puff.classList.toggle('flip', i % 3 === 1);
    drift.append(puff);
    clouds.append(drift);
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
    backdrop.hidden = !art.backdrop;
    if (art.backdrop) backdrop.src = art.backdrop;
    house.hidden = !art.house;
    if (art.house) {
      if (house.dataset.html !== art.house) { house.innerHTML = art.house; house.dataset.html = art.house; }
      dialog.style.setProperty('--stand-x', String(art.standX ?? 0.5));
    }
    stage.classList.toggle('sky-only', !!art.backdrop);
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
    bubble.className = 'scene-bubble wait';
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
      speed: passing ? WALK * (0.85 + Math.random() * 0.3) : WALK, pace: 1,
      share, state: passing ? 'going' : 'coming', timer: 0, talk: 0, says, measured: '', half: 0, lo: 0, hi: 0,
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

  // Up to two speech bubbles at once, never on top of each other and never cut off at the
  // stage's edges. Words never fly off with anyone: people in line stand still while they talk
  // and stop when they walk off, and a passer-by slows to a stroll before the words show, so a
  // bubble only has to keep clear of the short stretch its speaker strolls through.
  function say(w: Walker, text: string, ms: number, sad = false): boolean {
    if (!text || walkers.filter(o => o.talk > 0).length >= 2) return false;
    if (w.measured !== text) {
      // Measured while hidden, once per line (a passer-by may wait a while for room).
      w.bubble.textContent = w.measured = text;
      w.half = w.bubble.offsetWidth * 50 / stageW;
    }
    const walking = w.state === 'going';
    const center = w.x + w.width / 2;
    const stroll = walking ? w.speed * (SLOW_MS / 2 + TALK_PACE * ms) : 0;
    const lo = center - w.half - (w.dir < 0 ? stroll : 0) - 1;
    const hi = center + w.half + (w.dir > 0 ? stroll : 0) + 1;
    if (lo < 0 || hi > 100 || walkers.some(o => o !== w && o.talk > 0 && lo < o.hi && o.lo < hi)) return false;
    w.lo = lo;
    w.hi = hi;
    w.bubble.classList.toggle('sad', sad);
    w.talk = walking ? SLOW_MS + ms : ms;
    if (!walking) w.bubble.classList.remove('wait');
    return true;
  }

  function hush(w: Walker) {
    w.talk = 0;
    w.bubble.classList.add('wait');
  }

  function serve(w: Walker) {
    w.state = 'served';
    w.timer = serveMs;
    if (buyerTalks > 0 && Math.random() < 0.4) return;
    const name = friendNames.get(crowd.stand);
    const teaching = buyerTalks % 2 === 0 && taught < lines.teach.length;
    const text = teaching ? lines.teach[taught] : buyerTalks === 1 && name ? `Hi, ${name}!` : lines.buying();
    // A buyer who talks takes a little longer at the counter, long enough to read.
    const stay = Math.max(serveMs, READ_MS);
    if (say(w, text, stay)) {
      w.timer = stay;
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
        const stay = Math.max(w.timer, READ_MS);
        if ((sadOnes === 1 || Math.random() < 0.5) && say(w, lines.missed(), stay, true)) w.timer = stay;
      } else if (w.role === 'buy' && k === 0) {
        serve(w);
      }
    }
    for (const w of walkers) {
      if (w.talk > 0 && (w.talk -= dt) <= 0) hush(w);
      if (w.state === 'served' || w.state === 'sad') {
        if ((w.timer -= dt) > 0) continue;
        line.splice(line.indexOf(w), 1);
        hush(w);
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
        if (w.role === 'pass') {
          w.pace += ((w.talk > 0 ? TALK_PACE : 1) - w.pace) * Math.min(1, dt / 100);
          if (w.talk > 0 && w.pace < 0.2) w.bubble.classList.remove('wait');   // slowed down: the words show
          if (w.says && say(w, w.says, TALK_MS)) w.says = '';
        }
        move(w, w.dir * w.speed * w.pace * dt);
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
  if (rehearsal) {
    dialog.classList.add('rehearsal');
    dialog.setAttribute('inert', '');
    dialog.setAttribute('aria-hidden', 'true');
    dialog.setAttribute('open', '');   // not show(): that would move the focus into it
  } else {
    dialog.showModal();
  }
  stageW = stage.clientWidth || stageW;
  stageH = stage.clientHeight || stageH;
  showStand(crowds[0]);
  return new Promise(resolve => {
    let frame = 0, last = performance.now(), held = 0, rate = rehearsal ? 3 : 1;
    function finish() {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      dialog.close();
      dialog.remove();
      if (rehearsal) {
        endRehearsal = null;
      } else {
        pauseCustomers(false);
        freshenCustomers(4);   // a few new faces for tomorrow
      }
      resolve();
    }
    if (rehearsal) endRehearsal = finish;
    // The button holds both labels and shows one (dayScene.css), so its width never changes.
    speed.onclick = () => {
      rate = rate === 1 ? 3 : 1;
      speed.setAttribute('aria-pressed', String(rate === 3));
    };
    find<HTMLButtonElement>('[data-skip]').onclick = finish;
    dialog.oncancel = e => { e.preventDefault(); finish(); };
    function tick(now: number) {
      // A long frame (a hidden tab) never jumps anyone across the stage.
      const dt = Math.min(100, now - last) * rate;
      last = now;
      if (rehearsal && clock >= REHEARSAL_MS) { finish(); return; }
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
