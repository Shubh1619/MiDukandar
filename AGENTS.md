# Dev Workflow Rules

- After any code changes, restart the Docker stack so the running app picks up the new code.
  For example: `docker compose -f docker-compose.yml up -d --build`