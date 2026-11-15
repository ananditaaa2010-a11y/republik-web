const path = require('path');

module.exports = {
  WHATSAPP_WEB_URL: 'https://web.whatsapp.com',

  // Platform supported mapping
  PLATFORMS: {
    WHATSAPP: 'whatsapp',
    TELEGRAM: 'telegram',
    GMAIL: 'gmail'
  },

  PLATFORM_URLS: {
    whatsapp: 'https://web.whatsapp.com',
    telegram: 'https://web.telegram.org/a/',
    gmail: 'https://mail.google.com/mail/u/0/'
  },

  DEFAULT_PLATFORM_COLORS: {
    whatsapp: '#10b981',
    telegram: '#229ed9',
    gmail: '#ea4335'
  },

  SIDEBAR_WIDTH: 64,
  // Microsoft Edge User-Agent to enable WhatsApp Web Calling, Channels & Meta AI
  CHROME_USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0',
  // Standard Firefox User-Agent used to bypass Google Botguard embedded Chromium blocks
  FIREFOX_USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0'
};
