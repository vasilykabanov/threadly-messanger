import React from "react";
import ReactDOM from "react-dom";
import {RecoilRoot} from "recoil";
import recoilPersist from "recoil-persist";
import "./index.css";
import App from "./App";

const {RecoilPersist, updateState} = recoilPersist([], {
    key: "recoil-persist",
    storage: sessionStorage,
});

ReactDOM.render(
    <RecoilRoot initializeState={updateState}>
        <RecoilPersist/>
        <App/>
    </RecoilRoot>,
    document.getElementById("root")
);

// Service worker для push-уведомлений регистрируется в Chat.js
// Не используем стандартный CRA serviceWorker, чтобы избежать конфликтов
