# Quickstart & Validation Guide: Secure e-webui

**Feature**: `001-e-webui`  
**Date**: 2026-11-04  
**Status**: Ready for Implementation  

This guide specifies end-to-end verification steps to validate that the e-webui service, container networking, and auto-start mechanisms work correctly.

---

## 1. Prerequisites

1. An active Incus daemon on the host machine.
2. The `ollama` container running with the model `qwen3.5:4b` available:
   ```bash
   incus exec ollama -- ollama list
   ```
3. The `webui` container running with proxy devices `webui-proxy` and `ollama-link` configured.

---

## 2. Validation Scenarios

### Scenario 1: Inter-Container Ollama Connectivity Check
Verify that the `webui` container can query Ollama through the `ollama-link` device:
```bash
incus exec webui -- curl -s http://127.0.0.1:11434/api/tags
```
**Expected Outcome**: Returns a JSON object containing the list of available models including `qwen3.5:4b`.

---

### Scenario 2: Service Auto-Start on Container Boot
Verify that the web application service starts automatically when the container is restarted:
```bash
# Restart container
incus restart webui

# Wait 3 seconds, then check service status
incus exec webui -- systemctl status e-webui
```
**Expected Outcome**: `Active: active (running)` with PID managed by systemd, listening on `127.0.0.1:8080`.

---

### Scenario 3: Host Loopback Access & Health Verification
Verify that the host machine can access the web application through the loopback proxy:
```bash
curl -i http://127.0.0.1:8080/api/health
```
**Expected Outcome**: HTTP `200 OK` with JSON `{"status": "ok", "ollama_connected": true}`.

---

### Scenario 4: Streaming Generation Verification
Test prompt submission and token streaming via curl:
```bash
curl -N -X POST http://127.0.0.1:8080/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen3.5:4b", "prompt": "Hi, who are you?", "stream": true}'
```
**Expected Outcome**: Immediate `text/event-stream` chunks streaming into stdout, ending with `done: true`.

---

### Scenario 5: End-to-End Browser UI Flow
1. Open any desktop browser on the host machine and navigate to:
   ```text
   http://127.0.0.1:8080
   ```
2. Confirm the UI renders with a model selector dropdown populated with `qwen3.5:4b`.
3. Type a prompt (e.g. "Why is the sky blue?") and press **Enter** or click **Send**.
4. Observe the response text streaming live onto the page in real-time.
5. Inspect container memory usage:
   ```bash
   incus exec webui -- ps -o pid,user,%mem,rss,command -C python
   ```
   Confirm memory footprint is below 60 MB RAM.
