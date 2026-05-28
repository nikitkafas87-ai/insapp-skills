# HTML Push Publishing Notes

## Defaults

- Visibility: public.
- Branch: `main`.
- Pages source: `/` root.
- Default index repo: `<owner>/reports-index`.

## Repo Name Sanitizing

- Lowercase.
- Keep `a-z`, `0-9`, and hyphen.
- Transliterate or simplify Cyrillic names.
- Collapse repeated hyphens and trim leading/trailing hyphens.

## Reports Index

When updating `reports-index`, edit the remote repository contents, not the local `reports_index.md` artifact.

If the row already exists for the report URL, update date and visible metadata. If it does not exist, add a new row before `</tbody>`.

Do not echo passwords in final answers. If the index intentionally stores a report password as part of its UI, write only the required repository content and keep chat output redacted.

## GitHub Pages Build Status

Check the Pages build after pushing:

- `building`: wait and check again.
- `built`: success.
- `errored`: delete/recreate Pages configuration or repush a minimal `index.html`, then check again.

Never finish with only "push succeeded"; Pages can still fail after the git push.

