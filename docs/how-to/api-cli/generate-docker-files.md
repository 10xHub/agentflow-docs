---
title: Generate Docker Files
description: How to use agentflow build to generate a Dockerfile and docker-compose.yml.
---

# Generate Docker files

`agentflow build` generates a `Dockerfile` configured to run the API server. Add `--docker-compose` to also generate a `docker-compose.yml`.

## Requirements

Run `agentflow build` from the folder that contains `agentflow.json`.

## Minimal Dockerfile

```bash
agentflow build
```

This creates a `Dockerfile` using Python 3.13 and exposes port 8000.

To see the generated file:

```bash
cat Dockerfile
```

## With docker-compose

```bash
agentflow build --docker-compose --service-name my-agent
```

Creates both `Dockerfile` and `docker-compose.yml`. The `Dockerfile` omits the `CMD` instruction; `docker-compose.yml` provides the command instead.

## Options reference

| Option | Default | Description |
| --- | --- | --- |
| `--output`, `-o` | `Dockerfile` | Output path |
| `--force`, `-f` | `false` | Overwrite existing files |
| `--python-version` | `3.13` | Python base image version |
| `--port`, `-p` | `8000` | Port to expose |
| `--docker-compose` | off | Also generate `docker-compose.yml` |
| `--service-name` | `agentflow-cli` | Service name in `docker-compose.yml` |

## Custom Python version

```bash
agentflow build --python-version 3.12
```

## Overwrite existing files

```bash
agentflow build --force
```

## Build and run the container

After generating the `Dockerfile`:

```bash
# Build the image
docker build -t my-agent .

# Run the container
docker run -p 8000:8000 --env-file .env my-agent
```

With `docker-compose.yml`:

```bash
docker compose up
```

## Environment variables in Docker

Pass your environment variables via an env file or Docker secrets. Do not embed secrets in the `Dockerfile`.

```bash
docker run -p 8000:8000 \
  -e GOOGLE_API_KEY=your-key \
  -e JWT_SECRET_KEY=your-secret \
  -e MODE=production \
  my-agent
```

Or with an env file:

```bash
docker run -p 8000:8000 --env-file .env.prod my-agent
```

## Health check

The generated container can be health-checked using the `/ping` endpoint:

```yaml
# In your docker-compose.yml or Kubernetes config
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/ping"]
  interval: 30s
  timeout: 5s
  retries: 3
```
