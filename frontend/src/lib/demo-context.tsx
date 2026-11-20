"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface DemoContextType {
  isDemoMode: boolean;
  setDemoMode: (val: boolean) => void;
  toggleDemoMode: () => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        const stored = localStorage.getItem("smart_dorm_demo_mode");
        if (stored !== null) {
          setIsDemoMode(stored === "true");
        }
      } catch {
        // Ignore local storage error in non-browser env
      }
      setMounted(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setDemoMode = (val: boolean) => {
    setIsDemoMode(val);
    try {
      localStorage.setItem("smart_dorm_demo_mode", String(val));
    } catch {
      // Ignore
    }
  };

  const toggleDemoMode = () => {
    setDemoMode(!isDemoMode);
  };

  return (
    <DemoContext.Provider value={{ isDemoMode: mounted ? isDemoMode : true, setDemoMode, toggleDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoMode(): DemoContextType {
  const context = useContext(DemoContext);
  if (!context) {
    return {
      isDemoMode: true,
      setDemoMode: () => {},
      toggleDemoMode: () => {},
    };
  }
  return context;
}
