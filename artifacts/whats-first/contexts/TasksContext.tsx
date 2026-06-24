// Tasks context — manages all task CRUD and subtask operations with AsyncStorage persistence.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Task, Subtask, Urgency, TaskStatus } from '@/types';
import { getItem, setItem, STORAGE_KEYS } from '@/utils/storage';
import { todayISO } from '@/utils/dateHelpers';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

interface TasksContextValue {
  tasks: Task[];
  isLoaded: boolean;
  addTask: (data: { title: string; urgency: Urgency; dueDate: string; subtasks: string[] }) => void;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  completeTask: (id: string) => void;
  cancelTask: (id: string) => void;
  deleteTask: (id: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addSubtask: (taskId: string, title: string) => void;
  removeSubtask: (taskId: string, subtaskId: string) => void;
  clearHistory: () => void;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    getItem<Task[]>(STORAGE_KEYS.TASKS, []).then((stored) => {
      setTasks(stored);
      setIsLoaded(true);
    });
  }, []);

  const persist = useCallback((updated: Task[]) => {
    setTasks(updated);
    setItem(STORAGE_KEYS.TASKS, updated);
  }, []);

  const addTask = useCallback((data: { title: string; urgency: Urgency; dueDate: string; subtasks: string[] }) => {
    const newTask: Task = {
      id: genId(),
      title: data.title.trim(),
      status: 'active',
      urgency: data.urgency,
      dueDate: data.dueDate || todayISO(),
      createdAt: new Date().toISOString(),
      completedAt: null,
      subtasks: data.subtasks.filter(Boolean).map((t) => ({
        id: genId(),
        title: t.trim(),
        isCompleted: false,
      })),
    };
    setTasks((prev) => {
      const updated = [newTask, ...prev];
      setItem(STORAGE_KEYS.TASKS, updated);
      return updated;
    });
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
      setItem(STORAGE_KEYS.TASKS, updated);
      return updated;
    });
  }, []);

  const completeTask = useCallback((id: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === id ? { ...t, status: 'completed' as TaskStatus, completedAt: new Date().toISOString() } : t
      );
      setItem(STORAGE_KEYS.TASKS, updated);
      return updated;
    });
  }, []);

  const cancelTask = useCallback((id: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === id ? { ...t, status: 'cancelled' as TaskStatus, completedAt: new Date().toISOString() } : t
      );
      setItem(STORAGE_KEYS.TASKS, updated);
      return updated;
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      setItem(STORAGE_KEYS.TASKS, updated);
      return updated;
    });
  }, []);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          subtasks: t.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
          ),
        };
      });
      setItem(STORAGE_KEYS.TASKS, updated);
      return updated;
    });
  }, []);

  const addSubtask = useCallback((taskId: string, title: string) => {
    if (!title.trim()) return;
    const newSubtask: Subtask = { id: genId(), title: title.trim(), isCompleted: false };
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === taskId ? { ...t, subtasks: [...t.subtasks, newSubtask] } : t
      );
      setItem(STORAGE_KEYS.TASKS, updated);
      return updated;
    });
  }, []);

  const removeSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t
      );
      setItem(STORAGE_KEYS.TASKS, updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setTasks((prev) => {
      const updated = prev.filter((t) => t.status === 'active');
      setItem(STORAGE_KEYS.TASKS, updated);
      return updated;
    });
  }, []);

  return (
    <TasksContext.Provider value={{
      tasks, isLoaded,
      addTask, updateTask, completeTask, cancelTask,
      deleteTask, toggleSubtask, addSubtask, removeSubtask, clearHistory,
    }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
}
