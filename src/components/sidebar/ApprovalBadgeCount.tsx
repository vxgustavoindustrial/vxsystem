import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';

export function ApprovalBadgeCount() {
  const { profile } = useAuthStore();
  const { notifications } = useNotificationStore();
  const count = profile?.client_id
    ? notifications.filter((notification) => notification.type === 'approval' && !notification.read_at).length
    : 0;

  if (count === 0) return null;

  return (
    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-medium text-white animate-in zoom-in duration-300">
      {count > 99 ? '99+' : count}
    </span>
  );
}
