"use client";

import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

type CaseTab = "interrogation" | "evidence";

type WalkthroughProps = {
  tab: CaseTab;
  setTab: (tab: CaseTab) => void;
};

const stepTab = (index: number): CaseTab => (index === 2 ? "evidence" : "interrogation");

export function Walkthrough({ tab, setTab }: WalkthroughProps) {
  const driverRef = useRef<Driver | null>(null);
  const originalTabRef = useRef<CaseTab>(tab);
  const currentTabRef = useRef<CaseTab>(tab);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(true);
  const frameRef = useRef<number | null>(null);

  const restore = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    driverRef.current = null;
    if (!mountedRef.current) return;
    currentTabRef.current = originalTabRef.current;
    flushSync(() => setTab(originalTabRef.current));
    if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
  }, [setTab]);

  const moveTo = useCallback((driverInstance: Driver, index: number) => {
    const nextTab = stepTab(index);
    if (nextTab !== currentTabRef.current) {
      currentTabRef.current = nextTab;
      flushSync(() => setTab(nextTab));
    }
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (driverInstance.isActive()) driverInstance.moveTo(index);
    });
  }, [setTab]);

  const start = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    originalTabRef.current = tab;
    currentTabRef.current = tab;
    const driverInstance = driver({
      animate: false,
      allowClose: true,
      allowKeyboardControl: true,
      skipMissingElement: true,
      showProgress: true,
      progressText: "{{current}} / {{total}}",
      closeBtnLabel: "Skip walkthrough",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      popoverClass: "alibi-tour-popover",
      steps: [
        { element: "[data-tour='briefing']", popover: { title: "Private briefing", description: "This is your role and cover. It stays in the case file while you play." } },
        { element: "[data-tour='suspicion']", popover: { title: "Suspicion meter", description: "Detective Sen updates this signal after every answer." } },
        { element: "[data-tour='evidence']", popover: { title: "Evidence timeline", description: "Open any revealed fact for its detail and its limitation." } },
        { element: "[data-tour='question']", popover: { title: "Current question", description: "Answer the question shown here. The record keeps your exact words." } },
        { element: "[data-tour='transcript']", popover: { title: "Shared transcript", description: "Your answers and the detective's replies stay together in the public record." } },
        { element: "[data-tour='composer']", popover: { title: "Your response", description: "Drafts are kept in this browser until you submit. You can replay this walkthrough any time." } },
      ],
      onNextClick: (_element, _step, opts) => {
        const index = opts.index ?? 0;
        if (index < 5) moveTo(driverInstance, index + 1);
        else driverInstance.destroy();
      },
      onPrevClick: (_element, _step, opts) => {
        const index = opts.index ?? 0;
        if (index > 0) moveTo(driverInstance, index - 1);
      },
      onDestroyed: restore,
    });
    driverRef.current = driverInstance;
    if (tab !== "interrogation") {
      currentTabRef.current = "interrogation";
      flushSync(() => setTab("interrogation"));
    }
    driverInstance.drive();
  }, [moveTo, restore, setTab, tab]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (driverRef.current?.isActive()) driverRef.current.destroy();
    };
  }, []);

  return (
    <button className="tour-trigger" type="button" onClick={start}>
      <span aria-hidden="true">?</span> Walkthrough
    </button>
  );
}
