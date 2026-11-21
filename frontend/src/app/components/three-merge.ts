import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Fusionne, sous `root`, les maillages fixes qui partagent le même matériau : une pièce faite
 * de dizaines de petits volumes est dessinée en un seul appel au lieu d'un par volume (et de
 * même pour son ombre). L'image est identique : mêmes sommets (repassés dans le repère de
 * `root`), mêmes matériaux, mêmes réglages d'ombre.
 *
 * Deux matériaux aux réglages identiques sont interchangeables : les effets appliqués ensuite
 * (survol, performance) touchent tous les matériaux d'une pièce à la fois. Ceux qui changent
 * seuls (`apart`, ex. couleur d'accent) ne sont regroupés qu'avec eux-mêmes.
 *
 * Restent séparés : ce qui bouge (`moving`, ex. hélices), ce qui est transparent (l'ordre
 * d'affichage compte), les maillages marqués (`userData` : vitre, zones de clic, LED…), les
 * objets en miroir (échelle négative), les maillages multi-matériaux et les instances.
 *
 * Renvoie les géométries créées, à libérer avec le reste de la pièce.
 */
export function mergeStaticMeshes(
  root: THREE.Object3D,
  moving: ReadonlySet<THREE.Object3D>,
  apart: ReadonlySet<THREE.Material> = new Set(),
): THREE.BufferGeometry[] {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();

  const groups = new Map<string, THREE.Mesh[]>();
  root.traverse((object) => {
    if (!canMerge(object, root, moving)) return;
    const mesh = object as THREE.Mesh;
    const geometry = mesh.geometry;
    const attributes = Object.keys(geometry.attributes)
      .sort()
      .map((name) => `${name}:${geometry.attributes[name].itemSize}`)
      .join(',');
    const material = mesh.material as THREE.Material;
    const key = [
      apart.has(material) ? material.uuid : materialKey(material),
      mesh.castShadow,
      mesh.receiveShadow,
      mesh.renderOrder,
      geometry.index ? 'i' : 'n',
      attributes,
    ].join('|');
    const list = groups.get(key);
    if (list) list.push(mesh);
    else groups.set(key, [mesh]);
  });

  const created: THREE.BufferGeometry[] = [];
  const relative = new THREE.Matrix4();
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const parts = meshes.map((mesh) => {
      relative.multiplyMatrices(toRoot, mesh.matrixWorld);
      const part = mesh.geometry.clone().applyMatrix4(relative);
      part.clearGroups();
      return part;
    });
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    if (!merged) continue;

    const first = meshes[0];
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    root.add(mesh);
    for (const old of meshes) old.removeFromParent();
    created.push(merged);
  }
  return created;
}

function canMerge(
  object: THREE.Object3D,
  root: THREE.Object3D,
  moving: ReadonlySet<THREE.Object3D>,
): boolean {
  const mesh = object as THREE.Mesh;
  if (!mesh.isMesh || (object as THREE.InstancedMesh).isInstancedMesh) return false;
  if (!mesh.visible || Object.keys(mesh.userData).length) return false;
  if (mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return false;
  if (Array.isArray(mesh.material) || mesh.material.transparent) return false;
  if (!mesh.material.colorWrite || !mesh.material.depthWrite) return false;
  const geometry = mesh.geometry;
  // Avec un seul matériau, les groupes d'une géométrie (faces d'une boîte…) sont ignorés au dessin
  if (Object.keys(geometry.morphAttributes).length) return false;
  // Échelle négative : la fusion inverserait le sens des faces
  if (mesh.matrixWorld.determinant() < 0) return false;
  // Rien d'animé entre le maillage et la pièce
  for (let o: THREE.Object3D | null = mesh.parent; o && o !== root; o = o.parent) {
    if (moving.has(o) || !o.visible) return false;
  }
  return !moving.has(mesh);
}

const SKIPPED_KEYS = new Set(['uuid', 'id', 'name', 'version', 'userData', 'uniforms']);

/** Empreinte des réglages d'un matériau (valeurs simples, couleurs, textures par identité) */
function materialKey(material: THREE.Material): string {
  const parts: string[] = [material.type];
  for (const [key, value] of Object.entries(material)) {
    if (SKIPPED_KEYS.has(key) || key.startsWith('_') || typeof value === 'function') continue;
    if (value === null || value === undefined) parts.push(`${key}=-`);
    else if (typeof value !== 'object') parts.push(`${key}=${value}`);
    else if (value instanceof THREE.Color) parts.push(`${key}=#${value.getHexString()}`);
    else if (value instanceof THREE.Texture) parts.push(`${key}=t${value.uuid}`);
    else if (value instanceof THREE.Vector2) parts.push(`${key}=${value.x},${value.y}`);
    else if (value instanceof THREE.Euler) parts.push(`${key}=${value.x},${value.y},${value.z}`);
    // Valeurs simples regroupées (defines, plages numériques)
    else if (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype)
      parts.push(`${key}=${JSON.stringify(value)}`);
    // Autre objet (plans de découpe…) : matériau gardé tel quel
    else return material.uuid;
  }
  return parts.join(';');
}
