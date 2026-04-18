// import { subscribeCpuPressureToast } from '@/capabilities/cpu-pressure';
import { startSessionQuotaMonitor } from '@/storage/quota';

export function startSessionMonitors(): () => void {
  const stopQuota = startSessionQuotaMonitor();
  // const stopCpu = subscribeCpuPressureToast();
  return () => {
    stopQuota();
    // stopCpu();
  };
}
