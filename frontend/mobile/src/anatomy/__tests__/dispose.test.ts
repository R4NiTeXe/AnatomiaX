import * as THREE from 'three';
import { disposeObject } from '../dispose';

describe('stage disposal (8.19.35)', () => {
  it('disposes geometries and materials exactly once', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const disposeGeometry = jest.spyOn(geometry, 'dispose');
    const disposeMaterial = jest.spyOn(material, 'dispose');
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, material));

    expect(disposeObject(group)).toEqual({ geometriesDisposed: 1, materialsDisposed: 1 });
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
    // Second pass over disposed content stays safe.
    expect(() => disposeObject(group)).not.toThrow();
  });

  it('handles material arrays and empty groups', () => {
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [
        new THREE.MeshBasicMaterial(),
        new THREE.MeshBasicMaterial(),
      ])
    );
    group.add(new THREE.Group());
    expect(disposeObject(group)).toEqual({ geometriesDisposed: 1, materialsDisposed: 2 });
    expect(disposeObject(new THREE.Group())).toEqual({
      geometriesDisposed: 0,
      materialsDisposed: 0,
    });
  });
});
