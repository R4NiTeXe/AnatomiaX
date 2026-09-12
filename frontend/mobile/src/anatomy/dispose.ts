import * as THREE from 'three';

export interface DisposalCounts {
  geometriesDisposed: number;
  materialsDisposed: number;
}

/**
 * Releases GPU-side resources for a loaded system. Safe to call twice.
 * The stage disposes the previous system BEFORE loading the next so only
 * one system is ever resident.
 */
export function disposeObject(root: THREE.Object3D): DisposalCounts {
  let geometriesDisposed = 0;
  let materialsDisposed = 0;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    if (geometry) geometries.add(geometry);
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      for (const entry of material) if (entry) materials.add(entry);
    } else if (material) {
      materials.add(material);
    }
  });
  for (const geometry of geometries) {
    geometry.dispose();
    geometriesDisposed += 1;
  }
  for (const material of materials) {
    material.dispose();
    materialsDisposed += 1;
  }
  return { geometriesDisposed, materialsDisposed };
}
