const fs = require('fs');
const path = require('path');

async function main() {
  const { NodeIO } = await import('@gltf-transform/core');

  const src = path.join(
    __dirname,
    '..',
    '3d-assets',
    'female',
    'source',
    'hra-reference-organ-united-female-v1.5.glb'
  );
  const workingDir = path.join(__dirname, '..', '3d-assets', 'female', 'working');

  if (!fs.existsSync(src)) {
    console.error(`Source not found: ${src}`);
    process.exit(1);
  }

  fs.mkdirSync(workingDir, { recursive: true });

  // Mapping verified via inspection of VH_F children (10 direct children)
  // VH_F children: integumentary, nervous, muscular, reproductive, digestive, urinary, circulatory, respiratory, lymphatic, skeletal
  const assets = [
    {
      name: 'skin',
      nodes: ['VH_F_integumentary_system'],
      desc: 'Skin (integumentary, includes breast)',
    },
    {
      name: 'musculoskeletal',
      nodes: ['VH_F_muscular_system', 'VH_F_skeletal_system'],
      desc: 'Musculoskeletal (muscular + skeletal)',
    },
    {
      name: 'nervous',
      nodes: ['VH_F_nervous_system'],
      desc: 'Nervous system',
    },
    {
      name: 'cardiovascular',
      nodes: ['VH_F_circulatory_system'],
      desc: 'Cardiovascular (circulatory)',
    },
    { name: 'respiratory', nodes: ['VH_F_respiratory_system'], desc: 'Respiratory' },
    { name: 'digestive', nodes: ['VH_F_digestive_system'], desc: 'Digestive' },
    { name: 'urinary', nodes: ['VH_F_urinary_system'], desc: 'Urinary' },
    {
      name: 'reproductive',
      nodes: ['VH_F_reproductive_system'],
      desc: 'Reproductive (female, includes ovary/uterus/cervix/vagina/fallopian/broad ligament)',
    },
    {
      name: 'lymphatic',
      nodes: ['VH_F_lymphatic_system'],
      desc: 'Lymphatic (minimal)',
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

    const vhF = nodeByName.get('VH_F');
    if (vhF) keepNames.add('VH_F');

    const keepSet = new Set(keepNodes);
    if (vhF) keepSet.add(vhF);

    const toRemove = [];
    allNodes.forEach(node => {
      const name = node.getName();
      if (vhF && vhF.listChildren().includes(node) && !keepNames.has(name)) {
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

  console.log('\nAll 9 female assets processed. Check 3d-assets/female/working/');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
