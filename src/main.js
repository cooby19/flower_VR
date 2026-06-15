import * as THREE from "three";
import "./styles.css";

const canvas = document.querySelector("#scene");
const gyroButton = document.querySelector("#gyroButton");
const interactionPrompt = document.querySelector("#interactionPrompt");
const promptKey = document.querySelector("#promptKey");
const dialogueOverlay = document.querySelector("#dialogueOverlay");
const dialogueText = document.querySelector("#dialogueText");
const dialogueAdvance = document.querySelector("#dialogueAdvance");
const loadingEl = document.querySelector("#loading");
const hud = document.querySelector(".hud");
const hudText = document.querySelector("#hudText");
const statusText = document.querySelector("#statusText");

const panoramaUrl = new URL("./assets/panorama.png", import.meta.url).href;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1100);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});

const manualLookTarget = new THREE.Vector3();
const deviceEuler = new THREE.Euler();
const deviceQuaternion = new THREE.Quaternion();
const screenQuaternion = new THREE.Quaternion();
const screenAxis = new THREE.Vector3(0, 0, 1);
const cameraCorrection = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const cameraDirection = new THREE.Vector3();

const flowerDialogueLines = [
  "這是金針花，也常被稱為萱草花。花朵盛開時像金黃色的小燈，讓雨後的校園更醒目。",
  "它的葉片細長、花梗挺直，喜歡陽光充足、排水良好的環境。",
  "靠近觀察時，可以留意花瓣向外舒展的形狀，這是金針花很容易辨認的特徵。"
];

const flowerHotspots = [
  {
    id: "foreground-daylily",
    lon: 90,
    lat: -4,
    radius: 16,
    direction: new THREE.Vector3()
  },
  {
    id: "garden-daylily",
    lon: 104,
    lat: -12,
    radius: 17,
    direction: new THREE.Vector3()
  }
];

const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
const mobileWidthQuery = window.matchMedia("(max-width: 640px)");

const pointerState = {
  active: false,
  id: null,
  x: 0,
  y: 0
};

const viewState = {
  lon: -24,
  lat: -4
};

let deviceOrientation = null;
let gyroActive = false;
let gyroPending = false;
let gyroTimeout = 0;
let activeHotspot = null;
let promptVisible = false;

const dialogueState = {
  open: false,
  index: 0
};

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const sphereGeometry = new THREE.SphereGeometry(500, 96, 64);
const sphereMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  side: THREE.BackSide
});
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(sphere);

const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  panoramaUrl,
  (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    sphereMaterial.map = texture;
    sphereMaterial.needsUpdate = true;
    loadingEl.classList.add("is-hidden");
    setStatus("");
  },
  undefined,
  () => {
    loadingEl.classList.add("is-hidden");
    setStatus("全景圖片載入失敗，請確認 panorama.png 位於 src/assets/。");
  }
);

function setStatus(message) {
  statusText.textContent = message;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function directionFromLonLat(lon, lat, target) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon);

  target.set(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  );

  return target.normalize();
}

function setupHotspots() {
  flowerHotspots.forEach((hotspot) => {
    directionFromLonLat(hotspot.lon, hotspot.lat, hotspot.direction);
  });
}

function getNearestHotspot(direction) {
  let nearestHotspot = null;
  let nearestAngle = Infinity;

  flowerHotspots.forEach((hotspot) => {
    const dot = clamp(direction.dot(hotspot.direction), -1, 1);
    const angle = THREE.MathUtils.radToDeg(Math.acos(dot));

    if (angle <= hotspot.radius && angle < nearestAngle) {
      nearestHotspot = hotspot;
      nearestAngle = angle;
    }
  });

  return nearestHotspot;
}

function setInteractionPromptVisible(isVisible) {
  if (promptVisible === isVisible) {
    return;
  }

  promptVisible = isVisible;
  interactionPrompt.hidden = !isVisible;
  interactionPrompt.classList.toggle("is-hidden", !isVisible);
}

function updateInteractionPrompt() {
  if (dialogueState.open) {
    activeHotspot = null;
    setInteractionPromptVisible(false);
    return;
  }

  camera.getWorldDirection(cameraDirection).normalize();
  activeHotspot = getNearestHotspot(cameraDirection);
  setInteractionPromptVisible(Boolean(activeHotspot));
}

function updatePromptInputLabel() {
  const isTouchPrimary = coarsePointerQuery.matches || mobileWidthQuery.matches;

  promptKey.hidden = isTouchPrimary;
  interactionPrompt.classList.toggle("is-touch-primary", isTouchPrimary);
}

function observeMediaQuery(query, callback) {
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", callback);
    return;
  }

  query.addListener(callback);
}

function releasePointerCapture() {
  if (pointerState.id !== null && canvas.hasPointerCapture(pointerState.id)) {
    canvas.releasePointerCapture(pointerState.id);
  }

  pointerState.active = false;
  pointerState.id = null;
  canvas.classList.remove("is-dragging");
}

function updateDialogueLine() {
  dialogueText.textContent = flowerDialogueLines[dialogueState.index];
  dialogueAdvance.textContent = dialogueState.index === flowerDialogueLines.length - 1 ? "結束" : "下一句";
}

function openDialogue() {
  if (!activeHotspot || dialogueState.open) {
    return;
  }

  releasePointerCapture();
  dialogueState.open = true;
  dialogueState.index = 0;
  setInteractionPromptVisible(false);
  hud.classList.add("is-suppressed");
  dialogueOverlay.hidden = false;
  dialogueOverlay.classList.remove("is-hidden");
  updateDialogueLine();
  dialogueOverlay.focus({ preventScroll: true });
}

function closeDialogue() {
  dialogueState.open = false;
  dialogueOverlay.classList.add("is-hidden");
  dialogueOverlay.hidden = true;
  hud.classList.remove("is-suppressed");
  updateInteractionPrompt();
}

function advanceDialogue() {
  if (!dialogueState.open) {
    return;
  }

  if (dialogueState.index < flowerDialogueLines.length - 1) {
    dialogueState.index += 1;
    updateDialogueLine();
    return;
  }

  closeDialogue();
}

function updateManualCamera() {
  viewState.lat = clamp(viewState.lat, -82, 82);

  const phi = THREE.MathUtils.degToRad(90 - viewState.lat);
  const theta = THREE.MathUtils.degToRad(viewState.lon);

  manualLookTarget.set(
    500 * Math.sin(phi) * Math.cos(theta),
    500 * Math.cos(phi),
    500 * Math.sin(phi) * Math.sin(theta)
  );

  camera.lookAt(manualLookTarget);
}

function updateDeviceCamera() {
  if (!deviceOrientation) {
    return;
  }

  const alpha = THREE.MathUtils.degToRad(deviceOrientation.alpha || 0);
  const beta = THREE.MathUtils.degToRad(deviceOrientation.beta || 0);
  const gamma = THREE.MathUtils.degToRad(deviceOrientation.gamma || 0);
  const orientation = THREE.MathUtils.degToRad(getScreenOrientation());

  deviceEuler.set(beta, alpha, -gamma, "YXZ");
  deviceQuaternion.setFromEuler(deviceEuler);
  deviceQuaternion.multiply(cameraCorrection);
  screenQuaternion.setFromAxisAngle(screenAxis, -orientation);
  deviceQuaternion.multiply(screenQuaternion);
  camera.quaternion.copy(deviceQuaternion);
}

function getScreenOrientation() {
  if (screen.orientation && Number.isFinite(screen.orientation.angle)) {
    return screen.orientation.angle;
  }

  return Number(window.orientation) || 0;
}

function isOrientationEventUsable(event) {
  return event.alpha !== null && event.beta !== null && event.gamma !== null;
}

function handleDeviceOrientation(event) {
  if (!isOrientationEventUsable(event)) {
    return;
  }

  deviceOrientation = event;

  if (gyroPending) {
    gyroPending = false;
    gyroActive = true;
    window.clearTimeout(gyroTimeout);
    gyroButton.textContent = "陀螺儀已啟用";
    gyroButton.disabled = true;
    hudText.textContent = "轉動手機觀看四周";
    setStatus("");
  }
}

function stopGyro(message = "") {
  window.clearTimeout(gyroTimeout);
  window.removeEventListener("deviceorientation", handleDeviceOrientation, true);
  gyroPending = false;
  gyroActive = false;
  deviceOrientation = null;
  gyroButton.textContent = "啟用陀螺儀";
  gyroButton.disabled = false;
  hudText.textContent = "拖曳或轉動手機觀看四周";
  setStatus(message);
}

async function enableGyro() {
  if (!("DeviceOrientationEvent" in window)) {
    stopGyro("此裝置不支援陀螺儀，請拖曳畫面觀看四周。");
    return;
  }

  gyroButton.disabled = true;
  gyroButton.textContent = "啟用中";
  setStatus("");

  try {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const permission = await DeviceOrientationEvent.requestPermission();

      if (permission !== "granted") {
        throw new Error("permission-denied");
      }
    }

    gyroPending = true;
    window.addEventListener("deviceorientation", handleDeviceOrientation, true);
    gyroTimeout = window.setTimeout(() => {
      if (!gyroActive) {
        stopGyro("目前讀不到陀螺儀資料，請拖曳畫面觀看四周。");
      }
    }, 1800);
  } catch (error) {
    stopGyro("陀螺儀權限未啟用，請拖曳畫面觀看四周。");
  }
}

function handlePointerDown(event) {
  if (dialogueState.open) {
    return;
  }

  if (gyroActive || gyroPending) {
    stopGyro("已切換為拖曳觀看四周。");
  }

  pointerState.active = true;
  pointerState.id = event.pointerId;
  pointerState.x = event.clientX;
  pointerState.y = event.clientY;
  canvas.classList.add("is-dragging");
  canvas.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!pointerState.active || event.pointerId !== pointerState.id) {
    return;
  }

  const deltaX = event.clientX - pointerState.x;
  const deltaY = event.clientY - pointerState.y;
  pointerState.x = event.clientX;
  pointerState.y = event.clientY;

  viewState.lon -= deltaX * 0.13;
  viewState.lat += deltaY * 0.13;
}

function handlePointerUp(event) {
  if (event.pointerId !== pointerState.id) {
    return;
  }

  pointerState.active = false;
  pointerState.id = null;
  canvas.classList.remove("is-dragging");
}

function handleWheel(event) {
  event.preventDefault();

  if (dialogueState.open) {
    return;
  }

  camera.fov = clamp(camera.fov + event.deltaY * 0.018, 46, 82);
  camera.updateProjectionMatrix();
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();

  if (dialogueState.open) {
    if (key === "escape") {
      event.preventDefault();
      closeDialogue();
      return;
    }

    if (!event.repeat && (key === "f" || key === "enter" || key === " ")) {
      event.preventDefault();
      advanceDialogue();
    }

    return;
  }

  if (!event.repeat && key === "f" && activeHotspot) {
    event.preventDefault();
    openDialogue();
  }
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  if (!dialogueState.open) {
    if (gyroActive) {
      updateDeviceCamera();
    } else {
      updateManualCamera();
    }

    updateInteractionPrompt();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

setupHotspots();
updatePromptInputLabel();

gyroButton.addEventListener("click", enableGyro);
interactionPrompt.addEventListener("click", openDialogue);
dialogueOverlay.addEventListener("click", advanceDialogue);
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);
canvas.addEventListener("wheel", handleWheel, { passive: false });
window.addEventListener("resize", handleResize);
window.addEventListener("orientationchange", handleResize);
window.addEventListener("keydown", handleKeyDown);

observeMediaQuery(coarsePointerQuery, updatePromptInputLabel);
observeMediaQuery(mobileWidthQuery, updatePromptInputLabel);

updateManualCamera();
animate();
