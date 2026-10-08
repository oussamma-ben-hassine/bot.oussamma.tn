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
  currentTheme: 'light',
  user: null,
  config: {
    provider: 'sso',
    ssoEndpoint: 'https://sso-a.oussamma.tn/api/v1/integrations/ai/prompt',
    model: 'gpt-4o',
    apiKey: '',
    systemPrompt: "Tu es un assistant IA conversationnel moderne, précis et serviable. Réponds avec intelligence et structure toujours tes réponses avec du beau Markdown.",
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
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIconSun: document.getElementById('themeIconSun'),
  themeIconMoon: document.getElementById('themeIconMoon'),
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
  openMonitoringBtn: document.getElementById('openMonitoringBtn'),
  closeMonitoringModal: document.getElementById('closeMonitoringModal'),
  closeMonitoringFooterBtn: document.getElementById('closeMonitoringFooterBtn'),
  refreshMonitoringBtn: document.getElementById('refreshMonitoringBtn'),
  monitoringModal: document.getElementById('monitoringModal'),
  statTotalCalls: document.getElementById('statTotalCalls'),
  statSuccessCalls: document.getElementById('statSuccessCalls'),
  statFailedCalls: document.getElementById('statFailedCalls'),
  statTopProvider: document.getElementById('statTopProvider'),
  monitoringLogsBody: document.getElementById('monitoringLogsBody')
};

// Initialisation de l'application
async function initApp() {
  initTheme();
  loadConfig();
  loadConversations();
  setupEventListeners();
  await checkAuthStatus();

  if (state.conversations.length > 0) {
    selectConversation(state.conversations[0].id);
  } else {
    createNewConversation();
  }

  // Si on revient d'une reconnexion réussie, purger l'ancien message d'erreur
  if (window.location.search.includes('reconnected=1')) {
    window.history.replaceState({}, document.title, window.location.pathname);
    const currentChat = getCurrentConversation();
    if (currentChat && currentChat.messages && currentChat.messages.length > 0) {
      const lastMsg = currentChat.messages[currentChat.messages.length - 1];
      if (lastMsg.role === 'assistant' && (lastMsg.content.includes('Session SSO expirée') || lastMsg.content.includes('session SSO a expiré'))) {
        currentChat.messages.pop();
        saveConversations();
        renderMessages();
      }
    }
  }
}

// -------------------------------------------------------------
// GESTION DU THÈME CLAIR / SOMBRE (Par défaut : Clair)
// -------------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem('bot_oussamma_theme') || 'light';
  setTheme(savedTheme);
}

function setTheme(theme) {
  state.currentTheme = theme;
  localStorage.setItem('bot_oussamma_theme', theme);
  const html = document.documentElement;

  const hljsLight = document.getElementById('hljsLight');
  const hljsDark = document.getElementById('hljsDark');

  if (theme === 'dark') {
    html.classList.add('dark');
    html.classList.remove('light');
    DOM.themeIconSun.classList.remove('hidden');
    DOM.themeIconMoon.classList.add('hidden');
    if (hljsLight) hljsLight.disabled = true;
    if (hljsDark) hljsDark.disabled = false;
  } else {
    html.classList.remove('dark');
    html.classList.add('light');
    DOM.themeIconSun.classList.add('hidden');
    DOM.themeIconMoon.classList.remove('hidden');
    if (hljsLight) hljsLight.disabled = false;
    if (hljsDark) hljsDark.disabled = true;
  }
}

function toggleTheme() {
  const newTheme = state.currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
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

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.status === 401) {
      window.location.href = '/auth/login';
      return;
    }
    const data = await res.json();
    if (data.authenticated && data.user) {
      state.user = data.user;
      DOM.userName.textContent = data.user.name || 'Oussama';
      DOM.userStatus.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> SSO Connecté`;
      
      if (data.user.avatar) {
        DOM.userAvatar.innerHTML = `<img src="${data.user.avatar}" class="w-full h-full rounded-full object-cover">`;
      } else {
        const initial = (data.user.name || 'O').charAt(0).toUpperCase();
        DOM.userAvatar.textContent = initial;
      }

      // Gestion de la visibilité des paramètres IA et du Monitoring (Réservé au Superadmin)
      const isSuperAdmin = Boolean(data.user.is_superadmin);
      if (DOM.openSettingsBtn) {
        if (isSuperAdmin) {
          DOM.openSettingsBtn.classList.remove('hidden');
          DOM.openSettingsBtn.title = 'Paramètres IA (Superadmin)';
        } else {
          DOM.openSettingsBtn.classList.add('hidden');
        }
      }

      if (DOM.openMonitoringBtn) {
        if (isSuperAdmin) {
          DOM.openMonitoringBtn.classList.remove('hidden');
          DOM.openMonitoringBtn.title = 'Monitoring & Historique IA (Superadmin)';
        } else {
          DOM.openMonitoringBtn.classList.add('hidden');
        }
      }

      // Charger les modèles configurés par le Superadmin
      await loadAvailableModels(isSuperAdmin);

      DOM.authBtn.title = 'Déconnexion SSO';
      DOM.authBtn.innerHTML = `<i data-lucide="log-out" class="w-4 h-4 text-slate-400 hover:text-red-500"></i>`;
      DOM.authBtn.onclick = () => window.location.href = '/auth/logout';
    } else {
      window.location.href = '/auth/login';
    }
    lucide.createIcons();
  } catch (e) {
    console.error('Erreur vérification SSO:', e);
  }
}

// -------------------------------------------------------------
// CHARGEMENT DYNAMIQUE DES MODÈLES CONFIGURÉS PAR LE SUPERADMIN
// -------------------------------------------------------------
async function loadAvailableModels(isSuperAdmin = false) {
  try {
    const res = await fetch('/api/models/available');
    if (!res.ok) return;
    const data = await res.json();
    const availableModels = data.models || [];

    if (availableModels.length === 0) return;

    state.availableModels = availableModels;

    // Si le provider actuel n'est pas dans la liste des modèles configurés, basculer sur le premier
    const exists = availableModels.some(m => m.id === state.config.provider);
    if (!exists) {
      state.config.provider = availableModels[0].id;
      saveConfig();
    }

    renderModelDropdown(availableModels);
    updateModelSelectorLabel();
  } catch (err) {
    console.warn('Erreur chargement modèles disponibles:', err);
  }
}

function renderModelDropdown(models) {
  if (!DOM.modelDropdown) return;

  const current = state.config.provider || 'sso';

  let html = `
    <div class="px-3.5 py-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
      <span>Modèles Configurés</span>
      <span class="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md font-semibold">Par Superadmin</span>
    </div>
    <div class="py-1">
  `;

  for (const m of models) {
    const isSelected = m.id === current;
    const badgeColor = m.id === 'gemini' 
      ? 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300'
      : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';

    html += `
      <button class="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-[#2c2c2c] flex items-center justify-between group transition ${isSelected ? 'bg-slate-100 dark:bg-[#2c2c2c]' : ''}" data-model="${m.id}">
        <div class="truncate pr-2">
          <div class="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-blue-600 flex items-center gap-1.5 truncate">
            <i data-lucide="${m.icon || 'sparkles'}" class="w-3.5 h-3.5 ${m.id === 'gemini' ? 'text-purple-500' : 'text-blue-500'} shrink-0"></i>
            <span class="truncate">${m.name}</span>
          </div>
          <div class="text-[10px] text-slate-400 truncate">${m.description || ''}</div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <span class="text-[9px] ${badgeColor} px-1.5 py-0.5 rounded-full font-semibold border">${m.badge || 'Prêt'}</span>
          ${isSelected ? '<span class="active-check text-[11px] font-bold text-emerald-600 dark:text-emerald-400 ml-1">✓</span>' : ''}
        </div>
      </button>
    `;
  }

  html += `</div>`;
  DOM.modelDropdown.innerHTML = html;

  DOM.modelDropdown.querySelectorAll('button[data-model]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const selectedId = btn.getAttribute('data-model');
      if (selectedId) {
        state.config.provider = selectedId;
        saveConfig();
        renderModelDropdown(state.availableModels || models);
        updateModelSelectorLabel();
        DOM.modelDropdown.classList.add('hidden');
      }
    });
  });

  lucide.createIcons();
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
    btn.className = `group flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer text-xs font-medium transition duration-150 ${
      isActive 
        ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-[#212121] dark:text-white' 
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-[#b4b4b4] dark:hover:text-white dark:hover:bg-[#212121]/60'
    }`;
    
    btn.innerHTML = `
      <div class="flex items-center gap-2 truncate">
        <i data-lucide="message-square" class="w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600 dark:text-white' : 'text-slate-400'}"></i>
        <span class="truncate">${escapeHtml(chat.title)}</span>
      </div>
      <button class="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-slate-400 transition" title="Supprimer">
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
    // Sources Web si présentes
    const sourcesHtml = msg.webSources && msg.webSources.length > 0 ? `
      <div class="mb-3 p-3 rounded-2xl bg-blue-50/70 dark:bg-[#242424] border border-blue-100 dark:border-[#383838] text-xs text-slate-700 dark:text-[#d1d1d1]">
        <div class="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 mb-2">
          <i data-lucide="globe" class="w-3.5 h-3.5"></i>
          <span>Sources web consultées (${msg.webSources.length}) :</span>
        </div>
        <div class="space-y-1.5">
          ${msg.webSources.map((s, idx) => `
            <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="block hover:underline truncate text-slate-600 hover:text-blue-600 dark:text-[#a3a3a3] dark:hover:text-blue-400">
              <span class="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">[${idx + 1}]</span> ${escapeHtml(s.title || s.url)}
            </a>
          `).join('')}
        </div>
      </div>
    ` : '';

    row.innerHTML = `
      <div class="flex gap-3 sm:gap-4 w-full">
        <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
          <i data-lucide="sparkles" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 overflow-hidden space-y-2">
          ${sourcesHtml}
          <div class="assistant-message markdown-body">
            ${marked.parse(msg.content || '')}
          </div>
          <div class="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
            <button class="copy-msg-btn flex items-center gap-1 hover:text-slate-700 dark:hover:text-white transition" title="Copier">
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
        copyBtn.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-emerald-500"></i> Copié !`;
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

    let lang = 'code';
    codeEl.classList.forEach(cls => {
      if (cls.startsWith('language-')) lang = cls.replace('language-', '');
    });

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
      copyBtn.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-emerald-500"></i><span>Copié !</span>';
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
// ENVOI & STREAMING AVEC DYNAMISME IA (THINKING ACCORDION)
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

  // 2. Message Assistant temporaire avec Dynamisme IA
  state.isGenerating = true;
  DOM.sendBtn.disabled = true;

  const assistantMsg = { role: 'assistant', content: '', webSources: [] };
  currentChat.messages.push(assistantMsg);

  const assistantRow = document.createElement('div');
  assistantRow.className = 'flex justify-start animate-fade-in w-full';
  assistantRow.innerHTML = `
    <div class="flex gap-3 sm:gap-4 w-full">
      <div id="activeAiAvatar" class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
        <i data-lucide="sparkles" class="w-4 h-4"></i>
      </div>
      <div class="flex-1 overflow-hidden space-y-2">
        <div id="activeWebSources" class="hidden mb-3 p-3 rounded-2xl bg-blue-50/70 dark:bg-[#242424] border border-blue-100 dark:border-[#383838] text-xs text-slate-700 dark:text-[#d1d1d1]"></div>
        
        <div class="assistant-message markdown-body">
          <span id="streamingText">
            <span class="typing-dots">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </span>
          </span>
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
  const activeAiAvatar = assistantRow.querySelector('#activeAiAvatar');

  try {
    let geminiDirectKey = state.config.apiKey?.trim() || state.geminiApiKey;
    if (state.config.provider === 'gemini' && !geminiDirectKey) {
      try {
        const credRes = await fetch('/api/gemini/credentials');
        if (credRes.ok) {
          const credData = await credRes.json();
          if (credData.apiKey) {
            geminiDirectKey = credData.apiKey;
            state.geminiApiKey = geminiDirectKey;
          }
        }
      } catch (e) {
        console.warn('Impossible de récupérer la clé Gemini depuis le coffre-fort:', e);
      }
    }

    if (state.config.provider === 'gemini' && geminiDirectKey) {
      // Format des contenus pour Gemini
      const geminiContents = [];
      const history = currentChat.messages.slice(0, -1);
      for (const m of history) {
        geminiContents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content || '' }]
        });
      }

      const geminiPayload = {
        contents: geminiContents
      };

      if (state.config.systemPrompt) {
        geminiPayload.system_instruction = {
          parts: [{ text: state.config.systemPrompt }]
        };
      }

      const geminiStreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse&key=${geminiDirectKey}`;

      const gRes = await fetch(geminiStreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(geminiPayload)
      });

      if (!gRes.ok) {
        const errTxt = await gRes.text().catch(() => '');
        throw new Error(`Google API ${gRes.status}: ${errTxt}`);
      }

      const reader = gRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let firstTokenReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', '').trim());
              const tokenText = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (tokenText) {
                assistantMsg.content += tokenText;
                streamingTextSpan.innerHTML = marked.parse(assistantMsg.content);
                scrollToBottom();
              }
            } catch (e) {}
          }
        }
      }

      if (!assistantMsg.content) {
        assistantMsg.content = '*(Aucune réponse textuelle reçue de Gemini)*';
      }
      return;
    }

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

    if (response.status === 401) {
      window.location.href = '/auth/login';
      return;
    }

    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let firstTokenReceived = false;

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
                <div class="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 mb-2">
                  <i data-lucide="globe" class="w-3.5 h-3.5"></i>
                  <span>Sources web consultées (${data.results.length}) :</span>
                </div>
                <div class="space-y-1.5">
                  ${data.results.map((s, idx) => `
                    <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="block hover:underline truncate text-slate-600 hover:text-blue-600 dark:text-[#a3a3a3] dark:hover:text-blue-400">
                      <span class="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">[${idx + 1}]</span> ${escapeHtml(s.title || s.url)}
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
    activeAiAvatar.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i>`;
    markdownContainer.classList.remove('streaming-cursor');
    saveConversations();
    renderMessages();
    updateSendButtonState();
    lucide.createIcons();
  }
}

// -------------------------------------------------------------
// ÉVÉNEMENTS
// -------------------------------------------------------------
function setupEventListeners() {
  DOM.openSidebarBtn.onclick = openMobileSidebar;
  DOM.closeSidebarBtn.onclick = closeMobileSidebar;
  if (DOM.sidebarBackdrop) {
    DOM.sidebarBackdrop.onclick = closeMobileSidebar;
  }

  DOM.themeToggleBtn.onclick = toggleTheme;
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

  const toggleModelDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    DOM.modelDropdown.classList.toggle('hidden');
  };
  DOM.modelSelectorBtn.addEventListener('click', toggleModelDropdown);

  document.addEventListener('click', (e) => {
    if (DOM.modelDropdown && !DOM.modelSelectorBtn.contains(e.target) && !DOM.modelDropdown.contains(e.target)) {
      DOM.modelDropdown.classList.add('hidden');
    }
  });

  const selectModel = (model) => {
    if (!model) return;
    state.config.provider = model;
    saveConfig();
    updateModelSelectorLabel();
    DOM.modelDropdown.classList.add('hidden');
  };

  DOM.modelDropdown.querySelectorAll('button[data-model]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectModel(btn.getAttribute('data-model'));
    });
  });

  DOM.openSettingsBtn.onclick = openSettings;
  DOM.closeSettingsModal.onclick = closeSettings;
  DOM.cancelSettingsBtn.onclick = closeSettings;
  DOM.saveSettingsBtn.onclick = saveSettings;

  if (DOM.openMonitoringBtn) {
    DOM.openMonitoringBtn.onclick = openMonitoring;
  }
  if (DOM.closeMonitoringModal) {
    DOM.closeMonitoringModal.onclick = closeMonitoring;
  }
  if (DOM.closeMonitoringFooterBtn) {
    DOM.closeMonitoringFooterBtn.onclick = closeMonitoring;
  }
  if (DOM.refreshMonitoringBtn) {
    DOM.refreshMonitoringBtn.onclick = () => {
      loadMonitoringData();
    };
  }

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

// -------------------------------------------------------------
// ESPACE DE MONITORING DU PROXY IA (SUPERADMIN)
// -------------------------------------------------------------
async function openMonitoring() {
  if (!DOM.monitoringModal) return;
  DOM.monitoringModal.classList.remove('hidden');
  await loadMonitoringData();
}

function closeMonitoring() {
  if (DOM.monitoringModal) {
    DOM.monitoringModal.classList.add('hidden');
  }
}

async function loadMonitoringData() {
  if (DOM.refreshMonitoringBtn) {
    DOM.refreshMonitoringBtn.classList.add('animate-spin');
  }

  try {
    // 1. Récupérer les statistiques globales
    const statsRes = await fetch('/api/admin/monitoring/stats');
    if (statsRes.ok) {
      const stats = await statsRes.json();
      if (DOM.statTotalCalls) DOM.statTotalCalls.textContent = stats.total_calls ?? 0;
      if (DOM.statSuccessCalls) DOM.statSuccessCalls.textContent = stats.success_calls ?? 0;
      if (DOM.statFailedCalls) DOM.statFailedCalls.textContent = stats.failed_calls ?? 0;

      if (DOM.statTopProvider && stats.by_provider) {
        const top = Object.entries(stats.by_provider).sort((a, b) => b[1] - a[1])[0];
        DOM.statTopProvider.textContent = top ? `${top[0]} (${top[1]})` : 'Aucun';
      }
    }

    // 2. Récupérer l'historique détaillé des appels
    const logsRes = await fetch('/api/admin/monitoring/logs?limit=50');
    if (logsRes.ok) {
      const logs = await logsRes.json();
      renderMonitoringLogs(logs);
    }
  } catch (err) {
    console.error('Erreur chargement monitoring:', err);
  } finally {
    if (DOM.refreshMonitoringBtn) {
      setTimeout(() => DOM.refreshMonitoringBtn.classList.remove('animate-spin'), 400);
    }
  }
}

function renderMonitoringLogs(logs) {
  if (!DOM.monitoringLogsBody) return;

  if (!logs || logs.length === 0) {
    DOM.monitoringLogsBody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-slate-400">
          <div class="flex flex-col items-center justify-center gap-1.5">
            <i data-lucide="inbox" class="w-6 h-6 text-slate-300 dark:text-slate-600"></i>
            <p>Aucun appel au proxy IA enregistré pour le moment.</p>
          </div>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  let html = '';
  for (const log of logs) {
    const d = new Date(log.created_at);
    const dateFormatted = d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const isSuccess = log.details?.status === 'success';
    const statusBadge = isSuccess
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400">✓ 200 OK</span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400">✕ Erreur</span>`;

    const providerName = log.details?.provider || log.resource_id || 'inconnu';
    const modelName = log.details?.model || '';
    const userEmail = log.user_email || log.user_id || 'Utilisateur Anonyme';
    const mode = log.details?.mode === 'direct_streaming' ? 'Streaming Direct' : 'Proxy SSE';

    html += `
      <tr class="hover:bg-slate-50 dark:hover:bg-[#2a2a2a] transition">
        <td class="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
          ${dateFormatted}
        </td>
        <td class="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 max-w-[160px] truncate" title="${escapeHtml(userEmail)}">
          <div class="flex items-center gap-1.5 truncate">
            <div class="w-4 h-4 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center text-[9px] font-bold shrink-0">
              ${(userEmail.charAt(0) || 'U').toUpperCase()}
            </div>
            <span class="truncate">${escapeHtml(userEmail)}</span>
          </div>
        </td>
        <td class="py-2.5 px-3 text-slate-700 dark:text-slate-300">
          <div class="font-semibold text-xs capitalize flex items-center gap-1">
            <span>${escapeHtml(providerName)}</span>
          </div>
          ${modelName ? `<span class="font-mono text-[10px] text-slate-400">${escapeHtml(modelName)}</span>` : ''}
        </td>
        <td class="py-2.5 px-3">
          ${statusBadge}
        </td>
        <td class="py-2.5 px-3 text-[11px] text-slate-400 whitespace-nowrap">
          ${mode}
        </td>
      </tr>
    `;
  }

  DOM.monitoringLogsBody.innerHTML = html;
  lucide.createIcons();
}

function updateWebSearchUI() {
  if (state.webSearchEnabled) {
    DOM.webSearchToggle.classList.add('bg-blue-50', 'border-blue-400', 'text-blue-600', 'dark:bg-blue-950/60');
    DOM.webSearchToggle.classList.remove('text-slate-500', 'bg-slate-100');
    DOM.webSearchBadge.classList.remove('bg-slate-400');
    DOM.webSearchBadge.classList.add('bg-blue-600');
  } else {
    DOM.webSearchToggle.classList.remove('bg-blue-50', 'border-blue-400', 'text-blue-600', 'dark:bg-blue-950/60');
    DOM.webSearchToggle.classList.add('text-slate-500', 'bg-slate-100');
    DOM.webSearchBadge.classList.add('bg-slate-400');
    DOM.webSearchBadge.classList.remove('bg-blue-600');
  }
}

function updateModelSelectorLabel() {
  const current = state.config.provider || 'sso';
  
  if (state.availableModels && state.availableModels.length > 0) {
    const found = state.availableModels.find(m => m.id === current);
    if (found) {
      DOM.currentModelLabel.textContent = found.name;
    } else {
      DOM.currentModelLabel.textContent = current === 'gemini' ? 'Gemini 3.5 Flash' : 'GPT-4o (Codex SSO)';
    }
  } else {
    DOM.currentModelLabel.textContent = current === 'gemini' ? 'Gemini 3.5 Flash' : 'GPT-4o (Codex SSO)';
  }

  if (DOM.modelDropdown) {
    DOM.modelDropdown.querySelectorAll('button[data-model]').forEach(btn => {
      const isSelected = btn.getAttribute('data-model') === current;
      btn.classList.toggle('bg-slate-100', isSelected);
      btn.classList.toggle('dark:bg-[#333]', isSelected);
      
      let badge = btn.querySelector('.active-check');
      if (isSelected) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'active-check text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0';
          badge.textContent = '✓';
          btn.appendChild(badge);
        }
      } else if (badge) {
        badge.remove();
      }
    });
  }
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
  state.configSystemPrompt = DOM.configSystemPrompt.value.trim();
  state.configDefaultWebSearch = DOM.configDefaultWebSearch.checked;
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
