import * as T from './three.module.min.js';

export function makeWorld(stage, pins) {
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({ alpha:true, antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  stage.append(renderer.domElement);
  const camera = new T.PerspectiveCamera(36, 1, .1, 160);
  const ambient = new T.HemisphereLight(0xf4f6dc, 0x648e75, 2.05);
  const sun = new T.DirectionalLight(0xffdfac, 3.1);
  sun.position.set(-12, 20, 9);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera,{left:-19,right:19,top:18,bottom:-18,far:56});
  sun.shadow.mapSize.set(1536,1536);
  sun.shadow.normalBias = .045;
  scene.add(ambient,sun);

  let seed = 443;
  const random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0) / 4294967296);
  const vec = (x,y,z) => new T.Vector3(x,y,z);
  const rock = (x,z,cx,cz,width,h) => h*Math.exp(-((x-cx)**2+(z-cz)**2)/width);
  const stream = x => 1.25 + 1.1*Math.sin(x*.42);
  const outline = a => 1 + .061*Math.sin(a*5+.2) + .045*Math.cos(a*8) + .039*Math.sin(a*3);
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
  function mesh(geometry,color,x,y,z,parent=scene) {
    if (!materials.has(color)) materials.set(color, material(color));
    const m = new T.Mesh(geometry, materials.get(color));
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
  function triangleMesh(vertices,colors) {
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geo.computeVertexNormals();
    const m=new T.Mesh(geo,material(0xffffff,{vertexColors:true,side:T.DoubleSide}));
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
    const base=side ? soil[Math.floor(random()*soil.length)] : height>2.9 && slope>.15 ? '#8c947d' : height<.29 ? '#a0a574' : grassColors[Math.floor(random()*greens.length)];
    const color=new T.Color(base).multiplyScalar(.91+random()*.19);
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
  const shelf=rim.map(([x,,z],i)=>[x*.989,-.63+.14*Math.sin(i*.3),z*.989]);
  const floor=rim.map(([x,,z],i)=>[x*.945,-1.65+.15*Math.sin(i*.22),z*.945]);
  for(let i=0;i<sides;i++) {
    const j=(i+1)%sides;
    face(rim[i],rim[j],shelf[i],true);face(shelf[i],rim[j],shelf[j],true);
    face(shelf[i],shelf[j],floor[i],true);face(floor[i],shelf[j],floor[j],true);
    face(floor[i],floor[j],[0,-1.68,0],true);
  }
  const terrainColor=triangleMesh(verts,colors);

  function ribbon(path,width,color,offset=.045) {
    const vertices=[];
    for(let i=0;i<=160;i++){
      const u=i/160;
      const p=path.getPointAt(u), d=path.getTangentAt(u);
      for(const sign of [-1,1]){
        const x=p.x+sign*d.z*width/2,z=p.z-sign*d.x*width/2;
        vertices.push(x,Math.max(p.y,ground(x,z))+offset,z);
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
  const river=path(Array.from({length:23},(_,i)=>{const x=-10.95+i*.995;return [x,stream(x),.32]}));
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
  routes.forEach(r=>{
    ribbon(r,.86,'#c1b28a',.035);
    ribbon(r,.67,'#555e57',.096);
    for(let i=1;i<Math.floor(r.getLength()/.55);i++){
      const p=r.getPointAt(i*.55/r.getLength()), d=r.getTangentAt(i*.55/r.getLength());
      const m=box(p.x,Math.max(p.y,ground(p.x,p.z))+.111,p.z,.24,.012,.036,'#e7dca8');
      m.rotation.y=-Math.atan2(d.z,d.x);
      m.castShadow=false;
    }
  });
  for(const x of [.68,1.7]) {
    beam(vec(x,.99,.27),vec(x,.99,2.1),.04,'#d3c39b');
    for(const z of [.3,.86,1.46,2.06]) beam(vec(x,.49,z),vec(x,1,z),.043,'#ccb994');
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

  const trunk=material('#6e5740'), pineColors=['#285743','#3c6d4e','#487753','#679157','#346950'];
  const pines=[];
  const treeLower=new T.ConeGeometry(.63,1.4,7), treeUpper=new T.ConeGeometry(.46,1.24,7);
  const trunkGeometry=new T.CylinderGeometry(.065,.1,.51,5);
  const blocked=[[-5.2,3.8,2],[5.2,-2.6,3.05],[-.6,5.25,1.65],[5,-5.6,1.45]];
  const roadSamples=routes.flatMap(route=>route.getSpacedPoints(40));
  for(let n=0;n<1200 && pines.length<205;n++){
    const x=(random()-.5)*24,z=(random()-.5)*18,y=ground(x,z);
    if(edge(x,z)>.92||Math.abs(z-stream(x))<.92||y>2.67||blocked.some(([a,b,r])=>Math.hypot(x-a,z-b)<r))continue;
    if(roadSamples.some(v=>Math.hypot(x-v.x,z-v.z)<.62))continue;
    if(pines.some(t=>Math.hypot(x-t.x,z-t.z)<.39)) continue;
    pines.push({x,y,z,s:.41+random()*.85,a:random()*6.28,c:new T.Color(pineColors[Math.floor(random()*pineColors.length)])});
  }
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
  for(let i=0;i<53;i++){
    const x=(random()-.5)*23,z=(random()-.5)*17,y=ground(x,z);
    if(edge(x,z)>.92||y<1.25||y>3.8||blocked.some(([a,b,r])=>Math.hypot(x-a,z-b)<r))continue;
    const m=mesh(boulder,y-.05>2.5?'#929985':'#839074',x,y,z);
    m.scale.set(.18+random()*.45,.12+random()*.25,.14+random()*.37);
    m.rotation.set(random(),random()*6,random());
  }

  function platform(x,z,w,d,color='#b1ab86'){
    const y=ground(x,z)+.15;
    box(x,y-.15,z,w,.3,d,color);
    return y;
  }
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
    box(x,y+h,z,w+.11,.13,d+.11,'#eee0bb');
    box(x+.11,y+h+.1,z-.09,w*.55,.17,d*.52,'#6b8176');
    for(let level=.31;level<h-.12;level+=.33){
      for(const a of [-.28,0,.28]) box(x+w*a,y+level,z+d/2+.013,.13,.142,.026,'#416d6b');
      for(const a of [-.25,.24]) box(x+w/2+.013,y+level,z+d*a,.029,.142,.14,'#4d7977');
    }
  }

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

  const radioCurve=new T.CatmullRomCurve3([vec(-.25,6.2,-4.8),vec(-1,5.6,-1.3),vec(-.7,5.4,2.4),vec(tx,ty+3.95,tz)]);
  const telemetry=new T.CatmullRomCurve3([vec(wx,wy+1.4,wz),vec(-3,3.1,4.9),vec(tx,ty+3,tz),vec(2,4.4,1.4),vec(5,3.5,-2.5)]);
  const signals=[radioCurve,telemetry].map((curve,i)=>{
    const line=new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(90)),new T.LineDashedMaterial({color:i?0xfff0aa:0xe5fcba,transparent:true,opacity:.54,dashSize:.16,gapSize:.14}));
    line.computeLineDistances();scene.add(line);
    const dots=Array.from({length:5},()=>{const m=new T.Mesh(new T.IcosahedronGeometry(.10,1),new T.MeshBasicMaterial({color:i?0xffcf74:0xd7ffb7}));scene.add(m);return m});
    return {curve,line,dots};
  });
  const cloudGeo=new T.IcosahedronGeometry(1,2);
  const clouds=[[-8,4.7,-6.2],[7.5,5.3,-7.5],[-9.7,3.2,3.8],[9,4,4.3]].map(([x,y,z],i)=>{
    const group=new T.Group();
    for(let j=0;j<5;j++){
      const cloud=mesh(cloudGeo,'#dae8d9',(j-2)*.53,random()*.35,(random()-.5)*.4,group);
      cloud.scale.set(.7+random()*.48,.31+random()*.32,.52+random()*.33);
      cloud.castShadow=false;
    }
    scene.add(group);
    return {group,x,y,z,i};
  });

  const anchors={
    weather:vec(wx,wy+1.8,wz),
    city:vec(6,3.75,-3.6),
    maps:vec(3.85,ground(3.85,4.05)+.59,4.05),
    satellite:satellite.position,
    tower:vec(tx,ty+3.4,tz)
  };
  const focus={
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
  const spread=()=>{const [a,b]=touches.values();return Math.hypot(a.x-b.x,a.y-b.y)};
  surface.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    surface.setPointerCapture(e.pointerId);
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    drag={x:e.clientX,y:e.clientY};
  });
  surface.addEventListener('pointermove',e=>{
    if(!touches.has(e.pointerId))return;
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
    touches.delete(e.pointerId);drag=touches.values().next().value ?? null;
  });
  surface.addEventListener('wheel',e=>{e.preventDefault();scale(Math.exp(T.MathUtils.clamp(e.deltaY,-85,85)*.0033))},{passive:false});
  const projection=new T.Vector3();
  const homeSun=new T.Color(0xffdfac), duskSun=new T.Color(0xff9b6e);
  let blend=0, displayAngle=angle, displayElevation=elevation;
  let last=performance.now(), time=0, routeStart=0;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  renderer.setAnimationLoop(now=>{
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
    sun.intensity=T.MathUtils.lerp(3.1,1.4,blend);
    ambient.intensity=T.MathUtils.lerp(2.05,.92,blend);
    cup.rotation.y=time*(behavior==='gust'?8:2.4);
    satellite.position.y=6.6+Math.sin(time*.85)*.23;
    satellite.rotation.y=.25+Math.sin(time*.62)*.24;
    clouds.forEach(({group,x,y,z,i})=>group.position.set(x+Math.sin(time*.24+i)*.95,y+Math.cos(time*.26+i)*.13,z));
    ripples.forEach((m,i)=>{
      const u=(i/ripples.length+time*.083)%1, p=river.getPointAt(u);
      m.position.set(p.x,.351,p.z+Math.sin(i*13)*.25);
    });
    cars.forEach(({route,group},i)=>{
      const custom=i===1&&behavior==='route';
      const phase=(time*.045+i*.18)%2;
      const progress=custom?T.MathUtils.clamp((now-routeStart)/8000,0,1):phase<=1?phase:2-phase;
      const p=route.getPointAt(progress), d=route.getTangentAt(progress);
      group.position.set(p.x,Math.max(p.y,ground(p.x,p.z))+.102,p.z);
      group.rotation.y=-Math.atan2(d.z,d.x)+(phase>1&&!custom?Math.PI:0);
    });
    signals.forEach(({curve,line,dots},i)=>{
      const active=behavior===(i===0?'radio':'packet');
      line.material.opacity=active?.94:.47;
      dots.forEach((dot,j)=>{
        dot.position.copy(curve.getPointAt((time*(active?.59:.21)+j/dots.length)%1));
        dot.scale.setScalar(active?1.65:1);
      });
    });
    for(const [id,button] of Object.entries(pins)){
      projection.copy(anchors[id]).project(camera);
      const x=(projection.x*.5+.5)*width,y=(.5-projection.y*.5)*height;
      button.hidden=(selected!==null&&selected!==id)||projection.z>1||x<31||x>width-31||y<35||y>height-35;
      button.style.left=x+'px';button.style.top=y+'px';
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
  return {go,scale,setWinter,setDusk:value=>{dusk=value},demo:value=>{behavior=value;if(value==='route')routeStart=performance.now()}};
}
