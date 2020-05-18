import * as vscode from 'vscode';
import { IWorkspaceCommandArgs } from '../../model/workspace';
import { AbstractCommand, CommandContext } from '../abstractCommand';
import { Command, Commands } from '../common';

@Command()
export class SwitchToWorkspaceCommand extends AbstractCommand {
    constructor() {
        super(Commands.SwitchToWorkspace);
    }

    async execute(context?: CommandContext, args: IWorkspaceCommandArgs = {}) {
        args = { ...args };

        let uri = vscode.Uri.file(args.workspace!.path);
        await vscode.commands.executeCommand('vscode.openFolder', uri, args.inNewWindow);
    }
}
