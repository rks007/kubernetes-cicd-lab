# kubernetes-cicd-lab

![CI](https://github.com/rks007/kubernetes-cicd-lab/actions/workflows/CI.yml/badge.svg)
![Kubernetes](https://img.shields.io/badge/Kubernetes-EKS-326CE5?logo=kubernetes&logoColor=white)
![ArgoCD](https://img.shields.io/badge/GitOps-ArgoCD-EF7B4D?logo=argo&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Container-2496ED?logo=docker&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-Metrics-E6522C?logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-Dashboards-F46800?logo=grafana&logoColor=white)
![Loki](https://img.shields.io/badge/Grafana%20Loki-Logs-F46800?logo=grafana&logoColor=white)

A Node.js/Express blog API deployed on **AWS EKS** using a secure, GitOps-driven CI/CD pipeline — built as a hands-on DevOps/SRE lab to practice production-style patterns: shift-left security scanning, SBOM generation, Kustomize environment overlays, Gateway API routing, and ArgoCD auto-sync.

The app itself is intentionally simple (JWT-authenticated blog CRUD). The point of the project is everything **around** it — the pipeline, the manifests, and the platform it runs on.

---

## Architecture

```
 developer push (master)
        │
        ▼
 ┌────────────────────────────── GitHub Actions CI ───────────────────────────────┐
 │  1. Gitleaks  → secret scan                                                    │
 │  2. Trivy fs  → filesystem/dependency vuln scan (HIGH/CRITICAL)                │
 │  3. Build     → docker build                                                   │
 │  4. Trivy img → image vuln scan                                                │
 │  5. SBOM      → source + image SBOM (SPDX-JSON via anchore/sbom-action)        │
 │  6. Push      → image tagged with commit SHA → Docker Hub                      │
 │  7. Update    → bot commits new image tag into kubernetes/application/         │
 │                  deployment.yml  [skip ci]                                     │
 └──────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
   ArgoCD detects the manifest change (automated sync + self-heal)
        │
        ▼
 ┌───────────────────────────── AWS EKS Cluster ─────────────────────────────────┐
 │  Kustomize overlays: dev/ (namePrefix dev-) · production/ (HPA, resource caps)│
 │                                                                                │
 │  Gateway API (Envoy Gateway) → HTTPRoute → blog-app Service → Deployment pods │
 │                                                     │                          │
 │                                              MongoDB (StatefulSet + PVC)      │
 │                                                                                │
 │  monitoring namespace: kube-prometheus-stack (Prometheus/Grafana/Alertmanager)│
 │                         + Loki (S3-backed, IRSA) + Alloy (DaemonSet log ship) │
 └────────────────────────────────────────────────────────────────────────────────┘
```

## Tech stack

| Layer | Tools |
|---|---|
| App | Node.js, Express, MongoDB (Mongoose), JWT auth, bcryptjs, Zod validation |
| Logging | Winston (structured JSON) + Morgan (HTTP access logs) |
| Container | Docker (`node:22-alpine`, non-root `node` user, multi-layer cache) |
| CI | GitHub Actions — Gitleaks, Trivy (fs + image), Anchore SBOM |
| Registry | Docker Hub |
| Orchestration | AWS EKS, Kustomize (base + dev/production overlays), Gateway API |
| GitOps | ArgoCD (automated sync, self-heal, prune) |
| Observability | kube-prometheus-stack, Grafana Loki, Grafana Alloy — custom dashboards |

## Project structure

```
.
├── .github/workflows/CI.yml        # scan → build → scan → SBOM → push → GitOps commit
├── Dockerfile
├── docker-compose.yml              # local app + MongoDB
├── index.js / routes/ / db/        # Express app
├── middlewares/authMiddleware.js   # JWT verification
├── inputValidation/                # Zod schemas
├── lib/logger.js                   # Winston config
├── kubernetes/
│   ├── application/                # base manifests (Deployment, Service, StatefulSet,
│   │                                #   ConfigMap, Namespace, Gateway, GatewayClass, HTTPRoute)
│   └── overlays/
│       ├── dev/                    # namePrefix dev-, dev Gateway/route/Mongo URI patches
│       └── production/             # namePrefix prod-, HPA, resource requests/limits
└── argocd/applications/            # ArgoCD Application specs (dev + production)
```

## CI/CD pipeline

Every push to `master` (excluding README/manifest-only changes) runs:

1. **Gitleaks** — scans the repo for leaked secrets
2. **Trivy (filesystem)** — scans dependencies for HIGH/CRITICAL CVEs
3. **Build & scan image** — builds the Docker image, then Trivy-scans it
4. **SBOM generation** — SPDX-JSON SBOM for both source and image, uploaded as artifacts
5. **Push** — image pushed to Docker Hub, tagged with the commit SHA
6. **GitOps update** — a bot commits the new image tag into `kubernetes/application/deployment.yml`, which ArgoCD then syncs to the cluster automatically

All scan reports (Gitleaks, Trivy fs/image, SBOMs) are uploaded as workflow artifacts for auditability.

## Kubernetes setup

- **Base** (`kubernetes/application/`) defines the app Deployment, Service, MongoDB StatefulSet + PVC, ConfigMap, and Gateway API resources (GatewayClass, Gateway, HTTPRoute via Envoy Gateway).
- **`overlays/dev`** — prefixes resources with `dev-`, patches the Gateway/HTTPRoute/Mongo URI for the dev environment.
- **`overlays/production`** — prefixes with `prod-`, adds a `HorizontalPodAutoscaler` (CPU 70% / memory 80%, 2–6 replicas) and tighter resource requests/limits via a patch.
- **ArgoCD** applications point at each overlay path with `automated: { prune: true, selfHeal: true }` — the cluster stays in sync with Git without manual `kubectl apply`.

## Observability

Deployed separately on the same EKS cluster in a `monitoring` namespace:

- **kube-prometheus-stack** — Prometheus + Grafana + Alertmanager for metrics
- **Grafana Loki** (SingleBinary mode, S3-backed storage via IRSA) for logs
- **Grafana Alloy** (DaemonSet) shipping pod logs into Loki
- Hand-built Grafana dashboards (not imported) for app and cluster visibility

## Local development

```bash
cp .example.env .env        # set MONGO_URI
docker compose up --build   # app on :3000, MongoDB on :27017
```

## API

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/user/signup` | – | Create a user |
| POST | `/api/v1/user/signin` | – | Get a JWT |
| POST | `/api/v1/user/create` | Bearer | Create a blog post |
| GET  | `/api/v1/blog` | Bearer | List all blogs |
| GET  | `/api/v1/blog/myblogs` | Bearer | List the caller's blogs |
| PUT  | `/api/v1/blog/update` | Bearer | Update a blog |
| DELETE | `/api/v1/blog` | Bearer | Delete a blog |
