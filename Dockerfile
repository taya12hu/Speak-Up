# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv
#
# (The skipped check only flags VITE_SUPABASE_PUBLISHABLE_KEY, which is public by design: it ships in
# the browser bundle. Real secrets are runtime environment variables only, never build args.)
#
# Production image: Express API + built React client + whisper.cpp, served from one origin.
#   docker build -t speak-up --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=... .
#   docker run -p 4000:4000 --env-file server/.env speak-up
# On Render, dashboard environment variables are passed to the build as build args automatically.

ARG NODE_IMAGE=node:22-bookworm-slim

# --- whisper.cpp: compile the CLI and fetch a checksum-verified model ----------------------------
FROM ${NODE_IMAGE} AS whisper
ARG WHISPER_CPP_VERSION=v1.9.4
# base.en is more accurate; tiny.en is ~2-3x faster, for small CPU allowances (see README: Deploying).
ARG WHISPER_MODEL=base.en
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential cmake git ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 --branch "${WHISPER_CPP_VERSION}" https://github.com/ggml-org/whisper.cpp.git .
# Static, portable build: not tuned to the build machine (GGML_NATIVE=OFF) but with AVX2/FMA, which
# every current cloud x86-64 CPU supports. No OpenMP, so the runtime image needs no extra libraries.
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
      -DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON -DGGML_BMI2=ON \
      -DGGML_OPENMP=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF -DWHISPER_SDL2=OFF \
 && cmake --build build --config Release --target whisper-cli -j"$(nproc)" \
 && mkdir -p /out/bin /out/models \
 && cp build/bin/whisper-cli /out/bin/
# Pinned SHA-256s of the Hugging Face LFS objects; any other model name fails the build.
RUN case "${WHISPER_MODEL}" in \
      base.en) sha=a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002 ;; \
      tiny.en) sha=921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f ;; \
      *) echo "Unsupported WHISPER_MODEL '${WHISPER_MODEL}' (use base.en or tiny.en)" >&2; exit 1 ;; \
    esac \
 && curl -fsSL -o "/out/models/ggml-${WHISPER_MODEL}.bin" \
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${WHISPER_MODEL}.bin" \
 && echo "${sha}  /out/models/ggml-${WHISPER_MODEL}.bin" | sha256sum -c -

# --- client: type-check and build the static bundle ---------------------------------------------
FROM ${NODE_IMAGE} AS client
# Public values baked into the bundle (never put the service-role key here).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN test -n "${VITE_SUPABASE_URL}" && test -n "${VITE_SUPABASE_PUBLISHABLE_KEY}" \
      || (echo "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set at build time" >&2; exit 1)
RUN VITE_SUPABASE_URL="${VITE_SUPABASE_URL}" VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY}" npm run build

# --- server: production dependencies only ------------------------------------------------------
FROM ${NODE_IMAGE} AS server
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# --- runtime -----------------------------------------------------------------------------------
FROM ${NODE_IMAGE}
ARG WHISPER_MODEL=base.en
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    WHISPER_MODEL_PATH=/app/whisper/models/ggml-${WHISPER_MODEL}.bin
WORKDIR /app
# Layout matches the repository, so config.js defaults resolve without extra variables:
#   /app/server (API), /app/client/dist (static client), /app/whisper/{bin,models}.
COPY --from=server /app/server/node_modules ./server/node_modules
COPY server/package.json ./server/
COPY server/src ./server/src
COPY --from=client /app/client/dist ./client/dist
COPY --from=whisper /out/bin/whisper-cli ./whisper/bin/whisper-cli
COPY --from=whisper /out/models ./whisper/models
# Temporary uploads are the only thing written at runtime; run as the unprivileged node user.
RUN mkdir -p server/data/tmp && chown -R node:node server/data
USER node
EXPOSE 4000
CMD ["node", "server/src/index.js"]
