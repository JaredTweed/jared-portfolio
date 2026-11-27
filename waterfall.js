import * as T from './three.module.min.js';

export function addWaterfall(scene, mouth, heading, width) {
  const forward = new T.Vector3(heading.x, 0, heading.z).normalize();
  const side = new T.Vector3(forward.z, 0, -forward.x);
  const impact = mouth.clone().addScaledVector(forward, .64);
  impact.y = -.824;
  const uniforms = {clock: {value: 0}, dusk: {value: 0}};
  const surface = new T.PlaneGeometry(1, 1, 22, 38);
  const uv = surface.attributes.uv;
  const sample = new T.Vector3();
  for (let i = 0; i < uv.count; i++) {
    const t = 1 - uv.getY(i);
    const cross = uv.getX(i) - .5;
    sample.copy(mouth).addScaledVector(forward, .64 * t ** .68);
    sample.addScaledVector(side, cross * width * (1 + .22 * t));
    sample.y = T.MathUtils.lerp(mouth.y, impact.y, t ** 1.48) - .043 * Math.abs(cross);
    surface.attributes.position.setXYZ(i, sample.x, sample.y, sample.z);
  }
  const uvShader = `varying vec2 flowUV;
    void main(){flowUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const waterfall = new T.Mesh(surface, new T.ShaderMaterial({
    uniforms, vertexShader: uvShader, side: T.DoubleSide, transparent: true, depthWrite: false,
    fragmentShader: `varying vec2 flowUV;uniform float clock;uniform float dusk;
      void main(){
        float x=flowUV.x, t=1.-flowUV.y;
        float fall=t-clock*.85;
        float strands=sin(72.*x+1.2*sin(fall*10.))*.25+sin(143.*x-fall*17.)*.11;
        float streaks=sin(47.*fall+5.*sin(x*39.))*.17+sin(89.*fall-x*69.)*.14;
        float light=smoothstep(-.24,.68,strands+streaks+.25+.55*t);
        vec3 shade=mix(vec3(.092,.34,.33),vec3(.82,.94,.89),light);
        shade*=mix(vec3(1.),vec3(.55,.69,.83),dusk);
        float edges=smoothstep(0.,.075,min(x,1.-x)+.012*sin(fall*35.));
        gl_FragColor=vec4(shade,edges*(.78+.22*light));
        #include <colorspace_fragment>
      }`
  }));
  waterfall.renderOrder = 1;
  scene.add(waterfall);

  const pool = new T.Mesh(new T.PlaneGeometry(2.8, 2.15), new T.ShaderMaterial({
    uniforms, vertexShader: uvShader, transparent: true, depthWrite: false,
    fragmentShader: `varying vec2 flowUV;uniform float clock;uniform float dusk;
      void main(){
        vec2 p=(flowUV-.5)*2.;
        float angle=atan(p.y,p.x), r=length(p);
        float broken=sin(angle*9.+r*9.)*.025+sin(angle*19.-clock*1.3)*.014;
        float inner=exp(-r*r*12.);
        float wake=pow(max(0.,sin((r+broken)*37.-clock*3.6)),8.);
        float foam=(inner*.75+wake*.43)*(1.-smoothstep(.39,1.,r));
        vec3 tint=mix(vec3(.78,.92,.84),vec3(.44,.61,.75),dusk);
        gl_FragColor=vec4(tint,foam);
        #include <colorspace_fragment>
      }`
  }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.copy(impact).addScaledVector(forward, .28);
  pool.position.y = -.819;
  pool.renderOrder = 2;
  scene.add(pool);

  const count = 40;
  const geometry = new T.BufferGeometry();
  const positions = new T.Float32BufferAttribute(new Float32Array(count * 3), 3);
  const opacity = new T.Float32BufferAttribute(new Float32Array(count), 1);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('fade', opacity);
  const spray = new T.Points(geometry, new T.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `attribute float fade;varying float strength;
      void main(){
        vec4 view=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(158./-view.z,4.,35.);
        strength=fade;
      }`,
    fragmentShader: `varying float strength;uniform float dusk;
      void main(){
        float radius=length(gl_PointCoord-.5)*2.;
        float wispy=1.-smoothstep(.05,.96,radius);
        gl_FragColor=vec4(mix(vec3(.86,.95,.9),vec3(.56,.7,.8),dusk),wispy*wispy*strength);
        #include <colorspace_fragment>
      }`
  }));
  spray.frustumCulled = false;
  spray.renderOrder = 3;
  scene.add(spray);

  return (time, dusk) => {
    uniforms.clock.value = time;
    uniforms.dusk.value = dusk;
    for (let i = 0; i < count; i++) {
      const age = (i / count + time * (.48 + (i % 5) * .026)) % 1;
      const scatter = Math.sin(i * 2.39996);
      sample.copy(impact).addScaledVector(forward, age * (.22 + (i % 7) * .09));
      sample.addScaledVector(side, scatter * (.18 + age * .68));
      const height = .22 + (i % 9) * .095;
      sample.y += .05 + height * Math.sin(Math.PI * age);
      positions.setXYZ(i, sample.x, sample.y, sample.z);
      opacity.setX(i, .29 * Math.sin(Math.PI * age) * (1 - age * .65));
    }
    positions.needsUpdate = true;
    opacity.needsUpdate = true;
  };
}
