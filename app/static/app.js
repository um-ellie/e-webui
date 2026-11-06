/**
 * e-webui - Modern Developer Chat Interface
 * Vanilla ES6+, Zero Dependencies, Streaming SSE Client
 */

(() => {
  // DOM Elements
  const statusBadge = document.getElementById("status-badge");
  const statusText = document.getElementById("status-text");
  const modelSelect = document.getElementById("model-select");
  const thinkingBtn = document.getElementById("thinking-btn");
  const themeBtn = document.getElementById("theme-btn");
  const themeIconSun = document.getElementById("theme-icon-sun");
  const themeIconMoon = document.getElementById("theme-icon-moon");
  const clearBtn = document.getElementById("clear-btn");
  const chatContainer = document.getElementById("chat-container");
  const emptyState = document.getElementById("empty-state");
  const messagesList = document.getElementById("messages-list");
  const chatForm = document.getElementById("chat-form");
  const promptInput = document.getElementById("prompt-input");
  const sendBtn = document.getElementById("send-btn");
  const sendIcon = document.getElementById("send-icon");
  const stopIcon = document.getElementById("stop-icon");

  const SETTINGS_KEY = "ewebui_settings";
  let activeController = null;
  let isGenerating = false;

  // 1. Settings & Preferences Management
  const settings = {
    theme: "light",
    thinking: true,
  };

  function loadSettings() {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.theme === "dark" || parsed.theme === "light") {
          settings.theme = parsed.theme;
        }
        if (typeof parsed.thinking === "boolean") {
          settings.thinking = parsed.thinking;
        }
      }
    } catch (e) {
      console.warn("Could not load stored preferences:", e);
    }
    applyTheme(settings.theme);
    applyThinkingState(settings.thinking);
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("Could not save preferences to localStorage:", e);
    }
  }

  // Theme Management
  function applyTheme(theme) {
    settings.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") {
      themeIconSun.classList.add("hidden");
      themeIconMoon.classList.remove("hidden");
      themeBtn.title = "Switch to Light Pastel mode";
    } else {
      themeIconSun.classList.remove("hidden");
      themeIconMoon.classList.add("hidden");
      themeBtn.title = "Switch to Dark Pastel mode";
    }
  }

  function toggleTheme() {
    const nextTheme = settings.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    saveSettings();
  }

  // Thinking Mode Management
  function applyThinkingState(enabled) {
    settings.thinking = enabled;
    if (enabled) {
      thinkingBtn.classList.add("active");
      thinkingBtn.setAttribute("aria-pressed", "true");
      thinkingBtn.title = "Thinking Mode: Active (Reasoning tokens visible)";
    } else {
      thinkingBtn.classList.remove("active");
      thinkingBtn.setAttribute("aria-pressed", "false");
      thinkingBtn.title = "Thinking Mode: Disabled (Reasoning tokens hidden/bypassed)";
    }
  }

  function toggleThinking() {
    applyThinkingState(!settings.thinking);
    saveSettings();
  }

  // 2. Health & Connection Check
  async function checkHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (data.ollama_connected) {
        statusBadge.className = "status-badge connected";
        statusText.textContent = "Ollama Online";
      } else {
        statusBadge.className = "status-badge disconnected";
        statusText.textContent = "Ollama Offline";
      }
    } catch (e) {
      statusBadge.className = "status-badge disconnected";
      statusText.textContent = "Disconnected";
    }
  }

  // 3. Fetch Models
  async function loadModels() {
    try {
      const res = await fetch("/api/models");
      if (!res.ok) throw new Error("Failed to load models");
      const data = await res.json();

      modelSelect.innerHTML = "";
      if (data.models && data.models.length > 0) {
        data.models.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.name;
          const param = m.parameter_size ? ` (${m.parameter_size})` : "";
          opt.textContent = `${m.name}${param}`;
          if (m.name === data.default_model) {
            opt.selected = true;
          }
          modelSelect.appendChild(opt);
        });
        modelSelect.disabled = false;
      } else {
        modelSelect.innerHTML = '<option value="">No models found</option>';
        modelSelect.disabled = true;
      }
    } catch (e) {
      modelSelect.innerHTML = '<option value="">Ollama unavailable</option>';
      modelSelect.disabled = true;
    }
  }

  // 4. Safe Markdown Formatter & Clipboard Operations
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderMarkdown(text) {
    if (!text) return "";
    if (window.marked && typeof window.marked.parse === "function") {
      return window.marked.parse(text);
    }
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  async function copyToClipboard(text) {
    if (!text) return false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("Clipboard API failed, attempting fallback:", err);
      }
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-999999px";
    textarea.style.top = "-999999px";
    textarea.setAttribute("aria-hidden", "true");
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return successful;
    } catch (err) {
      document.body.removeChild(textarea);
      return false;
    }
  }

  // 5. Message DOM Construction
  function appendMessage(role, initialContent = "") {
    if (emptyState) emptyState.style.display = "none";

    const msgItem = document.createElement("div");
    msgItem.className = `message-item ${role}`;
    if (role === "assistant") {
      msgItem.dataset.rawMarkdown = initialContent;
    }

    const header = document.createElement("div");
    header.className = "message-header";
    header.textContent = role === "user" ? "You" : (modelSelect.value || "Assistant");

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.setAttribute("dir", "auto");
    bubble.innerHTML = renderMarkdown(initialContent);

    msgItem.appendChild(header);
    msgItem.appendChild(bubble);
    messagesList.appendChild(msgItem);

    scrollToBottom();
    return bubble;
  }

  function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function setGeneratingState(generating) {
    isGenerating = generating;
    if (generating) {
      sendIcon.classList.add("hidden");
      stopIcon.classList.remove("hidden");
      sendBtn.title = "Stop generating";
      sendBtn.setAttribute("aria-label", "Stop generating");
    } else {
      sendIcon.classList.remove("hidden");
      stopIcon.classList.add("hidden");
      sendBtn.title = "Send message";
      sendBtn.setAttribute("aria-label", "Send message");
      activeController = null;
    }
  }

  function renderAssistantBubble(bubble, thinkingText, responseText, isStreaming = false) {
    const msgItem = bubble.closest(".message-item");
    if (msgItem) {
      msgItem.dataset.rawMarkdown = responseText || "";
    }

    let html = "";
    
    // Only display thinking process if Thinking Mode is enabled
    if (settings.thinking && thinkingText) {
      const openAttr = isStreaming && !responseText ? "open" : "";
      const statusLabel = isStreaming && !responseText ? "thinking..." : "thought process";
      html += `
        <details class="thinking-container" ${openAttr}>
          <summary class="thinking-header">
            <span>💭 Thinking Process</span>
            <span class="thinking-status">${statusLabel}</span>
          </summary>
          <div class="thinking-body">${renderMarkdown(thinkingText)}</div>
        </details>
      `;
    }
    
    if (responseText) {
      html += renderMarkdown(responseText);
    }
    
    if (isStreaming) {
      html += '<span class="streaming-cursor" aria-hidden="true"></span>';
    }
    
    bubble.innerHTML = html;

    // Response Action Toolbar (ChatGPT / Gemini style)
    if (msgItem) {
      let actions = msgItem.querySelector(".message-actions");
      if (!isStreaming && responseText) {
        if (!actions) {
          actions = document.createElement("div");
          actions.className = "message-actions";
          actions.innerHTML = `
            <button class="action-btn copy-response-btn" type="button" title="Copy response" aria-label="Copy full response">
              <svg class="action-icon copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <svg class="action-icon check-icon hidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span class="action-label">Copy</span>
            </button>
          `;
          msgItem.appendChild(actions);
        } else {
          actions.style.display = "flex";
        }
      } else if (actions && isStreaming) {
        actions.style.display = "none";
      }
    }
  }

  // 6. Streaming Prompt Submission
  async function handleSubmit(promptText) {
    if (!promptText || isGenerating) return;

    const model = modelSelect.value;
    if (!model) {
      alert("No Ollama model selected or Ollama is offline.");
      return;
    }

    // Add user message
    appendMessage("user", promptText);
    promptInput.value = "";
    promptInput.style.height = "auto";

    // Create assistant message placeholder
    const assistantBubble = appendMessage("assistant", "");
    renderAssistantBubble(assistantBubble, "", "", true);

    setGeneratingState(true);
    activeController = new AbortController();

    let fullText = "";
    let thinkingText = "";

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model,
          prompt: promptText,
          stream: true,
          thinking: settings.thinking,
        }),
        signal: activeController.signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.error) {
              fullText += `\n\n*(Error: ${parsed.error})*`;
              renderAssistantBubble(assistantBubble, thinkingText, fullText, false);
              break;
            }

            if (parsed.thinking && settings.thinking) {
              thinkingText += parsed.thinking;
              renderAssistantBubble(assistantBubble, thinkingText, fullText, true);
              scrollToBottom();
            }

            if (parsed.token) {
              fullText += parsed.token;
              renderAssistantBubble(assistantBubble, thinkingText, fullText, true);
              scrollToBottom();
            }

            if (parsed.done) {
              break;
            }
          } catch (err) {
            console.error("Error parsing SSE line:", err, line);
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        fullText += " *(Generation stopped)*";
      } else {
        fullText += `\n\n*(Connection error: ${err.message})*`;
      }
    } finally {
      renderAssistantBubble(assistantBubble, thinkingText, fullText, false);
      setGeneratingState(false);
      scrollToBottom();
    }
  }

  // 7. Event Listeners
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (isGenerating && activeController) {
      activeController.abort();
      setGeneratingState(false);
      return;
    }
    const text = promptInput.value.trim();
    if (text) {
      handleSubmit(text);
    }
  });

  // Shift+Enter for newline, Enter to submit
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event("submit"));
    }
  });

  // Auto-resize textarea
  promptInput.addEventListener("input", () => {
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + "px";
  });

  // Quick prompt buttons
  document.querySelectorAll(".quick-prompt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prompt = btn.getAttribute("data-prompt");
      if (prompt) {
        promptInput.value = prompt;
        handleSubmit(prompt);
      }
    });
  });

  // Toolbar toggles
  thinkingBtn.addEventListener("click", toggleThinking);
  themeBtn.addEventListener("click", toggleTheme);

  // Message list click delegation (for full response copy & code block copy)
  messagesList.addEventListener("click", async (e) => {
    // 1. Full Response Copy Button (ChatGPT / Gemini style)
    const copyResponseBtn = e.target.closest(".copy-response-btn");
    if (copyResponseBtn) {
      const msgItem = copyResponseBtn.closest(".message-item");
      if (!msgItem) return;
      const textToCopy = msgItem.dataset.rawMarkdown || "";
      if (!textToCopy) return;

      const success = await copyToClipboard(textToCopy);
      if (success) {
        copyResponseBtn.classList.add("copied");
        const copyIcon = copyResponseBtn.querySelector(".copy-icon");
        const checkIcon = copyResponseBtn.querySelector(".check-icon");
        const label = copyResponseBtn.querySelector(".action-label");

        if (copyIcon) copyIcon.classList.add("hidden");
        if (checkIcon) checkIcon.classList.remove("hidden");
        if (label) label.textContent = "Copied!";

        setTimeout(() => {
          copyResponseBtn.classList.remove("copied");
          if (copyIcon) copyIcon.classList.remove("hidden");
          if (checkIcon) checkIcon.classList.add("hidden");
          if (label) label.textContent = "Copy";
        }, 1800);
      }
      return;
    }

    // 2. Individual Code Block Copy Button
    const copyCodeBtn = e.target.closest(".copy-code-btn");
    if (copyCodeBtn) {
      const wrapper = copyCodeBtn.closest(".code-block-wrapper");
      if (!wrapper) return;
      const codeEl = wrapper.querySelector("code");
      if (!codeEl) return;
      const codeText = codeEl.innerText || codeEl.textContent || "";

      const success = await copyToClipboard(codeText);
      if (success) {
        copyCodeBtn.classList.add("copied");
        const label = copyCodeBtn.querySelector(".copy-label") || copyCodeBtn;
        const origText = label.textContent;
        label.textContent = "Copied!";

        setTimeout(() => {
          copyCodeBtn.classList.remove("copied");
          label.textContent = origText === "Copied!" ? "Copy" : origText;
        }, 1500);
      }
    }
  });

  // Clear conversation
  clearBtn.addEventListener("click", () => {
    if (confirm("Clear current conversation?")) {
      messagesList.innerHTML = "";
      if (emptyState) emptyState.style.display = "flex";
      promptInput.value = "";
      promptInput.style.height = "auto";
    }
  });

  // Initialization
  loadSettings();
  checkHealth();
  loadModels();
  setInterval(checkHealth, 15000);
})();
