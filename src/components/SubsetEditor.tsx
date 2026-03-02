import React, { useState, useMemo, useEffect, useRef } from 'react';
import { mockElements, mockSubsets, rootElements } from '../data/mockData';
import { DimensionElement, Subset } from '../types';
import { 
  ChevronRight, ChevronDown, Search, Filter, 
  Save, ArrowRight, ArrowLeft, ChevronsRight, ChevronsLeft,
  ArrowUp, ArrowDown, Trash2, CheckSquare, Square,
  FolderTree, Hash, Type, X, ChevronUp, Tag, ArrowDownAZ, ArrowUpZA, RotateCcw, Play,
  History, Lock, Edit3, Check, ListTree, ListChecks, MoreHorizontal, Plus, Minus, Combine
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ElementIcon = ({ type }: { type: DimensionElement['type'] }) => {
  switch (type) {
    case 'Consolidated':
      return <FolderTree size={14} className="text-amber-500" />;
    case 'Numeric':
      return <Hash size={14} className="text-blue-500" />;
    case 'String':
      return <Type size={14} className="text-green-500" />;
    default:
      return <Hash size={14} className="text-gray-500" />;
  }
};

interface ExpressionBlock {
  id: string;
  type: 'Member' | 'Children' | 'Descendants' | 'Base' | 'Level' | 'Attribute' | 'Except' | 'Intersect' | 'Union';
  targetId?: string; // For member-based operations
  targetLevel?: number; // For Level/Base operations
  targetAttr?: { name: string; value: string }; // For Attribute operations
  subBlocks?: ExpressionBlock[]; // For nested operations like Except(Base(A), Base(B))
  mdx: string;
  description: string;
}

export default function SubsetEditor() {
  const [subsets, setSubsets] = useState<Subset[]>(mockSubsets);
  const [activeSubsetId, setActiveSubsetId] = useState<string>(mockSubsets[0].id);
  
  // Left Pane State (Working Set)
  const [leftMembers, setLeftMembers] = useState<string[]>(Object.keys(mockElements));
  const [leftMdx, setLeftMdx] = useState<string>('{ TM1SUBSETALL( [Region] ) }');
  const [leftSelected, setLeftSelected] = useState<Set<string>>(new Set());
  const [leftIsHierarchical, setLeftIsHierarchical] = useState(true);
  const [hoveredLeftId, setHoveredLeftId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; targetId: string } | null>(null);
  
  // Left Toolbar UI State
  const [levelFilter, setLevelFilter] = useState('all');
  const [wildcard, setWildcard] = useState('');
  const [ud1Filter, setUd1Filter] = useState('');
  const [ud2Filter, setUd2Filter] = useState('');
  const [highlightedMembers, setHighlightedMembers] = useState<Set<string> | null>(null);
  const [filterViewMode, setFilterViewMode] = useState<'highlight' | 'flat'>('highlight');

  // Right Pane State (Expression Blocks)
  const [expressionBlocks, setExpressionBlocks] = useState<ExpressionBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [currentSet, setCurrentSet] = useState<string[]>([]); // Resulting members from all blocks

  // Dialog State
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, message: '' });
  const [customMdxDialog, setCustomMdxDialog] = useState<{ isOpen: boolean; mdx: string; editBlockId: string | null }>({ isOpen: false, mdx: '', editBlockId: null });

  const maxLevel = useMemo(() => Math.max(...Object.values(mockElements).map(e => e.level)), []);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [applyContextFilters, setApplyContextFilters] = useState(false);

  // Reset filter toggle when menu opens
  useEffect(() => {
    if (contextMenu) {
      setApplyContextFilters(false);
    }
  }, [contextMenu]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Action Processor ---
  const hierarchicalSort = (ids: string[]) => {
    const idSet = new Set(ids);
    const ordered: string[] = [];
    const traverse = (id: string) => {
      if (idSet.has(id)) ordered.push(id);
      const el = mockElements[id];
      if (el && el.children) {
        const sortedChildren = [...el.children].sort((a, b) => {
           const nameA = mockElements[a].name.toLowerCase();
           const nameB = mockElements[b].name.toLowerCase();
           return nameA < nameB ? -1 : (nameA > nameB ? 1 : 0);
        });
        sortedChildren.forEach(traverse);
      }
    };
    const sortedRoots = [...rootElements].sort((a, b) => {
       const nameA = mockElements[a].name.toLowerCase();
       const nameB = mockElements[b].name.toLowerCase();
       return nameA < nameB ? -1 : (nameA > nameB ? 1 : 0);
    });
    sortedRoots.forEach(traverse);
    const reached = new Set(ordered);
    ids.forEach(id => { if (!reached.has(id)) ordered.push(id); });
    return ordered;
  };

  const handleApplyFilters = () => {
    let currentMembers = Object.keys(mockElements);
    let hasFilters = false;

    if (levelFilter !== 'all') {
      const lvl = Number(levelFilter);
      currentMembers = currentMembers.filter(id => mockElements[id].level === lvl);
      hasFilters = true;
    }
    if (ud1Filter) {
      currentMembers = currentMembers.filter(id => mockElements[id].attributes?.ud1 === ud1Filter);
      hasFilters = true;
    }
    if (ud2Filter) {
      currentMembers = currentMembers.filter(id => mockElements[id].attributes?.ud2 === ud2Filter);
      hasFilters = true;
    }
    if (wildcard) {
      const regex = new RegExp('^' + wildcard.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
      currentMembers = currentMembers.filter(id => regex.test(mockElements[id].name) || regex.test(id));
      hasFilters = true;
    }

    if (hasFilters) {
      setHighlightedMembers(new Set(currentMembers));
    } else {
      setHighlightedMembers(null);
    }
  };

  // Handlers
  const handleSubsetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setActiveSubsetId(id);
    const subset = subsets.find(s => s.id === id);
    if (subset) {
      // In a real app, we would parse the MDX to reconstruct blocks
      // For now, we just reset
      setExpressionBlocks([]);
      setCurrentSet([...subset.elements]);
    }
  };

  const toggleLeftSelect = (id: string, e: React.MouseEvent) => {
    const next = new Set(leftSelected);
    if (e.ctrlKey || e.metaKey) {
      if (next.has(id)) next.delete(id);
      else next.add(id);
    } else {
      next.clear();
      next.add(id);
    }
    setLeftSelected(next);
  };

  // --- Expression Block Logic ---
  const generateMdxFromBlock = (block: ExpressionBlock): string => {
    if (block.type === 'Except' && block.subBlocks && block.subBlocks.length === 2) {
      return `EXCEPT( ${block.subBlocks[0].mdx}, ${block.subBlocks[1].mdx} )`;
    }
    if (block.type === 'Intersect' && block.subBlocks && block.subBlocks.length === 2) {
      return `INTERSECT( ${block.subBlocks[0].mdx}, ${block.subBlocks[1].mdx} )`;
    }
    return block.mdx;
  };

  const applyFiltersToMdx = (baseMdx: string, baseDesc: string): { mdx: string, desc: string } => {
    let mdx = baseMdx;
    let desc = baseDesc;

    if (levelFilter !== 'all') {
      mdx = `TM1FILTERBYLEVEL( ${mdx}, ${levelFilter} )`;
      desc += ` (L${levelFilter})`;
    }
    if (ud1Filter) {
      mdx = `FILTER( ${mdx}, [Region].CurrentMember.Properties("ud1") = "${ud1Filter}" )`;
      desc += ` (UD1=${ud1Filter})`;
    }
    if (ud2Filter) {
      mdx = `FILTER( ${mdx}, [Region].CurrentMember.Properties("ud2") = "${ud2Filter}" )`;
      desc += ` (UD2=${ud2Filter})`;
    }
    if (wildcard) {
      mdx = `TM1FILTERBYPATTERN( ${mdx}, "${wildcard}" )`;
      desc += ` (Match "${wildcard}")`;
    }
    return { mdx, desc };
  };

  const addExpressionBlock = (type: ExpressionBlock['type'], targetId: string, withFilters: boolean = true) => {
    const targetName = targetId === '#root' ? 'All Members' : (mockElements[targetId]?.name || targetId);
    let mdx = '';
    let description = '';

    // Handle #root as global context
    const isRoot = targetId === '#root';
    const rootMdx = '{TM1SUBSETALL([Region])}';

    switch (type) {
      case 'Member':
        mdx = isRoot ? rootMdx : `[Region].[${targetId}]`;
        description = isRoot ? `All Members` : `Member: ${targetName}`;
        break;
      case 'Children':
        mdx = isRoot ? `${rootMdx}` : `[Region].[${targetId}].Children`; // Root doesn't really have children in this context, usually implies top level
        description = isRoot ? `All Members` : `Children of: ${targetName}`;
        break;
      case 'Descendants':
        mdx = isRoot ? `${rootMdx}` : `DESCENDANTS([Region].[${targetId}])`;
        description = isRoot ? `All Descendants` : `Descendants of: ${targetName}`;
        break;
      case 'Base':
        mdx = isRoot ? `TM1FILTERBYLEVEL(${rootMdx}, 0)` : `TM1FILTERBYLEVEL(DESCENDANTS([Region].[${targetId}]), 0)`;
        description = isRoot ? `All Leaf Nodes` : `Base (Leaf Nodes) of: ${targetName}`;
        break;
    }

    if (withFilters) {
      const filtered = applyFiltersToMdx(mdx, description);
      mdx = filtered.mdx;
      description = filtered.desc;
    }

    const newBlock: ExpressionBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      targetId,
      mdx,
      description
    };

    if (activeBlockId) {
      // Contextual Operation (Pruning / Intersection)
      // We are modifying the ACTIVE block by wrapping it
      setExpressionBlocks(prev => prev.map(block => {
        if (block.id === activeBlockId) {
           // If we are in "Edit Mode" for a block, adding a new block usually means
           // we want to UNION it, OR we want to Intersect/Except it.
           // BUT, the user request says "continue to operate on it".
           // Let's assume the default "Add" in context mode means UNION for now,
           // unless explicitly using the Minus/Intersect buttons.
           // However, the prompt implies "deduction" (Except).
           
           // Actually, if we are just "Adding" while a block is active, it might be ambiguous.
           // Let's stick to the Context Menu:
           // - Plus Icon -> Adds a NEW independent block (Union)
           // - Minus Icon -> Excludes from ACTIVE block (Except)
           
           // Wait, if I click "Add" on a member while Block A is active, 
           // do I want A + B (Union) or A inside B?
           // The user said: "选中右侧表达式得再点击编辑...在左侧继续对其操作"
           // This implies modifying the existing block.
           
           // Let's treat "Add" in context mode as UNIONing to the active block's definition?
           // Or just adding a new block to the list is enough for Union.
           
           // Let's keep "Add" as creating a new top-level block (Union),
           // and "Context Actions" (Minus/Intersect) for modifying.
           return block; 
        }
        return block;
      }));
      // If we just want to add a new block to the list, we don't need to map.
      setExpressionBlocks(prev => [...prev, newBlock]);
    } else {
      // Append new block (Union)
      setExpressionBlocks(prev => [...prev, newBlock]);
    }
    
    setContextMenu(null);
  };

  const handleContextOperation = (operation: 'Exclude' | 'Intersect', targetId: string, withFilters: boolean = true) => {
    if (!activeBlockId) return;
    
    const targetName = targetId === '#root' ? 'All Members' : (mockElements[targetId]?.name || targetId);
    const isRoot = targetId === '#root';
    const rootMdx = '{TM1SUBSETALL([Region])}';
    
    // Default to Base/Descendants based on what makes sense for "Exclude"
    // Usually we exclude a branch or a specific set of leaves.
    // Let's default to 'Descendants' for exclusion to be safe (exclude whole branch)
    let secondaryMdx = isRoot ? rootMdx : `DESCENDANTS([Region].[${targetId}])`;
    let secondaryDesc = isRoot ? `All Members` : `Descendants of ${targetName}`;
    
    if (withFilters) {
        const filtered = applyFiltersToMdx(secondaryMdx, secondaryDesc);
        secondaryMdx = filtered.mdx;
        secondaryDesc = filtered.desc;
    }
    
    const secondaryBlock: ExpressionBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'Descendants',
      targetId,
      mdx: secondaryMdx,
      description: secondaryDesc
    };

    setExpressionBlocks(prev => prev.map(block => {
      if (block.id === activeBlockId) {
        const opType = operation === 'Exclude' ? 'Except' : 'Intersect';
        const opMdx = operation === 'Exclude' ? 'EXCEPT' : 'INTERSECT';
        const opSymbol = operation === 'Exclude' ? '[-]' : '[&]';
        
        return {
          ...block,
          type: opType,
          subBlocks: [block, secondaryBlock], // Nesting: Current Block OP New Block
          mdx: `${opMdx}( ${block.mdx}, ${secondaryBlock.mdx} )`,
          description: `${block.description} ${opSymbol} ${secondaryDesc}`
        };
      }
      return block;
    }));
    setContextMenu(null);
  };

  const removeBlock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpressionBlocks(prev => prev.filter(b => b.id !== id));
    if (activeBlockId === id) setActiveBlockId(null);
  };

  // Update Resulting Set when blocks change
  useEffect(() => {
    // In a real app, we would send the combined MDX to the server to get the members.
    // Here we mock the result by just combining all 'targetId' members and their descendants.
    // This is a SIMPLIFICATION for the UI demo.
    
    if (expressionBlocks.length === 0) {
      setCurrentSet([]);
      return;
    }

    // Mock evaluation logic
    let resultSet = new Set<string>();
    
    expressionBlocks.forEach(block => {
      // Simple mock evaluation for the root blocks
      if (block.targetId) {
        const isRoot = block.targetId === '#root';
        const el = isRoot ? null : mockElements[block.targetId];
        
        if (!isRoot && !el) return;
        
        const addDescendants = (id: string, leavesOnly: boolean) => {
          const e = mockElements[id];
          if (!e) return;
          if (leavesOnly) {
             if (e.type !== 'Consolidated') resultSet.add(id);
          } else {
             resultSet.add(id);
          }
          if (e.children) e.children.forEach(c => addDescendants(c, leavesOnly));
        };

        if (block.type === 'Member') {
            if (isRoot) {
                rootElements.forEach(r => resultSet.add(r));
            } else {
                resultSet.add(block.targetId);
            }
        }
        else if (block.type === 'Children') {
            if (isRoot) {
                rootElements.forEach(r => resultSet.add(r));
            } else {
                el?.children?.forEach(c => resultSet.add(c));
            }
        }
        else if (block.type === 'Descendants') {
            if (isRoot) {
                rootElements.forEach(r => addDescendants(r, false));
            } else {
                addDescendants(block.targetId, false);
            }
        }
        else if (block.type === 'Base') {
            if (isRoot) {
                rootElements.forEach(r => addDescendants(r, true));
            } else {
                addDescendants(block.targetId, true);
            }
        }

        // Apply mock filtering based on the block's MDX string
        // This is a hacky way to make the demo UI reflect the filters
        if (block.mdx.includes('TM1FILTERBYPATTERN')) {
            const match = block.mdx.match(/TM1FILTERBYPATTERN\([^,]+,\s*"([^"]+)"\s*\)/);
            if (match && match[1]) {
                const pattern = match[1].replace(/\*/g, '').toLowerCase();
                const currentMembers = Array.from(resultSet);
                currentMembers.forEach(id => {
                    const memberName = mockElements[id]?.name.toLowerCase() || id.toLowerCase();
                    if (!memberName.includes(pattern)) {
                        resultSet.delete(id);
                    }
                });
            }
        }
        if (block.mdx.includes('TM1FILTERBYLEVEL')) {
            const match = block.mdx.match(/TM1FILTERBYLEVEL\([^,]+,\s*(\d+)\s*\)/);
            if (match && match[1]) {
                const level = parseInt(match[1], 10);
                const currentMembers = Array.from(resultSet);
                currentMembers.forEach(id => {
                    const memberLevel = mockElements[id]?.level;
                    if (memberLevel !== level) {
                        resultSet.delete(id);
                    }
                });
            }
        }
        if (block.mdx.includes('FILTER(')) {
            // Very basic mock for UD1/UD2 filters
            const ud1Match = block.mdx.match(/\[Region\]\.\[UD1\]\s*=\s*"([^"]+)"/);
            if (ud1Match && ud1Match[1]) {
                const val = ud1Match[1].toLowerCase();
                const currentMembers = Array.from(resultSet);
                currentMembers.forEach(id => {
                    // We don't have UD1 in mockElements, so we just mock it by removing everything
                    // In a real app, this would check the actual attribute
                    resultSet.delete(id); 
                });
            }
        }
        
        // Handle Except/Intersect logic roughly for demo (only 1 level deep)
        if (block.type === 'Except' && block.subBlocks) {
           // Remove members from the second block
           // (This mock logic is incomplete but sufficient to show the UI concept)
           const toRemove = block.subBlocks[1].targetId;
           if (toRemove) {
             // Mock: remove the specific target and its children
             if (resultSet.has(toRemove)) resultSet.delete(toRemove);
             // ... recursive remove ...
           }
        }
      }
    });

    setCurrentSet(Array.from(resultSet));
  }, [expressionBlocks]);

  const combinedMdx = useMemo(() => {
    if (expressionBlocks.length === 0) return '';
    if (expressionBlocks.length === 1) return `{ ${expressionBlocks[0].mdx} }`;
    const unionBody = expressionBlocks.map(b => b.mdx).join(', ');
    return `{ UNION( ${unionBody} ) }`;
  }, [expressionBlocks]);

  // --- Left Toolbar Actions ---
  const handleLeftReset = () => {
    setLevelFilter('all');
    setWildcard('');
    setUd1Filter('');
    setUd2Filter('');
    setLeftMembers(Object.keys(mockElements));
    setLeftMdx('{ TM1SUBSETALL( [Region] ) }');
    setLeftSelected(new Set());
    setLeftIsHierarchical(true);
    setHighlightedMembers(null);
    setFilterViewMode('highlight');
  };

  const handleLeftSortName = (dir: 'asc' | 'desc') => {
    const next = [...leftMembers].sort((a, b) => {
      const nameA = mockElements[a].name.toLowerCase();
      const nameB = mockElements[b].name.toLowerCase();
      return dir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
    setLeftMembers(next);
    setLeftMdx(`{ ORDER( ${leftMdx}, [Region].CurrentMember.Name, ${dir === 'asc' ? 'BASC' : 'BDESC'} ) }`);
    setLeftIsHierarchical(false);
  };

  const handleLeftSortHierarchy = () => {
    setLeftMembers(hierarchicalSort(leftMembers));
    setLeftMdx(`{ HIERARCHIZE( ${leftMdx} ) }`);
    setLeftIsHierarchical(true);
  };

  const handleLeftExpand = () => {
    if (leftSelected.size === 0) return;
    const nextExpand = [...leftMembers];
    [...leftSelected].forEach((id: string) => {
      const el = mockElements[id];
      if (el && el.children) {
        const idx = nextExpand.indexOf(id);
        if (idx !== -1) {
          const childrenToAdd = el.children.filter(c => !nextExpand.includes(c));
          nextExpand.splice(idx + 1, 0, ...childrenToAdd);
        }
      }
    });
    setLeftMembers(nextExpand);
    const expandMdx = '{ ' + [...leftSelected].map((id: string) => `[Region].[${id}]`).join(', ') + ' }';
    setLeftMdx(`{ DRILLDOWNMEMBER( ${leftMdx}, ${expandMdx} ) }`);
    setLeftIsHierarchical(true);
  };

  const handleLeftCollapse = () => {
    if (leftSelected.size === 0) return;
    const nextCollapse = [...leftMembers];
    [...leftSelected].forEach((id: string) => {
      const el = mockElements[id];
      if (el && el.children) {
        const descendants = new Set<string>();
        const getDescendants = (parentId: string) => {
          const p = mockElements[parentId];
          if (p && p.children) {
            p.children.forEach(c => { descendants.add(c); getDescendants(c); });
          }
        };
        getDescendants(id);
        for (let i = nextCollapse.length - 1; i >= 0; i--) {
          if (descendants.has(nextCollapse[i])) nextCollapse.splice(i, 1);
        }
      }
    });
    setLeftMembers(nextCollapse);
    const collapseMdx = '{ ' + [...leftSelected].map((id: string) => `[Region].[${id}]`).join(', ') + ' }';
    setLeftMdx(`{ DRILLUPMEMBER( ${leftMdx}, ${collapseMdx} ) }`);
    setLeftIsHierarchical(true);
  };

  // --- Move Left to Right ---
  // Removed middle controls logic

  // --- Right Pane Actions ---
  // Removed static conversion logic

  const handleSave = () => {
    const nextSubsets = subsets.map(s => 
      s.id === activeSubsetId ? { ...s, elements: currentSet, mdx: combinedMdx } : s
    );
    setSubsets(nextSubsets);
    alert('Subset saved successfully!');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <FolderTree className="text-blue-600" size={20} />
            <h1 className="text-lg font-semibold text-gray-800">Region</h1>
          </div>
          <div className="h-6 w-px bg-gray-300"></div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 font-medium">Subset:</span>
            <select 
              className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1.5 pl-3 pr-8 bg-gray-50"
              value={activeSubsetId}
              onChange={handleSubsetChange}
            >
              {subsets.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleSave}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Save size={16} />
            <span>Save</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-4 space-x-4 bg-gray-100">
        
        {/* Left Pane: Available Members & Toolbar */}
        <div className="flex flex-col flex-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden relative">
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Available Members</h2>
            <span className="text-xs text-gray-500">
              {highlightedMembers ? `${highlightedMembers.size} matches` : `${leftMembers.length} members`}
            </span>
          </div>
          
          {/* Left Toolbar */}
          <div className="p-3 border-b border-gray-100 flex flex-col gap-3 bg-gray-50">
            {/* Row 1: Filters */}
            <div className="flex items-center space-x-2 w-full">
              {/* Filter Level */}
              <select 
                className="h-8 text-xs border border-gray-300 rounded px-2 bg-white text-gray-700 outline-none focus:border-blue-500"
                value={levelFilter}
                onChange={e => setLevelFilter(e.target.value)}
                title="Filter by Level"
              >
                <option value="all">Level...</option>
                {Array.from({ length: maxLevel + 1 }).map((_, i) => (
                  <option key={i} value={i}>Level {i}</option>
                ))}
              </select>

              {/* Filter UD1 */}
              <div className="flex items-center border border-gray-300 rounded bg-white h-8 overflow-hidden">
                <span className="px-2 text-[10px] font-medium text-gray-500 bg-gray-100 border-r border-gray-300 h-full flex items-center">UD1</span>
                <input 
                  type="text" placeholder="Value" className="w-16 px-2 text-xs outline-none h-full"
                  value={ud1Filter} onChange={e => setUd1Filter(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
                />
              </div>

              {/* Filter UD2 */}
              <div className="flex items-center border border-gray-300 rounded bg-white h-8 overflow-hidden">
                <span className="px-2 text-[10px] font-medium text-gray-500 bg-gray-100 border-r border-gray-300 h-full flex items-center">UD2</span>
                <input 
                  type="text" placeholder="Value" className="w-16 px-2 text-xs outline-none h-full"
                  value={ud2Filter} onChange={e => setUd2Filter(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
                />
              </div>

              {/* Wildcard */}
              <div className="flex items-center border border-gray-300 rounded bg-white h-8 overflow-hidden flex-1">
                <span className="px-2 text-gray-400 bg-gray-100 border-r border-gray-300 h-full flex items-center"><Search size={12} /></span>
                <input 
                  type="text" placeholder="Wildcard (*)" className="w-full px-2 text-xs outline-none h-full"
                  value={wildcard} onChange={e => setWildcard(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
                />
              </div>
            </div>

            {/* Row 2: View/Sort & Actions */}
            <div className="flex items-center justify-between">
              {/* Left: View & Sort */}
              <div className="flex items-center border border-gray-300 rounded overflow-hidden bg-white h-8">
                <button onClick={handleLeftExpand} disabled={leftSelected.size === 0} className="px-2 h-full flex items-center text-gray-600 hover:bg-gray-100 disabled:opacity-30" title="Expand (Drill-down)"><ChevronDown size={14} /></button>
                <div className="w-px h-4 bg-gray-300"></div>
                <button onClick={handleLeftCollapse} disabled={leftSelected.size === 0} className="px-2 h-full flex items-center text-gray-600 hover:bg-gray-100 disabled:opacity-30" title="Collapse (Roll-up)"><ChevronUp size={14} /></button>
                <div className="w-px h-4 bg-gray-300"></div>
                <button onClick={() => handleLeftSortName('asc')} className="px-2 h-full flex items-center text-gray-600 hover:bg-gray-100" title="Sort A-Z"><ArrowDownAZ size={14} /></button>
                <div className="w-px h-4 bg-gray-300"></div>
                <button onClick={() => handleLeftSortName('desc')} className="px-2 h-full flex items-center text-gray-600 hover:bg-gray-100" title="Sort Z-A"><ArrowUpZA size={14} /></button>
                <div className="w-px h-4 bg-gray-300"></div>
                <button onClick={handleLeftSortHierarchy} className="px-2 h-full flex items-center text-gray-600 hover:bg-gray-100" title="Sort Hierarchy"><ListTree size={14} /></button>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handleApplyFilters}
                  className="h-8 px-4 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors shadow-sm flex items-center space-x-1"
                >
                  <Search size={14} />
                  <span>查询</span>
                </button>
                {highlightedMembers && (
                  <button
                    onClick={() => setFilterViewMode(prev => prev === 'highlight' ? 'flat' : 'highlight')}
                    className={cn(
                      "h-8 px-3 text-xs font-medium rounded transition-colors shadow-sm flex items-center space-x-1 border",
                      filterViewMode === 'flat' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    )}
                    title={filterViewMode === 'flat' ? "Show in Tree (Highlight)" : "Show Flat List (Hide Unmatched)"}
                  >
                    {filterViewMode === 'flat' ? <ListTree size={14} /> : <ListChecks size={14} />}
                    <span>{filterViewMode === 'flat' ? '树形视图' : '平铺视图'}</span>
                  </button>
                )}
                <button 
                  onClick={handleLeftReset}
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition-colors shadow-sm flex items-center space-x-1"
                  title="Reset to All Members"
                >
                  <RotateCcw size={14} />
                  <span>重置</span>
                </button>
              </div>
            </div>
          </div>

            <div className="flex-1 flex overflow-hidden">
            {/* Members List */}
            <div className="flex-1 overflow-y-auto p-1">
              {/* #root Element for Global Operations */}
              {(!highlightedMembers || filterViewMode === 'highlight') && (
                <div 
                  className={cn(
                    "flex items-center py-1.5 px-3 cursor-pointer text-sm select-none border-b border-gray-50 group relative bg-gray-50 font-semibold text-gray-800",
                  )}
                  onMouseEnter={() => setHoveredLeftId('#root')}
                  onMouseLeave={() => setHoveredLeftId(null)}
                >
                  <div className="mr-2">
                    <FolderTree size={14} className="text-purple-600" />
                  </div>
                  <span className="truncate">#root (Global)</span>
                  
                  {/* Hover FX Icon for Root */}
                  {hoveredLeftId === '#root' && (
                    <button
                      className="absolute right-12 top-1/2 transform -translate-y-1/2 p-1 bg-white border border-gray-200 rounded shadow-sm text-blue-600 hover:bg-blue-50 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({ x: e.clientX, y: e.clientY, targetId: '#root' });
                      }}
                    >
                      {activeBlockId ? <Minus size={14} /> : <Plus size={14} />}
                    </button>
                  )}
                </div>
              )}

              {(() => {
                const displayMembers = (highlightedMembers && filterViewMode === 'flat')
                  ? leftMembers.filter(id => highlightedMembers.has(id))
                  : leftMembers;
                  
                return displayMembers.map(id => {
                  const el = mockElements[id];
                  const isSelected = leftSelected.has(id);
                  const isHighlighted = highlightedMembers && filterViewMode === 'highlight' ? highlightedMembers.has(id) : false;
                  const isDimmed = highlightedMembers && filterViewMode === 'highlight' ? !highlightedMembers.has(id) : false;
                  // Calculate indentation if hierarchical view is active
                  const isFlat = highlightedMembers && filterViewMode === 'flat';
                  const indent = (leftIsHierarchical && !isFlat) && el ? (maxLevel - el.level) * 16 : 0;
                  
                  return (
                    <div 
                      key={id}
                      className={cn(
                        "flex items-center py-1.5 px-3 cursor-pointer text-sm select-none border-b border-gray-50 last:border-0 group relative transition-colors",
                        isSelected ? "bg-blue-100 text-blue-900" : "hover:bg-gray-100 text-gray-700",
                        isHighlighted && !isSelected && "bg-yellow-50 text-yellow-900 font-medium",
                        isDimmed && !isSelected && "opacity-40"
                      )}
                      style={{ paddingLeft: `${indent + 12}px` }}
                      onClick={(e) => toggleLeftSelect(id, e)}
                      onMouseEnter={() => setHoveredLeftId(id)}
                      onMouseLeave={() => setHoveredLeftId(null)}
                    >
                    <div className="mr-2">
                      <ElementIcon type={el?.type || 'Numeric'} />
                    </div>
                    <span className="truncate">{el?.name || id}</span>
                    <span className="ml-auto text-xs text-gray-400">L{el?.level}</span>

                    {/* Hover FX Icon */}
                    {hoveredLeftId === id && (
                      <button
                        className="absolute right-12 top-1/2 transform -translate-y-1/2 p-1 bg-white border border-gray-200 rounded shadow-sm text-blue-600 hover:bg-blue-50 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu({ x: e.clientX, y: e.clientY, targetId: id });
                        }}
                      >
                        {activeBlockId ? <Minus size={14} /> : <Plus size={14} />}
                      </button>
                    )}
                  </div>
                );
              })})()}
            </div>
          </div>
          
          {/* Context Menu */}
          {contextMenu && (
            <div 
              ref={contextMenuRef}
              className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 w-64"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50 flex justify-between items-center">
                <span>{activeBlockId ? 'Edit Block (Prune)' : 'Add Block'}</span>
              </div>
              
              {/* Helper to check if filters are active */}
              {(() => {
                const hasFilters = levelFilter !== 'all' || ud1Filter || ud2Filter || wildcard;
                const filterLabel = [
                  levelFilter !== 'all' ? `L${levelFilter}` : '',
                  ud1Filter ? `UD1` : '',
                  ud2Filter ? `UD2` : '',
                  wildcard ? `"${wildcard}"` : ''
                ].filter(Boolean).join(', ');

                return (
                  <>
                    {/* Filter Toggle Switch */}
                    {hasFilters && (
                      <div className="px-3 py-2 border-b border-gray-100 bg-blue-50 flex items-center justify-between">
                        <div className="flex items-center text-blue-700">
                          <Filter size={12} className="mr-1.5" />
                          <span className="text-[10px] font-medium">Apply Filters</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={applyContextFilters}
                            onChange={(e) => setApplyContextFilters(e.target.checked)}
                          />
                          <div className="w-7 h-4 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    )}
                    
                    {hasFilters && applyContextFilters && (
                       <div className="px-3 py-1 text-[10px] text-blue-600 bg-blue-50 border-b border-blue-100 truncate">
                         Using: {filterLabel}
                       </div>
                    )}

                    {activeBlockId ? (
                      <>
                        <div className="px-3 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Modify Active Block</div>
                        
                        <button onClick={() => handleContextOperation('Exclude', contextMenu.targetId, applyContextFilters)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 flex items-center group">
                          <div className="p-1 bg-red-100 text-red-600 rounded mr-2 group-hover:bg-red-200"><Minus size={14} /></div>
                          <span>Exclude {applyContextFilters ? '(Filtered)' : ''}</span>
                        </button>
                        <button onClick={() => handleContextOperation('Intersect', contextMenu.targetId, applyContextFilters)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center group">
                          <div className="p-1 bg-blue-100 text-blue-600 rounded mr-2 group-hover:bg-blue-200"><Combine size={14} /></div>
                          <span>Intersect {applyContextFilters ? '(Filtered)' : ''}</span>
                        </button>

                        <div className="border-t border-gray-100 my-1"></div>
                        <button onClick={() => addExpressionBlock('Member', contextMenu.targetId, applyContextFilters)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 flex items-center group">
                          <div className="p-1 bg-green-100 text-green-600 rounded mr-2 group-hover:bg-green-200"><Plus size={14} /></div>
                          <span>Add New Block (Union)</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => addExpressionBlock('Member', contextMenu.targetId, applyContextFilters)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center group">
                          <div className="p-1 bg-blue-100 text-blue-600 rounded mr-2 group-hover:bg-blue-200"><Hash size={14} /></div>
                          <span>Member {applyContextFilters ? '(Filtered)' : ''}</span>
                        </button>
                        <button onClick={() => addExpressionBlock('Children', contextMenu.targetId, applyContextFilters)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center group">
                          <div className="p-1 bg-blue-100 text-blue-600 rounded mr-2 group-hover:bg-blue-200"><ChevronDown size={14} /></div>
                          <span>Children {applyContextFilters ? '(Filtered)' : ''}</span>
                        </button>
                        <button onClick={() => addExpressionBlock('Descendants', contextMenu.targetId, applyContextFilters)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center group">
                          <div className="p-1 bg-blue-100 text-blue-600 rounded mr-2 group-hover:bg-blue-200"><ListTree size={14} /></div>
                          <span>Descendants {applyContextFilters ? '(Filtered)' : ''}</span>
                        </button>
                        <button onClick={() => addExpressionBlock('Base', contextMenu.targetId, applyContextFilters)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center group">
                          <div className="p-1 bg-blue-100 text-blue-600 rounded mr-2 group-hover:bg-blue-200"><ListChecks size={14} /></div>
                          <span>Base {applyContextFilters ? '(Filtered)' : ''}</span>
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Right Pane: Expression Blocks & Result */}
        <div className="flex flex-col flex-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Current Set (Union of Blocks)</h2>
            <span className="text-xs text-gray-500">{currentSet.length} members</span>
          </div>
          
          {/* Top: Member Preview */}
          <div className="flex-1 overflow-y-auto p-1 border-b border-gray-200 min-h-[200px]">
            {currentSet.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
                <FolderTree size={32} className="opacity-20" />
                <p className="text-sm">Set is empty. Add blocks from left.</p>
              </div>
            ) : (
              currentSet.map((id, index) => {
                const el = mockElements[id];
                return (
                  <div 
                    key={`${id}-${index}`}
                    className="flex items-center py-1.5 px-3 text-sm select-none border-b border-gray-50 last:border-0 text-gray-700"
                  >
                    <div className="w-6 text-xs text-gray-400 text-right mr-3 font-mono flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="mr-2 flex-shrink-0">
                      <ElementIcon type={el?.type || 'Numeric'} />
                    </div>
                    <span className="truncate">{el?.name || id}</span>
                    <span className="ml-auto text-xs text-gray-400 flex-shrink-0">L{el?.level}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom: Expression Blocks List */}
          <div className="h-1/3 bg-gray-50 border-t border-gray-200 flex flex-col">
            <div className="px-3 py-1.5 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-100 flex justify-between items-center">
              <span>Expression Blocks (Union)</span>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-gray-400">Select block to edit/prune</span>
                <button 
                  onClick={() => {
                    setCustomMdxDialog({ isOpen: true, mdx: '', editBlockId: null });
                  }}
                  className="p-1 bg-white border border-gray-300 rounded shadow-sm text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  title="Add Custom Expression"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {expressionBlocks.map((block, idx) => (
                <div 
                  key={block.id}
                  onClick={() => setActiveBlockId(activeBlockId === block.id ? null : block.id)}
                  className={cn(
                    "p-2 rounded border text-sm cursor-pointer transition-all relative group",
                    activeBlockId === block.id 
                      ? "bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-200" 
                      : "bg-white border-gray-200 hover:border-blue-200"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span className={cn(
                        "text-[10px] font-mono px-1.5 rounded",
                        activeBlockId === block.id ? "bg-blue-200 text-blue-800" : "bg-gray-200 text-gray-600"
                      )}>{idx + 1}</span>
                      <span className="font-medium text-gray-800">{block.description}</span>
                      {activeBlockId === block.id && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded animate-pulse">Editing...</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setCustomMdxDialog({ isOpen: true, mdx: block.mdx, editBlockId: block.id });
                        }}
                        className="p-1 rounded transition-colors text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        title="Edit MDX"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        onClick={(e) => removeBlock(block.id, e)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Remove Block"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 truncate pl-6">
                    {block.mdx}
                  </div>
                </div>
              ))}
              {expressionBlocks.length === 0 && (
                <div className="text-center text-xs text-gray-400 italic mt-4">
                  No expression blocks. Hover over left items to add.
                </div>
              )}
            </div>
            
            {/* Final MDX Preview */}
            <div className="p-2 bg-gray-800 text-green-400 font-mono text-[10px] border-t border-gray-700 whitespace-nowrap overflow-x-auto">
              {combinedMdx || '// Empty Set'}
            </div>
          </div>
        </div>
      </main>

      {/* Custom Alert Dialog */}
      {alertDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl p-5 w-80 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-800 mb-2">提示</h3>
            <p className="text-sm text-gray-600 mb-5">{alertDialog.message}</p>
            <div className="flex justify-end">
              <button 
                onClick={() => setAlertDialog({ isOpen: false, message: '' })}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom MDX Dialog */}
      {customMdxDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl p-5 w-[500px] border border-gray-200 flex flex-col">
            <h3 className="text-base font-semibold text-gray-800 mb-4">
              {customMdxDialog.editBlockId ? 'Edit MDX Expression' : 'Add Custom MDX'}
            </h3>
            <textarea 
              className="w-full h-32 p-3 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none mb-4"
              placeholder="Enter MDX expression here..."
              value={customMdxDialog.mdx}
              onChange={(e) => setCustomMdxDialog(prev => ({ ...prev, mdx: e.target.value }))}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setCustomMdxDialog({ isOpen: false, mdx: '', editBlockId: null })}
                className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  if (customMdxDialog.mdx.trim()) {
                    if (customMdxDialog.editBlockId) {
                      setExpressionBlocks(prev => prev.map(b => 
                        b.id === customMdxDialog.editBlockId 
                          ? { ...b, mdx: customMdxDialog.mdx, description: 'Custom Expression (Edited)' } 
                          : b
                      ));
                    } else {
                      setExpressionBlocks(prev => [...prev, {
                        id: Math.random().toString(36).substr(2, 9),
                        type: 'Member',
                        targetId: '',
                        mdx: customMdxDialog.mdx,
                        description: 'Custom Expression'
                      }]);
                    }
                  }
                  setCustomMdxDialog({ isOpen: false, mdx: '', editBlockId: null });
                }}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
