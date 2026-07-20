const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
    gameOver: document.getElementById('game-over-screen'),
    finalScore: document.getElementById('final-score')
};

let state = 'INIT'; 
let score = 0;
let lives = 3;
let lastTime = 0;
let speed = 0; 
let globalScrollY = 0;
let slideTimer = 0; 
let frameCount = 0;

const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, Space: false };
let touchActive = false;
let touchTargetX = 300;
let touchTargetY = 500;

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
    if (e.code === 'Space' && (state === 'GAMEOVER' || state === 'INIT')) startGame();
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
});

function handlePointer(e) {
    if (state !== 'PLAYING') return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    touchTargetX = (clientX - rect.left) * scaleX;
    touchTargetY = (clientY - rect.top) * scaleY;
    touchActive = true;
}

canvas.addEventListener('touchstart', (e) => { if (state === 'GAMEOVER') startGame(); else handlePointer(e); }, {passive: false});
canvas.addEventListener('touchmove', handlePointer, {passive: false});
canvas.addEventListener('touchend', () => { touchActive = false; speed *= 0.9; });
canvas.addEventListener('mousedown', (e) => { if (state === 'GAMEOVER') startGame(); else handlePointer(e); });
canvas.addEventListener('mousemove', (e) => { if (e.buttons > 0) handlePointer(e); });
canvas.addEventListener('mouseup', () => { touchActive = false; speed *= 0.9; });
canvas.addEventListener('mouseleave', () => { touchActive = false; speed *= 0.9; });

const player = { x: 300, y: 500, width: 64, height: 96, color: '#fcd320', vx: 0, maxVx: 350, friction: 0.9, invuln: 0 };
let enemies = [];
let hazards = []; 

const enemyColors = ['#8bc34a', '#03a9f4', '#e91e63'];

function crash() {
    if (player.invuln > 0) return;
    lives--;
    speed = 0;
    player.invuln = 2.0; 
    if (lives < 0) gameOver();
}

function getSegmentAtGlobalY(y) {
    for (let i = 0; i < TrackState.segments.length; i++) {
        let seg = TrackState.segments[i];
        if (y >= seg.startY && y < seg.endY) return seg;
    }
    return TrackState.segments[TrackState.segments.length - 1] || { type: TerrainTypes.WALLED, trackWidth: 400 };
}

function getEffectiveWallWidth(y) {
    let seg = getSegmentAtGlobalY(y);
    let wallW = (600 - seg.trackWidth) / 2;
    
    let dy = y - seg.startY;
    if (dy >= 0 && dy < 80) {
        let prevSeg = null;
        for (let i = 0; i < TrackState.segments.length; i++) {
            if (TrackState.segments[i].endY === seg.startY) {
                prevSeg = TrackState.segments[i];
                break;
            }
        }
        if (prevSeg) {
            let prevWallW = (600 - prevSeg.trackWidth) / 2;
            if (prevWallW !== wallW) {
                let t = dy / 80; // 0 to 1
                return prevWallW + (wallW - prevWallW) * t;
            }
        }
    }
    return wallW;
}

function globalYToCanvas(y) {
    return 600 - (y - globalScrollY);
}

function update(dt) {
    if (state !== 'PLAYING') return;
    frameCount++;

    if (player.invuln > 0) player.invuln -= dt;

    if (slideTimer > 0) { slideTimer -= dt; player.friction = 0.99; } 
    else { player.friction = 0.85; }

    if (slideTimer <= 0) {
        if (touchActive || keys.ArrowUp) {
            speed += 400 * dt;
        } else if (keys.ArrowDown) {
            speed -= 600 * dt;
        } else {
            speed -= 150 * dt;
        }
    } else {
        speed -= 150 * dt;
    }
    
    let maxSpeed = TrackState.baseMaxSpeed + (TrackState.difficultyMultiplier * 50);
    if (speed < 0) speed = 0;
    if (speed > maxSpeed) speed = maxSpeed;

    if (slideTimer <= 0) {
        if (touchActive) {
            let diff = touchTargetX - player.x;
            player.vx = diff * 6; 
        } else {
            if (keys.ArrowLeft) player.vx -= 1800 * dt;
            else if (keys.ArrowRight) player.vx += 1800 * dt;
            else player.vx *= Math.pow(player.friction, dt * 60);
        }
    } else {
        player.vx *= Math.pow(player.friction, dt * 60);
    }
    
    if (player.vx < -player.maxVx) player.vx = -player.maxVx;
    if (player.vx > player.maxVx) player.vx = player.maxVx;

    player.x += player.vx * dt;
    
    let playerGlobalY = globalScrollY + 100;
    const pWallWidth = getEffectiveWallWidth(playerGlobalY);
    if (player.x < pWallWidth + 48) { player.x = pWallWidth + 48; player.vx = 0; }
    if (player.x > 600 - pWallWidth - 48) { player.x = 600 - pWallWidth - 48; player.vx = 0; }

    let moveDist = speed * dt;
    globalScrollY += moveDist;
    score += Math.floor(moveDist * 0.1);

    generateNextSegments(globalScrollY);
    TrackState.segments = TrackState.segments.filter(s => s.endY > globalScrollY - 1000);

    let viewportTopY = globalScrollY + 700; 
    let topSegment = getSegmentAtGlobalY(viewportTopY);

    let spawnChance = TrackState.baseEnemyChance * TrackState.difficultyMultiplier;
    if (Math.random() < spawnChance && enemies.length < 3) {
        let w = topSegment.trackWidth;
        let left = (600 - w) / 2;
        let laneWidth = w / 3;
        let laneIdx = Math.floor(Math.random() * 3);
        let laneX = left + laneIdx * laneWidth + laneWidth / 2;
        
        let tooClose = enemies.some(e => Math.abs(e.globalY - viewportTopY) < 400);
        if (!tooClose) {
            enemies.push({
                x: laneX,
                globalY: viewportTopY + 200, 
                width: 64, height: 96,
                color: enemyColors[Math.floor(Math.random() * enemyColors.length)],
                speed: 250 + Math.random() * 150 
            });
        }
    }

    if (Math.random() < topSegment.hazardChance && hazards.length < 5) {
        if (topSegment.type === TerrainTypes.WALLED) {
            let r = Math.random();
            let y = viewportTopY + 200 + Math.random() * 200;
            let tooClose = hazards.some(h => Math.abs(h.globalY - y) < 400);
            if (!tooClose) {
                if (r < 0.2) {
                    hazards.push({ type: 'BARRIER_LEFT', globalY: y, width: 80, height: 160 });
                } else if (r < 0.4) {
                    hazards.push({ type: 'BARRIER_RIGHT', globalY: y, width: 80, height: 160 });
                } else if (r < 0.6) {
                    hazards.push({ type: 'BARRIER_BOTH', globalY: y, width: 80, height: 160 });
                } else if (r < 0.8) {
                    hazards.push({ type: 'DIVIDER', globalY: y, width: 120, height: 160 });
                } else {
                    let beamWidth = 120 + Math.random() * 60;
                    hazards.push({ type: Math.random() < 0.5 ? 'BEAM_LEFT' : 'BEAM_RIGHT', globalY: y, width: beamWidth, height: 40 });
                }
            }
        } else if (topSegment.type === TerrainTypes.DIRT) {
            let w = topSegment.trackWidth;
            let left = (600 - w) / 2 + 50;
            hazards.push({
                type: 'MUD',
                x: left + Math.random() * (w - 100),
                globalY: viewportTopY + Math.random() * 200,
                radius: 20 + Math.random()*20
            });
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        e.globalY += e.speed * dt;
        
        let eWallW = getEffectiveWallWidth(e.globalY);
        let targetVx = 0;
        
        if (e.x < eWallW + 48) targetVx = 150;
        else if (e.x > 600 - eWallW - 48) targetVx = -150;
        else {
            let imminentHazards = hazards.filter(h => h.globalY > e.globalY && h.globalY < e.globalY + 400);
            if (imminentHazards.length > 0) {
                imminentHazards.sort((a, b) => a.globalY - b.globalY);
                let hzd = imminentHazards[0];
                let hLeft = 0, hRight = 0;
                let wallW = getEffectiveWallWidth(hzd.globalY);
                
                if (hzd.type === 'MUD') {
                    hLeft = hzd.x - hzd.radius; hRight = hzd.x + hzd.radius;
                } else if (hzd.type === 'BARRIER_LEFT' || hzd.type === 'BEAM_LEFT') {
                    hLeft = wallW; hRight = wallW + hzd.width;
                } else if (hzd.type === 'BARRIER_RIGHT' || hzd.type === 'BEAM_RIGHT') {
                    hLeft = 600 - wallW - hzd.width; hRight = 600 - wallW;
                } else if (hzd.type === 'DIVIDER') {
                    hLeft = 300 - hzd.width / 2; hRight = 300 + hzd.width / 2;
                }
                
                if (hzd.type === 'BARRIER_BOTH') {
                    targetVx = e.x < 300 ? 250 : -250;
                } else if (e.x + 32 > hLeft - 10 && e.x - 32 < hRight + 10) {
                    let spaceLeft = hLeft - wallW;
                    let spaceRight = (600 - wallW) - hRight;
                    targetVx = spaceLeft > spaceRight ? -250 : 250;
                }
            }
        }
        
        if (e.vx === undefined) e.vx = 0;
        if (targetVx > e.vx) e.vx += 1200 * dt;
        if (targetVx < e.vx) e.vx -= 1200 * dt;
        if (Math.abs(e.vx) > 300) e.vx = Math.sign(e.vx) * 300;
        
        e.x += e.vx * dt;
        if (e.x < eWallW + 48) { e.x = eWallW + 48; e.vx = 0; }
        if (e.x > 600 - eWallW - 48) { e.x = 600 - eWallW - 48; e.vx = 0; }
        
        let eCanvasY = globalYToCanvas(e.globalY);
        if (rectIntersect(player.x - 32, player.y - 48, 64, 96, e.x - 32, eCanvasY - 48, 64, 96)) {
            crash();
            e.globalY += 100; 
        }
        if (eCanvasY > 800 || eCanvasY < -400) enemies.splice(i, 1);
    }

    for (let i = hazards.length - 1; i >= 0; i--) {
        let h = hazards[i];
        let hCanvasY = globalYToCanvas(h.globalY);
        let wallW = getEffectiveWallWidth(h.globalY);

        let hitPlayer = checkHazardHit(player.x - 32, player.y - 48, 64, 96, h, hCanvasY, wallW);
        if (hitPlayer) {
            crash();
            hazards.splice(i, 1);
            continue;
        }

        let hitEnemy = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            let eCanvasY = globalYToCanvas(e.globalY);
            if (checkHazardHit(e.x - 32, eCanvasY - 48, 64, 96, h, hCanvasY, wallW)) {
                enemies.splice(j, 1);
                hitEnemy = true;
                break;
            }
        }
        
        if (hCanvasY > 800) hazards.splice(i, 1);
    }
}

function checkHazardHit(px, py, pw, ph, h, hCanvasY, wallW) {
    if (h.type === 'MUD') {
        let dx = (px + pw/2) - h.x; let dy = (py + ph/2) - hCanvasY;
        return Math.sqrt(dx*dx + dy*dy) < h.radius + 15;
    }
    if (h.type === 'BARRIER_LEFT') return rectIntersect(px, py, pw, ph, wallW, hCanvasY - h.height/2, h.width, h.height);
    if (h.type === 'BARRIER_RIGHT') return rectIntersect(px, py, pw, ph, 600 - wallW - h.width, hCanvasY - h.height/2, h.width, h.height);
    if (h.type === 'BARRIER_BOTH') return rectIntersect(px, py, pw, ph, wallW, hCanvasY - h.height/2, h.width, h.height) || rectIntersect(px, py, pw, ph, 600 - wallW - h.width, hCanvasY - h.height/2, h.width, h.height);
    if (h.type === 'DIVIDER') return rectIntersect(px, py, pw, ph, 300 - h.width/2, hCanvasY - h.height/2, h.width, h.height);
    if (h.type === 'BEAM_LEFT') return rectIntersect(px, py, pw, ph, wallW, hCanvasY - h.height/2, h.width, h.height);
    if (h.type === 'BEAM_RIGHT') return rectIntersect(px, py, pw, ph, 600 - wallW - h.width, hCanvasY - h.height/2, h.width, h.height);
    return false;
}

function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 600, 600);

    if (state !== 'PLAYING') return;

    let startGlobalY_view = globalScrollY;
    let endGlobalY_view = globalScrollY + 600;

    for (let i = 0; i < TrackState.segments.length; i++) {
        let seg = TrackState.segments[i];
        if (seg.endY < startGlobalY_view || seg.startY > endGlobalY_view) continue;

        let canvasStartY = globalYToCanvas(seg.endY); 
        let canvasEndY = globalYToCanvas(seg.startY); 
        let segHeight = canvasEndY - canvasStartY;
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, Math.floor(canvasStartY) - 1, 600, Math.ceil(segHeight) + 2);
        ctx.clip(); 

        const wallWidth = (600 - seg.trackWidth) / 2;

        let cbColor1 = (seg.type === TerrainTypes.WALLED) ? '#a020f0' : '#8B4513';
        let cbColor2 = (seg.type === TerrainTypes.WALLED) ? '#4b0082' : '#d2691e';
        let firstCbY = Math.floor(seg.startY / 5) * 5;
        for (let y = firstCbY; y <= seg.endY + 5; y += 5) {
            let cy = globalYToCanvas(y);
            if (cy > 600 || cy < -5) continue;
            for(let x=0; x<20; x+=5) {
                ctx.fillStyle = ((y/5 + x/5) % 2 === 0) ? cbColor1 : cbColor2;
                ctx.fillRect(x, cy, 5, 5);
                ctx.fillRect(580 + x, cy, 5, 5);
            }
        }

        if (seg.type === TerrainTypes.WALLED) {
            let firstBrickY = Math.floor(seg.startY / 32) * 32;
            for (let y = firstBrickY; y <= seg.endY + 32; y += 32) {
                let cy = globalYToCanvas(y);
                if (cy > 600 || cy < -32) continue;

                ctx.fillStyle = '#8B0000';
                ctx.fillRect(20, cy, wallWidth - 20, 32);
                ctx.fillRect(600 - wallWidth, cy, wallWidth - 20, 32);

                ctx.fillStyle = '#000';
                ctx.fillRect(20, cy, wallWidth - 20, 4); 
                ctx.fillRect(600 - wallWidth, cy, wallWidth - 20, 4);
                let xOff = (y/32)%2 === 0 ? 0 : 16;
                for (let x = 20 + xOff; x < wallWidth; x += 32) ctx.fillRect(x, cy, 4, 32);
                for (let x = 600 - wallWidth + xOff; x < 580; x += 32) ctx.fillRect(x, cy, 4, 32);
            }
        } else if (seg.type === TerrainTypes.WATER) {
            let lakeColor = '#001ea8';
            let firstLakeY = Math.floor((seg.startY + 200) / 10) * 10;
            let endLakeY = seg.endY - 200;
            for (let y = firstLakeY; y <= endLakeY + 10; y += 10) {
                let cy = globalYToCanvas(y);
                if (cy > 600 || cy < -10) continue;
                let offset = Math.floor(Math.sin(y / 20) * 4) * 5; 
                ctx.fillStyle = lakeColor;
                ctx.fillRect(150 + offset, cy, 300, 10);
            }
        }
        ctx.restore();
    }

    // Draw track width transitions (white funnels)
    for (let i = 1; i < TrackState.segments.length; i++) {
        let prevSeg = TrackState.segments[i-1];
        let seg = TrackState.segments[i];
        if (seg.trackWidth !== prevSeg.trackWidth) {
            let tCanvasY = globalYToCanvas(seg.startY);
            if (tCanvasY > -80 && tCanvasY < 680) {
                let w1 = (600 - prevSeg.trackWidth) / 2;
                let w2 = (600 - seg.trackWidth) / 2;
                
                ctx.fillStyle = '#eee';
                ctx.beginPath();
                ctx.moveTo(w2, tCanvasY); 
                ctx.lineTo(w1, tCanvasY);
                ctx.lineTo(w2, tCanvasY - 80);
                ctx.fill();
                
                ctx.beginPath();
                ctx.moveTo(600 - w2, tCanvasY);
                ctx.lineTo(600 - w1, tCanvasY);
                ctx.lineTo(600 - w2, tCanvasY - 80);
                ctx.fill();
            }
        }
    }

    hazards.forEach(h => {
        let hCanvasY = globalYToCanvas(h.globalY);
        let wallW = getEffectiveWallWidth(h.globalY);

        if (h.type === 'MUD') {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(h.x - h.radius, hCanvasY - h.radius*0.8, h.radius*2, h.radius*1.6);
            ctx.fillRect(h.x - h.radius*0.8, hCanvasY - h.radius, h.radius*1.6, h.radius*2);
        } else if (h.type === 'BARRIER_LEFT' || h.type === 'BARRIER_RIGHT' || h.type === 'BARRIER_BOTH') {
            ctx.fillStyle = '#7b1fa2'; // Purple
            
            if (h.type === 'BARRIER_LEFT' || h.type === 'BARRIER_BOTH') {
                ctx.beginPath();
                ctx.moveTo(wallW, hCanvasY - h.height/2);
                ctx.lineTo(wallW + h.width, hCanvasY - h.height/4);
                ctx.lineTo(wallW + h.width, hCanvasY + h.height/4);
                ctx.lineTo(wallW, hCanvasY + h.height/2);
                ctx.fill();
            }
            if (h.type === 'BARRIER_RIGHT' || h.type === 'BARRIER_BOTH') {
                ctx.beginPath();
                ctx.moveTo(600 - wallW, hCanvasY - h.height/2);
                ctx.lineTo(600 - wallW - h.width, hCanvasY - h.height/4);
                ctx.lineTo(600 - wallW - h.width, hCanvasY + h.height/4);
                ctx.lineTo(600 - wallW, hCanvasY + h.height/2);
                ctx.fill();
            }
        } else if (h.type === 'DIVIDER') {
            let cx = 300;
            // Green middle
            ctx.fillStyle = '#33691E';
            ctx.fillRect(cx - h.width/2, hCanvasY - h.height/4, h.width, h.height/2);
            // Purple top triangle
            ctx.fillStyle = '#7b1fa2';
            ctx.beginPath();
            ctx.moveTo(cx - h.width/2, hCanvasY - h.height/4);
            ctx.lineTo(cx, hCanvasY - h.height/2 - 20);
            ctx.lineTo(cx + h.width/2, hCanvasY - h.height/4);
            ctx.fill();
            // Purple bottom triangle
            ctx.beginPath();
            ctx.moveTo(cx - h.width/2, hCanvasY + h.height/4);
            ctx.lineTo(cx, hCanvasY + h.height/2 + 20);
            ctx.lineTo(cx + h.width/2, hCanvasY + h.height/4);
            ctx.fill();
        } else if (h.type.startsWith('BEAM')) {
            ctx.fillStyle = '#33691E'; 
            if (h.type === 'BEAM_LEFT') {
                ctx.fillRect(wallW, hCanvasY - h.height/2, h.width, h.height);
                ctx.fillStyle = '#558b2f'; 
                ctx.fillRect(wallW, hCanvasY - h.height/2, h.width, 10);
            } else if (h.type === 'BEAM_RIGHT') {
                ctx.fillRect(600 - wallW - h.width, hCanvasY - h.height/2, h.width, h.height);
                ctx.fillStyle = '#558b2f';
                ctx.fillRect(600 - wallW - h.width, hCanvasY - h.height/2, h.width, 10);
            }
        }
    });

    enemies.forEach(e => {
        drawHighQualityCar(e.x, globalYToCanvas(e.globalY), e.color, false, e.vx, e.globalY);
    });

    if (player.invuln > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
        // Flash
    } else {
        drawHighQualityCar(player.x, player.y, player.color, slideTimer > 0, player.vx, globalScrollY);
    }

    drawRetroUI();
}

function drawRetroUI() {
    // Bottom black bar
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 560, 600, 40);

    ctx.font = '24px "Courier New", Courier, monospace';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Score on the left, padded with zeroes
    let paddedScore = score.toString().padStart(6, '0');
    ctx.fillText(paddedScore, 20, 580);

    // Some flag icon indicator (mocking the little flag from screenshot)
    ctx.fillStyle = '#aaa';
    ctx.fillRect(150, 570, 4, 20);
    ctx.beginPath(); ctx.moveTo(154, 570); ctx.lineTo(164, 575); ctx.lineTo(154, 580); ctx.fill();

    // Speed in center
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    let speedLvl = Math.floor(speed / 100) + 1;
    ctx.fillText('SPEED', 300, 572);
    ctx.fillStyle = '#5c5cff'; // Blue speed number
    ctx.fillText(speedLvl.toString(), 300, 592);
}

function drawHighQualityCar(x, y, color, isSliding, vx = 0, distanceTravelled = 0) {
    ctx.save();
    ctx.translate(x, y);
    
    let maxAngle = 0.2; 
    let angle = (vx / 350) * maxAngle;
    ctx.rotate(angle);

    if (isSliding) ctx.translate(Math.sin(frameCount * 0.5) * 4, 0);

    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 8;

    ctx.fillStyle = '#777'; 
    ctx.shadowColor = 'transparent'; 
    ctx.beginPath(); ctx.roundRect(-38, -30, 16, 24, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(22, -30, 16, 24, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-38, 6, 16, 24, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(22, 6, 16, 24, 4); ctx.fill();

    ctx.fillStyle = '#333';
    let treadCycle = Math.floor(distanceTravelled / 20) % 2;
    let treadOffset = treadCycle === 0 ? 0 : 8;
    ctx.fillRect(-38, -26 + treadOffset, 16, 4);
    ctx.fillRect(22, -26 + treadOffset, 16, 4);
    ctx.fillRect(-38, -14 + treadOffset, 16, 4);
    ctx.fillRect(22, -14 + treadOffset, 16, 4);

    ctx.fillRect(-38, 10 + treadOffset, 16, 4);
    ctx.fillRect(22, 10 + treadOffset, 16, 4);
    ctx.fillRect(-38, 22 + treadOffset, 16, 4);
    ctx.fillRect(22, 22 + treadOffset, 16, 4);

    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(-28, -48, 56, 96, 8); ctx.fill();
    
    ctx.shadowColor = 'transparent';
    let grad = ctx.createLinearGradient(-28, 0, 28, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.3)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.2)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    grad.addColorStop(0.8, 'rgba(255,255,255,0.1)');
    grad.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(-28, -48, 56, 96, 8); ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(-32, -30, 8, 60, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(24, -30, 8, 60, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.roundRect(-32, -30, 8, 60, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(24, -30, 8, 60, 2); ctx.fill();

    let winGrad = ctx.createLinearGradient(0, -18, 0, 18);
    winGrad.addColorStop(0, '#555');
    winGrad.addColorStop(0.5, '#999');
    winGrad.addColorStop(1, '#333');
    ctx.fillStyle = winGrad;
    ctx.beginPath(); ctx.roundRect(-18, -12, 36, 24, 3); ctx.fill();
    
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.moveTo(-18, -12); ctx.lineTo(18, -12); ctx.lineTo(-18, 6); ctx.fill();

    if (color === '#fcd320') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-24, -48, 12, 6);
        ctx.fillRect(12, -48, 12, 6);
    } else {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-24, 42, 12, 6);
        ctx.fillRect(12, 42, 12, 6);
    }

    ctx.restore();
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (screenId) document.getElementById(screenId).classList.add('active');
}

function startGame() {
    score = 0;
    lives = 3;
    initTrack();
    generateNextSegments(0);
    speed = 0;
    globalScrollY = 0;
    player.x = 300; player.y = 500; player.vx = 0; player.invuln = 0;
    enemies = []; hazards = []; slideTimer = 0;
    
    state = 'PLAYING';
    showScreen(''); // No hud screen anymore
    lastTime = performance.now();
}

function gameOver() {
    state = 'GAMEOVER';
    ui.finalScore.textContent = score;
    showScreen('game-over-screen');
    const restartTap = () => { startGame(); document.removeEventListener('touchstart', restartTap); };
    setTimeout(() => { document.addEventListener('touchstart', restartTap); }, 500);
}

function loop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; 
    lastTime = timestamp;
    if (state === 'PLAYING') { update(dt); draw(); }
    requestAnimationFrame(loop);
}

window.onload = () => {
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.remove();
    startGame();
    requestAnimationFrame(loop);
};
