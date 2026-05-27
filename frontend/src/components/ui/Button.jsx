import { motion } from 'framer-motion';

export const Button = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  isLoading = false,
  ...props 
}) => {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-elevation-1',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-primary/20',
    accent: 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-elevation-1',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-elevation-1',
    ghost: 'bg-transparent hover:bg-muted text-foreground',
    outline: 'bg-transparent border border-border hover:bg-muted text-foreground'
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={`px-6 py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      disabled={isLoading}
      {...props}
    >
      {isLoading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </motion.button>
  );
};
