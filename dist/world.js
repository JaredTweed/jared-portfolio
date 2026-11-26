import * as T from './three.module.min.js';

export function makeWorld(stage, pins, onVisit) {
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({ alpha:true, antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  stage.append(renderer.domElement);
  const camera = new T.PerspectiveCamera(36, 1, .1, 160);
  const ambient = new T.HemisphereLight(0xe1edfb, 0x6d755a, 1.72);
  const sun = new T.DirectionalLight(0xffdfac, 3.1);
  sun.position.set(-16, 17, 7);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera,{left:-19,right:19,top:18,bottom:-18,far:56});
  sun.shadow.mapSize.set(1536,1536);
  sun.shadow.normalBias = .045;
  sun.shadow.bias=-.00024;
  sun.shadow.radius=2;
  scene.add(ambient,sun);
  const sky=new T.Mesh(new T.SphereGeometry(100,24,16),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,uniforms:{dusk:{value:0}},
    vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 direction;uniform float dusk;
    void main(){
      vec3 dir=normalize(direction);
      float h=smoothstep(-.06,.75,dir.y);
      vec3 day=mix(vec3(.69,.82,.85),vec3(.23,.48,.72),h);
      vec3 evening=mix(vec3(.54,.34,.32),vec3(.048,.087,.17),h);
      gl_FragColor=vec4(mix(day,evening,dusk),1.);
      #include <colorspace_fragment>
    }`
  }));
  sky.renderOrder=-2;sky.raycast=()=>{};scene.add(sky);

  let seed = 443;
  const random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0) / 4294967296);
  const vec = (x,y,z) => new T.Vector3(x,y,z);
  const rock = (x,z,cx,cz,width,h) => h*Math.exp(-((x-cx)**2+(z-cz)**2)/width);
  const stream = x => 1.25 + 1.1*Math.sin(x*.42);
  const outline = a => 1 + .34*Math.max(0,-Math.cos(a))**4 + .061*Math.sin(a*5+.2) + .045*Math.cos(a*8) + .039*Math.sin(a*3);
  const edge = (x,z) => Math.hypot(x/12,z/9)/outline(Math.atan2(z/9,x/12));
  function ground(x,z) {
    const rim = Math.min(1, Math.max(0,(1-edge(x,z))*5.5));
    const hills = rock(x,z,-6.7,-3.9,6,3.75)+rock(x,z,-2.9,-5.7,5,2.73)+rock(x,z,.5,-6.5,4,1.72)+rock(x,z,6,-4,9,.7);
    const banks = .89+ .14*Math.sin(x*1.05+z*.75)+.12*Math.cos(z*1.5-x*.34)+hills;
    const river = .19 + .055*Math.sin(x*.9);
    const lift = T.MathUtils.smoothstep(Math.abs(z-stream(x)), .38, 1.05);
    return rim*(river + (banks-river)*lift);
  }

  const flat = {flatShading:true};
  const material = (color, extra={}) => new T.MeshStandardMaterial({color,...flat,...extra});
  const materials = new Map();
  let landmark=null;
  function mesh(geometry,color,x,y,z,parent=scene) {
    if (!materials.has(color)) materials.set(color, material(color));
    const m = new T.Mesh(geometry, materials.get(color));
    m.userData.landmark=landmark;
    m.position.set(x,y,z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const cube = new T.BoxGeometry();
  function box(x,y,z,w,h,d,color,parent) {
    const m = mesh(cube,color,x,y,z,parent);
    m.scale.set(w,h,d);
    return m;
  }
  function beam(a,b,r,color,parent=scene,sides=6) {
    const delta=b.clone().sub(a);
    const p=a.clone().addScaledVector(delta,.5);
    const m=mesh(new T.CylinderGeometry(r,r,delta.length(),sides),color,p.x,p.y,p.z,parent);
    m.quaternion.setFromUnitVectors(vec(0,1,0),delta.normalize());
    return m;
  }
  const groundLight=document.createElement('canvas');groundLight.width=groundLight.height=512;
  const occlusion=groundLight.getContext('2d');
  occlusion.fillStyle='#fff';occlusion.fillRect(0,0,512,512);
  function contactShade(x,z,rx,rz,density){
    occlusion.save();
    occlusion.translate(256+x*12.8,256+z*12.8);
    occlusion.scale(rx*12.8,rz*12.8);
    const falloff=occlusion.createRadialGradient(0,0,0,0,0,1);
    falloff.addColorStop(0,'rgba(0,0,0,'+density+')');
    falloff.addColorStop(.45,'rgba(0,0,0,'+density*.66+')');
    falloff.addColorStop(1,'rgba(0,0,0,0)');
    occlusion.fillStyle=falloff;occlusion.fillRect(-1,-1,2,2);occlusion.restore();
  }
  const groundAO=new T.CanvasTexture(groundLight);
  function triangleMesh(vertices,colors) {
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geo.computeVertexNormals();
    const coords=[];
    for(let i=0;i<vertices.length;i+=3)coords.push(.5+vertices[i]/40,.5-vertices[i+2]/40);
    geo.setAttribute('uv',new T.Float32BufferAttribute(coords,2));
    const m=new T.Mesh(geo,material(0xffffff,{vertexColors:true,side:T.DoubleSide,aoMap:groundAO,aoMapIntensity:1}));
    m.receiveShadow=true;
    m.castShadow=true;
    scene.add(m);
    return geo.attributes.color;
  }
  const verts=[], colors=[], winterColors=[];
  const frost=new T.Color('#e9f5ee');
  const soil=['#776150','#a88262','#bd9d74','#796454','#906d53'];
  const greens=['#5b814e','#648d50','#72985b','#779455','#829c5b','#5f8b59','#8ea469'];
  const grassColors=greens.map(c=>new T.Color(c));
  function face(a,b,c,side=false) {
    verts.push(...a,...b,...c);
    const height=(a[1]+b[1]+c[1])/3;
    const slope=Math.max(a[1],b[1],c[1])-Math.min(a[1],b[1],c[1]);
    const mx=(a[0]+b[0]+c[0])/3,mz=(a[2]+b[2]+c[2])/3;
    const patch=.5+.24*Math.sin(mx*.72+mz*.23)+.18*Math.cos(mz*1.2-mx*.31);
    const base=side ? soil[Math.min(soil.length-1,Math.floor(patch*soil.length))] : height>2.9 && slope>.15 ? '#8c947d' : height<.29 ? '#a0a574' : grassColors[Math.min(greens.length-1,Math.floor(patch*greens.length))];
    const color=new T.Color(base).multiplyScalar(.97+random()*.065);
    for(let n=0;n<3;n++) colors.push(color.r,color.g,color.b);
    const winter=side ? color : color.clone().lerp(frost,.64+T.MathUtils.clamp(height*.095,0,.28));
    for(let n=0;n<3;n++) winterColors.push(winter.r,winter.g,winter.b);
  }
  const rings=42, sides=140;
  const grid=Array.from({length:rings+1},(_,r)=>Array.from({length:sides},(_,i)=>{
    const a=i/sides*Math.PI*2;
    const radius=r/rings*outline(a);
    const x=12*radius*Math.cos(a), z=9*radius*Math.sin(a);
    return [x,ground(x,z),z];
  }));
  for(let r=0;r<rings;r++) for(let i=0;i<sides;i++) {
    const j=(i+1)%sides;
    face(grid[r][i],grid[r+1][j],grid[r+1][i]);
    if(r) face(grid[r][i],grid[r][j],grid[r+1][j]);
  }
  const rim=grid[rings];
  const shelf=rim.map(([x,,z],i)=>{
    const apron=1.019+.017*Math.sin(i*.24);
    return [x*apron,-.63+.14*Math.sin(i*.3),z*apron];
  });
  const floor=rim.map(([x,,z],i)=>[x*1.045,-1.65+.15*Math.sin(i*.22),z*1.045]);
  for(let i=0;i<sides;i++) {
    const j=(i+1)%sides;
    face(rim[i],rim[j],shelf[i],true);face(shelf[i],rim[j],shelf[j],true);
    face(shelf[i],shelf[j],floor[i],true);face(floor[i],shelf[j],floor[j],true);
    face(floor[i],floor[j],[0,-1.68,0],true);
  }
  const terrainColor=triangleMesh(verts,colors);

  // A continuous water surface catches the sky and breaks into pale surf at the shore.
  const seaMaterial=new T.ShaderMaterial({
    uniforms:{clock:{value:0},night:{value:0},sunDirection:{value:new T.Vector3()}},
    vertexShader:`varying vec2 water; void main(){water=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 water;uniform float clock;uniform float night;uniform vec3 sunDirection;
    void main(){
      vec2 p=vec2(water.x,-water.y);float a=atan(p.y/9.,p.x/12.);
      float coast=1.+.34*pow(max(0.,-cos(a)),4.)+.061*sin(5.*a+.2)+.045*cos(8.*a)+.039*sin(3.*a);
      float d=length(p/vec2(12.,9.))/coast-1.;
      float wave=sin(p.x*3.2+p.y*5.4+sin(p.x*1.1-clock*.4)+clock*.85);
      float chop=sin(p.y*9.-p.x*.8+clock*.66+1.4*sin(p.x*2.+sin(p.y*.84))+2.1*sin(p.y*.72+p.x*.44));
      vec3 color=mix(vec3(.065,.24,.27),vec3(.23,.49,.44),exp(-max(0.,d)*3.8));
      color+=.024*wave+.012*chop;
      float crest=smoothstep(1.3,1.83,wave+chop);
      color+=vec3(.095,.085,.062)*crest*exp(-length(p)*.035);
      float foam=1.-smoothstep(.008,.025,abs(d-.046-.009*wave));
      color=mix(color,vec3(.74,.84,.70),foam*.78);
      color=mix(color,vec3(.58,.74,.71),smoothstep(15.,60.,length(p))*.8);
      color*=mix(vec3(1.),vec3(.29,.43,.58),night);
      vec3 view=normalize(cameraPosition-vec3(p.x,-.83,p.y));
      vec3 normal=normalize(vec3(.063*cos(p.x*3.2+p.y*5.4+clock*.85)+.029*chop,1.,.09*wave+.047*chop));
      float fresnel=pow(1.-max(0.,dot(normal,view)),4.);
      color=mix(color,mix(vec3(.65,.80,.84),vec3(.40,.29,.32),night),.54*fresnel);
      float shine=pow(max(dot(normal,normalize(view+sunDirection)),0.),68.);
      color+=mix(vec3(.74,.65,.42),vec3(.88,.39,.13),night)*shine;
      gl_FragColor=vec4(color,1.);
      #include <colorspace_fragment>
    }`
  });
  const sea=new T.Mesh(new T.PlaneGeometry(230,230),seaMaterial);
  sea.rotation.x=-Math.PI/2;sea.position.y=-.83;scene.add(sea);

  function rawRoadHeight(route,u){
    const p=route.getPointAt(u),d=route.getTangentAt(u);
    const length=Math.hypot(d.x,d.z)||1, nx=d.z/length*.64,nz=-d.x/length*.64;
    return Math.max(p.y,ground(p.x,p.z),ground(p.x+nx,p.z+nz),ground(p.x-nx,p.z-nz))+.042;
  }
  function ribbon(path,width,color,offset=.045,lateral=0,road=false) {
    const vertices=[];
    for(let i=0;i<=160;i++){
      const u=i/160;
      const p=path.getPointAt(u), d=path.getTangentAt(u);
      for(const sign of [-1,1]){
        const shift=(lateral+sign*width/2)/(Math.hypot(d.x,d.z)||1);
        const x=p.x+d.z*shift,z=p.z-d.x*shift;
        vertices.push(x,(road?roadHeight(path,u):Math.max(p.y,ground(x,z)))+offset,z);
      }
    }
    const indices=[];
    for(let i=0;i<320;i+=2) indices.push(i,i+1,i+2,i+2,i+1,i+3);
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const m=mesh(geometry,color,0,0,0);
    m.material.side=T.DoubleSide;
    m.castShadow=false;
    return m;
  }
  const path = points => new T.CatmullRomCurve3(points.map(([x,z,y=0])=>vec(x,y,z)));
  function riverMouth(direction){
    let x=0;
    while(edge(x,stream(x))<.995)x+=direction*.08;
    return x;
  }
  const inlet=riverMouth(-1), outlet=riverMouth(1);
  const river=path(Array.from({length:39},(_,i)=>{
    const x=T.MathUtils.lerp(inlet,outlet,i/38);
    return [x,stream(x),.32];
  }));
  for(let i=-3;i<=3;i++){
    const z=stream(outlet)+i*.115;
    const drop=1.6+.23*Math.cos(i*1.3);
    box(outlet,.33-drop/2,z,.17,drop,.135,i%2?'#79c6ba':'#a4d6c6');
  }
  ribbon(river,.93,'#459f9b',.011);
  ribbon(river,.57,'#66bfb2',.018);
  const ripples=[];
  for(let i=0;i<28;i++){
    const m=box(0,0,0,.17+random()*.38,.009,.027,i%4===0?'#cae4c8':'#8bd1bd');
    m.castShadow=false;
    ripples.push(m);
  }

  const routes=[
    path([[-9,-.3],[-6,-.9],[-3,-1.68],[0,-1.15],[2.7,-.65],[5,-.8],[8,-1.3]]),
    path([[1.4,-1.15],[1.2,.1,.89],[1.2,1.8,.89],[1.55,3.3],[3.8,4.1],[7,3.7],[8.6,2.8]]),
    path([[8,-1.3],[8.2,-2.7],[7,-4.3],[5.4,-4.95]])
  ];
  const profiles=new Map();
  for(const route of routes){
    const count=160, interval=route.getLength()/count;
    const heights=Array.from({length:count+1},(_,i)=>rawRoadHeight(route,i/count));
    // Raise the approaches gradually so the bridge deck meets both banks.
    for(let i=1;i<=count;i++)heights[i]=Math.max(heights[i],heights[i-1]-interval*.22);
    for(let i=count-1;i>=0;i--)heights[i]=Math.max(heights[i],heights[i+1]-interval*.22);
    profiles.set(route,heights.map((v,i)=>
      (heights[Math.max(0,i-1)]+v*2+heights[Math.min(count,i+1)])/4
    ));
  }
  // Match the branch and the main road at the junction, including the turning area.
  const junction=routes[1].getPointAt(0);
  const mainSamples=routes[0].getSpacedPoints(160);
  const meetingIndex=mainSamples.reduce((best,p,i)=>
    p.distanceToSquared(junction)<mainSamples[best].distanceToSquared(junction)?i:best,0);
  const junctionHeight=Math.max(profiles.get(routes[0])[meetingIndex],profiles.get(routes[1])[0]);
  for(const [route,center,span] of [[routes[0],meetingIndex,15],[routes[1],0,22]]){
    const heights=profiles.get(route);
    for(let i=Math.max(0,center-span);i<=Math.min(160,center+span);i++){
      const fade=T.MathUtils.smoothstep(Math.abs(i-center)/span,.46,1);
      heights[i]=T.MathUtils.lerp(junctionHeight,heights[i],fade);
    }
  }
  function roadHeight(route,u){
    const heights=profiles.get(route),index=T.MathUtils.clamp(u,0,1)*(heights.length-1);
    return T.MathUtils.lerp(heights[Math.floor(index)],heights[Math.ceil(index)],index%1);
  }
  landmark='maps';
  routes.forEach(r=>{
    ribbon(r,1.36,'#afa890',0,0,true);
    ribbon(r,1.26,'#414c50',.014,0,true);
    for(const side of [-1,1]){
      ribbon(r,.245,'#308b71',.022,side*.493,true);
      ribbon(r,.028,'#ececd8',.031,side*.359,true);
    }
    for(let i=1;i<Math.floor(r.getLength()/.55);i++){
      const p=r.getPointAt(i*.55/r.getLength()), d=r.getTangentAt(i*.55/r.getLength());
      const m=box(p.x,roadHeight(r,i*.55/r.getLength())+.03,p.z,.24,.012,.036,'#e7dca8');
      m.rotation.y=-Math.atan2(d.z,d.x);
      m.castShadow=false;
    }
  });
  const stencil=document.createElement('canvas');
  stencil.width=128;stencil.height=80;
  const paint=stencil.getContext('2d');
  paint.strokeStyle='#fffcea';paint.lineWidth=6;paint.lineJoin='round';
  for(const x of [24,95]){
    paint.beginPath();paint.arc(x,52,18,0,Math.PI*2);paint.stroke();
  }
  paint.beginPath();paint.moveTo(24,52);paint.lineTo(44,24);paint.lineTo(59,52);
  paint.closePath();paint.moveTo(59,52);paint.lineTo(81,24);paint.lineTo(44,24);
  paint.moveTo(95,52);paint.lineTo(77,12);paint.lineTo(88,12);paint.stroke();
  const stencilMap=new T.CanvasTexture(stencil);
  const marking=new T.MeshBasicMaterial({map:stencilMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const markingPlane=new T.PlaneGeometry(.32,.197);
  for(const route of routes)for(const u of [.18,.52,.84])for(const side of [-1,1]){
    const p=route.getPointAt(u),d=route.getTangentAt(u),n=Math.hypot(d.x,d.z);
    const symbol=new T.Mesh(markingPlane,marking);
    const slope=(roadHeight(route,u+.003)-roadHeight(route,u-.003))/(.006*route.getLength());
    const along=vec(d.x/n,slope,d.z/n).multiplyScalar(-side).normalize();
    const across=vec(along.z,0,-along.x).normalize();
    symbol.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(along,across,along.clone().cross(across)));
    symbol.position.set(p.x+side*d.z/n*.493,roadHeight(route,u)+.035,p.z-side*d.x/n*.493);
    symbol.userData.landmark='maps';scene.add(symbol);
  }
  for(const side of [-1,1]){
    let previous=null;
    const route=routes[1];
    for(let i=0;i<=12;i++){
      const u=.115+i*.014,p=route.getPointAt(u),d=route.getTangentAt(u),n=Math.hypot(d.x,d.z);
      const x=p.x+side*d.z/n*.71,z=p.z-side*d.x/n*.71,y=roadHeight(route,u);
      const top=vec(x,y+.24,z);
      if(previous){
        beam(previous,top,.029,'#d6c9ac');
        beam(previous.clone().add(vec(0,-.31,0)),top.clone().add(vec(0,-.31,0)),.072,'#887b68');
      }
      if(i%3===0)beam(vec(x,Math.min(y-.09,ground(x,z)),z),top,.04,'#a3987d');
      previous=top;
    }
  }
  const cars=routes.map((route,i)=>{
    const group=new T.Group();
    box(0,.095,0,.49,.15,.24,['#b55a39','#e3bd61','#e2dfc7'][i],group);
    box(-.026,.198,0,.22,.09,.196,'#334f50',group);
    for(const x of [-.14,.14]) for(const z of [-.115,.115]) box(x,.04,z,.11,.09,.05,'#293a37',group);
    scene.add(group);
    group.traverse(object=>{object.castShadow=false});
    return {route,group};
  });

  const cyclists=routes.map((route,i)=>{
    const bike=new T.Group();
    const tire=new T.TorusGeometry(.092,.014,5,14);
    for(const x of [-.16,.16])mesh(tire,'#283739',x,.097,0,bike);
    const rear=vec(-.16,.097,0),front=vec(.16,.097,0),seat=vec(-.055,.246,0),pedal=vec(.015,.095,0);
    const bar=vec(.099,.235,0);
    for(const [a,b] of [[rear,seat],[seat,pedal],[rear,pedal],[pedal,bar],[bar,front],[seat,bar]])
      beam(a,b,.014,'#da9646',bike);
    beam(seat,vec(.031,.375,0),.053,['#c85230','#d79538','#ab4349'][i],bike);
    mesh(new T.SphereGeometry(.051,9,7),'#f0dcb5',.047,.425,0,bike);
    beam(vec(.025,.32,0),bar,.018,'#b88767',bike);
    beam(seat,vec(.03,.17,.038),.023,'#354b53',bike);
    beam(vec(.03,.17,.038),pedal,.018,'#354b53',bike);
    bike.traverse(part=>{part.castShadow=false});
    scene.add(bike);return bike;
  });

  landmark=null;
  const trunk=material('#6e5740'), pineColors=['#285743','#3c6d4e','#487753','#679157','#346950'];
  const pines=[];
  function firCrown(radius,height){
    const points=[];
    for(let tier=0;tier<5;tier++){
      const t=tier/5, skirt=radius*(1-t*.84), base=(t-.5)*height;
      for(let j=0;j<16;j++){
        const a=j*Math.PI/8+tier*.71,b=a+Math.PI/8;
        const branch=(angle,k)=>{
          const reach=skirt*(k%2?.68:1+.07*Math.cos(k+tier));
          return [Math.cos(angle)*reach,base+(k%2?.075:-.04)*height,Math.sin(angle)*reach];
        };
        points.push(...branch(a,j),.015,Math.min(height*.54,base+.39*height),0,...branch(b,j+1)); // outward-facing needles

      }
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(points,3));
    geo.computeVertexNormals();return geo;
  }
  const treeLower=firCrown(.61,1.42),treeUpper=firCrown(.40,1.17);
  const trunkGeometry=new T.CylinderGeometry(.065,.1,.51,5);
  const blocked=[[6.1,5.65,1.95],[-9,4.4,1.75],[-11,-2.6,2.1],[-5.2,3.8,2],[5.2,-2.6,3.05],[-.6,5.25,1.65],[5,-5.6,1.45]];
  const roadSamples=routes.flatMap(route=>route.getSpacedPoints(40));
  for(let n=0;n<1200 && pines.length<205;n++){
    const x=(random()-.5)*24,z=(random()-.5)*18,y=ground(x,z);
    if(edge(x,z)>.92||Math.abs(z-stream(x))<.92||y>2.67||blocked.some(([a,b,r])=>Math.hypot(x-a,z-b)<r))continue;
    if(roadSamples.some(v=>Math.hypot(x-v.x,z-v.z)<.96))continue;
    if(pines.some(t=>Math.hypot(x-t.x,z-t.z)<.39)) continue;
    pines.push({x,y,z,s:.41+random()*.85,a:random()*6.28,c:new T.Color(pineColors[Math.floor(random()*pineColors.length)])});
  }
  for(const pine of pines)contactShade(pine.x,pine.z,pine.s*.95,pine.s*.87,.81);
  const dummy=new T.Object3D();
  const winterFoliage=[];
  for(const [geometry,offset,mat,variation] of [[trunkGeometry,.23,trunk,false],[treeLower,.89,material(0xffffff),true],[treeUpper,1.43,material(0xffffff),true]]){
    const inst=new T.InstancedMesh(geometry,mat,pines.length);
    inst.castShadow=true;inst.receiveShadow=true;
    pines.forEach((p,i)=>{
      dummy.position.set(p.x,p.y+offset*p.s,p.z);
      dummy.scale.setScalar(p.s);
      dummy.rotation.y=p.a;dummy.updateMatrix();
      inst.setMatrixAt(i,dummy.matrix);
      if(variation) inst.setColorAt(i,p.c.clone().multiplyScalar(offset>1?1.16:.9));
    });
    scene.add(inst);
    if(variation)winterFoliage.push([inst,offset>1?1.16:.9]);
  }
  const boulder=new T.DodecahedronGeometry(1);
  const shoreStones=new T.InstancedMesh(boulder,material('#ffffff'),130);
  const stonePalette=['#818780','#747c78','#99a198','#a29d8e'];
  for(let i=0;i<shoreStones.count;i++){
    const cluster=Math.floor(i/10),angle=cluster*2.39996+(random()-.5)*.24;
    const radius=outline(angle)*(1.027+random()*.05);
    const scale=.07+random()**2*.42;
    dummy.position.set(12*radius*Math.cos(angle),-.78+scale*.16,9*radius*Math.sin(angle));
    dummy.scale.set(scale*1.4,scale*.67,scale);
    dummy.rotation.set(random()*.35,random()*6.28,random()*.23);
    dummy.updateMatrix();shoreStones.setMatrixAt(i,dummy.matrix);
    shoreStones.setColorAt(i,new T.Color(stonePalette[i%stonePalette.length]));
  }
  shoreStones.castShadow=true;shoreStones.receiveShadow=true;scene.add(shoreStones);
  for(let i=0;i<53;i++){
    const x=(random()-.5)*23,z=(random()-.5)*17,y=ground(x,z);
    if(edge(x,z)>.92||y<1.25||y>3.8||blocked.some(([a,b,r])=>Math.hypot(x-a,z-b)<r))continue;
    const m=mesh(boulder,y-.05>2.5?'#929985':'#839074',x,y,z);
    m.scale.set(.18+random()*.45,.12+random()*.25,.14+random()*.37);
    m.rotation.set(random(),random()*6,random());
  }

  function platform(x,z,w,d,color='#b1ab86'){
    contactShade(x,z,w*.82,d*.85,.9);
    const y=ground(x,z)+.15;
    box(x,y-.15,z,w,.3,d,color);
    return y;
  }
  landmark='weather';
  const wx=-5.4,wz=3.82,wy=platform(wx,wz,2.53,1.93);
  box(wx-.44,wy+.34,wz,.92,.7,.82,'#e9dbb6');
  const roof=mesh(new T.ConeGeometry(.78,.39,4), '#aa5539',wx-.44,wy+.87,wz);
  roof.rotation.y=Math.PI/4;
  box(wx-.47,wy+.28,wz+.416,.25,.49,.036,'#546a5b');
  box(wx-.1,wy+.4,wz+.42,.17,.19,.04,'#7eaeae');
  beam(vec(wx+.66,wy,wz-.17),vec(wx+.66,wy+1.75,wz-.17),.054,'#e5dfc3');
  for(let i=0;i<5;i++) mesh(new T.CylinderGeometry(.19,.13,.04,10),'#e4e5ca',wx+.66,wy+.99+i*.08,wz-.17);
  const cup=new T.Group();
  cup.position.set(wx+.66,wy+1.75,wz-.17);
  scene.add(cup);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3, p=vec(Math.cos(a)*.27,0,Math.sin(a)*.27);
    beam(vec(0,0,0),p,.023,'#f1e5c2',cup);
    mesh(new T.SphereGeometry(.084,8,5),'#bd6441',p.x,0,p.z,cup);
  }
  for(const x of [wx-.99,wx+1.11]) for(const z of [wz-.86,wz+.86]) box(x,wy+.16,z,.06,.39,.06,'#eee3be');

  landmark='city';
  const buildings=[
    [3.4,-2.68,1.23,1.5,.94,'#d29962'],[4.85,-2.75,1.2,2.64,1.04,'#dfd9b5'],
    [6.22,-2.6,1.03,1.91,1,'#609291'],[7.36,-2.86,.78,1.22,.76,'#bd7454'],
    [3.65,-4.02,1,1.1,.87,'#dbc29b'],[5.1,-4.17,1.05,1.56,.8,'#83a6a0'],
    [6.53,-4.13,1.08,1.35,.76,'#cfa06b'],[5.86,.12,1.25,.65,.76,'#d2b485'],
    [3.74,.04,.88,.81,.66,'#b47558']
  ];
  for(const [x,z,w,h,d,c] of buildings){
    const y=platform(x,z,w+.29,d+.35,'#a9ac90');
    box(x,y+h/2,z,w,h,d,c);
    const entrance=z+d/2;
    box(x,y+.13,entrance+.021,w*.24,.26,.05,'#36534d');
    box(x,y+.28,entrance+.079,w*.35,.037,.18,'#e6d1ac');
    box(x,y+.018,entrance+.09,w*.35,.034,.18,'#b6aa92');
    box(x+w*.27,y+.049,entrance+.055,w*.18,.10,.12,'#977e5a');
    mesh(new T.IcosahedronGeometry(w*.10,0),'#577a4f',x+w*.27,y+.128,entrance+.055);
    box(x,y+h,z,w+.11,.13,d+.11,'#eee0bb');
    box(x+.11,y+h+.1,z-.09,w*.55,.17,d*.52,'#6b8176');
    for(let level=.31;level<h-.12;level+=.33){
      for(const a of [-.28,0,.28]) box(x+w*a,y+level,z+d/2+.013,.13,.142,.026,'#416d6b');
      for(const a of [-.25,.24]) box(x+w/2+.013,y+level,z+d*a,.029,.142,.14,'#4d7977');
    }
  }

  landmark='tower';
  const tx=-.32,tz=5.16,ty=platform(tx,tz,1.8,1.75,'#b2a582');
  const levels=[0,.65,1.31,1.96,2.62,3.27];
  function towerPoint(i,j){
    const a=j*Math.PI*2/3+.54,r=.55-levels[i]*.126;
    return vec(tx+Math.cos(a)*r,ty+levels[i],tz+Math.sin(a)*r);
  }
  for(let i=0;i<levels.length-1;i++) for(let j=0;j<3;j++){
    const a=towerPoint(i,j), b=towerPoint(i+1,j), c=towerPoint(i,(j+1)%3);
    beam(a,b,.053,i%2?'#ede1b6':'#b76447');
    beam(a,c,.03,'#d9c39e');
    beam(c,b,.026,'#d9c39e');
  }
  beam(vec(tx,ty+3.15,tz),vec(tx,ty+3.96,tz),.034,'#e5d0a2');
  mesh(new T.IcosahedronGeometry(.085,1),'#e88b60',tx,ty+3.97,tz);
  for(let j=0;j<3;j++){
    const a=j*2.094;
    box(tx+Math.cos(a)*.28,ty+3.19,tz+Math.sin(a)*.28,.135,.62,.13,'#ede9cd');
  }
  box(tx+.54,ty+.21,tz+.35,.43,.42,.39,'#698b7d');

  landmark='satellite';
  const satellite=new T.Group();
  scene.add(satellite);
  satellite.position.set(-.25,6.6,-5.2);
  satellite.rotation.set(.33,.25,-.24);
  box(0,0,0,.61,.56,.59,'#d9ad68',satellite);
  box(0,.31,0,.52,.12,.55,'#e6e2cd',satellite);
  beam(vec(-1.9,0,0),vec(1.9,0,0),.05,'#d6c49c',satellite);
  for(const dir of [-1,1]){
    box(dir*1.24,0,0,1.3,.075,.78,'#a3ad9f',satellite);
    for(let col=0;col<4;col++) for(let row=0;row<3;row++)
      box(dir*(.79+col*.3),.046,(row-1)*.237,.268,.026,.205,'#365c72',satellite);
  }
  const dish=mesh(new T.CylinderGeometry(.36,.14,.15,16),'#ede9d3',0,0,.36,satellite);
  dish.rotation.x=Math.PI/2;
  beam(vec(0,0,.37),vec(0,0,.71),.033,'#d2bf95',satellite);

  landmark=null;
  const radioCurve=new T.CatmullRomCurve3([vec(-.25,6.2,-4.8),vec(-1,5.6,-1.3),vec(-.7,5.4,2.4),vec(tx,ty+3.95,tz)]);
  const telemetry=new T.CatmullRomCurve3([vec(wx,wy+1.4,wz),vec(-3,3.1,4.9),vec(tx,ty+3,tz),vec(2,4.4,1.4),vec(5,3.5,-2.5)]);
  const signals=[radioCurve,telemetry].map((curve,i)=>{
    const line=new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(90)),new T.LineDashedMaterial({color:i?0xfff0aa:0xe5fcba,transparent:true,opacity:.54,dashSize:.16,gapSize:.14}));
    line.computeLineDistances();scene.add(line);
    const dots=Array.from({length:5},()=>{const m=new T.Mesh(new T.IcosahedronGeometry(.065,1),new T.MeshBasicMaterial({color:i?0xffcf74:0xd7ffb7}));scene.add(m);return m});
    return {curve,line,dots};
  });
  const cloudCanvas=document.createElement('canvas');
  cloudCanvas.width=256;cloudCanvas.height=128;
  const cloudInk=cloudCanvas.getContext('2d');
  for(let i=0;i<140;i++){
    const x=30+random()*196;
    const envelope=Math.sin((x-30)/196*Math.PI);
    const y=72-envelope*(8+random()*27)+random()*18;
    const radius=11+random()*16;
    const shade=Math.floor(219+(72-y)*.57);
    const glow=cloudInk.createRadialGradient(x,y,0,x,y,radius);
    glow.addColorStop(0,'rgba('+shade+','+(shade+3)+','+(shade+2)+',.34)');
    glow.addColorStop(1,'rgba(247,249,245,0)');
    cloudInk.fillStyle=glow;cloudInk.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  const cloudTexture=new T.CanvasTexture(cloudCanvas);
  cloudTexture.colorSpace=T.SRGBColorSpace;
  const cloudMat=new T.SpriteMaterial({map:cloudTexture,transparent:true,depthWrite:false});
  const clouds=[[-8,5.25,-6.4],[7.5,6.1,-7.5],[-12,4.5,3.9],[10,5.3,5.9]].map(([x,y,z],i)=>{
    const group=new T.Sprite(cloudMat);group.scale.set(4.2+i*.23,2.1+i*.115,1);
    scene.add(group);return {group,x,y,z,i};
  });

  landmark='vision';
  const labX=-11, labZ=-2.6, labY=platform(labX,labZ,2.85,2.1);
  box(labX,labY+.49,labZ,2.25,.98,1.6,'#ca9870');
  box(labX,labY+1,labZ,2.44,.12,1.76,'#e9dec6');
  mesh(new T.SphereGeometry(.74,16,9,0,Math.PI*2,0,Math.PI/2),'#7fa9a5',labX-.35,labY+1.06,labZ);
  beam(vec(labX-.35,labY+1.4,labZ),vec(labX-.12,labY+1.96,labZ+.65),.16,'#3a5962');
  for(const dx of [-.69,-.22,.25,.72]) box(labX+dx,labY+.55,labZ+.81,.32,.38,.04,'#406768');
  const labFocus=vec(labX,labY+.92,labZ);
  // The archive porch faces the river and the terminal faces the southern road.
  landmark='archive';
  const ax=-9, az=4.4, ay=platform(ax,az,2.7,1.85);
  box(ax,ay+.51,az,2.16,1.02,1.38,'#936847');
  const archiveRoof=mesh(new T.ConeGeometry(1,.63,4),'#456e68',ax,ay+1.29,az);
  archiveRoof.rotation.y=Math.PI/4;archiveRoof.scale.set(1.84,1,1.35);
  for(const dx of [-.67,.68]){
    box(ax+dx,ay+.58,az+.705,.41,.46,.035,'#bed9c8');
    box(ax+dx,ay+.58,az+.73,.035,.46,.03,'#654a39');
  }
  box(ax,ay+.4,az+.71,.37,.81,.05,'#3e5b4c');
  for(const dx of [-1,1])beam(vec(ax+dx,ay,az+.86),vec(ax+dx,ay+1.04,az+.86),.046,'#e9d3a1');
  landmark='terminal';
  const hx=6.1,hz=5.65,hy=platform(hx,hz,2.9,1.8);
  box(hx,hy+.46,hz,2.32,.92,1.32,'#d8b88a');
  box(hx,hy+.98,hz,2.68,.16,1.65,'#aa6249');
  for(const dx of [-.78,-.35,.08,.51])box(hx+dx,hy+.54,hz+.673,.31,.41,.04,'#598382');
  box(hx+.91,hy+.43,hz+.69,.29,.83,.05,'#365851');
  const clock=mesh(new T.CylinderGeometry(.31,.31,.09,16),'#f2e9c8',hx,hy+1.28,hz+.49);
  clock.rotation.x=Math.PI/2;
  beam(vec(hx,hy+1.28,hz+.55),vec(hx,hy+1.49,hz+.55),.022,'#354f43');
  beam(vec(hx,hy+1.28,hz+.55),vec(hx+.12,hy+1.22,hz+.55),.021,'#354f43');
  ribbon(path([[6.1,4.82],[6.25,4.5],[6.53,3.84]]),.42,'#c4b58c',.08);
  ribbon(path([[-9,3.63],[-8,3.35],[-7,3.65],[-6.3,3.8]]),.37,'#c4b58c',.065);
  const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=64;
  const haloInk=haloCanvas.getContext('2d');
  const halo=haloInk.createRadialGradient(32,32,0,32,32,32);
  halo.addColorStop(0,'rgba(255,227,168,.86)');halo.addColorStop(.16,'rgba(255,194,121,.32)');
  halo.addColorStop(.5,'rgba(255,179,106,.095)');halo.addColorStop(1,'rgba(255,171,94,0)');
  haloInk.fillStyle=halo;haloInk.fillRect(0,0,64,64);
  const haloMaterial=new T.SpriteMaterial({map:new T.CanvasTexture(haloCanvas),transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:0});
  const streetLights=[];
  for(const [x,z] of [[6.68,4.48],[7.25,4.39],[-8,3.09]]){
    const y=ground(x,z);
    beam(vec(x,y,z),vec(x,y+.83,z),.032,'#516553');
    mesh(new T.IcosahedronGeometry(.116,1),'#f3d39a',x,y+.85,z);
    const light=new T.PointLight(0xffc48a,0,3.3,2);
    light.position.set(x,y+.77,z);
    streetLights.push(light);scene.add(light);
    const glow=new T.Sprite(haloMaterial);glow.position.set(x,y+.85,z);glow.scale.setScalar(.84);scene.add(glow);
  }
  landmark=null;
  const bridge=routes[1];
  for(const u of [.091,.319]){
    const p=bridge.getPointAt(u), d=bridge.getTangentAt(u);
    for(const side of [-1,1]){
      const x=p.x+side*d.z*.81, z=p.z-side*d.x*.81, y=roadHeight(bridge,u);
      box(x,y+.14,z,.047,.28,.047,'#ddd3bb');
      box(x,y+.23,z,.052,.07,.052,'#c6803e');
    }
  }
  const bankRock=new T.DodecahedronGeometry(1);
  for(const x of [-.5,.02,.48,2.67,3.03,3.55,4.1,4.4]){
    for(const side of [-1,1]){
      const z=stream(x)+side*(.54+random()*.13), y=ground(x,z);
      const stone=mesh(bankRock,'#8d9385',x,y+.012,z);
      stone.scale.set(.13+random()*.15,.08+random()*.07,.13+random()*.11);
      stone.rotation.y=random()*6;
      for(let i=0;i<3;i++){
        const rx=x+i*.035, rz=z+side*.12, ry=ground(rx,rz);
        beam(vec(rx,ry,rz),vec(rx+.035,ry+.20+random()*.16,rz+side*.065),.009,'#727c40');
      }
    }
  }
  const anchors={
    archive:vec(ax,ay+1.8,az), terminal:vec(hx,hy+1.68,hz),
    vision:vec(labX,labY+2.3,labZ),
    weather:vec(wx,wy+1.8,wz),
    city:vec(6,3.75,-3.6),
    maps:vec(3.85,ground(3.85,4.05)+.59,4.05),
    satellite:satellite.position,
    tower:vec(tx,ty+3.4,tz)
  };
  const focus={
    archive:vec(ax,ay+.6,az), terminal:vec(hx,hy+.65,hz),
    vision:labFocus,
    weather:vec(wx,wy+.68,wz),
    city:vec(5.1,1.58,-3.05),
    maps:vec(1.75,.86,2.65),
    satellite:satellite.position,
    tower:vec(tx,ty+1.8,tz)
  };
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const target=vec(0,1.05,0), desired=target.clone();
  let angle=.61, elevation=.68, distance=37, zoom=37, width=1, height=1;
  let selected=null, dusk=false, behavior=null, zoomBounds=[8,105];
  function fit(){
    const aspect=width/height;
    return 37*Math.max(1,1.29/aspect);
  }
  function resize(){
    width=stage.clientWidth; height=stage.clientHeight;
    if(!width||!height)return;
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    zoomBounds=[8,Math.max(105,fit()*1.55)];
    if(!selected) zoom=fit();
    if(!selected) distance=zoom;
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  function go(id){
    selected=id;
    desired.copy(id ? focus[id] : vec(0,1.05,0));
    zoom=id ? (id==='satellite'?9.5:id==='city'?13.7:12.4)*Math.max(1, .85/camera.aspect) : fit();
    if(!id){angle=.61;elevation=.68}
  }
  function scale(factor){zoom=T.MathUtils.clamp(zoom*factor,...zoomBounds)}
  let drag=null;
  const surface=renderer.domElement;
  const touches=new Map();
  const raycaster=new T.Raycaster(), pointer=new T.Vector2();
  let tap=null;
  function pick(event){
    const bounds=surface.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/width*2-1,1-(event.clientY-bounds.top)/height*2);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(scene.children,true).find(hit=>hit.object.isMesh);
    return hit?.object.userData.landmark;
  }
  const spread=()=>{const [a,b]=touches.values();return Math.hypot(a.x-b.x,a.y-b.y)};
  surface.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    surface.setPointerCapture(e.pointerId);
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    drag={x:e.clientX,y:e.clientY};
    tap=touches.size===1?drag:null;
  });
  surface.addEventListener('pointermove',e=>{
    if(!touches.has(e.pointerId))return;
    if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>5)tap=null;
    const prev=touches.size===2?spread():0;
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touches.size===2 && prev>0) {
      scale(prev/Math.max(1,spread()));
    } else if(touches.size===1 && drag) {
      angle-=(e.clientX-drag.x)*.007;
      elevation=T.MathUtils.clamp(elevation+(e.clientY-drag.y)*.007,.27,1.37);
    }
    drag={x:e.clientX,y:e.clientY};
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']) surface.addEventListener(event,e=>{
    if(event==='pointerup'&&tap){const id=pick(e);if(id)onVisit(id)}
    tap=null;
    touches.delete(e.pointerId);drag=touches.values().next().value ?? null;
  });
  surface.addEventListener('wheel',e=>{e.preventDefault();scale(Math.exp(T.MathUtils.clamp(e.deltaY,-85,85)*.0033))},{passive:false});
  const projection=new T.Vector3();
  // Warm occupied rooms read individually against cooler reflected skylight.
  // Sky above and a darker land horizon give glazing and metal a reflection source.
  const skyProbe=document.createElement('canvas');
  skyProbe.width=256;skyProbe.height=128;
  const probeInk=skyProbe.getContext('2d');
  const skyGradient=probeInk.createLinearGradient(0,0,0,128);
  for(const [stop,color] of [[0,'#7faac9'],[.42,'#dfeaf0'],[.49,'#fce8c9'],[.54,'#758473'],[1,'#414c48']])
    skyGradient.addColorStop(stop,color);
  probeInk.fillStyle=skyGradient;probeInk.fillRect(0,0,256,128);
  const skyMap=new T.CanvasTexture(skyProbe);
  skyMap.mapping=T.EquirectangularReflectionMapping;skyMap.colorSpace=T.SRGBColorSpace;
  const reflectiveSurfaces=new Set();
  for(const [key,metalness,roughness] of [['#d9ad68',.74,.36],['#d6c49c',.66,.36],['#365c72',.42,.19],['#7fa9a5',.54,.43],['#459f9b',.18,.21],['#66bfb2',.18,.23]]){
    const surface=materials.get(key);
    if(surface){surface.envMap=skyMap;surface.metalness=metalness;surface.roughness=roughness;reflectiveSurfaces.add(surface)}
  }
  const siding=document.createElement('canvas');siding.width=128;siding.height=128;
  const grain=siding.getContext('2d');
  grain.fillStyle='#f8f6f0';grain.fillRect(0,0,128,128);
  for(let row=0;row<8;row++){
    grain.fillStyle='rgba(86,75,63,.19)';grain.fillRect(0,row*16,128,1);
    for(let stroke=0;stroke<26;stroke++){
      grain.fillStyle='rgba(117,92,72,.08)';
      grain.fillRect(random()*128,row*16+random()*15,5+random()*47,.7);
    }
  }
  const sidingMap=new T.CanvasTexture(siding);sidingMap.colorSpace=T.SRGBColorSpace;
  for(const key of ['#936847','#d8b88a','#e9dbb6']){
    const wall=materials.get(key);wall.map=sidingMap;wall.bumpMap=sidingMap;wall.bumpScale=.018;
  }
  const windowColors=['#416d6b','#4d7977','#7eaeae','#406768','#bed9c8','#598382'];
  const glazing=new Set(windowColors.map(color=>materials.get(color)));
  const interiorLights=[];
  let windowNumber=0;
  scene.traverse(object=>{
    if(!object.isMesh||!glazing.has(object.material))return;
    object.material.roughness=.3;object.material.envMap=skyMap;reflectiveSurfaces.add(object.material);
    if(++windowNumber%5===0)return;
    const original=object.material;
    const group=windowNumber%3;
    const key='room-'+original.uuid+'-'+group;
    if(!materials.has(key)){
      const glass=original.clone();
      glass.emissive.set(['#ffc88a','#e6b680','#ffe2b3'][group]);
      glass.emissiveIntensity=0;
      interiorLights.push(glass);reflectiveSurfaces.add(glass);materials.set(key,glass);
    }
    object.material=materials.get(key);
  });
  const lampBulb=materials.get('#f3d39a');
  lampBulb.emissive.set('#ffbc73');
  const skyDay=new T.Color('#deebfa'),skyNight=new T.Color('#99abc9');
  const cloudDay=new T.Color('#fffdf6'),cloudNight=new T.Color('#c4948c');
  const dayPosition=vec(-15,14,8),eveningPosition=vec(-19,8,-9);
  let lastShadowBlend=-1;
  groundAO.needsUpdate=true;
  const homeSun=new T.Color(0xffdeb4), duskSun=new T.Color(0xff9b6e);
  let blend=0, displayAngle=angle, displayElevation=elevation;
  let last=performance.now(), time=0, routeStart=0;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  let frameCount=0,sampleStart=performance.now();
  renderer.setAnimationLoop(now=>{
    // Adapt the 3D buffer independently of the full-resolution guide and map labels.
    if(++frameCount>=24){
      const elapsed=(now-sampleStart)/frameCount;
      const current=renderer.getPixelRatio();
      const ceiling=Math.min(devicePixelRatio,1.65);
      const next=elapsed>48?Math.max(.68,current*.82):elapsed<20?Math.min(ceiling,current+.09):current;
      if(Math.abs(current-next)>.04)renderer.setPixelRatio(next);
      frameCount=0;sampleStart=now;
    }
    const step=T.MathUtils.clamp((now-last)/1000,0,.05);
    last=now; if(!reduced.matches)time+=step;
    const amount=reduced.matches ? 1 : 1-Math.exp(-step*5.2);
    target.lerp(desired,amount);distance=T.MathUtils.lerp(distance,zoom,amount);
    displayAngle=T.MathUtils.lerp(displayAngle,angle,amount);
    displayElevation=T.MathUtils.lerp(displayElevation,elevation,amount);
    const horizontal=Math.cos(displayElevation)*distance;
    camera.position.set(target.x+Math.sin(displayAngle)*horizontal,target.y+Math.sin(displayElevation)*distance,target.z+Math.cos(displayAngle)*horizontal);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    blend=T.MathUtils.lerp(blend,dusk?1:0,amount);
    sun.color.copy(homeSun).lerp(duskSun,blend);
    sun.position.lerpVectors(dayPosition,eveningPosition,blend);
    if(Math.abs(blend-lastShadowBlend)>.055 || (Math.abs(blend-(dusk?1:0))<.001 && lastShadowBlend!==(dusk?1:0))){
      renderer.shadowMap.needsUpdate=true;
      lastShadowBlend=Math.abs(blend-(dusk?1:0))<.001?(dusk?1:0):blend;
    }
    sun.intensity=T.MathUtils.lerp(3.1,1.55,blend);
    ambient.color.copy(skyDay).lerp(skyNight,blend);
    for(const surface of reflectiveSurfaces)surface.envMapIntensity=T.MathUtils.lerp(.38,.14,blend);
    cloudMat.color.copy(cloudDay).lerp(cloudNight,blend);
    sky.material.uniforms.dusk.value=blend;
    seaMaterial.uniforms.sunDirection.value.copy(sun.position).normalize();
    for(const glass of interiorLights)glass.emissiveIntensity=blend*1.35;
    for(const light of streetLights)light.intensity=blend*3.2;
    lampBulb.emissiveIntensity=blend*2;haloMaterial.opacity=blend*.83;
    ambient.intensity=T.MathUtils.lerp(1.72,.92,blend);
    cup.rotation.y=time*(behavior==='gust'?8:2.4);
    satellite.position.y=6.6+Math.sin(time*.85)*.23;
    satellite.rotation.y=.25+Math.sin(time*.62)*.24;
    clouds.forEach(({group,x,y,z,i})=>group.position.set(x+Math.sin(time*.24+i)*.95,y+Math.cos(time*.26+i)*.13,z));
    ripples.forEach((m,i)=>{
      const u=(i/ripples.length+time*.083)%1, p=river.getPointAt(u);
      m.position.set(p.x,.351,p.z+Math.sin(i*13)*.25);
    });
    cars.forEach(({route,group},i)=>{
      const phase=(time*.045+i*.18)%2;
      const progress=phase<=1?phase:2-phase;
      const p=route.getPointAt(progress), d=route.getTangentAt(progress);
      const heading=phase>1?-1:1;
      group.position.set(p.x-heading*d.z*.16,roadHeight(route,progress)+.029,p.z+heading*d.x*.16);
      group.rotation.y=-Math.atan2(d.z,d.x)+(phase>1?Math.PI:0);
    });
    cyclists.forEach((bike,i)=>{
      const route=routes[i],guided=i===1&&behavior==='route';
      const phase=(time*.028+i*.41)%2;
      const u=guided?T.MathUtils.clamp((now-routeStart)/8000,0,1):1-Math.abs(1-phase);
      const dir=guided||phase<=1?1:-1;
      const p=route.getPointAt(u),d=route.getTangentAt(u),horizontal=Math.hypot(d.x,d.z);
      bike.position.set(p.x-dir*d.z/horizontal*.493,roadHeight(route,u)+.035,p.z+dir*d.x/horizontal*.493);
      if(guided&&!reduced.matches){desired.copy(bike.position);desired.y+=.32}
      bike.rotation.y=-Math.atan2(d.z,d.x)+(dir<0?Math.PI:0);
      const ahead=Math.min(1,u+.004),behind=Math.max(0,u-.004);
      bike.rotation.z=dir*Math.atan2(roadHeight(route,ahead)-roadHeight(route,behind),(ahead-behind)*route.getLength());
    });
    seaMaterial.uniforms.clock.value=time;
    seaMaterial.uniforms.night.value=blend;
    signals.forEach(({curve,line,dots},i)=>{
      const active=behavior===(i===0?'radio':'packet');
      line.material.opacity=active?.94:.47;
      dots.forEach((dot,j)=>{
        dot.position.copy(curve.getPointAt((time*(active?.59:.21)+j/dots.length)%1));
        dot.scale.setScalar(active?1.65:1);
      });
    });
    const visible=[];
    for(const [id,button] of Object.entries(pins)){
      projection.copy(anchors[id]).project(camera);
      const x=(projection.x*.5+.5)*width,y=(.5-projection.y*.5)*height;
      button.hidden=(behavior==='route'&&id==='maps')||(selected!==null&&selected!==id)||projection.z>1||x<15||x>width-15||y<32||y>height-26;
      if(!button.hidden)visible.push({button,x,y,w:button.offsetWidth,h:button.offsetHeight});
    }
    const placed=[];
    for(const label of visible.sort((a,b)=>b.y-a.y)){
      const {button,w,h}=label;
      const x=T.MathUtils.clamp(label.x,w/2+5,width-w/2-5);
      let bottom=label.y;
      for(const other of placed){
        if(Math.abs(other.x-x)<(other.w+w)/2+3 && bottom>other.top-4 && bottom-h<other.bottom+4)
          bottom=other.top-4;
      }
      placed.push({x,w,top:bottom-h,bottom});
      button.style.left=x+'px';button.style.top=bottom+'px';
      button.style.setProperty('--leader',Math.max(6,label.y-bottom+6)+'px');
    }
    renderer.render(scene,camera);
  });
  function setWinter(value){
    terrainColor.array.set(value? winterColors:colors);
    terrainColor.needsUpdate=true;
    for(const [mesh,shade] of winterFoliage){
      pines.forEach((p,i)=>{
        const color=p.c.clone().multiplyScalar(shade);
        if(value) color.lerp(frost,shade>1?.64:.28);
        mesh.setColorAt(i,color);
      });
      mesh.instanceColor.needsUpdate=true;
    }
  }
  return {go,scale,setWinter,setDusk:value=>{dusk=value},demo:value=>{behavior=value;if(value==='route'){routeStart=performance.now();zoom=8.4}}};
}
