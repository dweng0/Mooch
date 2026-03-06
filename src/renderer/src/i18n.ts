import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import app from '../../locales/en/app.json';
import login from '../../locales/en/login.json';
import subscribe from '../../locales/en/subscribe.json';

// Define resources type for type safety
const resources = {
  en: {
    app,
    login,
    subscribe,
  },
} as const;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    defaultNS: 'app',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
