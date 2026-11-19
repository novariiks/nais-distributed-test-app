export interface Message {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  instance: string;
}

// Live events can overlap with history refreshes and reconnects.
export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const messages = new Map(current.map(message => [message.id, message]));
  incoming.forEach(message => messages.set(message.id, message));
  return [...messages.values()]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))
    .slice(-100);
}
