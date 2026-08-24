# AnatomiaX - Project Rules

## General

- Use TypeScript where appropriate.
- Keep frontend and backend separate.
- Keep shared code inside `frontend/packages` and `backend/packages`.
- Keep medical content separate from application code (`medical-data/`).
- Keep 3D assets separate from source code (`3d-assets/`).
- Keep large assets optimized.
- Do not change unrelated files.
- Make one simple commit for one completed piece of work.
- Run the relevant checks before reporting completion.

## Security

- Never commit API keys or passwords.
- Never expose API keys in frontend code.
- Never create fake medical information.
- Validate all medical content against trusted sources.

## Code Quality

- Use Prettier for formatting (`npm run format`).
- Keep setup clean and simple.
- Follow npm workspaces structure.
- Document architecture decisions in `docs/`.

## Workflow

- Inspect existing repository before making changes.
- Do not delete existing work unless clearly empty/unwanted.
- Verify folder structure and package configuration after changes.
