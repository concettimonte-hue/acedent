import { Fragment, type ReactNode } from 'react';
import {
  ArrowUpRight,
  CarFront,
  Check,
  ChevronRight,
  Clock3,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import naverData from '@/content/naver.json';
import siteData from '@/content/site.json';
import type {
  NaverContent,
  ServiceIconName,
  SiteContent,
} from '@/content/types';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import CaseGallery from '@/components/CaseGallery';
import ClosingMessage from '@/components/ClosingMessage';
import FaqSection from '@/components/FaqSection';
import InsuranceSection from '@/components/InsuranceSection';
import LocationSection from '@/components/LocationSection';
import NaverConnect from '@/components/NaverConnect';
import PaintCareSection from '@/components/PaintCareSection';
import ProcessSection from '@/components/ProcessSection';
import ReviewsSection from '@/components/ReviewsSection';
import SectionNumber from '@/components/SectionNumber';
import TrustBar from '@/components/TrustBar';
import {
  NUMBERED_SECTION_ORDER,
  type NumberedSectionId,
} from '@/content/section-order';
import { withLandingUtm } from '@/lib/tracking';

const site = siteData as SiteContent;
const naver = naverData as NaverContent;

const serviceIconMap: Record<ServiceIconName, LucideIcon> = {
  carFront: CarFront,
  wrench: Wrench,
  sparkles: Sparkles,
  shieldCheck: ShieldCheck,
};

export default function Home() {
  const { brand, navigation, hero, services, principles, contact } = site;
  const placeUrl = withLandingUtm(naver.place, 'place');
  const talkUrl = withLandingUtm(naver.talk, 'talk');

  const numberedSections: Record<NumberedSectionId, ReactNode> = {
    services: (
      <section
        id="services"
        className="section section-services numbered-section"
      >
        <SectionNumber sectionId="services" corner />
        <div className="section-heading">
          <p className="section-kicker">{services.kicker}</p>
          <h2>
            {services.titleLines[0]}
            <br />
            <span>{services.titleLines[1]}</span>
          </h2>
          <p>{services.description}</p>
        </div>
        <div className="service-grid">
          {services.items.map((service) => {
            const Icon = serviceIconMap[service.icon];
            return (
              <article className="service-card" key={service.title}>
                <div className="service-card-top">
                  <span>{service.number}</span>
                  <Icon aria-hidden="true" />
                </div>
                <h3>{service.title}</h3>
                <p>{service.copy}</p>
              </article>
            );
          })}
        </div>
      </section>
    ),
    cases: <CaseGallery />,
    'paint-care': <PaintCareSection />,
    reasons: (
      <section
        id="reasons"
        className="section reason-section numbered-section"
      >
        <SectionNumber sectionId="reasons" corner />
        <div className="reason-intro">
          <p className="section-kicker">{principles.reasonsKicker}</p>
          <h2>{principles.reasonsTitle}</h2>
        </div>
        <div className="reason-grid">
          {principles.reasons.map((reason) => (
            <article key={reason.number}>
              <span>{reason.number}</span>
              <h3>{reason.title}</h3>
              <p>{reason.copy}</p>
            </article>
          ))}
        </div>
      </section>
    ),
    principle: (
      <section
        id="principle"
        className="section principle-section numbered-section"
      >
        <SectionNumber sectionId="principle" corner />
        <div className="principle-statement">
          <p className="section-kicker">{principles.kicker}</p>
          <h2>
            {principles.titleLines[0]}
            <br />
            <span>{principles.titleLines[1]}</span>
          </h2>
          <p>{principles.description}</p>
        </div>
        <div className="principle-list">
          {principles.items.map((item, index) => (
            <div key={item.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div className="principle-item-copy">
                <strong>{item.title}</strong>
                {item.copy && <p>{item.copy}</p>}
              </div>
              <Check aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>
    ),
    reviews: <ReviewsSection />,
    insurance: <InsuranceSection />,
    process: <ProcessSection />,
    faq: <FaqSection />,
    contact: (
      <section
        id="contact"
        className="contact-section numbered-section"
      >
        <SectionNumber sectionId="contact" corner />
        <div className="contact-copy">
          <p className="section-kicker">{contact.kicker}</p>
          <h2>
            {contact.titleLines[0]}
            <br />
            {contact.titleLines[1]}
          </h2>
          <p>{contact.description}</p>
        </div>
        <div className="contact-actions">
          <a href={contact.phoneHref} className="contact-call">
            <div>
              <Phone aria-hidden="true" />
              <span>{contact.phoneLabel}</span>
            </div>
            <strong>{contact.phoneDisplay}</strong>
            <ChevronRight aria-hidden="true" />
          </a>
          <div className="contact-secondary">
            <a href={contact.smsHref}>
              <Smartphone aria-hidden="true" />
              <span>
                {contact.smsEyebrow}
                <strong>{contact.smsLabel}</strong>
              </span>
              <ArrowUpRight aria-hidden="true" />
            </a>
            <a href={talkUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" />
              <span>
                {contact.talkEyebrow}
                <strong>{contact.talkLabel}</strong>
              </span>
              <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
          <div className="contact-note">
            <Clock3 aria-hidden="true" />
            <span>{contact.note}</span>
          </div>
        </div>
      </section>
    ),
    location: <LocationSection />,
  };

  return (
    <main id="top" className="site-shell">
      <header className="site-header">
        <a href="#top" className="brand" aria-label={brand.homeAriaLabel}>
          <span className="brand-logo" aria-hidden="true">
            <img
              src={brand.logoSrc}
              alt={brand.logoAlt}
              width="1600"
              height="1200"
              loading="lazy"
              decoding="async"
            />
          </span>
          <span>
            <strong>{brand.name}</strong>
            <small>{brand.descriptor}</small>
          </span>
        </a>
        <nav className="desktop-nav" aria-label={navigation.ariaLabel}>
          {navigation.items.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className="header-call" href={contact.phoneHref}>
          <Phone aria-hidden="true" />
          <span>{contact.headerPhoneLabel}</span>
        </a>
        <nav className="mobile-section-nav" aria-label={navigation.ariaLabel}>
          {navigation.items.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span /> {hero.eyebrow}
          </p>
          <h1 id="hero-title">
            <span>{hero.title}</span>
            <em>{hero.titleAccent}</em>
          </h1>
          <p className="hero-subheadline">
            <em>{hero.subtitleAccent}</em> {hero.subtitle}
          </p>
          <p className="hero-description">
            {hero.descriptionLines.map((line) => (
              <span className="hero-description-line" key={line}>
                {line}
              </span>
            ))}
          </p>
          <div className="hero-actions">
            <a className="primary-action" href={contact.phoneHref}>
              <Phone aria-hidden="true" />
              {hero.phoneActionLabel}
              <ChevronRight aria-hidden="true" />
            </a>
            <a className="secondary-action" href={contact.smsHref}>
              <Smartphone aria-hidden="true" />
              {hero.smsActionLabel}
            </a>
          </div>
        </div>

        <div className="hero-result" aria-label={hero.resultAriaLabel}>
          <div className="hero-result-header">
            <div className="hero-result-label">
              <span>{hero.resultKicker}</span>
            </div>
            <h2>{hero.resultTitle}</h2>
            <p>{hero.resultMeta}</p>
          </div>
          <BeforeAfterSlider
            beforeSrc={hero.beforeSrc}
            afterSrc={hero.afterSrc}
            beforeAlt={hero.beforeAlt}
            afterAlt={hero.afterAlt}
            mode={hero.mode}
            priority
            showHint
            hintText={hero.sliderHint}
          />
          <div className="result-caption">
            <div>
              <span>{hero.workLabel}</span>
              <strong>{hero.workValue}</strong>
            </div>
            <div>
              <span>{hero.resultLabel}</span>
              <strong>{hero.resultValue}</strong>
            </div>
          </div>
        </div>
      </section>

      <TrustBar />

      {NUMBERED_SECTION_ORDER.map(({ id }) => (
        <Fragment key={id}>{numberedSections[id]}</Fragment>
      ))}

      <ClosingMessage />
      <NaverConnect />

      <footer>
        <a
          href="#top"
          className="brand footer-brand"
          aria-label={brand.footerHomeAriaLabel}
        >
          <span className="brand-logo" aria-hidden="true">
            <img
              src={brand.logoSrc}
              alt={brand.logoAlt}
              width="1600"
              height="1200"
              loading="lazy"
              decoding="async"
            />
          </span>
          <span>
            <strong>{brand.name}</strong>
            <small>{brand.tagline}</small>
          </span>
        </a>
        <div>
          <p>{contact.footerAddress}</p>
          <p>
            {contact.footerPhonePrefix} {contact.phoneDisplay}
          </p>
        </div>
        <a href={placeUrl} target="_blank" rel="noopener noreferrer">
          {contact.footerPlaceLabel} <ArrowUpRight aria-hidden="true" />
        </a>
      </footer>

      <nav
        className="mobile-action-bar"
        aria-label={contact.mobileNavAriaLabel}
      >
        <a href={contact.phoneHref}>
          <Phone aria-hidden="true" />
          {contact.mobilePhoneLabel}
        </a>
        <a href={contact.smsHref}>
          <Smartphone aria-hidden="true" />
          {contact.mobileSmsLabel}
        </a>
        <a href={talkUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden="true" />
          {contact.mobileNaverLabel}
        </a>
      </nav>
    </main>
  );
}
