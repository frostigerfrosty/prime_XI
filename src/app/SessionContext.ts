import { createContext, useContext } from 'react';

export const SessionContext = createContext<{
  restored: boolean;
  restoreCompleted: () => void;
  acknowledgeRestore: () => void;
} | null>(null);
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionContext is missing');
  return value;
}
