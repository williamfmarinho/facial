const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusBox = document.getElementById('status');
const fullNameInput = document.getElementById('fullNameInput');
const ageInput = document.getElementById('ageInput');

const startCameraBtn = document.getElementById('startCameraBtn');
const stopCameraBtn = document.getElementById('stopCameraBtn');
const enrollBtn = document.getElementById('enrollBtn');
const punchBtn = document.getElementById('punchBtn');

let stream = null;
let modelsLoaded = false;

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.className = isError ? 'error' : 'ok';
}

async function loadModels() {
  if (modelsLoaded) return;

  const modelUrl =
    (window.APP_CONFIG && window.APP_CONFIG.modelUrl) || '/models';

  await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
  await faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl);
  await faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl);

  modelsLoaded = true;
}

async function startCamera() {
  if (stream) return;

  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user',
    },
    audio: false,
  });

  video.srcObject = stream;
  await video.play();
}

function stopCamera() {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
}

async function captureDescriptor() {
  if (!stream) {
    throw new Error('Camera not started');
  }

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const detection = await faceapi
    .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error('Nenhum rosto detectado. Centralize o rosto e tente novamente.');
  }

  return Array.from(detection.descriptor);
}

async function getGeo() {
  if (!navigator.geolocation) {
    return 'web';
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        resolve(`lat:${latitude.toFixed(6)},lon:${longitude.toFixed(6)}`);
      },
      () => resolve('web'),
      { timeout: 3000 }
    );
  });
}

async function apiPost(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

startCameraBtn.addEventListener('click', async () => {
  try {
    setStatus('Carregando modelos faciais...');
    await loadModels();
    setStatus('Iniciando camera...');
    await startCamera();
    setStatus('Camera pronta.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

stopCameraBtn.addEventListener('click', () => {
  stopCamera();
  setStatus('Camera parada.');
});

enrollBtn.addEventListener('click', async () => {
  try {
    const fullName = fullNameInput.value.trim();
    const age = Number(ageInput.value);

    if (!fullName) {
      throw new Error('Informe o nome para cadastrar');
    }

    if (!Number.isInteger(age) || age < 1 || age > 120) {
      throw new Error('Informe uma idade valida entre 1 e 120');
    }

    await loadModels();
    await startCamera();

    setStatus('Capturando foto para cadastro...');
    const descriptor = await captureDescriptor();

    const result = await apiPost('/api/enroll', { fullName, age, descriptor });

    setStatus(
      `Pessoa cadastrada com sucesso\nNome: ${result.person.full_name}\nIdade: ${result.person.age}`
    );
  } catch (error) {
    setStatus(error.message, true);
  }
});

punchBtn.addEventListener('click', async () => {
  try {
    await loadModels();
    await startCamera();

    setStatus('Analisando foto e tentando bater ponto...');
    const descriptor = await captureDescriptor();
    const location = await getGeo();

    const result = await apiPost('/api/punch', { descriptor, location });

    const msg = [
      'Ponto batido com sucesso',
      `Nome: ${result.person.fullName}`,
      `Idade: ${result.person.age}`,
      `Distancia: ${result.distance}`,
      `Registro banco: ${result.punchSaved ? 'OK' : 'FALHOU'}`,
    ].join('\n');

    setStatus(msg);
  } catch (error) {
    setStatus(error.message, true);
  }
});

window.addEventListener('beforeunload', stopCamera);
