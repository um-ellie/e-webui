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

  // 4. Safe Lightweight Markdown Formatter
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderMarkdown(text) {
    if (!text) return "";

    // Code blocks with syntax copy button
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let formatted = text.replace(codeBlockRegex, (match, lang, code) => {
      const language = lang || "code";
      const escapedCode = escapeHtml(code.trim());
      return `
        <div class="code-block-wrapper">
          <div class="code-block-header">
            <span>${language}</span>
            <button class="copy-code-btn" type="button" onclick="navigator.clipboard.writeText(this.closest('.code-block-wrapper').querySelector('code').innerText); this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy', 1500);">Copy</button>
          </div>
          <pre><code class="language-${language}">${escapedCode}</code></pre>
        </div>
      `;
    });

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, (match, code) => {
      return `<code>${escapeHtml(code)}</code>`;
    });

    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Italic
    formatted = formatted.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Unordered lists
    formatted = formatted.replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>");
    formatted = formatted.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
    formatted = formatted.replace(/<\/ul>\s*<ul>/g, "");

    // Line breaks outside code blocks
    const parts = formatted.split(/(<div class="code-block-wrapper">[\s\S]*?<\/div>)/g);
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i].startsWith('<div class="code-block-wrapper">')) {
        parts[i] = parts[i].replace(/\n\n/g, "<p></p>").replace(/\n/g, "<br>");
      }
    }

    return parts.join("");
  }

  // 5. Message DOM Construction
  function appendMessage(role, initialContent = "") {
    if (emptyState) emptyState.style.display = "none";

    const msgItem = document.createElement("div");
    msgItem.className = `message-item ${role}`;

    const header = document.createElement("div");
    header.className = "message-header";
    header.textContent = role === "user" ? "You" : (modelSelect.value || "Assistant");

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
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
