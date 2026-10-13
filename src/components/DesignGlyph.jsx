export function GlyphPaths({ glyph, color }) {
  return glyph.map((part, index) => (Array.isArray(part)
    ? <circle key={index} cx={part[0]} cy={part[1]} r={part[2]} fill="none" stroke={color} strokeWidth="1.6" />
    : <path key={index} d={part} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />));
}

export function GlyphIcon({ glyph, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <GlyphPaths glyph={glyph} color="currentColor" />
    </svg>
  );
}
