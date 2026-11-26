// src/ui/reportModal.js -- the Day Report popup: it opens the moment the day scene ends, with
// any big news as banners on top (a new look, a money trophy, My House opening), and the
// Money Bag's "See report" opens yesterday's again.
import { dayReportHTML } from './dayReport.js';
import { reportKidHTML } from './kidView.js';
import { session } from './session.js';

const backdrop = () => document.getElementById('report-modal-backdrop');
const content = () => document.getElementById('report-modal-content');

// news: banners for the top of the report, top first: { cls, pic (markup, in its frame),
// title, text, button, onPress }. The button closes the report, then runs onPress.
function newsHTML(n, i) {
  return `<div class="magic-look ${n.cls || ''}">${n.pic}` +
    `<div class="magic-look-text"><b>${n.title}</b><span>${n.text}</span></div>` +
    `<button type="button" class="magic-look-try" data-news="${i}">${n.button}</button></div>`;
}

let newsShown = [];

// instant: no fade or pop. The day's report shows the moment the day scene closes (in the same
// frame), so the page never shows in between.
export function openDayReport(summary, news = [], instant = false) {
  newsShown = news;
  content().innerHTML = news.map(newsHTML).join('') + dayReportHTML(summary, session.engine.state, reportKidHTML);
  const el = backdrop();
  if (instant) el.classList.add('no-fade');
  el.classList.add('active');
  el.setAttribute('aria-hidden', 'false');
  if (instant) {
    void el.offsetWidth;   // settle it open with no transition, then put the transition back
    el.classList.remove('no-fade');
  }
  // A report with news opens at the top, so focusing the button at the bottom does not
  // scroll the news out of sight.
  document.getElementById('btn-report-modal-continue').focus({ preventScroll: news.length > 0 });
  if (news.length) document.getElementById('report-modal-dialog').scrollTop = 0;
}

function closeDayReport() {
  if (!backdrop().classList.contains('active')) return;
  backdrop().classList.remove('active');
  backdrop().setAttribute('aria-hidden', 'true');
}

export function initReportModal() {
  document.getElementById('btn-report-modal-continue').onclick = closeDayReport;
  document.getElementById('btn-report-modal-x').onclick = closeDayReport;
  backdrop().addEventListener('click', (e) => {
    const btn = e.target.closest('[data-news]');
    if (btn) {
      closeDayReport();
      newsShown[+btn.dataset.news]?.onPress();
      return;
    }
    if (e.target === backdrop()) closeDayReport();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDayReport(); });
}
