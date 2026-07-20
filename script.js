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
let canvasStream; 
let currentCall;
let isAudioMuted = false;
let isVideoStopped = false;

// Effects State
const effects = [
  "Tắt", 
  "Lưới Neon", 
  "Cyborg", 
  "Hề & Kính", 
  "Ẩn Danh"
];
let currentEffectIndex = 0;

// MediaPipe variables
let faceMesh;
let camera;
const ctx = localCanvas.getContext('2d');

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
    peer = new Peer(peerId); 

    peer.on('open', async (id) => {
      await setupMedia();
      setupFaceMesh();
      
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
      if (confirm('Có người đang gọi cho bạn! Bạn có muốn nghe máy không?')) {
        // Luôn trả lời bằng luồng gốc (đảm bảo Audio luôn hoạt động 100%)
        call.answer(localStream); 
        handleCall(call);
        
        // Nếu đang bật hiệu ứng thì đổi track video ngay sau đó
        if (currentEffectIndex > 0) {
          setTimeout(() => applyVideoTrackToCall(canvasStream.getVideoTracks()[0]), 500);
        }
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
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true }
    });
    
    localVideo.srcObject = localStream;
    canvasStream = localCanvas.captureStream(30);

  } catch (err) {
    console.error('Failed to get local stream', err);
    alert('Vui lòng cấp quyền sử dụng Camera và Micro để gọi video.');
  }
}

function handleCall(call) {
  currentCall = call;
  
  const callerId = call.peer.replace(APP_PREFIX, '');
  remoteLabel.textContent = "Bạn đang nói chuyện với: " + callerId;

  call.on('stream', (remoteStream) => {
    remoteVideo.srcObject = remoteStream;
    // Bắt buộc trình duyệt phát video & audio (tránh lỗi màn hình đen Autoplay)
    remoteVideo.play().catch(e => console.error("Auto-play prevented", e));
  });

  call.on('close', () => {
    remoteVideo.srcObject = null;
    endCallBtn.classList.add('hidden');
    callBtn.classList.remove('hidden');
    remoteLabel.textContent = "Người gọi";
    currentCall = null;
  });

  endCallBtn.classList.remove('hidden');
  callBtn.classList.add('hidden');
}

function applyVideoTrackToCall(track) {
  if (currentCall && currentCall.peerConnection) {
    const sender = currentCall.peerConnection.getSenders().find(s => s.track.kind === 'video');
    if (sender) {
      sender.replaceTrack(track).catch(err => console.error("Lỗi khi đổi track:", err));
    }
  }
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
      // Nếu tắt camera, dừng xử lý AI để nhẹ máy
      if (isVideoStopped) return;

      // Chỉ gọi AI quét mặt nếu đang bật hiệu ứng
      if (currentEffectIndex > 0) {
        await faceMesh.send({image: localVideo});
      }
    },
    width: 640,
    height: 480
  });
  camera.start();
}

function onResults(results) {
  if (isVideoStopped || currentEffectIndex === 0) return;

  localCanvas.width = localVideo.videoWidth || 640;
  localCanvas.height = localVideo.videoHeight || 480;

  ctx.save();
  ctx.clearRect(0, 0, localCanvas.width, localCanvas.height);
  
  // 1. Luôn vẽ video gốc làm nền
  ctx.drawImage(results.image, 0, 0, localCanvas.width, localCanvas.height);
  
  // 2. Vẽ hiệu ứng chồng lên
  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      if (typeof drawConnectors === 'undefined' || typeof FACEMESH_TESSELATION === 'undefined') continue;

      if (currentEffectIndex === 1) { // Lưới Neon
        drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {color: '#38bdf8', lineWidth: 1});
      } 
      else if (currentEffectIndex === 2) { // Cyborg
        drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {color: '#ef4444', lineWidth: 1});
        const leftEye = landmarks[159]; 
        const rightEye = landmarks[386]; 
        drawGlowingEye(ctx, leftEye.x * localCanvas.width, leftEye.y * localCanvas.height);
        drawGlowingEye(ctx, rightEye.x * localCanvas.width, rightEye.y * localCanvas.height);
      }
      else if (currentEffectIndex === 3) { // Hề & Kính
        const nose = landmarks[1];
        const leftEye = landmarks[159]; 
        const rightEye = landmarks[386];
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(leftEye.x * localCanvas.width, leftEye.y * localCanvas.height, 25, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rightEye.x * localCanvas.width, rightEye.y * localCanvas.height, 25, 0, 2 * Math.PI);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(leftEye.x * localCanvas.width + 25, leftEye.y * localCanvas.height);
        ctx.lineTo(rightEye.x * localCanvas.width - 25, rightEye.y * localCanvas.height);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(nose.x * localCanvas.width, nose.y * localCanvas.height, 20, 0, 2 * Math.PI);
        ctx.fill();
      }
      else if (currentEffectIndex === 4) { // Ẩn Danh
        const top = landmarks[10];
        const bottom = landmarks[152];
        const left = landmarks[234];
        const right = landmarks[454];

        const x = left.x * localCanvas.width;
        const y = top.y * localCanvas.height;
        const w = (right.x - left.x) * localCanvas.width;
        const h = (bottom.y - top.y) * localCanvas.height;

        ctx.fillStyle = '#000000';
        ctx.fillRect(x - 20, y - 40, w + 40, h + 60);
      }
    }
  }
  ctx.restore();
}

function drawGlowingEye(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, 2 * Math.PI);
  ctx.fillStyle = '#ef4444';
  ctx.fill();
  ctx.shadowBlur = 20;
  ctx.shadowColor = "red";
  ctx.fill();
  ctx.shadowBlur = 0;
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
    
    // Gọi luôn bằng luồng gốc
    const call = peer.call(APP_PREFIX + friendName, localStream);
    handleCall(call);
    
    // Nếu đang bật hiệu ứng thì đổi track video ngay sau đó
    if (currentEffectIndex > 0) {
      setTimeout(() => applyVideoTrackToCall(canvasStream.getVideoTracks()[0]), 500);
    }
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
    // Tắt bật luồng camera và canvas
    localStream.getVideoTracks()[0].enabled = !isVideoStopped;
    canvasStream.getVideoTracks()[0].enabled = !isVideoStopped;
    
    toggleVideoBtn.textContent = isVideoStopped ? '📸 Bật Camera' : '📷 Tắt Camera';
    toggleVideoBtn.classList.toggle('active');
    
    // Nếu đang bật hiệu ứng, xoá canvas thành đen khi tắt camera
    if (isVideoStopped) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, localCanvas.width, localCanvas.height);
    }
  });

  toggleEffectBtn.addEventListener('click', () => {
    currentEffectIndex = (currentEffectIndex + 1) % effects.length;
    toggleEffectBtn.textContent = `✨ Hiệu ứng: ${effects[currentEffectIndex]}`;
    
    if (currentEffectIndex > 0) {
      toggleEffectBtn.classList.add('active');
      localVideo.classList.add('hidden');
      localCanvas.classList.remove('hidden');
      
      // Áp dụng track của canvas vào cuộc gọi
      applyVideoTrackToCall(canvasStream.getVideoTracks()[0]);
    } else {
      toggleEffectBtn.classList.remove('active');
      localVideo.classList.remove('hidden');
      localCanvas.classList.add('hidden');
      
      // Áp dụng lại track video gốc vào cuộc gọi
      applyVideoTrackToCall(localStream.getVideoTracks()[0]);
    }
  });
}
