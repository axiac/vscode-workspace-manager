import { Command, Commands } from '../common';
import { AbstractCommand } from '../abstractCommand';
import { cacheWorkspace } from '../../util/cacheWorkspace';

@Command()
export class CacheWorkspace extends AbstractCommand {
    constructor() {
        super(Commands.CacheWorkspace);
    }

    async execute() {
        return await cacheWorkspace();
    }
}
