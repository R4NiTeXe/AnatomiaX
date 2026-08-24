import { OrbitControls } from '@react-three/drei';

export default function CameraControls(): JSX.Element {
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      enablePan
      enableZoom
      enableRotate
      minDistance={2}
      maxDistance={8}
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 1.9}
      target={[0, 0, 0]}
    />
  );
}
