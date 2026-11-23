import * as THREE from 'three';

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

  const particleGeometry = new THREE.OctahedronGeometry(0.065);
  const particles = Array.from({ length: 100 }, () => {
    const mesh = new THREE.Mesh(particleGeometry, new THREE.MeshBasicMaterial({
      color: '#ffd94d', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, velocity: new THREE.Vector3() };
  });
  const particleLife = 0.42;
  let cursor = 0;
  let shakeTime = 0;
  let shakeDuration = 0;
  let shakeAmplitude = 0;

  function burst(position) {
    for (let i = 0; i < 10; i++) {
      const particle = particles[cursor];
      cursor = (cursor + 1) % particles.length;
      particle.mesh.position.copy(position);
      particle.mesh.visible = true;
      particle.mesh.material.opacity = 1;
      particle.velocity.set((Math.random() - 0.5) * 5, Math.random() * 4 - 0.7, (Math.random() - 0.5) * 4);
    }
  }

  function shake(amplitude, duration) {
    shakeAmplitude = amplitude;
    shakeTime = shakeDuration = duration;
  }

  function update(dt, speed, realDt = dt) {
    const intensity = THREE.MathUtils.clamp((speed - 30) / 16, 0, 1);
    lines.visible = speed >= 30;
    if (lines.visible) {
      const count = Math.round(8 + intensity * (lineCount - 8));
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
    for (const { mesh, velocity } of particles) {
      if (!mesh.visible) continue;
      mesh.position.addScaledVector(velocity, dt);
      velocity.y -= dt * 5;
      mesh.material.opacity -= dt / particleLife;
      mesh.visible = mesh.material.opacity > 0;
    }
    if (shakeTime > 0) {
      const amplitude = shakeAmplitude * shakeTime / shakeDuration;
      camera.position.x += Math.sin((shakeDuration - shakeTime) * 91) * amplitude;
      camera.position.y += Math.cos((shakeDuration - shakeTime) * 103) * amplitude;
      shakeTime = Math.max(0, shakeTime - realDt);
    }
  }

  function reset() {
    shakeTime = 0;
    lines.visible = false;
    for (const { mesh } of particles) mesh.visible = false;
  }

  reset();
  return { burst, shake, update, reset };
}
