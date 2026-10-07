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

    const vhM = nodeByName.get('VH_M');
    if (vhM) keepNames.add('VH_M');

    const keepSet = new Set(keepNodes);
    if (vhM) keepSet.add(vhM);

    const toRemove = [];
    allNodes.forEach(node => {
      const name = node.getName();
      if (vhM && vhM.listChildren().includes(node) && !keepNames.has(name)) {
        toRemove.push(node);
      }
    });

    console.log(
      `  Keeping ${keepNames.size} named nodes, removing ${toRemove.length} top-level systems`
    );

    for (const node of toRemove) {
      const disposeRecursively = n => {
        [...n.listChildren()].forEach(child => disposeRecursively(child));
        n.dispose();
      };
      disposeRecursively(node);
    }

    const { prune } = await import('@gltf-transform/functions');
    await doc.transform(prune());

    const outPath = path.join(workingDir, `${asset.name}.glb`);
    await io.write(outPath, doc);
    const stat = fs.statSync(outPath);
    console.log(
      `  -> Wrote ${outPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB, ${stat.size} bytes)`
    );
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
