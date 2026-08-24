# 3D Assets — Source and License Record

Every external 3D asset must be recorded here before it is added to the repository.

## Rules

- Do not add random downloaded medical models
- Verify license for AnatomiaX public use
- Check commercial use, attribution, and redistribution rights
- Keep the original source link
- Optimize the GLB before committing (Draco/meshopt, textures, topology)
- Prefer `.glb` with descriptive hyphen names

## Template

Copy the block below for each asset:

```
Asset:
Source:
Author:
License:
Allowed use:
Attribution:
Notes:
```

Example (placeholder, not a real asset):

```
Asset: male-body.glb
Source: https://example.com/male-body
Author: Example Studio
License: CC-BY 4.0
Allowed use: Commercial, attribution required
Attribution: "Male Body by Example Studio (CC-BY 4.0)"
Notes: Optimized to 4.2MB, Draco compressed, 2K textures
```

## Current Assets

No external assets have been added yet. All model paths in `frontend/web/src/components/anatomy/anatomyAssets.ts` are marked `available: false`.
