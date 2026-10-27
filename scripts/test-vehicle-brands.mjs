// Display/input-only tests. No production API, data sync, image writes, or credentials.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTs } from './test-support.mjs';

const { VEHICLE_BRANDS, findVehicleBrand, getVehicleBrandLogo, getVehicleBrandLogoClassName } = loadTs('lib/vehicle-brands.ts');
const works = JSON.parse(readFileSync(new URL('../content/works.generated.json', import.meta.url), 'utf8')).records.map(row => row.work);
const VehicleTag = loadTs('components/WorkVehicleTag.tsx').default;
const BrandField = loadTs('components/AdminVehicleBrandField.tsx').default;
const render = (component, props) => renderToStaticMarkup(createElement(component, props));

await test('22 stable brands; exact aliases only; Hyundai and Genesis remain separate', () => {
  assert.equal(VEHICLE_BRANDS.length, 22);
  assert.equal(new Set(VEHICLE_BRANDS.map(item => item.id)).size, 22);
  for (const item of VEHICLE_BRANDS) for (const alias of [item.label, ...item.aliases]) assert.equal(findVehicleBrand(alias)?.id, item.id);
  for (const name of ['벤츠', '메르세데스-벤츠', '메르세데스-벤츠 (Mercedes-Benz)', 'MERCEDES BENZ']) assert.equal(findVehicleBrand(name)?.id, 'mercedes-benz');
  assert.notEqual(findVehicleBrand('현대')?.id, findVehicleBrand('제네시스')?.id);
  for (const unknown of ['', '현', '현대 모델', '미등록 브랜드', 'BMW 530i']) assert.equal(findVehicleBrand(unknown), undefined);
});

await test('all snapshot values recognized except ambiguous input; lookup does not mutate works/metadata', () => {
  const before = JSON.stringify(works);
  const { getWorkMetadata } = loadTs('lib/work-metadata.ts');
  for (const work of works) {
    const metadata = getWorkMetadata(work);
    const brand = findVehicleBrand(work.carMaker);
    if (work.carMaker === '현') assert.equal(brand, undefined);
    else assert.ok(brand, `unrecognized existing manufacturer: ${work.carMaker}`);
    assert.deepEqual(getWorkMetadata(work), metadata);
  }
  assert.equal(JSON.stringify(works), before);
});

await test('existing alias is selected without canonicalizing raw value; custom and blank are editable', () => {
  const alias = render(BrandField, { value: '메르세데스-벤츠 (Mercedes-Benz)', onChange() { assert.fail('render must never change value'); } });
  assert.match(alias, /value="mercedes-benz" selected="">메르세데스-벤츠/);
  assert.match(alias, /기존 입력: 메르세데스-벤츠 \(Mercedes-Benz\)/);
  const unknown = render(BrandField, { value: '현', onChange() { assert.fail(); } });
  assert.match(unknown, /value="custom" selected=""/);
  assert.match(unknown, /value="현"/);
  assert.match(render(BrandField, { value: '', onChange() { assert.fail(); } }), /value="" disabled="" selected=""/);
});

await test('22 documented local assets; unknown brands stay text-only', () => {
  assert.equal(VEHICLE_BRANDS.filter(brand => getVehicleBrandLogo(brand)).length, 22);
  const symbols = {hyundai:'hyundai-symbol.svg',lexus:'lexus-emblem.svg',genesis:'genesis-emblem.svg',tesla:'tesla-symbol.svg',porsche:'porsche-crest.png',chevrolet:'chevrolet-emblem.svg',lincoln:'lincoln-emblem.svg'};
  for (const brand of VEHICLE_BRANDS) {
    const logo = getVehicleBrandLogo(brand);
    assert.ok(logo);
    assert.equal(logo.src, `/brands/${symbols[brand.id] || `${brand.id}.svg`}`);
    assert.match(logo.source, /^https:\/\/(commons.wikimedia|en.wikipedia).org\/wiki\/File:/);
    assert.equal(logo.width ?? 20, ['hyundai','lexus','genesis','chevrolet','ford','land-rover'].includes(brand.id) ? 32 : 20);
    if (brand.id === 'porsche') {
      const png = readFileSync(new URL(`../public${logo.src}`, import.meta.url));
      assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(png.readUInt32BE(16), 64);
      assert.equal(png.readUInt32BE(20), 80);
      assert.ok(png.length < 10000);
      continue;
    }
    const svg = readFileSync(new URL(`../public${logo.src}`, import.meta.url), 'utf8');
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(svg, /<!DOCTYPE|<!ENTITY|<(script|foreignObject|image|iframe|object|embed|animate|set)\b|\son[a-z]+\s*=|@import|javascript:/i);
    assert.doesNotMatch(svg, /\b(?:href|src)\s*=\s*["'](?!#)/i);
  }
  for (const work of works) {
    const props = { maker: work.carMaker, model: work.carModel };
    const withLogo = render(VehicleTag, { ...props, showLogo: true });
    const textOnly = markup => markup.replace(/<[^>]*>/g, '');
    assert.equal(textOnly(withLogo), textOnly(render(VehicleTag, props)));
    assert.doesNotMatch(render(VehicleTag, props), /<img/); // Default/home/related stays off.
    if (!getVehicleBrandLogo(findVehicleBrand(work.carMaker))) assert.doesNotMatch(withLogo, /<img/);
  }
  assert.equal(getVehicleBrandLogo({ logo: { src: 'https://example.com/logo.svg', source: 'x', usageNote: 'x' } }), undefined);
  assert.equal(getVehicleBrandLogo({ logo: { src: '/brands/test.svg', source: '', usageNote: '' } }), undefined);
  const local = { src: '/brands/local-test.svg', source: 'local fixture', usageNote: 'generic test, not brand logo' };
  assert.deepEqual(getVehicleBrandLogo({ logo: local }), local);
});

await test('Mercedes display uses Korean full name while old raw values and new slug prefix stay compatible', () => {
  const { getStaticWorkVehicleTag } = loadTs('lib/static-html.ts');
  const { createWorkSlugAnalysis } = loadTs('functions/_shared/work-slug.ts');
  for (const maker of ['벤츠', '벤츠 (Mercedes-Benz)', '메르세데스 벤츠', '메르세데스-벤츠', 'Mercedes-Benz', '메르세데스-벤츠 (Mercedes-Benz)']) {
    for (const markup of [render(VehicleTag, { maker, model: 'CLS450' }), getStaticWorkVehicleTag(maker, 'CLS450')]) {
      assert.match(markup, />메르세데스-벤츠<\/span>/);
      assert.doesNotMatch(markup, />Mercedes-Benz|\(Mercedes-Benz\)/);
    }
    const field = render(BrandField, { value: maker, onChange() { assert.fail('existing raw value must remain'); } });
    assert.match(field, /value="mercedes-benz" selected="">메르세데스-벤츠<\/option>/);
  }
  const input = { carModel: 'CLS450', parts: [{ part: ['범퍼'] }], category: 'panel-paint' };
  for (const carMaker of ['벤츠', '메르세데스-벤츠']) {
    assert.equal(createWorkSlugAnalysis({ ...input, carMaker }).slug, 'mercedes-cls450-bumper-panel-paint');
  }
  assert.match(render(VehicleTag, { maker: '현대자동차', model: '쏘나타' }), />현대자동차<\/span>/);
});

await test('public asset attribution is reachable and prior wordmarks are preserved', () => {
  const credits = readFileSync(new URL('../public/brands/credits.html', import.meta.url),'utf8');
  for (const name of ['TucsonMager79', 'Blackspace', 'Tesla Inc.', 'Kai xzzrs']) assert.ok(credits.includes(name));
  for (const licence of ['by-sa/4.0/', 'by/4.0/']) assert.ok(credits.includes(`https://creativecommons.org/licenses/${licence}`));
  for (const name of ['hyundai', 'lexus']) assert.match(readFileSync(new URL(`../public/brands/${name}.svg`, import.meta.url),'utf8'), /<svg/);
  const lexus = readFileSync(new URL('../public/brands/lexus-emblem.svg', import.meta.url),'utf8');
  assert.match(lexus, /viewBox="99 0 291 212"/);
  assert.doesNotMatch(lexus, /id="(?:path3036|path4156|g3286|path3007|path3124|path3136|path3075)"/);
  const {getWorksStaticHtml} = loadTs('lib/static-html.ts');
  assert.match(getWorksStaticHtml([works[0]]), /href="\/brands\/credits.html"/);
  assert.match(readFileSync(new URL('../components/SiteFooter.tsx', import.meta.url),'utf8'), /href="\/brands\/credits.html"/);
});

await test('explicit display treatments preserve brand colours and metallic detail without white backdrops', () => {
  const monochrome = ['hyundai','volkswagen','kia','genesis','kgm','renault','land-rover','lincoln','mini','volvo','audi','jeep','tesla'];
  const metallic = ['mercedes-benz','lexus'];
  const colour = ['bmw','byd','toyota','porsche','ford','honda'];
  for (const brand of VEHICLE_BRANDS) {
    const logo = getVehicleBrandLogo(brand);
    const className = getVehicleBrandLogoClassName(logo);
    assert.doesNotMatch(className, /has-light-backdrop/);
    if (monochrome.includes(brand.id)) assert.match(className, /is-monochrome/);
    else if (metallic.includes(brand.id)) assert.match(className, /is-metallic/);
    else if (brand.id === 'chevrolet') assert.match(className, /is-yellow/);
    else { assert.ok(colour.includes(brand.id)); assert.doesNotMatch(className, /is-monochrome|is-metallic|is-yellow/); }
  }
  const css = readFileSync(new URL('../app/globals.css', import.meta.url),'utf8');
  assert.doesNotMatch(css, /\.vehicle-brand-logo\.has-light-backdrop/);
  assert.match(css, /\.vehicle-brand-logo\.is-monochrome\s*\{[^}]*filter: brightness\(0\) invert\(0\.82\)/);
  assert.match(css, /\.vehicle-brand-logo\.is-metallic\s*\{[^}]*filter: grayscale\(1\) brightness\(1\.1\)/);
  const chevrolet = readFileSync(new URL('../public/brands/chevrolet-emblem.svg', import.meta.url),'utf8');
  const lincoln = readFileSync(new URL('../public/brands/lincoln-emblem.svg', import.meta.url),'utf8');
  assert.match(chevrolet, /viewBox="19 25 701 226"/);
  assert.doesNotMatch(chevrolet, /Chevrolet_wordmark_/);
  assert.match(lincoln, /viewBox="171 -1 41 91"/);
  assert.match(lincoln, /id="path26"/);
  assert.doesNotMatch(lincoln, /id="g902"|id="path(?:12|14|16|18|20|22|24)"/);
});

await test('static and React vehicle tags share text, local logo, dimensions and failure isolation', () => {
  const { getStaticWorkVehicleTag, getWorksStaticHtml, getHomeStaticHtml, getWorkDetailStaticHtml } = loadTs('lib/static-html.ts');
  const normalize = html => html.replace(/<link[^>]*>/g, '').replace(/ data-static-vehicle-brand/g, '').replace(/\s*\/>/g, '/>');
  for (const maker of [...VEHICLE_BRANDS.map(brand => brand.label), '메르세데스-벤츠 (Mercedes-Benz)', '현', '<img src=x onerror=x>', '']) {
    assert.equal(normalize(getStaticWorkVehicleTag(maker, 'A1 & "test"')), normalize(render(VehicleTag, {maker, model:'A1 & "test"', showLogo:true})));
  }
  const work = {...works[0], carMaker:'BMW', carModel:'530i'};
  const list = getWorksStaticHtml([work]);
  assert.equal((list.match(/data-static-vehicle-brand/g) || []).length, 1);
  assert.match(list, /src="\/vehicle-brand-logos.js" defer/);
  assert.doesNotMatch(getHomeStaticHtml([work]), /vehicle-brand-logo|data-static-vehicle-brand/);
  const detail = getWorkDetailStaticHtml(work, [], 1, [work]);
  assert.equal((detail.match(/data-static-vehicle-brand/g) || []).length, 1);
  assert.match(detail, /width="20" height="20"/);
});

await test('all dropdown labels keep the brand in new slugs; existing maker mappings win', () => {
  const { createWorkSlugAnalysis } = loadTs('functions/_shared/work-slug.ts');
  const { SLUG_CAR_MAKER_TERMS } = loadTs('lib/slug-dictionary.ts');
  const input = { carModel: 'A1', parts: [{ part: ['범퍼'] }], category: 'panel-paint' };
  for (const brand of VEHICLE_BRANDS) {
    const result = createWorkSlugAnalysis({ ...input, carMaker: brand.label });
    const expected = brand.id === 'mercedes-benz' ? 'mercedes' : SLUG_CAR_MAKER_TERMS[brand.label] || brand.id;
    assert.equal(result.slug, `${expected}-a1-bumper-panel-paint`);
    assert.deepEqual(result.excludedTerms, []);
  }
  for (const [carMaker, slug] of Object.entries(SLUG_CAR_MAKER_TERMS)) {
    assert.equal(createWorkSlugAnalysis({ ...input, carMaker }).slug, `${slug}-a1-bumper-panel-paint`);
  }
});
