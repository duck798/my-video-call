// script.js

// -- DOM Elements --
const myIdDisplay = document.getElementById('my-id');
const copyBtn = document.getElementById('copy-btn');
const friendIdInput = document.getElementById('friend-id');
const callBtn = document.getElementById('call-btn');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const remotePlaceholder = document.getElementById('remote-placeholder');

const toggleMicBtn = document.getElementById('toggle-mic');
const toggleCamBtn = document.getElementById('toggle-cam');
const endCallBtn = document.getElementById('end-call');

const canvas = document.getElementById('face-canvas');
const ctx = canvas.getContext('2d');
const effectButtons = document.querySelectorAll('.effect-btn');
const modelStatus = document.getElementById('model-status');

// -- Variables --
let peer = null;
let localStream = null;
let currentCall = null;
let activeEffect = 'none';

// Cấu hình noise suppression (Khử tiếng ồn quạt/gió)
const constraints = {
    video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true, // Quan trọng: Khử tiếng ồn nền
        autoGainControl: true
    }
};

// -- Image Assets for Face AR --
const glassesImg = new Image();
glassesImg.src = 'https://cdn-icons-png.flaticon.com/512/1000/1000966.png'; // Ảnh kính râm mẫu

// -- Initialize Application --
async function init() {
    try {
        // 1. Get Local Media Stream
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = localStream;
        
        // Cập nhật sự kiện resize canvas cho khớp với video
        localVideo.onloadedmetadata = () => {
            canvas.width = localVideo.offsetWidth;
            canvas.height = localVideo.offsetHeight;
        };

        // 2. Initialize PeerJS (WebRTC Signaling)
        // Tạo một ID ngắn ngẫu nhiên cho dễ nhớ
        const randomId = 'user-' + Math.floor(Math.random() * 10000);
        peer = new Peer(randomId, {
            debug: 2
        });

        peer.on('open', (id) => {
            myIdDisplay.textContent = id;
        });

        // Lắng nghe cuộc gọi đến
        peer.on('call', (call) => {
            if (confirm(`Có cuộc gọi từ ${call.peer}. Bạn có muốn nghe không?`)) {
                call.answer(localStream); // Trả lời và gửi stream của mình
                setupCallEvents(call);
            } else {
                call.close();
            }
        });

        // 3. Khởi tạo AI Face Detection
        await loadFaceAPIModels();
        startFaceTracking();

    } catch (err) {
        console.error("Lỗi khởi tạo:", err);
        alert("Vui lòng cấp quyền Camera và Micro để sử dụng tính năng.");
    }
}

// -- Call Functions --
callBtn.addEventListener('click', () => {
    const friendId = friendIdInput.value.trim();
    if (!friendId) {
        alert('Vui lòng nhập ID người nhận!');
        return;
    }
    
    // Gọi và truyền stream của mình
    const call = peer.call(friendId, localStream);
    setupCallEvents(call);
});

function setupCallEvents(call) {
    if (currentCall) {
        currentCall.close();
    }
    currentCall = call;

    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        remotePlaceholder.style.display = 'none';
    });

    call.on('close', () => {
        remoteVideo.srcObject = null;
        remotePlaceholder.style.display = 'flex';
        currentCall = null;
    });
}

endCallBtn.addEventListener('click', () => {
    if (currentCall) {
        currentCall.close();
    }
    remoteVideo.srcObject = null;
    remotePlaceholder.style.display = 'flex';
});

// -- Copy ID --
copyBtn.addEventListener('click', () => {
    const text = myIdDisplay.textContent;
    if (text !== 'Đang khởi tạo...') {
        navigator.clipboard.writeText(text);
        copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--success)"></i>';
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
        }, 2000);
    }
});

// -- Media Controls (Mute/Cam off) --
toggleMicBtn.addEventListener('click', () => {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        toggleMicBtn.classList.toggle('muted');
        toggleMicBtn.innerHTML = audioTrack.enabled 
            ? '<i class="fa-solid fa-microphone"></i>' 
            : '<i class="fa-solid fa-microphone-slash"></i>';
    }
});

toggleCamBtn.addEventListener('click', () => {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toggleCamBtn.classList.toggle('off');
        toggleCamBtn.innerHTML = videoTrack.enabled 
            ? '<i class="fa-solid fa-video"></i>' 
            : '<i class="fa-solid fa-video-slash"></i>';
    }
});

// -- Face API (Hiệu ứng) --
// Sử dụng CDN trực tiếp của tác giả để load Model
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/';

async function loadFaceAPIModels() {
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);
        modelStatus.innerHTML = '<i class="fa-solid fa-check-circle"></i> AI Sẵn sàng';
        modelStatus.classList.add('ready');
    } catch (e) {
        console.error("Lỗi tải Model AI", e);
        modelStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Lỗi tải AI';
    }
}

effectButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        effectButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeEffect = btn.dataset.effect;
        
        // CSS Filters cho video (Nếu chọn mờ mặt qua css)
        if (activeEffect === 'blur') {
            // Chúng ta xử lý bằng canvas vẽ đè, không dùng css filter cho local video để nó tự nhiên hơn.
        }
    });
});

async function startFaceTracking() {
    // Vòng lặp nhận diện khuôn mặt liên tục
    setInterval(async () => {
        if (!localVideo.videoWidth || activeEffect === 'none') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        // Đảm bảo kích thước Canvas luôn khớp Video
        canvas.width = localVideo.offsetWidth;
        canvas.height = localVideo.offsetHeight;

        const displaySize = { width: canvas.width, height: canvas.height };
        
        // Cấu hình detector nhẹ để chạy nhanh
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.3 });
        
        // Nhận diện
        const detection = await faceapi.detectSingleFace(localVideo, options).withFaceLandmarks();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
            // Resize kết quả về kích thước canvas thật
            const resized = faceapi.resizeResults(detection, displaySize);
            
            // localVideo đang bị lật (scaleX(-1)), nên toạ độ x của canvas cũng cần được lật
            const { x, y, width, height } = resized.detection.box;
            const flippedX = canvas.width - x - width; // Lật trục x

            if (activeEffect === 'blur') {
                // Làm mờ khuôn mặt (Vẽ hình chữ nhật mờ)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; // Nền trắng mờ
                ctx.backdropFilter = 'blur(10px)'; // Chỉ chạy trên các trình duyệt hỗ trợ Canvas filter
                // Giả lập blur
                ctx.fillRect(flippedX, y, width, height);
                // Vẽ pattern che mờ
                const imgData = ctx.getImageData(flippedX, y, width, height);
                // (Đơn giản hóa: vẽ ô vuông đen thay vì blur thực vì API Canvas blur hơi khó)
                ctx.fillStyle = 'black';
                ctx.fillRect(flippedX, y, width, height);
                ctx.fillStyle = 'white';
                ctx.font = '20px Arial';
                ctx.fillText("Đã làm mờ", flippedX + 20, y + height/2);

            } else if (activeEffect === 'sunglasses') {
                // Vẽ kính râm dựa vào mốc mắt (landmarks)
                // Lấy 2 mắt
                const leftEye = resized.landmarks.getLeftEye();
                const rightEye = resized.landmarks.getRightEye();
                
                // Tính toán vị trí trung bình
                const eyeDistance = Math.sqrt(Math.pow(rightEye[0].x - leftEye[0].x, 2) + Math.pow(rightEye[0].y - leftEye[0].y, 2));
                
                // Kích thước và toạ độ kính
                const glassWidth = eyeDistance * 2.5;
                const glassHeight = glassWidth * 0.5;
                
                // Tính toạ độ lật
                const centerLeftX = canvas.width - leftEye[0].x;
                const centerRightX = canvas.width - rightEye[3].x;
                
                const drawX = centerRightX - glassWidth * 0.1;
                const drawY = leftEye[0].y - glassHeight * 0.3;

                ctx.drawImage(glassesImg, drawX, drawY, glassWidth, glassHeight);
            }
        }
    }, 100); // Khoảng 10 FPS cho nhẹ
}

// Khởi chạy khi load xong
window.addEventListener('load', init);
