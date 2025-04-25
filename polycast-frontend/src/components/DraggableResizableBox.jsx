import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * A simple draggable and resizable box wrapper for language/translation boxes.
 * Usage: <DraggableResizableBox>...</DraggableResizableBox>
 */
const MIN_WIDTH = 180;
const MIN_HEIGHT = 90;

function DraggableResizableBox({ children, initX, initY, initW, initH, style, className, snap = 0, bounds = false }) {
  const boxRef = useRef(null);
  const [pos, setPos] = useState({ x: initX || 100, y: initY || 100 });
  const [size, setSize] = useState({ w: initW || 250, h: initH || 140 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ mouseX: 0, mouseY: 0, w: 0, h: 0 });

  // Snap helper
  function snapTo(val, snap) {
    return snap > 1 ? Math.round(val / snap) * snap : val;
  }

  // Drag logic
  const onMouseDown = e => {
    if (e.target.classList.contains('resize-handle')) return;
    setDragging(true);
    setOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    document.body.style.userSelect = 'none';
  };
  const onMouseMove = e => {
    if (dragging) {
      let newX = e.clientX - offset.x;
      let newY = e.clientY - offset.y;
      if (snap > 1) {
        newX = snapTo(newX, snap);
        newY = snapTo(newY, snap);
      }
      setPos({ x: newX, y: newY });
    } else if (resizing) {
      const dx = e.clientX - resizeStart.mouseX;
      const dy = e.clientY - resizeStart.mouseY;
      let newW = Math.max(MIN_WIDTH, resizeStart.w + dx);
      let newH = Math.max(MIN_HEIGHT, resizeStart.h + dy);
      if (snap > 1) {
        newW = snapTo(newW, snap);
        newH = snapTo(newH, snap);
      }
      setSize({ w: newW, h: newH });
    }
  };
  const onMouseUp = () => {
    setDragging(false);
    setResizing(false);
    document.body.style.userSelect = '';
  };
  // Resize logic (now all corners)
  const onResizeMouseDown = e => {
    setResizing(true);
    setResizeStart({ mouseX: e.clientX, mouseY: e.clientY, w: size.w, h: size.h });
    e.stopPropagation();
    document.body.style.userSelect = 'none';
  };

  React.useEffect(() => {
    if (dragging || resizing) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  });

  return (
    <div
      ref={boxRef}
      className={className}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        boxSizing: 'border-box',
        zIndex: 1000,
        ...style,
      }}
      onMouseDown={onMouseDown}
    >
      <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>{children}</div>
      <div
        className="resize-handle"
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          background: 'rgba(0,0,0,0.15)',
          borderBottomRightRadius: 6,
          cursor: 'nwse-resize',
          zIndex: 1100,
        }}
        onMouseDown={onResizeMouseDown}
        title="Resize"
      />
    </div>
  );
}

DraggableResizableBox.propTypes = {
  children: PropTypes.node.isRequired,
  initX: PropTypes.number,
  initY: PropTypes.number,
  initW: PropTypes.number,
  initH: PropTypes.number,
  style: PropTypes.object,
  className: PropTypes.string,
  snap: PropTypes.number,
  bounds: PropTypes.bool,
};

export default DraggableResizableBox;
