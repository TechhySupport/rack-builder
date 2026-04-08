export default function ValidationPanel({ messages }) {
  if (!messages || messages.length === 0) {
    return (
      <div className="validation-panel validation-ok">
        <span className="val-icon">✓</span> Data looks valid — no issues found.
      </div>
    );
  }
  return (
    <div className="validation-panel validation-errors">
      <div className="val-header">
        <span className="val-icon val-warn">!</span>
        <strong>{messages.length} issue{messages.length > 1 ? 's' : ''} found</strong>
      </div>
      <ul className="val-list">
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}
