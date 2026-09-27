# reviews

Whole-repository reports, one Markdown file per report, named `<YYYY-MM-DD>-<kind>.md`. The `status-report` skill in the `platonic-coder` plugin writes `kind: status` reports (what was done, and what is open), and `architecture-review` writes `kind: architecture` reports. The header (`title`, `kind`, `date`, `commit`, `summary`) is what the platonic-coder dashboard lists.

A report records the repository at one commit and is not edited afterwards. The next report of the same kind says what changed since. Open items from a report become tickets in `tickets/`, with `kind: question` for a decision.
