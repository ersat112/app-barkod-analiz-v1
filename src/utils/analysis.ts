import { E_CODES_DATA } from '../services/eCodesData';

/**
 * 🔬 ErEnesAl® v1 - Merkezi Analiz Motoru
 * Gıda ve Kozmetik ürünleri için hibrit risk analizi ve puanlama sağlar.
 */

export interface Product {
  barcode: string;
  name: string;
  brand: string;
  image_url: string;
  type: 'food' | 'beauty';
  score?: number;
  grade?: string; 
  ingredients_text?: string;
  additives?: string[];
  nutriments?: any;
  nutrient_levels?: any;
  // 🧴 Kozmetik API için gerekli alan
  usage_instructions?: string; 
}

export interface AnalysisResult {
  riskLevel: 'Düşük' | 'Orta' | 'Yüksek';
  foundECodes: any[];
  summary: string;
  color: string;
  recommendation: string;
  score: number; // Detay ekranındaki sağlık skoru
}

export const analyzeProduct = (product: Product): AnalysisResult => {
  const text = (product.ingredients_text || "").toUpperCase();
  const foundECodesMap = new Map<string, any>();
  
  // 1️⃣ RegEx Tarama (E-Kodları)
  const eCodeRegex = /E[- ]?\d{3,4}[a-z]?/gi;
  const matches = text.match(eCodeRegex) || [];
  
  matches.forEach(m => {
    const rawMatch = String(m);
    const cleanCode = rawMatch.replace(/[- ]/g, "").toUpperCase(); 
    if (E_CODES_DATA[cleanCode]) {
      foundECodesMap.set(cleanCode, { ...E_CODES_DATA[cleanCode] });
    }
  });

  // 2️⃣ İsim Bazlı Tarama (Gizli içerikler)
  Object.keys(E_CODES_DATA).forEach(code => {
    const additive = E_CODES_DATA[code];
    if (additive.name && text.includes(additive.name.toUpperCase())) {
      if (!foundECodesMap.has(code)) {
        foundECodesMap.set(code, { ...additive });
      }
    }
  });

  const foundECodes = Array.from(foundECodesMap.values());

  // ⚖️ Skor tamamen API değerinden alınır, dahili faktörlerle oynanmaz.
  // OpenFoodFacts nutriscore_score değeri -15..40 aralığındadır (düşük daha iyi).
  // Uygulama tarafında yalnızca görselleştirme için 0..100 bandına normalize edilir.
  const apiScoreRaw = typeof product.score === 'number' ? product.score : null;
  const normalizedApiScore = apiScoreRaw === null
    ? null
    : Math.max(0, Math.min(100, Math.round((40 - apiScoreRaw) / 55 * 100)));

  const gradeToScore: Record<string, number> = {
    a: 95,
    b: 80,
    c: 60,
    d: 35,
    e: 10,
  };
  const productGrade = (product.grade || 'unknown').toLowerCase();
  const healthScore = normalizedApiScore ?? gradeToScore[productGrade] ?? 0;

  // 🚦 Durum Belirleme
  let riskLevel: 'Düşük' | 'Orta' | 'Yüksek' = 'Düşük';
  let color = '#1ED760'; 
  let recommendation = "İçerik temiz ve güvenle tüketilebilir.";

  if (healthScore < 45) {
    riskLevel = 'Yüksek';
    color = '#FF4444';
    recommendation = "API skoruna göre ürün risk seviyesi yüksek görünüyor.";
  } else if (healthScore < 75) {
    riskLevel = 'Orta';
    color = '#FFD700';
    recommendation = "API skoruna göre ürün orta risk seviyesinde.";
  } else {
    recommendation = "API skoruna göre ürün düşük risk seviyesinde.";
  }

  // 💡 ÖNEMLİ: AnalysisResult interface'indeki TÜM alanlar burada dönmelidir.
  return {
    riskLevel,
    foundECodes,
    summary: foundECodes.length > 0 ? `${foundECodes.length} içerik bileşeni incelendi.` : "Riskli madde bulunamadı.",
    color,
    recommendation,
    score: healthScore // Bu alan eksikse imza satırı hata verir!
  };
};
