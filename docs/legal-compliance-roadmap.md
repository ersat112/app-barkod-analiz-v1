# BarkodAnaliz Legal And Compliance Roadmap

This roadmap translates the product, independence, and liability patterns used by similar apps into BarkodAnaliz-specific work. It is a planning document, not legal advice.

## Turkey Launch Baseline

For Turkey-facing launch surfaces, the legal package should be aligned at minimum with:

- 6698 sayili Kisisel Verilerin Korunmasi Kanunu (KVKK)
- 6502 sayili Tuketicinin Korunmasi Hakkinda Kanun
- Mesafeli Sozlesmeler Yonetmeligi and related pre-information obligations
- E-commerce, commercial communication, and app-store billing rules where applicable

We should explicitly avoid importing foreign-law structures that do not match our market, especially:

- New York or other foreign governing-law defaults
- mandatory arbitration / class-action waiver language
- generic US subscription terms copied from another app

## Guiding Principle

BarkodAnaliz should adopt the structure of a mature consumer health-information product without copying any third party terms. All legal text, disclaimers, jurisdiction choices, and premium conditions must be drafted specifically for BarkodAnaliz and reviewed by counsel before public launch.

## P0 Documents

These are the minimum documents we should publish before broader launch:

1. Terms and Conditions
2. Privacy Policy
3. Medical and Informational Disclaimer
4. Premium Subscription Terms
5. User Contribution Policy
6. KVKK-compliant Clarification Text / Aydinlatma Metni

## P0 Product Statements

The app should clearly explain:

- Scores are informational and methodology-based, not guarantees.
- The app does not provide medical advice.
- Food, cosmetic, and medicine content may be incomplete or delayed.
- Users must verify ingredients and product labels directly on packaging.
- Medicine summaries do not replace a pharmacist, doctor, or official leaflet.
- Product alternatives are independent and non-sponsored.

## P0 Clauses To Draft

### 1. Mission and Independence

Describe BarkodAnaliz's mission:

- help users understand product composition
- support more informed choices
- encourage transparency and better reformulation

State independence clearly:

- no paid ranking influence
- no sponsored alternatives
- no sale of user data
- premium revenue and other declared revenue sources fund the app

### 2. Database and Content Limitations

Explain that data may come from:

- open databases
- user contributions
- brand-provided label data
- BarkodAnaliz curation and shared cache

Explain limits:

- BarkodAnaliz does not laboratory-test every product
- label transcription and detection errors can happen
- ingredients and formulas may change over time

### 3. Methodology Disclosures

Document, in plain language:

- food scoring dimensions
- cosmetic ingredient-risk logic
- medicine information scope
- personal suitability preferences versus product score

### 4. Medical Disclaimer

State that:

- BarkodAnaliz is not a doctor, pharmacist, or dietitian
- the app is not diagnosis or treatment guidance
- users should consult professionals for allergies, chronic conditions, pregnancy, children, or medicine use

### 5. Premium Terms

Clarify:

- subscription billing cycle
- renewal behavior
- restore and cancellation flow
- what premium features do and do not guarantee
- digital-content withdrawal rules and exceptions for Turkey-facing flows

### 6. User Contributions

Require contributors to:

- upload only data and photos they have rights to use
- avoid malicious or knowingly false edits
- accept moderation and takedown

### 7. Dispute and Jurisdiction

Do not copy another company's governing law, arbitration, or class-waiver language.

Choose these only after deciding:

- which legal entity operates BarkodAnaliz
- the Turkish company title, address, and tax / registry details
- how consumer complaints, hakem heyeti thresholds, and court jurisdiction will be referenced

## UI And Product Work

We should expose legal clarity in the product, not only on a website.

### Settings

Add entries for:

- Terms and Conditions
- Privacy Policy
- Methodology and Sources
- Medical Disclaimer
- Premium Terms
- Independence Policy

### Detail Screens

Show short notices where relevant:

- medicine: general information only
- food/cosmetics: score is an informational assessment
- alternatives: independent recommendations, not sponsored placement

## Implementation Plan

### Phase 1

- Draft BarkodAnaliz-specific legal text
- Publish hosted legal pages
- Link them from app settings and onboarding
- replace all foreign-law assumptions with Turkey-specific language

### Phase 2

- Add inline disclaimers to detail screens
- Add independence and recommendation policy page
- Add contributor policy confirmation to missing-product flow

### Phase 3

- Add change log for methodology updates
- Add region-specific versions if we launch in multiple jurisdictions
- Add internal legal review checklist for every scoring-method update
- finalize company identity fields, KVKK request channel, and Turkish premium disclosure copy

## Operational Recommendation

Before wider production launch, BarkodAnaliz should operate with:

- published legal pages
- visible in-app disclaimers
- a documented scoring methodology
- a declared independence policy
- a consistent premium policy

That combination builds user trust and reduces avoidable legal risk.
