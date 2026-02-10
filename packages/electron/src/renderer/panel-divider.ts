export function initPanelDivider(): void {
  const divider = document.getElementById('panel-divider');
  const chronicle = document.getElementById('event-log-panel');
  const inspector = document.getElementById('inspector-panel');

  if (divider === null || chronicle === null || inspector === null) {
    console.warn('Panel divider elements not found');
    return;
  }

  let dragging = false;
  let startY = 0;
  let startChronicleHeight = 0;

  divider.addEventListener('mousedown', (e: MouseEvent) => {
    dragging = true;
    startY = e.clientY;
    startChronicleHeight = chronicle.getBoundingClientRect().height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    const newHeight = startChronicleHeight + dy;
    const parent = chronicle.parentElement;
    if (parent === null) return;
    const totalHeight = parent.getBoundingClientRect().height - 4; // 4px divider
    const minHeight = 100;
    const clamped = Math.max(minHeight, Math.min(totalHeight - minHeight, newHeight));
    const ratio = clamped / totalHeight;
    chronicle.style.flex = String(ratio);
    inspector.style.flex = String(1 - ratio);
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}
