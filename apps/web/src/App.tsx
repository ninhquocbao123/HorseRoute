import AppRouter from './app/router';
import NetworkBanner from './components/ui/NetworkBanner';
import { NotificationToaster } from './features/notifications/NotificationToaster';

export default function App() {
  return <><NetworkBanner /><NotificationToaster /><AppRouter /></>;
}
