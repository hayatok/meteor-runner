import * as THREE from 'three';

const teal = new THREE.Color('#2ec4b6');
const gold = new THREE.Color('#ffd94d');

export function createDroneEffects(scene, drone) {
  const glow = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  const flameMaterial = new THREE.MeshBasicMaterial(glow);
  const flameGeometry = new THREE.ConeGeometry(0.145, 1, 10);
  flameGeometry.rotateX(Math.PI / 2);
  flameGeometry.translate(0, 0, 0.5);
  const flames = [-0.47, 0.47].map(x => {
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.position.set(x, 0.3, 0.58);
    drone.add(flame);
    return flame;
  });

  const lightMaterial = new THREE.MeshBasicMaterial({ ...glow, color: '#f5ead9' });
  const lightGeometry = new THREE.SphereGeometry(0.105, 10, 6);
  for (const x of [-0.49, 0.49]) {
    const light = new THREE.Mesh(lightGeometry, lightMaterial);
    light.position.set(x, 0.32, 0.6);
    light.scale.z = 0.38;
    drone.add(light);
  }

  const segments = 28;
  const history = new Float32Array(segments * 2);
  const trailPoints = new THREE.BufferAttribute(new Float32Array(segments * 6), 3).setUsage(THREE.DynamicDrawUsage);
  const trailFade = new Float32Array(segments * 2);
  const indices = [];
  for (let i = 0; i < segments; i++) {
    trailFade[i * 2] = trailFade[i * 2 + 1] = (1 - i / (segments - 1)) ** 2;
    if (i === segments - 1) continue;
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', trailPoints);
  trailGeometry.setAttribute('fade', new THREE.BufferAttribute(trailFade, 1));
  trailGeometry.setIndex(indices);
  const trail = new THREE.Mesh(trailGeometry, new THREE.ShaderMaterial({
    ...glow,
    side: THREE.DoubleSide,
    uniforms: { color: { value: teal.clone() }, intensity: { value: 1 } },
    vertexShader: `
      attribute float fade;
      varying float opacity;
      void main() {
        opacity = fade;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform float intensity;
      varying float opacity;
      void main() {
        gl_FragColor = vec4(color, intensity * opacity);
        #include <colorspace_fragment>
      }`,
  }));
  trail.frustumCulled = false;
  scene.add(trail);

  const windGeometry = new THREE.BufferGeometry();
  const windPoints = new THREE.BufferAttribute(new Float32Array(14 * 6), 3).setUsage(THREE.DynamicDrawUsage);
  windGeometry.setAttribute('position', windPoints);
  const wind = new THREE.LineSegments(windGeometry, new THREE.LineBasicMaterial({
    ...glow, color: '#f5ead9', opacity: 0.72,
  }));
  wind.frustumCulled = false;
  drone.add(wind);

  const aura = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 10),
    new THREE.MeshBasicMaterial({ ...glow, color: '#ffd94d', wireframe: true }));
  aura.position.y = 0.35;
  drone.add(aura);

  function reset() {
    for (let i = 0; i < segments; i++) {
      history[i * 2] = drone.position.x;
      history[i * 2 + 1] = drone.position.y + 0.2;
    }
    trail.visible = false;
  }

  function update(run, dt, time, fever, ignition, idle) {
    const speed = (run.speed - 18) / 28;
    flameMaterial.color.copy(teal).lerp(gold, fever ? 1 : speed);
    flameMaterial.opacity = 0.56 + 0.22 * Math.sin(time * 44) ** 2 + ignition * 0.22;
    lightMaterial.opacity = idle ? 0.1 + 0.8 * Math.sin(time * 4) ** 6 : 0.78 + ignition * 0.22;
    for (let i = 0; i < flames.length; i++) {
      flames[i].scale.z = (0.37 + speed * 1.13 + ignition * 1.9) * (0.85 + 0.15 * Math.sin(time * 47 + i));
    }
    trail.visible = !run.dead && !idle;
    if (trail.visible) {
      const blend = 1 - Math.exp(-dt * (100 - speed * 22));
      for (let i = segments - 1; i > 0; i--) {
        history[i * 2] += (history[(i - 1) * 2] - history[i * 2]) * blend;
        history[i * 2 + 1] += (history[(i - 1) * 2 + 1] - history[i * 2 + 1]) * blend;
      }
      history[0] = drone.position.x;
      history[1] = drone.position.y + 0.24;
      for (let i = 0; i < segments; i++) {
        const fraction = i / (segments - 1);
        const width = (0.33 + speed * 0.18) * (1 - fraction * 0.85);
        const x = history[i * 2];
        const y = history[i * 2 + 1];
        const z = 0.66 + fraction * (2.8 + speed * 3.1);
        trailPoints.setXYZ(i * 2, x - width, y, z);
        trailPoints.setXYZ(i * 2 + 1, x + width, y, z);
      }
      trailPoints.needsUpdate = true;
      trail.material.uniforms.color.value.copy(flameMaterial.color);
      trail.material.uniforms.intensity.value = 0.54 + speed * 0.38 + (fever ? 0.2 : 0);
    }

    wind.visible = run.dive > 0 && !idle;
    if (wind.visible) {
      for (let i = 0; i < 14; i++) {
        const angle = i * Math.PI * 2 / 14;
        const x = Math.cos(angle) * 0.84;
        const y = 0.46 + Math.sin(angle) * 0.6;
        const z = ((time * 9 + i * 0.43) % 2.8) - 1.4;
        windPoints.setXYZ(i * 2, x, y, z);
        windPoints.setXYZ(i * 2 + 1, x * 1.1, y + 0.07, z + 0.43);
      }
      windPoints.needsUpdate = true;
    }
    aura.visible = run.magnet > 0 && !idle;
    aura.material.opacity = 0.12 + 0.08 * Math.sin(time * 8);
    aura.rotation.y = time * 1.8;
  }

  return { reset, update };
}
