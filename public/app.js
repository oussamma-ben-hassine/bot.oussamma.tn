// Initialisation des icônes Lucide
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initApp();
});

// État Global de l'Application
const state = {
  conversations: [],
  currentConversationId: null,
  isGenerating: false,
  webSearchEnabled: false,
  user: null,
  config: {
    provider: 'sso',
    ssoEndpoint: 'https://sso-a.oussamma.tn/api/v1/integrations/ai/prompt',
    model: 'gpt-4o',
    apiKey: '',
    systemPrompt: "Tu es un assistant IA conversationnel moderne, intelligent et serviable. Réponds avec précision, clarté et structure toujours tes réponses avec du beau Markdown.",
    defaultWebSearch: false
  }
};

// Éléments du DOM
const DOM = {
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebarBackdrop'),
  openSidebarBtn: document.getElementById('openSidebarBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  conversationsList: document.getElementById('conversationsList'),
  userAvatar: document.getElementById('userAvatar'),
  userName: document.getElementById('userName'),
  userStatus: document.getElementById('userStatus'),
  authBtn: document.getElementById('authBtn'),
  chatMessages: document.getElementById('chatMessages'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  webSearchToggle: document.getElementById('webSearchToggle'),
  webSearchBadge: document.getElementById('webSearchBadge'),
  searchIndicator: document.getElementById('searchIndicator'),
  searchIndicatorText: document.getElementById('searchIndicatorText'),
  modelSelectorBtn: document.getElementById('modelSelectorBtn'),
  currentModelLabel: document.getElementById('currentModelLabel'),
  modelDropdown: document.getElementById('modelDropdown'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  closeSettingsModal: document.getElementById('closeSettingsModal'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  configProvider: document.getElementById('configProvider'),
  configEndpoint: document.getElementById('configEndpoint'),
  configModel: document.getElementById('configModel'),
  configApiKey: document.getElementById('configApiKey'),
  configSystemPrompt: document.getElementById('configSystemPrompt'),
  configDefaultWebSearch: document.getElementById('configDefaultWebSearch')
};

// Initialisation de l'application
async function initApp() {
  loadConfig();
  loadConversations();
  setupEventListeners();
  await checkAuthStatus();

  if (state.conversations.length > 0) {
    selectConversation(state.conversations[0].id);
  } else {
    createNewConversation();
  }
}

// -------------------------------------------------------------
// STOCKAGE LOCAL
// -------------------------------------------------------------
function loadConfig() {
  const saved = localStorage.getItem('bot_oussamma_config');
  if (saved) {
    try {
      state.config = { ...state.config, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Erreur chargement config:', e);
    }
  }
  state.webSearchEnabled = state.config.defaultWebSearch || false;
  updateWebSearchUI();
  updateModelSelectorLabel();
}

function saveConfig() {
  localStorage.setItem('bot_oussamma_config', JSON.stringify(state.config));
}

function loadConversations() {
  const saved = localStorage.getItem('bot_oussamma_chats');
  if (saved) {
    try {
      state.conversations = JSON.parse(saved);
    } catch (e) {
      state.conversations = [];
    }
  }
  renderConversationsList();
}

function saveConversations() {
  localStorage.setItem('bot_oussamma_chats', JSON.stringify(state.conversations));
}

// -------------------------------------------------------------
// AUTHENTIFICATION SSO
// -------------------------------------------------------------
async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated && data.user) {
      state.user = data.user;
      DOM.userName.textContent = data.user.name || 'Oussama';
      DOM.userStatus.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span> Connecté SSO`;
      
      if (data.user.avatar) {
        DOM.userAvatar.innerHTML = `<img src="${data.user.avatar}" class="w-full h-full rounded-full object-cover">`;
      } else {
        const initial = (data.user.name || 'O').charAt(0).toUpperCase();
        DOM.userAvatar.textContent = initial;
      }

      DOM.authBtn.title = 'Déconnexion SSO';
      DOM.authBtn.innerHTML = `<i data-lucide="log-out" class="w-4 h-4 text-[#8e8e8e] hover:text-red-400"></i>`;
      DOM.authBtn.onclick = () => window.location.href = '/auth/logout';
    } else {
      DOM.userName.textContent = 'Invité';
      DOM.userStatus.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span> Non connecté`;
      DOM.userAvatar.textContent = '?';
      DOM.authBtn.title = 'Connexion SSO';
      DOM.authBtn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4 text-emerald-400"></i>`;
      DOM.authBtn.onclick = () => window.location.href = '/auth/login';
    }
    lucide.createIcons();
  } catch (e) {
    console.error('Erreur vérification SSO:', e);
  }
}

// -------------------------------------------------------------
// CONVERSATIONS
// -------------------------------------------------------------
function createNewConversation() {
  const newChat = {
    id: 'chat_' + Date.now(),
    title: 'Nouveau chat',
    createdAt: new Date().toISOString(),
    messages: []
  };

  state.conversations.unshift(newChat);
  state.currentConversationId = newChat.id;
  saveConversations();
  renderConversationsList();
  renderMessages();
  closeMobileSidebar();
}

function selectConversation(id) {
  state.currentConversationId = id;
  renderConversationsList();
  renderMessages();
  closeMobileSidebar();
}

function deleteConversation(id, event) {
  event?.stopPropagation();
  state.conversations = state.conversations.filter(c => c.id !== id);
  if (state.currentConversationId === id) {
    state.currentConversationId = state.conversations.length > 0 ? state.conversations[0].id : null;
  }
  saveConversations();
  renderConversationsList();
  if (!state.currentConversationId) {
    createNewConversation();
  } else {
    renderMessages();
  }
}

function renderConversationsList() {
  DOM.conversationsList.innerHTML = '';
  state.conversations.forEach(chat => {
    const isActive = chat.id === state.currentConversationId;
    const btn = document.createElement('div');
    btn.className = `group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs font-medium transition duration-150 ${
      isActive ? 'bg-[#212121] text-white font-semibold' : 'text-[#b4b4b4] hover:text-white hover:bg-[#212121]/60'
    }`;
    
    btn.innerHTML = `
      <div class="flex items-center gap-2 truncate">
        <i data-lucide="message-square" class="w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-[#737373]'}"></i>
        <span class="truncate">${escapeHtml(chat.title)}</span>
      </div>
      <button class="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-[#737373] transition" title="Supprimer">
        <i data-lucide="trash" class="w-3 h-3"></i>
      </button>
    `;

    btn.onclick = () => selectConversation(chat.id);
    const delBtn = btn.querySelector('button');
    delBtn.onclick = (e) => deleteConversation(chat.id, e);

    DOM.conversationsList.appendChild(btn);
  });
  lucide.createIcons();
}

// -------------------------------------------------------------
// RENDU DU CHAT
// -------------------------------------------------------------
function getCurrentConversation() {
  return state.conversations.find(c => c.id === state.currentConversationId);
}

function renderMessages() {
  const currentChat = getCurrentConversation();
  DOM.chatMessages.innerHTML = '';

  if (!currentChat || currentChat.messages.length === 0) {
    DOM.welcomeScreen.classList.remove('hidden');
    DOM.chatMessages.appendChild(DOM.welcomeScreen);
    return;
  }

  DOM.welcomeScreen.classList.add('hidden');

  currentChat.messages.forEach(msg => {
    appendMessageToDOM(msg);
  });

  scrollToBottom();
}

function appendMessageToDOM(msg) {
  const isUser = msg.role === 'user';
  const row = document.createElement('div');
  row.className = `flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in w-full`;

  if (isUser) {
    row.innerHTML = `
      <div class="user-bubble">
        ${escapeHtml(msg.content)}
      </div>
    `;
  } else {
    // Message Assistant style ChatGPT
    const sourcesHtml = msg.webSources && msg.webSources.length > 0 ? `
      <div class="mb-3 p-2.5 rounded-xl bg-[#282828] border border-[#383838] text-xs text-[#d1d1d1]">
        <div class="flex items-center gap-1.5 font-semibold text-emerald-400 mb-2">
          <i data-lucide="globe" class="w-3.5 h-3.5"></i>
          <span>Sources web citées (${msg.webSources.length}) :</span>
        </div>
        <div class="space-y-1.5">
          ${msg.webSources.map((s, idx) => `
            <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="block hover:underline truncate text-[#a3a3a3] hover:text-emerald-300">
              <span class="font-mono text-[10px] text-emerald-400 font-bold">[${idx + 1}]</span> ${escapeHtml(s.title || s.url)}
            </a>
          `).join('')}
        </div>
      </div>
    ` : '';

    row.innerHTML = `
      <div class="flex gap-4 w-full">
        <div class="w-7 h-7 rounded-full bg-[#2f2f2f] flex items-center justify-center shrink-0 border border-[#3e3e3e]">
          <i data-lucide="sparkles" class="w-3.5 h-3.5 text-emerald-400"></i>
        </div>
        <div class="flex-1 overflow-hidden space-y-2">
          ${sourcesHtml}
          <div class="assistant-message markdown-body">
            ${marked.parse(msg.content || '')}
          </div>
          <div class="flex items-center gap-3 pt-1 text-[11px] text-[#737373]">
            <button class="copy-msg-btn flex items-center gap-1 hover:text-white transition" title="Copier">
              <i data-lucide="copy" class="w-3 h-3"></i> Copier
            </button>
          </div>
        </div>
      </div>
    `;

    const copyBtn = row.querySelector('.copy-msg-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(msg.content || '');
        copyBtn.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-emerald-400"></i> Copié !`;
        lucide.createIcons();
        setTimeout(() => {
          copyBtn.innerHTML = `<i data-lucide="copy" class="w-3 h-3"></i> Copier`;
          lucide.createIcons();
        }, 2000);
      };
    }
  }

  DOM.chatMessages.appendChild(row);
  enhanceCodeBlocks(row);
  lucide.createIcons();
}

function enhanceCodeBlocks(container) {
  container.querySelectorAll('pre code').forEach((codeEl) => {
    hljs.highlightElement(codeEl);

    const pre = codeEl.parentElement;
    if (pre.parentElement && pre.parentElement.classList.contains('code-block-wrapper')) return;

    // Déterminer le langage
    let lang = 'code';
    codeEl.classList.forEach(cls => {
      if (cls.startsWith('language-')) lang = cls.replace('language-', '');
    });

    // Créer le wrapper style ChatGPT
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span>${lang}</span>
      <button class="code-copy-btn">
        <i data-lucide="copy" class="w-3 h-3"></i>
        <span>Copier le code</span>
      </button>
    `;

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);

    const copyBtn = header.querySelector('.code-copy-btn');
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(codeEl.innerText);
      copyBtn.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-emerald-400"></i><span>Copié !</span>';
      lucide.createIcons();
      setTimeout(() => {
        copyBtn.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i><span>Copier le code</span>';
        lucide.createIcons();
      }, 2000);
    };
  });
}

function scrollToBottom() {
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

// -------------------------------------------------------------
// ENVOI & STREAMING
// -------------------------------------------------------------
async function handleSendMessage() {
  const text = DOM.messageInput.value.trim();
  if (!text || state.isGenerating) return;

  let currentChat = getCurrentConversation();
  if (!currentChat) {
    createNewConversation();
    currentChat = getCurrentConversation();
  }

  if (currentChat.messages.length === 0) {
    currentChat.title = text.slice(0, 28) + (text.length > 28 ? '...' : '');
    renderConversationsList();
  }

  // 1. Message Utilisateur
  currentChat.messages.push({ role: 'user', content: text });
  saveConversations();

  DOM.messageInput.value = '';
  adjustTextareaHeight();
  updateSendButtonState();
  renderMessages();

  // 2. Message Assistant temporaire avec curseur
  state.isGenerating = true;
  DOM.sendBtn.disabled = true;

  const assistantMsg = { role: 'assistant', content: '', webSources: [] };
  currentChat.messages.push(assistantMsg);

  const assistantRow = document.createElement('div');
  assistantRow.className = 'flex justify-start animate-fade-in w-full';
  assistantRow.innerHTML = `
    <div class="flex gap-4 w-full">
      <div class="w-7 h-7 rounded-full bg-[#2f2f2f] flex items-center justify-center shrink-0 border border-[#3e3e3e]">
        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-emerald-400"></i>
      </div>
      <div class="flex-1 overflow-hidden space-y-2">
        <div id="activeWebSources" class="hidden mb-3 p-2.5 rounded-xl bg-[#282828] border border-[#383838] text-xs text-[#d1d1d1]"></div>
        <div class="assistant-message markdown-body streaming-cursor">
          <span id="streamingText"></span>
        </div>
      </div>
    </div>
  `;
  DOM.chatMessages.appendChild(assistantRow);
  lucide.createIcons();
  scrollToBottom();

  const streamingTextSpan = assistantRow.querySelector('#streamingText');
  const activeWebSourcesDiv = assistantRow.querySelector('#activeWebSources');
  const markdownContainer = assistantRow.querySelector('.markdown-body');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: currentChat.messages.slice(0, -1),
        model: state.config.provider,
        customConfig: state.config,
        enableWebSearch: state.webSearchEnabled,
        systemPrompt: state.config.systemPrompt
      })
    });

    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      let eventType = null;
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.replace('event: ', '').trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.replace('data: ', '').trim());
            
            if (eventType === 'status') {
              DOM.searchIndicator.classList.remove('hidden');
              DOM.searchIndicatorText.textContent = data.message;
            } else if (eventType === 'web_results') {
              assistantMsg.webSources = data.results;
              activeWebSourcesDiv.classList.remove('hidden');
              activeWebSourcesDiv.innerHTML = `
                <div class="flex items-center gap-1.5 font-semibold text-emerald-400 mb-2">
                  <i data-lucide="globe" class="w-3.5 h-3.5"></i>
                  <span>Sources web citées (${data.results.length}) :</span>
                </div>
                <div class="space-y-1.5">
                  ${data.results.map((s, idx) => `
                    <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="block hover:underline truncate text-[#a3a3a3] hover:text-emerald-300">
                      <span class="font-mono text-[10px] text-emerald-400 font-bold">[${idx + 1}]</span> ${escapeHtml(s.title || s.url)}
                    </a>
                  `).join('')}
                </div>
              `;
              lucide.createIcons();
            } else if (eventType === 'token') {
              DOM.searchIndicator.classList.add('hidden');
              assistantMsg.content += data.token;
              streamingTextSpan.innerHTML = marked.parse(assistantMsg.content);
              scrollToBottom();
            } else if (eventType === 'error') {
              assistantMsg.content += `\n\n> ⚠️ **Erreur** : ${data.message}`;
              streamingTextSpan.innerHTML = marked.parse(assistantMsg.content);
            }
          } catch (e) {}
        }
      }
    }

  } catch (err) {
    assistantMsg.content = `> ⚠️ **Connexion interrompue** : ${err.message}`;
  } finally {
    DOM.searchIndicator.classList.add('hidden');
    state.isGenerating = false;
    markdownContainer.classList.remove('streaming-cursor');
    saveConversations();
    renderMessages();
    updateSendButtonState();
  }
}

// -------------------------------------------------------------
// ÉVÉNEMENTS
// -------------------------------------------------------------
function setupEventListeners() {
  // Gestion Sidebar Responsive (Mobile & Desktop)
  DOM.openSidebarBtn.onclick = openMobileSidebar;
  DOM.closeSidebarBtn.onclick = closeMobileSidebar;
  if (DOM.sidebarBackdrop) {
    DOM.sidebarBackdrop.onclick = closeMobileSidebar;
  }

  DOM.newChatBtn.onclick = () => createNewConversation();

  DOM.messageInput.addEventListener('input', () => {
    adjustTextareaHeight();
    updateSendButtonState();
  });

  DOM.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  DOM.sendBtn.onclick = handleSendMessage;

  DOM.webSearchToggle.onclick = () => {
    state.webSearchEnabled = !state.webSearchEnabled;
    updateWebSearchUI();
  };

  DOM.modelSelectorBtn.onclick = () => {
    DOM.modelDropdown.classList.toggle('hidden');
  };

  document.addEventListener('click', (e) => {
    if (!DOM.modelSelectorBtn.contains(e.target) && !DOM.modelDropdown.contains(e.target)) {
      DOM.modelDropdown.classList.add('hidden');
    }
  });

  DOM.modelDropdown.querySelectorAll('button[data-model]').forEach(btn => {
    btn.onclick = () => {
      const model = btn.getAttribute('data-model');
      state.config.provider = model;
      saveConfig();
      updateModelSelectorLabel();
      DOM.modelDropdown.classList.add('hidden');
    };
  });

  DOM.openSettingsBtn.onclick = openSettings;
  DOM.closeSettingsModal.onclick = closeSettings;
  DOM.cancelSettingsBtn.onclick = closeSettings;
  DOM.saveSettingsBtn.onclick = saveSettings;

  document.querySelectorAll('.prompt-suggestion').forEach(btn => {
    btn.onclick = () => {
      const text = btn.querySelector('p').textContent;
      DOM.messageInput.value = text;
      adjustTextareaHeight();
      updateSendButtonState();
      handleSendMessage();
    };
  });
}

function updateWebSearchUI() {
  if (state.webSearchEnabled) {
    DOM.webSearchToggle.classList.add('bg-emerald-950/60', 'border-emerald-600/50', 'text-emerald-400');
    DOM.webSearchToggle.classList.remove('text-[#8e8e8e]', 'bg-[#262626]');
    DOM.webSearchBadge.classList.remove('bg-[#666666]');
    DOM.webSearchBadge.classList.add('bg-emerald-400');
  } else {
    DOM.webSearchToggle.classList.remove('bg-emerald-950/60', 'border-emerald-600/50', 'text-emerald-400');
    DOM.webSearchToggle.classList.add('text-[#8e8e8e]', 'bg-[#262626]');
    DOM.webSearchBadge.classList.add('bg-[#666666]');
    DOM.webSearchBadge.classList.remove('bg-emerald-400');
  }
}

function updateModelSelectorLabel() {
  const map = {
    sso: 'GPT-4o (Codex SSO)',
    openai: 'OpenAI (GPT-4o)',
    gemini: 'Gemini 2.0 Flash',
    ollama: 'Ollama Local',
    custom: 'API Custom'
  };
  DOM.currentModelLabel.textContent = map[state.config.provider] || 'GPT-4o (SSO)';
}

function openSettings() {
  DOM.configProvider.value = state.config.provider || 'sso';
  DOM.configEndpoint.value = state.config.ssoEndpoint || '';
  DOM.configModel.value = state.config.model || '';
  DOM.configApiKey.value = state.config.apiKey || '';
  DOM.configSystemPrompt.value = state.config.systemPrompt || '';
  DOM.configDefaultWebSearch.checked = state.config.defaultWebSearch || false;
  DOM.settingsModal.classList.remove('hidden');
}

function closeSettings() {
  DOM.settingsModal.classList.add('hidden');
}

function saveSettings() {
  state.config.provider = DOM.configProvider.value;
  state.config.ssoEndpoint = DOM.configEndpoint.value.trim();
  state.config.model = DOM.configModel.value.trim();
  state.config.apiKey = DOM.configApiKey.value.trim();
  state.config.systemPrompt = DOM.configSystemPrompt.value.trim();
  state.config.defaultWebSearch = DOM.configDefaultWebSearch.checked;
  state.webSearchEnabled = state.config.defaultWebSearch;

  saveConfig();
  updateWebSearchUI();
  updateModelSelectorLabel();
  closeSettings();
}

function adjustTextareaHeight() {
  DOM.messageInput.style.height = 'auto';
  DOM.messageInput.style.height = Math.min(DOM.messageInput.scrollHeight, 180) + 'px';
}

function updateSendButtonState() {
  DOM.sendBtn.disabled = DOM.messageInput.value.trim() === '' || state.isGenerating;
}

function escapeHtml(string) {
  const div = document.createElement('div');
  div.innerText = string;
  return div.innerHTML;
}

function openMobileSidebar() {
  DOM.sidebar.classList.remove('-translate-x-full');
  if (DOM.sidebarBackdrop) DOM.sidebarBackdrop.classList.remove('hidden');
}

function closeMobileSidebar() {
  DOM.sidebar.classList.add('-translate-x-full');
  if (DOM.sidebarBackdrop) DOM.sidebarBackdrop.classList.add('hidden');
}
