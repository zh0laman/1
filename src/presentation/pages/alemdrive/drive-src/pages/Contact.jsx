import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, User, Mail, Search, Copy, X } from 'lucide-react';
import { getHierarchyTree } from '../api/hierarchy';
import { useToast } from '../components/Toast';

// Рекурсивная фильтрация дерева по поисковому запросу
function filterTree(nodes, query) {
    if (!nodes || !Array.isArray(nodes) || !query?.trim()) return nodes;
    const q = query.trim().toLowerCase();

    const matches = (node) => {
        if (!node) return false;
        if (node.name?.toLowerCase().includes(q)) return true;
        if (node.leader?.full_name?.toLowerCase().includes(q)) return true;
        if (node.leader?.email?.toLowerCase().includes(q)) return true;
        if (node.full_name?.toLowerCase().includes(q)) return true;
        if (node.email?.toLowerCase().includes(q)) return true;
        return (node.users || []).some(u => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    };

    const filterNode = (node) => {
        if (!node) return null;
        const passed = matches(node);
        const filteredChildren = (node.children || []).map(filterNode).filter(Boolean);
        const filteredUsers = (node.users || []).filter(u => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
        const hasMatchingChildren = filteredChildren.length > 0 || (passed ? (node.users || []).length > 0 : filteredUsers.length > 0);
        if (passed || hasMatchingChildren) {
            return {
                ...node,
                children: passed ? (node.children || []).map(filterNode).filter(Boolean) : filteredChildren,
                users: passed ? (node.users || []) : filteredUsers
            };
        }
        return null;
    };

    return nodes.map(filterNode).filter(Boolean);
}

// TreeNode component handles the rendering of a single node and its children in a tree structure
const TreeNode = ({ node, level = 0, onCopyEmail, onCardClick }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    // Treat users as children for visualization if they exist
    const subOrgs = node.children || [];
    const staff = node.users || [];
    const hasChildren = subOrgs.length > 0 || staff.length > 0;

    // Type styles
    // ... (keep styles) ...
    const styles = {
        prime_minister: "border-t-4 border-blue-600 bg-blue-50/50 shadow-blue-100",
        deputy_prime_minister: "border-t-4 border-indigo-500 bg-indigo-50/50 shadow-indigo-100",
        ministry: "border-t-4 border-purple-500 bg-purple-50/50 shadow-purple-100",
        state_body: "border-t-4 border-gray-400 bg-gray-50/50 shadow-gray-100",
        user: "border-t-4 border-green-500 bg-green-50/50 shadow-green-100",
        default: "border-t-4 border-gray-200 bg-white"
    };

    const cardStyle = styles[node.type] || styles.default;

    return (
        <div className="flex flex-col items-center">
            {/* The Node Card */}
            <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onCardClick?.(node)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onCardClick?.(node)}
                className={`
                    relative z-10 flex flex-col items-center justify-between p-2 rounded-lg shadow-md bg-white border border-gray-100 w-[220px] h-[200px] transition-all hover:shadow-lg hover:ring-2 hover:ring-indigo-200 overflow-hidden shrink-0 cursor-pointer
                    ${cardStyle}
                `}
            >
                {/* Expand/Collapse Toggle */}
                {hasChildren && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm text-gray-400 hover:text-blue-600 z-20"
                    >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                )}

                <div className="flex-1 flex flex-col items-center justify-center w-full">
                    <h3
                        className="font-bold text-gray-900 text-center text-xs mb-0.5 leading-tight min-h-[2rem] w-full break-words overflow-hidden"
                        style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}
                    >
                        {node.name}
                    </h3>
                    {node.type !== 'user' && (
                        <span className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-wider">
                            {node.type?.replace(/_/g, ' ')}
                        </span>
                    )}
                </div>

                {node.leader && (
                    <div className="flex items-center gap-1.5 w-full bg-white/60 p-1 rounded-lg border border-gray-50 mt-auto">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0 flex items-center justify-center text-gray-500 font-bold overflow-hidden border border-white shadow-sm">
                            {node.leader.avatar_url ? (
                                <img src={node.leader.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                node.leader.first_name?.[0] || <User size={12} />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-gray-800 break-words line-clamp-2">{node.leader.full_name}</p>
                            {node.leader.email && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onCopyEmail?.(node.leader.email); }}
                                    className="text-[9px] text-gray-500 truncate w-full text-left hover:text-indigo-600 hover:underline flex items-center gap-1"
                                    title="Клик для копирования"
                                >
                                    <Mail size={10} className="flex-shrink-0" />
                                    {node.leader.email}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Show users count if any (optional detail) */}
                {node.users && node.users.length > 0 && (
                    <div className="mt-2 w-full pt-2 border-t border-gray-100/50">
                        <div className="flex -space-x-2 justify-center">
                            {node.users.slice(0, 4).map((u, i) => (
                                <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-gray-100 text-[8px] flex items-center justify-center overflow-hidden" title={u.full_name}>
                                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : u.first_name?.[0]}
                                </div>
                            ))}
                            {node.users.length > 4 && (
                                <div className="w-5 h-5 rounded-full border-2 border-white bg-gray-50 text-[8px] flex items-center justify-center text-gray-400">
                                    +{node.users.length - 4}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </motion.div>

            <AnimatePresence>
                {isExpanded && hasChildren && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col items-center"
                    >
                        {/* Vertical line from parent down */}
                        <div className="w-px h-8 bg-gray-300"></div>

                        {/* Rendering Logic */}
                        {node.type === 'prime_minister' ? (
                            <div className="flex flex-col items-center gap-10 w-full">
                                {/* Group 1: Deputies (макс. 6 в ряд) */}
                                {subOrgs.some(c => c.type === 'deputy_prime_minister') && (
                                    <div className="relative flex flex-wrap justify-center gap-x-12 gap-y-10 w-full max-w-[1400px]">
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-px h-8 bg-gray-300" />

                                        {subOrgs.filter(c => c.type === 'deputy_prime_minister').map((child) => (
                                            <div key={child.id} className="relative flex flex-col items-center p-3 shrink-0">
                                                <div className="w-px h-4 bg-gray-300 absolute -top-4" />
                                                <TreeNode node={child} level={level + 1} onCopyEmail={onCopyEmail} onCardClick={onCardClick} />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Group 2: Ministries (Grid) */}
                                {subOrgs.some(c => c.type !== 'deputy_prime_minister') && (
                                    <div className="relative pt-10 border-t border-gray-200 mt-6 w-full flex justify-center">
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 bg-gray-100 text-xs text-gray-500 rounded-full border border-gray-200 z-10">
                                            Министерства
                                        </div>
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-px h-8 bg-gray-300"></div>

                                        <div className="flex flex-wrap justify-center gap-x-12 gap-y-10 w-full max-w-[1400px]">
                                            {subOrgs.filter(c => c.type !== 'deputy_prime_minister').map((child) => (
                                                <div key={child.id} className="p-3 shrink-0">
                                                    <TreeNode node={child} level={level + 1} onCopyEmail={onCopyEmail} onCardClick={onCardClick} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Stacking Staff and Sub-Orgs Vertically */
                            <div className="flex flex-col items-center gap-10 w-full">

                                {/* 1. Staff Group (Grid/Row) */}
                                {staff.length > 0 && (
                                    <div className="relative flex flex-col items-center">
                                        {/* Connector from Parent */}
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-px h-8 bg-gray-300" />

                                        {/* Staff Container (макс. 6 в ряд) */}
                                        <div className="flex flex-wrap justify-center gap-x-12 gap-y-10 w-full max-w-[1400px] relative pt-4">
                                            {staff.map((u, idx) => {
                                                // Create a transient node object for the staff member
                                                const staffNode = { ...u, id: `user-${u.id || Math.random()}`, type: 'user', name: u.full_name, leader: u };
                                                return (
                                                    <div key={staffNode.id} className="relative flex flex-col items-center p-3 shrink-0">
                                                        {/* Line Up */}
                                                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-px h-12 bg-gray-300" />

                                                        {/* Horizontal connectors logic... simplified:
                                                             It's hard to draw the perfect tree line for a wrapped grid. 
                                                             Let's just show them dropping down from the parent point.
                                                         */}
                                                        {/* If single row, we can do the horizontal bar. */}
                                                        {/* Let's try to just render them nicely without complex tree lines for adjacent staff, 
                                                             but connected to parent.
                                                         */}

                                                        <TreeNode node={staffNode} level={level + 1} onCopyEmail={onCopyEmail} onCardClick={onCardClick} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* 2. Sub-Orgs Group (Tree Row) */}
                                {subOrgs.length > 0 && (
                                    <div className="relative flex flex-col items-center">
                                        {/* Connector from Parent (or from Staff layer) */}
                                        {/* If we have staff, we need a line passing THROUGH or AROUND them? 
                                            Or just a line down from the parent's center, skipping the staff gap?
                                            Visual: Parent -> | -> Staff -> | -> SubOrgs
                                        */}
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-px h-8 bg-gray-300" />

                                        <div className="flex flex-wrap justify-center gap-x-12 gap-y-10 w-full max-w-[1400px] relative pt-4">
                                            {subOrgs.map((child, idx) => (
                                                <div key={`${child.type}-${child.id}-${idx}`} className="flex flex-col items-center relative p-3 shrink-0">
                                                    <div className="absolute -top-4 left-1/2 w-px h-4 bg-gray-300 transform -translate-x-1/2" />
                                                    <TreeNode node={child} level={level + 1} onCopyEmail={onCopyEmail} onCardClick={onCardClick} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Custom hook for drag scrolling (mouse + touch via Pointer Events)
const useDragScroll = () => {
    const [node, setNode] = useState(null);
    const setRef = React.useCallback((el) => setNode(el), []);

    useEffect(() => {
        if (!node) return;

        let isDown = false;
        let startX;
        let startY;
        let scrollLeft;
        let scrollTop;

        const beginDrag = (pageX, pageY) => {
            isDown = true;
            startX = pageX;
            startY = pageY;
            scrollLeft = node.scrollLeft;
            scrollTop = node.scrollTop;
            node.style.cursor = 'grabbing';
        };

        const moveDrag = (pageX, pageY) => {
            if (!isDown) return;
            const walkX = pageX - startX;
            const walkY = pageY - startY;
            node.scrollLeft = scrollLeft - walkX;
            node.scrollTop = scrollTop - walkY;
        };

        const endDrag = () => {
            isDown = false;
            node.style.cursor = 'grab';
        };

        const handlePointerDown = (e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            if (e.target.closest('button')) return;
            e.preventDefault();
            e.stopPropagation();
            node.setPointerCapture?.(e.pointerId);
            beginDrag(e.pageX, e.pageY);
        };

        const handlePointerMove = (e) => {
            if (!isDown) return;
            e.preventDefault();
            moveDrag(e.pageX, e.pageY);
        };

        const handlePointerUp = (e) => {
            node.releasePointerCapture?.(e.pointerId);
            if (isDown) endDrag();
        };

        const handlePointerCancel = () => {
            if (isDown) endDrag();
        };

        node.addEventListener('pointerdown', handlePointerDown, { capture: true });
        node.addEventListener('pointermove', handlePointerMove, { capture: true });
        node.addEventListener('pointerup', handlePointerUp, { capture: true });
        node.addEventListener('pointerleave', handlePointerUp);
        node.addEventListener('pointercancel', handlePointerCancel);
        node.style.cursor = 'grab';
        node.style.touchAction = 'none';

        return () => {
            node.removeEventListener('pointerdown', handlePointerDown, { capture: true });
            node.removeEventListener('pointermove', handlePointerMove, { capture: true });
            node.removeEventListener('pointerup', handlePointerUp, { capture: true });
            node.removeEventListener('pointerleave', handlePointerUp);
            node.removeEventListener('pointercancel', handlePointerCancel);
        };
    }, [node]);

    return [setRef, node];
};

// Модалка с деталями карточки
const ContactCardModal = ({ node, onClose, onCopyEmail }) => {
    if (!node) return null;
    const email = node.leader?.email || node.email;
    const name = node.leader?.full_name || node.full_name || node.name;
    const handleCopy = () => { if (email) { onCopyEmail?.(email); } };

    return (
        <motion.div
            key={node?.id || 'modal'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            >
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-lg font-bold text-gray-900">{node.name || name}</h2>
                    <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                        <X size={20} />
                    </button>
                </div>
                {node.type && node.type !== 'user' && (
                    <p className="text-xs uppercase text-gray-400 mb-3">{node.type.replace(/_/g, ' ')}</p>
                )}
                {name && (
                    <p className="text-gray-800 font-medium mb-1">{name}</p>
                )}
                {email && (
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-2 text-indigo-600 hover:underline text-sm"
                    >
                        <Mail size={16} />
                        {email}
                        <Copy size={14} />
                    </button>
                )}
                {(node.users?.length > 0 || node.children?.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">
                            {node.users?.length || 0} сотрудников
                            {node.children?.length > 0 && ` • ${node.children.length} подразделений`}
                        </p>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
};

function countPeopleInTree(nodes) {
    if (!nodes || !Array.isArray(nodes)) return 0;
    let count = 0;
    const visit = (n) => {
        if (!n) return;
        if (n.type === 'user') {
            count += 1;
            return;
        }
        if (n.leader) count += 1;
        count += (n.users || []).length;
        (n.children || []).forEach(visit);
    };
    nodes.forEach(visit);
    return count;
}

const Contact = () => {
    const [treeData, setTreeData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [scale, setScale] = useState(1);
    const [search, setSearch] = useState('');
    const [selectedNode, setSelectedNode] = useState(null);
    const { addToast } = useToast();
    const [dragRef, scrollNode] = useDragScroll();

    const filteredTree = useMemo(() => filterTree(treeData || [], search), [treeData, search]);

    const handleCopyEmail = (email) => {
        if (!email) return;
        navigator.clipboard.writeText(email).then(() => {
            addToast('Email скопирован', 'success');
        }).catch(() => addToast('Не удалось скопировать', 'error'));
    };

    const handleCardClick = (node) => setSelectedNode(node);

    useEffect(() => {
        fetchData();
    }, []);

    const PADDING_H = 600;
    const PADDING_V = 400;
    const totalPeople = treeData ? countPeopleInTree(treeData) : 0;

    useEffect(() => {
        if (scrollNode && treeData && !loading) {
            requestAnimationFrame(() => {
                scrollNode.scrollLeft = PADDING_H;
                scrollNode.scrollTop = PADDING_V;
            });
        }
    }, [scrollNode, treeData, loading, scale]);

    // Zoom колесом мыши (Ctrl/Cmd + колесо)
    useEffect(() => {
        if (!scrollNode) return;
        const handleWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                setScale(s => e.deltaY < 0 ? Math.min(s + 0.1, 2) : Math.max(s - 0.1, 0.5));
            }
        };
        scrollNode.addEventListener('wheel', handleWheel, { passive: false });
        return () => scrollNode.removeEventListener('wheel', handleWheel);
    }, [scrollNode]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getHierarchyTree();

            // Restructure data: Move all Ministries under Prime Minister if needed
            let roots = data.tree;
            if (Array.isArray(roots)) {
                const pmNodeIndex = roots.findIndex(n => n.type === 'prime_minister');

                if (pmNodeIndex !== -1) {
                    const pmNode = { ...roots[pmNodeIndex] };
                    // Collect all other nodes that are not the PM
                    const otherNodes = roots.filter((_, idx) => idx !== pmNodeIndex);

                    // Add them to PM's children (or creates a "Ministries" sub-group if cleaner)
                    // Currently adding directly to children to ensure "below" visual
                    if (!pmNode.children) pmNode.children = [];
                    pmNode.children = [...pmNode.children, ...otherNodes];

                    // Set single root
                    setTreeData([pmNode]);
                } else {
                    setTreeData(roots);
                }
            } else {
                setTreeData([data.tree]);
            }

        } catch (error) {
            console.error("Failed to fetch hierarchy", error);
            addToast("Не удалось загрузить структуру", 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
    const handleReset = () => setScale(1);

    const handleFitToView = () => {
        if (!scrollNode) return;
        requestAnimationFrame(() => {
            const viewW = scrollNode.clientWidth;
            const viewH = scrollNode.clientHeight;
            const scrollW = scrollNode.scrollWidth;
            const scrollH = scrollNode.scrollHeight;
            const contentW = Math.max(1, scrollW - 2 * PADDING_H);
            const contentH = Math.max(1, scrollH - 2 * PADDING_V);
            const fitScale = Math.min(viewW / contentW, viewH / contentH);
            setScale(Math.max(0.5, Math.min(1, fitScale * 0.95)));
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!treeData) return <div className="p-8 text-center text-gray-500">Нет данных</div>;

    const displayTree = filteredTree;

    return (
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 shadow-sm z-50 flex flex-wrap items-center gap-3 sm:gap-4 flex-shrink-0">
                <div className="min-w-0">
                    <h1 className="text-lg sm:text-xl font-bold text-gray-900">Alem Contact</h1>
                    <p className="text-xs sm:text-sm text-gray-500">
                        Иерархическая структура правительства
                        {totalPeople > 0 && (
                            <span className="ml-2 font-medium text-indigo-600">
                                • Всего: {totalPeople}{' '}
                                {(() => {
                                    const n = totalPeople % 100;
                                    const d = totalPeople % 10;
                                    if (n >= 11 && n <= 14) return 'человек';
                                    if (d === 1) return 'человек';
                                    if (d >= 2 && d <= 4) return 'человека';
                                    return 'человек';
                                })()}
                            </span>
                        )}
                    </p>
                </div>

                {/* Search */}
                <div className="flex-1 min-w-[200px] max-w-xs">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Поиск по имени или email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg shrink-0" title="Ctrl+колесо мыши — масштаб">
                    <button type="button" onClick={handleZoomOut} className="p-1 px-3 hover:bg-white rounded shadow-sm text-gray-600">-</button>
                    <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button type="button" onClick={handleZoomIn} className="p-1 px-3 hover:bg-white rounded shadow-sm text-gray-600">+</button>
                    <button type="button" onClick={handleReset} className="p-1 px-3 hover:bg-white rounded shadow-sm text-gray-600 ml-1 text-xs">Reset</button>
                    <button type="button" onClick={handleFitToView} className="p-1 px-3 hover:bg-white rounded shadow-sm text-gray-600 ml-1 text-xs" title="Вписать всю схему в экран (масштаб подберётся автоматически)">
                        Вписать в экран
                    </button>
                </div>
            </div>

            {/* Draggable Map Area */}
            <div
                ref={dragRef}
                className="flex-1 overflow-scroll overflow-x-scroll overflow-y-scroll bg-gray-100 relative cursor-grab select-none"
                style={{ overscrollBehavior: 'none', touchAction: 'none' }}
                title="Зажмите и перетащите для перемещения схемы"
            >
                <div
                    style={{
                        padding: `${PADDING_V}px ${PADDING_H}px`,
                        minWidth: 'fit-content'
                    }}
                >
                    <div
                        style={{
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                            transition: 'transform 0.2s ease-out',
                            minWidth: 'fit-content'
                        }}
                        className="flex justify-start"
                    >
                        {Array.isArray(displayTree) && displayTree.length === 0 ? (
                            <div className="py-16 text-center text-gray-500">
                                <p className="text-lg">Ничего не найдено</p>
                                <p className="text-sm mt-1">Попробуйте другой запрос</p>
                            </div>
                        ) : Array.isArray(displayTree) ? (
                            <div className="flex gap-8 max-w-[1400px]">
                                {displayTree.map((rootNode, idx) => (
                                    <TreeNode
                                        key={`${rootNode.type}-${rootNode.id}-${idx}`}
                                        node={rootNode}
                                        onCopyEmail={handleCopyEmail}
                                        onCardClick={handleCardClick}
                                    />
                                ))}
                            </div>
                        ) : (
                            <TreeNode node={displayTree} onCopyEmail={handleCopyEmail} onCardClick={handleCardClick} />
                        )}
                    </div>
                </div>
            </div>

            {/* Модалка с деталями */}
            <AnimatePresence>
                {selectedNode && (
                    <ContactCardModal
                        node={selectedNode}
                        onClose={() => setSelectedNode(null)}
                        onCopyEmail={handleCopyEmail}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default Contact;
