---
title: Deploy on Kubernetes — Production how-to
sidebar_label: Deploy on Kubernetes
description: Generate a Deployment and Service with agentflow build --k8s, and configure grace periods, probes, and scaling so a rolling deploy never truncates an in-flight agent run.
keywords:
  - agentflow kubernetes
  - deploy ai agent kubernetes
  - agentflow build k8s
  - agent rolling deploy
  - kubernetes graceful shutdown
---

# Deploy on Kubernetes

Agent runs are long. A single request can hold an LLM call, several tool calls,
and a stream open for minutes. That makes the default Kubernetes lifecycle
hostile: a 30-second termination grace period kills a pod mid-run on every
rolling deploy.

`agentflow build --k8s` generates a manifest with those numbers already set
correctly.

## Prerequisites

- A working [container image](../api-cli/generate-docker-files.md)
- A cluster and `kubectl` context
- Shared Redis and Postgres, reachable from the cluster. Multiple replicas
  without shared persistence is the most common production mistake. See
  [checkpointing](checkpointing.md).

---

## Generate the manifest

```bash
agentflow build --docker-compose --k8s --service-name my-agent --port 8000
```

This writes `k8s.yaml` next to the `Dockerfile`, containing a Deployment and a
Service. Use `--force` to regenerate over an existing file.

The generated Deployment sets three things that matter and are easy to get
wrong:

| Setting | Value | Why |
| --- | --- | --- |
| `terminationGracePeriodSeconds` | `660` | Must exceed the app's own graceful timeout (`600`s). If it is shorter, the kubelet sends SIGKILL while the pod is still draining. |
| `preStop` sleep | `15`s | Gives the load balancer time to notice the pod is terminating and stop routing new requests. Without it, SIGTERM and endpoint removal happen concurrently, so requests still arrive at a pod that has begun shutting down. |
| `livenessProbe` | `periodSeconds: 30`, `failureThreshold: 5` | Deliberately slack. A worker busy with a long run must not be mistaken for a hung one and restarted. |

The readiness probe is what takes a pod out of rotation, and it is tighter
(`periodSeconds: 10`) because that is the safe direction to be aggressive in.
Both probes hit [`/ping`](../../reference/rest-api/ping.md).

---

## What you must edit before applying

The generated manifest is a correct skeleton, not a finished deployment. Change
these:

```yaml
image: agentflow-cli:latest        # -> your registry and an immutable tag
env:
  - name: ORIGINS
    value: "https://your-frontend.example.com"   # -> your real origin
```

- **Pin the image.** `latest` makes rollbacks meaningless. Use a digest or a
  version tag.
- **Set real origins.** Production refuses to start with wildcard CORS and
  credentials enabled.
- **Add your secrets.** The manifest carries no API keys by design. Mount them
  from a `Secret`, never bake them into the image:

```yaml
envFrom:
  - secretRef:
      name: agentflow-secrets
```

with, for example, `GOOGLE_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET_KEY`,
`DATABASE_URL`, and `REDIS_URL`. See
[environment variables](environment-variables.md).

---

## Apply and verify

```bash
kubectl apply -f k8s.yaml
kubectl rollout status deployment/my-agent
kubectl port-forward svc/my-agent 8000:80
curl http://127.0.0.1:8000/ping
```

Then verify the property that actually matters: that a deploy does not truncate a
run.

```bash
# Start a long streaming run against the service, then in another shell:
kubectl rollout restart deployment/my-agent
```

The in-flight stream should finish normally. If it dies, your grace period is
shorter than the run, or the app is not receiving SIGTERM as PID 1.

---

## Scaling

The default is `replicas: 2`. Before raising it:

1. **Shared state is mandatory.** Every replica must point at the same Postgres
   and Redis, or a thread will resolve differently depending on which pod answers.
2. **Threads are not sticky and do not need to be.** State lives in the
   checkpointer, not in the pod. You do not need session affinity for REST calls.
3. **Streaming connections are long-lived.** Set your ingress and load balancer
   idle timeouts above your longest expected run, or the proxy will cut the
   stream even though the pod is healthy.
4. **Concurrent writes to one thread now conflict loudly.** With optimistic
   concurrency, the losing write raises `StaleStateError` and the API returns
   409. Clients that fan out against one `thread_id` should serialise or retry.

For horizontal autoscaling, scale on CPU only if your agents are compute-bound.
Most are latency-bound on the model provider, so queue depth or request
concurrency is the better signal.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-agent
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-agent
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleDown:
      # Long runs need time to drain before a pod disappears.
      stabilizationWindowSeconds: 900
```

---

## Common mistakes

| Symptom | Cause |
| --- | --- |
| Runs truncate on every deploy | `terminationGracePeriodSeconds` lowered below the app's graceful timeout, or the process is not PID 1 and never sees SIGTERM |
| Requests fail for a few seconds during a deploy | `preStop` sleep removed, so the load balancer still routes to a terminating pod |
| Pods restart during long runs | Liveness probe tightened. Loosen it; the readiness probe is the one that should be strict |
| Thread history disappears between requests | Replicas do not share a checkpointer, or `InMemoryCheckpointer` is still configured |
| Random 409 responses under load | Expected: two runs wrote to one thread. Serialise or retry. See [upgrade to 1.0](../../project/upgrade-to-1.0.md) |
| Server exits at startup with a CORS error | Wildcard `ORIGINS` with credentials enabled in production |

## Related

- [Deployment](deployment.md) for the general production model
- [Generate Docker files](../api-cli/generate-docker-files.md)
- [Backup and restore](backup-and-restore.md)
- [Logging and metrics](logging-and-metrics.md)
