// A list that draws only the rows you can see. Gratify has no clipping primitive and no scrolling
// container, so scrolling here is virtualization: rows have one fixed height, the view emits only
// the ones in range, and whatever is painted after the list (a sheet header) hides the overscan.
// The arithmetic below is pure and is what the tests pin down; the part is a thin wrapper on it.
import { at, part, rect as makeRect, v, type Element, type Intentish, type Vec } from 'gratify';

// Which rows are worth building this frame, and where the first of them starts.
export type ListWindow = {
  readonly first: number;
  // The last row in the window, or `first - 1` when there are none.
  readonly last: number;
  // Where row `first` is drawn, relative to the top of the list.
  readonly offset: number;
};

// How tall the whole list would be if it were all drawn.
export const listExtent = (count: number, rowHeight: number): number => Math.max(0, count) * rowHeight;

// The furthest down a list can be scrolled before its last row sits on the bottom edge.
export const maxScroll = (count: number, rowHeight: number, viewHeight: number): number =>
  Math.max(0, listExtent(count, rowHeight) - viewHeight);

// A scroll offset brought back inside the list.
export const clampScroll = (scroll: number, count: number, rowHeight: number, viewHeight: number): number =>
  Math.min(maxScroll(count, rowHeight, viewHeight), Math.max(0, Number.isFinite(scroll) ? scroll : 0));

// The rows on screen at a scroll offset, plus `overscan` rows on each side so a fast scroll never
// shows a gap. A list of nothing gives an empty window rather than a negative one.
export const listWindow = (
  count: number,
  rowHeight: number,
  viewHeight: number,
  scroll: number,
  overscan = 1,
): ListWindow => {
  if (count <= 0 || rowHeight <= 0) return { first: 0, last: -1, offset: 0 };
  const top = clampScroll(scroll, count, rowHeight, viewHeight);
  const first = Math.max(0, Math.floor(top / rowHeight) - overscan);
  const last = Math.min(count - 1, Math.ceil((top + viewHeight) / rowHeight) - 1 + overscan);
  return { first, last, offset: first * rowHeight - top };
};

// The scroll offset that brings a row fully into view, moving as little as possible.
export const scrollToShow = (
  index: number,
  count: number,
  rowHeight: number,
  viewHeight: number,
  scroll: number,
): number => {
  const top = index * rowHeight;
  const wanted = top < scroll ? top : top + rowHeight > scroll + viewHeight ? top + rowHeight - viewHeight : scroll;
  return clampScroll(wanted, count, rowHeight, viewHeight);
};

export type ListProps = {
  readonly width: number;
  readonly height: number;
  readonly rowHeight: number;
  readonly count: number;
  readonly scroll: number;
  // Builds one row. Only the rows in the window are ever asked for.
  readonly row: (index: number) => Element;
  // What a drag or wheel emits. The app clamps it; `clampScroll` is here for that.
  readonly scrollTo: (offset: number) => Intentish;
  readonly overscan?: number;
};

const listDefaults: { overscan: number } = { overscan: 1 };

// A fixed-size pane that places its children at the positions `at(...)` gave them. It is what makes
// the list a plain function of the scroll offset, and what a host uses to lay out a whole surface.
export const Pane = part('gallery-pane')
  .props<{ width: number; height: number }>()
  .measure((props) => v(props.width, props.height))
  .arrange((_props, r, kids) =>
    kids.map((kid) => makeRect(r.x + (kid.pos?.x ?? 0), r.y + (kid.pos?.y ?? 0), kid.size.x, kid.size.y)));

type DragScroll = { readonly from: number; readonly at: Vec };

// A scrolling list of fixed-height rows. Dragging the body scrolls it; a row that carries its own
// press interactor keeps its click, so an actionable row is not draggable.
export const List = part('gallery-list')
  .props<ListProps>()
  .defaults(listDefaults)
  .body((props) => {
    const window = listWindow(props.count, props.rowHeight, props.height, props.scroll, props.overscan);
    const rows: Element[] = [];
    for (let index = window.first; index <= window.last; index += 1) {
      rows.push(at(props.row(index), v(0, window.offset + (index - window.first) * props.rowHeight)));
    }
    return [Pane('pane', { width: props.width, height: props.height }, rows)];
  })
  .gesture<DragScroll>({
    begin: (node, point) => ({ from: node.props.scroll, at: point }),
    during: (state, node, point) =>
      node.props.scrollTo(
        clampScroll(
          state.from - (point.y - state.at.y),
          node.props.count,
          node.props.rowHeight,
          node.props.height,
        ),
      ),
  });
