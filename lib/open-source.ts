export const openSourceCategories = [
  { id: "all", label: "全部" },
  { id: "skills", label: "Skills 与工作流" },
  { id: "agents", label: "智能体系统" },
  { id: "context", label: "智能体上下文" },
  { id: "tools", label: "AI 开发工具" },
] as const;

export const openSourceDimensions = [
  { id: "agent-skills", label: "Agent Skills" },
  { id: "coding-agent", label: "Coding Agent" },
  { id: "agent-runtime", label: "Agent 运行时" },
  { id: "long-running", label: "长程 Agent" },
  { id: "multi-agent", label: "多智能体协作" },
  { id: "agent-control", label: "Agent 控制面" },
  { id: "agent-infra", label: "Agent 基础设施" },
  { id: "agent-context", label: "Agent 上下文" },
  { id: "local-retrieval", label: "本地检索" },
  { id: "model-gateway", label: "模型网关" },
  { id: "ai-ingestion", label: "AI 数据入口" },
] as const;

export type OpenSourceCategory = (typeof openSourceCategories)[number]["id"];
export type OpenSourceDimension = (typeof openSourceDimensions)[number]["id"];
export type OpenSourceStatus = "持续跟踪" | "计划试用" | "已提炼";

export type OpenSourceEvidence = {
  checkedAt: string;
  kind: "readme" | "repository";
  label: string;
  note: string;
  url: string;
};

export type OpenSourceEntry = {
  category: Exclude<OpenSourceCategory, "all">;
  caveats: string[];
  dimensions: OpenSourceDimension[];
  evidence: OpenSourceEvidence;
  judgement: string;
  nextStep: string;
  personalNote: string;
  repository: string;
  repositoryUrl: string;
  scenarios: string[];
  slug: string;
  sourceSummary: string;
  status: OpenSourceStatus;
  type: string;
  workflow: Array<{ description: string; label: string }>;
};

/**
 * 这是经过人工挑选、可以公开的个人判读，不是完整 GitHub Star 列表。
 * 事实层优先来自 README；仅在 README 缺失时才切换到仓库结构与入口文件解析。
 * 原始 Star 候选与后续同步记录保持在站点公开内容之外。
 */
export const openSourceEntries: OpenSourceEntry[] = [
  {
    category: "skills",
    caveats: [
      "它是给 Agent 调用的方法与评审集合，不是可直接替换设计系统的组件库。",
      "能否改善成品仍取决于调用它的 Agent、现有代码库和验收标准。",
    ],
    dimensions: ["agent-skills", "coding-agent"],
    evidence: {
      checkedAt: "2026-08-09",
      kind: "readme",
      label: "README.md",
      note: "README 将其定位为面向界面质量的 Agent Skills 集合。",
      url: "https://github.com/jakubkrehel/skills/blob/main/README.md",
    },
    judgement: "Skill 的价值不在于堆提示词，而在于把一次次高质量判断变成可被稳定调用的工作流。",
    nextStep: "继续观察哪些界面设计判断适合沉淀为项目内 Skills，并用真实改版验证效果。",
    personalNote: "我关注它如何把动画、可访问性与产品文案这些容易被忽略的环节，拆成面向 Agent 的明确能力。",
    repository: "jakubkrehel/skills",
    repositoryUrl: "https://github.com/jakubkrehel/skills",
    scenarios: ["需要让 Agent 在已有项目中完成一轮可复核的界面打磨。", "希望把 UI 评审标准从口头偏好转成可重复执行的工作流。"],
    slug: "jakubkrehel-skills",
    sourceSummary: "一组帮助 Agent 改善界面成品的 Skills，覆盖 UI 细节、排版、颜色、可访问性和产品文案。",
    status: "持续跟踪",
    type: "Skill 集合",
    workflow: [
      { label: "统一入口", description: "README 将 better-interface 作为协调界面改进任务的总入口。" },
      { label: "专项能力", description: "better-ui、typography、colors、accessibility 与 writing 分别处理不同的体验问题。" },
      { label: "整体评审", description: "interface-review 用于从多个专项维度复查一轮界面输出。" },
    ],
  },
  {
    category: "skills",
    caveats: [
      "README 说明分析阶段可能会把时间线 URL、截取文本、截图或旁白发送到 GitHub Cloud；录制前需要先判断内容敏感性。",
      "录制得到的是候选 Skill 或自动化，仍应人工校验意图还原和步骤泛化是否正确。",
    ],
    dimensions: ["agent-skills", "long-running"],
    evidence: {
      checkedAt: "2026-08-09",
      kind: "readme",
      label: "README.md",
      note: "README 描述从录制一次任务到生成 Skill 或定时自动化的完整路径。",
      url: "https://github.com/microsoft/skill-recorder/blob/main/README.md",
    },
    judgement: "如果真实操作过程可以还原成意图和步骤，Skill 就不必只来自手工编写，也可以从工作本身生长出来。",
    nextStep: "评估从录制到可复用 Skill 的各阶段，哪些必须由人确认后再继续。",
    personalNote: "它把一次屏幕操作转成可复用自动化的路径，提供了捕捉隐性工作流的另一种思路。",
    repository: "microsoft/skill-recorder",
    repositoryUrl: "https://github.com/microsoft/skill-recorder",
    scenarios: ["把稳定、重复的桌面或网页操作整理为候选 Skill。", "希望从真实执行轨迹中发现可以自动化的工作步骤。"],
    slug: "microsoft-skill-recorder",
    sourceSummary: "记录一次桌面操作，再借助 Copilot CLI 还原意图与有序步骤，生成可复用 Skill 或定时自动化。",
    status: "计划试用",
    type: "Skill 工具",
    workflow: [
      { label: "录制", description: "捕捉屏幕、点击、应用或窗口信息、页面 URL，并可选记录旁白。" },
      { label: "分析", description: "使用 Copilot CLI 从过程重建任务意图与步骤，而不是机械回放点击。" },
      { label: "生成", description: "将结果输出为 SKILL.md，或输出可定时运行的自动化。" },
    ],
  },
  {
    category: "skills",
    caveats: [
      "它提供的是前端 Agent 的工作规范，而非可直接安装的 UI 组件或运行时。",
      "规范需要与具体项目的数据模型、设计语言和代码边界一起使用。",
    ],
    dimensions: ["agent-skills", "coding-agent"],
    evidence: {
      checkedAt: "2026-08-09",
      kind: "readme",
      label: "README.md",
      note: "README 以任务、状态、空间和代码四类上下文组织前端 Agent 的工作。",
      url: "https://github.com/oil-oil/oil-frontend/blob/main/README.md",
    },
    judgement: "让前端 Agent 写出可维护界面，需要约束的不只是组件代码，还包括状态、归属与体验标准。",
    nextStep: "把其中可验证的前端规范，与当前站点的实现约束做一次对照。",
    personalNote: "中文前端规范对 Agent 的表达更直接，尤其适合观察产品设计规则如何进入编码过程。",
    repository: "oil-oil/oil-frontend",
    repositoryUrl: "https://github.com/oil-oil/oil-frontend",
    scenarios: ["给前端 Agent 补齐任务、状态、界面空间与代码归属的共同上下文。", "在改版前先排除无效信息、伪操作和没有所有者的 UI。"],
    slug: "oil-oil-oil-frontend",
    sourceSummary: "面向 AI 产品前端实现的 Skill，以任务与对象、状态与范围、界面与空间、组件与代码组织上下文。",
    status: "已提炼",
    type: "前端 Skill",
    workflow: [
      { label: "先明确对象", description: "从用户任务和业务对象开始，而不是直接堆叠页面元素。" },
      { label: "校准状态", description: "审查数据、状态与操作范围，移除无效信息和伪操作。" },
      { label: "落回代码", description: "明确 UI 与代码的所有权，再修改源代码并处理迁移。" },
    ],
  },
  {
    category: "agents",
    caveats: [
      "它管理 Agent 使用的终端和会话，不替换 Claude Code、Codex 等具体 Agent。",
      "持久会话能降低中断成本，但任务权限、提示与结果质量仍由上层 Agent 和操作者负责。",
    ],
    dimensions: ["coding-agent", "agent-runtime"],
    evidence: {
      checkedAt: "2026-08-09",
      kind: "readme",
      label: "README.md",
      note: "README 将 herdr 定义为 Coding Agent 所处的后台终端运行时。",
      url: "https://github.com/herdrdev/herdr/blob/master/README.md",
    },
    judgement: "Coding Agent 的体验不只取决于模型；终端、工作区与多任务切换同样是运行时的一部分。",
    nextStep: "继续拆解它如何处理多会话、终端与工作区之间的协作关系。",
    personalNote: "它把“Agent 在哪里工作”当成一等问题，而不是把工具调用藏在单次对话之后。",
    repository: "herdrdev/herdr",
    repositoryUrl: "https://github.com/herdrdev/herdr",
    scenarios: ["需要长时间保留多个 Coding Agent 终端，并可随时重新附着。", "希望一眼识别哪些任务正在工作、被阻塞或处于空闲。"],
    slug: "herdr",
    sourceSummary: "一个常驻后台的终端运行时：Agent 运行在其中，断网或重启后会话可以恢复，并可从本地终端或 SSH 重新附着。",
    status: "持续跟踪",
    type: "Agent 运行时",
    workflow: [
      { label: "托管终端", description: "后台服务持有终端与会话，不把一次终端连接当作唯一载体。" },
      { label: "暴露状态", description: "每个 pane 标记为 working、blocked 或 idle，便于定位需要人工处理的任务。" },
      { label: "Agent 原生接口", description: "CLI 与 socket API 使用同一表面，可用于创建 pane、提示其他 Agent 与等待阻塞。" },
    ],
  },
  {
    category: "agents",
    caveats: [
      "LoopX 不取代执行工作的 Agent runtime，也不是特定模型提供商的编排框架。",
      "README 明确将危险权限、发布、生产写入和最终所有权保留给人。",
    ],
    dimensions: ["long-running", "multi-agent", "agent-control"],
    evidence: {
      checkedAt: "2026-08-09",
      kind: "readme",
      label: "README.md",
      note: "README 将其定位为长程 Agent 的本地优先、提供商中立控制面。",
      url: "https://github.com/huangruiteng/loopx/blob/main/README.md",
    },
    judgement: "长程 Agent 的关键不是不断续聊，而是把目标、证据、配额和交接变成可恢复的状态。",
    nextStep: "关注它的目标状态、自动唤醒与可验证交接如何组合。",
    personalNote: "它把长期任务的状态核从具体 Agent Loop 中抽离出来，值得和实际多 Agent 协作方式对照。",
    repository: "huangruiteng/loopx",
    repositoryUrl: "https://github.com/huangruiteng/loopx",
    scenarios: ["跨多天的工程、研究或实验任务需要保留目标、证据与待办。", "多个 Agent 作为对等协作者工作，需要明确认领、租约、交接与人工关口。"],
    slug: "loopx",
    sourceSummary: "为长程 AI Agent 与对等 Agent 团队提供状态内核：稳定保存目标、关口、待办、证据、配额和交接。",
    status: "持续跟踪",
    type: "Agent 控制层",
    workflow: [
      { label: "持久状态", description: "将目标、范围、待办、证据和配额维护在独立控制层中。" },
      { label: "有界执行", description: "Codex、Claude Code、Cursor 或自定义运行时只执行一个受限工作切片。" },
      { label: "写回与续航", description: "把证据、交接与下一步写回状态，再由配额决定是否应触发下一次行动。" },
    ],
  },
  {
    category: "agents",
    caveats: [
      "agentOS 是进程内轻量 VM，不等同于具备完整 Linux 环境的沙箱；重浏览器和原生编译等工作负载可能仍需完整沙箱。",
      "README 标注 API 仍处于 preview，接入前需要评估版本变化与部署边界。",
    ],
    dimensions: ["agent-runtime", "agent-infra"],
    evidence: {
      checkedAt: "2026-08-09",
      kind: "readme",
      label: "README.md",
      note: "README 描述其在后端进程中提供虚拟机、权限与持久会话的方式。",
      url: "https://github.com/rivet-dev/agentos/blob/main/README.md",
    },
    judgement: "Agent 的执行边界应当是架构选择，而不是上线前才补的安全选项。",
    nextStep: "继续验证库式运行时在工具隔离、权限和部署成本之间的取舍。",
    personalNote: "它尝试以库的方式提供 Agent 所需的运行环境，让执行隔离可以进入已有后端。",
    repository: "rivet-dev/agentos",
    repositoryUrl: "https://github.com/rivet-dev/agentos",
    scenarios: ["希望把 Agent 会话、文件、命令和权限作为现有后端的一部分来管理。", "需要在轻量隔离与按需接入完整沙箱之间做分层。"],
    slug: "agentos",
    sourceSummary: "一个作为库嵌入后端的 Agent 操作系统：在进程内运行轻量 VM，并为 Agent 提供会话、工具、权限和持久化能力。",
    status: "计划试用",
    type: "Agent 基础设施",
    workflow: [
      { label: "声明软件", description: "在后端中注册 Pi、Claude Code、Codex、OpenCode 或自定义 Agent 软件。" },
      { label: "创建会话", description: "通过统一客户端 API 获取 VM、打开持久会话并接收流式事件。" },
      { label: "限制能力", description: "以文件、网络、进程和环境权限约束 Agent，默认拒绝对外网络等能力。" },
    ],
  },
  {
    category: "context",
    caveats: [
      "它区分 raw、wiki 与生成元数据；公开或同步前仍需自行审查来源、私密内容与路径信息。",
      "Agent 工作记忆轨迹功能在 README 中为显式 opt-in，默认不启用。",
    ],
    dimensions: ["agent-context"],
    evidence: {
      checkedAt: "2026-08-09",
      kind: "readme",
      label: "README.md",
      note: "README 将其定位为面向 pi、兼容 Obsidian 与 OKF 的可维护知识库。",
      url: "https://github.com/zosmaai/pi-llm-wiki/blob/main/README.md",
    },
    judgement: "比起一次性 RAG，能被维护、链接和复查的知识结构更适合作为 Agent 的长期上下文。",
    nextStep: "比较它的 OKF 知识组织方式与当前项目的公开/私有内容边界。",
    personalNote: "它把原始来源转成可互相链接、可持续维护的 Wiki，关注点正好落在知识如何累积。",
    repository: "zosmaai/pi-llm-wiki",
    repositoryUrl: "https://github.com/zosmaai/pi-llm-wiki",
    scenarios: ["把 URL、PDF、Markdown、JSON 或 XML 逐步转成可追溯的知识库。", "需要让 pi 或 MCP 客户端共享一个兼容 OKF 的个人与项目知识层。"],
    slug: "pi-llm-wiki",
    sourceSummary: "面向 pi 的自维护知识库：将原始资料转成可互链、可检索且兼容 Obsidian 与 OKF 的 Wiki。",
    status: "持续跟踪",
    type: "知识系统",
    workflow: [
      { label: "保留来源", description: "原始资料以 source packet 形式保存，作为可追溯的输入层。" },
      { label: "形成知识页", description: "将来源沉淀为来源页、规范 Wiki 页与可维护的概念、实体、综合和分析页面。" },
      { label: "生成投影", description: "从权威页面确定性生成索引、反链和日志，并通过搜索、MCP 或 pi 工具使用。" },
    ],
  },
  {
    category: "context",
    caveats: [
      "它是本地检索与上下文工具，不负责替使用者判断资料质量、权限或公开边界。",
      "向量检索与重排依赖本地模型和索引准备，接入成本应与实际资料规模一起评估。",
    ],
    dimensions: ["agent-context", "local-retrieval"],
    evidence: {
      checkedAt: "2026-08-09",
      kind: "readme",
      label: "README.md",
      note: "README 描述其使用本地 BM25、向量检索与 LLM 重排来查询文档集合。",
      url: "https://github.com/tobi/qmd/blob/main/README.md",
    },
    judgement: "本地检索并不只是离线替代品；它也决定了个人知识能否以低摩擦方式进入日常 Agent 工作流。",
    nextStep: "关注它在本地文档、笔记与会议记录之间的检索质量和接入成本。",
    personalNote: "一个轻量本地搜索引擎，适合观察“先找对上下文，再调用模型”的工作方式。",
    repository: "tobi/qmd",
    repositoryUrl: "https://github.com/tobi/qmd",
    scenarios: ["在本地笔记、文档和会议记录之间按关键词或自然语言寻找上下文。", "向 Agent 提供 JSON、文件列表或全文读取等可组合的检索接口。"],
    slug: "qmd",
    sourceSummary: "一个设备端文档搜索引擎：对 Markdown、会议记录、文档和知识库使用 BM25、向量检索与 LLM 重排。",
    status: "计划试用",
    type: "本地检索",
    workflow: [
      { label: "组织集合", description: "将笔记、会议记录或文档目录注册为 collection，并为子文档补充树状上下文。" },
      { label: "建立索引", description: "生成 embedding 后，可分别进行关键词、向量或混合加重排查询。" },
      { label: "供 Agent 调用", description: "通过 CLI 的 JSON/文件输出或 MCP 的 query、get、multi_get 与 status 工具接入。" },
    ],
  },
  {
    category: "tools",
    caveats: [
      "它是独立社区项目，并非 OpenAI、Anthropic 或其他模型提供商的官方产品。",
      "README 提醒第三方代理可能触及上游服务条款；接入账号、OAuth 与远程访问前必须先评估风险。",
    ],
    dimensions: ["coding-agent", "model-gateway"],
    evidence: {
      checkedAt: "2026-08-09",
      kind: "readme",
      label: "README.md",
      note: "README 将其描述为面向 Codex、Claude Code 等客户端的本地模型提供方代理。",
      url: "https://github.com/lidge-jun/opencodex/blob/main/README.md",
    },
    judgement: "模型选择、账号能力和编码工作流会持续变化，因此提供方适配层应与具体 Agent 体验解耦。",
    nextStep: "持续关注其兼容边界，以及代理层是否会引入新的可靠性与安全问题。",
    personalNote: "它把多家模型服务接到 Codex 与 Claude Code 上，值得从可替换性和维护边界两个角度看。",
    repository: "lidge-jun/opencodex",
    repositoryUrl: "https://github.com/lidge-jun/opencodex",
    scenarios: ["在不改变 Codex、Claude Code 或 Claude Desktop 原有交互的前提下接入不同模型。", "为模型路由、账号池、故障转移和运行状态提供本地管理面。"],
    slug: "opencodex",
    sourceSummary: "一个本地通用模型代理，将 Codex 的 Responses API 与不同模型提供商的流式、工具、推理和图像能力互相转换。",
    status: "持续跟踪",
    type: "模型网关",
    workflow: [
      { label: "启动代理", description: "在本地启动代理和仪表盘，为客户端提供统一入口。" },
      { label: "配置路由", description: "管理模型提供商、虚拟模型组合、故障转移或加权轮询，以及 Codex 子 Agent 的模型表面。" },
      { label: "维持会话", description: "可管理账号配额与线程亲和性；已有线程通常保持在最初账号，异常时再按规则重新绑定。" },
    ],
  },
  {
    category: "tools",
    caveats: [
      "它不提供 OCR；扫描件、图片型或混合 PDF 需要由调用方根据分类结果选择后续 OCR 路径。",
      "README 的基准结论针对其公开的测试条件，实际文件版式与语言仍应在目标资料上验证。",
    ],
    dimensions: ["ai-ingestion"],
    evidence: {
      checkedAt: "2026-08-09",
      kind: "readme",
      label: "README.md",
      note: "README 说明其先分类 PDF，再按版式提取文本和转换 Markdown 的处理链。",
      url: "https://github.com/firecrawl/pdf-inspector/blob/main/README.md",
    },
    judgement: "面对企业资料，先判断文件类型和可用性，再选择提取与理解路径，通常比一律丢给模型更可靠。",
    nextStep: "观察它如何区分扫描件与文本 PDF，以及结果是否适合进入后续 Agent 管道。",
    personalNote: "它把 PDF 的检查、分类和文本提取放到一个快速库里，体现了 AI 数据入口应先做路由判断。",
    repository: "firecrawl/pdf-inspector",
    repositoryUrl: "https://github.com/firecrawl/pdf-inspector",
    scenarios: ["在批量资料入库前先判断哪些 PDF 可以直接本地提取，哪些需要 OCR。", "需要尽可能保留阅读顺序、表格和位置关系，再交给后续 Agent 处理。"],
    slug: "pdf-inspector",
    sourceSummary: "一个 Rust PDF 分类与文本提取库，可识别文本型、扫描型、图片型或混合 PDF，并将可读内容转换为 Markdown。",
    status: "计划试用",
    type: "内容入口",
    workflow: [
      { label: "快速分类", description: "通过采样内容流判断 PDF 类型，并给出页面级 OCR 路由信息。" },
      { label: "一次加载提取", description: "同一份已加载文档在检测与提取阶段复用，识别文字、坐标、字体与布局。" },
      { label: "结构化输出", description: "处理多栏顺序、表格、列表、标题和链接，输出面向下游使用的 Markdown 或绑定 API 结果。" },
    ],
  },
];

export function getOpenSourceEntry(slug: string) {
  return openSourceEntries.find((entry) => entry.slug === slug) ?? null;
}

export function getOpenSourceCategoryLabel(category: OpenSourceCategory) {
  return openSourceCategories.find((item) => item.id === category)?.label ?? category;
}

export function getOpenSourceDimensionLabel(dimension: OpenSourceDimension) {
  return openSourceDimensions.find((item) => item.id === dimension)?.label ?? dimension;
}
