import React from "react";
import {BrowserRouter, Redirect, Route, Switch} from "react-router-dom";
import Signin from "./signin/Signin";
import Signup from "./signup/Signup";
import Profile from "./profile/Profile";
import Chat from "./chat/Chat";
import Settings from "./settings/Settings";
import "./App.css";
import PrivateRoute from "./PrivateRoute";

export const AppContext = React.createContext();
const App = (props) => {
    return (
        <div className="App">
            <BrowserRouter>
                <Switch>
                    <Route exact path="/" render={(props) => <Profile {...props} />}/>
                    <Route exact path="/login" render={(props) => <Signin {...props} />}/>
                    <Route exact path="/signup" render={(props) => <Signup {...props} />}/>
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
