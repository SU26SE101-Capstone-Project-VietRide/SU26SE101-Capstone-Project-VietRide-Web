import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getOperatorSubscription,
  type OperatorSubscriptionDetail,
} from "../api/vietride";
import type { AuthRole } from "../auth";
import { isSubscriptionEntitled } from "../utils/subscription";
import {
  disabledModuleDefaults,
  enabledModuleDefaults,
  OperatorSubscriptionContext,
  type OperatorSubscriptionContextValue,
  type SubscriptionModule,
} from "./operatorSubscriptionContext";

type OperatorSubscriptionProviderProps = {
  role: AuthRole;
  children: ReactNode;
};

export function OperatorSubscriptionProvider({
  role,
  children,
}: OperatorSubscriptionProviderProps) {
  const canReadSubscription = role === "OPERATOR_ADMIN";
  const [subscription, setSubscription] =
    useState<OperatorSubscriptionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(canReadSubscription);
  const [loadError, setLoadError] = useState("");

  const syncSubscription = useCallback(
    (nextSubscription: OperatorSubscriptionDetail) => {
      setSubscription(nextSubscription);
      setLoadError("");
      setIsLoading(false);
    },
    [],
  );

  const refreshSubscription = useCallback(async () => {
    if (!canReadSubscription) return null;

    setIsLoading(true);
    setLoadError("");
    try {
      const result = await getOperatorSubscription();
      syncSubscription(result);
      return result;
    } catch (error) {
      setSubscription(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load operator subscription.",
      );
      setIsLoading(false);
      throw error;
    }
  }, [canReadSubscription, syncSubscription]);

  useEffect(() => {
    if (!canReadSubscription) return;

    let cancelled = false;
    void getOperatorSubscription()
      .then((result) => {
        if (!cancelled) syncSubscription(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSubscription(null);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load operator subscription.",
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canReadSubscription, syncSubscription]);

  const modules = useMemo(
    () =>
      subscription && isSubscriptionEntitled(subscription)
        ? subscription.plan.modules
        : canReadSubscription
          ? disabledModuleDefaults
          : enabledModuleDefaults,
    [canReadSubscription, subscription],
  );
  const hasModule = useCallback(
    (module: SubscriptionModule) => modules[module],
    [modules],
  );
  const value = useMemo<OperatorSubscriptionContextValue>(
    () => ({
      subscription,
      isLoading,
      loadError,
      hasModule,
      refreshSubscription,
      syncSubscription,
    }),
    [
      hasModule,
      isLoading,
      loadError,
      refreshSubscription,
      subscription,
      syncSubscription,
    ],
  );

  return (
    <OperatorSubscriptionContext.Provider value={value}>
      {children}
    </OperatorSubscriptionContext.Provider>
  );
}
