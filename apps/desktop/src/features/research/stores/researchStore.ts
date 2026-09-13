/**
 * 研究功能 UI 状态 Store
 * 只保留 UI/派生状态，副作用移至 hooks
 */
import { create } from 'zustand'

interface ResearchUIState {
  operator: string
  showNewResearch: boolean
}

interface ResearchUIActions {
  setOperator: (name: string) => void
  setShowNewResearch: (show: boolean) => void
}

type ResearchUIStore = ResearchUIState & ResearchUIActions

const OPERATOR_KEY = 'research.operator'

export const useResearchStore = create<ResearchUIStore>((set) => ({
  operator: typeof localStorage !== 'undefined' ? localStorage.getItem(OPERATOR_KEY) ?? '' : '',
  showNewResearch: false,

  setOperator: (name) => {
    set({ operator: name })
    try {
      localStorage.setItem(OPERATOR_KEY, name)
    } catch {
      /* ignore */
    }
  },

  setShowNewResearch: (show) => set({ showNewResearch: show }),
}))
