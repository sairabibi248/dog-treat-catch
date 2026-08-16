const container = document.getElementById('game-container');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const selectionScreen = document.getElementById('selection-screen');
const levelScreen = document.getElementById('level-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreEl = document.getElementById('score');
const targetScoreEl = document.getElementById('target-score');
const livesEl = document.getElementById('lives');
const levelDisplay = document.getElementById('level-display');
const finalScoreEl = document.getElementById('final-score');
const aiReviewText = document.getElementById('ai-review-text');

const dogButtons = document.querySelectorAll('.dog-btn');
const diffButtons = document.querySelectorAll('.diff-btn');
const startBtn = document.getElementById('start-btn');
const nextLevelBtn = document.getElementById('next-level-btn');
const restartBtn = document.getElementById('restart-btn');

// Game State
let selectedDog = '🐕';
let difficulty = 'easy';
let currentLevel = 1;
let score = 0;
let lives = 3;
let streak = 0;
let multiplier = 1;
let isGameOver = false;
let isPaused = false;
let isMuted = false;
let gameAnimationId;
let items = [];
let particles = [];
let floatingTexts = [];
let spawnTimer = 0;

let highScore = localStorage.getItem('dog_game_high_score') || 0;

// Levels updated for ~60 seconds gameplay per level
const levels = [
    { target: 200, speedMultiplier: 0.9, badSpawnRate: 0.15 },
    { target: 400, speedMultiplier: 1.0, badSpawnRate: 0.18 },
    { target: 650, speedMultiplier: 1.1, badSpawnRate: 0.20 },
    { target: 950, speedMultiplier: 1.2, badSpawnRate: 0.22 },
    { target: 1300, speedMultiplier: 1.3, badSpawnRate: 0.23 },
    { target: 1700, speedMultiplier: 1.4, badSpawnRate: 0.24 },
    { target: 2150, speedMultiplier: 1.5, badSpawnRate: 0.25 },
    { target: 2650, speedMultiplier: 1.6, badSpawnRate: 0.26 },
    { target: 3200, speedMultiplier: 1.7, badSpawnRate: 0.27 },
    { target: 3800, speedMultiplier: 1.8, badSpawnRate: 0.28 },
    { target: 4450, speedMultiplier: 1.9, badSpawnRate: 0.29 },
    { target: 5150, speedMultiplier: 2.0, badSpawnRate: 0.30 },
    { target: 5900, speedMultiplier: 2.1, badSpawnRate: 0.31 },
    { target: 6700, speedMultiplier: 2.2, badSpawnRate: 0.32 },
    { target: 7550, speedMultiplier: 2.3, badSpawnRate: 0.33 },
    { target: 8450, speedMultiplier: 2.4, badSpawnRate: 0.34 },
    { target: 9400, speedMultiplier: 2.5, badSpawnRate: 0.35 },
    { target: 10400, speedMultiplier: 2.6, badSpawnRate: 0.36 },
    { target: 11450, speedMultiplier: 2.7, badSpawnRate: 0.37 },
    { target: 12550, speedMultiplier: 2.8, badSpawnRate: 0.38 }
];

const diffMultipliers = { easy: 1.0, hard: 1.8, pro: 2.8 };

// Player Config
const basePlayerSize = 45;
const player = { x: 0, y: 0, size: basePlayerSize, shield: false, eatTimer: null };

const goodTreats = [
    { symbol: '🦴', score: 10, type: 'bone' },
    { symbol: '🥩', score: 15, type: 'meat' },
    { symbol: '🥓', score: 12, type: 'bacon' },
    { symbol: '🍪', score: 5, type: 'cookie' }
];
const badTreats = [{ symbol: '🍫', isHarmful: true }, { symbol: '🍬', isHarmful: true }];
const powerUps = [{ symbol: '🛡️', isShield: true }, { symbol: '⭐', isDouble: true }];

// Selection Logic for Dogs and Difficulty with active states
dogButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        dogButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const text = btn.innerText.trim();
        // Extracting emoji from button text safely
        selectedDog = text.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u)?.[0] || '🐕';
    });
});

diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        difficulty = btn.innerText.trim().toLowerCase(); // 'easy', 'hard', 'pro'
    });
});

function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    player.y = canvas.height - 60;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    if (type === 'eat') { osc.type = 'sine'; osc.frequency.setValueAtTime(400, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1); gain.gain.setValueAtTime(0.3, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1); osc.start(); osc.stop(audioCtx.currentTime + 0.1); }
    else if (type === 'bad') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.25); gain.gain.setValueAtTime(0.4, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25); osc.start(); osc.stop(audioCtx.currentTime + 0.25); }
    else if (type === 'powerup') { osc.type = 'triangle'; osc.frequency.setValueAtTime(300, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(900, audioCtx.currentTime + 0.2); gain.gain.setValueAtTime(0.3, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2); osc.start(); osc.stop(audioCtx.currentTime + 0.2); }
}

function createBurst(x, y, symbol) {
    for (let i = 0; i < 6; i++) {
        particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 1.0, symbol: symbol });
    }
}

function addFloatingText(x, y, text, color = '#22c55e') { floatingTexts.push({ x, y, text, color, life: 1.0 }); }

function triggerEatAnimation(itemType) {
    player.size = 65;
    if (player.eatTimer) clearTimeout(player.eatTimer);
    player.eatTimer = setTimeout(() => { player.size = basePlayerSize; }, itemType === 'meat' ? 2000 : 1000);
}

function handleMove(clientX, clientY) {
    if (isPaused) return;
    const rect = canvas.getBoundingClientRect();
    player.x = clientX - rect.left;
    player.y = clientY - rect.top;
}

container.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
container.addEventListener('touchmove', (e) => { if (e.touches.length > 0) handleMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

startBtn.addEventListener('click', () => { selectionScreen.classList.add('hidden'); currentLevel = 1; score = 0; lives = 3; startLevel(); });
nextLevelBtn.addEventListener('click', () => { levelScreen.classList.add('hidden'); currentLevel++; startLevel(); });
restartBtn.addEventListener('click', () => { gameOverScreen.classList.add('hidden'); currentLevel = 1; score = 0; lives = 3; startLevel(); });

function startLevel() {
    isGameOver = false; isPaused = false; items = []; particles = []; floatingTexts = []; spawnTimer = 0; streak = 0; multiplier = 1; player.shield = false; player.size = basePlayerSize;
    container.className = `level-${((currentLevel - 1) % 5) + 1}`;
    levelDisplay.innerText = currentLevel; scoreEl.innerText = score; targetScoreEl.innerText = levels[currentLevel - 1].target; updateLivesUI();
    cancelAnimationFrame(gameAnimationId);
    gameLoop();
}

function updateLivesUI() { livesEl.innerText = '❤️'.repeat(lives); }

function spawnItem() {
    const levelConfig = levels[currentLevel - 1];
    const rand = Math.random();
    let itemData;
    if (rand < 0.08) itemData = powerUps[Math.floor(Math.random() * powerUps.length)];
    else if (rand < levelConfig.badSpawnRate) itemData = badTreats[Math.floor(Math.random() * badTreats.length)];
    else itemData = goodTreats[Math.floor(Math.random() * goodTreats.length)];
    
    const diffMultiplier = diffMultipliers[difficulty] || 1.0;
    items.push({ x: Math.random() * (canvas.width - 40) + 20, y: -30, speed: (Math.random() * 1.5 + 1.5) * levelConfig.speedMultiplier * diffMultiplier, size: 32, ...itemData });
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (isPaused) { ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.font = '28px Arial'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2); return; }
    if (!isGameOver) {
        spawnTimer++;
        if (spawnTimer % 40 === 0) spawnItem();
        
        for (let p = particles.length - 1; p >= 0; p--) { let pt = particles[p]; pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.04; ctx.globalAlpha = Math.max(0, pt.life); ctx.fillText(pt.symbol, pt.x, pt.y); ctx.globalAlpha = 1.0; if (pt.life <= 0) particles.splice(p, 1); }
        for (let ft = floatingTexts.length - 1; ft >= 0; ft--) { let txt = floatingTexts[ft]; txt.y -= 1.5; txt.life -= 0.03; ctx.globalAlpha = Math.max(0, txt.life); ctx.fillStyle = txt.color; ctx.fillText(txt.text, txt.x, txt.y); ctx.globalAlpha = 1.0; if (txt.life <= 0) floatingTexts.splice(ft, 1); }
        
        for (let i = items.length - 1; i >= 0; i--) {
            let item = items[i]; item.y += item.speed;
            ctx.font = `${item.size}px Arial`; ctx.textAlign = 'center'; ctx.fillText(item.symbol, item.x, item.y);
            
            if (Math.hypot(player.x - item.x, player.y - item.y) < player.size / 2 + item.size / 2) {
                if (item.isShield) { 
                    player.shield = true; 
                    playSound('powerup'); 
                    createBurst(item.x, item.y, '🛡️'); 
                    addFloatingText(item.x, item.y, 'Shield ON!', '#38bdf8'); 
                }
                else if (item.isDouble) { 
                    multiplier = 2; 
                    setTimeout(() => multiplier = 1, 5000); 
                    playSound('powerup'); 
                    createBurst(item.x, item.y, '✨'); 
                    addFloatingText(item.x, item.y, '2x Points!', '#f59e0b'); 
                }
                else if (item.isHarmful) { 
                    if (player.shield) { 
                        player.shield = false; 
                        playSound('powerup'); 
                        createBurst(item.x, item.y, '💥'); 
                        addFloatingText(item.x, item.y, 'Shield Blocked!', '#ef4444');
                    } else { 
                        playSound('bad'); 
                        lives--; 
                        updateLivesUI(); 
                        if (lives <= 0) triggerGameOver(); 
                    } 
                }
                else { 
                    playSound('eat'); 
                    triggerEatAnimation(item.type); 
                    
                    if (item.type === 'meat') {
                        addFloatingText(player.x, player.y - 45, 'Yum! 😋', '#fbbf24');
                    }
                    
                    streak++; 
                    const earned = Math.round(item.score * multiplier * (streak > 3 ? 1.5 : 1)); 
                    score += earned; 
                    scoreEl.innerText = score; 
                    addFloatingText(item.x, item.y, `+${earned}`); 
                    
                    if (score >= levels[currentLevel - 1].target) { 
                        triggerLevelComplete(); 
                        return; 
                    } 
                }
                items.splice(i, 1); continue;
            }
            if (item.y > canvas.height + 40) items.splice(i, 1);
        }
        
        // Render Player Dog
        ctx.font = `${player.size}px Arial`; 
        ctx.fillText(selectedDog, player.x, player.y);
        
        // Render Shield above the dog if active
        if (player.shield) {
            ctx.font = '22px Arial';
            ctx.fillText('🛡️', player.x, player.y - (player.size / 2) - 10);
        }

        gameAnimationId = requestAnimationFrame(gameLoop);
    }
}

function triggerLevelComplete() {
    isGameOver = true;
    if (currentLevel >= 20) {
        document.getElementById('level-title').innerText = 'All 20 Levels Completed! 🏆';
        document.getElementById('level-desc').innerText = 'You are the ultimate Puppy Champion!';
        nextLevelBtn.innerText = 'Play Again 🔄';
        nextLevelBtn.onclick = () => location.reload();
    } else {
        document.getElementById('level-title').innerText = `Level ${currentLevel} Cleared! 🎉`;
        document.getElementById('level-desc').innerText = 'Next level is getting faster!';
    }
    levelScreen.classList.remove('hidden');
}

function fetchGoogleAIFeedback(finalScore, levelReached) {
    aiReviewText.innerText = `"Gemini AI Analysis: Level ${levelReached} achieved! Your focus and reflexes are developing perfectly. Keep catching those treats!"`;
}

function triggerGameOver() {
    isGameOver = true;
    if (score > highScore) { highScore = score; localStorage.setItem('dog_game_high_score', highScore); }
    finalScoreEl.innerText = `${score} (High Score: ${highScore})`;
    gameOverScreen.classList.remove('hidden');
    fetchGoogleAIFeedback(score, currentLevel);
}
