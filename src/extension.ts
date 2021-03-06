import * as vscode from 'vscode';
import { cacheWorkspace } from './cache/cacheWorkspace';
import { registerCommands } from './commands';
import { IConfig } from './config';
import { configuration, Configuration } from './configuration';
import {
    CommandContext,
    extensionOutputChannelName,
    GlyphChars,
    setCommandContext
} from './constants';
import { Container } from './container';
import { IOutputLevel, Logger } from './logger';
import { Strings } from './system';
import * as telemetry from './telemetry';
import { getExtension } from './util/getExtension';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(
    context: vscode.ExtensionContext
): Promise<void> {
    const start = process.hrtime();

    // Pretend we are enabled (until we know otherwise) and set the view contexts to reduce flashing on load
    setCommandContext(CommandContext.Enabled, true);

    Logger.configure(
        context,
        configuration.get<IOutputLevel>(
            configuration.name('advanced')('outputLevel').value
        ),
        o => undefined
    );

    telemetry.activate(context);

    const extension = getExtension()!;
    let version = '0.0.0';

    if (extension) {
        version = extension.packageJSON.version;
    }

    Configuration.configure(context);

    const cfg = configuration.get<IConfig>();

    try {
        Container.initialize(context, cfg, version);

        registerCommands(context);
    } catch (e) {
        Logger.error(e, 'Error initializing atlascode!');
    }

    const elapsed = process.hrtime(start);
    const elapsedMs = elapsed[0] * 1e3 + elapsed[1] / 1e6;
    telemetry.Reporter.trackEvent(
        'activated',
        {},
        { activateTimeMs: elapsedMs }
    );

    Logger.log(
        `${extensionOutputChannelName} (v${version}) activated ${
            GlyphChars.Dot
        } ${Strings.getDurationMilliseconds(start)} ms`
    );

    await cacheWorkspace();
}

// this method is called when your extension is deactivated
export async function deactivate(): Promise<any> {
    Logger.configure(null);

    return await telemetry.deactivate();
}
