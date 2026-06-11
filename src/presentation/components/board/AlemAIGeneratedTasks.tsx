import React, { useState } from 'react';
import MaterialSymbol from '../../../shared/ui/MaterialSymbol';
import type { TzAiTaskItem, TzAiPriority } from '../../pages/alemai/tzai/types';

interface AlemAIGeneratedTasksProps {
  tasks: TzAiTaskItem[];
  kanbanContext: Record<string, { 
    board: { id: string; name: string }; 
    columns: { column: { id: string; name: string } }[]; 
    sprints: { id: string; name: string }[]; 
    members: { user_id: number; name: string }[]; 
  }>;
  onClose: () => void;
  onConfirm: (tasks: TzAiTaskItem[]) => void;
}

export const AlemAIGeneratedTasks: React.FC<AlemAIGeneratedTasksProps> = ({
  tasks: initialTasks,
  kanbanContext,
  onClose,
  onConfirm,
}) => {
  const [editedTasks, setEditedTasks] = useState<TzAiTaskItem[]>(initialTasks);

  const boards = Object.values(kanbanContext).map((ctx) => ctx.board);
  
  const handleTaskChange = (index: number, updates: Partial<TzAiTaskItem>) => {
    const newTasks = [...editedTasks];
    newTasks[index] = { ...newTasks[index], ...updates };
    setEditedTasks(newTasks);
  };

  const removeTask = (index: number) => {
    setEditedTasks(editedTasks.filter((_, i) => i !== index));
  };

  const getBoardOptions = (boardId: string | null) => {
    const ctx = kanbanContext[boardId || ''];
    if (!ctx) return { columns: [], sprints: [], members: [] };
    return {
      columns: ctx.columns || [],
      sprints: ctx.sprints || [],
      members: ctx.members || [],
    };
  };

  return (
    <div className="fixed inset-0 z-[700] flex flex-col bg-[#FDF5F0]">
      {/* Header */}
      <div className="flex h-14 items-center border-b border-[#DDE3EE] bg-white px-4 shadow-sm">
        <button
          onClick={onClose}
          className="mr-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
        >
          <MaterialSymbol name="arrow_back" size={20} color="#374C6B" />
        </button>
        <h2 className="text-base font-bold text-[#0A1628]">Сгенерированные задачи</h2>
        <div className="ml-auto">
           <button
            onClick={() => onConfirm(editedTasks)}
            disabled={editedTasks.length === 0}
            className="flex h-9 items-center justify-center rounded-lg bg-[#1E72E7] px-4 text-xs font-bold text-white shadow-md hover:bg-[#1861CA] disabled:opacity-50"
          >
            Создать задачи ({editedTasks.length})
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {editedTasks.map((task, index) => {
            const { columns, sprints, members } = getBoardOptions(task.board_id);

            return (
              <div key={index} className="overflow-hidden rounded-xl bg-white shadow-card border border-[#DDE3EE]">
                {/* Task Header */}
                <div className="flex items-center bg-[#F4F7FB] px-4 py-3 border-b border-[#DDE3EE]">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-[#1E72E7] text-[10px] font-bold text-white">
                    #{index + 1}
                  </div>
                  <span className="ml-3 text-sm font-bold text-[#374C6B]">Задача #{index + 1}</span>
                  <button
                    onClick={() => removeTask(index)}
                    className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#DDE3EE] bg-white px-2.5 py-1 text-[10px] font-bold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <MaterialSymbol name="close" size={14} color="currentColor" />
                    Удалить
                  </button>
                </div>

                {/* Task Body */}
                <div className="p-4 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8497B4]">Название</label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 text-[#B0C9F0]">
                        <MaterialSymbol name="title" size={16} color="currentColor" />
                      </div>
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => handleTaskChange(index, { title: e.target.value })}
                        className="h-10 w-full rounded-lg border border-[#DDE3EE] bg-[#F9FBFE] pl-10 pr-4 text-sm text-[#0A1628] focus:border-[#1E72E7] outline-none"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8497B4]">Описание</label>
                    <div className="relative flex">
                      <div className="absolute left-3 top-3 text-[#B0C9F0]">
                        <MaterialSymbol name="description" size={16} color="currentColor" />
                      </div>
                      <textarea
                        value={task.description}
                        onChange={(e) => handleTaskChange(index, { description: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-[#DDE3EE] bg-[#F9FBFE] pl-10 pr-4 py-2.5 text-sm text-[#0A1628] focus:border-[#1E72E7] outline-none resize-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Board */}
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8497B4]">Доска</label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3 text-[#B0C9F0]">
                          <MaterialSymbol name="dashboard" size={16} color="currentColor" />
                        </div>
                        <select
                          value={task.board_id || ''}
                          onChange={(e) => handleTaskChange(index, { board_id: e.target.value, column_id: '', sprint_id: '' })}
                          className="h-10 w-full appearance-none rounded-lg border border-[#DDE3EE] bg-[#F9FBFE] pl-10 pr-4 text-sm text-[#0A1628] focus:border-[#1E72E7] outline-none"
                        >
                          <option value="">Выберите доску</option>
                          {boards.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Column */}
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8497B4]">Колонка</label>
                        <select
                          value={task.column_id || ''}
                          onChange={(e) => handleTaskChange(index, { column_id: e.target.value })}
                          className="h-10 w-full rounded-lg border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] focus:border-[#1E72E7] outline-none"
                        >
                          <option value="">Выберите колонку</option>
                          {columns.map((c: { column: { id: string; name: string } }) => (
                            <option key={c.column.id} value={c.column.id}>{c.column.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Sprint */}
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8497B4]">Спринт</label>
                        <select
                          value={task.sprint_id || ''}
                          onChange={(e) => handleTaskChange(index, { sprint_id: e.target.value })}
                          className="h-10 w-full rounded-lg border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-sm text-[#0A1628] focus:border-[#1E72E7] outline-none"
                        >
                          <option value="">Без спринта</option>
                          {sprints.map((s: { id: string; name: string }) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Priority & Estimate */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8497B4]">Приоритет</label>
                        <div className="relative flex items-center">
                          <div className="absolute left-3 text-[#B0C9F0]">
                             <MaterialSymbol name="flag" size={16} color="currentColor" />
                          </div>
                          <select
                            value={task.priority}
                            onChange={(e) => handleTaskChange(index, { priority: e.target.value as TzAiPriority })}
                            className="h-10 w-full appearance-none rounded-lg border border-[#DDE3EE] bg-[#F9FBFE] pl-10 pr-4 text-sm text-[#0A1628] focus:border-[#1E72E7] outline-none"
                          >
                            <option value="low">Низкий</option>
                            <option value="medium">Средний</option>
                            <option value="high">Высокий</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8497B4]">Оценка (часы)</label>
                        <div className="relative flex items-center">
                          <div className="absolute left-3 text-[#B0C9F0]">
                             <MaterialSymbol name="schedule" size={16} color="currentColor" />
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={task.original_estimate_sec ? +(task.original_estimate_sec / 3600).toFixed(2) : ''}
                            onChange={(e) => {
                              const hours = parseFloat(e.target.value);
                              handleTaskChange(index, { original_estimate_sec: isNaN(hours) ? 0 : Math.round(hours * 3600) });
                            }}
                            className="h-10 w-full rounded-lg border border-[#DDE3EE] bg-[#F9FBFE] pl-10 pr-4 text-sm text-[#0A1628] focus:border-[#1E72E7] outline-none"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Assignee */}
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8497B4]">Исполнитель</label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3 text-[#B0C9F0]">
                           <MaterialSymbol name="person" size={16} color="currentColor" />
                        </div>
                        <select
                          value={task.assignee_id || ''}
                          onChange={(e) => handleTaskChange(index, { assignee_id: e.target.value ? Number(e.target.value) : null })}
                          className="h-10 w-full appearance-none rounded-lg border border-[#DDE3EE] bg-[#F9FBFE] pl-10 pr-4 text-sm text-[#0A1628] focus:border-[#1E72E7] outline-none"
                        >
                          <option value="">Не назначен</option>
                          {members.map((m: { user_id: number; name: string }) => (
                            <option key={m.user_id} value={m.user_id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Create Button */}
        <div className="mx-auto max-w-4xl mt-8 pb-10">
          <button
            onClick={() => onConfirm(editedTasks)}
            disabled={editedTasks.length === 0}
            className="group relative flex w-full h-14 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-r from-[#1E72E7] to-[#1861CA] px-8 text-sm font-extrabold text-white shadow-[0_8px_25px_rgba(30,114,231,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(30,114,231,0.45)] active:translate-y-0 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
            <MaterialSymbol name="add_task" size={22} color="white" />
            <span className="ml-3">
              {editedTasks.length === 1 ? 'Создать задачу' : `Создать задачи (${editedTasks.length})`}
            </span>
          </button>
          
          <p className="mt-4 text-center text-xs font-medium text-[#8497B4]">
            Все задачи будут добавлены на соответствующие доски и колонки
          </p>
        </div>
      </div>
    </div>
  );
};
