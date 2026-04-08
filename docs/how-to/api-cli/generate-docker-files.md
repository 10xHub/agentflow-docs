---
title: Generate Docker Files
description: How to use agentflow build to generate a Dockerfile and docker-compose.yml.
---

# Generate Docker files

`agentflow build` generates production-ready containerization files for your agent. This guide covers building, running, and deploying containers.

## Prerequisites

- Docker installed and running (`docker --version`)
- `agentflow.json` file in your project directory
- All your project files (graph code, dependencies, etc.)

## Generate a Dockerfile

From the folder containing `agentflow.json`:

```bash
agentflow build
```

This creates a `Dockerfile` with:
- Python 3.13 base image
- Your project dependencies installed from `requirements.txt`
- Port 8000 exposed
- The API server running on startup

### View the generated file

```bash
cat Dockerfile
```

The generated `Dockerfile` includes:

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
EXPOSE 8000
CMD ["agentflow", "api", "--host", "0.0.0.0"]
```

## Generate with docker-compose

For local multi-container setups:

```bash
agentflow build --docker-compose
```

This creates both `Dockerfile` and `docker-compose.yml`. In this mode, the `Dockerfile` omits the `CMD` instruction because `docker-compose.yml` controls the startup:

```bash
agentflow build --docker-compose --service-name my-agent
```

The generated `docker-compose.yml` looks like:

```yaml
version: '3.8'
services:
  my-agent:
    build: .
    ports:
      - "8000:8000"
    environment:
      - MODE=production
    command: agentflow api --no-reload
```

## Build options

| Option | Default | Description |
| --- | --- | --- |
| `--output / -o` | `Dockerfile` | Output path for the Dockerfile |
| `--force / -f` | `false` | Overwrite existing files |
| `--python-version` | `3.13` | Python version in the `FROM` line (e.g., `3.12`, `3.11`) |
| `--port / -p` | `8000` | Port to expose in the image |
| `--docker-compose` | off | Also generate `docker-compose.yml` |
| `--service-name` | `agentflow-cli` | Service name in `docker-compose.yml` |

## Customize the Python version

If you need Python 3.12:

```bash
agentflow build --python-version 3.12
```

If you need Python 3.11:

```bash
agentflow build --python-version 3.11
```

## Customize the exposed port

If your agent runs on a different port:

```bash
agentflow build --port 8080
```

This changes the `EXPOSE 8080` line in the Dockerfile. When running the container, you must map the same port:

```bash
docker run -p 8080:8080 my-agent
```

## Overwrite existing files

If you already have a `Dockerfile` and want to regenerate it:

```bash
agentflow build --force
```

Be careful — this overwrites any customizations you made to the Dockerfile.

## Building the Docker image

### Simple build

```bash
docker build -t my-agent:latest .
```

This:
1. Reads the `Dockerfile`
2. Installs dependencies from `requirements.txt`
3. Tags the image as `my-agent:latest`
4. Stores it in your local Docker daemon

Verify the image exists:

```bash
docker images | grep my-agent
# Output: my-agent    latest    abc123...    ago    200MB
```

### Build with a version tag

```bash
docker build -t my-agent:v1.0 .
```

Then push to a registry (Docker Hub, AWS ECR, etc.):

```bash
docker tag my-agent:v1.0 your-registry/my-agent:v1.0
docker push your-registry/my-agent:v1.0
```

### Speed up builds (caching)

Docker caches image layers. If you only changed Python code (not dependencies), the build reuses the cached dependency layer:

```bash
# First build (installs dependencies, ~1 minute)
docker build -t my-agent .

# Second build (reuses cached dependencies, ~10 seconds)
docker build -t my-agent .
```

If you change `requirements.txt`, Docker rebuilds the dependency layer.

## Running the container

### Simple run

```bash
docker run -p 8000:8000 my-agent:latest
```

This:
- Runs the image in a container
- Maps port 8000 inside the container to port 8000 on your machine
- Shows logs in the terminal

Test it:

```bash
curl http://127.0.0.1:8000/ping
```

### Run in the background

```bash
docker run -d -p 8000:8000 --name my-agent-1 my-agent:latest
```

This:
- `-d` — Detach (run in background)
- `--name my-agent-1` — Give the container a name

View logs:

```bash
docker logs -f my-agent-1  # -f to follow new logs
```

Stop the container:

```bash
docker stop my-agent-1
```

### Pass environment variables

Do NOT embed secrets in the Dockerfile or container. Pass them at runtime:

```bash
docker run -p 8000:8000 \
  -e GOOGLE_API_KEY=your-key \
  -e JWT_SECRET_KEY=your-secret \
  -e MODE=production \
  my-agent:latest
```

Or load from a file:

```bash
docker run -p 8000:8000 --env-file .env.prod my-agent:latest
```

### Mount a volume

For development, mount your local files into the container:

```bash
docker run -p 8000:8000 \
  -v $(pwd)/graph:/app/graph \
  my-agent:latest
```

Changes to your local `graph/` directory are immediately visible inside the container (if you have `--reload` enabled).

## Using docker-compose

### Start the service

```bash
docker compose up
```

This:
1. Builds the image (if not already built)
2. Starts the container
3. Shows logs in the terminal

### Run in the background

```bash
docker compose up -d
```

### View logs

```bash
docker compose logs -f
```

### Stop and remove

```bash
docker compose down
```

### Scale to multiple replicas

```yaml
# docker-compose.yml
version: '3.8'
services:
  my-agent:
    build: .
    deploy:
      replicas: 3
    ports:
      - "8000:8000"  # Load balance across replicas
```

## Health checks

Docker can automatically restart unhealthy containers.

### In Docker

```bash
docker run -p 8000:8000 \
  --health-cmd="curl -f http://localhost:8000/ping || exit 1" \
  --health-interval=30s \
  --health-timeout=5s \
  --health-retries=3 \
  my-agent:latest
```

### In docker-compose

```yaml
version: '3.8'
services:
  my-agent:
    build: .
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/ping"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

Docker considers the container `healthy` if `/ping` returns HTTP 200. Docker restarts the container if it fails the health check 3 times in a row.

## Production best practices

### 1. Use a slim base image

The generated Dockerfile uses `python:3.13-slim`, which is lightweight (~150MB vs ~900MB for the full image). For even smaller images, use `python:3.13-alpine` (but Alpine has some compatibility issues).

### 2. Disable auto-reload in containers

The generated Dockerfile uses `--no-reload`, which is correct for production. Auto-reload is expensive and unreliable in containers.

### 3. Set production environment

```bash
docker run -e MODE=production my-agent:latest
```

This disables verbose logging and enables optimizations.

### 4. Use multi-stage builds for smaller images

For larger projects, reduce image size by separating build dependencies from runtime dependencies:

```dockerfile
# Stage 1: Build
FROM python:3.13 as builder
RUN pip install --user -r requirements.txt

# Stage 2: Runtime
FROM python:3.13-slim
COPY --from=builder /root/.local /root/.local
COPY . /app
WORKDIR /app
CMD ["agentflow", "api", "--host", "0.0.0.0", "--no-reload"]
```

### 5. Use a reverse proxy with HTTPS

Run nginx in front of the agent container to handle HTTPS, rate limiting, and load balancing:

```yaml
# docker-compose.yml
version: '3.8'
services:
  nginx:
    image: nginx:latest
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./cert.pem:/etc/nginx/cert.pem
      - ./key.pem:/etc/nginx/key.pem
    depends_on:
      - my-agent

  my-agent:
    build: .
    ports:
      - "8000:8000"
```

### 6. Vulnerability scanning

Before pushing to production, scan the image for known vulnerabilities:

```bash
docker scan my-agent:latest
# or with Trivy
trivy image my-agent:latest
```

## Deployment scenarios

### Local testing

```bash
docker build -t my-agent .
docker run -p 8000:8000 --env-file .env.dev my-agent
```

### AWS ECS

Push to AWS ECR:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker tag my-agent:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/my-agent:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/my-agent:latest
```

Then reference the image in your ECS task definition.

### Kubernetes

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-agent
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: my-agent
        image: my-agent:latest
        ports:
        - containerPort: 8000
        env:
        - name: MODE
          value: production
        - name: GOOGLE_API_KEY
          valueFrom:
            secretKeyRef:
              name: agent-secrets
              key: google-api-key
        livenessProbe:
          httpGet:
            path: /ping
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
```

### Heroku / Railway / Render

These platforms automatically use your `Dockerfile` during deployment:

```bash
git push heroku main  # Or git push railway main
```

The platform:
1. Builds the Docker image
2. Runs the container
3. Maps the container port to a public URL
4. Manages SSL/HTTPS

## Troubleshooting

**"ERROR: failed to solve: rpc error: code = UNKNOWN desc = failed to solve with frontend dockerfile.v0"**
- Docker daemon may not be running. Start Docker Desktop or `systemctl start docker`.

**"Connection refused" when calling the container**
- Verify port mapping is correct: `docker run -p <host>:<container>`
- Verify the container is still running: `docker ps`
- Check logs: `docker logs <container-id>`

**Container is running but API is slow**
- Check CPU/memory usage: `docker stats`
- Verify the graph logic is efficient (no infinite loops, slow external calls)
- Increase container resources: `docker run -m 2g --cpus 2 my-agent`

**"requirements.txt not found"**
- Verify `requirements.txt` exists in the project root
- Verify you are running `agentflow build` from the project root
