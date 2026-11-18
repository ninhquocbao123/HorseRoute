import AppRouter from './app/router';
import { NotificationToaster } from './features/notifications/NotificationToaster';

export default function App() {
  return <><NotificationToaster /><AppRouter /></>;
}
