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
    ssoEndpoint: 'https://sso-a.oussamma.tn/api/ai',
    model: 'default-model',
    apiKey: '',
    systemPrompt: "Tu es un assistant IA intelligent, précis et serviable pour bot.oussamma.tn. Réponds avec pertinence et structure tes réponses avec du beau Markdown.",
    defaultWebSearch: false
  }
};

// Éléments du DOM
const DOM = {
  sidebar: document.getElementById('sidebar'),
  openSidebarBtn: document.getElementById('openSidebarBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  conversationsList: document.getElementById('conversationsList'),
  userAvatar: document.getElementById('userAvatar'),
  userName: document.getElementById('userName'),
  userStatus: document.getElementById('userStatus'),
  authBtn: document.getElementById('authBtn'),
  ssoBadge: document.getElementById('ssoBadge'),
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
  configDefaultWebSearch: document.getElementById('configDefaultWebSearch'),
  clearAllChatsBtn: document.getElementById('clearAllChatsBtn')
};

// Initialisation de l'application
async function initApp() {
  loadConfig();
  loadConversations();
  setupEventListeners();
  await checkAuthStatus();

  // Si des discussions existent, charger la plus récente, sinon écran d'accueil
  if (state.conversations.length > 0) {
    selectConversation(state.conversations[0].id);
  } else {
    createNewConversation();
  }
}

// -------------------------------------------------------------
// GESTION DU STOCKAGE LOCAL (LocalStorage)
// -------------------------------------------------------------
function loadConfig() {
  const saved = localStorage.getItem('bot_oussamma_config');
  if (saved) {
    try {
      state.config = { ...state.config, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Erreur chargement configuration:', e);
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
      DOM.userName.textContent = data.user.name || 'Utilisateur SSO';
      DOM.userStatus.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span> Connecté SSO`;
      
      if (data.user.avatar) {
        DOM.userAvatar.innerHTML = `<img src="${data.user.avatar}" class="w-full h-full rounded-full object-cover">`;
      } else {
        const initial = (data.user.name || 'U').charAt(0).toUpperCase();
        DOM.userAvatar.textContent = initial;
      }

      DOM.authBtn.title = 'Déconnexion SSO';
      DOM.authBtn.innerHTML = `<i data-lucide="log-out" class="w-4 h-4 text-slate-400 hover:text-red-400"></i>`;
      DOM.authBtn.onclick = () => window.location.href = '/auth/logout';
      DOM.ssoBadge.classList.remove('hidden');
      DOM.ssoBadge.classList.add('flex');
    } else {
      DOM.userName.textContent = 'Invité';
      DOM.userStatus.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span> Non connecté`;
      DOM.userAvatar.textContent = '?';
      DOM.authBtn.title = 'Connexion via SSO';
      DOM.authBtn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4 text-blue-400"></i>`;
      DOM.authBtn.onclick = () => window.location.href = '/auth/login';
      DOM.ssoBadge.classList.add('hidden');
    }
    lucide.createIcons();
  } catch (e) {
    console.error('Erreur vérification SSO:', e);
  }
}

// -------------------------------------------------------------
// GESTION DES CONVERSATIONS
// -------------------------------------------------------------
function createNewConversation() {
  const newChat = {
    id: 'chat_' + Date.now(),
    title: 'Nouvelle discussion',
    createdAt: new Date().toISOString(),
    messages: []
  };

  state.conversations.unshift(newChat);
  state.currentConversationId = newChat.id;
  saveConversations();
  renderConversationsList();
  renderMessages();
}

function selectConversation(id) {
  state.currentConversationId = id;
  renderConversationsList();
  renderMessages();
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
    btn.className = `group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs font-medium transition duration-150 ${
      isActive ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
    }`;
    
    btn.innerHTML = `
      <div class="flex items-center gap-2 truncate">
        <i data-lucide="message-square" class="w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}"></i>
        <span class="truncate">${chat.title}</span>
      </div>
      <button class="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition" title="Supprimer">
        <i data-lucide="trash" class="w-3.5 h-3.5"></i>
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
// RENDU DU CHAT ET MESSAGES
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
  row.className = `flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`;

  if (isUser) {
    row.innerHTML = `
      <div class="max-w-[85%] sm:max-w-[75%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md">
        <p class="text-sm whitespace-pre-wrap leading-relaxed">${escapeHtml(msg.content)}</p>
      </div>
    `;
  } else {
    // Message Assistant
    const sourcesHtml = msg.webSources && msg.webSources.length > 0 ? `
      <div class="mb-3 p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/60 text-xs text-slate-300">
        <div class="flex items-center gap-1.5 font-semibold text-blue-400 mb-2">
          <i data-lucide="globe" class="w-3.5 h-3.5"></i>
          <span>Sources web trouvées (${msg.webSources.length}) :</span>
        </div>
        <div class="space-y-1.5">
          ${msg.webSources.map((s, idx) => `
            <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="block hover:underline truncate text-slate-400 hover:text-blue-300">
              <span class="font-mono text-[10px] text-blue-400 font-bold">[${idx + 1}]</span> ${escapeHtml(s.title || s.url)}
            </a>
          `).join('')}
        </div>
      </div>
    ` : '';

    row.innerHTML = `
      <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
        <i data-lucide="bot" class="w-4 h-4 text-white"></i>
      </div>
      <div class="flex-1 max-w-[90%] sm:max-w-[85%] space-y-2">
        ${sourcesHtml}
        <div class="bg-[#172033] border border-slate-800/80 rounded-2xl rounded-tl-sm p-4 text-slate-200 markdown-body shadow-sm">
          ${marked.parse(msg.content || '')}
        </div>
        <div class="flex items-center gap-2 text-[11px] text-slate-500 pl-1">
          <button class="copy-msg-btn flex items-center gap-1 hover:text-slate-300 transition" title="Copier la réponse">
            <i data-lucide="copy" class="w-3 h-3"></i> Copier
          </button>
        </div>
      </div>
    `;

    // Gestion du bouton copier
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
  highlightCodeBlocks(row);
  lucide.createIcons();
}

function highlightCodeBlocks(container) {
  container.querySelectorAll('pre code').forEach((el) => {
    hljs.highlightElement(el);

    // Bouton de copie pour chaque bloc de code
    const pre = el.parentElement;
    if (!pre.querySelector('.code-copy-btn')) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn absolute top-2 right-2 px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] rounded-md flex items-center gap-1 transition';
      copyBtn.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i> Copier';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(el.innerText);
        copyBtn.innerText = 'Copié !';
        setTimeout(() => {
          copyBtn.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i> Copier';
          lucide.createIcons();
        }, 2000);
      };
      pre.appendChild(copyBtn);
    }
  });
}

function scrollToBottom() {
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

// -------------------------------------------------------------
// ENVOI DE MESSAGE ET STREAMING
// -------------------------------------------------------------
async function handleSendMessage() {
  const text = DOM.messageInput.value.trim();
  if (!text || state.isGenerating) return;

  let currentChat = getCurrentConversation();
  if (!currentChat) {
    createNewConversation();
    currentChat = getCurrentConversation();
  }

  // Si premier message, nommer la conversation
  if (currentChat.messages.length === 0) {
    currentChat.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
    renderConversationsList();
  }

  // 1. Ajouter le message utilisateur
  const userMsg = { role: 'user', content: text };
  currentChat.messages.push(userMsg);
  saveConversations();

  DOM.messageInput.value = '';
  adjustTextareaHeight();
  updateSendButtonState();
  renderMessages();

  // 2. Créer le message assistant vide avec curseur streaming
  state.isGenerating = true;
  DOM.sendBtn.disabled = true;

  const assistantMsg = { role: 'assistant', content: '', webSources: [] };
  currentChat.messages.push(assistantMsg);

  // Élément DOM d'attente
  const assistantRow = document.createElement('div');
  assistantRow.className = 'flex gap-3 sm:gap-4 justify-start animate-fade-in';
  assistantRow.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
      <i data-lucide="bot" class="w-4 h-4 text-white"></i>
    </div>
    <div class="flex-1 max-w-[90%] sm:max-w-[85%] space-y-2">
      <div id="activeWebSources" class="hidden mb-3 p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/60 text-xs text-slate-300"></div>
      <div class="bg-[#172033] border border-slate-800/80 rounded-2xl rounded-tl-sm p-4 text-slate-200 markdown-body shadow-sm streaming-cursor">
        <span id="streamingText"></span>
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

    if (!response.ok) {
      throw new Error(`Erreur serveur (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Reste non complet

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
                <div class="flex items-center gap-1.5 font-semibold text-blue-400 mb-2">
                  <i data-lucide="globe" class="w-3.5 h-3.5"></i>
                  <span>Sources web trouvées (${data.results.length}) :</span>
                </div>
                <div class="space-y-1.5">
                  ${data.results.map((s, idx) => `
                    <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="block hover:underline truncate text-slate-400 hover:text-blue-300">
                      <span class="font-mono text-[10px] text-blue-400 font-bold">[${idx + 1}]</span> ${escapeHtml(s.title || s.url)}
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
          } catch (e) {
            // Ligne de données incomplète ou format non JSON
          }
        }
      }
    }

  } catch (err) {
    console.error('Erreur streaming:', err);
    assistantMsg.content = `> ⚠️ **Impossible de joindre le service IA** : ${err.message}`;
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
// EVENT LISTENERS & UI
// -------------------------------------------------------------
function setupEventListeners() {
  // Sidebar toggles
  DOM.openSidebarBtn.onclick = () => DOM.sidebar.classList.remove('-translate-x-full');
  DOM.closeSidebarBtn.onclick = () => DOM.sidebar.classList.add('-translate-x-full');

  // Nouvelle conversation
  DOM.newChatBtn.onclick = () => createNewConversation();

  // Clear all chats
  DOM.clearAllChatsBtn.onclick = () => {
    if (confirm('Voulez-vous supprimer toutes les discussions ?')) {
      state.conversations = [];
      localStorage.removeItem('bot_oussamma_chats');
      createNewConversation();
    }
  };

  // Input auto-resize & envoi clavier
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

  // Web Search Toggle
  DOM.webSearchToggle.onclick = () => {
    state.webSearchEnabled = !state.webSearchEnabled;
    updateWebSearchUI();
  };

  // Modèle dropdown
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

  // Modal Paramètres
  DOM.openSettingsBtn.onclick = openSettings;
  DOM.closeSettingsModal.onclick = closeSettings;
  DOM.cancelSettingsBtn.onclick = closeSettings;
  DOM.saveSettingsBtn.onclick = saveSettings;

  // Clics sur suggestions d'accueil
  document.querySelectorAll('.prompt-suggestion').forEach(btn => {
    btn.onclick = () => {
      const text = btn.querySelector('p:last-child').textContent;
      DOM.messageInput.value = text;
      adjustTextareaHeight();
      updateSendButtonState();
      handleSendMessage();
    };
  });
}

function updateWebSearchUI() {
  if (state.webSearchEnabled) {
    DOM.webSearchToggle.classList.add('bg-blue-600/30', 'border-blue-500/60', 'text-blue-300');
    DOM.webSearchToggle.classList.remove('text-slate-400');
    DOM.webSearchBadge.classList.remove('bg-slate-500');
    DOM.webSearchBadge.classList.add('bg-emerald-400');
  } else {
    DOM.webSearchToggle.classList.remove('bg-blue-600/30', 'border-blue-500/60', 'text-blue-300');
    DOM.webSearchToggle.classList.add('text-slate-400');
    DOM.webSearchBadge.classList.add('bg-slate-500');
    DOM.webSearchBadge.classList.remove('bg-emerald-400');
  }
}

function updateModelSelectorLabel() {
  const map = {
    sso: 'SSO LLM (Défaut)',
    openai: 'OpenAI (GPT-4o)',
    gemini: 'Google Gemini',
    ollama: 'Ollama Local',
    custom: 'API Custom'
  };
  DOM.currentModelLabel.textContent = map[state.config.provider] || 'SSO LLM';
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
