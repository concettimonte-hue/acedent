'use client';

export default function ClosingMessage() {
  return (
    <section
      id="closing-message"
      className="closing-message-section"
      aria-label="에이스덴트의 약속"
    >
      <p className="closing-message-lead">
        <span>내 차가 손상되었다면</span>
        <span>남의 차를 손상시켰다면</span>
        <span>언제든 문의 주세요</span>
      </p>
      <p className="closing-message-promise">
        <span>
          <em>“내 차라면”</em> 이라는 마음으로
        </span>
        <span>올바른 안내를 해드리겠습니다</span>
      </p>
    </section>
  );
}
