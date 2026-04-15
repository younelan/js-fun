// ── Petit Chevaux ─────────────────────────────────────────────────────────────
const BS=600, G=15, C=BS/G;
const COLORS=['red','blue','green','yellow'];
const HEX ={red:'#e53935',blue:'#1565c0',green:'#388e3c',yellow:'#f9a825'};
const DARK={red:'#7f0000',blue:'#003c8f',green:'#1b5e20',yellow:'#c17900'};
const LITE={red:'#ffcdd2',blue:'#bbdefb',green:'#c8e6c9',yellow:'#fff9c4'};
const FR  ={red:'Rouge',  blue:'Bleu',   green:'Vert',   yellow:'Jaune'  };

// ── 52-step track (clockwise) ─────────────────────────────────────────────────
const TRACK52=(()=>{
    const t=[];
    for(let r=14;r>=9;r--) t.push([6,r]);   // Red entry:    col6 rows14→9  (6)
    for(let c=5;c>=0;c--) t.push([c,8]);    //               row8 cols5→0   (6)
    for(let r=7;r>=6;r--) t.push([0,r]);    //               col0 rows7→6   (2)
    for(let c=1;c<=5;c++) t.push([c,6]);    // Blue entry:   row6 cols1→5   (5)
    for(let r=5;r>=0;r--) t.push([6,r]);    //               col6 rows5→0   (6)
    t.push([7,0]);                           //               row0 col7      (1)
    for(let r=0;r<=5;r++) t.push([8,r]);    // Green entry:  col8 rows0→5   (6)
    for(let c=9;c<=14;c++) t.push([c,6]);   //               row6 cols9→14  (6)
    for(let r=7;r<=8;r++) t.push([14,r]);   //               col14 rows7→8  (2)
    for(let c=13;c>=9;c--) t.push([c,8]);   // Yellow entry: row8 cols13→9  (5)
    for(let r=9;r<=14;r++) t.push([8,r]);   //               col8 rows9→14  (6)
    t.push([7,14]);                          //               row14 col7     (1)
    return t; // 52
})();

const ENTRY     ={red:0,  blue:13, green:26, yellow:44};
const LAST_TRACK={red:51, blue:12, green:25, yellow:43};

function homeCell(color,step){
    switch(color){
        case 'red':    return [7,13-step];
        case 'blue':   return [1+step,7];
        case 'green':  return [7,1+step];
        case 'yellow': return [13-step,7];
    }
}
function stableSlot(color,idx){
    const ox=[1.5,3.5,1.5,3.5],oy=[1.5,1.5,3.5,3.5];
    switch(color){
        case 'red':    return {x:ox[idx]*C,       y:(9+oy[idx])*C};
        case 'blue':   return {x:ox[idx]*C,        y:oy[idx]*C};
        case 'green':  return {x:(9+ox[idx])*C,    y:oy[idx]*C};
        case 'yellow': return {x:(9+ox[idx])*C,    y:(9+oy[idx])*C};
    }
}
function cc(col,row){return{x:col*C+C/2,y:row*C+C/2};}

// ── State ─────────────────────────────────────────────────────────────────────
let horses={},currentColor='red',diceValue=null;
let waitingForMove=false,movableHorses=[],gameOver=false;
let particles=[];
let animHorses=[];   // {horse, fromX, fromY, toX, toY, t, onDone}
let glowT=0;         // pulsing glow timer

const DICE_FACES=['','⚀','⚁','⚂','⚃','⚄','⚅'];
const AI_DELAY=950;

const canvas =document.getElementById('board');
const ctx    =canvas.getContext('2d');
const rollBtn=document.getElementById('roll-btn');
const msgEl  =document.getElementById('message');
const diceEl =document.getElementById('dice-result');
const nameEl =document.getElementById('current-player-name');
const goEl   =document.getElementById('game-over');
const winEl  =document.getElementById('winner-text');
const restBtn=document.getElementById('restart-btn');

// ── Init ──────────────────────────────────────────────────────────────────────
function initGame(){
    horses={};
    COLORS.forEach(c=>{
        horses[c]=Array.from({length:4},(_,i)=>({
            id:i,color:c,state:'stable',trackIdx:0,homeStep:-1,
            x:0,y:0  // current render position (set on first draw)
        }));
    });
    currentColor='red'; diceValue=null;
    waitingForMove=false; movableHorses=[]; gameOver=false;
    particles=[]; animHorses=[];
    goEl.classList.add('hidden');
    rollBtn.disabled=true;
    setMsg('🎲 Lancement automatique…');
    diceEl.textContent='';
    // Initialise horse positions
    COLORS.forEach(c=>horses[c].forEach(h=>{
        const p=getHorseXY(h); h.x=p.x; h.y=p.y;
    }));
    updateUI();
    startLoop();
    setTimeout(onRoll, 800);
}

// ── Movement logic ────────────────────────────────────────────────────────────
function stepsToLast(color,idx){
    const lt=LAST_TRACK[color];
    return (lt-idx+52)%52+1;
}
function canMove(h,dice){
    if(h.state==='finished') return false;
    if(h.state==='stable')   return dice===6;
    if(h.state==='track'){
        const s=stepsToLast(h.color,h.trackIdx);
        return dice<s || (dice-s)<=4;
    }
    if(h.state==='home') return h.homeStep+dice<=4;
    return false;
}
function getMovable(color,dice){return horses[color].filter(h=>canMove(h,dice));}

function applyMove(h,dice){
    if(h.state==='stable'){
        h.state='track'; h.trackIdx=ENTRY[h.color];
        doCapture(h); return;
    }
    if(h.state==='track'){
        const s=stepsToLast(h.color,h.trackIdx);
        if(dice<s){ h.trackIdx=(h.trackIdx+dice)%52; doCapture(h); }
        else{ h.state='home'; h.homeStep=dice-s; if(h.homeStep>=4){h.homeStep=4;h.state='finished';} }
        return;
    }
    if(h.state==='home'){
        h.homeStep+=dice;
        if(h.homeStep>=4){h.homeStep=4;h.state='finished';}
    }
}

function doCapture(mover){
    if(mover.state!=='track') return;
    COLORS.forEach(c=>{
        if(c===mover.color) return;
        horses[c].forEach(h=>{
            if(h.state==='track'&&h.trackIdx===mover.trackIdx){
                spawnParticles(h.x,h.y,HEX[h.color]);
                h.state='stable'; h.trackIdx=0; h.homeStep=-1;
                const p=stableSlot(h.color,h.id); h.x=p.x; h.y=p.y;
                setMsg(`💥 ${FR[mover.color]} capture ${FR[c]} !`);
            }
        });
    });
}

function checkWin(color){return horses[color].every(h=>h.state==='finished');}

// ── Animated move ─────────────────────────────────────────────────────────────
// Build waypoints along the path for smooth step-by-step animation
function buildWaypoints(h,dice){
    const pts=[];
    const clone={state:h.state,trackIdx:h.trackIdx,homeStep:h.homeStep,color:h.color};
    pts.push(getHorseXYFromState(clone));
    if(clone.state==='stable'){
        clone.state='track'; clone.trackIdx=ENTRY[clone.color];
        pts.push(getHorseXYFromState(clone));
    } else if(clone.state==='track'){
        const s=stepsToLast(clone.color,clone.trackIdx);
        if(dice<s){
            for(let i=1;i<=dice;i++){
                const idx=(clone.trackIdx+i)%52;
                const [c,r]=TRACK52[idx]; pts.push(cc(c,r));
            }
        } else {
            // finish track steps
            for(let i=1;i<s;i++){
                const idx=(clone.trackIdx+i)%52;
                const [c,r]=TRACK52[idx]; pts.push(cc(c,r));
            }
            // enter home
            const into=dice-s;
            for(let i=0;i<=into&&i<=4;i++){
                const [c,r]=homeCell(clone.color,i); pts.push(cc(c,r));
            }
        }
    } else if(clone.state==='home'){
        for(let i=1;i<=dice&&clone.homeStep+i<=4;i++){
            const [c,r]=homeCell(clone.color,clone.homeStep+i); pts.push(cc(c,r));
        }
    }
    return pts;
}

function getHorseXYFromState(s){
    if(s.state==='stable') return stableSlot(s.color,0); // approx
    if(s.state==='track'){const[c,r]=TRACK52[s.trackIdx];return cc(c,r);}
    const step=s.state==='finished'?4:s.homeStep;
    const[c,r]=homeCell(s.color,step);return cc(c,r);
}

function animateMove(h,dice,onDone){
    const waypoints=buildWaypoints(h,dice);
    if(waypoints.length<=1){applyMove(h,dice);onDone();return;}
    let seg=0;
    const STEP_DUR=120; // ms per cell
    const start=performance.now();
    function tick(now){
        const elapsed=now-start;
        const totalSeg=waypoints.length-1;
        const segF=Math.min(elapsed/(STEP_DUR*totalSeg),1);
        const rawSeg=segF*totalSeg;
        const curSeg=Math.min(Math.floor(rawSeg),totalSeg-1);
        const t=rawSeg-curSeg;
        const a=waypoints[curSeg], b=waypoints[Math.min(curSeg+1,totalSeg)];
        if(!a||!b){applyMove(h,dice);const p=getHorseXY(h);h.x=p.x;h.y=p.y;onDone();return;}
        // ease in-out
        const e=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
        h.x=a.x+(b.x-a.x)*e;
        h.y=a.y+(b.y-a.y)*e;
        if(segF<1){ requestAnimationFrame(tick); }
        else{
            applyMove(h,dice);
            const p=getHorseXY(h); h.x=p.x; h.y=p.y;
            onDone();
        }
    }
    requestAnimationFrame(tick);
}

// ── Particles ─────────────────────────────────────────────────────────────────
function spawnParticles(x,y,color){
    for(let i=0;i<18;i++){
        const angle=Math.random()*Math.PI*2;
        const speed=1.5+Math.random()*3;
        particles.push({
            x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
            life:1,color,r:3+Math.random()*4
        });
    }
}
function spawnFinishParticles(x,y,color){
    for(let i=0;i<30;i++){
        const angle=Math.random()*Math.PI*2;
        const speed=2+Math.random()*5;
        particles.push({
            x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-3,
            life:1,color,r:4+Math.random()*5
        });
    }
}
function updateParticles(){
    particles=particles.filter(p=>{
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.life-=0.03;
        return p.life>0;
    });
}

// ── Turn flow ─────────────────────────────────────────────────────────────────
function onRoll(){
    if(gameOver||waitingForMove) return;
    rollBtn.disabled=true;
    diceEl.classList.add('rolling');
    let n=0;
    const iv=setInterval(()=>{
        diceEl.textContent=DICE_FACES[Math.ceil(Math.random()*6)];
        if(++n>=12){clearInterval(iv);diceEl.classList.remove('rolling');settle();}
    },65);
}

function settle(){
    diceValue=Math.ceil(Math.random()*6);
    diceEl.textContent=DICE_FACES[diceValue];
    diceEl.classList.add('landed');
    setTimeout(()=>diceEl.classList.remove('landed'),400);
    movableHorses=getMovable(currentColor,diceValue);
    if(movableHorses.length===0){
        setMsg(`${FR[currentColor]} : aucun mouvement possible.`);
        setTimeout(nextTurn,1400); return;
    }
    if(currentColor==='red'){
        waitingForMove=true;
        rollBtn.disabled=true;
        setMsg(`Dé : ${diceValue} — cliquez sur un cheval à déplacer.`);
        return;
    }
    setTimeout(()=>{
        let chosen=movableHorses.find(h=>{
            if(h.state!=='track') return false;
            const dest=(h.trackIdx+diceValue)%52;
            return COLORS.some(c=>c!==currentColor&&horses[c].some(o=>o.state==='track'&&o.trackIdx===dest));
        })||movableHorses.find(h=>h.state==='stable')||movableHorses[0];
        doMove(chosen);
    },600);
}

function doMove(h){
    waitingForMove=false; movableHorses=[];
    animateMove(h,diceValue,()=>{
        updateUI();
        if(h.state==='finished') spawnFinishParticles(h.x,h.y,HEX[h.color]);
        if(checkWin(currentColor)){
            gameOver=true;
            spawnFinishParticles(BS/2,BS/2,'#d4af37');
            setTimeout(()=>{winEl.textContent=`🏆 ${FR[currentColor]} gagne !`;goEl.classList.remove('hidden');},800);
            return;
        }
        if(diceValue===6){
            setMsg(`${FR[currentColor]} rejoue ! (6 🎲)`);
            setTimeout(onRoll, AI_DELAY);
        } else {
            setTimeout(nextTurn,500);
        }
    });
}

function nextTurn(){
    waitingForMove=false; movableHorses=[];
    currentColor=COLORS[(COLORS.indexOf(currentColor)+1)%4];
    diceValue=null; diceEl.textContent='';
    updateUI();
    if(currentColor==='red'){
        rollBtn.disabled=true;
        setMsg('🎲 Lancement automatique…');
        setTimeout(onRoll, AI_DELAY);
    } else {
        rollBtn.disabled=true;
        setMsg(`Tour de ${FR[currentColor]}…`);
        setTimeout(onRoll,AI_DELAY);
    }
}

// ── Canvas click ──────────────────────────────────────────────────────────────
canvas.addEventListener('click',e=>{
    if(!waitingForMove||currentColor!=='red') return;
    const rect=canvas.getBoundingClientRect();
    const sx=canvas.width/rect.width,sy=canvas.height/rect.height;
    const mx=(e.clientX-rect.left)*sx,my=(e.clientY-rect.top)*sy;
    for(const h of movableHorses){
        if((mx-h.x)**2+(my-h.y)**2<=(C*0.52)**2){doMove(h);return;}
    }
});

// ── Position helpers ──────────────────────────────────────────────────────────
function getHorseXY(h){
    if(h.state==='stable') return stableSlot(h.color,h.id);
    if(h.state==='track'){const[c,r]=TRACK52[h.trackIdx];return cc(c,r);}
    const step=h.state==='finished'?4:h.homeStep;
    const[c,r]=homeCell(h.color,step);return cc(c,r);
}

// ── Render loop ───────────────────────────────────────────────────────────────
let loopRunning=false;
function startLoop(){
    if(loopRunning) return;
    loopRunning=true;
    requestAnimationFrame(loop);
}
function loop(now){
    glowT=now/600;
    updateParticles();
    drawAll();
    requestAnimationFrame(loop);
}

function drawAll(){
    ctx.clearRect(0,0,BS,BS);
    drawBoard();
    COLORS.forEach(c=>horses[c].forEach(h=>drawHorse(h)));
    if(waitingForMove) movableHorses.forEach(h=>drawGlow(h,glowT));
    drawParticles();
}

// ── Board drawing ─────────────────────────────────────────────────────────────
function drawBoard(){
    // Background — clean dark felt
    ctx.fillStyle='#2d5a1b';
    ctx.fillRect(0,0,BS,BS);
    // Board border
    ctx.strokeStyle='#d4af37';
    ctx.lineWidth=5;
    ctx.strokeRect(3,3,BS-6,BS-6);
    ctx.strokeStyle='#a07c10';
    ctx.lineWidth=1.5;
    ctx.strokeRect(7,7,BS-14,BS-14);

    // Cross arms background
    ctx.fillStyle='#f0ebe0';
    ctx.fillRect(6*C,0,3*C,BS);
    ctx.fillRect(0,6*C,BS,3*C);
    // Cross arm subtle border lines
    ctx.strokeStyle='rgba(0,0,0,0.12)';
    ctx.lineWidth=1;
    ctx.strokeRect(6*C,0,3*C,BS);
    ctx.strokeRect(0,6*C,BS,3*C);

    // Corner quadrants — styled home bases
    const corners=[
        {color:'red',    col:0,row:9},
        {color:'blue',   col:0,row:0},
        {color:'green',  col:9,row:0},
        {color:'yellow', col:9,row:9},
    ];
    corners.forEach(({color,col,row})=>{
        const x=col*C, y=row*C, w=6*C, h=6*C;
        const cx=x+w/2, cy=y+h/2;

        // Flat solid fill + border
        ctx.fillStyle=LITE[color];
        ctx.strokeStyle=HEX[color];
        ctx.lineWidth=3;
        ctx.beginPath();
        ctx.roundRect(x+2,y+2,w-4,h-4,10);
        ctx.fill(); ctx.stroke();

        // Inner border inset
        ctx.strokeStyle=HEX[color]+'66';
        ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.roundRect(x+8,y+8,w-16,h-16,6);
        ctx.stroke();

        // Label
        ctx.fillStyle=DARK[color];
        ctx.font=`900 ${C*0.52}px Segoe UI`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        const bannerY = color==='red'||color==='yellow' ? y+C*0.6 : y+h-C*0.6;
        ctx.fillText(FR[color], cx, bannerY);

        // Stable spots
        for(let i=0;i<4;i++){
            const p=stableSlot(color,i);
            const R=C*0.42;
            // Shadow
            ctx.fillStyle='rgba(0,0,0,0.15)';
            ctx.beginPath(); ctx.ellipse(p.x+2,p.y+3,R*0.9,R*0.5,0,0,Math.PI*2); ctx.fill();
            // Circle
            ctx.fillStyle=HEX[color]+'55';
            ctx.strokeStyle=HEX[color];
            ctx.lineWidth=2.5;
            ctx.beginPath(); ctx.arc(p.x,p.y,R,0,Math.PI*2); ctx.fill(); ctx.stroke();
            // Inner ring
            ctx.strokeStyle=HEX[color];
            ctx.lineWidth=1.5;
            ctx.beginPath(); ctx.arc(p.x,p.y,R*0.5,0,Math.PI*2); ctx.stroke();
        }
    });

    // Track cells (skip any that fall inside a corner quadrant — they're hidden under the home base)
    const trackSet=new Set(TRACK52.map(([c,r])=>`${c},${r}`));
    TRACK52.forEach(([col,row],idx)=>{
        const inCorner=(col<6&&row<6)||(col>8&&row<6)||(col<6&&row>8)||(col>8&&row>8);
        if(inCorner) return; // hidden under corner base
        const x=col*C,y=row*C;
        let fill='#ffffff';
        if(idx===ENTRY.red)    fill=LITE.red;
        if(idx===ENTRY.blue)   fill=LITE.blue;
        if(idx===ENTRY.green)  fill=LITE.green;
        if(idx===ENTRY.yellow) fill=LITE.yellow;
        ctx.fillStyle=fill; ctx.strokeStyle='#ccc'; ctx.lineWidth=1;
        ctx.fillRect(x,y,C,C); ctx.strokeRect(x,y,C,C);
        // Entry marker circle
        if(idx===ENTRY.red||idx===ENTRY.blue||idx===ENTRY.green||idx===ENTRY.yellow){
            const ec=idx===ENTRY.red?'red':idx===ENTRY.blue?'blue':idx===ENTRY.green?'green':'yellow';
            ctx.fillStyle=HEX[ec]+'cc';
            ctx.beginPath(); ctx.arc(x+C/2,y+C/2,C*0.22,0,Math.PI*2); ctx.fill();
        }
    });

    // Non-track cross cells (col7 and row7 lanes)
    for(let r=0;r<G;r++) for(let c=0;c<G;c++){
        if(trackSet.has(`${c},${r}`)) continue;
        const inCorner=(c<6&&r<6)||(c>8&&r<6)||(c<6&&r>8)||(c>8&&r>8);
        if(inCorner) continue;
        const inCross=(c>=6&&c<=8)||(r>=6&&r<=8);
        if(!inCross) continue;
        let fill='#f5f0e8';
        if(c===7&&r>=0&&r<=6)  fill=LITE.green+'cc';
        if(c===7&&r>=8&&r<=14) fill=LITE.red+'cc';
        if(r===7&&c>=0&&c<=6)  fill=LITE.blue+'cc';
        if(r===7&&c>=8&&c<=14) fill=LITE.yellow+'cc';
        ctx.fillStyle=fill; ctx.strokeStyle='#ddd'; ctx.lineWidth=1;
        ctx.fillRect(c*C,r*C,C,C); ctx.strokeRect(c*C,r*C,C,C);
    }

    // Home columns — solid color runway with step numbers and finish star
    COLORS.forEach(color=>{
        for(let step=0;step<=4;step++){
            const[c,r]=homeCell(color,step);
            const x=c*C, y=r*C;
            ctx.fillStyle=step===4?HEX[color]:LITE[color];
            ctx.strokeStyle=HEX[color];
            ctx.lineWidth=1.5;
            ctx.fillRect(x,y,C,C); ctx.strokeRect(x,y,C,C);
            // Step number or finish star
            ctx.fillStyle=step===4?'#fff':DARK[color];
            ctx.font=step===4?`${C*0.55}px serif`:`bold ${C*0.42}px Segoe UI`;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(step===4?'★':step+1, x+C/2, y+C/2);
        }
    });

    // Centre
    const mid=BS/2, cx=6*C, cy=6*C, cw=3*C;
    ctx.fillStyle='#fff8f0'; ctx.fillRect(cx,cy,cw,cw);
    const tris=[
        {color:'red',    pts:[[cx,cy+cw],[cx+cw,cy+cw],[mid,mid]]},
        {color:'blue',   pts:[[cx,cy],   [cx,cy+cw],   [mid,mid]]},
        {color:'green',  pts:[[cx,cy],   [cx+cw,cy],   [mid,mid]]},
        {color:'yellow', pts:[[cx+cw,cy],[cx+cw,cy+cw],[mid,mid]]},
    ];
    tris.forEach(({color,pts})=>{
        ctx.fillStyle=HEX[color]+'cc';
        ctx.beginPath();
        ctx.moveTo(pts[0][0],pts[0][1]);
        ctx.lineTo(pts[1][0],pts[1][1]);
        ctx.lineTo(pts[2][0],pts[2][1]);
        ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle='#d4af37';
    ctx.font=`${C*2.1}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('★',mid,mid);
    ctx.strokeStyle='#d4af37'; ctx.lineWidth=2.5;
    ctx.strokeRect(cx,cy,cw,cw);
}

function drawHorse(h){
    const x=h.x, y=h.y, R=C*0.34;
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(x+2,y+4,R*0.9,R*0.45,0,0,Math.PI*2); ctx.fill();
    // Gradient body
    const g=ctx.createRadialGradient(x-R*0.3,y-R*0.3,R*0.1,x,y,R);
    g.addColorStop(0,'#fff');
    g.addColorStop(0.3,HEX[h.color]);
    g.addColorStop(1,DARK[h.color]);
    ctx.fillStyle=g;
    ctx.strokeStyle=DARK[h.color];
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(x,y,R,0,Math.PI*2); ctx.fill(); ctx.stroke();
    // Number
    ctx.fillStyle='#fff';
    ctx.font=`bold ${R*1.15}px Segoe UI`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(h.id+1,x,y);
}

function drawGlow(h,t){
    const pulse=0.7+0.3*Math.sin(t*3);
    const R=C*(0.42+0.06*Math.sin(t*3));
    ctx.save();
    ctx.shadowColor='#ffeb3b';
    ctx.shadowBlur=20*pulse;
    ctx.strokeStyle=`rgba(255,235,59,${pulse})`;
    ctx.lineWidth=3;
    ctx.setLineDash([6,4]);
    ctx.lineDashOffset=-t*8;
    ctx.beginPath(); ctx.arc(h.x,h.y,R,0,Math.PI*2); ctx.stroke();
    ctx.restore();
}

function drawParticles(){
    particles.forEach(p=>{
        ctx.globalAlpha=p.life;
        ctx.fillStyle=p.color;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha=1;
}

// ── UI ────────────────────────────────────────────────────────────────────────
function setMsg(t){msgEl.textContent=t;}

function updateUI(){
    nameEl.textContent=FR[currentColor];
    nameEl.style.color=HEX[currentColor];
    nameEl.style.textShadow=`0 0 12px ${HEX[currentColor]}`;
    rollBtn.style.boxShadow=currentColor==='red'
        ?`0 0 20px ${HEX.red},0 4px 14px rgba(0,0,0,0.4)`
        :'0 4px 14px rgba(0,0,0,0.4)';
    COLORS.forEach(c=>{
        const el=document.getElementById(`score-${c}`);
        if(el){
            el.classList.toggle('active',c===currentColor);
            el.style.borderColor=c===currentColor?HEX[c]:'rgba(255,255,255,0.2)';
            el.style.boxShadow=c===currentColor?`0 0 12px ${HEX[c]}66`:'none';
        }
        const sp=document.querySelector(`#score-${c} span`);
        if(sp) sp.textContent=horses[c]?horses[c].filter(h=>h.state==='finished').length:0;
    });
}

rollBtn.addEventListener('click',onRoll);
restBtn.addEventListener('click',initGame);
initGame();
