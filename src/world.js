import * as THREE from 'three';
import { createModels } from './models.js';

const phaseColors = [
  ['#232a52', '#fde0bb', '#ff8c42'],
  ['#292d59', '#dfd0ff', '#a480e1'],
  ['#152447', '#b5e2ff', '#2ec4b6'],
  ['#100f2f', '#a9bbff', '#3e6eb4'],
  ['#1b1a44', '#b4b8ff', '#8462d5'],
  ['#593d59', '#fff0d1', '#ff8c42'],
].map(colors => colors.map(color => new THREE.Color(color)));

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
  const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 245);
  const fill = new THREE.HemisphereLight('#fde0bb', '#393658', 2);
  const sun = new THREE.DirectionalLight('#ff8c42', 2.1);
  sun.position.set(-3, 7, 5);
  scene.add(fill, sun);
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
    // Preserve the track width in narrow portrait viewports.
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(0.5, 0.34 / camera.aspect)));
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', resize);
  resize();

  function pose(run) {
    const { distance, x, y, elapsed, dive } = run;
    drone.position.set(x, y, 0);
    drone.scale.y = dive > 0 ? 0.59 : 1;
    drone.rotation.set(dive > 0 ? -0.14 : 0, 0, Math.sin(Math.PI * run.laneTime / 0.12) * (run.fromX - x) * 0.23);
    shield.visible = run.shield;
    shield.rotation.y = elapsed * 1.3;
    camera.position.set(x * 0.22, 3.65, 6.7);
    camera.lookAt(x * 0.12, 0.75, -8);

    for (let i = 0; i < deck.length; i++) deck[i].position.z = 30 + distance % 30 - 30 * i;
    for (let i = 0; i < rocks.length; i++) {
      rocks[i].position.z = 16 - ((i * 11 + 12 - distance * 0.32) % 155 + 155) % 155;
      rocks[i].rotation.set(elapsed * 0.13 + i, elapsed * 0.19 + i, i);
    }

    const segment = (distance % 3000) / 500;
    const index = Math.floor(segment);
    const next = phaseColors[(index + 1) % phaseColors.length];
    const current = phaseColors[index];
    const progress = THREE.MathUtils.smoothstep(segment - index, 0.53, 1);
    scene.background.copy(current[0]).lerp(next[0], progress);
    scene.fog.color.copy(scene.background);
    fill.color.copy(current[1]).lerp(next[1], progress);
    sun.color.copy(current[2]).lerp(next[2], progress);
  }

  return { make, pose, render: () => renderer.render(scene, camera) };
}
