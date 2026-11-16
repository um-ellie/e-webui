/**
 * Client-Side Conversation Export Utility
 * Converts session dialogues to GitHub-Flavored Markdown or structured JSON,
 * and triggers native browser downloads via Blob URLs.
 * Contract: specs/016-chat-history-persistence/contracts/export-schema.json
 */

import { showToast } from './toast.js';

/**
 * Sanitizes a title string into a safe, clean filename slug with a datestamp.
 * Preserves alphanumeric characters including Persian/Arabic Unicode letters.
 * @param {string} rawTitle
 * @param {'md' | 'json'} extension
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
export function sanitizeFilename(rawTitle, extension, now = new Date()) {
  const clean = String(rawTitle || '')
    .replace(/[\/\\?%*:|"<>]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .slice(0, 64);

  const slug = clean || 'conversation';
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  return `${slug}-${dateStr}.${extension}`;
}

/**
 * Formats a timestamp into a readable date string.
 * @param {number} timestamp
 * @returns {string}
 */
function formatReadableDate(timestamp) {
  if (!timestamp) return new Date().toISOString().slice(0, 16).replace('T', ' ');
  const d = new Date(timestamp);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * Formats a ChatSession and its message turns into a clean GitHub-Flavored Markdown document.
 * @param {any} session
 * @returns {string}
 */
export function formatMarkdown(session) {
  if (!session) return '';

  const title = session.title || 'Conversation';
  const dateStr = formatReadableDate(session.updatedAt || session.createdAt);
  const modelName = session.model || 'Unknown model';

  const lines = [
    `# ${title}`,
    '',
    `- **Date**: ${dateStr}`,
    `- **Model**: ${modelName}`,
    ...(session.presetId ? [`- **Preset**: ${session.presetTitle || session.presetId}`] : []),
    ...(typeof session.temperature === 'number' ? [`- **Temperature**: ${session.temperature}`] : []),
    ...(typeof session.topP === 'number' ? [`- **Top-P**: ${session.topP}`] : []),
    ...(session.numCtx ? [`- **Context Window**: ${session.numCtx}`] : []),
    ...(session.systemPrompt ? [`- **System Instructions**: ${session.systemPrompt.replace(/\n+/g, ' ').slice(0, 300)}`] : []),
    '- **Exported from**: e-webui',
    '',
    '---',
    ''
  ];

  const messages = session.messages || [];
  if (messages.length === 0) {
    lines.push('*No messages in this conversation.*');
    return lines.join('\n');
  }

  for (const msg of messages) {
    const roleTitle = msg.role === 'user' ? 'User' : 'Assistant';
    lines.push(`### ${roleTitle}`);
    lines.push('');

    // Collapsible reasoning trace for thinking models
    if (msg.reasoning) {
      lines.push('<details>');
      lines.push('<summary>Reasoning</summary>');
      lines.push('');
      lines.push(msg.reasoning);
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }

    if (msg.content) {
      lines.push(msg.content);
      lines.push('');
    } else if (msg.reasoning && !msg.content) {
      lines.push('*[The model returned only reasoning for this turn]*');
      lines.push('');
    }

    // Benchmark performance metrics
    if (msg.metrics && msg.metrics.durationSeconds) {
      const parts = [`*Generated in ${msg.metrics.durationSeconds}s`];
      if (msg.metrics.tokensPerSecond) {
        parts.push(` (${msg.metrics.tokensPerSecond} tok/s)`);
      }
      if (msg.metrics.timeToFirstTokenMs) {
        const ttftStr = msg.metrics.timeToFirstTokenMs >= 1000
          ? `${(msg.metrics.timeToFirstTokenMs / 1000).toFixed(1)}s`
          : `${msg.metrics.timeToFirstTokenMs}ms`;
        parts.push(` · TTFT ${ttftStr}`);
      }
      if (msg.metrics.model) {
        parts.push(` · Model: ${msg.metrics.model}`);
      }
      parts.push('*');
      lines.push(parts.join(''));
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Serializes a ChatSession into structured JSON complying with export-schema.json.
 * @param {any} session
 * @returns {string}
 */
export function formatJson(session) {
  const exportPayload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    session: {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      model: session.model,
      systemPrompt: session.systemPrompt || null,
      presetId: session.presetId || null,
      temperature: typeof session.temperature === 'number' ? session.temperature : 0.7,
      topP: typeof session.topP === 'number' ? session.topP : 0.9,
      numCtx: session.numCtx || null,
      messages: session.messages || []
    }
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Triggers a browser file download using native Blob and URL.createObjectURL.
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * High-level export dispatcher for a session.
 * @param {any} session
 * @param {'markdown' | 'json'} [format='markdown']
 */
export function exportSession(session, format = 'markdown') {
  if (!session) return false;

  const messages = session.messages || [];
  if (messages.length === 0) {
    showToast('Cannot export an empty chat', 'warning');
    return false;
  }

  try {
    if (format === 'json') {
      const jsonStr = formatJson(session);
      const filename = sanitizeFilename(session.title, 'json');
      downloadFile(jsonStr, filename, 'application/json;charset=utf-8');
      showToast('Chat exported as JSON', 'success');
    } else {
      const mdStr = formatMarkdown(session);
      const filename = sanitizeFilename(session.title, 'md');
      downloadFile(mdStr, filename, 'text/markdown;charset=utf-8');
      showToast('Chat exported as Markdown', 'success');
    }
    return true;
  } catch (err) {
    showToast(`Export failed: ${err.message || 'Unknown error'}`, 'error');
    return false;
  }
}
