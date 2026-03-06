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

  // ⚖️ Puanlama Mantığı (Health Score)
  const highRiskCount = foundECodes.filter(e => e.risk === 'Yüksek').length;
  const moderateRiskCount = foundECodes.filter(e => e.risk === 'Orta').length;
  const productGrade = (product.grade || 'b').toLowerCase();

  let healthScore = 100;
  
  // Nutri-Score Kesintisi
  const penalties: Record<string, number> = { a: 0, b: 10, c: 30, d: 55, e: 75 };
  healthScore -= (penalties[productGrade] || 20);

  // Katkı Maddesi Kesintisi
  healthScore -= (highRiskCount * 30);
  healthScore -= (moderateRiskCount * 12);

  // Puan Sınırlandırma
  healthScore = Math.max(0, Math.min(100, healthScore));

  // 🚦 Durum Belirleme
  let riskLevel: 'Düşük' | 'Orta' | 'Yüksek' = 'Düşük';
  let color = '#1ED760'; 
  let recommendation = "İçerik temiz ve güvenle tüketilebilir.";

  if (healthScore < 45 || highRiskCount > 0) {
    riskLevel = 'Yüksek';
    color = '#FF4444';
    recommendation = "Yüksek riskli maddeler tespit edildi. Tüketimi önerilmez.";
  } else if (healthScore < 75 || moderateRiskCount > 0) {
    riskLevel = 'Orta';
    color = '#FFD700';
    recommendation = "Bazı riskli maddeler içeriyor. Sınırlı tüketilmesi önerilir.";
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