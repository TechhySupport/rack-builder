/**
 * RackElevation.jsx
 * Technical rack elevation diagram with external callout labels.
 * Labels appear to the right of the rack frame, connected by a dashed line.
 */
import { buildRackRows, connectionPointsForItem, isVerticalPdu } from '../utils/rackUtils';
import { useRef } from 'react';
import {
  PatchPanelFace,
  VoiceFace,
  SwitchFace,
  Catalyst2960Face,
  ExtremeSwitchFace,
  CableManagerFace,
  ServerFace,
  UPSFace,
  ShelfFace,
  PDUFace,
  FibreFace,
  FirewallFace,
  GenericFace,
  EmptyFace,
  NVRFace,
  devicePortProfile,
  RearDeviceFace,
  VerticalPDUFace,
} from './DeviceFaces';

// ── Layout constants ──────────────────────────────────────────────────────────
const RU_H      = 28;   // px per rack unit
const RACK_W    = 520;  // physical rack frame width
const LABEL_W   = 280;  // label zone to the right of the rack
const TOTAL_W   = RACK_W + LABEL_W;
const HDR_H     = 44;
const FTR_H     = 22;
const OUTER_PX  = 6;
const RU_NUM_W  = 28;
const RAIL_W    = 14;
const DEVICE_X  = OUTER_PX + RU_NUM_W + RAIL_W;           // 48
const DEVICE_W  = RACK_W - DEVICE_X - RAIL_W - OUTER_PX;  // 452

// Callout geometry (all in SVG units, right of rack frame)
const DOT_X      = RACK_W + 6;    // tick mark / dot on rack edge
const LINE_X1    = RACK_W + 8;    // dashed line start
const LINE_X2    = RACK_W + 38;   // dashed line end
const LABEL_X    = RACK_W + 44;   // label text start

// ── Colours ───────────────────────────────────────────────────────────────────
const C_OUTER    = '#2a2f3a';
const C_BODY     = '#dde1e8';
const C_RAIL     = '#444c5c';
const C_RAIL_HI  = 'rgba(255,255,255,0.18)';
const C_RU_BG    = '#c8cdd6';
const C_RU_TEXT  = '#4a5268';
const C_BOLT     = '#5a6272';
const C_BOLT_S   = '#3e4554';
const C_HDR      = '#1e2330';
const C_ROW_LINE = '#c0c4cc';
const C_CALLOUT  = '#6a7888';
const C_LABEL    = '#1a2030';

// ── Face selector ─────────────────────────────────────────────────────────────
function renderFace(item, ruCount, x, y, w, h, portProps = {}, viewSide = 'front') {
  const props = { ...item, x, y, w, h, label: item.label || '', ruCount, connectionFace: viewSide, ...portProps };
  if (viewSide === 'rear' && !['empty', 'cable_manager', 'tray', 'shelf'].includes(item.type)) {
    return <RearDeviceFace key={y} {...props} />;
  }
  switch (item.type) {
    case 'patch_panel':   return <PatchPanelFace   key={y} {...props} />;
    case 'switch':        return <SwitchFace        key={y} {...props} />;
    case 'catalyst_2960': return <Catalyst2960Face  key={y} {...props} />;
    case 'extreme_switch': return <ExtremeSwitchFace key={y} {...props} />;
    case 'cable_manager': return <CableManagerFace  key={y} {...props} />;
    case 'server':        return <ServerFace        key={y} {...props} />;
    case 'ups':           return <UPSFace           key={y} {...props} />;
    case 'pdu':           return <PDUFace           key={y} {...props} />;
    case 'fibre':         return <FibreFace         key={y} {...props} />;
    case 'firewall':      return <FirewallFace       key={y} {...props} />;
    case 'tray': case 'shelf': case 'desktop': case 'monitor':
                          return <ShelfFace         key={y} {...props} />;
    case 'nvr':           return <NVRFace           key={y} {...props} />;
    case 'voice':         return <VoiceFace          key={y} {...props} />;
    case 'empty':         return <EmptyFace         key={y} x={x} y={y} w={w} h={h} />;
    default:
      return <GenericFace key={y} {...props} typeStr={item.type?.replace(/_/g, ' ')} />;
  }
}

// ── Bolt holes ────────────────────────────────────────────────────────────────
function RailBolts({ railCX, maxRU }) {
  const holes = [];
  for (let i = 0; i < maxRU; i++) {
    [0.18, 0.5, 0.82].forEach((frac, j) => {
      const cy = HDR_H + i * RU_H + frac * RU_H;
      holes.push(
        <ellipse key={`${i}-${j}`} cx={railCX} cy={cy} rx={2.6} ry={2.3}
          fill={C_BOLT} stroke={C_BOLT_S} strokeWidth={0.5} />
      );
    });
  }
  return <>{holes}</>;
}

// ── Truncate label to fit label zone ─────────────────────────────────────────
function trunc(s, max) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function portAnchor(item, layout, portId, viewSide) {
  const profile = devicePortProfile(item, viewSide);
  if (!profile) return { x: DEVICE_X + DEVICE_W - 12, y: layout.y + layout.h / 2 };
  const { points, count, bankX, bankW } = profile;
  if (isVerticalPdu(item)) {
    const index = Math.max(0, points.findIndex((point) => point.id === portId));
    const top = layout.y + 26;
    const spacing = Math.max(1, layout.h - 36) / Math.max(1, points.length);
    return { x: layout.x + layout.w / 2, y: top + index * spacing + spacing / 2 };
  }
  if (viewSide === 'rear') {
    const powerPoints = points.filter((point) => point.medium === 'power');
    const dataPoints = points.filter((point) => point.medium !== 'power');
    const isPower = powerPoints.some((point) => point.id === portId);
    const bankPoints = isPower ? powerPoints : dataPoints;
    const rearBankW = isPower
      ? Math.min(DEVICE_W * 0.28, Math.max(42, powerPoints.length * 18))
      : Math.max(0, DEVICE_W - (powerPoints.length ? Math.min(DEVICE_W * 0.28, Math.max(42, powerPoints.length * 18)) : 0) - 66);
    const rearBankX = isPower ? DEVICE_X + DEVICE_W - rearBankW - 8 : DEVICE_X + 50;
    const rearIndex = Math.max(0, bankPoints.findIndex((point) => point.id === portId));
    const rearColumns = Math.max(1, bankPoints.length > 24 ? 24 : Math.ceil(bankPoints.length / 2));
    const rearRows = Math.max(1, Math.ceil(bankPoints.length / rearColumns));
    const rearGap = 2;
    const rearPortW = Math.max(4, (rearBankW - rearGap * (rearColumns - 1)) / rearColumns);
    const rearPortH = Math.max(5, (layout.h - 10 - rearGap * (rearRows - 1)) / rearRows);
    return {
      x: rearBankX + (rearIndex % rearColumns) * (rearPortW + rearGap) + rearPortW / 2,
      y: layout.y + 5 + Math.floor(rearIndex / rearColumns) * (rearPortH + rearGap) + rearPortH / 2,
    };
  }
  const columns = Math.max(1, count > 24 ? 24 : Math.ceil(count / 2));
  const rows = Math.ceil(count / columns);
  const resolvedBankX = DEVICE_X + (bankX < 1 ? DEVICE_W * bankX : bankX);
  const resolvedBankW = bankW * DEVICE_W;
  const gap = 2;
  const portW = Math.max(4, (resolvedBankW - gap * (columns - 1)) / columns);
  const portH = Math.max(5, (layout.h - 10 - gap * (rows - 1)) / rows);
  const index = Math.max(0, points.findIndex((point) => point.id === portId));
  return {
    x: resolvedBankX + (index % columns) * (portW + gap) + portW / 2,
    y: layout.y + 5 + Math.floor(index / columns) * (portH + gap) + portH / 2,
  };
}

// ── Main component ────────────────────────────────────────────────────────────
export function RackElevation({ rack, viewSide = 'front', showDataWiring = true, innerRef, onStartMoveItem, onPatchDevice, patchSource, onOpenProperties, onOpenRackProperties, onContextMenuItem }) {
  const lastPointerDown = useRef({ itemIndex: null, time: 0 });
  if (!rack) return null;

  const maxRU  = rack.maxRU || 42;
  const bodyH  = maxRU * RU_H;
  const totalH = HDR_H + bodyH + FTR_H;
  const rows   = buildRackRows(rack);

  const leftRailX  = OUTER_PX + RU_NUM_W;
  const rightRailX = DEVICE_X + DEVICE_W;

  let currentY = HDR_H;
  const deviceElements   = [];
  const verticalPduElements = [];
  const calloutElements  = [];
  const deviceLayouts = new Map();

  rows.forEach((row, idx) => {
    const rowH   = row.height * RU_H;
    const centerY = currentY + rowH / 2;

    if (row.type === 'item') {
      const itemIndex = rack.items.indexOf(row.item);
      const connectedPorts = (rack.connections || []).flatMap((connection) => {
        if (connection.from === itemIndex && (connection.fromPortId || connection.fromPort)) return [connection.fromPortId || connection.fromPort];
        if (connection.to === itemIndex && (connection.toPortId || connection.toPort)) return [connection.toPortId || connection.toPort];
        return [];
      });
      deviceLayouts.set(itemIndex, { y: currentY + 1, h: rowH - 2, item: row.item });
      deviceElements.push(
        <g
          key={`device-${idx}`}
          className={onPatchDevice ? `rack-device-patchable${patchSource === itemIndex ? ' rack-device-patch-source' : ''}` : onStartMoveItem ? 'rack-device-draggable' : undefined}
          onPointerDown={(event) => {
            if (event.detail >= 2) {
              onOpenProperties?.(itemIndex);
              return;
            }
            if (onPatchDevice) {
              event.preventDefault();
              return;
            }
            const now = Date.now();
            if (lastPointerDown.current.itemIndex === itemIndex && now - lastPointerDown.current.time < 350) {
              onOpenProperties?.(itemIndex);
              lastPointerDown.current = { itemIndex: null, time: 0 };
              return;
            }
            lastPointerDown.current = { itemIndex, time: now };
            if (!onStartMoveItem) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            onStartMoveItem(itemIndex);
          }}
          onDoubleClick={() => {
            onOpenProperties?.(itemIndex);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            onContextMenuItem?.(itemIndex, event);
          }}
        >
          {renderFace(row.item, row.height, DEVICE_X, currentY + 1, DEVICE_W, rowH - 2, {
            onSelectPort: onPatchDevice ? (port) => onPatchDevice(itemIndex, port) : undefined,
            selectedPort: patchSource?.itemIndex === itemIndex ? patchSource.port : undefined,
            connectedPorts,
          }, viewSide)}
        </g>
      );
      // External callout label
      if (row.item.label) {
        calloutElements.push(
          <g key={`callout-${idx}`}>
            {/* Tick mark on rack right edge */}
            <line x1={DOT_X} y1={centerY}
                  x2={LINE_X1} y2={centerY}
                  stroke={C_CALLOUT} strokeWidth={0.8} />
            {/* Dashed leader line */}
            <line x1={LINE_X1} y1={centerY}
                  x2={LINE_X2} y2={centerY}
                  stroke={C_CALLOUT} strokeWidth={0.7}
                  strokeDasharray="3,2.5" />
            {/* Small dot at label junction */}
            <circle cx={LINE_X2} cy={centerY} r={1.5} fill={C_CALLOUT} />
            {/* Label text */}
            <text x={LABEL_X} y={centerY}
              dominantBaseline="middle"
              fontSize={9} fill={C_LABEL}
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight={400}
            >{trunc(row.item.label, 40)}</text>
          </g>
        );
      }
    } else {
      deviceElements.push(
        <EmptyFace key={`empty-${idx}`}
          x={DEVICE_X} y={currentY + 1} w={DEVICE_W} h={RU_H - 2} />
      );
    }

    currentY += rowH;
  });

  if (viewSide === 'rear') {
    rack.items.forEach((item, itemIndex) => {
      if (!isVerticalPdu(item)) return;
      const railW = 18;
      const railX = item.pduRailSide === 'left' ? DEVICE_X + 3 : DEVICE_X + DEVICE_W - railW - 3;
      const railY = HDR_H + 6;
      const railH = bodyH - 12;
      const connectedPorts = (rack.connections || []).flatMap((connection) => {
        if (connection.from === itemIndex && (connection.fromPortId || connection.fromPort)) return [connection.fromPortId || connection.fromPort];
        if (connection.to === itemIndex && (connection.toPortId || connection.toPort)) return [connection.toPortId || connection.toPort];
        return [];
      });
      deviceLayouts.set(itemIndex, { x: railX, y: railY, w: railW, h: railH, item });
      verticalPduElements.push(
        <g
          key={`vertical-pdu-${itemIndex}`}
          className={onPatchDevice ? `rack-device-patchable${patchSource?.itemIndex === itemIndex ? ' rack-device-patch-source' : ''}` : undefined}
          onPointerDown={(event) => {
            if (event.detail >= 2) onOpenProperties?.(itemIndex);
            if (onPatchDevice) event.preventDefault();
          }}
          onDoubleClick={() => onOpenProperties?.(itemIndex)}
          onContextMenu={(event) => {
            event.preventDefault();
            onContextMenuItem?.(itemIndex, event);
          }}
        >
          <VerticalPDUFace
            {...item}
            x={railX}
            y={railY}
            w={railW}
            h={railH}
            onSelectPort={onPatchDevice ? (port) => onPatchDevice(itemIndex, port) : undefined}
            selectedPort={patchSource?.itemIndex === itemIndex ? patchSource.port : undefined}
            connectedPorts={connectedPorts}
          />
        </g>,
      );
    });
  }

  const connectionElements = (rack.connections || []).map((connection, index) => {
    if (!showDataWiring && connection.medium !== 'power') return null;
    const fromLayout = deviceLayouts.get(connection.from);
    const toLayout = deviceLayouts.get(connection.to);
    if (!fromLayout || !toLayout) return null;
    const fromPortId = connection.fromPortId || connection.fromPort;
    const toPortId = connection.toPortId || connection.toPort;
    const fromPoint = connectionPointsForItem(fromLayout.item).find((point) => point.id === fromPortId);
    const toPoint = connectionPointsForItem(toLayout.item).find((point) => point.id === toPortId);
    const pointFace = (point) => point?.face || (point?.medium === 'power' ? 'rear' : 'front');
    if (pointFace(fromPoint) !== viewSide || pointFace(toPoint) !== viewSide) return null;
    const from = portAnchor(fromLayout.item, fromLayout, fromPortId, viewSide);
    const to = portAnchor(toLayout.item, toLayout, toPortId, viewSide);
    const cableX = DEVICE_X + DEVICE_W - 28 - (index % 5) * 9;
    const color = connection.medium === 'fibre' ? '#22d3ee' : connection.medium === 'power' ? '#f59e0b' : '#2563eb';
    const fromName = fromPoint?.name || fromPortId;
    const toName = toPoint?.name || toPortId;
    return <g key={connection.id || `${connection.from}-${connection.to}-${index}`} pointerEvents="none">
      <title>{`${fromLayout.item.label || 'Device'} ${fromName} to ${toLayout.item.label || 'Device'} ${toName}`}</title>
      <path d={`M ${from.x} ${from.y} H ${cableX} C ${cableX - 38} ${from.y}, ${cableX - 38} ${to.y}, ${cableX} ${to.y} H ${to.x}`} fill="none" stroke="#0f172a" strokeWidth={5.5} opacity={0.42} />
      <path d={`M ${from.x} ${from.y} H ${cableX} C ${cableX - 38} ${from.y}, ${cableX - 38} ${to.y}, ${cableX} ${to.y} H ${to.x}`} fill="none" stroke={color} strokeWidth={2.6} />
      <circle cx={from.x} cy={from.y} r={3.2} fill={color} stroke="#eff6ff" strokeWidth={0.8} />
      <circle cx={to.x} cy={to.y} r={3.2} fill={color} stroke="#eff6ff" strokeWidth={0.8} />
    </g>;
  });

  return (
    <div ref={innerRef} style={{ display: 'inline-block', background: '#fff', padding: '8px' }}>
      <svg
        width={TOTAL_W} height={totalH}
        viewBox={`0 0 ${TOTAL_W} ${totalH}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', fontFamily: "system-ui, -apple-system, sans-serif" }}
        aria-label={`Rack elevation: ${rack.rackName || 'Unnamed Rack'}`}
      >
        {/* ── Frame shadow ───────────────────────────────────────────────── */}
        <rect x={3} y={3} width={RACK_W - 4} height={totalH - 4}
          fill="rgba(0,0,0,0.18)" rx={6} />

        {/* ── Outer rack frame ───────────────────────────────────────────── */}
        <rect x={0} y={0} width={RACK_W} height={totalH}
          fill={C_OUTER} rx={6} />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <rect x={0} y={0} width={RACK_W} height={HDR_H} fill={C_HDR} rx={6} />
        <rect x={0} y={HDR_H - 8} width={RACK_W} height={8} fill={C_HDR} />
        <rect x={0} y={1} width={RACK_W} height={3}
          fill="rgba(255,255,255,0.08)" rx={5} />

        <text x={RACK_W / 2} y={HDR_H / 2 - 6}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={13} fontWeight={700} fill="#eef0f5" letterSpacing={0.4}
        >{rack.rackName || 'Unnamed Rack'}</text>
        <text x={RACK_W / 2} y={HDR_H / 2 + 8}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={8} fill="#6a7888"
          fontFamily="'Courier New', monospace" letterSpacing={0.8}
        >{rack.rackNumber ? `RACK ${rack.rackNumber}  ·  ${maxRU}U` : `${maxRU}U`}</text>
        <rect x={0} y={0} width={RACK_W} height={HDR_H} fill="transparent" onDoubleClick={onOpenRackProperties} style={{ cursor: onOpenRackProperties ? 'pointer' : undefined }} />

        {/* ── Body background ─────────────────────────────────────────────── */}
        <rect x={OUTER_PX} y={HDR_H}
          width={RACK_W - OUTER_PX * 2} height={bodyH} fill={C_BODY} />

        {/* ── RU separator lines ──────────────────────────────────────────── */}
        {Array.from({ length: maxRU + 1 }, (_, i) => (
          <line key={i}
            x1={OUTER_PX} x2={RACK_W - OUTER_PX}
            y1={HDR_H + i * RU_H} y2={HDR_H + i * RU_H}
            stroke={C_ROW_LINE}
            strokeWidth={i === 0 || i === maxRU ? 1 : 0.35}
          />
        ))}

        {/* ── RU number strip ─────────────────────────────────────────────── */}
        <rect x={OUTER_PX} y={HDR_H} width={RU_NUM_W} height={bodyH} fill={C_RU_BG} />
        <line x1={OUTER_PX + RU_NUM_W} y1={HDR_H}
              x2={OUTER_PX + RU_NUM_W} y2={HDR_H + bodyH}
              stroke="#aab0bc" strokeWidth={0.5} />
        {Array.from({ length: maxRU }, (_, i) => (
          <text key={maxRU - i}
            x={OUTER_PX + RU_NUM_W - 5} y={HDR_H + i * RU_H + RU_H / 2}
            textAnchor="end" dominantBaseline="middle"
            fontSize={8} fill={C_RU_TEXT} fontFamily="'Courier New', monospace"
          >{maxRU - i}</text>
        ))}

        {/* ── Left mounting rail ───────────────────────────────────────────── */}
        <rect x={leftRailX}     y={HDR_H} width={RAIL_W} height={bodyH} fill={C_RAIL} />
        <rect x={leftRailX + 1} y={HDR_H} width={2}      height={bodyH} fill={C_RAIL_HI} />
        <RailBolts railCX={leftRailX + RAIL_W / 2} maxRU={maxRU} />

        {/* ── Right mounting rail ──────────────────────────────────────────── */}
        <rect x={rightRailX}              y={HDR_H} width={RAIL_W} height={bodyH} fill={C_RAIL} />
        <rect x={rightRailX + RAIL_W - 3} y={HDR_H} width={2}      height={bodyH} fill={C_RAIL_HI} />
        <RailBolts railCX={rightRailX + RAIL_W / 2} maxRU={maxRU} />

        {/* ── Device faceplates ───────────────────────────────────────────── */}
        {deviceElements}
        {verticalPduElements}
        {connectionElements}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <rect x={0} y={HDR_H + bodyH} width={RACK_W} height={FTR_H} fill={C_HDR} />
        <rect x={0} y={HDR_H + bodyH} width={RACK_W} height={6} fill={C_HDR} />
        <rect x={0} y={HDR_H + bodyH + FTR_H - 5} width={RACK_W} height={5}
          fill={C_HDR} rx={4} />
        <text x={RACK_W / 2} y={HDR_H + bodyH + FTR_H / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={7} fill="#4a5870"
          fontFamily="'Courier New', monospace" letterSpacing={1.2}
        >{`${maxRU}U RACK ELEVATION`}</text>

        {/* ── Corner screws ───────────────────────────────────────────────── */}
        {[[12, 12], [RACK_W - 12, 12], [12, totalH - 12], [RACK_W - 12, totalH - 12]].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r={5} fill="#2e3442" stroke="#1a1f28" strokeWidth={0.5} />
            <line x1={cx - 2.5} y1={cy} x2={cx + 2.5} y2={cy} stroke="#4a5268" strokeWidth={1} />
            <line x1={cx} y1={cy - 2.5} x2={cx} y2={cy + 2.5} stroke="#4a5268" strokeWidth={1} />
          </g>
        ))}

        {/* ── External callout labels (right of rack) ──────────────────────── */}
        {calloutElements}
      </svg>
    </div>
  );
}
