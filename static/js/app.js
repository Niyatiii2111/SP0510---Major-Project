/* ==========================================================================
   SlidePilot - Frontend Logic & Client-Side MediaPipe Hand Tracking
   ========================================================================== */

import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

// ──────────────────────────────────────────────────────────────────────────
// ── App State
// ──────────────────────────────────────────────────────────────────────────
const state = {
    sessionId: localStorage.getItem('slidepilot_session_id') || crypto.randomUUID(),
    slides: [],
    currentPage: 0,
    zoomLevel: 1.0,
    zoomStep: 0.25,
    zoomMin: 0.5,
    zoomMax: 3.0,
    fullView: false,
    presentMode: false,
    chatHistory: [],
    selectedFiles: [],
    
    // Gesture Tracking FSM State
    gestureMode: "NAV", // NAV or ZOOM
    fsmState: "NEUTRAL", // NEUTRAL or WAIT_FOR_RESET
    fistStartTime: null,
    gestureHistory: Array(6).fill(-1), // Keeps track of last 6 finger count frames
};

// Save session ID
localStorage.setItem('slidepilot_session_id', state.sessionId);

// MediaPipe variables
let handLandmarker = null;
let webcamStream = null;
let lastVideoTime = -1;
let animationFrameId = null;

// ──────────────────────────────────────────────────────────────────────────
// ── DOM Elements
// ──────────────────────────────────────────────────────────────────────────
// Layouts
const appContainer = document.getElementById('appContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const workspaceGrid = document.getElementById('workspaceGrid');
const gestureSection = document.getElementById('gestureSection');
const zoomSection = document.getElementById('zoomSection');

// Setup Panel
const fileInput = document.getElementById('fileInput');
const sidebarUploadArea = document.getElementById('sidebarUploadArea');
const fileList = document.getElementById('fileList');
const btnProcess = document.getElementById('btnProcess');
const btnUnload = document.getElementById('btnUnload');
const btnWelcomeUpload = document.getElementById('btnWelcomeUpload');
const btnToggleCamera = document.getElementById('btnToggleCamera');
const btnToggleCameraIcon = document.getElementById('btnToggleCameraIcon');
const btnToggleCameraText = document.getElementById('btnToggleCameraText');
const chatWidthSlider = document.getElementById('chatWidthSlider');

// Manual Controls
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const btnToggleFullView = document.getElementById('btnToggleFullView');
const btnPresent = document.getElementById('btnPresent');
const slideIndicator = document.getElementById('slideIndicator');
const zoomPill = document.getElementById('zoomPill');
const slideImage = document.getElementById('slideImage');
const slideContainer = document.getElementById('slideContainer');

// Manual Zoom Controls
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnResetZoom = document.getElementById('btnResetZoom');
const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');

// Chat Panel
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const btnSendChat = document.getElementById('btnSendChat');
const btnClearChat = document.getElementById('btnClearChat');
const chatCaption = document.getElementById('chatCaption');

// Camera Elements
const webcam = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cameraStatus = document.getElementById('cameraStatus');
const modeBadge = document.getElementById('modeBadge');
const btnToggleMode = document.getElementById('btnToggleMode');
const fingerBadge = document.getElementById('fingerBadge');
const gestureAlert = document.getElementById('gestureAlert');
const holdProgressContainer = document.getElementById('holdProgressContainer');
const holdProgressFill = document.getElementById('holdProgressFill');
const guideNav = document.getElementById('guideNav');
const guideZoom = document.getElementById('guideZoom');

// Fullscreen Presentation Mode Elements
const presentationFullscreen = document.getElementById('presentationFullscreen');
const fullscreenSlideImage = document.getElementById('fullscreenSlideImage');
const fsCounter = document.getElementById('fsCounter');
const fsBtnPrev = document.getElementById('fsBtnPrev');
const fsBtnNext = document.getElementById('fsBtnNext');
const fsBtnExit = document.getElementById('fsBtnExit');

// ──────────────────────────────────────────────────────────────────────────
// ── Initialization
// ──────────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
});

function initEventListeners() {
    // PDF selection & drag-and-drop
    sidebarUploadArea.addEventListener('click', () => fileInput.click());
    btnWelcomeUpload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelection);
    
    sidebarUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        sidebarUploadArea.style.borderColor = 'var(--color-primary)';
    });
    sidebarUploadArea.addEventListener('dragleave', () => {
        sidebarUploadArea.style.borderColor = 'rgba(255,255,255,0.12)';
    });
    sidebarUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        sidebarUploadArea.style.borderColor = 'rgba(255,255,255,0.12)';
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelection();
        }
    });

    // Upload & Unload processing
    btnProcess.addEventListener('click', processPDFs);
    btnUnload.addEventListener('click', unloadPDFs);

    // Presentation actions
    btnPrev.addEventListener('click', showPreviousSlide);
    btnNext.addEventListener('click', showNextSlide);
    btnToggleFullView.addEventListener('click', toggleFullView);
    btnPresent.addEventListener('click', enterPresentationMode);

    // Fullscreen presentation navigation
    fsBtnPrev.addEventListener('click', showPreviousSlide);
    fsBtnNext.addEventListener('click', showNextSlide);
    fsBtnExit.addEventListener('click', exitPresentationMode);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Manual Zoom actions
    btnZoomIn.addEventListener('click', () => adjustZoom(state.zoomStep));
    btnZoomOut.addEventListener('click', () => adjustZoom(-state.zoomStep));
    btnResetZoom.addEventListener('click', () => resetZoom());

    // Gesture manual toggle
    btnToggleMode.addEventListener('click', toggleGestureMode);

    // Chat actions
    btnSendChat.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    btnClearChat.addEventListener('click', clearChatHistory);
    btnToggleCamera.addEventListener('click', toggleCameraState);
    
    chatWidthSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (!state.fullView) {
            workspaceGrid.style.gridTemplateColumns = `${100 - val}fr ${val}fr`;
        }
    });
}

// ──────────────────────────────────────────────────────────────────────────
// ── PDF Handling
// ──────────────────────────────────────────────────────────────────────────
function handleFileSelection() {
    state.selectedFiles = Array.from(fileInput.files);
    fileList.innerHTML = '';
    
    if (state.selectedFiles.length > 0) {
        state.selectedFiles.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'file-item';
            div.innerHTML = `
                <span class="file-item-name">${file.name}</span>
                <span class="file-item-remove" data-index="${index}">&times;</span>
            `;
            fileList.appendChild(div);
        });
        
        btnProcess.disabled = false;
        
        // Add remove handlers
        document.querySelectorAll('.file-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                state.selectedFiles.splice(idx, 1);
                // Sync input element files
                const dt = new DataTransfer();
                state.selectedFiles.forEach(f => dt.items.add(f));
                fileInput.files = dt.files;
                handleFileSelection();
            });
        });
    } else {
        btnProcess.disabled = true;
    }
}

async function processPDFs() {
    if (state.selectedFiles.length === 0) return;

    btnProcess.disabled = true;
    btnProcess.innerText = '⏳ Processing PDFs...';

    const formData = new FormData();
    formData.append('session_id', state.sessionId);
    state.selectedFiles.forEach(file => {
        formData.append('files', file);
    });

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            state.slides = data.slides;
            state.currentPage = 0;
            state.zoomLevel = 1.0;
            state.fullView = false;
            
            // Sync session ID in case the server returned a new one
            state.sessionId = data.session_id;
            localStorage.setItem('slidepilot_session_id', state.sessionId);
            
            // Toggle sections UI
            welcomeScreen.style.display = 'none';
            workspaceGrid.style.display = 'grid';
            btnUnload.style.display = 'block';
            gestureSection.classList.remove('disabled-state');
            zoomSection.classList.remove('disabled-state');
            
            // Draw first slide
            renderActiveSlide();
            
            // Clear inputs
            fileList.innerHTML = '';
            btnProcess.disabled = true;
            btnProcess.innerText = '🚀 Process PDFs';

            // Show notice if the PDF has no text (or if chat building failed)
            if (data.chat_enabled === false) {
                chatCaption.style.display = 'none';
                appendMessage('assistant', '⚠️ Note: This document contains no extractable text (it might be scanned, image-only, or contain unreadable formatting). AI chat is disabled for this session, but you can still present and navigate using gestures!');
            }
        } else {
            alert('❌ Upload error: ' + (data.error || 'Unknown error'));
            btnProcess.disabled = false;
            btnProcess.innerText = '🚀 Process PDFs';
        }
    } catch (err) {
        console.error(err);
        alert('❌ Network error during PDF processing.');
        btnProcess.disabled = false;
        btnProcess.innerText = '🚀 Process PDFs';
    }
}

async function unloadPDFs() {
    try {
        await fetch('/api/unload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: state.sessionId })
        });
    } catch (e) {
        console.warn("Server unload failed:", e);
    }
    
    // Clear State
    state.slides = [];
    state.currentPage = 0;
    state.zoomLevel = 1.0;
    state.fullView = false;
    state.chatHistory = [];
    state.selectedFiles = [];
    fileInput.value = '';
    
    // Disable sections
    welcomeScreen.style.display = 'flex';
    workspaceGrid.style.display = 'none';
    btnUnload.style.display = 'none';
    btnProcess.disabled = true;
    gestureSection.classList.add('disabled-state');
    zoomSection.classList.add('disabled-state');
    
    // Stop camera loops
    stopCamera();
    clearChatHistory();
}

// ──────────────────────────────────────────────────────────────────────────
// ── Slide Navigation & Rendering
// ──────────────────────────────────────────────────────────────────────────
function renderActiveSlide() {
    if (state.slides.length === 0) return;
    
    const src = state.slides[state.currentPage];
    
    // Render standard slide
    slideImage.src = src;
    slideImage.style.transform = `scale(${state.zoomLevel})`;
    slideIndicator.innerText = `📄 Slide ${state.currentPage + 1} / ${state.slides.length}`;
    zoomPill.innerText = `🔍 ${state.zoomLevel.toFixed(2)}×`;
    
    // Render fullscreen presentation slide if active
    if (state.presentMode) {
        fullscreenSlideImage.src = src;
        fsCounter.innerText = `Slide ${state.currentPage + 1} / ${state.slides.length}`;
    }
}

function showNextSlide() {
    if (state.currentPage < state.slides.length - 1) {
        state.currentPage++;
        renderActiveSlide();
    }
}

function showPreviousSlide() {
    if (state.currentPage > 0) {
        state.currentPage--;
        renderActiveSlide();
    }
}

function toggleFullView() {
    state.fullView = !state.fullView;
    if (state.fullView) {
        workspaceGrid.classList.add('full-view-active');
        btnToggleFullView.innerText = '✕';
        btnToggleFullView.title = 'Exit full view';
    } else {
        workspaceGrid.classList.remove('full-view-active');
        btnToggleFullView.innerText = '⛶';
        btnToggleFullView.title = 'Expand to full width';
        
        // Restore slider width!
        const val = chatWidthSlider.value;
        workspaceGrid.style.gridTemplateColumns = `${100 - val}fr ${val}fr`;
    }
}

// Fullscreen Presentation Management
function enterPresentationMode() {
    if (presentationFullscreen.requestFullscreen) {
        presentationFullscreen.requestFullscreen();
    } else if (presentationFullscreen.webkitRequestFullscreen) { /* Safari */
        presentationFullscreen.webkitRequestFullscreen();
    } else if (presentationFullscreen.msRequestFullscreen) { /* IE11 */
        presentationFullscreen.msRequestFullscreen();
    }
}

function exitPresentationMode() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}

function handleFullscreenChange() {
    const isFullscreen = !!document.fullscreenElement || 
                          !!document.webkitFullscreenElement || 
                          !!document.msFullscreenElement;
    
    state.presentMode = isFullscreen;
    if (isFullscreen) {
        presentationFullscreen.style.display = 'flex';
        renderActiveSlide();
    } else {
        presentationFullscreen.style.display = 'none';
    }
}

// Zoom helpers
function adjustZoom(step) {
    state.zoomLevel = Math.max(state.zoomMin, Math.min(state.zoomMax, parseFloat((state.zoomLevel + step).toFixed(2))));
    zoomLevelDisplay.innerText = `${state.zoomLevel.toFixed(2)}×`;
    renderActiveSlide();
}

function resetZoom() {
    state.zoomLevel = 1.0;
    zoomLevelDisplay.innerText = '1.00×';
    renderActiveSlide();
}

// ──────────────────────────────────────────────────────────────────────────
// ── AI Q&A Assistant Chat
// ──────────────────────────────────────────────────────────────────────────
async function sendChatMessage() {
    const val = chatInput.value.trim();
    if (!val) return;
    
    // Clear input
    chatInput.value = '';
    
    // Hide default caption
    chatCaption.style.display = 'none';

    // 1. Add user message
    appendMessage('user', val);
    
    // 2. Add typing message placeholder
    const typingBubble = appendMessage('assistant', '<span class="typing-dots">Searching document context...</span>');

    try {
        const payload = {
            session_id: state.sessionId,
            question: val,
            history: state.chatHistory.slice(-6), // Send last 6 messages for history mapping
        };

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        // Remove typing placeholder
        typingBubble.remove();
        
        if (data.status === 'success') {
            appendMessage('assistant', data.answer);
        } else {
            appendMessage('assistant', `⚠️ Groq Assistant Error: ${data.error || 'Server error'}`);
        }
    } catch (err) {
        console.error(err);
        typingBubble.remove();
        appendMessage('assistant', '⚠️ Network error. Please check your connection.');
    }
}

function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `chat-message ${role}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = text;
    div.appendChild(bubble);
    
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.innerText = role === 'user' ? 'You' : 'Assistant';
    div.appendChild(meta);
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Append to local state history
    state.chatHistory.push({ role, content: text });
    return div;
}

function clearChatHistory() {
    state.chatHistory = [];
    chatMessages.innerHTML = '';
    chatCaption.style.display = 'block';
    chatMessages.appendChild(chatCaption);
}

// ──────────────────────────────────────────────────────────────────────────
// ── Camera & MediaPipe Hand Gesture AI
// ──────────────────────────────────────────────────────────────────────────
async function initCameraAndMediapipe() {
    if (handLandmarker && webcamStream) {
        // Camera already running
        return;
    }

    if (handLandmarker) {
        // Model is loaded, but camera stream was stopped. Just re-acquire webcam.
        cameraStatus.style.display = 'block';
        cameraStatus.innerText = 'Requesting camera...';
        try {
            webcamStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, frameRate: { ideal: 10, max: 15 } },
                audio: false
            });
            webcam.srcObject = webcamStream;
            webcam.onloadedmetadata = () => {
                webcam.play();
                cameraStatus.style.display = 'none';
                fingerBadge.style.display = 'flex';
                canvas.width = webcam.videoWidth || 320;
                canvas.height = webcam.videoHeight || 240;
                btnToggleCameraText.innerText = "Stop Camera";
                btnToggleCameraIcon.innerText = "🛑";
                startPredictionLoop();
            };
        } catch (err) {
            console.error("Camera re-start failure:", err);
            cameraStatus.innerText = '❌ Camera Access Failed';
            btnToggleCameraText.innerText = "Start Camera";
            btnToggleCameraIcon.innerText = "🎥";
        }
        return;
    }

    cameraStatus.innerText = 'Loading AI model...';

    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        
        cameraStatus.innerText = 'Requesting camera...';
        
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, frameRate: { ideal: 10, max: 15 } },
            audio: false
        });
        
        webcam.srcObject = webcamStream;
        webcam.onloadedmetadata = () => {
            webcam.play();
            cameraStatus.style.display = 'none';
            fingerBadge.style.display = 'flex';
            canvas.width = webcam.videoWidth || 320;
            canvas.height = webcam.videoHeight || 240;
            btnToggleCameraText.innerText = "Stop Camera";
            btnToggleCameraIcon.innerText = "🛑";
            startPredictionLoop();
        };

    } catch (err) {
        console.error("Camera/MediaPipe load failure:", err);
        cameraStatus.innerText = '❌ Camera Access Failed';
        btnToggleCameraText.innerText = "Start Camera";
        btnToggleCameraIcon.innerText = "🎥";
    }
}

function stopCamera() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    webcam.srcObject = null;
    cameraStatus.style.display = 'block';
    cameraStatus.innerText = 'Camera offline';
    fingerBadge.style.display = 'none';
    holdProgressContainer.style.display = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    btnToggleCameraText.innerText = "Start Camera";
    btnToggleCameraIcon.innerText = "🎥";
}

function toggleCameraState() {
    if (webcamStream) {
        stopCamera();
    } else {
        initCameraAndMediapipe();
    }
}

function startPredictionLoop() {
    lastVideoTime = -1;
    function predict() {
        if (webcam.readyState >= 2) { // HAVE_CURRENT_DATA
            const now = webcam.currentTime;
            if (now !== lastVideoTime) {
                lastVideoTime = now;
                const results = handLandmarker.detectForVideo(webcam, Date.now());
                processFrameResults(results);
            }
        }
        animationFrameId = requestAnimationFrame(predict);
    }
    animationFrameId = requestAnimationFrame(predict);
}

// Hand connections skeleton indices mapping
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],     // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8],     // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17]           // Palm webbing
];

function processFrameResults(results) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let fingerCount = null;
    let handLandmarks = null;
    let handedness = null;

    if (results.landmarks && results.landmarks.length > 0) {
        handLandmarks = results.landmarks[0];
        handedness = results.handedness[0][0].categoryName; // "Left" or "Right"
        
        // Draw Skeleton with neon cyber glow
        drawNeonSkeleton(handLandmarks);
        
        // Count fingers
        fingerCount = countFingersUp(handLandmarks, handedness);
        fingerBadge.innerText = fingerCount;
        fingerBadge.style.backgroundColor = state.gestureMode === 'ZOOM' ? 'var(--color-zoom)' : 'var(--color-primary)';
        fingerBadge.style.boxShadow = state.gestureMode === 'ZOOM' ? '0 4px 10px rgba(16, 185, 129, 0.6)' : '0 4px 10px rgba(99, 102, 241, 0.6)';
    } else {
        fingerBadge.innerText = '';
    }

    // Process logic with history buffer
    const finalCount = fingerCount !== null ? fingerCount : -1;
    state.gestureHistory.push(finalCount);
    state.gestureHistory.shift();

    const stable = getStableGesture();
    const isDead = (stable === 2 || stable === 3 || stable === -1);

    // Fist hold state logic
    if (stable === 0) {
        if (state.fistStartTime === null) {
            state.fistStartTime = Date.now();
        }
        
        const holdTime = (Date.now() - state.fistStartTime) / 1000;
        const pct = Math.min(holdTime / 2.0, 1.0); // 2 seconds fist hold
        
        holdProgressContainer.style.display = 'block';
        holdProgressFill.style.width = `${pct * 100}%`;
        
        if (pct >= 1.0) {
            toggleGestureMode();
            // Reset fist variables
            state.fistStartTime = null;
            holdProgressContainer.style.display = 'none';
            state.gestureHistory.fill(-1); // Reset history to avoid instant double trigger
        }
    } else {
        state.fistStartTime = null;
        holdProgressContainer.style.display = 'none';

        // Trigger action based on mode
        let action = null;
        
        if (state.fsmState === "WAIT_FOR_RESET") {
            if (isDead) {
                state.fsmState = "NEUTRAL";
            }
        } else if (state.fsmState === "NEUTRAL") {
            if (!isDead) {
                if (state.gestureMode === "NAV") {
                    if (stable <= 1) {
                        action = "PREV";
                    } else if (stable >= 4) {
                        action = "NEXT";
                    }
                } else { // ZOOM MODE
                    if (stable <= 1) {
                        action = "ZOOM_IN";
                    } else if (stable >= 4) {
                        action = "ZOOM_OUT";
                    }
                }
                
                if (action) {
                    state.fsmState = "WAIT_FOR_RESET";
                    triggerGestureAction(action);
                }
            }
        }
    }
}

function countFingersUp(landmarks, handedness) {
    // Index, Middle, Ring, Pinky
    // Up if tip Y < joint Y (closer to 0)
    const indexUp = landmarks[8].y < landmarks[6].y ? 1 : 0;
    const middleUp = landmarks[12].y < landmarks[10].y ? 1 : 0;
    const ringUp = landmarks[16].y < landmarks[14].y ? 1 : 0;
    const pinkyUp = landmarks[20].y < landmarks[18].y ? 1 : 0;

    // Thumb check
    // In anatomical Left hand (looks like right hand in mirror), tip 4 is left of IP 3: landmarks[4].x < landmarks[3].x
    // In Right hand, tip 4 is right of IP 3: landmarks[4].x > landmarks[3].x
    let thumbUp = 0;
    if (handedness === "Left") {
        thumbUp = landmarks[4].x < landmarks[3].x ? 1 : 0;
    } else {
        thumbUp = landmarks[4].x > landmarks[3].x ? 1 : 0;
    }

    return thumbUp + indexUp + middleUp + ringUp + pinkyUp;
}

function getStableGesture() {
    // Mode calculation (most common value)
    const counts = {};
    let maxVal = -1;
    let maxCount = 0;
    
    state.gestureHistory.forEach(val => {
        counts[val] = (counts[val] || 0) + 1;
        if (counts[val] > maxCount) {
            maxCount = counts[val];
            maxVal = val;
        }
    });
    
    return maxVal;
}

function drawNeonSkeleton(landmarks) {
    ctx.save();
    
    // Draw Bones with neon glow
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = state.gestureMode === 'ZOOM' ? 'rgba(16, 185, 129, 0.7)' : 'rgba(99, 102, 241, 0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowColor = state.gestureMode === 'ZOOM' ? '#10b981' : '#6366f1';

    HAND_CONNECTIONS.forEach(([i, j]) => {
        const p1 = landmarks[i];
        const p2 = landmarks[j];
        
        ctx.beginPath();
        ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
        ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
        ctx.stroke();
    });

    // Draw knuckles
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 4;
    landmarks.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    ctx.restore();
}

function triggerGestureAction(action) {
    // Flashes action text briefly on screen
    flashGestureAlert(action);

    // Run actions
    if (action === "PREV") {
        showPreviousSlide();
    } else if (action === "NEXT") {
        showNextSlide();
    } else if (action === "ZOOM_IN") {
        adjustZoom(state.zoomStep);
    } else if (action === "ZOOM_OUT") {
        adjustZoom(-state.zoomStep);
    }
}

function toggleGestureMode() {
    state.gestureMode = state.gestureMode === "NAV" ? "ZOOM" : "NAV";
    
    // Update Badge UI
    if (state.gestureMode === "NAV") {
        modeBadge.innerText = "🧭 NAV MODE";
        modeBadge.className = "mode-badge nav-mode";
        btnToggleMode.innerText = "🔁 Switch to Zoom mode";
        guideNav.style.display = 'block';
        guideZoom.style.display = 'none';
        flashGestureAlert("NAV MODE");
    } else {
        modeBadge.innerText = "🔍 ZOOM MODE";
        modeBadge.className = "mode-badge zoom-mode";
        btnToggleMode.innerText = "🔁 Switch to Nav mode";
        guideNav.style.display = 'none';
        guideZoom.style.display = 'block';
        flashGestureAlert("ZOOM MODE");
    }
}

let alertTimeout = null;
function flashGestureAlert(action) {
    if (alertTimeout) clearTimeout(alertTimeout);
    
    const labels = {
        "PREV": "⬅️ PREVIOUS SLIDE",
        "NEXT": "NEXT SLIDE ➡️",
        "ZOOM_IN": "🔍 ZOOM IN",
        "ZOOM_OUT": "🔎 ZOOM OUT",
        "NAV MODE": "🧭 NAVIGATION MODE",
        "ZOOM MODE": "🔍 ZOOMING MODE"
    };

    gestureAlert.innerText = labels[action] || action;
    gestureAlert.classList.add('show');
    
    alertTimeout = setTimeout(() => {
        gestureAlert.classList.remove('show');
    }, 900);
}
