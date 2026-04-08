const RU_HEIGHT = 26;

export default function EmptySlot({ ru }) {
  return (
    <div className="empty-slot" style={{ height: RU_HEIGHT - 2 }}>
      <span className="empty-slot-label">—</span>
    </div>
  );
}
