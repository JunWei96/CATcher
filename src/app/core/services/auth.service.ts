import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { NgZone } from '@angular/core';
import { ElectronService } from './electron.service';
import { UserService } from './user.service';
import { PhaseService } from './phase.service';
import { ErrorHandlingService } from './error-handling.service';
import { GithubService } from './github.service';
import { IssueService } from './issue.service';
import { DataService } from './data.service';
import { LabelService } from './label.service';
import { Title } from '@angular/platform-browser';
import { GithubEventService } from './githubevent.service';
import { uuid } from '../../shared/lib/uuid';
import { AppConfig } from '../../../environments/environment';

export enum AuthState { 'NotAuthenticated', 'AwaitingAuthentication', 'ConfirmOAuthUser', 'Authenticated'}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  readonly githubUrl = 'http://www.github.com';
  readonly githubDomain = 'github.com';
  readonly githubLoginCacheName = 'is_logged_in';

  authStateSource = new BehaviorSubject(AuthState.NotAuthenticated);
  currentAuthState = this.authStateSource.asObservable();
  accessToken = new BehaviorSubject(undefined);

  constructor(private electronService: ElectronService, private router: Router, private ngZone: NgZone,
              private http: HttpClient,  private errorHandlingService: ErrorHandlingService,
              private githubService: GithubService,
              private userService: UserService,
              private issueService: IssueService,
              private phaseService: PhaseService,
              private labelService: LabelService,
              private dataService: DataService,
              private githubEventService: GithubEventService,
              private titleService: Title) {}

  /**
   * Will store the OAuth token.
   */
  storeOAuthAccessToken(token: string) {
    this.accessToken.next(token);
  }

  reset(): void {
    this.accessToken.next(undefined);
    this.changeAuthState(AuthState.NotAuthenticated);
    this.ngZone.run(() => this.router.navigate(['']));
  }

  logOut(): void {
    this.githubService.reset();
    this.userService.reset();
    this.issueService.reset();
    this.phaseService.reset();
    this.dataService.reset();
    this.githubEventService.reset();
    this.titleService.setTitle(
      require('../../../../package.json').name
      .concat(' ')
      .concat(require('../../../../package.json').version)
    );
    this.issueService.setIssueTeamFilter('All Teams');
    this.reset();
  }

  isAuthenticated(): boolean {
    return this.authStateSource.getValue() === AuthState.Authenticated;
  }

  setLoginStatusWithGithub(isLoggedIn: boolean) {
    if (!isLoggedIn) {
      this.electronService.clearCookies();
    } else {
      this.electronService.setCookie(this.githubUrl, this.githubDomain, this.githubLoginCacheName, 'yes');
    }
  }

  changeAuthState(newAuthState: AuthState) {
    if (newAuthState === AuthState.Authenticated) {
      const sessionId = `${Date.now()}-${uuid()}`;
      this.issueService.setSessionId(sessionId);
      console.log(`Successfully authenticated with session: ${sessionId}`);
    }
    this.authStateSource.next(newAuthState);
  }

  /**
   * Will start the Github OAuth web flow process.
   * @param clearAuthState - A boolean to define whether to clear any auth cookies so prevent auto login.
   */
  startOAuthProcess(clearAuthState: boolean = false) {
    const githubRepoPermission = this.phaseService.githubRepoPermissionLevel();
    this.changeAuthState(AuthState.AwaitingAuthentication);
    this.electronService.sendIpcMessage('github-oauth', clearAuthState, githubRepoPermission);
    const authService = this;
    const oauthWindow = this.createOauthWindow(encodeURI(
      `${AppConfig.githubUrl}/login/oauth/authorize?client_id=${AppConfig.clientId}&scope=${githubRepoPermission},read:user`
    ));
    oauthWindow.addEventListener('unload', function(event) {
      if (!oauthWindow.closed) {
        authService.confirmWindowClosed(oauthWindow);
      }
    });
  }

  private confirmWindowClosed(window) {
    const authService = this;
    const pollTimer = window.setInterval(function() {
      if (window.closed) {
        window.clearInterval(pollTimer);
        if (!authService.accessToken) {
          authService.changeAuthState(AuthState.NotAuthenticated);
        }
      }
    }, 1000);
  }

  private createOauthWindow(url: string, name = 'Authorization', width = 500, height = 600, left = 0, top = 0) {
    if (url == null) {
      return null;
    }
    const options = `width=${width},height=${height},left=${left},top=${top}`;
    return window.open(`${url}`, name, options);
  }
}
