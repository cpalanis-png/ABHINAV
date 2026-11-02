import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface HolographicShieldBackgroundProps {
  activeTab?: string;
  isSosEmergencyActive?: boolean;
}

export const HolographicShieldBackground: React.FC<HolographicShieldBackgroundProps> = ({
  activeTab = 'dashboard',
  isSosEmergencyActive = false
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    // Check for reduced motion preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setIsReducedMotion(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL support
    const checkWebGL = (): boolean => {
      try {
        const canvas = document.createElement('canvas');
        return Boolean(
          window.WebGLRenderingContext &&
            (canvas.getContext('webgl') || canvas.getContext('experimental-webgl') || canvas.getContext('webgl2'))
        );
      } catch {
        return false;
      }
    };

    if (!checkWebGL()) {
      setWebglSupported(false);
      return;
    }

    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer | null = null;
    let pmremGenerator: THREE.PMREMGenerator | null = null;

    // Scene & Camera setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050816, 0.04);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 8.5);

    // Renderer setup
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        precision: 'mediump'
      });
    } catch {
      setWebglSupported(false);
      return;
    }

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    container.appendChild(renderer.domElement);

    // Studio Environment
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.2);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x050816, 1.5);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.PointLight(0x38bdf8, 12.0, 15);
    keyLight.position.set(3, 4, 4);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xc084fc, 14.0, 15);
    rimLight.position.set(-3, -2, -2);
    scene.add(rimLight);

    const coreLight = new THREE.PointLight(0x6366f1, 8.0, 10);
    coreLight.position.set(0, 0, 1);
    scene.add(coreLight);

    // -------------------------------------------------------------
    // PROCEDURAL 3D HOLOGRAPHIC SHIELD ASSEMBLY
    // -------------------------------------------------------------
    const shieldGroup = new THREE.Group();

    // Create 2D Shield Shape
    const createShieldShape = (): THREE.Shape => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 1.8);
      shape.bezierCurveTo(1.3, 1.8, 1.5, 1.3, 1.5, 0.4);
      shape.bezierCurveTo(1.5, -0.7, 0.7, -1.4, 0, -2.0);
      shape.bezierCurveTo(-0.7, -1.4, -1.5, -0.7, -1.5, 0.4);
      shape.bezierCurveTo(-1.5, 1.3, -1.3, 1.8, 0, 1.8);
      return shape;
    };

    // 1. Outer Metallic Armor Frame
    const frameGeometry = new THREE.ExtrudeGeometry(createShieldShape(), {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.09,
      bevelSize: 0.09,
      bevelSegments: 5
    });
    frameGeometry.center();

    const frameMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x4f46e5,
      metalness: 0.92,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 0.9,
      emissive: 0x1e1b4b,
      emissiveIntensity: 0.2
    });

    const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
    shieldGroup.add(frameMesh);

    // 2. Inner Translucent Holographic Glass Plate
    const glassGeometry = new THREE.ExtrudeGeometry(createShieldShape(), {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 3
    });
    glassGeometry.center();

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.15,
      roughness: 0.05,
      transmission: 0.85,
      ior: 1.52,
      thickness: 0.4,
      transparent: true,
      opacity: 0.75,
      reflectivity: 0.95,
      clearcoat: 1.0,
      emissive: 0x0284c7,
      emissiveIntensity: 0.3
    });

    const glassMesh = new THREE.Mesh(glassGeometry, glassMaterial);
    glassMesh.scale.set(0.88, 0.88, 0.88);
    glassMesh.position.z = 0.02;
    shieldGroup.add(glassMesh);

    // 3. Central Holographic Security Core & Crest
    const coreGroup = new THREE.Group();

    // Outer Core Lock Ring
    const lockRingGeo = new THREE.TorusGeometry(0.55, 0.04, 16, 48);
    const lockRingMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xa855f7,
      emissiveIntensity: 0.9,
      metalness: 0.8,
      roughness: 0.2
    });
    const lockRingMesh = new THREE.Mesh(lockRingGeo, lockRingMat);
    lockRingMesh.position.z = 0.18;
    coreGroup.add(lockRingMesh);

    // Inner Crest Emblem (Star / Octahedron Gem)
    const gemGeo = new THREE.OctahedronGeometry(0.38, 0);
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.2,
      metalness: 0.3,
      roughness: 0.1,
      clearcoat: 1.0
    });
    const gemMesh = new THREE.Mesh(gemGeo, gemMat);
    gemMesh.position.z = 0.22;
    coreGroup.add(gemMesh);

    shieldGroup.add(coreGroup);

    // 4. Orbital Holographic Energy Rings
    const ring1Geo = new THREE.TorusGeometry(2.3, 0.018, 16, 64);
    const ring1Mat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0284c7,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.85
    });
    const ring1Mesh = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1Mesh.rotation.x = Math.PI * 0.38;
    shieldGroup.add(ring1Mesh);

    const ring2Geo = new THREE.TorusGeometry(2.8, 0.012, 16, 64);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xa855f7,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.75
    });
    const ring2Mesh = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2Mesh.rotation.y = Math.PI * 0.25;
    shieldGroup.add(ring2Mesh);

    scene.add(shieldGroup);

    // -------------------------------------------------------------
    // CYBERNETIC PARTICLES FIELD
    // -------------------------------------------------------------
    const particleCount = 320;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const colorChoices = [
      new THREE.Color(0x38bdf8), // cyan
      new THREE.Color(0xc084fc), // purple
      new THREE.Color(0x818cf8), // indigo
      new THREE.Color(0xffffff)  // white highlight
    ];

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 12;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 8;

      const c = colorChoices[Math.floor(Math.random() * colorChoices.length)];
      particleColors[i * 3] = c.r;
      particleColors[i * 3 + 1] = c.g;
      particleColors[i * 3 + 2] = c.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // -------------------------------------------------------------
    // INTERACTION & PARALLAX HANDLERS
    // -------------------------------------------------------------
    let mouseX = 0;
    let mouseY = 0;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      mouseX = (clientX / window.innerWidth - 0.5) * 2;
      mouseY = (clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    const handleResize = () => {
      if (!renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // -------------------------------------------------------------
    // ANIMATION LOOP
    // -------------------------------------------------------------
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Adjust positioning and scale based on activeTab
      let targetPosX = 0;
      let targetPosY = 0;
      let targetScale = 1.0;

      if (activeTab === 'welcome' || activeTab === 'auth') {
        targetPosX = window.innerWidth > 768 ? 1.8 : 0;
        targetPosY = 0.2;
        targetScale = 1.15;
      } else if (activeTab === 'ai') {
        targetPosX = 2.0;
        targetPosY = -0.5;
        targetScale = 0.85;
      } else {
        targetPosX = window.innerWidth > 1024 ? 2.2 : 0;
        targetPosY = 0.3;
        targetScale = 0.9;
      }

      // Smooth position lerp
      shieldGroup.position.x = THREE.MathUtils.damp(shieldGroup.position.x, targetPosX, 3, delta);
      shieldGroup.position.y = THREE.MathUtils.damp(
        shieldGroup.position.y,
        targetPosY + Math.sin(elapsedTime * 0.8) * 0.18,
        3,
        delta
      );

      const currentScale = THREE.MathUtils.damp(shieldGroup.scale.x, targetScale, 3, delta);
      shieldGroup.scale.set(currentScale, currentScale, currentScale);

      // Emergency SOS Lighting Pulse
      if (isSosEmergencyActive) {
        keyLight.color.setHex(0xf43f5e); // Rose
        rimLight.color.setHex(0xe11d48);
        coreLight.color.setHex(0xbe123c);
        gemMat.emissive.setHex(0xf43f5e);
        gemMat.emissiveIntensity = 1.8 + Math.sin(elapsedTime * 6) * 0.8;
      } else {
        keyLight.color.setHex(0x38bdf8);
        rimLight.color.setHex(0xc084fc);
        coreLight.color.setHex(0x6366f1);
        gemMat.emissive.setHex(0x0284c7);
        gemMat.emissiveIntensity = 1.2;
      }

      // Smooth Rotation & Parallax
      if (!isReducedMotion) {
        shieldGroup.rotation.y = elapsedTime * 0.15 + mouseX * 0.25;
        shieldGroup.rotation.x = Math.sin(elapsedTime * 0.5) * 0.08 - mouseY * 0.2;

        lockRingMesh.rotation.z = elapsedTime * -0.4;
        gemMesh.rotation.y = elapsedTime * 0.6;

        ring1Mesh.rotation.z = elapsedTime * 0.22;
        ring2Mesh.rotation.x = elapsedTime * -0.18;

        // Particle floating drift
        const positions = particleGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3 + 1] += Math.sin(elapsedTime + i) * 0.002;
        }
        particleGeo.attributes.position.needsUpdate = true;
      }

      // Camera smooth damping
      const targetCamX = mouseX * 0.5;
      const targetCamY = -mouseY * 0.3;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 2, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 2, delta);
      camera.lookAt(0, 0, 0);

      if (renderer) {
        renderer.render(scene, camera);
      }
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('resize', handleResize);

      if (pmremGenerator) pmremGenerator.dispose();
      if (envTexture) envTexture.dispose();
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }

      // Dispose Geometries & Materials
      frameGeometry.dispose();
      frameMaterial.dispose();
      glassGeometry.dispose();
      glassMaterial.dispose();
      lockRingGeo.dispose();
      lockRingMat.dispose();
      gemGeo.dispose();
      gemMat.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      ring2Geo.dispose();
      ring2Mat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, [activeTab, isSosEmergencyActive, isReducedMotion]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      style={{
        background: isSosEmergencyActive
          ? 'radial-gradient(circle at 50% 30%, #4c0519 0%, #0f172a 60%, #050816 100%)'
          : 'radial-gradient(circle at 60% 20%, #1e1b4b 0%, #090d21 55%, #050816 100%)'
      }}
    >
      {/* Fallback CSS 2D Animated Holographic Shield if WebGL is unsupported */}
      {!webglSupported && (
        <div className="w-full h-full flex items-center justify-center opacity-40">
          <div className="relative w-72 h-80 rounded-full border-2 border-cyan-400/40 bg-gradient-to-tr from-cyan-900/20 via-indigo-900/30 to-purple-900/20 backdrop-blur-2xl flex items-center justify-center animate-pulse">
            <div className="w-48 h-56 rounded-3xl border border-cyan-300/50 flex items-center justify-center shadow-2xl shadow-cyan-950">
              <div className="w-24 h-24 rounded-full border-4 border-indigo-400 border-t-cyan-300 animate-spin" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
