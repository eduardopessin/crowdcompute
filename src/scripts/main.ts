import type { Stats } from '../lib/stats';

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
    crowdcomputeTurnstileReady?: () => void;
  }
}
const form = document.querySelector<HTMLFormElement>('#reservation-form')!;
const submit = document.querySelector<HTMLButtonElement>('#submit-button')!;
const message = document.querySelector<HTMLParagraphElement>('#form-message')!;
const success = document.querySelector<HTMLDivElement>('#success-panel')!;
let token = '';
let widget: string | undefined;
let submitting = false;

function updateStats(stats: Stats) {
  document.querySelectorAll('[data-committed]').forEach((el) => {
    el.textContent = stats.committed.toLocaleString('en');
  });
  document
    .querySelectorAll<HTMLProgressElement>('[data-progress]')
    .forEach((el) => {
      el.value = Math.min(stats.committed, stats.target);
      el.setAttribute(
        'aria-valuetext',
        `${stats.committed} of ${stats.target} interested`,
      );
    });
  document.querySelectorAll('[data-progress-percent]').forEach((el) => {
    el.textContent = `${Math.round((stats.committed / stats.target) * 100)}% OF TARGET`;
  });
  document.querySelectorAll('[data-stats-status]').forEach((el) => {
    el.textContent =
      'Only “Yes, at ~€59/month” responses count. Interest is not a purchase.';
  });
  for (const [key, count] of Object.entries(stats.modelVotes)) {
    const percent = stats.totalResponses
      ? Math.round((count / stats.totalResponses) * 100)
      : 0;
    const label = document.querySelector(`[data-vote-label="${key}"]`);
    if (label) label.textContent = `${percent}%`;
    const bar = document.querySelector<HTMLProgressElement>(
      `[data-vote="${key}"]`,
    );
    if (bar) {
      bar.value = percent;
      bar.setAttribute('aria-valuetext', `${percent}% from ${count} votes`);
    }
  }
  const voteStatus = document.querySelector('[data-vote-status]');
  if (voteStatus)
    voteStatus.textContent = stats.totalResponses
      ? `${stats.totalResponses.toLocaleString('en')} responses · Anonymous aggregate totals · Percentages rounded`
      : 'No votes yet. Help shape the first cluster.';
}
async function loadStats() {
  try {
    const response = await fetch('/api/stats', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Unavailable');
    const stats = (await response.json()) as Stats;
    if (
      stats.target !== 300 ||
      !Number.isInteger(stats.committed) ||
      stats.committed < 0 ||
      !Number.isInteger(stats.totalResponses) ||
      stats.totalResponses < stats.committed ||
      !stats.modelVotes ||
      Object.values(stats.modelVotes).some((n) => !Number.isInteger(n) || n < 0)
    )
      throw new Error('Invalid statistics');
    updateStats(stats);
  } catch {
    document.querySelectorAll('[data-stats-status]').forEach((el) => {
      el.textContent =
        'Live progress is temporarily unavailable. Please refresh to try again.';
    });
    const voteStatus = document.querySelector('[data-vote-status]');
    if (voteStatus)
      voteStatus.textContent =
        'Live votes are temporarily unavailable. No estimated numbers are shown.';
  }
}
void loadStats();
// Refresh modestly while visible; no polling or analytics while the tab is hidden.
window.setInterval(() => {
  if (!document.hidden) void loadStats();
}, 60000);

function resetChallenge() {
  token = '';
  submit.disabled = true;
  if (widget !== undefined) window.turnstile?.reset(widget);
}
const challengeError = document.querySelector('#turnstileToken-error')!;
window.crowdcomputeTurnstileReady = () => {
  const sitekey = form.dataset.sitekey;
  const container = document.querySelector<HTMLElement>('#turnstile-widget');
  if (!sitekey || !container || !window.turnstile) return;
  widget = window.turnstile.render(container, {
    sitekey,
    theme: 'dark',
    action: 'commit',
    size: 'flexible',
    callback: (value: string) => {
      token = value;
      submit.disabled = submitting;
      challengeError.textContent = '';
    },
    'expired-callback': () => {
      resetChallenge();
      challengeError.textContent =
        'Security check expired. Please complete a new check.';
    },
    'error-callback': () => {
      token = '';
      submit.disabled = true;
      challengeError.textContent =
        'Security check could not load. Check your connection or content blocker, then reload this page.';
    },
  });
};
if (form.dataset.sitekey) {
  const script = document.createElement('script');
  script.src =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=crowdcomputeTurnstileReady&render=explicit';
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    challengeError.textContent =
      'Security check could not load. Please check your connection and reload.';
  };
  document.head.append(script);
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting || !form.reportValidity()) return;
  if (!token) {
    challengeError.textContent = 'Please complete the security check.';
    return;
  }
  form.querySelectorAll('.field-error').forEach((el) => {
    el.textContent = '';
  });
  form
    .querySelectorAll('[aria-invalid]')
    .forEach((el) => el.removeAttribute('aria-invalid'));
  message.classList.remove('is-error');
  submitting = true;
  submit.disabled = true;
  submit.textContent = 'Saving your interest…';
  const data = new FormData(form);
  const payload = {
    email: data.get('email'),
    country: data.get('country'),
    would_pay_59: data.get('would_pay_59'),
    use_case: data.get('use_case'),
    model_vote: data.get('model_vote'),
    comment: data.get('comment'),
    consent: data.get('consent') === 'on',
    turnstileToken: token,
  };
  try {
    const response = await fetch('/api/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const result = (await response.json()) as {
      ok?: boolean;
      error?: string;
      message?: string;
      fields?: Record<string, string>;
    };
    if (!response.ok || !result.ok) {
      if (result.fields)
        for (const [field, text] of Object.entries(result.fields)) {
          const error = document.getElementById(`${field}-error`);
          if (error) error.textContent = text;
          const control = form.elements.namedItem(field);
          if (control instanceof HTMLElement)
            control.setAttribute('aria-invalid', 'true');
          else if (control instanceof RadioNodeList)
            control.forEach((node) => {
              if (node instanceof HTMLElement)
                node.setAttribute('aria-invalid', 'true');
            });
        }
      throw new Error(
        result.error || 'We could not save your response. Please try again.',
      );
    }
    form.hidden = true;
    success.hidden = false;
    document.querySelector('#success-detail')!.textContent =
      result.message ||
      'Your interest has been registered. No payment or binding commitment.';
    success.focus();
    await loadStats();
  } catch (error) {
    message.textContent =
      error instanceof Error &&
      error.name !== 'TimeoutError' &&
      error.name !== 'TypeError'
        ? error.message
        : 'We couldn’t confirm your submission. Check your connection and try again; your email will not be counted twice.';
    message.classList.add('is-error');
    message.focus();
  } finally {
    submitting = false;
    submit.innerHTML = 'Reserve my seat <span aria-hidden="true">↗</span>';
    resetChallenge();
  }
});
document
  .querySelector<HTMLTextAreaElement>('#comment')!
  .addEventListener('input', (event) => {
    document.querySelector('#comment-count')!.textContent = String(
      (event.target as HTMLTextAreaElement).value.length,
    );
  });
document.querySelector('#update-response')!.addEventListener('click', () => {
  success.hidden = true;
  form.hidden = false;
  message.textContent =
    'Change your response, complete the security check, and submit again.';
  document.querySelector<HTMLElement>('#email')!.focus();
  resetChallenge();
});
document.querySelector('#share-button')!.addEventListener('click', async () => {
  const text =
    "I'm helping launch CrowdCompute EU-01: a community-funded 8×H200 European AI cluster. https://crowdcompute.eu";
  const status = document.querySelector('#share-status')!;
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied. Thanks for spreading the word.';
  } catch {
    const fallback =
      document.querySelector<HTMLTextAreaElement>('#share-fallback')!;
    fallback.hidden = false;
    fallback.focus();
    fallback.select();
    status.textContent = 'Copy the selected text to share.';
  }
});
