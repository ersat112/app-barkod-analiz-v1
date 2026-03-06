/**
 * ErEnesAl® v1 - Profesyonel Barkod Çözümleme ve Global Menşei Motoru
 * GS1 uluslararası standartlarına uygun olarak tüm ülke ön eklerini içerir.
 */

export interface BarcodeMetadata {
  isValid: boolean;
  type: 'EAN-13' | 'EAN-8' | 'UPC-A' | 'UPC-E' | 'UNKNOWN';
  country?: string;
  normalizedData: string;
}

export const barcodeDecoder = {
  /**
   * GS1 Uluslararası Ön Ek Sözlüğü
   * Neredeyse tüm dünya ülkelerini kapsayan kapsamlı liste.
   */
  getCountryByPrefix: (prefix: number): string => {
    if (prefix >= 0 && prefix <= 19) return "ABD / Kanada";
    if (prefix >= 30 && prefix <= 39) return "ABD (İlaç)";
    if (prefix >= 300 && prefix <= 379) return "Fransa / Monako";
    if (prefix === 380) return "Bulgaristan";
    if (prefix === 383) return "Slovenya";
    if (prefix === 385) return "Hırvatistan";
    if (prefix === 387) return "Bosna-Hersek";
    if (prefix === 389) return "Karadağ";
    if (prefix >= 400 && prefix <= 440) return "Almanya";
    if ((prefix >= 450 && prefix <= 459) || (prefix >= 490 && prefix <= 499)) return "Japonya";
    if (prefix >= 460 && prefix <= 469) return "Rusya";
    if (prefix === 470) return "Kırgızistan";
    if (prefix === 471) return "Tayvan";
    if (prefix === 474) return "Estonya";
    if (prefix === 475) return "Letonya";
    if (prefix === 476) return "Azerbaycan";
    if (prefix === 477) return "Litvanya";
    if (prefix === 478) return "Özbekistan";
    if (prefix === 479) return "Sri Lanka";
    if (prefix === 480) return "Filipinler";
    if (prefix === 481) return "Belarus";
    if (prefix === 482) return "Ukrayna";
    if (prefix === 484) return "Moldova";
    if (prefix === 485) return "Ermenistan";
    if (prefix === 486) return "Gürcistan";
    if (prefix === 487) return "Kazakistan";
    if (prefix === 488) return "Tacikistan";
    if (prefix === 489) return "Hong Kong";
    if (prefix >= 500 && prefix <= 509) return "Birleşik Krallık";
    if (prefix >= 520 && prefix <= 521) return "Yunanistan";
    if (prefix === 528) return "Lübnan";
    if (prefix === 529) return "Güney Kıbrıs";
    if (prefix === 530) return "Arnavutluk";
    if (prefix === 531) return "Makedonya";
    if (prefix === 535) return "Malta";
    if (prefix === 539) return "İrlanda";
    if (prefix >= 540 && prefix <= 549) return "Belçika / Lüksemburg";
    if (prefix === 560) return "Portekiz";
    if (prefix === 569) return "İzlanda";
    if (prefix >= 570 && prefix <= 579) return "Danimarka / Grönland";
    if (prefix === 590) return "Polonya";
    if (prefix === 594) return "Romanya";
    if (prefix === 599) return "Macaristan";
    if (prefix >= 600 && prefix <= 601) return "Güney Afrika";
    if (prefix === 603) return "Gana";
    if (prefix === 604) return "Senegal";
    if (prefix === 608) return "Bahreyn";
    if (prefix === 609) return "Mauritius";
    if (prefix === 611) return "Fas";
    if (prefix === 613) return "Cezayir";
    if (prefix === 615) return "Nijerya";
    if (prefix === 616) return "Kenya";
    if (prefix === 618) return "Fildişi Sahili";
    if (prefix === 619) return "Tunus";
    if (prefix === 620) return "Tanzanya";
    if (prefix === 621) return "Suriye";
    if (prefix === 622) return "Mısır";
    if (prefix === 623) return "Brunei";
    if (prefix === 624) return "Libya";
    if (prefix === 625) return "Ürdün";
    if (prefix === 626) return "İran";
    if (prefix === 627) return "Kuveyt";
    if (prefix === 628) return "Suudi Arabistan";
    if (prefix === 629) return "B.A.E.";
    if (prefix >= 640 && prefix <= 649) return "Finlandiya";
    if (prefix >= 690 && prefix <= 699) return "Çin";
    if (prefix >= 700 && prefix <= 709) return "Norveç";
    if (prefix === 729) return "İsrail";
    if (prefix >= 730 && prefix <= 739) return "İsveç";
    if (prefix === 740) return "Guatemala";
    if (prefix === 741) return "El Salvador";
    if (prefix === 742) return "Honduras";
    if (prefix === 743) return "Nikaragua";
    if (prefix === 744) return "Kosta Rika";
    if (prefix === 745) return "Panama";
    if (prefix === 746) return "Dominik Cumh.";
    if (prefix === 750) return "Meksika";
    if (prefix >= 754 && prefix <= 755) return "Kanada";
    if (prefix === 759) return "Venezuela";
    if (prefix >= 760 && prefix <= 769) return "İsviçre / Lihtenştayn";
    if (prefix >= 770 && prefix <= 771) return "Kolombiya";
    if (prefix === 773) return "Uruguay";
    if (prefix === 775) return "Peru";
    if (prefix === 777) return "Bolivya";
    if (prefix >= 778 && prefix <= 779) return "Arjantin";
    if (prefix === 780) return "Şili";
    if (prefix === 784) return "Paraguay";
    if (prefix === 786) return "Ekvador";
    if (prefix >= 789 && prefix <= 790) return "Brezilya";
    if (prefix >= 800 && prefix <= 839) return "İtalya";
    if (prefix >= 840 && prefix <= 849) return "İspanya";
    if (prefix === 850) return "Küba";
    if (prefix === 858) return "Slovakya";
    if (prefix === 859) return "Çekya";
    if (prefix === 860) return "Sırbistan";
    if (prefix === 865) return "Moğolistan";
    if (prefix === 867) return "Kuzey Kore";
    if (prefix >= 868 && prefix <= 869) return "Türkiye";
    if (prefix >= 870 && prefix <= 879) return "Hollanda";
    if (prefix === 880) return "Güney Kore";
    if (prefix === 884) return "Kamboçya";
    if (prefix === 885) return "Tayland";
    if (prefix === 888) return "Singapur";
    if (prefix === 890) return "Hindistan";
    if (prefix === 893) return "Vietnam";
    if (prefix === 896) return "Pakistan";
    if (prefix === 899) return "Endonezya";
    if (prefix >= 900 && prefix <= 919) return "Avusturya";
    if (prefix >= 930 && prefix <= 939) return "Avustralya";
    if (prefix >= 940 && prefix <= 949) return "Yeni Zelanda";
    if (prefix === 955) return "Malezya";
    if (prefix === 958) return "Makao";

    return "Uluslararası / Bilinmiyor";
  },

  /**
   * Barkodun kontrol basamağını doğrular.
   */
  validateChecksum: (barcode: string): boolean => {
    if (!/^\d+$/.test(barcode)) return false;
    const digits = barcode.split('').map(Number);
    const lastDigit = digits.pop();
    const sum = digits
      .reverse()
      .reduce((acc, digit, idx) => acc + (idx % 2 === 0 ? digit * 3 : digit), 0);
    const calculated = (10 - (sum % 10)) % 10;
    return lastDigit === calculated;
  },

  /**
   * Tarayıcı verisini işler.
   */
  decode: (rawData: string): BarcodeMetadata => {
    const normalized = rawData.replace(/[^0-9]/g, '').trim();
    const length = normalized.length;
    let type: BarcodeMetadata['type'] = 'UNKNOWN';
    let isValid = false;

    if (length === 13) { type = 'EAN-13'; isValid = barcodeDecoder.validateChecksum(normalized); }
    else if (length === 8) { type = 'EAN-8'; isValid = barcodeDecoder.validateChecksum(normalized); }
    else if (length === 12) { type = 'UPC-A'; isValid = barcodeDecoder.validateChecksum(normalized); }

    const prefix = parseInt(normalized.substring(0, 3), 10);

    return {
      isValid,
      type,
      normalizedData: normalized,
      country: isValid ? barcodeDecoder.getCountryByPrefix(prefix) : undefined
    };
  }
};