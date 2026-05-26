const fetch = globalThis.fetch;
(async () => {
  const url = 'http://127.0.0.1:11434/api/chat';
  const body = {
    model: 'qwen3-coder:397b',
    messages: [{ role: 'user', content: 'Hello world' }],
    stream: false,
    think: false,
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    console.log('STATUS', res.status);
    console.log('TEXT', await res.text());
  } catch (err) {
    console.error('ERR', err);
  }
})();
