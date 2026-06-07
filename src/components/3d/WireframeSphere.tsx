import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function OrbitRings() {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const rings = useMemo(() => {
    const ringCount = 6;
    const pointCount = 50;
    const ringsData: {
      points: Float32Array;
      speed: number;
      axis: [number, number, number];
    }[] = [];

    for (let i = 0; i < ringCount; i++) {
      const points = new Float32Array(pointCount * 3);

      for (let j = 0; j < pointCount; j++) {
        const idx = j * 3;
        const r = 2.2 + Math.random() * 0.5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        points[idx] = r * Math.sin(phi) * Math.cos(theta + i * 1.047);
        points[idx + 1] = r * Math.sin(phi) * Math.sin(theta + i * 1.047);
        points[idx + 2] = r * Math.cos(phi);
      }

      ringsData.push({
        points,
        speed: 0.02 + Math.random() * 0.03,
        axis: [
          Math.random() * 0.5 - 0.25,
          Math.random() * 0.5 - 0.25,
          Math.random() * 0.5 - 0.25,
        ] as [number, number, number],
      });
    }

    return ringsData;
  }, []);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.05;
    }
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.01;
      groupRef.current.rotation.x += delta * 0.005;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Inner icosahedron wireframe */}
      <mesh>
        <icosahedronGeometry args={[2, 1]} />
        <meshBasicMaterial
          color="#6E56CF"
          wireframe
          transparent
          opacity={0.08}
        />
      </mesh>

      {/* Orbit rings */}
      {rings.map((ring, ri) => (
        <points
          key={ri}
          ref={ri === 0 ? pointsRef : undefined}
          rotation={[ring.axis[0], ring.axis[1], ring.axis[2]]}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[ring.points, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            color="#ffffff"
            size={0.015}
            transparent
            opacity={0.4}
            sizeAttenuation
          />
        </points>
      ))}

      {/* Outer glow sphere */}
      <mesh>
        <sphereGeometry args={[3.5, 32, 32]} />
        <meshBasicMaterial
          color="#6E56CF"
          transparent
          opacity={0.02}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

export default function WireframeSphere({ opacity = 0.3 }: { opacity?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        opacity,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={0.5} color="#6E56CF" />
        <OrbitRings />
      </Canvas>
    </div>
  );
}
