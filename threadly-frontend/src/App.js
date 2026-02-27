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
import AdminRegistrationApproval from "./admin-registration/AdminRegistrationApproval";
import ForgotPassword from "./forgot-password/ForgotPassword";
import ResetPassword from "./reset-password/ResetPassword";
import "./App.css";
import PrivateRoute from "./PrivateRoute";
import {useRecoilValue} from "recoil";
import {uiThemeMode} from "./atom/globalState";

export const AppContext = React.createContext();
const App = (props) => {
    const themeMode = useRecoilValue(uiThemeMode);

    useEffect(() => {
        const nextMode = themeMode === "light" ? "theme-new-light" : "theme-new-dark";
        document.body.classList.remove("theme-new", "theme-new-light", "theme-new-dark");
        document.body.classList.add("theme-new", nextMode);
    }, [themeMode]);

    return (
        <div className="App theme-new">
            <BrowserRouter>
                <Switch>
                    <PrivateRoute exact path="/" component={Chat} />
                    <Route exact path="/login" render={(props) => <Signin {...props} />}/>
                    <Route exact path="/signup" render={(props) => <Signup {...props} />}/>
                    <Route exact path="/forgot-password" render={(props) => <ForgotPassword {...props} />}/>
                    <Route exact path="/reset-password" render={(props) => <ResetPassword {...props} />}/>
                    <Route exact path="/verify-email" render={(props) => <VerifyEmail {...props} />}/>
                    <Route exact path="/check-email" render={(props) => <CheckEmail {...props} />}/>
                    <Route exact path="/update-email" render={(props) => <UpdateEmail {...props} />}/>
                    <Route exact path="/admin/registration/approve" render={(props) => <AdminRegistrationApproval {...props} />}/>
                    <Route exact path="/admin/registration/reject" render={(props) => <AdminRegistrationApproval {...props} />}/>
                    <PrivateRoute exact path="/chat" component={Chat} />
                    <PrivateRoute exact path="/profile" component={Profile} />
                    <PrivateRoute exact path="/settings" component={Settings} />
                    <Redirect to="/login" />
                </Switch>
            </BrowserRouter>
        </div>
    );
};

export default App;
