# e-webui

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg?style=flat&logo=python)](https://www.python.org/)
[![Incus](https://img.shields.io/badge/Container-Incus-orange.svg?style=flat)](https://linuxcontainers.org/incus/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> A lightweight, ultra-secure, and responsive web interface for [Ollama](https://ollama.com/) running inside a dedicated [Incus](https://linuxcontainers.org/incus/) container. Consumes **under 50 MB RAM**, auto-starts on boot via `systemd`, and strictly isolates traffic to the local host.

---

## Languages / زبان‌ها
- [English](#english)
- [فارسی (Persian)](#فارسی-persian)

---

# English

A lightweight, ultra-secure, and responsive web interface (`e-webui`) for [Ollama](https://ollama.com/) running inside a dedicated [Incus](https://linuxcontainers.org/incus/) container (`webui`).

Designed specifically to replace heavyweight multi-gigabyte UI suites with an ultra-efficient application consuming **under 50 MB RAM** that starts automatically on container boot and exposes access strictly to the local host machine.

---

### Key Features

- **Blazing Fast and Ultra-Light**: Consumes approximately 40 MB RAM at runtime (compared to over 1 GB for typical heavy web interfaces).
- **Instant Systemd Startup**: Runs as a managed service (`e-webui.service`). Whenever you run `incus start webui`, the interface is ready in under 1 second.
- **Strict Host-Only Isolation**: Binds exclusively to `127.0.0.1:8080` on the host machine via an Incus proxy device. No open ports on local networks or the internet.
- **Inter-Container Communication**: Talks directly to the Ollama container via an internal proxy device (`127.0.0.1:11434`), remaining completely air-gapped from external networks.
- **Real-Time Token Streaming**: Real-time response generation via Server-Sent Events (SSE).
- **Thinking and Reasoning Mode**: Dedicated collapsible thought process block for deep reasoning models (such as `qwen3.5` or `deepseek-r1`), with a header toggle to enable or disable thinking visibility.
- **Theme Customization**: Built-in toggle to switch smoothly between Light and Dark themes.
- **Rich Markdown and Code Copy**: Renders Markdown headings, tables, quotes, and code blocks, featuring one-click copy buttons for code snippets and entire assistant responses.
- **Zero External CDN Dependencies**: Bundled static frontend (Vanilla JS and marked.js) that operates 100% offline.
- **Production-Grade Deployment**: Includes an interactive, resumable deployment manager (`./deploy.sh`) and an immutable release packager (`./build-release.sh`).

---

### Architecture and Networking

```text
Host Browser (Desktop)
     │
     ▼ (Access http://127.0.0.1:8080)
[Incus Host Proxy Device: webui-proxy]
     │
     ▼ (Forwards to 127.0.0.1:8080 inside container)
[Incus Container: "webui"]
  └── FastAPI Async Application (systemd: e-webui.service)
     │
     ▼ (Forwards to 127.0.0.1:11434 via ollama-link)
[Incus Container: "ollama"]
  └── Ollama Service with GPU Acceleration (e.g., qwen3.5:4b)
```

---

### Step-by-Step Getting Started Guide

Follow these 5 simple steps to set up, deploy, and use `e-webui`:

#### Step 1: Verify Prerequisites
Ensure your Linux system has:
1. **Incus** installed and active:
   ```bash
   incus version
   ```
2. An **ollama** container running with at least one model downloaded:
   ```bash
   incus exec ollama -- ollama list
   ```

#### Step 2: Deploy the Application
Run the deployment script from the project root:
```bash
./deploy.sh
```

The script guides you through setup interactively:
- Automatically creates a Debian 13/stable container if one does not already exist.
- Configures host proxy devices (`webui-proxy` on port 8080) and inter-container links (`ollama-link`).
- Creates an isolated Python virtual environment (`/opt/e-webui/venv`) and installs dependencies.
- Registers, activates, and verifies the `e-webui.service` systemd unit.
- Conducts an HTTP health check to ensure immediate readiness.

#### Step 3: Access and Use the Web Chat
1. Open your browser on the host system and navigate to:
   ```text
   http://127.0.0.1:8080
   ```
2. **Connection Status**: Verify that the status badge in the top-left turns green and displays **Ollama Online**.
3. **Select a Model**: Choose your preferred model from the dropdown menu in the header.
4. **Send a Message**: Type your prompt into the input bar at the bottom:
   - Press `Enter` to send your message.
   - Press `Shift + Enter` to insert a newline.
5. **Explore App Controls**:
   - **Thinking Button**: Toggle model reasoning blocks on or off. When enabled, reasoning models display an expandable "Thinking Process" block.
   - **Theme Toggle**: Switch between Light and Dark visual modes with the sun/moon button in the top bar.
   - **Stop Button**: Interrupt message generation mid-stream.
   - **Copy Actions**: Click the copy button below any assistant message or inside any code block to copy formatted text to your clipboard.
   - **Clear Button**: Reset the active conversation history.

#### Step 4: Common Management and Lifecycle Commands
You can manage the application lifecycle directly using `./deploy.sh`:

```bash
# Check current deployment status, active release ID, and HTTP health:
./deploy.sh --status webui

# Perform a quick update without rebuilding the container:
./deploy.sh --update webui

# Restore the previous release version (Rollback):
./deploy.sh --rollback webui

# Automatically repair configuration, proxy links, or systemd services:
./deploy.sh --repair webui

# Package an immutable, verifiable release artifact:
./build-release.sh

# Deploy using a specific release package:
./deploy.sh --update --release dist/releases/e-webui-1.0.0-*.tar.gz webui

# Clean uninstallation (preserves persistent data by default):
./deploy.sh --uninstall webui
```

#### Step 5: Stopping and Starting Containers (Optional)
When you finish using the application:
```bash
# Stop the web UI container
incus stop webui

# Stop the Ollama container (to free up system memory and GPU)
incus stop ollama
```

Whenever you want to use the application again, simply run:
```bash
incus start webui
```
The interface will be instantly available in your browser at `http://127.0.0.1:8080`.

---

### Service Administration Commands

| Action | Terminal Command |
| :--- | :--- |
| **Check Service Status** | `incus exec webui -- systemctl status e-webui` |
| **View Live Streaming Logs** | `incus exec webui -- journalctl -u e-webui -f` |
| **Restart Service** | `incus exec webui -- systemctl restart e-webui` |
| **Stop Service** | `incus exec webui -- systemctl stop e-webui` |

---

### Automated Testing

To run the automated test suite within the container environment:

```bash
# Run pytest inside the default container (webui)
./scripts/test.sh

# Or specify a custom container name
./scripts/test.sh webui
```

---

### Project Structure

```text
├── deploy.sh                  # Root executable wrapper for deployment
├── build-release.sh           # Root executable wrapper for release packaging
├── app/
│   ├── config.py              # Environment variables and application configuration
│   ├── main.py                # FastAPI server, endpoints, and static routing
│   ├── models.py              # Data models and SSE schemas
│   ├── services/
│   │   └── ollama_client.py   # Async HTTP streaming client for Ollama API
│   ├── static/
│   │   ├── index.html         # Single-page chat interface
│   │   ├── style.css          # Theme-aware responsive stylesheet (light/dark)
│   │   ├── app.js             # SSE stream handler, UI controls, and DOM renderer
│   │   └── vendor/
│   │       └── marked.min.js  # Offline Markdown parsing library
│   └── systemd/
│       └── e-webui.service    # Systemd service unit definition
├── scripts/
│   ├── deploy.sh              # Full lifecycle management and deployment script
│   ├── build-release.sh       # Release artifact packager with checksum verification
│   └── test.sh                # Container-executed automated pytest runner
├── tests/
│   ├── conftest.py            # Pytest test fixtures
│   ├── unit/                  # Unit tests for deployment, packaging, and models
│   └── integration/           # Integration tests for FastAPI endpoints
└── specs/                     # Spec-Kit specifications and task blueprints
```

---

### Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama API endpoint inside the container |
| `APP_HOST` | `0.0.0.0` | Bind IP address for the FastAPI application |
| `APP_PORT` | `8080` | Port on which the application listens inside container |

---
---

# فارسی (Persian)

رابط کاربری سبک، فوق‌العاده کم‌مصرف و ایزوله برای کار با مدل‌های محلی [Ollama](https://ollama.com/) درون کانتینر اختصاصی [Incus](https://linuxcontainers.org/incus/).

این پروژه به عنوان جایگزینی کم‌حجم برای رابط‌های سنگین چند گیگابایتی طراحی شده است. `e-webui` در حالت اجرا فقط حدود **۴۰ مگابایت رم** مصرف می‌کند، به طور خودکار همزمان با کانتینر اجرا می‌شود و دسترسی به آن منحصراً به آدرس محلی سیستم میزبان محدود است.

---

### ویژگی‌های کلیدی

- **سبک و بسیار سریع**: مصرف رم حدود ۴۰ مگابایت در حالت اجرا (در مقایسه با بیش از ۱ گیگابایت در سایر رابط‌های سنگین).
- **راه‌اندازی خودکار با Systemd**: ثبت به عنوان سرویس سیستمی `e-webui.service`؛ بلافاصله پس از روشن شدن کانتینر (`incus start webui`) در کمتر از ۱ ثانیه در دسترس است.
- **امنیت سخت‌گیرانه و محلی**: اتصال اختصاصی به `127.0.0.1:8080` در سیستم میزبان از طریق پروکسی Incus، بدون باز کردن هیچ پورتی روی شبکه محلی، وای‌فای یا اینترنت.
- **ایزولاسیون کامل بین کانتینرها**: ارتباط با کانتینر Ollama از طریق پروکسی داخلی (`127.0.0.1:11434`) بدون نیاز به اتصال به شبکه بیرونی.
- **استریم زنده و بلادرنگ (SSE)**: نمایش کلمه به کلمه پاسخ مدل با سرعت بالا.
- **پشتیبانی از حالت تفکر و استدلال (Thinking Mode)**: نمایش فرآیند تفکر مدل‌های استدلال‌گر (مانند `qwen3.5` یا `deepseek-r1`) در بلوک بازشونده با امکان فعال یا غیرفعال کردن نمایش تفکر از هدر برنامه.
- **پشتیبانی از تم تیره و روشن (Dark / Light)**: امکان تغییر تم با دکمه اختصاصی در بالای صفحه.
- **رندر غنی Markdown و کپی آسان**: نمایش جداول، عناوین، لیست‌ها و بلوک‌های کد به همراه دکمه‌های کپی برای کل پاسخ و برای هر بلوک کد به صورت جداگانه.
- **بدون وابستگی به CDN خارجی**: فرانت‌اند مستقل با استفاده از جاوااسکریپت خام و کتابخانه آفلاین marked.js که به صورت ۱۰۰٪ آفلاین کار می‌کند.
- **مدیریت استقرار حرفه‌ای**: همراه با اسکریپت استقرار مرحله‌به‌مرحله و هوشمند (`./deploy.sh`) و ابزار ساخت پکیج رسمی انتشار (`./build-release.sh`).

---

### معماری و ارتباطات شبکه

```text
مرورگر سیستم میزبان (Host Desktop)
     │
     ▼ (دسترسی به آدرس http://127.0.0.1:8080)
[Incus Host Proxy Device: webui-proxy]
     │
     ▼ (هدایت ترافیک به 127.0.0.1:8080 داخل کانتینر)
[کانتینر Incus: "webui"]
  └── سرور FastAPI (سرویس e-webui.service)
     │
     ▼ (هدایت درخواست‌ها به 127.0.0.1:11434 از طریق ollama-link)
[کانتینر Incus: "ollama"]
  └── سرویس Ollama با شتاب‌دهنده گرافیکی GPU (مثلاً مدل qwen3.5:4b)
```

---

### راهنمای گام‌به‌گام نصب، راه‌اندازی و استفاده

برای راه‌اندازی و استفاده از برنامه، این ۵ گام ساده را دنبال کنید:

#### گام ۱: بررسی پیش‌نیازها
مطمئن شوید موارد زیر در سیستم شما فعال هستند:
1. موتور کانتینرساز **Incus** نصب و فعال باشد:
   ```bash
   incus version
   ```
2. کانتینر **ollama** در حال اجرا بوده و حداقل یک مدل روی آن دانلود شده باشد:
   ```bash
   incus exec ollama -- ollama list
   ```

#### گام ۲: اجرای اسکریپت استقرار
در پوشه اصلی پروژه، اسکریپت استقرار را اجرا کنید:
```bash
./deploy.sh
```

اسکریپت مراحل را به صورت خودکار و تعاملی پیش می‌برد:
- در صورت عدم وجود کانتینر، به طور خودکار کانتینر Debian 13/stable را ایجاد می‌کند.
- پروکسی میزبان (`webui-proxy` روی پورت ۸۰۸۰) و لینک ارتباطی با اولاما (`ollama-link`) را تنظیم می‌کند.
- محیط مجازی ایزوله پایتون (`/opt/e-webui/venv`) ساخته و وابستگی‌ها را نصب می‌نماید.
- سرویس سیستمی `e-webui.service` را ثبت، راه‌اندازی و فعال می‌کند.
- با پروب سلامت HTTP بررسی می‌کند که وب‌رابط با موفقیت در حال پاسخ‌گویی است.

#### گام ۳: باز کردن و استفاده از رابط کاربری در مرورگر
۱. در سیستم خود مرورگر را باز کرده و به نشانی زیر بروید:
   ```text
   http://127.0.0.1:8080
   ```
۲. **بررسی وضعیت اتصال**: نشانگر بالا سمت چپ باید سبز شده و عبارت **Ollama Online** را نمایش دهد.
۳. **انتخاب مدل**: از منوی کشویی در هدر، مدل دلخواه خود را انتخاب کنید.
۴. **ارسال پیام**: پیام خود را در کادر متنی پایین صفحه بنویسید:
   - فشردن کلید `Enter`: ارسال پیام.
   - فشردن همزمان `Shift + Enter`: ایجاد خط جدید در متن.
۵. **امکانات رابط کاربری**:
   - **دکمه Thinking**: فعال یا غیرفعال کردن نمایش بخش تفکر مدل در پاسخ‌های استدلالی.
   - **تغییر تم**: تغییر تم بین روشن و تیره با دکمه آیکون خورشید/ماه در هدر.
   - **دکمه Stop**: توقف فوری در حین تولید پاسخ استریم.
   - **عملیات کپی**: کپی آسان متن کل پاسخ یا هر بلوک کد به صورت جداگانه در کلیپ‌بورد.
   - **دکمه Clear**: پاک‌سازی پیام‌های گفت‌وگو و شروع مجدد.

#### گام ۴: دستورات کاربردی مدیریت و چرخه عمر برنامه
می‌توانید با استفاده از `./deploy.sh` استقرار را مدیریت کنید:

```bash
# مشاهده وضعیت کامل استقرار، شناسه پکیج فعال و سلامت HTTP:
./deploy.sh --status webui

# به‌روزرسانی سریع بدون بازسازی کانتینر و بسته‌های سیستمی:
./deploy.sh --update webui

# بازگشت خودکار به نسخه سالم قبلی (Rollback):
./deploy.sh --rollback webui

# عیب‌یابی و اصلاح خودکار پروکسی‌ها، لینک‌ها و سرویس:
./deploy.sh --repair webui

# ساخت پکیج رسمی و تاییدشده انتشار (همراه با manifest و checksum):
./build-release.sh

# استقرار یا ارتقا با فایل پکیج مشخص:
./deploy.sh --update --release dist/releases/e-webui-1.0.0-*.tar.gz webui

# حذف سرویس و استقرار (با حفظ داده‌های پایدار به صورت پیش‌فرض):
./deploy.sh --uninstall webui
```

#### گام ۵: خاموش و روشن کردن کانتینرها در پایان کار (اختیاری)
هنگامی که کارتان با برنامه تمام شد:
```bash
# خاموش کردن کانتینر رابط وب
incus stop webui

# در صورت تمایل، خاموش کردن کانتینر اولاما برای آزادسازی رم و پردازنده گرافیکی
incus stop ollama
```

هر زمان مجدداً نیاز به استفاده داشتید، فقط کافی است دستور زیر را اجرا کنید:
```bash
incus start webui
```
رابط کاربری فوراً در نشانی `http://127.0.0.1:8080` در دسترس خواهد بود.

---

### دستورات مدیریت سرویس

| عملیات | دستور در ترمینال |
| :--- | :--- |
| **مشاهده وضعیت سرویس** | `incus exec webui -- systemctl status e-webui` |
| **مشاهده لاگ‌های زنده** | `incus exec webui -- journalctl -u e-webui -f` |
| **راه‌اندازی مجدد سرویس** | `incus exec webui -- systemctl restart e-webui` |
| **توقف سرویس** | `incus exec webui -- systemctl stop e-webui` |

---

### اجرای تست‌های خودکار

برای توسعه محلی و اجرای آزمون‌های واحد بدون نیاز به کانتینر (مطابق با اصل جداسازی زیرساخت و استفاده از Mockها):

```bash
# ایجاد و فعال‌سازی محیط مجازی پایتون
python3 -m venv .venv
source .venv/bin/activate

# نصب وابستگی‌های توسعه و آزمون
pip install -r requirements-dev.txt

# اجرای آزمون‌های واحد و یکپارچگی به صورت محلی
python3 -m unittest discover tests
```

برای اجرای تست‌های خودکار درون محیط کانتینر Incus:

```bash
# اجرای تست‌ها درون کانتینر پیش‌فرض (e-webui-app)
./scripts/test.sh

# یا با تعیین نام کانتینر سفارشی
./scripts/test.sh e-webui-app
```

---

### متغیرهای محیطی

| متغیر | مقدار پیش‌فرض | توضیحات |
| :--- | :--- | :--- |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | آدرس اندپوینت اولاما داخل کانتینر |
| `APP_HOST` | `0.0.0.0` | آدرس آی‌پی گوش فرا دادن برنامه FastAPI |
| `APP_PORT` | `8080` | پورت برنامه داخل کانتینر |
