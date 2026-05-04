import React from "react";
import { createRoot } from "react-dom/client";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ActivityStream } from "./components/ActivityStream";
import { useConversationStore } from "./store/conversationStore";
import "./styles/globals.css";

/**
 * ForgeAI Webview Entry Point
 *
 * Main App Component - Renders the ForgeAI webview application.
 * Conditionally shows Welcome Screen or Activity Stream based on conversation state.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 22.1, 22.4
 */
function App() {
  const { isWelcomeScreenVisible } = useConversationStore();

  return (
    <div className="h-screen w-full">
      {isWelcomeScreenVisible ? <WelcomeScreen /> : <ActivityStream />}
    </div>
  );
}

// Mount the React application
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
