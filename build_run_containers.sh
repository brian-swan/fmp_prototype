#!/bin/bash
podman build -t fmp-api ./fmp_api
podman run -d -p 8000:8000 fmp-api

podman build -t fmp-ui ./ui --log-level=debug --no-cache
podman run -d -p 3000:3000 fmp-ui

podman ps