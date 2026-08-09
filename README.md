# JRAltd Workshop

A general-purpose workspace repo for standalone apps, tools, scripts, and experiments — anything built solo or with Claude Code (local or cloud sessions).

## Structure

```
JRAltd-Workshop/
├── projects/
│   ├── project-one/
│   ├── project-two/
│   └── ...
├── README.md
└── .gitignore
```

Each project lives in its own folder under `projects/`. Keep each one self-contained: its own README, dependencies, and (if needed) its own `.gitignore` additions.

## Starting a new project

1. Create a new folder under `projects/` — use a short, lowercase, hyphenated name (e.g. `refrigerant-pricing-tool`).
2. Add a `README.md` inside it describing what it does.
3. If it's a Claude Code cloud session, point the session at `projects/<your-folder>` so it stays scoped to that project instead of the whole repo.

## Conventions

- One project = one folder. Don't mix unrelated tools in the same folder.
- Keep secrets, API keys, and credentials out of the repo — use `.env` files (already gitignored) or your local environment.
- Prefer a short README per project over long inline comments — future-you will thank present-you.
