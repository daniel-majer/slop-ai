# Security

## Reporting a vulnerability

Use the repository's **Security → Advisories → Report a vulnerability** button
to contact the maintainers privately. Include the affected revision, reproduction
steps, impact and a minimal proof of concept without real credentials or personal
data. Do not post an exploitable vulnerability in a public issue or pull request.

If the button is unavailable on a fork, ask its owner to enable a private
reporting channel without disclosing exploit details.

Fixes target the current default branch. Older releases do not have a separate
patch-support commitment.

## Deployment boundary

The API currently exposes only health endpoints and has **no authentication or
authorization**. Add access control together with the first endpoint that reads
or writes real data. CORS and Helmet are not access control.

Before a real deployment, configure TLS, application-specific access control
and rate limits, secrets, database backups and a tested restore procedure,
monitoring and alerting. Keep the stores private, retain the restricted runtime
database role, and review migrations for compatibility with application rollbacks.
Changing an image tag does not roll back a database migration.

Enable dependency updates and review the resulting PRs. `renovate.json` is
configuration only: the Renovate GitHub App (or a self-hosted runner) must be
enabled separately. CI passing is useful evidence, not a security certification.
