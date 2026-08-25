const fs = require('fs');
const path = require('path');

async function main() {
  const { NodeIO } = await import('@gltf-transform/core');

  const src = path.join(
    __dirname,
    '..',
    '3d-assets',
    'male',
    'source',
    'hra-reference-organ-united-male-v1.5.glb'
  );
  const workingDir = path.join(__dirname, '..', '3d-assets', 'male', 'working');

  if (!fs.existsSync(src)) {
    console.error(`Source not found: ${src}`);
    process.exit(1);
  }

  fs.mkdirSync(workingDir, { recursive: true });

  // Mapping of asset name to source system node names (verified via inspection)
  // Root VH_M has 10 children: integumentary, nervous, muscular, male_reproductive, digestive, urinary, circulatory, respiratory, lymphatic, skeletal
  const assets = [
    {
      name: 'skin',
      nodes: ['VH_M_integumentary_system'],
      desc: 'Skin (integumentary system, 1 mesh)',
    },
    {
      name: 'musculoskeletal',
      nodes: ['VH_M_muscular_system', 'VH_M_skeletal_system'],
      desc: 'Musculoskeletal (muscular 27 + skeletal 91 = 118 meshes)',
    },
    {
      name: 'nervous',
      nodes: ['VH_M_nervous_system'],
      desc: 'Nervous system (363 meshes, includes brain, spinal cord, eyes)',
    },
    {
      name: 'cardiovascular',
      nodes: ['VH_M_circulatory_system'],
      desc: 'Cardiovascular (circulatory, 120 meshes)',
    },
    { name: 'respiratory', nodes: ['VH_M_respiratory_system'], desc: 'Respiratory (72 meshes)' },
    { name: 'digestive', nodes: ['VH_M_digestive_system'], desc: 'Digestive (62 meshes)' },
    { name: 'urinary', nodes: ['VH_M_urinary_system'], desc: 'Urinary (81 meshes)' },
    {
      name: 'reproductive',
      nodes: ['VH_M_male_reproductive_system'],
      desc: 'Reproductive (male, 18 meshes)',
    },
  ];

  for (const asset of assets) {
    console.log(`\n=== Processing ${asset.name} (${asset.desc}) ===`);
    const io = new NodeIO();
    const doc = await io.read(src);
    const root = doc.getRoot();
    const allNodes = root.listNodes();
    const nodeByName = new Map();
    allNodes.forEach(n => nodeByName.set(n.getName(), n));

    // Find the system nodes to keep
    const keepNodes = [];
    const keepNames = new Set();
    for (const name of asset.nodes) {
      const node = nodeByName.get(name);
      if (!node) {
        console.error(`  Node not found: ${name}`);
        continue;
      }
      keepNodes.push(node);
      keepNames.add(name);
      // Also collect all descendants
      const stack = [node];
      while (stack.length) {
        const cur = stack.pop();
        cur.listChildren().forEach(child => {
          keepNodes.push(child);
          keepNames.add(child.getName());
          stack.push(child);
        });
      }
    }

    // Also keep ancestors: VH_M and scene
    const vhM = nodeByName.get('VH_M');
    if (vhM) keepNames.add('VH_M');

    // Build set of node objects to keep (including ancestors)
    const keepSet = new Set(keepNodes);
    // Add VH_M and its hierarchy ancestors
    if (vhM) keepSet.add(vhM);
    // For musculoskeletal we have two systems, need to keep both and their children already added
    // Also need to keep the scene's root children that are ancestors

    // Now remove all top-level system nodes that are NOT in keepNames
    // The scene has one child VH_M, and VH_M has 10 children (the systems)
    // We will dispose any child of VH_M that is not in keepNames
    const toRemove = [];
    allNodes.forEach(node => {
      const name = node.getName();
      // If node is a direct child of VH_M and not in keepNames, mark for removal
      // Check if node's parent is VH_M
      const parent = node.getParentNode ? node.getParentNode() : null; // not reliable, use listParents?
      // Instead, check if node is in VH_M's children and not kept
      if (vhM && vhM.listChildren().includes(node) && !keepNames.has(name)) {
        toRemove.push(node);
      }
    });

    console.log(
      `  Keeping ${keepNames.size} named nodes, removing ${toRemove.length} top-level systems`
    );
    // Also need to handle lymphatic which is not in any of the 8 assets - it will be removed for all 8
    // For skin, we keep only integumentary, so 9 other systems will be removed

    // Dispose toRemove nodes and their subtrees
    for (const node of toRemove) {
      // Dispose recursively: need to dispose node and its children
      // Use dispose on node, but need to ensure we don't dispose nodes that are kept via other branches
      // Since systems are disjoint, it's safe to dispose the whole subtree
      const disposeRecursively = n => {
        // First dispose children
        [...n.listChildren()].forEach(child => disposeRecursively(child));
        n.dispose();
      };
      disposeRecursively(node);
    }

    // Prune unreferenced resources (meshes, materials, etc. that are no longer referenced)
    // Use document transformation: prune
    const { prune } = await import('@gltf-transform/functions');
    await doc.transform(prune());

    // Write to working dir
    const outPath = path.join(workingDir, `${asset.name}.glb`);
    await io.write(outPath, doc);
    const stat = fs.statSync(outPath);
    console.log(
      `  -> Wrote ${outPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB, ${stat.size} bytes)`
    );
    // Quick inspect
    console.log(
      `  -> Meshes: ${doc.getRoot().listMeshes().length}, Materials: ${doc.getRoot().listMaterials().length}, Nodes: ${doc.getRoot().listNodes().length}`
    );
  }

  console.log('\nAll 8 assets processed. Check 3d-assets/male/working/');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
