import { StrictMode, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { useCopilotHomePrompt } from "../../../features/copilot/useCopilotHomePrompt";

it("首页发送只在新会话准备完成后执行一次，历史回退不重复发送", async () => {
  const send = vi.fn(async () => {});
  const prepare = vi.fn();
  function Chat() {
    const [input, setInput] = useState("旧草稿");
    const [ready, setReady] = useState(false);
    const location = useLocation();
    useCopilotHomePrompt({ input, ready, send, prepare: (prompt) => { prepare(prompt); setInput(prompt); setReady(true); } });
    return <output>{JSON.stringify(location.state)}</output>;
  }
  function App() {
    const location = useLocation();
    const navigate = useNavigate();
    return <><button onClick={() => navigate("/away")}>离开</button><button onClick={() => navigate(-1)}>返回</button>{location.pathname === "/chat" ? <Chat /> : null}</>;
  }
  render(<StrictMode><MemoryRouter initialEntries={[{ pathname: "/chat", state: { homePrompt: "问题" } }]}><App /></MemoryRouter></StrictMode>);
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status")).toHaveTextContent("null");
  fireEvent.click(screen.getByText("离开"));
  fireEvent.click(screen.getByText("返回"));
  expect(send).toHaveBeenCalledTimes(1);
});
