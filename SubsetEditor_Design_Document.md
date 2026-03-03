# 子集编辑器 (Subset Editor) 设计与实现文档

## 1. 概述
本文档旨在为低代码平台Agent提供“子集编辑器”的详细设计说明。该组件主要用于多维数据库（如TM1或类似OLAP系统）中的维度成员选择与子集（Subset）管理。用户可以通过可视化的树形结构、搜索、过滤等方式选择成员，并通过构建表达式块（Expression Blocks）来动态生成或静态定义子集成员列表。

## 2. 整体布局 (Layout)
整体采用 `Flex` 布局，分为顶部工具栏和下方的主体工作区（左右分栏）。

### 2.1 顶部工具栏 (Header)
- **左侧**：显示当前编辑的维度名称（如 `Region`）和层级（Hierarchy）。
- **中间**：子集下拉选择器（Subset Selector），用于切换不同的预设子集。
- **右侧**：操作按钮，包括“另存为”(Save As)、“保存”(Save) 和“关闭”(Close)。

### 2.2 主体工作区 (Main Workspace)
主体工作区分为三个部分：左侧面板、中间操作区、右侧面板。

#### 2.2.1 左侧面板：可用元素 (Available Elements)
- **顶部工具栏**：
  - 搜索框：支持按名称或别名搜索成员。
  - 过滤按钮：按层级（Level）、属性（Attribute）等进行过滤。
  - 视图切换：支持高亮模式（Highlight）和扁平模式（Flat）。
- **树形视图区**：
  - 渲染维度元素的层级结构（树形控件）。
  - 支持展开/折叠节点。
  - 节点图标区分：合并项（Consolidated，如文件夹图标）、叶子项（Numeric，如井号图标）。
  - 支持多选（Checkbox 或 点击高亮）。
  - **右键菜单 (Context Menu)**：在节点上右键可触发快捷操作，如“添加成员”、“添加子项”、“添加叶子节点”等。

#### 2.2.2 中间操作区 (Middle Actions)
- 包含一组垂直排列的图标按钮，用于在左右面板之间移动数据：
  - `>`：将左侧选中的成员添加到右侧。
  - `<`：将右侧选中的成员移除。
  - `>>` / `<<`：全部添加 / 全部移除。
  - `Keep` / `Delete`：保留选中 / 删除选中。

#### 2.2.3 右侧面板：表达式与结果集 (Right Pane)
右侧面板垂直分为上下两部分：
- **上半部分：表达式块 (Expression Blocks)**
  - 标题栏包含操作按钮：“从剪切板导入”(ClipboardPaste) 和 “添加自定义MDX”(Plus)。
  - 列表区：显示当前构建的MDX表达式块。每个块代表一个操作（如选择某个成员及其子项）。
  - 块的交互：点击选中块，选中后可对其进行二次操作（如排除某些成员 `Except`，或取交集 `Intersect`）。
- **下半部分：当前结果集 (Current Set)**
  - 显示由表达式块计算得出的最终成员列表。
  - 列表项支持选中。
  - 顶部包含排序/移动按钮：上移、下移、按字母升序/降序、反转等。

## 3. 核心数据结构 (Data Structures)

### 3.1 维度元素 (DimensionElement)
```typescript
interface DimensionElement {
  id: string;
  name: string;
  type: 'Consolidated' | 'Numeric' | 'String';
  level: number;
  children?: string[]; // 子节点ID列表
  parent?: string;     // 父节点ID
  attributes?: Record<string, string | number>;
}
```

### 3.2 表达式块 (ExpressionBlock)
用于记录用户的操作轨迹，最终可拼接为完整的MDX语句。
```typescript
interface ExpressionBlock {
  id: string;
  type: 'Member' | 'Children' | 'Leaves' | 'Descendants' | 'Ancestors';
  targetId: string; // 操作目标的元素ID
  mdx: string;      // 该块对应的局部MDX片段
  description: string; // UI上显示的易读描述
}
```

### 3.3 子集 (Subset)
```typescript
interface Subset {
  id: string;
  name: string;
  dimension: string;
  elements: string[]; // 静态成员列表
  mdx?: string;       // 动态子集的MDX表达式
}
```

## 4. 交互与核心逻辑 (Interactions & Logic)

### 4.1 树形控件交互
- **展开/折叠**：维护一个 `expandedNodes` 的 Set 集合，点击节点左侧的箭头切换状态。
- **选中**：维护一个 `leftSelected` 的 Set 集合，支持单选和多选。
- **右键菜单**：
  - 阻止默认右键事件 `e.preventDefault()`。
  - 获取鼠标坐标，渲染绝对定位的菜单。
  - 菜单项点击后，生成对应的 `ExpressionBlock` 并追加到右侧表达式列表中。

### 4.2 表达式块逻辑 (MDX Builder)
- **追加 (Union)**：默认情况下，向右侧添加新成员或集合时，是与现有块进行并集（Union）操作。
- **上下文操作 (Contextual Operations)**：
  - 当用户在右侧选中了某个特定的 `ExpressionBlock`（即 `activeBlockId` 不为空）时，再从左侧右键添加成员，会弹出操作选择：是进行“排除 (Exclude/Except)”还是“交集 (Intersect)”。
  - 逻辑实现：修改选中的 `ExpressionBlock`，将其原有的 MDX 与新的 MDX 通过 `EXCEPT()` 或 `INTERSECT()` 函数包裹。

### 4.3 剪贴板导入 (Clipboard Import)
- **入口**：右侧表达式块标题栏的“剪贴板”图标。
- **交互**：弹出一个多行文本框（Textarea），用户可粘贴逗号分隔的成员编码（如 `US, Canada, UK`）。
- **逻辑**：
  - 按逗号分割字符串，去除首尾空格。
  - 校验成员是否存在于当前维度中。
  - 将有效的成员拼接为 MDX 集合语法 `{ [Dimension].[Member1], [Dimension].[Member2] }`。
  - 覆盖当前的表达式块（或作为新块追加）。
  - 若包含无效成员，弹出提示框（Alert Dialog）告知用户哪些成员被忽略。

### 4.4 自定义 MDX (Custom MDX)
- **入口**：右侧表达式块标题栏的“+”图标，或双击现有的自定义MDX块。
- **交互**：弹出对话框，提供一个等宽字体的文本框供用户直接编写 MDX 语句。
- **逻辑**：保存时生成一个类型为 `Member` 的特殊块，描述为 "Custom Expression"。

## 5. 样式与主题 (Styling)
- **CSS 框架**：使用 Tailwind CSS。
- **颜色规范**：
  - 背景色：整体偏浅色，使用 `bg-white` 和 `bg-gray-50` 区分不同面板。
  - 边框：`border-gray-200` 用于面板分割。
  - 强调色：蓝色 `blue-600` 用于主按钮和选中高亮状态。
  - 图标颜色：合并节点使用琥珀色 `text-amber-500`，叶子节点使用蓝色 `text-blue-500`。
- **排版**：
  - 字体大小以 `text-sm` (14px) 和 `text-xs` (12px) 为主，适合数据密集型应用。
  - 列表项高度紧凑，悬浮时有 `hover:bg-gray-100` 的反馈。

## 6. 给低代码平台 Agent 的实现建议

1. **组件拆分**：
   - 建议将左侧树形控件（`TreeView`）、右侧表达式列表（`ExpressionList`）、右侧结果集（`ResultSet`）拆分为独立的子组件，通过父组件（`SubsetEditor`）进行状态提升和统一管理。
2. **状态管理**：
   - 由于涉及大量的选中状态（左侧选中、右侧块选中、右侧成员选中）、展开状态，建议在低代码平台中使用全局状态（如 Redux/Zustand）或复杂的 Context Provider 来管理，避免 Props 层级过深。
3. **性能优化**：
   - 当维度成员数量巨大（如上万个节点）时，左侧树形控件必须实现**虚拟滚动 (Virtual Scrolling)**。
   - 搜索和过滤操作应使用防抖（Debounce），并在 Web Worker 中进行，避免阻塞主线程。
4. **后端交互**：
   - 当前代码中的 `currentSet` 是前端模拟计算的。在实际落地时，每次 `expressionBlocks` 发生变化，都应该将生成的完整 MDX 发送给后端（TM1 Server），由后端执行 MDX 并返回最终的成员列表，然后更新到 `currentSet` 中。
5. **拖拽支持 (Drag & Drop)**：
   - 可以在低代码平台中引入拖拽库（如 `dnd-kit`），支持将左侧节点直接拖拽到右侧面板，提升用户体验。
