export default function MacColorPicker({
  value = '#4a90d9',
  onChange,
  className = '',
  title = 'Change color',
  buttonClassName = '',
  swatchClassName = 'h-6 w-6 rounded-md',
  children,
}) {
  return (
    <label
      className={`relative inline-flex cursor-pointer items-center overflow-hidden ${buttonClassName || 'justify-center rounded-md border border-slate-200 bg-white p-1 shadow-sm hover:bg-slate-50'} ${className}`}
      title={title}
      onClick={event => event.stopPropagation()}
    >
      {children || <span className={`${swatchClassName} border border-slate-300 shadow-sm`} style={{ backgroundColor: value }} />}
      <input
        type="color"
        value={value}
        onChange={event => onChange?.(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}
