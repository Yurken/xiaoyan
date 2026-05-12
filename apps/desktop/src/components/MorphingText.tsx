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
  const animatingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      // Initial render: show immediately without animation
      setDisplayText(text);
      return;
    }

    if (text === displayText) return;

    let cancelled = false;
    animatingRef.current = true;

    const run = async () => {
      // Dissolve old text
      setVisible(false);
      await sleep(1400);

      if (cancelled) return;
      // Switch to new text (invisible)
      setDisplayText(text);
      await sleep(60);

      if (cancelled) return;
      // Appear new text, staggered per character via CSS transitionDelay
      setVisible(true);
      animatingRef.current = false;
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
