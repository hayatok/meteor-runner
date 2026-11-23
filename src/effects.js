import * as THREE from 'three';
import { createParticles } from './particles.js';

export function createEffects(scene, camera) {
  const lineCount = 48;
  const coordinates = new Float32Array(lineCount * 6);
  const streaks = Array.from({ length: lineCount }, (_, index) => ({
    angle: (index + Math.random()) / lineCount * Math.PI * 2,
    radius: 0.76 + Math.random() * 0.2,
    depth: 2 + Math.random() * 36,
  }));
  const geometry = new THREE.BufferGeometry();
  const points = new THREE.BufferAttribute(coordinates, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', points);
  const material = new THREE.LineBasicMaterial({
    color: '#f5ead9', transparent: true, depthWrite: false, fog: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  camera.add(lines);

  const particles = createParticles(scene, camera);
  const ringGeometry = new THREE.RingGeometry(0.88, 1, 40);
  const rings = Array.from({ length: 12 }, () => {
    const mesh = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    scene.add(mesh);
    return { mesh, time: 0, duration: 0 };
  });
  let ringCursor = 0;
  let scale = 1;
  let slowTime = 0;
  let fastTime = 0;
  let shakeTime = 0;
  let shakeDuration = 0;
  let shakeAmplitude = 0;

  function sampleFrame(dt) {
    slowTime = dt > 0.024 ? slowTime + Math.min(dt, 0.05) : 0;
    fastTime = dt > 0 && dt <= 0.02 ? fastTime + dt : 0;
    const next = slowTime >= 0.45 ? 0.5 : fastTime >= 2 ? 1 : scale;
    if (next !== scale) {
      scale = next;
      particles.quality(scale);
    }
  }

  function ring(position, color, radius, { floor = false, delay = 0, duration = 0.55 } = {}) {
    const entry = rings[ringCursor];
    ringCursor = (ringCursor + 1) % rings.length;
    entry.time = -delay;
    entry.duration = duration;
    entry.radius = radius;
    entry.floor = floor;
    entry.mesh.position.copy(position);
    entry.mesh.rotation.x = floor ? -Math.PI / 2 : 0;
    entry.mesh.material.color.set(color);
  }

  function burst(position, kind = 'shard', count = 10) {
    particles.burst(position, kind, count, scale);
  }

  const traceGeometry = new THREE.BufferGeometry();
  const tracePoints = new THREE.BufferAttribute(new Float32Array(24 * 6), 3).setUsage(THREE.DynamicDrawUsage);
  traceGeometry.setAttribute('position', tracePoints);
  const traces = new THREE.LineSegments(traceGeometry, new THREE.LineBasicMaterial({
    color: '#ffd94d', transparent: true, opacity: 0.65, depthWrite: false,
  }));
  traces.frustumCulled = false;
  scene.add(traces);
  const tracePool = Array.from({ length: 24 }, () => ({ position: new THREE.Vector3(), life: 0 }));
  let traceCursor = 0;

  function shardTrace(position) {
    const trace = tracePool[traceCursor];
    traceCursor = (traceCursor + 1) % tracePool.length;
    trace.position.copy(position);
    trace.life = 0.24;
  }

  function shake(amplitude, duration) {
    shakeAmplitude = amplitude;
    shakeTime = shakeDuration = duration;
  }

  function update(dt, speed, realDt = dt, dustVisible = true) {
    const intensity = THREE.MathUtils.clamp((speed - 30) / 16, 0, 1);
    lines.visible = dustVisible && speed >= 30;
    if (lines.visible) {
      const count = Math.round((8 + intensity * (lineCount - 8)) * scale);
      const slope = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      for (let i = 0; i < count; i++) {
        const streak = streaks[Math.floor(i * lineCount / count)];
        streak.depth -= (30 + intensity * 55) * dt;
        if (streak.depth < 2) streak.depth += 36;
        const x = Math.cos(streak.angle) * streak.radius * slope * camera.aspect;
        const y = Math.sin(streak.angle) * streak.radius * slope;
        const far = streak.depth + 0.7 + 2 * intensity;
        points.setXYZ(i * 2, x * streak.depth, y * streak.depth, -streak.depth);
        points.setXYZ(i * 2 + 1, x * streak.depth, y * streak.depth, -far);
      }
      material.opacity = 0.24 + intensity * 0.33;
      geometry.setDrawRange(0, count * 2);
      points.needsUpdate = true;
    }
    for (const entry of rings) {
      const { mesh, duration } = entry;
      if (entry.time >= duration) {
        mesh.visible = false;
        continue;
      }
      entry.time += dt;
      mesh.visible = entry.time >= 0 && entry.time < duration;
      if (entry.floor) mesh.position.z += speed * dt;
      if (!mesh.visible) continue;
      const progress = entry.time / duration;
      mesh.scale.setScalar(0.12 + entry.radius * (1 - (1 - progress) ** 2));
      mesh.material.opacity = (1 - progress) * 0.85;
    }
    let visibleTraces = 0;
    for (const trace of tracePool) {
      trace.life -= dt;
      if (trace.life <= 0) continue;
      trace.position.z += speed * dt;
      const { x, y, z } = trace.position;
      tracePoints.setXYZ(visibleTraces * 2, x, y, z);
      tracePoints.setXYZ(visibleTraces * 2 + 1, x - trace.life, y + trace.life, z + trace.life * 5);
      visibleTraces++;
    }
    traceGeometry.setDrawRange(0, visibleTraces * 2);
    tracePoints.needsUpdate = true;
    if (shakeTime > 0) {
      const amplitude = shakeAmplitude * shakeTime / shakeDuration;
      camera.position.x += Math.sin((shakeDuration - shakeTime) * 91) * amplitude;
      camera.position.y += Math.cos((shakeDuration - shakeTime) * 103) * amplitude;
      shakeTime = Math.max(0, shakeTime - realDt);
    }
    particles.update(dt, speed, scale, dustVisible);
  }

  function reset() {
    shakeTime = 0;
    lines.visible = false;
    particles.reset();
    for (const trace of tracePool) trace.life = 0;
    traceGeometry.setDrawRange(0, 0);
    for (const entry of rings) {
      entry.time = entry.duration = 0;
      entry.mesh.visible = false;
    }
  }

  reset();
  return { burst, ring, shardTrace, shake, update, reset, sampleFrame };
}
