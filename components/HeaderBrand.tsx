import siteData from '@/content/site.json';

/** Shared header identity; navigation and contact controls belong to each page. */
export default function HeaderBrand({ href = '/', className = '' }: { href?: string; className?: string }) {
  return (
    <a className={`header-brand ${className}`.trim()} href={href} aria-label="에이스덴트 홈">
      <span className="header-brand-symbol" aria-hidden="true">
        <img src={siteData.brand.headerLogoSrc} alt="" width="255" height="170" loading="eager" />
      </span>
      <span className="header-brand-copy">
        <strong>{siteData.brand.name}</strong>
        <small>{siteData.brand.descriptor}</small>
      </span>
    </a>
  );
}
