// DOM Elements
const startOverlay = document.getElementById('start-overlay');
const startAppBtn = document.getElementById('start-app-btn');
const myCustomIdInput = document.getElementById('my-custom-id-input');
const startError = document.getElementById('start-error');
const appContainer = document.getElementById('app');

const myIdEl = document.getElementById('my-id');
const copyBtn = document.getElementById('copy-id-btn');
const remoteIdInput = document.getElementById('remote-id-input');
const callBtn = document.getElementById('call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const localCanvas = document.getElementById('local-canvas');
const remoteLabel = document.getElementById('remote-label');

const toggleAudioBtn = document.getElementById('toggle-audio-btn');
const toggleVideoBtn = document.getElementById('toggle-video-btn');
const toggleEffectBtn = document.getElementById('toggle-effect-btn');

// State
let peer;
let localStream;
let processedStream; 
let currentCall;
let isAudioMuted = false;
let isVideoStopped = false;
let isEffectActive = false;

// MediaPipe variables
let faceMesh;
let camera;
const ctx = localCanvas.getContext('2d');

// Unique App Prefix to reduce global ID collision on PeerJS server
const APP_PREFIX = 'vi-call-';

// Setup Event Listeners for Startup
startAppBtn.addEventListener('click', () => {
  const customName = myCustomIdInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!customName) {
    alert('Vui lòng nhập tên hoặc mã cá nhân (chỉ dùng chữ cái và số)');
    return;
  }
  
  const peerId = APP_PREFIX + customName;
  startError.classList.add('hidden');
  startAppBtn.textContent = 'Đang kết nối...';
  startAppBtn.disabled = true;

  initApp(peerId, customName);
});

async function initApp(peerId, displayName) {
  try {
    // 1. Initialize Peer
    peer = new Peer(peerId); 

    peer.on('open', async (id) => {
      // 2. Setup Camera
      await setupMedia();
      setupFaceMesh();
      
      // Hide overlay, show app
      startOverlay.classList.add('hidden');
      appContainer.classList.remove('hidden');
      
      myIdEl.textContent = displayName;
      setupMainEventListeners();
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (err.type === 'unavailable-id') {
        startError.textContent = 'Mã này đã có người sử dụng đang online. Vui lòng chọn mã khác!';
        startError.classList.remove('hidden');
      } else {
        alert('Lỗi kết nối: ' + err.type);
      }
      startAppBtn.textContent = 'Vào ứng dụng';
      startAppBtn.disabled = false;
    });

    peer.on('call', (call) => {
      // Incoming call
      if (confirm('Có người đang gọi cho bạn! Bạn có muốn nghe máy không?')) {
        call.answer(processedStream); // Answer with our stream
        handleCall(call);
      } else {
        call.close();
      }
    });

  } catch (err) {
    console.error(err);
    alert('Có lỗi xảy ra khi khởi tạo.');
  }
}


// 1. Setup Camera & Mic with Noise Cancellation
async function setupMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      },
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true
      }
    });
    
    localVideo.srcObject = localStream;
    processedStream = localStream; 
  } catch (err) {
    console.error('Failed to get local stream', err);
    alert('Vui lòng cấp quyền sử dụng Camera và Micro để gọi video.');
  }
}

function handleCall(call) {
  currentCall = call;
  
  // Clean up remote ID display
  const callerId = call.peer.replace(APP_PREFIX, '');
  remoteLabel.textContent = "Bạn đang nói chuyện với: " + callerId;

  call.on('stream', (remoteStream) => {
    remoteVideo.srcObject = remoteStream;
  });

  call.on('close', () => {
    remoteVideo.srcObject = null;
    endCallBtn.classList.add('hidden');
    callBtn.classList.remove('hidden');
    remoteLabel.textContent = "Người gọi";
  });

  endCallBtn.classList.remove('hidden');
  callBtn.classList.add('hidden');
}

// 3. Setup Face Mesh (MediaPipe)
function setupFaceMesh() {
  if (typeof FaceMesh === 'undefined') {
    console.warn("MediaPipe FaceMesh not loaded yet.");
    return;
  }

  faceMesh = new FaceMesh({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
  }});
  
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  faceMesh.onResults(onResults);

  camera = new Camera(localVideo, {
    onFrame: async () => {
      if (isEffectActive) {
        await faceMesh.send({image: localVideo});
      }
    },
    width: 640,
    height: 480
  });
  camera.start();
}

function onResults(results) {
  if (!isEffectActive) return;

  localCanvas.width = localVideo.videoWidth || 640;
  localCanvas.height = localVideo.videoHeight || 480;

  ctx.save();
  ctx.clearRect(0, 0, localCanvas.width, localCanvas.height);
  
  ctx.drawImage(results.image, 0, 0, localCanvas.width, localCanvas.height);
  
  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      if (typeof drawConnectors !== 'undefined' && typeof FACEMESH_TESSELATION !== 'undefined') {
          drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {color: '#38bdf8', lineWidth: 1});
      }
    }
  }
  ctx.restore();
}

// 4. Main Event Listeners
function setupMainEventListeners() {
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(myIdEl.textContent);
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Đã Copy!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  });

  callBtn.addEventListener('click', () => {
    const friendName = remoteIdInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!friendName) {
      alert('Vui lòng nhập tên hoặc mã của bạn bè');
      return;
    }
    const call = peer.call(APP_PREFIX + friendName, processedStream);
    handleCall(call);
  });

  endCallBtn.addEventListener('click', () => {
    if (currentCall) {
      currentCall.close();
    }
  });

  toggleAudioBtn.addEventListener('click', () => {
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks()[0].enabled = !isAudioMuted;
    toggleAudioBtn.textContent = isAudioMuted ? '🔇 Bật Mic' : '🎤 Tắt Mic';
    toggleAudioBtn.classList.toggle('active');
  });

  toggleVideoBtn.addEventListener('click', () => {
    isVideoStopped = !isVideoStopped;
    localStream.getVideoTracks()[0].enabled = !isVideoStopped;
    toggleVideoBtn.textContent = isVideoStopped ? '📸 Bật Camera' : '📷 Tắt Camera';
    toggleVideoBtn.classList.toggle('active');
  });

  toggleEffectBtn.addEventListener('click', () => {
    isEffectActive = !isEffectActive;
    toggleEffectBtn.classList.toggle('active');
    
    if (isEffectActive) {
      localVideo.classList.add('hidden');
      localCanvas.classList.remove('hidden');
      
      const canvasStream = localCanvas.captureStream(30);
      const audioTracks = localStream.getAudioTracks();
      processedStream = new MediaStream([canvasStream.getVideoTracks()[0], ...audioTracks]);
      
      if (currentCall && currentCall.peerConnection) {
        const sender = currentCall.peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(processedStream.getVideoTracks()[0]);
      }
    } else {
      localVideo.classList.remove('hidden');
      localCanvas.classList.add('hidden');
      
      processedStream = localStream;
      
      if (currentCall && currentCall.peerConnection) {
        const sender = currentCall.peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(processedStream.getVideoTracks()[0]);
      }
    }
  });
}
