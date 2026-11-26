const get = name => document.getElementById('hand-' + name);
const video = get('video');
const photo = get('photo');
const overlay = get('overlay');
const pen = overlay.getContext('2d');
const stage = overlay.parentElement;
let session = null;
let epoch = 0;
let connections;
let sampleVisible = false;
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
  video.pause();
  video.srcObject = null;
  video.hidden = true;
  photo.hidden = false;
  stage.classList.remove('live','detected');
  pen.clearRect(0,0,overlay.width,overlay.height);
  get('feed').textContent = 'Sample photograph';
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
    } catch(error) { stop(failure(error)); return; }
  }
  s.frame = requestAnimationFrame(time=>liveFrame(s,time));
}
async function start(live) {
  stop('');
  const generation = epoch;
  const s = {frame:0,lastInference:0,live};
  session = s;
  get('start').textContent = live ? 'Stop camera' : 'Start camera';
  get('sample').disabled = true;
  try {
    if (live) {
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
      get('status').textContent = 'Camera on. Hold a hand in view.';
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
document.addEventListener('visibilitychange',()=>{if(document.hidden && session?.live) stop('Camera stopped while the page was hidden.');});
window.addEventListener('pagehide',()=>{if(session) stop();});
