const sizes = { sm: 'w-5 h-5 border-2', md: 'w-8 h-8 border-4' };

export default function Spinner({ size = 'md' }) {
  return (
    <div className={`${sizes[size]} border-muted border-t-primary rounded-full animate-spin`} />
  );
}
