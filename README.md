# e-webui

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg?style=flat&logo=python)](https://www.python.org/)
[![Incus](https://img.shields.io/badge/Container-Incus-orange.svg?style=flat)](https://linuxcontainers.org/incus/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> A lightweight, ultra-secure, and responsive web interface for [Ollama](https://ollama.com/) running inside a dedicated [Incus](https://linuxcontainers.org/incus/) container. Consumes **under 50 MB RAM**, auto-starts on boot via `systemd`, and strictly isolates traffic to the local host.

---

## زبان‌ها / Languages
- [فارسی (Persian)](#فارسی-persian)
- [English](#english)

---

# فارسی (Persian)

رابط کاربری سبک، فوق‌العاده کم‌مصرف و ایزوله برای اجرای مدل‌های محلی [Ollama](https://ollama.com/) درون کانتینر اختصاصی [Incus](https://linuxcontainers.org/incus/). 

این پروژه با هدف جایگزینی رابط‌های سنگین و چند گیگابایتی (مانند Open-WebUI) طراحی شده است. `e-webui` در حالت اجرا تنها حدود **۴۰ مگابایت رم** مصرف می‌کند، کاملاً به صورت آفلاین و بدون وابستگی به CDN کار می‌کند و ترافیک شبکه را منحصراً به آدرس محلی سیستم میزبان محدود می‌نماید.

---

### ویژگی‌های کلیدی
- **سبک و فوق‌العاده سریع:** مصرف رم کمتر از ۵۰ مگابایت (در مقایسه با بیش از ۱.۲ گیگابایت در رابط‌های وب سنگین).
- **راه‌اندازی خودکار با Systemd:** ثبت به عنوان سرویس سیستمی `e-webui.service`؛ به محض روشن شدن کانتینر (`incus start webui`) سرویس در کسری از ثانیه آماده پاسخگویی است.
- **امنیت سخت‌گیرانه و محلی:** مقید شده به `127.0.0.1:8080` در سیستم میزبان از طریق پروکسی Incus. هیچ پورتی روی شبکه محلی، وای‌فای یا اینترنت باز نمی‌شود.
- **ایزولاسیون بین کانتینرها:** ارتباط با کانتینر مدل‌های Ollama از طریق پروکسی داخلی (`127.0.0.1:11434`) انجام شده و از اینترنت بیرونی بی‌نیاز است.
- **استریم زنده و بلادرنگ (SSE):** نمایش کلمه به کلمه توکن‌ها به همراه پشتیبانی از بلوک‌های تفکر مدل (Thinking/Reasoning Blocks) مانند مدل‌های سری `qwen3.5`.
- **بدون نیاز به CDN و اینترنت:** فرانت‌اند مستقل با جاوااسکریپت خام (Vanilla JS) و استایل تم تیره که ۱۰۰٪ آفلاین عمل می‌کند.
- **اسکریپت استقرار هوشمند و تعاملی:** اسکریپت `./deploy.sh` با قابلیت ساخت خودکار کانتینر دبیان ۱۳، ساخت محیط مجازی ایزوله پایتون (venv)، تایید مرحله‌به‌مرحله، کشف خودکار اولاما، ذخیره وضعیت و امکان ادامه از نقطه توقف.

---

### معماری و سازوکار شبکه

```text
مرورگر سیستم میزبان (Host Desktop)
     │
     ▼ (دسترسی امن به http://127.0.0.1:8080)
[Incus Proxy Device در میزبان: webui-proxy]
     │
     ▼ (هدایت ترافیک به 127.0.0.1:8080 داخل کانتینر)
[کانتینر Incus: "webui"]
  └── سرور ناهمگام FastAPI (سرویس e-webui.service)
     │
     ▼ (هدایت درخواست‌ها به 127.0.0.1:11434 از طریق ollama-link)
[کانتینر Incus: "ollama"]
  └── سرویس Ollama با شتاب‌دهنده گرافیکی GPU (مثلاً مدل qwen3.5:4b)
```

---

### راهنمای گام‌به‌گام نصب، راه‌اندازی و استفاده

برای استفاده از `e-webui`، مراحل زیر را به ترتیب دنبال کنید. در هر مرحله توضیح داده شده است که چه کاری باید انجام دهید:

#### گام ۱: بررسی پیش‌نیازها
قبل از شروع، مطمئن شوید موارد زیر روی سیستم لینوکس شما مهیا هستند:
1. موتور کانتینرساز **Incus** نصب و فعال باشد (`incus version`).
2. کانتینر **ollama** که سرور Ollama را میزبانی می‌کند ساخته شده باشد و دست‌کم یک مدل روی آن دانلود شده باشد (مثلاً `qwen3.5:4b`):
   ```bash
   incus exec ollama -- ollama list
   ```

#### گام ۲: اجرای اسکریپت استقرار خودکار و هوشمند (`./deploy.sh`)
در ریشه پروژه، اسکریپت استقرار تعاملی را اجرا کنید (نیازی به ساخت دستی کانتینر نیست؛ اسکریپت در صورت نبودن، کانتینر دبیان ۱۳ را خودکار می‌سازد):
```bash
./deploy.sh
```

> **توضیح عملکرد اسکریپت:**
> اسکریپت نام کانتینر را از شما می‌پرسد (پیش‌فرض: `webui`) و مراحل زیر را به صورت تعاملی پیش می‌برد:
> 0. **بررسی Incus و ساخت کانتینر:** بررسی نصب بودن Incus، ایجاد کانتینر Debian 13/stable در صورت نبودن، یا تشخیص کانتینر موجود و دریافت تایید برای ادامه.
> 1. **تنظیم پروکسی‌ها و بررسی پورت:** بررسی آزاد بودن پورت ۸۰۸۰ در سیستم میزبان، تنظیم `webui-proxy` و کشف خودکار سرور Ollama و تنظیم `ollama-link`.
> 2. **حل تداخل و پیش‌نیازها:** توقف سرویس‌های متداخل روی ۸۰۸۰ و نصب پکیج‌های سیستمی `python3-venv` و `curl`.
> 3. **ایجاد محیط مجازی و انتقال فایل‌ها:** ساخت venv اختصاصی در `/opt/e-webui/venv`، انتقال فایل‌ها و نصب وابستگی‌ها بدون دستکاری پایتون اصلی سیستم.
> 4. **ثبت سرویس Systemd:** ثبت، بارگذاری مجدد و فعال‌سازی سرویس `e-webui.service`.
> 5. **بررسی سلامت و پروب HTTP:** تست پاسخ‌گویی واقعی وب‌سایت با HTTP 200 و بررسی ارتباط با اولاما.

**گزینه‌های کاربردی خط فرمان:**
```bash
# استقرار مستقیم روی یک کانتینر خاص:
./deploy.sh webui

# تعیین پورت میزبان سفارشی (در صورت اشغال بودن ۸۰۸۰):
./deploy.sh -p 8081 webui

# تعیین آدرس صریح اولاما:
./deploy.sh -o 192.168.1.50:11434 webui

# بررسی وضعیت سلامت و سرویس بدون ایجاد تغییر:
./deploy.sh --status webui

# پاک‌سازی و حذف سرویس و پروکسی‌های کانتینر:
./deploy.sh --clean webui

# استقرار خودکار بدون توقف برای تایید (Non-interactive):
./deploy.sh -y webui

# ریست کردن حافظه استقرار و اجرای کامل مجدد از ابتدا:
./deploy.sh -r webui
```

#### گام ۴: باز کردن و استفاده از رابط کاربری در مرورگر
۱. مرورگر سیستم خود را باز کرده و به آدرس زیر بروید:
   ```text
   http://127.0.0.1:8080
   ```
۲. **بررسی وضعیت اتصال:** نشانگر وضعیت در بالای صفحه چپ باید سبز شده و عبارت **Ollama Online** را نمایش دهد.
۳. **انتخاب مدل:** از منوی کشویی سمت راست بالا، مدل مورد نظر خود (مانند `qwen3.5:4b`) را انتخاب کنید.
۴. **شروع چت:** در کادر ورودی پایین صفحه، پیام یا دستور خود را بنویسید:
   - فشردن کلید `Enter`: ارسال پیام.
   - فشردن همزمان `Shift + Enter`: ایجاد خط جدید در متن.
۵. **مشاهده تفکر مدل:** در مدل‌های استدلال‌گر، یک بلوک بازشونده با عنوان **Thinking Process** ظاهر می‌شود که فرآیند تفکر مدل را به صورت زنده نمایش می‌دهد و پس از اتمام به شکل جمع‌شده درمی‌آید.
۶. **امکانات کنترل چت:**
   - دکمه **Stop**: برای توقف فوری پاسخ در حین تولید استریم.
   - دکمه **Copy**: برای کپی سریع پاسخ مدل در کلیپ‌بورد.
   - دکمه **Clear**: در هدر برای پاکسازی گفت‌وگو و شروع مجدد.

#### گام ۵: متوقف کردن کانتینرها در پایان کار (اختیاری)
هر زمان کارتان با مدل تمام شد و قصد آزادسازی منابع سیستم را داشتید:
```bash
# خاموش کردن کانتینر وب‌رابط
incus stop webui

# در صورت عدم نیاز به اولاما، خاموش کردن کانتینر اولاما
incus stop ollama
```
هر زمان که مجدداً نیاز به استفاده داشتید، فقط کافیست دستور `incus start webui` را بزنید؛ رابط بدون نیاز به هیچ کانفیگی دوباره فوراً در مرورگر در دسترس خواهد بود!

---

### مدیریت، عیب‌یابی و مانیتورینگ

| عملیات | دستور در ترمینال |
| :--- | :--- |
| **مشاهده وضعیت زنده سرویس** | `incus exec webui -- systemctl status e-webui` |
| **مشاهده لاگ‌های زنده (Live Logs)** | `incus exec webui -- journalctl -u e-webui -f` |
| **راه‌اندازی مجدد سرویس** | `incus exec webui -- systemctl restart e-webui` |
| **توقف سرویس** | `incus exec webui -- systemctl stop e-webui` |

---

### اجرای تست‌های خودکار

برای اطمینان از صحت عملکرد ماژول‌ها و یکپارچگی اندپوینت‌ها، تست‌های خودکار از طریق اسکریپت تعبیه شده در کانتینر اجرا می‌شوند:

```bash
# اجرای تست‌ها داخل کانتینر پیش‌فرض (webui)
./scripts/test.sh

# یا تعیین نام کانتینر خاص
./scripts/test.sh webui
```

---

<br/>

---

# English

A lightweight, ultra-secure, and responsive web interface (`e-webui`) for [Ollama](https://ollama.com/) running inside a dedicated [Incus](https://linuxcontainers.org/incus/) container (`webui`).

Designed specifically to replace heavyweight multi-gigabyte UI suites (such as Open-WebUI) with an ultra-efficient application consuming **under 50 MB RAM** that starts automatically on container boot and exposes access strictly to the host machine.

---

### Key Features
- **Blazing Fast & Ultra-Light:** Uses ~40 MB RAM at runtime (compared to >1.2 GB for typical full-stack alternatives).
- **Zero-Friction Auto-Start:** Runs as a native `systemd` service (`e-webui.service`). Whenever you run `incus start webui`, the web chat is ready in under 1 second.
- **Strict Host-Only Security:** Binds exclusively to `127.0.0.1:8080` via an Incus host proxy device. No open ports on your local Wi-Fi or LAN.
- **Inter-Container Isolation:** Communicates with the `ollama` container through an internal proxy device (`127.0.0.1:11434`), completely air-gapped from external networks.
- **Real-Time Token Streaming:** Token-by-token streaming using Server-Sent Events (SSE) with support for model thinking/reasoning blocks (e.g., `qwen3.5:4b`).
- **Zero CDN Dependencies:** Self-contained single-page chat interface built with Vanilla JS that works 100% offline.
- **Interactive & Resumable Deployment:** Production-grade deployment script (`scripts/deploy.sh`) featuring step-by-step confirmation, persistent progress resumption, and automated rollback/conflict handling.

---

### Architecture & Networking

```text
Host Browser (Desktop)
     │
     ▼ (http://127.0.0.1:8080)
[Incus Host Proxy Device: webui-proxy]
     │
     ▼ (127.0.0.1:8080 inside container)
[Incus Container: "webui"]
  └── FastAPI Async Server (systemd: e-webui.service)
     │
     ▼ (http://127.0.0.1:11434 via ollama-link proxy device)
[Incus Container: "ollama"]
  └── Ollama Daemon (GPU accelerated, e.g. qwen3.5:4b)
```

---

### Step-by-Step Getting Started & Usage Guide

Follow these steps sequentially to deploy, access, and use `e-webui`:

#### Step 1: Verify Prerequisites
Ensure your Linux host environment has the following prerequisites configured:
1. **Incus** is installed and functional (`incus version`).
2. An **ollama** container exists and has at least one model downloaded (e.g., `qwen3.5:4b`):
   ```bash
   incus exec ollama -- ollama list
   ```

#### Step 2: Run the Deployment Script (`./deploy.sh`)
Execute the deployment script directly from the project root. The script automatically launches a new Debian 13/stable container if it does not already exist:
```bash
./deploy.sh
```

> **What happens during deployment:**
> The script prompts for the target container name (defaults to `webui`) and executes the following modular steps:
> 0. **Incus Check & Container Provisioning:** Checks `incus` installation and launches a Debian 13 / stable container if missing, or prompts to reuse an existing container.
> 1. **Proxy Devices & Port Conflict Check:** Validates host port 8080, configures `webui-proxy`, auto-discovers the Ollama daemon, and sets up `ollama-link`.
> 2. **Environment & Prerequisites:** Stops conflicting services and installs `python3-venv` and `curl`.
> 3. **Python Virtual Environment & Code Sync:** Creates `/opt/e-webui/venv`, transfers application files, and installs dependencies strictly inside the virtualenv (PEP 668 compliant).
> 4. **Systemd Configuration:** Registers and enables `e-webui.service`.
> 5. **Live HTTP Health Verification:** Validates service status with an active HTTP 200 probe and confirms Ollama reachability.

**CLI Options & Commands:**
```bash
# Deploy to a specific container:
./deploy.sh webui

# Use custom host port:
./deploy.sh -p 8081 webui

# Specify custom Ollama URL:
./deploy.sh -o 192.168.1.50:11434 webui

# Inspect active status non-destructively:
./deploy.sh --status webui

# Teardown / Uninstall services and proxy devices:
./deploy.sh --clean webui

# Non-interactive mode (auto-accept all steps):
./deploy.sh -y webui

# Force reset saved progress and re-run all steps:
./deploy.sh -r webui
```

#### Step 4: Access and Use the Web Chat
1. Open your host desktop browser and navigate to:
   ```text
   http://127.0.0.1:8080
   ```
2. **Connection Status Check:** The badge at top-left should turn green and show **Ollama Online**.
3. **Select a Model:** Choose your model from the dropdown (e.g. `qwen3.5:4b`).
4. **Sending Messages:**
   - Press `Enter` to submit your prompt.
   - Press `Shift + Enter` to insert a newline.
5. **Reasoning / Thinking Blocks:** When querying reasoning models, a collapsible **Thinking Process** box unfolds in real-time and collapses upon completion.
6. **Chat Controls:**
   - **Stop Button:** Cancels ongoing stream generation.
   - **Copy Button:** Copies assistant responses with a single click.
   - **Clear Button:** Clears the chat history to start a fresh session.

#### Step 5: Shutting Down Containers (Optional)
When you are done with your workflow:
```bash
# Stop the Web UI container
incus stop webui

# Stop the Ollama container (if GPU/RAM release is desired)
incus stop ollama
```
Whenever you need it again, simply run `incus start webui` and refresh your browser!

---

### Management & Troubleshooting

| Task | Command |
| :--- | :--- |
| **Check Service Status** | `incus exec webui -- systemctl status e-webui` |
| **View Live Streaming Logs** | `incus exec webui -- journalctl -u e-webui -f` |
| **Restart Service** | `incus exec webui -- systemctl restart e-webui` |
| **Stop Service** | `incus exec webui -- systemctl stop e-webui` |

---

### Automated Testing

Automated test suites (unit and integration tests) verify mock proxies, API endpoints, and streaming generators:

```bash
# Run pytest inside the container
./scripts/test.sh

# Or specify custom container name
./scripts/test.sh webui
```

---

### Project Structure

```text
├── deploy.sh                  # Root executable wrapper delegating to scripts/deploy.sh
├── app/
│   ├── config.py              # Environment variables & runtime constants
│   ├── main.py                # FastAPI endpoints, CORS & static routing
│   ├── models.py              # Pydantic schemas (requests, responses, SSE)
│   ├── services/
│   │   └── ollama_client.py   # Async HTTP streaming client for Ollama API
│   ├── static/
│   │   ├── index.html         # Single-page chat interface
│   │   ├── style.css          # Dark-themed responsive stylesheet
│   │   └── app.js             # SSE stream reader, DOM renderer & controls
│   └── systemd/
│       └── e-webui.service    # Systemd unit definition for container boot
├── scripts/
│   ├── deploy.sh              # Resumable, interactive Incus deployment script
│   └── test.sh                # Container-executed automated pytest runner
├── tests/
│   ├── conftest.py            # Pytest test fixtures & mock responses
│   ├── unit/                  # Unit tests for client & deployment logic
│   └── integration/           # Integration tests for FastAPI endpoints
└── specs/                     # Spec-Kit specifications and blueprints
```

---

### Environment Variables

The application can be configured via environment variables (defined in `app/config.py` and `app/systemd/e-webui.service`):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Target Ollama API endpoint inside the container |
| `APP_HOST` | `0.0.0.0` | Bind IP for the FastAPI application |
| `APP_PORT` | `8080` | Port on which the application listens |
