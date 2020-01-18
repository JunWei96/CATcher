"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var nodeUrl = require('url');
var fetch = require('node-fetch');
var CLIENT_ID = '6750652c0c9001314434';
var BASE_URL = 'https://github.com';
var ACCESS_TOKEN_URL = 'https://catcher-proxy.herokuapp.com/authenticate';
var CALLBACK_URL = 'http://localhost:4200';
var authWindow;
/**
 * Will retrieve the access token from a proxy server which acts as a intermediary to retrieve the tokens from Github.
 * @param window - The main window of CATcher.
 * @param toClearAuthState - A boolean to define whether to clear any auth cookies so prevent auto login.
 */
function getAccessToken(window, toClearAuthState) {
    return getAuthorizationCode(window, toClearAuthState).then(function (code) {
        var accessTokenUrl = ACCESS_TOKEN_URL + "/" + code;
        return fetch(accessTokenUrl).then(function (res) { return res.json(); }).then(function (data) {
            if (data.error) {
                throw (new Error(data.error));
            }
            return data;
        });
    }).catch(function (error) {
        throw (error);
    });
}
exports.getAccessToken = getAccessToken;
/**
 * Get the authorization code from Github after success login.
 * @param parentWindow - The main window of CATcher
 * @param toClearAuthState - A boolean to define whether to clear any auth cookies so prevent auto login.
 */
function getAuthorizationCode(parentWindow, toClearAuthState) {
    var oauthUrl = encodeURI(BASE_URL + "/login/oauth/authorize?client_id=" + CLIENT_ID + "&scope=repo,read:user");
    return new Promise(function (resolve, reject) {
        var windowParams = {
            autoHideMenuBar: true,
            alwaysOnTop: true,
            movable: false,
            fullscreenable: false,
            parent: parentWindow,
            webPreferences: {
                nodeIntegration: true
            }
        };
        authWindow = new electron_1.BrowserWindow(windowParams);
        if (toClearAuthState) {
            authWindow.webContents.session.clearStorageData();
        }
        authWindow.loadURL(oauthUrl);
        authWindow.show();
        authWindow.on('closed', function (event) {
            reject(new Error('WINDOW_CLOSED'));
        });
        authWindow.webContents.on('will-navigate', function (event, newUrl) {
            if (newUrl.startsWith(CALLBACK_URL)) {
                onCallback(newUrl);
            }
        });
        authWindow.webContents.on('will-redirect', function (event, newUrl) {
            if (newUrl.startsWith(CALLBACK_URL)) {
                onCallback(newUrl);
            }
        });
        function onCallback(callbackUrl) {
            var url_parts = nodeUrl.parse(callbackUrl, true);
            var query = url_parts.query;
            var code = query.code;
            var error = query.error;
            var state = query.state;
            if (error !== undefined && state !== undefined) {
                reject(error);
            }
            else if (code) {
                resolve(code);
            }
            setImmediate(function () {
                authWindow.close();
                authWindow.on('closed', function () {
                    authWindow = null;
                });
            });
        }
    });
}
//# sourceMappingURL=oauth.js.map