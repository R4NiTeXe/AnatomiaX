import type { AnatomyAsset } from './anatomyAssets';
import ModelLoader from './ModelLoader';

type AnatomyModelProps = {
  asset: AnatomyAsset;
  scale?: number;
  position?: [number, number, number];
};

export default function AnatomyModel({
  asset,
  scale = 1,
  position = [0, 0, 0],
}: AnatomyModelProps): JSX.Element | null {
  if (!asset.available) {
    return null;
  }

  return (
    <group scale={scale} position={position}>
      <ModelLoader path={asset.path} />
    </group>
  );
}
