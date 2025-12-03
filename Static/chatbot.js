// Chat state
let currentConversationId = null;

$(document).ready(function () {
    loadConversations();

    // New Chat button
    $("#newChatBtn").on("click", function () {
        createNewConversation();
    });

    // Chat form submission
    $("#chat-form").on("submit", function (e) {
        e.preventDefault();
        sendMessage();
    });
});

async function loadConversations() {
    try {
        const response = await fetch('/get-conversations');
        const data = await response.json();

        if (data.success) {
            displayConversations(data.conversations);

            // Load the first conversation or create new one
            if (data.conversations.length > 0) {
                loadConversation(data.conversations[0].id);
            } else {
                createNewConversation();
            }
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

function displayConversations(conversations) {
    const historyContainer = $("#chatHistory");
    historyContainer.empty();

    if (conversations.length === 0) {
        historyContainer.html('<p style="color: #6e6e6e; font-size: 13px; padding: 8px;">No chats yet</p>');
        return;
    }

    conversations.forEach(conv => {
        const chatItem = $(`
            <div class="chat-history-item" data-conv-id="${conv.id}">
                ${escapeHtml(conv.title)}
            </div>
        `);

        chatItem.on("click", function () {
            loadConversation(conv.id);
        });

        historyContainer.append(chatItem);
    });
}

async function createNewConversation() {
    try {
        const response = await fetch('/new-conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            currentConversationId = data.conversation_id;

            // Clear chatbox
            $("#chatbox").html(`
                <div class="welcome-message">
                    <h2>Welcome to AI Assistant</h2>
                    <p>Start a conversation by typing a message below.</p>
                </div>
            `);

            // Reload conversation list
            loadConversations();
        }
    } catch (error) {
        console.error('Error creating conversation:', error);
    }
}

async function loadConversation(convId) {
    try {
        const response = await fetch(`/load-conversation/${convId}`);
        const data = await response.json();

        if (data.success) {
            currentConversationId = convId;

            // Clear chatbox
            $("#chatbox").empty();

            if (data.messages.length === 0) {
                $("#chatbox").html(`
                    <div class="welcome-message">
                        <h2>Welcome to AI Assistant</h2>
                        <p>Start a conversation by typing a message below.</p>
                    </div>
                `);
            } else {
                data.messages.forEach(msg => {
                    appendMessage(msg.sender, msg.content);
                });
            }

            // Update active state
            $(".chat-history-item").removeClass("active");
            $(`.chat-history-item[data-conv-id="${convId}"]`).addClass("active");

            // Update title
            $("#chatTitle").text(data.title);

            scrollToBottom();
        }
    } catch (error) {
        console.error('Error loading conversation:', error);
    }
}

async function sendMessage() {
    const rawText = $("#text").val().trim();
    if (rawText === "" || !currentConversationId) return;

    // Hide welcome message
    $(".welcome-message").remove();

    // Add user message to UI
    appendMessage("user", rawText);
    $("#text").val("");
    scrollToBottom();

    // Show typing indicator
    const loadingId = "loading-" + Date.now();
    const loadingHtml = `<div class="message bot-message loading" id="${loadingId}"><div class="message-content">Typing...</div></div>`;
    $("#chatbox").append(loadingHtml);
    scrollToBottom();

    try {
        const response = await fetch('/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversation_id: currentConversationId,
                message: rawText
            })
        });

        const data = await response.json();

        $(`#${loadingId}`).remove();

        if (data.success) {
            appendMessage("bot", data.response);
            scrollToBottom();

            // Reload conversations to update title
            loadConversations();
        } else {
            appendMessage("bot", "Sorry, something went wrong: " + data.message);
            scrollToBottom();
        }
    } catch (error) {
        $(`#${loadingId}`).remove();
        appendMessage("bot", "Network error. Please try again.");
        scrollToBottom();
    }
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
