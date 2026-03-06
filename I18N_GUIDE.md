# Internationalization (i18n) Guide

This project now uses **react-i18next** for managing translations and content in both the web app and desktop app.

## 📁 Structure

### Web App (`/web/src/`)
```
web/src/
├── i18n.ts                    # i18n configuration
└── locales/
    └── en/
        ├── common.json        # Shared strings (buttons, nav, footer)
        ├── landing.json       # Landing page content
        ├── pricing.json       # Pricing page content
        └── auth.json          # Authentication strings
```

### Desktop App (`/src/`)
```
src/
├── renderer/src/i18n.ts      # i18n configuration
└── locales/
    └── en/
        ├── app.json           # Main app UI strings
        ├── login.json         # Login screen
        └── subscribe.json     # Subscribe screen
```

## 🚀 Usage in Components

### Basic Usage

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('namespace');

  return <h1>{t('key')}</h1>;
}
```

### Using Different Namespaces

```tsx
// Default namespace from hook
const { t } = useTranslation('landing');
{t('hero.title')}  // Uses 'landing' namespace

// Accessing other namespaces
{t('buttons.downloadNow', { ns: 'common' })}  // Uses 'common' namespace
```

### Interpolation

```tsx
// In JSON: "greeting": "Hello {{name}}"
{t('greeting', { name: 'John' })}  // Output: "Hello John"
```

### Pluralization

```tsx
// In JSON:
// "item": "{{count}} item",
// "item_other": "{{count}} items"

{t('item', { count: 1 })}   // "1 item"
{t('item', { count: 5 })}   // "5 items"
```

### Arrays/Objects

```tsx
// In JSON: "features": ["Feature 1", "Feature 2"]
{t('features', { returnObjects: true }).map((feature) => ...)}
```

## 📝 Updated Components

### Web App
- ✅ `Hero.tsx` - Uses `landing` namespace
- ✅ `PricingPage.tsx` - Uses `pricing` namespace

### Desktop App
- ✅ `LoginScreen.tsx` - Uses `login` namespace
- ✅ `SubscribeScreen.tsx` - Uses `subscribe` namespace

## 🌍 Adding New Languages

1. Create new language folder:
   ```
   web/src/locales/es/
   src/locales/es/
   ```

2. Copy English JSON files and translate:
   ```json
   {
     "hero": {
       "title": "Conoce a Mochi",
       "description": "El asistente amigable..."
     }
   }
   ```

3. Update `i18n.ts` to include new language:
   ```ts
   import commonEn from './locales/en/common.json';
   import commonEs from './locales/es/common.json';

   const resources = {
     en: { common: commonEn },
     es: { common: commonEs },
   };
   ```

4. Add language switcher component (optional):
   ```tsx
   const { i18n } = useTranslation();

   <button onClick={() => i18n.changeLanguage('es')}>
     Español
   </button>
   ```

## 🔧 Best Practices

1. **Keep keys descriptive**: Use `hero.title` instead of `h1`
2. **Group by feature**: Organize keys by component/feature area
3. **Use namespaces**: Separate concerns (common, landing, pricing, etc.)
4. **Avoid hardcoded strings**: Extract all user-facing text to JSON
5. **Use interpolation**: For dynamic content like `{{name}}` or `{{count}}`
6. **Default namespace**: Set the most commonly used namespace as default in `i18n.init()`

## 📚 Namespaces

### Web App
- `common` - Shared UI elements (buttons, navigation, footer)
- `landing` - Landing page content (hero, features, FAQ, testimonials)
- `pricing` - Pricing plans and subscription info
- `auth` - Login, signup, password reset

### Desktop App
- `app` - Main application UI (default)
- `login` - Login screen
- `subscribe` - Subscribe/subscription required screen

## 🎯 Next Steps

To fully internationalize the app:

1. Extract remaining hardcoded strings from other components
2. Add Features, FAQ, and Testimonials components to use translations
3. Create language switcher component
4. Add additional languages (Spanish, French, etc.)
5. Consider using i18next-parser to auto-extract strings
6. Add type safety with typescript-plugin-i18next

## 📖 Resources

- [react-i18next Documentation](https://react.i18next.com/)
- [i18next Documentation](https://www.i18next.com/)
- [Translation Management Tools](https://locize.com/) (optional)
