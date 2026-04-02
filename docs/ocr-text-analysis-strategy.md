# OCR Text Analysis Strategy

## Goal

Enable real text-based analysis for:

- food `ingredients_text`
- cosmetic `INCI / ingredients`
- medicine `ne için kullanılır / etkin madde / uyarılar`

The text pipeline should not pretend to be barcode-level certainty. It should clearly communicate confidence and source quality.

## Recommended Runtime Flow

1. Camera frame captures ingredient or usage text.
2. Google ML Kit Text Recognition extracts raw text on device.
3. App normalizes text:
   - lowercasing
   - Turkish character normalization
   - line merge and duplicate cleanup
   - punctuation simplification
4. App classifies the text:
   - food
   - beauty
   - medicine
5. App tries structured matching:
   - barcode/product match if nearby signals exist
   - Open Food Facts / Open Beauty Facts name search candidate lookup
6. If no reliable product match exists, app runs local text scoring.
7. UI shows:
   - `OCR ile okundu`
   - `Tahmini analiz`
   - confidence badge

## Product Decision

### Food

Use a hybrid model:

- If OFF product match confidence is high, prefer OFF-backed structured product analysis.
- If no reliable match exists, analyze extracted text locally.

Local food text signals:

- allergens
- additives / E-codes
- nutrition-direction signals inferred from claims and ingredient density
- clean ingredient heuristics

Important:

- OCR text alone is not enough to compute a full Nutri-Score equivalent.
- Full nutrition scoring still needs structured nutriments.
- Therefore text-only mode should produce:
  - allergen warnings
  - additive warnings
  - ingredient simplicity score
  - confidence level

### Beauty

Use the same hybrid model:

- If OBF match is strong, prefer OBF-backed ingredient model.
- Otherwise run local INCI parsing.

Local beauty text signals:

- known risky ingredients
- fragrance / allergen markers
- preservative flags
- essential ingredient transparency

Text-only beauty mode should return:

- risk buckets by ingredient
- watchlist hits
- confidence level

### Medicine

Medicine OCR should not create a pseudo-medical risk score.

Recommended output:

- `what it is for` summary
- active ingredient detection
- dosage form detection
- warning that this does not replace the official leaflet

Medicine text mode should stay informational, not promotional or diagnostic.

## Confidence Tiers

- `High`
  Structured product matched from OFF/OBF or official medicine source
- `Medium`
  OCR is clean and local parser found strong ingredient markers
- `Low`
  OCR noisy, incomplete, or only partial match

## Suggested Scoring Model

### Food text-only

Build a temporary text score out of 100:

- 40 points: allergen / trace severity
- 30 points: additive severity
- 20 points: ingredient simplicity
- 10 points: suspicious processing markers

Display this as:

- `Metin Bazlı İçerik Sinyali`

Do not label it as Nutri-Score.

### Beauty text-only

- 50 points: ingredient risk severity
- 25 points: fragrance / sensitizer intensity
- 15 points: preservative profile
- 10 points: transparency / missing-data penalty

Display this as:

- `Metin Bazlı İçerik Riski`

### Medicine text-only

No aggregate health score.

Display:

- official summary card if matched
- text-derived usage summary if not matched

## OFF / OBF Usage

Open Food Facts can help in two ways:

- direct barcode product lookup
- full-text product search candidate generation

Open Food Facts documentation also indicates:

- product lookup by barcode is the core read path
- only the v1 search API supports full-text search
- there is an ingredient-related analysis journey for new or existing products
- OCR result datasets exist for OFF images

Open Beauty Facts is powered by the same Product Opener family, so the same platform model can be reused for beauty candidate matching.

## Recommendation For BarkodAnaliz

Do not choose between `OFF/OBF` and `our own algorithm`.

Use both:

1. `Match first`
   - OFF/OBF/offical source if confidence is high
2. `Score second`
   - our own local text parser if match is weak or absent
3. `Always disclose confidence`

This is the most honest and scalable model.

## Engineering Path

### P0

- real ML Kit OCR integration
- text normalization pipeline
- OCR confidence banner
- family allergen + watched additive text parser

### P1

- OFF/OBF candidate search from OCR text
- text-only heuristic scoring for food and beauty
- medicine usage summary extraction templates

### P2

- camera overlay guidance for ingredient capture quality
- server-side canonical parsing improvements
- OCR analytics and failure monitoring
