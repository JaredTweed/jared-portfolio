import {cycleSegments, segmentAt} from './cycle-route.js';
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
    ['Instrument', 'Wind field  01 86 (hex)', 'weather', 'gust'],
    ['Firmware', '0x0186 = 390 tenths ÷ 10 = 39 km/h · '+JSON.stringify({wind_kmh: wind}), 'weather', 'gust'],
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

export function cyclingRide(world, button) {
  const panel = document.createElement('section');
  panel.className = 'walkthrough cycle-ride';
  const map = document.createElement('canvas');
  map.width = 560;
  map.height = 290;
  map.setAttribute('role', 'img');
  map.setAttribute('aria-label', 'Route map. Dotted shared lane, dashed painted lane, solid separated track.');
  const ctx = map.getContext('2d');
  const description = document.createElement('output');
  const play = button('Start cycle ride', 'demo-action');
  const legend = document.createElement('div');
  const scrubber = document.createElement('input');
  scrubber.type='range';scrubber.min=0;scrubber.max=1000;scrubber.value=0;
  scrubber.setAttribute('aria-label','Ride progress');
  scrubber.addEventListener('input',()=>{render(Number(scrubber.value)/1000,true);pause()});
  legend.className = 'cycle-legend';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let progress = 0, frame = 0, previous = 0, active = null;
  const mobile = matchMedia('(max-width: 690px)');
  const inset = document.createElement('div');
  inset.className = 'cycle-map-inset';
  inset.setAttribute('aria-hidden','true');
  const insetMap = document.createElement('canvas');
  insetMap.width=map.width;
  insetMap.height=map.height;
  inset.append(insetMap);
  const insetContext=insetMap.getContext('2d');
  const controls = cycleSegments.map(segment => {
    const control = button(segment.name, 'cycle-segment');
    const sample = document.createElement('span');
    sample.className = 'pattern-' + segment.pattern.toLowerCase();
    sample.setAttribute('aria-hidden', 'true');
    control.prepend(sample);
    control.title = segment.pattern + ' line · ' + segment.name;
    control.addEventListener('click', () => {
      render((segment.start + segment.end) / 2, true);
      pause();
    });
    legend.append(control);
    return control;
  });

  function project(u, offset = 0) {
    const route = world();
    const p = route?.cyclePoint(u) ?? {x:1.3 + 7.3*u*u,z:-1.1 + 4.4*Math.sin(u*1.8)};
    const a = route?.cyclePoint(Math.max(0,u-.003)) ?? p;
    const b = route?.cyclePoint(Math.min(1,u+.003)) ?? {x:p.x+1,z:p.z};
    const dx=b.x-a.x, dz=b.z-a.z, length=Math.hypot(dx,dz)||1;
    return [68+(p.x-offset*dz/length)*48,36+(p.z+offset*dx/length)*44];
  }
  function trace(start,end,offset) {
    ctx.beginPath();
    for(let i=0;i<=60;i++){
      const p=project(start+(end-start)*i/60,offset);
      if(i)ctx.lineTo(...p);
      else ctx.moveTo(...p);
    }
    ctx.stroke();
  }
  function render(value, follow) {
    progress=value;
    scrubber.value=Math.round(progress*1000);
    scrubber.setAttribute('aria-valuetext',Math.round(progress*100)+'% · '+segmentAt(progress).name);
    const current=segmentAt(progress);
    if(follow){
      world()?.showRide(progress);
      if(mobile.matches && !inset.isConnected && world()){
        document.getElementById('map').append(inset);
      }
    }
    if(active!==current){
      active=current;
      description.textContent=current.pattern+' · '+current.description;
      controls.forEach((control,i)=>control.setAttribute('aria-pressed',String(cycleSegments[i]===current)));
    }
    ctx.fillStyle='#eef0e6';ctx.fillRect(0,0,560,290);
    ctx.strokeStyle='#b5dcdc';ctx.lineWidth=26;
    ctx.beginPath();
    for(let x=0;x<=560;x+=8)ctx.lineTo(x,36+(1.25+1.1*Math.sin((x-68)/48*.42))*44);
    ctx.stroke();
    ctx.strokeStyle='#b7bbb1';ctx.lineWidth=22;ctx.lineCap='round';
    trace(0,1,0);
    for(const segment of cycleSegments){
      ctx.strokeStyle=segment===current?'#176c55':'#478875';
      ctx.lineWidth=segment===current?7:5;
      ctx.setLineDash(segment.dash.map(value=>value*1.7));
      trace(segment.start,segment.end,segment.offset);
    }
    ctx.setLineDash([]);
    const transition=Math.max(0,Math.min(1,(progress-.122)/.054));
    const [x,y]=project(progress,.166+(.493-.166)*transition*transition*(3-2*transition));
    ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);
    ctx.fillStyle='#ac512f';ctx.fill();ctx.strokeStyle='#fffdf4';ctx.lineWidth=3;ctx.stroke();
    if(inset.isConnected)insetContext.drawImage(map,0,0);
  }
  function pause() {
    cancelAnimationFrame(frame);
    frame=0;
    play.textContent=progress===0?'Start cycle ride':progress===1?'Replay cycle ride':'Resume cycle ride';
  }
  function tick(now) {
    render(Math.min(1,progress+Math.max(0,Math.min(100,now-previous))/15500),true);
    previous=now;
    if(progress===1)pause();
    else frame=requestAnimationFrame(tick);
  }
  play.addEventListener('click',()=>{
    if(frame){pause();return}
    if(reduced.matches){
      const next=progress===0?cycleSegments[0]:cycleSegments[(cycleSegments.indexOf(active)+1)%cycleSegments.length];
      render((next.start+next.end)/2,true);
      play.textContent='Next facility';
      return;
    }
    if(progress===1)render(0,true);
    previous=performance.now();frame=requestAnimationFrame(tick);
    play.textContent='Pause cycle ride';
  });
  const timeline=document.createElement('div');
  timeline.className='cycle-timeline';
  for(const segment of cycleSegments){
    const stop=button(segment.pattern,'timeline-stop');
    stop.style.left=((segment.start+segment.end)*50)+'%';
    stop.addEventListener('click',()=>{render((segment.start+segment.end)/2,true);pause()});
    timeline.append(stop);
  }
  panel.append(play,map,scrubber,timeline,legend,description);
  render(0,false);
  return {panel, stop(){pause();inset.remove()}};
}

export function galleryQueue() {
  const panel = document.createElement('section');
  panel.className='walkthrough gallery-demo';
  panel.innerHTML='<h3>Thumbnail loading queue</h3><p>Scroll the sample gallery to reprioritize thumbnails. Four slots are available, with a simulated request delay.</p>';
  const status=document.createElement('output');
  const grid=document.createElement('div');
  grid.className='gallery-scroll';
  grid.tabIndex=0;
  grid.setAttribute('role','region');
  grid.setAttribute('aria-label','Scrollable sample gallery');
  const start=document.createElement('button');
  start.type='button';
  start.textContent='Start thumbnail loader';
  const tiles=Array.from({length:12},(_,index)=>{
    const tile=document.createElement('figure');
    const image=document.createElement('img');
    image.alt='Island detail '+(index+1);
    image.width=180;
    image.height=128;
    image.hidden=true;
    const label=document.createElement('figcaption');
    label.textContent='Queued';
    tile.append(image,label);
    grid.append(tile);
    return {tile,image,label,state:'waiting',index};
  });
  const timers=new Set();
  let running=false, stopped=false;
  function update(){
    if(!running||stopped)return;
    const center=grid.getBoundingClientRect().top+grid.clientHeight/2;
    const waiting=tiles.filter(t=>t.state==='waiting').map(t=>{
      const bounds=t.tile.getBoundingClientRect();
      return {t,distance:Math.abs(bounds.top+bounds.height/2-center)};
    }).sort((a,b)=>a.distance-b.distance);
    const limit=4-tiles.filter(t=>t.state==='loading').length;
    for(const {t} of waiting.slice(0,limit)){
      t.state='loading';
      t.label.textContent='Loading';
      const timer=setTimeout(async ()=>{
        timers.delete(timer);
        t.image.src='./gallery/atlas-'+t.index+'.webp';
        try{
          await t.image.decode();
          if(stopped)return;
          t.image.hidden=false;
          t.label.textContent='Loaded';
        }catch{
          if(stopped)return;
          t.label.textContent='Unavailable';
        }
        t.state='done';
        update();
      },1200+t.index%3*550);
      timers.add(timer);
    }
    status.textContent=['loading','waiting','done'].map(s=>tiles.filter(t=>t.state===s).length+' '+s).join(' · ');
  }
  start.addEventListener('click',()=>{
    running=true;
    start.hidden=true;
    grid.focus({preventScroll:true});
    update();
  });
  grid.addEventListener('scroll',update,{passive:true});
  status.textContent='0 loading · 12 waiting';
  panel.append(start,grid,status);
  return {panel,stop(){stopped=true;for(const timer of timers)clearTimeout(timer)}};
}
