export function weatherWalkthrough(world, button) {
  const panel = document.createElement('section');
  panel.className = 'walkthrough';
  const title = document.createElement('h3');
  title.textContent = 'Follow a weather reading';
  const reading = document.createElement('output');
  const next = button('Sample a gust', 'demo-action');
  const bytes = Uint8Array.of(0x01, 0x86);
  // This teaching payload stores wind in tenths of a kilometre per hour.
  const wind = new DataView(bytes.buffer).getUint16(0) / 10;
  const steps = [
    ['Instrument', 'Sample bytes  01 86', 'weather', 'gust'],
    ['Firmware', JSON.stringify({wind_kmh: wind}), 'weather', 'gust'],
    ['Telemetry', 'stations/demo/wind · ' + JSON.stringify({wind_kmh: wind}), 'tower', 'packet'],
    ['Dashboard', wind + ' km/h · Gust captured', 'city', null]
  ];
  let index = -1;
  const chart = document.createElement('canvas');
  chart.width = 272;
  chart.height = 56;
  chart.hidden = true;
  chart.setAttribute('aria-label', 'Sample wind measurements with a final gust');
  chart.setAttribute('role', 'img');
  reading.textContent = 'Simulated reading · Instrument → Firmware → Telemetry → Dashboard';
  next.addEventListener('click', () => {
    index = (index + 1) % steps.length;
    const [label, value, location, effect] = steps[index];
    reading.textContent = label + ' · ' + value;
    world()?.go(location);
    world()?.demo(effect);
    chart.hidden = index !== 3;
    if (index === 3) {
      const ctx = chart.getContext('2d');
      ctx.clearRect(0, 0, 272, 56);
      ctx.strokeStyle = '#29836b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      [12, 15, 13, 17, wind].forEach((sample, i) => {
        const y = 51 - sample;
        if (i) ctx.lineTo(10 + i * 62, y);
        else ctx.moveTo(10, y);
      });
      ctx.stroke();
    }
    next.textContent = ['Decode sample', 'Publish reading', 'Plot measurement', 'Replay walkthrough'][index];
  });
  panel.append(title, reading, chart, next);
  return panel;
}

export function laneComparison() {
  const panel = document.createElement('details');
  panel.className = 'walkthrough';
  const summary = document.createElement('summary');
  summary.textContent = 'Compare junction on a map';
  const side = document.createElement('select');
  side.setAttribute('aria-label', 'Cycle lane placement');
  for (const label of ['Both sides', 'Left side', 'Right side', 'No lanes']) side.add(new Option(label, label));
  const map = document.createElement('canvas');
  map.width = 280;
  map.height = 155;
  map.setAttribute('role', 'img');
  const caption = document.createElement('output');
  const draw = () => {
    const ctx = map.getContext('2d');
    ctx.fillStyle = '#e5ecd4';
    ctx.fillRect(0, 0, 280, 155);
    ctx.fillStyle = '#b9dfe2';
    ctx.fillRect(0, 109, 280, 23);
    ctx.fillStyle = '#4b585c';
    ctx.fillRect(0, 28, 280, 55);
    ctx.fillRect(111, 83, 58, 72);
    ctx.fillStyle = '#e9ead9';
    for (let x = 8; x < 280; x += 20) ctx.fillRect(x, 54, 11, 2);
    ctx.fillStyle = '#45bf96';
    if (['Both sides', 'Left side'].includes(side.value)) ctx.fillRect(0, 30, 280, 8);
    if (['Both sides', 'Right side'].includes(side.value)) {
      ctx.fillRect(0, 73, 111, 8);
      ctx.fillRect(169, 73, 111, 8);
    }
    ctx.fillRect(114, 83, 7, 72);
    ctx.fillRect(159, 83, 7, 72);
    caption.textContent = side.value + ' on the main road, looking east. The bridge has a lane in each direction.';
    map.setAttribute('aria-label', caption.textContent);
  };
  side.addEventListener('change', draw);
  panel.append(summary, side, map, caption);
  draw();
  return panel;
}
