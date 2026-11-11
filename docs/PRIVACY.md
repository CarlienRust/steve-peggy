# Privacy — hosted Peggy

Peggy’s API, files and vectors run on third-party hosts. This page is what is true today, not a legal opinion. Check your institution before sending participant data.

## Data classes

| Class | Examples | Rule |
|-------|----------|------|
| A | Public literature titles, abstracts, public full text | May go to Qdrant Cloud and the configured LLM |
| B | Aim, plans, notes, findings text, chat | Stored in Supabase and Qdrant Cloud. Sent to the LLM on **standard** projects |
| C | Table rows, identifiers, free text with names | Must stay in the browser. The API rejects `analysisTool.rows` |
| D | Counts, means, missingness | May be stored; sent to an LLM only on **standard** |

## Where it lives

| Service | Holds |
|---------|--------|
| Render | FastAPI process, logs (IDs and error types only) |
| Supabase | Auth, Postgres catalog, private Storage bucket `peggy-uploads` |
| Qdrant Cloud | Literature and findings chunks, filtered by `user_id` and `workspace_id` |
| Google Gemini | Prompt text when `LLM_PROVIDER=gemini`; literature/findings chunk text when `EMBEDDING_BACKEND=gemini` |

On Render, embeddings default to **hash** unless `EMBEDDING_BACKEND` is set otherwise. Hash vectors are not semantic. Gemini embed calls use class A for literature and class B for own findings; `strict` skips findings embed. Chunk text is not written to logs.

Analysis table rows stay in IndexedDB on the researcher’s browser (“stored in this browser only”). The API stores dataset label, headers, roles, types, and aggregates. Sharing that summary is class D, confirm each time, and is blocked on unpaid Gemini and strict projects.

## Project privacy mode

- **standard (default for new projects):** Ask Peggy and planners stay on. Project text may go to the configured provider. Turn off training in that provider account (table below). Peggy cannot verify the setting.
- **strict (AI help off):** no LLM on class B or D. Retrieval and structured features still run. Use this only when the project must not send aim, plans, findings, or dataset summaries to a hosted model.

Set the mode on create (setup step 4 or New project). Change it later from the profile menu at the bottom of the sidebar: **Peggy AI settings** (after Update profile and Settings). That dialog is per active project. There is no separate project-settings page.

Peggy cannot see your Google (or other) account. Turn off training or activity yourself.

Own keys: stored as Fernet ciphertext in `user_llm_settings` on the API only. Default is platform Gemini with `GEMINI_API_KEY`. OpenAI-compatible calls set `store: false`. Anthropic API traffic is not used for training by default. Gemini Keep Activity is still a Google-account setting.

## Free-tier training opt-out

Peggy does not control these settings. Terms can change.

| Platform | Free opt-out? | How |
|----------|---------------|-----|
| Claude | Yes | Settings → Privacy → Help improve Claude |
| ChatGPT | Yes | Settings → Data Controls → Improve the model for everyone → Off |
| Google Gemini | Yes | Turn off Keep Activity |
| Microsoft Copilot | Yes | Privacy → Training on conversation activity → Off |
| Perplexity | Yes | Turn off AI Data Retention |
| Meta AI | Limited | Objection mechanisms exist in some regions |

## Delete

- Delete a project: catalog, Storage prefix, and Qdrant points for that project.
- `DELETE /account`: all projects then the auth user (service role).
- Database backups may still hold old `analysisTool.rows` until they expire.

Accept de-identified or aggregate data only. Confirm ethics and cross-border rules before use.
