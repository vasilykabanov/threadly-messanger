import {atom} from "recoil";

const getInitialTheme = () => {
    if (typeof window === "undefined") return "legacy";
    try {
        return localStorage.getItem("uiTheme") || "legacy";
    } catch (error) {
        return "legacy";
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

export const uiTheme = atom({
    key: "uiTheme",
    default: getInitialTheme(),
});
