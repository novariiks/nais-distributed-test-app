import { StrictMode, useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { mergeMessages, type Message } from './messages';
import './style.css';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [author, setAuthor] = useState(() => localStorage.getItem('chat-name') ?? '');
  const [body, setBody] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [instance, setInstance] = useState('Connecting…');
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    let refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const response = await fetch('/api/messages', { signal: abort.signal });
        if (!response.ok) throw new Error('Unable to load chat history. Retrying automatically.');
        const history: Message[] = await response.json();
        setMessages(current => mergeMessages(current, history));
        setHistoryError('');
      } catch (error) {
        if (!abort.signal.aborted) setHistoryError(error instanceof Error ? error.message : 'Cannot reach the server.');
      } finally {
        refreshing = false;
        if (!abort.signal.aborted) setLoading(false);
      }
    }
    const events = new EventSource('/api/events');
    events.addEventListener('connected', () => { setConnected(true); void refresh(); });
    events.addEventListener('message', event => {
      try {
        const message: Message = JSON.parse((event as MessageEvent<string>).data);
        setMessages(current => mergeMessages(current, [message]));
      } catch { void refresh(); }
    });
    events.onerror = () => setConnected(false);
    void refresh();
    void fetch('/api/info', { signal: abort.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(info => setInstance(info.instance)).catch(() => {});
    // Reconcile missed events after reconnects, deploys, or Kafka downtime.
    const timer = window.setInterval(() => { void refresh(); }, 10000);
    return () => { abort.abort(); events.close(); window.clearInterval(timer); };
  }, []);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!author.trim() || !body.trim() || sending) return;
    setSending(true);
    setSendError('');
    localStorage.setItem('chat-name', author.trim());
    try {
      const response = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: author.trim(), body: body.trim() }),
      });
      if (!response.ok) throw new Error(response.status === 400 ? 'Use a name up to 40 characters and a message up to 2,000 characters.' : 'Message could not be sent. Please try again.');
      const message: Message = await response.json();
      setMessages(current => mergeMessages(current, [message]));
      setBody('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Cannot reach the server. Please try again.');
    } finally { setSending(false); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="NAIS Chat home"><span className="brand-mark">n.</span> NAIS <span className="brand-light">chat</span></a>
      <div className="workspace-label">PLATFORM PLAYGROUND</div>
      <div className="channel active"><span>#</span> general <span className="channel-badge">LIVE</span></div>
      <p className="sidebar-description">One conversation.<br />A distributed application.</p>
      <div className="stack">
        <div className="workspace-label">UNDER THE HOOD</div>
        <div><span className="stack-symbol">Kt</span><span>Kotlin <small>Spring Boot backend</small></span></div>
        <div><span className="stack-symbol">R</span><span>React <small>Your window into the chat</small></span></div>
        <div><span className="stack-symbol">P</span><span>PostgreSQL <small>Remembers the conversation</small></span></div>
        <div><span className="stack-symbol">K</span><span>Kafka <small>Connects the replicas</small></span></div>
      </div>
      <div className="sidebar-footer">Built to explore NAIS.<br /><span>No sign-in. Just say hello.</span></div>
    </aside>
    <main>
      <header className="topbar"><div><span className="hash">#</span><strong>general</strong><span className="divider" /><span className="topic">The platform, in conversation</span></div><span className={`connection ${connected ? 'online' : ''}`} role="status"><i />{connected ? 'Live updates' : 'Reconnecting'}</span></header>
      <section className="conversation" aria-label="General chat">
        <div className="welcome"><span className="eyebrow">SMALL APP. DISTRIBUTED BY DESIGN.</span><h1>Hello, platform.</h1><p>Drop a message. Open another tab. Watch it travel.</p><div className="journey"><span>React</span><b>→</b><span>Kotlin</span><b>→</b><span>PostgreSQL</span><b>→</b><span>Kafka</span><b>→</b><span>Everyone</span></div></div>
        <div className="conversation-divider"><span>The conversation starts here</span></div>
        <div className="messages" role="log" aria-live="polite" aria-label="Messages">
          {loading && <p className="empty">Loading the conversation…</p>}
          {!loading && messages.length === 0 && <div className="empty"><span className="empty-icon">#</span><h2>A little quiet in here.</h2><p>Be the first to say hello to the platform.</p></div>}
          {messages.map(message => <article className="message" key={message.id}>
            <div className="avatar" aria-hidden="true">{message.author.slice(0, 2).toUpperCase()}</div>
            <div className="message-content"><div className="message-meta"><strong>{message.author}</strong><time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString()}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.body}</p><span className="instance-tag" title="Backend replica that accepted this message">via {message.instance}</span></div>
          </article>)}
          <div ref={bottom} />
        </div>
      </section>
      <footer className="composer-area">
        {historyError && <p className="error" role="alert">{historyError}</p>}
        {sendError && <p className="error" role="alert">{sendError}</p>}
        <form className="composer" onSubmit={send}>
          <div className="name-row"><label htmlFor="name">Chatting as</label><input id="name" value={author} onChange={event => setAuthor(event.target.value)} placeholder="Your name" maxLength={40} required autoComplete="nickname" disabled={sending} /><span>No account needed</span></div>
          <label className="sr-only" htmlFor="message">Message general</label>
          <textarea id="message" value={body} onChange={event => setBody(event.target.value)} placeholder="Say something in #general…" maxLength={2000} rows={2} required disabled={sending} />
          <div className="composer-actions"><span>{body.length.toLocaleString()} / 2,000</span><button type="submit" disabled={sending || !author.trim() || !body.trim()}>{sending ? 'Sending…' : 'Send message'}</button></div>
        </form>
        <div className="bottom-note"><span>History in PostgreSQL · Live delivery through Kafka</span><span className="backend-instance" title="Backend replica serving this browser">{instance}</span></div>
      </footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
