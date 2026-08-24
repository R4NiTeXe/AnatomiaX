# Download Anatomy Assets — Male Whole-Body

Large GLB files are **not stored in Git** to keep the repository small and to respect the official source.

## Why

- The original NIH/HRA whole-body GLB is ~146 MB and would bloat Git history
- The file is kept locally at `3d-assets/male/source/hra-reference-organ-united-male-v1.5.glb` and is ignored via `.gitignore` (`3d-assets/male/source/*.glb`)
- It can be reproduced at any time from the official source and verified by checksum

## Official source

- NIH 3D entry: https://3d.nih.gov/entries/3DPX-021022
- HRA PURL: https://purl.humanatlas.io/ref-organ/united-male/v1.5
- Direct official download URL used by this script: `https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.5/assets/3d-vh-m-united.glb` (official HRA CDN, same content as NIH download `https://3d.nih.gov/entries/download/21022/1.01`)
- Collection: Human Reference Atlas 3D Reference Object Library

## Exact version

- HRA v1.5
- NIH entry v1.01 (Created 2024-03-06, Published 2025-08-05)
- Generator: `babylon.js glTF exporter for Autodesk MAYA 2023.2 v20220923.2`, glTF 2.0

## Exact SHA-256

- `34C45C90AA4ACD36BE19EDF8B878A8E7137DB9E8CB90E8E6332C2ABD49D7CF9D` (verified from official download, 153596592 bytes)

## How to download

From the project root:

```bash
node scripts/download-anatomy-assets/download.js
```

The script will:

- use only the official HRA CDN URL (no mirrors)
- preserve the original filename `hra-reference-organ-united-male-v1.5.glb`
- create `3d-assets/male/source/` if missing
- skip download if the local file already exists and matches the SHA-256
- verify the SHA-256 after download and fail if it does not match
- report success or failure clearly

Manual alternative (if you prefer):

```bash
curl -L -o 3d-assets/male/source/hra-reference-organ-united-male-v1.5.glb \
  https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.5/assets/3d-vh-m-united.glb
sha256sum 3d-assets/male/source/hra-reference-organ-united-male-v1.5.glb
# must equal 34C45C90AA4ACD36BE19EDF8B878A8E7137DB9E8CB90E8E6332C2ABD49D7CF9D
```

## License

- **CC BY 4.0** (`https://creativecommons.org/licenses/by/4.0/`) per NIH 3D entry badge and HRA-wide `All data is CC-BY 4.0 Licensed`
- Modification allowed, redistribution allowed with attribution
- Attribution must include Human Reference Atlas (HRA), NIH 3D `3DPX-021022`, PURL, and CC-BY 4.0 link — see `3d-assets/male/SOURCE.md` and `3d-assets/SOURCES.md`

## License/source record

The record must stay with the project:

- `3d-assets/male/SOURCE.md` — per-model record (file size, SHA, download URL, version, attribution)
- `3d-assets/SOURCES.md` — index of all candidate assets
- `docs/architecture/hra-source.md` — full research for HRA source
- `docs/architecture/3d-assets.md` — naming, placement, loading flow, approved candidate and first asset sections

Do not remove these records when re-downloading.

## Status

- Male whole-body: `hra-reference-organ-united-male-v1.5.glb` — Downloaded locally, verified, not in Git, reproducible via this script
- Female whole-body: not yet downloaded (candidate `hra-reference-organ-united-female-v1.5.glb` still research only)
