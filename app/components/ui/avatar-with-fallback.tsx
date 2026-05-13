interface AvatarWithFallbackProps {
  user: { name: string; hasAvatar?: boolean; id?: number };
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: "w-7 h-7 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
  xl: "w-16 h-16 text-2xl",
};

const imgSizeMap = {
  sm: "w-7 h-7",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-16 h-16",
};

export function AvatarWithFallback({ user, size = "md", className = "" }: AvatarWithFallbackProps) {
  if (user.hasAvatar && user.id) {
    return (
      <img
        src={`/api/avatar?userId=${user.id}`}
        alt={user.name}
        className={`${imgSizeMap[size]} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`${sizeMap[size]} bg-slate-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-slate-900 font-bold shrink-0 ${className}`}>
      {user.name.charAt(0)}
    </div>
  );
}
