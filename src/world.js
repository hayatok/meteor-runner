import * as THREE from 'three';
import { createModels } from './models.js';
import { createEffects } from './effects.js';

const indigo = new THREE.Color('#232a52');
const phaseColors = [
  [0, 500, indigo, '#f5ead9', '#ff8c42'],
  [500, 1500, indigo.clone().multiplyScalar(0.62), '#f5ead9', '#2ec4b6'],
  [1500, 2500, indigo.clone().multiplyScalar(0.24), '#2ec4b6', '#232a52'],
  [2500, 3500, indigo.clone().multiplyScalar(1.35), '#f5ead9', '#ffd94d'],
].map(([start, end, sky, fill, sun]) => ({
  start, end, sky, fill: new THREE.Color(fill), sun: new THREE.Color(sun),
}));

function addStars(scene) {
  const positions = [];
  for (let i = 0; i < 1300; i++) {
    positions.push((Math.random() - 0.5) * 340, Math.random() * 110 - 8, -30 - Math.random() * 180);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({
    color: '#f5ead9', size: 0.25, fog: false,
  })));
}

function addNebula(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, '#2ec4b66a');
  gradient.addColorStop(0.4, '#2ec4b62c');
  gradient.addColorStop(1, '#2ec4b600');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map, depthWrite: false, fog: false });
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Sprite(material);
    cloud.position.set(-72 + i * 19, 12 + Math.sin(i * 1.65) * 8, -158 + i * 4);
    cloud.scale.set(49, 19, 1);
    scene.add(cloud);
  }
}

export function createWorld(container, renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.FogExp2('#232a52', 0.016);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 245);
  const fill = new THREE.HemisphereLight('#f5ead9', '#232a52', 2);
  const sun = new THREE.DirectionalLight('#ff8c42', 2.1);
  sun.position.set(-3, 7, 5);
  scene.add(fill, sun, camera);
  const effects = createEffects(scene, camera);
  addStars(scene);
  addNebula(scene);

  const instantiate = createModels();
  function make(name) {
    const model = instantiate(name);
    scene.add(model);
    return model;
  }

  const deck = Array.from({ length: 5 }, () => make('deck'));
  const drone = make('drone');
  const shield = new THREE.Mesh(new THREE.SphereGeometry(0.87, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#2ec4b6', transparent: true, opacity: 0.27, wireframe: true }));
  shield.position.y = 0.35;
  drone.add(shield);

  const planet = make('planet');
  planet.scale.setScalar(0.68);
  planet.position.set(15, 5.5, -72);
  planet.rotation.z = -0.15;

  const rocks = Array.from({ length: 24 }, (_, index) => {
    const model = make(index % 2 ? 'asteroid_a' : 'asteroid_b');
    const side = index % 2 ? 1 : -1;
    model.position.set(side * (6 + Math.random() * 17), -6 + Math.random() * 16, 0);
    model.scale.setScalar(0.8 + Math.random() * 2.2);
    return model;
  });

  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', resize);
  resize();

  function pose(run, coast = 0) {
    const { x, y, elapsed, dive } = run;
    const distance = run.distance + coast;
    drone.position.set(x, y, 0);
    drone.scale.y = dive > 0 ? 0.59 : 1;
    drone.rotation.set(dive > 0 ? -0.14 : 0, 0, Math.sin(Math.PI * run.laneTime / 0.12) * (run.fromX - x) * 0.23);
    shield.visible = run.shield;
    shield.rotation.y = elapsed * 1.3;
    const fov = THREE.MathUtils.lerp(62, 74, (run.speed - 18) / (46 - 18));
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    const cameraZ = Math.max(6.7, 2.55 / (Math.tan(THREE.MathUtils.degToRad(fov / 2)) * camera.aspect));
    camera.position.set(x * 0.22, 3.65, cameraZ);
    camera.lookAt(x * 0.12, 0.75, -8);

    for (let i = 0; i < deck.length; i++) deck[i].position.z = 30 + distance % 30 - 30 * i;
    for (let i = 0; i < rocks.length; i++) {
      rocks[i].position.z = 16 - ((i * 11 + 12 - distance * 0.32) % 155 + 155) % 155;
      rocks[i].rotation.set(elapsed * 0.13 + i, elapsed * 0.19 + i, i);
    }

    const cycle = distance % 3500;
    const index = phaseColors.findIndex(phase => cycle < phase.end);
    const current = phaseColors[index];
    const next = phaseColors[(index + 1) % phaseColors.length];
    const progress = THREE.MathUtils.smoothstep(cycle, current.end - (current.end - current.start) * 0.2, current.end);
    scene.background.copy(current.sky).lerp(next.sky, progress);
    scene.fog.color.copy(scene.background);
    fill.color.copy(current.fill).lerp(next.fill, progress);
    sun.color.copy(current.sun).lerp(next.sun, progress);
  }

  return { make, pose, effects, render: () => renderer.render(scene, camera) };
}
