import * as THREE from 'three';

const dustSlots = 100;
const burstSlots = 200;
const capacity = dustSlots + burstSlots;
const colors = {
  shard: new THREE.Color('#ffd94d'),
  dust: new THREE.Color('#f5ead9'),
  shield: new THREE.Color('#2ec4b6'),
  crash: new THREE.Color('#ffb35e'),
};

export function createParticles(scene, camera) {
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const tint = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const sizes = new THREE.BufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('tint', tint);
  geometry.setAttribute('size', sizes);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 tint;
      attribute float size;
      varying vec3 glow;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.);
        gl_Position = size > 0. ? projectionMatrix * view : vec4(2., 2., 2., 1.);
        gl_PointSize = clamp(size / max(1., -view.z), 1., 28.);
        glow = tint;
      }`,
    fragmentShader: `
      varying vec3 glow;
      void main() {
        vec2 p = abs(gl_PointCoord - .5);
        float diamond = 1. - smoothstep(.13, .51, p.x + p.y);
        gl_FragColor = vec4(glow, diamond);
        #include <colorspace_fragment>
      }`,
  });
  const cloud = new THREE.Points(geometry, material);
  cloud.frustumCulled = false;
  scene.add(cloud);

  const dust = Array.from({ length: dustSlots }, () => ({
    x: (Math.random() - 0.5) * 25,
    y: Math.random() * 13,
    z: -Math.random() * 85,
  }));
  const debris = Array.from({ length: burstSlots }, () => ({
    position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0,
  }));
  // Effect density and frame timing must stay independent of gameplay spawning.
  let seed = Math.floor(Math.random() * 0x100000000);
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  }

  let cursor = 0;
  let budget = burstSlots;

  function quality(scale) {
    budget = burstSlots * scale;
    cursor %= budget;
    geometry.setDrawRange(0, dustSlots + budget);
    for (let i = budget; i < burstSlots; i++) debris[i].life = 0;
  }

  function burst(position, kind, count, scale) {
    for (let i = 0; i < Math.round(count * scale); i++) {
      const p = debris[cursor];
      cursor = (cursor + 1) % budget;
      p.position.copy(position);
      const force = kind === 'crash' ? 15 : kind === 'confetti' ? 6 : 5;
      p.velocity.set((random() - 0.5) * force, (random() - 0.15) * force, (random() - 0.5) * force);
      p.duration = kind === 'confetti' ? 1.7 + random() : kind === 'crash' ? 0.8 : 0.42;
      p.life = p.duration;
      p.size = kind === 'crash' || kind === 'confetti' ? 140 : 85;
      p.color = kind === 'confetti' ? (i % 3 ? colors.shard : colors.dust) : colors[kind];
    }
  }

  const dustPosition = new THREE.Vector3();

  function update(dt, speed, scale, dustVisible) {
    const count = dustVisible ? Math.round((48 + (speed - 18) / 28 * 52) * scale) : 0;
    camera.updateMatrixWorld();
    for (let i = 0; i < dustSlots; i++) {
      if (i < count) {
        const p = dust[i];
        p.z += speed * dt;
        if (p.z > -3) p.z -= 85;
        dustPosition.set(p.x, p.y - 5, p.z).applyMatrix4(camera.matrixWorld);
        positions.setXYZ(i, dustPosition.x, dustPosition.y, dustPosition.z);
        tint.setXYZ(i, 0.34, 0.45, 0.42);
      }
      sizes.setX(i, i < count ? 52 : 0);
    }
    for (let i = 0; i < budget; i++) {
      const p = debris[i];
      const index = dustSlots + i;
      p.life = Math.max(0, p.life - dt);
      if (p.life > 0) {
        p.position.addScaledVector(p.velocity, dt);
        p.velocity.y -= dt * 5;
        positions.setXYZ(index, p.position.x, p.position.y, p.position.z);
        const fade = p.life / p.duration;
        tint.setXYZ(index, p.color.r * fade, p.color.g * fade, p.color.b * fade);
      }
      sizes.setX(index, p.life > 0 ? p.size : 0);
    }
    positions.needsUpdate = tint.needsUpdate = sizes.needsUpdate = true;
  }

  return { quality, burst, update, reset: () => {
    for (const p of debris) p.life = 0;
    cursor = 0;
  } };
}
