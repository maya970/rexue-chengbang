export function MapTools(props: {
  title: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="map-tools" onPointerDown={(e) => e.stopPropagation()}>
      <span className="muted">{props.title}</span>
      <button className="btn tiny" type="button" onClick={props.onZoomOut} title="缩小">－</button>
      <button className="btn tiny" type="button" onClick={props.onZoomIn} title="放大">＋</button>
      <button className="btn tiny" type="button" onClick={props.onRotate} title="转变视角">转视角</button>
      {props.onReset ? <button className="btn tiny" type="button" onClick={props.onReset}>回正</button> : null}
    </div>
  );
}
