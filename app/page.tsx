import {
  ArrowUpRight,
  CalendarDays,
  CarFront,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import siteData from '@/content/site.json';
import type { NaverIconName, ServiceIconName, SiteContent } from '@/content/types';
import TrustBar from '@/components/TrustBar';

const site = siteData as SiteContent;

const serviceIconMap: Record<ServiceIconName, LucideIcon> = {
  carFront: CarFront,
  wrench: Wrench,
  sparkles: Sparkles,
  shieldCheck: ShieldCheck,
};

const naverIconMap: Record<Exclude<NaverIconName, 'naver'>, LucideIcon> = {
  mapPin: MapPin,
  messageCircle: MessageCircle,
  calendarDays: CalendarDays,
};

function NaverLinkIcon({ name }: { name: NaverIconName }) {
  if (name === 'naver') {
    return <span className="naver-icon">{site.naverLinks.naverSymbol}</span>;
  }

  const Icon = naverIconMap[name];
  return <Icon aria-hidden="true" className="card-main-icon" />;
}

export default function Home() {
  const { brand, navigation, hero, services, cases, principles, naverLinks, contact } = site;

  return (
    <main id="top" className="site-shell">
      <header className="site-header">
        <a href="#top" className="brand" aria-label={brand.homeAriaLabel}>
          <span className="brand-logo" aria-hidden="true"><img src={brand.logoSrc} alt={brand.logoAlt} /></span>
          <span><strong>{brand.name}</strong><small>{brand.descriptor}</small></span>
        </a>
        <nav className="desktop-nav" aria-label={navigation.ariaLabel}>
          {navigation.items.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
        </nav>
        <a className="header-call" href={contact.phoneHref}><Phone aria-hidden="true" /><span>{contact.headerPhoneLabel}</span></a>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span /> {hero.eyebrow}</p>
          <h1 id="hero-title"><em>{hero.titleAccent}</em> {hero.title}</h1>
          <p className="hero-subheadline">{hero.subtitle}</p>
          <p className="hero-description">
            {hero.descriptionLines.map((line) => <span className="hero-description-line" key={line}>{line}</span>)}
          </p>
          <div className="hero-actions">
            <a className="primary-action" href={contact.phoneHref}><Phone aria-hidden="true" />{hero.phoneActionLabel}<ChevronRight aria-hidden="true" /></a>
            <a className="secondary-action" href={contact.smsHref}><Smartphone aria-hidden="true" />{hero.smsActionLabel}</a>
          </div>
        </div>

        <div className="hero-result" aria-label={hero.resultAriaLabel}>
          <div className="hero-result-label"><span>{hero.resultKicker}</span><strong>{hero.resultNumber}</strong></div>
          <div className="before-after hero-photo">
            <img className="hero-image-backdrop" src={hero.imageSrc} alt="" aria-hidden="true" />
            <img className="hero-image-main" src={hero.imageSrc} alt={hero.imageAlt} />
          </div>
          <div className="result-caption">
            <div><span>{hero.workLabel}</span><strong>{hero.workValue}</strong></div>
            <div><span>{hero.resultLabel}</span><strong>{hero.resultValue}</strong></div>
          </div>
        </div>
      </section>

      <TrustBar />

      <section id="services" className="section section-services">
        <div className="section-heading">
          <p className="section-kicker">{services.kicker}</p>
          <h2>{services.titleLines[0]}<br /><span>{services.titleLines[1]}</span></h2>
          <p>{services.description}</p>
        </div>
        <div className="service-grid">
          {services.items.map((service) => {
            const Icon = serviceIconMap[service.icon];
            return <article className="service-card" key={service.title}>
              <div className="service-card-top"><span>{service.number}</span><Icon aria-hidden="true" /></div>
              <h3>{service.title}</h3><p>{service.copy}</p>
            </article>;
          })}
        </div>
      </section>

      <section id="cases" className="section section-cases">
        <div className="cases-heading">
          <div><p className="section-kicker light">{cases.kicker}</p><h2>{cases.titleLines[0]}<br /><span>{cases.titleLines[1]}</span></h2></div>
          <a href={cases.moreHref} target="_blank" rel="noreferrer">{cases.moreLabel} <ArrowUpRight aria-hidden="true" /></a>
        </div>
        <div className="case-grid">
          {cases.items.map((item) => <a className="case-card" key={item.index} href={item.href} target="_blank" rel="noreferrer" aria-label={`${item.vehicle} ${cases.ariaSuffix}`}>
            <div className="case-image">
              <img className="case-image-backdrop" src={item.src} alt="" aria-hidden="true" loading="lazy" />
              <img className="case-image-main" src={item.src} alt={item.alt} loading="lazy" />
              <span className="case-number">{cases.badgePrefix} {item.index}</span>
            </div>
            <div className="case-content"><p>{item.work}</p><h3>{item.vehicle}</h3><span>{cases.detailLabel} <ArrowUpRight aria-hidden="true" /></span></div>
          </a>)}
        </div>
      </section>

      <section id="principle" className="section principle-section">
        <div className="principle-statement">
          <p className="section-kicker">{principles.kicker}</p>
          <h2>{principles.titleLines[0]}<br /><span>{principles.titleLines[1]}</span></h2>
          <p>{principles.description}</p>
        </div>
        <div className="principle-list">
          {principles.items.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p><Check aria-hidden="true" /></div>)}
        </div>
      </section>

      <section className="section reason-section">
        <div className="reason-intro"><p className="section-kicker">{principles.reasonsKicker}</p><h2>{principles.reasonsTitle}</h2></div>
        <div className="reason-grid">
          {principles.reasons.map((reason) => <article key={reason.number}><span>{reason.number}</span><h3>{reason.title}</h3><p>{reason.copy}</p></article>)}
        </div>
      </section>

      <section className="naver-section" aria-labelledby="naver-title">
        <div className="naver-intro"><p className="section-kicker light">{naverLinks.kicker}</p><h2 id="naver-title">{naverLinks.title}</h2><p>{naverLinks.description}</p></div>
        <div className="naver-grid">
          {naverLinks.items.map((item) => <a href={item.href} target="_blank" rel="noreferrer" key={item.title}>
            <NaverLinkIcon name={item.icon} />
            <div><small>{item.label}</small><strong>{item.title}</strong><p>{item.copy}</p></div>
            <ArrowUpRight aria-hidden="true" />
          </a>)}
        </div>
      </section>

      <section id="contact" className="contact-section">
        <div className="contact-copy"><p className="section-kicker">{contact.kicker}</p><h2>{contact.titleLines[0]}<br />{contact.titleLines[1]}</h2><p>{contact.description}</p></div>
        <div className="contact-actions">
          <a href={contact.phoneHref} className="contact-call"><div><Phone aria-hidden="true" /><span>{contact.phoneLabel}</span></div><strong>{contact.phoneDisplay}</strong><ChevronRight aria-hidden="true" /></a>
          <div className="contact-secondary">
            <a href={contact.smsHref}><Smartphone aria-hidden="true" /><span>{contact.smsEyebrow}<strong>{contact.smsLabel}</strong></span><ArrowUpRight aria-hidden="true" /></a>
            <a href={contact.placeHref} target="_blank" rel="noreferrer"><MapPin aria-hidden="true" /><span>{contact.placeEyebrow}<strong>{contact.placeLabel}</strong></span><ArrowUpRight aria-hidden="true" /></a>
          </div>
          <div className="contact-note"><Clock3 aria-hidden="true" /><span>{contact.note}</span></div>
        </div>
      </section>

      <footer>
        <a href="#top" className="brand footer-brand" aria-label={brand.footerHomeAriaLabel}><span className="brand-logo" aria-hidden="true"><img src={brand.logoSrc} alt={brand.logoAlt} /></span><span><strong>{brand.name}</strong><small>{brand.tagline}</small></span></a>
        <div><p>{contact.footerAddress}</p><p>{contact.footerPhonePrefix} {contact.phoneDisplay}</p></div>
        <a href={contact.placeHref} target="_blank" rel="noreferrer">{contact.footerPlaceLabel} <ArrowUpRight aria-hidden="true" /></a>
      </footer>

      <nav className="mobile-action-bar" aria-label={contact.mobileNavAriaLabel}>
        <a href={contact.phoneHref}><Phone aria-hidden="true" />{contact.mobilePhoneLabel}</a>
        <a href={contact.smsHref}><Smartphone aria-hidden="true" />{contact.mobileSmsLabel}</a>
        <a href={contact.placeHref} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" />{contact.mobileNaverLabel}</a>
      </nav>
    </main>
  );
}
