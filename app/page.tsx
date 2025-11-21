'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Role = 'assistant' | 'user';

type Message = {
  id: string;
  role: Role;
  content: string;
  timestamp: string;
};

type Priority = 'High' | 'Medium' | 'Low';

type Task = {
  id: string;
  title: string;
  due: string;
  priority: Priority;
  reminder: string | null;
};

type QuickAction = {
  label: string;
  value: string;
};

const priorityOptions: Priority[] = ['High', 'Medium', 'Low'];

const idleActions: QuickAction[] = [
  { label: 'Add Task', value: 'Add Task' },
  { label: 'Update Task', value: 'Update Task' },
  { label: 'Delete Task', value: 'Delete Task' },
  { label: 'View Tasks', value: 'View Tasks' }
];

const initialMessages: Message[] = [
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: "Hey! I'm your WhatsApp Task Scheduler. Need to add, update, delete, or check tasks?",
    timestamp: new Date().toISOString()
  },
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: 'Just tap an option or tell me what you need.',
    timestamp: new Date().toISOString()
  }
];

const formatTimestamp = (iso: string) => new Date(iso).toLocaleTimeString([], {
  hour: '2-digit',
  minute: '2-digit'
});

const parseIndex = (value: string) => {
  const match = value.trim().match(/^(?:#)?(\d+)/);
  if (!match) return null;
  const idx = Number.parseInt(match[1], 10);
  return Number.isNaN(idx) ? null : idx - 1;
};

export default function Page() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [action, setAction] = useState<'idle' | 'add' | 'update' | 'delete' | 'view'>('idle');
  const [flowStep, setFlowStep] = useState(0);
  const [pendingTask, setPendingTask] = useState<Partial<Task>>({ priority: 'Medium' });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingField, setPendingField] = useState<keyof Task | null>(null);
  const [buttons, setButtons] = useState<QuickAction[]>(idleActions);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem('whatsapp-task-scheduler');
    if (stored) {
      try {
        const parsed: Task[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setTasks(parsed);
        }
      } catch (error) {
        console.error('Failed to parse stored tasks', error);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('whatsapp-task-scheduler', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pushMessage = (role: Role, content: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const resetConversation = () => {
    setAction('idle');
    setFlowStep(0);
    setPendingTask({ priority: 'Medium' });
    setSelectedTaskId(null);
    setPendingField(null);
    setButtons(idleActions);
  };

  const showIdleOptions = () => {
    pushMessage('assistant', 'Anything else I can help with? Add, update, delete, or view tasks.');
    resetConversation();
  };

  const handleAddFlow = (userInput: string) => {
    if (flowStep === 0) {
      setPendingTask({ priority: 'Medium' });
      pushMessage('assistant', 'Great! What is the task?');
      setFlowStep(1);
      setButtons([]);
      return;
    }

    if (flowStep === 1) {
      setPendingTask(prev => ({ ...prev, title: userInput.trim() }));
      pushMessage('assistant', 'Got it. When is it due? (e.g. "24 Apr 5pm")');
      setFlowStep(2);
      return;
    }

    if (flowStep === 2) {
      setPendingTask(prev => ({ ...prev, due: userInput.trim() }));
      const priorityButtons: QuickAction[] = priorityOptions.map(priority => ({
        label: priority,
        value: priority
      }));
      pushMessage('assistant', 'Any priority? High, Medium, or Low?');
      setButtons(priorityButtons);
      setFlowStep(3);
      return;
    }

    if (flowStep === 3) {
      const priority = priorityOptions.find(p => p.toLowerCase() === userInput.trim().toLowerCase());
      if (!priority) {
        pushMessage('assistant', 'Please choose between High, Medium, or Low.');
        return;
      }
      setPendingTask(prev => ({ ...prev, priority }));
      setButtons([
        { label: 'Yes, add reminder', value: 'yes' },
        { label: 'No reminder', value: 'no' }
      ]);
      pushMessage('assistant', 'Do you want to add a reminder?');
      setFlowStep(4);
      return;
    }

    if (flowStep === 4) {
      if (userInput.trim().toLowerCase().startsWith('y')) {
        pushMessage('assistant', 'Sure, when should I remind you?');
        setFlowStep(5);
        setButtons([]);
      } else if (userInput.trim().toLowerCase().startsWith('n')) {
        setPendingTask(prev => ({ ...prev, reminder: null }));
        pushMessage('assistant', 'Here is what I captured. Save it? (yes/no)');
        setFlowStep(6);
        setButtons([
          { label: 'Yes, save', value: 'yes' },
          { label: 'No, cancel', value: 'no' }
        ]);
      } else {
        pushMessage('assistant', 'Please say yes or no for the reminder.');
      }
      return;
    }

    if (flowStep === 5) {
      setPendingTask(prev => ({ ...prev, reminder: userInput.trim() }));
      pushMessage('assistant', 'Thanks! Shall I save it? (yes/no)');
      setFlowStep(6);
      setButtons([
        { label: 'Yes, save', value: 'yes' },
        { label: 'No, cancel', value: 'no' }
      ]);
      return;
    }

    if (flowStep === 6) {
      if (userInput.trim().toLowerCase().startsWith('y')) {
        const task: Task = {
          id: crypto.randomUUID(),
          title: pendingTask.title?.trim() ?? 'Untitled task',
          due: pendingTask.due?.trim() ?? 'No due date',
          priority: (pendingTask.priority as Priority) ?? 'Medium',
          reminder: pendingTask.reminder ?? null
        };
        const updated = [...tasks, task];
        setTasks(updated);
        const summaryParts = [
          `Task: ${task.title}`,
          `Due: ${task.due}`,
          `Priority: ${task.priority}`,
          `Reminder: ${task.reminder ?? 'None'}`
        ];
        pushMessage('assistant', `All set!\n${summaryParts.join('\n')}`);
        showIdleOptions();
      } else {
        pushMessage('assistant', 'No worries, I will discard that task.');
        showIdleOptions();
      }
    }
  };

  const handleUpdateFlow = (userInput: string) => {
    if (flowStep === 0) {
      if (tasks.length === 0) {
        pushMessage('assistant', 'You have no tasks yet. Let’s add one.');
        resetConversation();
        return;
      }
      const list = tasks
        .map((task, index) => `#${index + 1} ${task.title} — Due: ${task.due} — Priority: ${task.priority}`)
        .join('\n');
      pushMessage('assistant', `Which task do you want to update?\n${list}`);
      setFlowStep(1);
      return;
    }

    if (flowStep === 1) {
      const index = parseIndex(userInput);
      if (index === null || index < 0 || index >= tasks.length) {
        pushMessage('assistant', 'Please pick a valid task number.');
        return;
      }
      const task = tasks[index];
      setSelectedTaskId(task.id);
      const changeButtons: QuickAction[] = [
        { label: 'Task name', value: 'title' },
        { label: 'Due date & time', value: 'due' },
        { label: 'Priority', value: 'priority' },
        { label: 'Reminder', value: 'reminder' }
      ];
      pushMessage('assistant', 'What do you want to change?');
      setButtons(changeButtons);
      setFlowStep(2);
      return;
    }

    if (flowStep === 2) {
      const field = userInput.trim().toLowerCase();
      if (!['title', 'due', 'priority', 'reminder'].includes(field)) {
        pushMessage('assistant', 'Please choose title, due, priority, or reminder.');
        return;
      }
      setPendingField(field as keyof Task);
      if (field === 'priority') {
        setButtons(priorityOptions.map(priority => ({ label: priority, value: priority })));
        pushMessage('assistant', 'New priority? (High/Medium/Low)');
      } else if (field === 'reminder') {
        setButtons([
          { label: 'Update reminder', value: 'update' },
          { label: 'Remove reminder', value: 'remove' }
        ]);
        pushMessage('assistant', 'Want to update the reminder or remove it?');
      } else {
        setButtons([]);
        pushMessage('assistant', `Alright, what is the new ${field === 'title' ? 'task name' : 'due date & time'}?`);
      }
      setFlowStep(3);
      return;
    }

    if (flowStep === 3) {
      if (!selectedTaskId) {
        pushMessage('assistant', 'Let’s start over.');
        resetConversation();
        return;
      }
      const currentTask = tasks.find(task => task.id === selectedTaskId);
      if (!currentTask) {
        pushMessage('assistant', 'I could not find that task. Let’s try again.');
        resetConversation();
        return;
      }
      const updateDraft: Partial<Task> = {};

      if (pendingField === 'priority') {
        const priority = priorityOptions.find(p => p.toLowerCase() === userInput.trim().toLowerCase());
        if (!priority) {
          pushMessage('assistant', 'Priority should be High, Medium, or Low.');
          return;
        }
        updateDraft.priority = priority;
      } else if (pendingField === 'reminder') {
        const option = userInput.trim().toLowerCase();
        if (option === 'remove') {
          updateDraft.reminder = null;
        } else if (option === 'update') {
          pushMessage('assistant', 'What is the new reminder time?');
          setFlowStep(4);
          setButtons([]);
          return;
        } else {
          updateDraft.reminder = userInput.trim();
        }
      } else if (pendingField === 'title') {
        updateDraft.title = userInput.trim();
      } else if (pendingField === 'due') {
        updateDraft.due = userInput.trim();
      }

      const preview = {
        ...currentTask,
        ...updateDraft
      };
      const summaryParts = [
        `Task: ${preview.title}`,
        `Due: ${preview.due}`,
        `Priority: ${preview.priority}`,
        `Reminder: ${preview.reminder ?? 'None'}`
      ];
      setPendingTask(updateDraft);
      pushMessage('assistant', `Here is the updated version:\n${summaryParts.join('\n')}\nSave it? (yes/no)`);
      setButtons([
        { label: 'Yes, save', value: 'yes' },
        { label: 'No, cancel', value: 'no' }
      ]);
      setFlowStep(5);
      return;
    }

    if (flowStep === 4) {
      if (!selectedTaskId) {
        pushMessage('assistant', 'Let’s start over.');
        resetConversation();
        return;
      }
      const currentTask = tasks.find(task => task.id === selectedTaskId);
      if (!currentTask) {
        pushMessage('assistant', 'Task not found, sorry.');
        resetConversation();
        return;
      }
      const updateDraft: Partial<Task> = { reminder: userInput.trim() };
      const preview = { ...currentTask, ...updateDraft };
      const summaryParts = [
        `Task: ${preview.title}`,
        `Due: ${preview.due}`,
        `Priority: ${preview.priority}`,
        `Reminder: ${preview.reminder ?? 'None'}`
      ];
      setPendingTask(updateDraft);
      pushMessage('assistant', `Updated reminder ready:\n${summaryParts.join('\n')}\nSave it? (yes/no)`);
      setButtons([
        { label: 'Yes, save', value: 'yes' },
        { label: 'No, cancel', value: 'no' }
      ]);
      setFlowStep(5);
      return;
    }

    if (flowStep === 5) {
      if (!selectedTaskId) {
        pushMessage('assistant', 'Looks like that task vanished.');
        resetConversation();
        return;
      }
      if (userInput.trim().toLowerCase().startsWith('y')) {
        setTasks(prev =>
          prev.map(task =>
            task.id === selectedTaskId
              ? {
                  ...task,
                  ...pendingTask
                }
              : task
          )
        );
        pushMessage('assistant', 'Updated! Anything else?');
      } else {
        pushMessage('assistant', 'No changes saved.');
      }
      showIdleOptions();
    }
  };

  const handleDeleteFlow = (userInput: string) => {
    if (flowStep === 0) {
      if (tasks.length === 0) {
        pushMessage('assistant', 'No tasks to delete right now. Want to add one instead?');
        resetConversation();
        return;
      }
      const list = tasks
        .map((task, index) => `#${index + 1} ${task.title} — Due: ${task.due} — Priority: ${task.priority}`)
        .join('\n');
      pushMessage('assistant', `Got it. Which task should I delete?\n${list}`);
      setFlowStep(1);
      return;
    }

    if (flowStep === 1) {
      const index = parseIndex(userInput);
      if (index === null || index < 0 || index >= tasks.length) {
        pushMessage('assistant', 'Please choose a valid task number.');
        return;
      }
      const task = tasks[index];
      setSelectedTaskId(task.id);
      pushMessage(
        'assistant',
        `Just to confirm, delete "${task.title}" due ${task.due}? (yes/no)`
      );
      setButtons([
        { label: 'Yes, delete', value: 'yes' },
        { label: 'No, keep it', value: 'no' }
      ]);
      setFlowStep(2);
      return;
    }

    if (flowStep === 2) {
      if (!selectedTaskId) {
        pushMessage('assistant', 'Task already gone.');
        resetConversation();
        return;
      }
      if (userInput.trim().toLowerCase().startsWith('y')) {
        setTasks(prev => prev.filter(task => task.id !== selectedTaskId));
        pushMessage('assistant', 'Done! Task removed.');
      } else {
        pushMessage('assistant', 'Okay, nothing deleted.');
      }
      showIdleOptions();
    }
  };

  const handleViewFlow = () => {
    if (tasks.length === 0) {
      pushMessage('assistant', 'You do not have any tasks yet. Ready to add one?');
      resetConversation();
      return;
    }
    const list = tasks
      .map(
        task =>
          `• ${task.title}\n  Due: ${task.due}\n  Priority: ${task.priority}\n  Reminder: ${task.reminder ?? 'None'}`
      )
      .join('\n\n');
    pushMessage('assistant', `Here is what is on your list:\n${list}`);
    showIdleOptions();
  };

  const routeInput = (userInput: string) => {
    if (action === 'idle') {
      const intent = userInput.trim().toLowerCase();
      if (intent.includes('add')) {
        setAction('add');
        setFlowStep(0);
        setButtons([]);
        handleAddFlow('');
        return;
      }
      if (intent.includes('update')) {
        setAction('update');
        setFlowStep(0);
        setButtons([]);
        handleUpdateFlow('');
        return;
      }
      if (intent.includes('delete') || intent.includes('remove')) {
        setAction('delete');
        setFlowStep(0);
        setButtons([]);
        handleDeleteFlow('');
        return;
      }
      if (intent.includes('view') || intent.includes('show') || intent.includes('list')) {
        setAction('view');
        setFlowStep(0);
        setButtons([]);
        handleViewFlow();
        return;
      }
      pushMessage('assistant', 'I can add, update, delete, or show tasks. Which one do you need?');
      setButtons(idleActions);
      return;
    }

    if (action === 'add') {
      handleAddFlow(userInput);
    } else if (action === 'update') {
      handleUpdateFlow(userInput);
    } else if (action === 'delete') {
      handleDeleteFlow(userInput);
    } else if (action === 'view') {
      handleViewFlow();
    }
  };

  const handleSend = (value?: string) => {
    const messageText = value ?? input.trim();
    if (!messageText) return;
    pushMessage('user', messageText);
    setInput('');
    routeInput(messageText);
  };

  const assistantStatus = useMemo(() => {
    if (action === 'add') return 'Adding a task';
    if (action === 'update') return 'Updating a task';
    if (action === 'delete') return 'Deleting a task';
    if (action === 'view') return 'Viewing tasks';
    return 'Here for you';
  }, [action]);

  return (
    <div className="chat-wrapper">
      <div className="chat-card">
        <header className="chat-header">
          <div className="avatar">AI</div>
          <div>
            <div style={{ fontWeight: 600 }}>Task Scheduler</div>
            <div className="system-note">{assistantStatus}</div>
          </div>
        </header>
        <main className="chat-body">
          <div className="message-list">
            {messages.map(message => {
              const lines = message.content.split('\n');
              return (
                <div key={message.id} className={`message ${message.role}`}>
                  <span>
                    {lines.map((line, index) => (
                      <span key={index}>
                        {line}
                        {index < lines.length - 1 && <br />}
                      </span>
                    ))}
                  </span>
                <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>
          {buttons.length > 0 && (
            <div className="action-buttons" style={{ padding: '0 16px 12px' }}>
              {buttons.map(button => (
                <button
                  key={button.label}
                  className="action-button"
                  onClick={() => handleSend(button.value)}
                  type="button"
                >
                  {button.label}
                </button>
              ))}
            </div>
          )}
          <div className="chat-input">
            <input
              placeholder="Type a message"
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
            />
            <button onClick={() => handleSend()} type="button" disabled={!input.trim()}>
              Send
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
