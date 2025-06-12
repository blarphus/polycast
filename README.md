# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create an `.env.local` file in the project root and set your `GEMINI_API_KEY`.
3. Create `polycast-backend/.env.local` with values for `OPENAI_API_KEY` and `DATABASE_URL`.
4. Run the app:
   `npm run dev`

## Development Workflow

We keep the codebase consistently formatted and lint-clean so that AI code-assistants can parse it easily.

| Command | Purpose |
|---------|---------|
| `npm run format` | Apply Prettier formatting to all source files |
| `npm run format:check` | Check that files are already formatted (CI) |
| `npm run lint` | Run ESLint with TypeScript + Lit rules |

If you contribute code, **always run** `npm run format && npm run lint` before committing.  Our CI will fail otherwise.

The configuration lives in `.prettierrc.json` and `.eslintrc.cjs`.  Feel free to tweak rules in future refactor steps.
