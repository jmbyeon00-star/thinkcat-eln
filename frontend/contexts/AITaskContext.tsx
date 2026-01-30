import React, { createContext, useContext, useState, ReactNode } from 'react';

type AITaskStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'ERROR';

type AITaskState = {
  isBusy: boolean;
  status: AITaskStatus;
  progress: number;
  taskType?: 'training' | 'inference' | 'analysis';
  message?: string;
};

type AITaskContextType = {
  state: AITaskState;
  setState: (state: Partial<AITaskState>) => void;
  startTask: (taskType: 'training' | 'inference' | 'analysis') => void;
  completeTask: () => void;
  failTask: (message: string) => void;
  updateProgress: (progress: number) => void;
  resetTask: () => void;
};

const AITaskContext = createContext<AITaskContextType | undefined>(undefined);

const initialState: AITaskState = {
  isBusy: false,
  status: 'IDLE',
  progress: 0,
  taskType: undefined,
  message: undefined,
};

export function AITaskProvider({ children }: { children: ReactNode }) {
  const [state, setStateInternal] = useState<AITaskState>(initialState);

  const setState = (partialState: Partial<AITaskState>) => {
    setStateInternal(prev => ({ ...prev, ...partialState }));
  };

  const startTask = (taskType: 'training' | 'inference' | 'analysis') => {
    setState({
      isBusy: true,
      status: 'RUNNING',
      progress: 0,
      taskType,
      message: undefined,
    });
  };

  const completeTask = () => {
    setState({
      isBusy: false,
      status: 'COMPLETED',
      progress: 100,
    });
    // 3초 후 자동 리셋
    setTimeout(() => {
      resetTask();
    }, 3000);
  };

  const failTask = (message: string) => {
    setState({
      isBusy: false,
      status: 'ERROR',
      message,
    });
  };

  const updateProgress = (progress: number) => {
    setState({ progress });
  };

  const resetTask = () => {
    setStateInternal(initialState);
  };

  return (
    <AITaskContext.Provider
      value={{
        state,
        setState,
        startTask,
        completeTask,
        failTask,
        updateProgress,
        resetTask,
      }}
    >
      {children}
    </AITaskContext.Provider>
  );
}

export function useAITask() {
  const context = useContext(AITaskContext);
  if (context === undefined) {
    throw new Error('useAITask must be used within an AITaskProvider');
  }
  return context;
}