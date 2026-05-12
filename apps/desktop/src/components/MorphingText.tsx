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
  const displayTextRef = useRef(text);
  const mountedRef = useRef(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      displayTextRef.current = text;
      setDisplayText(text);
      setVisible(true);
      return;
    }

    if (text === displayTextRef.current) return;

    const runId = ++runIdRef.current;
    let cancelled = false;

    const run = async () => {
      setVisible(false);
      await sleep(1200);

      if (cancelled || runId !== runIdRef.current) return;

      displayTextRef.current = text;
      setDisplayText(text);
      await sleep(60);

      if (cancelled || runId !== runIdRef.current) return;

      setVisible(true);
    };

    run();
    return () => { cancelled = true; };
  }, [text]);

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
