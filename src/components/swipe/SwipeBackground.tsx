import { useLayoutEffect, useRef } from 'react'
import { GatewayFlow as ConstellationField } from '../../shaders/neuform-isolated/NeuformBatchEffects'
import '../../shaders/threeui.css'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

// Keep the registered ThreeUI files unchanged. Forward clicks into its sandbox
// so the authored particle bursts work while the film and voting keep focus.
const clickBridge = `<script data-moviematch-gateway>
window.addEventListener('message', function (event) {
  if (event.source !== parent || event.data?.type !== 'moviematch-gateway-click') return;
  const { x, y } = event.data;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  window.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y }));
});
</script>`

export default function SwipeBackground() {
  const root = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useLayoutEffect(() => {
    const frame = root.current?.querySelector('iframe')
    if (!frame) return
    frame.tabIndex = -1
    if (!frame.srcdoc.includes('data-moviematch-gateway')) {
      frame.srcdoc = frame.srcdoc.replace('</body>', `${clickBridge}</body>`)
    }
    const click = (event: MouseEvent) => {
      const rect = frame.getBoundingClientRect()
      frame.contentWindow?.postMessage({ type: 'moviematch-gateway-click', x: event.clientX - rect.left, y: event.clientY - rect.top }, '*')
    }
    window.addEventListener('click', click)
    return () => window.removeEventListener('click', click)
  }, [reducedMotion])

  return <div ref={root} className="swipe-background shader-frame" aria-hidden="true" inert>
    {!reducedMotion && <ConstellationField variant="gateway-flow" mode="dark" speed={1.00} size={1.00} length={1.00} density={1.00} opacity={1.00} hue={0} saturation={1.00} brightness={1.00} />}
  </div>
}
