import { useEffect } from 'react';
import type { WebviewMessage } from '../types';

export function useVSCodeMessage(onMessage: (message: WebviewMessage) => void) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as WebviewMessage;
      onMessage(message);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onMessage]);
}
