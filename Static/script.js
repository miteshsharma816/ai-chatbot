// Chat history management using localStorage
let currentChatId = null;
let chats = JSON.parse(localStorage.getItem('chatHistory')) || [];

$(document).ready(function () {
    loadChatHistory();

    // If no chats exist, create a new one
    if (chats.length === 0) {
        createNewChat();
    } else {
        // Load the most recent chat
        loadChat(chats[0].id);
    }

    // New Chat button
    $("#newChatBtn").on("click", function () {
        createNewChat();
    });

    // Chat form submission
    $("#chat-form").on("submit", function (e) {
        e.preventDefault();
        sendMessage();
    });

    // Handle Enter key
    $("#text").on("keypress", function (e) {
        if (e.which === 13 && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});

function createNewChat() {
    const chatId = Date.now().toString();
    const newChat = {
        id: chatId,
        title: "New Chat",
        messages: [],
        createdAt: new Date().toISOString()
    };

    chats.unshift(newChat);
    saveChats();
    loadChat(chatId);
    loadChatHistory();
}

function loadChat(chatId) {
    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);

    if (!chat) return;

    // Update UI
    $("#chatbox").empty();

    if (chat.messages.length === 0) {
        $("#chatbox").html(`
            <div class="welcome-message">
                <h2>Welcome to AI Assistant</h2>
                <p>Start a conversation by typing a message below.</p>
            </div>
        `);
    } else {
        chat.messages.forEach(msg => {
            appendMessage(msg.sender, msg.content);
        });
    }

    // Update active state in sidebar
    $(".chat-history-item").removeClass("active");
    $(`.chat-history-item[data-chat-id="${chatId}"]`).addClass("active");

    scrollToBottom();
}

function loadChatHistory() {
    const historyContainer = $("#chatHistory");
    historyContainer.empty();

    if (chats.length === 0) {
        historyContainer.html('<p style="color: #6e6e6e; font-size: 13px; padding: 8px;">No chats yet</p>');
        return;
    }

    chats.forEach(chat => {
        const chatItem = $(`
            <div class="chat-history-item" data-chat-id="${chat.id}">
                ${escapeHtml(chat.title)}
            </div>
        `);

        chatItem.on("click", function () {
            loadChat(chat.id);
        });

        historyContainer.append(chatItem);
    });
}

function sendMessage() {
    const rawText = $("#text").val().trim();
    if (rawText === "") return;

    // Find current chat
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    // Hide welcome message if present
    $(".welcome-message").remove();

    // Add user message
    appendMessage("user", rawText);
    chat.messages.push({ sender: "user", content: rawText });

    // Update chat title if it's the first message
    if (chat.messages.length === 1) {
        chat.title = rawText.substring(0, 30) + (rawText.length > 30 ? "..." : "");
        loadChatHistory();
    }

    saveChats();
    $("#text").val("");
    scrollToBottom();

    // Show typing indicator
    const loadingId = "loading-" + Date.now();
    const loadingHtml = `<div class="message bot-message loading" id="${loadingId}"><div class="message-content">Typing...</div></div>`;
    $("#chatbox").append(loadingHtml);
    scrollToBottom();

    // Send to backend
    $.ajax({
        type: "POST",
        url: "/get",
        data: { msg: rawText },
        success: function (data) {
            $(`#${loadingId}`).remove();
            const formattedData = data.replace(/\n/g, "<br>");
            appendMessage("bot", formattedData);

            // Save bot response
            chat.messages.push({ sender: "bot", content: data });
            saveChats();
            scrollToBottom();
        },
        error: function () {
            $(`#${loadingId}`).remove();
            appendMessage("bot", "Sorry, something went wrong. Please try again.");
            scrollToBottom();
        }
    });
}

function appendMessage(sender, content) {
    const messageClass = sender === "user" ? "user-message" : "bot-message";
    const formattedContent = content.replace(/\n/g, "<br>");
    const messageHtml = `
        <div class="message ${messageClass}">
            <div class="message-content">${formattedContent}</div>
        </div>
    `;
    $("#chatbox").append(messageHtml);
}

function scrollToBottom() {
    const chatbox = document.getElementById("chatbox");
    chatbox.scrollTop = chatbox.scrollHeight;
}

function saveChats() {
    localStorage.setItem('chatHistory', JSON.stringify(chats));
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
