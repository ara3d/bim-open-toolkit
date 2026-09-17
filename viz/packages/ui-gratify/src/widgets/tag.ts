import { part, rect as makeRect, v, type Intentish } from 'gratify';
import { fontSize, spaceOf } from '../theme.js';
import { cornerRadius, tonedSurface, type Tone } from './common.js';

export type TagProps = {
  readonly text: string;
  // A quieter second line, for the thing the first line is about.
  readonly detail?: string;
  // How far the leader line reaches below the box to the point the tag names.
  readonly leader?: number;
  readonly tone?: Tone;
  // When given, the tag can be clicked; a demo uses that to pin a hovering tag.
  readonly press?: Intentish;
};

const tagDefaults: { tone: Tone; leader: number } = { tone: 'plain', leader: 26 };

// The point a world-anchored tag names, in the tag's own coordinates: the foot of its leader line.
// A host placing a tag over a projected world point puts this corner on that point.
export const tagAnchorCorner = 'bottom-left';

const boxHeight = (props: { readonly detail?: string | undefined }): number =>
  spaceOf(props.detail === undefined ? 26 : 44);

// A label with a leader line down to the point it names: the callout a demo pins to an object.
export const Tag = part('gallery-tag')
  .props<TagProps>()
  .defaults(tagDefaults)
  .size((props, measure) => {
    const wide = Math.max(
      measure.text(props.text, fontSize('small')).x,
      props.detail === undefined ? 0 : measure.text(props.detail, fontSize('small')).x,
    );
    return v(wide + spaceOf(20), boxHeight(props) + spaceOf(props.leader));
  })
  .style((tokens, channels, props) => ({
    ...tonedSurface(tokens, channels, props.tone),
    corner: cornerRadius(),
    leader: tokens.mix(tokens.muted, tokens.accent, 0.4 + 0.6 * channels.hover),
    dim: tokens.textDim,
    size: fontSize('small'),
  }))
  .render((node, painter, style) => {
    const rect = node.rect;
    const height = boxHeight(node.props);
    const box = makeRect(rect.x, rect.y, rect.w, height);
    const foot = v(rect.x, rect.bottom);
    const elbow = v(rect.x + spaceOf(10), rect.y + height);
    painter.line(elbow, foot, style.leader, 1.5);
    painter.dot(foot, 3, style.leader);
    painter.box(box, style.corner, style.fill, style.edge, 1);
    const left = box.x + spaceOf(10);
    if (node.props.detail === undefined) {
      painter.label(node.props.text, v(left, box.center.y), style.text, { size: style.size, align: 'left', weight: 500 });
      return;
    }
    painter.label(node.props.text, v(left, box.y + spaceOf(14)), style.text, { size: style.size, align: 'left', weight: 500 });
    painter.label(node.props.detail, v(left, box.y + spaceOf(31)), style.dim, { size: style.size, align: 'left' });
  })
  .press((node) => node.props.press)
  .semantics((node) => ({
    role: 'note',
    label: node.props.detail === undefined ? node.props.text : `${node.props.text}: ${node.props.detail}`,
  }));
