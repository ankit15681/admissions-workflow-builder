import React from "react";
import { Provider } from "react-redux";
import { store } from "./app/store";
import { WorkflowBuilderPage } from "./pages/WorkflowBuilderPage";
import "./styles/globals.css";

export function App() {
  return (
    <Provider store={store}>
      <WorkflowBuilderPage />
    </Provider>
  );
}
