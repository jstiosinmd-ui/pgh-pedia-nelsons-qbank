/* Load the unchanged self-study runtime after its bank data is ready. */
(() => {
  'use strict';
  const plan = JSON.parse(document.getElementById('deliveryPlan').textContent);
  const panel = document.getElementById('deliveryStatus');
  const message = document.getElementById('deliveryMessage');
  const progress = document.getElementById('deliveryProgress');
  const retry = document.getElementById('deliveryRetry');
  const bank = new URLSearchParams(location.search).get('bank') === 'mock' ? 'mock' : 'nelson';
  const blocks = plan.blocks.filter(b => !b.bank || b.bank === bank);
  const jobs = blocks.flatMap(b => b.parts.map((url, i) => ({block: b, index: i, url})));
  let next = 0, done = 0;
  const parts = new Map(blocks.map(b => [b.id, new Array(b.parts.length)]));
  progress.max = jobs.length || 1;
  retry.onclick = () => location.reload();
  async function getPart(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(url, {signal: controller.signal});
        if (!response.ok) throw Error('Question data unavailable');
        const value = await response.json();
        if (typeof value !== 'string') throw Error('Invalid question data');
        return value;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
      } finally { clearTimeout(timer); }
    }
  }
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      parts.get(job.block.id)[job.index] = await getPart(job.url);
      progress.value = ++done;
      message.textContent = 'Loading questions… ' + Math.round(done / jobs.length * 100) + '%';
    }
  }
  async function loadScript(url) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = () => reject(Error('Practice tools unavailable'));
      document.body.appendChild(script);
    });
  }
  (async () => {
    await Promise.all(Array.from({length: Math.min(6, jobs.length)}, worker));
    for (const block of blocks) {
      const text = parts.get(block.id).join('');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
      if (hash !== block.sha256) throw Error('Question data incomplete');
      document.getElementById(block.id).textContent = text;
    }
    for (const url of plan.scripts) await loadScript(url);
    panel.remove();
    document.documentElement.removeAttribute('data-delivery-loading');
  })().catch(() => {
    message.textContent = 'Questions could not finish loading. Check your connection and try again.';
    progress.hidden = true;
    retry.hidden = false;
  });
})();
