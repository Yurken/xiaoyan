import { useEffect, useRef, useState } from "react";

interface MorphingTextProps {
  text: string;
  tag?: "h1" | "p";
  className?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 行首禁则：这些标点不应出现在行首，需与前一个字符留在同一行，避免句末标点单独换行
const NO_LINE_START = new Set("，。、；：！？）】》」』〉〕｝”’%‰℃°·…—～".split(""));

// 将字符按禁则分组：禁则标点并入前一组，同组内不允许换行
function groupChars(chars: string[]): string[][] {
  const groups: string[][] = [];
  for (const char of chars) {
    if (groups.length > 0 && NO_LINE_START.has(char)) {
      groups[groups.length - 1].push(char);
    } else {
      groups.push([char]);
    }
  }
  return groups;
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

  let charIndex = 0;

  return (
    <Tag className={className} aria-label={text}>
      {groupChars(displayText.split("")).map((group, gi) => (
        <span key={gi} style={{ whiteSpace: "nowrap" }}>
          {group.map((char) => {
            const i = charIndex++;
            return (
              <span
                key={i}
                className={`morph-char ${visible ? "visible" : ""}`}
                style={{ transitionDelay: visible ? `${i * 40}ms` : `${Math.random() * 150}ms` }}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
