import { Fragment } from 'react';
import { parseWorkBody, type BodyBlock, type BodyInline } from '@/lib/work-body';

function Lines({ text }: { text: string }) {
  return text.split('\n').map((line, index) => <Fragment key={index}>{index > 0 && <br />}{line}</Fragment>);
}
function Inlines({ items }: { items: BodyInline[] }) {
  return items.map((item, index) => typeof item === 'string'
    ? <Lines key={index} text={item} /> : <strong key={index}><Lines text={item[1]} /></strong>);
}
function Blocks({ blocks }: { blocks: BodyBlock[] }) {
  return blocks.map((block, index) => block[0] === 'ul'
    ? <ul key={index}>{block[1].map((item, itemIndex) => <li key={itemIndex}><Blocks blocks={item} /></li>)}</ul>
    : block[0] === 'h' ? <h3 key={index}><Inlines items={block[1]} /></h3> : <p key={index}><Inlines items={block[1]} /></p>);
}
export default function WorkBodyContent({ body }: { body: string }) {
  const blocks = parseWorkBody(body);
  return blocks ? <div className="work-body-formatted"><Blocks blocks={blocks} /></div>
    : <>{body.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</>;
}
