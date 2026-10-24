import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import { applyThemePref, readThemePref } from "@/lib/theme"
import App from './App.tsx'

// 在渲染前应用主题设置，避免首屏闪烁
applyThemePref(readThemePref());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TRPCProvider>
        <App />
      </TRPCProvider>
    </BrowserRouter>
  </StrictMode>,
)
