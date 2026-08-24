import { useGLTF } from '@react-three/drei';

type ModelLoaderProps = {
  path: string;
};

export default function ModelLoader({ path }: ModelLoaderProps): JSX.Element {
  const { scene } = useGLTF(path);

  return <primitive object={scene} dispose={null} />;
}
