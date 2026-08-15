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
let lives = 3; // 3 Lives
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

// Level Configs
const levels = [
    { target: 80, speedMultiplier: 1.0, badSpawnRate: 0.2 },
    { target: 180, speedMultiplier: 1.3, badSpawnRate: 0.25 },
    { target: 300, speedMultiplier: 1.6, badSpawnRate: 0.3 },
    { target: 450, speedMultiplier: 2.0, badSpawnRate: 0.35 },
    { target: 650, speedMultiplier: 2.5, badSpawnRate: 0.4 }
];

const diffMultipliers = { easy: 1.0, hard: 1.4, pro: 1.8 };

// Player Config
const basePlayerSize = 45;
const player = { 
    x: 0, 
    y: 0, 
    size: basePlayerSize, 
    shield: false,
    eatTimer: null 
};

const goodTreats = [
    { symbol: '🦴', score: 10, type: 'bone' },
    { symbol: '🥩', score: 15, type: 'meat' },
    { symbol: '🥓', score: 12, type: 'bacon' },
    { symbol: '🍪', score: 5, type: 'cookie' }
];

const badTreats = [
    { symbol: '🍫', isHarmful: true },
    { symbol: '🍬', isHarmful: true }
];

const powerUps = [
    { symbol: '🛡️', isShield: true },
    { symbol: '⭐', isDouble: true }
];

function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    player.y = canvas.height - 60;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'eat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'bad') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
    } else if (type === 'powerup') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(900, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    }
}

// Particle Bursts & Text
function createBurst(x, y, symbol) {
    for (let i = 0; i < 6; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 1.0,
            symbol: symbol
        });
    }
}

function addFloatingText(x, y, text, color = '#22c55e') {
    floatingTexts.push({ x, y, text, color, life: 1.0 });
}

// Bulge Duration Logic
function triggerEatAnimation(itemType) {
    player.size = 65; // Dynamic Enlarged Size
    
    // Duration: Meat = 2 sec (2000ms), Bone/Others = 1 sec (1000ms)
    const duration = itemType === 'meat' ? 2000 : 1000;

    if (player.eatTimer) clearTimeout(player.eatTimer);
    player.eatTimer = setTimeout(() => {
        player.size = basePlayerSize;
    }, duration);
}

// Player Movement
function handleMove(clientX, clientY) {
    if (isPaused) return;
    const rect = canvas.getBoundingClientRect();
    player.x = clientX - rect.left;
    player.y = clientY - rect.top;
}

container.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
container.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: true });

dogButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        dogButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDog = btn.dataset.dog;
    });
});

diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        difficulty = btn.dataset.diff;
    });
});

startBtn.addEventListener('click', () => {
    selectionScreen.classList.add('hidden');
    currentLevel = 1;
    score = 0;
    lives = 3;
    startLevel();
});

nextLevelBtn.addEventListener('click', () => {
    levelScreen.classList.add('hidden');
    currentLevel++;
    startLevel();
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    currentLevel = 1;
    score = 0;
    lives = 3;
    startLevel();
});

document.getElementById('mute-btn')?.addEventListener('click', () => {
    isMuted = !isMuted;
    document.getElementById('mute-btn').innerText = isMuted ? '🔇' : '🔊';
});

document.getElementById('pause-btn')?.addEventListener('click', () => {
    if (!isGameOver) {
        isPaused = !isPaused;
        document.getElementById('pause-btn').innerText = isPaused ? '▶️' : '⏸️';
        if (!isPaused) gameLoop();
    }
});

function startLevel() {
    isGameOver = false;
    isPaused = false;

    items = [];
    particles = [];
    floatingTexts = [];
    spawnTimer = 0;
    streak = 0;
    multiplier = 1;
    player.shield = false;
    player.size = basePlayerSize;
    
    container.className = `level-${currentLevel}`;
    levelDisplay.innerText = currentLevel;
    scoreEl.innerText = score;
    targetScoreEl.innerText = levels[currentLevel - 1].target;
    updateLivesUI();

    cancelAnimationFrame(gameAnimationId);
    gameLoop();
}

function updateLivesUI() {
    livesEl.innerText = '❤️'.repeat(lives);
}

function spawnItem() {
    const levelConfig = levels[currentLevel - 1];
    const rand = Math.random();
    let itemData;

    if (rand < 0.08) {
        itemData = powerUps[Math.floor(Math.random() * powerUps.length)];
    } else if (rand < levelConfig.badSpawnRate) {
        itemData = badTreats[Math.floor(Math.random() * badTreats.length)];
    } else {
        itemData = goodTreats[Math.floor(Math.random() * goodTreats.length)];
    }

    const speedBase = (Math.random() * 2 + 2) * levelConfig.speedMultiplier * diffMultipliers[difficulty];

    items.push({
        x: Math.random() * (canvas.width - 40) + 20,
        y: -30,
        speed: speedBase,
        size: 32,
        ...itemData
    });
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isPaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '28px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        return;
    }

    if (!isGameOver) {
        spawnTimer++;
        if (spawnTimer % 35 === 0) spawnItem();

        // Particles
        for (let p = particles.length - 1; p >= 0; p--) {
            let particle = particles[p];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= 0.04;

            ctx.globalAlpha = Math.max(0, particle.life);
            ctx.font = '16px Arial';
            ctx.fillText(particle.symbol, particle.x, particle.y);
            ctx.globalAlpha = 1.0;

            if (particle.life <= 0) particles.splice(p, 1);
        }

        // Floating Texts
        for (let ft = floatingTexts.length - 1; ft >= 0; ft--) {
            let txt = floatingTexts[ft];
            txt.y -= 1.5;
            txt.life -= 0.03;
            ctx.globalAlpha = Math.max(0, txt.life);
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = txt.color;
            ctx.fillText(txt.text, txt.x, txt.y);
            ctx.globalAlpha = 1.0;
            if (txt.life <= 0) floatingTexts.splice(ft, 1);
        }

        // Render & Collision Detection
        for (let i = items.length - 1; i >= 0; i--) {
            let item = items[i];
            item.y += item.speed;

            ctx.font = `${item.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(item.symbol, item.x, item.y);

            const dist = Math.hypot(player.x - item.x, player.y - item.y);
            if (dist < player.size / 2 + item.size / 2) {
                
                if (item.isShield) {
                    player.shield = true;
                    playSound('powerup');
                    createBurst(item.x, item.y, '🛡️');
                    addFloatingText(item.x, item.y, 'Shield ON!', '#3b82f6');
                } else if (item.isDouble) {
                    multiplier = 2;
                    setTimeout(() => multiplier = 1, 5000);
                    playSound('powerup');
                    createBurst(item.x, item.y, '✨');
                    addFloatingText(item.x, item.y, '2x Points!', '#eab308');
                } else if (item.isHarmful) {
                    if (player.shield) {
                        player.shield = false;
                        playSound('powerup');
                        createBurst(item.x, item.y, '💥');
                        addFloatingText(item.x, item.y, 'Blocked!', '#3b82f6');
                    } else {
                        playSound('bad');
                        streak = 0;
                        lives--;
                        updateLivesUI();
                        createBurst(item.x, item.y, '❌');
                        addFloatingText(item.x, item.y, '-1 Life', '#ef4444');
                        if (lives <= 0) triggerGameOver();
                    }
                } else {
                    playSound('eat');
                    triggerEatAnimation(item.type);
                    streak++;
                    const earned = Math.round(item.score * multiplier * (streak > 3 ? 1.5 : 1));
                    score += earned;
                    scoreEl.innerText = score;
                    createBurst(item.x, item.y, '✨');
                    addFloatingText(item.x, item.y, `+${earned}`);

                    if (score >= levels[currentLevel - 1].target) {
                        triggerLevelComplete();
                        return;
                    }
                }
                items.splice(i, 1);
                continue;
            }

            if (item.y > canvas.height + 40) items.splice(i, 1);
        }

        // Render Dog Character
        ctx.font = `${player.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(selectedDog, player.x, player.y);

        // Power-Up Overlays
        if (player.shield) {
            ctx.font = '20px Arial';
            ctx.fillText('🛡️', player.x + (player.size / 2), player.y - 20);
        }
        if (multiplier > 1) {
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f59e0b';
            ctx.fillText('2x!', player.x - (player.size / 2), player.y - 20);
        }

        gameAnimationId = requestAnimationFrame(gameLoop);
    }
}

function triggerLevelComplete() {
    isGameOver = true;
    if (currentLevel >= 5) {
        document.getElementById('level-title').innerText = 'Game Completed! 🏆';
        document.getElementById('level-desc').innerText = 'You cleared all 5 Levels!';
        nextLevelBtn.innerText = 'Play Again 🔄';
        nextLevelBtn.onclick = () => location.reload();
    } else {
        document.getElementById('level-title').innerText = `Level ${currentLevel} Cleared! 🎉`;
        document.getElementById('level-desc').innerText = 'Next level is faster!';
    }
    levelScreen.classList.remove('hidden');
}

function triggerGameOver() {
    isGameOver = true;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('dog_game_high_score', highScore);
    }
    finalScoreEl.innerText = `${score} (High Score: ${highScore})`;
    gameOverScreen.classList.remove('hidden');
}