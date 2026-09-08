import casesData from '../content/cases.json';
import faqData from '../content/faq.json';
import insuranceData from '../content/insurance.json';
import naverData from '../content/naver.json';
import polishData from '../content/polish.json';
import processData from '../content/process.json';
import reviewsData from '../content/reviews.json';
import siteData from '../content/site.json';
import trustData from '../content/trust.json';
import type {
  FaqContent,
  InsuranceContent,
  NaverContent,
  PolishContent,
  ProcessContent,
  ReviewsContent,
  SiteContent,
  TrustItem,
} from '../content/types';
import {
  WORK_CATEGORIES,
  getWorkCategoryLabel,
  type WorkCategory,
  type WorkItem,
  type WorkPartMedia,
} from '../content/works/types';
import {
  getWorkImageAlt,
  getWorkPrimaryPart,
  getWorkThumbnailSrc,
} from './work-images';

const site = siteData as SiteContent;
const faq = faqData as FaqContent;
const insurance = insuranceData as InsuranceContent;
const naver = naverData as NaverContent;
const polish = polishData as PolishContent;
const process = processData as ProcessContent;
const reviews = reviewsData as ReviewsContent;
const trust = trustData as TrustItem[];

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const text = (value: string) => escapeHtml(value);
const car = (work: WorkItem) => `${work.carMaker} ${work.carModel}`;

function image(
  src: string,
  alt: string,
  options: { width?: number; height?: number; eager?: boolean } = {},
) {
  return `<img src="${text(src)}" alt="${text(alt)}" width="${options.width ?? 1600}" height="${options.height ?? 1200}" loading="${options.eager ? 'eager' : 'lazy'}"${options.eager ? ' fetchpriority="high"' : ' decoding="async"'} />`;
}

function workCard(work: WorkItem) {
  const primaryPart = getWorkPrimaryPart(work);
  return `<article class="seo-work-card">
    <a href="/works/detail/${text(work.slug)}">
      ${image(getWorkThumbnailSrc(work), getWorkImageAlt(work, primaryPart, '후'), { width: 800, height: 600 })}
      <p>${text(getWorkCategoryLabel(work.category))}</p>
      <h3>${text(car(work))} ${text(work.title)}</h3>
      <p>${text(work.summary)}</p>
      <small>${text(work.part.join(' · '))} · ${text(work.days)}</small>
    </a>
  </article>`;
}

function faqList() {
  return `<div class="seo-faq-list">${faq.items
    .map(
      (item) => `<details${item.open ? ' open' : ''}>
        <summary>${text(item.q)}</summary>
        <p>${text(item.a)}</p>
      </details>`,
    )
    .join('')}</div>`;
}

export function getHomeStaticHtml(works: WorkItem[]) {
  const featured = works
    .filter((work) => work.featured)
    .sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999))
    .slice(0, 8);
  const highlightedReviews = reviews.reviews.filter((review) => review.highlight);
  const { hero, services, principles, contact } = site;

  return `<main class="seo-static seo-home" aria-label="에이스덴트 정적 페이지">
    <header class="seo-static-header">
      <a href="/">${image(site.brand.logoSrc, '에이스덴트 로고', { width: 1536, height: 1024, eager: true })}<strong>ACE DENT</strong></a>
      <nav aria-label="주요 메뉴">${site.navigation.items.map((item) => `<a href="${text(item.href)}">${text(item.label)}</a>`).join('')}</nav>
    </header>
    <section class="seo-static-hero">
      <div>
        <p>${text(hero.eyebrow)}</p>
        <h1>${text(hero.subtitleAccent)} ${text(hero.subtitle)} · ${text(hero.title)} ${text(hero.titleAccent)}</h1>
        <p>${hero.descriptionLines.map(text).join('<br />')}</p>
        <a href="${text(contact.phoneHref)}">${text(hero.phoneActionLabel)}</a>
        <a href="${text(contact.smsHref)}">${text(hero.smsActionLabel)}</a>
      </div>
      <div class="seo-comparison">
        <h2>${text(hero.resultTitle)}</h2>
        <p>${text(hero.resultMeta)}</p>
        ${image(hero.beforeSrc, hero.beforeAlt, { eager: true })}
        ${image(hero.afterSrc, hero.afterAlt, { eager: true })}
      </div>
    </section>
    <section class="seo-trust" aria-label="에이스덴트 신뢰 정보">${trust
      .map(
        (item) => `<article><strong>${text(Number(item.value).toLocaleString('ko-KR'))}<small>${text(item.valueSuffix)}</small></strong><h2>${text(item.label)}</h2><p>${text(item.sub)}</p></article>`,
      )
      .join('')}</section>
    <section id="services"><p>${text(services.kicker)}</p><h2>${services.titleLines.map(text).join(' ')}</h2><div class="seo-grid">${services.items
      .map((item) => `<article><small>${text(item.number)}</small><h3>${text(item.title)}</h3><p>${text(item.copy).replaceAll('\n', '<br />')}</p></article>`)
      .join('')}</div></section>
    <section id="cases"><p>${text(casesData.sectionLabel)}</p><h2>${casesData.headingLines.map(text).join(' ')}</h2><p>${text(casesData.instruction)}</p><div class="seo-works-grid">${featured.map(workCard).join('')}</div><a href="/works">${text(casesData.moreLinkLabel)}</a></section>
    <section id="paint-care"><p>${text(polish.sectionLabel)}</p><h2>${text(polish.heading)}</h2><p>${text(polish.subCopy)}</p><div class="seo-grid">${polish.items
      .map((item) => `<article><small>${text(item.no)} · ${text(item.days)}</small><h3>${text(item.title)}</h3><p>${text(item.keywords)}</p><p>${text(item.desc)}</p>${item.notWhen ? `<p><strong>이런 경우는</strong> ${text(item.notWhen)}</p>` : ''}</article>`)
      .join('')}</div></section>
    <section id="reasons"><p>${text(principles.reasonsKicker)}</p><h2>${text(principles.reasonsTitle)}</h2><div class="seo-grid">${principles.reasons.map((item) => `<article><h3>${text(item.title)}</h3><p>${text(item.copy)}</p></article>`).join('')}</div></section>
    <section id="principle"><p>${text(principles.kicker)}</p><h2>${principles.titleLines.map(text).join(' ')}</h2>${principles.items.map((item) => `<article><h3>${text(item.title)}</h3>${item.copy ? `<p>${text(item.copy)}</p>` : ''}</article>`).join('')}</section>
    <section id="reviews"><p>${text(reviews.sectionLabel)}</p><h2>${text(reviews.heading)}</h2>${highlightedReviews.map((item) => `<article><h3>${text(item.headline)}</h3><p>${text(item.text)}</p><small>${text(item.initial)} · ${text(item.car)} · ${text(item.area)} · ${text(item.part)}</small></article>`).join('')}</section>
    <section id="insurance"><p>${text(insurance.sectionLabel)}</p><h2>${text(insurance.heading)}</h2><p>${text(insurance.subCopy)}</p><table><thead><tr><th>예상 수리비</th><th>자기부담금</th><th>판단 기준</th></tr></thead><tbody>${insurance.table.map((row) => `<tr><th>${text(row.estimate)}</th><td>${text(row.own)}</td><td>${text(row.note)}</td></tr>`).join('')}</tbody></table></section>
    <section id="process"><p>${text(process.sectionLabel)}</p><h2>${text(process.heading)}</h2><div class="seo-grid">${process.items.map((item) => `<article><strong>${text(item.step)}</strong><h3>${text(item.title)}</h3><p>${text(item.desc)}</p></article>`).join('')}</div></section>
    <section id="faq"><p>${text(faq.sectionLabel)}</p><h2>${text(faq.heading)}</h2>${faqList()}</section>
    <section id="contact"><p>CONTACT</p><h2>${contact.titleLines.map(text).join(' ')}</h2><p>${text(contact.description)}</p><a href="${text(contact.phoneHref)}">${text(contact.phoneDisplay)}</a><a href="${text(contact.smsHref)}">${text(contact.smsLabel)}</a><a href="${text(naver.talk)}" target="_blank" rel="noopener noreferrer">${text(contact.talkLabel)}</a></section>
    <section id="location"><p>${text(contact.locationSectionLabel)}</p><h2>${text(contact.locationHeading)}</h2>${image('/storefront.jpg', '서울 동대문 판금도색 외형복원 전문 에이스덴트 매장 외관')}<address>${text(contact.footerAddress)} · ${text(contact.phoneDisplay)}</address><a href="${text(naver.place)}" target="_blank" rel="noopener noreferrer">${text(contact.directionsLabel)}</a><p>${text(contact.nearbyIntro)} ${text(contact.nearbyAreas)}</p></section>
    <section id="naver-connect"><h2>${text(naver.section.title)}</h2>${naver.section.items.map((item) => `<a href="${text(naver[item.key])}" target="_blank" rel="noopener noreferrer">${text(item.title)} ↗</a>`).join('')}</section>
  </main>`;
}

export function getWorksStaticHtml(works: WorkItem[], category?: WorkCategory) {
  const visible = category ? works.filter((work) => work.category === category) : works;
  const heading = category ? getWorkCategoryLabel(category) : '수리사례';
  return `<main class="seo-static seo-works">
    <header class="seo-static-header"><a href="/">ACE DENT</a><a href="${text(site.contact.phoneHref)}">${text(site.contact.phoneDisplay)}</a></header>
    <section><p>ACE DENT · REPAIR ARCHIVE</p><h1>${category ? `동대문 ${text(heading)} 전후 수리사례` : '동대문 판금도색·덴트·외형복원 수리사례'}</h1><p>실제 차량의 작업 전후를 확인하고 내 차와 비슷한 손상을 찾아보세요.</p></section>
    <nav aria-label="작업방식"><a href="/works">전체</a>${WORK_CATEGORIES.map((item) => `<a href="/works/${item.id}">${text(item.label)}</a>`).join('')}</nav>
    <section aria-label="수리사례 목록"><p>${visible.length}건</p><div class="seo-works-grid">${visible.map(workCard).join('')}</div></section>
  </main>`;
}

export function getWorkDetailStaticHtml(work: WorkItem, related: WorkItem[]) {
  const categoryLabel = getWorkCategoryLabel(work.category);
  const partSection = (part: WorkPartMedia, index: number) => `<section>
        <p>PART ${String(index + 1).padStart(2, '0')}</p>
        <h2>${text(part.label)}</h2>
        <p>${text(part.note)}</p>
        <div class="seo-comparison">
          ${image(part.before, getWorkImageAlt(work, part, '전'), { eager: index === 0 })}
          ${image(part.after, getWorkImageAlt(work, part, '후'), { eager: index === 0 })}
        </div>
      </section>`;
  return `<main class="seo-static seo-work-detail">
    <header class="seo-static-header"><a href="/">ACE DENT</a><a href="${text(site.contact.phoneHref)}">${text(site.contact.phoneDisplay)}</a></header>
    <nav aria-label="현재 위치"><a href="/">홈</a> / <a href="/works">수리사례</a> / <a href="/works/${text(work.category)}">${text(categoryLabel)}</a></nav>
    <article>
      <p>${text(categoryLabel)}</p>
      <h1>동대문 ${text(car(work))} ${text(work.title)} 수리사례</h1>
      <p>${text(work.part.join(' · '))} · ${work.color ? `${text(work.color)} · ` : ''}${text(work.days)}</p>
      ${work.parts.map(partSection).join('')}
      <p><strong>${text(work.summary)}</strong></p>
      ${work.body.split('\n\n').map((paragraph) => `<p>${text(paragraph)}</p>`).join('')}
      ${work.blogUrl ? `<a href="${text(work.blogUrl)}" target="_blank" rel="noopener noreferrer">블로그에서 더 보기</a>` : ''}
    </article>
    ${related.length ? `<section><h2>같은 작업방식 사례</h2><div class="seo-works-grid">${related.map(workCard).join('')}</div></section>` : ''}
    <section><h2>비슷한 손상이라면 사진으로 문의하세요.</h2><a href="${text(site.contact.phoneHref)}">전화</a><a href="${text(site.contact.smsHref)}">사진 문자</a><a href="${text(naver.talk)}" target="_blank" rel="noopener noreferrer">네이버 톡톡</a></section>
  </main>`;
}
