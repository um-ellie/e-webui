# Feature Specification: Secure Ollama Web UI Container

**Feature Branch**: `001-ollama-web-ui`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "من یک کانتینر incus دارم که داخل اون یک ollama دارم که از طریق proxy می تونم بهش وصل بشم. حالا می خواهم بجای اینکه دستورات و request های خودم رو از طریق ترمینال هر دفعه با پر کردن command های طولانی بپرسم یک کانتینر دیگه در incus داشته باشم که هر وقت این کانتینر را فعال کنم بتوانم از طریق وب و با یک وب اپ سوال های خودم را از ollama که در کانتینر دیگر است بپرسم. در ابتدا فقط یک طراحی ساده ولی امن می خواهم که هم بعد از روشن شدن کانتینر به صورت خودکار فعال شود و هم خیلی امن باشد. لطفا پیشنهاد های خودتون رو بهم بدید که از چه نوع api و یا سرویس و یا برنامه نویسی استفاده کنم."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interactive Prompting via Browser (Priority: P1)

As a user, I want to open a web browser to access a clean, dedicated web interface where I can type questions and receive AI responses from the Ollama model, eliminating the need to construct manual `curl` commands in the terminal.

**Why this priority**: Core value proposition. Provides the primary conversational interface and replaces manual CLI invocations.

**Independent Test**: Boot the web container, open the web interface in the browser, type a prompt (such as "Why is the sky blue?"), and verify that the generated answer is displayed clearly.

**Acceptance Scenarios**:

1. **Given** both the Web UI container and Ollama container are active, **When** the user sends a prompt through the web page, **Then** the prompt is forwarded to Ollama and the response is rendered in real-time or upon completion.
2. **Given** the Ollama container is unreachable or an invalid request is sent, **When** a prompt is submitted, **Then** an informative error message is displayed to the user instead of an application crash.

---

### User Story 2 - Automated Boot & Systemd Service Execution (Priority: P2)

As a system administrator/user, I want the web interface service inside the Incus container to start automatically when the container boots, requiring zero manual terminal commands inside the container.

**Why this priority**: Ensures ease of use and consistent uptime whenever the container is started via `incus start`.

**Independent Test**: Execute `incus start <container-name>`, wait for initialization, and immediately access the web UI URL from the host browser.

**Acceptance Scenarios**:

1. **Given** the container is booted or rebooted, **When** system initialization completes, **Then** the web application service is running under a reliable service supervisor (such as systemd).
2. **Given** the container is stopped, **When** inspected, **Then** all web server background processes terminate cleanly without lingering locks.

---

### User Story 3 - Secure Access Control & Container Isolation (Priority: P3)

As a security-conscious developer, I want access to the web UI and container communication to be restricted and isolated, so that unauthorized users or network snooping cannot access the model or the management interface.

**Why this priority**: Fulfills the explicit requirement for high security while keeping the architecture simple.

**Independent Test**: Attempt to reach the web interface from unauthorized network paths or interfaces, verifying that access is strictly restricted to host loopback.

**Acceptance Scenarios**:

1. **Given** an unauthenticated external or LAN client, **When** attempting to reach the web UI, **Then** connection is refused because the service is exposed solely on localhost loopback (`127.0.0.1`) on the host.
2. **Given** the web UI container, **When** it queries Ollama, **Then** it communicates strictly through isolated internal container networking or a designated loopback proxy.

---

### Edge Cases

- What happens if the Ollama container is stopped while the Web UI is open? (The UI must notify the user that Ollama is offline with a retry button).
- What happens if the response takes a long time or the connection drops mid-generation? (The connection should timeout gracefully without hanging the backend worker).
- What happens if the user asks for a model name that is not pulled yet? (The UI should list available models from Ollama's `/api/tags` or display a clear missing-model warning).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an intuitive web chat interface accessible via desktop browser.
- **FR-002**: System MUST communicate with Ollama's API (`/api/generate` or `/api/chat` and `/api/tags`) running in the dedicated Ollama container.
- **FR-003**: System MUST run as a managed system service inside the new Incus container that starts automatically on container launch.
- **FR-004**: System MUST enforce security controls by binding access exclusively to localhost loopback via Incus proxy device (`127.0.0.1:<port>`), preventing exposure to any external network or LAN interface.
- **FR-005**: System MUST implement a lightweight Python application (FastAPI backend supporting token streaming via SSE, and a clean, responsive single-page HTML/JS/CSS frontend), ensuring low memory consumption (<100MB RAM) and zero bloat.
- **FR-006**: System MUST support selecting available models retrieved dynamically from Ollama.
- **FR-007**: System MUST handle network errors and Ollama downtimes gracefully with clear user feedback.

### Key Entities *(include if feature involves data)*

- **Chat Message / Prompt**: Text content, role (user/assistant), timestamp, and model parameters.
- **Model Metadata**: Name, tag, and size of models retrieved from Ollama's `/api/tags`.
- **Service Configuration**: Target Ollama endpoint URL, port bindings, and security tokens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can access the web application in under 5 seconds after starting the Incus container.
- **SC-002**: Generation response starts streaming or displaying within 1 second of Ollama's first token output.
- **SC-003**: 100% of unauthorized external network access attempts are rejected by security boundaries.
- **SC-004**: Zero manual terminal commands are required inside the container during regular day-to-day operation.

## Assumptions

- The host machine runs Linux with Incus installed and configured with standard bridge networking (`incusbr0`).
- The existing Ollama container has an active Ollama instance accessible via loopback proxy or internal container IP.
- The web browser runs on the host machine.
- Initial setup and container provisioning are performed once, after which normal operations only require `incus start`.
