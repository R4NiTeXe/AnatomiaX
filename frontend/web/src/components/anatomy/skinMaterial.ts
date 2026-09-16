import * as THREE from 'three';
import { getSkinTone, type SkinToneId } from './skinTones';

/**
 * Skin material handling (STEP 8.31).
 *
 * Verified against the shipped GLBs (no guessing):
 * - male `skin-meshopt.glb`: single mesh VH_M_skin → `pasted__Skin_Mat`
 * - female `female-skin-meshopt.glb`: VH_F_skin → `Skin_mat2`,
 *   areola/nipple/tubercles → `Skin_mat`
 * Non-skin materials in the female skin file (`retina_mat3`, `Ligament_mat`,
 * `BroadLigament_mat`, `gland_mat`) never contain "skin" and are excluded.
 * GLBs ship zero textures, so realism comes from PBR properties only —
 * no external assets required (TASK 19 checkpoint: not needed).
 */

/** Name rule cross-checked against mesh semantics in both GLBs. */
export function isSkinMaterial(material: THREE.Material): boolean {
  return (material.name ?? '').toLowerCase().includes('skin');
}

/** Restrained realism constants — natural skin, never plastic or waxy. */
export const SKIN_REALISM = {
  roughness: 0.58,
  metalness: 0,
  clearcoat: 0.12,
  clearcoatRoughness: 0.6,
  sheen: 0.25,
  sheenRoughness: 0.7,
  sheenColor: '#F5D9C4',
  specularIntensity: 0.5,
} as const;

function stampOriginals(
  material: THREE.Material,
  transparent: boolean | undefined,
  depthWrite: boolean | undefined
): void {
  const record = material as unknown as Record<string, unknown>;
  record.__originalTransparent = transparent;
  record.__originalDepthWrite = depthWrite;
}

/**
 * Upgrades one skin material in place where possible.
 * MeshStandardMaterial (what GLTFLoader produces) keeps its identity and
 * gains realistic roughness; where MeshPhysicalMaterial is available it is
 * preferred for its restrained clearcoat/sheen response and returned as a
 * replacement — the caller swaps it into the mesh and disposes the old one.
 * Never touches opacity/transparent/depthWrite: the system-opacity pipeline
 * owns those. Falls back to the input material on any failure.
 */
export function enhanceSkinMaterial(material: THREE.Material): THREE.Material {
  try {
    const std = material as THREE.MeshStandardMaterial;
    if (typeof std.roughness === 'number') {
      std.roughness = SKIN_REALISM.roughness;
      std.metalness = SKIN_REALISM.metalness;
    }
    if (
      typeof (THREE as unknown as { MeshPhysicalMaterial?: unknown }).MeshPhysicalMaterial !==
      'function'
    ) {
      return material;
    }
    if ((material as { isMeshPhysicalMaterial?: boolean }).isMeshPhysicalMaterial) {
      const physical = material as THREE.MeshPhysicalMaterial;
      physical.clearcoat = SKIN_REALISM.clearcoat;
      physical.clearcoatRoughness = SKIN_REALISM.clearcoatRoughness;
      return material;
    }
    if (!(material as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial) {
      return material;
    }
    // NOTE: MeshPhysicalMaterial.copy(standard) throws on three r185 (it
    // blindly copies physical-only internals like clearcoatNormalScale), so
    // the replacement is constructed with an explicit carried-prop whitelist.
    // Verified sufficient: shipped GLBs carry color/alpha only, zero maps.
    const physical = new THREE.MeshPhysicalMaterial({
      color: std.color ? std.color.clone() : new THREE.Color('#ffffff'),
      roughness: SKIN_REALISM.roughness,
      metalness: SKIN_REALISM.metalness,
      transparent: std.transparent,
      opacity: std.opacity,
      alphaTest: std.alphaTest,
      depthWrite: std.depthWrite,
      side: std.side,
    });
    physical.name = std.name;
    if (std.map) physical.map = std.map;
    if (std.roughnessMap) physical.roughnessMap = std.roughnessMap;
    if (std.normalMap) {
      physical.normalMap = std.normalMap;
      physical.normalScale = std.normalScale.clone();
    }
    if (std.emissive) {
      physical.emissive = std.emissive.clone();
      physical.emissiveIntensity = std.emissiveIntensity;
      if (std.emissiveMap) physical.emissiveMap = std.emissiveMap;
    }
    physical.clearcoat = SKIN_REALISM.clearcoat;
    physical.clearcoatRoughness = SKIN_REALISM.clearcoatRoughness;
    physical.sheen = SKIN_REALISM.sheen;
    physical.sheenRoughness = SKIN_REALISM.sheenRoughness;
    physical.sheenColor = new THREE.Color(SKIN_REALISM.sheenColor);
    if (typeof physical.specularIntensity === 'number') {
      physical.specularIntensity = SKIN_REALISM.specularIntensity;
    }
    const record = material as unknown as Record<string, unknown>;
    stampOriginals(
      physical,
      record.__originalTransparent as boolean | undefined,
      record.__originalDepthWrite as boolean | undefined
    );
    return physical;
  } catch {
    return material;
  }
}

/** Applies the tone's RGB only — alpha/opacity/transparent are preserved. */
export function applySkinToneColor(material: THREE.Material, tone: SkinToneId): void {
  const std = material as THREE.MeshStandardMaterial;
  if (!std.color) return;
  std.color.set(getSkinTone(tone).color);
}

function eachMaterial(
  material: THREE.Material | THREE.Material[],
  fn: (material: THREE.Material) => void
): void {
  const list = Array.isArray(material) ? material : [material];
  for (const item of list) fn(item);
}

export interface SkinEntryLike {
  mesh: THREE.Mesh;
  base: THREE.Material | THREE.Material[];
  skin: boolean;
}

/**
 * Upgrades every skin entry once at mount: physical replacement (old clone
 * disposed, never rendered) + initial tone color. Non-skin entries pass
 * through untouched. Creates no per-frame work.
 */
export function enhanceSkinEntries(entries: SkinEntryLike[], tone: SkinToneId): void {
  for (const entry of entries) {
    if (!entry.skin) continue;
    const swap = (current: THREE.Material): THREE.Material => {
      if (!isSkinMaterial(current)) return current;
      const upgraded = enhanceSkinMaterial(current);
      applySkinToneColor(upgraded, tone);
      if (upgraded !== current) {
        entry.base = Array.isArray(entry.base)
          ? (entry.base as THREE.Material[]).map(m => (m === current ? upgraded : m))
          : upgraded;
        try {
          current.dispose?.();
        } catch {
          // ignore dispose errors
        }
      }
      return upgraded;
    };
    const current = entry.mesh.material as THREE.Material | THREE.Material[];
    if (Array.isArray(current)) {
      const next = current.map(swap);
      if (next.some((m, i) => m !== current[i])) entry.mesh.material = next;
    } else if (current) {
      const next = swap(current);
      if (next !== current) entry.mesh.material = next;
    }
  }
}

/**
 * Cheap in-place tone switch: recolors base + currently-mounted materials
 * (covers highlight clones) without allocating, refetching, or remounting.
 */
export function applySkinToneToEntries(entries: SkinEntryLike[], tone: SkinToneId): void {
  for (const entry of entries) {
    if (!entry.skin) continue;
    const seen = new Set<THREE.Material>();
    eachMaterial(entry.base, m => {
      if (!seen.has(m) && isSkinMaterial(m)) {
        seen.add(m);
        applySkinToneColor(m, tone);
      }
    });
    eachMaterial(entry.mesh.material as THREE.Material | THREE.Material[], m => {
      if (!seen.has(m) && isSkinMaterial(m)) {
        seen.add(m);
        applySkinToneColor(m, tone);
      }
    });
  }
}
