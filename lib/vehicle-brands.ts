/** Display/input dictionary. Never rewrite stored works or public SEO copy. */
export interface VehicleBrandLogoAsset {
  src: string;
  source: string;
  usageNote: string;
  /** Omit for brand colours; never infer treatment from the filename. */
  appearance?: 'monochrome' | 'metallic' | 'yellow';
  width?: 32;
}

export interface VehicleBrand {
  id: string;
  label: string;
  aliases: readonly string[];
  logo?: VehicleBrandLogoAsset;
}

// Per-file provenance and unchanged-shape processing are recorded in public/brands/README.md.
// Commons copyright labels are not a trademark licence or an endorsement.
const LOCAL_LOGOS: Readonly<Record<string, VehicleBrandLogoAsset>> = {
  'porsche': { src: '/brands/porsche-crest.png', source: 'https://commons.wikimedia.org/wiki/File:Porsche-seeklogo.svg', usageNote: 'Kai xzzrs / CC BY 4.0 as declared by uploader; uploader authority and original brand rights unconfirmed; local raster derivative credited at /brands/credits.html.' },
  'bmw': { src: '/brands/bmw.svg', source: 'https://commons.wikimedia.org/wiki/File:BMW_logo_(gray).svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.' },
  'mercedes-benz': { src: '/brands/mercedes-benz.svg', source: 'https://commons.wikimedia.org/wiki/File:Mercedes-Benz_Star_2022.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.', appearance: 'metallic' },
  'audi': { src: '/brands/audi.svg', source: 'https://commons.wikimedia.org/wiki/File:Audi-Logo_2016.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.', appearance: 'monochrome' },
  'volkswagen': { src: '/brands/volkswagen.svg', source: 'https://commons.wikimedia.org/wiki/File:Volkswagen_logo_2019.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.', appearance: 'monochrome' },
  'mini': { src: '/brands/mini.svg', source: 'https://commons.wikimedia.org/wiki/File:MINI_logo.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.', appearance: 'monochrome' },
  'land-rover': { src: '/brands/land-rover.svg', source: 'https://commons.wikimedia.org/wiki/File:Land_Rover_2023.svg', usageNote: 'PD-shape on source page; trademark rights remain with owner; see public/brands/README.md.', appearance: 'monochrome', width: 32 },
  'volvo': { src: '/brands/volvo.svg', source: 'https://commons.wikimedia.org/wiki/File:Volvo-Iron-Mark-Black.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.', appearance: 'monochrome' },
  'kia': { src: '/brands/kia.svg', source: 'https://commons.wikimedia.org/wiki/File:KIA_logo3.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.', appearance: 'monochrome' },
  'kgm': { src: '/brands/kgm.svg', source: 'https://commons.wikimedia.org/wiki/File:KG_Mobility_brand_logo.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.', appearance: 'monochrome' },
  'toyota': { src: '/brands/toyota.svg', source: 'https://commons.wikimedia.org/wiki/File:Toyota_Symbol.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.' },
  'byd': { src: '/brands/byd.svg', source: 'https://commons.wikimedia.org/wiki/File:BYD_Auto_2022_logo.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.' },
  'hyundai': { src: '/brands/hyundai-symbol.svg', source: 'https://commons.wikimedia.org/wiki/File:Hyundai_symbol.svg', usageNote: 'TucsonMager79 / CC BY-SA 4.0; attribution and asset-only licence at /brands/credits.html; trademark rights separate.', width: 32, appearance: 'monochrome' },
  'lexus': { src: '/brands/lexus-emblem.svg', source: 'https://en.wikipedia.org/wiki/File:Lexus_division_emblem.svg', usageNote: 'Lexus / PD-logo and PD-USonly on source page; source-country rights warning retained in /brands/credits.html.', width: 32, appearance: 'metallic' },
  'genesis': { src: '/brands/genesis-emblem.svg', source: 'https://en.wikipedia.org/wiki/File:Genesis_division_emblem.svg', usageNote: 'Blackspace / Genesis; PD-logo and PD-USonly with source-country and better-source warnings; see /brands/credits.html.', width: 32, appearance: 'monochrome' },
  'tesla': { src: '/brands/tesla-symbol.svg', source: 'https://commons.wikimedia.org/wiki/File:Tesla_T_symbol_-_white.svg', usageNote: 'Tesla Inc. / PD-textlogo on source page; white variant does not resolve related T-symbol copyright claims; see /brands/credits.html.', appearance: 'monochrome' },
  'honda': { src: '/brands/honda.svg', source: 'https://commons.wikimedia.org/wiki/File:Honda.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.' },
  'ford': { src: '/brands/ford.svg', source: 'https://commons.wikimedia.org/wiki/File:Ford_logo_flat.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.', width: 32 },
  'chevrolet': { src: '/brands/chevrolet-emblem.svg', source: 'https://commons.wikimedia.org/wiki/File:Chevrolet_simple_logo.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.', appearance: 'yellow', width: 32 },
  'lincoln': { src: '/brands/lincoln-emblem.svg', source: 'https://commons.wikimedia.org/wiki/File:Lincoln_logo.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.', appearance: 'monochrome' },
  'jeep': { src: '/brands/jeep.svg', source: 'https://commons.wikimedia.org/wiki/File:Jeep.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.', appearance: 'monochrome' },
  'renault': { src: '/brands/renault.svg', source: 'https://commons.wikimedia.org/wiki/File:Renault_2021.svg', usageNote: 'PD-textlogo on source page; trademark rights remain with owner; see public/brands/README.md.', appearance: 'monochrome' },
};

const brand = (id: string, label: string, english: string, aliases: string[] = []): VehicleBrand => ({
  id, label, aliases: [english, `${label} (${english})`, ...aliases], logo: LOCAL_LOGOS[id],
});

// Fixed order: domestic brands, then imported brands in Korean name order.
// Unknown brands or failed assets stay text-only; no guessed or generic emblems.
// Only reviewed, locally hosted assets may be added; a package licence alone is insufficient.
export const VEHICLE_BRANDS: readonly VehicleBrand[] = [
  brand('hyundai', '현대', 'Hyundai', ['현대자동차']),
  brand('kia', '기아', 'Kia', ['기아자동차']),
  brand('genesis', '제네시스', 'Genesis'),
  brand('kgm', 'KGM', 'KG Mobility', ['KG모빌리티', '쌍용', '쌍용자동차', 'SsangYong']),
  brand('renault', '르노코리아', 'Renault Korea', ['르노', '르노삼성', 'Renault']),
  brand('chevrolet', '쉐보레', 'Chevrolet', ['쉐보레자동차']),
  brand('land-rover', '랜드로버', 'Land Rover'),
  brand('lexus', '렉서스', 'Lexus'),
  brand('lincoln', '링컨', 'Lincoln'),
  brand('mini', '미니', 'MINI'),
  brand('mercedes-benz', '메르세데스-벤츠', 'Mercedes-Benz', ['벤츠', '벤츠 (Mercedes-Benz)', '메르세데스 벤츠']),
  brand('volvo', '볼보', 'Volvo'),
  brand('bmw', 'BMW', 'BMW'),
  brand('byd', 'BYD', 'BYD'),
  brand('audi', '아우디', 'Audi'),
  brand('jeep', '지프', 'Jeep'),
  brand('tesla', '테슬라', 'Tesla'),
  brand('toyota', '토요타', 'Toyota', ['도요타']),
  brand('porsche', '포르쉐', 'Porsche'),
  brand('ford', '포드', 'Ford'),
  brand('volkswagen', '폭스바겐', 'Volkswagen', ['VW']),
  brand('honda', '혼다', 'Honda'),
];

const lookupKey = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[\s()_\-–—·]+/g, '');
const brandByAlias = new Map(VEHICLE_BRANDS.flatMap((item) =>
  [item.label, ...item.aliases].map((alias) => [lookupKey(alias), item] as const),
));

/** Exact aliases only. Do not guess from partial strings, models, or typos such as "현". */
export function findVehicleBrand(value: string): VehicleBrand | undefined {
  return brandByAlias.get(lookupKey(value));
}

/** Presentation only: keep stored manufacturer text, SEO copy and URLs intact. */
export function getVehicleBrandDisplayName(value: string): string {
  const brand = findVehicleBrand(value);
  return brand?.id === 'mercedes-benz' ? brand.label : value.trim();
}

export function getVehicleBrandLogo(brand: VehicleBrand | undefined): VehicleBrandLogoAsset | undefined {
  const logo = brand?.logo;
  return logo && /^\/brands\/[a-z0-9-]+\.(svg|png|webp)$/.test(logo.src) && logo.source && logo.usageNote
    ? logo : undefined;
}

export function getVehicleBrandLogoClassName(logo: VehicleBrandLogoAsset): string {
  const appearance = logo.appearance === 'monochrome' ? ' is-monochrome' : logo.appearance === 'metallic' ? ' is-metallic' : logo.appearance === 'yellow' ? ' is-yellow' : '';
  return `vehicle-brand-logo${appearance}${logo.width === 32 ? ' is-wide' : ''}`;
}
