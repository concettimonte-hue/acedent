import {
  ArrowDown,
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
} from 'lucide-react';

const phoneDisplay = '010-6794-1739';
const phoneHref = 'tel:01067941739';
const smsHref = 'sms:01067941739';
const blogHref = 'https://blog.naver.com/ace_dent_shop';
const placeHref = 'https://naver.me/xv3DlbUy';

const services = [
  { number: '01', title: '외형복원', copy: '긁힘과 찌그러짐의 상태를 먼저 확인하고, 필요한 작업 범위를 설명합니다.', icon: CarFront },
  { number: '02', title: '판금도색', copy: '손상 정도와 패널 상태에 맞춰 판금과 도색의 방법을 판단합니다.', icon: Wrench },
  { number: '03', title: '광택', copy: '도장면의 상태를 보고 광택으로 개선할 수 있는 범위를 안내합니다.', icon: Sparkles },
  { number: '04', title: '덴트', copy: '도장 손상을 줄이면서 복원할 수 있는지 꼼꼼하게 확인합니다.', icon: ShieldCheck },
];

const cases = [
  {
    index: '01',
    vehicle: '랜드로버 디펜더',
    work: '범퍼 · 휀더 복원',
    src: '/images/case-defender.jpg',
    alt: '랜드로버 디펜더 앞 범퍼와 휀더 판금도장 복원 전후 비교',
    href: 'https://blog.naver.com/ace_dent_shop/224383645497',
  },
  {
    index: '02',
    vehicle: '테슬라 모델 3',
    work: '트렁크 도어 · 휀더 판금도장',
    src: '/images/case-tesla-model3.jpg',
    alt: '테슬라 모델 3 트렁크 도어와 휀더 찌그러짐 판금도장 복원 전후 비교',
    href: 'https://blog.naver.com/ace_dent_shop/224335294851',
  },
  {
    index: '03',
    vehicle: '메르세데스-벤츠 G-클래스',
    work: '휠커버 찌그러짐 · 스크래치 복원',
    src: '/images/case-gwagen.jpg',
    alt: '메르세데스-벤츠 G-클래스 휠커버 찌그러짐과 스크래치 복원 전후 비교',
    href: 'https://blog.naver.com/ace_dent_shop/224309593743',
  },
];

const principles = [
  '필요하지 않은 수리는 권하지 않습니다.',
  '가능한 결과와 작업의 한계를 먼저 설명합니다.',
  '사진만으로 단정하기 어려운 부분은 방문 확인을 안내합니다.',
];

export default function Home() {
  return (
    <main id="top" className="site-shell">
      <header className="site-header">
        <a href="#top" className="brand" aria-label="에이스덴트 홈">
          <span className="brand-logo" aria-hidden="true"><img src="/images/ace-dent-logo.png" alt="" /></span>
          <span><strong>ACE DENT</strong><small>자동차 외장관리 전문점</small></span>
        </a>
        <nav className="desktop-nav" aria-label="주요 메뉴">
          <a href="#services">서비스</a><a href="#cases">수리사례</a><a href="#principle">작업원칙</a><a href="#contact">오시는 길</a>
        </nav>
        <a className="header-call" href={phoneHref}><Phone aria-hidden="true" /><span>전화 문의</span></a>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span /> ACE DENT · SEOUL DONGDAEMUN</p>
          <h1 id="hero-title">믿고 맡기는<br /><em>에이스덴트</em></h1>
          <p className="hero-description">차량 외형복원·판금도색·광택·덴트.<br />결과를 과장하지 않고, 가능한 방법과 한계를 솔직하게 설명합니다.</p>
          <div className="hero-actions">
            <a className="primary-action" href={phoneHref}><Phone aria-hidden="true" />전화로 바로 문의<ChevronRight aria-hidden="true" /></a>
            <a className="secondary-action" href={smsHref}><Smartphone aria-hidden="true" />사진으로 문자 견적</a>
          </div>
          <a className="scroll-cue" href="#cases">실제 작업 사례 보기 <ArrowDown aria-hidden="true" /></a>
        </div>

        <div className="hero-result" aria-label="대표 작업 전후 이미지 영역">
          <div className="hero-result-label"><span>REPRESENTATIVE WORK</span><strong>01</strong></div>
          <div className="before-after hero-photo">
            <img className="hero-image-backdrop" src="/images/case-defender.jpg" alt="" aria-hidden="true" />
            <img className="hero-image-main" src="/images/case-defender.jpg" alt="랜드로버 디펜더 앞 범퍼와 휀더 판금도장 복원 전후 비교" />
          </div>
          <div className="result-caption">
            <div><span>WORK</span><strong>디펜더 범퍼 · 휀더 복원</strong></div>
            <div><span>RESULT</span><strong>Before / After 실제 작업</strong></div>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="에이스덴트 신뢰 정보">
        <div><strong>용두동</strong><span>서울 동대문구</span></div>
        <div><strong>20–30대</strong><span>월평균 작업 차량</span></div>
        <div><strong>DETAIL</strong><span>상세한 수리 기록</span></div>
        <div><strong>STANDARD</strong><span>자체 출고 기준</span></div>
      </section>

      <section id="services" className="section section-services">
        <div className="section-heading">
          <p className="section-kicker">WHAT WE DO</p>
          <h2>차량마다 다른 손상,<br /><span>필요한 만큼 정확하게.</span></h2>
          <p>가격과 기간은 손상 상태와 작업 범위에 따라 달라집니다. 차량 사진을 보내주시면 먼저 확인해 드립니다.</p>
        </div>
        <div className="service-grid">
          {services.map((service) => {
            const Icon = service.icon;
            return <article className="service-card" key={service.title}>
              <div className="service-card-top"><span>{service.number}</span><Icon aria-hidden="true" /></div>
              <h3>{service.title}</h3><p>{service.copy}</p>
            </article>;
          })}
        </div>
      </section>

      <section id="cases" className="section section-cases">
        <div className="cases-heading">
          <div><p className="section-kicker light">ACTUAL RESULTS</p><h2>설명보다 먼저,<br /><span>결과를 보여드립니다.</span></h2></div>
          <a href={blogHref} target="_blank" rel="noreferrer">네이버 블로그에서 더 보기 <ArrowUpRight aria-hidden="true" /></a>
        </div>
        <div className="case-grid">
          {cases.map((item) => <a className="case-card" key={item.index} href={item.href} target="_blank" rel="noreferrer" aria-label={`${item.vehicle} 실제 수리사례 자세히 보기`}>
            <div className="case-image">
              <img className="case-image-backdrop" src={item.src} alt="" aria-hidden="true" loading="lazy" />
              <img className="case-image-main" src={item.src} alt={item.alt} loading="lazy" />
              <span className="case-number">CASE {item.index}</span>
            </div>
            <div className="case-content"><p>{item.work}</p><h3>{item.vehicle}</h3><span>블로그에서 상세 과정 보기 <ArrowUpRight aria-hidden="true" /></span></div>
          </a>)}
        </div>
      </section>

      <section id="principle" className="section principle-section">
        <div className="principle-statement">
          <p className="section-kicker">OUR PRINCIPLE</p>
          <h2>“안 되는 것은<br /><span>안 된다고 말합니다.”</span></h2>
          <p>색상이 완전히 같을 수 없는 경우, 심한 찌그러짐으로 처음의 예리한 각을 그대로 만들기 어려운 경우도 있습니다. 만족스러운 선택을 위해 가능한 것과 어려운 것을 작업 전에 분명히 설명합니다.</p>
        </div>
        <div className="principle-list">
          {principles.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p><Check aria-hidden="true" /></div>)}
        </div>
      </section>

      <section className="section reason-section">
        <div className="reason-intro"><p className="section-kicker">WHY ACE DENT</p><h2>충분히 확인하고, 믿고 맡길 수 있도록.</h2></div>
        <div className="reason-grid">
          <article><span>01</span><h3>자세한 작업 기록</h3><p>과정과 결과를 블로그에 꾸준히 기록해 작업 판단의 근거를 보여드립니다.</p></article>
          <article><span>02</span><h3>필요한 수리만</h3><p>무조건 큰 작업을 권하지 않고 차량 상태에 맞는 범위를 안내합니다.</p></article>
          <article><span>03</span><h3>결과에 대한 책임</h3><p>자체 출고 기준으로 끝까지 확인하고, 설명한 범위 안에서 꼼꼼하게 작업합니다.</p></article>
        </div>
      </section>

      <section className="naver-section" aria-labelledby="naver-title">
        <div className="naver-intro"><p className="section-kicker light">NAVER CONNECT</p><h2 id="naver-title">필요한 정보를, 익숙한 곳에서.</h2><p>수리사례부터 리뷰·길찾기, 상담과 예약까지 네이버에서 이어집니다.</p></div>
        <div className="naver-grid">
          <a href={blogHref} target="_blank" rel="noreferrer"><span className="naver-icon">N</span><div><small>수리사례</small><strong>네이버 블로그</strong><p>차종별 상세 작업 과정을 확인하세요.</p></div><ArrowUpRight aria-hidden="true" /></a>
          <a href={placeHref} target="_blank" rel="noreferrer"><MapPin aria-hidden="true" className="card-main-icon" /><div><small>리뷰 · 위치 · 길찾기</small><strong>스마트플레이스</strong><p>방문 전 최신 매장 정보를 확인하세요.</p></div><ArrowUpRight aria-hidden="true" /></a>
          <a href={placeHref} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" className="card-main-icon" /><div><small>사진상담</small><strong>네이버 톡톡</strong><p>스마트플레이스에서 톡톡을 시작하세요.</p></div><ArrowUpRight aria-hidden="true" /></a>
          <a href={placeHref} target="_blank" rel="noreferrer"><CalendarDays aria-hidden="true" className="card-main-icon" /><div><small>방문 일정</small><strong>네이버 예약</strong><p>스마트플레이스에서 가능한 일정을 확인하세요.</p></div><ArrowUpRight aria-hidden="true" /></a>
        </div>
      </section>

      <section id="contact" className="contact-section">
        <div className="contact-copy"><p className="section-kicker">CONTACT</p><h2>차량 상태를<br />알려주세요.</h2><p>가장 빠른 방법은 전화입니다. 사진 견적은 손상 부위가 잘 보이는 사진을 문자로 보내주세요.</p></div>
        <div className="contact-actions">
          <a href={phoneHref} className="contact-call"><div><Phone aria-hidden="true" /><span>전화로 바로 문의</span></div><strong>{phoneDisplay}</strong><ChevronRight aria-hidden="true" /></a>
          <div className="contact-secondary">
            <a href={smsHref}><Smartphone aria-hidden="true" /><span>사진으로<strong>문자 견적</strong></span><ArrowUpRight aria-hidden="true" /></a>
            <a href={placeHref} target="_blank" rel="noreferrer"><MapPin aria-hidden="true" /><span>리뷰·길찾기<strong>스마트플레이스</strong></span><ArrowUpRight aria-hidden="true" /></a>
          </div>
          <div className="contact-note"><Clock3 aria-hidden="true" /><span>정확한 영업시간과 휴무일은 네이버 스마트플레이스에서 확인해 주세요.</span></div>
        </div>
      </section>

      <footer>
        <a href="#top" className="brand footer-brand" aria-label="에이스덴트 맨 위로"><span className="brand-logo" aria-hidden="true"><img src="/images/ace-dent-logo.png" alt="" /></span><span><strong>ACE DENT</strong><small>믿고 맡기는 에이스덴트</small></span></a>
        <div><p>서울 동대문구 용두동 · 자동차 외장관리 전문점</p><p>대표번호 {phoneDisplay}</p></div>
        <a href={placeHref} target="_blank" rel="noreferrer">네이버에서 위치 확인 <ArrowUpRight aria-hidden="true" /></a>
      </footer>

      <nav className="mobile-action-bar" aria-label="빠른 상담">
        <a href={phoneHref}><Phone aria-hidden="true" />전화 문의</a>
        <a href={smsHref}><Smartphone aria-hidden="true" />사진 문자</a>
        <a href={placeHref} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" />네이버 상담</a>
      </nav>
    </main>
  );
}
