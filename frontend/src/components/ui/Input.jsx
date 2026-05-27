
export const Input = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-foreground/80 ml-1">
          {label}
        </label>
      )}
      <input
        className={`px-4 py-2.5 rounded-xl border bg-background transition-all outline-none focus:ring-2 focus:ring-primary/20 
          ${error ? 'border-destructive focus:border-destructive' : 'border-border focus:border-primary'}
          disabled:opacity-50 disabled:bg-muted font-sans`}
        {...props}
      />
      {error && (
        <span className="text-xs text-destructive font-medium ml-1">
          {error}
        </span>
      )}
    </div>
  );
};

export const Select = ({ label, options, error, className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-foreground/80 ml-1">
          {label}
        </label>
      )}
      <select
        className={`px-4 py-2.5 rounded-xl border bg-background transition-all outline-none focus:ring-2 focus:ring-primary/20 
          ${error ? 'border-destructive focus:border-destructive' : 'border-border focus:border-primary'}
          disabled:opacity-50 disabled:bg-muted font-sans appearance-none`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-xs text-destructive font-medium ml-1">
          {error}
        </span>
      )}
    </div>
  );
};
