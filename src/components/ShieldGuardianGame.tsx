import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Shield, Play, Pause, RotateCcw, Volume2, VolumeX, Award, Sparkles, AlertTriangle } from 'lucide-react';

interface ShieldGuardianGameProps {
  onCloseGame: () => void;
}

export const ShieldGuardianGame: React.FC<ShieldGuardianGameProps> = ({ onCloseGame }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // Game States
  const [gameState, setGameState] = useState<'title' | 'playing' | 'paused' | 'victory' | 'gameover'>('title');
  const [score, setScore] = useState<number>(0);
  const [shieldEnergy, setShieldEnergy] = useState<number>(100);
  const [threatsIntercepted, setThreatsIntercepted] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Mutable ref for loop performance
  const gameRef = useRef<{
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    renderer: THREE.WebGLRenderer | null;
    playerMesh: THREE.Mesh | null;
    escortTarget: THREE.Mesh | null;
    threats: THREE.Mesh[];
    beacons: THREE.Mesh[];
    particles: THREE.Points | null;
    score: number;
    shieldEnergy: number;
    threatsIntercepted: number;
    keys: Record<string, boolean>;
    lastTime: number;
    audioCtx: AudioContext | null;
  }>({
    scene: null,
    camera: null,
    renderer: null,
    playerMesh: null,
    escortTarget: null,
    threats: [],
    beacons: [],
    particles: null,
    score: 0,
    shieldEnergy: 100,
    threatsIntercepted: 0,
    keys: {},
    lastTime: performance.now(),
    audioCtx: null,
  });

  // Simple Web Audio synth sound generator
  const playSynthSound = (type: 'dash' | 'hit' | 'pickup' | 'win') => {
    if (isMuted) return;
    try {
      if (!gameRef.current.audioCtx) {
        gameRef.current.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = gameRef.current.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'dash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'pickup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(880, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch { /* ignore audio fallback */ }
  };

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Setup Three.js Scene, Camera, Renderer
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.03);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 12, 16);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    mountRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x384260, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xa5b4fc, 1.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // City Ground Grid Plane
    const gridGeo = new THREE.PlaneGeometry(100, 100, 32, 32);
    const gridMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      wireframe: false,
    });
    const ground = new THREE.Mesh(gridGeo, gridMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(100, 40, 0x6366f1, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // 2. Create Player (Shield Guardian Drone)
    const playerGeo = new THREE.OctahedronGeometry(0.8, 1);
    const playerMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });
    const playerMesh = new THREE.Mesh(playerGeo, playerMat);
    playerMesh.position.set(0, 1, 0);
    playerMesh.castShadow = true;
    scene.add(playerMesh);

    // Player Shield Ring
    const ringGeo = new THREE.TorusGeometry(1.2, 0.06, 16, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
    const shieldRing = new THREE.Mesh(ringGeo, ringMat);
    shieldRing.rotation.x = Math.PI / 2;
    playerMesh.add(shieldRing);

    // 3. Create Escort Target (Citizen VIP)
    const escortGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 16);
    const escortMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xdb2777,
      emissiveIntensity: 0.5,
    });
    const escortTarget = new THREE.Mesh(escortGeo, escortMat);
    escortTarget.position.set(0, 0.6, 2);
    scene.add(escortTarget);

    // 4. Create Star Particles
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 80;
      particlePositions[i + 1] = Math.random() * 20 + 2;
      particlePositions[i + 2] = (Math.random() - 0.5) * 80;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0xa855f7, size: 0.2, transparent: true, opacity: 0.7 });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Save references
    gameRef.current.scene = scene;
    gameRef.current.camera = camera;
    gameRef.current.renderer = renderer;
    gameRef.current.playerMesh = playerMesh;
    gameRef.current.escortTarget = escortTarget;
    gameRef.current.particles = particles;

    // Keyboard Input Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      gameRef.current.keys[e.code] = true;
      if (e.code === 'Space') {
        playSynthSound('dash');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gameRef.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Spawn Initial Threat Drones
    const spawnThreat = () => {
      if (!scene) return;
      const tGeo = new THREE.ConeGeometry(0.5, 1, 8);
      const tMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 0.8 });
      const threat = new THREE.Mesh(tGeo, tMat);
      threat.rotation.x = Math.PI / 2;
      
      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 10;
      threat.position.set(Math.cos(angle) * dist, 0.8, Math.sin(angle) * dist);
      scene.add(threat);
      gameRef.current.threats.push(threat);
    };

    // Spawn Initial Safe Haven Light Beacons
    const spawnBeacon = () => {
      if (!scene) return;
      const bGeo = new THREE.IcosahedronGeometry(0.5, 0);
      const bMat = new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x059669, emissiveIntensity: 0.9 });
      const beacon = new THREE.Mesh(bGeo, bMat);
      beacon.position.set((Math.random() - 0.5) * 24, 0.6, (Math.random() - 0.5) * 24);
      scene.add(beacon);
      gameRef.current.beacons.push(beacon);
    };

    for (let i = 0; i < 5; i++) spawnThreat();
    for (let i = 0; i < 4; i++) spawnBeacon();

    // 5. Game Loop
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const now = performance.now();
      const rawDt = (now - gameRef.current.lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05); // Clamp dt to avoid huge jumps
      gameRef.current.lastTime = now;

      // Animate Idle Atmosphere (Title screen camera pan)
      if (playerMesh && escortTarget) {
        playerMesh.rotation.y += 0.02;
        shieldRing.rotation.z += 0.03;
        particles.rotation.y += 0.001;

        if (gameRef.current.keys['KeyW'] || gameRef.current.keys['ArrowUp']) playerMesh.position.z -= 10 * dt;
        if (gameRef.current.keys['KeyS'] || gameRef.current.keys['ArrowDown']) playerMesh.position.z += 10 * dt;
        if (gameRef.current.keys['KeyA'] || gameRef.current.keys['ArrowLeft']) playerMesh.position.x -= 10 * dt;
        if (gameRef.current.keys['KeyD'] || gameRef.current.keys['ArrowRight']) playerMesh.position.x += 10 * dt;

        // Keep player in bounds [-20, 20]
        playerMesh.position.x = Math.max(-20, Math.min(20, playerMesh.position.x));
        playerMesh.position.z = Math.max(-20, Math.min(20, playerMesh.position.z));

        // Escort target slowly follows player at safe distance
        escortTarget.position.x += (playerMesh.position.x - escortTarget.position.x) * 1.5 * dt;
        escortTarget.position.z += (playerMesh.position.z + 1.8 - escortTarget.position.z) * 1.5 * dt;

        // Camera follow
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, playerMesh.position.x, 0.05);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, playerMesh.position.z + 14, 0.05);
        camera.lookAt(playerMesh.position.x, 0.5, playerMesh.position.z);

        // Update threats movement towards escort target
        gameRef.current.threats.forEach((threat, idx) => {
          const dir = new THREE.Vector3().subVectors(escortTarget.position, threat.position).normalize();
          threat.position.addScaledVector(dir, 3.5 * dt);
          threat.lookAt(escortTarget.position);

          // Check collision with Player Shield
          const distToPlayer = playerMesh.position.distanceTo(threat.position);
          if (distToPlayer < 1.6) {
            playSynthSound('hit');
            gameRef.current.score += 150;
            gameRef.current.threatsIntercepted += 1;
            setScore(gameRef.current.score);
            setThreatsIntercepted(gameRef.current.threatsIntercepted);

            // Reposition threat
            const angle = Math.random() * Math.PI * 2;
            threat.position.set(Math.cos(angle) * 22, 0.8, Math.sin(angle) * 22);
          }

          // Check collision with Escort Target
          const distToEscort = escortTarget.position.distanceTo(threat.position);
          if (distToEscort < 0.8) {
            gameRef.current.shieldEnergy = Math.max(0, gameRef.current.shieldEnergy - 12);
            setShieldEnergy(gameRef.current.shieldEnergy);
            
            // Reposition threat
            const angle = Math.random() * Math.PI * 2;
            threat.position.set(Math.cos(angle) * 22, 0.8, Math.sin(angle) * 22);
          }
        });

        // Check Beacons Pickups
        gameRef.current.beacons.forEach((beacon) => {
          beacon.rotation.y += 0.03;
          if (playerMesh.position.distanceTo(beacon.position) < 1.5) {
            playSynthSound('pickup');
            gameRef.current.score += 300;
            gameRef.current.shieldEnergy = Math.min(100, gameRef.current.shieldEnergy + 20);
            setScore(gameRef.current.score);
            setShieldEnergy(gameRef.current.shieldEnergy);

            beacon.position.set((Math.random() - 0.5) * 24, 0.6, (Math.random() - 0.5) * 24);
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setShieldEnergy(100);
    setThreatsIntercepted(0);
    gameRef.current.score = 0;
    gameRef.current.shieldEnergy = 100;
    gameRef.current.threatsIntercepted = 0;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden">
      
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* World-Matched Low-Occlusion UI Layer */}
      <div className="relative z-10 w-full h-full pointer-events-none flex flex-col justify-between p-6">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center space-x-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800">
            <Shield className="w-6 h-6 text-sky-400 stroke-[2.2]" />
            <div>
              <h2 className="text-sm font-black text-white">SHIELD GUARDIAN 3D</h2>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Tactical Escort Simulation</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              onClick={onCloseGame}
              className="px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-bold text-xs border border-slate-800"
            >
              Exit Game Shell
            </button>
          </div>
        </div>

        {/* Playing HUD Overlay */}
        {gameState === 'playing' && (
          <div className="flex items-end justify-between">
            <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 space-y-2 pointer-events-auto min-w-[200px]">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-400">Shield Stability</span>
                <span className="text-sky-300 font-mono">{shieldEnergy}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${shieldEnergy}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 text-right pointer-events-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Threats Intercepted</span>
              <span className="text-2xl font-black text-white font-mono">{threatsIntercepted}</span>
              <span className="text-xs text-sky-400 font-bold block mt-1">Score: {score}</span>
            </div>
          </div>
        )}

        {/* Title Screen Overlay */}
        {gameState === 'title' && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center pointer-events-auto">
            <div className="max-w-lg space-y-6">
              
              {/* Bespoke Inline SVG Title Lockup */}
              <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 p-1 shadow-2xl shadow-sky-950 flex items-center justify-center">
                <Shield className="w-14 h-14 text-white stroke-[2.2]" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-sky-950 border border-sky-700 text-sky-300 text-xs font-bold uppercase tracking-widest">
                  3D Tactical Escort Simulation
                </span>
                <h1 className="text-4xl font-black text-white mt-3 tracking-tight">
                  SHIELD GUARDIAN 3D
                </h1>
                <p className="text-xs text-slate-300 mt-2 max-w-sm mx-auto">
                  Protect the Escort VIP along the night corridor. Intercept threat drones with your EMP shield and collect Safe Haven light beacons!
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={startGame}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-400 hover:to-purple-500 text-white font-black text-base shadow-xl shadow-sky-950 active:scale-95 transition-transform flex items-center justify-center space-x-2 mx-auto"
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span>START TACTICAL ESCORT MISSION</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 font-mono">
                WASD / Arrows to Steer Drone · Space Action EMP Dash · Esc Exit
              </p>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
