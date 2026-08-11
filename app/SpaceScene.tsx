"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const MODEL_URL = "/models/voyager.glb";
const SKYBOX_URL = "/textures/nebula-skybox.jpg";
const PUFF_ATLAS_URL = "/textures/puff-atlas.jpg";
const DISK_TEXTURE_URL = "/textures/accretion-disk.jpg";
const SKYBOX_ROTATION_Y = 0;
const SKYBOX_INTENSITY = 0.75;

function createStars(count: number, spread: number, depth: number, size: number) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = THREE.MathUtils.randFloatSpread(spread);
    positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(spread * 0.58);
    positions[i * 3 + 2] = THREE.MathUtils.randFloat(-depth, 8);
    speeds[i] = THREE.MathUtils.randFloat(0.35, 1);
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xcfe8ff,
    size,
    transparent: true,
    opacity: 0.78,
    sizeAttenuation: true,
    depthWrite: false,
  });

  return { points: new THREE.Points(geometry, material), positions, speeds };
}

function createStreaks(count: number) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 6);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const x = THREE.MathUtils.randFloatSpread(58);
    const y = THREE.MathUtils.randFloatSpread(32);
    const z = THREE.MathUtils.randFloat(-75, 3);
    const offset = i * 6;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    positions[offset + 3] = x;
    positions[offset + 4] = y;
    positions[offset + 5] = z - THREE.MathUtils.randFloat(1.3, 6.8);
    speeds[i] = THREE.MathUtils.randFloat(0.65, 1.4);
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x94cfff,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return { lines: new THREE.LineSegments(geometry, material), positions, speeds };
}

type FlowTrails = {
  lines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  count: number;
  segments: number;
  positions: Float32Array;
  radii: Float32Array;
  flatten: Float32Array;
  speeds: Float32Array;
  phases: Float32Array;
  lens: Float32Array;
  spans: Float32Array;
  depths: Float32Array;
  zSpreads: Float32Array;
  dirs: Float32Array;
};

function createFlowTrails(count: number, segments: number): FlowTrails {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * segments * 6);
  const colors = new Float32Array(count * segments * 6);
  const radii = new Float32Array(count);
  const flatten = new Float32Array(count);
  const speeds = new Float32Array(count);
  const phases = new Float32Array(count);
  const lens = new Float32Array(count);
  const spans = new Float32Array(count);
  const depths = new Float32Array(count);
  const zSpreads = new Float32Array(count);
  const dirs = new Float32Array(count);
  const ember = new THREE.Color(0xff5a1e);
  const gold = new THREE.Color(0xffc978);
  const white = new THREE.Color(0xfff3dc);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    radii[i] = 1.62 + Math.pow(Math.random(), 1.35) * 4.8;
    flatten[i] = THREE.MathUtils.randFloat(0.27, 0.37);
    speeds[i] = (1.7 / Math.pow(radii[i], 1.75)) * THREE.MathUtils.randFloat(0.7, 1.4);
    phases[i] = THREE.MathUtils.randFloat(0, Math.PI * 2);
    lens[i] = THREE.MathUtils.randFloat(0.03, 0.1);
    spans[i] = THREE.MathUtils.randFloat(0.7, 1.35);
    depths[i] = -0.05 - (i % 7) * 0.012;
    zSpreads[i] = THREE.MathUtils.randFloatSpread(2);
    dirs[i] = Math.random() > 0.06 ? 1 : -1;

    const heat = Math.pow(1 - (radii[i] - 1.62) / 4.8, 1.35);
    color.lerpColors(ember, gold, heat);
    color.lerp(white, Math.max(0, heat - 0.62) * 1.6);
    const intensity = 0.6 + heat * heat * 2.4;
    for (let k = 0; k < segments; k += 1) {
      const headFade = Math.pow(1 - k / segments, 1.55);
      const tailFade = Math.pow(1 - (k + 1) / segments, 1.55);
      const offset = (i * segments + k) * 6;
      colors[offset] = color.r * intensity * headFade;
      colors[offset + 1] = color.g * intensity * headFade;
      colors[offset + 2] = color.b * intensity * headFade;
      colors[offset + 3] = color.r * intensity * tailFade;
      colors[offset + 4] = color.g * intensity * tailFade;
      colors[offset + 5] = color.b * intensity * tailFade;
    }
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  material.toneMapped = false;
  material.fog = false;
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.renderOrder = 0;
  return { lines, count, segments, positions, radii, flatten, speeds, phases, lens, spans, depths, zSpreads, dirs };
}

function updateFlowTrails(trails: FlowTrails, elapsed: number, intensity: number, tunnel: number) {
  const { count, segments, positions } = trails;
  const arc = 0.09 + intensity * 1.35;
  for (let i = 0; i < count; i += 1) {
    const dir = trails.dirs[i];
    const radius = trails.radii[i];
    const head = trails.phases[i] + dir * elapsed * trails.speeds[i] * (0.3 + intensity * 2.3);
    const span = arc * trails.spans[i];
    const step = span / segments;
    const flatten = trails.flatten[i];
    const lensStrength = trails.lens[i];
    const z = trails.depths[i] + trails.zSpreads[i] * tunnel;
    let px = 0;
    let py = 0;
    for (let k = 0; k <= segments; k += 1) {
      const angle = head - dir * step * k;
      const wobble = Math.sin(angle * 3 + trails.phases[i] * 2.7) * radius * 0.022;
      const localRadius = radius + wobble;
      const upper = Math.max(0, Math.sin(angle));
      const lift = upper * upper * radius * lensStrength;
      const x = Math.cos(angle) * localRadius;
      const y = Math.sin(angle) * localRadius * flatten + lift;
      if (k > 0) {
        const offset = (i * segments + (k - 1)) * 6;
        positions[offset] = px;
        positions[offset + 1] = py;
        positions[offset + 2] = z;
        positions[offset + 3] = x;
        positions[offset + 4] = y;
        positions[offset + 5] = z;
      }
      px = x;
      py = y;
    }
  }
  (trails.lines.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
}

type DustDisk = {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial | THREE.ShaderMaterial>;
  positions: Float32Array;
  radii: Float32Array;
  angles: Float32Array;
  speeds: Float32Array;
  flatten: Float32Array;
  lifts: Float32Array;
  depths: Float32Array;
  zSpreads: Float32Array;
};

function createDustDisk(count: number, size: number, texture: THREE.Texture | null, opacity: number): DustDisk {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const radii = new Float32Array(count);
  const angles = new Float32Array(count);
  const speeds = new Float32Array(count);
  const flatten = new Float32Array(count);
  const lifts = new Float32Array(count);
  const depths = new Float32Array(count);
  const zSpreads = new Float32Array(count);
  const ember = new THREE.Color(0xff6a26);
  const gold = new THREE.Color(0xffd9a0);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    radii[i] = 1.66 + Math.pow(Math.random(), 1.45) * 5.4;
    zSpreads[i] = THREE.MathUtils.randFloatSpread(2);
    angles[i] = THREE.MathUtils.randFloat(0, Math.PI * 2);
    speeds[i] = (1.5 / Math.pow(radii[i], 1.7)) * THREE.MathUtils.randFloat(0.6, 1.4) * (Math.random() > 0.05 ? 1 : -1);
    flatten[i] = THREE.MathUtils.randFloat(0.26, 0.38);
    lifts[i] = THREE.MathUtils.randFloat(0.02, 0.1);
    depths[i] = THREE.MathUtils.randFloatSpread(0.5) - 0.1;
    const heat = Math.pow(1 - (radii[i] - 1.66) / 5.4, 1.3);
    color.lerpColors(ember, gold, heat * THREE.MathUtils.randFloat(0.5, 1));
    const intensity = 0.35 + heat * 1.1;
    colors[i * 3] = color.r * intensity;
    colors[i * 3 + 1] = color.g * intensity;
    colors[i * 3 + 2] = color.b * intensity;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    map: texture ?? undefined,
    vertexColors: true,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    sizeAttenuation: true,
  });
  material.fog = false;
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 0;
  return { points, positions, radii, angles, speeds, flatten, lifts, depths, zSpreads };
}

function updateDustDisk(dust: DustDisk, elapsed: number, intensity: number, tunnel: number) {
  const count = dust.radii.length;
  for (let i = 0; i < count; i += 1) {
    const angle = dust.angles[i] + elapsed * dust.speeds[i] * (0.25 + intensity * 1.9);
    const radius = dust.radii[i] + Math.sin(angle * 2 + i * 0.71) * 0.06;
    const upper = Math.max(0, Math.sin(angle));
    const lift = upper * upper * radius * dust.lifts[i];
    dust.positions[i * 3] = Math.cos(angle) * radius;
    dust.positions[i * 3 + 1] = Math.sin(angle) * radius * dust.flatten[i] + lift;
    dust.positions[i * 3 + 2] = dust.depths[i] + dust.zSpreads[i] * tunnel;
  }
  (dust.points.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
}

function createPuffCloud(count: number, texture: THREE.Texture, screenScale: number): DustDisk {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const tiles = new Float32Array(count);
  const rotations = new Float32Array(count);
  const sizes = new Float32Array(count);
  const radii = new Float32Array(count);
  const angles = new Float32Array(count);
  const speeds = new Float32Array(count);
  const flatten = new Float32Array(count);
  const lifts = new Float32Array(count);
  const depths = new Float32Array(count);
  const zSpreads = new Float32Array(count);
  const ember = new THREE.Color(0xe06a28);
  const cream = new THREE.Color(0xffe4bb);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    radii[i] = 1.9 + Math.pow(Math.random(), 1.2) * 8.0;
    zSpreads[i] = THREE.MathUtils.randFloatSpread(2);
    angles[i] = THREE.MathUtils.randFloat(0, Math.PI * 2);
    speeds[i] = (1.5 / Math.pow(radii[i], 1.7)) * THREE.MathUtils.randFloat(0.6, 1.4) * (Math.random() > 0.05 ? 1 : -1);
    flatten[i] = THREE.MathUtils.randFloat(0.28, 0.34);
    lifts[i] = THREE.MathUtils.randFloat(0.02, 0.08);
    depths[i] = THREE.MathUtils.randFloatSpread(0.4) - 0.1;
    tiles[i] = Math.floor(Math.random() * 16);
    rotations[i] = angles[i] + Math.PI / 2 + THREE.MathUtils.randFloatSpread(0.5);
    sizes[i] = THREE.MathUtils.randFloat(0.9, 2.2);
    const heat = Math.pow(1 - (radii[i] - 1.9) / 8.0, 1.15);
    color.lerpColors(ember, cream, Math.min(1, heat * THREE.MathUtils.randFloat(0.75, 1.25)));
    const intensity = 0.7 + heat * 1.7;
    colors[i * 3] = color.r * intensity;
    colors[i * 3 + 1] = color.g * intensity;
    colors[i * 3 + 2] = color.b * intensity;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aTile", new THREE.BufferAttribute(tiles, 1));
  geometry.setAttribute("aRot", new THREE.BufferAttribute(rotations, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uOpacity: { value: 0 },
      uScale: { value: screenScale },
      uSize: { value: 1.45 },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aTile;
      attribute float aRot;
      attribute float aSize;
      uniform float uScale;
      uniform float uSize;
      varying vec3 vColor;
      varying float vTile;
      varying float vRot;
      void main() {
        vColor = aColor;
        vTile = aTile;
        vRot = aRot;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * aSize * (uScale / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vTile;
      varying float vRot;
      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float c = cos(vRot);
        float s = sin(vRot);
        vec2 rotated = vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c);
        float mask = 1.0 - smoothstep(0.3, 0.5, length(rotated));
        if (mask < 0.004) discard;
        vec2 local = clamp(rotated + 0.5, 0.0, 1.0);
        float col = mod(vTile, 4.0);
        float row = floor(vTile / 4.0);
        vec2 uv = (vec2(col, row) + local) * 0.25;
        vec3 tex = texture2D(uMap, uv).rgb;
        gl_FragColor = vec4(tex * vColor * uOpacity * mask, 1.0);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  material.fog = false;

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 0;
  return { points, positions, radii, angles, speeds, flatten, lifts, depths, zSpreads };
}

function createDiskHalf(texture: THREE.Texture, thetaStart: number): THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.RingGeometry(1.5, 9.4, 160, 1, thetaStart, Math.PI);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uTime: { value: 0 },
      uSpeed: { value: 0.1 },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uSpeed;
      uniform float uOpacity;
      varying vec2 vPos;
      void main() {
        float r = length(vPos);
        float theta = atan(vPos.y, vPos.x);
        float omega = 1.6 / pow(max(r, 0.8), 1.5);
        float sheared = theta - uTime * uSpeed * omega;
        vec2 flowPos = vec2(cos(sheared), sin(sheared)) * r;
        vec2 uv = flowPos / 19.0 + 0.5;
        vec3 tex = texture2D(uMap, uv).rgb;
        float side = vPos.x / max(r, 0.001);
        float doppler = mix(1.65, 0.42, smoothstep(-1.0, 1.0, side));
        vec3 color = tex * doppler;
        color = mix(color, color * vec3(0.95, 1.0, 1.1), (1.0 - smoothstep(-1.0, 0.0, side)) * 0.3);
        float inner = smoothstep(1.5, 2.1, r);
        float outer = 1.0 - smoothstep(7.4, 9.4, r);
        gl_FragColor = vec4(color * (uOpacity * inner * outer), 1.0);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  material.fog = false;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

function createSparkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.28, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(128, 128, 2, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.12, "rgba(137,224,255,0.95)");
  gradient.addColorStop(0.36, "rgba(24,130,255,0.42)");
  gradient.addColorStop(1, "rgba(0,40,150,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createBeamTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const vertical = context.createLinearGradient(0, 0, 0, canvas.height);
  vertical.addColorStop(0, "rgba(238,253,255,1)");
  vertical.addColorStop(0.12, "rgba(103,224,255,0.95)");
  vertical.addColorStop(0.5, "rgba(57,151,255,0.52)");
  vertical.addColorStop(1, "rgba(65,105,255,0)");
  context.fillStyle = vertical;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalCompositeOperation = "destination-in";
  const horizontal = context.createLinearGradient(0, 0, canvas.width, 0);
  horizontal.addColorStop(0, "rgba(255,255,255,0)");
  horizontal.addColorStop(0.34, "rgba(255,255,255,0.82)");
  horizontal.addColorStop(0.5, "rgba(255,255,255,1)");
  horizontal.addColorStop(0.66, "rgba(255,255,255,0.82)");
  horizontal.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = horizontal;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createAccretionRibbonTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.globalCompositeOperation = "lighter";
  for (let i = 0; i < 190; i += 1) {
    const radiusX = THREE.MathUtils.randFloat(150, 500);
    const radiusY = radiusX * THREE.MathUtils.randFloat(0.075, 0.24);
    const start = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const span = THREE.MathUtils.randFloat(0.28, 1.85);
    const bright = Math.random() > 0.82;
    const alpha = bright ? THREE.MathUtils.randFloat(0.16, 0.34) : THREE.MathUtils.randFloat(0.025, 0.13);
    const red = 255;
    const green = Math.round(THREE.MathUtils.randFloat(92, 205));
    const blue = Math.round(THREE.MathUtils.randFloat(32, 116));
    context.beginPath();
    context.ellipse(512, 258 + THREE.MathUtils.randFloatSpread(20), radiusX, radiusY, THREE.MathUtils.randFloatSpread(0.035), start, start + span);
    context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    context.lineWidth = bright ? THREE.MathUtils.randFloat(1.3, 3.1) : THREE.MathUtils.randFloat(0.45, 1.45);
    context.shadowColor = `rgba(255, 115, 38, ${alpha * 0.72})`;
    context.shadowBlur = bright ? 12 : 5;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createNebulaTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const image = context.createImageData(canvas.width, canvas.height);
  const data = image.data;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const nx = x / canvas.width - 0.5;
      const ny = y / canvas.height - 0.5;
      const ridge = Math.exp(-Math.pow((ny + Math.sin(nx * 8) * 0.075) * 5.6, 2));
      const cloud = Math.exp(-(nx * nx * 2.4 + ny * ny * 8.5));
      const filaments = 0.55 + 0.45 * Math.sin(nx * 44 + Math.sin(ny * 18) * 2.2);
      const noise = Math.random() * 0.28 + filaments * 0.72;
      const edgeX = Math.min(1, Math.max(0, (0.5 - Math.abs(nx)) * 4));
      const edgeY = Math.min(1, Math.max(0, (0.5 - Math.abs(ny)) * 4));
      const alpha = Math.min(1, ridge * cloud * noise * edgeX * edgeY * 1.35);
      const index = (y * canvas.width + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = Math.round(alpha * 255);
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFallbackShip() {
  const ship = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xc64438, roughness: 0.32, metalness: 0.72 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17202b, roughness: 0.28, metalness: 0.82 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x5bc7e8, emissive: 0x154c69, emissiveIntensity: 1.4, roughness: 0.12, metalness: 0.25 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x6eeeff, transparent: true, opacity: 0.9 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 1.7, 8, 18), red);
  body.rotation.x = Math.PI / 2;
  ship.add(body);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), glass);
  cockpit.scale.set(0.78, 0.48, 1.08);
  cockpit.position.set(0, 0.32, -0.45);
  ship.add(cockpit);

  const wingGeometry = new THREE.BoxGeometry(1.55, 0.1, 0.7);
  const wings = new THREE.Mesh(wingGeometry, dark);
  wings.position.z = 0.35;
  ship.add(wings);

  [-0.28, 0.28].forEach((x) => {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.48, 16), dark);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, -0.12, 1.05);
    ship.add(engine);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.75, 14), glow);
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(x, -0.12, 1.55);
    ship.add(flame);
  });

  return ship;
}

export function SpaceScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020510);
    scene.fog = new THREE.FogExp2(0x01030a, 0.0145);

    new THREE.TextureLoader().load(
      SKYBOX_URL,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        scene.background = texture;
        scene.backgroundIntensity = SKYBOX_INTENSITY;
        scene.backgroundRotation.set(0, SKYBOX_ROTATION_Y, 0);
      },
      undefined,
      () => {},
    );

    const camera = new THREE.PerspectiveCamera(48, mount.clientWidth / mount.clientHeight, 0.1, 150);
    camera.position.set(0, 0.95, 7.7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x020510, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute("aria-label", "Voyage interactif dans l’espace, pilotable avec la souris ou les flèches du clavier");
    mount.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x04060d);
    const envWarm = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff8a3a }));
    envWarm.position.set(35, 22, -70);
    envScene.add(envWarm);
    const envCool = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 16), new THREE.MeshBasicMaterial({ color: 0x1c4f9e }));
    envCool.position.set(-45, -28, 35);
    envScene.add(envCool);
    const envTarget = pmrem.fromScene(envScene, 0.4);
    scene.environment = envTarget.texture;
    envWarm.geometry.dispose();
    envWarm.material.dispose();
    envCool.geometry.dispose();
    envCool.material.dispose();
    pmrem.dispose();

    const composerTarget = new THREE.WebGLRenderTarget(mount.clientWidth, mount.clientHeight, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    const composer = new EffectComposer(renderer, composerTarget);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    composer.setSize(mount.clientWidth, mount.clientHeight);
    composer.addPass(new RenderPass(scene, camera));
    const lensingPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uCenter: { value: new THREE.Vector2(0.66, 0.68) },
        uRadius: { value: 0.1 },
        uStrength: { value: 0 },
        uAspect: { value: mount.clientWidth / mount.clientHeight },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uCenter;
        uniform float uRadius;
        uniform float uStrength;
        uniform float uAspect;
        varying vec2 vUv;

        vec2 distort(vec2 uv, float k) {
          vec2 d = uv - uCenter;
          d.x *= uAspect;
          float r = length(d);
          float pull = k * uRadius * uRadius / max(r, uRadius * 0.35);
          float inner = smoothstep(uRadius * 0.3, uRadius * 0.9, r);
          vec2 dir = d / max(r, 1e-4);
          vec2 offset = -dir * pull * inner;
          offset.x /= uAspect;
          return uv + offset;
        }

        void main() {
          float red = texture2D(tDiffuse, distort(vUv, uStrength * 1.04)).r;
          float green = texture2D(tDiffuse, distort(vUv, uStrength)).g;
          float blue = texture2D(tDiffuse, distort(vUv, uStrength * 0.96)).b;
          gl_FragColor = vec4(red, green, blue, 1.0);
        }
      `,
    });
    composer.addPass(lensingPass);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(mount.clientWidth, mount.clientHeight), 0.38, 0.28, 1.0);
    composer.addPass(bloomPass);
    const gradingPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec3 color = texel.rgb;
          float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
          float shadows = 1.0 - smoothstep(0.0, 0.38, luma);
          float highlights = smoothstep(0.55, 1.7, luma);
          color = mix(color, color * vec3(0.8, 0.97, 1.2) + vec3(0.0, 0.004, 0.011), shadows * 0.5);
          color = mix(color, color * vec3(1.07, 1.0, 0.9), highlights * 0.35);
          float luma2 = dot(color, vec3(0.2126, 0.7152, 0.0722));
          color = mix(vec3(luma2), color, 1.09);
          gl_FragColor = vec4(color, texel.a);
        }
      `,
    });
    composer.addPass(gradingPass);
    composer.addPass(new OutputPass());

    const ambient = new THREE.HemisphereLight(0x5f8ecf, 0x0d0509, 0.85);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffd9b8, 2.6);
    key.position.set(-4, 5, 5);
    key.castShadow = true;
    scene.add(key);
    const holeRim = new THREE.DirectionalLight(0xffa14f, 4);
    holeRim.position.set(5.3, 3.15, -18.5);
    scene.add(holeRim);
    const coldRim = new THREE.DirectionalLight(0x3f8fd8, 2.4);
    coldRim.position.set(-5, -2, -4);
    scene.add(coldRim);

    const coolFill = new THREE.PointLight(0x2e8cff, 14, 22, 2);
    coolFill.position.set(-2.5, -1.5, 2.8);
    scene.add(coolFill);

    const farStars = createStars(1550, 78, 115, 0.115);
    const nearDust = createStars(260, 30, 64, 0.085);
    const streaks = createStreaks(340);
    nearDust.points.material.color.set(0x76cfff);
    nearDust.points.material.opacity = 0.5;
    scene.add(farStars.points, nearDust.points, streaks.lines);

    const glowTexture = createGlowTexture();
    const beamTexture = createBeamTexture();
    const nebulaTexture = createNebulaTexture();
    const accretionRibbonTexture = createAccretionRibbonTexture();
    const sparkTexture = createSparkTexture();

    if (sparkTexture) {
      [farStars, nearDust].forEach((field) => {
        field.points.material.map = sparkTexture;
        field.points.material.needsUpdate = true;
      });
    }

    if (nebulaTexture) {
      const nebulaBlueMaterial = new THREE.SpriteMaterial({
        map: nebulaTexture,
        color: 0x315fb4,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const nebulaBlue = new THREE.Sprite(nebulaBlueMaterial);
      nebulaBlue.position.set(-7, 2.6, -52);
      nebulaBlue.scale.set(52, 25, 1);
      scene.add(nebulaBlue);

      const nebulaVioletMaterial = nebulaBlueMaterial.clone();
      nebulaVioletMaterial.color.set(0x471d78);
      nebulaVioletMaterial.opacity = 0.26;
      const nebulaViolet = new THREE.Sprite(nebulaVioletMaterial);
      nebulaViolet.position.set(12, -5, -58);
      nebulaViolet.scale.set(46, 23, 1);
      nebulaViolet.rotation.z = -0.28;
      scene.add(nebulaViolet);
    }

    const singularity = new THREE.Group();
    singularity.position.set(5.3, 3.15, -18.5);
    singularity.rotation.z = -0.045;

    const dustFine = createDustDisk(2600, 0.085, sparkTexture, 0.12);
    const puffTexture = new THREE.TextureLoader().load(PUFF_ATLAS_URL);
    puffTexture.colorSpace = THREE.SRGBColorSpace;
    const puffScreenScale = () => mount.clientHeight * 0.5 * Math.min(window.devicePixelRatio, 1.5);
    const dustPuffs = createPuffCloud(720, puffTexture, puffScreenScale());
    singularity.add(dustFine.points, dustPuffs.points);

    const diskTexture = new THREE.TextureLoader().load(DISK_TEXTURE_URL);
    diskTexture.colorSpace = THREE.SRGBColorSpace;
    const diskGroup = new THREE.Group();
    diskGroup.rotation.x = -1.265;
    const diskFar = createDiskHalf(diskTexture, 0);
    diskFar.renderOrder = 1;
    const diskNear = createDiskHalf(diskTexture, Math.PI);
    diskNear.renderOrder = 3;
    diskGroup.add(diskFar, diskNear);
    singularity.add(diskGroup);

    const swirlMaterial = new THREE.SpriteMaterial({
      map: accretionRibbonTexture ?? undefined,
      color: 0xffb46b,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    swirlMaterial.toneMapped = false;
    swirlMaterial.fog = false;
    const accretionSwirl = new THREE.Sprite(swirlMaterial);
    accretionSwirl.scale.set(18.5, 9.25, 1);
    accretionSwirl.position.z = -0.12;
    accretionSwirl.renderOrder = 1;
    singularity.add(accretionSwirl);

    const blackHoleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uApproach: { value: 0 },
        uProximity: { value: 0 },
        uWarp: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uApproach;
        uniform float uProximity;
        uniform float uWarp;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.52;
          mat2 rotation = mat2(0.86, -0.5, 0.5, 0.86);
          for (int i = 0; i < 5; i++) {
            value += amplitude * noise(p);
            p = rotation * p * 2.03 + 7.13;
            amplitude *= 0.49;
          }
          return value;
        }

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          vec2 q = vec2(p.x * 1.56, p.y);
          float radius = length(q);
          float angle = atan(q.y, q.x);
          float time = uTime * 0.09;

          float swirlCoord = angle * 2.0 - 5.5 / (radius + 0.35) - time * 2.6;
          float flow = fbm(vec2(swirlCoord * 1.6, radius * 6.0 - time * 1.2));
          float flowDetail = fbm(vec2(swirlCoord * 3.4 + 13.7, radius * 14.0 + time * 0.8));
          float gaseousWarp = (flow - 0.5) * 0.16 + (flowDetail - 0.5) * 0.05;

          float core = 1.0 - smoothstep(0.30, 0.318, radius + gaseousWarp * 0.08);

          float ringDist = abs(radius + gaseousWarp * 0.05 - 0.335);
          float photonCore = exp(-pow(ringDist * 175.0, 1.4));
          float photonGlow = exp(-pow(ringDist * 40.0, 1.2));
          float ringPulse = 1.0 + 0.08 * sin(uTime * 0.7) + 0.04 * sin(uTime * 0.23 + 2.1);
          float photonRing = (photonCore * 1.65 + photonGlow * 0.26) * ringPulse;

          float tiltedY = q.y + q.x * 0.05;
          float diskWarp = gaseousWarp * smoothstep(0.25, 1.2, abs(q.x));
          float diskBand = exp(-pow(abs(tiltedY + diskWarp) * 7.0, 1.35));
          float hotSpine = exp(-pow(abs(tiltedY + diskWarp * 0.4) * 60.0, 1.05));
          float diskReach = smoothstep(1.42, 0.28, abs(q.x));
          float centerHeat = exp(-abs(q.x) * 1.7);
          float turbulence = 0.6 + flow * 0.55 + flowDetail * 0.2;
          float calm = 1.0 - uWarp * 0.32 - uProximity * 0.3;
          float diskCloud = diskBand * diskReach * turbulence;
          float disk = diskReach * (diskCloud * 0.45 + hotSpine * (1.1 + flowDetail * 0.8) * (0.5 + centerHeat * 1.15) * calm);
          float doppler = mix(1.9, 0.38, smoothstep(-1.1, 1.1, q.x));
          disk *= doppler;

          float spotAngle = uTime * 0.55;
          float spotDelta = atan(sin(angle - spotAngle), cos(angle - spotAngle));
          float flare = pow(max(0.0, sin(uTime * 0.16 + 1.3)), 18.0);
          float hotspot = exp(-spotDelta * spotDelta * 9.0) * exp(-pow(abs(radius - 0.36) * 22.0, 1.4)) * (0.55 + flare * 1.7);

          float bentRadius = radius + gaseousWarp * 0.42;
          float archNoise = 0.42 + fbm(vec2(swirlCoord * 1.2, bentRadius * 9.0)) * 0.7;
          float upperArch = exp(-pow(abs(bentRadius - 0.5) * 9.5, 1.3)) * smoothstep(-0.05, 0.3, q.y) * archNoise;
          float lowerArch = exp(-pow(abs(bentRadius - 0.42) * 11.0, 1.3)) * smoothstep(0.03, -0.28, q.y) * archNoise * 0.55;

          float threadPhase = radius * 26.0 - angle * 4.0 - time * 11.0 + flow * 6.0;
          float spiralThreads = pow(0.5 + 0.5 * sin(threadPhase), 6.0);
          float threadEnvelope = smoothstep(0.36, 0.5, radius) * (1.0 - smoothstep(0.95, 1.5, radius));
          float threadMask = smoothstep(0.35, 0.8, flowDetail + flow * 0.3);
          float filamentEnergy = spiralThreads * threadEnvelope * threadMask * (0.35 + uProximity * 1.0);

          float haloEnvelope = smoothstep(0.3, 0.42, radius) * (1.0 - smoothstep(0.75, 1.25, radius));
          float haloCells = smoothstep(0.32, 0.8, flow + flowDetail * 0.25);
          float asymmetry = 0.5 + 0.5 * sin(angle * 2.2 - time * 1.5 + flow * 4.0);
          float halo = haloEnvelope * haloCells * asymmetry * 0.55;

          float hotEnergy = disk * 1.2 + photonRing * (1.05 - uWarp * 0.15 - uProximity * 0.12) + upperArch * 0.85 + lowerArch + filamentEnergy * 0.6 + hotspot * 0.9;
          float cloudEnergy = halo * (0.7 + uProximity * 0.25) + diskCloud * 0.3;

          vec3 ember = vec3(0.42, 0.05, 0.015);
          vec3 amber = vec3(1.0, 0.30, 0.04);
          vec3 gold = vec3(1.0, 0.72, 0.30);
          vec3 whiteHot = vec3(1.0, 0.96, 0.88);
          vec3 hotColor = mix(amber, gold, smoothstep(0.3, 1.1, hotEnergy));
          hotColor = mix(hotColor, whiteHot, smoothstep(1.15, 2.4, hotEnergy));
          hotColor = mix(hotColor, hotColor * vec3(0.94, 1.0, 1.16), (1.0 - smoothstep(-1.0, 0.2, q.x)) * 0.5);
          hotColor = mix(hotColor, hotColor * vec3(1.05, 0.7, 0.48), smoothstep(0.15, 1.1, q.x) * 0.42);
          vec3 emberColor = mix(vec3(0.09, 0.02, 0.03), ember, flow) * 1.6;

          vec3 color = hotColor * hotEnergy + emberColor * cloudEnergy;
          color += vec3(1.0, 0.88, 0.62) * photonCore * (0.85 - uWarp * 0.3 - uProximity * 0.2);
          color += whiteHot * hotSpine * diskReach * centerHeat * doppler * 0.7 * calm * calm;

          float arrivalFlash = smoothstep(0.88, 1.0, uApproach) * exp(-radius * radius * 4.5);
          color += whiteHot * arrivalFlash * 4.5;

          float diskInFront = smoothstep(0.3, 0.75, hotSpine * diskReach * calm);
          color = mix(vec3(0.0, 0.0005, 0.002), color, max(1.0 - core, diskInFront));
          float alpha = max(core * 0.997, clamp(hotEnergy * 0.8 + cloudEnergy * 0.7 + arrivalFlash, 0.0, 1.0));
          float edgeFade = (1.0 - smoothstep(0.66, 0.97, abs(p.x))) * (1.0 - smoothstep(0.62, 0.96, abs(p.y)));
          alpha *= edgeFade;

          if (alpha < 0.012) discard;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    blackHoleMaterial.toneMapped = false;
    const blackHolePlane = new THREE.Mesh(new THREE.PlaneGeometry(15.8, 10.1), blackHoleMaterial);
    blackHolePlane.renderOrder = 2;
    singularity.add(blackHolePlane);

    const coronaMaterial = new THREE.SpriteMaterial({ map: glowTexture ?? undefined, color: 0xff6228, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
    coronaMaterial.fog = false;
    const corona = new THREE.Sprite(coronaMaterial);
    corona.scale.set(17.5, 17.5, 1);
    corona.renderOrder = 1;
    singularity.add(corona);

    const proximitySprites: THREE.Sprite[] = [];
    if (nebulaTexture) {
      const accretionMistMaterial = new THREE.SpriteMaterial({ map: nebulaTexture, color: 0xff6c2e, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
      accretionMistMaterial.fog = false;
      const accretionMist = new THREE.Sprite(accretionMistMaterial);
      accretionMist.scale.set(20.5, 8.8, 1);
      accretionMist.rotation.z = 0.08;
      accretionMist.position.z = -0.25;
      accretionMist.renderOrder = 0;
      accretionMist.userData.baseOpacity = 0.12;
      proximitySprites.push(accretionMist);
      singularity.add(accretionMist);

      const upperMistMaterial = accretionMistMaterial.clone();
      upperMistMaterial.color.set(0xffb06e);
      upperMistMaterial.opacity = 0.06;
      const upperMist = new THREE.Sprite(upperMistMaterial);
      upperMist.scale.set(13.5, 10.5, 1);
      upperMist.rotation.z = -0.42;
      upperMist.position.set(0.6, 1.05, -0.32);
      upperMist.renderOrder = 0;
      upperMist.userData.baseOpacity = 0.06;
      proximitySprites.push(upperMist);
      singularity.add(upperMist);
    }
    scene.add(singularity);

    const accretionLight = new THREE.PointLight(0xff8a43, 36, 46, 2);
    accretionLight.position.copy(singularity.position);
    scene.add(accretionLight);

    const shipRig = new THREE.Group();
    shipRig.position.set(1.25, -0.56, 0.1);
    shipRig.scale.setScalar(1.16);
    scene.add(shipRig);
    const fallback = createFallbackShip();
    fallback.scale.setScalar(0.82);
    shipRig.add(fallback);

    const engineGlows = new THREE.Group();
    const enginePositions = [
      { x: -0.72, scale: 0.74 },
      { x: 0, scale: 1.18 },
      { x: 0.72, scale: 0.74 },
    ];
    enginePositions.forEach(({ x, scale }) => {
      const engineMaterial = new THREE.SpriteMaterial({ map: glowTexture ?? undefined, color: 0x39cfff, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
      const engineGlow = new THREE.Sprite(engineMaterial);
      engineGlow.position.set(x, -0.06, 2.05);
      engineGlow.scale.set(scale, scale, 1);
      engineGlows.add(engineGlow);

      const engineCoreMaterial = new THREE.SpriteMaterial({ map: glowTexture ?? undefined, color: 0xe9fcff, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
      const engineCore = new THREE.Sprite(engineCoreMaterial);
      engineCore.position.set(x, -0.06, 2.08);
      engineCore.scale.set(scale * 0.38, scale * 0.38, 1);
      engineGlows.add(engineCore);
    });
    shipRig.add(engineGlows);

    const engineTrails = new THREE.Group();
    enginePositions.forEach(({ x, scale }) => {
      const angle = x < 0 ? -0.115 : x > 0 ? 0.115 : 0;
      const anchorZ = 2.11;

      const outerMaterial = new THREE.SpriteMaterial({
        map: beamTexture ?? undefined,
        color: 0x36c8ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      outerMaterial.toneMapped = false;
      outerMaterial.rotation = angle;
      const outerTrail = new THREE.Sprite(outerMaterial);
      outerTrail.center.set(0.5, 1);
      outerTrail.position.set(x, -0.06, anchorZ);
      outerTrail.scale.set(0.94 * scale, 0.12, 1);
      outerTrail.userData.width = 0.94 * scale;
      outerTrail.userData.strength = x === 0 ? 0.62 : 0.76;
      outerTrail.userData.phase = (x + 1) * 3.7;
      outerTrail.userData.lengthScale = 1;
      outerTrail.renderOrder = 9;
      engineTrails.add(outerTrail);

      const coreMaterial = new THREE.SpriteMaterial({
        map: beamTexture ?? undefined,
        color: 0xe9fdff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      coreMaterial.toneMapped = false;
      coreMaterial.rotation = angle;
      const coreTrail = new THREE.Sprite(coreMaterial);
      coreTrail.center.set(0.5, 1);
      coreTrail.position.set(x, -0.06, anchorZ + 0.02);
      coreTrail.scale.set(0.3 * scale, 0.12, 1);
      coreTrail.userData.width = 0.3 * scale;
      coreTrail.userData.strength = x === 0 ? 0.82 : 0.94;
      coreTrail.userData.phase = (x + 1) * 4.9 + 1.2;
      coreTrail.userData.lengthScale = 0.9;
      coreTrail.renderOrder = 10;
      engineTrails.add(coreTrail);
    });
    shipRig.add(engineTrails);

    const engineLight = new THREE.PointLight(0x48cfff, 22, 10, 2);
    engineLight.position.set(0, -0.1, 2.1);
    shipRig.add(engineLight);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      MODEL_URL,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(center);
        model.scale.setScalar(4.35 / Math.max(size.x, size.y, size.z));
        model.rotation.y = -Math.PI / 2;
        model.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            if (object.material instanceof THREE.MeshStandardMaterial) {
              object.material.envMapIntensity = 0.85;
              object.material.roughnessMap = null;
              object.material.roughness = 0.55;
              object.material.metalness = THREE.MathUtils.clamp(object.material.metalness, 0.3, 0.75);
              object.material.needsUpdate = true;
              object.material.color.set(0xffa59d);
              object.material.emissive.set(0x160307);
              object.material.emissiveIntensity = 0.24;
            }
          }
        });
        shipRig.remove(fallback);
        fallback.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            (object.material as THREE.Material).dispose();
          }
        });
        shipRig.add(model);
        setModelReady(true);
        setLoading(false);
      },
      undefined,
      () => setLoading(false),
    );

    const debris: THREE.Mesh[] = [];
    const debrisMaterial = new THREE.MeshStandardMaterial({ color: 0x26384b, roughness: 0.95, metalness: 0.1, flatShading: true, transparent: true });
    debrisMaterial.envMapIntensity = 0.25;
    const debrisSpawnXY = () => {
      let x = 0;
      let y = 0;
      do {
        x = THREE.MathUtils.randFloatSpread(20);
        y = THREE.MathUtils.randFloatSpread(11);
      } while (Math.abs(x - 5.3) < 5 && Math.abs(y - 3.15) < 3.6);
      return { x, y };
    };
    for (let i = 0; i < 15; i += 1) {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(THREE.MathUtils.randFloat(0.06, 0.18), 1), debrisMaterial);
      const spawn = debrisSpawnXY();
      rock.position.set(spawn.x, spawn.y, THREE.MathUtils.randFloat(-50, -8));
      rock.scale.set(1, THREE.MathUtils.randFloat(0.45, 1.5), THREE.MathUtils.randFloat(0.55, 1.2));
      rock.userData.speed = THREE.MathUtils.randFloat(2.1, 4.4);
      rock.userData.spin = new THREE.Vector3(THREE.MathUtils.randFloatSpread(1), THREE.MathUtils.randFloatSpread(1), THREE.MathUtils.randFloatSpread(1));
      debris.push(rock);
      scene.add(rock);
    }

    const pointer = new THREE.Vector2();
    const target = new THREE.Vector2();
    const keyboard = new THREE.Vector2();
    const onPointerMove = (event: PointerEvent) => {
      target.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };
    const onPointerLeave = () => target.set(0, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft") keyboard.x = -1;
      if (event.key === "ArrowRight") keyboard.x = 1;
      if (event.key === "ArrowUp") keyboard.y = 1;
      if (event.key === "ArrowDown") keyboard.y = -1;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight"].includes(event.key)) keyboard.x = 0;
      if (["ArrowUp", "ArrowDown"].includes(event.key)) keyboard.y = 0;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const shell = mount.closest(".space-shell") as HTMLElement | null;
    let scrollTarget = 0;
    let scrollProgress = 0;
    const updateScrollTarget = () => {
      const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollTarget = THREE.MathUtils.clamp(window.scrollY / scrollRange, 0, 1);
    };
    updateScrollTarget();
    window.addEventListener("scroll", updateScrollTarget, { passive: true });

    const timer = new THREE.Timer();
    timer.connect(document);
    const lensProjCenter = new THREE.Vector3();
    const lensProjEdge = new THREE.Vector3();
    const lensRight = new THREE.Vector3();
    const streakCool = new THREE.Color(0x94cfff);
    const streakHot = new THREE.Color(0xff9a4a);
    const dustCool = new THREE.Color(0x76cfff);
    const dustHot = new THREE.Color(0xffb984);
    let frame = 0;

    const moveField = (field: ReturnType<typeof createStars>, speed: number, delta: number) => {
      const positionAttribute = field.points.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < field.speeds.length; i += 1) {
        field.positions[i * 3 + 2] += speed * field.speeds[i] * delta;
        if (field.positions[i * 3 + 2] > 8) field.positions[i * 3 + 2] = -100;
      }
      positionAttribute.needsUpdate = true;
    };

    const moveStreaks = (speed: number, delta: number) => {
      const positionAttribute = streaks.lines.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < streaks.speeds.length; i += 1) {
        const offset = i * 6;
        const movement = speed * streaks.speeds[i] * delta;
        streaks.positions[offset + 2] += movement;
        streaks.positions[offset + 5] += movement;
        if (streaks.positions[offset + 2] > 7) {
          const z = THREE.MathUtils.randFloat(-80, -45);
          streaks.positions[offset + 2] = z;
          streaks.positions[offset + 5] = z - THREE.MathUtils.randFloat(1.2, 4.2);
        }
      }
      positionAttribute.needsUpdate = true;
    };

    const animate = (timestamp?: number) => {
      frame = requestAnimationFrame(animate);
      timer.update(timestamp);
      const delta = Math.min(timer.getDelta(), 0.04);
      const elapsed = timer.getElapsed();
      scrollProgress = THREE.MathUtils.damp(scrollProgress, scrollTarget, reduceMotion ? 18 : 3.8, delta);
      const approach = THREE.MathUtils.smoothstep(scrollProgress, 0.04, 0.94);
      const warp = THREE.MathUtils.smoothstep(scrollProgress, 0.14, 0.82);
      const deepApproach = THREE.MathUtils.smoothstep(scrollProgress, 0.68, 0.955);
      const plunge = THREE.MathUtils.smoothstep(scrollProgress, 0.79, 0.96);
      const arrival = THREE.MathUtils.smoothstep(scrollProgress, 0.965, 1);
      const steeringX = THREE.MathUtils.clamp(target.x + keyboard.x * 0.62, -1, 1);
      const steeringY = THREE.MathUtils.clamp(target.y + keyboard.y * 0.62, -1, 1);
      pointer.x = THREE.MathUtils.damp(pointer.x, steeringX, 3.2, delta);
      pointer.y = THREE.MathUtils.damp(pointer.y, steeringY, 3.2, delta);

      const steeringStrength = 1 - approach * 0.82;
      const shipTargetX = THREE.MathUtils.lerp(1.25, 0.02, approach) + pointer.x * 1.25 * steeringStrength;
      const shipTargetY = THREE.MathUtils.lerp(-0.56, -0.82, approach) + pointer.y * 0.62 * steeringStrength;
      const shipTargetZ = THREE.MathUtils.lerp(0, -2.65, warp) - plunge * 3.65 - arrival * 1.4 + Math.sin(elapsed * 1.25) * 0.055;
      shipRig.position.x = THREE.MathUtils.damp(shipRig.position.x, shipTargetX, 3.1, delta);
      shipRig.position.y = THREE.MathUtils.damp(shipRig.position.y, shipTargetY, 3.1, delta);
      shipRig.position.z = THREE.MathUtils.damp(shipRig.position.z, shipTargetZ, 3.4, delta);
      const shipScale = THREE.MathUtils.lerp(1.16, 0.92, warp) - plunge * 0.4 - arrival * 0.12;
      const dampedShipScale = THREE.MathUtils.damp(shipRig.scale.x, shipScale, 3.4, delta);
      shipRig.scale.setScalar(dampedShipScale);
      shipRig.rotation.z = THREE.MathUtils.damp(shipRig.rotation.z, -pointer.x * 0.34, 3.2, delta);
      shipRig.rotation.x = THREE.MathUtils.damp(shipRig.rotation.x, pointer.y * 0.12, 3.2, delta);
      shipRig.rotation.y = THREE.MathUtils.damp(shipRig.rotation.y, -pointer.x * 0.13, 3.2, delta);

      engineGlows.children.forEach((child, index) => {
        if (child instanceof THREE.Sprite) {
          const pulse = 1 + Math.sin(elapsed * 8.5 + index * 1.7) * 0.07;
          const base = index % 2 === 0 ? enginePositions[Math.floor(index / 2)]?.scale ?? 0.74 : (enginePositions[Math.floor(index / 2)]?.scale ?? 0.74) * 0.38;
          child.scale.set(base * pulse, base * pulse, 1);
        }
      });

      const trailLength = THREE.MathUtils.lerp(0.12, 8.6, warp);
      engineTrails.children.forEach((child, index) => {
        if (child instanceof THREE.Sprite) {
          const flicker = 1 + Math.sin(elapsed * 18 + child.userData.phase) * 0.055 + Math.sin(elapsed * 37 + index) * 0.022;
          const widthPulse = 1 + Math.sin(elapsed * 12 + child.userData.phase) * 0.035;
          const length = trailLength * child.userData.lengthScale * flicker;
          const widthBoost = THREE.MathUtils.lerp(0.9, 1.52, warp);
          child.scale.set(child.userData.width * widthPulse * widthBoost, length, 1);
          child.position.y = -0.06;
          child.material.opacity = warp * (1 - arrival * 0.24) * child.userData.strength;
        }
      });

      const singularityTargetScale = THREE.MathUtils.lerp(1, 3.12, approach) + plunge * 3.2 + arrival * 0.72;
      const dampedSingularityScale = THREE.MathUtils.damp(singularity.scale.x, singularityTargetScale, 3.2, delta);
      singularity.scale.setScalar(dampedSingularityScale);
      singularity.position.x = THREE.MathUtils.damp(singularity.position.x, THREE.MathUtils.lerp(5.3, 0.55, approach), 3.1, delta);
      singularity.position.y = THREE.MathUtils.damp(singularity.position.y, THREE.MathUtils.lerp(3.15, 1.5, approach), 3.1, delta);
      singularity.position.z = THREE.MathUtils.damp(singularity.position.z, THREE.MathUtils.lerp(-18.5, -8.2, plunge), 2.75, delta);
      singularity.rotation.z = THREE.MathUtils.damp(singularity.rotation.z, THREE.MathUtils.lerp(-0.045, 0.025, approach), 2.8, delta);

      const flare = Math.pow(Math.max(0, Math.sin(elapsed * 0.16 + 1.3)), 18);
      const cameraShake = (warp * (1 - arrival) + flare * 0.85 * approach) * (reduceMotion ? 0 : 1);
      camera.position.x = THREE.MathUtils.damp(camera.position.x, pointer.x * 0.22 + Math.sin(elapsed * 29) * 0.016 * cameraShake, 1.9, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.95 + pointer.y * 0.12 + Math.cos(elapsed * 25) * 0.013 * cameraShake, 1.9, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, 7.7 - warp * 0.6 - plunge * 2.6, 2.5, delta);
      const targetFov = 48 + warp * (1 - deepApproach) * 5.5 - deepApproach * 5.5 + arrival * 8;
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 3.2, delta);
      camera.updateProjectionMatrix();
      camera.lookAt(shipRig.position.x * 0.16, 0, -4);
      camera.rotation.z += (reduceMotion ? 0 : warp * 0.018 + plunge * 0.045);

      const travelScale = reduceMotion ? 0.18 : 1;
      const warpSpeed = 1 + warp * warp * 12;
      moveField(farStars, 2.1 * travelScale * warpSpeed, delta);
      moveField(nearDust, 7.2 * travelScale * warpSpeed, delta);
      moveStreaks((12 + warp * warp * 150) * travelScale, delta);
      (streaks.lines.material as THREE.LineBasicMaterial).opacity = THREE.MathUtils.lerp(0.3, 0.72, warp) * (1 - arrival * 0.35);
      (streaks.lines.material as THREE.LineBasicMaterial).color.lerpColors(streakCool, streakHot, warp);
      (nearDust.points.material as THREE.PointsMaterial).color.lerpColors(dustCool, dustHot, warp);
      const tunnel = deepApproach * 4.5;
      updateDustDisk(dustFine, elapsed, warp, tunnel);
      updateDustDisk(dustPuffs, elapsed, warp, tunnel);
      const ringFade = 1 - THREE.MathUtils.smoothstep(plunge, 0.02, 0.42);
      dustFine.points.material.opacity = (0.07 + warp * 0.1) * (1 - arrival * 0.45);
      (dustPuffs.points.material as THREE.ShaderMaterial).uniforms.uOpacity.value = (0.06 + deepApproach * 0.22) * (1 - arrival * 0.45);
      [diskFar, diskNear].forEach((half) => {
        half.material.uniforms.uTime.value = elapsed;
        half.material.uniforms.uSpeed.value = 0.1 + warp * 0.4;
        half.material.uniforms.uOpacity.value = (0.8 + warp * 0.3) * (1 - arrival * 0.5);
      });
      accretionSwirl.material.rotation = Math.sin(elapsed * 0.075) * 0.018;
      accretionSwirl.material.opacity = 0;
      corona.material.opacity = THREE.MathUtils.lerp(0.1, 0.04, plunge);
      proximitySprites.forEach((sprite) => {
        sprite.material.opacity = sprite.userData.baseOpacity * ringFade;
      });
      debrisMaterial.opacity = 1 - THREE.MathUtils.smoothstep(approach, 0.28, 0.62);
      debris.forEach((rock) => {
        rock.visible = debrisMaterial.opacity > 0.02;
        rock.position.z += rock.userData.speed * delta * travelScale;
        rock.rotation.x += rock.userData.spin.x * delta;
        rock.rotation.y += rock.userData.spin.y * delta;
        if (rock.position.z > 8) {
          rock.position.z = THREE.MathUtils.randFloat(-56, -35);
          const spawn = debrisSpawnXY();
          rock.position.x = spawn.x;
          rock.position.y = spawn.y;
        }
      });

      blackHoleMaterial.uniforms.uTime.value = elapsed;
      blackHoleMaterial.uniforms.uApproach.value = arrival;
      blackHoleMaterial.uniforms.uProximity.value = deepApproach;
      blackHoleMaterial.uniforms.uWarp.value = warp;
      accretionLight.position.copy(singularity.position);
      accretionLight.intensity = THREE.MathUtils.lerp(22, 44, warp);
      holeRim.position.copy(singularity.position);
      holeRim.intensity = 3.5 + warp * 5.5 + Math.sin(elapsed * 2.3) * 0.35 + arrival * 4 + flare * 3;
      bloomPass.strength = 0.34 + warp * 0.1 + arrival * 0.75 + flare * 0.06;
      camera.updateMatrixWorld();
      lensProjCenter.copy(singularity.position).project(camera);
      lensRight.setFromMatrixColumn(camera.matrixWorld, 0);
      lensProjEdge.copy(singularity.position).addScaledVector(lensRight, 1.7 * singularity.scale.x).project(camera);
      const lensAspect = camera.aspect;
      const lensDx = ((lensProjEdge.x - lensProjCenter.x) / 2) * lensAspect;
      const lensDy = (lensProjEdge.y - lensProjCenter.y) / 2;
      lensingPass.uniforms.uCenter.value.set((lensProjCenter.x + 1) / 2, (lensProjCenter.y + 1) / 2);
      lensingPass.uniforms.uRadius.value = Math.sqrt(lensDx * lensDx + lensDy * lensDy);
      lensingPass.uniforms.uStrength.value = 0.045 + approach * 0.12 + plunge * 0.1;
      lensingPass.uniforms.uAspect.value = lensAspect;
      if (shell) {
        shell.style.setProperty("--journey-progress", scrollProgress.toFixed(4));
        shell.style.setProperty("--copy-opacity", String(1 - THREE.MathUtils.smoothstep(scrollProgress, 0.06, 0.32)));
        shell.style.setProperty("--hud-opacity", String(1 - THREE.MathUtils.smoothstep(scrollProgress, 0.62, 0.92) * 0.72));
        shell.style.setProperty("--flash-opacity", String(arrival * arrival));
        shell.style.setProperty("--warp-opacity", String(warp * (1 - arrival * 0.72)));
      }
      composer.render(delta);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      composer.setSize(mount.clientWidth, mount.clientHeight);
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      lensingPass.uniforms.uAspect.value = camera.aspect;
      (dustPuffs.points.material as THREE.ShaderMaterial).uniforms.uScale.value = puffScreenScale();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("scroll", updateScrollTarget);
      window.removeEventListener("resize", onResize);
      timer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments || object instanceof THREE.Line) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material?.dispose());
        }
        if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
      if (scene.background instanceof THREE.Texture) scene.background.dispose();
      diskTexture.dispose();
      puffTexture.dispose();
      envTarget.dispose();
      bloomPass.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <main className="scroll-journey">
      <section className="space-shell">
      <div className="nebula nebula-one" aria-hidden="true" />
      <div className="nebula nebula-two" aria-hidden="true" />
      <div className="space-canvas" ref={mountRef} />
      <div className="vignette" aria-hidden="true" />
      <div className="warp-chroma" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="warp-flash" aria-hidden="true" />

      <header className="hud-top">
        <div className="signal">
          <span className="signal-pulse" />
          SIGNAL STABLE
        </div>
      </header>

      <section className="mission-copy" id="top" aria-labelledby="mission-title">
        <p className="eyebrow">PORTFOLIO // VOYAGER 01</p>
        <h1 id="mission-title">
          À LA LISIÈRE
          <br />
          <span>DU POSSIBLE</span>
        </h1>
        <p className="intro">Une exploration interactive à travers mes projets, mes idées et les mondes que j’aime construire.</p>
      </section>

      <div className="singularity-label" aria-hidden="true">
        <span className="reticle" />
        <span>
          <small>OBJET 01 — HORIZON</small>
          <strong>SINGULARITÉ DÉTECTÉE</strong>
        </span>
      </div>

      <div className="controls-hint">
        <span className="mouse-icon" aria-hidden="true"><i /></span>
        <span>GUIDEZ LE VAISSEAU</span>
        <small>SOURIS · TOUCHER · FLÈCHES</small>
      </div>

      <div className={`loading-state ${loading ? "is-visible" : ""}`} aria-live="polite">
        <span className="loader-ring" />
        <span>INITIALISATION DU VAISSEAU</span>
      </div>

      <footer className="hud-bottom">
        <span>{modelReady ? "VOYAGER // EN LIGNE" : "SYSTÈMES // NOMINAUX"}</span>
        <div className="telemetry"><i /><i /><i /><i /><i /></div>
        <span>VITESSE 0.042 C</span>
      </footer>
      </section>
    </main>
  );
}
