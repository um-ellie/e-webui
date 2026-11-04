/**
 * e-webui - Client-side Streaming Chat
 * 100% Vanilla JS, zero dependencies, responsive streaming
 */

(() => {
  // DOM Elements
  const statusBadge = document.getElementById("status-badge");
  const statusText = document.getElementById("status-text");
  const modelSelect = document.getElementById("model-select");
  const clearBtn = document.getElementById("clear-btn");
  const chatContainer = document.getElementById("chat-container");
  const emptyState = document.getElementById("empty-state");
  const messagesList = document.getElementById("messages-list");
  const chatForm = document.getElementById("chat-form");
  const promptInput = document.getElementById("prompt-input");
  const sendBtn = document.getElementById("send-btn");
  const sendIcon = document.getElementById("send-icon");
  const stopIcon = document.getElementById("stop-icon");

  let activeController = null;
  let isGenerating = false;

  // 1. Health & Connection Check
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

  // 2. Fetch Models
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
      }
    } catch (e) {
      modelSelect.innerHTML = '<option value="">Ollama unavailable</option>';
      modelSelect.disabled = true;
    }
  }

  // 3. Simple Safe Markdown Formatter
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderMarkdown(text) {
    if (!text) return "";

    // Code blocks with language
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let formatted = text.replace(codeBlockRegex, (match, lang, code) => {
      const language = lang || "plaintext";
      const escapedCode = escapeHtml(code.trim());
      return `
        <div class="code-block-wrapper">
          <div class="code-block-header">
            <span>${language}</span>
            <button class="copy-code-btn" onclick="navigator.clipboard.writeText(this.closest('.code-block-wrapper').querySelector('code').innerText); this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy', 1500);">Copy</button>
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

  // 4. Message Creation & DOM helpers
  function appendMessage(role, initialContent = "") {
    if (emptyState) emptyState.style.display = "none";

    const msgItem = document.createElement("div");
    msgItem.className = `message-item ${role}`;

    const header = document.createElement("div");
    header.className = "message-header";
    header.textContent = role === "user" ? "You" : (modelSelect.value || "Ollama");

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
    } else {
      sendIcon.classList.remove("hidden");
      stopIcon.classList.add("hidden");
      sendBtn.title = "Send message";
      activeController = null;
    }
  }

  function renderAssistantBubble(bubble, thinkingText, responseText, isStreaming = false) {
    let html = "";
    if (thinkingText) {
      const openAttr = isStreaming && !responseText ? "open" : "";
      html += `
        <details class="thinking-container" ${openAttr}>
          <summary class="thinking-header">
            <span>💭 Thinking Process</span>
          </summary>
          <div class="thinking-body">${renderMarkdown(thinkingText)}</div>
        </details>
      `;
    }
    if (responseText) {
      html += renderMarkdown(responseText);
    }
    if (isStreaming) {
      html += '<span class="streaming-cursor"></span>';
    }
    bubble.innerHTML = html;
  }

  // 5. Streaming Prompt Submission
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

            if (parsed.thinking) {
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

  // 6. Event Listeners
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
    promptInput.style.height = Math.min(promptInput.scrollHeight, 160) + "px";
  });

  // Quick prompt buttons
  document.querySelectorAll(".quick-prompt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prompt = btn.getAttribute("data-prompt");
      promptInput.value = prompt;
      handleSubmit(prompt);
    });
  });

  // Clear conversation
  clearBtn.addEventListener("click", () => {
    if (confirm("Clear current conversation?")) {
      messagesList.innerHTML = "";
      if (emptyState) emptyState.style.display = "flex";
    }
  });

  // Initial load
  checkHealth();
  loadModels();
  setInterval(checkHealth, 15000);
})();
