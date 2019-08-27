import * as vscode from 'vscode';
import { Commands } from '../../commands/common';

export class StatusBarCache {
    statusBarItem: vscode.StatusBarItem;
    private timeoutId?: NodeJS.Timer;

    constructor(
        command: string = Commands.CacheWorkspace,
        alignment?: vscode.StatusBarAlignment,
        priority: number = 0
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            alignment,
            priority
        );
        this.statusBarItem.command = command;
    }

    notify(icon: string, text: string, autoHide: boolean = true): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        this.statusBarItem.show();
        this.statusBarItem.text = `$(${icon}) ${text}`;
        this.statusBarItem.tooltip = undefined;

        if (autoHide) {
            this.timeoutId = setTimeout(() => {
                this.statusBarItem.text = `$(${icon})`;
                this.statusBarItem.tooltip = text;
            }, 5000);
        }
    }
}

export const statusBarCache: StatusBarCache = new StatusBarCache();