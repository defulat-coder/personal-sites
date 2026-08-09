export const openSourceCategories = [
  { id: "all", label: "全部" },
  { id: "skills", label: "Skills 与工作流" },
  { id: "agents", label: "Agent 系统" },
  { id: "context", label: "上下文与记忆" },
  { id: "tools", label: "开发者工具" },
] as const;

export type OpenSourceCategory = (typeof openSourceCategories)[number]["id"];
export type OpenSourceStatus = "持续跟踪" | "计划试用" | "已提炼";

export type OpenSourceEntry = {
  category: Exclude<OpenSourceCategory, "all">;
  focus: string[];
  judgement: string;
  nextStep: string;
  personalNote: string;
  repository: string;
  repositoryDescription: string;
  repositoryUrl: string;
  slug: string;
  status: OpenSourceStatus;
  type: string;
};

/**
 * 这是经过人工挑选、可以公开的个人判读，不是完整 GitHub Star 列表。
 * 原始 Star 候选与后续同步记录保持在站点公开内容之外。
 */
export const openSourceEntries: OpenSourceEntry[] = [
  {
    category: "skills",
    focus: ["能力拆分", "界面质量", "可复用工作流"],
    judgement: "Skill 的价值不在于堆提示词，而在于把一次次高质量判断变成可被稳定调用的工作流。",
    nextStep: "继续观察哪些界面设计判断适合沉淀为项目内 Skills。",
    personalNote: "关注它如何把动画、可访问性与产品文案这些容易被忽略的环节，拆成面向 Agent 的明确能力。",
    repository: "jakubkrehel/skills",
    repositoryDescription: "一组帮助构建更好界面的 Agent Skills，覆盖动画、UI 打磨、可访问性和产品文案。",
    repositoryUrl: "https://github.com/jakubkrehel/skills",
    slug: "jakubkrehel-skills",
    status: "持续跟踪",
    type: "Skill 集合",
  },
  {
    category: "skills",
    focus: ["工作记录", "技能生成", "自动化"],
    judgement: "如果真实操作过程可以还原成意图和步骤，Skill 就不必只来自手工编写，也可以从工作本身生长出来。",
    nextStep: "评估它从录制到可复用 Skill 之间，哪些环节需要人工校验。",
    personalNote: "它把一次屏幕操作转成可复用自动化的路径，提供了捕捉隐性工作流的另一种思路。",
    repository: "microsoft/skill-recorder",
    repositoryDescription: "记录屏幕工作过程，并借助 Copilot CLI 还原意图和步骤，再生成可复用的 Skill 或自动化。",
    repositoryUrl: "https://github.com/microsoft/skill-recorder",
    slug: "microsoft-skill-recorder",
    status: "计划试用",
    type: "Skill 工具",
  },
  {
    category: "skills",
    focus: ["前端规范", "产品状态", "设计系统"],
    judgement: "让前端 Agent 写出可维护界面，需要约束的不只是组件代码，还包括状态、归属与体验标准。",
    nextStep: "把其中可验证的前端规范，和当前站点的实现约束做一次对照。",
    personalNote: "中文前端规范对 Agent 的表达更直接，尤其适合观察产品设计规则如何进入编码过程。",
    repository: "oil-oil/oil-frontend",
    repositoryDescription: "为前端 Agent 提供的中文规范，统一产品界面、数据状态、组件组织和代码归属。",
    repositoryUrl: "https://github.com/oil-oil/oil-frontend",
    slug: "oil-oil-oil-frontend",
    status: "已提炼",
    type: "前端 Skill",
  },
  {
    category: "agents",
    focus: ["Coding Agent", "终端工作区", "运行时"],
    judgement: "Coding Agent 的体验不只取决于模型；终端、工作区与多任务切换同样是运行时的一部分。",
    nextStep: "继续拆解它如何处理多会话、终端与工作区之间的协作关系。",
    personalNote: "它把“Agent 在哪里工作”当成一等问题，而不是把工具调用藏在单次对话之后。",
    repository: "herdrdev/herdr",
    repositoryDescription: "为 Coding Agent 提供的运行时。",
    repositoryUrl: "https://github.com/herdrdev/herdr",
    slug: "herdr",
    status: "持续跟踪",
    type: "Agent 运行时",
  },
  {
    category: "agents",
    focus: ["长程任务", "状态管理", "交接"],
    judgement: "长程 Agent 的关键不是不断续聊，而是把目标、证据、配额和交接变成可恢复的状态。",
    nextStep: "关注它的目标状态、自动唤醒与可验证交接如何组合。",
    personalNote: "它把长期任务的状态核从具体 Agent Loop 中抽离出来，值得和实际多 Agent 协作方式对照。",
    repository: "huangruiteng/loopx",
    repositoryDescription: "面向长程 AI Agent 团队的轻量循环工程状态内核，提供持久目标、配额感知唤醒、待办、证据和交接。",
    repositoryUrl: "https://github.com/huangruiteng/loopx",
    slug: "loopx",
    status: "持续跟踪",
    type: "Agent 控制层",
  },
  {
    category: "agents",
    focus: ["执行隔离", "WebAssembly", "Agent 基础设施"],
    judgement: "Agent 的执行边界应当是架构选择，而不是上线前才补的安全选项。",
    nextStep: "继续验证库式运行时在工具隔离、权限和部署成本之间的取舍。",
    personalNote: "它尝试以库的方式提供 Agent 所需的运行环境，让执行隔离可以进入已有后端。",
    repository: "rivet-dev/agentos",
    repositoryDescription: "以 WebAssembly 与 V8 isolates 驱动的 Agent 操作系统库，可运行在现有后端中。",
    repositoryUrl: "https://github.com/rivet-dev/agentos",
    slug: "agentos",
    status: "计划试用",
    type: "Agent 基础设施",
  },
  {
    category: "context",
    focus: ["OKF", "知识库", "长期上下文"],
    judgement: "比起一次性 RAG，能被维护、链接和复查的知识结构更适合作为 Agent 的长期上下文。",
    nextStep: "比较它的 OKF 知识组织方式与当前项目的公开/私有内容边界。",
    personalNote: "它把原始来源转成可互相链接、可持续维护的 Wiki，关注点正好落在知识如何累积。",
    repository: "zosmaai/pi-llm-wiki",
    repositoryDescription: "面向 pi 的自维护、兼容 Obsidian 的知识库，可将原始资料沉淀为相互链接的 OKF Wiki。",
    repositoryUrl: "https://github.com/zosmaai/pi-llm-wiki",
    slug: "pi-llm-wiki",
    status: "持续跟踪",
    type: "知识系统",
  },
  {
    category: "context",
    focus: ["本地优先", "检索", "上下文工程"],
    judgement: "本地检索并不只是离线替代品；它也决定了个人知识能否以低摩擦方式进入日常 Agent 工作流。",
    nextStep: "关注它在本地文档、笔记与会议记录之间的检索质量和接入成本。",
    personalNote: "一个轻量本地搜索引擎，适合观察“先找对上下文，再调用模型”的工作方式。",
    repository: "tobi/qmd",
    repositoryDescription: "面向文档、知识库和会议记录的本地轻量 CLI 搜索引擎。",
    repositoryUrl: "https://github.com/tobi/qmd",
    slug: "qmd",
    status: "计划试用",
    type: "本地检索",
  },
  {
    category: "tools",
    focus: ["模型路由", "提供方适配", "Coding 工具"],
    judgement: "模型选择、账号能力和编码工作流会持续变化，因此提供方适配层应与具体 Agent 体验解耦。",
    nextStep: "持续关注其兼容边界，以及代理层是否会引入新的可靠性与安全问题。",
    personalNote: "它把多家模型服务接到 Codex 与 Claude Code 上，值得从可替换性和维护边界两个角度看。",
    repository: "lidge-jun/opencodex",
    repositoryDescription: "面向 OpenAI Codex 与 Claude Code 的通用模型提供方代理。",
    repositoryUrl: "https://github.com/lidge-jun/opencodex",
    slug: "opencodex",
    status: "持续跟踪",
    type: "开发者工具",
  },
  {
    category: "tools",
    focus: ["PDF", "内容路由", "结构化提取"],
    judgement: "面对企业资料，先判断文件类型和可用性，再选择提取与理解路径，通常比一律丢给模型更可靠。",
    nextStep: "观察它如何区分扫描件与文本 PDF，以及结果是否适合进入后续 Agent 管道。",
    personalNote: "它把 PDF 的检查、分类和文本提取放到一个快速库里，体现了 AI 数据入口应先做路由判断。",
    repository: "firecrawl/pdf-inspector",
    repositoryDescription: "快速检查、分类并提取 PDF 文本的 Rust 库，可识别扫描件与文本型 PDF 以辅助路由。",
    repositoryUrl: "https://github.com/firecrawl/pdf-inspector",
    slug: "pdf-inspector",
    status: "计划试用",
    type: "内容工具",
  },
];

export function getOpenSourceEntry(slug: string) {
  return openSourceEntries.find((entry) => entry.slug === slug) ?? null;
}

export function getOpenSourceCategoryLabel(category: OpenSourceCategory) {
  return openSourceCategories.find((item) => item.id === category)?.label ?? category;
}
