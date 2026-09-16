import * as THREE from 'three';
import {
  applySkinToneColor,
  applySkinToneToEntries,
  enhanceSkinEntries,
  enhanceSkinMaterial,
  isSkinMaterial,
  type SkinEntryLike,
} from '../skinMaterial';
import { getSkinTone } from '../skinTones';

function skinStandard(name: string): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 });
  material.name = name;
  return material;
}

function entryFor(material: THREE.Material, skin: boolean): SkinEntryLike {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  return { mesh, base: material, skin };
}

describe('skinMaterial (8.31)', () => {
  it('identifies only verified skin materials by name', () => {
    // Shipped GLB skin materials (male + female).
    expect(isSkinMaterial(skinStandard('pasted__Skin_Mat'))).toBe(true);
    expect(isSkinMaterial(skinStandard('Skin_mat'))).toBe(true);
    expect(isSkinMaterial(skinStandard('Skin_mat2'))).toBe(true);
    // Non-skin materials in the female skin file stay excluded.
    expect(isSkinMaterial(skinStandard('retina_mat3'))).toBe(false);
    expect(isSkinMaterial(skinStandard('Ligament_mat'))).toBe(false);
    expect(isSkinMaterial(skinStandard('BroadLigament_mat'))).toBe(false);
    expect(isSkinMaterial(skinStandard('gland_mat'))).toBe(false);
    expect(isSkinMaterial(skinStandard('Femur_mat'))).toBe(false);
    expect(isSkinMaterial(skinStandard(''))).toBe(false);
  });

  it('enhances skin toward restrained physical realism, preserving identity', () => {
    const material = skinStandard('Skin_mat');
    material.transparent = true;
    material.opacity = 0.72;
    const upgraded = enhanceSkinMaterial(material);
    expect((upgraded as { isMeshPhysicalMaterial?: boolean }).isMeshPhysicalMaterial).toBe(true);
    expect(upgraded.name).toBe('Skin_mat');
    const physical = upgraded as THREE.MeshPhysicalMaterial;
    expect(physical.roughness).toBeCloseTo(0.58);
    expect(physical.metalness).toBe(0);
    expect(physical.clearcoat).toBeLessThanOrEqual(0.2);
    // Opacity pipeline untouched.
    expect(physical.transparent).toBe(true);
    expect(physical.opacity).toBeCloseTo(0.72);
  });

  it('leaves non-standard materials alone', () => {
    const basic = new THREE.MeshBasicMaterial({ color: '#ff0000' });
    basic.name = 'Skin_mat';
    expect(enhanceSkinMaterial(basic)).toBe(basic);
  });

  it('applies tone RGB while preserving alpha behavior', () => {
    const material = skinStandard('pasted__Skin_Mat');
    material.transparent = true;
    material.opacity = 0.31;
    applySkinToneColor(material, 'deep');
    expect(material.color.getHexString().toLowerCase()).toBe(
      getSkinTone('deep').color.replace('#', '').toLowerCase()
    );
    expect(material.opacity).toBeCloseTo(0.31);
    expect(material.transparent).toBe(true);
  });

  it('switches tones in place without allocating or touching non-skin', () => {
    const skin = skinStandard('Skin_mat2');
    const bone = skinStandard('Femur_mat');
    const skinEntry = entryFor(skin, true);
    const boneEntry = entryFor(bone, false);
    const entries = [skinEntry, boneEntry];

    enhanceSkinEntries(entries, 'medium');
    const mounted = skinEntry.mesh.material as THREE.Material;
    expect(boneEntry.mesh.material).toBe(bone);
    expect(bone.color.getHexString()).toBe('ffffff');

    // Repeated switching keeps identical material objects (no leaks).
    for (const tone of ['light', 'deep', 'mediumDeep', 'mediumLight', 'medium'] as const) {
      applySkinToneToEntries(entries, tone);
      expect(skinEntry.mesh.material).toBe(mounted);
      expect(skinEntry.base).toBe(mounted);
      expect((mounted as THREE.MeshStandardMaterial).color.getHexString().toLowerCase()).toBe(
        getSkinTone(tone).color.replace('#', '').toLowerCase()
      );
    }
    expect(bone.color.getHexString()).toBe('ffffff');
  });
});
