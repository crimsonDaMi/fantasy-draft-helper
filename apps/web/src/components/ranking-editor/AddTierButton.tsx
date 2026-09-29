export function AddTierButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ranking-editor__tier-add"
      onClick={onClick}
      disabled={disabled}
    >
      + Add tier here
    </button>
  );
}
