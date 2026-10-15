import { getNoiseSnapshot } from "./api.js?v=2";

const REFRESH_MS = 30000;
let refreshing = false;
let initialized = false;
let timer;

export function recentNoiseEvents(snapshot) {
  if (!Array.isArray(snapshot?.recentEvents)) return [];
  return snapshot.recentEvents.slice(0, 100).flatMap(event => {
    if (!event || typeof event.timestamp !== 'string' ||
        !Number.isFinite(Date.parse(event.timestamp)) ||
        typeof event.sensor !== 'string' || !event.sensor.trim() ||
        event.protocol !== 'TCP' || !Number.isInteger(event.destinationPort) ||
        event.destinationPort < 1 || event.destinationPort > 65535 ||
        typeof event.source !== 'string') return [];

    // Accept only the public snapshot's masked address formats, never a full IP.
    const ipv4 = event.source.match(/^(\d{1,3})\.(\d{1,3})\.xxx\.xxx$/);
    const ipv6 = /^(?:[\da-f]{1,4}:){3}xxx(?::xxx){4}$/i.test(event.source);
    if (!(ipv4 && Number(ipv4[1]) <= 255 && Number(ipv4[2]) <= 255) && !ipv6) return [];

    return [{
      timestamp: new Date(event.timestamp).toISOString(),
      sensor: event.sensor.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 64),
      protocol: event.protocol,
      destinationPort: event.destinationPort,
      source: event.source,
    }];
  }).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 5);
}

function renderSnapshot(output, snapshot) {
  const events = recentNoiseEvents(snapshot);
  if (!events.length) {
    output.textContent = snapshot.recentEvents.length
      ? '[UNAVAILABLE] The public snapshot contained no usable sanitized events.'
      : '[QUIET] No recent events in the public snapshot.';
    return;
  }

  const list = document.createElement('ol');
  list.className = 'list-unstyled mb-0';
  for (const event of events) {
    const row = document.createElement('li');
    row.className = 'py-2';
    const line = document.createElement('div');
    line.className = 'd-flex flex-wrap gap-2 align-items-baseline';
    const sensor = document.createElement('span');
    sensor.className = 'text-accent';
    sensor.textContent = event.sensor;
    const destination = document.createElement('span');
    destination.textContent = `${event.protocol}/${event.destinationPort}`;
    const source = document.createElement('code');
    source.textContent = event.source;
    line.append(sensor, destination, source);
    const time = document.createElement('time');
    time.className = 'widget-state-detail d-block';
    time.dateTime = event.timestamp;
    time.textContent = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium', timeStyle: 'medium',
    }).format(new Date(event.timestamp));
    row.append(line, time);
    list.append(row);
  }
  output.replaceChildren(list);
}

export async function refreshNoiseObservatory() {
  const output = document.getElementById('noise-events');
  const button = document.getElementById('btn-noise-refresh');
  if (refreshing || !output) return;
  refreshing = true;
  if (button) button.disabled = true;
  output.setAttribute('aria-busy', 'true');
  try {
    const result = await getNoiseSnapshot();
    if (result.disabled) {
      clearInterval(timer);
      output.textContent = '[UNAVAILABLE] This preview is available on kgivler.com. Use Open Noise Observatory for the full snapshot.';
    } else if (!result.ok) {
      output.textContent = '[UNAVAILABLE] Noise Observatory is temporarily unavailable. Use Refresh Noise to retry.';
    } else {
      renderSnapshot(output, result.snapshot);
    }
  } catch (_) {
    output.textContent = '[UNAVAILABLE] Noise Observatory is temporarily unavailable. Use Refresh Noise to retry.';
  } finally {
    refreshing = false;
    output.setAttribute('aria-busy', 'false');
    if (button) button.disabled = false;
  }
}

export function initNoiseObservatory() {
  if (initialized || !document.getElementById('noise-events')) return;
  initialized = true;
  document.getElementById('btn-noise-refresh')?.addEventListener('click', () => {
    void refreshNoiseObservatory();
  });
  timer = setInterval(() => {
    if (!document.hidden) void refreshNoiseObservatory();
  }, REFRESH_MS);
  void refreshNoiseObservatory();
}

document.addEventListener('DOMContentLoaded', initNoiseObservatory);
