// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  createWalletKitCore,
  WalletKitCore,
  WalletKitCoreOptions,
  WalletKitCoreState,
} from "@mysten/wallet-kit-core";
import { WalletStandardAdapterProvider } from "@mysten/wallet-adapter-wallet-standard";
import { UnsafeBurnerWalletAdapter } from "@mysten/wallet-adapter-unsafe-burner";

export const WalletKitContext = createContext<WalletKitCore | null>(null);

interface WalletKitProviderProps extends Partial<WalletKitCoreOptions> {
  /** Enable the development-only unsafe burner wallet, which is can be useful for testing. */
  enableUnsafeBurner?: boolean;
  children: ReactNode;
  disableAutoConnect?: boolean;
}

export function WalletKitProvider({
  adapters: configuredAdapters,
  preferredWallets,
  children,
  enableUnsafeBurner,
  storageAdapter,
  storageKey,
  disableAutoConnect,
}: WalletKitProviderProps) {
  const adapters = useMemo(
    () =>
      configuredAdapters ?? [
        new WalletStandardAdapterProvider(),
        ...(enableUnsafeBurner ? [new UnsafeBurnerWalletAdapter()] : []),
      ],
    [configuredAdapters]
  );

  const walletKitRef = useRef<WalletKitCore | null>(null);
  if (!walletKitRef.current) {
    walletKitRef.current = createWalletKitCore({
      adapters,
      preferredWallets,
      storageAdapter,
      storageKey,
    });
  }

  // Automatically trigger the autoconnect logic when we mount, and whenever wallets change:
  const { wallets } = useSyncExternalStore(
    walletKitRef.current.subscribe,
    walletKitRef.current.getState
  );
  useEffect(() => {
    if (!disableAutoConnect) {
      walletKitRef.current?.autoconnect();
    }
  }, [wallets]);

  return (
    <WalletKitContext.Provider value={walletKitRef.current}>
      {children}
    </WalletKitContext.Provider>
  );
}

type UseWalletKit = WalletKitCoreState &
  Pick<
    WalletKitCore,
    "connect" | "disconnect" | "signTransaction" | "signAndExecuteTransaction"
  >;

export function useWalletKit(): UseWalletKit {
  const walletKit = useContext(WalletKitContext);

  if (!walletKit) {
    throw new Error(
      "You must call `useWalletKit` within the of the `WalletKitProvider`."
    );
  }

  const state = useSyncExternalStore(walletKit.subscribe, walletKit.getState);

  return useMemo(
    () => ({
      connect: walletKit.connect,
      disconnect: walletKit.disconnect,
      signTransaction: walletKit.signTransaction,
      signAndExecuteTransaction: walletKit.signAndExecuteTransaction,
      ...state,
    }),
    [walletKit, state]
  );
}
