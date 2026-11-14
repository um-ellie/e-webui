# Quickstart & Verification Guide: Offline LLM Diagnostics & Live Inference Metrics

**Feature**: `018-offline-llm-diagnostics`  
**Date**: 2026-11-14  
**Spec**: [spec.md](spec.md)  
**Data Model**: [data-model.md](data-model.md)  
**Contracts**: [contracts/metrics-contract.md](contracts/metrics-contract.md), [contracts/health-probe-contract.md](contracts/health-probe-contract.md)  

This guide provides procedures for validating live streaming speed, Time to First Token (TTFT) calculations, container health probing, and the diagnostics popover.

---

## 1. Automated Unit Testing

Run the workspace unit test suites:

```bash
python3 -m unittest tests/unit/test_ollama_client.py tests/unit/test_stream_pipeline.py tests/unit/test_ui_contracts.py -v
```

### Key Automated Checkpoints:
1. **Health Endpoint Schema & Latency:** Validates that `GET /api/health` returns `status`, `ollama_connected`, `latency_ms`, and `loaded_models`.
2. **Stream Chunk Telemetry:** Validates that `StreamChunk` parses and serializes `eval_count`, `eval_duration`, `prompt_eval_count`, `prompt_eval_duration`, and `load_duration`.
3. **Turn Performance Metrics Calculation:** Verifies mathematical correctness of tok/s and prompt eval rate calculations across various token and duration combinations.

---

## 2. Interactive Browser Validation Scenarios

Start the local application server:
```bash
python3 app/main.py
```
Open `http://127.0.0.1:8080`.

### Scenario 1: Header Health Indicator & Diagnostics Popover
1. Look at the top navigation bar next to the model selector.
2. Verify a green status dot with the label **"Connected"** is visible.
3. Click the status pill:
   - Verify the diagnostics popover opens smoothly.
   - Inspect the latency readout in milliseconds (e.g. `12.4 ms`).
   - Observe the listed running models.
4. Click the **"Check Now"** button:
   - Verify a quick refresh animation occurs and the timestamp updates to "Checked just now".
5. Click outside or press `Esc` to verify clean dismissal.

### Scenario 2: Live In-Flight Streaming Metrics & TTFT
1. Select a model and send a prompt (e.g. *"Explain quantum entanglement in 3 paragraphs"*).
2. Observe the message container during generation:
   - Notice the initial loading timer before the first token arrives.
   - As soon as the first token arrives, observe the live metrics badge displaying:
     `⚡ XX.X tok/s · TTFT X.Xs`
   - Notice that the speed value dynamically recalculates as text flows.

### Scenario 3: Completed Turn Metadata & Detailed Diagnostics Popover
1. When the generation finishes:
   - Inspect the metadata line in the message actions bar:
     `model · XX.X tok/s · TTFT X.Xs · X.Xs`
2. Click the metadata line:
   - Verify that the turn diagnostics popover appears.
   - Verify it shows:
     - Model Name
     - Time to First Token
     - Prompt Evaluation (count & tok/s)
     - Completion Generation (count & tok/s)
     - Model Load Duration
     - Total Latency

### Scenario 4: Background Inactivity Throttling
1. Switch to a different browser tab for 45 seconds.
2. Return to the `e-webui` tab:
   - Verify in the browser dev tools network panel that polling was halted while the tab was hidden and resumed with an immediate check upon refocusing.
