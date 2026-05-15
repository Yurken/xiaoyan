import React from 'react';
import { ArrowRight, BookOpen, Layers, Zap, FileText, BrainCircuit, PenTool, Sparkles, Navigation, Link as LinkIcon, Network } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center pt-24 px-6 pb-20">
      
      {/* Header Section */}
      <header className="max-w-4xl w-full text-center space-y-6 mb-32 relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nm-bg shadow-nm-inset text-brand text-sm font-medium mb-4">
          <Sparkles size={16} />
          <span>全新版本现已发布</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-gray-900 drop-shadow-sm leading-tight">
          沉着研究，水到渠成
        </h1>
        <p className="text-xl md:text-2xl text-nm-dark font-light max-w-2xl mx-auto leading-relaxed mt-4">
          小妍 —— 你的全能科研助理。<br/>
          为你梳理文献、沉淀笔记，专注科研本质。
        </p>

        <div className="flex justify-center items-center gap-6 mt-10">
          <button className="flex items-center gap-2 px-8 py-3 bg-brand text-white rounded-2xl shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] font-medium tracking-wide">
            免费下载桌面端
            <ArrowRight size={20} />
          </button>
          <button className="flex items-center gap-2 px-8 py-3 bg-nm-surface text-gray-800 rounded-2xl shadow-nm transition-transform hover:scale-[1.02] active:scale-[0.98] font-medium tracking-wide">
            网页版体验
          </button>
        </div>
      </header>

      {/* Core Philosophy & Main Features */}
      <section className="max-w-5xl w-full text-center mb-36 relative z-10">
        <h2 className="text-3xl font-semibold mb-12 text-gray-800">为高密度学术环境设计</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl bg-nm-surface shadow-nm flex flex-col gap-4 border border-white/50 text-left hover:-translate-y-1 transition-transform duration-300">
            <div className="w-12 h-12 rounded-xl bg-nm-bg shadow-nm-inset flex items-center justify-center text-brand mb-2">
              <BookOpen size={24} />
            </div>
            <h3 className="text-xl font-medium tracking-tight text-gray-900">极简文献阅读</h3>
            <p className="text-nm-dark leading-relaxed text-sm">
              克制的排版结构，彻底摆脱多余视觉噪音。精准的公式渲染与图表提取，让阅读回归专注。
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-nm-surface shadow-nm flex flex-col gap-4 border border-white/50 text-left hover:-translate-y-1 transition-transform duration-300">
            <div className="w-12 h-12 rounded-xl bg-nm-bg shadow-nm-inset flex items-center justify-center text-brand mb-2">
              <Layers size={24} />
            </div>
            <h3 className="text-xl font-medium tracking-tight text-gray-900">知识网络沉淀</h3>
            <p className="text-nm-dark leading-relaxed text-sm">
              不再让笔记散落各处。每一次勾画与批注，都会自动汇聚成你的个人专属图谱，构建结构化的脉络。
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-nm-surface shadow-nm flex flex-col gap-4 border border-white/50 text-left hover:-translate-y-1 transition-transform duration-300">
            <div className="w-12 h-12 rounded-xl bg-nm-bg shadow-nm-inset flex items-center justify-center text-brand mb-2">
              <Zap size={24} />
            </div>
            <h3 className="text-xl font-medium tracking-tight text-gray-900">克制的 AI 协作</h3>
            <p className="text-nm-dark leading-relaxed text-sm">
              AI 隐于幕后。我们拒绝花哨的对话框堆砌，AI 仅在需要时化作恰到好处的光束与提示，提供高密度学术帮助。
            </p>
          </div>
        </div>
      </section>

      {/* Deep Dive 1: Literature Reading */}
      <section className="max-w-5xl w-full flex flex-col md:flex-row items-center gap-16 mb-36">
        <div className="flex-1 space-y-6">
          <div className="w-12 h-12 rounded-xl bg-nm-surface shadow-nm flex items-center justify-center text-brand mb-4">
            <FileText size={24} />
          </div>
          <h2 className="text-3xl lg:text-4xl font-semibold text-gray-900 leading-tight">
            深度文献解析与双栏重构
          </h2>
          <p className="text-lg text-nm-dark leading-relaxed">
            打破 PDF 静态页面的束缚。我们提供行业领先的文献解析引擎能力，将枯燥的双栏排版与截断的语境重构为流畅、响应式的高质量学术内容。
          </p>
          <ul className="space-y-4 mt-6 text-gray-700">
            <li className="flex items-center gap-3"><ArrowRight className="text-brand shrink-0" size={18} /> <span className="font-medium">高精度公式渲染</span>：无缝识别复杂数理公式与学术图表</li>
            <li className="flex items-center gap-3"><ArrowRight className="text-brand shrink-0" size={18} /> <span className="font-medium">一键引文溯源</span>：悬浮查看并一键跳转原文，无需上下翻找</li>
            <li className="flex items-center gap-3"><ArrowRight className="text-brand shrink-0" size={18} /> <span className="font-medium">沉浸式多模态交互</span>：图文、表格并在同一视野下自由组合</li>
          </ul>
        </div>
        <div className="flex-1 w-full bg-nm-surface shadow-nm rounded-[2.5rem] p-6 text-center border border-white/60 relative overflow-hidden h-[360px] flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-50/20"></div>
          {/* Abstract visual representation */}
          <div className="w-3/4 max-w-sm h-full max-h-[85%] bg-nm-bg shadow-nm-inset rounded-2xl p-5 relative z-10 flex flex-col gap-4">
             <div className="w-24 h-4 bg-gray-300 rounded-md"></div>
             <div className="w-full h-3 bg-gray-200 rounded-full"></div>
             <div className="w-5/6 h-3 bg-gray-200 rounded-full"></div>
             <div className="flex-1 w-full mt-2 bg-white/60 shadow-sm border border-brand/20 rounded-xl flex items-center justify-center text-brand font-medium tracking-wider">
               LaTeX 渲染视图区
             </div>
             <div className="w-full h-3 bg-gray-200 rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Deep Dive 2: Knowledge Network */}
      <section className="max-w-5xl w-full flex flex-col md:flex-row-reverse items-center gap-16 mb-36">
        <div className="flex-1 space-y-6 md:pl-10">
          <div className="w-12 h-12 rounded-xl bg-nm-surface shadow-nm flex items-center justify-center text-brand mb-4">
            <Network size={24} />
          </div>
          <h2 className="text-3xl lg:text-4xl font-semibold text-gray-900 leading-tight">
            打造无缝连接的知识库
          </h2>
          <p className="text-lg text-nm-dark leading-relaxed">
            任何有价值的思考都不应被遗忘。你在文献中产生的所有高亮、批注与灵感，都会自动被建立索引并转化为节点笔记，陪伴贯穿你的写作阶段。
          </p>
          <ul className="space-y-4 mt-6 text-gray-700">
            <li className="flex items-center gap-3"><ArrowRight className="text-brand shrink-0" size={18} /> <span className="font-medium">节点式卡片笔记</span>：双向链接打通文献间的知识壁垒</li>
            <li className="flex items-center gap-3"><ArrowRight className="text-brand shrink-0" size={18} /> <span className="font-medium">自动标签与聚类</span>：依靠小妍算法自动整理相近的文献主题</li>
            <li className="flex items-center gap-3"><ArrowRight className="text-brand shrink-0" size={18} /> <span className="font-medium">知识脉络可视化</span>：全局视野查看引用网络，发现领域空白</li>
          </ul>
        </div>
        <div className="flex-1 w-full bg-nm-surface shadow-nm rounded-[2.5rem] p-6 border border-white/60 min-h-[360px] flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-emerald-50/20"></div>
          <div className="w-3/4 h-3/4 flex gap-6 z-10 justify-center items-center">
            {/* Cards Mockup with connecting lines implied */}
            <div className="w-36 h-36 bg-nm-bg shadow-nm-inset rounded-2xl p-4 flex flex-col gap-3 -translate-y-8 relative">
              <div className="w-1/2 h-3 bg-gray-300 rounded-full"></div>
              <div className="w-full flex-1 bg-white shadow-sm rounded-lg flex items-center justify-center border border-gray-100">
                <LinkIcon className="text-gray-400" size={16} />
              </div>
            </div>
            <div className="w-36 h-36 bg-nm-bg shadow-nm-inset rounded-2xl p-4 flex flex-col gap-3 translate-y-8 relative">
             <div className="w-2/3 h-3 bg-gray-300 rounded-full"></div>
              <div className="w-full flex-1 bg-white shadow-sm rounded-lg flex items-center justify-center border border-gray-100">
                <LinkIcon className="text-gray-400" size={16} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deep Dive 3: Writing Assistant */}
      <section className="max-w-5xl w-full flex flex-col md:flex-row items-center gap-16 mb-24">
        <div className="flex-1 space-y-6">
          <div className="w-12 h-12 rounded-xl bg-nm-surface shadow-nm flex items-center justify-center text-brand mb-4">
            <PenTool size={24} />
          </div>
          <h2 className="text-3xl lg:text-4xl font-semibold text-gray-900 leading-tight">
            更纯粹的学术级表达
          </h2>
          <p className="text-lg text-nm-dark leading-relaxed">
            从草稿到顶会级写作，小妍伴随你的每一步。绝不伪造事实(幻觉)，只是基于你本人的核心思路与专属知识库，为你提供贴合学术规范的高质量润色建议。
          </p>
        </div>
        <div className="flex-1 w-full flex flex-col gap-5 text-left">
           {/* Mockup blocks */}
           <div className="bg-nm-surface p-6 rounded-[2rem] shadow-nm border border-white/50 flex items-start gap-4">
             <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Navigation className="text-brand" size={20} />
             </div>
             <div>
               <h4 className="font-semibold text-gray-900 text-lg">一键综述大纲</h4>
               <p className="text-sm text-nm-dark mt-2 leading-relaxed">基于选定的系列文献，自动提取核心主轴并附送引用锚点，建立稳固的文章结构。</p>
             </div>
           </div>
           <div className="bg-nm-surface p-6 rounded-[2rem] shadow-nm border border-white/50 flex items-start gap-4 ml-0 md:ml-10">
             <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <BrainCircuit className="text-brand" size={20} />
             </div>
             <div>
               <h4 className="font-semibold text-gray-900 text-lg">英语母语级精修</h4>
               <p className="text-sm text-nm-dark mt-2 leading-relaxed">提供合乎逻辑语序的句型重构建议，修正非正式表达，保证语法清晰专业。</p>
             </div>
           </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl w-full py-20 px-8 text-center bg-nm-surface rounded-[3rem] shadow-nm border border-white/60 mt-16 mb-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-brand/5 rounded-full blur-3xl mix-blend-multiply"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-brand/5 rounded-full blur-3xl mix-blend-multiply"></div>
        
        <h2 className="text-4xl font-semibold mb-6 text-gray-900 relative z-10">一切准备就绪</h2>
        <p className="text-lg text-nm-dark mb-10 max-w-xl mx-auto leading-relaxed relative z-10">
          下载小妍产品端，解锁丝滑的离线与本地科研流。<br/>
          跨平台可用，无缝衔接你的下一个重大研究突破。
        </p>
        <button className="relative z-10 inline-flex items-center gap-2 px-10 py-4 bg-brand text-white rounded-2xl shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.98] font-medium text-lg tracking-wide">
          <ArrowRight size={20} />
          立即获取最新版
        </button>
      </section>

      {/* Footer */}
      <footer className="mt-auto w-full max-w-5xl border-t border-gray-200 pt-10 pb-6 flex flex-col md:flex-row items-center justify-between text-nm-dark text-sm tracking-wide gap-4">
        <div className="font-medium text-gray-400 flex items-center gap-2">
           <Zap size={16} className="text-gray-300" />
           小妍 · 为科研而生
        </div>
        <div className="text-gray-400">
          &copy; {new Date().getFullYear()} 小妍产品团队. All rights reserved.
        </div>
      </footer>

    </div>
  );
}
