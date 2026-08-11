import { createContext, useContext } from "react";
import type {
  OperatorSubscriptionDetail,
  SubscriptionPlan,
} from "../api/vietride";

export type SubscriptionModule = keyof SubscriptionPlan["modules"];

export type OperatorSubscriptionContextValue = {
  subscription: OperatorSubscriptionDetail | null;
  isLoading: boolean;
  loadError: string;
  hasModule: (module: SubscriptionModule) => boolean;
  refreshSubscription: () => Promise<OperatorSubscriptionDetail | null>;
  syncSubscription: (subscription: OperatorSubscriptionDetail) => void;
};

export const enabledModuleDefaults: SubscriptionPlan["modules"] = {
  enableParcel: true,
  enableShuttle: true,
  enableRag: true,
};

export const disabledModuleDefaults: SubscriptionPlan["modules"] = {
  enableParcel: false,
  enableShuttle: false,
  enableRag: false,
};

const defaultContextValue: OperatorSubscriptionContextValue = {
  subscription: null,
  isLoading: false,
  loadError: "",
  hasModule: (module) => enabledModuleDefaults[module],
  refreshSubscription: async () => null,
  syncSubscription: () => undefined,
};

export const OperatorSubscriptionContext =
  createContext<OperatorSubscriptionContextValue>(defaultContextValue);

export function useOperatorSubscription() {
  return useContext(OperatorSubscriptionContext);
}
