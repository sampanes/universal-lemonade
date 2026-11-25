// src/preload.ts -- fetch and decode pictures before they are needed, so nothing pops in on
// screen (the day scene switching stands, a new shop item, the house build scene).
//
// Each picture is loaded once and kept here, decoded, for as long as the page is open.
// priority: 'high' for what is about to show, 'low' for the background batch, so a big
// background batch never slows down what the kid is about to see.

export type LoadPriority = 'high' | 'low' | 'auto';

const ready = new Map<string, Promise<void>>();
const keep: HTMLImageElement[] = [];   // holds the decoded pictures

function preloadImage(url: string | null | undefined, priority: LoadPriority = 'auto'): Promise<void> {
  if (!url) return Promise.resolve();
  let pending = ready.get(url);
  if (!pending) {
    const img = new Image();
    img.decoding = 'async';
    img.fetchPriority = priority;
    img.src = url;
    // A picture that fails is forgotten (the next call tries again) and never holds anything up.
    pending = img.decode().then(() => { keep.push(img); }, () => { ready.delete(url); });
    ready.set(url, pending);
  }
  return pending;
}

// Resolves once every picture is ready, or after maxWaitMs, whichever comes first.
export function preloadImages(urls: Iterable<string | null | undefined>, maxWaitMs = 1500, priority: LoadPriority = 'auto'): Promise<void> {
  const all = Promise.all([...new Set(urls)].map(url => preloadImage(url, priority))).then(() => undefined);
  if (!Number.isFinite(maxWaitMs)) return all;
  return Promise.race([all, new Promise<void>(resolve => setTimeout(resolve, maxWaitMs))]);
}

// The background batch: one picture at a time at low priority, so it never crowds out a
// picture that is about to show.
export async function preloadInBackground(urls: Iterable<string | null | undefined>): Promise<void> {
  for (const url of new Set(urls)) await preloadImage(url, 'low');
}

// Run something (like a big preload) once the page has nothing else to do.
export function whenIdle(run: () => void): void {
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}
