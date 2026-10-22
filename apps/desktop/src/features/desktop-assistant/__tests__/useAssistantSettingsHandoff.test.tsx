import { act, render, screen } from '@testing-library/react'
import { listen } from '@tauri-apps/api/event'
import { beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { useAssistantSettingsHandoff } from '../hooks/useAssistantSettingsHandoff'
import { useSettingsSection } from '../../settings/useSettingsSection'

let openSettings: (() => void) | undefined
function Probe() {
  useAssistantSettingsHandoff()
  const [section, setSection] = useSettingsSection()
  const navigate = useNavigate()
  return <>
    <span>{section}</span>
    <button onClick={() => setSection('layout')}>其他分区</button>
    <button onClick={() => navigate('/settings', { state: { settingsSection: 'invalid' } })}>无效分区</button>
  </>
}

beforeEach(() => {
  localStorage.clear()
  openSettings = undefined
  vi.mocked(listen).mockReset().mockImplementation(async (event, handler) => {
    if (event === 'assistant:open-settings') openSettings = () => handler({ event, id: 1, payload: null })
    return () => { openSettings = undefined }
  })
})

it('opens the assistant section even when settings is already mounted', async () => {
  render(<MemoryRouter initialEntries={['/settings']}><Probe /></MemoryRouter>)
  await act(async () => {})
  act(() => { openSettings?.() })
  expect(screen.getByText('desktop_assistant')).toBeInTheDocument()
  act(() => { screen.getByText('其他分区').click() })
  expect(screen.getByText('layout')).toBeInTheDocument()
  act(() => { openSettings?.() })
  expect(screen.getByText('desktop_assistant')).toBeInTheDocument()
  act(() => { screen.getByText('无效分区').click() })
  expect(screen.getByText('desktop_assistant')).toBeInTheDocument()
})
