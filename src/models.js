import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const materials = {
  cream: new THREE.MeshStandardMaterial({ color: '#f5ead9' }),
  deck: new THREE.MeshStandardMaterial({ color: '#222941', roughness: 0.9 }),
  inset: new THREE.MeshStandardMaterial({ color: '#383f5c' }),
  rock: new THREE.MeshStandardMaterial({ color: '#4a4062', roughness: 1, flatShading: true }),
  teal: new THREE.MeshStandardMaterial({ color: '#2ec4b6', emissive: '#2ec4b6', emissiveIntensity: 0.7 }),
  orange: new THREE.MeshStandardMaterial({ color: '#ff8c42', emissive: '#ff8c42', emissiveIntensity: 0.9 }),
  yellow: new THREE.MeshStandardMaterial({ color: '#ffd94d', emissive: '#ffd94d', emissiveIntensity: 0.9 }),
  red: new THREE.MeshStandardMaterial({ color: '#ff626e', emissive: '#ff626e', emissiveIntensity: 0.35 }),
};

function mesh(group, geometry, material, x, y, z) {
  const part = new THREE.Mesh(geometry, materials[material]);
  part.position.set(x, y, z);
  group.add(part);
  return part;
}

function box(group, material, x, y, z, width, height, depth) {
  return mesh(group, new THREE.BoxGeometry(width, height, depth), material, x, y, z);
}

function gem(group, material, x, y, z, radius, stretch = 1) {
  const part = mesh(group, new THREE.OctahedronGeometry(radius), material, x, y, z);
  part.scale.y = stretch;
  return part;
}

function rock(group, x, y, z, radius) {
  const part = mesh(group, new THREE.IcosahedronGeometry(radius, 0), 'rock', x, y, z);
  part.rotation.set(0.18, 0.4, 0.24);
  part.scale.set(1, 0.94, 0.87);
}

const fallback = {
  drone(group) {
    const hull = mesh(group, new THREE.SphereGeometry(0.5, 16, 10), 'cream', 0, 0.3, -0.08);
    hull.scale.set(0.86, 0.6, 1.45);
    box(group, 'teal', 0, 0.34, -0.61, 0.53, 0.13, 0.16);
    box(group, 'inset', 0, 0.54, 0.2, 0.48, 0.3, 0.49);
    box(group, 'yellow', 0, 0.699, 0.2, 0.08, 0.025, 0.49);
    for (const x of [-0.43, 0.43]) {
      const pod = mesh(group, new THREE.SphereGeometry(0.22, 12, 8), 'cream', x, 0.21, 0.14);
      pod.scale.set(0.63, 0.8, 2.15);
      box(group, 'orange', x, 0.21, 0.55, 0.17, 0.12, 0.12);
    }
  },
  asteroid_a(group) {
    rock(group, 0, 0.76, 0, 0.85);
    gem(group, 'teal', -0.49, 1.16, 0.32, 0.22, 1.4);
  },
  asteroid_b(group) {
    rock(group, -0.23, 0.88, 0, 1.02);
    rock(group, 0.54, 0.55, 0.09, 0.58);
    gem(group, 'teal', 0.37, 1.26, 0.35, 0.29, 1.45);
  },
  crystal(group) {
    box(group, 'inset', 0, 0.06, 0, 1.8, 0.12, 0.74);
    for (let i = -2; i <= 2; i++) {
      gem(group, 'teal', i * 0.31, 0.28, (i % 2) * 0.17, 0.23, 1.3 + 0.16 * (2 - Math.abs(i))).rotation.z = -i * 0.16;
    }
  },
  barrier(group) {
    box(group, 'orange', 0, 1.29, 0, 2, 0.48, 0.29);
    for (const x of [-0.95, 0.95]) box(group, 'inset', x, 0.72, 0, 0.12, 1.44, 0.33);
  },
  shard(group) {
    gem(group, 'yellow', 0, 0.225, 0, 0.225, 1.15);
  },
  shield(group) {
    mesh(group, new THREE.TorusGeometry(0.32, 0.065, 8, 20), 'teal', 0, 0.4, 0);
    gem(group, 'teal', 0, 0.4, 0, 0.16);
  },
  magnet(group) {
    mesh(group, new THREE.TorusGeometry(0.25, 0.09, 8, 20, Math.PI), 'red', 0, 0.31, 0).rotation.z = Math.PI;
    for (const x of [-0.25, 0.25]) box(group, 'cream', x, 0.47, 0, 0.18, 0.29, 0.18);
  },
  gate(group) {
    box(group, 'inset', 0, 4.27, 0, 8, 0.46, 0.48);
    box(group, 'teal', 0, 4.12, 0.25, 7.65, 0.065, 0.045);
    for (const x of [-3.79, 3.79]) {
      box(group, 'inset', x, 2.15, 0, 0.42, 4.3, 0.48);
      box(group, 'teal', x, 2.15, 0.25, 0.07, 4.25, 0.045);
    }
  },
  deck(group) {
    box(group, 'deck', 0, -0.19, -15, 8, 0.38, 30);
    for (const x of [-3.94, 3.94]) box(group, 'teal', x, 0.014, -15, 0.06, 0.025, 30);
    for (const x of [-1.1, 1.1]) {
      for (let z = -2; z > -30; z -= 5) box(group, 'inset', x, 0.01, z, 0.045, 0.015, 2.1);
    }
  },
  planet(group) {
    mesh(group, new THREE.IcosahedronGeometry(10, 2), 'rock', 0, 10, 0);
    const ring = mesh(group, new THREE.RingGeometry(12, 16, 48), 'inset', 0, 10, 0);
    ring.material = new THREE.MeshBasicMaterial({ color: '#a78ba5', side: THREE.DoubleSide });
    ring.rotation.set(1.12, 0.2, -0.35);
  },
};

export function createModels() {
  const loader = new GLTFLoader();
  const models = new Map();

  for (const [name, build] of Object.entries(fallback)) {
    const template = new THREE.Group();
    build(template);
    const model = { template, instances: [] };
    models.set(name, model);
    loader.load(`${import.meta.env.BASE_URL}models/${name}.glb`, ({ scene }) => {
      model.template = scene;
      for (const instance of model.instances) {
        instance.children[0].clear().add(scene.clone());
      }
      model.instances = null;
    }, undefined, () => {
      model.instances = null;
    });
  }

  return function instantiate(name) {
    const model = models.get(name);
    const instance = new THREE.Group();
    const content = new THREE.Group();
    content.add(model.template.clone());
    instance.add(content);
    model.instances?.push(instance);
    return instance;
  };
}
