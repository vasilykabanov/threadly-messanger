import {atom} from "recoil";

const getInitialThemeMode = () => {
    if (typeof window === "undefined") return "dark";
    try {
        return localStorage.getItem("uiThemeMode") || "dark";
    } catch (error) {
        return "dark";
    }
};


export const loggedInUser = atom({
    key: "loggedInUser",
    default: {},
    persistence_UNSTABLE: {
        type: "loggedInUser",
    },
});

export const chatActiveContact = atom({
    key: "chatActiveContact",
    persistence_UNSTABLE: {
        type: "chatActiveContact",
    },
});

export const chatMessages = atom({
    key: "chatMessages",
    default: [],
    persistence_UNSTABLE: {
        type: "chatMessages",
    },
});

export const uiThemeMode = atom({
    key: "uiThemeMode",
    default: getInitialThemeMode(),
});

