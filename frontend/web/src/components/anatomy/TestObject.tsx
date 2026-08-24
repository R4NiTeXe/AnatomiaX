import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

export default function TestObject(): JSX.Element {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3;
      meshRef.current.rotation.x += delta * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#14b8a6" wireframe={false} flatShading={false} />
    </mesh>
  );
}
