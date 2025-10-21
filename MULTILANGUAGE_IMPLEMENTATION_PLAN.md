# Wayzo Multi-Language Implementation Plan

## Current Status

### What's Working
- ✅ Translation file exists (`frontend/translations.js`) with 10 languages
- ✅ Language selector UI present in main page
- ✅ Basic language switching infrastructure exists
- ✅ Languages supported: EN, ES, FR, DE, IT, PT, RU, ZH, JA, KO

### What's Broken
- ❌ Language selector doesn't work (uses jQuery `:contains()` selectors in vanilla JS)
- ❌ Translations not applied to all UI elements
- ❌ AI-generated content always in English (no language parameter sent to API)
- ❌ Backend doesn't support language parameter
- ❌ No language support in backoffice/personal cabinet
- ❌ No language persistence across pages
- ❌ Email notifications always in English

## Implementation Plan

### Phase 1: Fix Current Language Selector (PRIORITY)
**Estimated Time: 2-3 hours**

#### 1.1 Fix Language Switching in Frontend
- [ ] Replace jQuery-style `:contains()` selectors with proper vanilla JS
- [ ] Add `data-i18n` attributes to all translatable elements
- [ ] Create proper `updatePageLanguage()` function
- [ ] Test language switching works for all UI elements

**Files to modify:**
- `frontend/app.js` - Fix `changeLanguage()` function
- `frontend/index.backend.html` - Add `data-i18n` attributes

#### 1.2 Add Language Selector to Backoffice
- [ ] Copy language selector from main page
- [ ] Add translations for backoffice-specific elements
- [ ] Ensure language preference persists

**Files to modify:**
- `frontend/backoffice.html` - Add language selector
- `frontend/translations.js` - Add backoffice translations

### Phase 2: Backend Language Support (HIGH PRIORITY)
**Estimated Time: 4-6 hours**

#### 2.1 Accept Language Parameter in API
- [ ] Add `language` field to `/api/plan` endpoint
- [ ] Add `language` field to `/api/user/plan` endpoint
- [ ] Store language preference in database (`plans` table)
- [ ] Validate language code (ISO 639-1)

**Files to modify:**
- `backend/server.mjs` - Update API endpoints
- Database schema - Add `language` column to `plans` table

#### 2.2 Generate AI Content in User's Language
- [ ] Modify OpenAI prompt to include language instruction
- [ ] Add language-specific formatting instructions
- [ ] Test AI generation in all 10 languages
- [ ] Handle RTL languages (Arabic - future expansion)

**Files to modify:**
- `backend/server.mjs` - Update `generatePlanWithAI()` function

#### 2.3 Multi-Language Email Notifications
- [ ] Create email templates for each language
- [ ] Detect user language preference from plan data
- [ ] Send emails in user's preferred language

**Files to modify:**
- `backend/lib/email.mjs` - Add language support
- New file: `backend/lib/email-templates.mjs` - Language-specific templates

### Phase 3: Complete Translation Coverage (MEDIUM PRIORITY)
**Estimated Time: 6-8 hours**

#### 3.1 Translate All Frontend Pages
Create separate translation documents for each page:

**Pages to translate:**
1. `index.backend.html` - Main trip planning page
2. `backoffice.html` - Personal cabinet
3. `admin.html` - Admin dashboard (if public-facing)
4. Error messages and notifications
5. Form validation messages
6. Loading states and progress indicators

#### 3.2 Create Professional Translation Documents
For each language, create a comprehensive translation document:

**Document structure:**
```markdown
# Wayzo - [Language Name] Translation Guide

## Page: Main Application (index.backend.html)
- Navigation
- Form labels
- Button text
- Placeholder text
- Help text
- Error messages

## Page: Personal Cabinet (backoffice.html)
- Dashboard elements
- Plan list
- Plan detail view

## API Messages
- Success messages
- Error messages
- Validation messages

## Email Templates
- Welcome email
- Plan ready notification
- Password reset (if applicable)
```

**Languages to document:**
- [ ] English (EN) - Baseline
- [ ] Spanish (ES)
- [ ] French (FR)
- [ ] German (DE)
- [ ] Italian (IT)
- [ ] Portuguese (PT)
- [ ] Russian (RU)
- [ ] Chinese (ZH)
- [ ] Japanese (JA)
- [ ] Korean (KO)

### Phase 4: Advanced Features (LOW PRIORITY)
**Estimated Time: 4-6 hours**

#### 4.1 Language Detection
- [ ] Auto-detect browser language on first visit
- [ ] Suggest language change if browser language differs
- [ ] Remember user preference across sessions

#### 4.2 SEO Optimization
- [ ] Add `lang` attribute to HTML tag
- [ ] Add `hreflang` tags for search engines
- [ ] Create language-specific URLs (optional)

#### 4.3 Translation Management
- [ ] Create translation management script
- [ ] Validate translation completeness
- [ ] Check for missing translations
- [ ] Export/import translations for external translation services

## File Structure

```
wayzo/
├── frontend/
│   ├── translations.js           # Main translation file
│   ├── app.js                    # Updated with proper i18n
│   ├── index.backend.html        # Main page with data-i18n
│   └── backoffice.html           # Cabinet with language support
├── backend/
│   ├── server.mjs                # API with language support
│   └── lib/
│       ├── email.mjs             # Email with i18n
│       └── email-templates.mjs   # Language-specific templates
└── docs/
    └── translations/
        ├── EN-translation-guide.md
        ├── ES-translation-guide.md
        ├── FR-translation-guide.md
        ├── DE-translation-guide.md
        ├── IT-translation-guide.md
        ├── PT-translation-guide.md
        ├── RU-translation-guide.md
        ├── ZH-translation-guide.md
        ├── JA-translation-guide.md
        └── KO-translation-guide.md
```

## Database Schema Changes

### Plans Table - Add Language Column
```sql
-- Supabase migration
ALTER TABLE plans
ADD COLUMN language VARCHAR(5) DEFAULT 'en';

-- Create index for faster queries
CREATE INDEX idx_plans_language ON plans(language);
```

## API Changes

### Request Format (Updated)
```json
{
  "destination": "Paris",
  "start": "2025-11-01",
  "end": "2025-11-05",
  "budget": 2000,
  "language": "fr"  // NEW FIELD
}
```

### Response Format (Updated)
```json
{
  "ok": true,
  "id": "abc123",
  "language": "fr",  // NEW FIELD
  "markdown": "# Votre voyage à Paris...",
  "html": "<h1>Votre voyage à Paris...</h1>"
}
```

## OpenAI Prompt Modifications

### Current Prompt (English only)
```
Generate a detailed trip itinerary for {destination}...
```

### New Multi-Language Prompt
```javascript
const languageInstructions = {
  'en': 'Generate the entire response in English.',
  'es': 'Genera toda la respuesta en español.',
  'fr': 'Générez toute la réponse en français.',
  'de': 'Generieren Sie die gesamte Antwort auf Deutsch.',
  'it': 'Genera l\'intera risposta in italiano.',
  'pt': 'Gere toda a resposta em português.',
  'ru': 'Создайте весь ответ на русском языке.',
  'zh': '请用中文生成整个回复。',
  'ja': '回答全体を日本語で生成してください。',
  'ko': '전체 답변을 한국어로 생성하세요.'
};

const prompt = `
Generate a detailed trip itinerary for ${destination}.

IMPORTANT: ${languageInstructions[language] || languageInstructions['en']}

All content including headers, descriptions, recommendations, and budget details
must be in the specified language.

[rest of prompt...]
`;
```

## Testing Checklist

### Phase 1 Testing
- [ ] Language selector changes UI text correctly
- [ ] All UI elements translate properly
- [ ] Language preference persists after page reload
- [ ] Language works in both main page and backoffice

### Phase 2 Testing
- [ ] API accepts language parameter
- [ ] AI generates content in requested language
- [ ] Content quality is good in all languages
- [ ] Database stores language preference
- [ ] Emails sent in correct language

### Phase 3 Testing
- [ ] All pages fully translated
- [ ] No missing translations
- [ ] Professional translation quality
- [ ] Consistent terminology across pages

### Phase 4 Testing
- [ ] Auto-detection works correctly
- [ ] SEO tags present and correct
- [ ] Translation management tools functional

## Rollout Strategy

### Stage 1: Fix Critical Issues (Week 1)
1. Fix language selector (Phase 1.1)
2. Add basic backend support (Phase 2.1)
3. Deploy and test with English/Spanish

### Stage 2: Full Language Support (Week 2)
1. Complete AI language generation (Phase 2.2)
2. Add email translations (Phase 2.3)
3. Test with all 10 languages

### Stage 3: Polish and Documentation (Week 3)
1. Complete translation coverage (Phase 3)
2. Create translation documents
3. Add advanced features (Phase 4)

## Maintenance Plan

### Regular Tasks
- [ ] Review translations quarterly for accuracy
- [ ] Add new UI elements to translation files
- [ ] Update email templates when content changes
- [ ] Monitor user feedback per language
- [ ] Track most-used languages in analytics

### Quality Assurance
- [ ] Native speaker review for each language
- [ ] Professional translation service (optional)
- [ ] A/B testing of translations
- [ ] User feedback collection

## Success Metrics

- ✅ 100% UI elements translated
- ✅ AI content generation works in all 10 languages
- ✅ Email notifications in user's language
- ✅ <5% translation-related support tickets
- ✅ Language selector usage >30% of users
- ✅ No English fallback needed

## Resources Needed

### Development
- 16-22 hours development time
- Access to native speakers for QA
- OpenAI API testing budget

### Optional
- Professional translation service ($500-1000)
- Translation management system
- Crowdsourced translation platform

## Notes

1. **Keep English as fallback** - If translation missing, show English
2. **Test with real users** - Get native speakers to test each language
3. **Start small** - Begin with 2-3 popular languages, expand gradually
4. **Monitor costs** - OpenAI API costs may increase with non-English prompts
5. **Cultural adaptation** - Consider cultural differences in content (holidays, currency, etc.)

## Quick Start Implementation (Immediate Action)

For immediate improvements, focus on:

1. **Fix language selector** (2 hours)
   - Replace jQuery selectors
   - Add proper event handlers
   - Test basic translation

2. **Add language to API** (1 hour)
   - Accept `language` parameter
   - Pass to OpenAI prompt
   - Return in response

3. **Test with 2 languages** (1 hour)
   - English + Spanish
   - Verify end-to-end flow
   - Deploy to staging

**Total time for MVP: 4 hours**
