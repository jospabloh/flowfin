export default function PersonAvatar({ person, size = 'sm' }) {
  if (!person) return null;
  const initial = person.avatar_initial || person.name?.charAt(0)?.toUpperCase() || '?';
  const color = person.color || '#059669';
  const sizes = { xs: 'w-5 h-5 text-[9px]', sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' };
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}
      style={{ backgroundColor: color }}>
      {initial}
    </div>
  );
}