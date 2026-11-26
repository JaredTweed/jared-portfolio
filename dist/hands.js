const get = name => document.getElementById('hand-' + name);
const video = get('video');
const photo = get('photo');
const overlay = get('overlay');
const pen = overlay.getContext('2d');
const stage = overlay.parentElement;
let session = null;
let epoch = 0;
let audio;
let oscillator;
let gain;
let connections;
let sampleVisible = false;
let saved = {};
try { saved = JSON.parse(localStorage.getItem('hands-settings-v1')) || {}; } catch {}
const records = saved.records || {};
get('pitch').value = saved.pitch ?? 440;
get('volume').value = saved.volume ?? 0;
function save() {
  try {
    localStorage.setItem('hands-settings-v1', JSON.stringify({pitch:get('pitch').value, volume:get('volume').value, records}));
  } catch {}
}
function time(seconds) {
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2,'0');
}
function dateKey(d) {
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function updateRecords(seconds = 0) {
  const now = new Date();
  const today = dateKey(now);
  now.setDate(now.getDate() - now.getDay());
  const periods = {Today:today, Week:'week-'+dateKey(now), Month:today.slice(0,7), Year:today.slice(0,4), 'All time':'all'};
  const rows = [];
  let changed = false;
  for (const [label,key] of Object.entries(periods)) {
    if (seconds > (records[key] || 0)) { records[key] = seconds; changed = true; }
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = time(records[key] || 0);
    row.append(dt,dd);
    rows.push(row);
  }
  get('records').replaceChildren(...rows);
  if (changed) save();
}
function soundSettings() {
  const volume = Number(get('volume').value);
  get('volume-label').textContent = volume ? volume+'%' : 'Muted';
  get('pitch-label').textContent = get('pitch').value+' Hz';
  if (oscillator) oscillator.frequency.value = Number(get('pitch').value);
}
function prepareAudio() {
  if (!Number(get('volume').value)) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  audio ??= new Audio();
  audio.resume().catch(()=>{});
}
function beep(on) {
  if (!audio || !Number(get('volume').value)) on = false;
  if (on && !oscillator) {
    oscillator = audio.createOscillator();
    gain = audio.createGain();
    oscillator.connect(gain).connect(audio.destination);
    oscillator.frequency.value = Number(get('pitch').value);
    oscillator.start();
  }
  if (on) gain.gain.setTargetAtTime(Number(get('volume').value)/500, audio.currentTime, .01);
  if (!on && oscillator) {
    oscillator.stop();
    oscillator.disconnect();
    gain.disconnect();
    oscillator = null;
  }
}
for (const name of ['pitch','volume']) get(name).addEventListener('input', () => {
  soundSettings();
  if (session?.stream) prepareAudio();
  if (!Number(get('volume').value)) beep(false);
  save();
});
soundSettings();
updateRecords();

function draw(hands, width, height) {
  if (overlay.width !== width || overlay.height !== height) {
    overlay.width = width;
    overlay.height = height;
  }
  pen.clearRect(0,0,width,height);
  pen.lineCap = 'round';
  for (const points of hands) {
    pen.beginPath();
    for (const {start,end} of connections) {
      pen.moveTo(points[start].x*width, points[start].y*height);
      pen.lineTo(points[end].x*width, points[end].y*height);
    }
    pen.lineWidth = width*.008;
    pen.strokeStyle = '#193c32';
    pen.stroke();
    pen.lineWidth = width*.0038;
    pen.strokeStyle = '#b5ffd2';
    pen.stroke();
    pen.fillStyle = '#fff1ae';
    pen.strokeStyle = '#294737';
    pen.lineWidth = width*.002;
    for (const point of points) {
      pen.beginPath();
      pen.arc(point.x*width,point.y*height,width*.0048,0,Math.PI*2);
      pen.fill();
      pen.stroke();
    }
  }
}
function stop(message = 'Camera stopped.') {
  epoch++;
  const s = session;
  session = null;
  if (s) {
    cancelAnimationFrame(s.frame);
    s.stream?.getTracks().forEach(track=>track.stop());
    s.model?.close();
  }
  beep(false);
  video.pause();
  video.srcObject = null;
  video.hidden = true;
  photo.hidden = false;
  stage.classList.remove('live','detected');
  pen.clearRect(0,0,overlay.width,overlay.height);
  get('feed').textContent = 'Sample photograph';
  get('session').hidden = true;
  get('start').textContent = 'Start camera';
  sampleVisible = false;
  get('sample').textContent = 'Detect sample hands';
  get('sample').disabled = false;
  get('status').textContent = message;
}
function failure(error) {
  if (error.name === 'NotAllowedError') return 'Camera access was blocked. Allow the camera in your browser, or try the sample.';
  if (error.name === 'NotFoundError') return 'No camera found. Try the sample photograph.';
  if (error.name === 'NotReadableError') return 'The camera is busy. Close the other camera app and try again.';
  return 'Tracking could not start. Try again, or open the original app.';
}
function liveFrame(s, now) {
  if (session !== s) return;
  if (video.readyState >= 2 && video.currentTime !== s.videoTime && now - s.lastInference >= 65) {
    try {
      s.videoTime = video.currentTime;
      s.lastInference = now;
      const {landmarks} = s.model.detectForVideo(video, now);
      draw(landmarks,video.videoWidth,video.videoHeight);
      const count = landmarks.length;
      stage.classList.toggle('detected',count > 0);
      const label = count ? count + (count === 1 ? ' hand detected' : ' hands detected') : 'No hands in view';
      if (get('feed').textContent !== label) get('feed').textContent = label;
      s.detectedAt = count ? s.detectedAt ?? now : null;
      const grace = count ? Math.max(0,1-(now-s.detectedAt)/1100) : 1;
      get('grace').value = grace;
      if (!grace) s.elapsed = 0;
      else if (!s.paused && s.lastFrame) s.elapsed += now-s.lastFrame;
      s.lastFrame = now;
      const seconds = Math.floor(s.elapsed/1000);
      if (seconds !== s.seconds) {
        s.seconds = seconds;
        get('time').textContent = time(seconds);
        updateRecords(seconds);
      }
      beep(count && Math.floor((now-s.detectedAt)/300)%2 === 0);
    } catch(error) { stop(failure(error)); return; }
  }
  s.frame = requestAnimationFrame(time=>liveFrame(s,time));
}
async function start(live) {
  stop('');
  const generation = epoch;
  const s = {frame:0,elapsed:0,lastInference:0,paused:false,live};
  session = s;
  get('start').textContent = live ? 'Stop camera' : 'Start camera';
  get('sample').disabled = true;
  try {
    if (live) {
      prepareAudio();
      if (!navigator.mediaDevices?.getUserMedia) {
        stop('Camera access is unavailable in this browser. Try the sample photograph.');
        return;
      }
      get('status').textContent = 'Waiting for camera access…';
      const stream = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480}}});
      if (generation !== epoch) { stream.getTracks().forEach(track=>track.stop()); return; }
      s.stream = stream;
      stream.getVideoTracks()[0].addEventListener('ended',()=>{if(session===s)stop('The camera disconnected.');});
      video.srcObject = stream;
      await video.play();
    } else { await photo.decode(); }
    if (generation !== epoch) return;
    get('status').textContent = 'Loading the hand detector…';
    const {HandLandmarker, FilesetResolver} = await import('./hands/vision_bundle.mjs');
    const files = await FilesetResolver.forVisionTasks(new URL('./hands/wasm/',import.meta.url).href.replace(/\/$/,''));
    if (generation !== epoch) return;
    const model = await HandLandmarker.createFromOptions(files, {
      baseOptions:{modelAssetPath:new URL('./hands/hand_landmarker.task',import.meta.url).href},
      runningMode:live ? 'VIDEO' : 'IMAGE', numHands:2,
      minHandDetectionConfidence:.73, minTrackingConfidence:.7
    });
    if (generation !== epoch) { model.close(); return; }
    s.model = model;
    connections = HandLandmarker.HAND_CONNECTIONS;
    if (live) {
      stage.classList.add('live');
      photo.hidden = true;
      video.hidden = false;
      get('pause').textContent = 'Pause streak';
      get('time').textContent = '0:00';
      get('grace').value = 1;
      get('session').hidden = false;
      get('status').textContent = 'Camera on. Raise a hand, then lower it to start a new streak.';
      s.frame = requestAnimationFrame(now=>liveFrame(s,now));
    } else {
      const {landmarks} = model.detect(photo);
      draw(landmarks,photo.naturalWidth,photo.naturalHeight);
      model.close();
      s.model = null;
      session = null;
      get('feed').textContent = 'Sample · '+landmarks.length+' hands';
      get('status').textContent = landmarks.length*21+' landmarks detected in the sample. Start your camera to track live.';
      sampleVisible = true;
      get('sample').textContent = 'Clear landmarks';
      get('sample').disabled = false;
    }
  } catch(error) { if (generation === epoch) stop(failure(error)); }
}
get('start').addEventListener('click',()=>session?.live ? stop() : start(true));
get('sample').addEventListener('click',()=>sampleVisible ? stop('Sample landmarks cleared.') : start(false));
get('pause').addEventListener('click',()=>{
  if (!session?.live) return;
  session.paused = !session.paused;
  get('pause').textContent = session.paused ? 'Resume streak' : 'Pause streak';
});
document.addEventListener('visibilitychange',()=>{if(document.hidden && session?.live) stop('Camera stopped while the page was hidden.');});
window.addEventListener('pagehide',()=>{if(session) stop();});
