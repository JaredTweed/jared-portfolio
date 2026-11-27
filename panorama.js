// Source-to-panorama homographies estimated from matching features in the displayed photographs.
const transforms = [[0.553389444, 0.000317955, -0.509958918, -0.005988515, 0.557669228, 9.412630665, -1.8906e-05, 3.4523e-05, 1.0], [0.428928841, -0.04726149, 69.29966741, -0.067612328, 0.388585028, 122.465937879, -0.000259405, -0.000315724, 1.0], [0.397558229, -0.029311944, 145.140466602, -0.095003186, 0.484802861, 41.516534855, -0.000512668, -9.0458e-05, 1.0], [0.303001555, -0.117529883, 227.486046431, -0.137005032, 0.402706762, 130.042959332, -0.000697623, -0.000287957, 1.0]];
const stage = document.querySelector('.stitch-stage');
const scene = stage.firstElementChild;
const frames = [...scene.querySelectorAll('.source-frame')];
const result = scene.querySelector('.stitch-result');
const slider = document.querySelector('#stitch-progress');
const play = document.querySelector('#stitch-play');
const state = document.querySelector('#stitch-state');
let animation;
function render(value) {
  const t = Math.min(1, value / 85);
  const eased = t*t*(3-2*t);
  frames.forEach((frame,index) => {
    const [a,b,c,d,e,f,g,h] = transforms[index];
    const x=256.8, y=22.5, scale=.7;
    const target=[scale*a+x*g,scale*d+y*g,0,g,scale*b+x*h,scale*e+y*h,0,h,0,0,1,0,scale*c+x,scale*f+y,0,1];
    const initial=[.46,0,0,0,0,.46,0,0,0,0,1,0,23+index*218,100,0,1];
    frame.style.transform='matrix3d('+initial.map((v,i)=>v+(target[i]-v)*eased).join(',')+')';
  });
  result.style.opacity=Math.max(0,(value-85)/15);
  slider.value=value;
  state.textContent=value===0?'Four source frames':value===100?'Stitched panorama':'Aligning frames';
  play.textContent=animation?'Pause':value===100?'Replay stitch':value===0?'Stitch frames':'Continue stitch';
}
function pause() {cancelAnimationFrame(animation);animation=0;}
slider.addEventListener('input',()=>{pause();render(Number(slider.value));});
play.addEventListener('click',()=>{
  let value=Number(slider.value);
  if(animation){pause();render(value);return;}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){render(value===100?0:100);return;}
  if(value===100)value=0;
  const start=performance.now()-value*38;
  function step(now){
    const progress=Math.min(100,(now-start)/38);
    animation=progress<100?requestAnimationFrame(step):0;
    render(progress);
  }
  animation=requestAnimationFrame(step);
});
new ResizeObserver(()=>{scene.style.transform='scale('+stage.clientWidth/900+')';}).observe(stage);
render(0);
