/**
 * Centralized Internationalization (i18n) Dictionary
 * Provides English base strings and Persian translations.
 */

export const STRINGS = {
  en: {
    app_title: 'e-webui',
    new_chat: 'New chat',
    search_chats: 'Search chats...',
    chats: 'Chats',
    library: 'Library',
    tools: 'Tools',
    today: 'Today',
    yesterday: 'Yesterday',
    prev_7_days: 'Previous 7 days',
    older: 'Older',
    rename: 'Rename',
    pin: 'Pin',
    delete: 'Delete',
    export: 'Export',
    share: 'Share',
    settings: 'Settings',
    ollama_connected: 'Ollama connected',
    ollama_offline: 'Ollama offline',
    good_morning: 'Good morning, Ellie',
    good_afternoon: 'Good afternoon, Ellie',
    good_evening: 'Good evening, Ellie',
    composer_placeholder: 'How can I help you today?',
    think: 'Think',
    scroll_latest: 'Scroll to latest',
    disclaimer: 'Local models can make mistakes. Check important info.',
    file_upload_disabled: 'File upload is not available yet',
    copy: 'Copy',
    copied: 'Copied!',
    reasoning: 'Reasoning',
    mic_tooltip: 'Voice input is not available yet',
    manage_models_disabled: 'Manage models is not available yet',
    loading_model: 'Loading model…',
    retry: 'Retry',
    reasoning_only: 'The model returned only reasoning',
    search_models: 'Search models...',
    send_enter: 'Send (Enter)',
    stop_generation: 'Stop generation'
  },
  fa: {
    app_title: 'e-webui',
    new_chat: 'گفتگوی جدید',
    search_chats: 'جستجوی گفتگوها...',
    chats: 'گفتگوها',
    library: 'کتابخانه',
    tools: 'ابزارها',
    today: 'امروز',
    yesterday: 'دیروز',
    prev_7_days: '۷ روز گذشته',
    older: 'قدیمی‌تر',
    rename: 'تغییر نام',
    pin: 'سنجاق کردن',
    delete: 'حذف',
    export: 'خروجی',
    share: 'اشتراک‌گذاری',
    settings: 'تنظیمات',
    ollama_connected: 'اولاما متصل است',
    ollama_offline: 'اولاما قطع است',
    good_morning: 'صبح بخیر، الی',
    good_afternoon: 'عصر بخیر، الی',
    good_evening: 'شب بخیر، الی',
    composer_placeholder: 'امروز چطور می‌توانم کمکتان کنم؟',
    think: 'تفکر',
    scroll_latest: 'رفتن به جدیدترین پیام',
    disclaimer: 'مدل‌های محلی ممکن است اشتباه کنند. اطلاعات مهم را بررسی کنید.',
    file_upload_disabled: 'بارگذاری فایل هنوز در دسترس نیست',
    copy: 'رونوشت',
    copied: 'کپی شد!',
    reasoning: 'استدلال',
    mic_tooltip: 'ورودی صوتی هنوز در دسترس نیست',
    manage_models_disabled: 'مدیریت مدل‌ها هنوز در دسترس نیست',
    loading_model: 'در حال بارگذاری مدل...',
    retry: 'تلاش مجدد',
    reasoning_only: 'مدل فقط استدلال ارائه کرد',
    search_models: 'جستجوی مدل‌ها...',
    send_enter: 'ارسال (Enter)',
    stop_generation: 'توقف تولید'
  }
};

let currentLanguage = 'en';

export function setLanguage(lang) {
  if (STRINGS[lang]) {
    currentLanguage = lang;
  }
}

export function t(key) {
  return (STRINGS[currentLanguage] && STRINGS[currentLanguage][key]) || STRINGS.en[key] || key;
}
