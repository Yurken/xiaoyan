import { useEffect, useRef, useState } from "react";

interface MorphingTextProps {
  text: string;
  tag?: "h1" | "p";
  className?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function MorphingText({ text, tag: Tag = "p", className }: MorphingTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [visible, setVisible] = useState(true);
  const latestTextRef = useRef(text);
  const mountedRef = useRef(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    latestTextRef.current = text;
  }, [text]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setDisplayText(text);
      return;
    }

    if (text === displayText) return;

    const runId = ++runIdRef.current;
    let cancelled = false;

    const run = async () => {
      // Dissolve old text
      setVisible(false);
      await sleep(1200);

      if (cancelled || runId !== runIdRef.current) return;

      // Switch to latest text (still invisible)
      const nextText = latestTextRef.current;
      setDisplayText(nextText);
      await sleep(60);

      if (cancelled || runId !== runIdRef.current) return;

      setVisible(true);
    };

    run();
    return () => { cancelled = true; };
  }, [text, displayText]);

  return (
    <Tag className={className} aria-label={text}>
      {displayText.split("").map((char, i) => (
        <span
          key={i}
          className={`morph-char ${visible ? "visible" : ""}`}
          style={{ transitionDelay: visible ? `${i * 40}ms` : `${Math.random() * 150}ms` }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </Tag>
  );
}
