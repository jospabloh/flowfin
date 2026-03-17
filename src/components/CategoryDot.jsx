export default function CategoryDot({ category, size = 'sm' }) {
  const color = category?.color || '#94a3b8';
  const sizes = { sm: 'w-2.5 h-2.5', md: 'w-3.5 h-3.5', lg: 'w-5 h-5' };
  return (
    <div className={`${sizes[size]} rounded-full flex-shrink-0`} style={{ backgroundColor: color }} />
  );
}