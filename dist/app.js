import { makeWorld } from './world.js';

const projects = {
  vision: {
    name:'Vision Lab', short:'Vision Lab', icon:'◎', theme:'Machine learning & imaging', section:'COMPUTER VISION',
    intro:'From a NumPy convolutional network to real-time hand tracking.',
    copy:'My hand-tracking web app reached 777 active users in 45 countries. I also trained an airplane instance-segmentation model with Detectron2 and built a MATLAB panorama pipeline using Harris corners, RANSAC, and homographies.',
    links:[['Try hand tracking','https://jaredtweed.github.io/hands'],['Segmentation code','https://github.com/JaredTweed/ComputerVision-pytorch-detectron2'],['Panorama code','https://github.com/JaredTweed/PanoramaMaker']],
    demo:'Edge detection', action:'Apply Sobel filter', idle:'Synthetic test image', result:'Edges extracted with a 3 × 3 kernel'
  },
  weather: {
    name:'Weather Station', short:'Weather Station', icon:'☀',
    theme:'Environmental monitoring', section:'PEAK HYDROMET SOLUTIONS',
    intro:'From weather instruments to usable data.',
    copy:'I wrote C++ firmware for Nordic nRF52840 devices that read binary data from Davis stations over RS-485 and transmit JSON over LoRaWAN or cellular. I built ThingsBoard widgets and an anomaly detector that uses historical readings and data from nearby stations.',
    demo:'Station readings', action:'Simulate a gust', idle:'Wind 12 km/h · 14.2 °C', result:'Wind 39 km/h · 14.2 °C', graph:true, effect:'gust'
  },
  city: {
    name:'Software City', short:'Software City', icon:'▥',
    theme:'Full-stack & desktop apps', section:'APPLICATION ENGINEERING',
    intro:'Small tools that hold up under real workloads.',
    copy:'SharedLens is a mobile-friendly photo and video gallery with direct uploads, WebP thumbnails, and a priority-based loader. Audio to Text Transcriber is a GTK4 app with batch transcription and memory-mapped search.',
    links:[['SharedLens','https://sharedlens.ca'],['Gallery code','https://github.com/JaredTweed/wedding-photos'],['Transcriber code','https://github.com/JaredTweed/AudioToTextTranscriber']],
    demo:'Gallery loading queue', action:'Queue 9 photos', idle:'0 active · 0 waiting', effect:null
  },
  maps: {
    name:'Road Network', short:'Road Network', icon:'⌘',
    theme:'Organic Maps & routing', section:'OPEN SOURCE CARTOGRAPHY',
    intro:'Offline navigation and open map data.',
    copy:'I contribute to Organic Maps, an open-source navigation app built on OpenStreetMap data. Run the island’s sample route to follow a car across the river bridge.',
    links:[['My Organic Maps contribution','https://github.com/organicmaps/organicmaps/pull/12692']],
    demo:'Bridge route', action:'Start navigation', idle:'North bank to south shore', result:'Route active · crossing the river', effect:'route'
  },
  satellite: {
    name:'Satellite', short:'Satellite', icon:'◇',
    theme:'SDR & satellite navigation', section:'RADIO & GNSS EXPLORATION',
    intro:'How receivers listen for signals from orbit.',
    copy:'This landmark explores two technical interests: software-defined radio and satellite navigation. A GNSS receiver estimates distance from signal timing and combines measurements from multiple satellites to estimate its position.',
    demo:'Radio link', action:'Send test signal', idle:'Receiver listening', result:'Signal received · sample delay 72 ms', effect:'radio'
  },
  tower: {
    name:'Comms Tower', short:'Comms Tower', icon:'⌁',
    theme:'Backend & telemetry pipelines', section:'INFRASTRUCTURE',
    intro:'What happens after a sensor sends a reading.',
    copy:'At Peak HydroMet I worked with MQTT and AMQP, deployed Node-RED instances on AWS EC2, and integrated MongoDB with Node.js. I used Python and multithreading to curate JSON, XML, and CSV data.',
    demo:'MQTT telemetry', action:'Publish sample packet', idle:'Topic: stations/demo/wind', result:'Broker received { "wind_kmh": 12 }', effect:'packet'
  }
};
const byId = id => document.getElementById(id);
const locations = byId('locations');
const detail = byId('detail');
const pins = {};
const entries = {};
let world, selected, timer, dusk=false, winter=false;
function button(text, className) {
  const element = document.createElement('button');
  element.type='button'; element.className=className; element.textContent=text;
  return element;
}
for(const [id,p] of Object.entries(projects)){
  const entry=button('', 'location');
  entry.innerHTML=`<span class="location-icon" aria-hidden="true">${p.icon}</span><span><strong>${p.name}</strong><small>${p.theme}</small></span><span class="chevron" aria-hidden="true">›</span>`;
  entry.addEventListener('click',()=>select(id,entry));
  entry.setAttribute('aria-pressed','false');
  locations.append(entry);entries[id]=entry;
  const pin=button('', 'pin');
  pin.innerHTML=`<span aria-hidden="true">${p.icon}</span>${p.short}`;
  pin.dataset.location=id;
  pin.hidden=true;
  pin.setAttribute('aria-pressed','false');
  pin.addEventListener('click',()=>select(id,pin));
  byId('pins').append(pin);pins[id]=pin;
}
function select(id, invoker){
  clearTimeout(timer);
  selected=id;
  world?.demo(null);
  world?.go(id);
  for(const key of Object.keys(projects)){
    entries[key].setAttribute('aria-pressed',String(id===key));
    pins[key].setAttribute('aria-pressed',String(id===key));
  }
  detail.replaceChildren();
  locations.hidden=Boolean(id);
  detail.hidden=!id;
  byId('guide-description').hidden=Boolean(id);
  byId('directory-label').textContent=id?projects[id].section:'FIELD GUIDE';
  const title=byId('guide-title');
  title.textContent=id?projects[id].name:'Explore the island';
  if(!id){
    if(invoker) invoker.focus({preventScroll:true});
    return;
  }
  const p=projects[id];
  const back=button('All locations','back');
  back.addEventListener('click',()=>select(null,entries[id]));
  detail.append(back);
  const intro=document.createElement('p');
  intro.className='detail-intro';intro.textContent=p.intro;detail.append(intro);
  const description=document.createElement('p');
  description.textContent=p.copy;detail.append(description);
  if(p.links){
    const links=document.createElement('div');links.className='detail-links';
    for(const [label,url] of p.links){
      const a=document.createElement('a');
      a.href=url;a.textContent=label;links.append(a);
    }
    detail.append(links);
  }
  const demo=document.createElement('div');demo.className='demo';
  const heading=document.createElement('header');
  const strong=document.createElement('strong');strong.textContent=p.demo;
  const sim=document.createElement('small');sim.textContent='Simulation';
  heading.append(strong,sim);
  const output=document.createElement('output');output.textContent=p.idle;
  const action=button(p.action,'demo-action');
  demo.append(heading,output);
  if(id==='vision'){
    const canvas=document.createElement('canvas');
    canvas.width=72; canvas.height=28; canvas.className='edge-demo';
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#365649';ctx.fillRect(0,0,72,28);
    ctx.fillStyle='#dce8c8';ctx.fillRect(12,5,17,17);
    ctx.beginPath();ctx.arc(51,13,9,0,Math.PI*2);ctx.fill();
    const input=ctx.getImageData(0,0,72,28);
    action.addEventListener('click',()=>{
      const out=ctx.createImageData(72,28);
      const pixel=(x,y)=>input.data[(y*72+x)*4];
      for(let y=1;y<27;y++)for(let x=1;x<71;x++){
        const gx=pixel(x+1,y-1)+2*pixel(x+1,y)+pixel(x+1,y+1)-pixel(x-1,y-1)-2*pixel(x-1,y)-pixel(x-1,y+1);
        const gy=pixel(x-1,y+1)+2*pixel(x,y+1)+pixel(x+1,y+1)-pixel(x-1,y-1)-2*pixel(x,y-1)-pixel(x+1,y-1);
        const index=(y*72+x)*4;
        out.data.fill(Math.min(255,Math.hypot(gx,gy)),index,index+3);
        out.data[index+3]=255;
      }
      ctx.putImageData(out,0,0);
    });
    demo.append(canvas);
  }
  if(p.graph){
    const chart=document.createElement('canvas');chart.width=280;chart.height=42;
    chart.setAttribute('aria-hidden','true');chart.className='spark';
    demo.append(chart);
    const ctx=chart.getContext('2d');
    const draw=gust=>{
      ctx.clearRect(0,0,280,42);ctx.lineWidth=2;ctx.strokeStyle='#507a5e';
      ctx.beginPath();
      for(let x=0;x<280;x+=3){
        const y=gust? 32-23*Math.exp(-((x-165)**2)/900)+Math.sin(x*.14)*2.3 : 28+Math.sin(x*.11)*3+Math.cos(x*.061)*2;
        if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.stroke();
    };
    draw(false);action.addEventListener('click',()=>draw(true));
  }
  action.addEventListener('click',()=>{
    clearTimeout(timer);
    world?.demo(p.effect);
    if(id==='city'){
      let complete=0;
      const tick=()=>{
        const active=Math.min(4,9-complete);
        output.textContent=`${active} active · ${9-complete-active} waiting · ${complete} complete`;
        if(active){complete+=active;timer=setTimeout(tick,690)}
      };
      tick();
    }else{
      output.textContent=p.result;
      if(id==='maps')timer=setTimeout(()=>{output.textContent='Arrived · south shore'},8000);
    }
  });
  demo.append(action);
  detail.append(demo);
  title.tabIndex=-1;
  if(matchMedia('(max-width:690px)').matches && invoker?.classList.contains('pin')){
    title.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  title.focus({preventScroll:true});
}
try{
  world=makeWorld(byId('stage'),pins);
}catch(error){
  console.warn('Interactive map unavailable',error);
  byId('stage').replaceChildren();
  const message=document.createElement('div');
  message.className='fallback-note';
  message.textContent='The 3D map requires WebGL. You can still explore all six landmarks in the field guide.';
  byId('stage').append(message);
  byId('stage').removeAttribute('aria-hidden');
  byId('map-help').textContent='Explore with the field guide';
  document.querySelector('.map-modes').hidden=true;
  document.querySelector('.map-actions').hidden=true;
}
byId('zoom-in').addEventListener('click',()=>world?.scale(.78));
byId('zoom-out').addEventListener('click',()=>world?.scale(1.28));
byId('reset').addEventListener('click',()=>select(null));
byId('light').addEventListener('click',()=>{
  dusk=!dusk;
  byId('map').dataset.theme=dusk?'dusk':'day';
  byId('light').textContent=dusk?'☾':'☼';
  byId('light').title=dusk?'Switch to daylight':'Switch to dusk';
  byId('light').setAttribute('aria-label',byId('light').title);
  world?.setDusk(dusk);
});
byId('season').addEventListener('click',()=>{
  winter=!winter;
  const control=byId('season');
  control.textContent=winter?'♧':'❄';
  control.title=winter?'Switch to summer':'Switch to winter';
  control.setAttribute('aria-label',control.title);
  world?.setWinter(winter);
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&selected)select(null,entries[selected]);
});
const github='https://github.com/';
const notebook=[
  ['SharedLens','AWS S3 · Cognito · Firebase','Five weddings used the gallery, with 100+ guests. Multipart uploads handle large videos, while WebP thumbnails and a four-request loading queue keep mobile browsing responsive.','https://sharedlens.ca'],
  ['Real-time hand tracking','Computer vision · Stripe','777 active users in 45 countries used my browser-based hand-tracking app. I integrated payments and traffic analytics alongside the real-time interaction.','https://jaredtweed.github.io/hands'],
  ['Audio to Text Transcriber','GTK4 · whisper.cpp · Flatpak','Batch transcription with live progress, cancellation, and resume controls. Memory-mapped scanning keeps transcript search fast across thousands of files.',github+'JaredTweed/AudioToTextTranscriber'],
  ['Appointment scheduling','AWS Lambda · MongoDB · REST','I used Diophantine equations to evaluate appointment combinations and reduce gaps, alongside Google sign-in and persistent scheduling.','https://jaredtweed.github.io/tetrisbooking/'],
  ['Question bank converter','Python · Regex · XML','Several professors used my tool to turn plain-text questions into XML quiz banks. Its editor catches formatting errors before export.',github+'JaredTweed/TextToQuestionBankConverter'],
  ['Relational schema analyzer','Python · Database theory','Computes candidate keys, closures, and canonical covers. Checks normal forms through BCNF and tests decompositions for lossless joins and dependency preservation.',github+'JaredTweed/NormalForms-CanonicalCover'],
  ['Digit recognition from scratch','NumPy · Neural networks','Implemented convolution, ReLU, max pooling, and backpropagation in NumPy. A separate PyTorch project handles real-time digit recognition.',github+'JaredTweed/MNIST-artificial-intelligence-numpy'],
  ['Weekly Commits','Rust · COSMIC desktop','A desktop panel applet that tracks GitHub commits across the week. I built it in Rust for the COSMIC desktop environment.',github+'JaredTweed/weekly-commits'],
  ['Mouse Mirage','Java · Swing · Maven','I led Java development and designed level progression, sound management, and navigation for the game.',github+'JaredTweed/MouseMirageGame']
];
for(const [name,stack,description,url] of notebook){
  const card=document.createElement('article');
  const title=document.createElement('h3'), link=document.createElement('a');
  link.href=url;link.textContent=name;title.append(link);
  const tech=document.createElement('small');tech.textContent=stack;
  const body=document.createElement('p');body.textContent=description;
  card.append(tech,title,body);byId('work-list').append(card);
}
for(const [name,path] of [['Feeder','spacecowboy/Feeder/pull/1283'],['GNOME Clipboard Indicator','Tudmotu/gnome-shell-extension-clipboard-indicator/pull/534'],['Newelle','qwersyk/Newelle/pull/155'],['whisper.cpp','ggml-org/whisper.cpp/pull/3097'],['Microsoft Edit','microsoft/edit/pull/628'],['Actual Budget','actualbudget/actual/pull/4872'],['Organic Maps','organicmaps/organicmaps/pull/12692'],['Copyous','boerdereinar/copyous/pull/190'],['Aradia','JaredTweed/aradia']]){
  const a=document.createElement('a');a.href=github+path;a.textContent=name;byId('contributions').append(a);
}
