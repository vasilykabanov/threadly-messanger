import React, {useEffect} from "react";
import {BrowserRouter, Redirect, Route, Switch} from "react-router-dom";
import Signin from "./signin/Signin";
import Signup from "./signup/Signup";
import Profile from "./profile/Profile";
import Chat from "./chat/Chat";
import Settings from "./settings/Settings";
import VerifyEmail from "./verify-email/VerifyEmail";
import CheckEmail from "./check-email/CheckEmail";
import UpdateEmail from "./update-email/UpdateEmail";
import "./App.css";
import PrivateRoute from "./PrivateRoute";
import {useRecoilValue} from "recoil";
import {uiTheme, uiThemeMode} from "./atom/globalState";

export const AppContext = React.createContext();
const App = (props) => {
    const theme = useRecoilValue(uiTheme);
    const themeMode = useRecoilValue(uiThemeMode);

    useEffect(() => {
        const nextTheme = theme === "new" ? "theme-new" : "theme-legacy";
        const nextMode = themeMode === "light" ? "theme-new-light" : "theme-new-dark";
        document.body.classList.remove(
            "theme-new",
            "theme-legacy",
            "theme-new-light",
            "theme-new-dark"
        );
        document.body.classList.add(nextTheme);
        if (theme === "new") {
            document.body.classList.add(nextMode);
        }
    }, [theme, themeMode]);

    return (
        <div className={`App ${theme === "new" ? "theme-new" : "theme-legacy"}`}>
            <BrowserRouter>
                <Switch>
                    <PrivateRoute exact path="/" component={Profile} />
                    <Route exact path="/login" render={(props) => <Signin {...props} />}/>
                    <Route exact path="/signup" render={(props) => <Signup {...props} />}/>
                    <Route exact path="/verify-email" render={(props) => <VerifyEmail {...props} />}/>
                    <Route exact path="/check-email" render={(props) => <CheckEmail {...props} />}/>
                    <Route exact path="/update-email" render={(props) => <UpdateEmail {...props} />}/>
                    {/*<Route exact path="/chat" render={(props) => <Chat {...props} />}/>*/}
                    <PrivateRoute exact path="/chat" component={Chat} />
                    <PrivateRoute exact path="/settings" component={Settings} />
                    <Redirect to="/login" />
                </Switch>
            </BrowserRouter>
        </div>
    );
};

export default App;
