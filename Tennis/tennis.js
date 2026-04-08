// 3D Tennis Game
// Main game logic with Three.js

class TennisGame {
    constructor() {
        try {
            console.log('Initializing Tennis Game...');

            this.canvas = document.getElementById('gameCanvas');
            this.gameContainer = document.getElementById('tennis-game');

            if (!this.canvas) {
                throw new Error('Canvas element not found');
            }

            if (!THREE) {
                throw new Error('Three.js not loaded');
            }

            console.log('Canvas and Three.js found, continuing initialization...');

        // Game state
        this.gameState = 'start'; // start, playing, paused, gameOver
        this.playerScore = 0;
        this.opponentScore = 0;
        this.winningScore = 11;

        // Settings
        this.settings = {
            autoAim: true,
            autoTiming: true,
            movementAssist: true,
            difficulty: 'medium',
            soundEnabled: true
        };

        // Controls
        this.keys = {};
        this.touchStart = null;
        this.touchCurrent = null;

        // Three.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.ball = null;
        this.playerPaddle = null;
        this.opponentPaddle = null;

        // Game physics
        this.ballVelocity = new THREE.Vector3(0, 0, 0);
        this.gravity = -15;
        this.ballRadius = 0.15;

        // Court dimensions (meters)
        this.courtLength = 23.77;
        this.courtWidth = 10.97;
        this.netHeight = 0.914;

        // Player positions
        this.playerX = 0;
        this.opponentX = 0;
        this.playerSpeed = 8;
        this.opponentSpeed = 6;

        // Ball state
        this.ballInPlay = false;
        this.lastHitter = null;
        this.canHit = true;

        this.init();
        } catch (error) {
            console.error('Error initializing Tennis Game:', error);
            this.showError('Failed to initialize game: ' + error.message);
        }
    }

    showError(message) {
        const startScreen = document.getElementById('start-screen');
        if (startScreen) {
            startScreen.innerHTML = `
                <div class="start-content">
                    <h1>❌ Error</h1>
                    <p style="color: #ff6b6b; margin: 20px 0;">${message}</p>
                    <p style="font-size: 14px; color: #aaa;">Please refresh the page to try again.</p>
                    <button onclick="location.reload()" class="btn btn-large">Refresh</button>
                </div>
            `;
        }
        alert('Tennis Game Error: ' + message);
    }

    init() {
        try {
            console.log('Setting up Three.js scene...');
            this.setupThreeJS();

            console.log('Creating court...');
            this.createCourt();

            console.log('Creating ball...');
            this.createBall();

            console.log('Creating players...');
            this.createPaddles();

            console.log('Setting up lighting...');
            this.setupLighting();

            console.log('Setting up event listeners...');
            this.setupEventListeners();

            console.log('Resizing...');
            this.resize();

            console.log('Starting animation loop...');
            this.animate();

            console.log('✓ Tennis game initialized successfully!');

            // Show start button once loaded
            setTimeout(() => {
                const loadingIndicator = document.getElementById('loading-indicator');
                const startBtn = document.getElementById('start-btn');
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                if (startBtn) {
                    startBtn.style.display = 'block';
                    startBtn.style.animation = 'fadeIn 0.5s ease-in';
                }
            }, 500);
        } catch (error) {
            console.error('Error in init():', error);
            this.showError('Initialization failed: ' + error.message);
        }
    }

    setupThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 30, 60);

        // Add sky gradient effect
        const skyGeo = new THREE.SphereGeometry(100, 32, 15);
        const skyMat = new THREE.MeshBasicMaterial({
            color: 0x87CEEB,
            side: THREE.BackSide,
            fog: false
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);

        // Camera - third person view behind player
        this.camera = new THREE.PerspectiveCamera(
            70,
            1, // Square aspect ratio
            0.1,
            1000
        );
        this.camera.position.set(-3, 5, -this.courtLength / 2 - 3.5);
        this.camera.lookAt(-1, 1.5, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    createCourt() {
        // Main court surface - blue hard court
        const courtGeometry = new THREE.PlaneGeometry(this.courtWidth, this.courtLength);
        const courtMaterial = new THREE.MeshStandardMaterial({
            color: 0x1565C0, // Blue hard court
            roughness: 0.4,
            metalness: 0.3
        });
        const court = new THREE.Mesh(courtGeometry, courtMaterial);
        court.rotation.x = -Math.PI / 2;
        court.receiveShadow = true;
        this.scene.add(court);

        // Court border/surround (darker blue)
        const borderSize = 5;
        const borderGeometry = new THREE.PlaneGeometry(
            this.courtWidth + borderSize * 2,
            this.courtLength + borderSize * 2
        );
        const borderMaterial = new THREE.MeshStandardMaterial({
            color: 0x0D47A1,
            roughness: 0.6
        });
        const border = new THREE.Mesh(borderGeometry, borderMaterial);
        border.rotation.x = -Math.PI / 2;
        border.position.y = -0.01;
        border.receiveShadow = true;
        this.scene.add(border);

        // Court lines
        this.createCourtLines();

        // Net
        this.createNet();

        // Court branding/center logo
        this.createCourtLogo();

        // Stadium/fence elements
        this.createStadiumElements();

        // Add spectators
        this.createSpectators();

        // Surrounding ground (green)
        const groundGeometry = new THREE.PlaneGeometry(60, 60);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x2E7D32,
            roughness: 0.9
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.02;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    createCourtLines() {
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        const lineHeight = 0.02;
        const lineWidth = 0.05;

        // Baseline - player side
        const baseline1 = this.createLine(this.courtWidth, lineWidth, lineHeight);
        baseline1.position.set(0, lineHeight / 2, -this.courtLength / 2);
        this.scene.add(baseline1);

        // Baseline - opponent side
        const baseline2 = this.createLine(this.courtWidth, lineWidth, lineHeight);
        baseline2.position.set(0, lineHeight / 2, this.courtLength / 2);
        this.scene.add(baseline2);

        // Side lines
        const sideline1 = this.createLine(lineWidth, this.courtLength, lineHeight);
        sideline1.position.set(-this.courtWidth / 2, lineHeight / 2, 0);
        this.scene.add(sideline1);

        const sideline2 = this.createLine(lineWidth, this.courtLength, lineHeight);
        sideline2.position.set(this.courtWidth / 2, lineHeight / 2, 0);
        this.scene.add(sideline2);

        // Center service line
        const centerLine = this.createLine(lineWidth, this.courtLength / 2, lineHeight);
        centerLine.position.set(0, lineHeight / 2, -this.courtLength / 4);
        this.scene.add(centerLine);

        // Service lines
        const serviceLine1 = this.createLine(this.courtWidth, lineWidth, lineHeight);
        serviceLine1.position.set(0, lineHeight / 2, -this.courtLength / 4);
        this.scene.add(serviceLine1);

        const serviceLine2 = this.createLine(this.courtWidth, lineWidth, lineHeight);
        serviceLine2.position.set(0, lineHeight / 2, this.courtLength / 4);
        this.scene.add(serviceLine2);
    }

    createLine(width, depth, height) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        return new THREE.Mesh(geometry, material);
    }

    createCourtLogo() {
        // Center circle logo with tennis theme
        const logoGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
        const logoMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        const logo = new THREE.Mesh(logoGeometry, logoMaterial);
        logo.rotation.x = -Math.PI / 2;
        logo.position.set(0, 0.005, 0);
        this.scene.add(logo);

        // Inner circle
        const innerCircle = new THREE.Mesh(
            new THREE.CircleGeometry(0.7, 32),
            new THREE.MeshBasicMaterial({
                color: 0x0D47A1,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            })
        );
        innerCircle.rotation.x = -Math.PI / 2;
        innerCircle.position.set(0, 0.006, 0);
        this.scene.add(innerCircle);

        // Tennis ball icon in center
        const ballIconGeometry = new THREE.CircleGeometry(0.35, 20);
        const ballIconMaterial = new THREE.MeshBasicMaterial({
            color: 0xCCFF00,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const ballIcon = new THREE.Mesh(ballIconGeometry, ballIconMaterial);
        ballIcon.rotation.x = -Math.PI / 2;
        ballIcon.position.set(0, 0.007, 0);
        this.scene.add(ballIcon);

        // Add "TENNIS" text effect using simple geometry
        const textLineGeometry = new THREE.PlaneGeometry(2, 0.3);
        const textMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide
        });
        const textLine = new THREE.Mesh(textLineGeometry, textMaterial);
        textLine.rotation.x = -Math.PI / 2;
        textLine.position.set(0, 0.008, -this.courtLength / 4 - 1);
        this.scene.add(textLine);

        // Ball shadow (dynamic)
        const shadowGeometry = new THREE.CircleGeometry(this.ballRadius * 1.2, 16);
        const shadowMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        this.ballShadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        this.ballShadow.rotation.x = -Math.PI / 2;
        this.ballShadow.position.y = 0.02;
        this.scene.add(this.ballShadow);
    }

    createStadiumElements() {
        // Fencing around court
        const fenceHeight = 3;
        const fenceDistance = 8;
        const fenceMaterial = new THREE.MeshStandardMaterial({
            color: 0x2C5F2D,
            transparent: true,
            opacity: 0.7
        });

        // Back fences
        const backFenceGeometry = new THREE.PlaneGeometry(this.courtWidth + 10, fenceHeight);

        const playerBackFence = new THREE.Mesh(backFenceGeometry, fenceMaterial);
        playerBackFence.position.set(0, fenceHeight / 2, -this.courtLength / 2 - fenceDistance);
        this.scene.add(playerBackFence);

        const opponentBackFence = new THREE.Mesh(backFenceGeometry, fenceMaterial);
        opponentBackFence.position.set(0, fenceHeight / 2, this.courtLength / 2 + fenceDistance);
        opponentBackFence.rotation.y = Math.PI;
        this.scene.add(opponentBackFence);

        // Side fences
        const sideFenceGeometry = new THREE.PlaneGeometry(this.courtLength + fenceDistance * 2, fenceHeight);

        const leftFence = new THREE.Mesh(sideFenceGeometry, fenceMaterial);
        leftFence.position.set(-this.courtWidth / 2 - fenceDistance, fenceHeight / 2, 0);
        leftFence.rotation.y = Math.PI / 2;
        this.scene.add(leftFence);

        const rightFence = new THREE.Mesh(sideFenceGeometry, fenceMaterial);
        rightFence.position.set(this.courtWidth / 2 + fenceDistance, fenceHeight / 2, 0);
        rightFence.rotation.y = -Math.PI / 2;
        this.scene.add(rightFence);

        // Light poles (for atmosphere)
        const poleGeometry = new THREE.CylinderGeometry(0.15, 0.15, 12, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });

        const poles = [
            { x: -this.courtWidth / 2 - 10, z: -this.courtLength / 2 - 5 },
            { x: this.courtWidth / 2 + 10, z: -this.courtLength / 2 - 5 },
            { x: -this.courtWidth / 2 - 10, z: this.courtLength / 2 + 5 },
            { x: this.courtWidth / 2 + 10, z: this.courtLength / 2 + 5 }
        ];

        poles.forEach(pos => {
            const pole = new THREE.Mesh(poleGeometry, poleMaterial);
            pole.position.set(pos.x, 6, pos.z);
            pole.castShadow = true;
            this.scene.add(pole);

            // Light on top
            const lightGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.5);
            const lightMaterial = new THREE.MeshBasicMaterial({
                color: 0xFFFFAA,
                emissive: 0xFFFFAA,
                emissiveIntensity: 0.5
            });
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(pos.x, 12.2, pos.z);
            this.scene.add(light);
        });
    }

    createSpectators() {
        // Create crowd of spectators around the court
        const spectatorColors = [
            0xFF6B6B, 0x4ECDC4, 0x45B7D1, 0xFFA07A, 0x98D8C8,
            0xF7DC6F, 0xBB8FCE, 0x85C1E2, 0xF8B195, 0xC06C84
        ];

        // Behind player (closer view)
        this.createSpectatorRow(-this.courtLength / 2 - 8, 30, spectatorColors, 0);

        // Behind opponent
        this.createSpectatorRow(this.courtLength / 2 + 8, 35, spectatorColors, Math.PI);

        // Left side
        this.createSpectatorRow(-this.courtWidth / 2 - 8, 25, spectatorColors, Math.PI / 2, true);

        // Right side
        this.createSpectatorRow(this.courtWidth / 2 + 8, 25, spectatorColors, -Math.PI / 2, true);
    }

    createSpectatorRow(zPos, count, colors, rotation = 0, isSide = false) {
        const spectatorGroup = new THREE.Group();
        const spacing = isSide ? this.courtLength / count : this.courtWidth / count;
        const startPos = isSide ? -this.courtLength / 2 : -this.courtWidth / 2;

        for (let i = 0; i < count; i++) {
            const spectator = this.createSimpleSpectator(colors[i % colors.length]);

            if (isSide) {
                spectator.position.set(zPos, 0, startPos + i * spacing);
            } else {
                spectator.position.set(startPos + i * spacing, 0, zPos);
            }

            spectator.rotation.y = rotation + (Math.random() - 0.5) * 0.3;

            // Random slight position variation
            spectator.position.x += (Math.random() - 0.5) * 0.5;
            spectator.position.z += (Math.random() - 0.5) * 0.5;

            spectatorGroup.add(spectator);
        }

        this.scene.add(spectatorGroup);
    }

    createSimpleSpectator(shirtColor) {
        const spectator = new THREE.Group();

        // Body
        const bodyGeometry = new THREE.CylinderGeometry(0.15, 0.18, 0.6, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: shirtColor });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        body.castShadow = true;
        spectator.add(body);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.12, 8, 8);
        const skinTones = [0xFFDBB5, 0xE8B89A, 0xD4A574, 0x8D5524];
        const headMaterial = new THREE.MeshStandardMaterial({
            color: skinTones[Math.floor(Math.random() * skinTones.length)]
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.95;
        head.castShadow = true;
        spectator.add(head);

        // Arms (simplified)
        const armGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6);
        const armMaterial = new THREE.MeshStandardMaterial({
            color: skinTones[Math.floor(Math.random() * skinTones.length)]
        });

        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.2, 0.5, 0);
        leftArm.rotation.z = 0.3;
        spectator.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.2, 0.5, 0);
        rightArm.rotation.z = -0.3;
        spectator.add(rightArm);

        // Add slight random animation offset
        spectator.userData.animOffset = Math.random() * Math.PI * 2;

        return spectator;
    }

    createNet() {
        // Net posts (black)
        const postHeight = 1.07;
        const postGeometry = new THREE.CylinderGeometry(0.04, 0.04, postHeight);
        const postMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });

        const post1 = new THREE.Mesh(postGeometry, postMaterial);
        post1.position.set(-this.courtWidth / 2 - 0.5, postHeight / 2, 0);
        post1.castShadow = true;
        this.scene.add(post1);

        const post2 = new THREE.Mesh(postGeometry, postMaterial);
        post2.position.set(this.courtWidth / 2 + 0.5, postHeight / 2, 0);
        post2.castShadow = true;
        this.scene.add(post2);

        // Net - create actual mesh pattern
        const netWidth = this.courtWidth + 1;
        const netGroup = new THREE.Group();

        // White top band
        const bandGeometry = new THREE.BoxGeometry(netWidth, 0.08, 0.02);
        const bandMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
        const topBand = new THREE.Mesh(bandGeometry, bandMaterial);
        topBand.position.y = this.netHeight;
        netGroup.add(topBand);

        // Net mesh material
        const netMaterial = new THREE.MeshBasicMaterial({
            color: 0xCCCCCC,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });

        // Create grid pattern for net
        const gridSize = 0.15;
        const horizontalLines = Math.floor(this.netHeight / gridSize);
        const verticalLines = Math.floor(netWidth / gridSize);

        // Horizontal strings
        for (let i = 0; i <= horizontalLines; i++) {
            const lineGeometry = new THREE.BoxGeometry(netWidth, 0.01, 0.01);
            const line = new THREE.Mesh(lineGeometry, netMaterial);
            line.position.y = (i * gridSize);
            netGroup.add(line);
        }

        // Vertical strings
        for (let i = 0; i <= verticalLines; i++) {
            const lineGeometry = new THREE.BoxGeometry(0.01, this.netHeight, 0.01);
            const line = new THREE.Mesh(lineGeometry, netMaterial);
            line.position.x = -netWidth / 2 + (i * gridSize);
            line.position.y = this.netHeight / 2;
            netGroup.add(line);
        }

        this.scene.add(netGroup);
    }

    createBall() {
        const ballGeometry = new THREE.SphereGeometry(this.ballRadius, 20, 20);
        const ballMaterial = new THREE.MeshStandardMaterial({
            color: 0xCCFF00, // Tennis ball yellow-green
            roughness: 0.7,
            metalness: 0.0,
            emissive: 0x334400,
            emissiveIntensity: 0.1
        });
        this.ball = new THREE.Mesh(ballGeometry, ballMaterial);
        this.ball.castShadow = true;
        this.ball.receiveShadow = true;
        this.ball.position.set(0, 1, -this.courtLength / 2 + 2);

        // Add curved lines on ball (simplified tennis ball pattern)
        const lineGeometry = new THREE.TorusGeometry(this.ballRadius * 0.95, 0.008, 8, 32);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

        const line1 = new THREE.Mesh(lineGeometry, lineMaterial);
        line1.rotation.x = Math.PI / 2;
        line1.rotation.z = Math.PI / 6;
        this.ball.add(line1);

        const line2 = new THREE.Mesh(lineGeometry, lineMaterial);
        line2.rotation.x = Math.PI / 2;
        line2.rotation.z = -Math.PI / 6;
        this.ball.add(line2);

        this.scene.add(this.ball);

        // Hit indicator ring (shows when you can hit)
        const ringGeometry = new THREE.TorusGeometry(0.5, 0.05, 8, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00FF00,
            transparent: true,
            opacity: 0
        });
        this.hitIndicator = new THREE.Mesh(ringGeometry, ringMaterial);
        this.hitIndicator.rotation.x = -Math.PI / 2;
        this.scene.add(this.hitIndicator);
    }

    createPlayer(color, isPlayer = true) {
        const playerGroup = new THREE.Group();

        // Body colors
        const skinColor = 0xFFDBB5;
        const shirtColor = color;
        const shortsColor = 0x000033;
        const shoeColor = 0xFFFFFF;
        const hairColor = 0x442211;

        // Head
        const headGeometry = new THREE.SphereGeometry(0.2, 20, 20);
        const headMaterial = new THREE.MeshStandardMaterial({ color: skinColor });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.7;
        head.castShadow = true;
        playerGroup.add(head);

        // Hair
        const hairGeometry = new THREE.SphereGeometry(0.21, 16, 16);
        const hairMaterial = new THREE.MeshStandardMaterial({ color: hairColor });
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        hair.position.y = 1.78;
        hair.scale.set(1, 0.5, 1);
        hair.castShadow = true;
        playerGroup.add(hair);

        // Headband (tennis player accessory)
        const headbandGeometry = new THREE.TorusGeometry(0.19, 0.02, 8, 20);
        const headbandMaterial = new THREE.MeshStandardMaterial({
            color: isPlayer ? 0xFFFFFF : 0x000000
        });
        const headband = new THREE.Mesh(headbandGeometry, headbandMaterial);
        headband.position.y = 1.72;
        headband.rotation.x = Math.PI / 2;
        headband.castShadow = true;
        playerGroup.add(headband);

        // Eyes (simple dots)
        const eyeGeometry = new THREE.SphereGeometry(0.02, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.06, 1.68, 0.15);
        playerGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.06, 1.68, 0.15);
        playerGroup.add(rightEye);

        // Neck
        const neckGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.15, 12);
        const neck = new THREE.Mesh(neckGeometry, headMaterial);
        neck.position.y = 1.5;
        neck.castShadow = true;
        playerGroup.add(neck);

        // Torso
        const torsoGeometry = new THREE.BoxGeometry(0.5, 0.7, 0.3);
        const torsoMaterial = new THREE.MeshStandardMaterial({ color: shirtColor });
        const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
        torso.position.y = 1.05;
        torso.castShadow = true;
        playerGroup.add(torso);

        // Waist
        const waistGeometry = new THREE.CylinderGeometry(0.23, 0.25, 0.15, 12);
        const waistMaterial = new THREE.MeshStandardMaterial({ color: shortsColor });
        const waist = new THREE.Mesh(waistGeometry, waistMaterial);
        waist.position.y = 0.63;
        waist.castShadow = true;
        playerGroup.add(waist);

        // Shorts
        const shortsGeometry = new THREE.CylinderGeometry(0.25, 0.22, 0.25, 12);
        const shorts = new THREE.Mesh(shortsGeometry, waistMaterial);
        shorts.position.y = 0.48;
        shorts.castShadow = true;
        playerGroup.add(shorts);

        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.09, 0.08, 0.45, 12);
        const legMaterial = new THREE.MeshStandardMaterial({ color: skinColor });

        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.12, 0.225, 0);
        leftLeg.castShadow = true;
        playerGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.12, 0.225, 0);
        rightLeg.castShadow = true;
        playerGroup.add(rightLeg);

        // Shoes
        const shoeGeometry = new THREE.BoxGeometry(0.14, 0.1, 0.25);
        const shoeMaterial = new THREE.MeshStandardMaterial({ color: shoeColor });

        const leftShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
        leftShoe.position.set(-0.12, 0.05, 0.05);
        leftShoe.castShadow = true;
        playerGroup.add(leftShoe);

        const rightShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
        rightShoe.position.set(0.12, 0.05, 0.05);
        rightShoe.castShadow = true;
        playerGroup.add(rightShoe);

        // LEFT ARM (non-racket arm)
        const leftArmGroup = new THREE.Group();

        // Upper arm
        const upperArmGeometry = new THREE.CylinderGeometry(0.06, 0.055, 0.35, 10);
        const armMaterial = new THREE.MeshStandardMaterial({ color: skinColor });
        const leftUpperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
        leftUpperArm.position.y = -0.175;
        leftUpperArm.castShadow = true;
        leftArmGroup.add(leftUpperArm);

        // Forearm
        const forearmGeometry = new THREE.CylinderGeometry(0.055, 0.05, 0.3, 10);
        const leftForearm = new THREE.Mesh(forearmGeometry, armMaterial);
        leftForearm.position.y = -0.5;
        leftForearm.castShadow = true;
        leftArmGroup.add(leftForearm);

        // Hand
        const handGeometry = new THREE.SphereGeometry(0.06, 8, 8);
        const leftHand = new THREE.Mesh(handGeometry, armMaterial);
        leftHand.position.y = -0.7;
        leftHand.scale.set(0.8, 1, 0.6);
        leftHand.castShadow = true;
        leftArmGroup.add(leftHand);

        leftArmGroup.position.set(-0.28, 1.35, 0);
        leftArmGroup.rotation.z = 0.3;
        playerGroup.add(leftArmGroup);

        // RIGHT ARM (racket arm) - with full animation support
        const rightArmGroup = new THREE.Group();

        const rightUpperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
        rightUpperArm.position.y = -0.175;
        rightUpperArm.castShadow = true;
        rightArmGroup.add(rightUpperArm);

        const rightForearm = new THREE.Mesh(forearmGeometry, armMaterial);
        rightForearm.position.y = -0.5;
        rightForearm.castShadow = true;
        rightArmGroup.add(rightForearm);

        const rightHand = new THREE.Mesh(handGeometry, armMaterial);
        rightHand.position.y = -0.7;
        rightHand.scale.set(0.8, 1, 0.6);
        rightHand.castShadow = true;
        rightArmGroup.add(rightHand);

        // RACKET - attached to hand
        const racket = this.createRacket();
        racket.position.set(0, -0.9, 0);
        racket.rotation.x = Math.PI / 3;
        racket.castShadow = true;
        rightArmGroup.add(racket);

        rightArmGroup.position.set(0.28, 1.35, 0);
        rightArmGroup.rotation.z = -0.3;
        rightArmGroup.rotation.x = -0.2;
        playerGroup.add(rightArmGroup);

        // Wristbands (add after arm groups are created)
        const wristbandGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.08, 10);
        const wristbandMaterial = new THREE.MeshStandardMaterial({
            color: isPlayer ? 0xFF5722 : 0x2196F3
        });

        const leftWristband = new THREE.Mesh(wristbandGeometry, wristbandMaterial);
        leftWristband.position.y = -0.55;
        leftWristband.castShadow = true;
        leftArmGroup.add(leftWristband);

        const rightWristband = new THREE.Mesh(wristbandGeometry, wristbandMaterial);
        rightWristband.position.y = -0.55;
        rightWristband.castShadow = true;
        rightArmGroup.add(rightWristband);

        // Store references
        playerGroup.userData.rightArm = rightArmGroup;
        playerGroup.userData.leftArm = leftArmGroup;
        playerGroup.userData.racket = racket;
        playerGroup.userData.isSwinging = false;
        playerGroup.userData.swingTime = 0;
        playerGroup.userData.legs = { left: leftLeg, right: rightLeg };
        playerGroup.userData.moveTime = 0;
        playerGroup.userData.isMoving = false;

        return playerGroup;
    }

    createRacket() {
        const racketGroup = new THREE.Group();

        // Handle grip (dark brown/black)
        const handleGeometry = new THREE.CylinderGeometry(0.022, 0.026, 0.28, 12);
        const handleMaterial = new THREE.MeshStandardMaterial({
            color: 0x1A1A1A,
            roughness: 0.7
        });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.castShadow = true;
        racketGroup.add(handle);

        // Throat/neck of racket
        const neckGeometry = new THREE.CylinderGeometry(0.018, 0.025, 0.08, 8);
        const neckMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF6600,
            roughness: 0.4,
            metalness: 0.3
        });
        const neck = new THREE.Mesh(neckGeometry, neckMaterial);
        neck.position.y = 0.18;
        neck.castShadow = true;
        racketGroup.add(neck);

        // Racket head frame (ellipse shape)
        const headGeometry = new THREE.TorusGeometry(0.16, 0.018, 12, 20);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF6600,
            roughness: 0.4,
            metalness: 0.3
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.32;
        head.rotation.x = Math.PI / 2;
        head.scale.set(0.8, 1.1, 1);
        head.castShadow = true;
        racketGroup.add(head);

        // String bed (crosshatch pattern)
        const stringsGroup = new THREE.Group();
        const stringMaterial = new THREE.MeshBasicMaterial({
            color: 0xEEEEEE,
            transparent: true,
            opacity: 0.8
        });

        // Vertical strings
        for (let i = -6; i <= 6; i++) {
            const stringGeometry = new THREE.BoxGeometry(0.005, 0.28, 0.005);
            const string = new THREE.Mesh(stringGeometry, stringMaterial);
            string.position.set(i * 0.02, 0, 0);
            stringsGroup.add(string);
        }

        // Horizontal strings
        for (let i = -7; i <= 7; i++) {
            const stringGeometry = new THREE.BoxGeometry(0.24, 0.005, 0.005);
            const string = new THREE.Mesh(stringGeometry, stringMaterial);
            string.position.set(0, i * 0.02, 0);
            stringsGroup.add(string);
        }

        stringsGroup.position.y = 0.32;
        stringsGroup.rotation.x = Math.PI / 2;
        stringsGroup.scale.set(0.8, 1.1, 1);
        racketGroup.add(stringsGroup);

        return racketGroup;
    }

    createPaddles() {
        // Create player (you) - red/orange shirt
        this.playerPaddle = this.createPlayer(0xFF5722, true);
        this.playerPaddle.position.set(0, 0, -this.courtLength / 2 + 2);
        this.scene.add(this.playerPaddle);

        // Create opponent (CPU) - blue shirt
        this.opponentPaddle = this.createPlayer(0x2196F3, false);
        this.opponentPaddle.position.set(0, 0, this.courtLength / 2 - 2);
        this.opponentPaddle.rotation.y = Math.PI; // Face toward player
        this.scene.add(this.opponentPaddle);
    }

    setupLighting() {
        // Ambient light - soft overall illumination
        const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5);
        this.scene.add(ambientLight);

        // Main directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xFFFFF0, 1.0);
        sunLight.position.set(15, 25, 10);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.left = -25;
        sunLight.shadow.camera.right = 25;
        sunLight.shadow.camera.top = 25;
        sunLight.shadow.camera.bottom = -25;
        sunLight.shadow.camera.near = 0.1;
        sunLight.shadow.camera.far = 100;
        sunLight.shadow.bias = -0.0001;
        this.scene.add(sunLight);

        // Hemisphere light for more realistic outdoor lighting
        const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x2E7D32, 0.4);
        this.scene.add(hemiLight);

        // Fill light - softer, opposite side
        const fillLight = new THREE.DirectionalLight(0xFFFFFF, 0.3);
        fillLight.position.set(-10, 15, -5);
        this.scene.add(fillLight);
    }

    setupEventListeners() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === ' ' && this.gameState === 'playing') {
                e.preventDefault();
                this.hitBall();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // Touch controls - improved for mobile
        this.touchActive = false;
        this.touchStartTime = 0;

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;

            this.touchStart = { x: touchX, y: touch.clientY };
            this.touchCurrent = { x: touchX, y: touch.clientY };
            this.touchActive = true;
            this.touchStartTime = Date.now();
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.touchActive) {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const touchX = touch.clientX - rect.left;
                this.touchCurrent = { x: touchX, y: touch.clientY };
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();

            if (this.gameState === 'playing' && this.touchStart && this.touchActive) {
                const touchDuration = Date.now() - this.touchStartTime;
                const deltaX = Math.abs(this.touchCurrent.x - this.touchStart.x);
                const deltaY = Math.abs(this.touchCurrent.y - this.touchStart.y);

                // Quick tap (less than 200ms and small movement) = hit ball
                if (touchDuration < 200 && deltaX < 20 && deltaY < 20) {
                    this.hitBall();
                }
            }

            this.touchActive = false;
            this.touchStart = null;
            this.touchCurrent = null;
        }, { passive: false });

        // Prevent default touch behaviors on the game container
        this.gameContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
        }, { passive: false });

        this.gameContainer.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });

        // Mouse click to hit
        this.canvas.addEventListener('click', () => {
            if (this.gameState === 'playing') {
                this.hitBall();
            }
        });

        // UI buttons
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            // Add both click and touchend for better mobile support
            startBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Start button clicked');
                this.startGame();
            });

            startBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                console.log('Start button touched');
                this.startGame();
            }, { passive: false });
        }

        document.getElementById('settings-btn').addEventListener('click', () => {
            this.openSettings();
        });

        document.getElementById('close-settings-btn').addEventListener('click', () => {
            this.closeSettings();
        });

        document.getElementById('pause-btn').addEventListener('click', () => {
            this.togglePause();
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.restartGame();
        });

        // Settings changes
        document.getElementById('auto-aim-toggle').addEventListener('change', (e) => {
            this.settings.autoAim = e.target.checked;
        });

        document.getElementById('auto-timing-toggle').addEventListener('change', (e) => {
            this.settings.autoTiming = e.target.checked;
        });

        document.getElementById('movement-assist-toggle').addEventListener('change', (e) => {
            this.settings.movementAssist = e.target.checked;
        });

        document.getElementById('difficulty-select').addEventListener('change', (e) => {
            this.settings.difficulty = e.target.value;
            this.updateDifficulty();
        });

        document.getElementById('sound-toggle').addEventListener('change', (e) => {
            this.settings.soundEnabled = e.target.checked;
        });

        // Window resize
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const container = this.gameContainer;
        const size = Math.min(container.clientWidth, container.clientHeight);

        this.renderer.setSize(size, size);
        this.camera.aspect = 1;
        this.camera.updateProjectionMatrix();
    }

    startGame() {
        document.getElementById('start-screen').classList.add('hidden');
        this.gameState = 'playing';
        this.resetBall();
        this.showMessage('Get Ready!', 2000);

        // Hide touch hint after 3 seconds
        setTimeout(() => {
            const hint = document.getElementById('touch-hint');
            if (hint) {
                hint.style.opacity = '0';
                hint.style.transition = 'opacity 0.5s';
                setTimeout(() => hint.style.display = 'none', 500);
            }
        }, 3000);

        setTimeout(() => {
            this.serveBall();
        }, 2000);
    }

    restartGame() {
        this.playerScore = 0;
        this.opponentScore = 0;
        this.updateScore();
        this.closeSettings();
        this.gameState = 'playing';
        this.resetBall();
        this.showMessage('Game Restarted!', 1500);
        setTimeout(() => {
            this.serveBall();
        }, 1500);
    }

    openSettings() {
        this.gameState = 'paused';
        document.getElementById('settings-modal').classList.remove('hidden');
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
        if (this.playerScore < this.winningScore && this.opponentScore < this.winningScore) {
            this.gameState = 'playing';
        }
    }

    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            this.showMessage('PAUSED', 0);
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.hideMessage();
        }
    }

    updateDifficulty() {
        switch (this.settings.difficulty) {
            case 'easy':
                this.opponentSpeed = 5;
                break;
            case 'medium':
                this.opponentSpeed = 7;
                break;
            case 'hard':
                this.opponentSpeed = 10;
                break;
        }
    }

    serveBall() {
        this.ballInPlay = true;
        this.lastHitter = 'opponent';
        this.canHit = false; // Player can't hit during serve
        this.ballBounceTime = Date.now();

        // Serve from opponent - start at higher position
        this.ball.position.set(
            (Math.random() - 0.5) * 2,
            2.5,
            this.courtLength / 2 - 2
        );

        // Calculate serve velocity to ensure it clears the net
        const targetX = (Math.random() - 0.5) * (this.courtWidth * 0.5);
        const targetZ = -this.courtLength / 4; // Land in player's service box

        const distance = Math.sqrt(
            Math.pow(targetX - this.ball.position.x, 2) +
            Math.pow(targetZ - this.ball.position.z, 2)
        );

        // Calculate time to reach target (accounting for gravity)
        const time = 1.2;
        const velocityZ = (targetZ - this.ball.position.z) / time;
        const velocityX = (targetX - this.ball.position.x) / time;
        const velocityY = -0.5 * this.gravity * time; // Account for gravity

        this.ballVelocity.set(velocityX, velocityY, velocityZ);

        // Enable hitting after ball crosses the net toward player
        setTimeout(() => {
            this.canHit = true;
        }, 800);
    }

    resetBall() {
        this.ballInPlay = false;
        this.ball.position.set(0, 1, -this.courtLength / 2 + 2);
        this.ballVelocity.set(0, 0, 0);
        this.canHit = true;

        // Clear ball trail
        if (this.ballTrail) {
            this.ballTrail.forEach(trail => this.scene.remove(trail.mesh));
            this.ballTrail = [];
        }
    }

    createHitEffect(position) {
        // Create particle burst effect when ball is hit
        const particleCount = 8;
        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.05, 4, 4);
            const material = new THREE.MeshBasicMaterial({
                color: 0xFFFFFF,
                transparent: true,
                opacity: 0.8
            });
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);

            const angle = (i / particleCount) * Math.PI * 2;
            particle.userData.velocity = new THREE.Vector3(
                Math.cos(angle) * 2,
                Math.random() * 2 + 1,
                Math.sin(angle) * 2
            );
            particle.userData.life = 1.0;

            this.scene.add(particle);
            particles.push(particle);
        }

        // Animate and remove particles
        const animateParticles = () => {
            let allDead = true;
            particles.forEach(particle => {
                if (particle.userData.life > 0) {
                    allDead = false;
                    particle.position.add(particle.userData.velocity.clone().multiplyScalar(0.016));
                    particle.userData.velocity.y -= 0.2;
                    particle.userData.life -= 0.05;
                    particle.material.opacity = particle.userData.life * 0.8;
                    particle.scale.setScalar(particle.userData.life);
                }
            });

            if (!allDead) {
                requestAnimationFrame(animateParticles);
            } else {
                particles.forEach(p => this.scene.remove(p));
            }
        };
        animateParticles();
    }

    hitBall() {
        if (!this.canHit || !this.ballInPlay || this.gameState !== 'playing') return;

        // Only hit if it's not already your ball
        if (this.lastHitter === 'player') return;

        // More forgiving hit detection - wider range for forehand/backhand
        const distToPaddle = this.ball.position.distanceTo(this.playerPaddle.position);
        const maxHitDistance = this.settings.autoTiming ? 3.5 : 3.0; // Much wider range

        // Allow hits from more positions - not just in front
        const playerZ = this.playerPaddle.position.z;
        const ballZ = this.ball.position.z;
        const zDiff = ballZ - playerZ;

        // Can hit ball if it's in front, beside, or slightly behind (realistic tennis)
        const isInReachZ = zDiff < 3 && zDiff > -2; // Wide Z range

        // More forgiving height range - can hit low balls and overhead
        const isRightHeight = this.ball.position.y > 0.2 && this.ball.position.y < 4.0;

        // Allow hitting balls moving in any direction (not just toward player)
        const isInPlay = this.ball.position.z < -this.courtLength / 4 + 5;

        if (distToPaddle < maxHitDistance && isInReachZ && isRightHeight && isInPlay) {
            this.canHit = false;
            this.lastHitter = 'player';
            this.ballBounceTime = Date.now(); // Reset bounce timer

            // Trigger swing animation
            this.playerPaddle.userData.isSwinging = true;
            this.playerPaddle.userData.swingTime = 0;

            // Create hit effect
            this.createHitEffect(this.ball.position.clone());

            // Calculate hit direction with proper trajectory
            let targetX = (Math.random() - 0.5) * (this.courtWidth * 0.7);
            let targetZ = this.courtLength / 2 - 3;

            if (this.settings.autoAim) {
                // Auto-aim toward opponent's court
                targetX = (Math.random() - 0.5) * (this.courtWidth * 0.5);
            }

            // Calculate trajectory that WILL clear the net
            const deltaX = targetX - this.ball.position.x;
            const deltaZ = targetZ - this.ball.position.z;
            const horizontalDist = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);

            // Time to reach target (faster = flatter trajectory)
            const flightTime = 1.0 + Math.random() * 0.3;

            // Calculate velocities to reach target
            const velocityX = deltaX / flightTime;
            const velocityZ = deltaZ / flightTime;

            // Calculate Y velocity to reach peak height that clears net
            // Net is at z=0, ball needs to be at least netHeight + 0.5m when crossing
            const netClearanceHeight = this.netHeight + 0.8; // 0.8m above net
            const currentHeight = this.ball.position.y;

            // Ensure ball reaches good height over net
            const peakHeight = Math.max(netClearanceHeight, currentHeight + 2);
            const velocityY = Math.sqrt(2 * Math.abs(this.gravity) * (peakHeight - currentHeight));

            this.ballVelocity.set(velocityX, velocityY, velocityZ);

            this.playSound('hit');

            setTimeout(() => {
                this.canHit = true;
            }, 600);
        }
    }

    opponentHit() {
        if (this.lastHitter === 'opponent') return;

        // Check if ball is in opponent's hitting range
        const distToPaddle = this.ball.position.distanceTo(this.opponentPaddle.position);
        const isInFrontOfOpponent = this.ball.position.z > this.courtLength / 4 - 2;
        const isRightHeight = this.ball.position.y > 0.3 && this.ball.position.y < 3;

        if (distToPaddle < 2.0 && isInFrontOfOpponent && isRightHeight) {
            this.lastHitter = 'opponent';
            this.ballBounceTime = Date.now(); // Reset bounce timer

            // Trigger swing animation
            this.opponentPaddle.userData.isSwinging = true;
            this.opponentPaddle.userData.swingTime = 0;

            // Create hit effect
            this.createHitEffect(this.ball.position.clone());

            // AI aims based on difficulty
            let targetX;
            const difficulty = this.settings.difficulty;

            if (difficulty === 'easy') {
                // Easy: Aim somewhat near player
                targetX = this.playerX + (Math.random() - 0.5) * 5;
            } else if (difficulty === 'medium') {
                // Medium: Aim closer to player
                targetX = this.playerX + (Math.random() - 0.5) * 3;
            } else {
                // Hard: Aim away from player (strategic)
                const side = this.playerX > 0 ? -1 : 1;
                targetX = side * (this.courtWidth * 0.35) + (Math.random() - 0.5);
            }

            const targetZ = -this.courtLength / 2 + 3;

            // Calculate proper trajectory that clears net
            const deltaX = targetX - this.ball.position.x;
            const deltaZ = targetZ - this.ball.position.z;

            const flightTime = difficulty === 'hard' ? 0.9 : (difficulty === 'medium' ? 1.0 : 1.2);

            const velocityX = deltaX / flightTime;
            const velocityZ = deltaZ / flightTime;

            const netClearanceHeight = this.netHeight + 1.0;
            const currentHeight = this.ball.position.y;
            const peakHeight = Math.max(netClearanceHeight, currentHeight + 2.5);
            const velocityY = Math.sqrt(2 * Math.abs(this.gravity) * (peakHeight - currentHeight));

            this.ballVelocity.set(velocityX, velocityY, velocityZ);

            this.playSound('hit');
        }
    }

    updatePhysics(deltaTime) {
        if (!this.ballInPlay || this.gameState !== 'playing') return;

        // Apply gravity
        this.ballVelocity.y += this.gravity * deltaTime;

        // Update ball position
        this.ball.position.add(this.ballVelocity.clone().multiplyScalar(deltaTime));

        // Create ball trail when moving fast
        if (this.ballVelocity.length() > 5) {
            this.createBallTrail();
        }

        // Ball rotation for visual effect
        this.ball.rotation.x += this.ballVelocity.z * deltaTime * 2;
        this.ball.rotation.z -= this.ballVelocity.x * deltaTime * 2;

        // Update ball shadow position and size
        if (this.ballShadow) {
            this.ballShadow.position.x = this.ball.position.x;
            this.ballShadow.position.z = this.ball.position.z;

            // Shadow size and opacity based on height
            const heightFactor = Math.max(0.2, 1 - this.ball.position.y / 10);
            this.ballShadow.scale.setScalar(heightFactor);
            this.ballShadow.material.opacity = heightFactor * 0.4;
        }

        // Collision with ground
        if (this.ball.position.y <= this.ballRadius) {
            this.ball.position.y = this.ballRadius;
            this.ballVelocity.y *= -0.7; // Bounce with energy loss

            this.playSound('bounce');

            // Check if ball is out of bounds
            this.checkBallOut();
        }

        // Side boundaries bounce
        if (Math.abs(this.ball.position.x) > this.courtWidth / 2) {
            this.ball.position.x = Math.sign(this.ball.position.x) * this.courtWidth / 2;
            this.ballVelocity.x *= -0.8;
        }

        // Net collision
        if (Math.abs(this.ball.position.z) < 0.3 && this.ball.position.y < this.netHeight) {
            this.ballVelocity.z *= -0.5;
            this.ballVelocity.y *= 0.5;
            this.playSound('bounce');
        }

        // Check for opponent AI hit
        this.opponentHit();
    }

    checkBallOut() {
        const x = this.ball.position.x;
        const z = this.ball.position.z;

        // Only check after ball has been in play for at least 0.5 seconds
        if (!this.ballBounceTime) this.ballBounceTime = Date.now();
        const timeSinceLaunch = Date.now() - this.ballBounceTime;

        if (timeSinceLaunch < 500) {
            return; // Too soon, let the ball fly
        }

        // Ball bounced outside court side boundaries (left/right)
        if (Math.abs(x) > this.courtWidth / 2) {
            if (this.lastHitter === 'player') {
                this.opponentScore++;
                this.showMessage('Out! CPU Point', 1500);
                this.crowdReact(false);
            } else {
                this.playerScore++;
                this.showMessage('Out! Your Point', 1500);
                this.crowdReact(true);
            }
            this.updateScore();
            this.checkWin();
            this.ballBounceTime = null;
            return;
        }

        // Ball bounced past player's baseline (too far back on player's side)
        if (z < -this.courtLength / 2 && this.lastHitter === 'opponent') {
            this.opponentScore++;
            this.showMessage('CPU Point!', 1500);
            this.crowdReact(false);
            this.updateScore();
            this.checkWin();
            this.ballBounceTime = null;
            return;
        }

        // Ball bounced past opponent's baseline (too far back on opponent's side)
        if (z > this.courtLength / 2 && this.lastHitter === 'player') {
            this.playerScore++;
            this.showMessage('Your Point!', 1500);
            this.crowdReact(true);
            this.updateScore();
            this.checkWin();
            this.ballBounceTime = null;
            return;
        }
    }

    crowdReact(playerScored) {
        // Visual crowd reaction
        // In a full implementation, this would animate spectators
        // For now, we can add a sound cue or visual effect
        if (this.settings.soundEnabled) {
            this.playCrowdSound(playerScored);
        }
    }

    playCrowdSound(isCheer) {
        if (!this.settings.soundEnabled) return;

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (isCheer) {
            // Happy crowd sound (higher pitch noise burst)
            oscillator.frequency.value = 800 + Math.random() * 400;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        } else {
            // Disappointed sound (lower rumble)
            oscillator.frequency.value = 200 + Math.random() * 100;
            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        }

        oscillator.type = 'sawtooth';
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    }

    checkWin() {
        if (this.playerScore >= this.winningScore) {
            this.gameState = 'gameOver';
            this.showMessage('You Win! 🎉', 0);
            setTimeout(() => {
                this.restartGame();
            }, 3000);
        } else if (this.opponentScore >= this.winningScore) {
            this.gameState = 'gameOver';
            this.showMessage('CPU Wins!', 0);
            setTimeout(() => {
                this.restartGame();
            }, 3000);
        } else {
            // Continue game
            setTimeout(() => {
                this.resetBall();
                this.serveBall();
            }, 1500);
        }
    }

    updateScore() {
        const playerScoreEl = document.getElementById('player-score');
        const opponentScoreEl = document.getElementById('opponent-score');

        playerScoreEl.textContent = this.playerScore;
        opponentScoreEl.textContent = this.opponentScore;

        // Add animation class
        playerScoreEl.style.animation = 'none';
        opponentScoreEl.style.animation = 'none';

        setTimeout(() => {
            playerScoreEl.style.animation = 'scoreUpdate 0.5s ease-out';
            opponentScoreEl.style.animation = 'scoreUpdate 0.5s ease-out';
        }, 10);
    }

    showMessage(text, duration = 0) {
        const messageEl = document.getElementById('game-message');
        messageEl.textContent = text;
        messageEl.classList.add('show');

        if (duration > 0) {
            setTimeout(() => {
                this.hideMessage();
            }, duration);
        }
    }

    hideMessage() {
        document.getElementById('game-message').classList.remove('show');
    }

    playSound(type) {
        if (!this.settings.soundEnabled) return;

        // Create simple beep sounds using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'hit') {
            oscillator.frequency.value = 440;
            gainNode.gain.value = 0.1;
        } else if (type === 'bounce') {
            oscillator.frequency.value = 220;
            gainNode.gain.value = 0.05;
        }

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    updatePlayerMovement(deltaTime) {
        if (this.gameState !== 'playing') return;

        let moveX = 0;
        let targetX = null;

        // Keyboard input - FIXED: Inverted to match camera perspective
        if (this.keys['arrowleft'] || this.keys['a']) {
            moveX = 1; // Move right in world space (left on screen)
        }
        if (this.keys['arrowright'] || this.keys['d']) {
            moveX = -1; // Move left in world space (right on screen)
        }

        // Touch input - map touch position to player position
        if (this.touchActive && this.touchCurrent) {
            const rect = this.canvas.getBoundingClientRect();
            const canvasWidth = rect.width;

            // Convert touch X to normalized position (-1 to 1)
            const normalizedX = (this.touchCurrent.x / canvasWidth) * 2 - 1;

            // Map to court width (inverted because of camera angle)
            targetX = -normalizedX * (this.courtWidth / 2 - 0.5);
        }

        // Movement assist
        if (this.settings.movementAssist && this.ballInPlay && this.lastHitter === 'opponent' && !this.touchActive) {
            const ballTargetX = this.ball.position.x;
            const distToBall = ballTargetX - this.playerX;

            if (Math.abs(distToBall) > 0.5 && this.ball.position.z < 0) {
                moveX -= Math.sign(distToBall) * 0.3; // Inverted
            }
        }

        // Apply movement
        if (targetX !== null) {
            // Faster, more responsive touch movement
            const diff = targetX - this.playerX;
            const distance = Math.abs(diff);

            // Use faster interpolation for more responsive feel
            if (distance > 0.1) {
                // Move faster when far from target
                const speed = Math.min(distance * 8, this.playerSpeed * 1.5);
                this.playerX += Math.sign(diff) * speed * deltaTime;
            } else {
                // Snap to position when very close (prevents sliding)
                this.playerX = targetX;
            }
        } else {
            // Keyboard/assist movement - crisp and responsive
            if (moveX !== 0) {
                this.playerX += moveX * this.playerSpeed * deltaTime;
            }
            // No movement assist or input = stop immediately (no sliding)
        }

        // Clamp to court bounds
        const oldX = this.playerX;
        this.playerX = Math.max(-this.courtWidth / 2 + 0.5, Math.min(this.courtWidth / 2 - 0.5, this.playerX));

        this.playerPaddle.position.x = this.playerX;

        // Detect if player is moving for animation
        const movementSpeed = Math.abs(this.playerX - oldX) / deltaTime;
        this.playerPaddle.userData.isMoving = movementSpeed > 0.5;
    }

    updateOpponentMovement(deltaTime) {
        if (this.gameState !== 'playing' || !this.ballInPlay) return;

        let targetX = this.opponentX;

        // AI behavior based on ball position
        if (this.ball.position.z > -2) {
            // Ball is on opponent's side or near center
            targetX = this.ball.position.x;

            // Add some prediction based on difficulty
            if (this.settings.difficulty === 'hard') {
                // Predict where ball will land
                targetX += this.ballVelocity.x * 0.3;
            } else if (this.settings.difficulty === 'medium') {
                targetX += this.ballVelocity.x * 0.15;
            }
        } else {
            // Ball is on player's side, return to center
            targetX = 0;
        }

        const diff = targetX - this.opponentX;
        const oldX = this.opponentX;

        if (Math.abs(diff) > 0.3) {
            const moveAmount = Math.sign(diff) * this.opponentSpeed * deltaTime;
            this.opponentX += moveAmount;
        }

        this.opponentX = Math.max(-this.courtWidth / 2 + 0.5, Math.min(this.courtWidth / 2 - 0.5, this.opponentX));
        this.opponentPaddle.position.x = this.opponentX;

        // Detect opponent movement for animation
        const movementSpeed = Math.abs(this.opponentX - oldX) / deltaTime;
        this.opponentPaddle.userData.isMoving = movementSpeed > 0.5;
    }

    updateCamera() {
        // Smooth camera follow - third person view
        const targetX = -3 - this.playerX * 0.4;
        const targetZ = -this.courtLength / 2 - 3.5;

        // Faster camera follow to reduce lag
        this.camera.position.x += (targetX - this.camera.position.x) * 0.15;
        this.camera.position.z += (targetZ - this.camera.position.z) * 0.08;

        // Look at player position and forward
        const lookAtX = -1 - this.playerX * 0.3;
        const lookAtY = 1.5;
        const lookAtZ = 2;
        this.camera.lookAt(lookAtX, lookAtY, lookAtZ);
    }

    animateSwing(player, deltaTime) {
        if (player.userData.isSwinging) {
            player.userData.swingTime += deltaTime * 10;

            const rightArm = player.userData.rightArm;
            const t = player.userData.swingTime;

            if (t < Math.PI) {
                // Swing motion - powerful forehand swing
                const swingProgress = Math.sin(t);

                // Rotate arm in multiple axes for realistic swing
                rightArm.rotation.z = -0.3 + swingProgress * 1.8; // Main swing arc
                rightArm.rotation.x = -0.2 + swingProgress * 1.2; // Forward motion
                rightArm.rotation.y = swingProgress * 0.5; // Slight twist

                // Rotate the racket itself for follow-through
                if (player.userData.racket) {
                    player.userData.racket.rotation.x = Math.PI / 3 + swingProgress * 0.8;
                }
            } else {
                // Reset to resting position
                player.userData.isSwinging = false;
                rightArm.rotation.z = -0.3;
                rightArm.rotation.x = -0.2;
                rightArm.rotation.y = 0;
                if (player.userData.racket) {
                    player.userData.racket.rotation.x = Math.PI / 3;
                }
            }
        }
    }

    animateMovement(player, deltaTime) {
        // Subtle stance animation when moving
        if (player.userData.isMoving) {
            player.userData.moveTime += deltaTime * 12;

            const legs = player.userData.legs;
            if (legs && legs.left && legs.right) {
                // Subtle leg sway when moving
                const sway = Math.sin(player.userData.moveTime) * 0.08;
                legs.left.rotation.z = sway;
                legs.right.rotation.z = -sway;
            }
        } else {
            // Return to neutral stance
            player.userData.moveTime = 0;
            const legs = player.userData.legs;
            if (legs && legs.left && legs.right) {
                legs.left.rotation.z = 0;
                legs.right.rotation.z = 0;
            }
        }
    }

    createBallTrail() {
        // Create trail effect for ball
        if (!this.ballTrail) {
            this.ballTrail = [];
        }

        const trailLength = 8;
        const trailSphere = new THREE.Mesh(
            new THREE.SphereGeometry(this.ballRadius * 0.6, 8, 8),
            new THREE.MeshBasicMaterial({
                color: 0xCCFF00,
                transparent: true,
                opacity: 0.4
            })
        );
        trailSphere.position.copy(this.ball.position);
        this.scene.add(trailSphere);

        this.ballTrail.push({
            mesh: trailSphere,
            life: 1.0
        });

        // Remove old trail parts
        if (this.ballTrail.length > trailLength) {
            const old = this.ballTrail.shift();
            this.scene.remove(old.mesh);
        }
    }

    updateBallTrail(deltaTime) {
        if (!this.ballTrail) return;

        for (let i = this.ballTrail.length - 1; i >= 0; i--) {
            const trail = this.ballTrail[i];
            trail.life -= deltaTime * 2;

            if (trail.life <= 0) {
                this.scene.remove(trail.mesh);
                this.ballTrail.splice(i, 1);
            } else {
                trail.mesh.material.opacity = trail.life * 0.4;
                trail.mesh.scale.setScalar(trail.life);
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        try {
            const deltaTime = 1 / 60; // Fixed timestep for consistent physics

            this.updatePlayerMovement(deltaTime);
            this.updateOpponentMovement(deltaTime);
            this.updatePhysics(deltaTime);
            this.updateCamera();

            // Animate player swings and movement
            this.animateSwing(this.playerPaddle, deltaTime);
            this.animateSwing(this.opponentPaddle, deltaTime);
            this.animateMovement(this.playerPaddle, deltaTime);
            this.animateMovement(this.opponentPaddle, deltaTime);

            // Update ball trail effect
            this.updateBallTrail(deltaTime);

            // Update hit indicator
            this.updateHitIndicator();

            this.renderer.render(this.scene, this.camera);
        } catch (error) {
            console.error('Error in animation loop:', error);
        }
    }

    updateHitIndicator() {
        if (!this.ballInPlay || !this.canHit || this.gameState !== 'playing' || this.lastHitter === 'player') {
            this.hitIndicator.material.opacity = 0;
            return;
        }

        const distToBall = this.ball.position.distanceTo(this.playerPaddle.position);
        const maxHitDistance = this.settings.autoTiming ? 2.5 : 2.0;
        const isInFrontOfPlayer = this.ball.position.z < -this.courtLength / 4 + 2;
        const isRightHeight = this.ball.position.y > 0.3 && this.ball.position.y < 3;
        const isComingTowardPlayer = this.ballVelocity.z < 0;

        if (distToBall < maxHitDistance && isInFrontOfPlayer && isRightHeight && isComingTowardPlayer) {
            // Show green ring around ball when you can hit
            this.hitIndicator.position.copy(this.ball.position);
            this.hitIndicator.position.y = 0.05;
            this.hitIndicator.material.opacity = 0.6;
            this.hitIndicator.scale.setScalar(1 + Math.sin(Date.now() * 0.01) * 0.2);
        } else {
            this.hitIndicator.material.opacity = 0;
        }
    }
}

// Initialize game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new TennisGame();
    });
} else {
    new TennisGame();
}
